/**
 * @fileoverview Rutas para gestión de uploads multimedia
 * Incluye endpoint específico para imágenes pequeñas de enunciado (≤ 25 KB / 100x100 px)
 */

const express = require('express');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const { upload, uploadQuestionImage, validateFileSize, deleteFile, MAX_QUESTION_IMAGE_BYTES } = require('../config/multer');
const logger = require('../config/logger');

const router = express.Router();

/**
 * Endpoint para subir archivos multimedia (imágenes y audio)
 * POST /api/upload
 */
router.post('/api/upload', authenticateAdmin, upload.single('file'), validateFileSize, (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ningún archivo', code: 'NO_FILE_PROVIDED' });
        }

        const file = req.file;
        const fileUrl = `/uploads/${file.filename}`;
        const tipo_contenido = file.mimetype.startsWith('image/') ? 'imagen' : 'audio';

        res.status(201).json({
            success: true,
            message: 'Archivo subido correctamente',
            code: 'FILE_UPLOADED',
            url: fileUrl,
            tipo_contenido: tipo_contenido,
            filename: file.filename,
            size: file.size,
            mimetype: file.mimetype
        });
    } catch (err) {
        logger.error('Error subiendo archivo:', err);
        res.status(500).json({ error: 'Error al procesar el archivo', code: 'UPLOAD_PROCESSING_FAILED' });
    }
});

/**
 * Endpoint para subir imagen pequeña de enunciado de pregunta (≤ 25 KB)
 * POST /api/upload/question-image
 */
router.post('/api/upload/question-image', authenticateAdmin, (req, res, next) => {
    uploadQuestionImage.single('file')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    error: `La imagen de enunciado no puede superar ${MAX_QUESTION_IMAGE_BYTES / 1024} KB. ` +
                           'Reduce el tamaño o las dimensiones de la imagen (máx. 100×100 px).',
                    code: 'QUESTION_IMAGE_TOO_LARGE',
                    params: { maxKb: MAX_QUESTION_IMAGE_BYTES / 1024 }
                });
            }
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ningún archivo', code: 'NO_FILE_PROVIDED' });
        }

        const file = req.file;
        const fileUrl = `/uploads/${file.filename}`;

        logger.info(`Imagen de enunciado subida: ${file.filename} (${file.size} bytes)`);

        res.status(201).json({
            success: true,
            message: 'Imagen del enunciado subida correctamente',
            code: 'QUESTION_IMAGE_UPLOADED',
            url: fileUrl,
            filename: file.filename,
            size: file.size,
            mimetype: file.mimetype
        });
    } catch (err) {
        logger.error('Error subiendo imagen de enunciado:', err);
        res.status(500).json({ error: 'Error al procesar la imagen', code: 'QUESTION_IMAGE_PROCESSING_FAILED' });
    }
});

/**
 * Endpoint para eliminar archivos multimedia
 * DELETE /api/upload/:filename
 */
router.delete('/api/upload/:filename', authenticateAdmin, authorizeAdmin, (req, res) => {
    try {
        const filename = req.params.filename;
        const deleted = deleteFile(filename);

        if (deleted) {
            res.json({ success: true, message: 'Archivo eliminado correctamente', code: 'FILE_DELETED' });
        } else {
            res.status(404).json({ error: 'Archivo no encontrado', code: 'FILE_NOT_FOUND' });
        }
    } catch (err) {
        logger.error('Error eliminando archivo:', err);
        res.status(500).json({ error: 'Error al eliminar el archivo', code: 'DELETE_FILE_FAILED' });
    }
});

module.exports = router;
