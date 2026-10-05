/**
 * @fileoverview Orquestador del flujo de generación de bancos de preguntas con IA
 * Reutiliza: callLLM/getProviderPlan (ai-client), parseLLMResponse (response-parser),
 *            buildQuestionsForType/buildBankPayload (schema-builder),
 *            buildXxxPrompt (prompt-builder), logger (config/logger)
 */

const { callLLM, getProviderPlan } = require('./ai-client');
const { parseLLMResponse } = require('./response-parser');
const { buildQuestionsForType, buildBankPayload } = require('./schema-builder');
const prompts = require('./prompt-builder');
const logger = require('../config/logger');

const PROMPT_BUILDERS = {
    quiz: prompts.buildQuizPrompt,
    survey: prompts.buildSurveyPrompt,
    numeric_approximation: prompts.buildNumericPrompt,
    order: prompts.buildOrderPrompt,
    word_scramble: prompts.buildWordScramblePrompt,
    multiple_choice: prompts.buildMultipleChoicePrompt
};

const QUESTION_TYPES = Object.keys(PROMPT_BUILDERS);
const MAX_RETRIES = 2;
const BATCH_SIZE = 3;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRateLimitWaitTime(message) {
    if (!message || !message.includes('Rate limit reached')) {
        return null;
    }

    const matchSec = message.match(/Please try again in ([0-9.]+)s/);
    if (matchSec) {
        return parseFloat(matchSec[1]) * 1000 + 500;
    }

    const matchMs = message.match(/Please try again in ([0-9.]+)ms/);
    if (matchMs) {
        return parseFloat(matchMs[1]) + 500;
    }

    return 1500;
}

async function buildBatchPromptPayload(input) {
    const {
        type,
        text,
        batchCount,
        dificultad,
        questions,
        mode,
        provider
    } = input;
    const buildPrompt = PROMPT_BUILDERS[type];
    const previousTexts = questions.map(q => q.question_text);
    const prompt = buildPrompt(text, batchCount, dificultad, previousTexts, mode);
    const maxTokens = batchCount * 450 + 200;
    const raw = await callLLM(provider, prompt, undefined, 120000, maxTokens);
    const parsed = parseLLMResponse(raw, type);
    return buildQuestionsForType(type, parsed);
}

async function handleBatchError(context) {
    const { err, type, attempt, batchStart, batchCount, provider, canFallback } = context;
    logger.warn(`[ai-generator] Preguntas lote ${batchStart + 1}-${batchStart + batchCount} tipo '${type}' (${provider}) intento ${attempt}: ${err.message}`);

    const waitTime = getRateLimitWaitTime(err.message);
    if (waitTime !== null) {
        // Con proveedor de respaldo no se espera: el lote pasa al otro proveedor
        if (canFallback) {
            return 'break-batch';
        }
        await sleep(waitTime);
        return 'retry-same-attempt';
    }

    if (err.message && err.message.startsWith('Timeout:')) {
        return 'break-batch';
    }

    if (attempt <= MAX_RETRIES) {
        await sleep(800);
    }

    return 'continue';
}

async function generateBatchWithRetries(input) {
    const {
        type,
        text,
        batchCount,
        dificultad,
        questions,
        signal,
        mode,
        batchStart,
        provider,
        canFallback = false
    } = input;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        if (signal?.aborted) {
            return;
        }

        try {
            const normalized = await buildBatchPromptPayload({
                type,
                text,
                batchCount,
                dificultad,
                questions,
                mode,
                provider
            });

            if (normalized.length > 0) {
                questions.push(...normalized);
                logger.info(`[ai-generator] Tipo '${type}' (${provider}): lote generado (${questions.length}/${questions.targetCount})`);
            }

            await sleep(1000);
            return;
        } catch (err) {
            const nextAction = await handleBatchError({
                err,
                type,
                attempt,
                batchStart,
                batchCount,
                provider,
                canFallback
            });

            if (nextAction === 'retry-same-attempt') {
                attempt--;
                continue;
            }

            if (nextAction === 'break-batch') {
                return;
            }
        }
    }
}

/**
 * Genera con reintentos preguntas de un tipo concreto.
 * @param {Object} input
 * @param {string} input.type
 * @param {string} input.text
 * @param {number} input.count
 * @param {string} input.dificultad
 * @param {AbortSignal} [input.signal]
 * @param {string} [input.mode]
 * @param {{primary: string|null, fallback: string|null}} input.plan - proveedores (ai-config)
 * @returns {Promise<{type: string, questions: Array, error?: string}>}
 */
async function generateForType(input) {
    const {
        type,
        text,
        count,
        dificultad,
        signal,
        mode = 'document',
        plan
    } = input;
    const questions = [];
    questions.targetCount = count;

    for (let i = 0; i < count; i += BATCH_SIZE) {
        if (signal?.aborted) {
            logger.warn(`[ai-generator] Generación tipo '${type}' abortada por desconexión del cliente`);
            break;
        }

        const batchCount = Math.min(BATCH_SIZE, count - i);
        const batchInput = {
            type,
            text,
            batchCount,
            dificultad,
            questions,
            signal,
            mode,
            batchStart: i
        };
        const before = questions.length;

        await generateBatchWithRetries({ ...batchInput, provider: plan.primary, canFallback: Boolean(plan.fallback) });

        // Si el proveedor principal no ha sacado nada, el lote se repite con el de respaldo
        if (plan.fallback && questions.length === before && !signal?.aborted) {
            logger.warn(`[ai-generator] Lote ${i + 1}-${i + batchCount} tipo '${type}' sin resultado con '${plan.primary}', se usa '${plan.fallback}'`);
            await generateBatchWithRetries({ ...batchInput, provider: plan.fallback });
        }
    }

    delete questions.targetCount;

    if (questions.length === 0) {
        return {
            type,
            questions: [],
            error: `No se pudo generar ninguna pregunta de tipo '${type}'`,
            code: 'AI_QUESTION_TYPE_GENERATION_FAILED',
            params: { type }
        };
    }
    return { type, questions };
}

/**
 * Genera un banco completo de preguntas con IA.
 * @param {string} documentText - Texto extraído del documento
 * @param {{
 *   name: string,
 *   quiz?: number, survey?: number, numeric_approximation?: number,
 *   order?: number, word_scramble?: number, multiple_choice?: number,
 *   dificultad?: string
 * }} config
 * @param {AbortSignal} [signal]
 * @returns {Promise<{
 *   bankPayload: Object,       // Listo para POST /api/banks/save-all
 *   results: Array,            // Desglose por tipo con posibles errores
 *   totalGenerated: number
 * }>}
 */
async function generateBank(documentText, config, signal, mode = 'document') {
    const { name, language, dificultad = 'MEDIA', ...counts } = config;

    if (!documentText || documentText.trim().length < 10) {
        throw new Error('El texto está vacío o es demasiado corto para generar preguntas.');
    }

    const activeTypes = QUESTION_TYPES.filter(type => Number(counts[type]) > 0);

    if (activeTypes.length === 0) {
        throw new Error('La configuración no especifica ningún tipo de pregunta con count > 0.');
    }

    const plan = getProviderPlan();
    logger.info(`[ai-generator] Proveedor: ${plan.primary || 'ninguno'}${plan.fallback ? `, respaldo: ${plan.fallback}` : ''}`);

    // Ejecución secuencial por tipo de pregunta y control de lotes para prevenir Rate Limits de APIS
    const results = [];
    for (const type of activeTypes) {
        if (signal?.aborted) break;
        results.push(await generateForType({
            type,
            text: documentText,
            count: Number(counts[type]),
            dificultad,
            signal,
            mode,
            plan
        }));
    }
    const allQuestions = results.flatMap(r => r.questions);
    const bankPayload = buildBankPayload(name, allQuestions, language);

    return {
        bankPayload,
        results,
        totalGenerated: allQuestions.length
    };
}

module.exports = { generateBank };
