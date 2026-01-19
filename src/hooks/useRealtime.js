import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase';

/**
 * Hook para suscribirse a cambios en tiempo real de una tabla
 * @param {string} table - Nombre de la tabla
 * @param {Function} onUpdate - Callback cuando hay cambios
 * @param {Object} filter - Filtro opcional (ej: { column: 'torneo_id', value: '123' })
 */
export const useRealtimeSubscription = (table, onUpdate, filter = null) => {
    const channelRef = useRef(null);
    const onUpdateRef = useRef(onUpdate);

    // Mantener ref actualizada
    useEffect(() => {
        onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        if (!table) return;

        // Crear canal único
        const channelName = filter
            ? `${table}-${filter.column}-${filter.value}-${Date.now()}`
            : `${table}-all-${Date.now()}`;

        console.log(`Subscribing to realtime: ${channelName}`);

        let channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: table,
                    ...(filter && { filter: `${filter.column}=eq.${filter.value}` })
                },
                (payload) => {
                    console.log(`Realtime update on ${table}:`, payload.eventType, payload);
                    if (onUpdateRef.current) {
                        onUpdateRef.current(payload);
                    }
                }
            )
            .subscribe((status) => {
                console.log(`Realtime subscription status for ${table}:`, status);
            });

        channelRef.current = channel;

        // Cleanup al desmontar
        return () => {
            console.log(`Unsubscribing from: ${channelName}`);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [table, filter?.column, filter?.value]);

    return channelRef.current;
};

/**
 * Hook para suscribirse a cambios de partidos en tiempo real
 * @param {string} torneoId - ID del torneo (opcional)
 * @param {Function} onPartidoUpdate - Callback cuando un partido cambia
 */
export const usePartidosRealtime = (torneoId, onPartidoUpdate) => {
    return useRealtimeSubscription(
        'partidos',
        onPartidoUpdate,
        torneoId ? { column: 'torneo_id', value: torneoId } : null
    );
};

/**
 * Hook para suscribirse a eventos de un partido en tiempo real
 * @param {string} partidoId - ID del partido
 * @param {Function} onEventoUpdate - Callback cuando hay un nuevo evento
 */
export const useEventosRealtime = (partidoId, onEventoUpdate) => {
    return useRealtimeSubscription(
        'eventos_partido',
        onEventoUpdate,
        { column: 'partido_id', value: partidoId }
    );
};

export default useRealtimeSubscription;
