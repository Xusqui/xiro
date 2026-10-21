/**
 * @fileoverview Reveal sobre la rejilla de opciones del presentador: quiz,
 * encuestas, orden y matching.
 */

import { calculatePercentages, createPercentageHTML } from './presenter-percentage-calculator.js?v=20260922172926';
import { renderOrderReveal, renderMatchingReveal } from './presenter-reveal-cards.js?v=20260922172926';
import { revealMatchingBoard } from './presenter-matching-layout.js?v=20260922172926';

const CORRECT_BADGE_HTML =
    '<div class="absolute -top-4 -right-4 bg-white text-green-600 w-14 h-14 rounded-full flex items-center justify-center text-3xl border-4 border-green-500 shadow-xl"><i class="fas fa-check"></i></div>';

/** Encuesta: porcentaje de votos en cada tarjeta, sin respuesta correcta. */
function revealSurveyCard(tarjeta, i, percentages) {
    const percentage = percentages[i]?.percentage || 0;
    tarjeta.innerHTML += createPercentageHTML(percentage, i);
    tarjeta.classList.add('ring-4', 'ring-blue-400');
}

/**
 * Encuesta de selección múltiple: junto a su insignia, cuántos respondieron y por qué
 * los porcentajes (de los que respondieron) pueden sumar más del 100 %.
 */
function appendSurveyMultipleCaption(respondents) {
    const row = document.getElementById('sm-badge-row');
    if (!row) return;
    row.querySelector('[data-sm-caption]')?.remove();
    const text =
        respondents === 1
            ? _t('presenter.reveal.survey_multiple_caption_one', null, '1 respuesta · cada jugador podía elegir varias')
            : _t(
                'presenter.reveal.survey_multiple_caption_other',
                { count: respondents },
                '{count} respuestas · cada jugador podía elegir varias'
            );
    row.insertAdjacentHTML(
        'beforeend',
        `<div data-sm-caption class="bg-black/30 text-white px-5 py-2 rounded-full font-bold text-lg shadow-lg">${text}</div>`
    );
}

/** Quiz: porcentaje en cada tarjeta, resaltando la correcta y apagando el resto. */
function revealQuizCard(tarjeta, i, percentages, correctIndex) {
    const percentage = percentages[i]?.percentage || 0;
    tarjeta.innerHTML += createPercentageHTML(percentage, i);

    if (i === correctIndex) {
        tarjeta.classList.add('ring-8', 'ring-white', 'scale-105', 'z-10');
        tarjeta.innerHTML += CORRECT_BADGE_HTML;
    } else {
        tarjeta.classList.add('opacity-20', 'grayscale');
    }
}

/**
 * Marca las tarjetas de opciones según el tipo de pregunta.
 * @returns {{correctCardIndex: number, isOrderQuestion: boolean, isMatchingQuestion: boolean, matchingOnBoard: boolean}}
 */
export function revealOptionCards(data) {
    const tarjetas = document.querySelectorAll('#options-grid > div');
    const isOrderQuestion = Array.isArray(data.correctOrder) && data.correctOrder.length > 0;
    const isMatchingQuestion = Array.isArray(data.correctMatches) && data.correctMatches.length > 0;
    // Matching se revela en su tablero; sin tablero (imagen principal), tarjeta
    const matchingOnBoard = isMatchingQuestion && revealMatchingBoard();

    // Orden y matching muestran su propia tarjeta; la rejilla solo se atenúa
    if (isOrderQuestion || isMatchingQuestion) {
        if (isOrderQuestion) renderOrderReveal(data.correctOrder, { topOffset: '7.5rem' });
        if (isMatchingQuestion && !matchingOnBoard) renderMatchingReveal(data.correctMatches, { topOffset: '7.5rem' });
        tarjetas.forEach(tarjeta => tarjeta.classList.add('opacity-40'));
        return { correctCardIndex: -1, isOrderQuestion, isMatchingQuestion, matchingOnBoard };
    }

    let correctCardIndex = -1;
    if (data.percentages) {
        tarjetas.forEach((tarjeta, i) => revealSurveyCard(tarjeta, i, data.percentages));
        if (data.surveyMultiple) appendSurveyMultipleCaption(data.surveyMultiple.respondents || 0);
    } else {
        // Porcentajes calculados en cliente si el backend no los envía (quiz)
        const quizPercentages = calculatePercentages(data.stats, tarjetas.length);
        tarjetas.forEach((tarjeta, i) => {
            revealQuizCard(tarjeta, i, quizPercentages, data.correctIndex);
            if (i === data.correctIndex) correctCardIndex = i;
        });
    }
    return { correctCardIndex, isOrderQuestion, isMatchingQuestion, matchingOnBoard };
}
