import { supabase } from '../config/supabase';

/**
 * Servicio para gestión de equipos
 */
const equipoService = {
    /**
     * Obtener equipos de un torneo
     */
    getEquiposByTorneo: async (torneoId) => {
        const { data, error } = await supabase
            .from('equipos')
            .select(`
        *,
        jugadores:jugadores(count)
      `)
            .eq('torneo_id', torneoId)
            .order('nombre', { ascending: true });

        if (error) throw error;
        return data;
    },

    /**
     * Obtener detalle de un equipo
     */
    getEquipoById: async (equipoId) => {
        const { data, error } = await supabase
            .from('equipos')
            .select(`
        *,
        torneo:torneos(id, nombre),
        jugadores:jugadores(*)
      `)
            .eq('id', equipoId)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Crear un nuevo equipo
     */
    crearEquipo: async (torneoId, equipoData) => {
        const { data, error } = await supabase
            .from('equipos')
            .insert({
                torneo_id: torneoId,
                ...equipoData,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Actualizar un equipo
     */
    actualizarEquipo: async (equipoId, updates) => {
        const { data, error } = await supabase
            .from('equipos')
            .update(updates)
            .eq('id', equipoId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Eliminar un equipo
     */
    eliminarEquipo: async (equipoId) => {
        const { error } = await supabase
            .from('equipos')
            .delete()
            .eq('id', equipoId);

        if (error) throw error;
        return true;
    },

    /**
     * Asignar grupo a un equipo
     */
    asignarGrupo: async (equipoId, grupo) => {
        const { data, error } = await supabase
            .from('equipos')
            .update({ grupo })
            .eq('id', equipoId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Resetear estadísticas de un equipo
     */
    resetearEstadisticas: async (equipoId) => {
        const { data, error } = await supabase
            .from('equipos')
            .update({
                puntos: 0,
                partidos_jugados: 0,
                partidos_ganados: 0,
                partidos_empatados: 0,
                partidos_perdidos: 0,
                goles_favor: 0,
                goles_contra: 0,
                diferencia_gol: 0,
            })
            .eq('id', equipoId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Seguir un equipo
     */
    seguirEquipo: async (usuarioId, equipoId) => {
        const { data, error } = await supabase
            .from('equipos_seguidos')
            .insert({
                usuario_id: usuarioId,
                equipo_id: equipoId,
                notificaciones_activas: true,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Dejar de seguir un equipo
     */
    dejarDeSeguirEquipo: async (usuarioId, equipoId) => {
        const { error } = await supabase
            .from('equipos_seguidos')
            .delete()
            .eq('usuario_id', usuarioId)
            .eq('equipo_id', equipoId);

        if (error) throw error;
        return true;
    },

    /**
     * Verificar si un usuario sigue un equipo
     */
    isFollowingEquipo: async (usuarioId, equipoId) => {
        if (!usuarioId || !equipoId) return false;

        const { data, error } = await supabase
            .from('equipos_seguidos')
            .select('id')
            .eq('usuario_id', usuarioId)
            .eq('equipo_id', equipoId)
            .maybeSingle();

        if (error) {
            console.error('Error checking follow status:', error);
            return false;
        }
        return !!data;
    },

    /**
     * Obtener todos los equipos que sigue un usuario
     */
    getEquiposSeguidos: async (usuarioId) => {
        if (!usuarioId) return [];

        const { data, error } = await supabase
            .from('equipos_seguidos')
            .select(`
                equipo_id,
                equipo:equipos(id, nombre, nombre_corto, logo_url, color_principal, torneo:torneos(id, nombre))
            `)
            .eq('usuario_id', usuarioId);

        if (error) throw error;
        return data?.map(d => d.equipo) || [];
    },

    /**
     * Toggle seguir/dejar de seguir equipo
     */
    toggleSeguirEquipo: async (usuarioId, equipoId) => {
        const isFollowing = await equipoService.isFollowingEquipo(usuarioId, equipoId);

        if (isFollowing) {
            await equipoService.dejarDeSeguirEquipo(usuarioId, equipoId);
            return false;
        } else {
            await equipoService.seguirEquipo(usuarioId, equipoId);
            return true;
        }
    },
};

export default equipoService;
