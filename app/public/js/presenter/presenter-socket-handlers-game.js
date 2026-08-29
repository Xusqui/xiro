/**
 * @fileoverview Socket handlers del presentador - Parte 2
 * Manejo de juego, respuestas, timer y fin de partida
 */

import { getSocket } from './presenter-socket-config.js?v=20260829210149';
import {
    setTotalQuestions, setCurrentQuestionIndex,
    getPlayersData, setPlayerData, updatePlayerData, getSessionId, getTeamConfig,
    setGameSessionDbId, setConnectedPlayers, setTotalPlayers
} from './presenter-state.js?v=20260829210149';
import {
    renderPregunta, renderCommentSlide, renderInfoSlide, renderTextSlide, renderImageSlide, renderTextImageSlide,
    updatePlayersPanel, removeFloatingCards, renderPodio
} from './presenter-game-ui.js?v=20260829210149';
import { handleRevealAnswer, cleanupRevealElements } from './presenter-reveal.js?v=20260829210149';
import { updateAnswerCounter } from './presenter-answer-counter.js?v=20260829210149';
import { hideWaitingPanelNow, renderWaitingPanel } from './presenter-waiting-panel.js?v=20260829210149';
import { mostrarModalMensaje } from '../shared/modal.js?v=20260829210149';

/**
 * Registrar manejadores de socket para el juego
 */
export function registerGameSocketHandlers() {
    const socket = getSocket();

    // Error al iniciar juego
    socket.on('game-start-error', (data) => {
        console.error('❌ Error al iniciar juego:', data);
        mostrarModalMensaje(_t('presenter.session.start_error_title', null, 'Error al iniciar el juego'), data.message, 'error');
    });

    // Juego iniciado
    socket.on('game-started', (data, ack) => {
        window.isTrivialGame = false;
        setTotalQuestions(data.totalQuestions);
        setCurrentQuestionIndex(data.currentIndex);

        // Resetear estado de respuestas
        const playersData = getPlayersData();
        const lobbyPlayers = Array.isArray(data.players) ? data.players.filter(nick => nick && nick !== 'HOST') : [];
        if (lobbyPlayers.length > 0) {
            setConnectedPlayers(lobbyPlayers);
            setTotalPlayers(lobbyPlayers.length);
            lobbyPlayers.forEach(nick => {
                if (!playersData[nick]) {
                    setPlayerData(nick, { score: 0, answered: false, correct: null });
                }
            });
        }
        Object.keys(playersData).forEach(nick => {
            playersData[nick].answered = false;
            playersData[nick].correct = null;
        });

        // Renderizar pregunta o slide
        if (data.firstQuestion.slide_type === 'comment') {
            renderCommentSlide(data.firstQuestion);
        } else if (data.firstQuestion.slide_type === 'info') {
            renderInfoSlide(data.firstQuestion);
        } else if (data.firstQuestion.slide_type === 'text') {
            renderTextSlide(data.firstQuestion);
        } else if (data.firstQuestion.slide_type === 'image') {
            renderImageSlide(data.firstQuestion);
        } else if (data.firstQuestion.slide_type === 'text-image') {
            renderTextImageSlide(data.firstQuestion);
        } else {
            window.canShowRanking = true;
            renderPregunta(data.firstQuestion);
        }

        updatePlayersPanel();

        if (typeof ack === 'function') ack();
    });

    // Nueva pregunta
    socket.on('new-question', (data, ack) => {
        // CRÍTICO: Deshabilitar ranking antes de eliminar tarjetas
        window.canShowRanking = false;

        removeFloatingCards();

        // CRÍTICO: Limpiar elementos de reveal (ranking y justificación)
        cleanupRevealElements();

        // Resetear estado de respuestas
        const playersData = getPlayersData();
        Object.keys(playersData).forEach(nick => {
            playersData[nick].answered = false;
            playersData[nick].correct = null;
        });
        updatePlayersPanel();

        setTotalQuestions(data.totalQuestions);
        setCurrentQuestionIndex(data.currentIndex);

        if (data.question.slide_type === 'comment') {
            renderCommentSlide(data.question);
        } else if (data.question.slide_type === 'info') {
            renderInfoSlide(data.question);
        } else if (data.question.slide_type === 'text') {
            renderTextSlide(data.question);
        } else if (data.question.slide_type === 'image') {
            renderImageSlide(data.question);
        } else if (data.question.slide_type === 'text-image') {
            renderTextImageSlide(data.question);
        } else {
            window.canShowRanking = true;
            renderPregunta(data.question);
        }

        if (typeof ack === 'function') ack();
    });

    // Respuesta individual
    socket.on('answer-result', (data) => {
        console.log('📩 answer-result recibido (individual):', data);
        const { nickname, isCorrect, points, totalScore, streakInfo } = data;

        const playersData = getPlayersData();
        if (playersData[nickname]) {
            playersData[nickname].answered = true;
            playersData[nickname].correct = isCorrect;
            if (typeof totalScore === 'number') {
                playersData[nickname].score = totalScore;
            }
            if (streakInfo) {
                playersData[nickname].streakInfo = streakInfo;
            }
            console.log('✅ playersData actualizado para', nickname, ':', playersData[nickname]);
            updatePlayersPanel();

            // Actualizar contador de respuestas
            updateAnswerCounter();
            renderWaitingPanel();
        } else {
            console.warn('⚠️  nickname no encontrado en playersData:', nickname);
        }
    });

    // Batch de respuestas
    socket.on('answer-result-batch', (raw) => {
        const data = raw._b64 ? JSON.parse(atob(raw.data)) : raw;
        console.log('📦 answer-result-batch recibido:', data);
        const playersData = getPlayersData();
        if (data.answers && Array.isArray(data.answers)) {
            data.answers.forEach(answer => {
                const { nickname, isCorrect, totalScore, streakInfo } = answer;
                if (playersData[nickname]) {
                    playersData[nickname].answered = true;
                    playersData[nickname].correct = isCorrect;
                    if (typeof totalScore === 'number') {
                        playersData[nickname].score = totalScore;
                    }
                    if (streakInfo) {
                        playersData[nickname].streakInfo = streakInfo;
                    }
                }
            });
            console.log('✅ playersData actualizado en batch, total:', data.answers.length);
            updatePlayersPanel();

            // Actualizar contador de respuestas
            updateAnswerCounter();
            renderWaitingPanel();
        }
    });

    // Actualización de ranking
    socket.on('ranking-update', (data) => {
        if (data.ranking) {
            data.ranking.forEach(player => {
                updatePlayerData(player.nickname, { score: player.score });
            });
            updatePlayersPanel();
        }
    });

    // Revelar respuesta
    socket.on('reveal-answer', (data) => {
        handleRevealAnswer(data);
    });

    // Pausar timer
    socket.on('timer-paused', (data) => {
        console.log('⏸️  Frontend: timer-paused recibido', data);
        window.timerPaused = true;
        window.currentSeconds = Math.ceil(data.remainingTime);

        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.classList.remove('border-purple-500');
            timerEl.classList.add('border-yellow-500', 'bg-yellow-500/20');
            timerEl.innerText = _t(window.currentSeconds);
        }

        console.log('✅ Frontend: Timer pausado - Tiempo restante:', window.currentSeconds);
    });

    // Reanudar timer
    socket.on('timer-resumed', (data) => {
        console.log('▶️  Frontend: timer-resumed recibido', data);
        window.timerPaused = false;
        window.currentSeconds = Math.ceil(data.remainingTime);

        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.classList.remove('border-yellow-500', 'bg-yellow-500/20');
            timerEl.classList.add('border-purple-500');
        }

        console.log('✅ Frontend: Timer reanudado - Tiempo restante:', window.currentSeconds);
    });

    // Fin de juego
    socket.on('game-ended', (ranking, ack) => {
        console.log('🎯 game-ended recibido. Ranking:', ranking);

        removeFloatingCards();

        // CRÍTICO: Limpiar elementos de reveal antes de mostrar podio
        cleanupRevealElements();

        // CRÍTICO: Limpiar datos de sesión para que al reabrir no intente reconectar
        localStorage.removeItem('xiro_presenter_sessionId');
        localStorage.removeItem('xiro_presenter_pin');
        sessionStorage.removeItem('xiro_presenter_sessionId');
        sessionStorage.removeItem('xiro_presenter_pin');

        // Limpiar URL — quitar parámetro ?session=... para evitar reconexión
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('session');
        window.history.replaceState({}, '', cleanUrl);

        console.log('🧹 Sesión limpiada tras fin de juego');

        renderPodio(ranking);

        if (typeof ack === 'function') ack();
    });

    // Resultados persistidos en BD — actualizar botón de descarga con el ID real
    socket.on('results-ready', ({ sessionId: dbId }) => {
        setGameSessionDbId(dbId);
        const btn = document.getElementById('csv-download-btn');
        if (btn) {
            btn.href = `/api/results/session/${dbId}/export.csv`;
            btn.setAttribute('download', '');
            btn.removeAttribute('data-pending');
            btn.classList.remove('bg-gray-500', 'opacity-60', 'cursor-wait');
            btn.classList.add('bg-emerald-600', 'hover:bg-emerald-500');
            btn.innerHTML = _tHtml('<i class="fas fa-download mr-2"></i>Descargar resultados CSV');
        }
    });
}

/**
 * Siguiente pregunta
 */
export function nextQuestionClick() {
    const socket = getSocket();
    const sessionId = getSessionId();

    console.log('👆 Click en siguiente pregunta', { sessionId, hasSocket: !!socket });

    if (!sessionId) {
        console.error('❌ sessionId is null/undefined - cannot emit next-question');
        return;
    }

    if (!socket || !socket.connected) {
        console.error('❌ Socket not connected - cannot emit next-question');
        return;
    }

    console.log('📤 Emitiendo next-question:', sessionId);
    hideWaitingPanelNow();
    removeFloatingCards();
    socket.emit('next-question', sessionId);
}

/**
 * Pausar/reanudar timer
 */
export function togglePauseTimer() {
    console.log('🖱️  togglePauseTimer clicked');
    const socket = getSocket();
    const sessionId = getSessionId();

    console.log('📊 Estado actual:', {
        sessionId,
        timerPaused: window.timerPaused,
        socketConnected: socket?.connected
    });

    if (!sessionId) {
        console.error('❌ No hay sessionId, no se puede pausar/reanudar timer');
        return;
    }

    if (window.timerPaused) {
        console.log('▶️  Emitiendo resume-timer');
        socket.emit('resume-timer', sessionId);
    } else {
        console.log('⏸️  Emitiendo pause-timer');
        socket.emit('pause-timer', sessionId);
    }
}

/**
 * Revelar respuesta manualmente
 */
export function revealAnswerClick() {
    const socket = getSocket();
    const sessionId = getSessionId();

    if (!sessionId) {
        console.error('❌ No hay sessionId, no se puede revelar respuesta');
        return;
    }

    if (!socket || !socket.connected) {
        console.error('❌ Socket no conectado, no se puede revelar respuesta');
        return;
    }

    console.log('📤 Emitiendo reveal-answer manual:', sessionId);
    socket.emit('reveal-answer', sessionId);
}

/**
 * Asignar puntos manuales (para slides de comentario)
 */
export function assignManualPoints(nameOrTeam, points, isTeam = false) {
    const socket = getSocket();
    const sessionId = getSessionId();
    const teamConfig = getTeamConfig();
    const playersData = getPlayersData();

    if (isTeam && teamConfig && teamConfig.teams) {
        const team = teamConfig.teams.find(t => t.name === nameOrTeam);
        if (team && team.players.length > 0) {
            socket.emit('manual-points', {
                sessionId,
                nicknames: team.players,
                points
            });

            team.players.forEach(playerNick => {
                updatePlayerData(playerNick, { score: (playersData[playerNick]?.score || 0) + points });
            });

            updatePlayersPanel();
            renderCommentSlide({ comment_text: document.querySelector('h1').textContent });
        }
    } else {
        socket.emit('manual-points', { sessionId, nickname: nameOrTeam, points });

        updatePlayerData(nameOrTeam, { score: (playersData[nameOrTeam]?.score || 0) + points });
        updatePlayersPanel();
        renderCommentSlide({ comment_text: document.querySelector('h1').textContent });
    }
}
