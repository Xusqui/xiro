/**
 * @fileoverview Envío y pantalla de resultado de la Sopa de letras (word_search).
 * El jugador manda las coordenadas de las palabras que ha marcado; el servidor
 * vuelve a leer las letras en su rejilla y puntúa por palabra encontrada.
 */

import { setBodyHTML } from './player-streak-ui.js?v=20260922172926';
import { enviarPendiente } from './player-answer.js?v=20260922172926';
import {
    getPin, getSessionId, getNickname,
    getCanAnswer, setHaRespondido,
    getPendingAnswer, setPendingAnswer, getSendingAnswer
} from './player-state.js?v=20260922172926';
import { getFoundSelections, hasActiveWordSearch } from './player-wordsearch-state.js?v=20260922172926';
import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

function createRequestId() {
    return `ans_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Enviar respuesta tipo "word_search".
 * @param {boolean} isAuto - true al agotarse el tiempo (envía lo encontrado hasta entonces)
 */
export function enviarRespuestaWordSearch(isAuto = false) {
    // Tiempo agotado: solo el envío automático (blocked-answer) puede mandar lo encontrado
    if (!getCanAnswer() && !isAuto) return;
    if (getPendingAnswer() || getSendingAnswer()) return;
    if (!getNickname() || !hasActiveWordSearch()) return;

    const found = getFoundSelections();
    setHaRespondido(true);

    const room = getSessionId() ? { sessionId: getSessionId() } : { pin: getPin() };
    const payload = { ...room, nickname: getNickname(), answerType: 'word_search', found, requestId: createRequestId() };
    setPendingAnswer({ payload, found, isAuto });

    if (!isAuto) {
        setBodyHTML(`
            <div class="answer-loading-container">
                <div class="spinner spinner-purple"></div>
                <h2>${_t('player.answer.sending_answer', null, 'Enviando tu respuesta...')}</h2>
            </div>
        `);
    }

    enviarPendiente();
}

/** Pantalla de resultado: puntos, x/N palabras y las palabras encontradas o no. */
export function wordSearchResultHtml(data, rankingHTML) {
    const details = data.wordSearchDetails || {};
    const words = Array.isArray(details.words) ? details.words : [];
    const flags = Array.isArray(details.wordsFound) ? details.wordsFound : [];
    const chips = words.map((word, i) => {
        const found = Boolean(flags[i]) && Boolean(window.XiroWordSearch);
        // Encontrada con pista: la ficha muestra ½ (valió la mitad)
        const hinted = found && Boolean(details.hintedWords?.[i]);
        const style = found ? ` style="${window.XiroWordSearch.chipStyle(i)}"` : '';
        const label = escapeHtml(`${word} ${found ? '✓' : '✗'}${hinted ? ' ½' : ''}`);
        return `<span class="ws-word ${found ? 'is-found' : 'is-missed'}${hinted ? ' is-hinted' : ''}" role="listitem" aria-label="${label}"${style}>${escapeHtml(word)}</span>`;
    }).join('');

    return `
        <div class="h-screen w-screen flex flex-col items-center justify-center p-6 overflow-y-auto relative">
            <div class="text-center mb-4">
                <div class="text-6xl font-black text-white drop-shadow-lg">+${data.points} PTS</div>
                <div class="text-lg font-bold text-white/90 mt-1">${_t('player.answer.wordsearch_found', { n: details.foundCount || 0, total: details.totalWords || words.length }, '{n} de {total} palabras')}</div>
            </div>
            <div class="ws-words w-full max-w-md mx-auto px-2" role="list">${chips}</div>
            ${rankingHTML}
        </div>
    `;
}
