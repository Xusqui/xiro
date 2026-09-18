/**
 * @fileoverview Rutas para gestión de juegos personalizados
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { validateUniquePIN } = require('../middlewares/validators');
const { checkUsageBeforeDelete } = require('./helpers/DeleteHelpers');
const { schemas, validateBody } = require('../validation');
const dbService = require('../services/db.service');
const { handleRouteError, handleNotFound, handleBusinessError } = require('./helpers/RouteErrorHandler');
const logger = require('../config/logger');
const pdfService = require('../services/pdf.service');
const { pool } = require('../config/database');

const router = express.Router();

router.post('/api/custom-games/visibility-all', authenticateAdmin, async (req, res) => {
    try {
        const { visible } = req.body;
        if (typeof visible !== 'boolean') {
            return res.status(400).json({ error: 'El campo "visible" debe ser booleano', code: 'INVALID_VISIBLE' });
        }
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        const result = await dbService.setAllVisibleToPresenter('custom_game', visible, actorUserId);
        res.json({ success: true, updated: result.updated });
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get('/api/custom-games', authenticateAdmin, async (req, res) => {
    try {
        if (req.query.page !== undefined || req.query.limit !== undefined) {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
            return res.json(await dbService.getAllCustomGamesPaginated({ page, limit }));
        }
        const result = await dbService.getAllCustomGames();
        res.json(result);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.post('/api/custom-games', authenticateAdmin, validateBody(schemas.createCustomGame), validateUniquePIN('custom_game'), async (req, res) => {
    try {
        const payload = {
            ...req.body,
            created_by_role: req.user?.role,
            created_by_user_id: req.user?.userId
        };
        const customGame = await dbService.createCustomGame(payload);
        res.status(201).json(customGame);
    } catch (err) {
        if (err.code === '23505') { // Unique violation
            res.status(400).json({ error: 'El PIN ya está en uso', code: 'PIN_DUPLICATE' });
        } else {
            handleRouteError(err, res);
        }
    }
});

router.get('/api/custom-games/:id', authenticateAdmin, async (req, res) => {
    try {
        const result = await dbService.getCustomGameWithQuestions(req.params.id);
        if (!result) return handleNotFound(res);
        res.json(result);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.put('/api/custom-games/:id', authenticateAdmin, validateBody(schemas.updateCustomGame), validateUniquePIN('custom_game'), async (req, res) => {
    try {
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        const result = await dbService.updateCustomGame(req.params.id, req.body, actorUserId);
        if (!result.success) {
            return handleBusinessError(res, result.error);
        }
        res.json({ success: true });
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.delete('/api/custom-games/:id', authenticateAdmin, checkUsageBeforeDelete('custom_game'), async (req, res) => {
    try {
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        await dbService.deleteCustomGame(req.params.id, actorUserId);
        res.json({ message: 'Juego personalizado eliminado', code: 'CUSTOM_GAME_DELETED' });
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get('/api/custom-games/:id/export-pdf', authenticateAdmin, async (req, res) => {
    try {
        const gameData = await dbService.getCustomGameWithQuestions(req.params.id);

        if (!gameData) {
            return res.status(404).json({ error: 'Juego no encontrado', code: 'GAME_NOT_FOUND' });
        }

        await pdfService.generateQuizPDF(gameData, res);
    } catch (err) {
        logger.error('Error generando PDF:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error al generar el PDF', code: 'PDF_GENERATION_FAILED' });
        }
    }
});

router.post('/api/custom-games/:id/questions', authenticateAdmin, async (req, res) => {
    const { question_id, position } = req.body;
    try {
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        await dbService.assertEditorCanModifyResource('custom_game', req.params.id, actorUserId);

        await pool.query(
            'UPDATE custom_game_questions SET position = position + 1 WHERE custom_game_id = $1 AND position >= $2',
            [req.params.id, position]
        );

        const result = await pool.query(
            'INSERT INTO custom_game_questions (custom_game_id, question_id, position) VALUES ($1, $2, $3) RETURNING *',
            [req.params.id, question_id, position]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.delete('/api/custom-games/:id/questions/:questionId', authenticateAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        await dbService.assertEditorCanModifyResource('custom_game', req.params.id, actorUserId);

        await client.query('BEGIN');

        const questionPos = await client.query(
            'SELECT position FROM custom_game_questions WHERE custom_game_id = $1 AND question_id = $2',
            [req.params.id, req.params.questionId]
        );

        if (questionPos.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Pregunta no encontrada', code: 'QUESTION_NOT_FOUND' });
        }

        await client.query(
            'DELETE FROM custom_game_questions WHERE custom_game_id = $1 AND question_id = $2',
            [req.params.id, req.params.questionId]
        );

        await client.query(
            'UPDATE custom_game_questions SET position = position - 1 WHERE custom_game_id = $1 AND position > $2',
            [req.params.id, questionPos.rows[0].position]
        );

        await client.query('COMMIT');
        res.json({ message: 'Pregunta eliminada', code: 'QUESTION_DELETED' });
    } catch (err) {
        await client.query('ROLLBACK');
        handleRouteError(err, res);
    } finally {
        client.release();
    }
});

module.exports = router;
