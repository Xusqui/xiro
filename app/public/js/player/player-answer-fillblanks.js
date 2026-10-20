/**
 * @fileoverview Envío y pantalla de resultado de «Completa la frase» (fill_blanks).
 * El jugador manda una palabra por hueco ('' si está vacío); el servidor las compara
 * ignorando mayúsculas y tildes y puntúa por palabra acertada más un bonus de tiempo.
 */

import { setBodyHTML } from './player-streak-ui.js?v=20260922172926';
import { enviarPendiente } from './player-answer.js?v=20260922172926';
import {
    getPin,
    getSessionId,
    getNickname,
    getCanAnswer,
    getHaRespondido,
    setHaRespondido,
    getPendingAnswer,
    setPendingAnswer,
    getSendingAnswer
} from './player-state.js?v=20260922172926';
import { getFillBlanksState, getWords, hasActiveFillBlanks } from './player-fillblanks-state.js?v=20260922172926';
import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

function createRequestId() {
    return `ans_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Palabras a enviar: las propias, completadas con las del equipo si llegan (primer ENVIAR del equipo) */
function resolveWords(teamWords) {
    const own = getWords();
    if (!Array.isArray(teamWords)) return own;
    return own.map((word, i) => word || (typeof teamWords[i] === 'string' ? teamWords[i] : ''));
}

/**
 * Enviar respuesta tipo "fill_blanks".
 * @param {boolean} isAuto - true al agotarse el tiempo en equipos (envía lo que haya)
 * @param {string[]|null} teamWords - palabras del compañero que pulsó ENVIAR (equipos)
 */
export function enviarRespuestaFillBlanks(isAuto = false, teamWords = null) {
    // Ya enviada (p. ej. aviso del equipo o sincronización tras reconectar): no repetir
    if (getHaRespondido()) return;
    // Tiempo agotado: solo el envío automático (blocked-answer) puede mandar lo escrito
    if (!getCanAnswer() && !isAuto) return;
    if (getPendingAnswer() || getSendingAnswer()) return;
    if (!getNickname() || !hasActiveFillBlanks()) return;

    const words = resolveWords(teamWords);
    setHaRespondido(true);

    const room = getSessionId() ? { sessionId: getSessionId() } : { pin: getPin() };
    const payload = {
        ...room,
        nickname: getNickname(),
        answerType: 'fill_blanks',
        words,
        requestId: createRequestId()
    };
    setPendingAnswer({ payload, words, isAuto });

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

/** Frase completa con cada hueco en verde (acierto) o rojo (fallo) */
function sentenceHtml(details) {
    const text = getFillBlanksState()?.text;
    if (!text || !window.XiroFillBlanks) return '';
    const states = (details.blanksCorrect || []).map(ok => (ok ? 'fb-blank--ok' : 'fb-blank--ko'));
    return `<div class="fb-result__sentence w-full max-w-md mx-auto mb-4">
        ${window.XiroFillBlanks.sanitizeSentenceHtml(text, details.lengths || [], { letters: details.words || [], states, sizeClass: 'fb-sentence--player' })}
    </div>`;
}

/** Una fila por hueco: palabra correcta, lo escrito si falló, puntos y pistas */
function rowsHtml(details) {
    const words = details.words || [];
    return words
        .map((word, i) => {
            const ok = Boolean(details.blanksCorrect?.[i]);
            const given = details.given?.[i] || '';
            const hints = details.hintCounts?.[i] || 0;
            const points = details.wordPoints?.[i] || 0;
            return `<div class="fb-result__row">
            <span><i class="fas ${ok ? 'fa-check text-green-200' : 'fa-times text-red-200'} mr-2"></i>${escapeHtml(word)}
                ${!ok && given ? `<span class="fb-result__given ml-2">${escapeHtml(given)}</span>` : ''}
                ${hints ? `<span class="ml-2 text-yellow-200">💡×${hints}</span>` : ''}
            </span>
            <span>+${points}</span>
        </div>`;
        })
        .join('');
}

/** Pantalla de resultado: puntos, x/N palabras, la frase y el desglose. */
export function fillBlanksResultHtml(data, rankingHTML) {
    const details = data.fillBlanksDetails || {};
    const total = details.totalBlanks || (details.words || []).length;
    return `
        <div class="h-screen w-screen flex flex-col items-center justify-center p-4 overflow-y-auto relative">
            <div class="text-center mb-3">
                <div class="text-6xl font-black text-white drop-shadow-lg">+${data.points} PTS</div>
                <div class="text-lg font-bold text-white/90 mt-1">${_t('player.answer.fillblanks_correct', { n: details.correctCount || 0, total }, '{n} de {total} palabras')}</div>
                ${details.timeBonus ? `<div class="text-sm font-bold text-white/70">${_t('player.answer.fillblanks_time_bonus', { pts: details.timeBonus }, '+{pts} de bonus por tiempo')}</div>` : ''}
            </div>
            ${sentenceHtml(details)}
            <div class="w-full max-w-md mx-auto space-y-2">${rowsHtml(details)}</div>
            ${rankingHTML}
        </div>
    `;
}
