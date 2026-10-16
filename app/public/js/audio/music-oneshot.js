/**
 * @fileoverview Reproductor de "momentos" sueltos (revelación, puestos del podio): tiene
 * sus propios instrumentos, que no dependen de la escena (se puede cortar o cambiar), y
 * los conecta directamente a los canales de la mezcla. Programa pistas en un tick del
 * Transport y avisos en otros; clear() lo cancela todo.
 *
 * El pad, las campanas, los metales y el piano pasan por un filtro: la cadencia de la revelación
 * arranca con el filtro de la pregunta y lo abre hasta el golpe (más o menos según la
 * tensión). Cada momento nuevo empieza con el filtro abierto.
 */

import { createInstruments } from './music-instruments.js?v=20260922172926';
import { createDrumKit } from './music-drums.js?v=20260922172926';

const OPEN_FILTER_HZ = 18000;
const FILTERED = ['pad', 'arp', 'brass', 'piano'];

export function createOneShotPlayer(Tone, mixer) {
    const transport = Tone.getTransport();
    let voices = null;   // { players, inst, kit, bank }
    let parts = [];
    let ids = [];

    function disposeVoices() {
        voices.inst.dispose();
        voices.kit.dispose();
        voices.filters.forEach((f) => f.dispose());
        voices = null;
    }

    function playersFor(inst, kit) {
        return {
            brass: (t, e) => {
                if (e.sus) {
                    inst.brassSus.triggerAttackRelease(e.notes, e.dur, t, e.vel);
                    return;
                }
                inst.brass.triggerAttackRelease(e.notes, e.dur, t, e.vel);
                inst.brassLow.triggerAttackRelease(e.low, e.dur, t, e.vel * 0.9);
            },
            bass: (t, e) => inst.bass.triggerAttackRelease(e.note, e.dur, t, e.vel),
            lead: (t, e) => inst.lead.triggerAttackRelease(e.note, e.dur, t, e.vel),
            bells: (t, e) => inst.bells.triggerAttackRelease(e.note, e.dur, t, e.vel),
            pad: (t, e) => inst.pad.triggerAttackRelease(e.notes, e.dur, t, e.vel),
            piano: (t, e) => inst.piano.triggerAttackRelease(e.notes, e.dur, t, e.vel),
            timp: (t, e) => kit.timp(e.note, t, e.vel),
            crash: (t, e) => kit.crash(t, e.vel),
            kick: (t, e) => kit.kick(t, e.vel),
            snare: (t, e) => kit.snare(t, e.vel)
        };
    }

    function ensureVoices(bank) {
        if (voices && voices.bank === bank) return voices;
        if (voices) disposeVoices();
        const outputs = Object.assign({}, mixer.layers);
        const filters = FILTERED.map((name) => {
            const filter = new Tone.Filter({ frequency: OPEN_FILTER_HZ, type: 'lowpass', rolloff: -12 }).connect(mixer.layers[name]);
            outputs[name] = filter;
            return filter;
        });
        const inst = createInstruments(Tone, outputs, bank);
        const kit = createDrumKit(Tone, mixer.layers.drums, (time) => mixer.pumpAt(time), bank);
        voices = { players: playersFor(inst, kit), inst, kit, bank, filters };
        return voices;
    }

    return {
        /** Programa las pistas de `tracks` (brass, piano, bass, lead, bells, pad, timp, crash, kick, snare) en `atTick`. */
        play(tracks, atTick, bank) {
            const { players } = ensureVoices(bank);
            Object.keys(players).forEach((track) => {
                if (tracks[track] && tracks[track].length) parts.push(new Tone.Part(players[track], tracks[track]).start(`${atTick}i`));
            });
        },
        /** Filtro del pad, campanas y metales: de `fromHz` en `time` a `toHz` en `seconds`. */
        sweep(fromHz, toHz, time, seconds) {
            if (!voices) return;
            voices.filters.forEach((f) => {
                f.frequency.cancelAndHoldAtTime(time);
                f.frequency.setValueAtTime(Math.min(fromHz, toHz), time);
                f.frequency.exponentialRampToValueAtTime(toHz, time + seconds);
            });
        },
        /** Aviso fn(time) en un tick del Transport. */
        at(fn, tick) {
            if (fn) ids.push(transport.scheduleOnce(fn, `${tick}i`));
        },
        clear() {
            if (voices) {
                voices.filters.forEach((f) => {
                    f.frequency.cancelScheduledValues(0);
                    f.frequency.value = OPEN_FILTER_HZ;
                });
            }
            ids.forEach((id) => transport.clear(id));
            parts.forEach((p) => p.dispose());
            ids = [];
            parts = [];
        },
        dispose() {
            this.clear();
            if (voices) disposeVoices();
        }
    };
}
