/**
 * @fileoverview Director de escenas de MusicEngine: cambia de escena en el próximo
 * compás con crossfade, corta en seco (revelación) y lleva la escena que suena y la
 * programada. El motor le da acceso a la semilla, opciones, tensión y banco actuales.
 */

import { createScene } from './music-scene.js?v=20260922172926';
import { SCENES } from './music-scene-registry.js?v=20260922172926';
import { startAtNextBar, beatsToSeconds, afterAudioTime } from './music-clock.js?v=20260922172926';
import { trace } from './music-trace.js?v=20260922172926';

const CROSSFADE_BEATS = 2;
// Al cambiar de escena el tempo vuelve a su sitio en 2 compases (sin tirones)
const TEMPO_RETURN_BEATS = 8;
const CUT_SECONDS = 0.04;

/**
 * @param {object} Tone
 * @param {object} mixer
 * @param {{ seed: () => string, options: () => object, tension: () => number,
 *           tempoScale: () => number, bank: () => object|null,
 *           question?: () => object|null, emit: (type: string, detail: any) => void }} ctx
 */
export function createSceneDirector(Tone, mixer, ctx) {
    const transport = Tone.getTransport();
    const state = { name: 'idle', current: null, pending: null };

    function build(scene) {
        const options = Object.assign({}, ctx.options());
        const seed = ctx.seed();
        const created = createScene(
            Tone,
            mixer,
            Object.assign({}, scene, {
                bpm: scene.bpm * ctx.tempoScale(),
                swing: options.humanize ? scene.swing : 0,
                build: index => scene.build(seed, index, options, ctx.tension(), ctx.question ? ctx.question() : null)
            }),
            ctx.bank()
        );
        created.setFx(options.fx);
        created.isQuestion = scene === SCENES.question;
        created.fadeInBeats = scene.fadeInBeats || CROSSFADE_BEATS;
        created.onSection(plan => ctx.emit('section', plan));
        return created;
    }

    function cancelPending() {
        if (!state.pending) return;
        transport.clear(state.pending.id);
        if (state.pending.scene) state.pending.scene.dispose();
        state.pending = null;
    }

    function live() {
        return [state.current, state.pending && state.pending.scene].filter(Boolean);
    }

    function retire(scene, time, seconds) {
        scene.fadeOut(time, seconds);
        afterAudioTime(Tone, time + seconds, () => scene.dispose());
    }

    function swap(next, time) {
        trace(`entra escena ${state.name}`);
        const old = state.current;
        state.current = next;
        state.pending = null;
        if (old) retire(old, time, beatsToSeconds(transport, CROSSFADE_BEATS));
        if (next) {
            next.fadeIn(time, beatsToSeconds(transport, next.fadeInBeats));
            // El tempo vuelve a su sitio desde que entra la escena (en una revelación, el
            // fill va al tempo de la pregunta)
            if (Math.abs(next.bpm - transport.bpm.value) > 0.25)
                transport.bpm.rampTo(next.bpm, beatsToSeconds(transport, TEMPO_RETURN_BEATS), time);
        } else {
            afterAudioTime(Tone, time + beatsToSeconds(transport, CROSSFADE_BEATS), () => {
                // Solo si sigue sin escena: si ya se programó otra, parar aquí la dejaría colgada
                if (!state.current && !state.pending) {
                    trace('transport.stop (sin escena)');
                    transport.stop();
                }
            });
        }
    }

    return {
        state,
        /**
         * Cambia de escena en el siguiente compás (o en `atTick`, si se da: p. ej. el
         * golpe del ganador en el podio). Devuelve la escena nueva (o null).
         */
        setScene(name, force, atTick) {
            if (name === state.name && !force) return null;
            const scene = SCENES[name];
            if (name !== 'idle' && !scene) {
                ctx.emit('warn', `Escena "${name}" todavía no implementada`);
                return null;
            }
            cancelPending();
            trace(`setScene ${name}${atTick != null ? ' @' + atTick : ''} (transport ${transport.state})`);
            state.name = name;
            if (!state.current && name === 'idle') {
                if (transport.state === 'started') transport.stop();
                return null;
            }
            const startTick = atTick != null ? atTick : startAtNextBar(Tone);
            const next = scene ? build(scene) : null;
            trace(`  escena construida, arranca en ${startTick}`);
            if (next) {
                next.start(startTick);
                trace('  partes en marcha');
            }
            const id = transport.scheduleOnce(time => swap(next, time), `${startTick}i`);
            trace('  cambio programado');
            state.pending = { id, scene: next };
            ctx.emit('scene', { name, bar: startTick / (transport.PPQ * 4) });
            return next;
        },
        /** Corte seco (revelación): la escena que suena se apaga en `time`; queda sin escena. */
        cut(time, nextName) {
            cancelPending();
            if (state.current) retire(state.current, time, CUT_SECONDS);
            state.current = null;
            state.name = nextName;
            transport.bpm.rampTo(
                SCENES.lobby.bpm * ctx.tempoScale(),
                beatsToSeconds(transport, TEMPO_RETURN_BEATS),
                time
            );
        },
        /** Salida: fundido de `seconds` desde `time` y, al acabar, se para el Transport. */
        fadeAndStop(time, seconds) {
            cancelPending();
            if (state.current) retire(state.current, time, seconds);
            state.current = null;
            state.name = 'idle';
            afterAudioTime(Tone, time + seconds, () => {
                if (!state.current && !state.pending) transport.stop();
            });
        },
        /** Escenas vivas (la que suena y la programada), p. ej. para aplicar la tensión. */
        live,
        /** Baja a 0 las capas `layers` de la escena que suena desde `time` (revelación). */
        duck(time, layers, seconds) {
            if (state.current) layers.forEach(name => state.current.setLayerLevel(name, 0, time, seconds));
        },
        /** Acorde que suena en la pregunta ({ key, d, k }), o null si no suena una pregunta. */
        questionChord() {
            const scene = state.current;
            const section = scene && scene.isQuestion ? scene.currentSection() : null;
            const chord = section && section.plan.chords && section.plan.chords[0];
            return chord ? { key: section.plan.key, d: chord.d, k: chord.k } : null;
        },
        dispose() {
            cancelPending();
            if (state.current) state.current.dispose();
            state.current = null;
        }
    };
}
