'use strict';

/**
 * @fileoverview Diapositivas libres con IA: pide el contenido con el prompt de prompt.js, lo sanea (spec.js),
 * consigue las imágenes que pide (media.js: adjuntas, URL o fotos libres de Wikimedia Commons), lo maqueta
 * (build.js) y lo pasa por importSlidePackage, que valida cada lienzo como al importar un .xiroslide y guarda
 * los iconos y las fotos en /uploads/. Usa el proveedor configurado y, si falla, el de respaldo.
 */

const { callLLM, getProviderPlan } = require('../ai-client');
const { stripMarkdown } = require('../response-parser');
const { importSlidePackage } = require('../../services/slide-package/import.service');
const { buildCanvasSlidesPrompt, SYSTEM_PROMPT } = require('./prompt');
const { sanitizeDeck } = require('./spec');
const { buildPackage } = require('./build');
const { loadAttachedImages, resolveSlideImages } = require('./media');
const { THEME_NAMES, DEFAULT_THEME } = require('./themes');
const { uploadDir: DEFAULT_UPLOAD_DIR } = require('../../config/multer');
const logger = require('../../config/logger');

const MAX_SLIDES = 10;
const ATTEMPTS = 2;
const TIMEOUT = 180000;

function codedError(code, message, status) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

/** Cierra la cadena, las llaves y los corchetes que quedaron abiertos (respuesta cortada); ignora los de las cadenas. */
function closeBrackets(text) {
    const stack = [];
    let inString = false;
    let escaped = false;
    for (const ch of text) {
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
        } else if (ch === '"') inString = true;
        else if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
        else if ((ch === '}' || ch === ']') && stack.length) stack.pop();
    }
    return text + (inString ? '"' : '') + stack.reverse().join('');
}

/**
 * JSON de la respuesta; tolera bloques ```, comas sobrantes antes de } o ] y cierres que falten al final
 * (también cuando la respuesta se corta con una llave dentro de una cadena: se toma desde la primera llave).
 */
function parseJson(raw) {
    const text = String(raw || '');
    const cleaned = stripMarkdown(text);
    const noTrailing = s => s.replace(/,\s*([}\]])/g, '$1');
    const start = text.search(/[[{]/);
    const tail = start >= 0 ? text.slice(start).replace(/```\s*$/, '').trim() : cleaned;
    let firstError = null;
    for (const candidate of [cleaned, noTrailing(cleaned), closeBrackets(noTrailing(cleaned)), closeBrackets(noTrailing(tail))]) {
        try {
            return JSON.parse(candidate);
        } catch (err) {
            firstError = firstError || err;
        }
    }
    throw new Error(`JSON inválido: ${firstError.message}`);
}

function clampCount(value) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(MAX_SLIDES, Math.max(1, n)) : 1;
}

/** Diapositivas aprovechables de un proveedor, con un reintento. */
async function askProvider({ provider, prompt, count, signal }) {
    let lastError = new Error('generación cancelada');
    for (let attempt = 1; attempt <= ATTEMPTS && !(signal && signal.aborted); attempt++) {
        try {
            const raw = await callLLM(provider, prompt, SYSTEM_PROMPT, TIMEOUT, count * 450 + 500);
            const deck = sanitizeDeck(parseJson(raw), count);
            if (deck.slides.length) return deck;
            lastError = new Error('ninguna diapositiva aprovechable');
        } catch (err) {
            lastError = err;
        }
        logger.warn(`[ai-generator] Diapositivas con IA (${provider}) intento ${attempt}: ${lastError.message}`);
    }
    throw lastError;
}

/** Primero el proveedor principal y, si no saca nada, el de respaldo. */
async function askAI({ prompt, count, signal }) {
    const plan = getProviderPlan();
    if (!plan.primary) {
        throw codedError('AI_NOT_CONFIGURED', 'Proveedor de IA no configurado. Ve a Panel > IA para configurarlo.', 503);
    }
    let lastError = null;
    for (const provider of [plan.primary, plan.fallback].filter(Boolean)) {
        if (signal && signal.aborted) break;
        try {
            return { ...(await askProvider({ provider, prompt, count, signal })), provider };
        } catch (err) {
            lastError = err;
        }
    }
    const detail = lastError ? `: ${lastError.message}` : '';
    throw codedError('AI_CANVAS_GENERATION_FAILED', `La IA no ha devuelto diapositivas válidas${detail}`, 502);
}

/**
 * Genera diapositivas libres con IA.
 * @param {Object} input
 * @param {string} [input.prompt] - Lo que pide el usuario (con documento: indicaciones opcionales)
 * @param {string} [input.document] - Texto del documento (Markdown de POST /api/ai-generator/upload)
 * @param {number} [input.count] - De 1 a 10
 * @param {string} [input.theme] - 'auto' o un estilo de themes.js
 * @param {string} [input.language] - Idioma de los textos
 * @param {Array<{url: string, name?: string}>} [input.images] - Imágenes adjuntas, ya subidas a /uploads/
 * @param {AbortSignal} [input.signal]
 * @param {Object} [deps] - Para los tests: opciones de importSlidePackage ({ uploadDir, writeFile }) y de media.js
 *   ({ readFile, fetchImage, findPhoto })
 * @returns {Promise<{slides: Array, warnings: Array, theme: string, provider: string, layouts: string[]}>}
 */
async function generateCanvasSlides(input, deps = {}) {
    const count = clampCount(input.count);
    const theme = THEME_NAMES.includes(input.theme) ? input.theme : 'auto';
    const attached = await loadAttachedImages(input.images, { uploadDir: deps.uploadDir || DEFAULT_UPLOAD_DIR, readFile: deps.readFile });
    const prompt = buildCanvasSlidesPrompt({
        request: input.prompt,
        document: input.document,
        count,
        theme,
        language: input.language,
        images: attached
    });
    const deck = await askAI({ prompt, count, signal: input.signal });
    const themeName = theme !== 'auto' ? theme : deck.theme || DEFAULT_THEME;
    const media = await resolveSlideImages(deck.slides, { attached, fetchImage: deps.fetchImage, findPhoto: deps.findPhoto, signal: input.signal });
    const pkg = buildPackage(media.slides, themeName);
    const trustedUploads = attached.map(img => img.url);
    const result = await importSlidePackage(Buffer.from(JSON.stringify(pkg), 'utf8'), { ...deps, trustedUploads });
    const warnings = [...result.warnings];
    if (media.missing) warnings.push({ code: 'AI_IMAGE_NOT_FOUND', params: { n: media.missing } });
    if (result.slides.length < count) {
        warnings.push({ code: 'AI_FEWER_SLIDES', params: { n: result.slides.length, total: count } });
    }
    return {
        slides: result.slides,
        warnings,
        theme: themeName,
        provider: deck.provider,
        layouts: media.slides.map(s => s.layout)
    };
}

module.exports = { generateCanvasSlides };
