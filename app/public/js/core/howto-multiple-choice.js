/**
 * @fileoverview Guion de la instrucción «multiple_choice» (respuesta múltiple): línea de tiempo (ms) de gestos y
 * efectos de sonido sobre el escenario de howto-multiple-choice-ui.js, sincronizada con la locución. Cada gesto
 * arranca a una fracción de la duración de su clip (T.dur, medida de los mp3 de cada idioma) para que encaje
 * con la voz aunque cambie el idioma; la escena siguiente espera al más lento de voz y gesto. Orden: la
 * pregunta con varias correctas, marcar y desmarcar, enviar, correctas que suman, incorrectas que restan,
 * bonus de perfección y cierre. Puntos del ejemplo = valores por defecto del juego (+10, -10, bonus +20).
 * ES5: lo carga también tv.html.
 */
(function (root) {
    'use strict';

    const PAD_MS = 500;
    const INTRO_MS = 3200; // rótulo «Respuesta múltiple · Instrucciones» antes de la primera escena
    const TAP_GAP_MS = 900; // un toque de marcar cada TAP_GAP_MS
    const POINTS = 10;
    const PENALTY = 10;
    const PERFECT = 20;
    // Casillas del ejemplo: aves = Loro (0), Tucán (2) y Águila (4); Delfín (3) es la trampa
    const PARROT = 0;
    const TOUCAN = 2;
    const DOLPHIN = 3;
    const EAGLE = 4;

    function timeline(ui, T, base) {
        // El guion se escribe desde 0; la intro lo desplaza INTRO_MS
        const h = {
            dur: base.dur,
            at: function (t, fn) {
                base.at(t + INTRO_MS, fn);
            },
            sfx: function (t, name) {
                base.sfx(t + INTRO_MS, name);
            },
            scene: function (t, u, step, clip) {
                base.scene(t + INTRO_MS, u, step, clip);
            }
        };
        function frac(clip, f) {
            return Math.round(h.dur(clip) * f);
        }
        /** Un toque sobre una casilla: el dedo llega, pulsa y la casilla se marca o se desmarca */
        function tapMark(t, i, on) {
            h.at(t, function () {
                ui.fingerToTile(i);
                ui.fingerOn(true);
            });
            h.at(t + 450, function () {
                ui.fingerDown(true);
                ui.tapTile(i, true);
            });
            h.sfx(t + 450, 'tap');
            h.at(t + 600, function () {
                ui.fingerDown(false);
                ui.tapTile(i, false);
                ui.mark(i, on);
            });
            h.sfx(t + 600, on ? 'on' : 'off');
        }

        base.at(0, function () {
            ui.reset();
        });
        base.at(INTRO_MS - 100, function () {
            ui.intro(false);
        });

        // 0 · puede haber más de una respuesta correcta
        h.scene(0, ui, 0, 0);
        h.sfx(200, 'pop');
        let s = h.dur(0) + PAD_MS;

        // 1 · varias opciones: se marcan todas las que se crean correctas
        h.scene(s, ui, 0, 1);
        h.at(s + frac(1, 0.5), function () {
            ui.pulseTiles(true);
        });
        h.at(s + frac(1, 0.85), function () {
            ui.pulseTiles(false);
        });
        s += h.dur(1) + PAD_MS;

        // 2 · tocar marca una opción; tocarla otra vez la desmarca
        h.scene(s, ui, 1, 2);
        const first = s + Math.min(frac(2, 0.15), 800);
        tapMark(first, PARROT, true);
        tapMark(first + TAP_GAP_MS, TOUCAN, true);
        tapMark(first + TAP_GAP_MS * 2, DOLPHIN, true);
        tapMark(first + TAP_GAP_MS * 3, DOLPHIN, false);
        const marksEnd = first + TAP_GAP_MS * 3 + 900;
        h.at(marksEnd, function () {
            ui.fingerOn(false);
        });
        s = Math.max(s + h.dur(2), marksEnd) + PAD_MS;

        // 3 · enviar: cuenta lo que haya marcado en ese momento
        h.scene(s, ui, 2, 3);
        const send = s + Math.min(frac(3, 0.25), 600);
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

        // 4 · cada correcta marcada suma
        h.scene(s, ui, 3, 4);
        h.at(s, function () {
            ui.sent(false);
            ui.scoreClear();
            ui.scoreOn(true);
        });
        h.at(s + frac(4, 0.25), function () {
            ui.scoreRow('ok', T.opts[PARROT], POINTS);
        });
        h.sfx(s + frac(4, 0.25), 'ding');
        h.at(s + frac(4, 0.6), function () {
            ui.scoreRow('ok', T.opts[TOUCAN], POINTS);
            ui.scoreTotal(POINTS * 2);
        });
        h.sfx(s + frac(4, 0.6), 'ding');
        s += h.dur(4) + PAD_MS;

        // 5 · cada incorrecta marcada resta; una correcta sin marcar ni suma ni resta
        h.scene(s, ui, 3, 5);
        h.at(s + frac(5, 0.18), function () {
            ui.scoreRow('bad', T.opts[DOLPHIN], -PENALTY);
            ui.scoreTotal(POINTS * 2 - PENALTY);
        });
        h.sfx(s + frac(5, 0.18), 'fall');
        h.at(s + frac(5, 0.6), function () {
            ui.scoreRow('miss', T.opts[EAGLE], 0);
        });
        h.sfx(s + frac(5, 0.6), 'pop');
        s += h.dur(5) + PAD_MS;

        // 6 · todas las correctas y ninguna incorrecta: bonus de perfección
        h.scene(s, ui, 4, 6);
        h.at(s, function () {
            ui.scoreClear();
        });
        [PARROT, TOUCAN, EAGLE].forEach(function (i, k) {
            h.at(s + frac(6, 0.08 + k * 0.14), function () {
                ui.scoreRow('ok', T.opts[i], POINTS);
                ui.scoreTotal(POINTS * (k + 1));
            });
            h.sfx(s + frac(6, 0.08 + k * 0.14), 'pop');
        });
        h.at(s + frac(6, 0.62), function () {
            ui.scoreRow('perfect', '', PERFECT);
            ui.scoreTotal(POINTS * 3 + PERFECT);
        });
        h.sfx(s + frac(6, 0.62), 'flourish');
        s += h.dur(6) + PAD_MS;

        h.scene(s, ui, null, 7);
        h.at(s, function () {
            ui.scoreOn(false);
        });
        return s + h.dur(7) + PAD_MS + INTRO_MS;
    }

    root.XiroHowTo.register('multiple_choice', {
        createStage: root.XiroHowToUi.multiple_choice.createStage,
        timeline: timeline
    });
})(typeof window !== 'undefined' ? window : this);
