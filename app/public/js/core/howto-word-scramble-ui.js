/**
 * @fileoverview Escenario de la instrucción «word_scramble» (adivinar palabra): un móvil con la pantalla del jugador
 * (pregunta, «palabra de N letras», casillas, fichas de letras barajadas con alguna de más, botones Borrar y Enviar),
 * el panel de ejemplo de puntos (acierto + bonus de tiempo) y el panel de pasos, en el lienzo lógico de 1280x720 de
 * howto-core.js. Usa el marco común de howto-kit.js. ES5 (lo carga también tv.html). Los textos llegan en `T`
 * (howto-word-scramble-text.js); nada viene de la base de datos ni del usuario. El guion está en howto-word-scramble.js.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;

    /**
     * Construye el escenario dentro de `host` y devuelve la API de primitivas.
     * @param {Element} host - Contenedor (se vacía)
     * @param {Object} T - Textos del idioma (word, tiles, solution, wrong, wl, btnReset, btn...)
     * @returns {Object}
     */
    function createStage(host, T) {
        const boxesHtml = T.word
            .map(function () {
                return '<div class="howto-ws-box"></div>';
            })
            .join('');
        const tilesHtml = T.tiles
            .map(function (letter) {
                return '<div class="howto-ws-tile">' + Kit.esc(letter) + '</div>';
            })
            .join('');
        const inner =
            '<p class="howto-ws-len">' +
            Kit.esc(T.wl.replace('{n}', String(T.word.length))) +
            '</p>' +
            '<div class="howto-ws-boxes">' +
            boxesHtml +
            '</div>' +
            '<div class="howto-ws-tiles">' +
            tilesHtml +
            '</div>' +
            '<div class="howto-footer howto-ws-footer"><div class="howto-ws-reset">' +
            Kit.esc(T.btnReset) +
            '</div>' +
            '<div class="howto-finish howto-ws-send">' +
            Kit.esc(T.btn) +
            '</div></div>';
        const api = Kit.createStage(host, T, inner);
        const boxes = api.qa('.howto-ws-box');
        const tiles = api.qa('.howto-ws-tile');
        const reset = api.q('.howto-ws-reset');
        const send = api.q('.howto-ws-send');
        let filled = [];

        api.fingerToTile = function (i) {
            api.fingerSlow(false);
            api.fingerTo(tiles[i]);
        };
        api.fingerToReset = function () {
            api.fingerSlow(false);
            api.fingerTo(reset);
        };
        api.fingerToSend = function () {
            api.fingerSlow(false);
            api.fingerTo(send);
        };
        api.tapTile = function (i, on) {
            Kit.toggle(tiles[i], 'howto-tap', on);
        };
        /** Pasa una ficha a la siguiente casilla libre (la ficha queda gastada) */
        api.place = function (i) {
            if (filled.length >= boxes.length) return;
            boxes[filled.length].textContent = T.tiles[i];
            Kit.toggle(boxes[filled.length], 'howto-ws-on', true);
            Kit.toggle(tiles[i], 'howto-ws-used', true);
            filled.push(i);
        };
        /** Borrar: vacía las casillas y devuelve las fichas */
        api.clear = function () {
            filled = [];
            boxes.forEach(function (b) {
                b.textContent = '';
                b.className = 'howto-ws-box';
            });
            tiles.forEach(function (t) {
                Kit.toggle(t, 'howto-ws-used', false);
            });
        };
        api.pulseBoxes = function (on) {
            boxes.forEach(function (b) {
                Kit.toggle(b, 'howto-pulse', on);
            });
        };
        api.resetTap = function (on) {
            Kit.toggle(reset, 'howto-tap', on);
        };
        api.sendTap = function (on) {
            Kit.toggle(send, 'howto-tap', on);
        };
        api.sendGlow = function (on) {
            Kit.toggle(send, 'howto-glow', on);
        };
        api.reset = function () {
            api.clear();
            tiles.forEach(function (t) {
                t.className = 'howto-ws-tile';
            });
            reset.className = 'howto-ws-reset';
            send.className = 'howto-finish howto-ws-send';
            api.resetCommon();
        };
        return api;
    }

    root.XiroHowToUi = root.XiroHowToUi || {};
    root.XiroHowToUi.word_scramble = { createStage: createStage };
})(typeof window !== 'undefined' ? window : this);
