/**
 * Formatea una fecha a formato legible en español
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} Fecha formateada
 */
export const formatDate = (date) => {
    if (!date) return '';
    // Si es string YYYY-MM-DD, agregar hora para evitar problemas de timezone
    let d;
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        // Parsear como fecha local, no UTC
        d = new Date(date + 'T12:00:00');
    } else {
        d = new Date(date);
    }
    return d.toLocaleDateString('es-CO', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });
};

/**
 * Formatea una fecha completa
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} Fecha formateada
 */
export const formatFullDate = (date) => {
    if (!date) return '';
    // Si es string YYYY-MM-DD, agregar hora para evitar problemas de timezone
    let d;
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        d = new Date(date + 'T12:00:00');
    } else {
        d = new Date(date);
    }
    return d.toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
};

/**
 * Formatea una hora
 * @param {string} time - Hora en formato HH:MM:SS
 * @returns {string} Hora formateada
 */
export const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
};

/**
 * Formatea segundos a formato MM:SS
 * @param {number} totalSeconds - Total de segundos
 * @returns {string} Tiempo formateado
 */
export const formatTimer = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Calcula la diferencia de tiempo relativa
 * @param {string|Date} date - Fecha
 * @returns {string} Texto relativo
 */
export const timeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const d = new Date(date);
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return formatDate(date);
};

/**
 * Genera un ID único para sincronización offline
 * @returns {string} ID único
 */
export const generateSyncId = () => {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Valida un email
 * @param {string} email - Email a validar
 * @returns {boolean} Es válido
 */
export const isValidEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

/**
 * Capitaliza la primera letra de cada palabra
 * @param {string} str - String a capitalizar
 * @returns {string} String capitalizado
 */
export const capitalize = (str) => {
    if (!str) return '';
    return str.replace(/\b\w/g, (l) => l.toUpperCase());
};

/**
 * Trunca un texto a cierta longitud
 * @param {string} text - Texto
 * @param {number} maxLength - Longitud máxima
 * @returns {string} Texto truncado
 */
export const truncate = (text, maxLength = 50) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

/**
 * Ordena equipos por tabla de posiciones
 * Criterios de desempate (en orden):
 * 1. Puntos
 * 2. Diferencia de gol
 * 3. Goles a favor
 * 4. Fair Play (menos tarjetas = mejor posición)
 * 5. Alfabéticamente (último recurso)
 * 
 * Nota: El enfrentamiento directo se evalúa en sortByStandingsWithHeadToHead
 * @param {Array} teams - Lista de equipos
 * @returns {Array} Equipos ordenados
 */
export const sortByStandings = (teams) => {
    return [...teams].sort((a, b) => {
        // 1. Primero por puntos
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;

        // 2. Luego por diferencia de gol
        if (b.diferencia_gol !== a.diferencia_gol) return b.diferencia_gol - a.diferencia_gol;

        // 3. Luego por goles a favor
        if (b.goles_favor !== a.goles_favor) return b.goles_favor - a.goles_favor;

        // 4. Fair Play - el que tenga MENOS tarjetas queda arriba
        // Roja = 3 puntos, Azul = 2 puntos, Amarilla = 1 punto
        const tarjetasA = ((a.tarjetas_rojas || 0) * 3) + ((a.tarjetas_azules || 0) * 2) + (a.tarjetas_amarillas || 0);
        const tarjetasB = ((b.tarjetas_rojas || 0) * 3) + ((b.tarjetas_azules || 0) * 2) + (b.tarjetas_amarillas || 0);
        if (tarjetasA !== tarjetasB) return tarjetasA - tarjetasB; // Menos tarjetas = mejor

        // 5. Finalmente alfabéticamente
        return a.nombre.localeCompare(b.nombre);
    });
};

/**
 * Ordena equipos incluyendo enfrentamiento directo
 * @param {Array} teams - Lista de equipos
 * @param {Array} matches - Lista de partidos del torneo
 * @returns {Array} Equipos ordenados
 */
export const sortByStandingsWithHeadToHead = (teams, matches = []) => {
    // Primero ordenar por criterios básicos
    const sorted = sortByStandings(teams);

    // Si hay partidos, resolver empates por enfrentamiento directo
    if (matches.length === 0) return sorted;

    // Encontrar equipos con mismos puntos
    const result = [];
    let i = 0;

    while (i < sorted.length) {
        const currentPoints = sorted[i].puntos;
        const tiedTeams = [sorted[i]];

        // Encontrar todos los equipos con los mismos puntos
        while (i + 1 < sorted.length && sorted[i + 1].puntos === currentPoints) {
            i++;
            tiedTeams.push(sorted[i]);
        }

        if (tiedTeams.length === 1) {
            result.push(tiedTeams[0]);
        } else {
            // Resolver empate por enfrentamiento directo
            const resolvedTie = resolveHeadToHead(tiedTeams, matches);
            result.push(...resolvedTie);
        }

        i++;
    }

    return result;
};

/**
 * Resuelve empates por enfrentamiento directo
 * @param {Array} tiedTeams - Equipos empatados
 * @param {Array} matches - Partidos del torneo
 * @returns {Array} Equipos ordenados por enfrentamiento directo
 */
const resolveHeadToHead = (tiedTeams, matches) => {
    if (tiedTeams.length !== 2) {
        // Para 3+ equipos, mantener orden por diferencia de gol
        return tiedTeams;
    }

    const team1 = tiedTeams[0];
    const team2 = tiedTeams[1];

    // Buscar el partido entre ambos equipos
    const headToHead = matches.find(m =>
        m.estado === 'finalizado' && (
            (m.equipo_local_id === team1.id && m.equipo_visitante_id === team2.id) ||
            (m.equipo_local_id === team2.id && m.equipo_visitante_id === team1.id)
        )
    );

    if (!headToHead) return tiedTeams; // No hay partido, mantener orden

    // Determinar ganador
    const team1IsLocal = headToHead.equipo_local_id === team1.id;
    const team1Goals = team1IsLocal ? headToHead.goles_local : headToHead.goles_visitante;
    const team2Goals = team1IsLocal ? headToHead.goles_visitante : headToHead.goles_local;

    if (team1Goals > team2Goals) {
        return [team1, team2]; // team1 ganó
    } else if (team2Goals > team1Goals) {
        return [team2, team1]; // team2 ganó
    }

    // Empate en enfrentamiento directo, mantener orden original
    return tiedTeams;
};

/**
 * Agrupa partidos por fecha
 * @param {Array} matches - Lista de partidos
 * @returns {Object} Partidos agrupados por fecha
 */
export const groupMatchesByDate = (matches) => {
    return matches.reduce((groups, match) => {
        const date = match.fecha;
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(match);
        return groups;
    }, {});
};

/**
 * Genera el calendario de partidos para un torneo
 * @param {Array} teams - Lista de equipos
 * @param {string} tournamentId - ID del torneo
 * @returns {Array} Lista de partidos generados
 */
export const generateRoundRobinSchedule = (teams, tournamentId) => {
    const matches = [];
    const n = teams.length;

    // Algoritmo Round Robin
    const teamsCopy = [...teams];

    // Si es impar, agregar un equipo "bye"
    if (n % 2 !== 0) {
        teamsCopy.push({ id: null, nombre: 'BYE' });
    }

    const numTeams = teamsCopy.length;
    const numRounds = numTeams - 1;
    const halfSize = numTeams / 2;

    const teamsIndexes = teamsCopy.map((_, i) => i).slice(1);

    for (let round = 0; round < numRounds; round++) {
        const roundMatches = [];
        const newTeamsIndexes = [0, ...teamsIndexes];

        for (let i = 0; i < halfSize; i++) {
            const home = newTeamsIndexes[i];
            const away = newTeamsIndexes[numTeams - 1 - i];

            // No agregar partidos con equipo "bye"
            if (teamsCopy[home].id && teamsCopy[away].id) {
                roundMatches.push({
                    torneo_id: tournamentId,
                    equipo_local_id: teamsCopy[home].id,
                    equipo_visitante_id: teamsCopy[away].id,
                    jornada: round + 1,
                    fase: 'grupos',
                    estado: 'programado',
                });
            }
        }

        matches.push(...roundMatches);

        // Rotar equipos (excepto el primero)
        teamsIndexes.push(teamsIndexes.shift());
    }

    return matches;
};

/**
 * Calcula estadísticas de un jugador
 * @param {Object} player - Jugador
 * @returns {Object} Estadísticas calculadas
 */
export const calculatePlayerStats = (player) => {
    const goalsPerMatch = player.partidos_jugados > 0
        ? (player.goles_totales / player.partidos_jugados).toFixed(2)
        : 0;

    return {
        ...player,
        goalsPerMatch,
        totalCards: player.tarjetas_amarillas + player.tarjetas_rojas,
    };
};
