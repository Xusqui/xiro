/**
 * @fileoverview Temas propios de las diapositivas libres (administradores y editores):
 *   GET    /api/canvas-slides/themes      lista, los más recientes primero
 *   POST   /api/canvas-slides/themes      guarda { name, theme }
 *   PATCH  /api/canvas-slides/themes/:id  renombra { name }
 *   DELETE /api/canvas-slides/themes/:id  borra
 * Un editor solo renombra o borra lo que creó (403 OWNER_FORBIDDEN); un administrador, todo.
 */
'use strict';

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { validateBody } = require('../validation');
const { createThemeSchema, renameThemeSchema } = require('../application/validators/CanvasThemeValidator');
const themes = require('../services/db/canvas-slide-theme.service');
const { handleRouteError, handleNotFound } = require('./helpers/RouteErrorHandler');
const logger = require('../config/logger');

const router = express.Router();
const BASE = '/api/canvas-slides/themes';

/** Id numérico positivo de la ruta, o null. */
function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

/** Solo los editores están limitados a lo suyo: para un administrador no se comprueba la propiedad. */
function actorOf(req) {
    return req.user?.role === 'editor' ? req.user?.userId : null;
}

function invalidId(res) {
    return res.status(400).json({ error: 'Identificador no válido', code: 'INVALID_ID' });
}

router.get(BASE, authenticateAdmin, async (req, res) => {
    try {
        res.json(await themes.listThemes());
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.post(BASE, authenticateAdmin, validateBody(createThemeSchema), async (req, res) => {
    try {
        const saved = await themes.createTheme({
            name: req.body.name,
            theme: req.body.theme,
            creatorRole: req.user?.role,
            creatorUserId: req.user?.userId ?? null
        });
        logger.info('Tema de diapositivas libres guardado', { id: saved.id, userId: req.user?.userId });
        res.status(201).json(saved);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.patch(`${BASE}/:id`, authenticateAdmin, validateBody(renameThemeSchema), async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return invalidId(res);
    try {
        const renamed = await themes.renameTheme(id, req.body.name, actorOf(req));
        if (!renamed) return handleNotFound(res);
        res.json(renamed);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.delete(`${BASE}/:id`, authenticateAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return invalidId(res);
    try {
        const deleted = await themes.deleteTheme(id, actorOf(req));
        if (!deleted) return handleNotFound(res);
        logger.info('Tema de diapositivas libres borrado', { id, userId: req.user?.userId });
        res.json({ success: true });
    } catch (err) {
        handleRouteError(err, res);
    }
});

module.exports = router;
