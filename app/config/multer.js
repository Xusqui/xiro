/**
 * @fileoverview Configuración de Multer para subida de archivos multimedia
 * Soporta imágenes (JPG, PNG, GIF, WebP, SVG) y audio (MP3, WAV, OGG).
 * También incluye configuración específica para imágenes pequeñas de enunciado
 * (máx. 100x100 px / 25 KB) en preguntas de banco de preguntas.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Crear directorio de uploads si no existe
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generar nombre único: timestamp-random-originalname
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        // Sanitizar el nombre del archivo
        const sanitizedBasename = basename.replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${sanitizedBasename}-${uniqueSuffix}${ext}`);
    }
});

// Filtro de tipos de archivo
const fileFilter = (req, file, cb) => {
    // Tipos MIME permitidos
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    const allowedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];

    const allowedTypes = [...allowedImageTypes, ...allowedAudioTypes];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se permiten imágenes (JPG, PNG, GIF, WebP, SVG) y audio (MP3, WAV, OGG)`), false);
    }
};

// ===== LÍMITES DE TAMAÑO =====
const MAX_QUESTION_IMAGE_BYTES = 200 * 1024; // 200 KB para imágenes de enunciado/opción
const MAX_GAME_COVER_IMAGE_BYTES = 1024 * 1024; // 1 MB para imagen de portada de juego/banco

// Configuración de Multer (multimedia general)
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB máximo (se valida por tipo en el controlador)
    }
});

// Filtro exclusivo para imágenes pequeñas de enunciado
const imageOnlyFilter = (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedImageTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP) para el enunciado'), false);
    }
};

// Configuración de Multer para imágenes pequeñas de enunciado (≤ 25 KB)
const uploadQuestionImage = multer({
    storage: storage,
    fileFilter: imageOnlyFilter,
    limits: {
        fileSize: MAX_QUESTION_IMAGE_BYTES,
    }
});

// Configuración de Multer para imagen de portada de un juego/banco (≤ 1 MB)
const uploadGameCoverImage = multer({
    storage: storage,
    fileFilter: imageOnlyFilter,
    limits: {
        fileSize: MAX_GAME_COVER_IMAGE_BYTES,
    }
});

/**
 * Middleware para validar tamaño según tipo de archivo
 */
function validateFileSize(req, res, next) {
    if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ningún archivo', code: 'NO_FILE_PROVIDED' });
    }

    const file = req.file;
    const maxImageSize = 5 * 1024 * 1024; // 5MB para imágenes
    const maxAudioSize = 10 * 1024 * 1024; // 10MB para audio

    const isImage = file.mimetype.startsWith('image/');
    const isAudio = file.mimetype.startsWith('audio/');

    if (isImage && file.size > maxImageSize) {
        // Eliminar archivo si excede el límite
        fs.unlinkSync(file.path);
        return res.status(400).json({
            error: `El archivo de imagen excede el límite de 5MB. Tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
            code: 'IMAGE_FILE_TOO_LARGE',
            params: { maxMb: 5, sizeMb: Number((file.size / 1024 / 1024).toFixed(2)) }
        });
    }

    if (isAudio && file.size > maxAudioSize) {
        // Eliminar archivo si excede el límite
        fs.unlinkSync(file.path);
        return res.status(400).json({
            error: `El archivo de audio excede el límite de 10MB. Tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
            code: 'AUDIO_FILE_TOO_LARGE',
            params: { maxMb: 10, sizeMb: Number((file.size / 1024 / 1024).toFixed(2)) }
        });
    }

    next();
}

/**
 * Elimina un archivo del sistema de archivos
 * @param {string} filename - Nombre del archivo a eliminar
 * @returns {boolean} - true si se eliminó correctamente
 */
function deleteFile(filename) {
    try {
        const filePath = path.join(uploadDir, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (err) {
        logger.error('Error eliminando archivo:', err);
        return false;
    }
}

module.exports = {
    upload,
    uploadQuestionImage,
    uploadGameCoverImage,
    validateFileSize,
    deleteFile,
    uploadDir,
    MAX_QUESTION_IMAGE_BYTES,
    MAX_GAME_COVER_IMAGE_BYTES
};
