import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState } from '../../components/common';
import torneoService from '../../services/torneoService';
import equipoService from '../../services/equipoService';
import { COLORS } from '../../utils/constants';

const BuscarScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('torneos');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return;

        setLoading(true);
        setHasSearched(true);
        try {
            if (activeTab === 'torneos') {
                const data = await torneoService.buscarTorneos(searchQuery.trim());
                setResults(data || []);
            } else {
                const data = await equipoService.buscarEquipos(searchQuery.trim());
                setResults(data || []);
            }
        } catch (error) {
            console.error('Error searching:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, activeTab]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setResults([]);
        setHasSearched(false);
    };

    const renderTorneo = ({ item }) => (
        <TouchableOpacity
            style={styles.resultItem}
            onPress={() => navigation.navigate('TorneoDetail', { torneoId: item.id })}
        >
            <Card style={styles.resultCard}>
                <View style={styles.resultContent}>
                    {item.imagen_url ? (
                        <Image source={{ uri: item.imagen_url }} style={styles.torneoImage} />
                    ) : (
                        <View style={[styles.iconBadge, { backgroundColor: COLORS.primary }]}>
                            <Ionicons name="trophy" size={20} color="#fff" />
                        </View>
                    )}
                    <View style={styles.resultInfo}>
                        <Text style={styles.resultTitle}>{item.nombre}</Text>
                        <Text style={styles.resultSubtitle}>
                            {item.tipo_torneo} • {item.estado}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </View>
            </Card>
        </TouchableOpacity>
    );

    const renderEquipo = ({ item }) => (
        <TouchableOpacity
            style={styles.resultItem}
            onPress={() => {
                if (item.torneo_id) {
                    navigation.navigate('TorneoDetail', { torneoId: item.torneo_id });
                }
            }}
        >
            <Card style={styles.resultCard}>
                <View style={styles.resultContent}>
                    {item.logo_url ? (
                        <Image source={{ uri: item.logo_url }} style={styles.equipoImage} />
                    ) : (
                        <View style={[styles.iconBadge, { backgroundColor: item.color_principal || COLORS.secondary }]}>
                            <Ionicons name="shield" size={20} color="#fff" />
                        </View>
                    )}
                    <View style={styles.resultInfo}>
                        <Text style={styles.resultTitle}>{item.nombre}</Text>
                        <Text style={styles.resultSubtitle}>
                            {item.torneo?.nombre || 'Equipo'}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </View>
            </Card>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Buscar</Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                    <Ionicons name="search" size={20} color={COLORS.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar torneos o equipos..."
                        placeholderTextColor={COLORS.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => {
                            setSearchQuery('');
                            setResults([]);
                            setHasSearched(false);
                        }}>
                            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                    <Text style={styles.searchButtonText}>Buscar</Text>
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'torneos' && styles.activeTab]}
                    onPress={() => handleTabChange('torneos')}
                >
                    <Ionicons
                        name="trophy"
                        size={18}
                        color={activeTab === 'torneos' ? COLORS.primary : COLORS.textSecondary}
                    />
                    <Text style={[styles.tabText, activeTab === 'torneos' && styles.activeTabText]}>
                        Torneos
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'equipos' && styles.activeTab]}
                    onPress={() => handleTabChange('equipos')}
                >
                    <Ionicons
                        name="shield"
                        size={18}
                        color={activeTab === 'equipos' ? COLORS.primary : COLORS.textSecondary}
                    />
                    <Text style={[styles.tabText, activeTab === 'equipos' && styles.activeTabText]}>
                        Equipos
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Results */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Buscando...</Text>
                </View>
            ) : !hasSearched ? (
                <EmptyState
                    icon="search-outline"
                    title="Buscar torneos y equipos"
                    message="Escribe un término de búsqueda para encontrar torneos y equipos"
                />
            ) : results.length === 0 ? (
                <EmptyState
                    icon="search-outline"
                    title="Sin resultados"
                    message={`No se encontraron ${activeTab === 'torneos' ? 'torneos' : 'equipos'} para "${searchQuery}"`}
                />
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    renderItem={activeTab === 'torneos' ? renderTorneo : renderEquipo}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <Text style={styles.resultsCount}>
                            {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                        </Text>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
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
    searchContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    searchInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    searchButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        borderRadius: 12,
        justifyContent: 'center',
    },
    searchButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginRight: 8,
        backgroundColor: COLORS.surfaceVariant,
    },
    activeTab: {
        backgroundColor: `${COLORS.primary}20`,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.textSecondary,
        marginLeft: 6,
    },
    activeTabText: {
        color: COLORS.primary,
    },
    listContent: {
        padding: 16,
    },
    resultsCount: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginBottom: 12,
    },
    resultItem: {
        marginBottom: 8,
    },
    resultCard: {
        padding: 0,
    },
    resultContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    iconBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    torneoImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.background,
    },
    equipoImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.background,
    },
    resultInfo: {
        flex: 1,
        marginLeft: 12,
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    resultSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
});

export default BuscarScreen;
