/**
 * @fileoverview Servicio de dominio para cálculo de puntuaciones
 * Orquestador que delega cálculos a estrategias específicas
 * 
 * ARQUITECTURA: Domain Service (Clean Architecture)
 * - Orquesta estrategias de puntuación
 * - Funciones puras testables
 * - Sin dependencias de infraestructura
 * 
 * REFACTORIZADO: Fase 17.2 - Día 4
 * - Delegación a ScoringStrategyFactory
 * - Mantiene backward compatibility
 * - Métodos auxiliares intactos
 */

const GAME_CONSTANTS = require('../../config/game-constants');
const { SCORING, TIMING } = GAME_CONSTANTS;
const strategyFactory = require('../strategies/scoring/ScoringStrategyFactory');

/**
 * Redondea puntuación a 2 decimales
 * @param {number} score - Puntuación a redondear
 * @returns {number} Puntuación redondeada
 */
function roundScore(score) {
    return Math.round(score * 100) / 100;
}

/**
 * Calcula el bonus de tiempo basado en velocidad de respuesta
 * 
 * @deprecated Usar estrategias de puntuación (TimeBasedScoring, etc.)
 * @param {number} timeElapsed - Tiempo transcurrido desde inicio de pregunta (segundos)
 * @param {number} questionTimeLimit - Límite de tiempo de la pregunta (segundos)
 * @returns {number} Bonus de tiempo (0 a MAX_TIME_BONUS)
 */
function calculateTimeBonus(timeElapsed, questionTimeLimit) {
    const timeLeft = Math.max(0, questionTimeLimit - timeElapsed);
    const bonusRatio = timeLeft / questionTimeLimit;
    return roundScore(bonusRatio * SCORING.MAX_TIME_BONUS);
}

/**
 * Calcula puntos ganados por una respuesta correcta
 * 
 * @deprecated Usar estrategias de puntuación (TimeBasedScoring, etc.)
 * @param {Object} params - Parámetros de cálculo
 * @param {number} params.timeElapsed - Tiempo desde inicio de pregunta (segundos)
 * @param {number} params.questionTimeLimit - Límite de tiempo (segundos)
 * @returns {number} Puntos totales (BASE_POINTS + bonus tiempo)
 */
function calculatePointsEarned({ timeElapsed, questionTimeLimit }) {
    const timeBonus = calculateTimeBonus(timeElapsed, questionTimeLimit);
    const totalPoints = SCORING.BASE_POINTS + timeBonus;
    return roundScore(totalPoints);
}

/**
 * Procesa una respuesta de jugador y calcula puntuación
 * 
 * @param {Object} params - Parámetros de procesamiento
 * @param {Object} params.question - Pregunta actual
 * @param {string} params.question.question_type - Tipo: 'quiz' o 'survey'
 * @param {number} params.question.time_limit - Límite de tiempo en segundos
 * @param {Array} params.question.options - Opciones de la pregunta
 * @param {number} params.answerIndex - Índice de opción seleccionada
 * @param {number} params.gameStartTime - Timestamp inicio de pregunta (ms)
 * @param {number} params.currentTime - Timestamp actual (ms) - inyectable para tests
 * @returns {Object} Resultado del procesamiento
 * 
 * @example
 * const result = processAnswer({
 *   question: {  usando estrategias
 * 
 * REFACTORIZADO: Delega cálculo a ScoringStrategy
 * 
 * @param {Object} params - Parámetros de procesamiento
 * @param {Object} params.question - Pregunta actual
 * @param {string} params.question.question_type - Tipo: 'quiz' o 'survey'
 * @param {number} params.question.time_limit - Límite de tiempo en segundos
 * @param {string} params.question.scoring_strategy - Estrategia (opcional, default: 'time_based')
 * @param {Object} params.question.scoring_params - Parámetros de estrategia (opcional)
 * @param {Array} params.question.options - Opciones de la pregunta
 * @param {number} params.answerIndex - Índice de opción seleccionada
 * @param {number} params.gameStartTime - Timestamp inicio de pregunta (ms)
 * @param {number} params.currentTime - Timestamp actual (ms)
 * @param {Object} params.game - Objeto de juego (opcional, para config de estrategias)
 * @param {Object} params.playerState - Estado del jugador (opcional)
 * @param {Object} params.teamState - Estado del equipo (opcional)
 * @param {Object} params.betState - Estado de apuesta (opcional)
 * @param {number} [params.basePoints] - Puntos base de esta pregunta (puntuación
 *   aleatoria). Si se omite, se usa BASE_POINTS.
 * @returns {Object} Resultado del procesamiento
 */
function processAnswer({
    question,
    answerIndex,
    playerAnswer,
    gameStartTime,
    currentTime = Date.now(),
    game = {},
    playerState = {},
    teamState = {},
    betState = {},
    basePoints
}) {
    // Si es pregunta numérica aproximada
    if (question.question_type === 'numeric_approximation') {
        const { processNumericAnswer } = require('./NumericAnswerService');
        return processNumericAnswer({
            question,
            playerAnswer,
            gameStartTime,
            currentTime
        });
    }

    // Obtener opción seleccionada (para preguntas de opciones múltiples)
    const optionSelected = question.options[answerIndex];

    // Si no existe la opción, respuesta inválida
    if (!optionSelected) {
        return {
            isCorrect: false,
            pointsEarned: 0,
            timeBonus: 0,
            optionSelected: null,
            isSurvey: question.question_type === 'survey',
            details: null
        };
    }

    // Si es encuesta, no hay puntos
    if (question.question_type === 'survey') {
        return {
            isCorrect: null,
            pointsEarned: 0,
            timeBonus: 0,
            optionSelected,
            isSurvey: true,
            details: { strategy: 'survey' }
        };
    }

    // Obtener estrategia de puntuación
    const strategy = strategyFactory.createFromQuestion(question, game, { basePoints });

    // Calcular tiempo transcurrido
    const questionTimeLimit = question.time_limit || TIMING.DEFAULT_QUESTION_TIME;
    const timeElapsed = (currentTime - gameStartTime) / 1000; // Convertir a segundos

    // Delegar cálculo a estrategia
    const result = strategy.calculatePoints({
        isCorrect: optionSelected.isCorrect,
        timeElapsed,
        questionTimeLimit,
        playerState,
        teamState,
        betState
    });

    // Retornar en formato compatible con código legacy
    return {
        isCorrect: optionSelected.isCorrect,
        pointsEarned: result.pointsEarned,
        timeBonus: result.details.timeBonus || 0,
        timeElapsed,
        optionSelected,
        isSurvey: false,
        details: result.details // Detalles completos de la estrategia
    };
}

/**
 * Actualiza puntuación de equipo
 * 
 * @param {Object} params - Parámetros
 * @param {number} params.currentTeamScore - Puntuación actual del equipo
 * @param {number} params.pointsEarned - Puntos ganados por el jugador
 * @returns {number} Nueva puntuación del equipo
 */
function updateTeamScore({ currentTeamScore = 0, pointsEarned }) {
    return roundScore(currentTeamScore + pointsEarned);
}

/**
 * Actualiza puntuación de jugador
 * 
 * @param {Object} params - Parámetros
 * @param {number} params.currentScore - Puntuación actual
 * @param {number} params.pointsEarned - Puntos ganados/perdidos
 * @returns {number} Nueva puntuación
 */
function updatePlayerScore({ currentScore = 0, pointsEarned }) {
    return roundScore(currentScore + pointsEarned);
}

/**
 * Genera ranking ordenado por puntuación
 * 
 * @param {Object} scores - Mapa de nickname → score
 * @returns {Array<Object>} Ranking ordenado
 * 
 * @example
 * generateRanking({ 'Alice': 100, 'Bob': 150, 'Charlie': 75 })
 * // → [
 * //   { position: 1, nickname: 'Bob', score: 150, isTeam: false },
 * //   { position: 2, nickname: 'Alice', score: 100, isTeam: false },
 * //   { position: 3, nickname: 'Charlie', score: 75, isTeam: false }
 * // ]
 */
function generateRanking(scores, isTeam = false) {
    return Object.entries(scores)
        .sort((a, b) => b[1] - a[1]) // Ordenar descendente por puntuación
        .map(([nickname, score], index) => ({
            position: index + 1,
            nickname,
            score: roundScore(score),
            isTeam
        }));
}

/**
 * Encuentra la opción correcta de una pregunta
 * 
 * @param {Object} question - Pregunta
 * @returns {Object|null} Opción correcta o null si es encuesta
 */
function getCorrectOption(question) {
    if (question.question_type === 'survey') {
        return null;
    }
    return question.options.find(opt => opt.isCorrect) || null;
}

/**
 * Obtiene justificación de una opción (o de la correcta como fallback)
 * 
 * @param {Object} selectedOption - Opción seleccionada
 * @param {Object} correctOption - Opción correcta
 * @returns {string|null} Texto de justificación
 */
function getJustification(selectedOption, correctOption) {
    return selectedOption?.justification || correctOption?.justification || null;
}

/**
 * Texto de la respuesta correcta para el resultado del jugador.
 * Numérica y anagrama no tienen opción correcta: se usa el número o la palabra.
 * @param {Object} question
 * @param {Object|null} correctOption
 * @returns {string|number|null}
 */
function getCorrectAnswerText(question, correctOption) {
    if (question?.question_type === 'numeric_approximation') return question.correct_answer ?? null;
    if (question?.question_type === 'word_scramble') return question.correct_word ?? null;
    return correctOption?.text || correctOption?.optionText || correctOption?.option_text || '';
}

/**
 * Obtiene la estrategia de puntuación para una pregunta
 * 
 * @param {Object} question - Pregunta
 * @param {Object} game - Objeto de juego
 * @returns {ScoringStrategy} Estrategia configurada
 */
function getStrategy(question, game = {}) {
    return strategyFactory.createFromQuestion(question, game);
}

// ========== EXPORTACIONES ==========
module.exports = {
    // Funciones principales (refactorizadas)
    processAnswer,
    updatePlayerScore,
    updateTeamScore,
    generateRanking,

    // Utilidades
    calculateTimeBonus, // @deprecated - usar estrategias
    calculatePointsEarned, // @deprecated - usar estrategias
    roundScore,
    getCorrectOption,
    getJustification,
    getCorrectAnswerText,
    getStrategy, // NUEVO: obtener estrategia para una pregunta

    // Constantes (re-exportar para conveniencia)
    SCORING,
    TIMING,

    // Factory (exponer para testing)
    strategyFactory
};
