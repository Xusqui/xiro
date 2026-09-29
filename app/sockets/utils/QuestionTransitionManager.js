/**
 * @fileoverview Question Transition Manager - Handles state transitions between questions
 * Manages player state reset, state machine sync, and Redis broadcasting
 */

const logger = require('../../config/logger');
const { getRedisClient } = require('../../config/redis');
const { getOrCreateAdapter } = require('../../domain/state/GameStateAdapter');
const { initializeExpectedPlayers } = require('./AtomicAnswerCounter');
const { usesRandomPoints } = require('../../domain/services/QuestionScoringPolicy');
const { generateForGame } = require('../../domain/services/RandomPointsGenerator');
const { persistRandomPoints } = require('../../application/commands/submit-answer/randomPointsResolution');

/**
 * Sortea los puntos base de la pregunta que se va a mostrar, si procede.
 * Fuente de verdad única: se genera aquí una sola vez, se guarda en el juego,
 * se persiste en Redis y se publica por pub/sub (igual que questionStartTime).
 *
 * @param {Object} game
 * @param {string} roomId
 * @returns {number|null}
 */
function assignRandomPointsForCurrentQuestion(game, roomId) {
    const question = game.questions?.[game.currentIndex];

    if (!usesRandomPoints(question, game)) {
        game.currentRandomPoints = null;
        return null;
    }

    game.currentRandomPoints = generateForGame(game);
    persistRandomPoints({
        roomId,
        questionIndex: game.currentIndex,
        points: game.currentRandomPoints
    });

    return game.currentRandomPoints;
}

/**
 * Reset player states for next question
 * @param {Map} players - Global players map
 * @param {Object} game - Active game object
 * @param {Object} io - Socket.io instance for cross-worker sync
 */
function resetPlayerStatesForNextQuestion(players, game) {
    if (!game || !game.players) return;

    const roomId = game.roomId || game.pin;

    // Persist canonical roomId on the game to avoid fallback to pin in later transitions
    game.roomId = roomId;

    // Reset only local Map entries — O(n). Cross-worker socket.data reset via fetchSockets()
    // was removed: it caused 200+ concurrent Redis adapter queries under load and timed out.
    // Answer state is tracked canonically in Redis (AtomicAnswerCounter), not in socket.data.
    const playerByNickname = new Map();
    for (const [, player] of players.entries()) {
        if (player.roomId === roomId) {
            playerByNickname.set(player.nickname, player);
        }
    }

    for (const nickname of game.players) {
        const player = playerByNickname.get(nickname);
        if (player) {
            player.hasAnswered = false;
            player.currentIndex = game.currentIndex;
        }
    }
}

/**
 * Transition state machine to next question
 * @param {string} roomId - Game room ID
 * @param {Array} questions - Game questions array
 * @param {boolean} isTeamMode - Is team mode enabled
 * @returns {boolean} Success status
 */
function transitionStateMachine(roomId, questions, isTeamMode) {
    try {
        const adapter = getOrCreateAdapter(roomId, questions, isTeamMode);

        if (!adapter) {
            logger.warn(`No adapter found for ${roomId}`);
            return false;
        }

        const currentState = adapter.getCurrentState();

        // Handle different starting states
        if (currentState === 'scoring') {
            adapter.scoringComplete(); // scoring → results
        }

        if (currentState === 'results') {
            adapter.nextQuestion(true); // results → questionActive (legacy ya incrementó índice)
        } else if (currentState === 'lobby') {
            // Avance no bloqueante de sincronía con flujo legacy (sin afectar ejecución principal)
            adapter.startGame();
            adapter.countdownComplete();
            adapter.revealToPlayers();
        } else if (currentState === 'countdown') {
            adapter.countdownComplete();
            adapter.revealToPlayers();
        } else if (currentState === 'questionActive') {
            adapter.revealToPlayers();
        } else if (currentState === 'idle') {
            logger.error('Cannot transition from idle state');
            return false;
        }

        // Ready de sincronización (no gatea ejecución de juego)
        return adapter.getCurrentState() !== 'idle';

    } catch (err) {
        logger.error('State machine transition error:', err.message);
        return false;
    }
}

/**
 * Prepare next question with full state reset
 * @param {Object} params - Transition parameters
 * @returns {Object} Transition result
 */
async function prepareNextQuestion({
    game,
    players,
    syncBus,
    clearGameTimer,
    io
}) {
    if (!game) {
        return { success: false, error: 'Game not found' };
    }

    const roomId = game.roomId || game.pin;
    game.roomId = roomId;
    game.readyForRanking = false;

    // Guard: no avanzar más allá de la última pregunta
    const nextIndex = game.currentIndex + 1;
    if (!game.questions || nextIndex >= game.questions.length) {
        return { success: false, isGameEnd: true };
    }

    // Stop current question timer
    clearGameTimer(roomId);


    // Move to next question
    game.currentIndex = nextIndex;
    game.questionStartTime = Date.now();
    game.answerStats = {};
    assignRandomPointsForCurrentQuestion(game, roomId);

    // Persist canonical questionStartTime to Redis so workers that missed the pub/sub message
    // (transient disconnection) can recover the correct epoch before scoring.
    // TTL matches the max game session duration; fire-and-forget to stay non-blocking.
    Promise.resolve(getRedisClient())
        .then(rc => rc.set(`game:questionstart:${roomId}`, String(game.questionStartTime), { EX: 7200 }))
        .catch(err => logger.warn('Failed to persist questionStartTime to Redis', { roomId, error: err.message }));

    // Reset all player states (local Map only — cross-worker via AtomicAnswerCounter)
    await resetPlayerStatesForNextQuestion(players, game);

    // Transition state machine
    const stateMachineReady = transitionStateMachine(
        roomId,
        game.questions,
        game.teamMode
    );

    if (!stateMachineReady) {
        logger.warn('State machine no sincronizada, continuando en modo legacy');
    }

    // Enable answers
    game.canAnswer = true;
    game.answeredCurrent = new Set();

    // Reiniciar contadores canónicos en Redis. Pasar game.players evita el fetchSockets()
    // de fallback en initializeExpectedPlayers, que bajo carga alta (200+ bots) agota
    // el Redis adapter y provoca timeouts en cascada en submit-answer.
    try {
        await initializeExpectedPlayers({ roomId, io, nicknames: game.players });
    } catch (err) {
        // Fallback defensivo: al menos limpiar respondidos para no contaminar la ronda.
        logger.warn('Failed to initialize expected players set', {
            roomId,
            error: err.message
        });
        Promise.resolve(getRedisClient())
            .then(r => r.del(`game:answered:${roomId}`))
            .catch(() => { });
    }

    // Broadcast to other workers via Redis.
    // IMPORTANT: pass game.questionStartTime so every worker uses the same canonical epoch
    // for time-based scoring. Without this, non-originating workers keep the stale
    // questionStartTime from the previous question and compute timeElapsed incorrectly.
    await syncBus.publishNextQuestion(
        roomId,
        game.currentIndex,
        game.questionStartTime,
        game.currentRandomPoints
    );

    return {
        success: true,
        questionIndex: game.currentIndex,
        currentQuestion: game.questions[game.currentIndex],
        canAnswer: game.canAnswer
    };
}

module.exports = {
    resetPlayerStatesForNextQuestion,
    transitionStateMachine,
    prepareNextQuestion,
    assignRandomPointsForCurrentQuestion
};
