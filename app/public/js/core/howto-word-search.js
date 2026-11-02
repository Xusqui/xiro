/**
 * @fileoverview Guion de la instrucción «word_search»: línea de tiempo (ms) de gestos sobre el
 * escenario de howto-word-search-ui.js, sincronizada con la locución. Los gestos arrancan a una
 * fracción de la duración de su clip (T.dur, medida de los mp3 de cada idioma) para que encajen
 * con la voz aunque cambie el idioma; la escena siguiente espera al más lento de voz y gesto.
 * ES5: lo carga también tv.html.
 */
(function (root) {
    'use strict';

    const DRAG_MS = 3600;
    const TAP_TAP_MS = 4810;
    const PAD_MS = 500;
    const INTRO_MS = 3200; // rótulo «Sopa de letras · Instrucciones» antes de la primera escena

    function timeline(ui, T, base) {
        // El guion se escribe desde 0; la intro lo desplaza INTRO_MS
        const h = {
            dur: base.dur,
            at: function (t, fn) { base.at(t + INTRO_MS, fn); },
            scene: function (t, u, step, clip) { base.scene(t + INTRO_MS, u, step, clip); }
        };
        function drag(t, i) {
            const list = ui.cellsOf(i);
            const first = list[0];
            const last = list[list.length - 1];
            h.at(t, function () { ui.fingerTo(first[0], first[1], false); ui.fingerOn(true); });
            h.at(t + 700, function () { ui.fingerDown(true); ui.mark([first], 'howto-sel'); });
            h.at(t + 950, function () { ui.fingerTo(last[0], last[1], true); });
            list.forEach(function (cell, k) {
                if (k > 0) h.at(t + 950 + (k * 1100) / list.length, function () { ui.mark([cell], 'howto-sel'); });
            });
            h.at(t + 2550, function () { ui.fingerDown(false); });
            h.at(t + 2700, function () { ui.setFound(i); });
            h.at(t + DRAG_MS, function () { ui.fingerOn(false); });
        }
        function tapTap(t, i) {
            const list = ui.cellsOf(i);
            const first = list[0];
            const last = list[list.length - 1];
            h.at(t, function () { ui.fingerTo(first[0], first[1], false); ui.fingerOn(true); });
            h.at(t + 700, function () { ui.fingerDown(true); });
            h.at(t + 880, function () { ui.fingerDown(false); ui.mark([first], 'howto-anchor'); });
            h.at(t + 1980, function () { ui.fingerTo(last[0], last[1], true); });
            h.at(t + 3280, function () { ui.fingerDown(true); });
            h.at(t + 3460, function () { ui.fingerDown(false); ui.clearSel(); ui.mark(list, 'howto-sel'); });
            h.at(t + 3910, function () { ui.setFound(i); });
            h.at(t + TAP_TAP_MS, function () { ui.fingerOn(false); });
        }
        // Gesto que arranca a `frac` del clip, pero con holgura para que no se salga de él
        function startAt(s, clip, frac, length) {
            return s + Math.min(Math.round(h.dur(clip) * frac), Math.max(300, h.dur(clip) - length));
        }
        function endOf(s, clip, gestureStart, length) {
            return Math.max(s + h.dur(clip), gestureStart + length) + PAD_MS;
        }

        base.at(0, function () { ui.reset(); });
        base.at(INTRO_MS - 100, function () { ui.intro(false); });
        h.scene(0, ui, 0, 0);
        h.at(Math.round(h.dur(0) * 0.5), function () { ui.pulseChips(true); });
        h.at(Math.round(h.dur(0) * 0.75), function () { ui.pulseChips(false); });
        let s = h.dur(0) + PAD_MS;

        h.scene(s, ui, 1, 1);
        let g = startAt(s, 1, 0.28, DRAG_MS);
        drag(g, 0);
        s = endOf(s, 1, g, DRAG_MS);

        h.scene(s, ui, 2, 2);
        g = startAt(s, 2, 0.2, TAP_TAP_MS);
        tapTap(g, 1);
        s = endOf(s, 2, g, TAP_TAP_MS);

        h.scene(s, ui, null, 3);
        g = startAt(s, 3, 0.55, DRAG_MS);
        drag(g, 2);
        s = endOf(s, 3, g, DRAG_MS) + PAD_MS;

        h.scene(s, ui, 3, 4);
        const hint = startAt(s, 4, 0.4, 1300);
        h.at(hint, function () { ui.fingerToChip(3); ui.fingerOn(true); });
        h.at(hint + 900, function () { ui.fingerDown(true); ui.tapChip(3, true); });
        h.at(hint + 1100, function () {
            ui.fingerDown(false); ui.tapChip(3, false); ui.hintChip(3);
            ui.mark([ui.cellsOf(3)[0]], 'howto-hint'); ui.fingerOn(false);
        });
        s = endOf(s, 4, hint, 1300) - PAD_MS;

        h.scene(s, ui, null, 5);
        g = startAt(s, 5, 0.38, DRAG_MS);
        h.at(g, function () { ui.unmark([ui.cellsOf(3)[0]], 'howto-hint'); });
        drag(g, 3);
        s = endOf(s, 5, g, DRAG_MS);

        h.scene(s, ui, 4, 6);
        const send = Math.round(h.dur(6) * 0.45);
        h.at(s + send, function () { ui.finishGlow(true); });
        h.at(s + send + 1500, function () { ui.finishGlow(false); ui.fingerToFinish(); ui.fingerOn(true); });
        h.at(s + send + 2200, function () { ui.fingerDown(true); ui.finishTap(true); });
        h.at(s + send + 2450, function () { ui.fingerDown(false); ui.fingerOn(false); ui.finishTap(false); ui.sent(true); });
        s = endOf(s, 6, s + send, 2450) + 300;

        h.scene(s, ui, 5, 7);
        return s + h.dur(7) + PAD_MS + INTRO_MS;
    }

    root.XiroHowTo.register('word_search', { createStage: root.XiroHowToUi.wordSearch.createStage, timeline: timeline });
})(typeof window !== 'undefined' ? window : this);
