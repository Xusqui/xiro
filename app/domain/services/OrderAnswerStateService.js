/**
 * @fileoverview Estado y validacion de respuestas tipo "order"
 * Funciones puras para evitar dependencias de infraestructura.
 */

function calculateTimeLeft(gameStartTime, currentTime, questionTimeLimit) {
    const timeElapsed = (currentTime - gameStartTime) / 1000;
    return Math.max(0, questionTimeLimit - timeElapsed);
}

/**
 * Valida una respuesta de ordenar: que se admita responder y que `order` sea una permutación de las opciones.
 * @param {Object} input
 * @param {Object} input.question - Pregunta
 * @param {number[]} input.order - Índices enviados
 * @param {boolean} input.gameCanAnswer - Si la partida admite respuestas
 * @param {boolean} [input.allowWhenClosed=false] - Admitir respuesta tardía
 * @returns {{valid: boolean, reason: 'game-closed'|'question-missing'|'invalid-options'|'invalid-order'|'invalid-order-
 *   length'|'duplicate-order'|null}}
 */
function validateOrderAnswer({ question, order, gameCanAnswer, allowWhenClosed = false }) {
    if (!gameCanAnswer && !allowWhenClosed) {
        return { valid: false, reason: 'game-closed' };
    }

    if (!question) {
        return { valid: false, reason: 'question-missing' };
    }

    if (!Array.isArray(question.options)) {
        return { valid: false, reason: 'invalid-options' };
    }

    if (!Array.isArray(order)) {
        return { valid: false, reason: 'invalid-order' };
    }

    if (order.length !== question.options.length) {
        return { valid: false, reason: 'invalid-order-length' };
    }

    const maxIndex = question.options.length - 1;
    const seen = new Set();

    for (const value of order) {
        if (!Number.isInteger(value) || value < 0 || value > maxIndex) {
            return { valid: false, reason: 'invalid-order' };
        }
        if (seen.has(value)) {
            return { valid: false, reason: 'duplicate-order' };
        }
        seen.add(value);
    }

    return { valid: true, reason: null };
}

/**
 * Construye el estado inicial (sin puntuar) de una respuesta de ordenar, para el jugador y para socket.data.
 * @param {Object} input
 * @param {number[]} input.order - Índices enviados
 * @param {number} input.gameStartTime - Inicio de la pregunta (ms)
 * @param {number} input.currentTime - Ahora (ms)
 * @param {number} input.questionTimeLimit - Límite de la pregunta
 * @returns {{playerAnswer: Object, socketDataAnswer: Object, timeLeft: number, timestamp: number}}
 */
function buildOrderAnswerState({ order, gameStartTime, currentTime, questionTimeLimit }) {
    const timestamp = currentTime;
    const timeLeft = calculateTimeLeft(gameStartTime, currentTime, questionTimeLimit);

    const playerAnswer = {
        order,
        timestamp,
        timeLeft,
        pointsEarned: 0,
        isCorrect: false
    };

    const socketDataAnswer = {
        order,
        timestamp,
        pointsEarned: 0,
        isCorrect: false
    };

    return {
        playerAnswer,
        socketDataAnswer,
        timeLeft,
        timestamp
    };
}

/**
 * Anota la respuesta en el jugador y en socket.data. Sin jugador no hace nada.
 * @param {Object} input
 * @param {Object} [input.player] - Jugador (se modifica)
 * @param {Object} input.socket - Socket (se modifica socket.data)
 * @param {Object} input.game - Partida
 * @param {Object} input.answerState - Resultado de buildOrderAnswerState
 * @returns {void}
 */
function updatePlayerState({ player, socket, game, answerState }) {
    if (!player) return;

    player.answeredQuestions.add(game.currentIndex);
    player.lastSeen = Date.now();

    if (!socket.data.answeredQuestions) socket.data.answeredQuestions = [];
    if (!socket.data.answeredQuestions.includes(game.currentIndex)) {
        socket.data.answeredQuestions.push(game.currentIndex);
    }

    if (!player.answers) player.answers = {};
    player.answers[game.currentIndex] = answerState.playerAnswer;

    if (!socket.data.answers) socket.data.answers = {};
    socket.data.answers[game.currentIndex] = answerState.socketDataAnswer;
}

module.exports = {
    validateOrderAnswer,
    buildOrderAnswerState,
    updatePlayerState
};
