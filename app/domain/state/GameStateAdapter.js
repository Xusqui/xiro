/**
 * GameStateAdapter - Adaptador entre el estado legacy y la state machine
 * 
 * Permite usar la máquina de estados en paralelo con el código existente
 * sin romper funcionalidad. Sincroniza ambos sistemas.
 * 
 * @module domain/state/GameStateAdapter
 */

const { createActor } = require('xstate');
const { gameStateMachine } = require('./GameStateMachine');
const logger = require('../../config/logger');

/**
 * Adaptador que mantiene sincronizados el estado legacy y la state machine
 */
class GameStateAdapter {
    constructor(gameId) {
        this.gameId = gameId;
        this.actor = null;
        this.legacyState = null;
    }

    /**
     * Inicializa la máquina de estados con el juego creado
     */
    initialize(questions, isTeamMode = false) {
        this.actor = createActor(gameStateMachine);
        this.actor.start();

        logger.debug(`Inicializando state machine con ${questions?.length || 0} preguntas, isTeamMode: ${isTeamMode}`);

        this.actor.send({
            type: 'CREATE_GAME',
            questions,
            isTeamMode
        });

        const finalState = this.getCurrentState();
        logger.debug(`Estado después de CREATE_GAME: ${finalState}, totalQuestions: ${this.getContext().totalQuestions}`);

        return this;
    }

    /**
     * Sincroniza con el estado legacy
     * Sobrescribe el contexto de XState para mantener sincronización
     */
    syncWithLegacy(legacyGame) {
        this.legacyState = {
            currentIndex: legacyGame.currentIndex,
            canAnswer: legacyGame.canAnswer,
            scores: legacyGame.scores,
            answerStats: legacyGame.answerStats,
            players: legacyGame.players
        };

        // CRÍTICO: Sincronizar currentQuestionIndex usando evento SYNC_QUESTION_INDEX
        // XState requiere eventos para modificar el contexto (no mutaciones directas)
        if (this.actor) {
            const currentIndex = this.actor.getSnapshot().context.currentQuestionIndex;
            if (currentIndex !== legacyGame.currentIndex) {
                this.actor.send({
                    type: 'SYNC_QUESTION_INDEX',
                    index: legacyGame.currentIndex
                });
            }
        }
    }

    /**
     * Jugador se une al lobby
     */
    playerJoin(playerNickname) {
        if (!this.actor) return;

        this.actor.send({
            type: 'PLAYER_JOIN',
            playerNickname
        });
    }

    /**
     * Jugador sale del lobby
     */
    playerLeave(playerNickname) {
        if (!this.actor) return;

        this.actor.send({
            type: 'PLAYER_LEAVE',
            playerNickname
        });
    }

    /**
     * Inicia el juego (lobby → countdown)
     */
    startGame() {
        if (!this.actor) return false;

        this.actor.send({ type: 'START_GAME' });
        return this.getCurrentState() === 'countdown';
    }

    /**
     * Completa el countdown (countdown → questionActive)
     */
    countdownComplete() {
        if (!this.actor) return;

        this.actor.send({ type: 'COUNTDOWN_COMPLETE' });
    }

    /**
     * Revela pregunta a jugadores (questionActive → answering)
     */
    revealToPlayers() {
        if (!this.actor) return;

        this.actor.send({ type: 'REVEAL_TO_PLAYERS' });
    }

    /**
     * Procesa una respuesta de jugador
     */
    submitAnswer(answerIndex) {
        if (!this.actor) return false;

        const canSubmit = this.canAcceptAnswers();
        if (canSubmit) {
            this.actor.send({
                type: 'SUBMIT_ANSWER',
                answerIndex
            });
        }
        return canSubmit;
    }

    /**
     * Pausa el timer
     */
    pauseTimer() {
        if (!this.actor) return;

        this.actor.send({ type: 'PAUSE_TIMER' });
    }

    /**
     * Reanuda el timer
     */
    resumeTimer() {
        if (!this.actor) return;

        this.actor.send({ type: 'RESUME_TIMER' });
    }

    /**
     * Timer se acaba (answering → scoring)
     */
    timeUp() {
        if (!this.actor) return;

        this.actor.send({ type: 'TIME_UP' });
    }

    /**
     * Revela resultados manualmente (answering → scoring)
     */
    revealResults() {
        if (!this.actor) return;

        this.actor.send({ type: 'REVEAL_RESULTS' });
    }

    /**
     * Completa scoring (scoring → results)
     */
    scoringComplete() {
        if (!this.actor) return;

        this.actor.send({ type: 'SCORING_COMPLETE' });
    }

    /**
     * Avanza a siguiente pregunta (results → questionActive)
     * @param {boolean} skipIncrement - Si true, no incrementa el índice (útil cuando legacy ya incrementó)
     */
    nextQuestion(skipIncrement = false) {
        if (!this.actor) return false;

        this.actor.send({
            type: 'NEXT_QUESTION',
            skipIncrement: skipIncrement
        });
        return this.getCurrentState() === 'questionActive';
    }



    /**
     * Termina el juego (results → gameEnd)
     */
    endGame() {
        if (!this.actor) return;

        this.actor.send({ type: 'END_GAME' });
    }

    /**
     * Obtiene el estado actual de la máquina
     */
    getCurrentState() {
        if (!this.actor) return 'idle';

        const snapshot = this.actor.getSnapshot();
        return snapshot.value;
    }

    /**
     * Obtiene el contexto completo
     */
    getContext() {
        if (!this.actor) return null;

        return this.actor.getSnapshot().context;
    }

    /**
     * Verifica si puede aceptar respuestas
     */
    canAcceptAnswers() {
        if (!this.actor) return false;

        const snapshot = this.actor.getSnapshot();
        const state = snapshot.value;
        const context = snapshot.context;

        return state === 'answering' && context.canAnswer && !context.isPaused;
    }

    /**
     * Verifica si el juego está en progreso
     */
    isInProgress() {
        if (!this.actor) return false;

        const state = this.getCurrentState();
        return ['countdown', 'questionActive', 'answering', 'scoring', 'results'].includes(state);
    }

    /**
     * Verifica si está pausado
     */
    isPaused() {
        if (!this.actor) return false;

        return this.getContext()?.isPaused || false;
    }

    /**
     * Obtiene el índice de pregunta actual
     */
    getCurrentQuestionIndex() {
        if (!this.actor) return 0;

        return this.getContext()?.currentQuestionIndex || 0;
    }

    /**
     * Verifica si debe ir a siguiente pregunta o terminar
     */
    shouldGoToNext() {
        if (!this.actor) return false;

        const context = this.getContext();
        return context.currentQuestionIndex < context.totalQuestions - 1;
    }

    /**
     * Valida que el estado de la máquina coincide con el legacy
     * Para debugging y migración gradual
     */
    validateSync() {
        if (!this.actor || !this.legacyState) return { valid: true, errors: [] };

        const context = this.getContext();
        const errors = [];

        // Validar índice de pregunta
        if (context.currentQuestionIndex !== this.legacyState.currentIndex) {
            errors.push(`Question index mismatch: SM=${context.currentQuestionIndex}, Legacy=${this.legacyState.currentIndex}`);
        }

        // Validar canAnswer (solo si estamos en answering)
        if (this.getCurrentState() === 'answering') {
            if (context.canAnswer !== this.legacyState.canAnswer) {
                errors.push(`canAnswer mismatch: SM=${context.canAnswer}, Legacy=${this.legacyState.canAnswer}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            state: this.getCurrentState(),
            legacyCanAnswer: this.legacyState.canAnswer,
            machineCanAnswer: context.canAnswer
        };
    }

    /**
     * Detiene el actor
     */
    stop() {
        if (this.actor) {
            this.actor.stop();
            this.actor = null;
        }
    }
}

/**
 * Mapa global de adaptadores por gameId
 * Permite acceder a la state machine desde cualquier parte del código
 */
const gameStateAdapters = new Map();

/**
 * Obtiene un adapter existente (sin crear uno nuevo)
 * Solo devuelve el adapter si está inicializado
 */
function getAdapter(gameId) {
    const adapter = gameStateAdapters.get(gameId);
    // Solo devolver si existe Y está inicializado (tiene actor)
    if (adapter && adapter.actor) {
        return adapter;
    }
    return null;
}

/**
 * Crea o obtiene un adaptador para un juego
 */
function getOrCreateAdapter(gameId, questions, isTeamMode = false) {
    logger.debug(`getOrCreateAdapter called: gameId=${gameId}, questions=${questions?.length || 'undefined'}, isTeamMode=${isTeamMode}, exists=${gameStateAdapters.has(gameId)}`);

    if (!gameStateAdapters.has(gameId)) {
        const adapter = new GameStateAdapter(gameId);
        logger.debug(`Calling initialize with ${questions?.length || 0} questions`);
        adapter.initialize(questions, isTeamMode);
        gameStateAdapters.set(gameId, adapter);
    }
    return gameStateAdapters.get(gameId);
}

/**
 * Elimina un adaptador
 */
function removeAdapter(gameId) {
    const adapter = gameStateAdapters.get(gameId);
    if (adapter) {
        adapter.stop();
        gameStateAdapters.delete(gameId);
    }
}

/**
 * Limpia todos los adaptadores
 */
function clearAllAdapters() {
    gameStateAdapters.forEach(adapter => adapter.stop());
    gameStateAdapters.clear();
}

module.exports = {
    GameStateAdapter,
    getAdapter,
    getOrCreateAdapter,
    removeAdapter,
    clearAllAdapters
};
