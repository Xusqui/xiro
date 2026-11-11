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
// En estos tipos la respuesta correcta identifica la pregunta: repetirla es repetir la pregunta aunque
// cambie el enunciado (los modelos locales reformulan una y otra vez la misma pregunta)
const ANSWER_DEFINES_QUESTION = new Set(['quiz', 'multiple_choice', 'word_scramble']);
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

/** Textos de la respuesta correcta tal como los dio la IA ([] si el tipo no tiene una comparable). */
function correctAnswers(question) {
    if (question.type === 'word_scramble') return [String(question.correctWord ?? '')];
    if (question.type === 'numeric_approximation') return [String(question.correctAnswer ?? '')];
    if (OPTIONS_DEFINE_QUESTION.has(question.type)) return [];
    return (question.options || []).filter(o => o.isCorrect).map(o => String(o.optionText ?? ''));
}

/**
 * Respuesta correcta legible de una pregunta, para pedir a la IA que no la vuelva a usar.
 * @param {Object} question - Pregunta normalizada
 * @returns {string} Respuesta ('' si el tipo no tiene una comparable)
 */
function correctAnswerText(question) {
    return correctAnswers(question)
        .map(answer => answer.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' / ');
}

/** Respuesta correcta normalizada ('' si el tipo no tiene una respuesta comparable). */
function answerOf(question) {
    return correctAnswers(question).map(normalizeText).filter(Boolean).sort().join('|');
}

/** Indica si todas las palabras de `small` (no vacío) están en `big`. */
function isContained(small, big) {
    if (small.size === 0) return false;
    for (const word of small) if (!big.has(word)) return false;
    return true;
}

/**
 * Indica si dos respuestas son la misma: iguales, o una con todas sus palabras dentro
 * de la otra («Dublín» / «Dublín, Irlanda», «Guitarra» / «Guitarra eléctrica»).
 */
function isSameAnswer(a, b) {
    if (a.answer === '' || b.answer === '') return false;
    return a.answer === b.answer || isContained(a.answerWords, b.answerWords) || isContained(b.answerWords, a.answerWords);
}

/**
 * Huella de una pregunta para compararla con otras.
 * @param {Object} question - Pregunta normalizada
 * @returns {{ type: string, text: string, words: Set<string>, answer: string }}
 */
function fingerprint(question) {
    const text = identityText(question);
    const answer = answerOf(question);
    return { type: question.type, text: normalizeText(text), words: significantWords(text), answer, answerWords: significantWords(answer) };
}

/** Indica si dos huellas corresponden a la misma pregunta. */
function isSameQuestion(a, b) {
    if (a.text && a.text === b.text) return true;
    if (ANSWER_DEFINES_QUESTION.has(a.type) && a.type === b.type && isSameAnswer(a, b)) return true;
    const sameAnswer = a.answer !== '' && a.answer === b.answer;
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

module.exports = { filterNewQuestions, correctAnswerText };
