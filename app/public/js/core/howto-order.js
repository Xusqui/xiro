/**
 * @fileoverview Guion de la instrucción «order» (ordenar): línea de tiempo (ms) de gestos y efectos de sonido sobre
 * el escenario de howto-order-ui.js, sincronizada con la locución. Cada gesto arranca a una fracción de la duración
 * de su clip (T.dur, medida de los mp3 de cada idioma) para que encaje con la voz aunque cambie el idioma; la escena
 * siguiente espera al más lento de voz y gesto. Orden: qué hay que hacer, el criterio de la pregunta, arrastrar dos
 * elementos a su sitio, enviar, puntos por posición acertada y efecto en la racha (todas: sube; la mitad o más:
 * se mantiene; menos: se rompe). ES5: lo carga también tv.html.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;
    const PAD_MS = Kit.PAD_MS;
    const INTRO_MS = Kit.INTRO_MS;
    const DRAG_MS = 1900; // un arrastre cada DRAG_MS
    // Índices de T.opts (orden correcto): Mercurio 0, Venus 1, Tierra 2, Marte 3
    const MERCURY = 0;
    const VENUS = 1;

    function timeline(ui, T, base) {
        const s0 = Kit.script(base, ui);
        const h = s0.h;
        const frac = s0.frac;

        /** Arrastra un elemento hasta un hueco: el dedo lo coge, lo lleva y lo suelta */
        function drag(t, opt, slot) {
            h.at(t, function () {
                ui.fingerToItem(opt);
                ui.fingerOn(true);
            });
            h.at(t + 450, function () {
                ui.fingerDown(true);
                ui.grab(opt, true);
            });
            h.sfx(t + 450, 'tap');
            h.at(t + 600, function () {
                ui.fingerToSlot(slot);
                ui.move(opt, slot);
            });
            h.at(t + 1300, function () {
                ui.fingerDown(false);
                ui.grab(opt, false);
            });
            h.sfx(t + 1300, 'pop');
        }

        // 0 · hay que poner varios elementos en orden
        h.scene(0, ui, 0, 0);
        h.sfx(200, 'pop');
        let s = h.dur(0) + PAD_MS;

        // 1 · la pregunta dice qué criterio seguir
        h.scene(s, ui, 0, 1);
        h.at(s + frac(1, 0.5), function () {
            ui.pulseItems(true);
        });
        h.at(s + frac(1, 0.85), function () {
            ui.pulseItems(false);
        });
        s += h.dur(1) + PAD_MS;

        // 2 · arrastrar: Mercurio al primer hueco y Venus al segundo
        h.scene(s, ui, 1, 2);
        const first = s + Math.min(frac(2, 0.12), 600);
        drag(first, MERCURY, 0);
        drag(first + DRAG_MS, VENUS, 1);
        const dragEnd = first + DRAG_MS + 1700;
        h.at(dragEnd, function () {
            ui.fingerOn(false);
        });
        s = Math.max(s + h.dur(2), dragEnd) + PAD_MS;

        // 3 · enviar: cuenta el orden que haya en ese momento
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

        // 4 · cada posición acertada suma: ejemplo con dos de cuatro (Marte y Tierra intercambiadas)
        h.scene(s, ui, 3, 4);
        h.at(s, function () {
            ui.sent(false);
            ui.scoreClear();
            ui.totalOn(true);
            ui.scoreOn(true);
        });
        const attempt = [
            ['ok', 0, 0.15],
            ['ok', 1, 0.33],
            ['bad', 3, 0.51],
            ['bad', 2, 0.69]
        ];
        attempt.forEach(function (row, k) {
            h.at(s + frac(4, row[2]), function () {
                ui.scoreRow(row[0], k + 1 + ' · ' + T.opts[row[1]], row[0] === 'ok' ? '✓' : '✗');
            });
            h.sfx(s + frac(4, row[2]), row[0] === 'ok' ? 'ding' : 'fall');
        });
        h.at(s + frac(4, 0.84), function () {
            ui.scoreTotal('2 / 4');
        });
        s += h.dur(4) + PAD_MS;

        // 5 · racha: todas bien sube, la mitad o más se mantiene, menos se rompe
        h.scene(s, ui, 4, 5);
        h.at(s, function () {
            ui.scoreClear();
            ui.totalOn(false);
        });
        [
            ['ok', 'sAll', 'rUp', 0.12, 'ding'],
            ['info', 'sHalf', 'rKeep', 0.42, 'pop'],
            ['bad', 'sLess', 'rLost', 0.7, 'fall']
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

    root.XiroHowTo.register('order', { createStage: root.XiroHowToUi.order.createStage, timeline: timeline });
})(typeof window !== 'undefined' ? window : this);
