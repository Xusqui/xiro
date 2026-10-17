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
const { documentToMarkdown } = require('./markdown');
const { generateBank } = require('./controller');
const { checkAIStatus } = require('./ai-client');
const logger = require('../config/logger');

const router = express.Router();

// Formatos que el conversor a Markdown (./markdown) sabe leer
const ALLOWED_MIME = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.presentation',
    'application/epub+zip',
    'application/rtf', 'text/rtf',
    'text/html', 'application/xhtml+xml',
    'text/markdown', 'text/x-markdown',
    'application/msword',
    'text/plain'
];
const ALLOWED_EXT = ['pdf', 'docx', 'doc', 'odt', 'odp', 'pptx', 'epub', 'rtf', 'html', 'htm', 'xhtml', 'md', 'markdown', 'txt'];
const FORMATS_LABEL = 'PDF, DOCX, ODT, PPTX, ODP, EPUB, RTF, HTML, MD o TXT';

// Multer exclusivo para documentos: memoria, máx 10 MB
const documentUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = file.originalname.split('.').pop().toLowerCase();
        if (ALLOWED_MIME.includes(file.mimetype) || ALLOWED_EXT.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo no permitido: ${file.mimetype}. Use ${FORMATS_LABEL}.`), false);
        }
    }
});

/** Nombre del fichero para el log (acotado). */
function fileLabel(file) {
    return String((file && file.originalname) || '').slice(0, 120);
}

/**
 * Log de una conversión: resumen en info y detalle por fases en debug.
 * Nunca se registra el contenido del documento, solo cifras.
 */
function logConversion(file, result, wordCount) {
    const { stats = {}, format, fallback } = result;
    logger.info('[ai-generator] Documento convertido a Markdown', {
        file: fileLabel(file), mime: file.mimetype, format, fallback, bytes: stats.bytes,
        ms: stats.ms, rawChars: stats.rawChars, chars: stats.mdChars, wordCount
    });
    logger.debug('[ai-generator] Detalle de la conversión', { file: fileLabel(file), ...stats });
}

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
 * Convierte un documento a Markdown (PDF, DOCX, ODT, PPTX, ODP, EPUB, RTF, HTML, MD, TXT)
 * para que la IA reciba solo el contenido con su estructura, sin ruido.
 * Body: multipart/form-data con campo "document"
 * Respuesta: { text: string (Markdown), wordCount: number, format: string }
 */
router.post('/api/ai-generator/upload', authenticateAdmin, documentUpload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ningún documento', code: 'NO_DOCUMENT_PROVIDED' });
        }
        const result = await documentToMarkdown(req.file, {
            legacyExtract: extractText,
            onFallback: err => logger.warn('[ai-generator] Conversor Markdown falló, se usa el extractor de texto', {
                file: fileLabel(req.file), error: err.message, stack: err.stack
            })
        });
        const { markdown: text, format } = result;
        if (!text || text.trim().length === 0) {
            logger.warn('[ai-generator] Documento sin texto extraíble', { file: fileLabel(req.file), format, bytes: req.file.size });
            return res.status(400).json({ error: 'No se pudo extraer texto del documento (está vacío o protegido)', code: 'DOCUMENT_TEXT_EXTRACTION_FAILED' });
        }
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        logConversion(req.file, result, wordCount);
        res.json({ text, wordCount, format });
    } catch (err) {
        // Rechazos esperables (.doc antiguo, hoja de cálculo, cifrado…) en warn; fallos internos en error con traza
        const meta = { file: fileLabel(req.file), mime: req.file && req.file.mimetype, bytes: req.file && req.file.size, error: err.message };
        if (err.definitive) logger.warn('[ai-generator] Documento rechazado', meta);
        else logger.error('[ai-generator] Error convirtiendo documento', { ...meta, stack: err.stack });
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
