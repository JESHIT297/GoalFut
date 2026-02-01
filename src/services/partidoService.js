import { supabase } from '../config/supabase';
import { MATCH_STATUS, EVENT_TYPES } from '../utils/constants';
import notificationService from './notificationService';
import offlineMatchService from './offlineMatchService';
import * as syncService from './syncService';
import * as database from '../database/database';

/**
 * Servicio para gestión de partidos
 */
const partidoService = {
    /**
     * Obtener partidos de un torneo
     * NO cachea - solo torneos seguidos se cachean via auto-download
     */
    getPartidosByTorneo: async (torneoId, estado = null) => {
        try {
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
        } catch (error) {
            console.error('Error getting partidos online, trying cache:', error.message);
            // Offline: mostrar desde caché (solo si es torneo seguido)
            const allPartidos = await database.getAllRecords('partidos');
            return allPartidos.filter(p => p.torneo_id === torneoId);
        }
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
          jugadores:jugadores(id, nombre, apellido, numero_camiseta, posicion, activo, foto_url, es_capitan)
        ),
        equipo_visitante:equipos!equipo_visitante_id(
          id, nombre, nombre_corto, logo_url, color_principal,
          jugadores:jugadores(id, nombre, apellido, numero_camiseta, posicion, activo, foto_url, es_capitan)
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
     * Generar partidos para un nuevo equipo agregado a un torneo
     * Crea un partido contra cada equipo existente en el mismo grupo
     * @param {string} torneoId - ID del torneo
     * @param {string} nuevoEquipoId - ID del nuevo equipo
     * @param {string} grupo - Letra del grupo (A, B, C, etc.)
     * @returns {Promise<Array>} Partidos creados
     */
    generarPartidosParaNuevoEquipo: async (torneoId, nuevoEquipoId, grupo) => {
        // Obtener todos los equipos del mismo grupo excepto el nuevo
        const { data: equiposGrupo, error: eqError } = await supabase
            .from('equipos')
            .select('id, nombre')
            .eq('torneo_id', torneoId)
            .eq('grupo', grupo)
            .neq('id', nuevoEquipoId);

        if (eqError) throw eqError;

        if (!equiposGrupo || equiposGrupo.length === 0) {
            return []; // No hay otros equipos en el grupo
        }

        // Obtener la última jornada del torneo para continuar la numeración
        const { data: ultimoPartido } = await supabase
            .from('partidos')
            .select('jornada')
            .eq('torneo_id', torneoId)
            .order('jornada', { ascending: false })
            .limit(1)
            .single();

        const siguienteJornada = (ultimoPartido?.jornada || 0) + 1;

        // Obtener el último partido para calcular la próxima fecha
        const { data: ultimoPartidoFecha } = await supabase
            .from('partidos')
            .select('fecha, hora')
            .eq('torneo_id', torneoId)
            .order('fecha', { ascending: false })
            .order('hora', { ascending: false })
            .limit(1)
            .single();

        // Calcular fecha base (próximo sábado si no hay partidos previos)
        let fechaBase = new Date();
        if (ultimoPartidoFecha?.fecha) {
            fechaBase = new Date(ultimoPartidoFecha.fecha + 'T12:00:00');
            fechaBase.setDate(fechaBase.getDate() + 7); // Una semana después
        } else {
            // Encontrar próximo sábado
            while (fechaBase.getDay() !== 6) {
                fechaBase.setDate(fechaBase.getDate() + 1);
            }
        }

        // Formatear fecha local
        const formatLocalDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // Generar partidos: nuevo equipo vs cada equipo existente
        const partidos = equiposGrupo.map((equipo, index) => ({
            torneo_id: torneoId,
            equipo_local_id: index % 2 === 0 ? nuevoEquipoId : equipo.id,
            equipo_visitante_id: index % 2 === 0 ? equipo.id : nuevoEquipoId,
            fecha: formatLocalDate(new Date(fechaBase.getTime() + Math.floor(index / 4) * 7 * 24 * 60 * 60 * 1000)),
            hora: ['09:00', '10:30', '12:00', '14:00'][index % 4],
            jornada: siguienteJornada + Math.floor(index / 4),
            grupo: grupo,
            fase: 'grupos',
            estado: 'programado',
        }));

        // Insertar partidos
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
     * También cambia el estado del torneo a 'activo' si es el primer partido
     */
    iniciarPartido: async (partidoId) => {
        // Primero obtener el partido para saber el torneo_id
        const { data: partido, error: fetchError } = await supabase
            .from('partidos')
            .select('torneo_id')
            .eq('id', partidoId)
            .single();

        if (fetchError) throw fetchError;

        // Verificar si el torneo está en configuración o inscripción y cambiarlo a activo
        if (partido.torneo_id) {
            const { data: torneo } = await supabase
                .from('torneos')
                .select('estado')
                .eq('id', partido.torneo_id)
                .single();

            if (torneo && (torneo.estado === 'configuracion' || torneo.estado === 'inscripcion')) {
                await supabase
                    .from('torneos')
                    .update({ estado: 'activo' })
                    .eq('id', partido.torneo_id);
            }
        }

        // Iniciar el partido
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
     * Calcula nuevo tiempo_inicio_real basado en segundos ya jugados
     */
    reanudarPartido: async (partidoId, segundosJugados = 0) => {
        // Calcular nuevo tiempo_inicio_real: ahora menos los segundos ya jugados
        const nuevoTiempoInicio = new Date(Date.now() - (segundosJugados * 1000)).toISOString();

        const { data, error } = await supabase
            .from('partidos')
            .update({
                estado: MATCH_STATUS.EN_JUEGO,
                tiempo_inicio_real: nuevoTiempoInicio,
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
    iniciarSegundoTiempo: async (partidoId, segundosJugados = 0) => {
        // Calcular nuevo tiempo_inicio_real para segundo tiempo
        const nuevoTiempoInicio = new Date(Date.now() - (segundosJugados * 1000)).toISOString();

        const { data, error } = await supabase
            .from('partidos')
            .update({
                estado: MATCH_STATUS.EN_JUEGO,
                tiempo_actual: 2,
                segundos_jugados: segundosJugados,
                tiempo_inicio_real: nuevoTiempoInicio,
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
        // Obtener datos del partido incluyendo la fase
        const { data: partido, error: fetchError } = await supabase
            .from('partidos')
            .select('equipo_local_id, equipo_visitante_id, goles_local, goles_visitante, fase')
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

        // Solo actualizar estadísticas de tabla para fase de grupos
        if (partido.fase === 'grupos') {
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
        }

        return data;
    },

    /**
     * Finalizar partido de eliminación con penales
     * @param {string} partidoId - ID del partido
     * @param {number} segundosJugados - Segundos jugados
     * @param {number} penalesLocal - Goles de penal del equipo local
     * @param {number} penalesVisitante - Goles de penal del equipo visitante
     */
    finalizarConPenales: async (partidoId, segundosJugados, penalesLocal, penalesVisitante) => {
        const { data, error } = await supabase
            .from('partidos')
            .update({
                estado: MATCH_STATUS.FINALIZADO,
                segundos_jugados: segundosJugados,
                penales_local: penalesLocal,
                penales_visitante: penalesVisitante,
            })
            .eq('id', partidoId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Registrar un evento (gol, tarjeta, falta) - con soporte offline
     */
    registrarEvento: async (eventoData) => {
        // Check if online
        const online = await syncService.isOnline();

        if (!online) {
            // Save event offline for later sync
            const offlineEvent = {
                ...eventoData,
                id: `offline_${Date.now()}`,
                offline: true,
                created_at: new Date().toISOString()
            };
            await offlineMatchService.saveEventOffline(offlineEvent);
            console.log('Evento guardado offline:', offlineEvent.id);
            return offlineEvent;
        }

        // Online: normal flow
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

                // NOTA: goles_totales del jugador se actualiza automáticamente por trigger en la BD
                // NOTA: goles_contra se actualiza al finalizar el partido via RPC actualizar_estadisticas_equipo
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

                // NOTA: goles_contra se actualiza al finalizar el partido via RPC
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
     * NO cachea - auto-download lo hace
     */
    getEventosByPartido: async (partidoId) => {
        try {
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
        } catch (error) {
            console.log('Error getting eventos online, trying cache:', error.message);
            // Offline: mostrar desde caché
            const allEventos = await database.getAllRecords('eventos_partido');
            const eventos = allEventos.filter(e => e.partido_id === partidoId);

            const jugadores = await database.getAllRecords('jugadores');
            const equipos = await database.getAllRecords('equipos');

            return eventos.map(e => ({
                ...e,
                jugador: jugadores.find(j => j.id === e.jugador_id) || null,
                equipo: equipos.find(eq => eq.id === e.equipo_id) || null
            })).sort((a, b) => {
                if (a.tiempo !== b.tiempo) return a.tiempo - b.tiempo;
                if (a.minuto !== b.minuto) return a.minuto - b.minuto;
                return (a.segundo || 0) - (b.segundo || 0);
            });
        }
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

                // NOTA: goles_contra se calcula al finalizar el partido via RPC
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

                // NOTA: goles_contra se calcula al finalizar el partido via RPC
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
     * Eliminar un partido y revertir todas las estadísticas
     * - Elimina todos los eventos del partido
     * - Revierte los goles de los jugadores (tabla de goleadores)
     * - Revierte goles en contra de equipos (valla menos vencida)
     */
    eliminarPartido: async (partidoId) => {
        // 1. Obtener todos los eventos del partido
        const { data: eventos, error: eventosError } = await supabase
            .from('eventos_partido')
            .select('*')
            .eq('partido_id', partidoId);

        if (eventosError) throw eventosError;

        // 2. Obtener datos del partido
        const { data: partido, error: partidoError } = await supabase
            .from('partidos')
            .select('equipo_local_id, equipo_visitante_id, goles_local, goles_visitante, fase')
            .eq('id', partidoId)
            .single();

        if (partidoError) throw partidoError;

        // 3. Revertir goles de jugadores para cada evento de gol
        if (eventos && eventos.length > 0) {
            for (const evento of eventos) {
                if ([EVENT_TYPES.GOL, EVENT_TYPES.GOL_PENAL].includes(evento.tipo) && evento.jugador_id) {
                    // Restar gol al jugador
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
            }

            // 4. Eliminar todos los eventos del partido
            const { error: deleteEventosError } = await supabase
                .from('eventos_partido')
                .delete()
                .eq('partido_id', partidoId);

            if (deleteEventosError) throw deleteEventosError;
        }

        // 5. Revertir goles_contra de equipos (valla menos vencida)
        // Si el partido tiene goles registrados, restarlos del goles_contra del equipo contrario
        if (partido.goles_local > 0 || partido.goles_visitante > 0) {
            // Restar goles_contra del equipo local (goles que recibió = goles_visitante)
            if (partido.goles_visitante > 0) {
                const { data: equipoLocal } = await supabase
                    .from('equipos')
                    .select('goles_contra')
                    .eq('id', partido.equipo_local_id)
                    .single();

                if (equipoLocal) {
                    await supabase
                        .from('equipos')
                        .update({
                            goles_contra: Math.max(0, (equipoLocal.goles_contra || 0) - partido.goles_visitante)
                        })
                        .eq('id', partido.equipo_local_id);
                }
            }

            // Restar goles_contra del equipo visitante (goles que recibió = goles_local)
            if (partido.goles_local > 0) {
                const { data: equipoVisitante } = await supabase
                    .from('equipos')
                    .select('goles_contra')
                    .eq('id', partido.equipo_visitante_id)
                    .single();

                if (equipoVisitante) {
                    await supabase
                        .from('equipos')
                        .update({
                            goles_contra: Math.max(0, (equipoVisitante.goles_contra || 0) - partido.goles_local)
                        })
                        .eq('id', partido.equipo_visitante_id);
                }
            }
        }

        // 6. Eliminar el partido
        const { error } = await supabase
            .from('partidos')
            .delete()
            .eq('id', partidoId);

        if (error) throw error;
        return true;
    },
};

export default partidoService;
