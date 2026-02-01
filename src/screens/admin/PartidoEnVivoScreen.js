import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Modal,
    ScrollView,
    FlatList,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOffline } from '../../contexts/OfflineContext';
import { Loading, Button, Card } from '../../components/common';
import partidoService from '../../services/partidoService';
import offlineMatchService from '../../services/offlineMatchService';
import { COLORS, MATCH_STATUS, EVENT_TYPES, EVENT_TYPE_LABELS } from '../../utils/constants';
import { formatTimer } from '../../utils/helpers';

const PartidoEnVivoScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { partidoId } = route.params;
    const { isOnline, addToSyncQueue } = useOffline();

    const [partido, setPartido] = useState(null);
    const [loading, setLoading] = useState(true);
    const [eventos, setEventos] = useState([]);
    const [pendingEventsCount, setPendingEventsCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

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

    // Modal para penales (eliminación directa)
    const [penalesModalVisible, setPenalesModalVisible] = useState(false);
    const [penalesLocal, setPenalesLocal] = useState('0');
    const [penalesVisitante, setPenalesVisitante] = useState('0');

    useEffect(() => {
        loadPartido();
        loadPendingCount();
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [partidoId]);

    // Cargar conteo de eventos pendientes
    const loadPendingCount = async () => {
        const count = await offlineMatchService.getPendingCount();
        setPendingEventsCount(count);
    };

    // Sincronizar cuando vuelva internet
    useEffect(() => {
        if (isOnline && pendingEventsCount > 0) {
            syncPendingData();
        }
    }, [isOnline]);

    // Sincronizar datos pendientes
    const syncPendingData = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            console.log('Iniciando sincronización...');
            const results = await offlineMatchService.syncPendingData();
            console.log('Sincronización completada:', results);

            // Recargar partido para obtener datos actualizados
            await loadPartido();
            await loadPendingCount();

            if (results.eventsSync.success > 0 || results.matchUpdatesSync.success > 0) {
                Alert.alert(
                    'Sincronización Exitosa',
                    `Se sincronizaron ${results.eventsSync.success} eventos y ${results.matchUpdatesSync.success} actualizaciones.`
                );
            }
        } catch (error) {
            console.error('Error en sincronización:', error);
        } finally {
            setIsSyncing(false);
        }
    };

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

    // Sincronizar tiempo con la base de datos cada 10 segundos (solo si hay internet)
    useEffect(() => {
        if (isRunning && seconds > 0 && seconds % 10 === 0) {
            if (isOnline) {
                // Guardar tiempo en la DB para que otros usuarios lo vean
                console.log('Sincronizando tiempo a DB:', seconds);
                partidoService.actualizarPartido(partidoId, {
                    segundos_jugados: seconds,
                    tiempo_actual: currentHalf
                }).catch(err => console.log('Error syncing time:', err));
            } else {
                // Guardar tiempo localmente
                offlineMatchService.saveMatchUpdateOffline(partidoId, {
                    segundos_jugados: seconds,
                    tiempo_actual: currentHalf,
                    estado: MATCH_STATUS.EN_JUEGO
                });
                loadPendingCount();
            }
        }
    }, [seconds, isRunning, partidoId, currentHalf, isOnline]);

    const loadPartido = async () => {
        try {
            const data = await partidoService.getPartidoById(partidoId);
            setPartido(data);
            // Ordenar eventos: más recientes primero
            const sortedEventos = (data.eventos || []).sort((a, b) => {
                // Primero por tiempo (2T antes que 1T si es más reciente)
                if (b.tiempo !== a.tiempo) return b.tiempo - a.tiempo;
                // Luego por minuto descendente
                return b.minuto - a.minuto;
            });
            setEventos(sortedEventos);

            console.log('=== DEBUG TIMER ===');
            console.log('Estado partido:', data.estado);
            console.log('tiempo_inicio_real:', data.tiempo_inicio_real);
            console.log('segundos_jugados guardados:', data.segundos_jugados);

            // Restaurar estado del cronómetro si el partido está en juego
            if (data.estado === MATCH_STATUS.EN_JUEGO) {
                setIsRunning(true);
                setCurrentHalf(data.tiempo_actual || 1);

                // Calcular segundos transcurridos desde tiempo_inicio_real
                if (data.tiempo_inicio_real) {
                    const startTime = new Date(data.tiempo_inicio_real).getTime();
                    const now = Date.now();
                    const elapsedSeconds = Math.floor((now - startTime) / 1000);
                    const finalSeconds = Math.max(elapsedSeconds, data.segundos_jugados || 0);
                    console.log('startTime:', startTime);
                    console.log('now:', now);
                    console.log('elapsedSeconds calculados:', elapsedSeconds);
                    console.log('finalSeconds a usar:', finalSeconds);
                    setSeconds(finalSeconds);
                } else {
                    console.log('NO HAY tiempo_inicio_real, usando segundos_jugados');
                    setSeconds(data.segundos_jugados || 0);
                }
            } else if (data.estado === MATCH_STATUS.PAUSADO || data.estado === MATCH_STATUS.MEDIO_TIEMPO) {
                console.log('Partido pausado/medio tiempo, usando segundos_jugados:', data.segundos_jugados);
                setSeconds(data.segundos_jugados || 0);
                setCurrentHalf(data.tiempo_actual || 1);
            }
            console.log('===================');
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
                await partidoService.reanudarPartido(partidoId, seconds);
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
                            // Verificar si es partido de eliminación y está empatado
                            const isKnockout = partido.fase && partido.fase !== 'grupos';
                            const isTied = partido.goles_local === partido.goles_visitante;

                            if (isKnockout && isTied) {
                                // Mostrar modal de penales
                                setPenalesLocal('0');
                                setPenalesVisitante('0');
                                setPenalesModalVisible(true);
                            } else {
                                // Finalizar normalmente
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
                        }
                    },
                },
            ]
        );
    };

    const handleFinalizarConPenales = async () => {
        const penL = parseInt(penalesLocal) || 0;
        const penV = parseInt(penalesVisitante) || 0;

        if (penL === penV) {
            Alert.alert('Error', 'Los penales no pueden terminar empatados');
            return;
        }

        try {
            await partidoService.finalizarConPenales(partidoId, seconds, penL, penV);
            setPenalesModalVisible(false);
            const ganador = penL > penV ? partido.equipo_local.nombre : partido.equipo_visitante.nombre;
            Alert.alert(
                'Partido Finalizado',
                `Resultado: ${partido.equipo_local.nombre} ${partido.goles_local} (${penL}) - (${penV}) ${partido.goles_visitante} ${partido.equipo_visitante.nombre}\n\nGanador por penales: ${ganador}`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.error('Error finalizing with penalties:', error);
            Alert.alert('Error', 'No se pudo finalizar el partido');
        }
    };

    const handleStartSecondHalf = async () => {
        try {
            await partidoService.iniciarSegundoTiempo(partidoId, seconds);
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

            // Si no hay conexión, guardar offline
            if (!isOnline) {
                // Usar el nuevo servicio offline
                const offlineEvent = await offlineMatchService.saveEventOffline(eventoData);
                console.log('Evento guardado offline:', offlineEvent.offlineId);

                // Actualizar UI localmente
                const localEvento = {
                    ...eventoData,
                    id: offlineEvent.offlineId, // ID temporal
                    jugador: selectedPlayer,
                    isOffline: true, // Marcador para identificar eventos offline
                };
                setEventos(prev => [localEvento, ...prev]);

                // Actualizar marcador localmente si es gol
                if ([EVENT_TYPES.GOL, EVENT_TYPES.GOL_PENAL].includes(eventType)) {
                    const isLocal = selectedTeam.id === partido.equipo_local.id;
                    setPartido(prev => ({
                        ...prev,
                        goles_local: isLocal ? prev.goles_local + 1 : prev.goles_local,
                        goles_visitante: !isLocal ? prev.goles_visitante + 1 : prev.goles_visitante,
                    }));
                } else if (eventType === EVENT_TYPES.AUTOGOL) {
                    // Autogol cuenta para el equipo contrario
                    const isLocal = selectedTeam.id === partido.equipo_local.id;
                    setPartido(prev => ({
                        ...prev,
                        goles_local: !isLocal ? prev.goles_local + 1 : prev.goles_local,
                        goles_visitante: isLocal ? prev.goles_visitante + 1 : prev.goles_visitante,
                    }));
                }

                // Actualizar conteo de pendientes
                await loadPendingCount();

                // Notificar al usuario
                Alert.alert(
                    '📴 Guardado Offline',
                    'El evento se guardó localmente y se sincronizará cuando tengas internet.',
                    [{ text: 'OK' }]
                );
            } else {
                const nuevoEvento = await partidoService.registrarEvento(eventoData);

                // Recargar partido para actualizar marcador y sincronizar eventos
                const updatedPartido = await partidoService.getPartidoById(partidoId);
                setPartido(updatedPartido);

                // Ordenar eventos: más recientes primero
                const sortedEventos = (updatedPartido.eventos || []).sort((a, b) => {
                    if (b.tiempo !== a.tiempo) return b.tiempo - a.tiempo;
                    return b.minuto - a.minuto;
                });
                setEventos(sortedEventos);
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
                            console.log('Eliminando evento ID:', evento.id);
                            await partidoService.eliminarEvento(evento.id);
                            console.log('Evento eliminado exitosamente');

                            // Recargar partido para actualizar marcador y sincronizar eventos
                            const updatedPartido = await partidoService.getPartidoById(partidoId);
                            console.log('Eventos después de eliminar:', updatedPartido.eventos?.length);

                            setPartido(updatedPartido);

                            // Ordenar eventos: más recientes primero
                            const sortedEventos = (updatedPartido.eventos || []).sort((a, b) => {
                                if (b.tiempo !== a.tiempo) return b.tiempo - a.tiempo;
                                return b.minuto - a.minuto;
                            });
                            setEventos(sortedEventos);

                            Alert.alert('Éxito', 'Evento eliminado correctamente');
                        } catch (error) {
                            console.error('Error deleting event:', error);
                            Alert.alert('Error', 'No se pudo eliminar el evento: ' + error.message);
                        }
                    },
                },
            ]
        );
    };

    const handleWalkover = () => {
        if (!partido) return;

        Alert.alert(
            'Ganar por W.O.',
            '¿Qué equipo gana por W.O. (Walkover)?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: partido.equipo_local.nombre_corto || 'Local',
                    onPress: () => confirmarWalkover('local'),
                },
                {
                    text: partido.equipo_visitante.nombre_corto || 'Visitante',
                    onPress: () => confirmarWalkover('visitante'),
                },
            ]
        );
    };

    const confirmarWalkover = async (ganador) => {
        try {
            // Obtener configuración de W.O. del torneo
            const golesGanador = partido.torneo?.goles_wo_ganador ?? 3;
            const golesPerdedor = partido.torneo?.goles_wo_perdedor ?? 0;

            // Actualizar marcador según ganador
            const goles_local = ganador === 'local' ? golesGanador : golesPerdedor;
            const goles_visitante = ganador === 'visitante' ? golesGanador : golesPerdedor;

            await partidoService.actualizarPartido(partidoId, {
                goles_local,
                goles_visitante,
                estado: MATCH_STATUS.FINALIZADO,
                observaciones: `Partido ganado por W.O. - ${ganador === 'local' ? partido.equipo_local.nombre : partido.equipo_visitante.nombre}`,
            });

            // Actualizar estadísticas de equipos
            await partidoService.finalizarPartido(partidoId, 0);

            Alert.alert(
                'W.O. Registrado',
                `${ganador === 'local' ? partido.equipo_local.nombre : partido.equipo_visitante.nombre} gana por W.O. (${golesGanador}-${golesPerdedor})`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.error('Error processing walkover:', error);
            Alert.alert('Error', 'No se pudo registrar el W.O.');
        }
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
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Text>No se pudo cargar el partido</Text>
            </View>
        );
    }

    const isMatchStarted = [MATCH_STATUS.EN_JUEGO, MATCH_STATUS.PAUSADO, MATCH_STATUS.MEDIO_TIEMPO].includes(partido.estado);
    const isMatchFinished = partido.estado === MATCH_STATUS.FINALIZADO;
    const maxMinutes = partido.torneo?.duracion_tiempo_minutos || 20;

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {isMatchFinished ? 'Resumen' : 'Partido en Vivo'}
                    </Text>
                    <View style={styles.headerRight}>
                        {/* Indicador de eventos pendientes */}
                        {pendingEventsCount > 0 && (
                            <TouchableOpacity
                                style={styles.pendingBadge}
                                onPress={isOnline ? syncPendingData : null}
                            >
                                <Ionicons
                                    name={isSyncing ? "sync" : "cloud-upload"}
                                    size={16}
                                    color={COLORS.textOnPrimary}
                                />
                                <Text style={styles.pendingText}>{pendingEventsCount}</Text>
                            </TouchableOpacity>
                        )}
                        {/* Badge offline */}
                        {!isOnline && (
                            <View style={styles.offlineBadge}>
                                <Ionicons name="cloud-offline" size={16} color={COLORS.warning} />
                            </View>
                        )}
                    </View>
                </View>

                {/* Marcador */}
                <Card style={styles.scoreCard}>
                    <View style={styles.scoreContainer}>
                        {/* Equipo Local */}
                        <View style={styles.teamScore}>
                            {/* Logo equipo local */}
                            {partido.equipo_local.logo_url ? (
                                <Image source={{ uri: partido.equipo_local.logo_url }} style={styles.teamLogo} />
                            ) : (
                                <View style={[styles.teamBadge, { backgroundColor: partido.equipo_local.color_principal || COLORS.primary }]}>
                                    <Ionicons name="shield" size={24} color={COLORS.textOnPrimary} />
                                </View>
                            )}
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
                            {/* Logo equipo visitante */}
                            {partido.equipo_visitante.logo_url ? (
                                <Image source={{ uri: partido.equipo_visitante.logo_url }} style={styles.teamLogo} />
                            ) : (
                                <View style={[styles.teamBadge, { backgroundColor: partido.equipo_visitante.color_principal || COLORS.secondary }]}>
                                    <Ionicons name="shield" size={24} color={COLORS.textOnPrimary} />
                                </View>
                            )}
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
                            <View style={styles.startMatchRow}>
                                <Button
                                    title="Iniciar Partido"
                                    onPress={handleStartMatch}
                                    icon={<Ionicons name="play" size={20} color={COLORS.textOnPrimary} />}
                                    style={{ flex: 1, marginRight: 8 }}
                                />
                                <TouchableOpacity
                                    style={styles.woButton}
                                    onPress={handleWalkover}
                                >
                                    <Ionicons name="ban" size={20} color={COLORS.error} />
                                    <Text style={styles.woButtonText}>W.O.</Text>
                                </TouchableOpacity>
                            </View>
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
                                        {evento.minuto}' ({evento.tiempo === 2 ? '2T' : '1T'})
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

            {/* Modal de Penales */}
            <Modal
                visible={penalesModalVisible}
                transparent
                animationType="slide"
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>🥅 Tanda de Penales</Text>
                        <Text style={styles.modalSubtitle}>El partido terminó empatado. Ingresa el resultado de los penales:</Text>

                        <View style={styles.penalesContainer}>
                            <View style={styles.penalTeam}>
                                <Text style={styles.penalTeamName}>{partido?.equipo_local?.nombre_corto || partido?.equipo_local?.nombre}</Text>
                                <View style={styles.penalInputContainer}>
                                    <TouchableOpacity
                                        style={styles.penalBtn}
                                        onPress={() => setPenalesLocal(String(Math.max(0, parseInt(penalesLocal) - 1)))}
                                    >
                                        <Ionicons name="remove" size={24} color={COLORS.textPrimary} />
                                    </TouchableOpacity>
                                    <Text style={styles.penalValue}>{penalesLocal}</Text>
                                    <TouchableOpacity
                                        style={styles.penalBtn}
                                        onPress={() => setPenalesLocal(String(parseInt(penalesLocal) + 1))}
                                    >
                                        <Ionicons name="add" size={24} color={COLORS.textPrimary} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <Text style={styles.penalVs}>vs</Text>

                            <View style={styles.penalTeam}>
                                <Text style={styles.penalTeamName}>{partido?.equipo_visitante?.nombre_corto || partido?.equipo_visitante?.nombre}</Text>
                                <View style={styles.penalInputContainer}>
                                    <TouchableOpacity
                                        style={styles.penalBtn}
                                        onPress={() => setPenalesVisitante(String(Math.max(0, parseInt(penalesVisitante) - 1)))}
                                    >
                                        <Ionicons name="remove" size={24} color={COLORS.textPrimary} />
                                    </TouchableOpacity>
                                    <Text style={styles.penalValue}>{penalesVisitante}</Text>
                                    <TouchableOpacity
                                        style={styles.penalBtn}
                                        onPress={() => setPenalesVisitante(String(parseInt(penalesVisitante) + 1))}
                                    >
                                        <Ionicons name="add" size={24} color={COLORS.textPrimary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        <View style={styles.penalButtons}>
                            <Button
                                title="Cancelar"
                                variant="secondary"
                                onPress={() => setPenalesModalVisible(false)}
                                style={{ flex: 1, marginRight: 8 }}
                            />
                            <Button
                                title="Finalizar"
                                onPress={handleFinalizarConPenales}
                                style={{ flex: 1, marginLeft: 8 }}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
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
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    pendingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    pendingText: {
        color: COLORS.textOnPrimary,
        fontSize: 12,
        fontWeight: '600',
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
    teamLogo: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.background,
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
    startMatchRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    woButton: {
        backgroundColor: COLORS.surface,
        borderWidth: 2,
        borderColor: COLORS.error,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    woButtonText: {
        color: COLORS.error,
        fontWeight: '700',
        marginLeft: 6,
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
    // Penalty shootout modal styles
    penalesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginVertical: 24,
    },
    penalTeam: {
        alignItems: 'center',
        flex: 1,
    },
    penalTeamName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: 12,
    },
    penalInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    penalBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
    },
    penalValue: {
        fontSize: 36,
        fontWeight: '700',
        color: COLORS.primary,
        marginHorizontal: 16,
        minWidth: 40,
        textAlign: 'center',
    },
    penalVs: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginHorizontal: 8,
    },
    penalButtons: {
        flexDirection: 'row',
        marginTop: 16,
    },
});

export default PartidoEnVivoScreen;
