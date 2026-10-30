/**
 * @fileoverview Resultados de las encuestas en el móvil: lista de opciones con lo que votó
 * el jugador marcado y, al revelar, el porcentaje de cada opción.
 * - Selección múltiple: porcentaje de los que respondieron que eligió cada una (la suma
 *   puede pasar del 100 %); se puede no marcar nada.
 * - Respuesta única: cada jugador vota una opción y los porcentajes suman 100 %. El voto lo
 *   anota enviarRespuesta (noteSurveyVote); tras recargar la página no se marca.
 * Sin dependencias de la pantalla de la pregunta, para que la use también
 * player-reveal-correct.js sin ciclos. Estilos en css/survey-multiple.css.
 */

import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

// Pregunta en curso: tipo de encuesta ('single', 'multiple' o null), textos de las
// opciones y lo que votó el jugador
let kind = null;
let optionTexts = [];
let mySelection = [];

/** Nueva pregunta: guarda el tipo y los textos de las opciones y olvida el voto anterior. */
export function resetSurvey(texts, nextKind) {
    kind = nextKind || null;
    optionTexts = Array.isArray(texts) ? texts : [];
    mySelection = [];
}

export function resetSurveyMultiple(texts) {
    resetSurvey(texts, 'multiple');
}

/** Encuesta de respuesta única: el jugador ha votado la opción `index`. */
export function noteSurveyVote(index) {
    if (kind === 'single' && Number.isInteger(index)) mySelection = [index];
}

function formatPercentage(value) {
    const lang = document.documentElement.lang || 'es';
    try {
        return new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
    } catch {
        return `${value} %`;
    }
}

function rowHtml({ text, mine, percentage, index }) {
    const mark = mine
        ? `<i class="fas fa-check" aria-hidden="true"></i><span class="sr-only">${_t('player.survey_multiple.mine', null, 'Tu elección')}</span>`
        : '';
    const revealed = typeof percentage === 'number';
    return `<li class="sm-row${mine ? ' sm-row--mine' : ''}">
                <div class="sm-row__head">
                    <span class="sm-row__mark">${mark}</span>
                    <span class="sm-row__text" lang="es">${escapeHtml(text)}</span>
                    ${revealed ? `<span class="sm-row__pct">${formatPercentage(percentage)}</span>` : ''}
                </div>
                ${revealed ? `<div class="sm-row__track"><div class="sm-row__fill" style="width:${Math.min(100, percentage)}%;--sm-i:${index}"></div></div>` : ''}
            </li>`;
}

function captionHtml(respondents, single) {
    const group = single ? 'player.survey.' : 'player.survey_multiple.';
    const key = group + (respondents === 1 ? 'caption_one' : 'caption_other');
    let fallback = respondents === 1 ? '1 respuesta' : '{count} respuestas';
    if (!single) fallback += ' · cada jugador podía elegir varias';
    return `<p class="sm-results__caption">${_t(key, { count: respondents }, fallback)}</p>`;
}

/**
 * Lista de resultados. Sin `survey` (aún no se ha revelado) solo marca lo votado.
 * @param {{ respondents: number, options: Array<{ text: string, percentage: number }> }|null} survey
 * @param {number[]|null} selection - Lo que votó el jugador (null si no respondió)
 * @param {boolean} [single] - Encuesta de respuesta única
 */
export function surveyResultsHtml(survey, selection, single = false) {
    const chosen = new Set(selection || []);
    const options = survey ? survey.options : optionTexts.map(text => ({ text }));
    let status = '';
    if (!single && selection && chosen.size === 0) {
        status = _t('player.survey_multiple.none_chosen', null, 'No marcaste ninguna opción');
    } else if (!survey) {
        status = _t('player.survey_multiple.waiting', null, 'Los porcentajes aparecen al revelar la pregunta');
    }
    const rows = options
        .map((option, index) =>
            rowHtml({ text: option.text, mine: chosen.has(index), percentage: option.percentage, index })
        )
        .join('');
    return `<section class="sm-results" data-survey-multiple aria-live="polite">
                ${status ? `<p class="sm-results__status">${status}</p>` : ''}
                ${rows ? `<ol class="sm-results__list">${rows}</ol>` : ''}
                ${survey ? captionHtml(survey.respondents, single) : ''}
            </section>`;
}

/**
 * Pantalla tras votar (answer-result). Si la revelación ya llegó (equipos), sale con porcentajes.
 * @param {Object} data - answer-result con surveyMultipleDetails
 * @param {Object|null} revealed - surveyMultiple de la última revelación, si la hay
 */
export function surveyMultipleResultHtml(data, revealed) {
    mySelection = data.surveyMultipleDetails?.selectedIndices || [];
    return `
        <i class="fas fa-square-poll-horizontal text-6xl mb-3 animate-pop" aria-hidden="true"></i>
        <h2 class="text-4xl font-black italic uppercase">${_t('player.answer.vote_registered', null, '¡Voto Registrado!')}</h2>
        <p class="text-lg font-black mt-3 bg-black/20 py-2 px-6 rounded-full">${_t('player.survey_multiple.label', null, 'Encuesta de selección múltiple')}</p>
        ${surveyResultsHtml(revealed || null, mySelection)}
    `;
}

/**
 * Encuesta de respuesta única, tras votar (answer-result). Si la revelación ya llegó
 * (equipos), sale con porcentajes.
 * @param {Object|null} revealed - surveySingle de la última revelación, si la hay
 */
export function surveySingleResultHtml(revealed) {
    return `
        <i class="fas fa-vote-yea text-6xl mb-3 animate-pop" aria-hidden="true"></i>
        <h2 class="text-4xl font-black italic uppercase">${_t('player.answer.vote_registered', null, '¡Voto Registrado!')}</h2>
        <p class="text-lg font-black mt-3 bg-black/20 py-2 px-6 rounded-full">${_t('player.answer.survey_label', null, 'Encuesta')}</p>
        ${surveyResultsHtml(revealed || null, mySelection, true)}
    `;
}

/**
 * Revelación con el jugador ya en su pantalla de resultado: cambia la lista por la de porcentajes.
 * @param {Object} survey - surveyMultiple o surveySingle
 * @param {boolean} [single]
 * @returns {boolean} true si había lista que actualizar
 */
export function applySurveyReveal(survey, single = false) {
    const section = document.querySelector('[data-survey-multiple]');
    if (!section || !survey) return false;
    section.outerHTML = surveyResultsHtml(survey, mySelection, single);
    return true;
}

export function applySurveyMultipleReveal(survey) {
    return applySurveyReveal(survey, false);
}
