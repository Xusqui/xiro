/**
 * @fileoverview Respuesta correcta al revelar (reveal-answer), en el formato de
 * cada tipo: parejas, orden, palabra, opciones correctas o texto/número.
 */

import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

function hasValue(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
}

function listHtml(items) {
    return `<div class="space-y-1 text-left">${items.map(item =>
        `<p class="text-base font-black break-words hyphens-auto" lang="es">${item}</p>`
    ).join('')}</div>`;
}

/** Contenido de la respuesta correcta, o '' si el reveal no trae ninguna. */
function correctContentHtml(data) {
    if (Array.isArray(data.correctMatches) && data.correctMatches.length > 0) {
        return listHtml(data.correctMatches.map(pair =>
            `${escapeHtml(pair.leftText)} ↔ ${escapeHtml(pair.rightText)}`));
    }
    if (Array.isArray(data.correctOrder) && data.correctOrder.length > 0) {
        return listHtml(data.correctOrder.map((item, i) => `${i + 1}. ${escapeHtml(item.text)}`));
    }
    if (hasValue(data.correctWord)) {
        return `<p class="text-2xl font-black tracking-widest break-words">${escapeHtml(String(data.correctWord).toUpperCase())}</p>`;
    }
    if (Array.isArray(data.correctOptionTexts) && data.correctOptionTexts.length > 0) {
        return listHtml(data.correctOptionTexts.map(text => escapeHtml(text)));
    }
    if (hasValue(data.correctAnswer)) {
        return `<p class="text-xl font-black break-words hyphens-auto" lang="es">${escapeHtml(String(data.correctAnswer))}</p>`;
    }
    return '';
}

/** Bloque "Correcta:" para la pantalla de tiempo agotado o bajo el resultado. */
export function correctAnswerBlockHtml(data) {
    const content = correctContentHtml(data || {});
    if (!content) return '';
    return `<div class="mt-4 bg-black/30 rounded-xl p-4 w-full max-w-sm mx-auto">
               <p class="text-sm uppercase font-bold mb-1 opacity-80">${_t('player.answer.correct_label', null, 'Correcta:')}</p>
               ${content}
           </div>`;
}

// Última revelación de la pregunta en curso. La guarda reveal-answer aunque el jugador
// ya hubiera enviado (envío automático de ordenar/emparejar): si después el servidor
// rechaza ese envío por llegar tarde, se muestra con ella la pantalla de tiempo agotado.
// Se borra al empezar cada pregunta (el payload no dice a qué pregunta pertenece).
let _rememberedReveal = null;

export function rememberReveal(data) {
    _rememberedReveal = { data, at: Date.now() };
}

/** @returns {{ data: Object, at: number }|null} */
export function getRememberedReveal() {
    return _rememberedReveal;
}

export function forgetReveal() {
    _rememberedReveal = null;
}

/** Pantalla "¡Tiempo agotado!": respuesta correcta y ranking, o "Esperando resultados" sin revelación. */
export function timeUpScreenHtml(data = null) {
    if (!data) {
        return `
            <div class="time-up-container">
                <i class="fas fa-clock"></i>
                <h2>${_t('player.answer.time_up', null, '¡TIEMPO AGOTADO!')}</h2>
                <p>${_t('player.answer.waiting_results', null, 'Esperando resultados...')}</p>
            </div>
        `;
    }

    const justBlock = data.justification
        ? `<div class="mt-2 bg-black/30 rounded-xl p-4 w-full max-w-sm text-sm leading-relaxed">${escapeHtml(data.justification)}</div>`
        : '';
    return `
        <div class="time-up-container" data-reveal-shown="1">
            <i class="fas fa-clock"></i>
            <h2>${_t('player.answer.time_up', null, '¡TIEMPO AGOTADO!')}</h2>
            ${correctAnswerBlockHtml(data)}
            ${justBlock}
            <div class="mt-6 bg-black/20 rounded-2xl p-4 max-w-md w-full mx-auto">
                <h3 class="text-xl font-black uppercase mb-3 text-center">${_t('player.answer.ranking', null, 'Ranking')}</h3>
                <div id="ranking-container" class="space-y-2"></div>
            </div>
        </div>
    `;
}

/**
 * Jugador que ya respondió: si su pantalla de resultado no enseña la respuesta
 * correcta (p. ej. ordenar parcial o numérica aproximada), se añade al revelar.
 */
export function appendCorrectAnswerToResult(data) {
    const result = document.querySelector('[data-result-screen]');
    if (!result || result.hasAttribute('data-correct-shown')) return;
    const block = correctAnswerBlockHtml(data);
    if (!block) return;
    result.insertAdjacentHTML('beforeend', block);
    result.setAttribute('data-correct-shown', '1');
}
