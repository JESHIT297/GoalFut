import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Loading, Card, Button } from '../../components/common';
import partidoService from '../../services/partidoService';
import equipoService from '../../services/equipoService';
import { COLORS, EVENT_TYPES, MATCH_STATUS, PLAYER_POSITION_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';
import { useRealtimeSubscription, useEventosRealtime } from '../../hooks/useRealtime';

const PartidoDetailScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { partidoId, fromAdmin = false } = route.params; // fromAdmin indica si viene del panel admin
    const { isAdmin, userProfile } = useAuth();

    const [partido, setPartido] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('resumen');
    const [followingLocal, setFollowingLocal] = useState(false);
    const [followingVisitante, setFollowingVisitante] = useState(false); // resumen, local, visitante

    const loadPartido = useCallback(async () => {
        try {
            const data = await partidoService.getPartidoById(partidoId);
            setPartido(data);
        } catch (error) {
            console.error('Error loading partido:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [partidoId]);

    useEffect(() => {
        loadPartido();
    }, [loadPartido]);

    // Recargar datos cuando la pantalla obtiene el foco (para sincronizar eventos eliminados)
    useFocusEffect(
        useCallback(() => {
            loadPartido();
        }, [loadPartido])
    );

    // Cargar estado de seguimiento de equipos
    useEffect(() => {
        const loadFollowStatus = async () => {
            if (!userProfile?.id || !partido) return;

            const [localFollow, visitanteFollow] = await Promise.all([
                equipoService.isFollowingEquipo(userProfile.id, partido.equipo_local_id),
                equipoService.isFollowingEquipo(userProfile.id, partido.equipo_visitante_id),
            ]);

            setFollowingLocal(localFollow);
            setFollowingVisitante(visitanteFollow);
        };
        loadFollowStatus();
    }, [userProfile?.id, partido?.equipo_local_id, partido?.equipo_visitante_id]);

    const handleToggleFollow = async (equipoId, isLocal) => {
        if (!userProfile?.id) {
            Alert.alert('Iniciar sesión', 'Debes iniciar sesión para seguir equipos');
            return;
        }

        try {
            const nowFollowing = await equipoService.toggleSeguirEquipo(userProfile.id, equipoId);
            if (isLocal) {
                setFollowingLocal(nowFollowing);
            } else {
                setFollowingVisitante(nowFollowing);
            }
            Alert.alert(
                nowFollowing ? '¡Siguiendo!' : 'Dejaste de seguir',
                nowFollowing ? 'Recibirás notificaciones de este equipo' : 'Ya no recibirás notificaciones'
            );
        } catch (error) {
            console.error('Error toggling follow:', error);
            Alert.alert('Error', 'No se pudo actualizar el seguimiento');
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadPartido();
    };

    // Suscripción a cambios del partido en tiempo real
    useRealtimeSubscription('partidos', (payload) => {
        console.log('Realtime partido update:', payload.eventType);
        if (payload.new?.id === partidoId || payload.old?.id === partidoId) {
            loadPartido();
        }
    });

    // Suscripción a eventos del partido en tiempo real
    useEventosRealtime(partidoId, (payload) => {
        console.log('Realtime evento update:', payload.eventType, payload);
        loadPartido();
    });

    // Auto-refresh cada 10 segundos para partidos en vivo (respaldo a realtime)
    useEffect(() => {
        if (partido?.estado === MATCH_STATUS.EN_JUEGO ||
            partido?.estado === MATCH_STATUS.PAUSADO ||
            partido?.estado === MATCH_STATUS.MEDIO_TIEMPO) {
            const interval = setInterval(() => {
                loadPartido();
            }, 10000); // 10 segundos
            return () => clearInterval(interval);
        }
    }, [partido?.estado, loadPartido]);

    // Solo mostrar controles admin si viene del panel admin
    const showAdminControls = fromAdmin && isAdmin && partido?.torneo?.admin_id === userProfile?.id;

    const getEventIcon = (tipo) => {
        switch (tipo) {
            case EVENT_TYPES.GOL:
            case EVENT_TYPES.GOL_PENAL:
                return { name: 'football', color: COLORS.success };
            case EVENT_TYPES.AUTOGOL:
                return { name: 'football', color: COLORS.error };
            case EVENT_TYPES.TARJETA_AMARILLA:
                return { name: 'card', color: COLORS.yellowCard };
            case EVENT_TYPES.TARJETA_AZUL:
                return { name: 'card', color: COLORS.blueCard };
            case EVENT_TYPES.TARJETA_ROJA:
            case EVENT_TYPES.DOBLE_AMARILLA:
                return { name: 'card', color: COLORS.redCard };
            case EVENT_TYPES.FALTA:
                return { name: 'warning', color: COLORS.warning };
            case EVENT_TYPES.SUSTITUCION:
                return { name: 'swap-horizontal', color: COLORS.primary };
            default:
                return { name: 'ellipse', color: COLORS.textSecondary };
        }
    };

    // Calcular tiempo transcurrido dinámicamente
    const calcularTiempoTranscurrido = () => {
        if (!partido?.tiempo_inicio_real || partido.estado !== MATCH_STATUS.EN_JUEGO) {
            return partido?.segundos_jugados || 0;
        }
        // Calcular segundos desde el inicio real + segundos previos (pausas)
        const inicio = new Date(partido.tiempo_inicio_real);
        const ahora = new Date();
        const segundosDesdeInicio = Math.floor((ahora - inicio) / 1000);
        return Math.max(0, segundosDesdeInicio);
    };

    const getStatusText = () => {
        if (!partido) return '';
        switch (partido.estado) {
            case MATCH_STATUS.PROGRAMADO:
                return '📅 Programado';
            case MATCH_STATUS.EN_JUEGO:
                const segundosActuales = calcularTiempoTranscurrido();
                const minutos = Math.floor(segundosActuales / 60);
                const segundos = segundosActuales % 60;
                const tiempoStr = `${minutos}:${segundos.toString().padStart(2, '0')}`;
                const halfStr = partido.tiempo_actual === 2 ? '2T' : '1T';
                return `🔴 En Vivo - ${tiempoStr} (${halfStr})`;
            case MATCH_STATUS.PAUSADO:
                const minPausa = Math.floor((partido.segundos_jugados || 0) / 60);
                const segPausa = (partido.segundos_jugados || 0) % 60;
                const tiempoPausa = `${minPausa}:${segPausa.toString().padStart(2, '0')}`;
                const halfPausa = partido.tiempo_actual === 2 ? '2T' : '1T';
                return `⏸️ Pausado - ${tiempoPausa} (${halfPausa})`;
            case MATCH_STATUS.DESCANSO:
            case MATCH_STATUS.MEDIO_TIEMPO:
                const min1T = Math.floor((partido.segundos_jugados || 0) / 60);
                return `⏸️ Medio Tiempo (1T: ${min1T} min)`;
            case MATCH_STATUS.FINALIZADO:
                return '✅ Finalizado';
            default:
                return partido.estado;
        }
    };

    const renderResumen = () => {
        const eventos = partido?.eventos || [];

        // Goles del equipo local:
        // - Goles normales donde equipo_id es local
        // - Autogoles donde equipo_id es visitante (autogol del visitante cuenta para local)
        const golesLocal = eventos.filter(e => {
            if (e.tipo === EVENT_TYPES.GOL || e.tipo === EVENT_TYPES.GOL_PENAL) {
                return e.equipo_id === partido.equipo_local_id;
            }
            if (e.tipo === EVENT_TYPES.AUTOGOL) {
                // Autogol del visitante cuenta para el local
                return e.equipo_id === partido.equipo_visitante_id;
            }
            return false;
        });

        // Goles del equipo visitante:
        // - Goles normales donde equipo_id es visitante
        // - Autogoles donde equipo_id es local (autogol del local cuenta para visitante)
        const golesVisitante = eventos.filter(e => {
            if (e.tipo === EVENT_TYPES.GOL || e.tipo === EVENT_TYPES.GOL_PENAL) {
                return e.equipo_id === partido.equipo_visitante_id;
            }
            if (e.tipo === EVENT_TYPES.AUTOGOL) {
                // Autogol del local cuenta para el visitante
                return e.equipo_id === partido.equipo_local_id;
            }
            return false;
        });

        return (
            <View>
                {/* Marcador Grande */}
                <Card style={styles.scoreCard}>
                    <View style={styles.scoreContainer}>
                        <View style={styles.teamScore}>
                            {/* Logo equipo local */}
                            {partido.equipo_local?.logo_url ? (
                                <Image source={{ uri: partido.equipo_local.logo_url }} style={styles.teamLogo} />
                            ) : (
                                <View style={[styles.teamBadge, { backgroundColor: partido.equipo_local?.color_principal || COLORS.primary }]}>
                                    <Ionicons name="shield" size={24} color="#fff" />
                                </View>
                            )}
                            <Text style={styles.teamName} numberOfLines={2}>
                                {partido.equipo_local?.nombre || 'Local'}
                            </Text>
                        </View>

                        <View style={styles.scoresCenter}>
                            <View style={styles.scores}>
                                <Text style={styles.scoreValue}>{partido.goles_local || 0}</Text>
                                <Text style={styles.scoreSeparator}>-</Text>
                                <Text style={styles.scoreValue}>{partido.goles_visitante || 0}</Text>
                            </View>

                            {/* Mostrar penales si existen */}
                            {partido.penales_local != null && partido.penales_visitante != null && (
                                <View style={styles.penalesContainer}>
                                    <Text style={styles.penalesScore}>({partido.penales_local})</Text>
                                    <Text style={styles.penalesSeparator}>-</Text>
                                    <Text style={styles.penalesScore}>({partido.penales_visitante})</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.teamScore}>
                            {/* Logo equipo visitante */}
                            {partido.equipo_visitante?.logo_url ? (
                                <Image source={{ uri: partido.equipo_visitante.logo_url }} style={styles.teamLogo} />
                            ) : (
                                <View style={[styles.teamBadge, { backgroundColor: partido.equipo_visitante?.color_principal || COLORS.secondary }]}>
                                    <Ionicons name="shield" size={24} color="#fff" />
                                </View>
                            )}
                            <Text style={styles.teamName} numberOfLines={2}>
                                {partido.equipo_visitante?.nombre || 'Visitante'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.statusContainer}>
                        <Text style={styles.statusText}>{getStatusText()}</Text>
                        {partido.fecha && (
                            <Text style={styles.dateText}>
                                {formatDate(partido.fecha)} - {partido.hora || ''}
                            </Text>
                        )}
                    </View>
                </Card>

                {/* Goleadores */}
                {(golesLocal.length > 0 || golesVisitante.length > 0) && (
                    <Card style={styles.goalsCard}>
                        <Text style={styles.sectionTitle}>⚽ Goles</Text>
                        <View style={styles.goalsContainer}>
                            <View style={styles.goalsColumn}>
                                {golesLocal.map((gol, idx) => (
                                    <Text key={idx} style={styles.goalText}>
                                        ⚽ {gol.jugador?.nombre || 'Jugador'} {gol.minuto ? `(${gol.minuto}')` : ''}
                                    </Text>
                                ))}
                            </View>
                            <View style={styles.goalsColumn}>
                                {golesVisitante.map((gol, idx) => (
                                    <Text key={idx} style={[styles.goalText, { textAlign: 'right' }]}>
                                        {gol.jugador?.nombre || 'Jugador'} {gol.minuto ? `(${gol.minuto}')` : ''} ⚽
                                    </Text>
                                ))}
                            </View>
                        </View>
                    </Card>
                )}

                {/* Eventos del partido - Divididos por equipo */}
                <Card style={styles.eventsCard}>
                    <Text style={styles.sectionTitle}>📋 Eventos del Partido</Text>
                    {eventos.length === 0 ? (
                        <Text style={styles.noEventsText}>No hay eventos registrados</Text>
                    ) : (
                        <View style={styles.eventsContainer}>
                            {/* Header de equipos */}
                            <View style={styles.eventsHeader}>
                                <Text style={styles.eventsTeamName} numberOfLines={1}>
                                    {partido.equipo_local?.nombre_corto || partido.equipo_local?.nombre || 'Local'}
                                </Text>
                                <Text style={styles.eventsTimeHeader}>Min</Text>
                                <Text style={[styles.eventsTeamName, { textAlign: 'right' }]} numberOfLines={1}>
                                    {partido.equipo_visitante?.nombre_corto || partido.equipo_visitante?.nombre || 'Visitante'}
                                </Text>
                            </View>

                            {/* Lista de eventos ordenados: más recientes primero */}
                            {eventos.sort((a, b) => {
                                // Primero por tiempo (2T antes que 1T)
                                if ((b.tiempo || 1) !== (a.tiempo || 1)) return (b.tiempo || 1) - (a.tiempo || 1);
                                // Luego por minuto descendente
                                return (b.minuto || 0) - (a.minuto || 0);
                            }).map((evento, index) => {
                                const icon = getEventIcon(evento.tipo);
                                const esLocal = evento.equipo_id === partido.equipo_local_id;

                                return (
                                    <View key={index} style={styles.eventRow}>
                                        {/* Columna izquierda - Local */}
                                        <View style={styles.eventColumnLeft}>
                                            {esLocal && (
                                                <View style={styles.eventContentLeft}>
                                                    <Ionicons name={icon.name} size={16} color={icon.color} />
                                                    <Text style={styles.eventPlayerName} numberOfLines={1}>
                                                        {evento.jugador?.nombre || evento.tipo?.replace('_', ' ')}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Columna central - Minuto */}
                                        <View style={styles.eventTimeColumn}>
                                            <Text style={styles.eventMinuteCenter}>
                                                {evento.minuto ? `${evento.minuto}' (${evento.tiempo === 2 ? '2T' : '1T'})` : '-'}
                                            </Text>
                                        </View>

                                        {/* Columna derecha - Visitante */}
                                        <View style={styles.eventColumnRight}>
                                            {!esLocal && (
                                                <View style={styles.eventContentRight}>
                                                    <Text style={styles.eventPlayerName} numberOfLines={1}>
                                                        {evento.jugador?.nombre || evento.tipo?.replace('_', ' ')}
                                                    </Text>
                                                    <Ionicons name={icon.name} size={16} color={icon.color} />
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </Card>
            </View>
        );
    };

    const renderJugadores = (equipo, jugadores, isLocal) => {
        const eventosEquipo = (partido?.eventos || []).filter(e => e.equipo_id === equipo?.id);
        const isFollowing = isLocal ? followingLocal : followingVisitante;

        const getJugadorStats = (jugadorId) => {
            const goles = eventosEquipo.filter(e =>
                e.jugador_id === jugadorId &&
                (e.tipo === EVENT_TYPES.GOL || e.tipo === EVENT_TYPES.GOL_PENAL)
            ).length;
            const amarillas = eventosEquipo.filter(e =>
                e.jugador_id === jugadorId && e.tipo === EVENT_TYPES.TARJETA_AMARILLA
            ).length;
            const azules = eventosEquipo.filter(e =>
                e.jugador_id === jugadorId && e.tipo === EVENT_TYPES.TARJETA_AZUL
            ).length;
            const rojas = eventosEquipo.filter(e =>
                e.jugador_id === jugadorId &&
                (e.tipo === EVENT_TYPES.TARJETA_ROJA || e.tipo === EVENT_TYPES.DOBLE_AMARILLA)
            ).length;

            return { goles, amarillas, azules, rojas };
        };

        return (
            <View>
                <View style={[styles.teamHeader, { backgroundColor: equipo?.color_principal || COLORS.primary }]}>
                    <View style={styles.teamHeaderInfo}>
                        {/* Logo del equipo */}
                        {equipo?.logo_url ? (
                            <Image source={{ uri: equipo.logo_url }} style={styles.teamHeaderLogo} />
                        ) : (
                            <Ionicons name="shield" size={24} color="#fff" />
                        )}
                        <Text style={styles.teamHeaderText}>{equipo?.nombre || 'Equipo'}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                        onPress={() => handleToggleFollow(equipo?.id, isLocal)}
                    >
                        <Ionicons
                            name={isFollowing ? 'heart' : 'heart-outline'}
                            size={18}
                            color={isFollowing ? COLORS.error : '#fff'}
                        />
                        <Text style={styles.followBtnText}>
                            {isFollowing ? 'Siguiendo' : 'Seguir'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {jugadores?.length === 0 ? (
                    <Card>
                        <Text style={styles.noPlayersText}>No hay jugadores registrados</Text>
                    </Card>
                ) : (
                    jugadores?.map((jugador) => {
                        const stats = getJugadorStats(jugador.id);
                        return (
                            <Card key={jugador.id} style={styles.playerCard}>
                                <View style={styles.playerRow}>
                                    <View style={styles.playerNumber}>
                                        <Text style={styles.playerNumberText}>{jugador.numero_camiseta}</Text>
                                    </View>
                                    {/* Foto del jugador */}
                                    {jugador.foto_url ? (
                                        <Image source={{ uri: jugador.foto_url }} style={styles.playerPhoto} />
                                    ) : (
                                        <View style={styles.playerPhotoPlaceholder}>
                                            <Ionicons name="person" size={18} color={COLORS.textLight} />
                                        </View>
                                    )}
                                    <View style={styles.playerInfo}>
                                        <Text style={styles.playerName}>
                                            {jugador.nombre} {jugador.apellido || ''}
                                            {jugador.es_capitan && ' (C)'}
                                        </Text>
                                        <Text style={styles.playerPosition}>
                                            {PLAYER_POSITION_LABELS[jugador.posicion] || jugador.posicion}
                                        </Text>
                                    </View>
                                    <View style={styles.playerStats}>
                                        {stats.goles > 0 && (
                                            <View style={styles.statBadge}>
                                                <Text style={styles.statText}>⚽{stats.goles}</Text>
                                            </View>
                                        )}
                                        {stats.amarillas > 0 && (
                                            <View style={[styles.cardBadge, { backgroundColor: COLORS.yellowCard }]} />
                                        )}
                                        {stats.azules > 0 && (
                                            <View style={[styles.cardBadge, { backgroundColor: COLORS.blueCard }]} />
                                        )}
                                        {stats.rojas > 0 && (
                                            <View style={[styles.cardBadge, { backgroundColor: COLORS.redCard }]} />
                                        )}
                                    </View>
                                </View>
                            </Card>
                        );
                    })
                )}
            </View>
        );
    };

    if (loading) {
        return <Loading message="Cargando partido..." />;
    }

    if (!partido) {
        return (
            <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={48} color={COLORS.error} />
                    <Text style={styles.errorText}>No se pudo cargar el partido</Text>
                    <Button title="Volver" onPress={() => navigation.goBack()} variant="outline" />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Detalle del Partido</Text>
                    {showAdminControls && (
                        <TouchableOpacity onPress={() => navigation.navigate('PartidoEnVivo', { partidoId })}>
                            <Ionicons name="settings-outline" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                    )}
                    {!showAdminControls && <View style={{ width: 24 }} />}
                </View>

                {/* Botón para admins */}
                {showAdminControls && (
                    <TouchableOpacity
                        style={styles.adminBtn}
                        onPress={() => navigation.navigate('PartidoEnVivo', { partidoId })}
                    >
                        <Ionicons name="timer-outline" size={20} color="#fff" />
                        <Text style={styles.adminBtnText}>Gestionar Partido (Admin)</Text>
                        <Ionicons name="chevron-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                )}

                {/* Tabs */}
                <View style={styles.tabs}>
                    {[
                        { key: 'resumen', label: 'Resumen' },
                        { key: 'local', label: partido?.equipo_local?.nombre_corto || 'Local' },
                        { key: 'visitante', label: partido?.equipo_visitante?.nombre_corto || 'Visitante' },
                    ].map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                            onPress={() => setActiveTab(tab.key)}
                        >
                            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {activeTab === 'resumen' && renderResumen()}
                    {activeTab === 'local' && renderJugadores(partido.equipo_local, partido.equipo_local?.jugadores, true)}
                    {activeTab === 'visitante' && renderJugadores(partido.equipo_visitante, partido.equipo_visitante?.jugadores, false)}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.surface },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    adminBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, margin: 16, marginTop: 0, padding: 14, borderRadius: 12 },
    adminBtnText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 10 },
    tabs: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
    tabText: { fontSize: 13, color: COLORS.textSecondary },
    tabTextActive: { color: COLORS.primary, fontWeight: '600' },
    content: { padding: 16 },
    scoreCard: { marginBottom: 16 },
    scoreContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    teamScore: { flex: 1, alignItems: 'center' },
    teamBadge: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    teamLogo: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.background },
    teamName: { fontSize: 13, color: COLORS.textPrimary, textAlign: 'center', marginTop: 8, fontWeight: '600' },
    scores: { flexDirection: 'row', alignItems: 'center' },
    scoreValue: { fontSize: 40, fontWeight: '700', color: COLORS.textPrimary },
    scoreSeparator: { fontSize: 30, color: COLORS.textSecondary, marginHorizontal: 10 },
    statusContainer: { alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.divider },
    statusText: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
    dateText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
    goalsCard: { marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
    goalsContainer: { flexDirection: 'row' },
    goalsColumn: { flex: 1 },
    goalText: { fontSize: 14, color: COLORS.textPrimary, marginBottom: 4 },
    eventsCard: { marginBottom: 16 },
    noEventsText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', padding: 20 },
    eventItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
    eventMinute: { width: 40, fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
    eventInfo: { flex: 1, marginLeft: 10 },
    eventPlayer: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
    eventType: { fontSize: 12, color: COLORS.textSecondary, textTransform: 'capitalize' },
    teamHeader: { padding: 14, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
    teamHeaderText: { fontSize: 16, fontWeight: '700', color: '#fff', marginLeft: 10 },
    noPlayersText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', padding: 20 },
    playerCard: { marginBottom: 8 },
    playerRow: { flexDirection: 'row', alignItems: 'center' },
    playerNumber: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    playerNumberText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    playerPhoto: { width: 36, height: 36, borderRadius: 18, marginLeft: 8, backgroundColor: COLORS.background },
    playerPhotoPlaceholder: { width: 36, height: 36, borderRadius: 18, marginLeft: 8, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
    playerInfo: { flex: 1, marginLeft: 12 },
    playerName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
    playerPosition: { fontSize: 12, color: COLORS.textSecondary },
    playerStats: { flexDirection: 'row', alignItems: 'center' },
    statBadge: { backgroundColor: COLORS.success + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 4 },
    statText: { fontSize: 13, fontWeight: '600', color: COLORS.success },
    cardBadge: { width: 14, height: 18, borderRadius: 2, marginLeft: 4 },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    errorText: { fontSize: 16, color: COLORS.textSecondary, marginVertical: 16 },
    // Estilos para eventos divididos por equipo
    eventsContainer: { marginTop: 8 },
    eventsHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: COLORS.primary, marginBottom: 8 },
    eventsTeamName: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.primary },
    eventsTimeHeader: { width: 40, textAlign: 'center', fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
    eventRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
    eventColumnLeft: { flex: 1, justifyContent: 'center' },
    eventColumnRight: { flex: 1, justifyContent: 'center' },
    eventTimeColumn: { width: 40, justifyContent: 'center', alignItems: 'center' },
    eventContentLeft: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
    eventContentRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    eventPlayerName: { fontSize: 13, color: COLORS.textPrimary, marginHorizontal: 6 },
    eventMinuteCenter: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, backgroundColor: COLORS.surfaceVariant, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    // Estilos para botón de seguir equipo
    teamHeaderInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    teamHeaderLogo: { width: 28, height: 28, borderRadius: 14 },
    followBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    followBtnActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
    followBtnText: { color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 },
    // Penalty shootout styles
    scoresCenter: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    penalesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    penalesScore: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
    penalesLabelBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.warning + '20',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        marginHorizontal: 8,
    },
    penalesLabelText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.warning,
        marginLeft: 4,
    },
});

export default PartidoDetailScreen;
