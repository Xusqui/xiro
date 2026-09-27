/**
 * @fileoverview Eventos de socket de la pantalla del jugador relacionados con la
 * respuesta: pausa del temporizador, bloqueo por tiempo, reveal, espera del
 * equipo y resultado.
 */

import { socket } from './player-socket-config.js?v=20260922172926';
import { applyStreakToResult, cancelStreakAnimation } from './player-streak-ui.js?v=20260922172926';
import { enviarOrdenRespuesta, enviarMatchingRespuesta } from './player-answer.js?v=20260922172926';
import { buildAnswerResultHTML } from './player-answer-result.js?v=20260922172926';
import {
    setCanAnswer, getHaRespondido,
    setPendingAnswer, setSendingAnswer, setResultReceived,
    getCurrentOrder, getCurrentMatches, clearOrderAutoSendTimer, clearMatchAutoSendTimer,
    startOrderAutoSendTimer, getCurrentSlideType, getStreakInfo
} from './player-state.js?v=20260922172926';
import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

function onTimerPaused(data) {
    console.log('⏸️ Timer pausado por presentador', data);
    clearOrderAutoSendTimer();
    clearMatchAutoSendTimer();
}

function onTimerResumed(data) {
    console.log('▶️ Timer reanudado por presentador', data);
    const remaining = data?.remainingTime;
    if (remaining > 0 && !getHaRespondido()) {
        if (getCurrentOrder()) {
            startOrderAutoSendTimer(remaining);
        } else if (getCurrentMatches()) {
            window.startMatchAutoSendTimer?.(remaining);
        }
    }
}

/** Tiempo agotado (o todos respondieron): se bloquean las respuestas. */
function onBlockedAnswer(data) {
    console.log('⏱️ Respuestas bloqueadas:', data);
    clearOrderAutoSendTimer();
    clearMatchAutoSendTimer();

    // Auto-enviar orden actual antes de bloquear (captura puntuación parcial)
    if (!getHaRespondido() && getCurrentOrder()) {
        enviarOrdenRespuesta(true);
    }

    // Auto-enviar emparejamiento actual antes de bloquear
    if (!getHaRespondido() && getCurrentMatches()) {
        enviarMatchingRespuesta(true);
    }

    setCanAnswer(false);

    if (getCurrentSlideType() === 'info' || getCurrentSlideType() === 'comment' || getCurrentSlideType() === 'text') {
        return;
    }

    // reveal-answer puede llegar antes (viaja por otro canal de Redis entre
    // workers): no sustituir la pantalla con la respuesta por la de espera
    if (!getHaRespondido() && !document.querySelector('[data-reveal-shown]')) {
        const timeUpHTML = `
            <div class="time-up-container">
                <i class="fas fa-clock"></i>
                <h2>${_t('player.answer.time_up', null, '¡TIEMPO AGOTADO!')}</h2>
                <p>${_t('player.answer.waiting_results', null, 'Esperando resultados...')}</p>
            </div>
        `;
        const currentStreak = getStreakInfo();
        if (currentStreak?.isInStreak) {
            // Racha perdida por tiempo agotado — mostrar animación y ocultar badge
            applyStreakToResult({
                current: 0,
                previous: currentStreak.current,
                threshold: currentStreak.threshold,
                doubleThreshold: currentStreak.doubleThreshold,
                isInStreak: false,
                isInDoubleStreak: false,
                justLost: true,
                justEntered: false,
                justEnteredDoubleStreak: false
            }, timeUpHTML);
        } else {
            document.body.innerHTML = _tHtml(timeUpHTML);
        }
    }
}

/** Pantalla de "tiempo agotado" con la respuesta correcta para quien no respondió. */
function onRevealAnswer(data) {
    if (getCurrentSlideType() === 'info' || getCurrentSlideType() === 'comment' || getCurrentSlideType() === 'text') {
        return;
    }
    if (!getHaRespondido()) {
        // Evita que la animación de racha perdida (blocked-answer) pinte después
        // la pantalla de espera encima de esta
        cancelStreakAnimation();
        const correctBlock = data?.correctAnswer
            ? `<div class="mt-4 bg-black/30 rounded-xl p-4 w-full max-w-sm">
                   <p class="text-sm uppercase font-bold mb-1 opacity-80">${_t('player.answer.correct_label', null, 'Correcta:')}</p>
                   <p class="text-xl font-black break-words hyphens-auto" lang="es">${escapeHtml(data.correctAnswer)}</p>
               </div>`
            : '';
        const justBlock = data?.justification
            ? `<div class="mt-2 bg-black/30 rounded-xl p-4 w-full max-w-sm text-sm leading-relaxed">${escapeHtml(data.justification)}</div>`
            : '';
        document.body.innerHTML = _tHtml(`
            <div class="time-up-container" data-reveal-shown="1">
                <i class="fas fa-clock"></i>
                <h2>${_t('player.answer.time_up', null, '¡TIEMPO AGOTADO!')}</h2>
                ${correctBlock}
                ${justBlock}
                <div class="mt-6 bg-black/20 rounded-2xl p-4 max-w-md w-full mx-auto">
                    <h3 class="text-xl font-black uppercase mb-3 text-center">${_t('player.answer.ranking', null, 'Ranking')}</h3>
                    <div id="ranking-container" class="space-y-2"></div>
                </div>
            </div>
        `);
    }
}

/** Modo equipos: respuesta enviada, a la espera del resto del equipo. */
function onAnswerPending(data) {
    console.log('⏳ Esperando al equipo:', data);

    document.body.innerHTML = _tHtml(`
        <div class="team-waiting-container">
            <div class="team-waiting-icon">
                <i class="fas fa-users"></i>
                <div class="team-checkmark">
                    <i class="fas fa-check"></i>
                </div>
            </div>
            <h2>${_t('player.answer.sent', null, '¡Respuesta Enviada!')}</h2>
            <div class="team-waiting-info">
                <p class="team-waiting-label">${_t('player.answer.waiting_team', null, 'Esperando a tu equipo...')}</p>
                <p class="team-waiting-name">${escapeHtml(data.teamName)}</p>
                <div class="team-waiting-count">
                    <span class="count-answered">${data.answered}</span>
                    <span class="count-separator">/</span>
                    <span class="count-total">${data.total}</span>
                </div>
                <p class="team-waiting-subtext">${_t('player.answer.players_answered', null, 'jugadores han respondido')}</p>
            </div>
            <div class="loading-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>
    `);
}

function onAnswerResult(data, ack) {
    console.log('📥 answer-result recibido', {
        hasMultipleChoiceDetails: !!data.multipleChoiceDetails,
        correct: data.correct,
        points: data.points,
        dataKeys: Object.keys(data)
    });
    setResultReceived(true);
    const resultHTML = buildAnswerResultHTML(data);

    // Confirmar recepción y resetear estado
    setPendingAnswer(null);
    setSendingAnswer(false);
    setResultReceived(false);
    if (typeof ack === 'function') ack();

    // Mostrar resultado (con animación de racha si corresponde)
    applyStreakToResult(data.streak, resultHTML);
}

/**
 * Registrar eventos relacionados con respuestas
 */
export function registerAnswerEvents() {
    socket.on('timer-paused', onTimerPaused);
    socket.on('timer-resumed', onTimerResumed);
    socket.on('blocked-answer', onBlockedAnswer);
    socket.on('reveal-answer', onRevealAnswer);
    socket.on('answer-pending', onAnswerPending);
    socket.on('answer-result', onAnswerResult);
}
