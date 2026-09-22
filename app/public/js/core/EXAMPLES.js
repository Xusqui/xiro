/**
 * @fileoverview Ejemplo de uso de los módulos core
 * @description Muestra cómo usar SocketEventManager + GameStateManager juntos
 * @created 2025-02-05
 * @week Semana 19 - Frontend Cleanup
 * 
 * NOTA: Este archivo es solo de referencia/documentación
 *       NO incluirlo en producción
 */

import { SocketEventManager } from './SocketEventManager.js?v=20260922074829';
import { GameStateManager, GameStates } from './GameStateManager.js?v=20260922074829';
import {
    CONNECTION_EVENTS,
    JOIN_EVENTS,
    GAME_EVENTS,
    QUESTION_EVENTS,
    ANSWER_EVENTS,
    UPDATE_EVENTS,
} from './socket-events.js?v=20260922074829';

// ============================================================================
// EJEMPLO 1: Inicialización básica
// ============================================================================

function example1_basicSetup() {
    // Conectar socket
    const socket = io();

    // Crear gestores
    const socketManager = new SocketEventManager(socket, {
        debug: true,    // Habilitar logs
        strict: false   // No lanzar errores en eventos deprecados
    });

    const gameState = new GameStateManager();

    // Configurar estado inicial
    gameState.setState({
        role: 'player',
        nickname: 'JugadorDemo',
        pin: '1234',
    });

    console.log('✅ Gestores inicializados');
}

// ============================================================================
// EJEMPLO 2: Flujo completo de un jugador
// ============================================================================

function example2_playerFlow() {
    const socket = io();
    const socketManager = new SocketEventManager(socket, { debug: true });
    const gameState = new GameStateManager();

    // Configuración inicial
    gameState.setState({
        role: 'player',
        nickname: 'JugadorDemo',
        pin: '1234',
    });

    // -----------------------------------------------------------------------
    // 1. CONEXIÓN
    // -----------------------------------------------------------------------
    socketManager.on(CONNECTION_EVENTS.CONNECT, () => {
        console.log('🟢 Conectado al servidor');

        // Auto-join si hay PIN
        if (gameState.get('pin')) {
            socketManager.emit(JOIN_EVENTS.JOIN_GAME, {
                pin: gameState.get('pin'),
                nickname: gameState.get('nickname'),
            });
        }
    });

    socketManager.on(CONNECTION_EVENTS.DISCONNECT, (reason) => {
        console.log('🔴 Desconectado:', reason);
        gameState.setState({ gameState: GameStates.RECONNECTING });
    });

    // -----------------------------------------------------------------------
    // 2. JOIN
    // -----------------------------------------------------------------------
    socketManager.on(JOIN_EVENTS.JOIN_SUCCESS, (data) => {
        console.log('✅ Join exitoso:', data);
        gameState.initializeRoom(data);

        // Mostrar UI de lobby
        showLobby(data);
    });

    socketManager.on(JOIN_EVENTS.JOIN_ERROR, (data) => {
        console.error('❌ Error al unirse:', data.error);
        showError(data.error);
    });

    socketManager.on(JOIN_EVENTS.PLAYER_JOINED, (data) => {
        console.log('👤 Nuevo jugador:', data.nickname);
        gameState.addPlayer({ nickname: data.nickname, team: data.team });
        updatePlayerList(gameState.get('players'));
    });

    // -----------------------------------------------------------------------
    // 3. INICIO DEL JUEGO
    // -----------------------------------------------------------------------
    socketManager.on(GAME_EVENTS.COUNTDOWN_START, (data) => {
        console.log('⏱️ Cuenta regresiva:', data.countdown);
        gameState.startCountdown(data.countdown);
        showCountdown(data.countdown);
    });

    socketManager.on(GAME_EVENTS.GAME_STARTED, (data) => {
        console.log('🎮 Juego iniciado:', data);
        gameState.startGame(data);
        hideCountdown();
    });

    // -----------------------------------------------------------------------
    // 4. PREGUNTAS
    // -----------------------------------------------------------------------
    socketManager.on(QUESTION_EVENTS.NEW_QUESTION, (data) => {
        console.log('❓ Nueva pregunta:', data);
        gameState.setCurrentQuestion(data);

        // Mostrar pregunta en UI
        showQuestion({
            question: data.question,
            options: data.options,
            imageUrl: data.imageUrl,
            questionNumber: data.questionNumber,
            totalQuestions: data.totalQuestions,
        });

        // Iniciar timer visual
        startTimer(data.timerDuration);
    });

    socketManager.on(QUESTION_EVENTS.BLOCKED_ANSWER, (data) => {
        console.log('⏰ Bloqueado - tiempo agotado');
        disableAnswerButtons();
        showMessage('Tiempo agotado', 'warning');
    });

    // -----------------------------------------------------------------------
    // 5. RESPUESTAS
    // -----------------------------------------------------------------------

    // Cuando el jugador hace clic en una opción
    window.onAnswerClick = function (selectedAnswer) {
        if (gameState.hasAnswered()) {
            console.log('⚠️ Ya has respondido');
            return;
        }

        // Marcar en estado local
        gameState.submitAnswer(selectedAnswer);

        // Calcular tiempo de respuesta
        const timeToAnswer = calculateTimeToAnswer();

        // Enviar al servidor
        socketManager.emit(ANSWER_EVENTS.SUBMIT_ANSWER, {
            pin: gameState.get('pin'),
            answer: selectedAnswer,
            timeToAnswer,
        });

        // Feedback visual
        highlightAnswer(selectedAnswer);
        disableAnswerButtons();
        showMessage('Respuesta enviada', 'success');
    };

    socketManager.on(ANSWER_EVENTS.ANSWER_PENDING, (data) => {
        console.log('⏳ Respuesta pendiente:', data.message);
        showMessage(`Esperando a: ${data.waitingFor.join(', ')}`, 'info');
    });

    socketManager.on(ANSWER_EVENTS.ANSWER_RESULT, (data) => {
        console.log('📊 Resultado:', data);

        // Actualizar score
        gameState.updateScore(data.score);

        // Mostrar resultado
        showAnswerResult({
            isCorrect: data.isCorrect,
            score: data.score,
            timeBonus: data.timeBonus,
            correctAnswer: data.correctAnswer,
        });
    });

    // -----------------------------------------------------------------------
    // 6. REVEAL
    // -----------------------------------------------------------------------
    socketManager.on(QUESTION_EVENTS.REVEAL_ANSWER, (data) => {
        console.log('💡 Respuesta correcta:', data.correctAnswer);
        gameState.revealAnswer(data.correctAnswer);

        // Marcar respuesta correcta visualmente
        markCorrectAnswer(data.correctAnswer);
    });

    // -----------------------------------------------------------------------
    // 7. RANKING
    // -----------------------------------------------------------------------
    socketManager.on(UPDATE_EVENTS.RANKING_UPDATE, (data) => {
        console.log('🏆 Ranking actualizado:', data.ranking);
        gameState.updateRanking(data.ranking);

        // Mostrar ranking en UI
        updateRankingDisplay(data.ranking);

        // Mostrar posición del jugador
        const myPosition = gameState.get('position');
        showMyPosition(myPosition);
    });

    // -----------------------------------------------------------------------
    // 8. FIN DEL JUEGO
    // -----------------------------------------------------------------------
    socketManager.on(GAME_EVENTS.GAME_ENDED, (data) => {
        console.log('🏁 Juego terminado:', data);
        gameState.endGame(data.ranking);

        // Mostrar pantalla de resultados
        showFinalResults({
            ranking: data.ranking,
            myPosition: gameState.get('position'),
            myScore: gameState.getMyScore(),
            winners: data.winners,
        });
    });
}

// ============================================================================
// EJEMPLO 3: Listeners de cambios de estado
// ============================================================================

function example3_stateListeners() {
    const gameState = new GameStateManager();

    // Escuchar cambios de estado general
    gameState.on('stateChanged', (newState, oldState) => {
        console.log('📝 Estado actualizado:', newState);
    });

    // Escuchar cambios específicos
    gameState.on('gameStateChanged', (newGameState, oldGameState) => {
        console.log(`🎮 Estado del juego: ${oldGameState} → ${newGameState}`);

        switch (newGameState) {
            case GameStates.LOBBY:
                showLobbyScreen();
                break;
            case GameStates.COUNTDOWN:
                showCountdownScreen();
                break;
            case GameStates.PLAYING:
                showGameScreen();
                break;
            case GameStates.ENDED:
                showResultsScreen();
                break;
        }
    });

    gameState.on('scoreChanged', (newScore, oldScore) => {
        console.log(`💰 Score: ${oldScore} → ${newScore}`);
        animateScoreChange(oldScore, newScore);
    });

    gameState.on('rankingChanged', (newRanking) => {
        console.log('🏆 Ranking actualizado:', newRanking);
        updateRankingUI(newRanking);
    });
}

// ============================================================================
// EJEMPLO 4: Estadísticas de eventos
// ============================================================================

function example4_stats() {
    const socket = io();
    const socketManager = new SocketEventManager(socket, { debug: true });

    // Después de jugar un rato...
    setTimeout(() => {
        const stats = socketManager.getStats();

        console.log('📊 Estadísticas de eventos:');
        console.log('Total emitidos:', stats.totalEmitted);
        console.log('Total recibidos:', stats.totalReceived);
        console.log('Total errores:', stats.totalErrors);
        console.log('Desglose emitidos:', stats.emitted);
        console.log('Desglose recibidos:', stats.received);

        // Resetear si es necesario
        // socketManager.resetStats();
    }, 60000); // Después de 1 minuto
}

// ============================================================================
// FUNCIONES HELPER DE UI (stubs para el ejemplo)
// ============================================================================

function showLobby(data) { console.log('UI: Mostrando lobby'); }
function showError(error) { console.log('UI: Mostrando error:', error); }
function updatePlayerList(players) { console.log('UI: Lista de jugadores:', players); }
function showCountdown(countdown) { console.log('UI: Countdown:', countdown); }
function hideCountdown() { console.log('UI: Ocultar countdown'); }
function showQuestion(data) { console.log('UI: Mostrando pregunta:', data); }
function startTimer(duration) { console.log('UI: Timer iniciado:', duration); }
function disableAnswerButtons() { console.log('UI: Botones deshabilitados'); }
function showMessage(msg, type) { console.log(`UI: Mensaje [${type}]:`, msg); }
function highlightAnswer(answer) { console.log('UI: Respuesta seleccionada:', answer); }
function calculateTimeToAnswer() { return 5000; }
function showAnswerResult(data) { console.log('UI: Resultado:', data); }
function markCorrectAnswer(answer) { console.log('UI: Respuesta correcta:', answer); }
function updateRankingDisplay(ranking) { console.log('UI: Ranking:', ranking); }
function showMyPosition(position) { console.log('UI: Mi posición:', position); }
function showFinalResults(data) { console.log('UI: Resultados finales:', data); }
function showLobbyScreen() { console.log('UI: Pantalla lobby'); }
function showCountdownScreen() { console.log('UI: Pantalla countdown'); }
function showGameScreen() { console.log('UI: Pantalla juego'); }
function showResultsScreen() { console.log('UI: Pantalla resultados'); }
function animateScoreChange(oldScore, newScore) { console.log(`UI: Animación score ${oldScore} → ${newScore}`); }
function updateRankingUI(ranking) { console.log('UI: Actualizar ranking:', ranking); }

// ============================================================================
// EXPORTAR PARA REFERENCIA
// ============================================================================

export {
    example1_basicSetup,
    example2_playerFlow,
    example3_stateListeners,
    example4_stats,
};
