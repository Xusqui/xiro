/**
 * @fileoverview Guion de la instrucción «fill_blanks» (completa la frase): línea de tiempo (ms) de gestos y efectos
 * de sonido sobre el escenario de howto-fill-blanks-ui.js, sincronizada con la locución. Cada gesto arranca a una
 * fracción de la duración de su clip (T.dur, medida de los mp3 de cada idioma) para que encaje con la voz aunque
 * cambie el idioma; la escena siguiente espera al más lento de voz y gesto. Orden: completar la frase, casillas por
 * letra, escribir el primer hueco, pedir una pista en el segundo (−30 %) y acabarlo, enviar, puntos por palabra
 * (20 sin pistas, 14 con una pista, un único bonus de tiempo) y la mitad de huecos = acierto. ES5: también tv.html.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;
    const PAD_MS = Kit.PAD_MS;
    const INTRO_MS = Kit.INTRO_MS;
    const KEY_MS = 330; // una letra cada KEY_MS
    const WORD1 = 20; // palabra sin pistas
    const WORD2 = 14; // 20 × 0,7: una pista
    const BONUS = 8; // bonus de tiempo único

    function timeline(ui, T, base) {
        const s0 = Kit.script(base, ui);
        const h = s0.h;
        const frac = s0.frac;
        const len1 = Array.from ? Array.from(T.words[0]).length : T.words[0].length;
        const len2 = Array.from ? Array.from(T.words[1]).length : T.words[1].length;

        /** Teclea las letras de un hueco de la `from`+1 a la última, una cada KEY_MS, desde el instante t */
        function typeWord(t, blank, from, len) {
            for (let k = from; k < len; k++) {
                h.at(t + (k - from) * KEY_MS, function () {
                    ui.fill(blank, k + 1);
                });
                h.sfx(t + (k - from) * KEY_MS, 'tap');
            }
            return t + (len - from) * KEY_MS;
        }

        // 0 · completar la frase
        h.scene(0, ui, 0, 0);
        h.sfx(200, 'pop');
        let s = h.dur(0) + PAD_MS;

        // 1 · una casilla por letra
        h.scene(s, ui, 0, 1);
        h.at(s + frac(1, 0.45), function () {
            ui.pulseBlanks(true);
        });
        h.sfx(s + frac(1, 0.45), 'pop');
        h.at(s + frac(1, 0.85), function () {
            ui.pulseBlanks(false);
        });
        s += h.dur(1) + PAD_MS;

        // 2 · tocar el primer hueco y escribir
        h.scene(s, ui, 1, 2);
        const tap = s + Math.min(frac(2, 0.1), 500);
        h.at(tap, function () {
            ui.fingerToBlank(0);
            ui.fingerOn(true);
        });
        h.at(tap + 450, function () {
            ui.fingerDown(true);
        });
        h.sfx(tap + 450, 'tap');
        h.at(tap + 600, function () {
            ui.fingerDown(false);
            ui.focusBlank(0, true);
            ui.fingerOn(false);
        });
        const typedEnd = typeWord(tap + 900, 0, 0, len1);
        h.at(typedEnd, function () {
            ui.focusBlank(0, false);
        });
        s = Math.max(s + h.dur(2), typedEnd + 200) + PAD_MS;

        // 3 · pedir una pista en el segundo hueco y acabarlo
        h.scene(s, ui, 2, 3);
        const hint = s + Math.min(frac(3, 0.15), 500);
        h.at(hint, function () {
            ui.fingerToHint(1);
            ui.fingerOn(true);
        });
        h.at(hint + 450, function () {
            ui.fingerDown(true);
            ui.hintTap(1, true);
        });
        h.sfx(hint + 450, 'tap');
        h.at(hint + 600, function () {
            ui.fingerDown(false);
            ui.hintTap(1, false);
            ui.fingerOn(false);
            ui.hint(1);
            ui.focusBlank(1, true);
        });
        h.sfx(hint + 600, 'pop');
        const typed2 = typeWord(hint + 1000, 1, 1, len2);
        h.at(typed2, function () {
            ui.focusBlank(1, false);
        });
        s = Math.max(s + h.dur(3), typed2 + 200) + PAD_MS;

        // 4 · enviar
        h.scene(s, ui, 3, 4);
        const send = s + Math.min(frac(4, 0.2), 500);
        h.at(send, function () {
            ui.fingerToSend();
            ui.fingerOn(true);
            ui.sendGlow(true);
        });
        h.at(send + 700, function () {
            ui.fingerDown(true);
            ui.sendTap(true);
        });
        h.sfx(send + 700, 'tap');
        h.at(send + 900, function () {
            ui.fingerDown(false);
            ui.sendTap(false);
            ui.sendGlow(false);
            ui.fingerOn(false);
            ui.sent(true);
        });
        h.sfx(send + 900, 'send');
        s = Math.max(s + h.dur(4), send + 1300) + PAD_MS;

        // 5 · puntos por palabra: las pistas valen menos y hay un único bonus de tiempo
        h.scene(s, ui, 4, 5);
        h.at(s, function () {
            ui.sent(false);
            ui.scoreClear();
            ui.totalOn(true);
            ui.scoreOn(true);
        });
        h.at(s + frac(5, 0.2), function () {
            ui.scoreRow('ok', T.labels[0] + ' · ' + T.sNoHint, '+' + WORD1);
        });
        h.sfx(s + frac(5, 0.2), 'ding');
        h.at(s + frac(5, 0.45), function () {
            ui.scoreRow('ok', T.labels[1] + ' · ' + T.sOneHint, '+' + WORD2);
        });
        h.sfx(s + frac(5, 0.45), 'ding');
        h.at(s + frac(5, 0.7), function () {
            ui.scoreRow('perfect', T.sBonus, '+' + BONUS);
        });
        h.sfx(s + frac(5, 0.7), 'flourish');
        h.at(s + frac(5, 0.88), function () {
            ui.scoreTotal('+' + (WORD1 + WORD2 + BONUS) + ' ' + T.ptsUnit);
        });
        s += h.dur(5) + PAD_MS;

        // 6 · con la mitad de los huecos o más, la pregunta cuenta como acierto
        h.scene(s, ui, null, 6);
        h.at(s, function () {
            ui.scoreClear();
            ui.totalOn(false);
        });
        h.at(s + frac(6, 0.35), function () {
            ui.scoreRow('ok', T.sHalf, '✓');
        });
        h.sfx(s + frac(6, 0.35), 'ding');
        h.at(s + frac(6, 0.6), function () {
            ui.scoreRow('info', T.rHit, '');
        });
        s += h.dur(6) + PAD_MS;

        h.scene(s, ui, null, 7);
        h.at(s, function () {
            ui.scoreOn(false);
        });
        return s + h.dur(7) + PAD_MS + INTRO_MS;
    }

    root.XiroHowTo.register('fill_blanks', {
        createStage: root.XiroHowToUi.fill_blanks.createStage,
        timeline: timeline
    });
})(typeof window !== 'undefined' ? window : this);
