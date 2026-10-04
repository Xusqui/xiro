/**
 * @fileoverview Pantalla de resultado del jugador tras responder (answer-result):
 * ranking, desglose de ordenar y de selección múltiple, encuesta, acierto,
 * aproximación y fallo.
 */

import './player-answer-visual-logic.js?v=20260922172926';
import { buildMultipleChoiceBreakdownHTML } from './player-answer-mc-breakdown.js?v=20260922172926';
import { matchingResultHtml } from './player-answer-matching-breakdown.js?v=20260922172926';
import { getCurrentOrder, getCurrentOrderOptions, getCurrentSlideType } from './player-state.js?v=20260922172926';
import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

function getPlayerAnswerVisualLogic() {
    const fallback = {
        shouldShowApproximateResult({ isOrder, currentSlideType, data }) {
            return !isOrder
                && (currentSlideType === 'numeric_approximation' || typeof data.correctAnswer === 'number')
                && data.correct === false
                && Number(data.points) > 0;
        },
        resolveResultColor({ isOrder, isFullyCorrect, isApproximate, isCorrect }) {
            if (isOrder) {
                return isFullyCorrect ? 'bg-green-500' : 'bg-blue-500';
            }

            if (isCorrect === null) {
                return 'bg-plum-600';
            }

            if (isCorrect) {
                return 'bg-green-500';
            }

            return isApproximate ? 'bg-yellow-500' : 'bg-red-500';
        }
    };

    return globalThis.PlayerAnswerVisualLogic || fallback;
}

function rankingHtml(data) {
    if (!(data.ranking && data.ranking.length > 0 && data.correct !== null)) return '';
    return `
                <div class="mt-6 bg-black/20 rounded-2xl p-4 max-w-md w-full mx-auto">
                    <h3 class="text-xl font-black uppercase mb-3 text-center">${_t('player.answer.ranking', null, 'Ranking')}</h3>
                    <div id="ranking-container" class="space-y-2">
                        ${data.ranking.slice(0, 5).map(player => `
                            <div class="flex justify-center items-center bg-white/10 rounded-lg px-3 py-2">
                                <span class="font-bold">${player.position}. ${escapeHtml(player.nickname)}</span>
                                <span class="mx-3"><i class="fas fa-arrow-right"></i></span>
                                <span class="font-black">${player.score} pts</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
}

function orderResultHtml(data, rankingHTML) {
    const positionsCorrect = data.orderDetails?.positionsCorrect || [];
    const orderOptions = getCurrentOrderOptions() || [];

    // Obtener el orden actual del jugador
    const currentOrder = getCurrentOrder() || [];

    // Construir tarjetas de opciones con estado
    let optionsCardsHTML = '';
    if (currentOrder.length > 0) {
        optionsCardsHTML = `
            <div class="space-y-2 w-full max-w-md mx-auto px-4">
                ${currentOrder.map((optionIndex, position) => {
        const isCorrect = positionsCorrect[position] || false;
        const option = orderOptions[optionIndex];
        const optionText = option?.optionText || option?.text || option?.option_text || '';

        return `
                        <div class="relative rounded-xl p-2 flex items-center gap-2 ${isCorrect ? 'bg-green-500/20 border-2 border-green-500' : 'bg-gray-500/20 border-2 border-gray-500'}">
                            <span class="text-white font-black text-lg shrink-0 w-9 h-9 flex items-center justify-center bg-white/20 rounded-full">${position + 1}</span>
                            <span class="text-white font-bold text-sm uppercase flex-1 break-words">${escapeHtml(optionText)}</span>
                            <div class="absolute -top-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-black ${isCorrect ? 'bg-green-500 ring-3 ring-green-300' : 'bg-gray-600 ring-3 ring-gray-400'}">
                                ${isCorrect ? '<i class="fas fa-check"></i>' : '<i class="fas fa-times"></i>'}
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        `;
    }

    return `
        <div class="h-screen w-screen flex flex-col items-center justify-center p-6 overflow-y-auto relative">
            <!-- Puntuación grande semitransparente superpuesta -->
            <div class="absolute top-2 left-0 right-0 text-center pointer-events-none">
                <div class="text-7xl font-black text-white drop-shadow-lg opacity-60 mix-blend-screen">
                    +${data.points} PTS
                </div>
            </div>
            
            <!-- Lista de opciones -->
            <div class="flex flex-col items-center justify-center flex-1 w-full mt-32">
                ${optionsCardsHTML}
            </div>
            
            <!-- Ranking abajo si existe -->
            ${rankingHTML}
        </div>
    `;
}

function multipleChoiceResultHtml(data, rankingHTML) {
    // Multiple Choice: desglose de marcadas (acertadas/falladas) + correctas no marcadas
    const breakdownHTML = buildMultipleChoiceBreakdownHTML(data.multipleChoiceDetails);

    const totalIcon = data.points > 0 ? 'fa-check-circle' : 'fa-times-circle';
    const totalText = data.points > 0 ? _t('player.answer.correct', null, '¡BIEN!') : _t('player.answer.wrong', null, '¡FALLASTE!');
    const totalPointsSign = data.points >= 0 ? '+' : '';

    return `
        <i class="fas ${totalIcon} text-7xl mb-3 animate-pop"></i>
        <h2 class="text-4xl font-black italic uppercase mb-4">${totalText}</h2>
        ${breakdownHTML}
        <div class="bg-white/20 rounded-2xl p-4 mb-4">
            <p class="text-sm uppercase font-bold mb-1">Total</p>
            <p class="text-5xl font-black">${totalPointsSign}${data.points} PTS</p>
        </div>
        ${rankingHTML}
    `;
}

function surveyResultHtml() {
    // Survey
    return `
        <i class="fas fa-vote-yea text-9xl mb-4 animate-pop"></i>
        <h2 class="text-5xl font-black italic uppercase">${_t('player.answer.vote_registered', null, '¡Voto Registrado!')}</h2>
        <p class="text-3xl font-black mt-4 bg-black/20 py-2 px-8 rounded-full">${_t('player.answer.survey_label', null, 'Encuesta')}</p>
    `;
}

function correctResultHtml(data, rankingHTML) {
    // Correcto
    return `
        ${_t('player.answer.yes', null, '<img src="/images/chamaleon/thumbs_up.svg" class="w-32 h-32 mb-4 animate-float drop-shadow-lg" alt="👍">')}
        <p class="text-3xl font-black mt-4 bg-black/20 py-2 px-8 rounded-full">+${data.points} PTS</p>
        ${data.justification ? `<p class="text-lg mt-4 bg-white/20 p-4 rounded-2xl max-w-md">${escapeHtml(data.justification)}</p>` : ''}
        ${rankingHTML}
    `;
}

function approximateResultHtml(data, rankingHTML) {
    // Aproximada (pregunta numérica con puntos parciales)
    return `
        <i class="fas fa-bullseye text-9xl mb-4 animate-pop"></i>
        <h2 class="text-5xl font-black italic uppercase">${_t('player.answer.approximate', null, '¡APROXIMADA!')}</h2>
        <p class="text-3xl font-black mt-4 bg-black/20 py-2 px-8 rounded-full">+${data.points} PTS</p>
        ${rankingHTML}
    `;
}

function wrongResultHtml(data, rankingHTML) {
    // Incorrecto
    return `
        ${_t('player.answer.no', null, '<img src="/images/chamaleon/thumbs_down.svg" class="w-32 h-32 mb-4 animate-float drop-shadow-lg" alt="👎">')}
        <p class="text-3xl font-black mt-4 bg-black/20 py-2 px-8 rounded-full">+${data.points} PTS</p>
        ${hasCorrectAnswer(data) ? `<div class="mt-4 bg-white/20 p-4 rounded-2xl max-w-md">
            <p class="text-sm uppercase font-bold mb-2">${_t('player.answer.correct_answer_label', null, 'Respuesta correcta:')}</p>
            <p class="text-xl font-black">${escapeHtml(String(data.correctAnswer))}</p>
        </div>` : ''}
        ${data.justification ? `<p class="text-lg mt-4 bg-white/20 p-4 rounded-2xl max-w-md">${escapeHtml(data.justification)}</p>` : ''}
        ${rankingHTML}
    `;
}

function hasCorrectAnswer(data) {
    return data.correctAnswer !== null && data.correctAnswer !== undefined && String(data.correctAnswer).trim() !== '';
}

/**
 * ¿La pantalla ya enseña la respuesta correcta? Si no (ordenar parcial,
 * numérica aproximada...), el reveal la añade debajo.
 */
function showsCorrectAnswer(data, isApproximate) {
    if (data.correct === true || data.correct === null) return true;
    if (data.matchingDetails || data.multipleChoiceDetails?.options) return true;
    if (data.orderDetails || isApproximate) return false;
    return hasCorrectAnswer(data);
}

/** Contenido según el tipo de pregunta y el resultado. */
function resultMessageHtml(data, isApproximate) {
    const rankingHTML = rankingHtml(data);
    if (data.orderDetails) return orderResultHtml(data, rankingHTML);
    if (data.matchingDetails) return matchingResultHtml(data, rankingHTML);
    if (data.multipleChoiceDetails && data.multipleChoiceDetails.options) return multipleChoiceResultHtml(data, rankingHTML);
    if (data.correct === null) return surveyResultHtml();
    if (data.correct) return correctResultHtml(data, rankingHTML);
    if (isApproximate) return approximateResultHtml(data, rankingHTML);
    return wrongResultHtml(data, rankingHTML);
}

/** HTML completo de la pantalla de resultado (fondo según acierto/fallo). */
export function buildAnswerResultHTML(data) {
    // Ordenar y emparejar: verde si todo está bien, azul si es parcial
    const isOrder = !!(data.orderDetails || data.matchingDetails);
    const correctCount = (data.orderDetails || data.matchingDetails)?.correctCount || 0;
    const totalOptions = data.orderDetails?.totalOptions || data.matchingDetails?.totalPairs || 0;
    const isFullyCorrect = totalOptions > 0 && correctCount === totalOptions;
    const visualLogic = getPlayerAnswerVisualLogic();
    const isApproximate = visualLogic.shouldShowApproximateResult({
        isOrder,
        currentSlideType: getCurrentSlideType(),
        data
    });
    const color = visualLogic.resolveResultColor({
        isOrder,
        isFullyCorrect,
        isApproximate,
        isCorrect: data.correct
    });

    const messageHTML = resultMessageHtml(data, isApproximate);
    const correctShown = showsCorrectAnswer(data, isApproximate) ? ' data-correct-shown="1"' : '';
    return `<div data-result-screen${correctShown} class="player-result-enter h-screen w-screen flex flex-col items-center justify-center ${color} text-white text-center p-6 overflow-y-auto">${messageHTML}</div>`;
}
