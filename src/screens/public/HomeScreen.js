import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext';
import { Loading, EmptyState } from '../../components/common';
import { TorneoCard } from '../../components/torneo';
import { PartidoCard } from '../../components/partido';
import torneoService from '../../services/torneoService';
import partidoService from '../../services/partidoService';
import { COLORS } from '../../utils/constants';
import { usePartidosRealtime } from '../../hooks/useRealtime';

const HomeScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { isAuthenticated, isGuest, userProfile, isAdmin } = useAuth();
    const { isOnline, pendingSyncCount } = useOffline();

    const [torneos, setTorneos] = useState([]);
    const [partidosEnVivo, setPartidosEnVivo] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [torneosData, partidosData] = await Promise.all([
                torneoService.getTorneosActivos(),
                partidoService.getPartidosEnVivo(),
            ]);
            setTorneos(torneosData || []);
            setPartidosEnVivo(partidosData || []);
        } catch (error) {
            console.error('Error loading home data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Suscripción a cambios en tiempo real de partidos
    usePartidosRealtime(null, (payload) => {
        // Recargar datos cuando hay cambios
        loadData();
    });

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const renderHeader = () => (
        <View style={styles.header}>
            {/* Saludo */}
            <View style={styles.greeting}>
                <Text style={styles.greetingText}>
                    Hola, {userProfile?.nombre || (isGuest ? 'Invitado' : 'Usuario')} 👋
                </Text>
                <Text style={styles.greetingSubtext}>
                    {isGuest ? 'Estás navegando como invitado' : 'Bienvenido a GoalFut'}
                </Text>
            </View>

            {/* Indicadores de estado */}
            <View style={styles.statusBar}>
                {!isOnline && (
                    <View style={styles.offlineBadge}>
                        <Ionicons name="cloud-offline" size={14} color={COLORS.warning} />
                        <Text style={styles.offlineText}>Sin conexión</Text>
                    </View>
                )}
                {pendingSyncCount > 0 && (
                    <View style={styles.syncBadge}>
                        <Ionicons name="sync" size={14} color={COLORS.primary} />
                        <Text style={styles.syncText}>{pendingSyncCount} pendientes</Text>
                    </View>
                )}
            </View>

            {/* Botón de admin si es administrador */}
            {isAdmin && (
                <TouchableOpacity
                    style={styles.adminButton}
                    onPress={() => navigation.navigate('AdminDashboard')}
                >
                    <Ionicons name="settings" size={20} color={COLORS.textOnPrimary} />
                    <Text style={styles.adminButtonText}>Panel de Administrador</Text>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textOnPrimary} />
                </TouchableOpacity>
            )}

            {/* Partidos en vivo */}
            {partidosEnVivo.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.liveIndicator}>
                            <View style={styles.liveDot} />
                            <Text style={styles.sectionTitle}>En Vivo</Text>
                        </View>
                    </View>
                    {partidosEnVivo.map((partido) => (
                        <PartidoCard
                            key={partido.id}
                            partido={partido}
                            showTorneo
                            onPress={() => navigation.navigate('PartidoDetail', { partidoId: partido.id })}
                        />
                    ))}
                </View>
            )}

            {/* Título de torneos */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Torneos Activos</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Buscar')}>
                    <Text style={styles.seeAll}>Ver todos</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (loading) {
        return <Loading message="Cargando torneos..." />;
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <FlatList
                data={torneos}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TorneoCard
                        torneo={item}
                        onPress={() => navigation.navigate('TorneoDetail', { torneoId: item.id })}
                    />
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={
                    <EmptyState
                        icon="trophy-outline"
                        title="Sin torneos activos"
                        message="No hay torneos disponibles en este momento"
                    />
                }
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    header: {
        marginBottom: 8,
    },
    greeting: {
        marginBottom: 16,
    },
    greetingText: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    greetingSubtext: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    statusBar: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    offlineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 8,
    },
    offlineText: {
        fontSize: 12,
        color: COLORS.warning,
        marginLeft: 4,
        fontWeight: '600',
    },
    syncBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    syncText: {
        fontSize: 12,
        color: COLORS.primary,
        marginLeft: 4,
        fontWeight: '600',
    },
    adminButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    adminButtonText: {
        flex: 1,
        color: COLORS.textOnPrimary,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 12,
    },
    section: {
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.matchLive,
        marginRight: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    seeAll: {
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: '600',
    },
});

export default HomeScreen;
