/**
 * @fileoverview Router principal que orquesta todos los sub-routers de la API
 * Estructura modular por dominios: uploads, banks, games, custom-games, pins, quizzes
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const dbService = require('../services/db.service');
const { handleRouteError } = require('./helpers/RouteErrorHandler');
const router = express.Router();

// Importar sub-routers por dominio
router.use(require('./uploads.routes'));
router.use(require('./banks.routes'));
router.use(require('./games.routes'));
router.use(require('./custom-games.routes'));
router.use(require('./pins.routes'));
router.use(require('./quizzes.routes'));

/**
 * GET /api/all-games
 * Devuelve los tres tipos de juego en una sola llamada (uso del add-in PowerPoint).
 * Requiere JWT de admin o editor.
 */
router.get('/api/all-games', authenticateAdmin, async (req, res) => {
    try {
        const [banks, custom, trivial] = await Promise.all([
            dbService.getAllGames(),
            dbService.getAllCustomGames(),
            dbService.getAllTrivialGames(),
        ]);
        res.json({ banks, custom, trivial });
    } catch (err) {
        handleRouteError(err, res);
    }
});

/**
 * GET /api/presenter-game-info/:pin
 * Endpoint PÚBLICO para el add-in PowerPoint.
 * Devuelve nombre, tipo y número de preguntas de un juego visible al presentador.
 */
const { pool } = require('../config/database');
router.get('/api/presenter-game-info/:pin', async (req, res) => {
    const pin = req.params.pin.toUpperCase();
    try {
        // Juego personalizado
        const cg = await pool.query(
            `SELECT cg.id, cg.name, 'custom' AS type,
                    COUNT(cgq.id) AS question_count
             FROM custom_games cg
             LEFT JOIN custom_game_questions cgq ON cgq.custom_game_id = cg.id
             WHERE cg.pin = $1 AND cg.visible_to_presenter = true
             GROUP BY cg.id`, [pin]);
        if (cg.rows.length) {
            return res.json({ pin, name: cg.rows[0].name, type: 'custom', questionCount: parseInt(cg.rows[0].question_count, 10) });
        }
        // Banco de preguntas
        const bk = await pool.query(
            `SELECT qb.id, qb.name, 'bank' AS type,
                    COUNT(q.id) AS question_count
             FROM question_banks qb
             LEFT JOIN questions q ON q.bank_id = qb.id
             WHERE qb.pin = $1 AND qb.visible_to_presenter = true
             GROUP BY qb.id`, [pin]);
        if (bk.rows.length) {
            return res.json({ pin, name: bk.rows[0].name, type: 'bank', questionCount: parseInt(bk.rows[0].question_count, 10) });
        }
        // Trivial
        const tr = await pool.query(
            `SELECT tg.id, tg.name, 'trivial' AS type,
                    COUNT(tq.id) AS question_count
             FROM trivial_games tg
             LEFT JOIN trivial_questions tq ON tq.trivial_game_id = tg.id
             WHERE tg.pin = $1 AND tg.visible_to_presenter = true
             GROUP BY tg.id`, [pin]);
        if (tr.rows.length) {
            return res.json({ pin, name: tr.rows[0].name, type: 'trivial', questionCount: parseInt(tr.rows[0].question_count, 10) });
        }
        return res.status(404).json({ error: 'PIN no encontrado o no visible al presentador', code: 'PRESENTER_PIN_NOT_VISIBLE' });
    } catch (err) {
        handleRouteError(err, res);
    }
});

/**
 * GET /api/presenter-game-questions/:pin
 * Endpoint PÚBLICO para el add-in PowerPoint.
 * Devuelve las preguntas (sin respuestas correctas) para pre-popular las diapositivas
 * en modo edición antes de iniciar la presentación.
 */
router.get('/api/presenter-game-questions/:pin', async (req, res) => {
    const pin = req.params.pin.toUpperCase();
    try {
        // Juego personalizado — preguntas ordenadas por posición
        const cg = await pool.query(
            `SELECT id FROM custom_games WHERE pin = $1 AND visible_to_presenter = true`,
            [pin]
        );
        if (cg.rows.length) {
            const qr = await pool.query(
                `SELECT q.question_text, q.question_type, q.time_limit,
                    json_agg(
                        json_build_object('text', o.option_text, 'optionText', o.option_text)
                        ORDER BY COALESCE(o.order_index, o.id)
                    ) FILTER (WHERE o.id IS NOT NULL) AS options
                 FROM custom_game_questions cgq
                 JOIN questions q ON cgq.question_id = q.id
                 LEFT JOIN options o ON o.question_id = q.id
                 WHERE cgq.custom_game_id = $1
                 GROUP BY cgq.position, q.id, q.question_text, q.question_type, q.time_limit
                 ORDER BY cgq.position`,
                [cg.rows[0].id]
            );
            return res.json({ questions: qr.rows });
        }
        // Banco de preguntas — preguntas ordenadas por id (el orden real se define al iniciar)
        const bk = await pool.query(
            `SELECT id FROM question_banks WHERE pin = $1 AND visible_to_presenter = true`,
            [pin]
        );
        if (bk.rows.length) {
            const qr = await pool.query(
                `SELECT q.question_text, q.question_type, q.time_limit,
                    json_agg(
                        json_build_object('text', o.option_text, 'optionText', o.option_text)
                        ORDER BY COALESCE(o.order_index, o.id)
                    ) FILTER (WHERE o.id IS NOT NULL) AS options
                 FROM questions q
                 LEFT JOIN options o ON o.question_id = q.id
                 WHERE q.bank_id = $1
                 GROUP BY q.id, q.question_text, q.question_type, q.time_limit
                 ORDER BY q.id`,
                [bk.rows[0].id]
            );
            return res.json({ questions: qr.rows });
        }
        return res.status(404).json({ error: 'PIN no encontrado o no visible al presentador', code: 'PRESENTER_PIN_NOT_VISIBLE' });
    } catch (err) {
        handleRouteError(err, res);
    }
});

module.exports = router;
