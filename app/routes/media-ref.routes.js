/**
 * @fileoverview POST /api/upload/from-ref: usa como imagen o audio de una pregunta (o portada) una
 * ruta de /uploads o una URL de otra web, sin subir el fichero. Lo decide services/media-ref.js;
 * aquí solo se valida la forma y se traducen sus errores a 400.
 */

'use strict';

const express = require('express');
const Joi = require('joi');
const { authenticateAdmin } = require('../middlewares/auth');
const { validateBody } = require('../validation/middleware');
const { resolveMediaRef, MEDIA_REF_KINDS } = require('../services/media-ref');
const logger = require('../config/logger');

const router = express.Router();

const mediaRefSchema = Joi.object({
    ref: Joi.string().trim().min(1).max(2048).required(),
    kind: Joi.string().valid(...MEDIA_REF_KINDS).required()
});

router.post('/api/upload/from-ref', authenticateAdmin, validateBody(mediaRefSchema), async (req, res) => {
    const { ref, kind } = req.body;
    try {
        const media = await resolveMediaRef(ref, kind, { ownHost: req.get('host') });
        return res.json({ success: true, ...media });
    } catch (err) {
        if (typeof err.code === 'string' && err.code.startsWith('REF_')) {
            return res.status(400).json({ error: err.message, code: err.code, ...(err.params ? { params: err.params } : {}) });
        }
        logger.error('Error usando una ruta o URL como recurso:', err);
        return res.status(500).json({ error: 'Error al usar el fichero', code: 'MEDIA_REF_FAILED' });
    }
});

module.exports = router;
