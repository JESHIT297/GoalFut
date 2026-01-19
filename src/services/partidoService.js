import { supabase } from '../config/supabase';
import { MATCH_STATUS, EVENT_TYPES } from '../utils/constants';
import notificationService from './notificationService';

/**
 * Servicio para gestión de partidos
 */
const partidoService = {
    /**
     * Obtener partidos de un torneo
     */
    getPartidosByTorneo: async (torneoId, estado = null) => {
        let query = supabase
            .from('partidos')
            .select(`
        *,
        equipo_local:equipos!equipo_local_id(id, nombre, nombre_corto, logo_url),
        equipo_visitante:equipos!equipo_visitante_id(id, nombre, nombre_corto, logo_url)
      `)
            .eq('torneo_id', torneoId);

        if (estado) {
            query = query.eq('estado', estado);
        }

        const { data, error } = await query.order('fecha', { ascending: true }).order('hora', { ascending: true });

        if (error) throw error;
        return data;
    },

    /**
     * Obtener partidos próximos (públicos)
     */
    getProximosPartidos: async (limit = 10) => {
        const { data, error } = await supabase
            .from('vista_proximos_partidos')
            .select('*')
            .limit(limit);

        if (error) throw error;
        return data;
    },

    /**
     * Obtener partidos en vivo
     */
    getPartidosEnVivo: async () => {
        const { data, error } = await supabase
            .from('partidos')
            .select(`
        *,
        equipo_local:equipos!equipo_local_id(id, nombre, nombre_corto, logo_url),
        equipo_visitante:equipos!equipo_visitante_id(id, nombre, nombre_corto, logo_url),
        torneo:torneos(id, nombre)
      `)
            .eq('estado', MATCH_STATUS.EN_JUEGO);

        if (error) throw error;
        return data;
    },

    /**
     * Obtener detalle de un partido
     */
    getPartidoById: async (partidoId) => {
        const { data, error } = await supabase
            .from('partidos')
            .select(`
        *,
        equipo_local:equipos!equipo_local_id(
          id, nombre, nombre_corto, logo_url, color_principal,
          jugadores:jugadores(id, nombre, apellido, numero_camiseta, posicion, activo)
        ),
        equipo_visitante:equipos!equipo_visitante_id(
          id, nombre, nombre_corto, logo_url, color_principal,
          jugadores:jugadores(id, nombre, apellido, numero_camiseta, posicion, activo)
        ),
        torneo:torneos(id, nombre, duracion_tiempo_minutos, cantidad_tiempos)
      `)
            .eq('id', partidoId)
            .single();

        if (error) throw error;

        // Cargar eventos por separado para evitar ambigüedad de FK
        const { data: eventos, error: eventosError } = await supabase
            .from('eventos_partido')
            .select(`
                id, tipo, minuto, segundo, tiempo, descripcion,
                jugador_id, equipo_id
            `)
            .eq('partido_id', partidoId)
            .order('tiempo', { ascending: true })
            .order('minuto', { ascending: true });

        if (eventosError) {
            console.error('Error loading eventos:', eventosError);
            data.eventos = [];
        } else {
            // Mapear jugadores a los eventos
            const allPlayers = [
                ...(data.equipo_local?.jugadores || []),
                ...(data.equipo_visitante?.jugadores || [])
            ];

            data.eventos = eventos.map(e => ({
                ...e,
                jugador: allPlayers.find(j => j.id === e.jugador_id) || null
            }));
        }

        // Filtrar solo jugadores activos
        if (data.equipo_local?.jugadores) {
            data.equipo_local.jugadores = data.equipo_local.jugadores.filter(j => j.activo !== false);
        }
        if (data.equipo_visitante?.jugadores) {
            data.equipo_visitante.jugadores = data.equipo_visitante.jugadores.filter(j => j.activo !== false);
        }

        return data;
    },

    /**
     * Crear un nuevo partido
     */
    crearPartido: async (partidoData) => {
        const { data, error } = await supabase
            .from('partidos')
            .insert({
                ...partidoData,
                estado: MATCH_STATUS.PROGRAMADO,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Crear múltiples partidos (para calendario automático)
     */
    crearPartidosMultiples: async (partidos) => {
        const { data, error } = await supabase
            .from('partidos')
            .insert(partidos)
            .select();

        if (error) throw error;
        return data;
    },

    /**
     * Actualizar un partido
     */
    actualizarPartido: async (partidoId, updates) => {
        const { data, error } = await supabase
            .from('partidos')
            .update(updates)
            .eq('id', partidoId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Iniciar un partido
     */
    iniciarPartido: async (partidoId) => {
        const { data, error } = await supabase
            .from('partidos')
            .update({
                estado: MATCH_STATUS.EN_JUEGO,
                tiempo_actual: 1,
                segundos_jugados: 0,
                tiempo_inicio_real: new Date().toISOString(),
            })
            .eq('id', partidoId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Pausar un partido
     */
    pausarPartido: async (partidoId, segundosJugados) => {
        const { data, error } = await supabase
            .from('partidos')
            .update({
                estado: MATCH_STATUS.PAUSADO,
                segundos_jugados: segundosJugados,
            })
            .eq('id', partidoId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Reanudar un partido
     */
    reanudarPartido: async (partidoId) => {
        const { data, error } = await supabase
            .from('partidos')
            .update({
                estado: MATCH_STATUS.EN_JUEGO,
            })
            .eq('id', partidoId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Iniciar segundo tiempo
     */
    iniciarSegundoTiempo: async (partidoId) => {
        const { data, error } = await supabase
            .from('partidos')
            .update({
                estado: MATCH_STATUS.EN_JUEGO,
                tiempo_actual: 2,
                segundos_jugados: 0,
            })
            .eq('id', partidoId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Finalizar un partido
     */
    finalizarPartido: async (partidoId, segundosJugados) => {
        // Obtener datos del partido
        const { data: partido, error: fetchError } = await supabase
            .from('partidos')
            .select('equipo_local_id, equipo_visitante_id, goles_local, goles_visitante')
            .eq('id', partidoId)
            .single();

        if (fetchError) throw fetchError;

        // Actualizar estado del partido
        const { data, error } = await supabase
            .from('partidos')
            .update({
                estado: MATCH_STATUS.FINALIZADO,
                segundos_jugados: segundosJugados,
            })
            .eq('id', partidoId)
            .select()
            .single();

        if (error) throw error;

        // Actualizar estadísticas de equipos
        await supabase.rpc('actualizar_estadisticas_equipo', {
            p_equipo_id: partido.equipo_local_id,
            p_goles_favor: partido.goles_local,
            p_goles_contra: partido.goles_visitante,
        });

        await supabase.rpc('actualizar_estadisticas_equipo', {
            p_equipo_id: partido.equipo_visitante_id,
            p_goles_favor: partido.goles_visitante,
            p_goles_contra: partido.goles_local,
        });

        return data;
    },

    /**
     * Registrar un evento (gol, tarjeta, falta)
     */
    registrarEvento: async (eventoData) => {
        // Insertar sin join para evitar error de FK ambigua
        const { data, error } = await supabase
            .from('eventos_partido')
            .insert(eventoData)
            .select('*')
            .single();

        if (error) throw error;

        // Si es un gol, actualizar marcador del partido
        if ([EVENT_TYPES.GOL, EVENT_TYPES.GOL_PENAL].includes(eventoData.tipo)) {
            const { data: partido } = await supabase
                .from('partidos')
                .select('equipo_local_id, equipo_visitante_id, goles_local, goles_visitante')
                .eq('id', eventoData.partido_id)
                .single();

            if (partido) {
                const esLocal = eventoData.equipo_id === partido.equipo_local_id;
                await supabase
                    .from('partidos')
                    .update({
                        goles_local: esLocal ? partido.goles_local + 1 : partido.goles_local,
                        goles_visitante: !esLocal ? partido.goles_visitante + 1 : partido.goles_visitante,
                    })
                    .eq('id', eventoData.partido_id);

                // Actualizar goles_totales del jugador (goleadores)
                if (eventoData.jugador_id) {
                    const { data: jugador } = await supabase
                        .from('jugadores')
                        .select('goles_totales')
                        .eq('id', eventoData.jugador_id)
                        .single();

                    if (jugador) {
                        await supabase
                            .from('jugadores')
                            .update({ goles_totales: (jugador.goles_totales || 0) + 1 })
                            .eq('id', eventoData.jugador_id);
                    }
                }

                // Actualizar goles_contra del equipo rival (valla menos vencida)
                const equipoRivalId = esLocal ? partido.equipo_visitante_id : partido.equipo_local_id;
                const { data: equipoRival } = await supabase
                    .from('equipos')
                    .select('goles_contra')
                    .eq('id', equipoRivalId)
                    .single();

                if (equipoRival) {
                    await supabase
                        .from('equipos')
                        .update({ goles_contra: (equipoRival.goles_contra || 0) + 1 })
                        .eq('id', equipoRivalId);
                }
            }
        }

        // Si es autogol, actualizar marcador del equipo contrario
        if (eventoData.tipo === EVENT_TYPES.AUTOGOL) {
            const { data: partido } = await supabase
                .from('partidos')
                .select('equipo_local_id, equipo_visitante_id, goles_local, goles_visitante')
                .eq('id', eventoData.partido_id)
                .single();

            if (partido) {
                const esLocal = eventoData.equipo_id === partido.equipo_local_id;
                await supabase
                    .from('partidos')
                    .update({
                        // Autogol suma al equipo contrario
                        goles_local: !esLocal ? partido.goles_local + 1 : partido.goles_local,
                        goles_visitante: esLocal ? partido.goles_visitante + 1 : partido.goles_visitante,
                    })
                    .eq('id', eventoData.partido_id);

                // Actualizar goles_contra del equipo que hizo el autogol
                const { data: equipoAutogol } = await supabase
                    .from('equipos')
                    .select('goles_contra')
                    .eq('id', eventoData.equipo_id)
                    .single();

                if (equipoAutogol) {
                    await supabase
                        .from('equipos')
                        .update({ goles_contra: (equipoAutogol.goles_contra || 0) + 1 })
                        .eq('id', eventoData.equipo_id);
                }
            }
        }

        // Enviar notificaciones para goles (normal y autogol)
        if ([EVENT_TYPES.GOL, EVENT_TYPES.GOL_PENAL, EVENT_TYPES.AUTOGOL].includes(eventoData.tipo)) {
            try {
                // Obtener info del partido para la notificación
                const { data: partidoInfo } = await supabase
                    .from('partidos')
                    .select(`
                        equipo_local_id, equipo_visitante_id,
                        goles_local, goles_visitante,
                        equipo_local:equipos!equipo_local_id(nombre),
                        equipo_visitante:equipos!equipo_visitante_id(nombre)
                    `)
                    .eq('id', eventoData.partido_id)
                    .single();

                if (partidoInfo) {
                    const { data: jugadorInfo } = await supabase
                        .from('jugadores')
                        .select('nombre')
                        .eq('id', eventoData.jugador_id)
                        .single();

                    const { data: equipoInfo } = await supabase
                        .from('equipos')
                        .select('nombre')
                        .eq('id', eventoData.equipo_id)
                        .single();

                    const marcador = `${partidoInfo.goles_local} - ${partidoInfo.goles_visitante}`;
                    const equipoNombre = equipoInfo?.nombre || 'Equipo';
                    const jugadorNombre = jugadorInfo?.nombre || 'Jugador';

                    // Determinar el equipo rival
                    const equipoRivalId = eventoData.equipo_id === partidoInfo.equipo_local_id
                        ? partidoInfo.equipo_visitante_id
                        : partidoInfo.equipo_local_id;

                    await notificationService.notifyGoal(
                        eventoData.equipo_id,
                        equipoNombre,
                        eventoData.tipo === EVENT_TYPES.AUTOGOL ? `${jugadorNombre} (Autogol)` : jugadorNombre,
                        marcador,
                        equipoRivalId
                    );
                }
            } catch (notifError) {
                console.log('Error enviando notificación de gol:', notifError);
            }
        }

        return data;
    },

    /**
     * Obtener eventos de un partido
     */
    getEventosByPartido: async (partidoId) => {
        const { data, error } = await supabase
            .from('eventos_partido')
            .select(`
        *,
        jugador:jugadores(id, nombre, apellido, numero_camiseta),
        equipo:equipos(id, nombre, logo_url)
      `)
            .eq('partido_id', partidoId)
            .order('tiempo', { ascending: true })
            .order('minuto', { ascending: true })
            .order('segundo', { ascending: true });

        if (error) throw error;
        return data;
    },

    /**
     * Eliminar un evento
     */
    eliminarEvento: async (eventoId) => {
        // Primero obtener el evento para revertir cambios
        const { data: evento, error: fetchError } = await supabase
            .from('eventos_partido')
            .select('*')
            .eq('id', eventoId)
            .single();

        if (fetchError) throw fetchError;

        // Eliminar el evento
        const { error } = await supabase
            .from('eventos_partido')
            .delete()
            .eq('id', eventoId);

        if (error) throw error;

        // Revertir cambios en el marcador si era un gol
        if ([EVENT_TYPES.GOL, EVENT_TYPES.GOL_PENAL].includes(evento.tipo)) {
            const { data: partido } = await supabase
                .from('partidos')
                .select('equipo_local_id, equipo_visitante_id, goles_local, goles_visitante')
                .eq('id', evento.partido_id)
                .single();

            if (partido) {
                const esLocal = evento.equipo_id === partido.equipo_local_id;
                await supabase
                    .from('partidos')
                    .update({
                        goles_local: esLocal ? Math.max(0, partido.goles_local - 1) : partido.goles_local,
                        goles_visitante: !esLocal ? Math.max(0, partido.goles_visitante - 1) : partido.goles_visitante,
                    })
                    .eq('id', evento.partido_id);

                // Restar gol al jugador
                if (evento.jugador_id) {
                    const { data: jugador } = await supabase
                        .from('jugadores')
                        .select('goles_totales')
                        .eq('id', evento.jugador_id)
                        .single();

                    if (jugador) {
                        await supabase
                            .from('jugadores')
                            .update({ goles_totales: Math.max(0, (jugador.goles_totales || 0) - 1) })
                            .eq('id', evento.jugador_id);
                    }
                }

                // Restar gol en contra al equipo rival
                const equipoRivalId = esLocal ? partido.equipo_visitante_id : partido.equipo_local_id;
                const { data: equipoRival } = await supabase
                    .from('equipos')
                    .select('goles_contra')
                    .eq('id', equipoRivalId)
                    .single();

                if (equipoRival) {
                    await supabase
                        .from('equipos')
                        .update({ goles_contra: Math.max(0, (equipoRival.goles_contra || 0) - 1) })
                        .eq('id', equipoRivalId);
                }
            }
        }

        // Revertir cambios en el marcador si era un autogol (resta al equipo contrario)
        if (evento.tipo === EVENT_TYPES.AUTOGOL) {
            const { data: partido } = await supabase
                .from('partidos')
                .select('equipo_local_id, equipo_visitante_id, goles_local, goles_visitante')
                .eq('id', evento.partido_id)
                .single();

            if (partido) {
                const esLocal = evento.equipo_id === partido.equipo_local_id;
                // El autogol suma al equipo contrario, así que restamos al contrario
                await supabase
                    .from('partidos')
                    .update({
                        // Si el autogol fue del local, resta al visitante
                        goles_local: !esLocal ? Math.max(0, partido.goles_local - 1) : partido.goles_local,
                        goles_visitante: esLocal ? Math.max(0, partido.goles_visitante - 1) : partido.goles_visitante,
                    })
                    .eq('id', evento.partido_id);

                // Restar gol en contra al equipo que hizo el autogol
                const { data: equipoAutogol } = await supabase
                    .from('equipos')
                    .select('goles_contra')
                    .eq('id', evento.equipo_id)
                    .single();

                if (equipoAutogol) {
                    await supabase
                        .from('equipos')
                        .update({ goles_contra: Math.max(0, (equipoAutogol.goles_contra || 0) - 1) })
                        .eq('id', evento.equipo_id);
                }
            }
        }

        // Actualizar timestamp del partido para disparar realtime a todos los clientes
        await supabase
            .from('partidos')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', evento.partido_id);

        return true;
    },

    /**
     * Eliminar un partido
     */
    eliminarPartido: async (partidoId) => {
        const { error } = await supabase
            .from('partidos')
            .delete()
            .eq('id', partidoId);

        if (error) throw error;
        return true;
    },
};

export default partidoService;
