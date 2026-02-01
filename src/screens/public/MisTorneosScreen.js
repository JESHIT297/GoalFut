import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext';
import { Loading, Card, EmptyState } from '../../components/common';
import { TorneoCard } from '../../components/torneo';
import torneoService from '../../services/torneoService';
import { COLORS, CACHE_KEYS } from '../../utils/constants';

const MisTorneosScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { userProfile, isGuest } = useAuth();
    const { isOnline } = useOffline();
    const [torneos, setTorneos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadTorneos = useCallback(async () => {
        try {
            if (isGuest) {
                // Los invitados no tienen torneos seguidos
                setTorneos([]);
            } else if (isOnline && userProfile?.id) {
                // Cargar desde servidor
                const data = await torneoService.getTorneosSeguidos(userProfile.id);
                const torneosList = data?.map(d => d.torneo) || [];
                setTorneos(torneosList);

                // Guardar en caché para uso offline
                await AsyncStorage.setItem(
                    CACHE_KEYS.FOLLOWED_TOURNAMENTS,
                    JSON.stringify(torneosList)
                );
            } else {
                // Sin conexión - cargar desde caché
                const cached = await AsyncStorage.getItem(CACHE_KEYS.FOLLOWED_TOURNAMENTS);
                if (cached) {
                    setTorneos(JSON.parse(cached));
                }
            }
        } catch (error) {
            console.error('Error loading followed tournaments:', error);
            // Intentar cargar desde caché en caso de error
            const cached = await AsyncStorage.getItem(CACHE_KEYS.FOLLOWED_TOURNAMENTS);
            if (cached) {
                setTorneos(JSON.parse(cached));
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userProfile?.id, isOnline, isGuest]);

    useEffect(() => {
        loadTorneos();
    }, [loadTorneos]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadTorneos();
        });
        return unsubscribe;
    }, [navigation, loadTorneos]);

    const onRefresh = () => {
        setRefreshing(true);
        loadTorneos();
    };

    const handleUnfollow = async (torneo) => {
        Alert.alert(
            'Dejar de seguir',
            `¿Deseas dejar de seguir "${torneo.nombre}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Dejar de seguir',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await torneoService.dejarDeSeguirTorneo(userProfile.id, torneo.id);
                            setTorneos(torneos.filter(t => t.id !== torneo.id));

                            // Actualizar caché
                            const updated = torneos.filter(t => t.id !== torneo.id);
                            await AsyncStorage.setItem(
                                CACHE_KEYS.FOLLOWED_TOURNAMENTS,
                                JSON.stringify(updated)
                            );
                        } catch (error) {
                            Alert.alert('Error', 'No se pudo dejar de seguir el torneo');
                        }
                    },
                },
            ]
        );
    };

    const renderTorneo = ({ item }) => (
        <View style={styles.torneoContainer}>
            <TorneoCard
                torneo={item}
                onPress={() => navigation.navigate('TorneoDetail', { torneoId: item.id })}
            />
            {!isGuest && (
                <View style={styles.torneoActions}>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => navigation.navigate('Estadisticas', {
                            torneoId: item.id,
                            torneoNombre: item.nombre
                        })}
                    >
                        <Ionicons name="stats-chart" size={16} color={COLORS.primary} />
                        <Text style={styles.actionText}>Estadísticas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleUnfollow(item)}
                    >
                        <Ionicons name="heart-dislike-outline" size={16} color={COLORS.error} />
                        <Text style={[styles.actionText, { color: COLORS.error }]}>Dejar de seguir</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    // Si es invitado, mostrar pantalla de registro/login
    if (isGuest) {
        return (
            <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Mis Torneos</Text>
                </View>
                <View style={styles.guestContainer}>
                    <Ionicons name="heart" size={80} color={COLORS.primary} />
                    <Text style={styles.guestTitle}>Sigue tus torneos favoritos</Text>
                    <Text style={styles.guestMessage}>
                        Inicia sesión o regístrate para seguir torneos y recibir actualizaciones en tiempo real
                    </Text>
                    <View style={styles.guestButtons}>
                        <TouchableOpacity
                            style={styles.loginButton}
                            onPress={() => navigation.navigate('Login')}
                        >
                            <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.registerButton}
                            onPress={() => navigation.navigate('Register')}
                        >
                            <Text style={styles.registerButtonText}>Registrarse</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    if (loading) {
        return <Loading message="Cargando torneos..." />;
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Mis Torneos</Text>
                {!isOnline && (
                    <View style={styles.offlineBadge}>
                        <Ionicons name="cloud-offline" size={14} color={COLORS.warning} />
                        <Text style={styles.offlineText}>Offline</Text>
                    </View>
                )}
            </View>

            <FlatList
                data={torneos}
                keyExtractor={(item) => item.id}
                renderItem={renderTorneo}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                }
                ListEmptyComponent={
                    <EmptyState
                        icon="heart-outline"
                        title="Sin torneos seguidos"
                        message={
                            isGuest
                                ? 'Regístrate para seguir torneos y recibir actualizaciones'
                                : 'Explora torneos y sigue los que te interesen'
                        }
                        actionText={isGuest ? 'Registrarse' : 'Explorar Torneos'}
                        onAction={() => navigation.navigate(isGuest ? 'Register' : 'Inicio')}
                    />
                }
                ListHeaderComponent={
                    torneos.length > 0 ? (
                        <View style={styles.infoBox}>
                            <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
                            <Text style={styles.infoText}>
                                {isOnline ? 'Datos actualizados' : 'Mostrando última copia guardada'}
                            </Text>
                        </View>
                    ) : null
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingBottom: 12,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    offlineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    offlineText: {
        fontSize: 12,
        fontWeight: '500',
        color: COLORS.warning,
        marginLeft: 4,
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${COLORS.primary}10`,
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    infoText: {
        fontSize: 13,
        color: COLORS.primary,
        marginLeft: 8,
    },
    torneoContainer: {
        marginBottom: 16,
    },
    torneoActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: -8,
        paddingHorizontal: 8,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        marginLeft: 8,
    },
    actionText: {
        fontSize: 12,
        color: COLORS.primary,
        marginLeft: 4,
        fontWeight: '500',
    },
    // Guest styles
    guestContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    guestTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginTop: 20,
        textAlign: 'center',
    },
    guestMessage: {
        fontSize: 15,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 22,
    },
    guestButtons: {
        marginTop: 32,
        width: '100%',
        gap: 12,
    },
    loginButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    registerButton: {
        backgroundColor: 'transparent',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    registerButtonText: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default MisTorneosScreen;
