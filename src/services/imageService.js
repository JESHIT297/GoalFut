/**
 * Servicio de imágenes para GoalFut
 * Maneja la subida y obtención de imágenes desde Supabase Storage
 */

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../config/supabase';
import { getErrorMessage } from '../utils/errorHandler';

const BUCKET_NAME = 'goalfut-images';

/**
 * Solicita permisos para acceder a la galería
 */
export const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
};

/**
 * Abre el selector de imágenes
 * @returns {Promise<string|null>} URI de la imagen seleccionada o null
 */
export const pickImage = async () => {
    try {
        const hasPermission = await requestMediaPermission();
        if (!hasPermission) {
            throw new Error('Se necesitan permisos para acceder a la galería');
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.3, // Reducido para subidas más rápidas en túnel
            // Limitar tamaño máximo para evitar timeouts
            exif: false,
        });

        if (result.canceled) return null;

        return result.assets[0].uri;
    } catch (error) {
        console.error('Error picking image:', error);
        throw error;
    }
};

/**
 * Sube una imagen a Supabase Storage con reintentos
 * Usa base64 para mejor compatibilidad con túnel de Expo
 * @param {string} uri - URI local de la imagen
 * @param {string} folder - Carpeta destino (equipos, jugadores, etc.)
 * @param {string} fileName - Nombre del archivo
 * @param {number} retries - Número de reintentos (default: 2)
 * @returns {Promise<string>} URL pública de la imagen
 */
export const uploadImage = async (uri, folder, fileName, retries = 2) => {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            // Leer archivo como base64
            let base64Data;
            try {
                base64Data = await FileSystem.readAsStringAsync(uri, {
                    encoding: 'base64',
                });
            } catch (readError) {
                console.error('Error reading image:', readError);
                throw new Error('No se pudo leer la imagen seleccionada');
            }

            // Verificar tamaño aproximado (base64 es ~33% más grande)
            const estimatedSize = (base64Data.length * 3) / 4;
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (estimatedSize > maxSize) {
                throw new Error('La imagen es muy grande. El tamaño máximo es 5MB');
            }

            // Generar nombre único
            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            const extension = validExtensions.includes(fileExt) ? fileExt : 'jpg';
            const uniqueName = `${folder}/${fileName}_${Date.now()}.${extension}`;

            // Convertir base64 a ArrayBuffer
            const arrayBuffer = decode(base64Data);

            // Subir a Supabase Storage
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(uniqueName, arrayBuffer, {
                    contentType: `image/${extension}`,
                    upsert: true,
                });

            if (error) {
                console.error(`Supabase upload error (attempt ${attempt + 1}):`, error);

                // Errores que no vale la pena reintentar
                if (error.message?.includes('bucket') || error.statusCode === 404) {
                    throw new Error('El almacenamiento de imágenes no está configurado. Contacta al administrador');
                }
                if (error.message?.includes('policy') || error.statusCode === 403) {
                    throw new Error('No tienes permisos para subir imágenes');
                }

                // Guardar error para posible reintento
                lastError = error;

                // Si aún quedan reintentos, esperar y continuar
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
                    continue;
                }

                throw new Error('Error al subir la imagen después de varios intentos');
            }

            // Obtener URL pública
            const { data: urlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(data.path);

            return urlData.publicUrl;

        } catch (error) {
            lastError = error;

            // Si es un error de validación, no reintentar
            if (error.message?.includes('máximo') || error.message?.includes('leer')) {
                throw error;
            }

            // Si aún quedan reintentos para errores de red
            if (attempt < retries) {
                console.log(`Reintentando subida (intento ${attempt + 2}/${retries + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
                continue;
            }
        }
    }

    // Si llegamos aquí, todos los reintentos fallaron
    console.error('Error uploading image after all retries:', lastError);
    if (lastError?.message && !lastError.message.includes('StorageUnknownError')) {
        throw lastError;
    }
    throw new Error('Error de conexión. Verifica tu internet e intenta de nuevo');
};

/**
 * Elimina una imagen de Supabase Storage
 * @param {string} imageUrl - URL de la imagen a eliminar
 */
export const deleteImage = async (imageUrl) => {
    try {
        if (!imageUrl) return;

        // Extraer el path del URL
        const urlParts = imageUrl.split(`${BUCKET_NAME}/`);
        if (urlParts.length < 2) return;

        const path = urlParts[1];

        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([path]);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting image:', error);
    }
};

/**
 * Sube logo de equipo
 * @param {string} uri - URI de la imagen
 * @param {string} equipoId - ID del equipo
 */
export const uploadEquipoLogo = async (uri, equipoId) => {
    return uploadImage(uri, 'equipos', equipoId);
};

/**
 * Sube foto de jugador
 * @param {string} uri - URI de la imagen
 * @param {string} jugadorId - ID del jugador
 */
export const uploadJugadorFoto = async (uri, jugadorId) => {
    return uploadImage(uri, 'jugadores', jugadorId);
};

export default {
    pickImage,
    uploadImage,
    deleteImage,
    uploadEquipoLogo,
    uploadJugadorFoto,
    requestMediaPermission,
};
