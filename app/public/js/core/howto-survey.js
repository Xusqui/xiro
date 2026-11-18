/**
 * @fileoverview Guiones de las instrucciones «survey» (encuesta) y «survey_multiple» (encuesta múltiple): línea de
 * tiempo (ms) de gestos y efectos de sonido sobre los escenarios de howto-survey-ui.js, sincronizada con la locución.
 * Cada gesto arranca a una fracción de la duración de su clip (T.dur, medida de los mp3 de cada idioma) para que encaje
 * con la voz aunque cambie el idioma; la escena siguiente espera al más lento de voz y gesto. Encuesta: sin respuesta
 * correcta, tocar una opción, voto registrado (sin puntos ni racha), resultados en % (suman 100) y elección marcada.
 * Múltiple: marcar varias (o ninguna), enviar, sin puntos, resultados que pueden superar el 100 % y elecciones
 * marcadas. Porcentajes y respuestas del ejemplo: 20 respuestas. ES5: lo carga también tv.html.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;
    const PAD_MS = Kit.PAD_MS;
    const INTRO_MS = Kit.INTRO_MS;
    const RESPONDENTS = 20;
    const SINGLE_PERCENT = [20, 45, 25, 10]; // suman 100
    const MULTI_PERCENT = [70, 40, 55, 20]; // pueden sumar más de 100
    // Opciones del ejemplo: Loro 0, Camaleón 1, Tucán 2, Mono 3
    const PARROT = 0;
    const CHAMELEON = 1;
    const TOUCAN = 2;

    /** Escena de resultados: la lista aparece y las barras se rellenan */
    function showResults(s0, ui, s, clip, percents) {
        const h = s0.h;
        const frac = s0.frac;
        h.at(s, function () {
            ui.sent(false);
            ui.fillResults([0, 0, 0, 0], RESPONDENTS);
            ui.resultsOn(true);
        });
        h.at(s + frac(clip, 0.35), function () {
            ui.fillResults(percents, RESPONDENTS);
        });
        h.sfx(s + frac(clip, 0.35), 'ding');
    }

    function sendSteps(h, ui, s, dur) {
        const send = s + Math.min(Math.round(dur * 0.3), 700);
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
        return send + 1300;
    }

    /** `how`: { on: true | false | 'choose', sound: nombre del efecto al marcar o desmarcar } */
    function tapTile(h, ui, t, i, how) {
        const on = how.on;
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
            if (on === 'choose') ui.choose(i);
            else ui.mark(i, on);
        });
        h.sfx(t + 600, how.sound);
    }

    function single(ui, T, base) {
        const s0 = Kit.script(base, ui);
        const h = s0.h;
        const frac = s0.frac;

        // 0 · es una encuesta: no hay respuestas correctas
        h.scene(0, ui, 0, 0);
        h.sfx(200, 'pop');
        let s = h.dur(0) + PAD_MS;

        // 1 · una pregunta con varias opciones de colores
        h.scene(s, ui, 0, 1);
        h.at(s + frac(1, 0.5), function () {
            ui.pulseTiles(true);
        });
        h.at(s + frac(1, 0.85), function () {
            ui.pulseTiles(false);
        });
        s += h.dur(1) + PAD_MS;

        // 2 · tocar una opción: solo cuenta la primera
        h.scene(s, ui, 1, 2);
        const tap = s + Math.min(frac(2, 0.25), 800);
        tapTile(h, ui, tap, CHAMELEON, { on: 'choose', sound: 'pop' });
        h.at(tap + 1300, function () {
            ui.fingerOn(false);
        });
        s = Math.max(s + h.dur(2), tap + 1500) + PAD_MS;

        // 3 · voto registrado: no suma ni resta puntos ni toca la racha
        h.scene(s, ui, 2, 3);
        h.at(s + 300, function () {
            ui.sent(true);
        });
        h.sfx(s + 300, 'send');
        s += h.dur(3) + PAD_MS;

        // 4 · al acabar el tiempo, el porcentaje de cada opción (suman 100)
        h.scene(s, ui, 3, 4);
        showResults(s0, ui, s, 4, SINGLE_PERCENT);
        s += h.dur(4) + PAD_MS;

        // 5 · la elección propia aparece marcada
        h.scene(s, ui, 4, 5);
        h.at(s + frac(5, 0.3), function () {
            ui.markMine([CHAMELEON]);
        });
        h.sfx(s + frac(5, 0.3), 'ding');
        s += h.dur(5) + PAD_MS;

        h.scene(s, ui, null, 6);
        s += h.dur(6) + PAD_MS;

        h.scene(s, ui, null, 7);
        h.at(s, function () {
            ui.resultsOn(false);
        });
        return s + h.dur(7) + PAD_MS + INTRO_MS;
    }

    function multiple(ui, T, base) {
        const s0 = Kit.script(base, ui);
        const h = s0.h;
        const frac = s0.frac;

        // 0 · encuesta múltiple: sin respuestas correctas, varias opciones o ninguna
        h.scene(0, ui, 0, 0);
        h.sfx(200, 'pop');
        let s = h.dur(0) + PAD_MS;

        // 1 · varias opciones: marcar todas las que se quiera
        h.scene(s, ui, 0, 1);
        h.at(s + frac(1, 0.5), function () {
            ui.pulseTiles(true);
        });
        h.at(s + frac(1, 0.85), function () {
            ui.pulseTiles(false);
        });
        s += h.dur(1) + PAD_MS;

        // 2 · tocar marca; tocar otra vez desmarca (Loro, Tucán y Camaleón marcado y desmarcado)
        h.scene(s, ui, 1, 2);
        const first = s + Math.min(frac(2, 0.12), 500);
        tapTile(h, ui, first, PARROT, { on: true, sound: 'on' });
        tapTile(h, ui, first + 900, TOUCAN, { on: true, sound: 'on' });
        tapTile(h, ui, first + 1800, CHAMELEON, { on: true, sound: 'on' });
        tapTile(h, ui, first + 2700, CHAMELEON, { on: false, sound: 'off' });
        const marksEnd = first + 2700 + 900;
        h.at(marksEnd, function () {
            ui.fingerOn(false);
        });
        s = Math.max(s + h.dur(2), marksEnd) + PAD_MS;

        // 3 · enviar: sin nada marcado el botón diría «Ninguna»
        h.scene(s, ui, 2, 3);
        const sentAt = sendSteps(h, ui, s, h.dur(3));
        s = Math.max(s + h.dur(3), sentAt) + PAD_MS;

        // 4 · una encuesta no suma ni resta puntos ni toca la racha
        h.scene(s, ui, 3, 4);
        s += h.dur(4) + PAD_MS;

        // 5 · porcentaje de jugadores que marcó cada opción (pueden sumar más de 100)
        h.scene(s, ui, 4, 5);
        showResults(s0, ui, s, 5, MULTI_PERCENT);
        s += h.dur(5) + PAD_MS;

        // 6 · las propias opciones aparecen marcadas
        h.scene(s, ui, 4, 6);
        h.at(s + frac(6, 0.3), function () {
            ui.markMine([PARROT, TOUCAN]);
        });
        h.sfx(s + frac(6, 0.3), 'ding');
        s += h.dur(6) + PAD_MS;

        h.scene(s, ui, null, 7);
        h.at(s, function () {
            ui.resultsOn(false);
        });
        return s + h.dur(7) + PAD_MS + INTRO_MS;
    }

    root.XiroHowTo.register('survey', { createStage: root.XiroHowToUi.survey.createStage, timeline: single });
    root.XiroHowTo.register('survey_multiple', {
        createStage: root.XiroHowToUi.survey_multiple.createStage,
        timeline: multiple
    });
})(typeof window !== 'undefined' ? window : this);
