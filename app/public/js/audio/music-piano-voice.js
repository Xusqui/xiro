/**
 * @fileoverview Voz del piano de acompañamiento: piano de cola con muestras (Salamander,
 * banco 'grand') o, si se elige 'epiano' o no hay muestras, un piano eléctrico FM al
 * estilo del «E.Piano» del DX7: cuerpo 1:1 con el ataque del modulador y una púa aguda
 * («tine») que suena solo al principio, con un poco de chorus.
 */

/** Piano eléctrico FM (dos PolySynth en paralelo: cuerpo y púa). */
function electricPiano(Tone, own, output) {
    const chorus = own(new Tone.Chorus({ frequency: 1.2, delayTime: 3, depth: 0.35, spread: 120, wet: 0.35 }))
        .start()
        .connect(output);
    const body = own(
        new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 1,
            modulationIndex: 2.4,
            oscillator: { type: 'sine' },
            modulation: { type: 'sine' },
            envelope: { attack: 0.002, decay: 1.8, sustain: 0.18, release: 0.9 },
            modulationEnvelope: { attack: 0.002, decay: 0.45, sustain: 0.12, release: 0.5 },
            volume: -12
        })
    ).connect(chorus);
    const tine = own(
        new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 7,
            modulationIndex: 1.2,
            oscillator: { type: 'sine' },
            modulation: { type: 'sine' },
            envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.2 },
            modulationEnvelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 },
            volume: -24
        })
    ).connect(chorus);
    body.maxPolyphony = 24;
    tine.maxPolyphony = 24;
    return {
        triggerAttackRelease(notes, dur, time, vel) {
            body.triggerAttackRelease(notes, dur, time, vel);
            tine.triggerAttackRelease(notes, dur, time, vel);
        },
        setFx(on) {
            chorus.wet.rampTo(on ? 0.35 : 0, 0.2);
        }
    };
}

/** Piano de cola con muestras: un poco de compresión para que el acompañamiento vaya parejo. */
function grandPiano(Tone, own, output, layer) {
    const comp = own(new Tone.Compressor({ threshold: -20, ratio: 3, attack: 0.01, release: 0.2 })).connect(output);
    const eq = own(new Tone.EQ3({ low: -2, mid: 0, high: 1, lowFrequency: 200, highFrequency: 3000 })).connect(comp);
    const sampler = own(new Tone.Sampler({ urls: layer, attack: 0.002, release: 0.8 })).connect(eq);
    sampler.volume.value = -6;
    return {
        triggerAttackRelease(notes, dur, time, vel) {
            sampler.triggerAttackRelease(notes, dur, time, vel);
        },
        setFx() {}
    };
}

/**
 * @param {object} Tone
 * @param {(node: object) => object} own  Registra el nodo para liberarlo con el instrumento
 * @param {object} output  Entrada de la capa del piano
 * @param {object[]} layers  Capas de muestras del banco ([] = eléctrico FM)
 */
export function createPianoVoice(Tone, own, output, layers) {
    return layers && layers.length
        ? grandPiano(Tone, own, output, layers[layers.length - 1])
        : electricPiano(Tone, own, output);
}
