/**
 * @fileoverview Trivial: pregunta de una casilla lista para enviar. Antes estaba copiada en
 * TrivialQuestionStart (movimiento) y TrivialCenterHandler (casilla central).
 * @module sockets/handlers/trivial/TrivialQuestionNormalizer
 */

'use strict';

const logger = require('../../../config/logger');
const { shuffle } = require('../../../services/game.logic');
const { prepareTypeContent } = require('../../utils/QuestionPreparation');

function mapOption(option) {
    return {
        ...option,
        optionText: option.option_text ?? option.optionText ?? '',
        isCorrect: option.is_correct ?? option.isCorrect ?? false,
        orderIndex: option.order_index ?? option.orderIndex ?? 0
    };
}

/**
 * Unifica los campos de las opciones, las baraja (salvo en ordenar, que conserva su orden)
 * y genera el contenido propio del tipo (anagrama, sopa de letras, completa la frase).
 * @param {Object} question - Pregunta tal como sale de la base de datos
 * @param {string} roomId - Sala (para los logs)
 * @param {string} source - Quién la pide, para los logs (p. ej. 'handleMove')
 * @returns {Object} Pregunta nueva; la recibida no se modifica
 */
function normalizeTrivialQuestion(question, roomId, source) {
    const mappedOptions = (question.options || []).map(mapOption);
    const isOrder = question.question_type === 'order';
    if (isOrder) {
        logger.debug(`trivial ${source}: order question — options NOT shuffled`, { roomId, questionId: question.id });
    }
    const options = isOrder ? mappedOptions : shuffle(mappedOptions);
    return prepareTypeContent({ ...question, options }, { roomId, mode: 'trivial' });
}

module.exports = { normalizeTrivialQuestion };
