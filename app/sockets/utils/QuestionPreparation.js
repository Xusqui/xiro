/**
 * @fileoverview Question Preparation Helper - Preparación de preguntas según tipo de juego
 */

const { shuffle } = require('../../services/game.logic');
const { generateScrambledLetters, normalizeWord } = require('../../domain/services/WordScrambleService');

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

        // Barajar opciones para preguntas normales
        return {
            ...q,
            options: shuffle(q.options || [])
        };
    });
}

module.exports = {
    prepareQuestions
};
