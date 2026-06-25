/**
 * @fileoverview Estado y validación de respuestas tipo "matching" (Emparejar)
 * Funciones puras para evitar dependencias de infraestructura.
 * Espejo exacto de OrderAnswerStateService adaptado al campo "matches".
 */

function calculateTimeLeft(gameStartTime, currentTime, questionTimeLimit) {
    const timeElapsed = (currentTime - gameStartTime) / 1000;
    return Math.max(0, questionTimeLimit - timeElapsed);
}

/**
 * Valida que el payload matches sea coherente con la pregunta.
 * @param {{ question, matches, gameCanAnswer, allowWhenClosed }} param
 * @returns {{ valid: boolean, reason: string|null }}
 */
function validateMatchingAnswer({ question, matches, gameCanAnswer, allowWhenClosed = false }) {
    if (!gameCanAnswer && !allowWhenClosed) {
        return { valid: false, reason: 'game-closed' };
    }

    if (!question) {
        return { valid: false, reason: 'question-missing' };
    }

    if (!Array.isArray(question.options)) {
        return { valid: false, reason: 'invalid-options' };
    }

    if (!Array.isArray(matches)) {
        return { valid: false, reason: 'invalid-matches' };
    }

    if (matches.length !== question.options.length) {
        return { valid: false, reason: 'invalid-matches-length' };
    }

    const maxIndex = question.options.length - 1;
    const seen = new Set();

    for (const value of matches) {
        if (!Number.isInteger(value) || value < 0 || value > maxIndex) {
            return { valid: false, reason: 'invalid-matches' };
        }
        if (seen.has(value)) {
            return { valid: false, reason: 'duplicate-matches' };
        }
        seen.add(value);
    }

    return { valid: true, reason: null };
}

/**
 * Construye el estado de respuesta tras validación.
 * @param {{ matches, gameStartTime, currentTime, questionTimeLimit }} param
 */
function buildMatchingAnswerState({ matches, gameStartTime, currentTime, questionTimeLimit }) {
    const timestamp = currentTime;
    const timeLeft = calculateTimeLeft(gameStartTime, currentTime, questionTimeLimit);

    const playerAnswer = {
        matches,
        timestamp,
        timeLeft,
        pointsEarned: 0,
        isCorrect: false
    };

    const socketDataAnswer = {
        matches,
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
 * Persiste el estado de respuesta en player y socket.data.
 * @param {{ player, socket, game, answerState }} param
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
    validateMatchingAnswer,
    buildMatchingAnswerState,
    updatePlayerState
};
