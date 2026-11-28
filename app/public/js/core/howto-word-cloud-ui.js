/**
 * @fileoverview Escenario de la instrucción «word_cloud» (Nube de palabras): un móvil con la pantalla del jugador
 * (pregunta, casillas de palabra, botón Enviar), la nube que sustituye al formulario al enviar (la pinta
 * word-cloud-render.js, la misma de la partida) y el panel de pasos, en el lienzo lógico de 1280x720 de howto-core.js.
 * Usa el marco común de howto-kit.js y las clases `howto-wc-*` de css/howto.css. ES5 (lo carga también tv.html). Los
 * textos llegan en `T` (howto-word-cloud-text.js); nada viene de la base de datos ni del usuario. El guion está en
 * howto-word-cloud.js.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;
    const BOXES = 3; // casillas de la demo («hasta 3 palabras»)
    const CLOUD_W = 300; // tamaño lógico de la nube en el móvil
    const CLOUD_H = 250;

    function boxesHtml() {
        let html = '';
        for (let i = 0; i < BOXES; i++) html += '<div class="howto-wc-box"></div>';
        return html;
    }

    /**
     * Construye el escenario dentro de `host` y devuelve la API de primitivas.
     * @param {Element} host - Contenedor (se vacía)
     * @param {Object} T - Textos del idioma
     * @returns {Object}
     */
    function createStage(host, T) {
        // El marco común reserva la pantalla «enviada» y el ejemplo de puntos, que esta pregunta no usa
        const texts = Object.assign({ sentTitle: '', sentBody: '', sExample: '', sTotal: '' }, T);
        const inner =
            '<div class="howto-wc-form">' +
            boxesHtml() +
            '<p class="howto-wc-hint">' +
            Kit.esc(T.hint) +
            '</p></div>' +
            '<div class="howto-wc-cloud"><div class="wc-cloud"></div></div>' +
            '<p class="howto-wc-notice"></p>' +
            '<div class="howto-footer"><div class="howto-finish howto-wc-send">' +
            Kit.esc(T.btn) +
            '</div></div>';
        const api = Kit.createStage(host, texts, inner);
        api.stage.className += ' howto-wc';
        const boxes = api.qa('.howto-wc-box');
        const canvas = api.q('.howto-wc-cloud .wc-cloud');
        const notice = api.q('.howto-wc-notice');
        const question = api.q('.howto-question');
        const send = api.q('.howto-wc-send');

        api.fingerToBox = function (i) {
            api.fingerSlow(false);
            api.fingerTo(boxes[i]);
        };
        api.fingerToSend = function () {
            api.fingerSlow(false);
            api.fingerTo(send);
        };
        /** Escribe una palabra en una casilla */
        api.boxText = function (i, text) {
            boxes[i].textContent = text;
            Kit.toggle(boxes[i], 'howto-wc-filled', Boolean(text));
        };
        api.pulseQuestion = function (on) {
            Kit.toggle(question, 'howto-pulse', on);
        };
        api.sendTap = function (on) {
            Kit.toggle(send, 'howto-tap', on);
        };
        api.sendGlow = function (on) {
            Kit.toggle(send, 'howto-glow', on);
        };
        /** Tras enviar, la nube sustituye al formulario y al botón */
        api.sentOn = function (on) {
            Kit.toggle(api.stage, 'howto-wc-sent', on);
        };
        /** Pinta la nube con la misma pieza que la partida; las palabras que siguen se reutilizan y crecen */
        api.cloud = function (pairs) {
            const words = pairs.map(function (pair) {
                return { key: String(pair[0]).toLowerCase(), text: pair[0], count: pair[1] };
            });
            root.XiroWordCloudRender.render(canvas, { words: words }, { width: CLOUD_W, height: CLOUD_H });
        };
        api.notice = function (text) {
            notice.textContent = text || '';
        };
        api.reset = function () {
            boxes.forEach(function (box) {
                box.textContent = '';
                box.className = 'howto-wc-box';
            });
            canvas.innerHTML = '';
            notice.textContent = '';
            api.stage.className = api.stage.className.replace(' howto-wc-sent', '');
            question.className = 'howto-question';
            send.className = 'howto-finish howto-wc-send';
            api.resetCommon();
        };
        return api;
    }

    root.XiroHowToUi = root.XiroHowToUi || {};
    root.XiroHowToUi.word_cloud = { createStage: createStage };
})(typeof window !== 'undefined' ? window : this);
