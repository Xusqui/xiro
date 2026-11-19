/**
 * @fileoverview Question Preparation Helper - Preparación de preguntas según tipo de juego
 */

const { shuffle } = require('../../services/game.logic');
const { generateScrambledLetters, normalizeWord } = require('../../domain/services/WordScrambleService');
const { prepareWordSearchQuestion } = require('../../domain/services/WordSearchService');
const { prepareFillBlanksQuestion } = require('../../domain/services/FillBlanksService');
const { parseVideoSource } = require('../../public/js/core/video-source');
const logger = require('../../config/logger');

/**
 * Procesa elementos de canvas para añadir video_source a los elementos de tipo video
 * @param {Object} canvas - Canvas a procesar
 * @returns {Object} Canvas procesado (sin mutar el original)
 */
function withVideoSources(canvas) {
    if (!canvas || !canvas.elements || !Array.isArray(canvas.elements)) {
        return canvas;
    }

    // Crear copia profunda del canvas
    const result = JSON.parse(JSON.stringify(canvas));

    // Procesar cada elemento
    result.elements = result.elements.map(el => {
        if (el.type === 'video' && el.props && typeof el.props.url === 'string') {
            // video_source va junto a props (contrato), igual que en la diapositiva de vídeo
            return { ...el, video_source: parseVideoSource(el.props.url) };
        }
        return el;
    });

    return result;
}

/**
 * Prepara una sopa de letras y avisa en el log si no se pudo generar la rejilla
 * (palabras inválidas en bancos antiguos o importados a mano): sin rejilla la
 * pregunta se muestra vacía y nadie puntúa, así que debe quedar rastro.
 * También lo usan los manejadores del Trivial.
 * @param {Object} question
 * @param {Object} [context] - Datos extra para el log (sala, tipo de juego…)
 * @returns {Object} Pregunta preparada
 */
function prepareWordSearchLogged(question, context = {}) {
    const prepared = prepareWordSearchQuestion(question);
    if (!prepared.ws_grid) {
        logger.warn('word_search sin rejilla: palabras inválidas, la pregunta no puntuará', {
            ...context,
            questionId: question?.id,
            words: prepared.ws_words
        });
    }
    return prepared;
}

/**
 * Prepara una pregunta de Completa la frase y avisa en el log si los huecos de la
 * frase no cuadran con las palabras guardadas (bancos antiguos o importados a mano):
 * la pregunta se juega igual, pero conviene que quede rastro.
 * También lo usan los manejadores del Trivial.
 * @param {Object} question
 * @param {Object} [context] - Datos extra para el log (sala, tipo de juego…)
 * @returns {Object} Pregunta preparada (fb_words, fb_lengths)
 */
function prepareFillBlanksLogged(question, context = {}) {
    const prepared = prepareFillBlanksQuestion(question);
    if (!prepared.fb_valid) {
        logger.warn('fill_blanks con huecos y palabras que no cuadran', {
            ...context,
            questionId: question?.id,
            blanks: (question?.question_text || '').match(/\{\{\d+\}\}/g)?.length || 0,
            words: prepared.fb_words
        });
    }
    return prepared;
}

// Anagrama: letras barajadas y longitud de la palabra normalizada, sin opciones
function prepareWordScramble(question) {
    const word = question.correct_word || '';
    return {
        ...question,
        word_length: normalizeWord(word).length,
        scrambled_letters: generateScrambledLetters(word),
        options: []
    };
}

// Contenido propio del tipo que se genera antes de enviar la pregunta
const TYPE_CONTENT = Object.freeze({
    word_scramble: (question) => prepareWordScramble(question),
    // Sopa de letras: la rejilla se genera una sola vez (viaja a Redis con el gameState)
    word_search: (question, logContext) => prepareWordSearchLogged(question, logContext),
    // Completa la frase: solución normalizada (fb_words) y longitud de cada hueco (fb_lengths)
    fill_blanks: (question, logContext) => prepareFillBlanksLogged(question, logContext)
});

function hasTypeContent(question) {
    return Object.prototype.hasOwnProperty.call(TYPE_CONTENT, question?.question_type);
}

/**
 * Genera el contenido propio del tipo (anagrama, sopa de letras, completa la frase).
 * Lo comparten la partida normal y Trivial. Los demás tipos se devuelven tal cual.
 * @param {Object} question - Pregunta
 * @param {Object} logContext - Contexto para los logs (gameType, o roomId y mode en Trivial)
 * @returns {Object} Pregunta nueva con el contenido, o la misma si el tipo no tiene
 */
function prepareTypeContent(question, logContext) {
    return hasTypeContent(question) ? TYPE_CONTENT[question.question_type](question, logContext) : question;
}

// Diapositivas y encuestas conservan el orden de sus opciones (no se barajan)
const KEEP_ORDER_SLIDES = new Set(['comment', 'info', 'text', 'image']);
const KEEP_ORDER_TYPES = new Set(['survey', 'survey_multiple']);

function keepsOptionOrder(q) {
    return KEEP_ORDER_SLIDES.has(q.slide_type) || KEEP_ORDER_TYPES.has(q.question_type);
}

// Baraja las opciones según el tipo de slide y genera lo que cada tipo necesita para jugarse
function prepareQuestion(q, gameType) {
    // Diapositiva de vídeo: el origen ya analizado (tipo y URL del reproductor) viaja al
    // presentador y a la TV, que es ES5 y no carga core/video-source.js. El saneado de los
    // jugadores no copia este campo: los jugadores nunca reciben el vídeo.
    if (q.slide_type === 'video') {
        return { ...q, video_source: parseVideoSource(q.slide_video) };
    }

    // Diapositiva de lienzo: procesar elementos de vídeo
    if (q.slide_type === 'canvas') {
        return { ...q, slide_canvas: withVideoSources(q.slide_canvas) };
    }

    // Diapositiva de instrucciones: contenido fijo del cliente, nada que preparar
    if (q.slide_type === 'howto') {
        return q;
    }

    // No barajar opciones para slides especiales (comment/info/text) o encuestas
    if (keepsOptionOrder(q)) {
        return q;
    }

    if (q.question_type === 'order') {
        const normalizedOptions = (q.options || []).map((opt, index) => ({
            ...opt,
            order_index: Number.isInteger(opt.order_index) ? opt.order_index : index
        }));

        return {
            ...q,
            options: shuffle(normalizedOptions)
        };
    }

    // Anagrama, sopa de letras y completa la frase: su contenido sustituye a las opciones
    if (hasTypeContent(q)) {
        return prepareTypeContent(q, { gameType });
    }

    // Barajar opciones para preguntas normales
    return {
        ...q,
        options: shuffle(q.options || [])
    };
}

/**
 * Prepara las preguntas según el tipo de juego
 * - custom_game: NO barajar preguntas (orden definido por admin), sí barajar opciones
 * - bank/quiz: SÍ barajar preguntas y opciones
 * - order: SÍ barajar opciones, manteniendo order_index para corrección
 *
 * @param {Array} questions - Array de preguntas cargadas
 * @param {String} gameType - Tipo de juego: 'custom_game', 'bank', 'quiz'
 * @returns {Array} Preguntas preparadas
 */
function prepareQuestions(questions, gameType) {
    if (!questions || questions.length === 0) {
        return [];
    }

    // Determinar si se deben barajar las preguntas
    const shouldShuffleQuestions = gameType !== 'custom_game';

    // Barajar preguntas si corresponde
    const orderedQuestions = shouldShuffleQuestions ? shuffle(questions) : questions;

    return orderedQuestions.map(q => prepareQuestion(q, gameType));
}

module.exports = {
    prepareTypeContent,
    prepareQuestions,
    prepareWordSearchLogged,
    prepareFillBlanksLogged
};
