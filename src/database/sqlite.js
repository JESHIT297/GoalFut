import * as SQLite from 'expo-sqlite';

// Database instance
let db = null;

/**
 * Initialize the SQLite database
 * Creates all necessary tables if they don't exist
 */
export const initDatabase = async () => {
    if (db) return db;

    db = await SQLite.openDatabaseAsync('goalfut.db');

    // Create tables
    await db.execAsync(`
        -- Torneos table
        CREATE TABLE IF NOT EXISTS torneos (
            id TEXT PRIMARY KEY,
            nombre TEXT,
            descripcion TEXT,
            estado TEXT,
            fecha_inicio TEXT,
            fecha_fin TEXT,
            logo_url TEXT,
            imagen_url TEXT,
            lugar TEXT,
            admin_id TEXT,
            max_jugadores INTEGER,
            duracion_tiempo INTEGER,
            synced INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Equipos table
        CREATE TABLE IF NOT EXISTS equipos (
            id TEXT PRIMARY KEY,
            torneo_id TEXT,
            nombre TEXT,
            nombre_corto TEXT,
            logo_url TEXT,
            color_principal TEXT,
            puntos INTEGER DEFAULT 0,
            partidos_jugados INTEGER DEFAULT 0,
            partidos_ganados INTEGER DEFAULT 0,
            partidos_empatados INTEGER DEFAULT 0,
            partidos_perdidos INTEGER DEFAULT 0,
            goles_favor INTEGER DEFAULT 0,
            goles_contra INTEGER DEFAULT 0,
            diferencia_gol INTEGER DEFAULT 0,
            grupo TEXT,
            synced INTEGER DEFAULT 1,
            FOREIGN KEY (torneo_id) REFERENCES torneos(id)
        );
        
        -- Jugadores table
        CREATE TABLE IF NOT EXISTS jugadores (
            id TEXT PRIMARY KEY,
            equipo_id TEXT,
            nombre TEXT,
            apellido TEXT,
            numero_camiseta INTEGER,
            posicion TEXT,
            foto_url TEXT,
            goles_totales INTEGER DEFAULT 0,
            tarjetas_amarillas INTEGER DEFAULT 0,
            tarjetas_rojas INTEGER DEFAULT 0,
            activo INTEGER DEFAULT 1,
            synced INTEGER DEFAULT 1,
            FOREIGN KEY (equipo_id) REFERENCES equipos(id)
        );
        
        -- Partidos table
        CREATE TABLE IF NOT EXISTS partidos (
            id TEXT PRIMARY KEY,
            torneo_id TEXT,
            equipo_local_id TEXT,
            equipo_visitante_id TEXT,
            fecha TEXT,
            hora TEXT,
            estado TEXT,
            goles_local INTEGER DEFAULT 0,
            goles_visitante INTEGER DEFAULT 0,
            tiempo_actual TEXT,
            minuto_actual INTEGER DEFAULT 0,
            synced INTEGER DEFAULT 1,
            FOREIGN KEY (torneo_id) REFERENCES torneos(id),
            FOREIGN KEY (equipo_local_id) REFERENCES equipos(id),
            FOREIGN KEY (equipo_visitante_id) REFERENCES equipos(id)
        );
        
        -- Eventos de partido table
        CREATE TABLE IF NOT EXISTS eventos_partido (
            id TEXT PRIMARY KEY,
            partido_id TEXT,
            tipo TEXT,
            minuto INTEGER,
            segundo INTEGER,
            tiempo TEXT,
            jugador_id TEXT,
            equipo_id TEXT,
            descripcion TEXT,
            synced INTEGER DEFAULT 1,
            FOREIGN KEY (partido_id) REFERENCES partidos(id),
            FOREIGN KEY (jugador_id) REFERENCES jugadores(id),
            FOREIGN KEY (equipo_id) REFERENCES equipos(id)
        );
        
        -- Torneos seguidos table
        CREATE TABLE IF NOT EXISTS torneos_seguidos (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            torneo_id TEXT,
            notificaciones_activas INTEGER DEFAULT 1,
            synced INTEGER DEFAULT 1,
            FOREIGN KEY (torneo_id) REFERENCES torneos(id)
        );
        
        -- Sync queue table (for offline operations)
        CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT,
            operation TEXT,
            record_id TEXT,
            data TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            attempts INTEGER DEFAULT 0
        );
    `);

    console.log('SQLite database initialized');
    return db;
};

/**
 * Get the database instance (initializes if needed)
 */
export const getDatabase = async () => {
    if (!db) {
        await initDatabase();
    }
    return db;
};

/**
 * Insert or replace a record in a table
 */
export const upsertRecord = async (tableName, record) => {
    const db = await getDatabase();
    const columns = Object.keys(record);
    const values = Object.values(record);
    const placeholders = columns.map(() => '?').join(', ');

    const query = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    try {
        await db.runAsync(query, values);
        return true;
    } catch (error) {
        console.error(`Error upserting into ${tableName}:`, error);
        throw error;
    }
};

/**
 * Get all records from a table
 */
export const getAllRecords = async (tableName) => {
    const db = await getDatabase();
    try {
        const result = await db.getAllAsync(`SELECT * FROM ${tableName}`);
        return result || [];
    } catch (error) {
        console.error(`Error getting records from ${tableName}:`, error);
        return [];
    }
};

/**
 * Get a record by ID
 */
export const getRecordById = async (tableName, id) => {
    const db = await getDatabase();
    try {
        const result = await db.getFirstAsync(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
        return result || null;
    } catch (error) {
        console.error(`Error getting record from ${tableName}:`, error);
        return null;
    }
};

/**
 * Get records with a WHERE clause
 */
export const getRecordsWhere = async (tableName, whereClause, params = []) => {
    const db = await getDatabase();
    try {
        const result = await db.getAllAsync(`SELECT * FROM ${tableName} WHERE ${whereClause}`, params);
        return result || [];
    } catch (error) {
        console.error(`Error getting records from ${tableName}:`, error);
        return [];
    }
};

/**
 * Delete a record by ID
 */
export const deleteRecord = async (tableName, id) => {
    const db = await getDatabase();
    try {
        await db.runAsync(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
        return true;
    } catch (error) {
        console.error(`Error deleting from ${tableName}:`, error);
        return false;
    }
};

/**
 * Delete all records from a table
 */
export const clearTable = async (tableName) => {
    const db = await getDatabase();
    try {
        await db.runAsync(`DELETE FROM ${tableName}`);
        return true;
    } catch (error) {
        console.error(`Error clearing ${tableName}:`, error);
        return false;
    }
};

/**
 * Add an operation to the sync queue
 */
export const addToSyncQueue = async (tableName, operation, recordId, data) => {
    const db = await getDatabase();
    try {
        await db.runAsync(
            `INSERT INTO sync_queue (table_name, operation, record_id, data) VALUES (?, ?, ?, ?)`,
            [tableName, operation, recordId, JSON.stringify(data)]
        );
        return true;
    } catch (error) {
        console.error('Error adding to sync queue:', error);
        return false;
    }
};

/**
 * Get all pending sync operations
 */
export const getPendingSyncOperations = async () => {
    const db = await getDatabase();
    try {
        const result = await db.getAllAsync(`SELECT * FROM sync_queue ORDER BY created_at ASC`);
        return (result || []).map(row => ({
            ...row,
            data: JSON.parse(row.data || '{}')
        }));
    } catch (error) {
        console.error('Error getting sync queue:', error);
        return [];
    }
};

/**
 * Remove a sync operation after it's been processed
 */
export const removeSyncOperation = async (id) => {
    const db = await getDatabase();
    try {
        await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
        return true;
    } catch (error) {
        console.error('Error removing sync operation:', error);
        return false;
    }
};

/**
 * Clear all data from all tables (for logout)
 */
export const clearAllData = async () => {
    const tables = ['eventos_partido', 'partidos', 'jugadores', 'equipos', 'torneos_seguidos', 'torneos', 'sync_queue'];
    for (const table of tables) {
        await clearTable(table);
    }
    console.log('All SQLite data cleared');
};

// Alias for compatibility
export const insertRecord = upsertRecord;

/**
 * Mark a record as synced
 */
export const markAsSynced = async (tableName, recordId) => {
    const db = await getDatabase();
    try {
        await db.runAsync(`UPDATE ${tableName} SET synced = 1 WHERE id = ?`, [recordId]);
        return true;
    } catch (error) {
        console.error(`Error marking as synced in ${tableName}:`, error);
        return false;
    }
};

/**
 * Update sync queue error
 */
export const updateSyncQueueError = async (id, errorMessage) => {
    const db = await getDatabase();
    try {
        await db.runAsync(
            `UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?`,
            [id]
        );
        return true;
    } catch (error) {
        console.error('Error updating sync queue:', error);
        return false;
    }
};

/**
 * Alias for removeSyncOperation
 */
export const removeFromSyncQueue = removeSyncOperation;

export default {
    initDatabase,
    getDatabase,
    upsertRecord,
    insertRecord,
    getAllRecords,
    getRecordById,
    getRecordsWhere,
    deleteRecord,
    clearTable,
    addToSyncQueue,
    getPendingSyncOperations,
    removeSyncOperation,
    removeFromSyncQueue,
    markAsSynced,
    updateSyncQueueError,
    clearAllData
};
