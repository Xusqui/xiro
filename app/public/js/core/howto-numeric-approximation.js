/**
 * @fileoverview Guion de la instrucción «numeric_approximation» (aproximación numérica): línea de tiempo (ms) de
 * gestos y efectos de sonido sobre el escenario de howto-numeric-approximation-ui.js, sincronizada con la locución.
 * Cada gesto arranca a una fracción de la duración de su clip (T.dur, medida de los mp3 de cada idioma) para que
 * encaje con la voz aunque cambie el idioma; la escena siguiente espera al más lento de voz y gesto. Orden: acertar
 * un número, pregunta y pista, teclear un entero, enviar, más cerca = más puntos, y exacto = bonus / fuera del margen
 * = 0. Ejemplo con respuesta correcta 300 y máximo 100 puntos: margen del 25 % (75): 285 da 80, 255 da 40, el
 * número exacto suma el bonus de 20 (120) y 220 queda fuera (0). ES5: lo carga también tv.html.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;
    const PAD_MS = Kit.PAD_MS;
    const INTRO_MS = Kit.INTRO_MS;
    const ANSWER = '285'; // lo que se teclea en la demo
    const KEY_MS = 380; // una cifra cada KEY_MS

    function timeline(ui, T, base) {
        const s0 = Kit.script(base, ui);
        const h = s0.h;
        const frac = s0.frac;

        // 0 · hay que acertar un número o acercarse
        h.scene(0, ui, 0, 0);
        h.sfx(200, 'pop');
        let s = h.dur(0) + PAD_MS;

        // 1 · la pregunta y la pista
        h.scene(s, ui, 0, 1);
        h.at(s + frac(1, 0.5), function () {
            ui.pulseHint(true);
        });
        h.sfx(s + frac(1, 0.5), 'pop');
        h.at(s + frac(1, 0.9), function () {
            ui.pulseHint(false);
        });
        s += h.dur(1) + PAD_MS;

        // 2 · teclear un número entero: el dedo toca la caja y aparecen las cifras una a una
        h.scene(s, ui, 1, 2);
        const tap = s + Math.min(frac(2, 0.15), 600);
        h.at(tap, function () {
            ui.fingerToInput();
            ui.fingerOn(true);
        });
        h.at(tap + 450, function () {
            ui.fingerDown(true);
            ui.inputTap(true);
        });
        h.sfx(tap + 450, 'tap');
        h.at(tap + 600, function () {
            ui.fingerDown(false);
            ui.inputTap(false);
            ui.focusInput(true);
            ui.fingerOn(false);
        });
        ANSWER.split('').forEach(function (_, k) {
            h.at(tap + 1000 + k * KEY_MS, function () {
                ui.type(ANSWER.slice(0, k + 1));
            });
            h.sfx(tap + 1000 + k * KEY_MS, 'tap');
        });
        const typedEnd = tap + 1000 + ANSWER.length * KEY_MS + 300;
        s = Math.max(s + h.dur(2), typedEnd) + PAD_MS;

        // 3 · enviar
        h.scene(s, ui, 2, 3);
        const send = s + Math.min(frac(3, 0.3), 700);
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
        s = Math.max(s + h.dur(3), send + 1300) + PAD_MS;

        // 4 · cuanto más cerca del número correcto (300), más puntos
        h.scene(s, ui, 3, 4);
        h.at(s, function () {
            ui.sent(false);
            ui.scoreClear();
            ui.totalOn(false);
            ui.scoreOn(true);
        });
        h.at(s + frac(4, 0.3), function () {
            ui.scoreRow('ok', '285 · ' + T.sClose, '+80');
        });
        h.sfx(s + frac(4, 0.3), 'ding');
        h.at(s + frac(4, 0.65), function () {
            ui.scoreRow('info', '255 · ' + T.sFar, '+40');
        });
        h.sfx(s + frac(4, 0.65), 'pop');
        s += h.dur(4) + PAD_MS;

        // 5 · exacto suma bonus; fuera del margen no suma
        h.scene(s, ui, 4, 5);
        h.at(s + frac(5, 0.2), function () {
            ui.scoreRow('perfect', '300 · ' + T.sExact, '+120');
        });
        h.sfx(s + frac(5, 0.2), 'flourish');
        h.at(s + frac(5, 0.62), function () {
            ui.scoreRow('bad', '220 · ' + T.sOut, '0');
        });
        h.sfx(s + frac(5, 0.62), 'fall');
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

    root.XiroHowTo.register('numeric_approximation', {
        createStage: root.XiroHowToUi.numeric_approximation.createStage,
        timeline: timeline
    });
})(typeof window !== 'undefined' ? window : this);
