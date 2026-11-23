/**
 * @fileoverview ABC -> canción de XiRo (los ajustes de música): tónica y modo, tempo, un acorde por
 * compás (el vigente al empezar cada compás, hasta 8) y un motivo con las notas de los dos primeros
 * compases. Solo una voz y 4/4; lo que no cabe se omite y se avisa con un código en `warnings`.
 * Datos puros, sin DOM.
 *
 * Export dual (Jest/Node con require; navegador en self.XiroMusic.abcImport).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            () => module.require('./music-abc-parse.js'), () => module.require('./music-abc-keys.js'),
            () => module.require('./music-abc-text.js'), () => module.require('./music-motif.js')
        );
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.abcImport = factory(
            () => root.XiroMusic.abcParse, () => root.XiroMusic.abcKeys, () => root.XiroMusic.abcText, () => root.XiroMusic.motif
        );
    }
})(typeof self !== 'undefined' ? self : this, function (parseOf, keysOf, textOf, motifOf) {
    'use strict';

    const STEPS_PER_BAR = 16;
    const MAX_BARS = 8;
    const MOTIF_STEPS = 2 * STEPS_PER_BAR;
    const TEMPO = { min: 80, max: 140 };
    const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

    /** Grado (con octava) de la escala mayor del relativo; una nota fuera de la escala baja al grado de debajo. */
    function degreeIndex(midi, relativeMajor) {
        const offset = midi - relativeMajor;
        const octave = Math.floor(offset / 12);
        const semitones = offset - 12 * octave;
        const index = MAJOR_SCALE.reduce((best, step, position) => (step <= semitones ? position : best), 0);
        return octave * 7 + index;
    }

    /** ¿Entra el acorde a mitad de compás? (los compases cuentan desde el final de la anacrusa) */
    function isMidBar(time, pickup) {
        const fraction = (((time - pickup) % 1) + 1) % 1;
        return fraction > textOf().EPS && fraction < 1 - textOf().EPS;
    }

    /** Acordes por compás: [{ bar, root, quality }] con los cambios, más los avisos que se detectan. */
    function songChords(tune, warnings) {
        const eps = textOf().EPS;
        const events = [];
        for (const item of tune.chords) {
            const parsed = keysOf().parseChord(item.symbol);
            if (parsed) events.push({ ...parsed, time: item.time });
            else warnings.add('CHORD_UNKNOWN');
        }
        if (!events.length) throw textOf().codedError('ABC_NO_CHORDS');
        const bars = Math.max(1, Math.ceil(tune.total - tune.pickup - eps));
        if (bars > MAX_BARS) warnings.add('BARS_TRUNCATED');
        if (events.some((event) => event.time < tune.pickup + MAX_BARS && isMidBar(event.time, tune.pickup))) warnings.add('CHORDS_MIDBAR');
        return collapse(events, Math.min(bars, MAX_BARS), tune.pickup);
    }

    function collapse(events, bars, pickup) {
        const eps = textOf().EPS;
        const chords = [];
        for (let bar = 1; bar <= bars; bar++) {
            const start = pickup + bar - 1;
            const active = events.filter((event) => event.time <= start + eps).at(-1) || events[0];
            const previous = chords.at(-1);
            if (!previous || previous.root !== active.root || previous.quality !== active.quality) {
                chords.push({ bar, root: active.root, quality: active.quality });
            }
        }
        return chords;
    }

    /** Notas de los dos primeros compases como ritmo [inicio, duración] en pasos de semicorchea. */
    function motifSlots(tune) {
        const slots = [];
        for (const note of tune.notes) {
            const start = Math.round((note.time - tune.pickup) * STEPS_PER_BAR);
            if (start < 0 || start >= MOTIF_STEPS || (slots.length && start <= slots.at(-1).start)) continue;
            slots.push({ start, len: Math.max(1, Math.round(note.dur * STEPS_PER_BAR)), midi: note.midi });
        }
        slots.forEach((slot, index) => {
            const limit = index + 1 < slots.length ? slots[index + 1].start : MOTIF_STEPS;
            slot.len = Math.min(slot.len, limit - slot.start);
        });
        return slots.slice(0, motifOf().LIMITS.maxNotes);
    }

    function songMotif(tune, warnings) {
        const slots = motifSlots(tune);
        if (!slots.length) return null;
        const degrees = slots.map((slot) => degreeIndex(slot.midi, tune.key.relativeMajor));
        const motif = { rhythm: slots.map((slot) => [slot.start, slot.len]), rel: degrees.map((degree) => degree - degrees[0]) };
        const { minDegree, maxDegree } = motifOf().LIMITS;
        if (motif.rel.some((degree) => degree < minDegree || degree > maxDegree)) warnings.add('MOTIF_RANGE');
        else if (motifOf().motifError(motif)) warnings.add('MOTIF_OMITTED');
        else return motif;
        return null;
    }

    function tempoOf(tune, warnings) {
        if (tune.tempo === null) return null;
        const clamped = Math.min(TEMPO.max, Math.max(TEMPO.min, Math.round(tune.tempo)));
        if (clamped !== Math.round(tune.tempo)) warnings.add('TEMPO_CLAMPED');
        return clamped;
    }

    /**
     * Convierte un ABC en una canción.
     * @param {string} abc Texto ABC (la primera pieza, la primera voz, en 4/4)
     * @returns {{song: {tonic: number, mode: string, chords: Array, motif?: Object}, tempo: ?number, title: string, warnings: string[]}}
     * @throws {Error} con `code`: ABC_EMPTY, ABC_KEY_MISSING, ABC_KEY_INVALID, ABC_METER o ABC_NO_CHORDS
     */
    function abcToSong(abc) {
        const tune = parseOf().parseAbc(abc);
        const warnings = new Set();
        if (tune.key.approximated) warnings.add('KEY_APPROXIMATED');
        const song = { tonic: tune.key.tonic, mode: tune.key.mode, chords: songChords(tune, warnings) };
        const motif = songMotif(tune, warnings);
        if (motif) song.motif = motif;
        const tempo = tempoOf(tune, warnings);
        return { song, tempo, title: tune.title, warnings: [...warnings] };
    }

    return { abcToSong };
});
