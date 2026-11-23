'use strict';

/**
 * @fileoverview POST /api/ai-generator/music-song: canción para la pestaña «Música» del admin.
 * Body: { prompt: string (1-500), provider?: 'groq'|'gemini'|'ollama', model?: string }
 * Respuesta: { title, tempo, song: { tonic, mode, chords, motif? }, provider, model, attempts }. El admin
 * rellena la rejilla con ella; no se guarda nada hasta que pulsa «Guardar».
 * Como en las diapositivas con IA, se envían espacios cada 15 s para que el proxy no corte la espera, por
 * eso un error a mitad llega con estado 200 y { error, code } en el cuerpo.
 */

const express = require('express');
const { authenticateAdmin } = require('../../middlewares/auth');
const { generateMusicSong } = require('./generator');
const logger = require('../../config/logger');

const router = express.Router();
const MAX_PROMPT_CHARS = 500;
const KEEP_ALIVE_MS = 15000;
const PROVIDERS = ['groq', 'gemini', 'ollama'];
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/;

/** Error de validación de la petición, o null si vale. */
function requestError({ prompt, provider, model }) {
    if (!prompt) return { error: 'Describe el tema que quieres', code: 'AI_MUSIC_PROMPT_REQUIRED' };
    if (prompt.length > MAX_PROMPT_CHARS) return { error: 'La descripción es demasiado larga', code: 'AI_MUSIC_PROMPT_TOO_LONG' };
    if (provider !== undefined && !PROVIDERS.includes(provider)) return { error: 'Proveedor de IA no válido', code: 'AI_MUSIC_PROVIDER_INVALID' };
    if (model !== undefined && !MODEL_RE.test(model)) return { error: 'Nombre de modelo no válido', code: 'AI_MUSIC_MODEL_INVALID' };
    return null;
}

function readRequest(body) {
    const source = body || {};
    return {
        prompt: typeof source.prompt === 'string' ? source.prompt.trim() : '',
        provider: typeof source.provider === 'string' && source.provider ? source.provider : undefined,
        model: typeof source.model === 'string' && source.model ? source.model : undefined
    };
}

router.post('/api/ai-generator/music-song', authenticateAdmin, async (req, res) => {
    const params = readRequest(req.body);
    const invalid = requestError(params);
    if (invalid) return res.status(400).json(invalid);

    req.socket.setTimeout(0);
    res.setTimeout(0);
    res.setHeader('Content-Type', 'application/json');
    const keepAlive = setInterval(() => res.write(' '), KEEP_ALIVE_MS);
    let clientGone = false;
    res.on('close', () => {
        clearInterval(keepAlive);
        clientGone = !res.writableEnded;
    });
    try {
        const result = await generateMusicSong(params);
        logger.info('[ai-generator] Canción generada con IA', { provider: result.provider, attempts: result.attempts, userId: req.user?.userId });
        if (!clientGone) res.end(JSON.stringify(result));
    } catch (err) {
        const fail = { error: err.message, code: err.code || 'AI_MUSIC_FAILED' };
        logger.warn('[ai-generator] Canción con IA sin resultado', fail);
        if (!res.headersSent) res.status(err.status || 500).json(fail);
        else if (!clientGone) res.end(JSON.stringify(fail));
    } finally {
        clearInterval(keepAlive);
    }
});

module.exports = router;
