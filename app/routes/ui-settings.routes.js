/**
 * @fileoverview Rutas de ajustes de interfaz de usuario
 * GET  /api/ui-settings          → devuelve ajustes (público, lectura en index.html)
 * POST /api/admin/ui-settings    → actualiza un ajuste (solo admin)
 */

'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const uiSettings = require('../config/ui-settings');
const runtimeConfig = require('../config/runtime-config');
const logger = require('../config/logger');

const router = express.Router();

// Multer aislado, exclusivo de esta ruta: no reutiliza config/multer.js para no tocar
// la subida de multimedia general (preguntas, portadas, etc.).
const PERSONALIZATIONS_DIR = path.join(__dirname, '../public/images/personalizations');
if (!fs.existsSync(PERSONALIZATIONS_DIR)) {
    fs.mkdirSync(PERSONALIZATIONS_DIR, { recursive: true });
}
const MAX_PERSONALIZATION_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

const personalizationStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, PERSONALIZATIONS_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const base = path.basename(file.originalname, path.extname(file.originalname))
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 60) || 'logo';
        let name = `${base}${ext}`;
        let i = 1;
        while (fs.existsSync(path.join(PERSONALIZATIONS_DIR, name))) {
            name = `${base}-${i++}${ext}`;
        }
        cb(null, name);
    }
});

const uploadPersonalizationImage = multer({
    storage: personalizationStorage,
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
        if (allowed.includes(file.mimetype)) return cb(null, true);
        const err = new Error('Solo se permiten imágenes JPG, PNG, WebP o SVG');
        err.code = 'PERSONALIZATION_INVALID_TYPE';
        cb(err, false);
    },
    limits: { fileSize: MAX_PERSONALIZATION_IMAGE_BYTES }
});

/** Público — index.html lo consume para aplicar visibilidad */
router.get('/api/ui-settings', (req, res) => {
    const settings = uiSettings.getAll();
    settings.umamiServerUrl = runtimeConfig.get('UMAMI_SERVER_URL');
    settings.umamiWebsiteId = runtimeConfig.get('UMAMI_WEBSITE_ID');
    // Tiempo por defecto de las preguntas nuevas en el editor de bancos (Config → Partidas)
    settings.questionTimeLimit = runtimeConfig.get('QUESTION_TIME_LIMIT');
    res.json(settings);
});

/** Admin — lista las imágenes disponibles para personalizar el frontend */
router.get('/api/admin/ui-settings/personalization-images', authenticateAdmin, authorizeAdmin, (req, res) => {
    const images = uiSettings.listPersonalizationImages().map(filename => ({
        filename,
        url: `/images/personalizations/${filename}`
    }));
    res.json({ success: true, images });
});

/** Admin — sube una nueva imagen de personalización */
router.post('/api/admin/ui-settings/personalization-images', authenticateAdmin, authorizeAdmin, (req, res, next) => {
    uploadPersonalizationImage.single('file')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    error: `La imagen no puede superar ${MAX_PERSONALIZATION_IMAGE_BYTES / 1024 / 1024} MB`,
                    code: 'PERSONALIZATION_IMAGE_TOO_LARGE'
                });
            }
            if (err.code === 'PERSONALIZATION_INVALID_TYPE') {
                return res.status(400).json({ success: false, error: err.message, code: err.code });
            }
            // Cualquier otro fallo (p.ej. permisos de disco) no se expone tal cual al
            // cliente: puede filtrar rutas absolutas del servidor.
            logger.error('Error subiendo imagen de personalización', { message: err.message, code: err.code });
            return res.status(500).json({ success: false, error: 'Error al guardar la imagen en el servidor', code: 'PERSONALIZATION_IMAGE_SAVE_FAILED' });
        }
        next();
    });
}, (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No se proporcionó ningún archivo', code: 'NO_FILE_PROVIDED' });
    }
    logger.info('Imagen de personalización subida', { filename: req.file.filename });
    res.status(201).json({
        success: true,
        filename: req.file.filename,
        url: `/images/personalizations/${req.file.filename}`
    });
});

/** Admin — elimina una imagen de personalización */
router.delete('/api/admin/ui-settings/personalization-images/:filename', authenticateAdmin, authorizeAdmin, (req, res) => {
    try {
        uiSettings.deletePersonalizationImage(req.params.filename);
        logger.info('Imagen de personalización eliminada', { filename: req.params.filename });
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

/** Admin — actualiza un ajuste de UI */
router.post('/api/admin/ui-settings', authenticateAdmin, authorizeAdmin, (req, res) => {
    try {
        const { key, value } = req.body;
        if (typeof key !== 'string' || !(key)) {
            return res.status(400).json({ success: false, error: 'Se requiere { key, value }', code: 'UI_SETTING_KEY_VALUE_REQUIRED' });
        }
        uiSettings.set(key, value);
        uiSettings.persistAll();
        logger.info('UI setting updated', { key, value });
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
