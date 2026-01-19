import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    Modal,
    Alert,
    RefreshControl,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Card, Loading, EmptyState } from '../../components/common';
import equipoService from '../../services/equipoService';
import imageService from '../../services/imageService';
import { COLORS } from '../../utils/constants';

const GestionarEquiposScreen = ({ route, navigation }) => {
    const { torneoId } = route.params;
    const [equipos, setEquipos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingEquipo, setEditingEquipo] = useState(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        nombre: '',
        nombre_corto: '',
        color_principal: '#1E88E5',
    });
    const [logoUri, setLogoUri] = useState(null);
    const [errors, setErrors] = useState({});

    const coloresDisponibles = [
        '#1E88E5', '#E53935', '#43A047', '#FB8C00',
        '#8E24AA', '#00ACC1', '#FFB300', '#5E35B1',
        '#D81B60', '#00897B', '#3949AB', '#C0CA33',
    ];

    const loadEquipos = useCallback(async () => {
        try {
            const data = await equipoService.getEquiposByTorneo(torneoId);
            setEquipos(data || []);
        } catch (error) {
            console.error('Error loading equipos:', error);
            Alert.alert('Error', 'No se pudieron cargar los equipos');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [torneoId]);

    useEffect(() => {
        loadEquipos();
    }, [loadEquipos]);

    const onRefresh = () => {
        setRefreshing(true);
        loadEquipos();
    };

    const openModal = (equipo = null) => {
        if (equipo) {
            setEditingEquipo(equipo);
            setFormData({
                nombre: equipo.nombre,
                nombre_corto: equipo.nombre_corto || '',
                color_principal: equipo.color_principal || '#1E88E5',
            });
        } else {
            setEditingEquipo(null);
            setFormData({
                nombre: '',
                nombre_corto: '',
                color_principal: '#1E88E5',
            });
        }
        setErrors({});
        setLogoUri(null);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setEditingEquipo(null);
        setLogoUri(null);
        setErrors({});
        setFormData({ nombre: '', nombre_corto: '', color_principal: '#1E88E5' });
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.nombre.trim()) {
            newErrors.nombre = 'El nombre es requerido';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;

        setSaving(true);
        try {
            const equipoData = {
                nombre: formData.nombre.trim(),
                nombre_corto: formData.nombre_corto.trim() || formData.nombre.substring(0, 3).toUpperCase(),
                color_principal: formData.color_principal,
            };

            if (editingEquipo) {
                await equipoService.actualizarEquipo(editingEquipo.id, equipoData);
                Alert.alert('Éxito', 'Equipo actualizado correctamente');
            } else {
                await equipoService.crearEquipo(torneoId, equipoData);
                Alert.alert('Éxito', 'Equipo creado correctamente');
            }

            const equipoId = editingEquipo?.id || data.id;

            // Si hay logo seleccionado, subirlo
            if (logoUri) {
                try {
                    const logoUrl = await imageService.uploadEquipoLogo(logoUri, equipoId);
                    await equipoService.actualizarEquipo(equipoId, { logo_url: logoUrl });
                } catch (imgError) {
                    console.log('Error uploading logo:', imgError);
                    // No interrumpir si falla la imagen
                }
            }

            closeModal();
            loadEquipos();
        } catch (error) {
            console.error('Error saving equipo:', error);
            Alert.alert('Error', error.message || 'No se pudo guardar el equipo');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (equipo) => {
        Alert.alert(
            'Eliminar Equipo',
            `¿Estás seguro de que deseas eliminar "${equipo.nombre}"? Esta acción no se puede deshacer.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await equipoService.eliminarEquipo(equipo.id);
                            loadEquipos();
                            Alert.alert('Éxito', 'Equipo eliminado correctamente');
                        } catch (error) {
                            console.error('Error deleting equipo:', error);
                            Alert.alert('Error', 'No se pudo eliminar el equipo');
                        }
                    },
                },
            ]
        );
    };

    const navigateToJugadores = (equipo) => {
        navigation.navigate('GestionarJugadores', {
            equipoId: equipo.id,
            equipoNombre: equipo.nombre,
            torneoId
        });
    };

    const renderEquipo = ({ item }) => (
        <Card style={styles.equipoCard}>
            <View style={styles.equipoHeader}>
                <View style={[styles.equipoColor, { backgroundColor: item.color_principal || COLORS.primary }]}>
                    <Ionicons name="shield" size={24} color={COLORS.textOnPrimary} />
                </View>
                <View style={styles.equipoInfo}>
                    <Text style={styles.equipoNombre}>{item.nombre}</Text>
                    <Text style={styles.equipoCorto}>{item.nombre_corto || '-'}</Text>
                </View>
                <View style={styles.equipoStats}>
                    <Text style={styles.statValue}>{item.jugadores?.[0]?.count || 0}</Text>
                    <Text style={styles.statLabel}>Jugadores</Text>
                </View>
            </View>

            <View style={styles.equipoActions}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigateToJugadores(item)}
                >
                    <Ionicons name="people" size={18} color={COLORS.primary} />
                    <Text style={styles.actionText}>Jugadores</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openModal(item)}
                >
                    <Ionicons name="pencil" size={18} color={COLORS.warning} />
                    <Text style={styles.actionText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDelete(item)}
                >
                    <Ionicons name="trash" size={18} color={COLORS.error} />
                    <Text style={[styles.actionText, { color: COLORS.error }]}>Eliminar</Text>
                </TouchableOpacity>
            </View>
        </Card>
    );

    if (loading) {
        return <Loading message="Cargando equipos..." />;
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Gestionar Equipos</Text>
                <TouchableOpacity onPress={() => openModal()}>
                    <Ionicons name="add-circle" size={28} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            {/* Lista de equipos */}
            <FlatList
                data={equipos}
                keyExtractor={(item) => item.id}
                renderItem={renderEquipo}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                }
                ListEmptyComponent={
                    <EmptyState
                        icon="people-outline"
                        title="Sin equipos"
                        message="Agrega equipos a este torneo"
                        actionText="Agregar Equipo"
                        onAction={() => openModal()}
                    />
                }
                ListHeaderComponent={
                    equipos.length > 0 ? (
                        <Text style={styles.countText}>{equipos.length} equipo(s) registrado(s)</Text>
                    ) : null
                }
            />

            {/* Botón flotante */}
            {equipos.length > 0 && (
                <TouchableOpacity style={styles.fab} onPress={() => openModal()}>
                    <Ionicons name="add" size={28} color={COLORS.textOnPrimary} />
                </TouchableOpacity>
            )}

            {/* Modal para agregar/editar equipo */}
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
                                {editingEquipo ? 'Editar Equipo' : 'Nuevo Equipo'}
                            </Text>
                            <TouchableOpacity onPress={closeModal}>
                                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <Input
                            label="Nombre del Equipo *"
                            value={formData.nombre}
                            onChangeText={(v) => setFormData({ ...formData, nombre: v })}
                            placeholder="Ej: Los Tigres FC"
                            error={errors.nombre}
                        />

                        <Input
                            label="Nombre Corto (3 letras)"
                            value={formData.nombre_corto}
                            onChangeText={(v) => setFormData({ ...formData, nombre_corto: v.toUpperCase().substring(0, 3) })}
                            placeholder="TIG"
                        />

                        {/* Selector de Logo */}
                        <Text style={styles.colorLabel}>Logo del Equipo</Text>
                        <TouchableOpacity
                            style={styles.logoPicker}
                            onPress={async () => {
                                try {
                                    const uri = await imageService.pickImage();
                                    if (uri) setLogoUri(uri);
                                } catch (err) {
                                    Alert.alert('Error', err.message);
                                }
                            }}
                        >
                            {logoUri || editingEquipo?.logo_url ? (
                                <Image
                                    source={{ uri: logoUri || editingEquipo?.logo_url }}
                                    style={styles.logoPreview}
                                />
                            ) : (
                                <View style={styles.logoPlaceholder}>
                                    <Ionicons name="camera" size={32} color={COLORS.textSecondary} />
                                    <Text style={styles.logoPlaceholderText}>Agregar Logo</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <Text style={styles.colorLabel}>Color del Equipo</Text>
                        <View style={styles.colorGrid}>
                            {coloresDisponibles.map((color) => (
                                <TouchableOpacity
                                    key={color}
                                    style={[
                                        styles.colorOption,
                                        { backgroundColor: color },
                                        formData.color_principal === color && styles.colorOptionSelected,
                                    ]}
                                    onPress={() => setFormData({ ...formData, color_principal: color })}
                                >
                                    {formData.color_principal === color && (
                                        <Ionicons name="checkmark" size={20} color={COLORS.textOnPrimary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalActions}>
                            <Button
                                title="Cancelar"
                                onPress={closeModal}
                                variant="outline"
                                style={{ flex: 1, marginRight: 8 }}
                            />
                            <Button
                                title={editingEquipo ? 'Guardar' : 'Crear Equipo'}
                                onPress={handleSave}
                                loading={saving}
                                style={{ flex: 1, marginLeft: 8 }}
                            />
                        </View>
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    listContent: {
        padding: 16,
        paddingBottom: 80,
    },
    countText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 12,
    },
    equipoCard: {
        marginBottom: 12,
    },
    equipoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    equipoColor: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    equipoInfo: {
        flex: 1,
        marginLeft: 12,
    },
    equipoNombre: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    equipoCorto: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    equipoStats: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.primary,
    },
    statLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
    },
    equipoActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    actionText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginLeft: 4,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
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
        maxHeight: '85%',
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
    colorLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 20,
    },
    colorOption: {
        width: 44,
        height: 44,
        borderRadius: 22,
        margin: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    colorOptionSelected: {
        borderWidth: 3,
        borderColor: COLORS.textPrimary,
    },
    modalActions: {
        flexDirection: 'row',
        marginTop: 10,
    },
    logoPicker: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: COLORS.divider,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 16,
        overflow: 'hidden',
    },
    logoPreview: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
    },
    logoPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoPlaceholderText: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
});

export default GestionarEquiposScreen;
