import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    Alert,
    RefreshControl,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Card, Loading, EmptyState } from '../../components/common';
import jugadorService from '../../services/jugadorService';
import torneoService from '../../services/torneoService';
import imageService from '../../services/imageService';
import { COLORS, PLAYER_POSITIONS } from '../../utils/constants';

const GestionarJugadoresScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { equipoId, equipoNombre, torneoId } = route.params;
    const [jugadores, setJugadores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingJugador, setEditingJugador] = useState(null);
    const [saving, setSaving] = useState(false);

    // Límite de jugadores del torneo
    const [maxJugadores, setMaxJugadores] = useState(12);

    const [formData, setFormData] = useState({
        nombre: '',
        apellido: '',
        numero_camiseta: '',
        posicion: 'mediocampista',
    });
    const [fotoUri, setFotoUri] = useState(null);
    const [errors, setErrors] = useState({});

    const loadJugadores = useCallback(async () => {
        try {
            const data = await jugadorService.getJugadoresByEquipo(equipoId);
            setJugadores(data || []);
        } catch (error) {
            console.error('Error loading jugadores:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [equipoId]);

    const loadTorneoConfig = useCallback(async () => {
        if (torneoId) {
            try {
                const torneo = await torneoService.getTorneoById(torneoId);
                if (torneo?.max_jugadores_equipo) {
                    setMaxJugadores(torneo.max_jugadores_equipo);
                }
            } catch (error) {
                console.error('Error loading torneo config:', error);
            }
        }
    }, [torneoId]);

    useEffect(() => {
        loadJugadores();
        loadTorneoConfig();
    }, [loadJugadores, loadTorneoConfig]);

    const onRefresh = () => {
        setRefreshing(true);
        loadJugadores();
    };

    const openModal = (jugador = null) => {
        // Verificar límite antes de abrir modal para nuevo jugador
        if (!jugador && jugadores.length >= maxJugadores) {
            Alert.alert(
                'Límite Alcanzado',
                `Este equipo ya tiene ${maxJugadores} jugadores, que es el máximo permitido para este torneo.`,
                [{ text: 'Entendido' }]
            );
            return;
        }

        if (jugador) {
            setEditingJugador(jugador);
            setFormData({
                nombre: jugador.nombre,
                apellido: jugador.apellido || '',
                numero_camiseta: jugador.numero_camiseta?.toString() || '',
                posicion: jugador.posicion || 'ala',
            });
        } else {
            setEditingJugador(null);
            setFormData({
                nombre: '',
                apellido: '',
                numero_camiseta: '',
                posicion: 'ala',
            });
        }
        setErrors({});
        setFotoUri(null);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setEditingJugador(null);
        setFotoUri(null);
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.nombre.trim()) {
            newErrors.nombre = 'El nombre es requerido';
        }
        if (!formData.numero_camiseta) {
            newErrors.numero_camiseta = 'El número es requerido';
        } else {
            const num = parseInt(formData.numero_camiseta);
            if (isNaN(num) || num < 1 || num > 99) {
                newErrors.numero_camiseta = 'Número entre 1 y 99';
            }
            const existe = jugadores.find(
                j => j.numero_camiseta === num && j.id !== editingJugador?.id
            );
            if (existe) {
                newErrors.numero_camiseta = 'Este número ya está en uso';
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;

        setSaving(true);
        try {
            const jugadorData = {
                nombre: formData.nombre.trim(),
                apellido: formData.apellido.trim() || null,
                numero_camiseta: parseInt(formData.numero_camiseta),
                posicion: formData.posicion,
            };

            let jugadorId;
            if (editingJugador) {
                await jugadorService.actualizarJugador(editingJugador.id, jugadorData);
                jugadorId = editingJugador.id;
                Alert.alert('Éxito', 'Jugador actualizado');
            } else {
                const nuevoJugador = await jugadorService.crearJugador(equipoId, jugadorData);
                jugadorId = nuevoJugador.id;
                Alert.alert('Éxito', 'Jugador agregado');
            }

            // Subir foto si se seleccionó
            if (fotoUri && jugadorId) {
                try {
                    const fotoUrl = await imageService.uploadJugadorFoto(fotoUri, jugadorId);
                    await jugadorService.actualizarJugador(jugadorId, { foto_url: fotoUrl });
                } catch (imgError) {
                    console.log('Error uploading photo:', imgError);
                }
            }

            closeModal();
            loadJugadores();
        } catch (error) {
            console.error('Error saving jugador:', error);
            Alert.alert('Error', error.message || 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (jugador) => {
        // Verificar si tiene estadísticas
        const hasStats = (jugador.goles_totales || 0) > 0 ||
            (jugador.tarjetas_amarillas || 0) > 0 ||
            (jugador.tarjetas_rojas || 0) > 0 ||
            (jugador.tarjetas_azules || 0) > 0;

        let message = `¿Eliminar a ${jugador.nombre} ${jugador.apellido || ''}?`;

        if (hasStats) {
            message += `\n\n⚠️ Este jugador tiene estadísticas:\n`;
            if (jugador.goles_totales > 0) message += `• ${jugador.goles_totales} goles\n`;
            if (jugador.tarjetas_amarillas > 0) message += `• ${jugador.tarjetas_amarillas} tarjetas amarillas\n`;
            if (jugador.tarjetas_rojas > 0) message += `• ${jugador.tarjetas_rojas} tarjetas rojas\n`;
            if (jugador.tarjetas_azules > 0) message += `• ${jugador.tarjetas_azules} tarjetas azules\n`;
            message += `\nEstas estadísticas se perderán permanentemente.`;
        }

        Alert.alert(
            hasStats ? '⚠️ Eliminar Jugador con Estadísticas' : 'Eliminar Jugador',
            message,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: hasStats ? 'Eliminar de todas formas' : 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await jugadorService.eliminarJugador(jugador.id);
                            loadJugadores();
                        } catch (error) {
                            Alert.alert('Error', 'No se pudo eliminar. El jugador puede tener eventos registrados.');
                        }
                    },
                },
            ]
        );
    };

    const handleSetCapitan = async (jugador) => {
        try {
            await jugadorService.asignarCapitan(equipoId, jugador.id);
            loadJugadores();
            Alert.alert('Éxito', `${jugador.nombre} es ahora el capitán`);
        } catch (error) {
            Alert.alert('Error', 'No se pudo asignar capitán');
        }
    };

    const getPositionLabel = (pos) => {
        return PLAYER_POSITIONS.find(p => p.value === pos)?.label || pos;
    };

    const canAddMore = jugadores.length < maxJugadores;

    const renderJugador = ({ item }) => (
        <Card style={styles.jugadorCard}>
            <View style={styles.jugadorHeader}>
                <View style={styles.numeroContainer}>
                    <Text style={styles.numero}>{item.numero_camiseta}</Text>
                </View>
                {/* Foto del jugador */}
                {item.foto_url ? (
                    <Image source={{ uri: item.foto_url }} style={styles.jugadorPhoto} />
                ) : (
                    <View style={styles.jugadorPhotoPlaceholder}>
                        <Ionicons name="person" size={18} color={COLORS.textLight} />
                    </View>
                )}
                <View style={styles.jugadorInfo}>
                    <View style={styles.nombreRow}>
                        <Text style={styles.nombre}>
                            {item.nombre} {item.apellido || ''}
                        </Text>
                        {item.es_capitan && (
                            <View style={styles.capitanBadge}>
                                <Text style={styles.capitanText}>C</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.posicion}>{getPositionLabel(item.posicion)}</Text>
                </View>
                <View style={styles.stats}>
                    <View style={styles.statItem}>
                        <Ionicons name="football" size={14} color={COLORS.success} />
                        <Text style={styles.statValue}>{item.goles_totales || 0}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <View style={[styles.miniCard, { backgroundColor: COLORS.yellowCard }]} />
                        <Text style={styles.statValue}>{item.tarjetas_amarillas || 0}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.jugadorActions}>
                {!item.es_capitan && (
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleSetCapitan(item)}
                    >
                        <Ionicons name="star-outline" size={16} color={COLORS.warning} />
                        <Text style={styles.actionText}>Capitán</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => openModal(item)}
                >
                    <Ionicons name="pencil" size={16} color={COLORS.primary} />
                    <Text style={styles.actionText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(item)}
                >
                    <Ionicons name="trash" size={16} color={COLORS.error} />
                    <Text style={[styles.actionText, { color: COLORS.error }]}>Eliminar</Text>
                </TouchableOpacity>
            </View>
        </Card>
    );

    if (loading) {
        return <Loading message="Cargando jugadores..." />;
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Jugadores</Text>
                    <Text style={styles.headerSubtitle}>{equipoNombre}</Text>
                </View>
                {canAddMore ? (
                    <TouchableOpacity onPress={() => openModal()}>
                        <Ionicons name="add-circle" size={28} color={COLORS.primary} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 28 }} />
                )}
            </View>

            {/* Indicador de límite */}
            <View style={styles.limitIndicator}>
                <Text style={[styles.limitText, !canAddMore && styles.limitReached]}>
                    {jugadores.length}/{maxJugadores} jugadores
                </Text>
                {!canAddMore && (
                    <Text style={styles.limitWarning}>Límite alcanzado</Text>
                )}
            </View>

            <FlatList
                data={jugadores}
                keyExtractor={(item) => item.id}
                renderItem={renderJugador}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                }
                ListEmptyComponent={
                    <EmptyState
                        icon="person-outline"
                        title="Sin jugadores"
                        message="Agrega jugadores a este equipo"
                        actionText="Agregar Jugador"
                        onAction={() => openModal()}
                    />
                }
            />

            {canAddMore && jugadores.length > 0 && (
                <TouchableOpacity style={[styles.fab, { bottom: 20 + insets.bottom }]} onPress={() => openModal()}>
                    <Ionicons name="add" size={28} color={COLORS.textOnPrimary} />
                </TouchableOpacity>
            )}

            {/* Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingJugador ? 'Editar Jugador' : 'Nuevo Jugador'}
                            </Text>
                            <TouchableOpacity onPress={closeModal}>
                                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        {/* Selector de Foto */}
                        <TouchableOpacity
                            style={styles.fotoPicker}
                            onPress={async () => {
                                try {
                                    const uri = await imageService.pickImage();
                                    if (uri) setFotoUri(uri);
                                } catch (err) {
                                    Alert.alert('Error', err.message);
                                }
                            }}
                        >
                            {fotoUri || editingJugador?.foto_url ? (
                                <Image
                                    source={{ uri: fotoUri || editingJugador?.foto_url }}
                                    style={styles.fotoPreview}
                                />
                            ) : (
                                <View style={styles.fotoPlaceholder}>
                                    <Ionicons name="person" size={32} color={COLORS.textSecondary} />
                                    <Text style={styles.fotoPlaceholderText}>Agregar Foto</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        {/* Botón para eliminar foto */}
                        {(fotoUri || editingJugador?.foto_url) && (
                            <TouchableOpacity
                                style={styles.deletePhotoBtn}
                                onPress={() => {
                                    Alert.alert(
                                        'Eliminar Foto',
                                        '¿Estás seguro de que deseas eliminar la foto?',
                                        [
                                            { text: 'Cancelar', style: 'cancel' },
                                            {
                                                text: 'Eliminar',
                                                style: 'destructive',
                                                onPress: async () => {
                                                    setFotoUri(null);
                                                    if (editingJugador?.id && editingJugador?.foto_url) {
                                                        try {
                                                            // Eliminar del storage
                                                            await imageService.deleteImage(editingJugador.foto_url);
                                                            // Actualizar en BD
                                                            await jugadorService.actualizarJugador(editingJugador.id, { foto_url: null });
                                                            setEditingJugador({ ...editingJugador, foto_url: null });
                                                            loadJugadores();
                                                            Alert.alert('Éxito', 'Foto eliminada correctamente');
                                                        } catch (err) {
                                                            console.error('Error deleting photo:', err);
                                                            Alert.alert('Error', 'No se pudo eliminar la foto');
                                                        }
                                                    } else {
                                                        // Solo se está eliminando la preview local
                                                        setFotoUri(null);
                                                    }
                                                }
                                            }
                                        ]
                                    );
                                }}
                            >
                                <Ionicons name="trash" size={16} color={COLORS.error} />
                                <Text style={styles.deletePhotoText}>Eliminar foto</Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.formRow}>
                            <View style={{ flex: 2, marginRight: 8 }}>
                                <Input
                                    label="Nombre *"
                                    value={formData.nombre}
                                    onChangeText={(v) => setFormData({ ...formData, nombre: v })}
                                    placeholder="Juan"
                                    error={errors.nombre}
                                />
                            </View>
                            <View style={{ flex: 2 }}>
                                <Input
                                    label="Apellido"
                                    value={formData.apellido}
                                    onChangeText={(v) => setFormData({ ...formData, apellido: v })}
                                    placeholder="Pérez"
                                />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Input
                                    label="Número *"
                                    value={formData.numero_camiseta}
                                    onChangeText={(v) => setFormData({ ...formData, numero_camiseta: v })}
                                    placeholder="10"
                                    keyboardType="numeric"
                                    error={errors.numero_camiseta}
                                />
                            </View>
                            <View style={{ flex: 2 }}>
                                <Text style={styles.label}>Posición</Text>
                                <View style={styles.posicionGrid}>
                                    {PLAYER_POSITIONS.map((pos) => (
                                        <TouchableOpacity
                                            key={pos.value}
                                            style={[
                                                styles.posicionBtn,
                                                formData.posicion === pos.value && styles.posicionBtnActive,
                                            ]}
                                            onPress={() => setFormData({ ...formData, posicion: pos.value })}
                                        >
                                            <Text
                                                style={[
                                                    styles.posicionText,
                                                    formData.posicion === pos.value && styles.posicionTextActive,
                                                ]}
                                            >
                                                {pos.short}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        <View style={[styles.modalActions, { paddingBottom: insets.bottom }]}>
                            <Button
                                title="Cancelar"
                                onPress={closeModal}
                                variant="outline"
                                style={{ flex: 1, marginRight: 8 }}
                            />
                            <Button
                                title={editingJugador ? 'Guardar' : 'Agregar'}
                                onPress={handleSave}
                                loading={saving}
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
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
    headerCenter: { flex: 1, marginLeft: 16 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    headerSubtitle: { fontSize: 13, color: COLORS.textSecondary },
    limitIndicator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.surfaceVariant },
    limitText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
    limitReached: { color: COLORS.error },
    limitWarning: { fontSize: 12, color: COLORS.error, fontWeight: '600' },
    listContent: { padding: 16, paddingBottom: 80 },
    jugadorCard: { marginBottom: 10 },
    jugadorHeader: { flexDirection: 'row', alignItems: 'center' },
    numeroContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    numero: { fontSize: 18, fontWeight: '700', color: COLORS.textOnPrimary },
    jugadorPhoto: { width: 40, height: 40, borderRadius: 20, marginLeft: 10, backgroundColor: COLORS.background },
    jugadorPhotoPlaceholder: { width: 40, height: 40, borderRadius: 20, marginLeft: 10, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
    jugadorInfo: { flex: 1, marginLeft: 12 },
    nombreRow: { flexDirection: 'row', alignItems: 'center' },
    nombre: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
    capitanBadge: { backgroundColor: COLORS.warning, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    capitanText: { fontSize: 12, fontWeight: '700', color: COLORS.textOnPrimary },
    posicion: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
    stats: { flexDirection: 'row' },
    statItem: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
    statValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginLeft: 4 },
    miniCard: { width: 12, height: 16, borderRadius: 2 },
    jugadorActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.divider },
    actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10 },
    actionText: { fontSize: 12, color: COLORS.textSecondary, marginLeft: 4 },
    fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
    formRow: { flexDirection: 'row' },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
    posicionGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    posicionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: COLORS.surfaceVariant, marginRight: 6, marginBottom: 6 },
    posicionBtnActive: { backgroundColor: COLORS.primary },
    posicionText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
    posicionTextActive: { color: COLORS.textOnPrimary },
    modalActions: { flexDirection: 'row', marginTop: 16 },
    fotoPicker: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: COLORS.divider,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 16,
        overflow: 'hidden',
    },
    fotoPreview: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
    },
    fotoPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    fotoPlaceholderText: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    deletePhotoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        padding: 6,
    },
    deletePhotoText: {
        fontSize: 12,
        color: COLORS.error,
        marginLeft: 4,
    },
});

export default GestionarJugadoresScreen;
