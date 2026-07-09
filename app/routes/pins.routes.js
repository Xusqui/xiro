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

router.get('/api/presenter-pins', presenterPinsLimiter, async (req, res) => {
    try {
        const pins = await dbService.getPinsForPresenter();
        res.json(pins);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get('/api/ui-settings/standalone-games', presenterPinsLimiter, async (req, res) => {
    try {
        const pins = await dbService.getPinsForPresenter();
        // Transformar formato para Standalone
        const games = (pins || []).map(pin => ({
            pin: pin.pin,
            name: pin.name || pin.pin,
            type: pin.type || 'bank',
            questionCount: pin.question_count || 0
        }));
        res.json({ games });
    } catch (err) {
        handleRouteError(err, res);
    }
});

module.exports = router;
