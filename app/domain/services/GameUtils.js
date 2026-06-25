/**
 * @fileoverview Utilidades puras de lógica de juego — capa de dominio
 *
 * Estas funciones son puras (sin efectos secundarios salvo logging) y pertenecen
 * al dominio porque codifican reglas de negocio: cómo se barajan opciones, cómo
 * se puntúan respuestas y cómo se calcula la puntuación de un equipo.
 *
 * Referencia de importadores externos: services/game.logic.js re-exporta estas
 * funciones para compatibilidad con código fuera de la capa de dominio.
 */

const logger = require('../../config/logger');

/**
 * Baraja un array usando el algoritmo Fisher-Yates
 * @param {Array} array - Array a barajar
 * @returns {Array} - Nueva copia del array barajada
 */
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Baraja las opciones de cada pregunta (no modifica slides de comentario, info ni encuestas)
 * @param {Array} questions - Array de preguntas
 * @returns {Array} - Preguntas con opciones barajadas
 */
function shuffleOptions(questions) {
    return questions.map(q => {
        // No modificar slides especiales (comment/info/text) ni encuestas
        if (
            q.slide_type === 'comment'
            || q.slide_type === 'info'
            || q.slide_type === 'text'
            || q.slide_type === 'image'
            || q.question_type === 'survey'
        ) {
            return q;
        }
        const shuffledOptions = shuffle(q.options);
        return {
            ...q,
            options: shuffledOptions
        };
    });
}

/**
 * Redondea puntuaciones a 1 decimal
 * @param {number} score - Puntuación a redondear
 * @returns {number} - Puntuación redondeada
 */
function roundScore(score) {
    return Math.round(score * 10) / 10;
}

/**
 * Calcula la puntuación de un equipo usando media suavizada
 * Fórmula: S_equipo = (Σ puntos_jugadores + λ × μ) / (n_jugadores + λ)
 *
 * @param {Object} team - Objeto del equipo con {players: string[], score: number}
 * @param {Object} individualScores - Mapa de {nickname: score} con puntos individuales
 * @param {number} globalMean - Media global de puntos por jugador (μ)
 * @param {number} lambda - Parámetro de suavizado (λ). 0 = media simple, >0 = suavizado
 * @returns {number} - Puntuación calculada del equipo
 */
function calculateTeamScore(team, individualScores, globalMean, lambda = 0.5) {
    const teamPlayers = team.players || [];
    const n = teamPlayers.length;

    if (n === 0) return 0;

    const sumPoints = teamPlayers.reduce((sum, playerNick) => {
        return sum + (individualScores[playerNick] || 0);
    }, 0);

    logger.debug('[DEBUG] calculateTeamScore internals:', {
        teamName: team.name,
        teamPlayers,
        n,
        sumPoints,
        globalMean,
        lambda,
        calculation: `(${sumPoints} + ${lambda} × ${globalMean}) / (${n} + ${lambda})`,
        numerator: sumPoints + lambda * globalMean,
        denominator: n + lambda,
        rawScore: (sumPoints + lambda * globalMean) / (n + lambda)
    });

    const teamScore = (sumPoints + lambda * globalMean) / (n + lambda);
    const finalScore = roundScore(teamScore);

    logger.debug('[DEBUG] calculateTeamScore result:', {
        teamName: team.name,
        teamScore,
        finalScore,
        isNaN: isNaN(finalScore)
    });

    return finalScore;
}

module.exports = {
    shuffle,
    shuffleOptions,
    roundScore,
    calculateTeamScore
};
