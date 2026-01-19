import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

// Configurar cómo se manejan las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

/**
 * Servicio de notificaciones push
 */
const notificationService = {
    /**
     * Registrar para notificaciones push
     * NOTA: Push notifications no funcionan en Expo Go desde SDK 53
     * Se necesita un "development build" para que funcionen
     * @returns {string|null} Token de push o null si falla
     */
    registerForPushNotifications: async () => {
        try {
            if (!Device.isDevice) {
                console.log('Push notifications solo funcionan en dispositivos físicos');
                return null;
            }

            // Verificar/solicitar permisos
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Permiso de notificaciones denegado');
                return null;
            }

            // Configuración especial para Android
            if (Platform.OS === 'android') {
                try {
                    await Notifications.setNotificationChannelAsync('default', {
                        name: 'default',
                        importance: Notifications.AndroidImportance.MAX,
                        vibrationPattern: [0, 250, 250, 250],
                        lightColor: '#FF231F7C',
                    });
                } catch (channelError) {
                    console.log('Canal de notificación no disponible en Expo Go');
                }
            }

            // Obtener token de Expo - requiere development build, no funciona en Expo Go
            const projectId = Constants.expoConfig?.extra?.eas?.projectId
                ?? Constants.easConfig?.projectId
                ?? 'goalfut-project'; // Fallback ID

            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId,
            });

            return tokenData.data;
        } catch (error) {
            // En Expo Go SDK 53+, push notifications no están disponibles
            // Este error es esperado y no debería interrumpir la app
            console.log('Push notifications no disponibles (requiere development build):', error.message);
            return null;
        }
    },

    /**
     * Guardar token en Supabase
     * @param {string} userId - ID del usuario
     * @param {string} token - Token de push
     */
    saveTokenToDatabase: async (userId, token) => {
        if (!userId || !token) return;

        try {
            // Upsert: insertar o actualizar si ya existe
            const { error } = await supabase
                .from('push_tokens')
                .upsert({
                    user_id: userId,
                    token: token,
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'token',
                });

            if (error) throw error;
            console.log('Token guardado exitosamente');
        } catch (error) {
            console.error('Error guardando token:', error);
        }
    },

    /**
     * Eliminar token al cerrar sesión
     * @param {string} token - Token a eliminar
     */
    removeToken: async (token) => {
        if (!token) return;

        try {
            await supabase
                .from('push_tokens')
                .delete()
                .eq('token', token);
        } catch (error) {
            console.error('Error eliminando token:', error);
        }
    },

    /**
     * Enviar notificación local (para pruebas)
     * @param {string} title - Título
     * @param {string} body - Mensaje
     */
    sendLocalNotification: async (title, body) => {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                sound: true,
            },
            trigger: null, // Inmediata
        });
    },

    /**
     * Escuchar notificaciones recibidas
     * @param {Function} callback - Función a ejecutar cuando llega notificación
     */
    addNotificationReceivedListener: (callback) => {
        return Notifications.addNotificationReceivedListener(callback);
    },

    /**
     * Escuchar cuando el usuario toca una notificación
     * @param {Function} callback - Función a ejecutar
     */
    addNotificationResponseListener: (callback) => {
        return Notifications.addNotificationResponseReceivedListener(callback);
    },

    /**
     * Enviar notificación push vía Expo Push API
     * @param {string[]} tokens - Array de tokens Expo push
     * @param {string} title - Título de la notificación
     * @param {string} body - Mensaje
     * @param {object} data - Datos adicionales (opcional)
     */
    sendPushNotification: async (tokens, title, body, data = {}) => {
        if (!tokens || tokens.length === 0) return;

        const messages = tokens.map(token => ({
            to: token,
            sound: 'default',
            title,
            body,
            data,
        }));

        try {
            const response = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages),
            });

            const result = await response.json();
            console.log('Push notification sent:', result);
            return result;
        } catch (error) {
            console.error('Error sending push notification:', error);
        }
    },

    /**
     * Obtener tokens de usuarios que siguen un equipo
     * @param {string} equipoId - ID del equipo
     * @returns {string[]} Array de tokens
     */
    getTokensByEquipo: async (equipoId) => {
        try {
            const { data, error } = await supabase
                .from('equipos_seguidos')
                .select('usuario_id')
                .eq('equipo_id', equipoId);

            if (error) throw error;
            if (!data || data.length === 0) return [];

            const userIds = data.map(t => t.usuario_id);

            const { data: tokens, error: tokenError } = await supabase
                .from('push_tokens')
                .select('token')
                .in('user_id', userIds);

            if (tokenError) throw tokenError;
            return tokens?.map(t => t.token) || [];
        } catch (error) {
            console.error('Error getting tokens:', error);
            return [];
        }
    },

    /**
     * Notificar gol a seguidores del equipo
     * @param {string} equipoId - ID del equipo que marcó
     * @param {string} equipoNombre - Nombre del equipo que marcó
     * @param {string} jugadorNombre - Nombre del jugador
     * @param {string} marcador - Marcador actual (ej: "2 - 1")
     * @param {string} equipoRivalId - ID del equipo rival (para notificar también a sus seguidores)
     */
    notifyGoal: async (equipoId, equipoNombre, jugadorNombre, marcador, equipoRivalId = null) => {
        // Obtener tokens de seguidores del equipo que marcó
        const tokensEquipo = await notificationService.getTokensByEquipo(equipoId);

        // Obtener tokens de seguidores del equipo rival (también les interesa saber)
        let tokensRival = [];
        if (equipoRivalId) {
            tokensRival = await notificationService.getTokensByEquipo(equipoRivalId);
        }

        // Combinar tokens únicos
        const allTokens = [...new Set([...tokensEquipo, ...tokensRival])];

        if (allTokens.length === 0) return;

        await notificationService.sendPushNotification(
            allTokens,
            `⚽ ¡GOL de ${equipoNombre}!`,
            `${jugadorNombre} marca. Marcador: ${marcador}`,
            { type: 'goal', equipoId }
        );
    },

    /**
     * Notificar que un partido está por comenzar
     * @param {string} equipoLocalId - ID del equipo local
     * @param {string} equipoVisitanteId - ID del equipo visitante
     * @param {string} equipoLocal - Nombre equipo local
     * @param {string} equipoVisitante - Nombre equipo visitante
     * @param {number} minutos - Minutos para que empiece
     */
    notifyMatchStarting: async (equipoLocalId, equipoVisitanteId, equipoLocal, equipoVisitante, minutos = 15) => {
        // Notificar a seguidores de ambos equipos
        const tokensLocal = await notificationService.getTokensByEquipo(equipoLocalId);
        const tokensVisitante = await notificationService.getTokensByEquipo(equipoVisitanteId);

        const allTokens = [...new Set([...tokensLocal, ...tokensVisitante])];

        if (allTokens.length === 0) return;

        await notificationService.sendPushNotification(
            allTokens,
            `🏟️ Partido en ${minutos} minutos`,
            `${equipoLocal} vs ${equipoVisitante}`,
            { type: 'match_starting' }
        );
    },
};

export default notificationService;
