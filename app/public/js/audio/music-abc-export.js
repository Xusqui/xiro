/**
 * @fileoverview Canción de XiRo -> ABC (formato estándar de intercambio): tonalidad, tempo, un acorde
 * entre comillas en el compás donde entra y el motivo en los dos primeros compases (el resto, silencios;
 * la melodía de las demás secciones la genera el motor). Semicorcheas (L:1/16), 4/4, 8 compases.
 * El motivo empieza en la tónica (octava 4) y sus grados caen sobre la armadura: no hace falta ningún
 * accidental. Datos puros, sin DOM.
 *
 * Export dual (Jest/Node con require; navegador en self.XiroMusic.abcExport).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(() => module.require('./music-abc-keys.js'));
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.abcExport = factory(() => root.XiroMusic.abcKeys);
    }
})(typeof self !== 'undefined' ? self : this, function (keysOf) {
    'use strict';

    const STEPS_PER_BAR = 16;
    const BARS = 8;
    const MOTIF_STEPS = 2 * STEPS_PER_BAR;
    const BARS_PER_LINE = 4;
    const DEFAULT_TITLE = 'XiRo';
    const DEFAULT_TEMPO = 112;

    /** Nota ABC de un grado: `rel` pasos de escala desde la tónica escrita en la octava 4. */
    function noteName(tonicLetter, rel) {
        const keys = keysOf();
        const index = 28 + tonicLetter + rel;
        const letter = keys.LETTERS[((index % 7) + 7) % 7];
        const octave = Math.floor(index / 7);
        if (octave <= 4) return letter + ','.repeat(4 - octave);
        return letter.toLowerCase() + "'".repeat(octave - 5);
    }

    const length = (steps) => (steps === 1 ? '' : String(steps));

    /** Línea de tiempo de los dos compases del motivo: notas y silencios que llenan los 32 pasos. */
    function timeline(motif) {
        const events = [];
        let cursor = 0;
        if (motif) {
            motif.rhythm.forEach((slot, index) => {
                if (slot[0] > cursor) events.push({ start: cursor, len: slot[0] - cursor, rel: null });
                events.push({ start: slot[0], len: slot[1], rel: motif.rel[index] });
                cursor = slot[0] + slot[1];
            });
        }
        if (cursor < MOTIF_STEPS) events.push({ start: cursor, len: MOTIF_STEPS - cursor, rel: null });
        return events;
    }

    /** Parte en dos las figuras que cruzan una barra de compás (las notas, ligadas). */
    function splitAtBars(events) {
        const parts = [];
        for (const event of events) {
            const barEnd = (Math.floor(event.start / STEPS_PER_BAR) + 1) * STEPS_PER_BAR;
            if (event.start + event.len <= barEnd) {
                parts.push(event);
            } else {
                parts.push({ ...event, len: barEnd - event.start, tied: event.rel !== null });
                parts.push({ ...event, start: barEnd, len: event.start + event.len - barEnd });
            }
        }
        return parts;
    }

    function token(event, tonicLetter) {
        const body = event.rel === null ? 'z' : noteName(tonicLetter, event.rel);
        return body + length(event.len) + (event.tied ? '-' : '');
    }

    function barText(barIndex, parts, chordText, tonicLetter) {
        const inBar = parts.filter((part) => Math.floor(part.start / STEPS_PER_BAR) === barIndex);
        const tokens = inBar.length ? inBar.map((part) => token(part, tonicLetter)) : ['z' + STEPS_PER_BAR];
        return (chordText ? `"${chordText}"` : '') + tokens.join(' ');
    }

    function chordAt(song, bar) {
        const keys = keysOf();
        const chord = song.chords.find((item) => item.bar === bar);
        return chord ? keys.chordText(chord.root, chord.quality, song.mode) : '';
    }

    function cleanTitle(title) {
        const text = typeof title === 'string' ? title.replace(/[\r\n]+/g, ' ').trim() : '';
        return text || DEFAULT_TITLE;
    }

    /**
     * Escribe la canción en ABC.
     * @param {{song: {tonic: number, mode: string, chords: Array, motif?: Object}, tempo?: number, title?: string}} params
     * @returns {string} Texto ABC (4/4, L:1/16, 8 compases)
     */
    function songToAbc({ song, tempo, title }) {
        const keys = keysOf();
        const { tonicLetter } = keys.letterIndexes(song.tonic, song.mode);
        const parts = splitAtBars(timeline(song.motif));
        const bars = Array.from({ length: BARS }, (_, index) => barText(index, parts, chordAt(song, index + 1), tonicLetter));
        const lines = [];
        for (let first = 0; first < BARS; first += BARS_PER_LINE) lines.push(bars.slice(first, first + BARS_PER_LINE).join('|') + '|');
        lines[lines.length - 1] += ']';
        const bpm = Number.isFinite(tempo) ? Math.round(tempo) : DEFAULT_TEMPO;
        const header = ['X:1', `T:${cleanTitle(title)}`, 'M:4/4', 'L:1/16', `Q:1/4=${bpm}`, `K:${keys.keyText(song.tonic, song.mode)}`];
        return header.concat(lines).join('\n') + '\n';
    }

    return { songToAbc };
});
