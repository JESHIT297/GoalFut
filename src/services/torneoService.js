import { supabase } from '../config/supabase';
import { LIMITS, TOURNAMENT_STATUS } from '../utils/constants';

/**
 * Servicio para gestión de torneos
 */
const torneoService = {
    /**
     * Obtener todos los torneos activos (públicos)
     */
    getTorneosActivos: async () => {
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
    },

    /**
     * Obtener torneos de un administrador
     */
    getTorneosByAdmin: async (adminId) => {
        const { data, error } = await supabase
            .from('torneos')
            .select(`
        *,
        equipos:equipos(count)
      `)
            .eq('admin_id', adminId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Obtener detalle de un torneo
     */
    getTorneoById: async (torneoId) => {
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
     */
    getGoleadores: async (torneoId, limit = 10) => {
        const { data, error } = await supabase
            .from('vista_goleadores')
            .select('*')
            .eq('torneo_id', torneoId)
            .limit(limit);

        if (error) throw error;
        return data;
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
     */
    getTorneosSeguidos: async (usuarioId) => {
        const { data, error } = await supabase
            .from('torneos_seguidos')
            .select(`
        *,
        torneo:torneos(
          id, nombre, descripcion, estado, fecha_inicio, logo_url,
          equipos:equipos(count)
        )
      `)
            .eq('usuario_id', usuarioId);

        if (error) throw error;
        return data;
    },

    /**
     * Verificar si el usuario sigue un torneo
     */
    estaSiguiendo: async (usuarioId, torneoId) => {
        const { data, error } = await supabase
            .from('torneos_seguidos')
            .select('id')
            .eq('usuario_id', usuarioId)
            .eq('torneo_id', torneoId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return !!data;
    },
};

export default torneoService;
