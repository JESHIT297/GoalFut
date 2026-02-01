/**
 * Servicio de almacenamiento offline para partidos en vivo
 * Permite registrar eventos sin internet y sincronizarlos después
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { MATCH_STATUS, EVENT_TYPES } from '../utils/constants';

const OFFLINE_KEYS = {
    PENDING_EVENTS: '@goalfut_pending_events',
    PENDING_MATCH_UPDATES: '@goalfut_pending_match_updates',
    CACHED_MATCHES: '@goalfut_cached_matches',
};

const offlineMatchService = {
    /**
     * Guardar evento pendiente de sincronizar
     */
    saveEventOffline: async (eventoData) => {
        try {
            const pending = await offlineMatchService.getPendingEvents();
            const newEvent = {
                ...eventoData,
                offlineId: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                createdAt: new Date().toISOString(),
                synced: false,
            };
            pending.push(newEvent);
            await AsyncStorage.setItem(OFFLINE_KEYS.PENDING_EVENTS, JSON.stringify(pending));
            console.log('Evento guardado offline:', newEvent.offlineId);
            return newEvent;
        } catch (error) {
            console.error('Error guardando evento offline:', error);
            throw error;
        }
    },

    /**
     * Obtener eventos pendientes de sincronizar
     */
    getPendingEvents: async () => {
        try {
            const data = await AsyncStorage.getItem(OFFLINE_KEYS.PENDING_EVENTS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error obteniendo eventos pendientes:', error);
            return [];
        }
    },

    /**
     * Guardar actualización de partido pendiente
     */
    saveMatchUpdateOffline: async (partidoId, updateData) => {
        try {
            const pending = await offlineMatchService.getPendingMatchUpdates();
            const update = {
                partidoId,
                data: updateData,
                offlineId: `match_${Date.now()}`,
                createdAt: new Date().toISOString(),
                synced: false,
            };

            // Reemplazar update anterior del mismo partido si existe
            const filtered = pending.filter(p => p.partidoId !== partidoId);
            filtered.push(update);

            await AsyncStorage.setItem(OFFLINE_KEYS.PENDING_MATCH_UPDATES, JSON.stringify(filtered));
            console.log('Update de partido guardado offline:', update.offlineId);
            return update;
        } catch (error) {
            console.error('Error guardando update offline:', error);
            throw error;
        }
    },

    /**
     * Obtener updates de partidos pendientes
     */
    getPendingMatchUpdates: async () => {
        try {
            const data = await AsyncStorage.getItem(OFFLINE_KEYS.PENDING_MATCH_UPDATES);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error obteniendo updates pendientes:', error);
            return [];
        }
    },

    /**
     * Guardar estado local del partido (para mostrar mientras está offline)
     */
    cacheMatchState: async (partidoId, matchState) => {
        try {
            const cached = await offlineMatchService.getCachedMatches();
            cached[partidoId] = {
                ...matchState,
                cachedAt: new Date().toISOString(),
            };
            await AsyncStorage.setItem(OFFLINE_KEYS.CACHED_MATCHES, JSON.stringify(cached));
        } catch (error) {
            console.error('Error cacheando partido:', error);
        }
    },

    /**
     * Obtener estado cacheado de un partido
     */
    getCachedMatchState: async (partidoId) => {
        try {
            const cached = await offlineMatchService.getCachedMatches();
            return cached[partidoId] || null;
        } catch (error) {
            console.error('Error obteniendo partido cacheado:', error);
            return null;
        }
    },

    /**
     * Obtener todos los partidos cacheados
     */
    getCachedMatches: async () => {
        try {
            const data = await AsyncStorage.getItem(OFFLINE_KEYS.CACHED_MATCHES);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            return {};
        }
    },

    /**
     * Sincronizar todos los datos pendientes con el servidor
     */
    syncPendingData: async () => {
        const results = {
            eventsSync: { success: 0, failed: 0 },
            matchUpdatesSync: { success: 0, failed: 0 },
        };

        // 1. Sincronizar updates de partidos primero
        const pendingUpdates = await offlineMatchService.getPendingMatchUpdates();
        const remainingUpdates = [];

        for (const update of pendingUpdates) {
            try {
                const { error } = await supabase
                    .from('partidos')
                    .update(update.data)
                    .eq('id', update.partidoId);

                if (error) throw error;
                results.matchUpdatesSync.success++;
                console.log('Update sincronizado:', update.offlineId);
            } catch (error) {
                console.error('Error sincronizando update:', error);
                results.matchUpdatesSync.failed++;
                remainingUpdates.push(update);
            }
        }

        await AsyncStorage.setItem(OFFLINE_KEYS.PENDING_MATCH_UPDATES, JSON.stringify(remainingUpdates));

        // 2. Sincronizar eventos
        const pendingEvents = await offlineMatchService.getPendingEvents();
        const remainingEvents = [];

        for (const evento of pendingEvents) {
            try {
                // Remover campos offline antes de enviar
                const { offlineId, createdAt, synced, ...eventoData } = evento;

                const { error } = await supabase
                    .from('eventos_partido')
                    .insert(eventoData);

                if (error) throw error;
                results.eventsSync.success++;
                console.log('Evento sincronizado:', offlineId);
            } catch (error) {
                console.error('Error sincronizando evento:', error);
                results.eventsSync.failed++;
                remainingEvents.push(evento);
            }
        }

        await AsyncStorage.setItem(OFFLINE_KEYS.PENDING_EVENTS, JSON.stringify(remainingEvents));

        return results;
    },

    /**
     * Obtener conteo de items pendientes de sincronizar
     */
    getPendingCount: async () => {
        const events = await offlineMatchService.getPendingEvents();
        const updates = await offlineMatchService.getPendingMatchUpdates();
        return events.length + updates.length;
    },

    /**
     * Limpiar datos sincronizados
     */
    clearSyncedData: async () => {
        try {
            const events = await offlineMatchService.getPendingEvents();
            const updates = await offlineMatchService.getPendingMatchUpdates();

            // Mantener solo los no sincronizados
            const unsyncedEvents = events.filter(e => !e.synced);
            const unsyncedUpdates = updates.filter(u => !u.synced);

            await AsyncStorage.setItem(OFFLINE_KEYS.PENDING_EVENTS, JSON.stringify(unsyncedEvents));
            await AsyncStorage.setItem(OFFLINE_KEYS.PENDING_MATCH_UPDATES, JSON.stringify(unsyncedUpdates));
        } catch (error) {
            console.error('Error limpiando datos:', error);
        }
    },

    /**
     * Limpiar toda la caché offline
     */
    clearAllOfflineData: async () => {
        try {
            await AsyncStorage.multiRemove([
                OFFLINE_KEYS.PENDING_EVENTS,
                OFFLINE_KEYS.PENDING_MATCH_UPDATES,
                OFFLINE_KEYS.CACHED_MATCHES,
            ]);
        } catch (error) {
            console.error('Error limpiando caché offline:', error);
        }
    },
};

export default offlineMatchService;
