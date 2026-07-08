/**
 * @fileoverview Presenter remote orchestrator.
 * Keeps socket flow and state transitions compact; UI and Wake Lock are modularized.
 */

import { socket } from './presenter-socket-config.js?v=20260708133604';
import { mostrarModalConfirmacion } from '../shared/modal.js?v=20260708133604';
import { createRemoteWakeLockController } from './presenter-remote-wake-lock.js?v=20260708133604';
import {
    applyRemoteCSS,
    renderLoadingUI,
    renderControlPanel,
    renderError,
    setStatusBadge,
    setStateLabel,
    syncControlsVisibility,
    updatePrimaryButton,
    showEndedBanner
} from './presenter-remote-ui.js?v=20260708133604';
import {
    renderCommentPanel,
    refreshCommentScores,
    hideCommentPanel,
    setRemotePointsHandler
} from './presenter-remote-comment.js?v=20260708133604';

const ADMIN_TOKEN_KEY = 'adminToken';

const state = {
    sessionId: null,
    pin: null,
    gameType: null,
    isLobby: false,
    isReveal: false,
    isFinal: false,
    isCommentSlide: false,
    scores: {},
    teamConfig: null
};

const timerState = {
    interval: null,
    seconds: 0,
    paused: false
};

const wakeLockController = createRemoteWakeLockController({
    hasActiveSessionContext: () => Boolean(state.sessionId || state.pin || sessionStorage.getItem('xiro_remote_pin'))
});

/** Initializes remote mode and starts socket handshake. */
export function initRemoteControlMode(pin) {
    state.pin = String(pin);
    sessionStorage.setItem('xiro_remote_pin', state.pin);

    applyRemoteCSS();
    renderLoadingUI(pin);
    wakeLockController.setup();
    wakeLockController.activate('remote-mode-init');

    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    const adminSessionStr = localStorage.getItem('adminSession');
    let hasSession = false;
    if (adminSessionStr) {
        try {
            const parsed = JSON.parse(adminSessionStr);
            if (parsed.expires && parsed.expires > Date.now()) {
                hasSession = true;
            }
        } catch (_) {}
    }

    if (!token && !hasSession) {
        renderError(_t('presenter.remote.no_admin_session', null, 'No se encontró sesión de administrador.<br>Inicia sesión en el panel de admin primero.'));
        return;
    }

    bindSocketEvents();
    socket.connected ? joinRemote(pin, token) : socket.once('connect', () => joinRemote(pin, token));
}

/** Binds all socket listeners used by remote mode. */
function bindSocketEvents() {
    socket.off('remote-join-success', handleJoinSuccess);
    socket.off('game-ended', handleRemoteGameEnded);
    socket.off('reveal-answer', handleRemoteRevealEvent);
    socket.off('game-started', handleRemoteGameStarted);
    socket.off('new-question', handleRemoteNewQuestion);
    socket.off('timer-paused', handleRemoteTimerPaused);
    socket.off('timer-resumed', handleRemoteTimerResumed);
    socket.off('ranking-update', handleRemoteRankingUpdate);

    socket.on('remote-join-success', handleJoinSuccess);
    socket.on('remote-join-failed', (d) => renderError(d.message || _t('presenter.remote.connect_error', null, 'Error al conectar como control remoto')));
    socket.on('game-over', () => showEndedBanner(_t('presenter.remote.game_finished', null, 'La partida ha finalizado')));
    socket.on('game-ended', handleRemoteGameEnded);
    socket.on('reveal-answer', handleRemoteRevealEvent);
    socket.on('game-started', handleRemoteGameStarted);
    socket.on('new-question', handleRemoteNewQuestion);
    socket.on('timer-paused', handleRemoteTimerPaused);
    socket.on('timer-resumed', handleRemoteTimerResumed);
    socket.on('ranking-update', handleRemoteRankingUpdate);
    socket.on('disconnect', () => setStatusBadge(false));
    socket.on('connect', () => {
        setStatusBadge(true);
        const savedPin = sessionStorage.getItem('xiro_remote_pin');
        const savedToken = localStorage.getItem(ADMIN_TOKEN_KEY);
        if (savedPin && savedToken) joinRemote(savedPin, savedToken);
    });
}

/** Emits remote join handshake to backend. */
function joinRemote(pin, token) {
    socket.emit('join-remote-presenter', { pin: String(pin), token });
}

/** Applies initial snapshot from backend and paints remote controls. */
function handleJoinSuccess(data) {
    state.sessionId = data.sessionId;
    state.pin = data.pin || data.sessionId;
    state.gameType = data.gameType || null;
    state.isLobby = data.state === 'lobby';
    state.isReveal = !state.isLobby && data.canAnswer === false;
    state.isFinal = false;
    state.scores = data.scores || {};
    state.teamConfig = data.teamConfig || null;

    sessionStorage.setItem('xiro_remote_sessionId', data.sessionId);
    sessionStorage.setItem('xiro_remote_pin', state.pin);

    renderControlPanel(data, {
        onPrimary: remotePrimaryAction,
        onReveal: remoteReveal,
        onEnd: remoteEnd,
        onConclude: remoteConclude,
        onTimer: remoteToggleTimer
    });

    // Registrar callback de asignacion de puntos para el panel de comentarios remoto.
    setRemotePointsHandler((nameOrTeam, points, isTeam) => {
        if (!state.sessionId) return;
        if (isTeam) {
            const team = state.teamConfig?.teams?.find(t => t.name === nameOrTeam);
            if (!team) return;
            socket.emit('manual-points', { sessionId: state.sessionId, nicknames: team.players, points });
        } else {
            socket.emit('manual-points', { sessionId: state.sessionId, nickname: nameOrTeam, points });
        }
    });

    syncUI();
}

/** Handles primary action: Start in lobby, Continue after reveal. */
function remotePrimaryAction() {
    if (!state.sessionId || state.isFinal) return;
    wakeLockController.activateFromGesture('primary-btn');

    if (state.isLobby) {
        if (state.gameType === 'trivial') socket.emit('trivial-start', { roomId: state.sessionId });
        else socket.emit('start-game', state.sessionId);

        state.isLobby = false;
        state.isReveal = false;
        setStateLabel(_t('presenter.remote.game_started', null, 'Partida iniciada'));
        syncUI();
        return;
    }

    if (!state.isReveal) return;
    socket.emit('next-question', state.sessionId);
    state.isReveal = false;
    syncUI();
}

/** Reveals current question answer from remote. */
function remoteReveal() {
    if (!state.sessionId || state.isLobby || state.isFinal) return;
    wakeLockController.activateFromGesture('reveal-btn');
    socket.emit('reveal-answer', state.sessionId);
    state.isReveal = true;
    syncUI();
}

/** Opens confirmation modal and emits end-game on confirm. */
function remoteEnd(event) {
    if (!state.sessionId || state.isFinal) return;
    wakeLockController.activateFromGesture('end-btn');

    // Evita que el mismo tap/click que abre el modal lo cierre al instante
    // en navegadores móviles con click sintético tardío.
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    setTimeout(() => {
        mostrarModalConfirmacion(
            _t('presenter.remote.end_game', null, 'Terminar partida'),
            _t('presenter.remote.end_confirm', null, '¿Quieres terminar la partida ahora?'),
            () => socket.emit('end-game', { roomIdOrPin: state.sessionId, reason: 'manual' }),
            null,
            _t('presenter.remote.btn_end', null, 'Terminar'),
            _t('presenter.remote.cancel', null, 'Cancelar'),
            'warning'
        );
    }, 120);
}

/** Concludes session after podium, mirroring presenter main flow. */
function remoteConclude() {
    if (!state.sessionId) return;
    socket.emit('abandon-game', { roomIdOrPin: state.sessionId, reason: 'concluded' });
    location.href = '/admin.html';
}

// ── Timer handlers ─────────────────────────────────────────────────────────

const SLIDE_TYPES = new Set(['info', 'comment', 'text', 'image', 'text-image']);

/** Starts the visual countdown when a new question is received. */
function handleRemoteNewQuestion(data) {
    if (state.isFinal) return;
    const question = data.question || data;

    hideCommentPanel();
    state.isCommentSlide = false;

    if (question.slide_type === 'comment') {
        state.isCommentSlide = true;
        state.isReveal = true;
        renderCommentPanel(question.comment_text, state.scores, state.teamConfig);
        syncUI();
        return;
    }

    const isSlide = SLIDE_TYPES.has(question.slide_type);

    if (isSlide) {
        // Slides without answer phase: skip timer, show Continue directly
        clearInterval(timerState.interval);
        timerState.interval = null;
        const bar = document.getElementById('remote-timer-bar');
        if (bar) bar.style.display = 'none';
        state.isReveal = true;
    } else {
        state.isReveal = false;
        const timeLimit = question.time_limit || 20;
        startRemoteTimer(timeLimit);
    }
    syncUI();
}

/** Updates timer display and marks paused state. */
function handleRemoteTimerPaused(data) {
    timerState.paused = true;
    timerState.seconds = Math.ceil(data.remainingTime);
    updateRemoteTimerUI();
}

/** Resumes countdown from server-authoritative remaining time. */
function handleRemoteTimerResumed(data) {
    timerState.paused = false;
    timerState.seconds = Math.ceil(data.remainingTime);
    updateRemoteTimerUI();
}

/** Emits pause-timer or resume-timer, mirroring togglePauseTimer() in presenter. */
function remoteToggleTimer() {
    if (!state.sessionId || state.isLobby || state.isFinal) return;
    wakeLockController.activateFromGesture('timer-btn');
    if (timerState.paused) {
        socket.emit('resume-timer', state.sessionId);
    } else {
        socket.emit('pause-timer', state.sessionId);
    }
}

/** Starts the local countdown interval for the remote timer widget. */
function startRemoteTimer(seconds) {
    clearInterval(timerState.interval);
    timerState.seconds = seconds;
    timerState.paused = false;

    const bar = document.getElementById('remote-timer-bar');
    if (bar) bar.style.display = '';

    updateRemoteTimerUI();

    timerState.interval = setInterval(() => {
        if (timerState.paused) return;
        timerState.seconds--;
        if (timerState.seconds <= 0) {
            timerState.seconds = 0;
            clearInterval(timerState.interval);
        }
        updateRemoteTimerUI();
    }, 1000);
}

/** Updates the timer DOM element to reflect current timerState. */
function updateRemoteTimerUI() {
    const ring = document.getElementById('remote-timer');
    const value = document.getElementById('remote-timer-value');
    const hint = document.getElementById('remote-timer-hint');
    if (!ring || !value) return;

    value.textContent = _t(timerState.seconds);

    if (timerState.paused) {
        ring.classList.add('paused');
        if (hint) hint.textContent = _t('presenter.remote.tap_resume', null, 'Toca para reanudar');
    } else {
        ring.classList.remove('paused');
        if (hint) hint.textContent = _t('presenter.remote.tap_pause', null, 'Toca para pausar');
    }

    // Color rojo en los últimos 5 segundos, igual que el presentador
    if (timerState.seconds <= 5 && timerState.seconds > 0 && !timerState.paused) {
        ring.classList.add('urgent');
    } else {
        ring.classList.remove('urgent');
    }
}

/** Marks reveal phase when reveal-answer is received. */
function handleRemoteRevealEvent() {
    if (state.isLobby || state.isFinal) return;
    // Parar el timer local — la respuesta ya se reveló (todos contestaron o tiempo agotado)
    clearInterval(timerState.interval);
    timerState.interval = null;
    const bar = document.getElementById('remote-timer-bar');
    if (bar) bar.style.display = 'none';
    state.isReveal = true;
    syncUI();
}

/** Resets UI to in-game phase when game starts/restarts. */
function handleRemoteGameStarted(data) {
    state.isLobby = false;
    state.isReveal = false;
    state.isFinal = false;
    setStateLabel(_t('presenter.remote.game_started', null, 'Partida iniciada'));
    syncUI();

    // La primera pregunta llega en game-started, no en new-question
    const firstQuestion = data && (data.firstQuestion || data.question);
    if (firstQuestion && firstQuestion.time_limit) {
        startRemoteTimer(firstQuestion.time_limit);
    }
}

/** Updates local scores from server ranking-update (fires during comment slides). */
function handleRemoteRankingUpdate(data) {
    if (!data.ranking) return;
    data.ranking.forEach(r => { state.scores[r.nickname] = r.score; });
    if (state.isCommentSlide) {
        refreshCommentScores(data.ranking, state.teamConfig);
    }
}

/** Switches remote controls to final podium mode. */
function handleRemoteGameEnded() {
    state.isFinal = true;
    state.isLobby = false;
    state.isReveal = false;
    setStateLabel(_t('presenter.remote.final_podium', null, 'Podio final'));
    syncUI();
    showEndedBanner(_t('presenter.remote.game_finished', null, 'La partida ha finalizado'));
}

/** Synchronizes button visibility and main-label/icon according to phase. */
function syncUI() {
    syncControlsVisibility({
        isLobbyState: state.isLobby,
        isRevealPhase: state.isReveal,
        isFinalState: state.isFinal,
        isCommentSlide: state.isCommentSlide
    });
    updatePrimaryButton({ isLobbyState: state.isLobby, isRevealPhase: state.isReveal });
}
