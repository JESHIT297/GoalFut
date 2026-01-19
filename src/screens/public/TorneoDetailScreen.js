import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Modal,
    FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Loading, Button, Card } from '../../components/common';
import { PartidoCard } from '../../components/partido';
import torneoService from '../../services/torneoService';
import partidoService from '../../services/partidoService';
import jugadorService from '../../services/jugadorService';
import { COLORS, PLAYER_POSITION_LABELS } from '../../utils/constants';
import { formatFullDate, sortByStandings } from '../../utils/helpers';
import { usePartidosRealtime } from '../../hooks/useRealtime';

const TorneoDetailScreen = ({ route, navigation }) => {
    const { torneoId } = route.params;
    const { userProfile, isAuthenticated, isGuest } = useAuth();

    const [torneo, setTorneo] = useState(null);
    const [partidos, setPartidos] = useState([]);
    const [goleadores, setGoleadores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [siguiendo, setSiguiendo] = useState(false);
    const [activeTab, setActiveTab] = useState('info');

    // Modal para ver jugadores
    const [jugadoresModal, setJugadoresModal] = useState(false);
    const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
    const [jugadoresEquipo, setJugadoresEquipo] = useState([]);
    const [loadingJugadores, setLoadingJugadores] = useState(false);

    useEffect(() => {
        loadData();
    }, [torneoId]);

    const loadData = async () => {
        try {
            const [torneoData, partidosData] = await Promise.all([
                torneoService.getTorneoById(torneoId),
                partidoService.getPartidosByTorneo(torneoId),
            ]);
            setTorneo(torneoData);
            setPartidos(partidosData || []);

            // Cargar goleadores
            try {
                const goleadoresData = await torneoService.getGoleadores(torneoId, 10);
                setGoleadores(goleadoresData || []);
            } catch (e) {
                console.log('Error loading goleadores:', e);
            }

            if (userProfile?.id) {
                try {
                    const estaSiguiendo = await torneoService.estaSiguiendo(userProfile.id, torneoId);
                    setSiguiendo(estaSiguiendo);
                } catch (e) { }
            }
        } catch (error) {
            console.error('Error loading torneo:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Suscripción a cambios en tiempo real de partidos del torneo
    usePartidosRealtime(torneoId, (payload) => {
        // Recargar datos cuando hay cambios
        loadData();
    });

    const handleSeguir = async () => {
        if (!isAuthenticated || isGuest) {
            navigation.navigate('Login');
            return;
        }

        try {
            if (siguiendo) {
                await torneoService.dejarDeSeguirTorneo(userProfile.id, torneoId);
                setSiguiendo(false);
            } else {
                await torneoService.seguirTorneo(userProfile.id, torneoId);
                setSiguiendo(true);
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const verJugadores = async (equipo) => {
        setEquipoSeleccionado(equipo);
        setLoadingJugadores(true);
        setJugadoresModal(true);

        try {
            const data = await jugadorService.getJugadoresByEquipo(equipo.id);
            setJugadoresEquipo(data || []);
        } catch (error) {
            console.error('Error loading jugadores:', error);
            setJugadoresEquipo([]);
        } finally {
            setLoadingJugadores(false);
        }
    };

    // Obtener grupos únicos
    const getGrupos = () => {
        const grupos = [...new Set((torneo?.equipos || []).map(e => e.grupo).filter(g => g))];
        return grupos.sort();
    };

    const renderTabs = () => (
        <View style={styles.tabs}>
            {[
                { key: 'info', label: 'Info', icon: 'information-circle-outline' },
                { key: 'partidos', label: 'Partidos', icon: 'football-outline' },
                { key: 'tabla', label: 'Tabla', icon: 'stats-chart-outline' },
                { key: 'valla', label: 'Valla', icon: 'shield-checkmark-outline' },
                { key: 'goleadores', label: 'Goles', icon: 'trophy-outline' },
            ].map((tab) => (
                <TouchableOpacity
                    key={tab.key}
                    style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                    onPress={() => setActiveTab(tab.key)}
                >
                    <Ionicons
                        name={tab.icon}
                        size={18}
                        color={activeTab === tab.key ? COLORS.primary : COLORS.textSecondary}
                    />
                    <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                        {tab.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderInfo = () => (
        <View style={styles.infoContainer}>
            {torneo.descripcion && (
                <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Descripción</Text>
                    <Text style={styles.infoText}>{torneo.descripcion}</Text>
                </View>
            )}

            <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                    <Ionicons name="people" size={24} color={COLORS.primary} />
                    <Text style={styles.infoItemValue}>{torneo.cantidad_equipos}</Text>
                    <Text style={styles.infoItemLabel}>Equipos</Text>
                </View>

                <View style={styles.infoItem}>
                    <Ionicons name="timer" size={24} color={COLORS.primary} />
                    <Text style={styles.infoItemValue}>{torneo.duracion_tiempo_minutos}'</Text>
                    <Text style={styles.infoItemLabel}>Por tiempo</Text>
                </View>

                <View style={styles.infoItem}>
                    <Ionicons name="person" size={24} color={COLORS.primary} />
                    <Text style={styles.infoItemValue}>{torneo.max_jugadores_equipo || 12}</Text>
                    <Text style={styles.infoItemLabel}>Máx jugadores</Text>
                </View>
            </View>

            {torneo.lugar && (
                <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Lugar</Text>
                    <Text style={styles.infoText}>{torneo.lugar}</Text>
                </View>
            )}

            {/* Lista de equipos - AHORA CLICKEABLE PARA VER JUGADORES */}
            {torneo.equipos && torneo.equipos.length > 0 && (
                <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Equipos ({torneo.equipos.length})</Text>
                    <Text style={styles.subLabel}>Toca un equipo para ver sus jugadores</Text>
                    <View style={styles.equiposList}>
                        {torneo.equipos.map((equipo) => (
                            <TouchableOpacity
                                key={equipo.id}
                                style={styles.equipoItem}
                                onPress={() => verJugadores(equipo)}
                            >
                                <View style={[styles.equipoLogoPlaceholder, { backgroundColor: equipo.color_principal || COLORS.primary }]}>
                                    <Ionicons name="shield" size={16} color={COLORS.textOnPrimary} />
                                </View>
                                <Text style={styles.equipoNombre}>{equipo.nombre}</Text>
                                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );

    const renderPartidos = () => {
        // Ordenar partidos por fecha y hora
        const partidosOrdenados = [...partidos].sort((a, b) => {
            const fechaA = new Date(`${a.fecha}T${a.hora || '00:00'}`);
            const fechaB = new Date(`${b.fecha}T${b.hora || '00:00'}`);
            return fechaA - fechaB;
        });

        if (partidosOrdenados.length === 0) {
            return (
                <View style={styles.partidosContainer}>
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={48} color={COLORS.textLight} />
                        <Text style={styles.emptyText}>No hay partidos programados</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.partidosContainer}>
                {partidosOrdenados.map((partido) => (
                    <View key={partido.id}>
                        {/* Mostrar grupo si existe */}
                        {partido.grupo && (
                            <View style={styles.grupoLabel}>
                                <Ionicons name="trophy-outline" size={14} color={COLORS.primary} />
                                <Text style={styles.grupoLabelText}>Grupo {partido.grupo}</Text>
                            </View>
                        )}
                        <PartidoCard
                            partido={partido}
                            onPress={() => navigation.navigate('PartidoDetail', { partidoId: partido.id })}
                        />
                    </View>
                ))}
            </View>
        );
    };

    const renderTabla = () => {
        const grupos = getGrupos();
        const equipos = torneo.equipos || [];

        if (grupos.length > 0) {
            return (
                <View>
                    {grupos.map(grupo => {
                        const equiposGrupo = sortByStandings(equipos.filter(e => e.grupo === grupo));
                        return (
                            <View key={grupo} style={styles.grupoSection}>
                                <Text style={styles.grupoHeader}>Grupo {grupo}</Text>
                                {renderTablaGrupo(equiposGrupo)}
                            </View>
                        );
                    })}
                </View>
            );
        }

        return renderTablaGrupo(sortByStandings(equipos));
    };

    const renderTablaGrupo = (equiposOrdenados) => (
        <View style={styles.tablaContainer}>
            <View style={styles.tablaHeader}>
                <Text style={[styles.tablaHeaderCell, styles.posCol]}>#</Text>
                <Text style={[styles.tablaHeaderCell, styles.equipoCol]}>Equipo</Text>
                <Text style={styles.tablaHeaderCell}>PJ</Text>
                <Text style={styles.tablaHeaderCell}>G</Text>
                <Text style={styles.tablaHeaderCell}>E</Text>
                <Text style={styles.tablaHeaderCell}>P</Text>
                <Text style={styles.tablaHeaderCell}>DG</Text>
                <Text style={[styles.tablaHeaderCell, styles.ptsCol]}>PTS</Text>
            </View>

            {equiposOrdenados.map((equipo, index) => (
                <TouchableOpacity
                    key={equipo.id}
                    style={[styles.tablaRow, index % 2 === 0 && styles.tablaRowEven]}
                    onPress={() => verJugadores(equipo)}
                >
                    <Text style={[styles.tablaCell, styles.posCol]}>{index + 1}</Text>
                    <View style={[styles.equipoCol, styles.equipoCellContainer]}>
                        <View style={[styles.miniLogoPlaceholder, { backgroundColor: equipo.color_principal }]} />
                        <Text style={styles.equipoCellName} numberOfLines={1}>
                            {equipo.nombre_corto || equipo.nombre}
                        </Text>
                    </View>
                    <Text style={styles.tablaCell}>{equipo.partidos_jugados || 0}</Text>
                    <Text style={styles.tablaCell}>{equipo.partidos_ganados || 0}</Text>
                    <Text style={styles.tablaCell}>{equipo.partidos_empatados || 0}</Text>
                    <Text style={styles.tablaCell}>{equipo.partidos_perdidos || 0}</Text>
                    <Text style={styles.tablaCell}>{equipo.diferencia_gol || 0}</Text>
                    <Text style={[styles.tablaCell, styles.ptsCol, styles.ptsValue]}>
                        {equipo.puntos || 0}
                    </Text>
                </TouchableOpacity>
            ))}

            {equiposOrdenados.length === 0 && (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No hay equipos</Text>
                </View>
            )}
        </View>
    );

    const renderVallaMenosVencida = () => {
        const equipos = [...(torneo.equipos || [])].sort((a, b) => {
            if ((a.goles_contra || 0) === (b.goles_contra || 0)) {
                return (b.partidos_jugados || 0) - (a.partidos_jugados || 0);
            }
            return (a.goles_contra || 0) - (b.goles_contra || 0);
        });

        return (
            <View style={styles.vallaContainer}>
                <Text style={styles.sectionTitle}>🛡️ Valla Menos Vencida</Text>
                <Text style={styles.sectionSubtitle}>Equipos que menos goles han recibido</Text>

                {equipos.map((equipo, index) => (
                    <Card key={equipo.id} style={styles.vallaCard}>
                        <View style={styles.vallaRow}>
                            <Text style={[styles.vallaRank, index < 3 && styles.vallaRankTop]}>
                                {index + 1}
                            </Text>
                            <View style={[styles.vallaColor, { backgroundColor: equipo.color_principal }]}>
                                <Ionicons name="shield" size={16} color="#fff" />
                            </View>
                            <View style={styles.vallaInfo}>
                                <Text style={styles.vallaName}>{equipo.nombre}</Text>
                                <Text style={styles.vallaStats}>{equipo.partidos_jugados || 0} partidos jugados</Text>
                            </View>
                            <View style={styles.vallaGoals}>
                                <Text style={styles.vallaGoalsValue}>{equipo.goles_contra || 0}</Text>
                                <Text style={styles.vallaGoalsLabel}>GC</Text>
                            </View>
                        </View>
                    </Card>
                ))}

                {equipos.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No hay equipos registrados</Text>
                    </View>
                )}
            </View>
        );
    };

    const renderGoleadores = () => (
        <View style={styles.goleadoresContainer}>
            <Text style={styles.sectionTitle}>⚽ Goleadores</Text>

            {goleadores.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="football-outline" size={48} color={COLORS.textLight} />
                    <Text style={styles.emptyText}>Aún no hay goles registrados</Text>
                </View>
            ) : (
                goleadores.map((jugador, index) => (
                    <Card key={jugador.id} style={styles.goleadorCard}>
                        <View style={styles.goleadorRow}>
                            <Text style={[styles.goleadorRank, index < 3 && styles.goleadorRankTop]}>
                                {index + 1}
                            </Text>
                            <View style={styles.goleadorInfo}>
                                <Text style={styles.goleadorName}>
                                    {jugador.nombre} {jugador.apellido || ''}
                                </Text>
                                <Text style={styles.goleadorTeam}>{jugador.equipo?.nombre || jugador.equipo_nombre}</Text>
                            </View>
                            <View style={styles.goleadorGoals}>
                                <Ionicons name="football" size={18} color={COLORS.success} />
                                <Text style={styles.goleadorGoalsValue}>
                                    {jugador.goles_totales || jugador.goles || 0}
                                </Text>
                            </View>
                        </View>
                    </Card>
                ))
            )}
        </View>
    );

    if (loading) {
        return <Loading message="Cargando torneo..." />;
    }

    if (!torneo) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={48} color={COLORS.error} />
                    <Text style={styles.errorText}>No se pudo cargar el torneo</Text>
                    <Button title="Volver" onPress={() => navigation.goBack()} variant="outline" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>

                    <View style={styles.torneoHeader}>
                        <View style={styles.torneoLogoPlaceholder}>
                            <Ionicons name="trophy" size={40} color={COLORS.primary} />
                        </View>
                        <Text style={styles.torneoNombre}>{torneo.nombre}</Text>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>
                                {torneo.estado === 'activo' ? 'En Curso' :
                                    torneo.estado === 'finalizado' ? 'Finalizado' : 'En Configuración'}
                            </Text>
                        </View>
                    </View>

                    <Button
                        title={siguiendo ? 'Siguiendo ✓' : 'Seguir'}
                        onPress={handleSeguir}
                        variant={siguiendo ? 'secondary' : 'primary'}
                        style={styles.followButton}
                    />
                </View>

                {renderTabs()}

                <View style={styles.tabContent}>
                    {activeTab === 'info' && renderInfo()}
                    {activeTab === 'partidos' && renderPartidos()}
                    {activeTab === 'tabla' && renderTabla()}
                    {activeTab === 'valla' && renderVallaMenosVencida()}
                    {activeTab === 'goleadores' && renderGoleadores()}
                </View>
            </ScrollView>

            {/* Modal para ver jugadores del equipo */}
            <Modal visible={jugadoresModal} animationType="slide" transparent onRequestClose={() => setJugadoresModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {equipoSeleccionado?.nombre || 'Jugadores'}
                            </Text>
                            <TouchableOpacity onPress={() => setJugadoresModal(false)}>
                                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        {loadingJugadores ? (
                            <View style={styles.loadingJugadores}>
                                <Text>Cargando jugadores...</Text>
                            </View>
                        ) : jugadoresEquipo.length === 0 ? (
                            <View style={styles.emptyJugadores}>
                                <Ionicons name="person-outline" size={48} color={COLORS.textLight} />
                                <Text style={styles.emptyText}>No hay jugadores registrados</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={jugadoresEquipo}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <View style={styles.jugadorItem}>
                                        <View style={styles.jugadorNumero}>
                                            <Text style={styles.jugadorNumeroText}>{item.numero_camiseta}</Text>
                                        </View>
                                        <View style={styles.jugadorInfo}>
                                            <Text style={styles.jugadorNombre}>
                                                {item.nombre} {item.apellido || ''}
                                                {item.es_capitan && ' (C)'}
                                            </Text>
                                            <Text style={styles.jugadorPosicion}>
                                                {PLAYER_POSITION_LABELS[item.posicion] || item.posicion}
                                            </Text>
                                        </View>
                                        <View style={styles.jugadorStats}>
                                            <Text style={styles.jugadorStatText}>⚽ {item.goles_totales || 0}</Text>
                                        </View>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { padding: 16, backgroundColor: COLORS.surface },
    backButton: { marginBottom: 16 },
    torneoHeader: { alignItems: 'center' },
    torneoLogoPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
    torneoNombre: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginTop: 12, textAlign: 'center' },
    statusBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
    statusText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
    followButton: { marginTop: 16 },
    tabs: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
    tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
    tabText: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
    tabTextActive: { color: COLORS.primary, fontWeight: '600' },
    tabContent: { padding: 16 },
    infoContainer: {},
    infoSection: { marginBottom: 20 },
    infoLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
    subLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 8 },
    infoText: { fontSize: 16, color: COLORS.textPrimary, lineHeight: 24 },
    infoGrid: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 20 },
    infoItem: { alignItems: 'center' },
    infoItemValue: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginTop: 8 },
    infoItemLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
    equiposList: {},
    equipoItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 8 },
    equipoLogoPlaceholder: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    equipoNombre: { flex: 1, fontSize: 14, color: COLORS.textPrimary, marginLeft: 12, fontWeight: '500' },
    partidosContainer: {},
    grupoSection: { marginBottom: 20 },
    grupoHeader: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: COLORS.primary },
    grupoLabel: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4, paddingHorizontal: 8 },
    grupoLabelText: { fontSize: 12, fontWeight: '600', color: COLORS.primary, marginLeft: 4 },
    tablaContainer: { backgroundColor: COLORS.surface, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
    tablaHeader: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 8 },
    tablaHeaderCell: { fontSize: 11, fontWeight: '600', color: COLORS.textOnPrimary, textAlign: 'center', width: 26 },
    tablaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
    tablaRowEven: { backgroundColor: COLORS.surfaceVariant },
    tablaCell: { fontSize: 12, color: COLORS.textPrimary, textAlign: 'center', width: 26 },
    posCol: { width: 22 },
    equipoCol: { flex: 1 },
    equipoCellContainer: { flexDirection: 'row', alignItems: 'center' },
    miniLogoPlaceholder: { width: 20, height: 20, borderRadius: 10 },
    equipoCellName: { fontSize: 12, color: COLORS.textPrimary, marginLeft: 6, flex: 1 },
    ptsCol: { width: 30 },
    ptsValue: { fontWeight: '700', color: COLORS.primary },
    vallaContainer: {},
    sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
    sectionSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
    vallaCard: { marginBottom: 8 },
    vallaRow: { flexDirection: 'row', alignItems: 'center' },
    vallaRank: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary, width: 28 },
    vallaRankTop: { color: COLORS.primary, fontWeight: '700' },
    vallaColor: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    vallaInfo: { flex: 1, marginLeft: 12 },
    vallaName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
    vallaStats: { fontSize: 12, color: COLORS.textSecondary },
    vallaGoals: { alignItems: 'center' },
    vallaGoalsValue: { fontSize: 22, fontWeight: '700', color: COLORS.error },
    vallaGoalsLabel: { fontSize: 10, color: COLORS.textSecondary },
    goleadoresContainer: {},
    goleadorCard: { marginBottom: 8 },
    goleadorRow: { flexDirection: 'row', alignItems: 'center' },
    goleadorRank: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary, width: 28 },
    goleadorRankTop: { color: COLORS.warning, fontWeight: '700' },
    goleadorInfo: { flex: 1 },
    goleadorName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
    goleadorTeam: { fontSize: 12, color: COLORS.textSecondary },
    goleadorGoals: { flexDirection: 'row', alignItems: 'center' },
    goleadorGoalsValue: { fontSize: 20, fontWeight: '700', color: COLORS.success, marginLeft: 6 },
    emptyState: { alignItems: 'center', padding: 40 },
    emptyText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8 },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    errorText: { fontSize: 16, color: COLORS.textSecondary, marginVertical: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
    loadingJugadores: { padding: 40, alignItems: 'center' },
    emptyJugadores: { padding: 40, alignItems: 'center' },
    jugadorItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
    jugadorNumero: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    jugadorNumeroText: { fontSize: 16, fontWeight: '700', color: COLORS.textOnPrimary },
    jugadorInfo: { flex: 1, marginLeft: 12 },
    jugadorNombre: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
    jugadorPosicion: { fontSize: 12, color: COLORS.textSecondary },
    jugadorStats: { alignItems: 'center' },
    jugadorStatText: { fontSize: 14, color: COLORS.textSecondary },
});

export default TorneoDetailScreen;
