/**
 * AnswerStateService - Lógica pura de gestión de estado de respuestas
 * 
 * Funciones puras para preparar, validar y estructurar datos de respuestas
 * sin dependencias de Socket.IO, DB o Redis.
 * 
 * @module domain/services/AnswerStateService
 */

/**
 * Prepara los datos de respuesta del jugador
 * 
 * @param {Object} params - Parámetros
 * @param {number} params.answerIndex - Índice de la opción seleccionada
 * @param {Object} params.option - Opción seleccionada
 * @param {number} params.timestamp - Timestamp de la respuesta
 * @param {number} params.timeLeft - Tiempo restante cuando respondió
 * @param {number} params.pointsEarned - Puntos ganados (opcional, default 0)
 * @param {boolean} params.isCorrect - Si es correcta (opcional)
 * @returns {Object} Datos de respuesta estructurados
 * 
 * @example
 * const answerData = prepareAnswerData({
 *   answerIndex: 2,
 *   option: { text: "Paris", isCorrect: true },
 *   timestamp: Date.now(),
 *   timeLeft: 15.5,
 *   pointsEarned: 35,
 *   isCorrect: true
 * });
 */
function prepareAnswerData({ answerIndex, option, timestamp, timeLeft, pointsEarned = 0, isCorrect = false }) {
    return {
        index: answerIndex,
        option,
        timestamp,
        timeLeft,
        pointsEarned,
        isCorrect
    };
}

/**
 * Prepara datos de respuesta para socket.data (versión simplificada cross-worker)
 * 
 * @param {Object} params - Parámetros
 * @param {number} params.answerIndex - Índice de la respuesta
 * @param {boolean} params.isCorrect - Si es correcta
 * @param {number} params.pointsEarned - Puntos ganados
 * @param {number} params.timestamp - Timestamp
 * @returns {Object} Datos simplificados para socket.data
 */
function prepareSocketDataAnswer({ answerIndex, isCorrect, pointsEarned = 0, timestamp }) {
    return {
        index: answerIndex,
        isCorrect,
        pointsEarned,
        timestamp
    };
}

/**
 * Actualiza las estadísticas de respuestas del juego
 * 
 * @param {Object} currentStats - Estadísticas actuales { 0: 5, 1: 3, 2: 7 }
 * @param {number} answerIndex - Índice de la opción respondida
 * @returns {Object} Estadísticas actualizadas (nuevo objeto, inmutable)
 * 
 * @example
 * const stats = { 0: 5, 1: 3 };
 * const updated = updateAnswerStats(stats, 1);
 * // => { 0: 5, 1: 4 }
 */
function updateAnswerStats(currentStats, answerIndex) {
    return {
        ...currentStats,
        [answerIndex]: (currentStats[answerIndex] || 0) + 1
    };
}

/**
 * Calcula el tiempo restante cuando el jugador respondió
 * 
 * @param {number} gameStartTime - Timestamp de inicio del juego
 * @param {number} currentTime - Timestamp actual
 * @param {number} questionTimeLimit - Límite de tiempo de la pregunta
 * @returns {number} Tiempo restante (>= 0)
 * 
 * @example
 * const timeLeft = calculateTimeLeft(1000000, 1002000, 30);
 * // gameStartTime=1000000, currentTime=1002000 → elapsed=2s
 * // questionTimeLimit=30 → timeLeft=28
 */
function calculateTimeLeft(gameStartTime, currentTime, questionTimeLimit) {
    const timeElapsed = (currentTime - gameStartTime) / 1000;
    return Math.max(0, questionTimeLimit - timeElapsed);
}

/**
 * Verifica si un jugador ya respondió una pregunta específica
 * 
 * @param {Object} playerAnswers - Objeto de respuestas del jugador { 0: {...}, 1: {...} }
 * @param {number} questionIndex - Índice de la pregunta
 * @returns {boolean} true si ya respondió
 * 
 * @example
 * const answers = { 0: { index: 2 }, 1: { index: 0 } };
 * hasAnswered(answers, 1); // => true
 * hasAnswered(answers, 2); // => false
 */
function hasAnswered(playerAnswers, questionIndex) {
    if (!playerAnswers) {
        return false;
    }
    return playerAnswers[questionIndex] !== undefined && playerAnswers[questionIndex] !== null;
}

/**
 * Obtiene la respuesta previa de un jugador para una pregunta
 * 
 * @param {Object} playerAnswers - Respuestas del jugador
 * @param {number} questionIndex - Índice de la pregunta
 * @returns {Object|null} Respuesta previa o null
 */
function getPreviousAnswer(playerAnswers, questionIndex) {
    if (!hasAnswered(playerAnswers, questionIndex)) {
        return null;
    }
    return playerAnswers[questionIndex];
}

/**
 * Prepara payload de respuesta duplicada
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.previousAnswer - Respuesta previa
 * @param {Object} params.question - Pregunta actual
 * @param {Array} params.ranking - Ranking actual
 * @param {Object} params.correctOption - Opción correcta
 * @returns {Object} Payload para answer-result
 */
function prepareDuplicateAnswerPayload({ previousAnswer, question, ranking, correctOption }) {
    const isSurvey = question.question_type === 'survey';
    const playerOption = previousAnswer.option;
    const playerPoints = previousAnswer.pointsEarned || 0;

    return {
        correct: isSurvey ? null : playerOption?.isCorrect,
        points: isSurvey ? 0 : playerPoints,
        correctAnswer: isSurvey ? null : correctOption?.text,
        ranking,
        duplicate: true
    };
}

/**
 * Construye el estado completo de una respuesta de jugador
 * Combina todos los datos necesarios en un solo objeto estructurado
 * 
 * @param {Object} params - Parámetros
 * @param {number} params.answerIndex - Índice de la respuesta
 * @param {Object} params.option - Opción seleccionada
 * @param {number} params.gameStartTime - Inicio del juego
 * @param {number} params.currentTime - Tiempo actual
 * @param {number} params.questionTimeLimit - Límite de tiempo
 * @param {number} params.pointsEarned - Puntos ganados
 * @param {boolean} params.isCorrect - Si es correcta
 * @returns {Object} Estado completo de la respuesta
 * @property {Object} playerAnswer - Para player.answers[index]
 * @property {Object} socketDataAnswer - Para socket.data.answers[index]
 * @property {number} timeLeft - Tiempo restante
 */
function buildCompleteAnswerState({
    answerIndex,
    option,
    gameStartTime,
    currentTime,
    questionTimeLimit,
    pointsEarned = 0,
    isCorrect = false
}) {
    const timestamp = currentTime;
    const timeLeft = calculateTimeLeft(gameStartTime, currentTime, questionTimeLimit);

    const playerAnswer = prepareAnswerData({
        answerIndex,
        option,
        timestamp,
        timeLeft,
        pointsEarned,
        isCorrect
    });

    const socketDataAnswer = prepareSocketDataAnswer({
        answerIndex,
        isCorrect,
        pointsEarned,
        timestamp
    });

    return {
        playerAnswer,
        socketDataAnswer,
        timeLeft,
        timestamp
    };
}

/**
 * Valida que una respuesta sea procesable
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.question - Pregunta actual
 * @param {number} params.answerIndex - Índice de respuesta
 * @param {boolean} params.gameCanAnswer - Si el juego acepta respuestas
 * @param {boolean} [params.allowWhenClosed=false] - Permitir incluso si el juego marca canAnswer=false (caso última pregunta)
 * @returns {Object} Resultado de validación
 * @property {boolean} valid - Si es válida
 * @property {string|null} reason - Razón del rechazo si invalid
 * 
 * @example
 * const result = validateAnswer({ question, answerIndex: 2, gameCanAnswer: true });
 * if (!result.valid) {
 *   // manejar result.reason, por ejemplo: "invalid-index"
 * }
 */
function validateAnswer({ question, answerIndex, gameCanAnswer, allowWhenClosed = false }) {
    if (!gameCanAnswer && !allowWhenClosed) {
        return { valid: false, reason: 'game-closed' };
    }

    if (!question) {
        return { valid: false, reason: 'question-missing' };
    }

    if (!question.options || !Array.isArray(question.options)) {
        return { valid: false, reason: 'invalid-options' };
    }

    if (answerIndex < 0 || answerIndex >= question.options.length) {
        return { valid: false, reason: 'invalid-index' };
    }

    return { valid: true, reason: null };
}

module.exports = {
    prepareAnswerData,
    prepareSocketDataAnswer,
    updateAnswerStats,
    calculateTimeLeft,
    hasAnswered,
    getPreviousAnswer,
    prepareDuplicateAnswerPayload,
    buildCompleteAnswerState,
    validateAnswer
};
