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

module.exports = router;
