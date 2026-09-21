/**
 * @fileoverview Desglose del resultado de preguntas de respuesta múltiple.
 * Muestra las opciones marcadas (acertadas y falladas) y también las
 * correctas que el jugador no llegó a marcar.
 */

import { escapeHtml } from '../core/sanitize.js?v=20260921211928';

const STYLES = {
    correct: { bg: 'bg-green-600/30', border: 'border-green-400', icon: 'fa-check' },
    incorrect: { bg: 'bg-red-600/30', border: 'border-red-400', icon: 'fa-times' },
    missed: { bg: 'bg-gray-600/30', border: 'border-gray-300', icon: 'fa-eye-slash' }
};

function translate(key, fallback) {
    if (typeof window !== 'undefined' && typeof window._t === 'function') {
        return window._t(key, null, fallback);
    }
    return fallback;
}

function buildRow({ text, style, pointsLabel, tag }) {
    return `
        <div class="${style.bg} ${style.border} border-2 rounded-lg p-3 flex items-center justify-between">
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <i class="fas ${style.icon} text-lg"></i>
                <span class="font-bold text-sm uppercase break-words">${escapeHtml(text)}</span>
                ${tag ? `<span class="text-[10px] font-black uppercase bg-white/25 rounded-full px-2 py-0.5 shrink-0">${escapeHtml(tag)}</span>` : ''}
            </div>
            <span class="font-black text-xl shrink-0">${pointsLabel}</span>
        </div>
    `;
}

function getOptionText(mcDetails, index) {
    const option = mcDetails.options?.[index];
    return option?.text || '';
}

function buildSelectedRows(mcDetails, correctSet) {
    return (mcDetails.selectedIndices || []).map((idx) => {
        const isCorrect = correctSet.has(idx);
        const points = isCorrect ? mcDetails.pointsPerCorrect : -mcDetails.penaltyPerIncorrect;
        const sign = points >= 0 ? '+' : '';

        return buildRow({
            text: getOptionText(mcDetails, idx),
            style: isCorrect ? STYLES.correct : STYLES.incorrect,
            pointsLabel: `${sign}${points}`
        });
    });
}

function buildMissedRows(mcDetails, correctSet) {
    const selectedSet = new Set(mcDetails.selectedIndices || []);
    const missedTag = translate('player.answer.mc_missed', 'NO MARCADA');

    return [...correctSet]
        .filter((idx) => !selectedSet.has(idx))
        .sort((a, b) => a - b)
        .map((idx) => buildRow({
            text: getOptionText(mcDetails, idx),
            style: STYLES.missed,
            pointsLabel: '0',
            tag: missedTag
        }));
}

function buildPerfectRow(mcDetails) {
    if (!mcDetails.isPerfect || !(mcDetails.perfectBonus > 0)) {
        return '';
    }

    return `
        <div class="bg-yellow-500/30 border-2 border-yellow-400 rounded-lg p-3 flex items-center justify-between">
            <div class="flex items-center gap-2 flex-1">
                <i class="fas fa-trophy text-lg text-yellow-400"></i>
                <span class="font-bold text-sm uppercase">${escapeHtml(translate('player.answer.mc_perfect', 'PERFECTO'))}</span>
            </div>
            <span class="font-black text-xl">+${mcDetails.perfectBonus}</span>
        </div>
    `;
}

/**
 * Construye el HTML del desglose de una respuesta múltiple.
 *
 * @param {Object} mcDetails - Detalles enviados por el servidor.
 * @returns {string} HTML del desglose completo.
 */
export function buildMultipleChoiceBreakdownHTML(mcDetails) {
    if (!mcDetails || !mcDetails.options) {
        return '';
    }

    const correctSet = new Set(mcDetails.correctIndices || []);
    const rows = [
        ...buildSelectedRows(mcDetails, correctSet),
        ...buildMissedRows(mcDetails, correctSet)
    ].join('');

    return `<div class="w-full max-w-lg space-y-2 mb-4">${rows}${buildPerfectRow(mcDetails)}</div>`;
}
