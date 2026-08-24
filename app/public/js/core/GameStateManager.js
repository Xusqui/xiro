/**
 * @fileoverview Gestor centralizado del estado del juego
 * @description Maneja el estado global del juego con patrón Observer
 * @created 2025-02-05
 * @week Semana 19 - Frontend Cleanup
 */

import EventEmitter from './EventEmitter.js?v=20260824101409';

/**
 * Estados posibles del juego
 */
export const GameStates = {
    IDLE: 'idle',                   // Sin juego activo
    LOBBY: 'lobby',                 // En sala de espera
    COUNTDOWN: 'countdown',         // Cuenta regresiva
    PLAYING: 'playing',             // Jugando
    REVEALING: 'revealing',         // Revelando respuesta
    ENDED: 'ended',                 // Juego terminado
    RECONNECTING: 'reconnecting',   // Reconectando
};

/**
 * Gestor de estado del juego
 * Centraliza TODA la información del estado del juego
 */
export class GameStateManager extends EventEmitter {
    constructor() {
        super();

        this._state = {
            // Estado general
            gameState: GameStates.IDLE,
            pin: null,
            roomId: null,

            // Usuario actual
            nickname: null,
            role: null, // 'player', 'presenter', 'tv', 'admin'
            team: null,
            score: 0,
            position: null,

            // Configuración del juego
            isTeamMode: false,
            bank: null,
            totalQuestions: 0,
            currentQuestionNumber: 0,
            timerDuration: 0,

            // Pregunta actual
            currentQuestion: null,
            currentOptions: [],
            currentImageUrl: null,
            selectedAnswer: null,
            hasAnswered: false,

            // Jugadores
            players: [],
            totalPlayers: 0,

            // Equipos (si isTeamMode)
            teams: {},
            teamScores: {},

            // Ranking
            ranking: [],

            // Timer
            timerStartTime: null,
            timerPaused: false,
            timerRemainingTime: null,

            // Reconexión
            sessionId: null,
            isReconnecting: false,
            reconnectAttempts: 0,
        };
    }

    /**
     * Obtiene el estado completo (inmutable)
     * @returns {Object} Copia del estado
     */
    getState() {
        return { ...this._state };
    }

    /**
     * Obtiene un valor específico del estado
     * @param {string} key - Clave del estado
     * @returns {*} Valor
     */
    get(key) {
        return this._state[key];
    }

    /**
     * Actualiza el estado con validación
     * @param {Object} updates - Actualizaciones parciales
     * @param {boolean} [silent=false] - No emitir evento 'stateChanged'
     */
    setState(updates, silent = false) {
        const oldState = { ...this._state };

        // Aplicar actualizaciones
        Object.assign(this._state, updates);

        // Emitir eventos específicos
        Object.keys(updates).forEach(key => {
            if (oldState[key] !== this._state[key]) {
                this.emit(`${key}Changed`, this._state[key], oldState[key]);
            }
        });

        // Emitir evento general de cambio de estado
        if (!silent) {
            this.emit('stateChanged', this._state, oldState);
        }
    }

    /**
     * Reinicia el estado a valores iniciales
     */
    reset() {
        const pin = this._state.pin;
        const nickname = this._state.nickname;
        const role = this._state.role;

        this._state = {
            gameState: GameStates.IDLE,
            pin,
            roomId: null,
            nickname,
            role,
            team: null,
            score: 0,
            position: null,
            isTeamMode: false,
            bank: null,
            totalQuestions: 0,
            currentQuestionNumber: 0,
            timerDuration: 0,
            currentQuestion: null,
            currentOptions: [],
            currentImageUrl: null,
            selectedAnswer: null,
            hasAnswered: false,
            players: [],
            totalPlayers: 0,
            teams: {},
            teamScores: {},
            ranking: [],
            timerStartTime: null,
            timerPaused: false,
            timerRemainingTime: null,
            sessionId: null,
            isReconnecting: false,
            reconnectAttempts: 0,
        };

        this.emit('stateReset');
    }

    // ========================================================================
    // HELPERS ESPECÍFICOS
    // ========================================================================

    /**
     * Inicializa sala (join-success)
     */
    initializeRoom(data) {
        this.setState({
            roomId: data.roomId,
            nickname: data.nickname,
            isTeamMode: data.isTeamMode || false,
            team: data.team || null,
            players: data.players || [],
            totalPlayers: (data.players || []).length,
            gameState: GameStates.LOBBY,
        });
    }

    /**
     * Actualiza pregunta actual
     */
    setCurrentQuestion(questionData) {
        this.setState({
            currentQuestion: questionData.question,
            currentOptions: questionData.options || [],
            currentImageUrl: questionData.imageUrl || null,
            currentQuestionNumber: questionData.questionNumber,
            totalQuestions: questionData.totalQuestions,
            timerDuration: questionData.timerDuration,
            selectedAnswer: null,
            hasAnswered: false,
            gameState: GameStates.PLAYING,
        });
    }

    /**
     * Marca respuesta seleccionada
     */
    submitAnswer(answer) {
        this.setState({
            selectedAnswer: answer,
            hasAnswered: true,
        });
    }

    /**
     * Actualiza score del jugador
     */
    updateScore(score) {
        this.setState({ score });
    }

    /**
     * Actualiza ranking
     */
    updateRanking(ranking) {
        this.setState({ ranking });

        // Encontrar posición del jugador actual
        const position = ranking.findIndex(entry =>
            entry.nickname === this._state.nickname
        ) + 1;

        if (position > 0) {
            this.setState({ position }, true);
        }
    }

    /**
     * Actualiza lista de jugadores
     */
    updatePlayers(players) {
        this.setState({
            players,
            totalPlayers: players.length,
        });
    }

    /**
     * Agrega un jugador
     */
    addPlayer(player) {
        const players = [...this._state.players, player];
        this.updatePlayers(players);
    }

    /**
     * Elimina un jugador
     */
    removePlayer(nickname) {
        const players = this._state.players.filter(p => p.nickname !== nickname);
        this.updatePlayers(players);
    }

    /**
     * Actualiza equipos
     */
    updateTeams(teams, teamScores = null) {
        const updates = { teams };
        if (teamScores) {
            updates.teamScores = teamScores;
        }
        this.setState(updates);
    }

    /**
     * Inicia countdown
     */
    startCountdown(countdown) {
        this.setState({
            gameState: GameStates.COUNTDOWN,
        });
        this.emit('countdownStarted', countdown);
    }

    /**
     * Inicia juego
     */
    startGame(gameData) {
        this.setState({
            bank: gameData.bank,
            totalQuestions: gameData.totalQuestions,
            timerDuration: gameData.timerDuration,
            gameState: GameStates.PLAYING,
        });
    }

    /**
     * Termina juego
     */
    endGame(ranking) {
        this.setState({
            gameState: GameStates.ENDED,
            ranking,
        });
    }

    /**
     * Actualiza estado del timer
     */
    updateTimer(state) {
        this.setState({
            timerStartTime: state.startTime || null,
            timerPaused: state.paused || false,
            timerRemainingTime: state.remainingTime || null,
        });
    }

    /**
     * Revela respuesta correcta
     */
    revealAnswer(correctAnswer) {
        this.setState({
            gameState: GameStates.REVEALING,
        });
        this.emit('answerRevealed', correctAnswer);
    }

    /**
     * Inicia reconexión
     */
    startReconnection() {
        this.setState({
            isReconnecting: true,
            gameState: GameStates.RECONNECTING,
            reconnectAttempts: this._state.reconnectAttempts + 1,
        });
    }

    /**
     * Reconexión exitosa
     */
    reconnectSuccess(snapshot) {
        this.setState({
            isReconnecting: false,
            gameState: snapshot.gameState || GameStates.LOBBY,
            reconnectAttempts: 0,
        });

        // Restaurar estado del snapshot
        if (snapshot.currentQuestion) {
            this.setCurrentQuestion(snapshot.currentQuestion);
        }
        if (snapshot.score !== undefined) {
            this.updateScore(snapshot.score);
        }
        if (snapshot.ranking) {
            this.updateRanking(snapshot.ranking);
        }
    }

    /**
     * Verifica si el usuario actual es presentador
     */
    isPresenter() {
        return this._state.role === 'presenter';
    }

    /**
     * Verifica si el usuario actual es jugador
     */
    isPlayer() {
        return this._state.role === 'player';
    }

    /**
     * Verifica si está en modo equipo
     */
    isTeamMode() {
        return this._state.isTeamMode;
    }

    /**
     * Verifica si el jugador ha respondido
     */
    hasAnswered() {
        return this._state.hasAnswered;
    }

    /**
     * Obtiene el equipo del jugador actual
     */
    getMyTeam() {
        return this._state.team;
    }

    /**
     * Obtiene score del jugador actual (individual o equipo)
     */
    getMyScore() {
        if (this.isTeamMode() && this._state.team) {
            return this._state.teamScores[this._state.team] || 0;
        }
        return this._state.score;
    }
}

export default GameStateManager;
