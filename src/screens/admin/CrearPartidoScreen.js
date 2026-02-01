import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Input, Loading, Card } from '../../components/common';
import partidoService from '../../services/partidoService';
import equipoService from '../../services/equipoService';
import { getErrorMessage } from '../../utils/errorHandler';
import { COLORS } from '../../utils/constants';

const FASES_DISPONIBLES = [
    { value: 'grupos', label: 'Fase de Grupos' },
    { value: 'octavos', label: 'Octavos de Final' },
    { value: 'cuartos', label: 'Cuartos de Final' },
    { value: 'semifinal', label: 'Semifinal' },
    { value: 'tercer_puesto', label: 'Tercer Puesto' },
    { value: 'final', label: 'Final' },
    { value: 'otro', label: 'Otro...' },
];

const HORARIOS_DISPONIBLES = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
    '14:00', '15:00', '16:00', '17:00', '18:00',
    '19:00', '20:00', '21:00', '22:00', '23:00',
];

const CrearPartidoScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { torneoId } = route.params;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [equipos, setEquipos] = useState([]);

    // Estados del formulario
    const [equipoLocal, setEquipoLocal] = useState(null);
    const [equipoVisitante, setEquipoVisitante] = useState(null);
    const [fecha, setFecha] = useState(new Date());
    const [horaSeleccionada, setHoraSeleccionada] = useState('10:00');
    const [fase, setFase] = useState('grupos');
    const [fasePersonalizada, setFasePersonalizada] = useState('');
    const [jornada, setJornada] = useState('1');
    const [cancha, setCancha] = useState('');

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showEquipoLocalPicker, setShowEquipoLocalPicker] = useState(false);
    const [showEquipoVisitantePicker, setShowEquipoVisitantePicker] = useState(false);

    useEffect(() => {
        loadEquipos();
    }, [torneoId]);

    const loadEquipos = async () => {
        try {
            const data = await equipoService.getEquiposByTorneo(torneoId);
            setEquipos(data || []);
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

    const formatDate = (date) => {
        return date.toLocaleDateString('es-ES', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const validate = () => {
        if (!equipoLocal) {
            Alert.alert('Error', 'Selecciona el equipo local');
            return false;
        }
        if (!equipoVisitante) {
            Alert.alert('Error', 'Selecciona el equipo visitante');
            return false;
        }
        if (equipoLocal.id === equipoVisitante.id) {
            Alert.alert('Error', 'Los equipos deben ser diferentes');
            return false;
        }
        if (fase === 'otro' && !fasePersonalizada.trim()) {
            Alert.alert('Error', 'Ingresa el nombre de la fase personalizada');
            return false;
        }
        return true;
    };

    const handleSave = async () => {
        if (!validate()) return;

        setSaving(true);
        try {
            // Formatear fecha en formato local para evitar problemas de zona horaria
            const year = fecha.getFullYear();
            const month = String(fecha.getMonth() + 1).padStart(2, '0');
            const day = String(fecha.getDate()).padStart(2, '0');
            const fechaStr = `${year}-${month}-${day}`;

            await partidoService.crearPartido({
                torneo_id: torneoId,
                equipo_local_id: equipoLocal.id,
                equipo_visitante_id: equipoVisitante.id,
                fecha: fechaStr,
                hora: horaSeleccionada,
                // Use custom phase name if 'otro' is selected
                fase: fase === 'otro' ? fasePersonalizada.trim() : fase,
                // Solo asignar jornada para fase de grupos, null para eliminatorias
                jornada: fase === 'grupos' ? (parseInt(jornada) || 1) : null,
                cancha: cancha || null,
                estado: 'programado',
                goles_local: 0,
                goles_visitante: 0,
            });

            Alert.alert('Éxito', 'Partido creado correctamente', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Alert.alert('Error', getErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <Loading message="Cargando equipos..." />;
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Crear Partido</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Equipo Local */}
                <Text style={styles.label}>Equipo Local</Text>
                <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowEquipoLocalPicker(!showEquipoLocalPicker)}
                >
                    {equipoLocal ? (
                        <View style={styles.equipoSelected}>
                            <View style={[styles.equipoColor, { backgroundColor: equipoLocal.color_principal }]} />
                            <Text style={styles.equipoText}>{equipoLocal.nombre}</Text>
                        </View>
                    ) : (
                        <Text style={styles.pickerPlaceholder}>Seleccionar equipo local...</Text>
                    )}
                    <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>

                {showEquipoLocalPicker && (
                    <View style={styles.equiposList}>
                        {equipos.filter(e => e.id !== equipoVisitante?.id).map(equipo => (
                            <TouchableOpacity
                                key={equipo.id}
                                style={styles.equipoOption}
                                onPress={() => {
                                    setEquipoLocal(equipo);
                                    setShowEquipoLocalPicker(false);
                                }}
                            >
                                <View style={[styles.equipoColor, { backgroundColor: equipo.color_principal }]} />
                                <Text style={styles.equipoText}>{equipo.nombre}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Equipo Visitante */}
                <Text style={styles.label}>Equipo Visitante</Text>
                <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowEquipoVisitantePicker(!showEquipoVisitantePicker)}
                >
                    {equipoVisitante ? (
                        <View style={styles.equipoSelected}>
                            <View style={[styles.equipoColor, { backgroundColor: equipoVisitante.color_principal }]} />
                            <Text style={styles.equipoText}>{equipoVisitante.nombre}</Text>
                        </View>
                    ) : (
                        <Text style={styles.pickerPlaceholder}>Seleccionar equipo visitante...</Text>
                    )}
                    <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>

                {showEquipoVisitantePicker && (
                    <View style={styles.equiposList}>
                        {equipos.filter(e => e.id !== equipoLocal?.id).map(equipo => (
                            <TouchableOpacity
                                key={equipo.id}
                                style={styles.equipoOption}
                                onPress={() => {
                                    setEquipoVisitante(equipo);
                                    setShowEquipoVisitantePicker(false);
                                }}
                            >
                                <View style={[styles.equipoColor, { backgroundColor: equipo.color_principal }]} />
                                <Text style={styles.equipoText}>{equipo.nombre}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Fase del torneo */}
                <Text style={styles.label}>Fase del Torneo</Text>
                <View style={styles.fasesGrid}>
                    {FASES_DISPONIBLES.map(f => (
                        <TouchableOpacity
                            key={f.value}
                            style={[
                                styles.faseOption,
                                fase === f.value && styles.faseOptionSelected
                            ]}
                            onPress={() => setFase(f.value)}
                        >
                            <Text style={[
                                styles.faseText,
                                fase === f.value && styles.faseTextSelected
                            ]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Fecha */}
                <Text style={styles.label}>Fecha</Text>
                <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Ionicons name="calendar" size={20} color={COLORS.primary} />
                    <Text style={styles.pickerText}>{formatDate(fecha)}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                    <DateTimePicker
                        value={fecha}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleDateChange}
                    />
                )}

                {/* Hora */}
                <Text style={styles.label}>Hora</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horasScroll}>
                    <View style={styles.horasRow}>
                        {HORARIOS_DISPONIBLES.map(h => (
                            <TouchableOpacity
                                key={h}
                                style={[
                                    styles.horaOption,
                                    horaSeleccionada === h && styles.horaOptionSelected
                                ]}
                                onPress={() => setHoraSeleccionada(h)}
                            >
                                <Text style={[
                                    styles.horaText,
                                    horaSeleccionada === h && styles.horaTextSelected
                                ]}>
                                    {h}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                {/* Jornada (solo para fase de grupos) */}
                {fase === 'grupos' && (
                    <Input
                        label="Jornada"
                        value={jornada}
                        onChangeText={setJornada}
                        keyboardType="numeric"
                        placeholder="1"
                    />
                )}

                {/* Fase personalizada (solo para 'otro') */}
                {fase === 'otro' && (
                    <Input
                        label="Nombre de la Fase"
                        value={fasePersonalizada}
                        onChangeText={setFasePersonalizada}
                        placeholder="Ej: Repechaje, Liguilla..."
                    />
                )}

                {/* Cancha */}
                <Input
                    label="Cancha (opcional)"
                    value={cancha}
                    onChangeText={setCancha}
                    placeholder="Ej: Cancha 1"
                />

                <Button
                    title="Crear Partido"
                    onPress={handleSave}
                    loading={saving}
                    style={styles.saveButton}
                />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background
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
        color: COLORS.textPrimary
    },
    content: {
        flex: 1,
        padding: 16
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 8,
        marginTop: 16,
    },
    picker: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    pickerText: {
        flex: 1,
        fontSize: 16,
        color: COLORS.textPrimary,
        marginLeft: 12,
    },
    pickerPlaceholder: {
        flex: 1,
        fontSize: 16,
        color: COLORS.textSecondary,
    },
    equipoSelected: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    equipoColor: {
        width: 24,
        height: 24,
        borderRadius: 12,
        marginRight: 12,
    },
    equipoText: {
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    equiposList: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    equipoOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    fasesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginVertical: 8,
    },
    faseOption: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        margin: 4,
    },
    faseOptionSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    faseText: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    faseTextSelected: {
        color: COLORS.textOnPrimary,
        fontWeight: '600',
    },
    horasScroll: {
        marginBottom: 8,
    },
    horasRow: {
        flexDirection: 'row',
    },
    horaOption: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginRight: 8,
    },
    horaOptionSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    horaText: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    horaTextSelected: {
        color: COLORS.textOnPrimary,
        fontWeight: '600',
    },
    saveButton: {
        marginTop: 32,
        marginBottom: 40
    },
});

export default CrearPartidoScreen;
