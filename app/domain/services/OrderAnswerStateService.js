/**
 * @fileoverview Estado y validacion de respuestas tipo "order"
 * Funciones puras para evitar dependencias de infraestructura.
 */

function calculateTimeLeft(gameStartTime, currentTime, questionTimeLimit) {
    const timeElapsed = (currentTime - gameStartTime) / 1000;
    return Math.max(0, questionTimeLimit - timeElapsed);
}

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
