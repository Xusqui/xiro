/**
 * @fileoverview Escenario de la instrucción «numeric_approximation» (aproximación numérica): un móvil con la pantalla
 * del jugador (pregunta, pista, caja donde se teclea un número entero y botón de enviar), el panel de ejemplo (cuanto
 * más cerca del número correcto más puntos; exacto = bonus; fuera del margen = 0) y el panel de pasos, en el lienzo
 * lógico de 1280x720 de howto-core.js. Usa el marco común de howto-kit.js. ES5 (lo carga también tv.html). Los textos
 * llegan en `T` (howto-numeric-approximation-text.js); nada viene de la base de datos ni del usuario. El guion está en
 * howto-numeric-approximation.js.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;

    /**
     * Construye el escenario dentro de `host` y devuelve la API de primitivas.
     * @param {Element} host - Contenedor (se vacía)
     * @param {Object} T - Textos del idioma
     * @returns {Object}
     */
    function createStage(host, T) {
        const inner =
            '<div class="howto-nm-hint"><small>' +
            Kit.esc(T.hintLabel) +
            '</small><span>' +
            Kit.esc(T.hintText) +
            '</span></div>' +
            '<div class="howto-nm-card"><label>' +
            Kit.esc(T.ansLabel) +
            '</label>' +
            '<div class="howto-nm-input"><span class="howto-nm-typed"></span><i class="howto-nm-caret"></i></div>' +
            '<p>' +
            Kit.esc(T.onlyInt) +
            '</p></div>' +
            '<div class="howto-footer"><div class="howto-finish howto-nm-send">' +
            Kit.esc(T.btn) +
            '</div></div>';
        const api = Kit.createStage(host, T, inner);
        const hint = api.q('.howto-nm-hint');
        const input = api.q('.howto-nm-input');
        const typed = api.q('.howto-nm-typed');
        const send = api.q('.howto-nm-send');

        api.fingerToInput = function () {
            api.fingerSlow(false);
            api.fingerTo(input);
        };
        api.fingerToSend = function () {
            api.fingerSlow(false);
            api.fingerTo(send);
        };
        api.pulseHint = function (on) {
            Kit.toggle(hint, 'howto-pulse', on);
        };
        api.inputTap = function (on) {
            Kit.toggle(input, 'howto-tap', on);
        };
        /** Pone el foco en la caja (borde marcado y cursor parpadeando) */
        api.focusInput = function (on) {
            Kit.toggle(input, 'howto-nm-focus', on);
        };
        /** Lo que hay escrito en la caja */
        api.type = function (text) {
            typed.textContent = text;
        };
        api.sendTap = function (on) {
            Kit.toggle(send, 'howto-tap', on);
        };
        api.sendGlow = function (on) {
            Kit.toggle(send, 'howto-glow', on);
        };
        api.reset = function () {
            hint.className = 'howto-nm-hint';
            input.className = 'howto-nm-input';
            typed.textContent = '';
            send.className = 'howto-finish howto-nm-send';
            api.resetCommon();
        };
        return api;
    }

    root.XiroHowToUi = root.XiroHowToUi || {};
    root.XiroHowToUi.numeric_approximation = { createStage: createStage };
})(typeof window !== 'undefined' ? window : this);
