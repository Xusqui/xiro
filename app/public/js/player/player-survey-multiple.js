/**
 * @fileoverview «Encuesta de selección múltiple» (survey_multiple) en el móvil.
 * La pregunta es la pantalla de selección múltiple con otra configuración (se
 * puede enviar sin marcar nada). La pantalla de después y los porcentajes al
 * revelar están en player-survey-results.js.
 */

import { renderizarPreguntaMultipleChoice } from './player-multiplechoice-ui.js?v=20260922172926';
import { resetSurveyMultiple } from './player-survey-results.js?v=20261021120000';

const SURVEY_CONFIG = {
    answerType: 'survey_multiple',
    allowEmpty: true,
    stripHtml: () =>
        `<i class="fas fa-square-poll-horizontal mr-1" aria-hidden="true"></i>${_t('player.survey_multiple.strip', null, 'Encuesta · marca las que quieras, o ninguna')}`,
    sendLabel: () => _t('player.survey_multiple.send', null, 'ENVIAR RESPUESTA'),
    emptyLabel: () => _t('player.survey_multiple.none', null, 'NINGUNA')
};

/** Pinta la pregunta y recuerda los textos para la pantalla de después. */
export function renderizarPreguntaSurveyMultiple(pregunta) {
    resetSurveyMultiple((pregunta.options || []).map(option => option.optionText || option.text || ''));
    renderizarPreguntaMultipleChoice(pregunta, SURVEY_CONFIG);
}
