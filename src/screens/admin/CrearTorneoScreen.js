import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Alert,
    FlatList,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input, Card } from '../../components/common';
import torneoService from '../../services/torneoService';
import equipoService from '../../services/equipoService';
import partidoService from '../../services/partidoService';
import { COLORS, TOURNAMENT_STATUS } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';

const DIAS_SEMANA = [
    { value: 'lunes', label: 'Lunes', short: 'Lun' },
    { value: 'martes', label: 'Martes', short: 'Mar' },
    { value: 'miercoles', label: 'Miércoles', short: 'Mié' },
    { value: 'jueves', label: 'Jueves', short: 'Jue' },
    { value: 'viernes', label: 'Viernes', short: 'Vie' },
    { value: 'sabado', label: 'Sábado', short: 'Sáb' },
    { value: 'domingo', label: 'Domingo', short: 'Dom' },
];

const HORARIOS_DISPONIBLES = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '14:00', '15:00', '16:00', '17:00', '18:00',
    '19:00', '20:00', '21:00',
];

const COLORES_EQUIPO = [
    '#1E88E5', '#E53935', '#43A047', '#FB8C00',
    '#8E24AA', '#00ACC1', '#FFB300', '#5E35B1',
    '#D81B60', '#00897B', '#3949AB', '#6D4C41',
];

const LETRAS_GRUPO = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const CrearTorneoScreen = ({ navigation }) => {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [torneoCreado, setTorneoCreado] = useState(null);

    // Paso 1: Info básica
    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        lugar: '',
    });

    // Paso 2: Configuración
    const [config, setConfig] = useState({
        cantidad_equipos: '8',
        cantidad_grupos: '2',
        max_jugadores_equipo: '12',
        min_jugadores_equipo: '5',
        duracion_tiempo_minutos: '20',
        cantidad_tiempos: '2',
    });

    // Paso 3: Puntos
    const [puntos, setPuntos] = useState({
        puntos_victoria: '3',
        puntos_empate: '1',
        puntos_derrota: '0',
    });

    // Paso 4: Equipos
    const [equipos, setEquipos] = useState([]);
    const [equipoModal, setEquipoModal] = useState(false);
    const [nuevoEquipo, setNuevoEquipo] = useState({ nombre: '', color: COLORES_EQUIPO[0] });

    // Paso 5: Asignar grupos
    const [gruposAsignados, setGruposAsignados] = useState({});

    // Paso 6: Programación
    const [diasJuego, setDiasJuego] = useState(['sabado', 'domingo']);
    const [horariosJuego, setHorariosJuego] = useState(['09:00', '10:30']);

    // Paso 7: Calendario generado
    const [partidosGenerados, setPartidosGenerados] = useState([]);

    const [errors, setErrors] = useState({});

    const updateField = (setter, field, value) => {
        setter(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    const numGrupos = parseInt(config.cantidad_grupos) || 1;

    // Validaciones por paso
    const validateStep = () => {
        const newErrors = {};

        if (step === 1) {
            if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es requerido';
        }

        if (step === 2) {
            const cantidad = parseInt(config.cantidad_equipos);
            const grupos = parseInt(config.cantidad_grupos);
            if (isNaN(cantidad) || cantidad < 4) newErrors.cantidad_equipos = 'Mínimo 4 equipos';
            if (cantidad > 32) newErrors.cantidad_equipos = 'Máximo 32 equipos';
            if (isNaN(grupos) || grupos < 1) newErrors.cantidad_grupos = 'Mínimo 1 grupo';
            if (grupos > 8) newErrors.cantidad_grupos = 'Máximo 8 grupos';
        }

        if (step === 4) {
            if (equipos.length < 2) newErrors.equipos = 'Agrega al menos 2 equipos';
        }

        if (step === 5) {
            // Verificar que todos los equipos tengan grupo asignado
            const sinGrupo = equipos.filter(e => !gruposAsignados[e.id]);
            if (sinGrupo.length > 0) {
                newErrors.grupos = `Faltan ${sinGrupo.length} equipos por asignar a un grupo`;
            }
        }

        if (step === 6) {
            if (diasJuego.length === 0) newErrors.dias = 'Selecciona al menos un día';
            if (horariosJuego.length === 0) newErrors.horarios = 'Selecciona al menos un horario';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = async () => {
        if (!validateStep()) return;

        if (step === 3 && !torneoCreado) {
            await crearTorneo();
        } else if (step === 5) {
            // Actualizar grupos de equipos en BD
            await guardarGrupos();
        } else if (step === 6) {
            generarCalendario();
        } else if (step < 7) {
            setStep(step + 1);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        } else {
            navigation.goBack();
        }
    };

    const crearTorneo = async () => {
        try {
            setLoading(true);

            const torneoData = {
                nombre: formData.nombre.trim(),
                descripcion: formData.descripcion.trim() || null,
                lugar: formData.lugar.trim() || null,
                cantidad_equipos: parseInt(config.cantidad_equipos),
                max_jugadores_equipo: parseInt(config.max_jugadores_equipo),
                min_jugadores_equipo: parseInt(config.min_jugadores_equipo),
                duracion_tiempo_minutos: parseInt(config.duracion_tiempo_minutos),
                cantidad_tiempos: parseInt(config.cantidad_tiempos),
                puntos_victoria: parseInt(puntos.puntos_victoria),
                puntos_empate: parseInt(puntos.puntos_empate),
                puntos_derrota: parseInt(puntos.puntos_derrota),
                estado: TOURNAMENT_STATUS.CONFIGURACION,
            };

            const torneo = await torneoService.crearTorneo(userProfile.id, torneoData);
            setTorneoCreado(torneo);
            setStep(4);
        } catch (error) {
            Alert.alert('Error', error.message || 'No se pudo crear el torneo');
        } finally {
            setLoading(false);
        }
    };

    const agregarEquipo = async () => {
        if (!nuevoEquipo.nombre.trim()) {
            Alert.alert('Error', 'El nombre del equipo es requerido');
            return;
        }

        try {
            setLoading(true);
            const equipo = await equipoService.crearEquipo(torneoCreado.id, {
                nombre: nuevoEquipo.nombre.trim(),
                nombre_corto: nuevoEquipo.nombre.substring(0, 3).toUpperCase(),
                color_principal: nuevoEquipo.color,
            });

            setEquipos([...equipos, equipo]);
            setNuevoEquipo({ nombre: '', color: COLORES_EQUIPO[equipos.length % COLORES_EQUIPO.length] });
            setEquipoModal(false);
        } catch (error) {
            Alert.alert('Error', error.message || 'No se pudo crear el equipo');
        } finally {
            setLoading(false);
        }
    };

    const eliminarEquipo = async (equipoId) => {
        try {
            await equipoService.eliminarEquipo(equipoId);
            setEquipos(equipos.filter(e => e.id !== equipoId));
            // Remover de grupos asignados
            const newGrupos = { ...gruposAsignados };
            delete newGrupos[equipoId];
            setGruposAsignados(newGrupos);
        } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar el equipo');
        }
    };

    const asignarGrupo = (equipoId, grupo) => {
        setGruposAsignados(prev => ({
            ...prev,
            [equipoId]: grupo,
        }));
    };

    const guardarGrupos = async () => {
        try {
            setLoading(true);
            // Actualizar cada equipo con su grupo
            for (const equipo of equipos) {
                const grupo = gruposAsignados[equipo.id];
                if (grupo) {
                    await equipoService.actualizarEquipo(equipo.id, { grupo });
                }
            }
            setStep(6);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron guardar los grupos');
        } finally {
            setLoading(false);
        }
    };

    const toggleDia = (dia) => {
        if (diasJuego.includes(dia)) {
            setDiasJuego(diasJuego.filter(d => d !== dia));
        } else {
            setDiasJuego([...diasJuego, dia]);
        }
    };

    const toggleHorario = (horario) => {
        if (horariosJuego.includes(horario)) {
            setHorariosJuego(horariosJuego.filter(h => h !== horario));
        } else {
            setHorariosJuego([...horariosJuego, horario].sort());
        }
    };

    const generarCalendario = () => {
        const allMatches = [];
        const dayMap = {
            'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3,
            'jueves': 4, 'viernes': 5, 'sabado': 6
        };
        const gameDays = diasJuego.map(d => dayMap[d]).sort((a, b) => a - b);

        let currentDate = new Date();
        // Encontrar próximo día de juego
        while (!gameDays.includes(currentDate.getDay())) {
            currentDate.setDate(currentDate.getDate() + 1);
        }

        let globalJornada = 1;
        let horarioIndex = 0;

        // Generar partidos por cada grupo
        for (let g = 0; g < numGrupos; g++) {
            const grupoLetra = LETRAS_GRUPO[g];
            const equiposGrupo = equipos.filter(e => gruposAsignados[e.id] === grupoLetra);

            if (equiposGrupo.length < 2) continue;

            const matches = generateRoundRobin(equiposGrupo, torneoCreado.id, grupoLetra);

            // Asignar fechas y horas
            matches.forEach((match, idx) => {
                if (horarioIndex >= horariosJuego.length) {
                    horarioIndex = 0;
                    // Avanzar al siguiente día de juego
                    do {
                        currentDate.setDate(currentDate.getDate() + 1);
                    } while (!gameDays.includes(currentDate.getDay()));
                }

                match.fecha = currentDate.toISOString().split('T')[0];
                match.hora = horariosJuego[horarioIndex];
                match.jornada = globalJornada;

                horarioIndex++;
            });

            allMatches.push(...matches);
            globalJornada++;
        }

        setPartidosGenerados(allMatches);
        setStep(7);
    };

    const generateRoundRobin = (teams, torneoId, grupo) => {
        const matches = [];
        const n = teams.length;
        const isOdd = n % 2 !== 0;
        const teamList = [...teams];

        if (isOdd) {
            teamList.push({ id: null, nombre: 'Descansa' });
        }

        const totalTeams = teamList.length;
        const totalRounds = totalTeams - 1;
        const matchesPerRound = totalTeams / 2;

        for (let round = 0; round < totalRounds; round++) {
            for (let match = 0; match < matchesPerRound; match++) {
                const home = (round + match) % (totalTeams - 1);
                let away = (totalTeams - 1 - match + round) % (totalTeams - 1);

                if (match === 0) {
                    away = totalTeams - 1;
                }

                const homeTeam = teamList[home];
                const awayTeam = teamList[away];

                if (!homeTeam.id || !awayTeam.id) continue;

                matches.push({
                    torneo_id: torneoId,
                    equipo_local_id: homeTeam.id,
                    equipo_visitante_id: awayTeam.id,
                    equipo_local: homeTeam,
                    equipo_visitante: awayTeam,
                    grupo: grupo,
                    estado: 'programado',
                });
            }
        }

        return matches;
    };

    const guardarCalendario = async () => {
        try {
            setLoading(true);

            const partidosData = partidosGenerados.map(p => ({
                torneo_id: p.torneo_id,
                equipo_local_id: p.equipo_local_id,
                equipo_visitante_id: p.equipo_visitante_id,
                fecha: p.fecha,
                hora: p.hora,
                jornada: p.jornada,
                grupo: p.grupo,
                estado: 'programado',
            }));

            await partidoService.crearPartidosMultiples(partidosData);
            await torneoService.cambiarEstado(torneoCreado.id, TOURNAMENT_STATUS.INSCRIPCION);

            Alert.alert(
                '¡Torneo Creado!',
                `Se crearon ${partidosGenerados.length} partidos en ${numGrupos} grupo(s).`,
                [
                    {
                        text: 'Ver Torneo',
                        onPress: () => navigation.replace('GestionarTorneo', { torneoId: torneoCreado.id }),
                    },
                ]
            );
        } catch (error) {
            console.error('Error saving calendar:', error);
            Alert.alert('Error', error.message || 'No se pudo guardar el calendario');
        } finally {
            setLoading(false);
        }
    };

    // ===== RENDER STEPS =====

    const renderStep1 = () => (
        <View>
            <Text style={styles.stepTitle}>📝 Información Básica</Text>
            <Text style={styles.stepDesc}>Ingresa el nombre y descripción de tu torneo</Text>

            <Input
                label="Nombre del Torneo *"
                value={formData.nombre}
                onChangeText={(v) => updateField(setFormData, 'nombre', v)}
                placeholder="Ej: Copa del Barrio 2026"
                error={errors.nombre}
            />
            <Input
                label="Descripción"
                value={formData.descripcion}
                onChangeText={(v) => updateField(setFormData, 'descripcion', v)}
                placeholder="Describe tu torneo..."
                multiline
                numberOfLines={3}
            />
            <Input
                label="Lugar / Cancha"
                value={formData.lugar}
                onChangeText={(v) => updateField(setFormData, 'lugar', v)}
                placeholder="Ej: Cancha San Miguel"
                icon={<Ionicons name="location-outline" size={20} color={COLORS.textSecondary} />}
            />
        </View>
    );

    const renderStep2 = () => (
        <View>
            <Text style={styles.stepTitle}>⚙️ Configuración</Text>
            <Text style={styles.stepDesc}>Define la estructura del torneo</Text>

            <View style={styles.row}>
                <View style={styles.half}>
                    <Input
                        label="Cantidad de Equipos"
                        value={config.cantidad_equipos}
                        onChangeText={(v) => updateField(setConfig, 'cantidad_equipos', v)}
                        keyboardType="numeric"
                        error={errors.cantidad_equipos}
                    />
                </View>
                <View style={styles.half}>
                    <Input
                        label="Cantidad de Grupos"
                        value={config.cantidad_grupos}
                        onChangeText={(v) => updateField(setConfig, 'cantidad_grupos', v)}
                        keyboardType="numeric"
                        error={errors.cantidad_grupos}
                    />
                </View>
            </View>

            <Card style={styles.infoCard}>
                <Text style={styles.infoText}>
                    📊 {config.cantidad_equipos} equipos en {config.cantidad_grupos} grupo(s)
                    = ~{Math.ceil(parseInt(config.cantidad_equipos) / parseInt(config.cantidad_grupos))} equipos por grupo
                </Text>
            </Card>

            <View style={styles.row}>
                <View style={styles.half}>
                    <Input
                        label="Duración (min)"
                        value={config.duracion_tiempo_minutos}
                        onChangeText={(v) => updateField(setConfig, 'duracion_tiempo_minutos', v)}
                        keyboardType="numeric"
                    />
                </View>
                <View style={styles.half}>
                    <Input
                        label="Tiempos"
                        value={config.cantidad_tiempos}
                        onChangeText={(v) => updateField(setConfig, 'cantidad_tiempos', v)}
                        keyboardType="numeric"
                    />
                </View>
            </View>
        </View>
    );

    const renderStep3 = () => (
        <View>
            <Text style={styles.stepTitle}>🏆 Sistema de Puntos</Text>
            <Text style={styles.stepDesc}>Configura los puntos por resultado</Text>

            <Card style={styles.pointsCard}>
                <View style={styles.pointsRow}>
                    <View style={styles.pointItem}>
                        <Ionicons name="trophy" size={32} color={COLORS.success} />
                        <Text style={styles.pointLabel}>Victoria</Text>
                        <Input
                            value={puntos.puntos_victoria}
                            onChangeText={(v) => updateField(setPuntos, 'puntos_victoria', v)}
                            keyboardType="numeric"
                            style={styles.pointInput}
                        />
                    </View>
                    <View style={styles.pointItem}>
                        <Ionicons name="remove-circle" size={32} color={COLORS.warning} />
                        <Text style={styles.pointLabel}>Empate</Text>
                        <Input
                            value={puntos.puntos_empate}
                            onChangeText={(v) => updateField(setPuntos, 'puntos_empate', v)}
                            keyboardType="numeric"
                            style={styles.pointInput}
                        />
                    </View>
                    <View style={styles.pointItem}>
                        <Ionicons name="close-circle" size={32} color={COLORS.error} />
                        <Text style={styles.pointLabel}>Derrota</Text>
                        <Input
                            value={puntos.puntos_derrota}
                            onChangeText={(v) => updateField(setPuntos, 'puntos_derrota', v)}
                            keyboardType="numeric"
                            style={styles.pointInput}
                        />
                    </View>
                </View>
            </Card>
        </View>
    );

    const renderStep4 = () => (
        <View>
            <Text style={styles.stepTitle}>👥 Agregar Equipos</Text>
            <Text style={styles.stepDesc}>
                Agrega los equipos ({equipos.length}/{config.cantidad_equipos})
            </Text>

            {errors.equipos && <Text style={styles.errorText}>{errors.equipos}</Text>}

            <View style={styles.equiposList}>
                {equipos.map((equipo, index) => (
                    <View key={equipo.id} style={styles.equipoItem}>
                        <View style={[styles.equipoColor, { backgroundColor: equipo.color_principal }]}>
                            <Text style={styles.equipoNum}>{index + 1}</Text>
                        </View>
                        <Text style={styles.equipoNombre}>{equipo.nombre}</Text>
                        <TouchableOpacity onPress={() => eliminarEquipo(equipo.id)}>
                            <Ionicons name="close-circle" size={24} color={COLORS.error} />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>

            {equipos.length < parseInt(config.cantidad_equipos) && (
                <Button
                    title="Agregar Equipo"
                    onPress={() => setEquipoModal(true)}
                    variant="outline"
                    icon={<Ionicons name="add" size={20} color={COLORS.primary} />}
                />
            )}

            <Modal visible={equipoModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Nuevo Equipo</Text>
                        <Input
                            label="Nombre del Equipo"
                            value={nuevoEquipo.nombre}
                            onChangeText={(v) => setNuevoEquipo({ ...nuevoEquipo, nombre: v })}
                            placeholder="Ej: Los Tigres"
                        />
                        <Text style={styles.colorLabel}>Color</Text>
                        <View style={styles.colorGrid}>
                            {COLORES_EQUIPO.map((color) => (
                                <TouchableOpacity
                                    key={color}
                                    style={[
                                        styles.colorOption,
                                        { backgroundColor: color },
                                        nuevoEquipo.color === color && styles.colorSelected,
                                    ]}
                                    onPress={() => setNuevoEquipo({ ...nuevoEquipo, color })}
                                >
                                    {nuevoEquipo.color === color && (
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.modalActions}>
                            <Button title="Cancelar" onPress={() => setEquipoModal(false)} variant="outline" style={{ flex: 1, marginRight: 8 }} />
                            <Button title="Agregar" onPress={agregarEquipo} loading={loading} style={{ flex: 1 }} />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );

    const renderStep5 = () => (
        <View>
            <Text style={styles.stepTitle}>📊 Asignar Grupos</Text>
            <Text style={styles.stepDesc}>
                Asigna cada equipo a un grupo ({Object.keys(gruposAsignados).length}/{equipos.length} asignados)
            </Text>

            {errors.grupos && <Text style={styles.errorText}>{errors.grupos}</Text>}

            {equipos.map((equipo) => (
                <View key={equipo.id} style={styles.grupoAsignacion}>
                    <View style={[styles.equipoMini, { backgroundColor: equipo.color_principal }]}>
                        <Ionicons name="shield" size={16} color="#fff" />
                    </View>
                    <Text style={styles.equipoNombreGrupo}>{equipo.nombre}</Text>
                    <View style={styles.grupoButtons}>
                        {LETRAS_GRUPO.slice(0, numGrupos).map((letra) => (
                            <TouchableOpacity
                                key={letra}
                                style={[
                                    styles.grupoBtn,
                                    gruposAsignados[equipo.id] === letra && styles.grupoBtnActive,
                                ]}
                                onPress={() => asignarGrupo(equipo.id, letra)}
                            >
                                <Text style={[
                                    styles.grupoBtnText,
                                    gruposAsignados[equipo.id] === letra && styles.grupoBtnTextActive,
                                ]}>
                                    {letra}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ))}

            <Card style={styles.resumenGrupos}>
                <Text style={styles.resumenTitle}>Resumen de Grupos</Text>
                {LETRAS_GRUPO.slice(0, numGrupos).map((letra) => {
                    const count = equipos.filter(e => gruposAsignados[e.id] === letra).length;
                    return (
                        <Text key={letra} style={styles.resumenText}>
                            Grupo {letra}: {count} equipo(s)
                        </Text>
                    );
                })}
            </Card>
        </View>
    );

    const renderStep6 = () => (
        <View>
            <Text style={styles.stepTitle}>📅 Programación</Text>
            <Text style={styles.stepDesc}>Selecciona días y horarios de los partidos</Text>

            {errors.dias && <Text style={styles.errorText}>{errors.dias}</Text>}

            <Text style={styles.sectionLabel}>Días de Juego</Text>
            <View style={styles.diasGrid}>
                {DIAS_SEMANA.map((dia) => (
                    <TouchableOpacity
                        key={dia.value}
                        style={[
                            styles.diaBtn,
                            diasJuego.includes(dia.value) && styles.diaBtnActive,
                        ]}
                        onPress={() => toggleDia(dia.value)}
                    >
                        <Text style={[
                            styles.diaText,
                            diasJuego.includes(dia.value) && styles.diaTextActive,
                        ]}>
                            {dia.short}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {errors.horarios && <Text style={styles.errorText}>{errors.horarios}</Text>}

            <Text style={styles.sectionLabel}>Horarios de Partidos</Text>
            <View style={styles.horariosGrid}>
                {HORARIOS_DISPONIBLES.map((hora) => (
                    <TouchableOpacity
                        key={hora}
                        style={[
                            styles.horarioBtn,
                            horariosJuego.includes(hora) && styles.horarioBtnActive,
                        ]}
                        onPress={() => toggleHorario(hora)}
                    >
                        <Text style={[
                            styles.horarioText,
                            horariosJuego.includes(hora) && styles.horarioTextActive,
                        ]}>
                            {hora}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderStep7 = () => (
        <View>
            <Text style={styles.stepTitle}>✅ Calendario Generado</Text>
            <Text style={styles.stepDesc}>
                {partidosGenerados.length} partidos en {numGrupos} grupo(s)
            </Text>

            {LETRAS_GRUPO.slice(0, numGrupos).map((letra) => {
                const partidosGrupo = partidosGenerados.filter(p => p.grupo === letra);
                if (partidosGrupo.length === 0) return null;
                return (
                    <View key={letra} style={styles.grupoSection}>
                        <Text style={styles.grupoHeader}>Grupo {letra}</Text>
                        {partidosGrupo.map((p, idx) => (
                            <Card key={idx} style={styles.partidoCard}>
                                <View style={styles.partidoHeader}>
                                    <Text style={styles.partidoFecha}>
                                        {formatDate(p.fecha)} - {p.hora}
                                    </Text>
                                </View>
                                <View style={styles.partidoTeams}>
                                    <Text style={styles.teamName}>{p.equipo_local.nombre}</Text>
                                    <Text style={styles.vs}>VS</Text>
                                    <Text style={styles.teamName}>{p.equipo_visitante.nombre}</Text>
                                </View>
                            </Card>
                        ))}
                    </View>
                );
            })}
        </View>
    );

    const renderProgress = () => (
        <View style={styles.progressContainer}>
            {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                <View key={s} style={styles.progressItem}>
                    <View style={[styles.progressDot, step >= s && styles.progressDotActive]}>
                        {step > s ? (
                            <Ionicons name="checkmark" size={10} color="#fff" />
                        ) : (
                            <Text style={[styles.progressNum, step >= s && styles.progressNumActive]}>{s}</Text>
                        )}
                    </View>
                </View>
            ))}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Crear Torneo</Text>
                    <View style={{ width: 24 }} />
                </View>

                {renderProgress()}

                <View style={styles.stepContent}>
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                    {step === 4 && renderStep4()}
                    {step === 5 && renderStep5()}
                    {step === 6 && renderStep6()}
                    {step === 7 && renderStep7()}
                </View>

                <View style={styles.actions}>
                    {step < 7 ? (
                        <Button
                            title={
                                step === 3 ? 'Crear y Continuar' :
                                    step === 5 ? 'Guardar Grupos' :
                                        step === 6 ? 'Generar Calendario' : 'Siguiente'
                            }
                            onPress={handleNext}
                            loading={loading}
                        />
                    ) : (
                        <Button
                            title="Guardar y Finalizar"
                            onPress={guardarCalendario}
                            loading={loading}
                            icon={<Ionicons name="checkmark-circle" size={20} color="#fff" />}
                        />
                    )}

                    {step === 4 && equipos.length >= 2 && (
                        <Button
                            title="Continuar a Grupos"
                            onPress={() => setStep(5)}
                            variant="outline"
                            style={{ marginTop: 12 }}
                        />
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { padding: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
    progressContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 24 },
    progressItem: { alignItems: 'center', marginHorizontal: 4 },
    progressDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.surfaceVariant, justifyContent: 'center', alignItems: 'center' },
    progressDotActive: { backgroundColor: COLORS.primary },
    progressNum: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
    progressNumActive: { color: '#fff' },
    stepContent: { marginBottom: 24 },
    stepTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
    stepDesc: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
    row: { flexDirection: 'row', marginHorizontal: -8 },
    half: { flex: 1, paddingHorizontal: 8 },
    infoCard: { marginBottom: 16, backgroundColor: `${COLORS.primary}10` },
    infoText: { fontSize: 14, color: COLORS.primary, textAlign: 'center' },
    pointsCard: { marginBottom: 16 },
    pointsRow: { flexDirection: 'row', justifyContent: 'space-around' },
    pointItem: { alignItems: 'center', flex: 1 },
    pointLabel: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, marginBottom: 8 },
    pointInput: { width: 60, marginBottom: 0 },
    equiposList: { marginBottom: 16 },
    equipoItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: 12, borderRadius: 12, marginBottom: 8 },
    equipoColor: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    equipoNum: { fontSize: 14, fontWeight: '700', color: '#fff' },
    equipoNombre: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
    colorLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
    colorGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
    colorOption: { width: 40, height: 40, borderRadius: 20, margin: 6, justifyContent: 'center', alignItems: 'center' },
    colorSelected: { borderWidth: 3, borderColor: COLORS.textPrimary },
    modalActions: { flexDirection: 'row', marginTop: 8 },
    grupoAsignacion: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: 10, borderRadius: 10, marginBottom: 8 },
    equipoMini: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    equipoNombreGrupo: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
    grupoButtons: { flexDirection: 'row' },
    grupoBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceVariant, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
    grupoBtnActive: { backgroundColor: COLORS.primary },
    grupoBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
    grupoBtnTextActive: { color: '#fff' },
    resumenGrupos: { marginTop: 16 },
    resumenTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 8 },
    resumenText: { fontSize: 14, color: COLORS.textPrimary, marginBottom: 4 },
    sectionLabel: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginTop: 16, marginBottom: 12 },
    diasGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
    diaBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.surfaceVariant, margin: 4 },
    diaBtnActive: { backgroundColor: COLORS.primary },
    diaText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
    diaTextActive: { color: '#fff' },
    horariosGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    horarioBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: COLORS.surfaceVariant, margin: 4 },
    horarioBtnActive: { backgroundColor: COLORS.secondary },
    horarioText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
    horarioTextActive: { color: '#fff' },
    grupoSection: { marginBottom: 20 },
    grupoHeader: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginBottom: 10 },
    partidoCard: { marginBottom: 8 },
    partidoHeader: { marginBottom: 6 },
    partidoFecha: { fontSize: 12, color: COLORS.textSecondary },
    partidoTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    teamName: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
    vs: { fontSize: 12, color: COLORS.textSecondary, marginHorizontal: 8 },
    errorText: { color: COLORS.error, fontSize: 13, marginBottom: 12 },
    actions: { marginTop: 8 },
});

export default CrearTorneoScreen;
