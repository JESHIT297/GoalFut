import React from 'react';
import { Platform, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { Loading } from '../components/common';
import { COLORS } from '../utils/constants';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Public Screens
import HomeScreen from '../screens/public/HomeScreen';
import TorneoDetailScreen from '../screens/public/TorneoDetailScreen';
import PartidoDetailScreen from '../screens/public/PartidoDetailScreen';
import EstadisticasScreen from '../screens/public/EstadisticasScreen';
import MisTorneosScreen from '../screens/public/MisTorneosScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import CrearTorneoScreen from '../screens/admin/CrearTorneoScreen';
import EditarTorneoScreen from '../screens/admin/EditarTorneoScreen';
import EditarPartidoScreen from '../screens/admin/EditarPartidoScreen';
import PartidoEnVivoScreen from '../screens/admin/PartidoEnVivoScreen';
import GestionarEquiposScreen from '../screens/admin/GestionarEquiposScreen';
import GestionarJugadoresScreen from '../screens/admin/GestionarJugadoresScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Stack de autenticación
const AuthStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
);

// MisTorneosScreen ahora se importa desde screens/public


// Pantalla placeholder para Buscar
const BuscarScreen = () => {
    const { EmptyState } = require('../components/common');
    return (
        <EmptyState
            icon="search-outline"
            title="Buscar"
            message="Busca torneos, equipos y jugadores"
        />
    );
};

// Pantalla placeholder para Perfil
const ProfileScreen = ({ navigation }) => {
    const { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } = require('react-native');
    const { useAuth } = require('../contexts/AuthContext');
    const { Button } = require('../components/common');

    const { userProfile, isGuest, signOut, isAdmin, becomeAdmin } = useAuth();

    const handleSignOut = async () => {
        await signOut();
    };

    const handleBecomeAdmin = async () => {
        Alert.alert(
            'Convertirse en Administrador',
            '¿Deseas convertirte en administrador para crear y gestionar torneos?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Sí, quiero ser Admin',
                    onPress: async () => {
                        const result = await becomeAdmin();
                        if (result.success) {
                            Alert.alert('¡Listo!', 'Ahora eres administrador. Ve al Panel de Administrador para crear torneos.');
                        } else {
                            Alert.alert('Error', result.error || 'No se pudo actualizar el rol');
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
                <View style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    backgroundColor: COLORS.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 24,
                }}>
                    <Ionicons name="person" size={48} color={COLORS.textOnPrimary} />
                </View>

                <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.textPrimary }}>
                    {userProfile?.nombre || (isGuest ? 'Invitado' : 'Usuario')}
                </Text>

                {userProfile?.email && (
                    <Text style={{ fontSize: 16, color: COLORS.textSecondary, marginTop: 4 }}>
                        {userProfile.email}
                    </Text>
                )}

                {isAdmin && (
                    <View style={{
                        backgroundColor: COLORS.primary,
                        paddingHorizontal: 16,
                        paddingVertical: 6,
                        borderRadius: 16,
                        marginTop: 12,
                    }}>
                        <Text style={{ color: COLORS.textOnPrimary, fontWeight: '600' }}>
                            Administrador ✓
                        </Text>
                    </View>
                )}

                <View style={{ width: '100%', marginTop: 40, gap: 12 }}>
                    {/* Botón para ir al Panel de Admin (si ya es admin) */}
                    {isAdmin && (
                        <Button
                            title="Panel de Administrador"
                            onPress={() => navigation.navigate('AdminDashboard')}
                            icon={<Ionicons name="settings" size={20} color={COLORS.textOnPrimary} />}
                        />
                    )}

                    {/* Botón para convertirse en admin (si no lo es) */}
                    {!isGuest && !isAdmin && (
                        <Button
                            title="Convertirse en Administrador"
                            onPress={handleBecomeAdmin}
                            variant="secondary"
                            icon={<Ionicons name="shield-checkmark" size={20} color={COLORS.textOnPrimary} />}
                        />
                    )}

                    {isGuest ? (
                        <Button
                            title="Iniciar Sesión"
                            onPress={() => navigation.navigate('Login')}
                        />
                    ) : (
                        <Button
                            title="Cerrar Sesión"
                            onPress={handleSignOut}
                            variant="outline"
                        />
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
};


// Tab Navigator principal
const MainTabs = () => (
    <Tab.Navigator
        screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
                let iconName;

                switch (route.name) {
                    case 'Inicio':
                        iconName = focused ? 'home' : 'home-outline';
                        break;
                    case 'MisTorneos':
                        iconName = focused ? 'heart' : 'heart-outline';
                        break;
                    case 'Buscar':
                        iconName = focused ? 'search' : 'search-outline';
                        break;
                    case 'Perfil':
                        iconName = focused ? 'person' : 'person-outline';
                        break;
                    default:
                        iconName = 'ellipse';
                }

                return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: COLORS.textSecondary,
            headerShown: false,
            tabBarStyle: {
                backgroundColor: COLORS.surface,
                borderTopWidth: 1,
                borderTopColor: COLORS.divider,
                paddingBottom: Platform.OS === 'android' ? 10 : 5,
                height: Platform.OS === 'android' ? 70 : 60,
            },
            tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: '500',
            },
        })}
    >
        <Tab.Screen name="Inicio" component={HomeScreen} />
        <Tab.Screen
            name="MisTorneos"
            component={MisTorneosScreen}
            options={{ tabBarLabel: 'Seguidos' }}
        />
        <Tab.Screen name="Buscar" component={BuscarScreen} />
        <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
);

// Placeholder para gestionar torneo
const GestionarTorneoScreen = ({ route, navigation }) => {
    const { View, Text, ScrollView, SafeAreaView, TouchableOpacity } = require('react-native');
    const { Card, Button } = require('../components/common');
    const [torneo, setTorneo] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const torneoService = require('../services/torneoService').default;

    React.useEffect(() => {
        loadTorneo();
    }, []);

    const loadTorneo = async () => {
        try {
            const data = await torneoService.getTorneoById(route.params.torneoId);
            setTorneo(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        const { Loading } = require('../components/common');
        return <Loading />;
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
            <ScrollView style={{ padding: 16 }}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>

                <Text style={{ fontSize: 24, fontWeight: '700', marginTop: 16, color: COLORS.textPrimary }}>
                    {torneo?.nombre || 'Torneo'}
                </Text>

                <View style={{ marginTop: 24, gap: 12 }}>
                    <Card>
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
                            onPress={() => navigation.navigate('GestionarEquipos', { torneoId: route.params.torneoId })}
                        >
                            <Ionicons name="people" size={24} color={COLORS.primary} />
                            <Text style={{ flex: 1, marginLeft: 12, fontSize: 16, color: COLORS.textPrimary }}>
                                Gestionar Equipos
                            </Text>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </Card>

                    <Card>
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
                            onPress={() => navigation.navigate('GestionarPartidos', { torneoId: route.params.torneoId })}
                        >
                            <Ionicons name="football" size={24} color={COLORS.primary} />
                            <Text style={{ flex: 1, marginLeft: 12, fontSize: 16, color: COLORS.textPrimary }}>
                                Gestionar Partidos
                            </Text>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </Card>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

// GestionarEquiposScreen ahora se importa desde screens/admin


const GestionarPartidosScreen = ({ route, navigation }) => {
    const { View, Text, SafeAreaView, FlatList, TouchableOpacity } = require('react-native');
    const { Loading, Card, Button } = require('../components/common');
    const { PartidoCard } = require('../components/partido');
    const [partidos, setPartidos] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const partidoService = require('../services/partidoService').default;

    React.useEffect(() => {
        loadPartidos();
    }, []);

    const loadPartidos = async () => {
        try {
            const data = await partidoService.getPartidosByTorneo(route.params.torneoId);
            setPartidos(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Loading />;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={{ padding: 16 }}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 16, color: COLORS.textPrimary }}>
                    Partidos
                </Text>
            </View>
            <FlatList
                data={partidos}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingTop: 0 }}
                renderItem={({ item }) => (
                    <View>
                        <PartidoCard
                            partido={item}
                            onPress={() => navigation.navigate('PartidoEnVivo', { partidoId: item.id })}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12, marginTop: -8 }}>
                            <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}
                                onPress={() => navigation.navigate('EditarPartido', { partidoId: item.id })}
                            >
                                <Ionicons name="calendar-outline" size={16} color={COLORS.warning} />
                                <Text style={{ marginLeft: 4, fontSize: 12, color: COLORS.warning }}>Editar Fecha/Hora</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <Card>
                        <Text style={{ textAlign: 'center', color: COLORS.textSecondary }}>
                            No hay partidos programados
                        </Text>
                    </Card>
                }
            />
        </SafeAreaView>
    );
};

// Stack principal
const MainStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="TorneoDetail" component={TorneoDetailScreen} />
        <Stack.Screen name="PartidoDetail" component={PartidoDetailScreen} />
        <Stack.Screen name="Estadisticas" component={EstadisticasScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen name="CrearTorneo" component={CrearTorneoScreen} />
        <Stack.Screen name="EditarTorneo" component={EditarTorneoScreen} />
        <Stack.Screen name="EditarPartido" component={EditarPartidoScreen} />
        <Stack.Screen name="GestionarTorneo" component={GestionarTorneoScreen} />
        <Stack.Screen name="GestionarEquipos" component={GestionarEquiposScreen} />
        <Stack.Screen name="GestionarJugadores" component={GestionarJugadoresScreen} />
        <Stack.Screen name="GestionarPartidos" component={GestionarPartidosScreen} />
        <Stack.Screen name="PartidoEnVivo" component={PartidoEnVivoScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
);

// Navegador raíz
const AppNavigator = () => {
    const { loading, isAuthenticated, isGuest } = useAuth();

    if (loading) {
        return <Loading message="Cargando..." />;
    }

    return (
        <NavigationContainer>
            {isAuthenticated || isGuest ? <MainStack /> : <AuthStack />}
        </NavigationContainer>
    );
};

export default AppNavigator;
