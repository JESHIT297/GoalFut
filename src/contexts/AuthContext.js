import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CACHE_KEYS, USER_ROLES } from '../utils/constants';
import notificationService from '../services/notificationService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isGuest, setIsGuest] = useState(false);

    useEffect(() => {
        // Verificar sesión al iniciar
        checkUser();

        // Escuchar cambios de autenticación
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === 'SIGNED_IN' && session?.user) {
                    setUser(session.user);
                    await fetchUserProfile(session.user.id);
                    setIsGuest(false);
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setUserProfile(null);
                    setIsGuest(false);
                    await AsyncStorage.removeItem(CACHE_KEYS.USER_DATA);
                }
            }
        );

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    const checkUser = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                setUser(session.user);
                await fetchUserProfile(session.user.id);
                setIsGuest(false);
            } else {
                // Verificar si hay datos de usuario en caché
                const cachedUser = await AsyncStorage.getItem(CACHE_KEYS.USER_DATA);
                if (cachedUser) {
                    const parsed = JSON.parse(cachedUser);
                    if (parsed.isGuest) {
                        setIsGuest(true);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking user:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserProfile = async (authId) => {
        try {
            const { data, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('auth_id', authId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (data) {
                setUserProfile(data);
                await AsyncStorage.setItem(CACHE_KEYS.USER_DATA, JSON.stringify(data));

                // Registrar para notificaciones push
                const pushToken = await notificationService.registerForPushNotifications();
                if (pushToken) {
                    await notificationService.saveTokenToDatabase(data.id, pushToken);
                }
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
    };

    const signUp = async (email, password, nombre, telefono = null) => {
        try {
            setLoading(true);

            // Registrar en Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;

            // Crear perfil en tabla usuarios
            if (authData.user) {
                const { data: profileData, error: profileError } = await supabase
                    .from('usuarios')
                    .insert({
                        auth_id: authData.user.id,
                        email,
                        nombre,
                        telefono,
                        rol: USER_ROLES.REGISTERED,
                    })
                    .select()
                    .single();

                if (profileError) throw profileError;

                setUserProfile(profileData);
            }

            return { success: true, data: authData };
        } catch (error) {
            console.error('Error signing up:', error);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (email, password) => {
        try {
            setLoading(true);

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            setIsGuest(false);
            return { success: true, data };
        } catch (error) {
            console.error('Error signing in:', error);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        try {
            setLoading(true);

            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            setUser(null);
            setUserProfile(null);
            setIsGuest(false);

            // Limpiar TODA la caché al cerrar sesión
            await AsyncStorage.multiRemove([
                CACHE_KEYS.USER_DATA,
                CACHE_KEYS.FOLLOWED_TOURNAMENTS,
                CACHE_KEYS.TOURNAMENTS,
                CACHE_KEYS.SYNC_QUEUE,
                CACHE_KEYS.LAST_SYNC,
            ]);

            return { success: true };
        } catch (error) {
            console.error('Error signing out:', error);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    const continueAsGuest = async () => {
        setIsGuest(true);
        await AsyncStorage.setItem(CACHE_KEYS.USER_DATA, JSON.stringify({ isGuest: true }));
    };

    const updateProfile = async (updates) => {
        try {
            if (!userProfile?.id) return { success: false, error: 'No user profile' };

            const { data, error } = await supabase
                .from('usuarios')
                .update(updates)
                .eq('id', userProfile.id)
                .select()
                .single();

            if (error) throw error;

            setUserProfile(data);
            await AsyncStorage.setItem(CACHE_KEYS.USER_DATA, JSON.stringify(data));

            return { success: true, data };
        } catch (error) {
            console.error('Error updating profile:', error);
            return { success: false, error: error.message };
        }
    };

    const becomeAdmin = async () => {
        return updateProfile({ rol: USER_ROLES.ADMIN });
    };

    const value = {
        user,
        userProfile,
        loading,
        isGuest,
        isAuthenticated: !!user,
        isAdmin: userProfile?.rol === USER_ROLES.ADMIN,
        signUp,
        signIn,
        signOut,
        continueAsGuest,
        updateProfile,
        becomeAdmin,
        refreshProfile: () => user && fetchUserProfile(user.id),
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
