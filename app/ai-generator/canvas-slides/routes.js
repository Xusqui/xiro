'use strict';

/**
 * @fileoverview POST /api/ai-generator/canvas-slides: diapositivas libres diseñadas por la IA a partir de una
 * descripción o de un documento ya convertido a Markdown (POST /api/ai-generator/upload), con imágenes opcionales
 * ya subidas a /uploads/ (POST /api/upload).
 * Body: { prompt?, document?, count?: 1-10, theme?: 'auto'|estilo, language?, images?: [{ url, name }] }
 * Respuesta: { slides: [{ slide_type: 'canvas', slide_canvas }], warnings, theme, provider, layouts }, el mismo
 * formato que POST /api/canvas-slides/import (el admin decide si van al editor o al final del juego).
 * Como en /api/ai-generator/generate, se envían espacios cada 15 s para que el proxy no corte la espera;
 * por eso un error a mitad llega con estado 200 y { error, code } en el cuerpo.
 */

const express = require('express');
const { authenticateAdmin } = require('../../middlewares/auth');
const { generateCanvasSlides } = require('./generator');
const { MAX_REQUEST_CHARS } = require('./prompt');
const { MAX_ATTACHED } = require('./media');
const logger = require('../../config/logger');

const router = express.Router();
const MAX_DOCUMENT_CHARS = 300000;
const KEEP_ALIVE_MS = 15000;
const UPLOAD_URL_RE = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

/** Error de validación de la petición, o null si vale. */
function requestError(prompt, document) {
    if (!prompt && !document) return { error: 'Describe las diapositivas o adjunta un documento', code: 'AI_CANVAS_PROMPT_REQUIRED' };
    if (prompt.length > MAX_REQUEST_CHARS || document.length > MAX_DOCUMENT_CHARS) {
        return { error: 'La descripción o el documento son demasiado largos', code: 'AI_CANVAS_PROMPT_TOO_LONG' };
    }
    return null;
}

/** Imágenes adjuntas que valen: como mucho MAX_ATTACHED, con URL de /uploads/ y nombre corto. */
function attachedImages(value) {
    return (Array.isArray(value) ? value : [])
        .filter(img => img && typeof img.url === 'string' && UPLOAD_URL_RE.test(img.url))
        .slice(0, MAX_ATTACHED)
        .map(img => ({ url: img.url, name: typeof img.name === 'string' ? img.name.slice(0, 120) : '' }));
}

router.post('/api/ai-generator/canvas-slides', authenticateAdmin, async (req, res) => {
    const body = req.body || {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const document = typeof body.document === 'string' ? body.document.trim() : '';
    const invalid = requestError(prompt, document);
    if (invalid) return res.status(400).json(invalid);

    req.socket.setTimeout(0);
    res.setTimeout(0);
    res.setHeader('Content-Type', 'application/json');
    const abort = new AbortController();
    const keepAlive = setInterval(() => res.write(' '), KEEP_ALIVE_MS);
    // En Node moderno, req 'close' ya no avisa de que el cliente se ha ido: se mira la respuesta
    res.on('close', () => {
        clearInterval(keepAlive);
        if (!res.writableEnded) abort.abort();
    });
    try {
        const images = attachedImages(body.images);
        const result = await generateCanvasSlides({ ...body, prompt, document, images, signal: abort.signal });
        logger.info('[ai-generator] Diapositivas libres generadas con IA', {
            slides: result.slides.length,
            layouts: result.layouts,
            theme: result.theme,
            provider: result.provider,
            warnings: result.warnings.length,
            userId: req.user?.userId
        });
        if (!abort.signal.aborted) res.end(JSON.stringify(result));
    } catch (err) {
        const fail = { error: err.message, code: err.code || 'AI_CANVAS_GENERATION_FAILED' };
        if (err.status) logger.warn('[ai-generator] Diapositivas con IA sin resultado', fail);
        else logger.error('[ai-generator] Error generando diapositivas con IA', { error: err.message, stack: err.stack });
        if (!res.headersSent) res.status(err.status || 500).json(fail);
        else if (!abort.signal.aborted) res.end(JSON.stringify(fail));
    } finally {
        clearInterval(keepAlive);
    }
});

module.exports = router;
