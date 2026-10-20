/**
 * @fileoverview Batería de la música. Con banco de muestras: bombo y caja reales
 * (micro cercano + sala, de un kit de los 80), charles cerrado y abierto, crash y
 * timbales, con capas de intensidad y alternancia de golpes. Las palmas siguen
 * sintetizadas (como en las cajas de ritmos de los 80). Sin banco, todo sintetizado.
 * Todo pasa por una compresión de bus que lo pega.
 */

const KICK_NOTE = 'C1';
const SNARE_BODY_NOTE = 'E3';
const HAT_FREQ = 260;
// Palmas: tres golpes muy seguidos, como varias manos
const CLAP_SPACING = 0.011;

function createClap(Tone, output, own) {
    const clapFilter = own(new Tone.Filter({ type: 'bandpass', frequency: 1150, Q: 1.1 })).connect(output);
    const clap = own(
        new Tone.NoiseSynth({
            noise: { type: 'pink' },
            envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.02 },
            volume: -12
        })
    ).connect(clapFilter);
    return (time, vel) => {
        clap.triggerAttackRelease('64n', time, vel * 0.6);
        clap.triggerAttackRelease('64n', time + CLAP_SPACING, vel * 0.5);
        clap.triggerAttackRelease('32n', time + 2 * CLAP_SPACING, vel);
    };
}

/**
 * Pieza con muestras: capa según la intensidad y alternancia entre golpes iguales.
 * @param {{ Tone: object, own: Function, bank: object }} ctx
 */
function layeredPiece(ctx, piece, output, volume) {
    const { Tone, own, bank } = ctx;
    const kit = bank.drum(piece);
    const sampler = own(new Tone.Sampler({ urls: kit.urls, release: 0.05 })).connect(output);
    sampler.volume.value = volume;
    const layerFor = self.XiroMusic.sampleMap.layerFor;
    let rr = 0;
    const play = (time, vel) => {
        const row = kit.notes[layerFor(vel, kit.notes.length)];
        sampler.triggerAttack(row[rr++ % row.length], time, 0.55 + vel * 0.45);
    };
    return { sampler, play };
}

function createSampledKit(Tone, output, own, bank) {
    const ctx = { Tone, own, bank };
    const kick = layeredPiece(ctx, 'kick', output, -3);
    const snare = layeredPiece(ctx, 'snare', output, -6);
    const hatPan = own(new Tone.Panner(0.28)).connect(output);
    const hatC = layeredPiece(ctx, 'hatC', hatPan, -14);
    const hatO = layeredPiece(ctx, 'hatO', hatPan, -17);
    const crash = layeredPiece(ctx, 'crash', output, -12);
    const timp = own(new Tone.Sampler({ urls: bank.pitched('timp'), release: 1 })).connect(output);
    timp.volume.value = -6;
    return {
        kick: kick.play,
        snare: snare.play,
        hatC(time, vel) {
            hatO.sampler.releaseAll(time); // el cerrado corta al abierto
            hatC.play(time, vel);
        },
        hatO: hatO.play,
        crash: crash.play,
        timp: (note, time, vel) => timp.triggerAttack(note, time, vel)
    };
}

function createSynthKit(Tone, output, own) {
    const kick = own(
        new Tone.MembraneSynth({
            pitchDecay: 0.028,
            octaves: 6.5,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.001, decay: 0.36, sustain: 0, release: 0.05 },
            volume: -6
        })
    ).connect(output);
    const snareFilter = own(new Tone.Filter(1500, 'highpass')).connect(output);
    const snareNoise = own(
        new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.001, decay: 0.17, sustain: 0, release: 0.03 },
            volume: -15
        })
    ).connect(snareFilter);
    const snareBody = own(
        new Tone.MembraneSynth({
            pitchDecay: 0.015,
            octaves: 1.6,
            envelope: { attack: 0.001, decay: 0.11, sustain: 0, release: 0.02 },
            volume: -17
        })
    ).connect(output);
    const hatFilter = own(new Tone.Filter(7000, 'highpass')).connect(own(new Tone.Panner(0.28)).connect(output));
    const hatOptions = { harmonicity: 5.1, modulationIndex: 32, resonance: 5200, octaves: 1.4 };
    const hatC = own(
        new Tone.MetalSynth(
            Object.assign({ envelope: { attack: 0.001, decay: 0.035, release: 0.01 }, volume: -31 }, hatOptions)
        )
    ).connect(hatFilter);
    const hatO = own(
        new Tone.MetalSynth(
            Object.assign({ envelope: { attack: 0.001, decay: 0.28, release: 0.08 }, volume: -34 }, hatOptions)
        )
    ).connect(hatFilter);
    const timp = own(
        new Tone.MembraneSynth({
            pitchDecay: 0.06,
            octaves: 1.2,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.004, decay: 1.6, sustain: 0, release: 1 },
            volume: -9
        })
    ).connect(own(new Tone.Filter(1000, 'lowpass')).connect(output));
    return {
        kick: (time, vel) => kick.triggerAttackRelease(KICK_NOTE, '8n', time, vel),
        snare(time, vel) {
            snareNoise.triggerAttackRelease('16n', time, vel);
            snareBody.triggerAttackRelease(SNARE_BODY_NOTE, '32n', time, vel * 0.8);
        },
        hatC(time, vel) {
            hatO.triggerRelease(time);
            hatC.triggerAttackRelease(HAT_FREQ, '32n', time, vel);
        },
        hatO: (time, vel) => hatO.triggerAttackRelease(HAT_FREQ, '8n', time, vel),
        crash: () => {},
        timp: (note, time, vel) => timp.triggerAttackRelease(note, '2n', time, vel)
    };
}

/**
 * @param {object} Tone
 * @param {object} output  Entrada de la capa de batería (la reverb la pone la mezcla)
 * @param {(time: number) => void} onKick  Aviso por cada bombo (bombeo de la mezcla)
 * @param {object|null} bank  Banco de muestras o null para sintetizar
 */
export function createDrumKit(Tone, output, onKick, bank) {
    const nodes = [];
    const own = node => {
        nodes.push(node);
        return node;
    };
    const busComp = own(new Tone.Compressor({ threshold: -16, ratio: 3, attack: 0.01, release: 0.15 })).connect(output);
    const kit = bank ? createSampledKit(Tone, busComp, own, bank) : createSynthKit(Tone, busComp, own);
    const clap = createClap(Tone, busComp, own);
    return {
        kick(time, vel) {
            kit.kick(time, vel);
            onKick(time);
        },
        snare: kit.snare,
        clap,
        hatC: kit.hatC,
        hatO: kit.hatO,
        crash: kit.crash,
        timp: kit.timp,
        dispose() {
            nodes.forEach(node => node.dispose());
        }
    };
}
