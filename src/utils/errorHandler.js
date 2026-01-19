/**
 * Manejador de errores para GoalFut
 * Traduce errores de Supabase a mensajes amigables en español
 */

const ERROR_MESSAGES = {
    // Errores de autenticación - Login
    'Invalid login credentials': 'Email o contraseña incorrectos. Verifica tus datos.',
    'invalid_credentials': 'Email o contraseña incorrectos',
    'Email not confirmed': 'Debes confirmar tu email antes de iniciar sesión. Revisa tu bandeja.',
    'Invalid email or password': 'Email o contraseña incorrectos',
    'User not found': 'Este email no está registrado',

    // Errores de autenticación - Registro
    'User already registered': 'Este email ya está registrado. Intenta iniciar sesión.',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
    'Unable to validate email address: invalid format': 'El formato del email no es válido',
    'Signup requires a valid password': 'Debes ingresar una contraseña válida',

    // Errores de base de datos - duplicados
    'usuarios_email_key': 'Este email ya está registrado en el sistema',
    'usuarios_telefono_key': 'Este número de teléfono ya está en uso',
    'duplicate key value violates unique constraint': 'Este registro ya existe',
    'violates foreign key constraint': 'No se puede eliminar porque tiene datos relacionados',
    'violates check constraint': 'El valor ingresado no es válido',
    'new row violates row-level security policy': 'No tienes permiso para esta acción',

    // Errores de red
    'Network request failed': 'Error de conexión. Verifica tu internet.',
    'Failed to fetch': 'No se pudo conectar al servidor',

    // Errores generales
    'PGRST116': 'No se encontró el registro solicitado',
    '23505': 'Este registro ya existe en el sistema',
    '23503': 'No se puede completar porque depende de otros datos',
    '42501': 'No tienes permisos para realizar esta acción',
};

/**
 * Obtiene un mensaje de error amigable
 * @param {Error|Object|string} error - El error a traducir
 * @returns {string} Mensaje amigable en español
 */
export const getErrorMessage = (error) => {
    if (!error) return 'Ocurrió un error inesperado';

    // Si es string, buscar directamente
    if (typeof error === 'string') {
        for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
            if (error.includes(key)) return value;
        }
        return error;
    }

    // Si es objeto con message
    const errorMessage = error.message || error.error || error.details || '';
    const errorCode = error.code || '';

    // Buscar por código primero
    if (errorCode && ERROR_MESSAGES[errorCode]) {
        return ERROR_MESSAGES[errorCode];
    }

    // Buscar por mensaje
    for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
        if (errorMessage.includes(key)) return value;
    }

    // Si no encontramos traducción, devolver el mensaje original o uno genérico
    return errorMessage || 'Ocurrió un error inesperado';
};

/**
 * Muestra un error en consola con formato
 * @param {string} context - Contexto donde ocurrió el error
 * @param {Error} error - El error
 */
export const logError = (context, error) => {
    console.error(`[${context}]`, error);
};

export default {
    getErrorMessage,
    logError,
};
