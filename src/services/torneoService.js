import { supabase } from '../config/supabase';
import { LIMITS, TOURNAMENT_STATUS } from '../utils/constants';
import * as database from '../database/database';
import * as syncService from './syncService';

/**
 * Servicio para gestión de torneos
 */
const torneoService = {
    /**
     * Obtener todos los torneos activos (públicos)
     * NO cachea - solo torneos seguidos deben estar disponibles offline
     */
    getTorneosActivos: async () => {
        try {
            const { data, error } = await supabase
                .from('torneos')
                .select(`
                    *,
                    admin:usuarios!admin_id(nombre, email),
                    equipos:equipos(count)
                `)
                .in('estado', [TOURNAMENT_STATUS.INSCRIPCION, TOURNAMENT_STATUS.ACTIVO])
                .order('fecha_inicio', { ascending: true });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting torneos activos:', error.message);
            // Offline: solo mostrar torneos seguidos desde caché
            const seguidos = await database.getAllRecords('torneos_seguidos');
            const torneoIds = seguidos.map(s => s.torneo_id);
            const allTorneos = await database.getAllRecords('torneos');
            return allTorneos.filter(t => torneoIds.includes(t.id));
        }
    },

    /**
     * Obtener torneos de un administrador (con caché offline)
     */
    getTorneosByAdmin: async (adminId) => {
        try {
            const { data, error } = await supabase
                .from('torneos')
                .select(`
                    *,
                    equipos:equipos(count)
                `)
                .eq('admin_id', adminId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Cache in background (fire-and-forget)
            if (data) {
                data.forEach(torneo => {
                    database.insertRecord('torneos', {
                        id: torneo.id,
                        nombre: torneo.nombre,
                        estado: torneo.estado,
                        admin_id: adminId,
                        synced: 1
                    }).catch(() => { });
                });
            }

            return data;
        } catch (error) {
            console.error('Error getting admin torneos, trying cache:', error.message);
            const allTorneos = await database.getAllRecords('torneos');
            return allTorneos.filter(t => t.admin_id === adminId);
        }
    },

    /**
     * Obtener detalle de un torneo
     * NO cachea automáticamente - solo torneos seguidos se cachean via auto-download
     */
    getTorneoById: async (torneoId) => {
        try {
            // Try online first
            const { data, error } = await supabase
                .from('torneos')
                .select(`
                    *,
                    admin:usuarios!admin_id(id, nombre, email),
                    equipos:equipos(
                        id, nombre, nombre_corto, logo_url, color_principal,
                        puntos, partidos_jugados, partidos_ganados, partidos_empatados,
                        partidos_perdidos, goles_favor, goles_contra, diferencia_gol, grupo
                    )
                `)
                .eq('id', torneoId)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting torneo online, trying cache:', error.message);
            // Offline: solo mostrar si es un torneo seguido que está en caché
            try {
                const cached = await database.getRecordById('torneos', torneoId);
                if (cached) {
                    const allEquipos = await database.getAllRecords('equipos');
                    cached.equipos = allEquipos.filter(e => e.torneo_id === torneoId);
                    return cached;
                }
            } catch (cacheError) {
                console.error('Cache also failed:', cacheError);
            }
            return null;
        }
    },

    /**
     * Crear un nuevo torneo
     */
    crearTorneo: async (adminId, torneoData) => {
        // Verificar límite de torneos activos
        const { data: countData, error: countError } = await supabase
            .rpc('contar_torneos_activos_admin', { p_admin_id: adminId });

        if (countError) throw countError;

        if (countData >= LIMITS.MAX_ACTIVE_TOURNAMENTS_PER_ADMIN) {
            throw new Error(`Has alcanzado el límite de ${LIMITS.MAX_ACTIVE_TOURNAMENTS_PER_ADMIN} torneos activos`);
        }

        const { data, error } = await supabase
            .from('torneos')
            .insert({
                admin_id: adminId,
                ...torneoData,
                estado: TOURNAMENT_STATUS.CONFIGURACION,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Actualizar un torneo
     */
    actualizarTorneo: async (torneoId, updates) => {
        const { data, error } = await supabase
            .from('torneos')
            .update(updates)
            .eq('id', torneoId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Cambiar estado del torneo
     */
    cambiarEstado: async (torneoId, nuevoEstado) => {
        const { data, error } = await supabase
            .from('torneos')
            .update({ estado: nuevoEstado })
            .eq('id', torneoId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Eliminar un torneo
     */
    eliminarTorneo: async (torneoId) => {
        const { error } = await supabase
            .from('torneos')
            .delete()
            .eq('id', torneoId);

        if (error) throw error;
        return true;
    },

    /**
     * Buscar torneos por nombre
     */
    buscarTorneos: async (query) => {
        const { data, error } = await supabase
            .from('torneos')
            .select(`
        *,
        admin:usuarios!admin_id(nombre)
      `)
            .ilike('nombre', `%${query}%`)
            .in('estado', [TOURNAMENT_STATUS.INSCRIPCION, TOURNAMENT_STATUS.ACTIVO, TOURNAMENT_STATUS.FINALIZADO])
            .limit(20);

        if (error) throw error;
        return data;
    },

    /**
     * Obtener tabla de posiciones
     */
    getTablaposiciones: async (torneoId, grupo = null) => {
        let query = supabase
            .from('vista_tabla_posiciones')
            .select('*')
            .eq('torneo_id', torneoId);

        if (grupo) {
            query = query.eq('grupo', grupo);
        }

        const { data, error } = await query.order('posicion', { ascending: true });

        if (error) throw error;
        return data;
    },

    /**
     * Obtener tabla de goleadores
     * NO cachea - datos calculados desde jugadores cacheados
     */
    getGoleadores: async (torneoId, limit = 10) => {
        try {
            const { data, error } = await supabase
                .from('vista_goleadores')
                .select('*')
                .eq('torneo_id', torneoId)
                .limit(limit);

            if (error) throw error;
            return data;
        } catch (error) {
            console.log('Error getting goleadores online, trying cache:', error.message);
            // Offline: calcular desde datos locales
            const jugadores = await database.getAllRecords('jugadores');
            const equipos = await database.getAllRecords('equipos');
            const torneoEquipos = equipos.filter(e => e.torneo_id === torneoId).map(e => e.id);

            const goleadores = jugadores
                .filter(j => torneoEquipos.includes(j.equipo_id) && (j.goles_totales || 0) > 0)
                .map(j => {
                    const equipo = equipos.find(e => e.id === j.equipo_id);
                    return {
                        jugador_id: j.id,
                        nombre: j.nombre,
                        goles: j.goles_totales || 0,
                        equipo_nombre: equipo?.nombre || 'Equipo',
                        equipo_logo: equipo?.logo_url || null
                    };
                })
                .sort((a, b) => b.goles - a.goles)
                .slice(0, limit);

            return goleadores;
        }
    },

    /**
     * Seguir un torneo
     */
    seguirTorneo: async (usuarioId, torneoId) => {
        const { data, error } = await supabase
            .from('torneos_seguidos')
            .insert({
                usuario_id: usuarioId,
                torneo_id: torneoId,
                notificaciones_activas: true,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Dejar de seguir un torneo
     */
    dejarDeSeguirTorneo: async (usuarioId, torneoId) => {
        const { error } = await supabase
            .from('torneos_seguidos')
            .delete()
            .eq('usuario_id', usuarioId)
            .eq('torneo_id', torneoId);

        if (error) throw error;
        return true;
    },

    /**
     * Obtener torneos seguidos por un usuario
     * NO cachea - auto-download lo hace
     */
    getTorneosSeguidos: async (usuarioId) => {
        try {
            const { data, error } = await supabase
                .from('torneos_seguidos')
                .select(`
                    *,
                    torneo:torneos(
                        id, nombre, descripcion, estado, fecha_inicio, logo_url, imagen_url, lugar,
                        equipos:equipos(count)
                    )
                `)
                .eq('usuario_id', usuarioId);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting torneos seguidos, trying cache:', error.message);
            // Offline: mostrar desde caché
            const seguidos = await database.getAllRecords('torneos_seguidos');
            const userSeguidos = seguidos.filter(s => s.user_id === usuarioId);
            const result = [];
            for (const seguido of userSeguidos) {
                const torneo = await database.getRecordById('torneos', seguido.torneo_id);
                result.push({ ...seguido, torneo });
            }
            return result;
        }
    },

    /**
     * Verificar si el usuario sigue un torneo (con soporte offline)
     */
    estaSiguiendo: async (usuarioId, torneoId) => {
        try {
            const { data, error } = await supabase
                .from('torneos_seguidos')
                .select('id')
                .eq('usuario_id', usuarioId)
                .eq('torneo_id', torneoId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return !!data;
        } catch (error) {
            console.log('Checking seguimiento offline:', error.message);
            // Check local cache
            const seguidos = await database.getAllRecords('torneos_seguidos');
            const found = seguidos.find(s =>
                s.user_id === usuarioId && s.torneo_id === torneoId
            );
            return !!found;
        }
    },
};

export default torneoService;
