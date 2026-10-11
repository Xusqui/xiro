/**
 * @fileoverview Generadores puros de acompañamiento al estilo de plató de los 80:
 * bajo con notas de paso, campanas (arpegio tipo DX7), golpes y anacrusas en
 * tresillo de los metales y pad de cuerdas con enlace de voces.
 * Bajo y campanas trabajan en pasos de semicorchea; metales y pad, en ticks.
 *
 * Export dual (Jest con require; navegador en self.XiroMusic.parts).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(module.require('./music-theory.js'));
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.parts = factory(root.XiroMusic.theory);
    }
})(typeof self !== 'undefined' ? self : this, function (theory) {
    'use strict';

    const BAR = theory.STEPS_PER_BAR;
    const STEP = theory.STEP_TICKS;
    const BAR_TICKS = theory.BAR_TICKS;
    const APPROACH = 'approach';

    // Bajo: [paso, duración, grado sobre la fundamental | 'approach' = paso hacia el acorde siguiente]
    const BASS_PATTERNS = {
        pop: [
            [[0, 6, 0], [6, 2, 0], [8, 4, 4], [12, 2, 7], [14, 2, APPROACH]],
            [[0, 3, 0], [3, 3, 0], [6, 2, 7], [8, 4, 0], [12, 2, 4], [14, 2, APPROACH]],
            [[0, 4, 0], [4, 2, 7], [6, 2, 0], [8, 6, 4], [14, 2, APPROACH]]
        ],
        octave: [
            [[0, 2, 0], [2, 2, 7], [4, 2, 0], [6, 2, 7], [8, 2, 0], [10, 2, 7], [12, 2, 0], [14, 2, APPROACH]]
        ],
        pedal: [[[0, 12, 0], [12, 4, 4]]]
    };

    // Golpes de metal por compás [paso, duración en semicorcheas]: a contratiempo, de plató
    const STAB_PATTERNS = [
        [[6, 1], [14, 2]],
        [[3, 1], [6, 1], [14, 2]],
        [[0, 2], [6, 1], [10, 1], [14, 1]],
        [[10, 1], [14, 2]]
    ];

    const ARP_SHAPES = [[0, 1, 2, 3, 2, 1, 0, 1], [0, 2, 1, 3, 0, 2, 1, 3], [0, 1, 2, 3, 0, 1, 2, 3]];

    function bassLine(rng, chords, style, nextRoot) {
        const patterns = BASS_PATTERNS[style];
        if (!patterns) return [];
        const notes = [];
        let pattern = null;
        chords.forEach(function (chord, bar) {
            if (bar % 2 === 0) pattern = rng.pick(patterns);
            const next = bar + 1 < chords.length ? chords[bar + 1].d : nextRoot;
            pattern.forEach(function (slot) {
                const degree = slot[2] === APPROACH ? next - 1 : chord.d + slot[2];
                notes.push({ step: bar * BAR + slot[0], len: slot[1], degree: degree });
            });
        });
        return notes;
    }

    /** Campanas: arpegio en corcheas ('sparkle') o notas sueltas ('sparse') sobre acordes en MIDI. */
    function bellLine(rng, chordNotes, style) {
        if (style !== 'sparkle' && style !== 'sparse') return [];
        const notes = [];
        const shape = rng.pick(ARP_SHAPES);
        chordNotes.forEach(function (tones, bar) {
            const lift = bar >= 4 && tones[tones.length - 1] + 12 <= 93 ? 12 : 0; // segunda mitad, octava arriba
            if (style === 'sparse') {
                [4, 10, 12].forEach(function (s, i) {
                    notes.push({ step: bar * BAR + s, len: 2, midi: tones[(i + bar) % tones.length] + lift });
                });
                return;
            }
            shape.forEach(function (index, i) {
                notes.push({ step: bar * BAR + i * 2, len: 2, midi: tones[index % tones.length] + lift });
            });
        });
        return notes;
    }

    /** Anacrusa en tresillo de corcheas en el último tiempo (ta-ta-ta → ¡TA! en la sección siguiente). */
    function tripletPickup(voicing, lastBar) {
        const start = lastBar * BAR_TICKS + 3 * theory.PPQ;
        return voicing.slice(-3).map(function (note, i) {
            return { tick: start + i * theory.TRIPLET_TICKS, len: theory.TRIPLET_TICKS, notes: [note], vel: 0.6 + i * 0.12 };
        });
    }

    function stabLine(rng, voicings, prevType) {
        const out = [];
        const openingHit = prevType === 'build' || prevType === 'intro';
        if (openingHit) out.push({ tick: 0, len: 4 * STEP, notes: voicings[0], vel: 0.95 });
        let pattern = null;
        voicings.forEach(function (voicing, bar) {
            if (bar % 2 === 0) pattern = rng.pick(STAB_PATTERNS);
            pattern.forEach(function (slot) {
                if (openingHit && bar === 0 && slot[0] < 4) return;
                out.push({ tick: bar * BAR_TICKS + slot[0] * STEP, len: slot[1] * STEP, notes: voicing, vel: slot[0] % 4 === 2 ? 0.75 : 0.62 });
            });
        });
        return out;
    }

    /**
     * Metales: 'stabs' (golpes a contratiempo + golpe orquestal si se viene de la intro
     * o de una subida) o 'pickup' (acorde que crece y anacrusa en tresillo). En ticks.
     */
    function brassLine(rng, voicings, style, prevType) {
        if (style === 'stabs') return stabLine(rng, voicings, prevType);
        if (style !== 'pickup') return [];
        const swellFrom = voicings.length - 2;
        return [{ tick: swellFrom * BAR_TICKS, len: 2 * BAR_TICKS - theory.PPQ, notes: voicings[swellFrom], vel: 0.35, sus: true }]
            .concat(tripletPickup(voicings[voicings.length - 1], voicings.length - 1));
    }

    /** Voicings enlazados (cada acorde, el que menos se mueve desde el anterior). */
    function voiceChords(key, chords, range) {
        let prev = null;
        return chords.map(function (c) {
            prev = theory.voiceLead(prev, theory.chordMidi(key, c.d, c.k), range[0], range[1]);
            return prev;
        });
    }

    /** Pad de cuerdas: une compases seguidos con el mismo acorde en una sola nota larga. */
    function padLine(voicings, chords, vel) {
        const events = [];
        chords.forEach(function (chord, bar) {
            const prev = events[events.length - 1];
            if (prev && prev.chord.d === chord.d && prev.chord.k === chord.k) {
                prev.len += BAR_TICKS;
                return;
            }
            events.push({ chord: chord, tick: bar * BAR_TICKS, len: BAR_TICKS, notes: voicings[bar], vel: vel });
        });
        return events.map(function (e) { return { tick: e.tick, len: e.len, notes: e.notes, vel: e.vel }; });
    }

    return { BASS_PATTERNS, STAB_PATTERNS, bassLine, bellLine, brassLine, voiceChords, padLine };
});
