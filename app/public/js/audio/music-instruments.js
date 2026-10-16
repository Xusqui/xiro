/**
 * @fileoverview Instrumentos melódicos de una escena. Híbrido: metales, lead y bajo
 * con muestras reales (music-sampled.js) y, sintetizados a propósito por su sabor
 * de los 80, el colchón de cuerdas (sierra desafinada con filtro que respira y
 * chorus) y las campanas FM tipo DX7. Si el banco de muestras no carga, metales,
 * lead y bajo pasan a sintetizarse. Cada escena crea los suyos para poder hacer
 * crossfade con la anterior; dispose() los libera todos.
 *
 * Solo nodos nativos (osciladores, filtros, LFO, retardos, buffers): sin worklets.
 */

import { createSampledVoices } from './music-sampled.js?v=20260922172926';
import { createPianoVoice } from './music-piano-voice.js?v=20260922172926';

/** Reserva sin muestras: metales, bajo y lead sintetizados. */
function createSynthVoices(Tone, outputs, own) {
    const brassFilter = own(new Tone.Filter(4500, 'lowpass')).connect(outputs.brass);
    const brass = own(new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'sawtooth' },
        filter: { Q: 1.2, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.02, decay: 0.25, sustain: 0.55, release: 0.22 },
        filterEnvelope: { attack: 0.03, decay: 0.3, sustain: 0.45, release: 0.25, baseFrequency: 320, octaves: 3.4 },
        volume: -15
    })).connect(brassFilter);
    brass.maxPolyphony = 16;

    const bass = own(new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.004, decay: 0.22, sustain: 0.45, release: 0.08 },
        filterEnvelope: { attack: 0.002, decay: 0.16, sustain: 0.15, release: 0.1, baseFrequency: 110, octaves: 3.2 },
        volume: -10
    })).connect(outputs.bass);

    const lead = own(new Tone.MonoSynth({
        oscillator: { type: 'fatsawtooth', count: 2, spread: 12 },
        filter: { Q: 1.5, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.7, release: 0.35 },
        filterEnvelope: { attack: 0.06, decay: 0.4, sustain: 0.55, release: 0.4, baseFrequency: 500, octaves: 2.8 },
        volume: -11
    })).connect(outputs.melody);

    return { lead, trumpet: lead, brass, brassLow: brass, brassSus: brass, bass };
}

/**
 * @param {object} Tone
 * @param {Object<string, object>} outputs  Entrada por capa (pad, brass, piano, bass, arp, melody);
 *        la reverb y el delay los pone la mezcla en cada capa
 * @param {object|null} bank  Banco de muestras (loadSampleBank) o null para sintetizar todo
 */
export function createInstruments(Tone, outputs, bank) {
    const nodes = [];
    const own = (node) => {
        nodes.push(node);
        return node;
    };

    // Cuerdas
    const padChorus = own(new Tone.Chorus({ frequency: 0.6, delayTime: 4, depth: 0.55, spread: 180, wet: 0.5 }))
        .start().connect(outputs.pad);
    const padFilter = own(new Tone.AutoFilter({
        frequency: 0.12, baseFrequency: 650, octaves: 1.8, depth: 0.45, wet: 1,
        filter: { type: 'lowpass', rolloff: -24, Q: 0.6 }
    })).start().connect(padChorus);
    const pad = own(new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 28 },
        envelope: { attack: 0.9, decay: 0.5, sustain: 0.8, release: 1.8 },
        volume: -11
    })).connect(padFilter);
    // Acordes de 4 notas con release largo; en la pregunta cambian cada compás y se solapan
    pad.maxPolyphony = 16;

    // Campanas FM (piano eléctrico/campana del DX7)
    const bells = own(new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.5,
        modulationIndex: 11,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.3 },
        volume: -2
    })).connect(outputs.arp);
    bells.maxPolyphony = 16;

    const sampled = bank ? createSampledVoices(Tone, outputs, bank) : null;
    const voices = sampled || createSynthVoices(Tone, outputs, own);
    // Piano: de cola si el banco lo trae; si no (o si se eligió), el eléctrico FM
    const piano = createPianoVoice(Tone, own, outputs.piano, bank ? bank.pitchedLayers('piano') : []);

    return Object.assign({ pad, bells, piano, sampled: Boolean(sampled) }, voices, {
        /** Chorus y filtro que respira on/off (comparación A/B). */
        setFx(on) {
            padChorus.wet.rampTo(on ? 0.5 : 0, 0.2);
            padFilter.depth.rampTo(on ? 0.45 : 0, 0.2);
            piano.setFx(on);
        },
        dispose() {
            if (sampled) sampled.dispose();
            nodes.forEach((node) => node.dispose());
        }
    });
}
