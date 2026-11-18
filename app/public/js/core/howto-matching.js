/**
 * @fileoverview Guion de la instrucción «matching» (emparejar): línea de tiempo (ms) de gestos y efectos de sonido
 * sobre el escenario de howto-matching-ui.js, sincronizada con la locución. Cada gesto arranca a una fracción de la
 * duración de su clip (T.dur, medida de los mp3 de cada idioma) para que encaje con la voz aunque cambie el idioma;
 * la escena siguiente espera al más lento de voz y gesto. Orden: qué hay que hacer, columna fija y columna móvil,
 * arrastrar dos elementos frente a su pareja, enviar, puntos por pareja acertada y cuándo la respuesta es correcta
 * (solo con todas las parejas; si no, puntos parciales). ES5: lo carga también tv.html.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;
    const PAD_MS = Kit.PAD_MS;
    const INTRO_MS = Kit.INTRO_MS;
    const DRAG_MS = 1900; // un arrastre cada DRAG_MS
    // Índices de T.right (= su pareja en T.left): Madrid 0, París 1, Roma 2, Berlín 3
    const MADRID = 0;
    const PARIS = 1;

    function timeline(ui, T, base) {
        const s0 = Kit.script(base, ui);
        const h = s0.h;
        const frac = s0.frac;

        /** Arrastra un elemento de la derecha hasta un hueco: el dedo lo coge, lo lleva y lo suelta */
        function drag(t, partner, slot) {
            h.at(t, function () {
                ui.fingerToRight(partner);
                ui.fingerOn(true);
            });
            h.at(t + 450, function () {
                ui.fingerDown(true);
                ui.grab(partner, true);
            });
            h.sfx(t + 450, 'tap');
            h.at(t + 600, function () {
                ui.fingerToRightSlot(slot);
                ui.move(partner, slot);
            });
            h.at(t + 1300, function () {
                ui.fingerDown(false);
                ui.grab(partner, false);
            });
            h.sfx(t + 1300, 'pop');
        }

        // 0 · hay que emparejar los elementos de dos columnas
        h.scene(0, ui, 0, 0);
        h.sfx(200, 'pop');
        let s = h.dur(0) + PAD_MS;

        // 1 · la izquierda es fija; la derecha se mueve
        h.scene(s, ui, 0, 1);
        h.at(s + frac(1, 0.55), function () {
            ui.pulseRight(true);
        });
        h.at(s + frac(1, 0.9), function () {
            ui.pulseRight(false);
        });
        s += h.dur(1) + PAD_MS;

        // 2 · arrastrar Madrid frente a España y París frente a Francia (Italia y Alemania quedan cruzadas)
        h.scene(s, ui, 1, 2);
        const first = s + Math.min(frac(2, 0.12), 600);
        drag(first, MADRID, 0);
        drag(first + DRAG_MS, PARIS, 1);
        const dragEnd = first + DRAG_MS + 1700;
        h.at(dragEnd, function () {
            ui.fingerOn(false);
        });
        s = Math.max(s + h.dur(2), dragEnd) + PAD_MS;

        // 3 · enviar: cuenta lo que haya en ese momento
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

        // 4 · cada pareja acertada suma: ejemplo con dos de cuatro (Italia y Alemania cruzadas)
        h.scene(s, ui, 3, 4);
        h.at(s, function () {
            ui.sent(false);
            ui.scoreClear();
            ui.totalOn(true);
            ui.scoreOn(true);
        });
        [
            ['ok', 0, 0, 0.15],
            ['ok', 1, 1, 0.33],
            ['bad', 2, 3, 0.51],
            ['bad', 3, 2, 0.69]
        ].forEach(function (row) {
            h.at(s + frac(4, row[3]), function () {
                ui.scoreRow(row[0], T.left[row[1]] + ' ↔ ' + T.right[row[2]], row[0] === 'ok' ? '✓' : '✗');
            });
            h.sfx(s + frac(4, row[3]), row[0] === 'ok' ? 'ding' : 'fall');
        });
        h.at(s + frac(4, 0.84), function () {
            ui.scoreTotal('2 / 4');
        });
        s += h.dur(4) + PAD_MS;

        // 5 · solo con todas las parejas la respuesta es correcta; si no, puntos parciales
        h.scene(s, ui, 4, 5);
        h.at(s, function () {
            ui.scoreClear();
            ui.totalOn(false);
        });
        [
            ['ok', 'sAll', 'rAll', 0.2, 'ding'],
            ['info', 'sSome', 'rSome', 0.6, 'pop']
        ].forEach(function (row) {
            h.at(s + frac(5, row[3]), function () {
                ui.scoreRow(row[0], T[row[1]], T[row[2]]);
            });
            h.sfx(s + frac(5, row[3]), row[4]);
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

    root.XiroHowTo.register('matching', { createStage: root.XiroHowToUi.matching.createStage, timeline: timeline });
})(typeof window !== 'undefined' ? window : this);
