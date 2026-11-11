'use strict';

/**
 * @fileoverview Descarte de preguntas repetidas o casi iguales generadas por la IA.
 * Los modelos (sobre todo los locales de Ollama) ignoran a menudo la lista de
 * preguntas ya hechas que lleva el prompt, así que el servidor no se fía y compara
 * cada pregunta nueva con las anteriores del mismo tipo.
 * Trabaja sobre preguntas ya normalizadas (schema-builder): questionText, options, correctWord…
 */

// Por encima de este parecido (Jaccard de palabras significativas) dos enunciados son la misma pregunta
const SAME_QUESTION_SIMILARITY = 0.7;
// Con la misma respuesta correcta basta un parecido menor: «¿Cuál es la capital…?» / «¿Qué ciudad es la capital…?»
const SAME_ANSWER_SIMILARITY = 0.5;
// El enunciado de estos tipos es una instrucción genérica: lo que distingue la pregunta son las opciones
const OPTIONS_DEFINE_QUESTION = new Set(['word_search', 'matching']);
// Palabras vacías frecuentes (es/en); las de 1-2 letras se descartan por longitud
const STOPWORDS = new Set(
    (
        'que cual cuales quien quienes como donde cuando cuanto cuanta cuantos cuantas los las del una uno unos unas ' +
        'por para con sin sus son fue era mas este esta estos estas ese esa eso the what which who whom how where ' +
        'when why are was were and for with from that this does did'
    ).split(' ')
);

/**
 * Pasa un texto a minúsculas sin tildes ni signos.
 * @param {*} text
 * @returns {string}
 */
function normalizeText(text) {
    return String(text ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

/** @returns {Set<string>} Palabras significativas del texto */
function significantWords(text) {
    return new Set(normalizeText(text).split(' ').filter(word => word.length > 2 && !STOPWORDS.has(word)));
}

/** Parecido de Jaccard entre dos conjuntos; dos conjuntos vacíos no se parecen. */
function jaccard(a, b) {
    if (a.size === 0 || b.size === 0) return 0;
    let shared = 0;
    a.forEach(word => {
        if (b.has(word)) shared++;
    });
    return shared / (a.size + b.size - shared);
}

/** Texto que identifica la pregunta: el enunciado, o las opciones si el enunciado es genérico. */
function identityText(question) {
    if (!OPTIONS_DEFINE_QUESTION.has(question.type)) return question.questionText;
    return (question.options || []).map(o => `${o.optionText ?? ''} ${o.match_value ?? ''}`).join(' ');
}

/** Respuesta correcta normalizada ('' si el tipo no tiene una respuesta comparable). */
function answerOf(question) {
    if (question.type === 'word_scramble') return normalizeText(question.correctWord);
    if (question.type === 'numeric_approximation') return normalizeText(question.correctAnswer);
    if (OPTIONS_DEFINE_QUESTION.has(question.type)) return '';
    const correct = (question.options || []).filter(o => o.isCorrect);
    return correct.map(o => normalizeText(o.optionText)).sort().join('|');
}

/**
 * Huella de una pregunta para compararla con otras.
 * @param {Object} question - Pregunta normalizada
 * @returns {{ type: string, text: string, words: Set<string>, answer: string }}
 */
function fingerprint(question) {
    const text = identityText(question);
    return { type: question.type, text: normalizeText(text), words: significantWords(text), answer: answerOf(question) };
}

/** Indica si dos huellas corresponden a la misma pregunta. */
function isSameQuestion(a, b) {
    if (a.text && a.text === b.text) return true;
    const sameAnswer = a.answer !== '' && a.answer === b.answer;
    // Un anagrama con la misma palabra es la misma pregunta aunque cambie la pista
    if (sameAnswer && a.type === 'word_scramble') return true;
    const similarity = jaccard(a.words, b.words);
    return similarity >= SAME_QUESTION_SIMILARITY || (sameAnswer && similarity >= SAME_ANSWER_SIMILARITY);
}

/**
 * Separa las preguntas nuevas de las repetidas, comparando con las ya aceptadas
 * y con las anteriores del mismo lote (se queda con la primera).
 * @param {Object[]} candidates - Preguntas normalizadas del lote
 * @param {Object[]} existing - Preguntas ya aceptadas
 * @returns {{ fresh: Object[], discarded: number }}
 */
function filterNewQuestions(candidates, existing) {
    const seen = existing.map(fingerprint);
    const fresh = [];
    candidates.forEach(question => {
        const print = fingerprint(question);
        if (seen.some(other => isSameQuestion(print, other))) return;
        seen.push(print);
        fresh.push(question);
    });
    return { fresh, discarded: candidates.length - fresh.length };
}

module.exports = { filterNewQuestions };
