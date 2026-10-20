/**
 * @fileoverview Voces con muestras reales (banco CC0 de music-samples.js): lead de
 * metales (trompa grave, trombón agudo y trompeta arriba), trompetas que doblan el
 * tema en los clímax, golpes de trompeta con trombón una octava por debajo, colchón
 * de metales sostenidos y bajo eléctrico a dedo con compresión y EQ.
 *
 * El bajo puede ser de muestras o un sintetizado de los 80 (sierra con filtro que se
 * cierra), y la melodía, los metales (lead), otro instrumento con muestras (saxos,
 * flauta, clarinete, oboe, violines) o un lead sintetizado, según el juego de sonidos.
 *
 * Si el banco trae varias dinámicas (metales de Iowa: pp, mf, ff), cada nota suena con
 * la capa que toca a su intensidad: un metal suave cambia de timbre, no solo de volumen.
 */

/** Bajo sintetizado de los 80: dos sierras algo desafinadas y filtro con envolvente. */
function synthBass(Tone, own, output) {
    return own(
        new Tone.MonoSynth({
            oscillator: { type: 'fatsawtooth', count: 2, spread: 14 },
            filter: { Q: 3, type: 'lowpass', rolloff: -24 },
            envelope: { attack: 0.003, decay: 0.3, sustain: 0.55, release: 0.1 },
            filterEnvelope: { attack: 0.002, decay: 0.2, sustain: 0.2, release: 0.15, baseFrequency: 80, octaves: 3.4 },
            volume: -9
        })
    ).connect(output);
}

/** Lead sintetizado de los 80: sierras gruesas, filtro que se abre y un poco de portamento. */
function synthLead(Tone, own, output) {
    return own(
        new Tone.MonoSynth({
            portamento: 0.025,
            oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
            filter: { Q: 1.5, type: 'lowpass', rolloff: -24 },
            envelope: { attack: 0.012, decay: 0.25, sustain: 0.7, release: 0.3 },
            filterEnvelope: {
                attack: 0.01,
                decay: 0.35,
                sustain: 0.45,
                release: 0.3,
                baseFrequency: 700,
                octaves: 2.6
            },
            volume: -15
        })
    ).connect(output);
}

/** Varios Sampler (uno por dinámica) que se tocan como uno: la capa sale de la intensidad. */
function layeredSampler(Tone, own, layers, opts) {
    const layerFor = self.XiroMusic.sampleMap.layerFor;
    const samplers = layers.map(urls => {
        const s = own(new Tone.Sampler({ urls, attack: 0.005, release: opts.release }));
        s.volume.value = opts.volume;
        return s.connect(opts.output);
    });
    return {
        triggerAttackRelease(notes, dur, time, vel) {
            samplers[layerFor(vel, samplers.length)].triggerAttackRelease(notes, dur, time, vel);
        }
    };
}

/**
 * @param {object} Tone
 * @param {Object<string, object>} outputs  Entrada por capa (brass, bass, melody)
 * @param {object} bank  loadSampleBank()
 */
export function createSampledVoices(Tone, outputs, bank) {
    const nodes = [];
    const own = node => {
        nodes.push(node);
        return node;
    };
    // Melodía: los metales de siempre, otro instrumento con muestras o el lead sintetizado
    function melodyVoice(kind) {
        if (!kind || kind === 'brass') return sampler('lead', 0.35, -9, leadEq);
        if (!bank.pitchedLayers('melody').length) return synthLead(Tone, own, leadEq);
        return sampler('melody', 0.4, -9, leadEq);
    }
    const sampler = (group, release, volume, output) => {
        const layers = bank.pitchedLayers(group);
        if (layers.length > 1) return layeredSampler(Tone, own, layers, { release, volume, output });
        const s = own(new Tone.Sampler({ urls: layers[0], attack: 0.005, release }));
        s.volume.value = volume;
        return s.connect(output);
    };

    // Lead: un poco menos de agudos para que trompa, trombón y trompeta empasten
    const leadEq = own(new Tone.EQ3({ low: 0, mid: 1, high: -3, lowFrequency: 250, highFrequency: 3500 })).connect(
        outputs.melody
    );
    const lead = melodyVoice(bank.sounds.melody);
    const trumpet = sampler('trumpet', 0.35, -13, leadEq);

    // Golpes: release largo para que suene la cola de sala de la muestra (si no, quedan secos)
    const brass = sampler('stab', 0.6, -5, outputs.brass);
    const brassLow = sampler('stabLow', 0.6, -8, outputs.brass);
    const brassSus = sampler('lead', 0.5, -13, outputs.brass);

    // Bajo: graves arriba, compresión para que empuje parejo
    const bassComp = own(new Tone.Compressor({ threshold: -22, ratio: 4, attack: 0.005, release: 0.12 })).connect(
        outputs.bass
    );
    const bassEq = own(new Tone.EQ3({ low: 3, mid: -1, high: -2, lowFrequency: 120, highFrequency: 2500 })).connect(
        bassComp
    );
    const bass = bank.pitchedLayers('bass').length ? sampler('bass', 0.08, 0, bassEq) : synthBass(Tone, own, bassEq);

    return {
        lead,
        trumpet,
        brass,
        brassLow,
        brassSus,
        bass,
        dispose() {
            nodes.forEach(node => node.dispose());
        }
    };
}
