import { supabase } from '../config/supabase';
import * as database from '../database/database';
import * as syncService from './syncService';

/**
 * Servicio para gestión de jugadores
 */
const jugadorService = {
    /**
     * Obtener jugadores de un equipo
     * NO cachea - solo torneos seguidos se cachean via auto-download
     */
    getJugadoresByEquipo: async (equipoId) => {
        try {
            const { data, error } = await supabase
                .from('jugadores')
                .select('*')
                .eq('equipo_id', equipoId)
                .eq('activo', true)
                .order('numero_camiseta', { ascending: true });

            if (error) throw error;
            return data;
        } catch (error) {
            console.log('Error getting jugadores online, trying cache:', error.message);
            // Offline: mostrar desde caché
            const allJugadores = await database.getAllRecords('jugadores');
            return allJugadores.filter(j => j.equipo_id === equipoId && j.activo !== false);
        }
    },

    /**
     * Obtener detalle de un jugador
     */
    getJugadorById: async (jugadorId) => {
        const { data, error } = await supabase
            .from('jugadores')
            .select(`
        *,
        equipo:equipos(id, nombre, logo_url, torneo_id)
      `)
            .eq('id', jugadorId)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Crear un nuevo jugador - con soporte offline
     */
    crearJugador: async (equipoId, jugadorData) => {
        const online = await syncService.isOnline();

        if (!online) {
            // Create player offline with temporary ID
            const offlinePlayer = {
                id: `offline_player_${Date.now()}`,
                equipo_id: equipoId,
                ...jugadorData,
                activo: true,
                goles_totales: 0,
                synced: 0,
                offline: true,
                created_at: new Date().toISOString()
            };

            // Save to local database
            await database.insertRecord('jugadores', offlinePlayer);
            // Add to sync queue
            await database.addToSyncQueue('jugadores', 'INSERT', offlinePlayer.id, offlinePlayer);

            console.log('Jugador guardado offline:', offlinePlayer.id);
            return offlinePlayer;
        }

        // Online: normal flow
        const { data, error } = await supabase
            .from('jugadores')
            .insert({
                equipo_id: equipoId,
                ...jugadorData,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Actualizar un jugador
     */
    actualizarJugador: async (jugadorId, updates) => {
        const { data, error } = await supabase
            .from('jugadores')
            .update(updates)
            .eq('id', jugadorId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Eliminar (desactivar) un jugador
     */
    eliminarJugador: async (jugadorId) => {
        const { data, error } = await supabase
            .from('jugadores')
            .update({ activo: false })
            .eq('id', jugadorId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Asignar capitán
     */
    asignarCapitan: async (equipoId, jugadorId) => {
        // Primero quitar capitanía de todos los jugadores del equipo
        await supabase
            .from('jugadores')
            .update({ es_capitan: false })
            .eq('equipo_id', equipoId);

        // Asignar capitán al jugador seleccionado
        const { data, error } = await supabase
            .from('jugadores')
            .update({ es_capitan: true })
            .eq('id', jugadorId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Obtener goleadores de un torneo
     */
    getGoleadoresByTorneo: async (torneoId, limit = 20) => {
        const { data, error } = await supabase
            .from('jugadores')
            .select(`
        id, nombre, apellido, numero_camiseta, foto_url, goles_totales,
        equipo:equipos!inner(id, nombre, logo_url, torneo_id)
      `)
            .eq('equipo.torneo_id', torneoId)
            .gt('goles_totales', 0)
            .order('goles_totales', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    },

    /**
     * Buscar jugadores por nombre
     */
    buscarJugadores: async (torneoId, query) => {
        const { data, error } = await supabase
            .from('jugadores')
            .select(`
        *,
        equipo:equipos!inner(id, nombre, torneo_id)
      `)
            .eq('equipo.torneo_id', torneoId)
            .or(`nombre.ilike.%${query}%,apellido.ilike.%${query}%`)
            .limit(20);

        if (error) throw error;
        return data;
    },
};

export default jugadorService;
