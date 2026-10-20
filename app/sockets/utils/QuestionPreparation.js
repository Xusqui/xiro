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

    // Procesar cada pregunta (barajar opciones según tipo de slide)
    return orderedQuestions.map(q => {
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

        // No barajar opciones para slides especiales (comment/info/text) o encuestas
        if (
            q.slide_type === 'comment'
            || q.slide_type === 'info'
            || q.slide_type === 'text'
            || q.slide_type === 'image'
            || q.question_type === 'survey'
        ) {
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

        // Preparar preguntas de anagrama: generar letras barajadas
        if (q.question_type === 'word_scramble') {
            const word = q.correct_word || '';
            const normalized = normalizeWord(word);
            return {
                ...q,
                word_length: normalized.length,
                scrambled_letters: generateScrambledLetters(word),
                options: []
            };
        }

        // Sopa de letras: generar la rejilla una sola vez (viaja a Redis con el gameState)
        if (q.question_type === 'word_search') {
            return prepareWordSearchLogged(q, { gameType });
        }

        // Completa la frase: solución normalizada (fb_words) y longitud de cada hueco (fb_lengths)
        if (q.question_type === 'fill_blanks') {
            return prepareFillBlanksLogged(q, { gameType });
        }

        // Barajar opciones para preguntas normales
        return {
            ...q,
            options: shuffle(q.options || [])
        };
    });
}

module.exports = {
    prepareQuestions,
    prepareWordSearchLogged,
    prepareFillBlanksLogged
};
