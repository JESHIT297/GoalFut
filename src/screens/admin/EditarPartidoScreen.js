import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Platform,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Input, Loading, Card } from '../../components/common';
import partidoService from '../../services/partidoService';
import { getErrorMessage } from '../../utils/errorHandler';
import { COLORS, MATCH_STATUS } from '../../utils/constants';

const EditarPartidoScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { partidoId } = route.params;
    const [partido, setPartido] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Estados del formulario
    const [fecha, setFecha] = useState(new Date());
    const [hora, setHora] = useState(new Date());
    const [cancha, setCancha] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        loadPartido();
    }, [partidoId]);

    const loadPartido = async () => {
        try {
            const data = await partidoService.getPartidoById(partidoId);
            setPartido(data);

            // Cargar datos existentes
            if (data.fecha) {
                setFecha(new Date(data.fecha));
            }
            if (data.hora) {
                const [hours, minutes] = data.hora.split(':');
                const horaDate = new Date();
                horaDate.setHours(parseInt(hours), parseInt(minutes));
                setHora(horaDate);
            }
            setCancha(data.cancha || '');
        } catch (error) {
            Alert.alert('Error', getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (event, selectedDate) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setFecha(selectedDate);
        }
    };

    const handleTimeChange = (event, selectedTime) => {
        setShowTimePicker(false);
        if (selectedTime) {
            setHora(selectedTime);
        }
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const formatTime = (time) => {
        return time.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const fechaStr = fecha.toISOString().split('T')[0];
            const horaStr = `${hora.getHours().toString().padStart(2, '0')}:${hora.getMinutes().toString().padStart(2, '0')}`;

            await partidoService.actualizarPartido(partidoId, {
                fecha: fechaStr,
                hora: horaStr,
                cancha: cancha || null,
            });

            Alert.alert('Éxito', 'Partido actualizado correctamente', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Alert.alert('Error', getErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <Loading message="Cargando partido..." />;
    }

    if (!partido) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Text style={styles.errorText}>No se encontró el partido</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Editar Partido</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Equipos */}
                <Card style={styles.matchCard}>
                    <View style={styles.teamsRow}>
                        <View style={styles.team}>
                            {partido.equipo_local?.logo_url ? (
                                <Image source={{ uri: partido.equipo_local.logo_url }} style={styles.teamLogo} />
                            ) : (
                                <View style={[styles.teamBadge, { backgroundColor: partido.equipo_local?.color_principal || COLORS.primary }]}>
                                    <Ionicons name="shield" size={20} color="#fff" />
                                </View>
                            )}
                            <Text style={styles.teamName}>{partido.equipo_local?.nombre_corto || 'Local'}</Text>
                        </View>
                        <Text style={styles.vsText}>VS</Text>
                        <View style={styles.team}>
                            {partido.equipo_visitante?.logo_url ? (
                                <Image source={{ uri: partido.equipo_visitante.logo_url }} style={styles.teamLogo} />
                            ) : (
                                <View style={[styles.teamBadge, { backgroundColor: partido.equipo_visitante?.color_principal || COLORS.secondary }]}>
                                    <Ionicons name="shield" size={20} color="#fff" />
                                </View>
                            )}
                            <Text style={styles.teamName}>{partido.equipo_visitante?.nombre_corto || 'Visitante'}</Text>
                        </View>
                    </View>
                </Card>

                {/* Fecha */}
                <Text style={styles.label}>Fecha del Partido</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.pickerText}>{formatDate(fecha)}</Text>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>

                {showDatePicker && (
                    <DateTimePicker
                        value={fecha}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleDateChange}
                        minimumDate={new Date()}
                    />
                )}

                {/* Hora */}
                <Text style={styles.label}>Hora del Partido</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTimePicker(true)}>
                    <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.pickerText}>{formatTime(hora)}</Text>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>

                {showTimePicker && (
                    <DateTimePicker
                        value={hora}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleTimeChange}
                        is24Hour={false}
                    />
                )}

                {/* Cancha */}
                <Input
                    label="Cancha / Ubicación (opcional)"
                    value={cancha}
                    onChangeText={setCancha}
                    placeholder="Ej: Cancha 1, Polideportivo Central"
                    icon={<Ionicons name="location-outline" size={20} color={COLORS.textSecondary} />}
                />

                {/* Botón Guardar */}
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
    matchCard: { marginBottom: 24 },
    teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    team: { alignItems: 'center' },
    teamBadge: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    teamLogo: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.background },
    teamName: { marginTop: 8, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
    vsText: { fontSize: 18, fontWeight: '700', color: COLORS.textSecondary },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8, marginTop: 16 },
    pickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
    pickerText: { flex: 1, marginLeft: 12, fontSize: 16, color: COLORS.textPrimary },
    saveButton: { marginTop: 32, marginBottom: 24 },
    errorText: { fontSize: 16, color: COLORS.error, textAlign: 'center', padding: 24 },
});

export default EditarPartidoScreen;
