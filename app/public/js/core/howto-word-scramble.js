/**
 * @fileoverview Guion de la instrucción «word_scramble» (adivinar palabra): línea de tiempo (ms) de gestos y efectos
 * de sonido sobre el escenario de howto-word-scramble-ui.js, sincronizada con la locución. Cada gesto arranca a una
 * fracción de la duración de su clip (T.dur, medida de los mp3 de cada idioma) para que encaje con la voz aunque
 * cambie el idioma; la escena siguiente espera al más lento de voz y gesto. Orden: descubrir una palabra, longitud y
 * letras de más, tocar letras (con un error), Borrar, completar y enviar, y puntos (base 20 + bonus de tiempo 18).
 * ES5: lo carga también tv.html.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;
    const PAD_MS = Kit.PAD_MS;
    const INTRO_MS = Kit.INTRO_MS;
    const BASE = 20;
    const BONUS = 18;

    function timeline(ui, T, base) {
        const s0 = Kit.script(base, ui);
        const h = s0.h;
        const frac = s0.frac;
        const sol = T.solution;

        /** Un toque en una ficha: el dedo llega, pulsa y la letra pasa a la casilla */
        function tapLetter(t, tile) {
            h.at(t, function () {
                ui.fingerToTile(tile);
                ui.fingerOn(true);
            });
            h.at(t + 400, function () {
                ui.fingerDown(true);
                ui.tapTile(tile, true);
            });
            h.sfx(t + 400, 'tap');
            h.at(t + 550, function () {
                ui.fingerDown(false);
                ui.tapTile(tile, false);
                ui.place(tile);
            });
        }

        // 0 · descubrir una palabra con las letras desordenadas
        h.scene(0, ui, 0, 0);
        h.sfx(200, 'pop');
        let s = h.dur(0) + PAD_MS;

        // 1 · cuántas letras tiene y que sobran letras
        h.scene(s, ui, 0, 1);
        h.at(s + frac(1, 0.3), function () {
            ui.pulseBoxes(true);
        });
        h.sfx(s + frac(1, 0.3), 'pop');
        h.at(s + frac(1, 0.75), function () {
            ui.pulseBoxes(false);
        });
        s += h.dur(1) + PAD_MS;

        // 2 · tocar letras en orden: dos bien y una de más por error
        h.scene(s, ui, 1, 2);
        const first = s + Math.min(frac(2, 0.12), 500);
        tapLetter(first, sol[0]);
        tapLetter(first + 800, sol[1]);
        tapLetter(first + 1600, T.wrong);
        const tapsEnd = first + 1600 + 900;
        h.at(tapsEnd, function () {
            ui.fingerOn(false);
        });
        s = Math.max(s + h.dur(2), tapsEnd) + PAD_MS;

        // 3 · Borrar vacía las casillas
        h.scene(s, ui, 2, 3);
        const clear = s + Math.min(frac(3, 0.25), 600);
        h.at(clear, function () {
            ui.fingerToReset();
            ui.fingerOn(true);
        });
        h.at(clear + 450, function () {
            ui.fingerDown(true);
            ui.resetTap(true);
        });
        h.sfx(clear + 450, 'tap');
        h.at(clear + 600, function () {
            ui.fingerDown(false);
            ui.resetTap(false);
            ui.clear();
            ui.fingerOn(false);
        });
        h.sfx(clear + 600, 'off');
        s = Math.max(s + h.dur(3), clear + 1000) + PAD_MS;

        // 4 · completar la palabra y enviar
        h.scene(s, ui, 3, 4);
        const again = s + 300;
        sol.forEach(function (tile, k) {
            tapLetter(again + k * 750, tile);
        });
        const send = again + sol.length * 750 + 200;
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

        // 5 · acierto + bonus de tiempo
        h.scene(s, ui, 4, 5);
        h.at(s, function () {
            ui.sent(false);
            ui.scoreClear();
            ui.totalOn(true);
            ui.scoreOn(true);
        });
        h.at(s + frac(5, 0.25), function () {
            ui.scoreRow('ok', T.sBase, '+' + BASE);
        });
        h.sfx(s + frac(5, 0.25), 'ding');
        h.at(s + frac(5, 0.55), function () {
            ui.scoreRow('perfect', T.sBonus, '+' + BONUS);
        });
        h.sfx(s + frac(5, 0.55), 'flourish');
        h.at(s + frac(5, 0.8), function () {
            ui.scoreTotal('+' + (BASE + BONUS) + ' ' + T.ptsUnit);
        });
        s += h.dur(5) + PAD_MS;

        // 6 · consejo
        h.scene(s, ui, null, 6);
        h.at(s, function () {
            ui.scoreOn(false);
        });
        s += h.dur(6) + PAD_MS;

        h.scene(s, ui, null, 7);
        return s + h.dur(7) + PAD_MS + INTRO_MS;
    }

    root.XiroHowTo.register('word_scramble', {
        createStage: root.XiroHowToUi.word_scramble.createStage,
        timeline: timeline
    });
})(typeof window !== 'undefined' ? window : this);
