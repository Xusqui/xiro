/**
 * @fileoverview Rutas API del módulo de generación con IA
 * Reutiliza: authenticateAdmin (middlewares/auth),
 *            handleRouteError (routes/helpers/RouteErrorHandler),
 *            logger (config/logger)
 *
 * Multer para documentos configurado aquí (memoryStorage, separado del multer
 * de multimedia que está en config/multer.js para no modificarlo).
 */

const express = require('express');
const multer = require('multer');
const { authenticateAdmin } = require('../middlewares/auth');
const { handleRouteError } = require('../routes/helpers/RouteErrorHandler');
const { extractText } = require('./document-parser');
const { generateBank } = require('./controller');
const { checkAIStatus } = require('./ai-client');
const logger = require('../config/logger');

const router = express.Router();

// Multer exclusivo para documentos: memoria, máx 10 MB
const documentUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'text/plain'
        ];
        const ext = file.originalname.split('.').pop().toLowerCase();
        const allowedExt = ['pdf', 'docx', 'doc', 'txt'];
        if (allowed.includes(file.mimetype) || allowedExt.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo no permitido: ${file.mimetype}. Use PDF, DOCX o TXT.`), false);
        }
    }
});

/**
 * GET /api/ai-generator/status
 * Comprueba disponibilidad del proveedor de IA.
 */
router.get('/api/ai-generator/status', authenticateAdmin, (req, res) => {
    try {
        res.json(checkAIStatus());
    } catch (err) {
        handleRouteError(err, res);
    }
});

/**
 * POST /api/ai-generator/upload
 * Extrae texto de un documento (PDF/DOCX/TXT).
 * Body: multipart/form-data con campo "document"
 * Respuesta: { text: string, wordCount: number }
 */
router.post('/api/ai-generator/upload', authenticateAdmin, documentUpload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ningún documento', code: 'NO_DOCUMENT_PROVIDED' });
        }
        const text = await extractText(req.file);
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'No se pudo extraer texto del documento (está vacío o protegido)', code: 'DOCUMENT_TEXT_EXTRACTION_FAILED' });
        }
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        logger.info('[ai-generator] Documento procesado', { wordCount, mime: req.file.mimetype });
        res.json({ text, wordCount });
    } catch (err) {
        logger.error('[ai-generator] Error extrayendo texto', err);
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/ai-generator/generate
 * Genera un banco de preguntas con IA.
 * Body: { text: string, config: { name, quiz, survey, ..., dificultad } }
 * Respuesta: { bankPayload, results, totalGenerated }
 */
router.post('/api/ai-generator/generate', authenticateAdmin, (req, res, next) => {
    // Timeout extendido para procesar documentos largos sobre APIS con Rate Limit
    req.socket.setTimeout(0);
    res.setTimeout(0);
    next();
}, async (req, res) => {
    const { text, config, mode = 'document' } = req.body;

    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'El campo "text" es obligatorio', code: 'AI_TEXT_FIELD_REQUIRED' });
    }
    if (!config || typeof config !== 'object' || !config.name) {
        return res.status(400).json({ error: 'El campo "config" debe incluir al menos "name"', code: 'AI_CONFIG_NAME_REQUIRED' });
    }

    try {
        // Enviar cabeceras JSON para la respuesta
        res.setHeader('Content-Type', 'application/json');

        // Anti-Timeout para proxies (Nginx, Synology) que cortan a los 60s sin inactividad:
        const keepAliveInterval = setInterval(() => {
            res.write(' ');
            // Importante: hacer un flush de red si el método existe en el socket (Node/Express internals)
            if (res.flushHeaders) res.flushHeaders();
        }, 15000);

        // Control de cancelación si el cliente desconecta
        const abortController = new AbortController();
        req.on('close', () => {
            clearInterval(keepAliveInterval);
            abortController.abort();
        });

        const result = await generateBank(text, config, abortController.signal, mode);

        clearInterval(keepAliveInterval);
        if (!abortController.signal.aborted) {
            res.end(JSON.stringify(result));
        }
    } catch (err) {
        // Si no se han enviado cabeceras, enviamos el error normal.
        // Si ya se enviaron, mandamos el error dentro de JSON (cuidado con el JSON en ese caso)
        logger.error('[ai-generator] Error generando banco', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        } else {
            res.end(JSON.stringify({ error: err.message }));
        }
    }
});

module.exports = router;
