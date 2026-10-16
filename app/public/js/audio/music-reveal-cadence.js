/**
 * @fileoverview Revelación como cadencia de la propia música de la pregunta, en
 * funciones puras. La pregunta suena en el relativo menor; la revelación resuelve en
 * el relativo mayor (la tonalidad del lobby y del marcador) con VI–VII–I del menor,
 * que en el mayor es IV–V–I:
 *  - fill: pad, metales y bajo en el IV, enlazados desde el acorde que sonaba, con el
 *    redoble de caja de siempre y el piano repitiendo el IV a corcheas en crescendo;
 *  - golpe: «TA» (V, una semicorchea) y «DAAAA» (I) con los mismos instrumentos, de
 *    un compás: la escena siguiente (marcador o tablero) entra en el golpe, debajo.
 * La intensidad sigue a la tensión. Con poca, suave y oscuro: trompas sostenidas (sin
 * golpe de metales), sin platillo y con el filtro casi cerrado. Con tensión media
 * entran el golpe de metales, el platillo y la trompeta; las campanas, solo con alta.
 *
 * Export dual (Jest con require; navegador en self.XiroMusic.cadence).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(module.require('./music-theory.js'), module.require('./music-stingers.js'));
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.cadence = factory(root.XiroMusic.theory, root.XiroMusic.stingers);
    }
})(typeof self !== 'undefined' ? self : this, function (theory, stingers) {
    'use strict';

    const BEAT = theory.PPQ;
    const STEP = theory.STEP_TICKS;
    const BAR = theory.BAR_TICKS;
    // Un compás: la escena siguiente entra en el golpe y suena debajo del «DAAAA»
    const CADENCE_TICKS = BAR;
    const DA_TICKS = 3 * BEAT;
    const RANGES = {
        pad: [55, 74],
        brass: [58, 79],
        piano: [55, 79],
        pianoLeft: [43, 54],
        bass: [28, 43],
        lead: [60, 88],
        bells: [65, 100],
        timp: [41, 55]
    };
    const LEAD_FROM = 0.35;   // tensión a partir de la que dobla la trompeta
    const STAB_FROM = 0.35;   // golpe de metales y platillo (por debajo, trompas sostenidas)
    const BELLS_FROM = 0.7;   // tensión a partir de la que suenan las campanas
    const DARK_HZ = 1800;     // filtro del golpe sin tensión (con tensión 1, 18 kHz)
    // Grados del mayor: IV, V, I
    const IV = 3;
    const V = 4;
    const I = 0;

    const t = (ticks) => Math.round(ticks) + 'i';
    const name = theory.midiToName;
    const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0));
    const energyOf = (tension) => 0.4 + 0.6 * tension;

    /** Hasta dónde se abre el filtro del pad, las campanas y los metales en el golpe. */
    function brightnessHz(tension) {
        return DARK_HZ * Math.pow(10, clamp(tension));
    }

    function chordEvent(tick, len, midi, vel, sus) {
        const e = { time: t(tick), dur: t(len), notes: midi.map(name), midi: midi, vel: vel };
        if (sus) e.sus = true;
        else e.low = name(Math.min.apply(null, midi) - 12);
        return e;
    }

    function noteEvent(tick, len, midi, vel) {
        return { time: t(tick), dur: t(len), note: name(midi), midi: midi, vel: vel };
    }

    function lead(prev, key, degree, kind, range) {
        return theory.voiceLead(prev, theory.chordMidi(key, degree, kind), range[0], range[1]);
    }

    function rootIn(key, degree, range) {
        return theory.fitToRange([theory.degreeToMidi(key, degree)], range[0], range[1])[0];
    }

    /**
     * Voicings de la cadencia. `from` = acorde que sonaba en la pregunta
     * ({ key, d, k }) o null: de él salen las voces, para que el IV llegue con el
     * menor movimiento posible.
     */
    function cadenceVoicings(key, from) {
        const ref = (range) => (from ? lead(null, from.key, from.d, from.k, range) : null);
        const padIV = lead(ref(RANGES.pad), key, IV, 'triad', RANGES.pad);
        const brassIV = lead(ref(RANGES.brass), key, IV, 'triad', RANGES.brass);
        const brassV = lead(brassIV, key, V, 'triad', RANGES.brass);
        const pianoIV = lead(ref(RANGES.piano), key, IV, 'triad', RANGES.piano);
        const pianoV = lead(pianoIV, key, V, 'triad', RANGES.piano);
        return {
            from: from ? { pad: ref(RANGES.pad), brass: ref(RANGES.brass) } : null,
            padIV: padIV,
            padI: lead(padIV, key, I, 'add9', RANGES.pad),
            brassIV: brassIV,
            brassV: brassV,
            brassI: lead(brassV, key, I, 'add9', RANGES.brass),
            pianoIV: pianoIV,
            pianoV: pianoV,
            pianoI: lead(pianoV, key, I, 'add9', RANGES.piano)
        };
    }

    /** Fill de `beats` tiempos: IV sostenido y bajo a corcheas en crescendo, con el redoble. */
    function buildFill(key, v, beats, energy) {
        const drums = stingers.buildRevealFill(beats);
        const total = drums.lengthTicks;
        const bassNote = rootIn(key, IV, RANGES.bass);
        const half = BEAT / 2;
        const bass = [];
        const piano = [];
        for (let tick = 0; tick < total; tick += half) {
            const swell = tick / total;
            bass.push(noteEvent(tick, half * 0.9, bassNote, energy * (0.55 + 0.35 * swell)));
            piano.push(chordEvent(tick, half * 0.8, v.pianoIV, energy * (0.35 + 0.35 * swell), true));
        }
        const soft = (e) => Object.assign({}, e, { vel: e.vel * energy });
        return {
            snare: drums.snare.map(soft),
            kick: drums.kick.map(soft),
            pad: [chordEvent(0, total, v.padIV, 0.35 * energy, true)],
            brass: [chordEvent(0, total, v.brassIV, 0.5 * energy, true)],
            bass: bass,
            piano: piano,
            lengthTicks: total
        };
    }

    /** «TA» en el V (una semicorchea) y «DAAAA» en el I, con la intensidad de la tensión. */
    function buildHit(key, v, tension, energy) {
        const ta = STEP;
        const stab = tension >= STAB_FROM;
        const hit = {
            brass: stab ? [
                chordEvent(0, ta, v.brassV, 0.8 * energy),
                chordEvent(ta, BEAT, v.brassI, 0.95 * energy),
                chordEvent(ta, DA_TICKS, v.brassI, 0.7 * energy, true)
            ] : [
                chordEvent(0, ta, v.brassV, 0.7 * energy, true),
                chordEvent(ta, DA_TICKS, v.brassI, 0.8 * energy, true)
            ],
            pad: [chordEvent(ta, DA_TICKS, v.padI, 0.45 * energy, true)],
            // Piano con los metales: TA en el V y DAAAA en el I con la fundamental abajo
            piano: [
                chordEvent(0, ta, v.pianoV, 0.7 * energy, true),
                chordEvent(ta, 2 * BEAT, [rootIn(key, I, RANGES.pianoLeft)].concat(v.pianoI), 0.85 * energy, true)
            ],
            // El bajo de la escena siguiente sigue enseguida
            bass: [noteEvent(0, ta, rootIn(key, V, RANGES.bass), 0.85 * energy), noteEvent(ta, BEAT, rootIn(key, I, RANGES.bass), 0.95 * energy)],
            timp: [noteEvent(0, ta, rootIn(key, V, RANGES.timp), 0.9 * energy), noteEvent(ta, 2 * BEAT, rootIn(key, I, RANGES.timp), 0.9 * energy)],
            crash: stab ? [{ time: t(ta), vel: 0.5 + 0.45 * tension }] : [],
            kick: [{ time: t(0), vel: 0.7 * energy }, { time: t(ta), vel: 0.95 * energy }],
            lead: [],
            bells: [],
            lengthTicks: CADENCE_TICKS
        };
        if (tension >= LEAD_FROM) {
            const [five, eight] = stingers.placeFigure([theory.degreeToMidi(key, V), theory.degreeToMidi(key, 7)], RANGES.lead);
            hit.lead = [noteEvent(0, ta, five, 0.85 * energy), noteEvent(ta, DA_TICKS, eight, 0.85 * energy)];
        }
        if (tension >= BELLS_FROM) {
            const arp = stingers.placeFigure([0, 2, 4, 7, 9, 11, 14].map((d) => theory.degreeToMidi(key, d)), RANGES.bells);
            hit.bells = arp.map((midi, i) => noteEvent(ta + i * STEP, 4 * STEP, midi, 0.45));
        }
        return hit;
    }

    /**
     * opts: { key (mayor de destino), beats (del fill), tension 0..1, from (acorde de la
     * pregunta o null) }. Devuelve { fill, stinger }: el fill empieza en su tick 0 y el
     * stinger en el golpe; cada uno con su lengthTicks.
     */
    function buildRevealCadence(opts) {
        const tension = clamp(opts.tension);
        const energy = energyOf(tension);
        const v = cadenceVoicings(opts.key, opts.from || null);
        return {
            fill: buildFill(opts.key, v, opts.beats, energy),
            stinger: buildHit(opts.key, v, tension, energy),
            voicings: v
        };
    }

    return { CADENCE_TICKS, LEAD_FROM, STAB_FROM, BELLS_FROM, brightnessHz, cadenceVoicings, buildRevealCadence };
});
