/**
 * @fileoverview Rutas para consulta de PINs
 */

const express = require('express');
const dbService = require('../services/db.service');
const { handleRouteError } = require('./helpers/RouteErrorHandler');
const { authenticateAdmin } = require('../middlewares/auth');
const { presenterPinsLimiter } = require('../middlewares/security');

const router = express.Router();

router.get('/api/all-pins', authenticateAdmin, async (req, res) => {
    try {
        const pins = await dbService.getAllPins();
        res.json(pins);
    } catch (err) {
        handleRouteError(err, res);
    }
});

const MIN_SEARCH_LENGTH = 3;
const MAX_SEARCH_LENGTH = 100;

// Minúsculas y sin acentos, para que "matematicas" encuentre "Matemáticas"
function normalizeSearch(value) {
    return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Filtra por PIN o nombre según ?q=; sin q (o con menos de 3 caracteres) devuelve todo. */
function filterPinsBySearch(pins, rawQuery) {
    const query = typeof rawQuery === 'string'
        ? normalizeSearch(rawQuery.slice(0, MAX_SEARCH_LENGTH))
        : '';
    if (query.length < MIN_SEARCH_LENGTH) return pins;
    return pins.filter(p => normalizeSearch(p.pin).includes(query) || normalizeSearch(p.name).includes(query));
}

router.get('/api/presenter-pins', presenterPinsLimiter, async (req, res) => {
    try {
        const pins = await dbService.getPinsForPresenter();
        res.json(filterPinsBySearch(pins, req.query.q));
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get('/api/ui-settings/standalone-games', presenterPinsLimiter, async (req, res) => {
    try {
        const pins = await dbService.getPinsForPresenter();
        // Transformar formato para Standalone
        const games = filterPinsBySearch(pins || [], req.query.q).map(pin => ({
            pin: pin.pin,
            name: pin.name || pin.pin,
            type: pin.type || 'bank',
            language: pin.language || null,
            questionCount: pin.question_count || 0,
            imageUrl: pin.image_url || null
        }));
        res.json({ games });
    } catch (err) {
        handleRouteError(err, res);
    }
});

module.exports = router;
