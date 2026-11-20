/**
 * @fileoverview POST /api/upload/embedded-image: guarda una imagen que viaja incrustada (data URL en
 * base64) en el JSON de un banco, como la de «Toca la imagen». El tipo y el tamaño los decide
 * services/image-store.js por los bytes, no por el data URL.
 */

'use strict';

const express = require('express');
const Joi = require('joi');
const { authenticateAdmin } = require('../middlewares/auth');
const { validateBody } = require('../validation/middleware');
const { storeImageBuffer, MAX_IMAGE_BYTES } = require('../services/image-store');
const logger = require('../config/logger');

const router = express.Router();

const DATA_URL_PREFIX = /^data:image\/(?:png|jpeg|webp|gif);base64,/;
// Base64 de MAX_IMAGE_BYTES más la cabecera del data URL
const MAX_DATA_URL_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 64;

const embeddedImageSchema = Joi.object({
    dataUrl: Joi.string()
        .max(MAX_DATA_URL_LENGTH)
        .pattern(/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/)
        .required()
});

router.post('/api/upload/embedded-image', authenticateAdmin, validateBody(embeddedImageSchema), async (req, res) => {
    const buffer = Buffer.from(req.body.dataUrl.replace(DATA_URL_PREFIX, ''), 'base64');
    try {
        const url = await storeImageBuffer(buffer, { prefix: 'import' });
        if (!url) {
            return res.status(400).json({ error: 'La imagen no es válida', code: 'EMBEDDED_IMAGE_INVALID' });
        }
        return res.status(201).json({ success: true, url });
    } catch (err) {
        logger.error('Error guardando imagen incrustada:', err);
        return res.status(500).json({ error: 'Error al guardar la imagen', code: 'EMBEDDED_IMAGE_FAILED' });
    }
});

module.exports = router;
