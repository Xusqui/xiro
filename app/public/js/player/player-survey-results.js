/**
 * @fileoverview «Encuesta de selección múltiple» en el móvil: lista de opciones con
 * las del jugador marcadas y, al revelar, el porcentaje de los que respondieron que
 * eligió cada una (la suma puede pasar del 100 %). Sin dependencias de la pantalla
 * de la pregunta, para que la use también player-reveal-correct.js sin ciclos.
 * Estilos en css/survey-multiple.css.
 */

import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

// Textos de las opciones de la pregunta en curso y lo que votó el jugador
let optionTexts = [];
let mySelection = [];

/** Nueva pregunta: guarda los textos de las opciones y olvida el voto anterior. */
export function resetSurveyMultiple(texts) {
    optionTexts = Array.isArray(texts) ? texts : [];
    mySelection = [];
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

function captionHtml(respondents) {
    const key = respondents === 1 ? 'player.survey_multiple.caption_one' : 'player.survey_multiple.caption_other';
    const fallback =
        respondents === 1
            ? '1 respuesta · cada jugador podía elegir varias'
            : '{count} respuestas · cada jugador podía elegir varias';
    return `<p class="sm-results__caption">${_t(key, { count: respondents }, fallback)}</p>`;
}

/**
 * Lista de resultados. Sin `survey` (aún no se ha revelado) solo marca lo votado.
 * @param {{ respondents: number, options: Array<{ text: string, percentage: number }> }|null} survey
 * @param {number[]|null} selection - Lo que votó el jugador (null si no respondió)
 */
export function surveyResultsHtml(survey, selection) {
    const chosen = new Set(selection || []);
    const options = survey ? survey.options : optionTexts.map(text => ({ text }));
    let status = '';
    if (selection && chosen.size === 0) {
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
                ${survey ? captionHtml(survey.respondents) : ''}
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
 * Revelación con el jugador ya en su pantalla de resultado: cambia la lista por la de porcentajes.
 * @returns {boolean} true si había lista que actualizar
 */
export function applySurveyMultipleReveal(survey) {
    const section = document.querySelector('[data-survey-multiple]');
    if (!section || !survey) return false;
    section.outerHTML = surveyResultsHtml(survey, mySelection);
    return true;
}
