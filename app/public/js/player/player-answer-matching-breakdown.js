/**
 * @fileoverview Desglose del resultado de preguntas de emparejar: cada pareja
 * que formó el jugador, marcada como acertada o fallada, y en las falladas
 * la pareja correcta.
 */

import { getCurrentMatches, getCurrentMatchOptions } from './player-state.js?v=20260922172926';
import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

function leftText(option) {
    return option?.optionText || option?.option_text || '';
}

function rightText(option) {
    return option?.match_value || '';
}

function pairRowHtml({ left, chosen, correct, isCorrect }) {
    const correctHint = isCorrect || !correct
        ? ''
        : `<div class="text-xs text-white/80 mt-1 break-words"><i class="fas fa-arrow-right mr-1"></i>${escapeHtml(correct)}</div>`;
    return `
        <div class="relative rounded-xl p-2 flex items-center gap-2 ${isCorrect ? 'bg-green-500/20 border-2 border-green-500' : 'bg-gray-500/20 border-2 border-gray-500'}">
            <div class="flex-1 min-w-0 text-left">
                <div class="text-white font-bold text-sm uppercase break-words">${escapeHtml(left)} ↔ ${escapeHtml(chosen)}</div>
                ${correctHint}
            </div>
            <div class="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white text-lg font-black ${isCorrect ? 'bg-green-500' : 'bg-gray-600'}">
                ${isCorrect ? '<i class="fas fa-check"></i>' : '<i class="fas fa-times"></i>'}
            </div>
        </div>
    `;
}

/**
 * Filas de parejas. Si no queda el emparejamiento local (p. ej. tras recargar),
 * se muestra solo la pareja correcta de cada elemento.
 */
function pairRowsHtml(details) {
    const options = getCurrentMatchOptions() || [];
    const matches = getCurrentMatches();
    const pairsCorrect = details.pairsCorrect || [];

    return options.map((option, pos) => {
        const isCorrect = !!pairsCorrect[pos];
        const chosenIndex = Array.isArray(matches) ? matches[pos] : null;
        const chosen = chosenIndex === null || chosenIndex === undefined ? rightText(option) : rightText(options[chosenIndex]);
        return pairRowHtml({ left: leftText(option), chosen, correct: rightText(option), isCorrect });
    }).join('');
}

/** Pantalla de resultado de emparejar: puntos, x/N parejas, filas y ranking. */
export function matchingResultHtml(data, rankingHTML) {
    const details = data.matchingDetails || {};
    const total = details.totalPairs || 0;
    const correctCount = details.correctCount || 0;
    return `
        <div class="h-screen w-screen flex flex-col items-center justify-center p-6 overflow-y-auto relative">
            <div class="text-center mb-4">
                <div class="text-6xl font-black text-white drop-shadow-lg">+${data.points} PTS</div>
                <div class="text-lg font-bold text-white/90 mt-1">${_t('player.answer.matching_pairs', { n: correctCount, total }, '{n} de {total} parejas')}</div>
            </div>
            <div class="space-y-2 w-full max-w-md mx-auto px-2">
                ${pairRowsHtml(details)}
            </div>
            ${rankingHTML}
        </div>
    `;
}
