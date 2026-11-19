/**
 * @fileoverview Detalle propio del tipo de pregunta en el resultado que recibe el jugador
 * al revelar ('answer-result'). Antes estaba copiado en IndividualGameMode, TeamGameMode,
 * TeamManager y TeamRevealHelper con pequeñas diferencias.
 *
 * El campo sale del catálogo de tipos (detailsField). Los clientes esperan siempre los
 * tres primeros (null si no aplican); los demás solo en su tipo. El detalle de numérica y
 * anagrama no viaja en este payload.
 *
 * ARQUITECTURA: Domain Service (funciones puras, sin I/O).
 * @module domain/services/PlayerResultDetails
 */

'use strict';

const QuestionTypes = require('../../public/js/core/question-types');

const ALWAYS_SENT = Object.freeze(['orderDetails', 'multipleChoiceDetails', 'matchingDetails']);
const SENT_IN_OWN_TYPE = Object.freeze(['wordSearchDetails', 'fillBlanksDetails', 'surveyMultipleDetails']);

// Sin detalle guardado: la encuesta múltiple envía una selección vacía (votó «Ninguna»)
const EMPTY_DETAILS = Object.freeze({ surveyMultipleDetails: () => ({ selectedIndices: [] }) });

function emptyDetails(field) {
    return Object.prototype.hasOwnProperty.call(EMPTY_DETAILS, field) ? EMPTY_DETAILS[field]() : null;
}

/**
 * Campos de detalle del resultado del jugador.
 * @param {{question_type?: string}} question - Pregunta revelada
 * @param {Object|null|undefined} answer - Respuesta guardada del jugador
 * @returns {Object<string, Object|null>}
 */
function playerResultDetails(question, answer) {
    const details = {};
    ALWAYS_SENT.forEach((field) => {
        details[field] = null;
    });

    const field = QuestionTypes.get(question?.question_type)?.detailsField;
    if (ALWAYS_SENT.includes(field) || SENT_IN_OWN_TYPE.includes(field)) {
        details[field] = answer?.[field] || emptyDetails(field);
    }
    return details;
}

module.exports = { playerResultDetails };
