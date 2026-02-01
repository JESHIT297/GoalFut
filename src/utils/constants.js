// Colores principales de la aplicación
export const COLORS = {
    primary: '#1E88E5',       // Azul principal
    primaryDark: '#1565C0',   // Azul oscuro
    primaryLight: '#64B5F6',  // Azul claro
    secondary: '#26A69A',     // Verde teal
    accent: '#FF6B35',        // Naranja acento

    // Estados
    success: '#4CAF50',       // Verde éxito
    warning: '#FFC107',       // Amarillo advertencia
    error: '#F44336',         // Rojo error
    info: '#2196F3',          // Azul info

    // Tarjetas de fútbol
    yellowCard: '#FFEB3B',    // Tarjeta amarilla
    blueCard: '#2196F3',      // Tarjeta azul (fútbol de salón)
    redCard: '#D32F2F',       // Tarjeta roja

    // Fondos
    background: '#F5F5F5',    // Fondo gris claro
    surface: '#FFFFFF',       // Superficie blanca
    surfaceVariant: '#E8E8E8', // Superficie variante

    // Textos
    textPrimary: '#212121',   // Texto principal
    textSecondary: '#757575', // Texto secundario
    textLight: '#BDBDBD',     // Texto claro
    textOnPrimary: '#FFFFFF', // Texto sobre color primario

    // Bordes
    border: '#E0E0E0',
    divider: '#EEEEEE',

    // Estados de partido
    matchLive: '#F44336',     // En vivo
    matchScheduled: '#9E9E9E', // Programado
    matchFinished: '#4CAF50',  // Finalizado
};

// Estados de partido
export const MATCH_STATUS = {
    PROGRAMADO: 'programado',
    EN_JUEGO: 'en_juego',
    PAUSADO: 'pausado',
    MEDIO_TIEMPO: 'medio_tiempo',
    FINALIZADO: 'finalizado',
    SUSPENDIDO: 'suspendido',
    APLAZADO: 'aplazado',
};

export const MATCH_STATUS_LABELS = {
    programado: 'Programado',
    en_juego: 'En Vivo',
    pausado: 'Pausado',
    medio_tiempo: 'Medio Tiempo',
    finalizado: 'Finalizado',
    suspendido: 'Suspendido',
    aplazado: 'Aplazado',
};

// Estados de torneo
export const TOURNAMENT_STATUS = {
    CONFIGURACION: 'configuracion',
    INSCRIPCION: 'inscripcion',
    ACTIVO: 'activo',
    FINALIZADO: 'finalizado',
    CANCELADO: 'cancelado',
};

export const TOURNAMENT_STATUS_LABELS = {
    configuracion: 'En Configuración',
    inscripcion: 'Inscripciones Abiertas',
    activo: 'En Curso',
    finalizado: 'Finalizado',
    cancelado: 'Cancelado',
};

// Tipos de evento de partido
export const EVENT_TYPES = {
    GOL: 'gol',
    GOL_PENAL: 'gol_penal',
    AUTOGOL: 'autogol',
    TARJETA_AMARILLA: 'tarjeta_amarilla',
    TARJETA_AZUL: 'tarjeta_azul',     // Fútbol de salón - 2 min suspensión
    TARJETA_ROJA: 'tarjeta_roja',
    DOBLE_AMARILLA: 'doble_amarilla',
    FALTA: 'falta',
    SUSTITUCION: 'sustitucion',
};

export const EVENT_TYPE_LABELS = {
    gol: '⚽ Gol',
    gol_penal: '⚽ Gol de Penal',
    autogol: '⚽ Autogol',
    tarjeta_amarilla: '🟨 Tarjeta Amarilla',
    tarjeta_azul: '🟦 Tarjeta Azul (2 min)',
    tarjeta_roja: '🟥 Tarjeta Roja',
    doble_amarilla: '🟨🟨 Doble Amarilla',
    falta: '⚠️ Falta',
    sustitucion: '🔄 Sustitución',
};

// Posiciones de jugadores (compatible con base de datos)
export const PLAYER_POSITIONS = [
    { value: 'portero', label: 'Portero', short: 'POR' },
    { value: 'defensa', label: 'Defensa', short: 'DEF' },
    { value: 'mediocampista', label: 'Mediocampista', short: 'MED' },
    { value: 'delantero', label: 'Delantero', short: 'DEL' },
    { value: 'universal', label: 'Universal', short: 'UNI' },
];

export const PLAYER_POSITION_LABELS = {
    portero: 'Portero',
    defensa: 'Defensa',
    mediocampista: 'Mediocampista',
    delantero: 'Delantero',
    universal: 'Universal',
};

// Fases del torneo
export const TOURNAMENT_PHASES = {
    GRUPOS: 'grupos',
    OCTAVOS: 'octavos',
    CUARTOS: 'cuartos',
    SEMIFINAL: 'semifinal',
    TERCER_PUESTO: 'tercer_puesto',
    FINAL: 'final',
};

export const TOURNAMENT_PHASE_LABELS = {
    grupos: 'Fase de Grupos',
    octavos: 'Octavos de Final',
    cuartos: 'Cuartos de Final',
    semifinal: 'Semifinal',
    tercer_puesto: 'Tercer Puesto',
    final: 'Final',
};

// Roles de usuario
export const USER_ROLES = {
    ADMIN: 'admin',
    REGISTERED: 'registered',
    GUEST: 'guest',
};

// Límites según las especificaciones
export const LIMITS = {
    MAX_ACTIVE_TOURNAMENTS_PER_ADMIN: 3,
    MAX_PLAYERS_PER_TEAM: 15,
    MIN_PLAYERS_PER_TEAM: 5,
};

// Configuración de caché offline
export const CACHE_KEYS = {
    USER_DATA: '@goalfut_user',
    TOURNAMENTS: '@goalfut_tournaments',
    FOLLOWED_TOURNAMENTS: '@goalfut_followed',
    SYNC_QUEUE: '@goalfut_sync_queue',
    LAST_SYNC: '@goalfut_last_sync',
};

// Tiempo de expiración de caché (en milisegundos)
export const CACHE_EXPIRY = {
    TOURNAMENTS: 5 * 60 * 1000,     // 5 minutos
    MATCHES: 1 * 60 * 1000,         // 1 minuto
    STANDINGS: 5 * 60 * 1000,       // 5 minutos
};
