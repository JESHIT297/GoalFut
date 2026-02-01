// SQLite Database Schema for GoalFut
// Tables for local offline storage

export const SCHEMA = {
    version: 1,
    tables: {
        // Torneos table
        torneos: `
            CREATE TABLE IF NOT EXISTS torneos (
                id TEXT PRIMARY KEY,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                lugar TEXT,
                fecha_inicio TEXT,
                fecha_fin TEXT,
                estado TEXT DEFAULT 'activo',
                tipo TEXT DEFAULT 'liga',
                max_equipos INTEGER DEFAULT 8,
                min_jugadores INTEGER DEFAULT 7,
                max_jugadores INTEGER DEFAULT 15,
                duracion_partido INTEGER DEFAULT 90,
                tiempo_entretiempo INTEGER DEFAULT 15,
                tarjetas_amarillas_suspension INTEGER DEFAULT 3,
                admin_id TEXT,
                imagen_url TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced INTEGER DEFAULT 0
            )
        `,

        // Equipos table
        equipos: `
            CREATE TABLE IF NOT EXISTS equipos (
                id TEXT PRIMARY KEY,
                nombre TEXT NOT NULL,
                nombre_corto TEXT,
                color TEXT,
                logo_url TEXT,
                torneo_id TEXT,
                grupo TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced INTEGER DEFAULT 0,
                FOREIGN KEY (torneo_id) REFERENCES torneos(id)
            )
        `,

        // Jugadores table
        jugadores: `
            CREATE TABLE IF NOT EXISTS jugadores (
                id TEXT PRIMARY KEY,
                nombre TEXT NOT NULL,
                apellido TEXT,
                numero INTEGER,
                posicion TEXT,
                es_capitan INTEGER DEFAULT 0,
                foto_url TEXT,
                equipo_id TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced INTEGER DEFAULT 0,
                FOREIGN KEY (equipo_id) REFERENCES equipos(id)
            )
        `,

        // Partidos table
        partidos: `
            CREATE TABLE IF NOT EXISTS partidos (
                id TEXT PRIMARY KEY,
                torneo_id TEXT,
                equipo_local_id TEXT,
                equipo_visitante_id TEXT,
                goles_local INTEGER DEFAULT 0,
                goles_visitante INTEGER DEFAULT 0,
                fecha TEXT,
                hora TEXT,
                estado TEXT DEFAULT 'programado',
                jornada INTEGER,
                fase TEXT,
                grupo TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced INTEGER DEFAULT 0,
                FOREIGN KEY (torneo_id) REFERENCES torneos(id),
                FOREIGN KEY (equipo_local_id) REFERENCES equipos(id),
                FOREIGN KEY (equipo_visitante_id) REFERENCES equipos(id)
            )
        `,

        // Torneos seguidos por el usuario
        torneos_seguidos: `
            CREATE TABLE IF NOT EXISTS torneos_seguidos (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                torneo_id TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced INTEGER DEFAULT 0,
                FOREIGN KEY (torneo_id) REFERENCES torneos(id)
            )
        `,

        // Cola de sincronización para operaciones pendientes
        sync_queue: `
            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                operation TEXT NOT NULL,
                record_id TEXT NOT NULL,
                data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                attempts INTEGER DEFAULT 0,
                last_error TEXT
            )
        `
    }
};

export const TABLE_NAMES = Object.keys(SCHEMA.tables);
