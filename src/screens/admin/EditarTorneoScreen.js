import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Loading, Card } from '../../components/common';
import torneoService from '../../services/torneoService';
import { getErrorMessage } from '../../utils/errorHandler';
import { COLORS, TOURNAMENT_STATUS } from '../../utils/constants';

const EditarTorneoScreen = ({ route, navigation }) => {
    const { torneoId } = route.params;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        lugar: '',
        duracion_tiempo_minutos: '20',
        cantidad_tiempos: '2',
        puntos_victoria: '3',
        puntos_empate: '1',
        puntos_derrota: '0',
    });
    const [errors, setErrors] = useState({});

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
                    puntos_victoria: String(data.puntos_victoria || 3),
                    puntos_empate: String(data.puntos_empate || 1),
                    puntos_derrota: String(data.puntos_derrota || 0),
                });
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

    const handleSave = async () => {
        if (!validate()) return;

        setSaving(true);
        try {
            await torneoService.actualizarTorneo(torneoId, {
                nombre: formData.nombre.trim(),
                descripcion: formData.descripcion.trim() || null,
                lugar: formData.lugar.trim(),
                duracion_tiempo_minutos: parseInt(formData.duracion_tiempo_minutos),
                cantidad_tiempos: parseInt(formData.cantidad_tiempos),
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
        <SafeAreaView style={styles.container}>
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
        </SafeAreaView>
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
});

export default EditarTorneoScreen;
