/**
 * @fileoverview Rutas para gestión de juegos (trivial)
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { pinValidationLimiter } = require('../middlewares/security');
const { validateUniquePIN, validateUniqueGameBanks } = require('../middlewares/validators');
const { checkUsageBeforeDelete } = require('./helpers/DeleteHelpers');
const { schemas, validateBody } = require('../validation');
const dbService = require('../services/db.service');
const { handleRouteError, handleNotFound, handleBusinessError } = require('./helpers/RouteErrorHandler');

const router = express.Router();

router.get('/api/games', authenticateAdmin, async (req, res) => {
    try {
        if (req.query.page !== undefined || req.query.limit !== undefined) {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
            return res.json(await dbService.getAllGamesPaginated({ page, limit }));
        }
        const result = await dbService.getAllGames();
        res.json(result);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.post('/api/games', authenticateAdmin, validateBody(schemas.game), validateUniqueGameBanks, validateUniquePIN('game'), async (req, res) => {
    try {
        const payload = {
            ...req.body,
            created_by_role: req.user?.role,
            created_by_user_id: req.user?.userId
        };
        const game = await dbService.createGame(payload);
        res.status(201).json(game);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get('/api/games/:id', authenticateAdmin, async (req, res) => {
    try {
        const result = await dbService.getGameWithBanks(req.params.id);
        if (!result) return handleNotFound(res);
        res.json(result);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.put('/api/games/:id', authenticateAdmin, validateBody(schemas.game), validateUniqueGameBanks, validateUniquePIN('game'), async (req, res) => {
    try {
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        const result = await dbService.updateGame(req.params.id, req.body, actorUserId);
        if (!result.success) {
            return handleBusinessError(res, result.error);
        }
        res.json({ success: true });
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.delete('/api/games/:id', authenticateAdmin, checkUsageBeforeDelete('game'), async (req, res) => {
    try {
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        await dbService.deleteGame(req.params.id, actorUserId);
        res.json({ message: 'Juego eliminado', code: 'GAME_DELETED' });
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get('/api/games/validate-pin/:pin', pinValidationLimiter, async (req, res) => {
    try {
        const excludeId = req.query.excludeId;
        const exists = await dbService.gamePinExists(req.params.pin, excludeId);
        res.json({ exists });
    } catch (err) {
        handleRouteError(err, res);
    }
});

module.exports = router;
