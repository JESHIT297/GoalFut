/**
 * Servicio de imágenes para GoalFut
 * Maneja la subida y obtención de imágenes desde Supabase Storage
 */

import * as ImagePicker from 'expo-image-picker';
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
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (result.canceled) return null;

        return result.assets[0].uri;
    } catch (error) {
        console.error('Error picking image:', error);
        throw error;
    }
};

/**
 * Sube una imagen a Supabase Storage
 * @param {string} uri - URI local de la imagen
 * @param {string} folder - Carpeta destino (equipos, jugadores, etc.)
 * @param {string} fileName - Nombre del archivo
 * @returns {Promise<string>} URL pública de la imagen
 */
export const uploadImage = async (uri, folder, fileName) => {
    try {
        // Obtener el archivo como blob
        const response = await fetch(uri);
        const blob = await response.blob();

        // Generar nombre único
        const fileExt = uri.split('.').pop() || 'jpg';
        const uniqueName = `${folder}/${fileName}_${Date.now()}.${fileExt}`;

        // Subir a Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(uniqueName, blob, {
                contentType: `image/${fileExt}`,
                upsert: true,
            });

        if (error) throw error;

        // Obtener URL pública
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path);

        return urlData.publicUrl;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw new Error(getErrorMessage(error));
    }
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
