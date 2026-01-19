import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext';
import { Loading, Card, Button } from '../../components/common';
import { TorneoCard } from '../../components/torneo';
import torneoService from '../../services/torneoService';
import { COLORS, LIMITS, TOURNAMENT_STATUS } from '../../utils/constants';

const AdminDashboardScreen = ({ navigation }) => {
    const { userProfile, isAdmin, becomeAdmin } = useAuth();
    const { isOnline, pendingSyncCount, processSyncQueue, isSyncing } = useOffline();

    const [torneos, setTorneos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        if (!userProfile?.id) return;

        try {
            const data = await torneoService.getTorneosByAdmin(userProfile.id);
            setTorneos(data || []);
        } catch (error) {
            console.error('Error loading admin torneos:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userProfile?.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleBecomeAdmin = async () => {
        Alert.alert(
            'Convertirse en Administrador',
            '¿Deseas convertirte en administrador para poder crear y gestionar torneos?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Sí, quiero ser Admin',
                    onPress: async () => {
                        const result = await becomeAdmin();
                        if (result.success) {
                            Alert.alert('¡Listo!', 'Ahora eres administrador y puedes crear torneos.');
                        } else {
                            Alert.alert('Error', result.error);
                        }
                    },
                },
            ]
        );
    };

    const handleSync = async () => {
        if (pendingSyncCount === 0) {
            Alert.alert('Sincronizado', 'No hay cambios pendientes por sincronizar.');
            return;
        }

        await processSyncQueue();
        Alert.alert('Listo', 'Sincronización completada.');
    };

    const handleCreateTorneo = () => {
        const torneosActivos = torneos.filter(t =>
            [TOURNAMENT_STATUS.CONFIGURACION, TOURNAMENT_STATUS.INSCRIPCION, TOURNAMENT_STATUS.ACTIVO].includes(t.estado)
        );

        if (torneosActivos.length >= LIMITS.MAX_ACTIVE_TOURNAMENTS_PER_ADMIN) {
            Alert.alert(
                'Límite alcanzado',
                `Solo puedes tener ${LIMITS.MAX_ACTIVE_TOURNAMENTS_PER_ADMIN} torneos activos simultáneamente. Finaliza o cancela uno de tus torneos actuales para crear uno nuevo.`
            );
            return;
        }

        navigation.navigate('CrearTorneo');
    };

    const handleDeleteTorneo = (torneo) => {
        Alert.alert(
            'Eliminar Torneo',
            `¿Estás seguro de que deseas eliminar "${torneo.nombre}"?\n\nEsta acción eliminará todos los equipos, jugadores y partidos asociados. No se puede deshacer.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await torneoService.eliminarTorneo(torneo.id);
                            setTorneos(torneos.filter(t => t.id !== torneo.id));
                            Alert.alert('Eliminado', 'El torneo ha sido eliminado correctamente.');
                        } catch (error) {
                            console.error('Error deleting torneo:', error);
                            Alert.alert('Error', 'No se pudo eliminar el torneo. Intenta de nuevo.');
                        }
                    },
                },
            ]
        );
    };

    if (!isAdmin) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.notAdminContainer}>
                    <Ionicons name="shield-checkmark" size={80} color={COLORS.primary} />
                    <Text style={styles.notAdminTitle}>Panel de Administrador</Text>
                    <Text style={styles.notAdminText}>
                        Para crear y gestionar torneos, necesitas ser administrador.
                    </Text>
                    <Button
                        title="Convertirme en Administrador"
                        onPress={handleBecomeAdmin}
                        style={styles.becomeAdminButton}
                    />
                    <Button
                        title="Volver"
                        onPress={() => navigation.goBack()}
                        variant="outline"
                        style={{ marginTop: 12 }}
                    />
                </View>
            </SafeAreaView>
        );
    }

    if (loading) {
        return <Loading message="Cargando panel..." />;
    }

    const torneosActivos = torneos.filter(t => t.estado === TOURNAMENT_STATUS.ACTIVO);
    const torneosEnConfig = torneos.filter(t =>
        [TOURNAMENT_STATUS.CONFIGURACION, TOURNAMENT_STATUS.INSCRIPCION].includes(t.estado)
    );

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                    />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Panel de Administrador</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Status bar */}
                <View style={styles.statusBar}>
                    <View style={[styles.statusItem, { backgroundColor: isOnline ? '#E8F5E9' : '#FFF3E0' }]}>
                        <Ionicons
                            name={isOnline ? 'cloud-done' : 'cloud-offline'}
                            size={16}
                            color={isOnline ? COLORS.success : COLORS.warning}
                        />
                        <Text style={[styles.statusText, { color: isOnline ? COLORS.success : COLORS.warning }]}>
                            {isOnline ? 'Conectado' : 'Sin conexión'}
                        </Text>
                    </View>

                    {pendingSyncCount > 0 && (
                        <TouchableOpacity
                            style={[styles.statusItem, styles.syncButton]}
                            onPress={handleSync}
                            disabled={isSyncing}
                        >
                            <Ionicons name="sync" size={16} color={COLORS.primary} />
                            <Text style={[styles.statusText, { color: COLORS.primary }]}>
                                {isSyncing ? 'Sincronizando...' : `${pendingSyncCount} pendientes`}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Estadísticas rápidas */}
                <View style={styles.statsContainer}>
                    <Card style={styles.statCard}>
                        <Text style={styles.statValue}>{torneos.length}</Text>
                        <Text style={styles.statLabel}>Total torneos</Text>
                    </Card>
                    <Card style={styles.statCard}>
                        <Text style={[styles.statValue, { color: COLORS.success }]}>{torneosActivos.length}</Text>
                        <Text style={styles.statLabel}>En curso</Text>
                    </Card>
                    <Card style={styles.statCard}>
                        <Text style={[styles.statValue, { color: COLORS.warning }]}>{torneosEnConfig.length}</Text>
                        <Text style={styles.statLabel}>En config</Text>
                    </Card>
                </View>

                {/* Botón crear torneo */}
                <Button
                    title="Crear Nuevo Torneo"
                    onPress={handleCreateTorneo}
                    icon={<Ionicons name="add-circle" size={20} color={COLORS.textOnPrimary} />}
                    style={styles.createButton}
                />

                <Text style={styles.limitText}>
                    Puedes crear hasta {LIMITS.MAX_ACTIVE_TOURNAMENTS_PER_ADMIN} torneos activos
                </Text>

                {/* Lista de torneos */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Mis Torneos</Text>

                    {torneos.length === 0 ? (
                        <Card>
                            <View style={styles.emptyState}>
                                <Ionicons name="trophy-outline" size={48} color={COLORS.textLight} />
                                <Text style={styles.emptyText}>No has creado ningún torneo</Text>
                                <Text style={styles.emptySubtext}>¡Crea tu primer torneo ahora!</Text>
                            </View>
                        </Card>
                    ) : (
                        torneos.map((torneo) => (
                            <View key={torneo.id} style={styles.torneoContainer}>
                                <TorneoCard
                                    torneo={torneo}
                                    onPress={() => navigation.navigate('GestionarTorneo', { torneoId: torneo.id })}
                                />
                                <View style={styles.torneoActions}>
                                    <TouchableOpacity
                                        style={styles.torneoActionBtn}
                                        onPress={() => navigation.navigate('GestionarTorneo', { torneoId: torneo.id })}
                                    >
                                        <Ionicons name="settings-outline" size={18} color={COLORS.primary} />
                                        <Text style={styles.torneoActionText}>Gestionar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.torneoActionBtn}
                                        onPress={() => navigation.navigate('EditarTorneo', { torneoId: torneo.id })}
                                    >
                                        <Ionicons name="pencil-outline" size={18} color={COLORS.warning} />
                                        <Text style={[styles.torneoActionText, { color: COLORS.warning }]}>Editar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.torneoActionBtn}
                                        onPress={() => handleDeleteTorneo(torneo)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                                        <Text style={[styles.torneoActionText, { color: COLORS.error }]}>Eliminar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    statusBar: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    statusItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 8,
    },
    syncButton: {
        backgroundColor: '#E3F2FD',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
    statsContainer: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        marginHorizontal: 4,
        alignItems: 'center',
        paddingVertical: 16,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.primary,
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    createButton: {
        marginBottom: 8,
    },
    limitText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 12,
    },
    emptyState: {
        alignItems: 'center',
        padding: 24,
    },
    emptyText: {
        fontSize: 16,
        color: COLORS.textSecondary,
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 14,
        color: COLORS.textLight,
        marginTop: 4,
    },
    notAdminContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    notAdminTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginTop: 16,
    },
    notAdminText: {
        fontSize: 16,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
    },
    becomeAdminButton: {
        width: '100%',
    },
    torneoContainer: {
        marginBottom: 12,
    },
    torneoActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: -8,
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    torneoActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        marginLeft: 8,
    },
    torneoActionText: {
        fontSize: 13,
        color: COLORS.primary,
        marginLeft: 4,
        fontWeight: '500',
    },
});

export default AdminDashboardScreen;
