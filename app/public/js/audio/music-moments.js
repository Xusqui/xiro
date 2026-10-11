/**
 * @fileoverview Momentos cuantizados de la partida, sobre el reproductor de momentos:
 *  - Revelación: fill desde el siguiente tiempo hasta el siguiente medio compás (mínimo
 *    1 tiempo: como mucho ~1,4 s, para no ir por detrás de la pantalla) y golpe. Con
 *    `cadence`, la propia música resuelve (IV en el fill, «TA» en el V, «DAAAA» en el I);
 *    sin ella, el stinger «¡TA-DAAAA!» fijo.
 *  - Podio: redoble y los puestos 3º, 2º y 1º a negras en los grados 1-3-4; después,
 *    el final (tema A) y salida con fundido.
 * Los avisos de "golpe" para la pantalla se emiten con Tone.Draw: llegan en el instante
 * en que suena el golpe, no cuando se programa.
 */

import { quantizeHit, beatsToSeconds } from './music-clock.js?v=20260922172926';
import { LAYERS } from './music-mixer.js?v=20260922172926';

// Redoble antes del 3º: al menos 3 tiempos hasta el compás
const PODIUM_ROLL_BEATS = 3;
const REVEAL_PREP_BEATS = 1;
const REVEAL_GRID_BEATS = 2;
const FINALE_BARS = 8;
// Al empezar el fill la pregunta se aparta: la batería deja sitio al redoble y, con la
// cadencia, también el resto (sigue la cadencia con los mismos instrumentos)
const DRUMS_DUCK_SECONDS = 0.05;
const PITCHED_DUCK_SECONDS = 0.12;
const PITCHED_LAYERS = LAYERS.filter((name) => name !== 'drums');
const OUTRO_SECONDS = 4;
// Con la cadencia, la escena siguiente (marcador o tablero) entra de golpe en el golpe
const REVEAL_ENTRY_BEATS = 0.25;

/**
 * @param {object} Tone
 * @param {{ player: object, director: object, emit: Function }} ctx
 */
export function createMoments(Tone, ctx) {
    const { stingers, cadence } = self.XiroMusic;
    const { player, director, emit } = ctx;
    const onScreen = (fn) => (time) => Tone.getDraw().schedule(fn, time);

    return {
        /**
         * opts: { key, bank, cadence, tension, filterHz (filtro de la pregunta),
         *         next (escena que sigue o null), onHit(time), onDone() }
         * Con cadencia y `next`, la revelación es un fill: la escena siguiente queda
         * programada en el golpe y la música no se corta (el «DAAAA» cae en su primer
         * tiempo, que siempre es el I). Devuelve q con `continues`.
         */
        reveal(opts) {
            player.clear();
            const q = quantizeHit(Tone, REVEAL_PREP_BEATS, REVEAL_GRID_BEATS);
            const music = opts.cadence
                ? cadence.buildRevealCadence({ key: opts.key, beats: q.beats, tension: opts.tension, from: director.questionChord() })
                : { fill: stingers.buildRevealFill(q.beats), stinger: stingers.buildStinger(opts.key) };
            const stinger = music.stinger;
            player.play(music.fill, q.startTick, opts.bank);
            player.play(stinger, q.hitTick, opts.bank);
            player.at((time) => {
                director.duck(time, ['drums'], DRUMS_DUCK_SECONDS);
                if (!opts.cadence) return;
                director.duck(time, PITCHED_LAYERS, PITCHED_DUCK_SECONDS);
                // El fill sale con el filtro de la pregunta y lo abre hasta el golpe (con poca
                // tensión, poco: golpe suave y oscuro)
                const seconds = beatsToSeconds(Tone.getTransport(), q.beats);
                player.sweep(opts.filterHz, cadence.brightnessHz(opts.tension), time, seconds);
            }, q.startTick);
            q.continues = Boolean(opts.cadence && opts.next);
            if (q.continues) {
                const scene = director.setScene(opts.next, true, q.hitTick);
                if (scene) scene.fadeInBeats = REVEAL_ENTRY_BEATS;
            }
            player.at(opts.onHit, q.hitTick);
            // Un compás antes del final: la escena siguiente entra justo al acabar el stinger
            // (con la cadencia, que dura un compás, en el mismo golpe)
            player.at(opts.onDone, q.hitTick + stinger.lengthTicks - q.bar);
            return q;
        },

        /**
         * Podio completo: redoble desde el siguiente tiempo y, en el compás, los puestos
         * 3º, 2º y 1º a negras ('podiumHit' en el instante de cada nota). En el compás
         * siguiente, el final (tema A); tras él, salida con fundido ('podiumEnd').
         * opts: { key (tonalidad que suena), bank }
         */
        podium(opts) {
            player.clear();
            const q = quantizeHit(Tone, PODIUM_ROLL_BEATS);
            const reveal = stingers.buildPodiumReveal(opts.key);
            player.play(stingers.buildPodiumRoll(q.beats), q.startTick, opts.bank);
            player.play(reveal, q.hitTick, opts.bank);
            reveal.steps.forEach((step) => player.at(onScreen(() => emit('podiumHit', step.place)), q.hitTick + step.tick));
            const finaleTick = q.hitTick + q.bar;
            director.setScene('podiumFinale', true, finaleTick);
            player.at((time) => {
                director.fadeAndStop(time, OUTRO_SECONDS);
                Tone.getDraw().schedule(() => emit('podiumEnd'), time + OUTRO_SECONDS);
            }, finaleTick + FINALE_BARS * q.bar);
            return q;
        },

        cancel() {
            player.clear();
        }
    };
}
