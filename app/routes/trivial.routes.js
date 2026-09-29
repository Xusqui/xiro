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
const {
    validateRandomPointsConfig,
    MIN_VALUE: RANDOM_POINTS_MIN,
    MAX_VALUE: RANDOM_POINTS_MAX
} = require('../application/validators/RandomPointsValidator');

const router = express.Router();

const RANDOM_POINTS_MESSAGES = {
    'random-points-not-integer': 'Los puntos mínimo y máximo de la puntuación aleatoria deben ser números enteros',
    'random-points-out-of-range': `Los puntos de la puntuación aleatoria deben estar entre ${RANDOM_POINTS_MIN} y ${RANDOM_POINTS_MAX}`,
    'random-points-inverted-range': 'El máximo de puntuación aleatoria debe ser mayor o igual que el mínimo'
};

// Trivial no valida con Joi; usa el mismo validador compartido que el resto de tipos de juego
function validateRandomPoints(req, res) {
    const result = validateRandomPointsConfig(req.body);
    if (result.valid) return true;

    res.status(400).json({
        error: 'Puntuación aleatoria inválida',
        message: RANDOM_POINTS_MESSAGES[result.code],
        code: result.code,
        params: { field: result.field }
    });
    return false;
}

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

router.post('/api/trivial-games/visibility-all', authenticateAdmin, async (req, res) => {
    try {
        const { visible } = req.body;
        if (typeof visible !== 'boolean') {
            return res.status(400).json({ error: 'El campo "visible" debe ser booleano', code: 'INVALID_VISIBLE' });
        }
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        const result = await dbService.setAllVisibleToPresenter('trivial', visible, actorUserId);
        res.json({ success: true, updated: result.updated });
    } catch (err) { handleRouteError(err, res); }
});

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
        if (!validateRandomPoints(req, res)) return;
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
        if (!validateRandomPoints(req, res)) return;
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
