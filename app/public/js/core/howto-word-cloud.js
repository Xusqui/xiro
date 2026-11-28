/**
 * @fileoverview Guion de la instrucción «word_cloud» (Nube de palabras): línea de tiempo (ms) de gestos y efectos de
 * sonido sobre el escenario de howto-word-cloud-ui.js, sincronizada con la locución. Cada gesto arranca a una fracción
 * de la duración de su clip (T.dur, medida de los mp3 de cada idioma); la escena siguiente espera al más lento de voz y
 * gesto. Orden: no hay respuestas correctas ni puntos, la pregunta pide palabras, escribir en solo dos de las tres
 * casillas, enviar (la nube sustituye al formulario), la nube crece con las palabras de los demás, las más repetidas
 * se ven más grandes, las repetidas o no permitidas no se envían y el cierre. ES5: lo carga también tv.html.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;
    const PAD_MS = Kit.PAD_MS;

    /** Los recuentos de la demo a una fracción del final (mínimo 1), para que la nube vaya creciendo */
    function partial(cloud, share) {
        return cloud.map(function (pair) {
            return [pair[0], Math.max(1, Math.round(pair[1] * share))];
        });
    }

    function timeline(ui, T, base) {
        const s0 = Kit.script(base, ui);
        const h = s0.h;
        const frac = s0.frac;
        const own = T.words.length;

        /** El dedo baja sobre una casilla y la palabra aparece escrita */
        function type(t, box) {
            h.at(t, function () {
                ui.fingerToBox(box);
                ui.fingerOn(true);
            });
            h.at(t + 600, function () {
                ui.fingerDown(true);
            });
            h.sfx(t + 600, 'tap');
            h.at(t + 900, function () {
                ui.fingerDown(false);
                ui.boxText(box, T.words[box]);
            });
            h.sfx(t + 900, 'pop');
        }

        // 0 · no hay respuestas correctas ni puntos
        h.scene(0, ui, 0, 0);
        h.sfx(200, 'pop');
        let s = h.dur(0) + PAD_MS;

        // 1 · la pregunta pide palabras sobre un tema
        h.scene(s, ui, 0, 1);
        h.at(s + frac(1, 0.5), function () {
            ui.pulseQuestion(true);
        });
        h.at(s + frac(1, 0.85), function () {
            ui.pulseQuestion(false);
        });
        s += h.dur(1) + PAD_MS;

        // 2 · escribir en dos casillas: no hace falta rellenarlas todas
        h.scene(s, ui, 1, 2);
        const first = s + Math.min(frac(2, 0.1), 500);
        type(first, 0);
        const second = s + Math.max(frac(2, 0.5), first - s + 1700);
        type(second, 1);
        h.at(second + 1300, function () {
            ui.fingerOn(false);
        });
        s = Math.max(s + h.dur(2), second + 1400) + PAD_MS;

        // 3 · enviar: la nube sustituye al formulario con las palabras propias
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
            ui.sentOn(true);
            ui.cloud(
                T.words.map(function (word) {
                    return [word, 1];
                })
            );
        });
        h.sfx(send + 900, 'send');
        s = Math.max(s + h.dur(3), send + 1300) + PAD_MS;

        // 4 · la nube crece con las palabras de los demás
        h.scene(s, ui, 3, 4);
        const others = T.cloud.length - own;
        for (let k = 0; k < others; k++) {
            const at = s + frac(4, 0.2 + (0.6 * k) / Math.max(others - 1, 1));
            h.at(at, function () {
                ui.cloud(
                    T.words
                        .map(function (word) {
                            return [word, 1];
                        })
                        .concat(partial(T.cloud, 0.4).slice(own, own + k + 1))
                );
            });
            h.sfx(at, 'pop');
        }
        s += h.dur(4) + PAD_MS;

        // 5 · las palabras más repetidas se ven más grandes
        h.scene(s, ui, 3, 5);
        h.at(s + frac(5, 0.25), function () {
            ui.cloud(partial(T.cloud, 0.7));
        });
        h.sfx(s + frac(5, 0.25), 'pop');
        h.at(s + frac(5, 0.6), function () {
            ui.cloud(T.cloud);
        });
        h.sfx(s + frac(5, 0.6), 'ding');
        s += h.dur(5) + PAD_MS;

        // 6 · una palabra repetida o no permitida no se envía
        h.scene(s, ui, 4, 6);
        h.at(s + frac(6, 0.3), function () {
            ui.notice(T.dup);
        });
        h.sfx(s + frac(6, 0.3), 'fall');
        s += h.dur(6) + PAD_MS;

        // 7 · cuando todos envían, la pregunta termina
        h.scene(s, ui, null, 7);
        h.at(s, function () {
            ui.notice('');
        });
        h.sfx(s + frac(7, 0.1), 'flourish');
        return s + h.dur(7) + PAD_MS + Kit.INTRO_MS;
    }

    root.XiroHowTo.register('word_cloud', {
        createStage: root.XiroHowToUi.word_cloud.createStage,
        timeline: timeline
    });
})(typeof window !== 'undefined' ? window : this);
