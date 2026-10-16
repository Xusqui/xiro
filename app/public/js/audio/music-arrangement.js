/**
 * @fileoverview Arreglo por secciones (horizontal): la música avanza por bloques de
 * 8 compases (intro → A → B → respiro → subida → …) y cada bloque decide qué capas
 * suenan, con qué estilo y en qué tonalidad. Determinista: (semilla, índice) da
 * siempre la misma sección, pero nunca se repite el bucle entero.
 *
 * Export dual (Jest con require; navegador en self.XiroMusic.arrangement).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        const req = module.require.bind(module);
        module.exports = factory(req('./music-prng.js'), req('./music-theory.js'), req('./music-tension.js'));
    } else {
        const m = root.XiroMusic;
        m.arrangement = factory(m.prng, m.theory, m.tension);
    }
})(typeof self !== 'undefined' ? self : this, function (prng, theory, tension) {
    'use strict';

    const SECTION_BARS = 8;

    /**
     * Tipos de sección del lobby. `layers`: nivel 0..1 de cada capa; el resto elige
     * el estilo de cada generador (music-scores.js).
     */
    const SECTION_TYPES = {
        intro: {
            layers: { pad: 1, brass: 0.7, piano: 0.7, bass: 0, drums: 0.5, arp: 0.9, melody: 0 },
            drums: 'intro', bass: 'none', arp: 'sparkle', brass: 'pickup', piano: 'arp', melody: 'none'
        },
        A: {
            layers: { pad: 0.7, brass: 0.8, piano: 0.75, bass: 1, drums: 1, arp: 0.7, melody: 1 },
            drums: 'pop', bass: 'pop', arp: 'sparse', brass: 'stabs', piano: 'stabs', melody: 'themeA'
        },
        B: {
            layers: { pad: 0.85, brass: 0.9, piano: 0.7, bass: 1, drums: 1, arp: 0.8, melody: 0.95 },
            drums: 'disco', bass: 'octave', arp: 'sparkle', brass: 'stabs', piano: 'stabs', melody: 'themeB'
        },
        break: {
            layers: { pad: 1, brass: 0, piano: 0.85, bass: 0.8, drums: 0.6, arp: 1, melody: 0.8 },
            drums: 'light', bass: 'pedal', arp: 'sparkle', brass: 'none', piano: 'arp', melody: 'response'
        },
        build: {
            layers: { pad: 0.8, brass: 1, piano: 0.8, bass: 1, drums: 1, arp: 0.35, melody: 0 },
            drums: 'build', bass: 'octave', arp: 'none', brass: 'pickup', piano: 'pulse', melody: 'none'
        }
    };

    // Formas posibles de cada vuelta (tras la intro); la semilla elige una por vuelta
    const FORMS = [
        ['A', 'A', 'B', 'break', 'build'],
        ['A', 'B', 'A', 'break', 'build'],
        ['A', 'B', 'B', 'break', 'build']
    ];
    const CYCLE_LENGTH = 5;

    /**
     * Tonalidad de toda la partida (lobby, marcador, tablero, revelación y podio): no
     * modula. La pregunta suena en su relativo menor (questionKey).
     */
    function baseKey(seed) {
        return { root: prng.createRng(seed, 'key').pick(theory.KEY_ROOTS), mode: 'ionian' };
    }

    function locate(seed, index) {
        if (index === 0) return { type: 'intro', cycle: 0, position: -1 };
        const cycle = Math.floor((index - 1) / CYCLE_LENGTH);
        const position = (index - 1) % CYCLE_LENGTH;
        const form = prng.createRng(seed, 'form:' + cycle).pick(FORMS);
        return { type: form[position], cycle: cycle, position: position };
    }

    /**
     * Plan de la sección `index` de la escena.
     * options.sections === false: siempre la misma sección A (para comparar A/B).
     */
    function planSection(seed, index, options) {
        const fixed = options && options.sections === false;
        const where = fixed ? { type: 'A', cycle: 0, position: 0 } : locate(seed, index);
        const prevType = fixed || index === 0 ? 'A' : locate(seed, index - 1).type;
        const type = SECTION_TYPES[where.type];
        const progressions = theory.PROGRESSIONS[where.type];
        const progRng = prng.createRng(seed, 'prog:' + where.type + ':' + where.cycle);
        return {
            index: fixed ? 0 : index,
            type: where.type,
            cycle: where.cycle,
            position: where.position,
            prevType: prevType,
            key: baseKey(seed),
            chords: progRng.pick(progressions),
            bars: SECTION_BARS,
            layers: Object.assign({}, type.layers),
            styles: { drums: type.drums, bass: type.bass, arp: type.arp, brass: type.brass, piano: type.piano, melody: type.melody },
            // Etiqueta para las variaciones propias de esta aparición de la sección
            variant: where.type + ':' + (fixed ? 0 : index),
            // Clímax: el tema B y la A de las vueltas impares; las trompetas doblan el tema
            climax: where.type === 'B' || (where.type === 'A' && where.cycle % 2 === 1)
        };
    }

    /*
     * Pregunta: en el relativo menor del lobby (mismas notas, color de suspense), un
     * acorde por compás en frases de 4. Con calma, las frases alternan dos progresiones
     * (i–VI–iv–v y i–iv–VI–v) para que una pregunta larga no sea el mismo bucle; con
     * tensión alta, acordes suspendidos y pedal de tónica en el bajo.
     */
    const QUESTION_CHORDS = {
        calm: [{ d: 0, k: 'add9' }, { d: 5, k: 'seventh' }, { d: 3, k: 'seventh' }, { d: 4, k: 'sus4' }],
        calmAlt: [{ d: 0, k: 'add9' }, { d: 3, k: 'seventh' }, { d: 5, k: 'seventh' }, { d: 4, k: 'sus4' }],
        tense: [{ d: 0, k: 'sus2' }, { d: 6, k: 'triad' }, { d: 5, k: 'triad' }, { d: 4, k: 'sus4' }]
    };
    const QUESTION_PHRASE = 4;

    /** Acorde del compás `index` de la pregunta con la armonía `harmony` ('calm' | 'tense'). */
    function questionChord(index, harmony) {
        const phrase = Math.floor(index / QUESTION_PHRASE);
        const chords = harmony === 'tense' ? QUESTION_CHORDS.tense : QUESTION_CHORDS[phrase % 2 ? 'calmAlt' : 'calm'];
        return chords[index % QUESTION_PHRASE];
    }

    function questionKey(seed) {
        return { root: baseKey(seed).root - 3, mode: 'aeolian' };
    }

    /**
     * Plan del compás `index` de la pregunta con la tensión actual (secciones de 1 compás).
     * question: { final } o null; la última pregunta entra con timbal y platillo.
     */
    function planQuestionBar(seed, index, t, question) {
        const params = tension.tensionParams(t);
        return {
            index: index,
            type: 'question',
            cycle: 0,
            position: index % QUESTION_PHRASE,
            prevType: 'question',
            key: questionKey(seed),
            chords: [questionChord(index, params.harmony)],
            nextChord: questionChord(index + 1, params.harmony),
            finalEntry: index === 0 && Boolean(question && question.final),
            bars: 1,
            phrase: { startBar: index, bars: QUESTION_PHRASE },
            pedal: params.harmony === 'tense',
            layers: params.layers,
            styles: { drums: params.drums, bass: params.bass, arp: params.arp, brass: params.brass, piano: params.piano, melody: 'none' },
            variant: 'question:' + index,
            climax: false,
            tension: t
        };
    }

    return {
        SECTION_BARS, SECTION_TYPES, FORMS, CYCLE_LENGTH, QUESTION_CHORDS,
        baseKey, questionKey, questionChord, planSection, planQuestionBar
    };
});
