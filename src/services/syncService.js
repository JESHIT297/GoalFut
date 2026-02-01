// Sync Service for GoalFut
// Handles synchronization between local storage and remote Supabase

import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../config/supabase';
import * as database from '../database/database';

// Mapping of local tables to Supabase tables
const TABLE_MAPPING = {
    torneos: 'torneos',
    equipos: 'equipos',
    jugadores: 'jugadores',
    partidos: 'partidos',
    torneos_seguidos: 'torneos_seguidos'
};

// Check if online
export const isOnline = async () => {
    try {
        const state = await NetInfo.fetch();
        // isInternetReachable can be null initially, treat null as online to allow initial fetch
        const isReachable = state.isInternetReachable === null ? true : state.isInternetReachable;
        const result = state.isConnected && isReachable;
        console.log(`Network check: connected=${state.isConnected}, reachable=${state.isInternetReachable}, result=${result}`);
        return result;
    } catch (error) {
        console.error('Error checking network status:', error);
        return true; // Assume online if check fails, let actual request determine
    }
};

// Sync all pending operations to Supabase
export const syncPendingOperations = async () => {
    const online = await isOnline();
    if (!online) {
        console.log('Offline - skipping sync');
        return { success: false, message: 'Sin conexión a internet' };
    }

    try {
        const pendingOps = await database.getPendingSyncOperations();
        console.log(`Found ${pendingOps.length} pending operations`);

        let successCount = 0;
        let errorCount = 0;

        for (const op of pendingOps) {
            try {
                const success = await executeSyncOperation(op);
                if (success) {
                    await database.removeFromSyncQueue(op.id);
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                console.error(`Error syncing operation ${op.id}:`, error);
                await database.updateSyncQueueError(op.id, error.message);
                errorCount++;
            }
        }

        return {
            success: true,
            synced: successCount,
            errors: errorCount,
            message: `Sincronizados: ${successCount}, Errores: ${errorCount}`
        };
    } catch (error) {
        console.error('Error during sync:', error);
        return { success: false, message: error.message };
    }
};

// Execute a single sync operation
const executeSyncOperation = async (op) => {
    const { table_name, operation, record_id, data } = op;
    const parsedData = data ? JSON.parse(data) : null;
    const supabaseTable = TABLE_MAPPING[table_name];

    if (!supabaseTable) {
        console.error(`Unknown table: ${table_name}`);
        return false;
    }

    // Remove local-only fields before syncing
    if (parsedData) {
        delete parsedData.synced;
        delete parsedData.updated_at;
    }

    switch (operation) {
        case 'INSERT':
        case 'UPDATE':
            const { error: upsertError } = await supabase
                .from(supabaseTable)
                .upsert(parsedData, { onConflict: 'id' });
            if (upsertError) throw upsertError;
            break;

        case 'DELETE':
            const { error: deleteError } = await supabase
                .from(supabaseTable)
                .delete()
                .eq('id', record_id);
            if (deleteError) throw deleteError;
            break;

        default:
            console.error(`Unknown operation: ${operation}`);
            return false;
    }

    // Mark local record as synced
    await database.markAsSynced(table_name, record_id);
    return true;
};

// Fetch data from Supabase and store locally
export const fetchAndStoreLocally = async (tableName, query = {}) => {
    const online = await isOnline();
    if (!online) {
        console.log('Offline - returning local data only');
        return null;
    }

    try {
        const supabaseTable = TABLE_MAPPING[tableName];
        if (!supabaseTable) {
            throw new Error(`Unknown table: ${tableName}`);
        }

        let queryBuilder = supabase.from(supabaseTable).select(query.select || '*');

        // Apply filters if provided
        if (query.eq) {
            for (const [column, value] of Object.entries(query.eq)) {
                queryBuilder = queryBuilder.eq(column, value);
            }
        }

        if (query.order) {
            queryBuilder = queryBuilder.order(query.order.column, { ascending: query.order.ascending ?? true });
        }

        const { data, error } = await queryBuilder;

        if (error) throw error;

        // Store fetched data locally
        if (data && data.length > 0) {
            for (const record of data) {
                await database.insertRecord(tableName, { ...record, synced: 1 });
            }
            console.log(`Stored ${data.length} records in ${tableName}`);
        }

        return data;
    } catch (error) {
        console.error(`Error fetching ${tableName}:`, error);
        return null;
    }
};

// Get data - tries remote first, falls back to local
export const getData = async (tableName, query = {}) => {
    const online = await isOnline();

    if (online) {
        // Try to fetch from remote and update local
        const remoteData = await fetchAndStoreLocally(tableName, query);
        if (remoteData) {
            return { data: remoteData, source: 'remote' };
        }
    }

    // Fall back to local data
    let whereClause = '';
    const params = [];

    if (query.eq) {
        const conditions = Object.entries(query.eq).map(([column, value]) => {
            params.push(value);
            return `${column} = ?`;
        });
        whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const localData = await database.getAllRecords(tableName, whereClause, params);
    return { data: localData, source: 'local' };
};

// Save data - saves locally and queues for sync
export const saveData = async (tableName, data, operation = 'INSERT') => {
    try {
        const online = await isOnline();

        // Always save locally first
        if (operation === 'DELETE') {
            await database.deleteRecord(tableName, data.id);
        } else {
            await database.insertRecord(tableName, { ...data, synced: online ? 1 : 0 });
        }

        if (online) {
            // Try to sync immediately
            try {
                const supabaseTable = TABLE_MAPPING[tableName];
                if (operation === 'DELETE') {
                    const { error } = await supabase
                        .from(supabaseTable)
                        .delete()
                        .eq('id', data.id);
                    if (error) throw error;
                } else {
                    const cleanData = { ...data };
                    delete cleanData.synced;
                    delete cleanData.updated_at;

                    const { error } = await supabase
                        .from(supabaseTable)
                        .upsert(cleanData, { onConflict: 'id' });
                    if (error) throw error;
                }
                await database.markAsSynced(tableName, data.id);
            } catch (syncError) {
                console.error('Immediate sync failed, queuing:', syncError);
                await database.addToSyncQueue(tableName, operation, data.id, data);
            }
        } else {
            // Queue for later sync
            await database.addToSyncQueue(tableName, operation, data.id, data);
        }

        return { success: true, synced: online };
    } catch (error) {
        console.error(`Error saving data to ${tableName}:`, error);
        return { success: false, error: error.message };
    }
};

// Initialize sync - subscribe to network changes
export const initSync = (onSyncComplete) => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
        if (state.isConnected && state.isInternetReachable) {
            console.log('Network connected - starting sync');
            const result = await syncPendingOperations();
            if (onSyncComplete) {
                onSyncComplete(result);
            }
        }
    });

    return unsubscribe;
};

// Get sync status
export const getSyncStatus = async () => {
    const pendingOps = await database.getPendingSyncOperations();
    const online = await isOnline();

    return {
        online,
        pendingOperations: pendingOps.length,
        hasPendingChanges: pendingOps.length > 0
    };
};

// Download all data for a user (called on login and on reconnect)
export const downloadAllUserData = async (userId, isAdmin = false) => {
    const online = await isOnline();
    if (!online) {
        console.log('Offline - cannot download user data');
        return { success: false, message: 'Sin conexión' };
    }

    console.log('Starting full data download for user:', userId);
    let downloaded = 0;

    // Helper to clean object for storage (remove nested objects)
    const cleanForStorage = (obj, extraFields = {}) => {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip nested objects and arrays (except simple values)
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                continue;
            }
            if (Array.isArray(value)) {
                continue;
            }
            cleaned[key] = value;
        }
        return { ...cleaned, ...extraFields };
    };

    try {
        // 1. Download followed tournaments
        console.log('Downloading followed tournaments...');
        const { data: seguidos, error: seguidosError } = await supabase
            .from('torneos_seguidos')
            .select(`
                *,
                torneo:torneos(
                    *,
                    equipos:equipos(*)
                )
            `)
            .eq('usuario_id', userId);

        if (seguidosError) {
            console.error('Error fetching seguidos:', seguidosError);
        }

        if (seguidos && seguidos.length > 0) {
            console.log(`Found ${seguidos.length} followed tournaments`);

            for (const seguido of seguidos) {
                // Cache the seguido record
                await database.insertRecord('torneos_seguidos', {
                    id: seguido.id,
                    user_id: userId,
                    torneo_id: seguido.torneo_id,
                    synced: 1
                });

                // Cache the tournament (cleaned)
                if (seguido.torneo) {
                    const torneoClean = cleanForStorage(seguido.torneo, { synced: 1 });
                    await database.insertRecord('torneos', torneoClean);
                    downloaded++;
                    console.log(`Cached torneo: ${seguido.torneo.nombre}`);

                    // Cache all equipos of this tournament
                    if (seguido.torneo.equipos && seguido.torneo.equipos.length > 0) {
                        for (const equipo of seguido.torneo.equipos) {
                            const equipoClean = cleanForStorage(equipo, {
                                torneo_id: seguido.torneo_id,
                                synced: 1
                            });
                            await database.insertRecord('equipos', equipoClean);
                            downloaded++;
                        }
                        console.log(`Cached ${seguido.torneo.equipos.length} equipos`);
                    }

                    // Download partidos for this tournament
                    const { data: partidos } = await supabase
                        .from('partidos')
                        .select('*')
                        .eq('torneo_id', seguido.torneo_id);

                    if (partidos && partidos.length > 0) {
                        for (const partido of partidos) {
                            await database.insertRecord('partidos', { ...partido, synced: 1 });
                            downloaded++;

                            // Download eventos for each partido
                            const { data: eventos } = await supabase
                                .from('eventos_partido')
                                .select('*')
                                .eq('partido_id', partido.id);

                            if (eventos && eventos.length > 0) {
                                for (const evento of eventos) {
                                    await database.insertRecord('eventos_partido', { ...evento, synced: 1 });
                                    downloaded++;
                                }
                            }
                        }
                        console.log(`Cached ${partidos.length} partidos with events`);
                    }

                    // Download jugadores for each equipo
                    if (seguido.torneo.equipos) {
                        for (const equipo of seguido.torneo.equipos) {
                            const { data: jugadores } = await supabase
                                .from('jugadores')
                                .select('*')
                                .eq('equipo_id', equipo.id);

                            if (jugadores && jugadores.length > 0) {
                                for (const jugador of jugadores) {
                                    await database.insertRecord('jugadores', { ...jugador, synced: 1 });
                                    downloaded++;
                                }
                            }
                        }
                    }
                }
            }
        } else {
            console.log('No followed tournaments found');
        }

        // 2. If admin, also download admin's tournaments
        if (isAdmin) {
            console.log('Downloading admin tournaments...');
            const { data: adminTorneos, error: adminError } = await supabase
                .from('torneos')
                .select(`
                    *,
                    equipos:equipos(*)
                `)
                .eq('admin_id', userId);

            if (adminError) {
                console.error('Error fetching admin torneos:', adminError);
            }

            if (adminTorneos && adminTorneos.length > 0) {
                console.log(`Found ${adminTorneos.length} admin tournaments`);

                for (const torneo of adminTorneos) {
                    const torneoClean = cleanForStorage(torneo, { synced: 1 });
                    await database.insertRecord('torneos', torneoClean);
                    downloaded++;

                    if (torneo.equipos) {
                        for (const equipo of torneo.equipos) {
                            const equipoClean = cleanForStorage(equipo, {
                                torneo_id: torneo.id,
                                synced: 1
                            });
                            await database.insertRecord('equipos', equipoClean);
                            downloaded++;
                        }
                    }

                    // Download partidos
                    const { data: partidos } = await supabase
                        .from('partidos')
                        .select('*')
                        .eq('torneo_id', torneo.id);

                    if (partidos) {
                        for (const partido of partidos) {
                            await database.insertRecord('partidos', { ...partido, synced: 1 });
                            downloaded++;
                        }
                    }

                    // Download jugadores for each equipo
                    if (torneo.equipos) {
                        for (const equipo of torneo.equipos) {
                            const { data: jugadores } = await supabase
                                .from('jugadores')
                                .select('*')
                                .eq('equipo_id', equipo.id);

                            if (jugadores) {
                                for (const jugador of jugadores) {
                                    await database.insertRecord('jugadores', { ...jugador, synced: 1 });
                                    downloaded++;
                                }
                            }
                        }
                    }
                }
            }
        }

        console.log(`✅ Total items downloaded and cached: ${downloaded}`);
        return { success: true, downloaded, message: `Descargados ${downloaded} items` };
    } catch (error) {
        console.error('❌ Error downloading user data:', error);
        return { success: false, message: error.message };
    }
};

// Full sync - upload pending + download fresh data
export const fullSync = async (userId, isAdmin = false) => {
    console.log('Starting full sync...');

    // First, upload any pending changes
    const uploadResult = await syncPendingOperations();
    console.log('Upload result:', uploadResult);

    // Then download fresh data
    const downloadResult = await downloadAllUserData(userId, isAdmin);
    console.log('Download result:', downloadResult);

    return {
        upload: uploadResult,
        download: downloadResult
    };
};
