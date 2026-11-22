/**
 * @fileoverview POST /api/upload/bank-media: guarda una imagen o un audio que viaja en el JSON de un
 * banco. Llega como fichero binario (multipart, campo «file»), sin pasar por base64. El tipo y el
 * tamaño los decide services/bank-media-store.js por los bytes.
 */

'use strict';

const express = require('express');
const multer = require('multer');
const { authenticateAdmin } = require('../middlewares/auth');
const { storeBankMedia, BankMediaError, MAX_BANK_AUDIO_BYTES } = require('../services/bank-media-store');
const logger = require('../config/logger');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BANK_AUDIO_BYTES, files: 1 } });
const STATUS_BY_CODE = Object.freeze({ BANK_MEDIA_INVALID: 400, BANK_MEDIA_TOO_LARGE: 413 });

/** Sube el fichero; multer deja su error de tamaño para responderlo con el mismo código. */
function receiveFile(req, res, next) {
    upload.single('file')(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'El fichero pesa demasiado', code: 'BANK_MEDIA_TOO_LARGE' });
        }
        return res.status(400).json({ error: 'No se pudo leer el fichero', code: 'BANK_MEDIA_INVALID' });
    });
}

router.post('/api/upload/bank-media', authenticateAdmin, receiveFile, async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ningún archivo', code: 'NO_FILE_PROVIDED' });
    }
    try {
        const { url, tipo_contenido } = await storeBankMedia(req.file.buffer);
        return res.status(201).json({ success: true, url, tipo_contenido });
    } catch (err) {
        if (err instanceof BankMediaError) {
            return res.status(STATUS_BY_CODE[err.code] || 400).json({ error: err.message, code: err.code });
        }
        logger.error('Error guardando recurso de banco:', err);
        return res.status(500).json({ error: 'Error al guardar el fichero', code: 'BANK_MEDIA_FAILED' });
    }
});

module.exports = router;
