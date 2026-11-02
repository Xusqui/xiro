/**
 * @fileoverview Guion de la instrucción «quiz»: línea de tiempo (ms) de gestos sobre el escenario de
 * howto-quiz-ui.js, sincronizada con la locución. Cada gesto arranca a una fracción de la duración de su
 * clip (T.dur, medida de los mp3 de cada idioma) para que encaje con la voz aunque cambie el idioma; la
 * escena siguiente espera al más lento de voz y gesto. Orden: puntos en juego (sorteados o fijos), pregunta,
 * respuesta, bonus de tiempo, resultado y racha. ES5: lo carga también tv.html.
 */
(function (root) {
    'use strict';

    const TAP_MS = 1500;
    const PAD_MS = 500;
    const INTRO_MS = 3200; // rótulo «Quiz · Instrucciones» antes de la primera escena
    const ROLL_STEP_MS = 110;
    const ROLL = [12, 47, 29, 38, 21, 44, 33, 26, 41, 35]; // el último es el valor que se queda
    const FIXED = 20;
    const GAINED = 38; // ejemplo de acierto rápido (20 base + 18 de bonus); coincide con la barra «Rápido»
    const WITH_STREAK = 57; // 38 + 50 % de racha

    function timeline(ui, T, base) {
        // El guion se escribe desde 0; la intro lo desplaza INTRO_MS
        const h = {
            dur: base.dur,
            at: function (t, fn) {
                base.at(t + INTRO_MS, fn);
            },
            scene: function (t, u, step, clip) {
                base.scene(t + INTRO_MS, u, step, clip);
            }
        };
        function frac(clip, f) {
            return Math.round(h.dur(clip) * f);
        }

        base.at(0, function () {
            ui.reset();
        });
        base.at(INTRO_MS - 100, function () {
            ui.intro(false);
        });

        // 0 · puntos en juego: se sortean y, si no, valen siempre lo mismo
        h.scene(0, ui, 0, 0);
        const roll = frac(0, 0.14);
        ROLL.forEach(function (value, i) {
            h.at(roll + i * ROLL_STEP_MS, function () {
                ui.pointsValue(value);
            });
        });
        h.at(frac(0, 0.74), function () {
            ui.pointsMode(true);
            ui.pointsValue(FIXED);
        });
        let s = h.dur(0) + PAD_MS;

        // 1 · la pregunta y sus cuatro respuestas de colores
        h.scene(s, ui, 1, 1);
        h.at(s, function () {
            ui.pointsOn(false);
        });
        h.at(s + frac(1, 0.5), function () {
            ui.pulseTiles(true);
        });
        h.at(s + frac(1, 0.8), function () {
            ui.pulseTiles(false);
        });
        s += h.dur(1) + PAD_MS;

        // 2 · tocar una respuesta: solo cuenta la primera
        h.scene(s, ui, 2, 2);
        const tap = s + Math.min(frac(2, 0.3), Math.max(300, h.dur(2) - TAP_MS));
        h.at(tap, function () {
            ui.fingerToTile(1);
            ui.fingerOn(true);
        });
        h.at(tap + 700, function () {
            ui.fingerDown(true);
            ui.tapTile(1, true);
        });
        h.at(tap + 900, function () {
            ui.fingerDown(false);
            ui.tapTile(1, false);
            ui.choose(1);
        });
        h.at(tap + TAP_MS, function () {
            ui.fingerOn(false);
        });
        s = Math.max(s + h.dur(2), tap + TAP_MS) + PAD_MS;

        // 3 · respuesta enviada
        h.scene(s, ui, null, 3);
        h.at(s + 400, function () {
            ui.sent(true);
        });
        s += h.dur(3) + PAD_MS;

        // 4 · puntos de la pregunta + bonus de tiempo (cuanto antes, más); un fallo no suma
        h.scene(s, ui, 3, 4);
        h.at(s, function () {
            ui.sent(false);
            ui.meterOn(true);
        });
        h.at(s + frac(4, 0.14), function () {
            ui.meterRow(0);
        });
        h.at(s + frac(4, 0.46), function () {
            ui.meterRow(1);
        });
        h.at(s + frac(4, 0.76), function () {
            ui.meterRow(2);
        });
        s += h.dur(4) + PAD_MS;

        // 5 · resultado: verde con los puntos ganados, rojo si se falla
        h.scene(s, ui, 4, 5);
        h.at(s, function () {
            ui.meterOn(false);
            ui.result('ok', GAINED);
        });
        h.at(s + frac(5, 0.62), function () {
            ui.result('bad', 0);
        });
        s += h.dur(5) + PAD_MS;

        // 6 · racha: los aciertos seguidos suman extra
        h.scene(s, ui, null, 6);
        h.at(s, function () {
            ui.result('ok', GAINED);
        });
        h.at(s + frac(6, 0.45), function () {
            ui.streak(true);
            ui.resultPts(WITH_STREAK);
        });
        s += h.dur(6) + PAD_MS;

        h.scene(s, ui, 5, 7);
        return s + h.dur(7) + PAD_MS + INTRO_MS;
    }

    root.XiroHowTo.register('quiz', { createStage: root.XiroHowToUi.quiz.createStage, timeline: timeline });
})(typeof window !== 'undefined' ? window : this);
