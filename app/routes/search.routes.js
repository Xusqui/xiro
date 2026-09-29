/**
 * @fileoverview Rutas de búsqueda global de preguntas
 * @module routes/search.routes
 *
 * Expone: GET /api/questions/search?q=texto
 * Busca en todos los bancos simultáneamente.
 * Requiere autenticación de administrador.
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { handleRouteError } = require('./helpers/RouteErrorHandler');
const { searchQuestions } = require('../services/db/search.service');

const router = express.Router();

/**
 * GET /api/questions/search?q=texto
 *
 * Parámetros:
 *   q  (string) — texto a buscar (mínimo 2 caracteres)
 *
 * Respuesta: Array de preguntas con campos:
 *   id, question_text, question_type, bank_id, bank_name, options, ...
 */
router.get('/api/questions/search', authenticateAdmin, async (req, res) => {
    const query = (req.query.q || '').trim();

    try {
        if (query.length < 2) {
            return res.json([]);
        }

        const results = await searchQuestions(query);
        res.json(results);
    } catch (err) {
        handleRouteError(err, res);
    }
});

module.exports = router;
