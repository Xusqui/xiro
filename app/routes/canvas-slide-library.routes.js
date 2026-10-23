/**
 * @fileoverview Biblioteca de diapositivas libres (administradores y editores):
 *   GET    /api/canvas-slides/library      lista, las más recientes primero
 *   POST   /api/canvas-slides/library      guarda { name, slide_canvas }
 *   PATCH  /api/canvas-slides/library/:id  renombra { name }
 *   DELETE /api/canvas-slides/library/:id  borra
 * Un editor solo renombra o borra lo que creó (403 OWNER_FORBIDDEN); un administrador, todo.
 */
'use strict';

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { validateBody } = require('../validation');
const {
    createLibrarySlideSchema,
    renameLibrarySlideSchema
} = require('../application/validators/CanvasSlideLibraryValidator');
const library = require('../services/db/canvas-slide-library.service');
const { handleRouteError, handleNotFound } = require('./helpers/RouteErrorHandler');
const logger = require('../config/logger');

const router = express.Router();
const BASE = '/api/canvas-slides/library';

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
        res.json(await library.listLibrarySlides());
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.post(BASE, authenticateAdmin, validateBody(createLibrarySlideSchema), async (req, res) => {
    try {
        const slide = await library.createLibrarySlide({
            name: req.body.name,
            slideCanvas: req.body.slide_canvas,
            creatorRole: req.user?.role,
            creatorUserId: req.user?.userId ?? null
        });
        logger.info('Diapositiva libre guardada en la biblioteca', { id: slide.id, userId: req.user?.userId });
        res.status(201).json(slide);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.patch(`${BASE}/:id`, authenticateAdmin, validateBody(renameLibrarySlideSchema), async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return invalidId(res);
    try {
        const slide = await library.renameLibrarySlide(id, req.body.name, actorOf(req));
        if (!slide) return handleNotFound(res);
        res.json(slide);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.delete(`${BASE}/:id`, authenticateAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return invalidId(res);
    try {
        const deleted = await library.deleteLibrarySlide(id, actorOf(req));
        if (!deleted) return handleNotFound(res);
        logger.info('Diapositiva libre borrada de la biblioteca', { id, userId: req.user?.userId });
        res.json({ success: true });
    } catch (err) {
        handleRouteError(err, res);
    }
});

module.exports = router;
