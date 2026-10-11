/**
 * @fileoverview MusicEngine: único dueño de Tone.js. API declarativa (setScene,
 * setTension, triggerReveal…); el resto de la app nunca toca Tone directamente.
 *
 * Se carga bajo demanda desde music-loader.js. Los scripts clásicos (Tone,
 * funciones puras) se importan por efecto lateral y EN ESTE ORDEN: cada uno
 * lee de self.XiroMusic lo que dejaron los anteriores.
 */

import '../../vendor/tone/tone-15.1.22.min.js?v=20260922172926';
import './music-prng.js?v=20260922172926';
import './music-theory.js?v=20260922172926';
import './music-tension.js?v=20260922172926';
import './music-arrangement.js?v=20260922172926';
import './music-loops.js?v=20260922172926';
import './music-melody.js?v=20260922172926';
import './music-groove.js?v=20260922172926';
import './music-parts.js?v=20260922172926';
import './music-scores.js?v=20260922172926';
import './music-stingers.js?v=20260922172926';
import './music-reveal-cadence.js?v=20260922172926';
import './music-sample-map.js?v=20260922172926';
import { createMixer } from './music-mixer.js?v=20260922172926';
import { watchClock } from './music-clock.js?v=20260922172926';
import { createCues } from './music-cues.js?v=20260922172926';
import { DEFAULT_OPTIONS } from './music-scene-registry.js?v=20260922172926';
import { createSceneDirector } from './music-scene-director.js?v=20260922172926';
import { createOneShotPlayer } from './music-oneshot.js?v=20260922172926';
import { createMoments } from './music-moments.js?v=20260922172926';
import { trace } from './music-trace.js?v=20260922172926';
import { engineStatus } from './music-engine-status.js?v=20260922172926';
import { resolveSounds, loadInitialSounds, switchSounds } from './music-sound-sets.js?v=20260922172926';

const { prng, tension, arrangement, settings: musicSettings } = self.XiroMusic;

const TENSION_RAMP_SECONDS = 0.4;
const GATE_OUT_SECONDS = 1;    // pausa: fundido de 1 s
const GATE_IN_SECONDS = 0.4;   // reanudar: fundido corto que empieza en el siguiente compás
const TENSION_TEMPO_SECONDS = 1.5;
// Paso del tempo de tensión: rampas de bpm casi planas descuadran el reloj de Tone
// (TickParam.getTimeOfTick da tiempos absurdos y Safari se cuelga)
const TENSION_TEMPO_STEP = 0.5;

export class MusicEngine {
    constructor(Tone, options = {}) {
        this.Tone = Tone;
        this.transport = Tone.getTransport();
        this.transport.PPQ = 192; // las partituras cuentan en ticks de 192 por negra
        this.tempoScale = musicSettings.tempoScale({ tempo: options.tempo });
        this.transport.bpm.value = musicSettings.TEMPO.base * this.tempoScale;
        this.mixer = createMixer(Tone);
        this.cues = createCues(Tone, this.mixer.cues, tension);
        this.oneShot = createOneShotPlayer(Tone, this.mixer);
        this.options = Object.assign({}, DEFAULT_OPTIONS, options.features);
        this.seed = String(options.seed || prng.randomSeed());
        this.tension = 0;
        this.revealing = false;
        this.paused = false;
        this.silenced = false;
        this.listeners = new Set();
        this.bank = null;
        this.sounds = resolveSounds(options.sounds);
        this.director = createSceneDirector(Tone, this.mixer, {
            seed: () => this.seed,
            options: () => this.options,
            tension: () => this.tension,
            tempoScale: () => this.tempoScale,
            bank: () => this.bank,
            emit: (type, detail) => this.emit(type, detail)
        });
        this.moments = createMoments(Tone, { player: this.oneShot, director: this.director, emit: (t, d) => this.emit(t, d) });
        // Las muestras cargan en segundo plano; sin ellas, todo sintetizado
        this.ready = loadInitialSounds(this);
        watchClock(Tone, () => this.emit('warn', 'Reloj en Worker bloqueado (¿CSP worker-src?): se usa setTimeout'));
    }

    /**
     * Suscripción a avisos del motor: fn(type, detail). Tipos: scene, section, reveal,
     * revealDone, podiumHit (puesto, en el instante del golpe), podiumEnd, warn.
     */
    on(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emit(type, detail) {
        this.listeners.forEach((fn) => fn(type, detail));
    }

    get sceneName() {
        return this.director.state.name;
    }

    /** Cambia de escena en el siguiente compás, con crossfade de capas. */
    setScene(name, { force = false } = {}) {
        if (this.revealing && name !== 'idle') this.cancelReveal();
        const next = this.director.setScene(name, force);
        this.tempoTarget = null;
        if (next && next.isQuestion) this.applyTension(next);
        if (name !== 'question') this.cues.cancel();
    }

    /**
     * Activa o desactiva una mejora (sections, humanize, fx, motif). Los efectos
     * cambian al momento; el resto regenera la escena en el próximo compás.
     */
    setOption(name, value) {
        if (!(name in this.options)) return;
        this.options[name] = Boolean(value);
        if (name === 'cadence') return; // solo cuenta en la próxima revelación
        if (name === 'fx') {
            this.mixer.setFx(this.options.fx);
            this.director.live().forEach((scene) => scene.setFx(this.options.fx));
            return;
        }
        if (this.sceneName !== 'idle') this.setScene(this.sceneName, { force: true });
    }

    /**
     * Juego de sonidos ({ brass, melody, bass, drums, reverb }): las muestras se descargan y
     * entran en el compás siguiente; la reverb cambia al momento. Devuelve una promesa.
     */
    setSounds(sounds) {
        return switchSounds(this, sounds);
    }

    /**
     * Tempo base en bpm (las partituras van a 112): regenera la escena actual, que entra
     * en el siguiente compás y lleva el tempo a su sitio con una rampa.
     */
    setTempo(bpm) {
        this.tempoScale = musicSettings.tempoScale({ tempo: bpm });
        this.tempoTarget = null;
        if (this.sceneName !== 'idle') this.setScene(this.sceneName, { force: true });
    }

    /** Re-genera la escena actual con otra semilla (entra en el siguiente compás). */
    setSeed(seed) {
        this.seed = String(seed);
        if (this.sceneName !== 'idle') this.setScene(this.sceneName, { force: true });
    }

    /**
     * Tensión 0..1 de la pregunta: capas, filtro y tempo con rampas suaves al momento;
     * el estilo de batería, bajo y armonía cambia en el compás siguiente.
     */
    setTension(value) {
        this.tension = Math.max(0, Math.min(1, Number(value) || 0));
        if (this.sceneName !== 'question' || this.revealing) return;
        this.director.live().forEach((scene) => {
            if (scene.isQuestion) this.applyTension(scene);
        });
    }

    applyTension(scene) {
        const params = tension.tensionParams(this.tension);
        const now = this.Tone.now();
        Object.keys(params.layers).forEach((name) => scene.setLayerLevel(name, params.layers[name], now, TENSION_RAMP_SECONDS));
        scene.setFilter(params.filterHz, now, TENSION_RAMP_SECONDS);
        const bpm = Math.round(scene.bpm * params.tempoFactor / TENSION_TEMPO_STEP) * TENSION_TEMPO_STEP;
        if (bpm !== this.tempoTarget) {
            this.tempoTarget = bpm;
            this.transport.bpm.rampTo(bpm, TENSION_TEMPO_SECONDS);
        }
        if (!this.lastTensionParams) trace('  tensión aplicada');
        this.lastTensionParams = params;
    }

    /** Avisos de fin de tiempo (subida y tic-tac) para lo que queda de pregunta. */
    startQuestionClock(remainingMs) {
        this.cues.start(remainingMs);
    }

    stopQuestionClock() {
        this.cues.cancel();
    }

    /**
     * Revelación: fill desde el siguiente tiempo y golpe en el medio compás. Con la
     * opción `cadence`, la pregunta se aparta al empezar el fill y la cadencia sigue con
     * su acorde, su filtro y su tensión (music-moments.js); si además se da `next`
     * ('leaderboard' o 'board'), esa escena entra en el golpe y la música no se corta.
     * Sin cadencia, corte seco y stinger. Emite 'revealDone' un compás antes de que
     * acabe el stinger (con la cadencia, en el golpe).
     */
    triggerReveal(next = null) {
        if (this.revealing || this.transport.state !== 'started') return;
        this.revealing = true;
        this.cues.cancel();
        const q = this.moments.reveal({
            next,
            key: arrangement.baseKey(this.seed),
            bank: this.bank,
            cadence: this.options.cadence,
            tension: this.tension,
            filterHz: tension.tensionParams(this.tension).filterHz,
            onHit: (time) => {
                if (!q.continues) this.director.cut(time, 'reveal');
                this.emit('reveal');
            },
            // Fuera del callback de audio: quien escuche puede cambiar de escena sin
            // programar nada desde dentro del reloj
            onDone: () => setTimeout(() => {
                this.revealing = false;
                this.emit('revealDone');
            }, 0)
        });
    }

    cancelReveal() {
        this.moments.cancel();
        this.revealing = false;
    }

    /**
     * Podio: redoble y 3º, 2º y 1º a negras en los grados 1-3-4 de la tonalidad
     * ('podiumHit' con el puesto, en el instante de cada nota); luego el final (tema A,
     * en la misma tonalidad) y la salida ('podiumEnd'). Si no sonaba el podio, lo pone.
     */
    triggerPodium() {
        if (this.sceneName === 'podiumFinale') return;
        if (this.sceneName !== 'podium') this.setScene('podium');
        this.moments.podium({ key: arrangement.baseKey(this.seed), bank: this.bank });
    }

    /** Pausa del presentador: fundido de 1 s. Al reanudar, fundido corto en el siguiente compás. */
    setPaused(paused) {
        this.paused = Boolean(paused);
        this.updateGate();
    }

    /** Silencio mientras suena el audio propio de una pregunta (la música sigue el juego por debajo). */
    setSilenced(silenced) {
        this.silenced = Boolean(silenced);
        this.updateGate();
    }

    updateGate() {
        const open = !this.paused && !this.silenced;
        const started = this.transport.state === 'started';
        const at = open && started ? this.transport.nextSubdivision('1m') : this.Tone.now();
        this.mixer.setGate(open, at, open ? GATE_IN_SECONDS : GATE_OUT_SECONDS);
    }

    setVolume(value) {
        this.mixer.setVolume(value);
    }

    mute(muted = true) {
        this.mixer.setMuted(muted);
    }

    /** Mezcla (volumen y mute por capa, onda), avisos (tic-tac) y tempo: solo para el panel. */
    get debug() {
        return { mixer: this.mixer, cues: this.cues, setBpm: (bpm) => this.transport.bpm.rampTo(Number(bpm), 1) };
    }

    getStatus() {
        return engineStatus(this);
    }

    dispose() {
        this.director.dispose();
        this.transport.stop();
        this.transport.cancel(0);
        [this.oneShot, this.cues, this.mixer].forEach((part) => part.dispose());
        if (this.bank) this.bank.dispose();
        this.listeners.clear();
    }
}

let contextBound = null;

/** Crea el motor sobre el AudioContext desbloqueado por music-loader.js. */
export function createMusicEngine(audioContext, options) {
    const Tone = self.Tone;
    if (audioContext && contextBound !== audioContext) {
        Tone.setContext(audioContext);
        contextBound = audioContext;
    }
    return new MusicEngine(Tone, options);
}
