/**
 * @fileoverview Escena musical por SECCIONES: cada 8 compases entra la sección
 * siguiente que da el generador (`source.build(index)`), con sus propias capas y
 * niveles. Las secciones se calculan dos por delante y fuera de los callbacks de
 * audio (setTimeout); las ya sonadas se liberan.
 *
 * Cadena por capa: instrumento → nivel del arreglo → fundido de la escena → mezcla.
 * Los callbacks de Tone.Part solo disparan notas ya calculadas: no crean objetos.
 */

import { LAYERS } from './music-mixer.js?v=20260922172926';
import { createInstruments } from './music-instruments.js?v=20260922172926';
import { createDrumKit } from './music-drums.js?v=20260922172926';
import { trace } from './music-trace.js?v=20260922172926';

const DEFAULT_SECTION_BARS = 8;
const DEFAULT_LOOKAHEAD = 2;
const OPEN_FILTER_HZ = 18000;
// Capas que pasan por el filtro de tensión (se abre al subir la tensión): en la pregunta, el
// piano suena apagado con poca tensión y se abre con ella
const FILTERED = new Set(['pad', 'piano', 'arp']);
const LAYER_UP_SECONDS = 0.06;
const LAYER_DOWN_SECONDS = 0.5;

/** Rampa lineal desde el valor que tenga el parámetro en `time`. */
function rampParam(param, target, time, seconds) {
    param.cancelAndHoldAtTime(time);
    param.linearRampToValueAtTime(target, time + seconds);
}

/**
 * @param {object} Tone
 * @param {object} mixer  createMixer()
 * @param {{ bpm: number, swing: number, build: (index: number) => object,
 *           sectionBars?: number, lookahead?: number, levelsFromPlan?: boolean }} source
 *        sectionBars/lookahead: compases por sección y secciones preparadas por delante
 *        (la pregunta va de compás en compás para seguir la tensión); levelsFromPlan:
 *        false si los niveles de capa los lleva la tensión y no el arreglo.
 * @param {object|null} bank  Banco de muestras (o null: todo sintetizado)
 */
export function createScene(Tone, mixer, source, bank) {
    const transport = Tone.getTransport();
    const sectionTicks = transport.PPQ * 4 * (source.sectionBars || DEFAULT_SECTION_BARS);
    const lookahead = source.lookahead || DEFAULT_LOOKAHEAD;
    const levelsFromPlan = source.levelsFromPlan !== false;
    const arrange = {};
    const fade = {};
    const filters = {};
    LAYERS.forEach(name => {
        fade[name] = new Tone.Gain(0).connect(mixer.layers[name]);
        let into = fade[name];
        if (FILTERED.has(name)) {
            filters[name] = new Tone.Filter({ frequency: OPEN_FILTER_HZ, type: 'lowpass', rolloff: -12 }).connect(
                fade[name]
            );
            into = filters[name];
        }
        arrange[name] = new Tone.Gain(0).connect(into);
    });
    const inst = createInstruments(Tone, arrange, bank);
    const kit = createDrumKit(Tone, arrange.drums, time => mixer.pumpAt(time), bank);

    // Metales: largos → sostenidos; cortos → golpe de trompeta + trombón una octava abajo
    const playBrass = (t, e) => {
        if (e.sus) {
            inst.brassSus.triggerAttackRelease(e.notes, e.dur, t, e.vel);
            return;
        }
        inst.brass.triggerAttackRelease(e.notes, e.dur, t, e.vel);
        if (e.low) inst.brassLow.triggerAttackRelease(e.low, e.dur, t, e.vel * 0.9);
    };
    // Tema: lead de metales; en los clímax, trompetas doblando a la octava
    const playMelody = (t, e) => {
        inst.lead.triggerAttackRelease(e.note, e.dur, t, e.vel);
        if (e.up) inst.trumpet.triggerAttackRelease(e.up, e.dur, t, e.vel * 0.85);
    };

    // Pista de la partitura → disparo (creados una vez)
    const PLAY = {
        pad: (t, e) => inst.pad.triggerAttackRelease(e.notes, e.dur, t, e.vel),
        brass: playBrass,
        bass: (t, e) => inst.bass.triggerAttackRelease(e.note, e.dur, t, e.vel),
        bells: (t, e) => inst.bells.triggerAttackRelease(e.note, e.dur, t, e.vel),
        piano: (t, e) => inst.piano.triggerAttackRelease(e.notes, e.dur, t, e.vel),
        melody: playMelody,
        kick: (t, e) => kit.kick(t, e.vel),
        snare: (t, e) => kit.snare(t, e.vel),
        clap: (t, e) => kit.clap(t, e.vel),
        hatC: (t, e) => kit.hatC(t, e.vel),
        hatO: (t, e) => kit.hatO(t, e.vel),
        timp: (t, e) => kit.timp(e.note, t, e.vel),
        crash: (t, e) => kit.crash(t, e.vel)
    };
    const TRACKS = Object.keys(PLAY);

    const sections = new Map();
    let startTick = 0;
    let entered = 0;
    let repeatId = null;
    let current = null;
    let listener = null;
    let disposed = false;

    function prepare(index) {
        if (disposed || sections.has(index)) return;
        if (index < 3) trace(`  prepara sección ${index}`);
        const score = source.build(index);
        const at = `${startTick + index * sectionTicks}i`;
        const parts = [];
        TRACKS.forEach(track => {
            const events = score[track];
            if (!events || !events.length) return;
            parts.push(new Tone.Part(PLAY[track], events).start(at));
        });
        sections.set(index, { score, parts });
    }

    function release(index) {
        const section = sections.get(index);
        if (!section) return;
        section.parts.forEach(part => part.dispose());
        sections.delete(index);
    }

    function applyLevels(layers, time, instant) {
        LAYERS.forEach(name => {
            const target = layers[name] || 0;
            const goingUp = target > arrange[name].gain.getValueAtTime(time);
            rampParam(
                arrange[name].gain,
                target,
                time,
                instant ? 0.01 : goingUp ? LAYER_UP_SECONDS : LAYER_DOWN_SECONDS
            );
        });
    }

    function enterSection(time) {
        const index = entered++;
        const section = sections.get(index);
        if (section) {
            current = section.score;
            if (levelsFromPlan) applyLevels(current.plan.layers, time, index === 0);
            if (listener) listener(current.plan);
        }
        setTimeout(() => {
            for (let k = 1; k <= lookahead; k++) prepare(index + k);
            release(index - 2);
        }, 0);
    }

    return {
        bpm: source.bpm,
        /** Arranca en un tick del Transport (siempre a principio de compás). */
        start(tick) {
            startTick = tick;
            transport.swing = source.swing;
            transport.swingSubdivision = '16n';
            for (let k = 0; k < lookahead; k++) prepare(k);
            repeatId = transport.scheduleRepeat(enterSection, `${sectionTicks}i`, `${tick}i`);
        },
        fadeIn(time, seconds) {
            LAYERS.forEach(name => rampParam(fade[name].gain, 1, time, seconds));
        },
        fadeOut(time, seconds) {
            LAYERS.forEach(name => rampParam(fade[name].gain, 0, time, seconds));
        },
        /** Nivel 0..1 de una capa (lo usará la tensión de la pregunta). */
        setLayerLevel(name, level, time, seconds) {
            if (arrange[name]) rampParam(arrange[name].gain, level, time, seconds);
        },
        /** Frecuencia del filtro de tensión del pad y las campanas. */
        setFilter(hz, time, seconds) {
            Object.values(filters).forEach(f => {
                f.frequency.cancelAndHoldAtTime(time);
                f.frequency.exponentialRampToValueAtTime(hz, time + seconds);
            });
        },
        setFx(on) {
            inst.setFx(on);
        },
        onSection(fn) {
            listener = fn;
        },
        /** Plan y partitura de la sección que suena. */
        currentSection() {
            return current;
        },
        dispose() {
            disposed = true;
            if (repeatId !== null) transport.clear(repeatId);
            Array.from(sections.keys()).forEach(release);
            inst.dispose();
            kit.dispose();
            LAYERS.forEach(name => {
                arrange[name].dispose();
                fade[name].dispose();
            });
            Object.values(filters).forEach(f => f.dispose());
        }
    };
}
