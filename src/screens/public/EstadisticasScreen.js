import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Loading, Card } from '../../components/common';
import torneoService from '../../services/torneoService';
import { COLORS } from '../../utils/constants';

const EstadisticasScreen = ({ route, navigation }) => {
    const { torneoId, torneoNombre } = route.params;
    const [activeTab, setActiveTab] = useState('goleadores');
    const [goleadores, setGoleadores] = useState([]);
    const [posiciones, setPosiciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [golesData, tablaPosData] = await Promise.all([
                torneoService.getGoleadores(torneoId, 20),
                torneoService.getTablaposiciones(torneoId),
            ]);
            setGoleadores(golesData || []);
            setPosiciones(tablaPosData || []);
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [torneoId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Ordenar por valla menos vencida (menos goles en contra)
    const vallasMenosVencidas = [...posiciones].sort((a, b) => {
        if (a.goles_contra === b.goles_contra) {
            return b.partidos_jugados - a.partidos_jugados;
        }
        return a.goles_contra - b.goles_contra;
    });

    const renderGoleador = ({ item, index }) => (
        <Card style={styles.itemCard}>
            <View style={styles.rankContainer}>
                <Text style={[styles.rank, index < 3 && styles.topRank]}>
                    {index + 1}
                </Text>
            </View>
            <View style={styles.playerInfo}>
                <Text style={styles.playerName}>
                    {item.nombre} {item.apellido}
                </Text>
                <Text style={styles.teamName}>{item.equipo_nombre}</Text>
            </View>
            <View style={styles.statContainer}>
                <Ionicons name="football" size={20} color={COLORS.success} />
                <Text style={styles.statValue}>{item.goles || item.goles_totales}</Text>
            </View>
        </Card>
    );

    const renderValla = ({ item, index }) => (
        <Card style={styles.itemCard}>
            <View style={styles.rankContainer}>
                <Text style={[styles.rank, index < 3 && styles.topRank]}>
                    {index + 1}
                </Text>
            </View>
            <View style={[styles.teamBadge, { backgroundColor: item.color_principal || COLORS.primary }]}>
                <Ionicons name="shield" size={16} color="#fff" />
            </View>
            <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{item.nombre}</Text>
                <Text style={styles.teamName}>{item.partidos_jugados} PJ</Text>
            </View>
            <View style={styles.statContainer}>
                <Text style={styles.statLabel}>GC</Text>
                <Text style={[styles.statValue, { color: COLORS.error }]}>{item.goles_contra}</Text>
            </View>
        </Card>
    );

    const renderPosicion = ({ item, index }) => (
        <Card style={styles.itemCard}>
            <View style={styles.rankContainer}>
                <Text style={[styles.rank, index < 3 && styles.topRank]}>
                    {index + 1}
                </Text>
            </View>
            <View style={[styles.teamBadge, { backgroundColor: item.color_principal || COLORS.primary }]}>
                <Ionicons name="shield" size={16} color="#fff" />
            </View>
            <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{item.nombre}</Text>
                <Text style={styles.teamName}>
                    {item.partidos_ganados}G {item.partidos_empatados}E {item.partidos_perdidos}P
                </Text>
            </View>
            <View style={styles.statsRow}>
                <View style={styles.miniStat}>
                    <Text style={styles.miniLabel}>GF</Text>
                    <Text style={styles.miniValue}>{item.goles_favor}</Text>
                </View>
                <View style={styles.miniStat}>
                    <Text style={styles.miniLabel}>GC</Text>
                    <Text style={styles.miniValue}>{item.goles_contra}</Text>
                </View>
                <View style={styles.miniStat}>
                    <Text style={styles.miniLabel}>DIF</Text>
                    <Text style={[styles.miniValue, { color: item.diferencia_gol >= 0 ? COLORS.success : COLORS.error }]}>
                        {item.diferencia_gol > 0 ? '+' : ''}{item.diferencia_gol}
                    </Text>
                </View>
                <View style={styles.pointsBadge}>
                    <Text style={styles.pointsValue}>{item.puntos}</Text>
                </View>
            </View>
        </Card>
    );

    // Agrupar posiciones por grupo
    const posicionesPorGrupo = posiciones.reduce((acc, equipo) => {
        const grupo = equipo.grupo || 'Sin Grupo';
        if (!acc[grupo]) acc[grupo] = [];
        acc[grupo].push(equipo);
        return acc;
    }, {});

    // Ordenar equipos dentro de cada grupo
    Object.keys(posicionesPorGrupo).forEach(grupo => {
        posicionesPorGrupo[grupo].sort((a, b) => {
            if (b.puntos !== a.puntos) return b.puntos - a.puntos;
            if (b.diferencia_gol !== a.diferencia_gol) return b.diferencia_gol - a.diferencia_gol;
            return b.goles_favor - a.goles_favor;
        });
    });

    const renderPosicionesConGrupos = () => {
        const grupos = Object.keys(posicionesPorGrupo).sort();

        if (grupos.length === 0 || (grupos.length === 1 && grupos[0] === 'Sin Grupo')) {
            // Sin grupos, mostrar lista normal
            return (
                <FlatList
                    data={posiciones.sort((a, b) => b.puntos - a.puntos)}
                    keyExtractor={(item, index) => item.id?.toString() || `${index}`}
                    renderItem={renderPosicion}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="stats-chart-outline" size={48} color={COLORS.textLight} />
                            <Text style={styles.emptyText}>No hay datos disponibles</Text>
                        </View>
                    }
                />
            );
        }

        return (
            <FlatList
                data={grupos}
                keyExtractor={(grupo) => grupo}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                }
                renderItem={({ item: grupo }) => (
                    <View style={styles.grupoSection}>
                        <View style={styles.grupoHeader}>
                            <Ionicons name="trophy-outline" size={18} color={COLORS.primary} />
                            <Text style={styles.grupoTitle}>{grupo}</Text>
                        </View>
                        {posicionesPorGrupo[grupo].map((equipo, index) => (
                            <Card key={equipo.id} style={styles.itemCard}>
                                <View style={styles.rankContainer}>
                                    <Text style={[styles.rank, index < 2 && styles.topRank]}>
                                        {index + 1}
                                    </Text>
                                </View>
                                <View style={[styles.teamBadge, { backgroundColor: equipo.color_principal || COLORS.primary }]}>
                                    <Ionicons name="shield" size={16} color="#fff" />
                                </View>
                                <View style={styles.playerInfo}>
                                    <Text style={styles.playerName}>{equipo.nombre}</Text>
                                    <Text style={styles.teamName}>
                                        {equipo.partidos_ganados}G {equipo.partidos_empatados}E {equipo.partidos_perdidos}P
                                    </Text>
                                </View>
                                <View style={styles.statsRow}>
                                    <View style={styles.miniStat}>
                                        <Text style={styles.miniLabel}>DIF</Text>
                                        <Text style={[styles.miniValue, { color: equipo.diferencia_gol >= 0 ? COLORS.success : COLORS.error }]}>
                                            {equipo.diferencia_gol > 0 ? '+' : ''}{equipo.diferencia_gol}
                                        </Text>
                                    </View>
                                    <View style={styles.pointsBadge}>
                                        <Text style={styles.pointsValue}>{equipo.puntos}</Text>
                                    </View>
                                </View>
                            </Card>
                        ))}
                    </View>
                )}
            />
        );
    };

    if (loading) {
        return <Loading message="Cargando estadísticas..." />;
    }

    const tabs = [
        { key: 'goleadores', label: 'Goleadores', icon: 'football' },
        { key: 'valla', label: 'Valla Menos Vencida', icon: 'shield-checkmark' },
        { key: 'tabla', label: 'Posiciones', icon: 'trophy' },
    ];

    // Para Posiciones, usamos renderizado especial con grupos
    if (activeTab === 'tabla') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>Estadísticas</Text>
                        <Text style={styles.headerSubtitle}>{torneoNombre}</Text>
                    </View>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.tabsContainer}>
                    {tabs.map((tab) => (
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
                {renderPosicionesConGrupos()}
            </SafeAreaView>
        );
    }

    const getData = () => {
        switch (activeTab) {
            case 'goleadores':
                return goleadores;
            case 'valla':
                return vallasMenosVencidas;
            default:
                return [];
        }
    };

    const getRenderItem = () => {
        switch (activeTab) {
            case 'goleadores':
                return renderGoleador;
            case 'valla':
                return renderValla;
            default:
                return renderGoleador;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Estadísticas</Text>
                    <Text style={styles.headerSubtitle}>{torneoNombre}</Text>
                </View>
                <View style={{ width: 24 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                {tabs.map((tab) => (
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

            {/* Lista */}
            <FlatList
                data={getData()}
                keyExtractor={(item, index) => item.id?.toString() || `${index}`}
                renderItem={getRenderItem()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="stats-chart-outline" size={48} color={COLORS.textLight} />
                        <Text style={styles.emptyText}>No hay datos disponibles</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    grupoSection: {
        marginBottom: 20,
    },
    grupoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingVertical: 8,
        borderBottomWidth: 2,
        borderBottomColor: COLORS.primary,
    },
    grupoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
        marginLeft: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: COLORS.surface,
    },
    headerCenter: {
        flex: 1,
        marginLeft: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    headerSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 20,
        marginHorizontal: 4,
    },
    tabActive: {
        backgroundColor: `${COLORS.primary}15`,
    },
    tabText: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginLeft: 4,
        fontWeight: '500',
    },
    tabTextActive: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingVertical: 12,
    },
    rankContainer: {
        width: 32,
        alignItems: 'center',
    },
    rank: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    topRank: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.primary,
    },
    teamBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    playerInfo: {
        flex: 1,
        marginLeft: 8,
    },
    playerName: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    teamName: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    statContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginRight: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginLeft: 6,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    miniStat: {
        alignItems: 'center',
        marginHorizontal: 6,
    },
    miniLabel: {
        fontSize: 9,
        color: COLORS.textSecondary,
    },
    miniValue: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    pointsBadge: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 8,
    },
    pointsValue: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textOnPrimary,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 12,
    },
});

export default EstadisticasScreen;
