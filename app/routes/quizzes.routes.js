/**
 * @fileoverview Rutas para gestión de quizzes (compatibilidad legacy)
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { pinValidationLimiter } = require('../middlewares/security');
const dbService = require('../services/db.service');
const { handleRouteError, handleNotFound } = require('./helpers/RouteErrorHandler');
const logger = require('../config/logger');

const router = express.Router();

router.get('/api/quizzes', authenticateAdmin, async (req, res) => {
    try {
        const quizzes = await dbService.getAllQuizzes();
        res.json(quizzes);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.post('/api/quizzes', authenticateAdmin, async (req, res) => {
    try {
        const payload = {
            ...req.body,
            created_by_role: req.user?.role,
            created_by_user_id: req.user?.userId
        };
        const quiz = await dbService.createQuiz(payload);
        res.status(201).json(quiz);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get('/api/quizzes/:id', authenticateAdmin, async (req, res) => {
    try {
        const result = await dbService.getQuizWithQuestions(req.params.id);
        if (!result) return handleNotFound(res);
        res.json(result);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.delete('/api/quizzes/:id', authenticateAdmin, async (req, res) => {
    try {
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        await dbService.deleteQuiz(req.params.id, actorUserId);
        res.json({ message: 'Cuestionario eliminado', code: 'QUIZ_DELETED' });
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.post('/api/quizzes/save-all', authenticateAdmin, async (req, res) => {
    try {
        const payload = req.body.id
            ? req.body
            : {
                ...req.body,
                created_by_role: req.user?.role,
                created_by_user_id: req.user?.userId
            };
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        const result = await dbService.saveQuizComplete(payload, actorUserId);
        res.json(result);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get('/api/quizzes/validate/:pin', pinValidationLimiter, async (req, res) => {
    try {
        const pinToValidate = req.params.pin;
        logger.debug(`Validando PIN: "${pinToValidate}"`);

        const pinValidation = await dbService.validatePinInDatabase(pinToValidate);
        logger.debug(`Resultado final: ${pinValidation.valid ? 'PIN VÁLIDO' : 'PIN NO VÁLIDO'}`);

        res.json({
            exists: pinValidation.valid,
            gameType: pinValidation.type
        });
    } catch (err) {
        logger.error('Error validando PIN:', err.message);
        handleRouteError(err, res);
    }
});

module.exports = router;
