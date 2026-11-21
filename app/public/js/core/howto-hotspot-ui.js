/**
 * @fileoverview Escenario de la instrucción «hotspot» (Toca la imagen): un móvil con la pantalla del jugador (pregunta,
 * una imagen dibujada aquí en SVG, la chincheta que se clava y se mueve, y el botón de enviar), el área correcta que
 * aparece al revelar, el panel de ejemplo (dentro / cerca / lejos) y el panel de pasos, en el lienzo lógico de 1280x720
 * de howto-core.js. Usa el marco común de howto-kit.js y las clases `hs-*` de css/hotspot.css (la chincheta y el área).
 * ES5 (lo carga también tv.html). Los textos llegan en `T` (howto-hotspot-text.js); nada viene de la base de datos ni
 * del usuario. La imagen es fija (una casa con chimenea): el guion está en howto-hotspot.js.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;
    const IMG_W = 300; // tamaño lógico de la imagen en el móvil (4:3); sirve para colocar el dedo
    const IMG_H = 225;
    // Área de la chimenea en coordenadas 0-1 (como la que dibuja el editor)
    const AREA = '0.655,0.18 0.76,0.18 0.76,0.37 0.655,0.37';

    function houseSvg() {
        return (
            '<svg class="howto-hs-img" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">' +
            '<rect width="400" height="300" fill="#cee9c9"/>' +
            '<rect y="235" width="400" height="65" fill="#8ab817"/>' +
            '<rect x="40" y="165" width="12" height="75" fill="#6b4423"/>' +
            '<circle cx="46" cy="150" r="38" fill="#2d7244"/>' +
            '<rect x="120" y="135" width="200" height="105" fill="#f9b518"/>' +
            '<rect x="268" y="62" width="30" height="60" fill="#b42d2c"/>' +
            '<polygon points="105,140 220,60 335,140" fill="#793475"/>' +
            '<rect x="195" y="175" width="50" height="65" fill="#684374"/>' +
            '<circle cx="236" cy="208" r="3" fill="#f9b518"/>' +
            '<rect x="140" y="160" width="36" height="36" fill="#fff" stroke="#684374" stroke-width="4"/>' +
            '<rect x="264" y="160" width="36" height="36" fill="#fff" stroke="#684374" stroke-width="4"/>' +
            '</svg>'
        );
    }

    /**
     * Construye el escenario dentro de `host` y devuelve la API de primitivas.
     * @param {Element} host - Contenedor (se vacía)
     * @param {Object} T - Textos del idioma
     * @returns {Object}
     */
    function createStage(host, T) {
        const inner =
            '<div class="howto-hs-frame"><div class="howto-hs-stage">' +
            houseSvg() +
            '<svg class="hs-svg howto-hs-area" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">' +
            '<polygon class="hs-area" points="' +
            AREA +
            '"/></svg>' +
            '<span class="hs-pin hs-pin--own howto-hs-pin"></span></div></div>' +
            '<p class="howto-hs-hint">' +
            Kit.esc(T.hint) +
            '</p>' +
            '<div class="howto-footer"><div class="howto-finish howto-hs-send">' +
            Kit.esc(T.btn) +
            '</div></div>';
        const api = Kit.createStage(host, T, inner);
        api.stage.className += ' howto-hs';
        const image = api.q('.howto-hs-stage');
        const area = api.q('.howto-hs-area');
        const pin = api.q('.howto-hs-pin');
        const question = api.q('.howto-question');
        const send = api.q('.howto-hs-send');

        /** Dedo sobre un punto de la imagen (x, y en 0-1) */
        api.fingerToPoint = function (x, y) {
            api.fingerSlow(false);
            api.fingerTo(image, (x - 0.5) * IMG_W, (y - 0.5) * IMG_H);
        };
        api.fingerToSend = function () {
            api.fingerSlow(false);
            api.fingerTo(send);
        };
        /** Clava la chincheta en un punto (0-1); si ya estaba puesta, se desliza hasta allí */
        api.pinAt = function (x, y) {
            pin.style.left = x * 100 + '%';
            pin.style.top = y * 100 + '%';
            Kit.toggle(pin, 'howto-on', true);
        };
        api.pinOff = function () {
            Kit.toggle(pin, 'howto-on', false);
        };
        /** Muestra u oculta el área correcta (la que revela el presentador) */
        api.areaOn = function (on) {
            Kit.toggle(area, 'howto-on', on);
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
        api.reset = function () {
            pin.className = 'hs-pin hs-pin--own howto-hs-pin';
            pin.style.left = '';
            pin.style.top = '';
            area.setAttribute('class', 'hs-svg howto-hs-area');
            question.className = 'howto-question';
            send.className = 'howto-finish howto-hs-send';
            api.resetCommon();
        };
        return api;
    }

    root.XiroHowToUi = root.XiroHowToUi || {};
    root.XiroHowToUi.hotspot = { createStage: createStage };
})(typeof window !== 'undefined' ? window : this);
