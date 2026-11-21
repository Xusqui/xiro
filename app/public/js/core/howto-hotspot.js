/**
 * @fileoverview Guion de la instrucción «hotspot» (Toca la imagen): línea de tiempo (ms) de gestos y efectos de sonido
 * sobre el escenario de howto-hotspot-ui.js, sincronizada con la locución. Cada gesto arranca a una fracción de la
 * duración de su clip (T.dur, medida de los mp3 de cada idioma); la escena siguiente espera al más lento de voz y
 * gesto. Orden: qué hay que hacer, la pregunta dice qué buscar, tocar (primero fuera, luego se mueve la chincheta a la
 * chimenea), enviar, puntos según la cercanía al área (dentro, cerca, lejos), efecto en la racha y consejo (tocar el
 * centro). ES5: lo carga también tv.html.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;
    const PAD_MS = Kit.PAD_MS;
    const INTRO_MS = Kit.INTRO_MS;
    // Puntos de la imagen (0-1): un toque errado en el tejado, el centro de la chimenea, uno cerca y uno lejos
    const MISS = { x: 0.42, y: 0.4 };
    const CENTER = { x: 0.71, y: 0.27 };
    const NEAR = { x: 0.62, y: 0.3 };
    const FAR = { x: 0.2, y: 0.78 };

    function timeline(ui, T, base) {
        const s0 = Kit.script(base, ui);
        const h = s0.h;
        const frac = s0.frac;

        /** El dedo baja sobre un punto de la imagen y la chincheta se clava (o se mueve) allí */
        function tap(t, point) {
            h.at(t, function () {
                ui.fingerToPoint(point.x, point.y);
                ui.fingerOn(true);
            });
            h.at(t + 600, function () {
                ui.fingerDown(true);
                ui.pinAt(point.x, point.y);
            });
            h.sfx(t + 600, 'tap');
            h.at(t + 900, function () {
                ui.fingerDown(false);
            });
            h.sfx(t + 900, 'pop');
        }

        // 0 · hay que tocar un sitio de una imagen
        h.scene(0, ui, 0, 0);
        h.sfx(200, 'pop');
        let s = h.dur(0) + PAD_MS;

        // 1 · la pregunta dice qué buscar
        h.scene(s, ui, 0, 1);
        h.at(s + frac(1, 0.5), function () {
            ui.pulseQuestion(true);
        });
        h.at(s + frac(1, 0.85), function () {
            ui.pulseQuestion(false);
        });
        s += h.dur(1) + PAD_MS;

        // 2 · tocar: un primer toque errado y otro que mueve la chincheta a la chimenea
        h.scene(s, ui, 1, 2);
        const first = s + Math.min(frac(2, 0.1), 500);
        tap(first, MISS);
        const second = s + Math.max(frac(2, 0.6), first - s + 1700);
        tap(second, CENTER);
        h.at(second + 1300, function () {
            ui.fingerOn(false);
        });
        s = Math.max(s + h.dur(2), second + 1400) + PAD_MS;

        // 3 · enviar: cuenta la chincheta que haya en ese momento
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

        // 4 · el presentador revela el área: dentro todo y un extra, cerca una parte, lejos nada
        h.scene(s, ui, 3, 4);
        h.at(s, function () {
            ui.sent(false);
            ui.scoreClear();
            ui.totalOn(false);
            ui.scoreOn(true);
            ui.areaOn(true);
            ui.pinAt(CENTER.x, CENTER.y);
        });
        [
            ['ok', 'sIn', 'vIn', CENTER, 0.3, 'ding'],
            ['info', 'sNear', 'vNear', NEAR, 0.6, 'pop'],
            ['bad', 'sFar', 'vFar', FAR, 0.82, 'fall']
        ].forEach(function (row) {
            h.at(s + frac(4, row[4]), function () {
                ui.pinAt(row[3].x, row[3].y);
                ui.scoreRow(row[0], T[row[1]], T[row[2]]);
            });
            h.sfx(s + frac(4, row[4]), row[5]);
        });
        s += h.dur(4) + PAD_MS;

        // 5 · racha: dentro sube, con puntos se mantiene, sin puntos se rompe
        h.scene(s, ui, 4, 5);
        h.at(s, function () {
            ui.scoreClear();
            ui.pinOff();
        });
        [
            ['ok', 'sIn', 'rUp', 0.1, 'ding'],
            ['info', 'sNear', 'rKeep', 0.4, 'pop'],
            ['bad', 'sFar', 'rLost', 0.68, 'fall']
        ].forEach(function (row) {
            h.at(s + frac(5, row[3]), function () {
                ui.scoreRow(row[0], T[row[1]], T[row[2]]);
            });
            h.sfx(s + frac(5, row[3]), row[4]);
        });
        s += h.dur(5) + PAD_MS;

        // 6 · consejo: tocar el centro de lo que se busca
        h.scene(s, ui, null, 6);
        h.at(s, function () {
            ui.scoreOn(false);
        });
        h.at(s + frac(6, 0.3), function () {
            ui.pinAt(CENTER.x, CENTER.y);
        });
        h.sfx(s + frac(6, 0.3), 'tap');
        s += h.dur(6) + PAD_MS;

        h.scene(s, ui, null, 7);
        h.at(s, function () {
            ui.pinOff();
            ui.areaOn(false);
        });
        return s + h.dur(7) + PAD_MS + INTRO_MS;
    }

    root.XiroHowTo.register('hotspot', { createStage: root.XiroHowToUi.hotspot.createStage, timeline: timeline });
})(typeof window !== 'undefined' ? window : this);
