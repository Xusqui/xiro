/**
 * @fileoverview Capa de comunicación Socket.IO del modo Standalone.
 *
 * El backend liga cada socket a UN único rol (presentador o jugador) al
 * hacer join-lobby / join-presenter-lobby (ver JoinGameCommand._joinSocketRooms).
 * Como Standalone no tiene presentador humano, abrimos DOS conexiones:
 *  - "presenter": se une como HOST y es la única autorizada a start-game /
 *    next-question (assertIsPresenter exige estar en la room roomId:presenter).
 *  - "player": se une con el nickname real, responde preguntas y recibe
 *    su feedback (answer-result).
 */

'use strict';

const StandaloneSocket = (() => {
    let presenterSocket = null;
    let playerSocket = null;
    let handlers = {};

    function _generateSessionId(pin) {
        const randomNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `${pin.toUpperCase()}-${randomNumber}`;
    }

    function _createSocket(playerId) {
        return io({
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 3,
            timeout: 20000,
            auth: { playerId }
        });
    }

    function _wirePlayerEvents(socket) {
        socket.on('game-started', (data) => handlers.onGameStarted && handlers.onGameStarted(data));
        socket.on('new-question', (data) => handlers.onNewQuestion && handlers.onNewQuestion(data));
        socket.on('answer-result', (data) => handlers.onAnswerResult && handlers.onAnswerResult(data));
        // 'reveal-answer' NO se escucha aquí: el servidor envía a la room ':players'
        // una versión reducida (correctAnswer/justification/correctOrder únicamente,
        // ver GameEndManager.emitRevealPayloads) porque en una partida real el
        // presentador (pantalla compartida) es quien muestra el resto. En Standalone
        // no hay pantalla compartida, así que usamos el payload completo que sí le
        // llega al socket "presenter" (ver _wirePresenterEvents) — evita duplicar
        // el manejo con datos incompletos.
        socket.on('ranking-update', (data) => handlers.onRankingUpdate && handlers.onRankingUpdate(data));
        socket.on('game-ended', (ranking) => handlers.onGameEnded && handlers.onGameEnded(ranking));
        socket.on('blocked-answer', (data) => handlers.onBlockedAnswer && handlers.onBlockedAnswer(data));
        socket.on('answer-error', (data) => handlers.onError && handlers.onError('answer-error', data));
        socket.on('disconnect', (reason) => handlers.onDisconnected && handlers.onDisconnected('player', reason));
    }

    function _wirePresenterEvents(socket) {
        socket.on('game-start-error', (data) => handlers.onError && handlers.onError('game-start-error', data));
        socket.on('next-question-error', (data) => handlers.onError && handlers.onError('next-question-error', data));
        // Payload completo (correctIndex/correctIndices/correctWord/correctMatches/
        // correctOrder/stats/...), ver nota en _wirePlayerEvents.
        socket.on('reveal-answer', (data) => handlers.onRevealAnswer && handlers.onRevealAnswer(data));
        socket.on('disconnect', (reason) => handlers.onDisconnected && handlers.onDisconnected('presenter', reason));
    }

    function _waitForJoinSuccess(socket) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('timeout'));
            }, 10000);

            function onSuccess(data) {
                cleanup();
                resolve(data);
            }
            function onError(data) {
                cleanup();
                reject(new Error(data?.message || 'join-error'));
            }
            function cleanup() {
                clearTimeout(timeout);
                socket.off('join-success', onSuccess);
                socket.off('join-error', onError);
            }

            socket.once('join-success', onSuccess);
            socket.once('join-error', onError);
        });
    }

    /**
     * Crea la sesión, une presentador (HOST oculto) y jugador real, y arranca el juego.
     * @param {{pin:string, nickname:string}} params
     * @param {Object} eventHandlers - callbacks: onGameStarted, onNewQuestion, onAnswerResult,
     *   onRevealAnswer, onRankingUpdate, onGameEnded, onBlockedAnswer, onJoinError, onError, onDisconnected
     * @returns {Promise<{sessionId:string}>}
     */
    async function startSession({ pin, nickname }, eventHandlers) {
        handlers = eventHandlers || {};

        const sessionId = _generateSessionId(pin);
        const presenterPlayerId = crypto.randomUUID();
        const playerPlayerId = crypto.randomUUID();

        // Publicado de inmediato (no solo al terminar con éxito) para que
        // abandonAndDisconnect() pueda limpiar la sesión en el servidor
        // incluso si el join falla a mitad de camino.
        StandaloneState.get().sessionId = sessionId;

        presenterSocket = _createSocket(presenterPlayerId);
        _wirePresenterEvents(presenterSocket);

        playerSocket = _createSocket(playerPlayerId);
        _wirePlayerEvents(playerSocket);

        const presenterJoinPromise = _waitForJoinSuccess(presenterSocket);
        presenterSocket.emit('join-presenter-lobby', {
            pin,
            sessionId,
            playerId: presenterPlayerId,
            isTeamMode: false
        });
        await presenterJoinPromise;

        const playerJoinPromise = _waitForJoinSuccess(playerSocket);
        playerSocket.emit('join-lobby', {
            pin,
            sessionId,
            nickname,
            playerId: playerPlayerId
        });
        await playerJoinPromise;

        presenterSocket.emit('start-game', sessionId);

        return { sessionId, presenterPlayerId, playerPlayerId };
    }

    /**
     * Envía la respuesta del jugador. answerType/campos dependen del tipo de pregunta
     * (ver contrato en app/application/commands/submit-answer/*).
     * @returns {Promise<Object>} ack del servidor { ok, success, reason? }
     */
    function submitAnswer(payload) {
        return new Promise((resolve) => {
            if (!playerSocket) {
                resolve({ ok: false, reason: 'not-connected' });
                return;
            }
            playerSocket.emit('submit-answer', payload, (ack) => {
                resolve(ack || { ok: true });
            });
        });
    }

    function nextQuestion() {
        const sessionId = StandaloneState.get().sessionId;
        if (presenterSocket && sessionId) {
            presenterSocket.emit('next-question', sessionId);
        }
    }

    function abandonAndDisconnect() {
        const state = StandaloneState.get();
        const sessionId = state.sessionId;
        try {
            // Si el juego ya terminó de forma natural (game-ended), EndGameUseCase
            // ya limpió la sesión en el servidor — no hace falta abandonar.
            if (presenterSocket && sessionId && !state.ended) {
                // registerPresenterSocketEvents.abandon-game busca roomId en
                // ['roomId','roomIdOrPin','pin'] (ver socket.handlers.js) — no 'sessionId'.
                presenterSocket.emit('abandon-game', { roomId: sessionId });
            }
        } catch (_) { /* best-effort */ }

        if (presenterSocket) {
            presenterSocket.disconnect();
            presenterSocket = null;
        }
        if (playerSocket) {
            playerSocket.disconnect();
            playerSocket = null;
        }
        handlers = {};
    }

    return {
        startSession,
        submitAnswer,
        nextQuestion,
        abandonAndDisconnect
    };
})();
