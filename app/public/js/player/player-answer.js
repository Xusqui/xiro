/**
 * @fileoverview Gestión de respuestas del jugador
 * Envío, reintentos y resultados de respuestas
 */

import { socket } from './player-socket-config.js?v=20260627191916';
import './player-answer-visual-logic.js?v=20260627191916';
import { applyStreakToResult, setBodyHTML } from './player-streak-ui.js?v=20260627191916';
import {
    getPin, getSessionId, getNickname,
    getCanAnswer, setCanAnswer, getHaRespondido, setHaRespondido,
    getPendingAnswer, setPendingAnswer,
    getSendingAnswer, setSendingAnswer,
    getResultReceived, setResultReceived,
    getCurrentOrder, getCurrentOrderOptions, clearOrderAutoSendTimer,
    startOrderAutoSendTimer,
    getCurrentMatches, clearMatchAutoSendTimer,
    getCurrentSlideType, getStreakInfo
} from './player-state.js?v=20260627191916';

function createRequestId() {
    return `ans_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

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
                return 'bg-blue-500';
            }

            if (isCorrect) {
                return 'bg-green-500';
            }

            return isApproximate ? 'bg-yellow-500' : 'bg-red-500';
        }
    };

    return globalThis.PlayerAnswerVisualLogic || fallback;
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

    setPendingAnswer({ payload, order: [...order] });

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

    setPendingAnswer({ payload, matches: [...matches] });

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

    socket.timeout(20000).emit('submit-answer', pendingAnswer.payload, (err, resp) => {
        setSendingAnswer(false);

        console.log('📥 Callback de submit-answer recibido:', { err, resp });

        // Si ya recibimos answer-result, no sobrescribir
        if (getResultReceived()) {
            console.log('✅ Result already received via answer-result event, ignoring callback');
            setPendingAnswer(null);
            return;
        }

        // Si fue rechazada explícitamente
        if (resp && resp.ok === false) {
            const reason = resp.reason || 'unknown';
            console.warn('❌ Respuesta rechazada por el servidor:', reason);

            // Rechazos que NO deben reintentar
            if (
                reason === 'game-closed'
                || reason === 'invalid-payload'
                || reason === 'invalid-index'
                || reason === 'invalid-options'
                || reason === 'question-missing'
                || reason === 'invalid-order'
                || reason === 'invalid-order-length'
                || reason === 'duplicate-order'
                || reason === 'invalid-word-scramble'
            ) {
                setPendingAnswer(null);
                setHaRespondido(false);
                setBodyHTML(`
                    <div class="answer-rejected-container">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h2>Respuesta no aceptada</h2>
                        <p>El juego ya no acepta respuestas para esta pregunta.</p>
                    </div>
                `);
                return;
            }
        }

        // Timeout de ack: puede estar procesada en servidor, evitar bucle de reconexión
        if (err && err.message && err.message.includes('timed out')) {
            console.warn('⏳ ACK timeout, manteniendo estado de espera para evitar duplicados');
            setBodyHTML(`
                <div class="answer-loading-container">
                    <div class="spinner spinner-purple"></div>
                    <h2>Respuesta enviada</h2>
                    <p>Esperando confirmación del servidor...</p>
                </div>
            `);
            return;
        }

        // Error de red o rechazo no definitivo - reintentar
        if (err || !resp || resp.ok !== true) {
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
        } else if (resp.waitingForTeams) {
            // Team mode: esperando que el resto del equipo responda
            // El evento 'answer-pending' reemplazará el spinner con la pantalla de espera
            console.log('⏳ Modo equipos: esperando al resto del equipo');
            setPendingAnswer(null);
        } else {
            console.log('✅ Respuesta confirmada por el servidor');
            setPendingAnswer(null);
        }
    });
}

// ===== EVENTOS DE RESPUESTAS =====

/**
 * Registrar eventos relacionados con respuestas
 */
export function registerAnswerEvents() {
    // ===== PAUSA/REANUDACIÓN DE TIMER =====
    socket.on('timer-paused', (data) => {
        console.log('⏸️ Timer pausado por presentador', data);
        clearOrderAutoSendTimer();
        clearMatchAutoSendTimer();
    });

    socket.on('timer-resumed', (data) => {
        console.log('▶️ Timer reanudado por presentador', data);
        const remaining = data?.remainingTime;
        if (remaining > 0 && !getHaRespondido()) {
            if (getCurrentOrder()) {
                startOrderAutoSendTimer(remaining);
            } else if (getCurrentMatches()) {
                window.startMatchAutoSendTimer?.(remaining);
            }
        }
    });

    // ===== TIEMPO AGOTADO =====
    socket.on('blocked-answer', (data) => {
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

        if (!getHaRespondido()) {
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
    });

    // ===== REVELAR RESPUESTA =====
    socket.on('reveal-answer', (data) => {
        if (getCurrentSlideType() === 'info' || getCurrentSlideType() === 'comment' || getCurrentSlideType() === 'text') {
            return;
        }
        if (!getHaRespondido()) {
            const correctBlock = data?.correctAnswer
                ? `<div class="mt-4 bg-black/30 rounded-xl p-4 w-full max-w-sm">
                       <p class=\"text-sm uppercase font-bold mb-1 opacity-80\">${_t('player.answer.correct_label', null, 'Correcta:')}</p>
                       <p class="text-xl font-black break-words hyphens-auto" lang="es">${data.correctAnswer}</p>
                   </div>`
                : '';
            const justBlock = data?.justification
                ? `<div class="mt-2 bg-black/30 rounded-xl p-4 w-full max-w-sm text-sm leading-relaxed">${data.justification}</div>`
                : '';
            document.body.innerHTML = _tHtml(`
                <div class="time-up-container">
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
    });

    // ===== ESPERA DE EQUIPO =====
    socket.on('answer-pending', (data) => {
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
                    <p class="team-waiting-name">${data.teamName}</p>
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
    });

    // ===== RESULTADO DE RESPUESTA =====
    socket.on('answer-result', (data, ack) => {
        console.log('📥 answer-result recibido', {
            hasMultipleChoiceDetails: !!data.multipleChoiceDetails,
            correct: data.correct,
            points: data.points,
            dataKeys: Object.keys(data)
        });
        setResultReceived(true);

        const isOrder = !!data.orderDetails;
        const correctCount = data.orderDetails?.correctCount || 0;
        const totalOptions = data.orderDetails?.totalOptions || 0;
        const isFullyCorrect = totalOptions > 0 && correctCount === totalOptions;
        const currentSlideType = getCurrentSlideType();
        const visualLogic = getPlayerAnswerVisualLogic();
        const isApproximate = visualLogic.shouldShowApproximateResult({
            isOrder,
            currentSlideType,
            data
        });

        const color = visualLogic.resolveResultColor({
            isOrder,
            isFullyCorrect,
            isApproximate,
            isCorrect: data.correct
        });

        // Construir ranking HTML
        let rankingHTML = '';
        if (data.ranking && data.ranking.length > 0 && data.correct !== null) {
            rankingHTML = `
                <div class="mt-6 bg-black/20 rounded-2xl p-4 max-w-md w-full mx-auto">
                    <h3 class="text-xl font-black uppercase mb-3 text-center">${_t('player.answer.ranking', null, 'Ranking')}</h3>
                    <div id="ranking-container" class="space-y-2">
                        ${data.ranking.slice(0, 5).map(player => `
                            <div class="flex justify-center items-center bg-white/10 rounded-lg px-3 py-2">
                                <span class="font-bold">${player.position}. ${player.nickname}</span>
                                <span class="mx-3"><i class="fas fa-arrow-right"></i></span>
                                <span class="font-black">${player.score} pts</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Construir mensaje
        let messageHTML = '';
        if (isOrder) {
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
                                    <span class="text-white font-bold text-sm uppercase flex-1 break-words">${optionText}</span>
                                    <div class="absolute -top-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-black ${isCorrect ? 'bg-green-500 ring-3 ring-green-300' : 'bg-gray-600 ring-3 ring-gray-400'}">
                                        ${isCorrect ? '<i class="fas fa-check"></i>' : '<i class="fas fa-times"></i>'}
                                    </div>
                                </div>
                            `;
                }).join('')}
                    </div>
                `;
            }

            messageHTML = `
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
        } else if (data.multipleChoiceDetails && data.multipleChoiceDetails.options) {
            // Multiple Choice: mostrar desglose de puntos
            const mcDetails = data.multipleChoiceDetails;
            const correctSet = new Set(mcDetails.correctIndices || []);

            // Construir desglose de opciones seleccionadas
            let breakdownHTML = '<div class="w-full max-w-lg space-y-2 mb-4">';
            mcDetails.selectedIndices.forEach(idx => {
                const option = mcDetails.options[idx];
                const isCorrect = correctSet.has(idx);
                const points = isCorrect ? mcDetails.pointsPerCorrect : -mcDetails.penaltyPerIncorrect;
                const sign = points >= 0 ? '+' : '';
                const bgColor = isCorrect ? 'bg-green-600/30' : 'bg-red-600/30';
                const borderColor = isCorrect ? 'border-green-400' : 'border-red-400';
                const icon = isCorrect ? 'fa-check' : 'fa-times';

                breakdownHTML += `
                    <div class="${bgColor} ${borderColor} border-2 rounded-lg p-3 flex items-center justify-between">
                        <div class="flex items-center gap-2 flex-1">
                            <i class="fas ${icon} text-lg"></i>
                            <span class="font-bold text-sm uppercase">${option.text}</span>
                        </div>
                        <span class="font-black text-xl">${sign}${points}</span>
                    </div>
                `;
            });

            // Agregar bonus de perfección si aplica
            if (mcDetails.isPerfect && mcDetails.perfectBonus > 0) {
                breakdownHTML += `
                    <div class="bg-yellow-500/30 border-2 border-yellow-400 rounded-lg p-3 flex items-center justify-between">
                        <div class="flex items-center gap-2 flex-1">
                            <i class="fas fa-trophy text-lg text-yellow-400"></i>
                            <span class="font-bold text-sm uppercase">PERFECTO</span>
                        </div>
                        <span class="font-black text-xl">+${mcDetails.perfectBonus}</span>
                    </div>
                `;
            }

            breakdownHTML += '</div>';

            const totalIcon = data.points > 0 ? 'fa-check-circle' : 'fa-times-circle';
            const totalText = data.points > 0 ? _t('player.answer.correct', '¡BIEN!') : _t('player.answer.wrong', '¡FALLASTE!');
            const totalPointsSign = data.points >= 0 ? '+' : '';

            messageHTML = `
                <i class="fas ${totalIcon} text-7xl mb-3 animate-bounce"></i>
                <h2 class="text-4xl font-black italic uppercase mb-4">${totalText}</h2>
                ${breakdownHTML}
                <div class="bg-white/20 rounded-2xl p-4 mb-4">
                    <p class="text-sm uppercase font-bold mb-1">Total</p>
                    <p class="text-5xl font-black">${totalPointsSign}${data.points} PTS</p>
                </div>
                ${rankingHTML}
            `;
        } else if (data.correct === null) {
            // Survey
            messageHTML = `
                <i class="fas fa-vote-yea text-9xl mb-4 animate-bounce"></i>
                <h2 class="text-5xl font-black italic uppercase">${_t('player.answer.vote_registered', null, '¡Voto Registrado!')}</h2>
                <p class="text-3xl font-black mt-4 bg-black/20 py-2 px-8 rounded-full">${_t('player.answer.survey_label', null, 'Encuesta')}</p>
            `;
        } else if (data.correct) {
            // Correcto
            messageHTML = `
                ${_t('player.answer.yes', null, '<img src="/images/chamaleon/thumbs_up.svg" class="w-32 h-32 mb-4 animate-bounce drop-shadow-lg" alt="👍">')}
                <p class="text-3xl font-black mt-4 bg-black/20 py-2 px-8 rounded-full">+${data.points} PTS</p>
                ${data.justification ? `<p class="text-lg mt-4 bg-white/20 p-4 rounded-2xl max-w-md">${data.justification}</p>` : ''}
                ${rankingHTML}
            `;
        } else if (isApproximate) {
            // Aproximada (pregunta numérica con puntos parciales)
            messageHTML = `
                <i class="fas fa-bullseye text-9xl mb-4 animate-bounce"></i>
                <h2 class="text-5xl font-black italic uppercase">${_t('player.answer.approximate', null, '¡APROXIMADA!')}</h2>
                <p class="text-3xl font-black mt-4 bg-black/20 py-2 px-8 rounded-full">+${data.points} PTS</p>
                ${rankingHTML}
            `;
        } else {
            // Incorrecto
            messageHTML = `
                ${_t('player.answer.no', null, '<img src="/images/chamaleon/thumbs_down.svg" class="w-32 h-32 mb-4 animate-bounce drop-shadow-lg" alt="👎">')}
                <p class="text-3xl font-black mt-4 bg-black/20 py-2 px-8 rounded-full">+${data.points} PTS</p>
                ${data.correctAnswer ? `<div class="mt-4 bg-white/20 p-4 rounded-2xl max-w-md">
                    <p class="text-sm uppercase font-bold mb-2">${_t('player.answer.correct_answer_label', null, 'Respuesta correcta:')}</p>
                    <p class="text-xl font-black">${data.correctAnswer}</p>
                </div>` : ''}
                ${data.justification ? `<p class="text-lg mt-4 bg-white/20 p-4 rounded-2xl max-w-md">${data.justification}</p>` : ''}
                ${rankingHTML}
            `;
        }

        // Confirmar recepción y resetear estado
        setPendingAnswer(null);
        setSendingAnswer(false);
        setResultReceived(false);
        if (typeof ack === 'function') ack();

        // Mostrar resultado (con animación de racha si corresponde)
        const resultHTML = `<div class="h-screen w-screen flex flex-col items-center justify-center ${color} text-white text-center p-6 overflow-y-auto">${messageHTML}</div>`;
        applyStreakToResult(data.streak, resultHTML);
    });
}
