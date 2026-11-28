/**
 * @fileoverview Registro de manejadores de respuesta por tipo de pregunta (Strategy).
 * Cada manejador sabe validar el envío del jugador, evaluarlo con su servicio de
 * dominio y si admite el envío automático justo tras el cierre (lateAnswer).
 *
 * Los tipos son los del catálogo public/js/core/question-types.js; el contrato
 * __tests__/question-types.contract.test.js exige un manejador para cada uno.
 * @module application/question-types/AnswerHandlerRegistry
 */

'use strict';

const choice = require('./answer-handlers/choice');
const arranged = require('./answer-handlers/arranged');
const typed = require('./answer-handlers/typed');
const cloud = require('./answer-handlers/cloud');

const QuestionTypes = require('../../public/js/core/question-types');

const BEHAVIOURS = { ...choice, ...arranged, ...typed, ...cloud };

// Manejador = hechos declarativos del catálogo (forma de respuesta, campo de detalle)
// + comportamiento del tipo (validar, evaluar, plazo extra, racha)
const HANDLERS = Object.freeze(
    Object.fromEntries(
        Object.entries(BEHAVIOURS).map(([type, behaviour]) => {
            const { answerShape, detailsField } = QuestionTypes.get(type);
            return [type, Object.freeze({ answerShape, detailsField, ...behaviour })];
        })
    )
);

/**
 * @typedef {Object} AnswerHandler
 * @property {boolean} lateAnswer - Admite el envío justo después del cierre
 * @property {'option'|'selection'|'order'|'matching'|'number'|'text'|'found'|'words'|'tap'|'cloud'} answerShape
 *   Qué envía el jugador; solo 'option' (quiz y encuesta) responde con un índice de opción
 * @property {string|null} detailsField - Campo de la respuesta guardada con el detalle del tipo
 * @property {(answerResult: Object) => (boolean|null)} [streakAction] - Tipos con acierto
 *   parcial: la racha sube (true), se mantiene (null) o se rompe (false). Sin ella, manda isCorrect
 * @property {(input: {payload: Object, question: Object, flags: Object}) => Object} validate
 *   Devuelve { valid, reason } y los datos normalizados que dé el servicio de estado
 * @property {(ctx: Object) => Object} evaluate - Resultado del servicio de puntuación del tipo
 */

/**
 * @param {*} questionType
 * @returns {boolean} Si el tipo tiene manejador propio.
 */
function hasAnswerHandler(questionType) {
    return typeof questionType === 'string' && Object.prototype.hasOwnProperty.call(HANDLERS, questionType);
}

/**
 * Manejador del tipo. Sin tipo (preguntas antiguas) o con uno desconocido, el del quiz,
 * como hacía el flujo antes del registro.
 * @param {*} questionType
 * @returns {AnswerHandler}
 */
function getAnswerHandler(questionType) {
    return hasAnswerHandler(questionType) ? HANDLERS[questionType] : HANDLERS.quiz;
}

module.exports = { getAnswerHandler, hasAnswerHandler };
