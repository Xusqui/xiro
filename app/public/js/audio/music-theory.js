/**
 * @fileoverview Teoría musical pura para la música generativa: modos, grados,
 * acordes diatónicos, progresiones por tipo de sección y enlace de voces.
 *
 * Todo se calcula en GRADOS de la escala (0 = tónica, 7 = tónica una octava
 * arriba) y solo al final se pasa a MIDI: así ninguna nota sale de la escala.
 * Una tonalidad es { root: <MIDI de la tónica>, mode: 'ionian' | ... }.
 * Los tiempos van en ticks del Transport (PPQ 192: semicorchea = 48 ticks).
 *
 * Export dual (Jest con require; navegador en self.XiroMusic.theory).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.theory = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const PPQ = 192;
    const STEP_TICKS = PPQ / 4;          // semicorchea
    const STEPS_PER_BAR = 16;
    const BAR_TICKS = STEP_TICKS * STEPS_PER_BAR;
    const TRIPLET_TICKS = PPQ / 3;       // corchea de tresillo

    const MODES = {
        ionian: [0, 2, 4, 5, 7, 9, 11],
        lydian: [0, 2, 4, 6, 7, 9, 11],
        mixolydian: [0, 2, 4, 5, 7, 9, 10],
        dorian: [0, 2, 3, 5, 7, 9, 10],
        aeolian: [0, 2, 3, 5, 7, 8, 10]
    };

    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Grados (desde la fundamental del acorde) que forman cada tipo de acorde
    const CHORD_SHAPES = {
        triad: [0, 2, 4],
        seventh: [0, 2, 4, 6],
        sus2: [0, 1, 4],
        sus4: [0, 3, 4],
        add9: [0, 2, 4, 8]
    };

    // Tónicas posibles (MIDI, octava 4)
    const KEY_ROOTS = [60, 62, 65, 67];

    const c = (d, k) => ({ d: d, k: k });

    /**
     * Progresiones de 8 compases por tipo de sección (un acorde por compás).
     * A: heroicas a lo Falcon Crest (I-IV-I-V); B: giran al relativo menor;
     * break: lentas y abiertas; build: pedal de dominante que pide resolver.
     */
    const PROGRESSIONS = {
        intro: [
            [c(0, 'add9'), c(3, 'seventh'), c(0, 'add9'), c(3, 'seventh'), c(5, 'seventh'), c(3, 'seventh'), c(1, 'seventh'), c(4, 'sus4')]
        ],
        A: [
            [c(0, 'triad'), c(3, 'triad'), c(0, 'triad'), c(4, 'triad'), c(0, 'triad'), c(3, 'triad'), c(1, 'seventh'), c(4, 'sus4')],
            [c(0, 'add9'), c(2, 'seventh'), c(3, 'seventh'), c(4, 'triad'), c(0, 'add9'), c(2, 'seventh'), c(3, 'seventh'), c(4, 'sus4')],
            [c(0, 'triad'), c(5, 'seventh'), c(3, 'triad'), c(4, 'triad'), c(0, 'triad'), c(5, 'seventh'), c(1, 'seventh'), c(4, 'seventh')]
        ],
        B: [
            [c(5, 'seventh'), c(3, 'seventh'), c(0, 'add9'), c(4, 'triad'), c(5, 'seventh'), c(3, 'seventh'), c(1, 'seventh'), c(4, 'sus4')],
            [c(3, 'seventh'), c(4, 'triad'), c(2, 'seventh'), c(5, 'seventh'), c(3, 'seventh'), c(4, 'triad'), c(0, 'add9'), c(4, 'sus4')],
            [c(1, 'seventh'), c(4, 'triad'), c(0, 'seventh'), c(5, 'seventh'), c(1, 'seventh'), c(4, 'triad'), c(2, 'seventh'), c(4, 'sus4')]
        ],
        break: [
            [c(3, 'seventh'), c(3, 'seventh'), c(0, 'add9'), c(0, 'add9'), c(5, 'seventh'), c(5, 'seventh'), c(1, 'seventh'), c(4, 'sus4')],
            [c(5, 'seventh'), c(2, 'seventh'), c(3, 'seventh'), c(0, 'add9'), c(5, 'seventh'), c(2, 'seventh'), c(3, 'seventh'), c(4, 'sus4')]
        ],
        build: [
            [c(4, 'sus4'), c(4, 'triad'), c(4, 'sus4'), c(4, 'triad'), c(3, 'triad'), c(3, 'triad'), c(4, 'sus4'), c(4, 'seventh')]
        ],
        // Podio: espera solemne mientras salen los puestos, y cierre sostenido tras el ganador
        podium: [
            [c(0, 'add9'), c(3, 'seventh'), c(5, 'seventh'), c(3, 'triad'), c(1, 'seventh'), c(4, 'sus4'), c(4, 'triad'), c(0, 'add9')]
        ],
        podiumEnd: [
            [c(0, 'add9'), c(0, 'add9'), c(3, 'seventh'), c(3, 'seventh'), c(0, 'add9'), c(0, 'add9'), c(0, 'add9'), c(0, 'add9')]
        ]
    };

    function midiToName(midi) {
        return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
    }

    /** Grado de la escala (puede ser negativo o pasar de 7) a nota MIDI. */
    function degreeToMidi(key, degree) {
        const scale = MODES[key.mode];
        const octave = Math.floor(degree / 7);
        return key.root + octave * 12 + scale[degree - octave * 7];
    }

    function isInScale(midi, key) {
        const pitchClass = (((midi - key.root) % 12) + 12) % 12;
        return MODES[key.mode].indexOf(pitchClass) !== -1;
    }

    /** Grados [más bajo, más alto] cuyas notas caen dentro de [lowMidi, highMidi]. */
    function degreeRange(key, lowMidi, highMidi) {
        let low = -21;
        while (degreeToMidi(key, low) < lowMidi) low++;
        let high = low;
        while (degreeToMidi(key, high + 1) <= highMidi) high++;
        return [low, high];
    }

    function chordDegrees(degree, kind) {
        return CHORD_SHAPES[kind].map(function (offset) { return degree + offset; });
    }

    function chordMidi(key, degree, kind) {
        return chordDegrees(degree, kind).map(function (d) { return degreeToMidi(key, d); });
    }

    /** Pliega las notas por octavas dentro de [low, high] (sin repetir) y las ordena. */
    function fitToRange(notes, low, high) {
        const out = [];
        notes.forEach(function (note) {
            let n = note;
            while (n < low) n += 12;
            while (n > high) n -= 12;
            if (n >= low && out.indexOf(n) === -1) out.push(n);
        });
        return out.sort(function (a, b) { return a - b; });
    }

    /** ¿El grado es nota del acorde? (compara por clase de grado, sin octava) */
    function isChordTone(degree, chordRoot, kind) {
        const norm = ((degree % 7) + 7) % 7;
        return CHORD_SHAPES[kind].some(function (offset) {
            return (((chordRoot + offset) % 7) + 7) % 7 === norm;
        });
    }

    function octaveOptions(note, low, high) {
        const out = [];
        for (let n = note - 48; n <= high; n += 12) if (n >= low) out.push(n);
        return out;
    }

    /**
     * Enlace de voces: de todas las inversiones del acorde dentro de [low, high],
     * la que menos se mueve respecto al acorde anterior (como lo tocaría un teclista).
     */
    function voiceLead(prev, chordNotes, low, high) {
        const options = chordNotes.map(function (n) { return octaveOptions(n, low, high); });
        const ref = prev && prev.length ? prev : [Math.round((low + high) / 2)];
        const refMean = ref.reduce(function (s, n) { return s + n; }, 0) / ref.length;
        let best = null;
        let bestCost = Infinity;
        (function walk(i, picked) {
            if (i === options.length) {
                const voicing = picked.slice().sort(function (a, b) { return a - b; });
                if (voicing[voicing.length - 1] - voicing[0] > 14) return; // acorde cerrado
                const mean = voicing.reduce(function (s, n) { return s + n; }, 0) / voicing.length;
                const cost = voicing.length === ref.length
                    ? voicing.reduce(function (s, n, k) { return s + Math.abs(n - ref[k]); }, 0)
                    : Math.abs(mean - refMean) * voicing.length;
                if (cost < bestCost) { bestCost = cost; best = voicing; }
                return;
            }
            options[i].forEach(function (n) {
                if (picked.indexOf(n) === -1) walk(i + 1, picked.concat([n]));
            });
        })(0, []);
        return best || fitToRange(chordNotes, low, high);
    }

    return {
        PPQ, STEP_TICKS, STEPS_PER_BAR, BAR_TICKS, TRIPLET_TICKS,
        MODES, CHORD_SHAPES, KEY_ROOTS, PROGRESSIONS,
        midiToName, degreeToMidi, isInScale, degreeRange, chordDegrees, chordMidi,
        fitToRange, isChordTone, voiceLead
    };
});
