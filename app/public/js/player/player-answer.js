/**
 * @fileoverview Gestión de respuestas del jugador
 * Envío y reintentos de respuestas (los eventos y la pantalla de resultado están en
 * player-answer-events.js y player-answer-result.js)
 */

import { socket } from './player-socket-config.js?v=20260922172926';
import { setBodyHTML, applyStreakToResult, replacePendingStreakResult, buildLostStreakInfo } from './player-streak-ui.js?v=20260922172926';
import { getRememberedReveal, timeUpScreenHtml } from './player-reveal-correct.js?v=20260922172926';
import { renderLastRankingSince } from './player-results.js?v=20260922172926';
import {
    getPin, getSessionId, getNickname,
    getCanAnswer, setHaRespondido,
    getPendingAnswer, setPendingAnswer,
    getSendingAnswer, setSendingAnswer,
    getResultReceived,
    getCurrentOrder, clearOrderAutoSendTimer,
    getCurrentMatches, clearMatchAutoSendTimer,
    getStreakInfo
} from './player-state.js?v=20260922172926';

function createRequestId() {
    return `ans_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ===== ENVÍO DE RESPUESTAS =====

/**
 * Enviar respuesta seleccionada
 */
export function enviarRespuesta(i) {
    if (!getCanAnswer()) {
        console.log('🚫 Respuestas bloqueadas (tiempo agotado)');
        return;
    }
    if (getPendingAnswer() || getSendingAnswer()) return;

    clearOrderAutoSendTimer();

    setHaRespondido(true);

    const payload = getSessionId()
        ? { sessionId: getSessionId(), nickname: getNickname(), index: i, requestId: createRequestId() }
        : { pin: getPin(), nickname: getNickname(), index: i, requestId: createRequestId() };

    setPendingAnswer({ payload, index: i });

    // Mostrar spinner
    setBodyHTML(`
        <div class="answer-loading-container">
            <div class="spinner spinner-purple"></div>
            <h2>${_t('player.answer.will_it_be_right', null, '¿Será correcta?')}</h2>
        </div>
    `);

    enviarPendiente();
}

/**
 * Enviar respuesta tipo "order"
 */
export function enviarOrdenRespuesta(isAuto = false) {
    if (!getCanAnswer() && !isAuto) {
        console.log('🚫 Respuestas bloqueadas (tiempo agotado)');
        return;
    }
    if (getPendingAnswer() || getSendingAnswer()) return;
    if (!getNickname()) { console.warn('Bloqueado: estado de jugador vacío'); return; }

    const order = getCurrentOrder();
    if (!Array.isArray(order) || order.length === 0) {
        console.warn('⚠️ Orden no disponible para enviar');
        return;
    }

    clearOrderAutoSendTimer();
    setHaRespondido(true);

    const payload = getSessionId()
        ? { sessionId: getSessionId(), nickname: getNickname(), answerType: 'order', order: [...order], requestId: createRequestId() }
        : { pin: getPin(), nickname: getNickname(), answerType: 'order', order: [...order], requestId: createRequestId() };

    setPendingAnswer({ payload, order: [...order], isAuto });

    if (!isAuto) {
        setBodyHTML(`
            <div class="answer-loading-container">
                <div class="spinner spinner-purple"></div>
                <h2>${_t('player.answer.sending_order', null, 'Enviando tu orden...')}</h2>
            </div>
        `);
    }

    enviarPendiente();
}

/**
 * Enviar respuesta tipo "matching" (emparejamiento)
 */
export function enviarMatchingRespuesta(isAuto = false) {
    if (!getCanAnswer() && !isAuto) {
        console.log('🚫 Respuestas bloqueadas (tiempo agotado)');
        return;
    }
    if (getPendingAnswer() || getSendingAnswer()) return;

    const matches = getCurrentMatches();
    if (!Array.isArray(matches) || matches.length === 0) {
        console.warn('⚠️ Emparejamiento no disponible para enviar');
        return;
    }

    clearMatchAutoSendTimer();
    setHaRespondido(true);

    const payload = getSessionId()
        ? { sessionId: getSessionId(), nickname: getNickname(), answerType: 'matching', matches: [...matches], requestId: createRequestId() }
        : { pin: getPin(), nickname: getNickname(), answerType: 'matching', matches: [...matches], requestId: createRequestId() };

    setPendingAnswer({ payload, matches: [...matches], isAuto });

    if (!isAuto) {
        setBodyHTML(`
            <div class="answer-loading-container">
                <div class="spinner spinner-amber"></div>
                <h2>${_t('player.answer.sending_answer', null, 'Enviando tu respuesta...')}</h2>
            </div>
        `);
    }

    enviarPendiente();
}

/**
 * Enviar respuesta numérica aproximada
 */
export function enviarRespuestaNumerica(isAuto = false) {
    if (!getCanAnswer() && !isAuto) {
        console.log('🚫 Respuestas bloqueadas (tiempo agotado)');
        return;
    }

    if (getPendingAnswer() || getSendingAnswer()) return;

    if (!getNickname()) {
        console.warn('Bloqueado envío de respuesta: No hay nickname (estado reseteado)');
        return;
    }

    const inputElement = document.getElementById('numeric-answer-input');
    if (!inputElement) {
        console.warn('⚠️ Input numérico no encontrado');
        return;
    }

    const playerAnswer = inputElement.value.trim();
    if (!playerAnswer || isNaN(playerAnswer)) {
        // Mostrar error visual
        inputElement.classList.add('border-red-500', 'ring-2', 'ring-red-300');
        setTimeout(() => {
            inputElement.classList.remove('border-red-500', 'ring-2', 'ring-red-300');
        }, 1000);
        return;
    }

    clearOrderAutoSendTimer();
    setHaRespondido(true);

    const payload = getSessionId()
        ? { sessionId: getSessionId(), nickname: getNickname(), answerType: 'numeric', playerAnswer: parseInt(playerAnswer), requestId: createRequestId() }
        : { pin: getPin(), nickname: getNickname(), answerType: 'numeric', playerAnswer: parseInt(playerAnswer), requestId: createRequestId() };

    setPendingAnswer({ payload, playerAnswer: parseInt(playerAnswer) });

    if (!isAuto) {
        setBodyHTML(`
            <div class="answer-loading-container">
                <div class="spinner spinner-purple"></div>
                <h2>${_t('player.answer.validating', null, 'Validando tu respuesta...')}</h2>
            </div>
        `);
    }

    enviarPendiente();
}

/**
 * Enviar respuesta tipo "word_scramble"
 */
export function enviarRespuestaWordScramble(isAuto = false) {
    if (!getCanAnswer() && !isAuto) {
        console.log('🚫 Respuestas bloqueadas (tiempo agotado)');
        return;
    }
    if (getPendingAnswer() || getSendingAnswer()) return;
 
    if (!getNickname()) {
        console.warn('Bloqueado envío de respuesta: No hay nickname (estado reseteado)');
        return;
    }

    const wordAnswer = (window._wsAnswer || '').trim().toUpperCase();
    if (!wordAnswer) {
        // Feedback visual: parpadear las cajas vacías
        const boxes = document.querySelectorAll('.ws-box');
        boxes.forEach(b => b.classList.add('border-red-500'));
        setTimeout(() => boxes.forEach(b => b.classList.remove('border-red-500')), 800);
        return;
    }

    clearOrderAutoSendTimer();
    setHaRespondido(true);

    const payload = getSessionId()
        ? { sessionId: getSessionId(), nickname: getNickname(), answerType: 'word_scramble', playerAnswer: wordAnswer, requestId: createRequestId() }
        : { pin: getPin(), nickname: getNickname(), answerType: 'word_scramble', playerAnswer: wordAnswer, requestId: createRequestId() };

    setPendingAnswer({ payload, playerAnswer: wordAnswer });

    if (!isAuto) {
        setBodyHTML(`
            <div class="answer-loading-container">
                <div class="spinner spinner-purple"></div>
                <h2>Verificando tu palabra...</h2>
            </div>
        `);
    }

    enviarPendiente();
}

/**
 * Enviar respuesta tipo "multiple_choice"
 */
export function enviarRespuestaMultipleChoice(selectedIndices, isAuto = false) {
    if (!getCanAnswer() && !isAuto) {
        console.log('🚫 Respuestas bloqueadas (tiempo agotado)');
        return;
    }
    if (getPendingAnswer() || getSendingAnswer()) return;

    if (!getNickname()) {
        console.warn('Bloqueado envío de respuesta: No hay nickname (estado reseteado)');
        return;
    }

    if (!Array.isArray(selectedIndices) || selectedIndices.length === 0) {
        console.warn('⚠️ Índices seleccionados no válidos');
        return;
    }

    clearOrderAutoSendTimer();
    setHaRespondido(true);

    const payload = getSessionId()
        ? { sessionId: getSessionId(), nickname: getNickname(), answerType: 'multiple_choice', selectedIndices: [...selectedIndices], requestId: createRequestId() }
        : { pin: getPin(), nickname: getNickname(), answerType: 'multiple_choice', selectedIndices: [...selectedIndices], requestId: createRequestId() };

    setPendingAnswer({ payload, selectedIndices: [...selectedIndices] });

    if (!isAuto) {
        setBodyHTML(`
            <div class="answer-loading-container">
                <div class="spinner spinner-purple"></div>
                <h2>Verificando tu selección...</h2>
            </div>
        `);
    }

    enviarPendiente();
}

// Rechazos definitivos del servidor: no se reintenta el envío
const FINAL_REJECTION_REASONS = new Set([
    'game-closed',
    'invalid-payload',
    'invalid-index',
    'invalid-options',
    'question-missing',
    'invalid-order',
    'invalid-order-length',
    'duplicate-order',
    'invalid-word-scramble',
    'invalid-matches',
    'invalid-matches-length',
    'duplicate-matches'
]);

/** true si el servidor rechazó la respuesta de forma definitiva (y ya se ha avisado al jugador). */
/**
 * Envío automático de ordenar/emparejar (al agotarse el tiempo) que llegó tarde al
 * servidor (mala conexión): para el jugador es igual que no haber respondido, así
 * que ve la pantalla de tiempo agotado con la respuesta correcta y el ranking, y la
 * animación de racha perdida si estaba en racha. Si la revelación aún no ha llegado,
 * se muestra "Esperando resultados" y reveal-answer la completará.
 */
function showTimeUpAfterLateAutoSend() {
    const remembered = getRememberedReveal();
    const html = timeUpScreenHtml(remembered?.data || null);
    const renderRanking = remembered ? () => renderLastRankingSince(remembered.at) : null;

    const currentStreak = getStreakInfo();
    if (currentStreak?.isInStreak) {
        applyStreakToResult(buildLostStreakInfo(currentStreak), html);
        replacePendingStreakResult(html, renderRanking);
        return;
    }

    setBodyHTML(html);
    if (renderRanking) renderRanking();
}

function handleFinalRejection(resp, pendingAnswer) {
    if (!(resp && resp.ok === false)) return false;
    const reason = resp.reason || 'unknown';
    console.warn('❌ Respuesta rechazada por el servidor:', reason);
    if (!FINAL_REJECTION_REASONS.has(reason)) return false;

    setPendingAnswer(null);
    setHaRespondido(false);

    if (reason === 'game-closed' && pendingAnswer?.isAuto) {
        showTimeUpAfterLateAutoSend();
        return true;
    }

    setBodyHTML(`
                    <div class="answer-rejected-container">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h2>${_t('player.answer.not_accepted_title', null, 'Respuesta no aceptada')}</h2>
                        <p>${_t('player.answer.not_accepted_text', null, 'El juego ya no acepta respuestas para esta pregunta.')}</p>
                    </div>
                `);
    return true;
}

function showAckTimeoutWaiting() {
    console.warn('⏳ ACK timeout, manteniendo estado de espera para evitar duplicados');
    setBodyHTML(`
                <div class="answer-loading-container">
                    <div class="spinner spinner-purple"></div>
                    <h2>${_t('player.answer.sent', null, '¡Respuesta Enviada!')}</h2>
                    <p>${_t('player.answer.waiting_server', null, 'Esperando confirmación del servidor...')}</p>
                </div>
            `);
}

function showRetryScreen(err, resp) {
    setHaRespondido(false);
    console.warn('⚠️ Respuesta no confirmada, reintentando...', { err, resp });
    document.body.innerHTML = _tHtml(`
                <div class="answer-retry-container">
                    <i class="fas fa-wifi"></i>
                    <h2>Reconectando...</h2>
                    <p>No pudimos enviar tu respuesta. Revisa tu conexión y toca para reintentar.</p>
                    <button data-player-action="retry-pending" class="btn-primary">Reintentar</button>
                </div>
            `);
}

/** Resultado del ack de submit-answer. */
function handleSubmitAck(err, resp) {
    setSendingAnswer(false);
    const pendingAnswer = getPendingAnswer();

    console.log('📥 Callback de submit-answer recibido:', { err, resp });

    // Si ya recibimos answer-result, no sobrescribir
    if (getResultReceived()) {
        console.log('✅ Result already received via answer-result event, ignoring callback');
        setPendingAnswer(null);
        return;
    }

    if (handleFinalRejection(resp, pendingAnswer)) return;

    // Timeout de ack: puede estar procesada en servidor, evitar bucle de reconexión
    if (err && err.message && err.message.includes('timed out')) {
        showAckTimeoutWaiting();
        return;
    }

    // Error de red o rechazo no definitivo - reintentar
    if (err || !resp || resp.ok !== true) {
        showRetryScreen(err, resp);
    } else if (resp.waitingForTeams) {
        // Team mode: esperando que el resto del equipo responda
        // El evento 'answer-pending' reemplazará el spinner con la pantalla de espera
        console.log('⏳ Modo equipos: esperando al resto del equipo');
        setPendingAnswer(null);
    } else {
        console.log('✅ Respuesta confirmada por el servidor');
        setPendingAnswer(null);
    }
}

/**
 * Enviar respuesta pendiente (con reintentos)
 */
export function enviarPendiente() {
    const pendingAnswer = getPendingAnswer();
    if (!pendingAnswer || getSendingAnswer()) {
        console.log('🚫 enviarPendiente bloqueado:', {
            pendingAnswer: !!pendingAnswer,
            sendingAnswer: getSendingAnswer()
        });
        return;
    }

    setSendingAnswer(true);

    console.log('📤 Enviando respuesta al servidor...');

    socket.timeout(20000).emit('submit-answer', pendingAnswer.payload, handleSubmitAck);
}

// ===== EVENTOS DE RESPUESTAS =====
