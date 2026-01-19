import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Alert,
    Modal,
    FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOffline } from '../../contexts/OfflineContext';
import { Loading, Button, Card } from '../../components/common';
import partidoService from '../../services/partidoService';
import { COLORS, MATCH_STATUS, EVENT_TYPES, EVENT_TYPE_LABELS } from '../../utils/constants';
import { formatTimer } from '../../utils/helpers';

const PartidoEnVivoScreen = ({ route, navigation }) => {
    const { partidoId } = route.params;
    const { isOnline, addToSyncQueue } = useOffline();

    const [partido, setPartido] = useState(null);
    const [loading, setLoading] = useState(true);
    const [eventos, setEventos] = useState([]);

    // Estado del cronómetro
    const [isRunning, setIsRunning] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [currentHalf, setCurrentHalf] = useState(1);
    const intervalRef = useRef(null);

    // Modal para registrar eventos
    const [modalVisible, setModalVisible] = useState(false);
    const [eventType, setEventType] = useState(null);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    useEffect(() => {
        loadPartido();
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [partidoId]);

    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(() => {
                setSeconds(prev => prev + 1);
            }, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning]);

    // Sincronizar tiempo con la base de datos cada 60 segundos (1 minuto)
    useEffect(() => {
        if (isRunning && seconds > 0 && seconds % 60 === 0) {
            // Guardar tiempo en la DB para que otros usuarios lo vean
            partidoService.actualizarPartido(partidoId, {
                segundos_jugados: seconds,
                tiempo_actual: currentHalf
            }).catch(err => console.log('Error syncing time:', err));
        }
    }, [seconds, isRunning, partidoId, currentHalf]);

    const loadPartido = async () => {
        try {
            const data = await partidoService.getPartidoById(partidoId);
            setPartido(data);
            setEventos(data.eventos || []);

            // Restaurar estado del cronómetro si el partido está en juego
            if (data.estado === MATCH_STATUS.EN_JUEGO) {
                setIsRunning(true);
                setSeconds(data.segundos_jugados || 0);
                setCurrentHalf(data.tiempo_actual || 1);
            } else if (data.estado === MATCH_STATUS.PAUSADO) {
                setSeconds(data.segundos_jugados || 0);
                setCurrentHalf(data.tiempo_actual || 1);
            }
        } catch (error) {
            console.error('Error loading partido:', error);
            Alert.alert('Error', 'No se pudo cargar el partido');
        } finally {
            setLoading(false);
        }
    };

    const handleStartMatch = async () => {
        try {
            await partidoService.iniciarPartido(partidoId);
            setIsRunning(true);
            setCurrentHalf(1);
            setSeconds(0);
            setPartido(prev => ({ ...prev, estado: MATCH_STATUS.EN_JUEGO }));
        } catch (error) {
            console.error('Error starting match:', error);
            Alert.alert('Error', 'No se pudo iniciar el partido');
        }
    };

    const handlePauseResume = async () => {
        try {
            if (isRunning) {
                await partidoService.pausarPartido(partidoId, seconds);
                setIsRunning(false);
                setPartido(prev => ({ ...prev, estado: MATCH_STATUS.PAUSADO }));
            } else {
                await partidoService.reanudarPartido(partidoId);
                setIsRunning(true);
                setPartido(prev => ({ ...prev, estado: MATCH_STATUS.EN_JUEGO }));
            }
        } catch (error) {
            console.error('Error pausing/resuming:', error);
        }
    };

    const handleEndHalf = () => {
        Alert.alert(
            currentHalf === 1 ? 'Fin del Primer Tiempo' : 'Finalizar Partido',
            currentHalf === 1
                ? '¿Deseas terminar el primer tiempo?'
                : '¿Estás seguro de que deseas finalizar el partido?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar',
                    onPress: async () => {
                        setIsRunning(false);
                        if (currentHalf === 1) {
                            setCurrentHalf(2);
                            setSeconds(0);
                            Alert.alert('Medio Tiempo', 'Presiona Iniciar cuando comience el segundo tiempo');
                        } else {
                            // Finalizar partido
                            try {
                                await partidoService.finalizarPartido(partidoId, seconds);
                                Alert.alert(
                                    'Partido Finalizado',
                                    `Resultado final: ${partido.equipo_local.nombre} ${partido.goles_local} - ${partido.goles_visitante} ${partido.equipo_visitante.nombre}`,
                                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                                );
                            } catch (error) {
                                console.error('Error finalizing match:', error);
                                Alert.alert('Error', 'No se pudo finalizar el partido');
                            }
                        }
                    },
                },
            ]
        );
    };

    const handleStartSecondHalf = async () => {
        try {
            await partidoService.iniciarSegundoTiempo(partidoId);
            setIsRunning(true);
            setPartido(prev => ({ ...prev, estado: MATCH_STATUS.EN_JUEGO, tiempo_actual: 2 }));
        } catch (error) {
            console.error('Error starting second half:', error);
        }
    };

    const openEventModal = (type) => {
        setEventType(type);
        setSelectedTeam(null);
        setSelectedPlayer(null);
        setModalVisible(true);
    };

    const handleRegisterEvent = async () => {
        if (!selectedTeam || !selectedPlayer) {
            Alert.alert('Error', 'Selecciona el equipo y el jugador');
            return;
        }

        try {
            const minuto = Math.floor(seconds / 60);
            const segundo = seconds % 60;

            const eventoData = {
                partido_id: partidoId,
                jugador_id: selectedPlayer.id,
                equipo_id: selectedTeam.id,
                tipo: eventType,
                tiempo: currentHalf,
                minuto,
                segundo,
            };

            // Si no hay conexión, agregar a cola de sincronización
            if (!isOnline) {
                await addToSyncQueue({
                    table: 'eventos_partido',
                    operation: 'INSERT',
                    data: eventoData,
                });

                // Actualizar UI localmente
                setEventos(prev => [...prev, { ...eventoData, jugador: selectedPlayer }]);

                if ([EVENT_TYPES.GOL, EVENT_TYPES.GOL_PENAL].includes(eventType)) {
                    const isLocal = selectedTeam.id === partido.equipo_local.id;
                    setPartido(prev => ({
                        ...prev,
                        goles_local: isLocal ? prev.goles_local + 1 : prev.goles_local,
                        goles_visitante: !isLocal ? prev.goles_visitante + 1 : prev.goles_visitante,
                    }));
                }
            } else {
                const nuevoEvento = await partidoService.registrarEvento(eventoData);
                setEventos(prev => [...prev, nuevoEvento]);

                // Recargar partido para actualizar marcador
                const updatedPartido = await partidoService.getPartidoById(partidoId);
                setPartido(updatedPartido);
            }

            setModalVisible(false);
            setEventType(null);
            setSelectedTeam(null);
            setSelectedPlayer(null);
        } catch (error) {
            console.error('Error registering event:', error);
            Alert.alert('Error', 'No se pudo registrar el evento');
        }
    };

    const handleDeleteEvent = (evento) => {
        Alert.alert(
            'Eliminar Evento',
            `¿Eliminar este evento?\n${EVENT_TYPE_LABELS[evento.tipo] || evento.tipo} - ${evento.jugador?.nombre || ''}`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await partidoService.eliminarEvento(evento.id);
                            setEventos(prev => prev.filter(e => e.id !== evento.id));
                            // Recargar partido para actualizar marcador
                            const updatedPartido = await partidoService.getPartidoById(partidoId);
                            setPartido(updatedPartido);
                        } catch (error) {
                            console.error('Error deleting event:', error);
                            Alert.alert('Error', 'No se pudo eliminar el evento');
                        }
                    },
                },
            ]
        );
    };
    const getEventIcon = (tipo) => {
        switch (tipo) {
            case EVENT_TYPES.GOL:
            case EVENT_TYPES.GOL_PENAL:
                return { name: 'football', color: COLORS.success };
            case EVENT_TYPES.AUTOGOL:
                return { name: 'football-outline', color: '#FF6B35' }; // Naranja
            case EVENT_TYPES.TARJETA_AMARILLA:
                return { name: 'card', color: COLORS.yellowCard };
            case EVENT_TYPES.TARJETA_AZUL:
                return { name: 'card', color: COLORS.blueCard };
            case EVENT_TYPES.TARJETA_ROJA:
            case EVENT_TYPES.DOBLE_AMARILLA:
                return { name: 'card', color: COLORS.redCard };
            case EVENT_TYPES.FALTA:
                return { name: 'warning', color: COLORS.warning };
            default:
                return { name: 'ellipse', color: COLORS.textSecondary };
        }
    };

    if (loading) {
        return <Loading message="Cargando partido..." />;
    }

    if (!partido) {
        return (
            <SafeAreaView style={styles.container}>
                <Text>No se pudo cargar el partido</Text>
            </SafeAreaView>
        );
    }

    const isMatchStarted = [MATCH_STATUS.EN_JUEGO, MATCH_STATUS.PAUSADO, MATCH_STATUS.MEDIO_TIEMPO].includes(partido.estado);
    const isMatchFinished = partido.estado === MATCH_STATUS.FINALIZADO;
    const maxMinutes = partido.torneo?.duracion_tiempo_minutos || 20;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {isMatchFinished ? 'Resumen' : 'Partido en Vivo'}
                    </Text>
                    {!isOnline && (
                        <View style={styles.offlineBadge}>
                            <Ionicons name="cloud-offline" size={16} color={COLORS.warning} />
                        </View>
                    )}
                </View>

                {/* Marcador */}
                <Card style={styles.scoreCard}>
                    <View style={styles.scoreContainer}>
                        {/* Equipo Local */}
                        <View style={styles.teamScore}>
                            <View style={[styles.teamBadge, { backgroundColor: partido.equipo_local.color_principal || COLORS.primary }]}>
                                <Ionicons name="shield" size={24} color={COLORS.textOnPrimary} />
                            </View>
                            <Text style={styles.teamName} numberOfLines={2}>
                                {partido.equipo_local.nombre_corto || partido.equipo_local.nombre}
                            </Text>
                            <Text style={styles.score}>{partido.goles_local}</Text>
                        </View>

                        {/* Centro - Cronómetro */}
                        <View style={styles.centerScore}>
                            <View style={[styles.halfBadge, isMatchStarted && styles.halfBadgeActive]}>
                                <Text style={styles.halfText}>
                                    {currentHalf === 1 ? '1T' : '2T'}
                                </Text>
                            </View>
                            <Text style={styles.timer}>{formatTimer(seconds)}</Text>
                            <Text style={styles.maxTime}>/ {maxMinutes}:00</Text>
                        </View>

                        {/* Equipo Visitante */}
                        <View style={styles.teamScore}>
                            <View style={[styles.teamBadge, { backgroundColor: partido.equipo_visitante.color_principal || COLORS.secondary }]}>
                                <Ionicons name="shield" size={24} color={COLORS.textOnPrimary} />
                            </View>
                            <Text style={styles.teamName} numberOfLines={2}>
                                {partido.equipo_visitante.nombre_corto || partido.equipo_visitante.nombre}
                            </Text>
                            <Text style={styles.score}>{partido.goles_visitante}</Text>
                        </View>
                    </View>
                </Card>

                {/* Controles del cronómetro */}
                {!isMatchFinished && (
                    <View style={styles.controls}>
                        {!isMatchStarted ? (
                            <Button
                                title="Iniciar Partido"
                                onPress={handleStartMatch}
                                icon={<Ionicons name="play" size={20} color={COLORS.textOnPrimary} />}
                            />
                        ) : currentHalf === 2 && !isRunning && seconds === 0 ? (
                            <Button
                                title="Iniciar 2do Tiempo"
                                onPress={handleStartSecondHalf}
                                icon={<Ionicons name="play" size={20} color={COLORS.textOnPrimary} />}
                            />
                        ) : (
                            <View style={styles.controlButtons}>
                                <TouchableOpacity
                                    style={[styles.controlButton, isRunning ? styles.pauseButton : styles.playButton]}
                                    onPress={handlePauseResume}
                                >
                                    <Ionicons
                                        name={isRunning ? 'pause' : 'play'}
                                        size={28}
                                        color={COLORS.textOnPrimary}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.controlButton, styles.endButton]}
                                    onPress={handleEndHalf}
                                >
                                    <Ionicons name="stop" size={28} color={COLORS.textOnPrimary} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}

                {/* Botones de eventos */}
                {isMatchStarted && !isMatchFinished && (
                    <View style={styles.eventButtons}>
                        <TouchableOpacity
                            style={[styles.eventButton, styles.goalButton]}
                            onPress={() => openEventModal(EVENT_TYPES.GOL)}
                        >
                            <Ionicons name="football" size={24} color={COLORS.textOnPrimary} />
                            <Text style={styles.eventButtonText}>Gol</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.eventButton, styles.autogolButton]}
                            onPress={() => openEventModal(EVENT_TYPES.AUTOGOL)}
                        >
                            <Ionicons name="football-outline" size={24} color={COLORS.textOnPrimary} />
                            <Text style={styles.eventButtonText}>Autogol</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.eventButton, styles.yellowButton]}
                            onPress={() => openEventModal(EVENT_TYPES.TARJETA_AMARILLA)}
                        >
                            <View style={styles.yellowCard} />
                            <Text style={styles.eventButtonText}>Amarilla</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.eventButton, styles.blueButton]}
                            onPress={() => openEventModal(EVENT_TYPES.TARJETA_AZUL)}
                        >
                            <View style={styles.blueCard} />
                            <Text style={styles.eventButtonText}>Azul</Text>
                        </TouchableOpacity>


                        <TouchableOpacity
                            style={[styles.eventButton, styles.foulButton]}
                            onPress={() => openEventModal(EVENT_TYPES.FALTA)}
                        >
                            <Ionicons name="warning" size={24} color={COLORS.textOnPrimary} />
                            <Text style={styles.eventButtonText}>Falta</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Lista de eventos */}
                <View style={styles.eventsSection}>
                    <Text style={styles.sectionTitle}>Eventos del Partido</Text>
                    {eventos.length === 0 ? (
                        <Text style={styles.noEvents}>No hay eventos registrados</Text>
                    ) : (
                        eventos.map((evento, index) => {
                            const icon = getEventIcon(evento.tipo);
                            return (
                                <View key={evento.id || index} style={styles.eventItem}>
                                    <Text style={styles.eventTime}>
                                        {evento.minuto}'{evento.tiempo === 2 ? ' (2T)' : ''}
                                    </Text>
                                    <Ionicons name={icon.name} size={20} color={icon.color} />
                                    <Text style={styles.eventPlayer}>
                                        {evento.jugador?.nombre} {evento.jugador?.apellido}
                                    </Text>
                                    <Text style={styles.eventType}>
                                        {EVENT_TYPE_LABELS[evento.tipo] || evento.tipo}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.deleteEventBtn}
                                        onPress={() => handleDeleteEvent(evento)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                                    </TouchableOpacity>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {/* Modal para registrar eventos */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {EVENT_TYPE_LABELS[eventType] || 'Registrar Evento'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalLabel}>Selecciona el equipo:</Text>
                        <View style={styles.teamSelection}>
                            <TouchableOpacity
                                style={[
                                    styles.teamOption,
                                    selectedTeam?.id === partido.equipo_local.id && styles.teamOptionSelected,
                                ]}
                                onPress={() => setSelectedTeam(partido.equipo_local)}
                            >
                                <Text style={styles.teamOptionText}>{partido.equipo_local.nombre}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.teamOption,
                                    selectedTeam?.id === partido.equipo_visitante.id && styles.teamOptionSelected,
                                ]}
                                onPress={() => setSelectedTeam(partido.equipo_visitante)}
                            >
                                <Text style={styles.teamOptionText}>{partido.equipo_visitante.nombre}</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedTeam && (
                            <>
                                <Text style={styles.modalLabel}>Selecciona el jugador:</Text>
                                <FlatList
                                    data={selectedTeam.jugadores || []}
                                    keyExtractor={(item) => item.id}
                                    style={styles.playerList}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={[
                                                styles.playerOption,
                                                selectedPlayer?.id === item.id && styles.playerOptionSelected,
                                            ]}
                                            onPress={() => setSelectedPlayer(item)}
                                        >
                                            <Text style={styles.playerNumber}>#{item.numero_camiseta}</Text>
                                            <Text style={styles.playerName}>
                                                {item.nombre} {item.apellido}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                    ListEmptyComponent={
                                        <Text style={styles.noPlayers}>No hay jugadores registrados</Text>
                                    }
                                />
                            </>
                        )}

                        <Button
                            title="Registrar"
                            onPress={handleRegisterEvent}
                            disabled={!selectedTeam || !selectedPlayer}
                            style={styles.modalButton}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginLeft: 16,
    },
    offlineBadge: {
        padding: 8,
        backgroundColor: '#FFF3E0',
        borderRadius: 20,
    },
    scoreCard: {
        marginBottom: 16,
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    teamScore: {
        flex: 1,
        alignItems: 'center',
    },
    teamBadge: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    teamName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginTop: 8,
        height: 36,
    },
    score: {
        fontSize: 48,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    centerScore: {
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    halfBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: COLORS.surfaceVariant,
        borderRadius: 12,
    },
    halfBadgeActive: {
        backgroundColor: COLORS.success,
    },
    halfText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textOnPrimary,
    },
    timer: {
        fontSize: 36,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginTop: 8,
    },
    maxTime: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    controls: {
        marginBottom: 16,
    },
    controlButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    controlButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    playButton: {
        backgroundColor: COLORS.success,
    },
    pauseButton: {
        backgroundColor: COLORS.warning,
    },
    endButton: {
        backgroundColor: COLORS.error,
    },
    eventButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 24,
    },
    eventButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 70,
        height: 70,
        borderRadius: 35,
    },
    eventButtonText: {
        fontSize: 11,
        color: COLORS.textOnPrimary,
        marginTop: 4,
        fontWeight: '600',
    },
    goalButton: {
        backgroundColor: COLORS.success,
    },
    autogolButton: {
        backgroundColor: '#FF6B35', // Naranja para distinguir del gol normal
    },
    yellowButton: {
        backgroundColor: '#FBC02D',
    },
    redButton: {
        backgroundColor: COLORS.error,
    },
    foulButton: {
        backgroundColor: COLORS.warning,
    },
    yellowCard: {
        width: 20,
        height: 28,
        backgroundColor: COLORS.yellowCard,
        borderRadius: 2,
    },
    redCard: {
        width: 20,
        height: 28,
        backgroundColor: COLORS.redCard,
        borderRadius: 2,
    },
    blueCard: {
        width: 20,
        height: 28,
        backgroundColor: COLORS.blueCard,
        borderRadius: 2,
    },
    blueButton: {
        backgroundColor: '#1976D2',
    },
    eventsSection: {
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 12,
    },
    noEvents: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        paddingVertical: 24,
    },
    eventItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    eventTime: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textPrimary,
        width: 50,
    },
    eventPlayer: {
        flex: 1,
        fontSize: 14,
        color: COLORS.textPrimary,
        marginLeft: 12,
    },
    eventType: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    modalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: 8,
        marginTop: 12,
    },
    teamSelection: {
        flexDirection: 'row',
    },
    teamOption: {
        flex: 1,
        padding: 12,
        backgroundColor: COLORS.surfaceVariant,
        borderRadius: 8,
        marginHorizontal: 4,
        alignItems: 'center',
    },
    teamOptionSelected: {
        backgroundColor: COLORS.primary,
    },
    teamOptionText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    playerList: {
        maxHeight: 200,
    },
    playerOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: COLORS.background,
        borderRadius: 8,
        marginBottom: 8,
    },
    playerOptionSelected: {
        backgroundColor: COLORS.primaryLight,
    },
    playerNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
        width: 40,
    },
    playerName: {
        fontSize: 14,
        color: COLORS.textPrimary,
    },
    noPlayers: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        paddingVertical: 20,
    },
    modalButton: {
        marginTop: 20,
    },
    deleteEventBtn: {
        padding: 8,
        marginLeft: 8,
    },
});

export default PartidoEnVivoScreen;
