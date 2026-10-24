/**
 * @fileoverview Lo que ve un jugador al revisar una diapositiva ya mostrada de un juego
 * personalizado: la diapositiva y, si es una pregunta, la solución con la justificación
 * (sin estadísticas, como en el reveal) y su propio resultado.
 *
 * El resultado sale del registro de respuestas que se guarda al responder
 * (playerAnswerArchive: `game:playeranswers:<sala>`, campo `<índice>:<nick>`).
 * En equipos, sin registro propio, vale el de un compañero de su equipo.
 */

'use strict';

const { getRedisClient } = require('../../config/redis');
const { sanitizeQuestionForPlayers } = require('../../services/payload.sanitizer');
const { hasTimer } = require('../../domain/services/QuestionScoringPolicy');
const { buildPlayerRevealPayload } = require('./RevealTypePayloads');
const { findRevealPayload } = require('./RevealPayloadStore');
const logger = require('../../config/logger');

const NOT_ANSWERED = Object.freeze({ answered: false });

async function readSnapshot(redis, roomId, field) {
    const raw = await redis.hGet(`game:playeranswers:${roomId}`, field);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function toResult(snapshot, team) {
    return {
        answered: true,
        isCorrect: snapshot.isCorrect ?? null,
        pointsEarned: snapshot.pointsEarned || 0,
        answer: snapshot.answer ?? null,
        team
    };
}

function findTeam(teamConfig, nickname) {
    if (!teamConfig?.isTeamMode || !Array.isArray(teamConfig.teams)) return null;
    return teamConfig.teams.find(team => team.players?.includes(nickname)) || null;
}

/**
 * @param {Object} params
 * @param {string} params.roomId
 * @param {number} params.index
 * @param {string} params.nickname
 * @param {Object} [params.teamConfig]
 * @returns {Promise<Object>} { answered: false } o { answered: true, isCorrect, pointsEarned, answer, team }
 */
async function loadPlayerReviewResult({ roomId, index, nickname, teamConfig }) {
    try {
        const redis = await getRedisClient();
        const own = await readSnapshot(redis, roomId, `${index}:${nickname}`);
        if (own) return toResult(own, null);

        const team = findTeam(teamConfig, nickname);
        for (const mate of team?.players || []) {
            if (mate === nickname) continue;
            const snapshot = await readSnapshot(redis, roomId, `${index}:${mate}`);
            if (snapshot) return toResult(snapshot, team.name);
        }
    } catch (err) {
        logger.warn('No se pudo leer el resultado del jugador para la revisión', { roomId, index, error: err.message });
    }
    return { ...NOT_ANSWERED };
}

/**
 * @param {Object} params
 * @param {string} params.roomId
 * @param {Object} params.game - Partida en memoria (activeGames)
 * @param {string} params.nickname
 * @param {Object} [params.teamConfig]
 * @returns {Promise<Object>} { question, currentIndex, totalQuestions, reveal, result }
 */
async function buildPlayerReviewState({ roomId, game, nickname, teamConfig }) {
    const index = game.currentIndex;
    const question = game.questions?.[index];
    const base = {
        question: sanitizeQuestionForPlayers(question),
        currentIndex: index,
        totalQuestions: game.questions?.length || 0
    };

    if (!hasTimer(question)) {
        return { ...base, reveal: null, result: null };
    }

    const stored = await findRevealPayload(roomId, game, index);
    return {
        ...base,
        reveal: stored ? buildPlayerRevealPayload(stored) : null,
        result: await loadPlayerReviewResult({ roomId, index, nickname, teamConfig })
    };
}

module.exports = { buildPlayerReviewState, loadPlayerReviewResult };
