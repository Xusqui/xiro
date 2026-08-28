/**
 * @fileoverview API routes for Trivial Pursuit game type
 * @module routes/trivial.routes
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { pinValidationLimiter } = require('../middlewares/security');
const { handleRouteError, handleNotFound } = require('./helpers/RouteErrorHandler');
const dbService = require('../services/db');
const { SUPPORTED_LANGUAGES } = require('../config/languages');

const router = express.Router();

function validateLanguage(req, res) {
    const { language } = req.body;
    if (!SUPPORTED_LANGUAGES.includes(language)) {
        res.status(400).json({
            error: 'Idioma inválido',
            message: `El campo "language" debe ser uno de: ${SUPPORTED_LANGUAGES.join(', ')}`,
            code: 'LANGUAGE_INVALID'
        });
        return false;
    }
    return true;
}

// ========== LIST & GET ==========

router.get('/api/trivial-games', authenticateAdmin, async (req, res) => {
    try {
        const games = await dbService.getAllTrivialGames();
        res.json(games);
    } catch (err) { handleRouteError(err, res); }
});

router.get('/api/trivial-games/:id', authenticateAdmin, async (req, res) => {
    try {
        const result = await dbService.getTrivialGameById(req.params.id);
        if (!result) return handleNotFound(res);
        res.json(result);
    } catch (err) { handleRouteError(err, res); }
});

// ========== CREATE ==========

router.post('/api/trivial-games', authenticateAdmin, async (req, res) => {
    try {
        if (!validateLanguage(req, res)) return;
        const { pin } = req.body;
        if (pin) {
            const conflict = await dbService.pinExistsGlobally(pin, { excludeType: 'trivial' });
            if (conflict?.exists) {
                return res.status(400).json({
                    error: 'PIN duplicado',
                    message: `El PIN "${pin}" ya está en uso. Los PINs deben ser únicos.`,
                    code: 'PIN_DUPLICATE',
                    params: { pin }
                });
            }
        }
        const payload = {
            ...req.body,
            created_by_role: req.user?.role,
            created_by_user_id: req.user?.userId
        };
        const game = await dbService.createTrivialGame(payload);
        res.status(201).json(game);
    } catch (err) { handleRouteError(err, res); }
});

// ========== UPDATE ==========

router.put('/api/trivial-games/:id', authenticateAdmin, async (req, res) => {
    try {
        if (!validateLanguage(req, res)) return;
        const { pin } = req.body;
        if (pin) {
            const conflict = await dbService.pinExistsGlobally(pin, {
                excludeType: 'trivial',
                excludeId: parseInt(req.params.id)
            });
            if (conflict?.exists) {
                return res.status(400).json({
                    error: 'PIN duplicado',
                    message: `El PIN "${pin}" ya está en uso. Los PINs deben ser únicos.`,
                    code: 'PIN_DUPLICATE',
                    params: { pin }
                });
            }
        }
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        const result = await dbService.updateTrivialGame(req.params.id, req.body, actorUserId);
        if (!result.success) return res.status(400).json({ error: result.error });
        res.json({ success: true });
    } catch (err) { handleRouteError(err, res); }
});

// ========== DELETE ==========

router.delete('/api/trivial-games/:id', authenticateAdmin, async (req, res) => {
    try {
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        await dbService.deleteTrivialGame(req.params.id, actorUserId);
        res.json({ message: 'Trivial eliminado', code: 'TRIVIAL_DELETED' });
    } catch (err) { handleRouteError(err, res); }
});

// ========== VALIDATE PIN ==========

router.get('/api/trivial-games/validate-pin/:pin', pinValidationLimiter, async (req, res) => {
    try {
        const result = await dbService.validatePinInDatabase(req.params.pin);
        res.json({ exists: result.valid && result.type === 'trivial' });
    } catch (err) { handleRouteError(err, res); }
});

module.exports = router;
