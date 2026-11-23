/**
 * @fileoverview Modelo del editor de la canción (pestaña «Música» del admin): pasa la
 * canción guardada (acordes con el compás en que entran) a una rejilla de 8 compases
 * y de vuelta. Un compás de la rejilla entra con acorde propio (`entry`) o mantiene el
 * anterior. Datos puros, sin DOM.
 *
 * Export dual (Jest/Node con require; navegador en self.XiroMusic.song).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.song = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const BARS = 8;

    /**
     * Canción con la que arranca el editor: La menor con Am, Fmaj7, C y G7.
     * @returns {{tonic: number, mode: string, chords: Array<{bar: number, root: number, quality: string}>}}
     */
    function exampleSong() {
        return {
            tonic: 9,
            mode: 'minor',
            chords: [
                { bar: 1, root: 9, quality: 'min' },
                { bar: 3, root: 5, quality: 'maj7' },
                { bar: 5, root: 0, quality: 'maj' },
                { bar: 7, root: 7, quality: 'dom7' }
            ]
        };
    }

    /**
     * Rejilla de 8 compases de una canción. Un compás que mantiene el acorde copia el
     * del compás anterior.
     * @param {?{chords: Array}} song Canción guardada; null parte del ejemplo.
     * @returns {Array<{entry: boolean, root: number, quality: string}>}
     */
    function cellsFromSong(song) {
        const chords = (song || exampleSong()).chords;
        const cells = [];
        let current = chords[0];
        for (let bar = 1; bar <= BARS; bar++) {
            const entering = chords.find(function (chord) { return chord.bar === bar; });
            if (entering) current = entering;
            cells.push({ entry: Boolean(entering), root: current.root, quality: current.quality });
        }
        return cells;
    }

    /**
     * Canción de una rejilla. El compás 1 siempre entra; de los demás solo cuentan los
     * que tienen `entry` (lo escrito en un compás que mantiene el acorde se ignora).
     * @param {{tonic: number, mode: string, cells: Array<{entry: boolean, root: number, quality: string}>}} form
     * @returns {{tonic: number, mode: string, chords: Array<{bar: number, root: number, quality: string}>}}
     */
    function songFromCells(form) {
        const chords = [];
        form.cells.forEach(function (cell, index) {
            if (index === 0 || cell.entry) {
                chords.push({ bar: index + 1, root: cell.root, quality: cell.quality });
            }
        });
        return { tonic: form.tonic, mode: form.mode, chords: chords };
    }

    return { BARS, exampleSong, cellsFromSong, songFromCells };
});
