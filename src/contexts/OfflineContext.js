import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../config/supabase';
import { CACHE_KEYS } from '../utils/constants';
import { generateSyncId } from '../utils/helpers';

const OfflineContext = createContext({});

export const OfflineProvider = ({ children }) => {
    const [isOnline, setIsOnline] = useState(true);
    const [syncQueue, setSyncQueue] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);

    useEffect(() => {
        // Cargar cola de sincronización
        loadSyncQueue();
        loadLastSyncTime();

        // Suscribirse a cambios de conectividad
        const unsubscribe = NetInfo.addEventListener(state => {
            const online = state.isConnected && state.isInternetReachable;
            setIsOnline(online);

            // Sincronizar cuando vuelva la conexión
            if (online) {
                processSyncQueue();
            }
        });

        return () => unsubscribe();
    }, []);

    const loadSyncQueue = async () => {
        try {
            const queue = await AsyncStorage.getItem(CACHE_KEYS.SYNC_QUEUE);
            if (queue) {
                setSyncQueue(JSON.parse(queue));
            }
        } catch (error) {
            console.error('Error loading sync queue:', error);
        }
    };

    const loadLastSyncTime = async () => {
        try {
            const time = await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
            if (time) {
                setLastSyncTime(new Date(time));
            }
        } catch (error) {
            console.error('Error loading last sync time:', error);
        }
    };

    const saveSyncQueue = async (queue) => {
        try {
            await AsyncStorage.setItem(CACHE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
            setSyncQueue(queue);
        } catch (error) {
            console.error('Error saving sync queue:', error);
        }
    };

    /**
     * Agregar una operación a la cola de sincronización
     */
    const addToSyncQueue = async (operation) => {
        const syncItem = {
            id: generateSyncId(),
            ...operation,
            createdAt: new Date().toISOString(),
            attempts: 0,
        };

        const newQueue = [...syncQueue, syncItem];
        await saveSyncQueue(newQueue);
        return syncItem.id;
    };

    /**
     * Procesar la cola de sincronización
     */
    const processSyncQueue = async () => {
        if (isSyncing || syncQueue.length === 0 || !isOnline) return;

        setIsSyncing(true);

        try {
            const failedItems = [];

            for (const item of syncQueue) {
                try {
                    await processQueueItem(item);
                } catch (error) {
                    console.error('Error processing queue item:', error);
                    // Incrementar intentos y mantener en cola si aún no excede el máximo
                    if (item.attempts < 3) {
                        failedItems.push({ ...item, attempts: item.attempts + 1 });
                    }
                }
            }

            // Actualizar cola con items fallidos
            await saveSyncQueue(failedItems);

            // Actualizar tiempo de última sincronización
            const now = new Date();
            await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, now.toISOString());
            setLastSyncTime(now);
        } catch (error) {
            console.error('Error processing sync queue:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    /**
     * Procesar un item individual de la cola
     */
    const processQueueItem = async (item) => {
        const { table, operation, data, localId } = item;

        switch (operation) {
            case 'INSERT':
                const { data: insertedData, error: insertError } = await supabase
                    .from(table)
                    .insert(data)
                    .select()
                    .single();

                if (insertError) throw insertError;

                // Actualizar referencia local con ID del servidor
                if (localId) {
                    await updateLocalReference(table, localId, insertedData.id);
                }
                break;

            case 'UPDATE':
                const { error: updateError } = await supabase
                    .from(table)
                    .update(data)
                    .eq('id', data.id);

                if (updateError) throw updateError;
                break;

            case 'DELETE':
                const { error: deleteError } = await supabase
                    .from(table)
                    .delete()
                    .eq('id', data.id);

                if (deleteError) throw deleteError;
                break;

            default:
                console.warn('Unknown operation:', operation);
        }
    };

    /**
     * Actualizar referencia local después de sincronizar
     */
    const updateLocalReference = async (table, localId, serverId) => {
        // Implementar según necesidad específica
        console.log(`Updated ${table} local ID ${localId} to server ID ${serverId}`);
    };

    /**
     * Guardar datos en caché
     */
    const cacheData = async (key, data) => {
        try {
            const cacheItem = {
                data,
                cachedAt: new Date().toISOString(),
            };
            await AsyncStorage.setItem(key, JSON.stringify(cacheItem));
        } catch (error) {
            console.error('Error caching data:', error);
        }
    };

    /**
     * Obtener datos de caché
     */
    const getCachedData = async (key, maxAgeMs = null) => {
        try {
            const cached = await AsyncStorage.getItem(key);
            if (!cached) return null;

            const { data, cachedAt } = JSON.parse(cached);

            // Verificar si los datos han expirado
            if (maxAgeMs) {
                const age = Date.now() - new Date(cachedAt).getTime();
                if (age > maxAgeMs) {
                    return null;
                }
            }

            return data;
        } catch (error) {
            console.error('Error getting cached data:', error);
            return null;
        }
    };

    /**
     * Limpiar caché
     */
    const clearCache = async () => {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const goalfutKeys = keys.filter(key => key.startsWith('@goalfut_'));
            await AsyncStorage.multiRemove(goalfutKeys);
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    };

    const value = {
        isOnline,
        isSyncing,
        syncQueue,
        lastSyncTime,
        pendingSyncCount: syncQueue.length,
        hasOnlineChanges: syncQueue.length > 0,
        addToSyncQueue,
        processSyncQueue,
        cacheData,
        getCachedData,
        clearCache,
    };

    return (
        <OfflineContext.Provider value={value}>
            {children}
        </OfflineContext.Provider>
    );
};

export const useOffline = () => {
    const context = useContext(OfflineContext);
    if (!context) {
        throw new Error('useOffline must be used within an OfflineProvider');
    }
    return context;
};

export default OfflineContext;
