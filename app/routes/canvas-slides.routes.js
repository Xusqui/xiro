/**
 * @fileoverview Importación de paquetes .xiroslide (diapositivas libres de otra instalación de XiRo).
 * POST /api/canvas-slides/import (multipart, campo file) devuelve las diapositivas, con sus imágenes ya
 * guardadas en /uploads/, y los avisos; el admin decide si las añade a un juego o a la biblioteca.
 */
'use strict';

const express = require('express');
const multer = require('multer');
const { authenticateAdmin } = require('../middlewares/auth');
const { MAX_PACKAGE_BYTES } = require('../public/js/core/slide-package');
const { importSlidePackage } = require('../services/slide-package/import.service');
const { handleRouteError } = require('./helpers/RouteErrorHandler');
const logger = require('../config/logger');

const router = express.Router();
const MAX_PACKAGE_MB = MAX_PACKAGE_BYTES / 1024 / 1024;

// En memoria: el paquete se valida entero antes de escribir nada en disco
const uploadPackage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PACKAGE_BYTES, files: 1 }
});

/** Recibe el fichero del paquete y traduce los errores de multer a códigos estables. */
function receivePackage(req, res, next) {
    uploadPackage.single('file')(req, res, err => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                error: `El paquete supera ${MAX_PACKAGE_MB} MB`,
                code: 'SLIDE_PACKAGE_TOO_LARGE',
                params: { maxMb: MAX_PACKAGE_MB }
            });
        }
        return res.status(400).json({ error: 'No se pudo leer el archivo', code: 'SLIDE_PACKAGE_INVALID' });
    });
}

router.post('/api/canvas-slides/import', authenticateAdmin, receivePackage, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ningún archivo', code: 'NO_FILE_PROVIDED' });
        }
        const result = await importSlidePackage(req.file.buffer);
        logger.info('Paquete de diapositivas libres importado', {
            slides: result.slides.length,
            warnings: result.warnings.length,
            bytes: req.file.size,
            userId: req.user?.userId
        });
        res.json(result);
    } catch (err) {
        handleRouteError(err, res);
    }
});

module.exports = router;
