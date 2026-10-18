/**
 * @fileoverview Puente entre la partida del presentador y la música: escucha los
 * mensajes del socket (lobby, intro, preguntas, pausas, revelación, Trivial, podio) y
 * se los pasa al controlador de la música. Solo si el administrador tiene activada
 * «Música de la partida». El audio se desbloquea con el primer gesto en la página.
 *
 * Expone window.XiroPresenterMusic para el menú (pausa), el temporizador (bip.wav solo
 * sin música) y el podio (la música marca el 3º, 2º y 1º).
 */

import { getSocket } from './presenter-socket-config.js?v=20260922172926';
import { getSessionId, getPlayersData, getConnectedPlayers } from './presenter-state.js?v=20260922172926';
import { createMusicController } from '../audio/music-controller.js?v=20260922172926';
import { normalizeMusicSettings } from '../audio/music-apply-settings.js?v=20260922172926';
import { bindMusicControls } from './presenter-music-controls.js?v=20260922172926';

const SLIDE_TYPES = new Set(['comment', 'info', 'text', 'image', 'text-image', 'video']);
const DEFAULT_TIME_LIMIT_S = 20;

/** Ajustes de interfaz: «Música de la partida» y los de la pestaña «Música» del admin. */
async function loadUiSettings() {
    try {
        const res = await fetch('/api/ui-settings');
        return res.ok ? await res.json() : {};
    } catch {
        return {};
    }
}

/** Respondidos y total de jugadores (los manejadores del juego ya han marcado la respuesta). */
function answerCount() {
    const players = Object.values(getPlayersData());
    return { answered: players.filter((p) => p.answered).length, total: players.length };
}

function bindSocket(socket, music) {
    // Se registra después de los manejadores del juego: la pregunta ya está pintada
    // (así se sabe si trae audio propio, y entonces la música calla)
    const onQuestion = (q, data) => {
        if (!q) return;
        if (SLIDE_TYPES.has(q.slide_type)) {
            // El vídeo trae su propio sonido: la música calla mientras se ve
            music.slide({ hasAudio: q.slide_type === 'video' });
            return;
        }
        music.question({
            durationMs: (q.time_limit || DEFAULT_TIME_LIMIT_S) * 1000,
            startedAt: data.questionStartedAt || data.startedAt,
            serverNow: data.serverNow,
            hasAudio: Boolean(document.getElementById('question-audio')),
            index: data.currentIndex,
            total: data.totalQuestions
        });
    };
    const onAnswers = () => {
        const { answered, total } = answerCount();
        music.answered(answered, total);
    };
    socket.on('answer-result', onAnswers);
    socket.on('answer-result-batch', onAnswers);
    socket.on('player-joined', () => music.playerJoined(getConnectedPlayers().length));
    socket.on('trivial-dice-rolled', () => music.dice());
    socket.on('join-success', () => {
        music.lobby();
        music.preload();
    });
    socket.on('game-intro', () => music.intro());
    // Con puntuación aleatoria, su pantalla da tiempo a la transición hacia la pregunta
    socket.on('random-points-reveal', () => music.preQuestion());
    socket.on('game-started', (data) => onQuestion(data.firstQuestion, data));
    socket.on('new-question', (data) => onQuestion(data.question, data));
    socket.on('timer-paused', (data) => music.timerPaused(data || {}));
    socket.on('timer-resumed', (data) => music.timerResumed(data || {}));
    socket.on('reveal-answer', () => music.reveal());
    socket.on('trivial-game-started', () => music.board());
    socket.on('game-ended', () => music.podium());
    socket.on('trivial-winner', () => music.podium());
    socket.on('game-abandoned', () => music.stop());
    socket.on('reconnected-success', (snapshot) => onReconnected(snapshot, music, onQuestion));
}

/** Al recargar en mitad de la partida: retomar la escena que toca. */
function onReconnected(snapshot, music, onQuestion) {
    const gs = snapshot && snapshot.gameState;
    if (!gs || !gs.isGameActive) {
        music.lobby();
        return;
    }
    if (gs.isTrivialBoardPhase || gs.isTrivial) music.board();
    const q = gs.currentQuestion;
    if (q && gs.canAnswer) onQuestion(q, gs);
    else if (!gs.isTrivialBoardPhase) music.slide(); // ya revelada o entre preguntas: fondo del marcador
}

/** Registro síncrono: escucha el socket desde ya; «Música de la partida» se consulta aparte. */
export function registerMusicBridge() {
    let enabled = null; // aún sin saber
    let music = null;
    const controls = bindMusicControls({
        paused: (on) => music.setPaused(on),
        volume: (v) => music.setVolume(v)
    });
    const uiSettings = loadUiSettings();
    music = createMusicController({
        seed: () => getSessionId() || String(Date.now()),
        settings: () => uiSettings.then((s) => s.musicSettings || null),
        volume: null, // el del admin, hasta que el presentador mueva el deslizador
        paused: controls.state.paused,
        onEngineEvent: (type, detail) => {
            if (type === 'podiumHit') document.dispatchEvent(new CustomEvent('xiro:podium-hit', { detail: { place: detail } }));
        }
    });
    window.XiroPresenterMusic = {
        togglePause: () => controls.togglePause(),
        isPlaying: () => enabled !== false && music.isPlaying(),
        drivesPodium: () => enabled !== false && music.drivesPodium()
    };
    // Safari solo deja sonar audio tras un gesto: cualquier toque o tecla vale
    const unlock = () => {
        if (enabled !== false) music.unlock();
    };
    document.addEventListener('pointerdown', unlock, { capture: true });
    document.addEventListener('keydown', unlock, { capture: true });
    bindSocket(getSocket(), music);
    void uiSettings.then((s) => {
        enabled = s.musicaPartida !== false;
        if (enabled) {
            controls.syncVolume(normalizeMusicSettings(s.musicSettings).volume);
            controls.show();
        } else {
            music.stop();
            music.setPaused(true);
        }
    });
}
