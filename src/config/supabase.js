import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Credenciales de Supabase - Proyecto GoalFut
const SUPABASE_URL = 'https://dtebxanvnyrvalwlhmyp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3KgwESkbZ0MsRVRE1yGuBA_ZzZfgNLr';


// Crear cliente de Supabase con persistencia de sesión
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Función helper para verificar si hay una sesión activa
export const getSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

// Función helper para obtener el usuario actual
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export default supabase;
