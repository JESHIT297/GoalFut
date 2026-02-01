import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Loading, Card } from '../../components/common';
import torneoService from '../../services/torneoService';
import imageService from '../../services/imageService';
import { getErrorMessage } from '../../utils/errorHandler';
import { COLORS, TOURNAMENT_STATUS } from '../../utils/constants';

const EditarTorneoScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { torneoId } = route.params;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        lugar: '',
        duracion_tiempo_minutos: '20',
        cantidad_tiempos: '2',
        max_jugadores_equipo: '12',
        min_jugadores_equipo: '5',
        puntos_victoria: '3',
        puntos_empate: '1',
        puntos_derrota: '0',
    });
    const [errors, setErrors] = useState({});
    const [imagenUri, setImagenUri] = useState(null);
    const [originalImagenUrl, setOriginalImagenUrl] = useState(null);

    useEffect(() => {
        loadTorneo();
    }, [torneoId]);

    const loadTorneo = async () => {
        try {
            const data = await torneoService.getTorneoById(torneoId);
            if (data) {
                setFormData({
                    nombre: data.nombre || '',
                    descripcion: data.descripcion || '',
                    lugar: data.lugar || '',
                    duracion_tiempo_minutos: String(data.duracion_tiempo_minutos || 20),
                    cantidad_tiempos: String(data.cantidad_tiempos || 2),
                    max_jugadores_equipo: String(data.max_jugadores_equipo || 12),
                    min_jugadores_equipo: String(data.min_jugadores_equipo || 5),
                    puntos_victoria: String(data.puntos_victoria || 3),
                    puntos_empate: String(data.puntos_empate || 1),
                    puntos_derrota: String(data.puntos_derrota || 0),
                });
                // Cargar imagen existente
                if (data.imagen_url) {
                    setImagenUri(data.imagen_url);
                    setOriginalImagenUrl(data.imagen_url);
                }
            }
        } catch (error) {
            Alert.alert('Error', getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.nombre.trim()) {
            newErrors.nombre = 'El nombre es requerido';
        }
        if (!formData.lugar.trim()) {
            newErrors.lugar = 'El lugar es requerido';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Seleccionar imagen del torneo
    const seleccionarImagen = async () => {
        try {
            const result = await imageService.pickImage();
            if (result) {
                setImagenUri(result); // pickImage devuelve directamente la URI
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo seleccionar la imagen');
        }
    };

    const handleSave = async () => {
        if (!validate()) return;

        setSaving(true);
        try {
            // Subir nueva imagen si cambió
            let imagenUrl = originalImagenUrl;
            if (imagenUri && imagenUri !== originalImagenUrl) {
                try {
                    imagenUrl = await imageService.uploadImage(imagenUri, 'torneos', 'torneo');
                } catch (imgError) {
                    console.error('Error uploading image:', imgError);
                }
            } else if (!imagenUri && originalImagenUrl) {
                // Si se eliminó la imagen, borrarla del storage
                try {
                    await imageService.deleteImage(originalImagenUrl);
                    imagenUrl = null;
                } catch (imgError) {
                    console.error('Error deleting image:', imgError);
                }
            }

            await torneoService.actualizarTorneo(torneoId, {
                nombre: formData.nombre.trim(),
                descripcion: formData.descripcion.trim() || null,
                lugar: formData.lugar.trim(),
                imagen_url: imagenUrl,
                duracion_tiempo_minutos: parseInt(formData.duracion_tiempo_minutos),
                cantidad_tiempos: parseInt(formData.cantidad_tiempos),
                max_jugadores_equipo: parseInt(formData.max_jugadores_equipo),
                min_jugadores_equipo: parseInt(formData.min_jugadores_equipo),
                puntos_victoria: parseInt(formData.puntos_victoria),
                puntos_empate: parseInt(formData.puntos_empate),
                puntos_derrota: parseInt(formData.puntos_derrota),
            });

            Alert.alert('Éxito', 'Torneo actualizado correctamente', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Alert.alert('Error', getErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <Loading message="Cargando torneo..." />;
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Editar Torneo</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
                <Card style={styles.section}>
                    <Text style={styles.sectionTitle}>Información General</Text>

                    <Input
                        label="Nombre del Torneo *"
                        value={formData.nombre}
                        onChangeText={(v) => setFormData({ ...formData, nombre: v })}
                        placeholder="Ej: Copa Verano 2026"
                        error={errors.nombre}
                    />

                    <Input
                        label="Descripción"
                        value={formData.descripcion}
                        onChangeText={(v) => setFormData({ ...formData, descripcion: v })}
                        placeholder="Descripción del torneo"
                        multiline
                        numberOfLines={3}
                    />

                    <Input
                        label="Lugar *"
                        value={formData.lugar}
                        onChangeText={(v) => setFormData({ ...formData, lugar: v })}
                        placeholder="Ej: Polideportivo Central"
                        error={errors.lugar}
                    />

                    {/* Imagen del torneo */}
                    <Text style={styles.inputLabel}>Imagen del Torneo</Text>
                    <View style={styles.imagenContainer}>
                        {imagenUri ? (
                            <View style={styles.imagenPreviewContainer}>
                                <Image source={{ uri: imagenUri }} style={styles.imagenPreview} />
                                <View style={styles.imagenActions}>
                                    <TouchableOpacity
                                        style={styles.cambiarImagenBtn}
                                        onPress={seleccionarImagen}
                                    >
                                        <Ionicons name="camera-outline" size={18} color={COLORS.primary} />
                                        <Text style={styles.cambiarImagenText}>Cambiar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.eliminarImagenBtn}
                                        onPress={() => setImagenUri(null)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                                        <Text style={styles.eliminarImagenText}>Eliminar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.imagenPickerBtn}
                                onPress={seleccionarImagen}
                            >
                                <Ionicons name="trophy-outline" size={40} color={COLORS.textSecondary} />
                                <Text style={styles.imagenPickerText}>Agregar imagen de copa</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </Card>

                <Card style={styles.section}>
                    <Text style={styles.sectionTitle}>Configuración de Partido</Text>

                    <View style={styles.row}>
                        <View style={styles.halfInput}>
                            <Input
                                label="Duración (min)"
                                value={formData.duracion_tiempo_minutos}
                                onChangeText={(v) => setFormData({ ...formData, duracion_tiempo_minutos: v })}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.halfInput}>
                            <Input
                                label="Tiempos"
                                value={formData.cantidad_tiempos}
                                onChangeText={(v) => setFormData({ ...formData, cantidad_tiempos: v })}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.halfInput}>
                            <Input
                                label="Máx. Jugadores/Equipo"
                                value={formData.max_jugadores_equipo}
                                onChangeText={(v) => setFormData({ ...formData, max_jugadores_equipo: v })}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.halfInput}>
                            <Input
                                label="Mín. Jugadores/Equipo"
                                value={formData.min_jugadores_equipo}
                                onChangeText={(v) => setFormData({ ...formData, min_jugadores_equipo: v })}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>
                </Card>

                <Card style={styles.section}>
                    <Text style={styles.sectionTitle}>Puntuación</Text>

                    <View style={styles.row}>
                        <View style={styles.thirdInput}>
                            <Input
                                label="Victoria"
                                value={formData.puntos_victoria}
                                onChangeText={(v) => setFormData({ ...formData, puntos_victoria: v })}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.thirdInput}>
                            <Input
                                label="Empate"
                                value={formData.puntos_empate}
                                onChangeText={(v) => setFormData({ ...formData, puntos_empate: v })}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.thirdInput}>
                            <Input
                                label="Derrota"
                                value={formData.puntos_derrota}
                                onChangeText={(v) => setFormData({ ...formData, puntos_derrota: v })}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>
                </Card>

                <Button
                    title="Guardar Cambios"
                    onPress={handleSave}
                    loading={saving}
                    style={styles.saveButton}
                />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.surface },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    content: { padding: 16 },
    section: { marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
    row: { flexDirection: 'row', marginHorizontal: -8 },
    halfInput: { flex: 1, paddingHorizontal: 8 },
    thirdInput: { flex: 1, paddingHorizontal: 8 },
    saveButton: { marginTop: 16, marginBottom: 32 },
    // Estilos para imagen del torneo
    inputLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8, marginTop: 16 },
    imagenContainer: { marginBottom: 16 },
    imagenPreviewContainer: { alignItems: 'center' },
    imagenPreview: { width: 150, height: 150, borderRadius: 12, backgroundColor: COLORS.surfaceVariant },
    imagenActions: { flexDirection: 'row', marginTop: 12 },
    cambiarImagenBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: COLORS.primary },
    cambiarImagenText: { marginLeft: 6, fontSize: 14, fontWeight: '600', color: COLORS.primary },
    eliminarImagenBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.error },
    eliminarImagenText: { marginLeft: 6, fontSize: 14, fontWeight: '600', color: COLORS.error },
    imagenPickerBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceVariant, borderRadius: 12, padding: 24, borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed' },
    imagenPickerText: { marginTop: 8, fontSize: 14, color: COLORS.textSecondary },
});

export default EditarTorneoScreen;
