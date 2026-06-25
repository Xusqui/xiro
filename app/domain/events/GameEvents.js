/**
 * @fileoverview Eventos de dominio del ciclo de vida del juego
 * @module domain/events/GameEvents
 */

const DomainEvent = require('./DomainEvent');

/**
 * Evento: Juego iniciado
 */
class GameStartedEvent extends DomainEvent {
    constructor({ gameId, pin, mode, questionCount, playerCount }) {
        super('game.started', {
            gameId,
            pin,
            mode, // 'individual' | 'teams'
            questionCount,
            playerCount
        });
    }
}

/**
 * Evento: Pregunta revelada a jugadores
 */
class QuestionRevealedEvent extends DomainEvent {
    constructor({ roomId, gameId, question, questionIndex, questionId, questionType, timeLimit, totalQuestions, showAnswersToPlayers }) {
        super('question.revealed', {
            roomId: roomId || gameId,
            gameId: gameId || roomId,
            question,
            questionIndex,
            questionId: questionId || question?.id,
            questionType: questionType || question?.question_type || question?.slide_type,
            timeLimit: timeLimit || question?.time_limit,
            totalQuestions,
            showAnswersToPlayers: showAnswersToPlayers !== undefined ? showAnswersToPlayers : false
        });
    }
}

/**
 * Evento: Jugador envió respuesta
 */
class AnswerSubmittedEvent extends DomainEvent {
    constructor({ gameId, playerId, nickname, questionIndex, answerIndex, isCorrect, timeElapsed }) {
        super('answer.submitted', {
            gameId,
            playerId,
            nickname,
            questionIndex,
            answerIndex,
            isCorrect,
            timeElapsed
        });
    }
}

/**
 * Evento: Puntos calculados para jugador
 * 
 * @param {Object} params
 * @param {string} params.gameId - ID del juego
 * @param {string} params.playerId - ID del jugador
 * @param {string} params.nickname - Nickname del jugador
 * @param {number} params.questionIndex - Índice de la pregunta
 * @param {number} params.pointsEarned - Puntos ganados/perdidos
 * @param {number} params.totalScore - Puntuación total
 * @param {boolean} params.isCorrect - Si respondió correctamente
 * @param {Object} [params.scoringDetails] - Detalles del cálculo de puntuación
 * @param {string} params.scoringDetails.strategy - Estrategia usada (time_based, streak_bonus, betting)
 * @param {number} params.scoringDetails.basePoints - Puntos base
 * @param {number} params.scoringDetails.timeBonus - Bonus por tiempo
 * @param {number} [params.scoringDetails.streakBonus] - Bonus por racha (individual + equipo)
 * @param {number} [params.scoringDetails.currentStreak] - Racha actual del jugador
 * @param {boolean} [params.scoringDetails.teamStreak] - Si el equipo está en racha
 * @param {number} [params.scoringDetails.betAmount] - Cantidad apostada (si betting)
 */
class PlayerScoredEvent extends DomainEvent {
    constructor({ gameId, playerId, nickname, questionIndex, pointsEarned, totalScore, isCorrect, scoringDetails = null }) {
        super('player.scored', {
            gameId,
            playerId,
            nickname,
            questionIndex,
            pointsEarned,
            totalScore,
            isCorrect,
            scoringDetails // NUEVO: Detalles completos del scoring
        });
    }
}

/**
 * Evento: Respuesta revelada (tiempo agotado o todos respondieron)
 */
class AnswerRevealedEvent extends DomainEvent {
    constructor({ gameId, questionIndex, correctIndex, stats }) {
        super('answer.revealed', {
            gameId,
            questionIndex,
            correctIndex,
            stats // { 0: 5, 1: 3, 2: 1 } - respuestas por opción
        });
    }
}

/**
 * Evento: Juego finalizado
 */
class GameEndedEvent extends DomainEvent {
    constructor({ roomId, gameId, pin, finalRanking, ranking, totalQuestions, questionCount, duration, playerCount, stats, reason, timestamp }) {
        super('game.ended', {
            roomId: roomId || gameId,
            gameId: gameId || roomId,
            pin,
            ranking: finalRanking || ranking, // [{position, name, score}] o [{nickname, score, position}]
            finalRanking: finalRanking || ranking,
            totalQuestions: totalQuestions || questionCount,
            questionCount: questionCount || totalQuestions,
            duration,
            playerCount: playerCount || (ranking || finalRanking)?.length || 0,
            stats,
            reason,
            timestamp: timestamp || Date.now()
        });
    }
}

/**
 * Evento: Jugador se unió al juego
 */
class PlayerJoinedEvent extends DomainEvent {
    constructor({ gameId, playerId, nickname, playerCount }) {
        super('player.joined', {
            gameId,
            playerId,
            nickname,
            playerCount
        });
    }
}

/**
 * Evento: Jugador se desconectó
 */
class PlayerDisconnectedEvent extends DomainEvent {
    constructor({ gameId, playerId, nickname, reason }) {
        super('player.disconnected', {
            gameId,
            playerId,
            nickname,
            reason
        });
    }
}

/**
 * Evento: Timer iniciado para pregunta
 */
class TimerStartedEvent extends DomainEvent {
    constructor({ gameId, questionIndex, timeLimit }) {
        super('timer.started', {
            gameId,
            questionIndex,
            timeLimit
        });
    }
}

/**
 * Evento: Tiempo agotado
 */
class TimeExpiredEvent extends DomainEvent {
    constructor({ gameId, questionIndex, answeredCount, totalPlayers }) {
        super('timer.expired', {
            gameId,
            questionIndex,
            answeredCount,
            totalPlayers
        });
    }
}

/**
 * Evento: Jugador alcanzó racha de aciertos
 * FASE 17.2 - Estrategias de Puntuación
 */
class PlayerStreakAchievedEvent extends DomainEvent {
    constructor({ gameId, playerId, nickname, streakCount, bonusPercentage }) {
        super('player.streak.achieved', {
            gameId,
            playerId,
            nickname,
            streakCount,
            bonusPercentage
        });
    }
}

/**
 * Evento: Equipo completo alcanzó racha (todos los jugadores en racha)
 * FASE 17.2 - Estrategias de Puntuación
 */
class TeamStreakAchievedEvent extends DomainEvent {
    constructor({ gameId, teamName, streakCount, bonusPercentage, playerCount }) {
        super('team.streak.achieved', {
            gameId,
            teamName,
            streakCount,
            bonusPercentage,
            playerCount
        });
    }
}

/**
 * Evento: Jugador colocó apuesta en pregunta de tipo betting
 * FASE 17.2 - Estrategias de Puntuación
 */
class BetPlacedEvent extends DomainEvent {
    constructor({ gameId, playerId, nickname, questionIndex, betAmount, currentScore }) {
        super('bet.placed', {
            gameId,
            playerId,
            nickname,
            questionIndex,
            betAmount,
            currentScore
        });
    }
}

/**
 * Evento: Todos los jugadores han colocado sus apuestas
 * FASE 17.2 - Estrategias de Puntuación
 */
class AllBetsPlacedEvent extends DomainEvent {
    constructor({ gameId, questionIndex, betCount, totalBetAmount }) {
        super('bets.all_placed', {
            gameId,
            questionIndex,
            betCount,
            totalBetAmount
        });
    }
}

module.exports = {
    GameStartedEvent,
    QuestionRevealedEvent,
    AnswerSubmittedEvent,
    PlayerScoredEvent,
    AnswerRevealedEvent,
    GameEndedEvent,
    PlayerJoinedEvent,
    PlayerDisconnectedEvent,
    TimerStartedEvent,
    TimeExpiredEvent,
    PlayerStreakAchievedEvent,
    TeamStreakAchievedEvent,
    BetPlacedEvent,
    AllBetsPlacedEvent
};
