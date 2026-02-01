// AsyncStorage Database Manager for GoalFut
// Uses AsyncStorage instead of SQLite for Expo Go compatibility
import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_PREFIX = '@goalfut_db_';
const SYNC_QUEUE_KEY = '@goalfut_sync_queue';

// Initialize database (no-op for AsyncStorage, but keeps API compatible)
export const initDatabase = async () => {
    try {
        console.log('AsyncStorage database initialized');
        return true;
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
};

// Get database instance (not needed for AsyncStorage, but keeps API compatible)
export const getDatabase = () => {
    return AsyncStorage;
};

// Get all records from a "table" (stored as array in AsyncStorage)
const getTableData = async (tableName) => {
    try {
        const key = `${DB_PREFIX}${tableName}`;
        const data = await AsyncStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error(`Error getting table ${tableName}:`, error);
        return [];
    }
};

// Save all records to a "table"
const saveTableData = async (tableName, data) => {
    try {
        const key = `${DB_PREFIX}${tableName}`;
        await AsyncStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error(`Error saving table ${tableName}:`, error);
        return false;
    }
};

// Insert or replace a record
export const insertRecord = async (tableName, record) => {
    try {
        const data = await getTableData(tableName);
        const existingIndex = data.findIndex(r => r.id === record.id);

        const recordWithTimestamp = {
            ...record,
            updated_at: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            data[existingIndex] = recordWithTimestamp;
        } else {
            recordWithTimestamp.created_at = new Date().toISOString();
            data.push(recordWithTimestamp);
        }

        await saveTableData(tableName, data);
        return true;
    } catch (error) {
        console.error(`Error inserting into ${tableName}:`, error);
        throw error;
    }
};

// Insert multiple records
export const insertMultiple = async (tableName, records) => {
    try {
        for (const record of records) {
            await insertRecord(tableName, record);
        }
        return true;
    } catch (error) {
        console.error(`Error inserting multiple into ${tableName}:`, error);
        throw error;
    }
};

// Get all records from a table
export const getAllRecords = async (tableName, whereClause = '', params = []) => {
    try {
        const data = await getTableData(tableName);
        // Note: whereClause is ignored in AsyncStorage version
        // Filtering should be done in the calling code
        return data;
    } catch (error) {
        console.error(`Error getting records from ${tableName}:`, error);
        return [];
    }
};

// Get single record by ID
export const getRecordById = async (tableName, id) => {
    try {
        const data = await getTableData(tableName);
        return data.find(r => r.id === id) || null;
    } catch (error) {
        console.error(`Error getting record from ${tableName}:`, error);
        return null;
    }
};

// Update a record
export const updateRecord = async (tableName, id, updates) => {
    try {
        const data = await getTableData(tableName);
        const index = data.findIndex(r => r.id === id);

        if (index >= 0) {
            data[index] = {
                ...data[index],
                ...updates,
                updated_at: new Date().toISOString()
            };
            await saveTableData(tableName, data);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error updating ${tableName}:`, error);
        throw error;
    }
};

// Delete a record
export const deleteRecord = async (tableName, id) => {
    try {
        const data = await getTableData(tableName);
        const filtered = data.filter(r => r.id !== id);
        await saveTableData(tableName, filtered);
        return true;
    } catch (error) {
        console.error(`Error deleting from ${tableName}:`, error);
        throw error;
    }
};

// Mark record as synced
export const markAsSynced = async (tableName, id) => {
    return updateRecord(tableName, id, { synced: 1 });
};

// Get unsynced records
export const getUnsyncedRecords = async (tableName) => {
    const data = await getTableData(tableName);
    return data.filter(r => !r.synced || r.synced === 0);
};

// Clear all data
export const clearDatabase = async () => {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const dbKeys = keys.filter(key => key.startsWith(DB_PREFIX));
        await AsyncStorage.multiRemove(dbKeys);
        console.log('Database cleared');
        return true;
    } catch (error) {
        console.error('Error clearing database:', error);
        return false;
    }
};

// Sync Queue Functions

// Add to sync queue
export const addToSyncQueue = async (tableName, operation, recordId, data) => {
    try {
        const queue = await getPendingSyncOperations();
        queue.push({
            id: Date.now(),
            table_name: tableName,
            operation,
            record_id: recordId,
            data: JSON.stringify(data),
            created_at: new Date().toISOString(),
            attempts: 0
        });
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
        return true;
    } catch (error) {
        console.error('Error adding to sync queue:', error);
        return false;
    }
};

// Get pending sync operations
export const getPendingSyncOperations = async () => {
    try {
        const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error getting sync queue:', error);
        return [];
    }
};

// Remove from sync queue
export const removeFromSyncQueue = async (id) => {
    try {
        const queue = await getPendingSyncOperations();
        const filtered = queue.filter(op => op.id !== id);
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
        return true;
    } catch (error) {
        console.error('Error removing from sync queue:', error);
        return false;
    }
};

// Update sync queue error
export const updateSyncQueueError = async (id, errorMsg) => {
    try {
        const queue = await getPendingSyncOperations();
        const index = queue.findIndex(op => op.id === id);
        if (index >= 0) {
            queue[index].attempts = (queue[index].attempts || 0) + 1;
            queue[index].last_error = errorMsg;
            await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
        }
        return true;
    } catch (error) {
        console.error('Error updating sync queue:', error);
        return false;
    }
};
