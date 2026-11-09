/**
 * @fileoverview Gestión de archivos del panel de administración: limpieza de huérfanos de /uploads.
 * Montado desde routes/admin.routes.js.
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const { pool } = require('../config/database');
const logger = require('../config/logger');

const { sendFailure } = require('./helpers/admin-auth-helpers');

const router = express.Router();

// Referencias a ficheros de /uploads: recursos de preguntas, slides, imágenes de opciones,
// imágenes representativas de juegos y diapositivas libres (juegos y biblioteca)
const UPLOAD_REFERENCE_QUERIES = [
    'SELECT DISTINCT url_recurso AS ref FROM questions WHERE url_recurso IS NOT NULL',
    'SELECT DISTINCT slide_image AS ref FROM custom_game_questions WHERE slide_image IS NOT NULL',
    'SELECT DISTINCT slide_video AS ref FROM custom_game_questions WHERE slide_video IS NOT NULL',
    'SELECT DISTINCT question_image_url AS ref FROM questions WHERE question_image_url IS NOT NULL',
    'SELECT DISTINCT option_image_url AS ref FROM options WHERE option_image_url IS NOT NULL',
    `SELECT image_url AS ref FROM question_banks WHERE image_url IS NOT NULL
                        UNION SELECT image_url FROM custom_games WHERE image_url IS NOT NULL
                        UNION SELECT image_url FROM games WHERE image_url IS NOT NULL
                        UNION SELECT image_url FROM trivial_games WHERE image_url IS NOT NULL`,
    `
                SELECT DISTINCT slide_canvas->'background'->>'image' AS ref
                FROM custom_game_questions
                WHERE slide_canvas IS NOT NULL AND jsonb_typeof(slide_canvas->'background') = 'object'
                AND slide_canvas->'background'->>'image' IS NOT NULL
                UNION
                SELECT e->'props'->>'src' AS ref
                FROM custom_game_questions,
                     jsonb_array_elements(slide_canvas->'elements') e
                WHERE slide_canvas IS NOT NULL AND jsonb_typeof(slide_canvas->'elements') = 'array'
                AND e->'props'->>'src' IS NOT NULL
                UNION
                SELECT e->'props'->>'url' AS ref
                FROM custom_game_questions,
                     jsonb_array_elements(slide_canvas->'elements') e
                WHERE slide_canvas IS NOT NULL AND jsonb_typeof(slide_canvas->'elements') = 'array'
                AND e->'props'->>'url' IS NOT NULL
                UNION
                SELECT slide_canvas->'background'->>'image' AS ref
                FROM canvas_slide_library
                WHERE jsonb_typeof(slide_canvas->'background') = 'object'
                AND slide_canvas->'background'->>'image' IS NOT NULL
                UNION
                SELECT e->'props'->>'src' AS ref
                FROM canvas_slide_library,
                     jsonb_array_elements(slide_canvas->'elements') e
                WHERE jsonb_typeof(slide_canvas->'elements') = 'array'
                AND e->'props'->>'src' IS NOT NULL
                UNION
                SELECT e->'props'->>'url' AS ref
                FROM canvas_slide_library,
                     jsonb_array_elements(slide_canvas->'elements') e
                WHERE jsonb_typeof(slide_canvas->'elements') = 'array'
                AND e->'props'->>'url' IS NOT NULL
            `
];

/**
 * Endpoint para limpiar archivos huérfanos en /uploads/ - SOLO ADMIN
 */
router.post('/api/uploads/cleanup', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, '../public/uploads');

        // Obtener todos los archivos en uploads
        const files = await fs.readdir(uploadsDir);

        // Filtrar archivos (excluir .gitignore y directorios)
        const uploadedFiles = [];
        for (const file of files) {
            if (file === '.gitignore') continue;

            const filePath = path.join(uploadsDir, file);
            const stats = await fs.stat(filePath);
            if (stats.isFile()) {
                uploadedFiles.push(file);
            }
        }

        // Obtener todos los archivos referenciados en la base de datos
        // (recursos de preguntas, slides, imágenes de opciones e imágenes representativas de juegos)
        const results = await Promise.all(UPLOAD_REFERENCE_QUERIES.map(sql => pool.query(sql)));

        const referencedFiles = new Set();
        results
            .flatMap(r => r.rows)
            .forEach(row => {
                if (row.ref) {
                    // Extraer el nombre del archivo de la URL (formato: /uploads/filename)
                    const filename = row.ref.replace('/uploads/', '');
                    referencedFiles.add(filename);
                }
            });

        // Identificar archivos huérfanos
        const orphanedFiles = uploadedFiles.filter(file => !referencedFiles.has(file));

        // Eliminar archivos huérfanos
        const deletedFiles = [];
        for (const file of orphanedFiles) {
            const filePath = path.join(uploadsDir, file);
            await fs.unlink(filePath);
            deletedFiles.push(file);
            logger.info('Orphaned file deleted', { file, admin: req.user.role });
        }

        res.json({
            success: true,
            deleted: deletedFiles.length,
            files: deletedFiles,
            message: `${deletedFiles.length} archivo(s) huérfano(s) eliminado(s)`,
            code: 'ORPHANED_FILES_CLEANED',
            params: { count: deletedFiles.length }
        });
    } catch (error) {
        logger.error('Error cleaning orphaned files', { error: error.message });
        sendFailure(res, 500, 'Error al limpiar archivos huérfanos', 'CLEANUP_ORPHANED_FILES_FAILED');
    }
});

module.exports = router;
