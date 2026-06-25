/**
 * @fileoverview MultipleChoiceAnswerStateService - Gestión de estado para respuestas de selección múltiple
 * 
 * Maneja validación, construcción de estado y actualización de jugadores
 * para preguntas tipo multiple_choice
 * 
 * @module domain/services/MultipleChoiceAnswerStateService
 */

/**
 * Valida una respuesta de selección múltiple
 * 
 * Reglas de validación:
 * - Debe tener al menos 1 opción seleccionada
 * - Los índices deben ser válidos (dentro del rango de opciones)
 * - El juego debe permitir respuestas (canAnswer = true)
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.question - Pregunta con options
 * @param {Array<number>} params.selectedIndices - Índices seleccionados [0, 2, 4]
 * @param {boolean} params.gameCanAnswer - Si el juego permite respuestas
 * @param {boolean} params.allowWhenClosed - Permitir respuesta tardía (últimos segundos)
 * @returns {Object} { valid: boolean, reason: string|null }
 * 
 * @example
 * validateMultipleChoiceAnswer({
 *   question: { options: [{}, {}, {}] },
 *   selectedIndices: [0, 2],
 *   gameCanAnswer: true,
 *   allowWhenClosed: false
 * });
 * // => { valid: true, reason: null }
 */
function validateMultipleChoiceAnswer({
    question,
    selectedIndices,
    gameCanAnswer,
    allowWhenClosed = false
}) {
    // Validar que la pregunta exista
    if (!question) {
        return { valid: false, reason: 'question-missing' };
    }

    // Validar que tenga opciones
    const options = question.options || [];
    if (options.length === 0) {
        return { valid: false, reason: 'invalid-options' };
    }

    // Validar que el juego permita respuestas
    if (!gameCanAnswer && !allowWhenClosed) {
        return { valid: false, reason: 'game-closed' };
    }

    // Validar que selectedIndices sea un array
    if (!Array.isArray(selectedIndices)) {
        return { valid: false, reason: 'invalid-payload' };
    }

    // Validar que tenga al menos 1 selección
    if (selectedIndices.length === 0) {
        return { valid: false, reason: 'no-selection' };
    }

    // Validar que no tenga más de 6 selecciones
    if (selectedIndices.length > 6) {
        return { valid: false, reason: 'too-many-selections' };
    }

    // Validar que todos los índices sean válidos
    const invalidIndex = selectedIndices.find(idx => {
        return !Number.isInteger(idx) || idx < 0 || idx >= options.length;
    });

    if (invalidIndex !== undefined) {
        return { valid: false, reason: 'invalid-option-index' };
    }

    return { valid: true, reason: null };
}

/**
 * Construye el estado de respuesta para selección múltiple
 * 
 * @param {Object} params - Parámetros
 * @param {Array<number>} params.selectedIndices - Índices seleccionados
 * @param {number} params.gameStartTime - Timestamp inicio de pregunta
 * @param {number} params.currentTime - Timestamp actual
 * @param {number} params.questionTimeLimit - Límite de tiempo en segundos
 * @returns {Object} Estado estructurado de la respuesta
 * 
 * @example
 * buildMultipleChoiceAnswerState({
 *   selectedIndices: [0, 2, 4],
 *   gameStartTime: 1000000,
 *   currentTime: 1015000,
 *   questionTimeLimit: 30
 * });
 * // => {
 * //   selectedIndices: [0, 2, 4],
 * //   timestamp: 1015000,
 * //   timeLeft: 15,
 * //   timeElapsed: 15
 * // }
 */
function buildMultipleChoiceAnswerState({
    selectedIndices,
    gameStartTime,
    currentTime,
    questionTimeLimit
}) {
    const timeElapsed = (currentTime - gameStartTime) / 1000;
    const timeLeft = Math.max(0, questionTimeLimit - timeElapsed);

    return {
        selectedIndices: [...selectedIndices], // Copiar array para inmutabilidad
        timestamp: currentTime,
        timeLeft,
        timeElapsed
    };
}

/**
 * Actualiza el estado del jugador con la respuesta de selección múltiple
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.player - Objeto del jugador
 * @param {Object} params.socket - Socket del jugador
 * @param {Object} params.game - Objeto del juego
 * @param {Object} params.answerState - Estado de la respuesta construido
 * 
 * @example
 * updatePlayerState({
 *   player: { answers: {}, answeredQuestions: new Set() },
 *   socket: { data: {} },
 *   game: { currentIndex: 0 },
 *   answerState: { selectedIndices: [0, 2], timestamp: 123, ... }
 * });
 */
function updatePlayerState({
    player,
    socket,
    game,
    answerState
}) {
    if (!player) {
        return;
    }

    const currentIndex = game.currentIndex;

    // Marcar como respondida
    if (!player.answeredQuestions) {
        player.answeredQuestions = new Set();
    }
    player.answeredQuestions.add(currentIndex);

    // Actualizar lastSeen
    player.lastSeen = Date.now();

    // Guardar respuesta en player.answers
    if (!player.answers) {
        player.answers = {};
    }

    player.answers[currentIndex] = {
        selectedIndices: answerState.selectedIndices,
        timestamp: answerState.timestamp,
        timeLeft: answerState.timeLeft,
        pointsEarned: 0, // Se actualizará después del cálculo
        isCorrect: false // Se actualizará después del cálculo
    };

    // Actualizar socket.data para cross-worker
    if (socket && socket.data) {
        // Marcar como respondida (necesario para team mode)
        if (!socket.data.answeredQuestions) {
            socket.data.answeredQuestions = [];
        }
        if (!socket.data.answeredQuestions.includes(currentIndex)) {
            socket.data.answeredQuestions.push(currentIndex);
        }

        // Guardar respuesta en socket.data.answers
        if (!socket.data.answers) {
            socket.data.answers = {};
        }
        socket.data.answers[currentIndex] = {
            selectedIndices: answerState.selectedIndices,
            timestamp: answerState.timestamp,
            timeLeft: answerState.timeLeft,
            pointsEarned: 0, // Se actualizará después
            isCorrect: false // Se actualizará después
        };

        socket.data.lastAnswer = {
            selectedIndices: answerState.selectedIndices,
            timestamp: answerState.timestamp,
            questionIndex: currentIndex
        };
    }
}

module.exports = {
    validateMultipleChoiceAnswer,
    buildMultipleChoiceAnswerState,
    updatePlayerState
};
