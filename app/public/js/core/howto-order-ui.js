/**
 * @fileoverview Escenario de la instrucción «order» (ordenar): un móvil con la pantalla del jugador (pregunta, lista
 * de elementos de colores que se arrastran de arriba abajo y el botón de enviar), el panel de ejemplo (posiciones
 * acertadas y efecto en la racha) y el panel de pasos, en el lienzo lógico de 1280x720 de howto-core.js. Usa el
 * marco común de howto-kit.js. ES5 (lo carga también tv.html). Los textos llegan en `T` (howto-order-text.js);
 * nada viene de la base de datos ni del usuario. El guion temporal está en howto-order.js.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;
    // Colores de las fichas del juego: rojo, azul, amarillo, verde
    const COLORS = ['#dc2626', '#2563eb', '#eab308', '#22c55e'];
    const LIGHT = '#eab308'; // fondo claro: el juego pone tinta oscura encima
    const SLOT = 74; // alto de cada hueco de la lista (px del lienzo)
    // Orden en que aparecen al principio (índices de T.opts, que va en el orden correcto)
    // Tras colocar Mercurio y Venus quedan Marte y Tierra al revés: es el «2 de 4» que se explica al puntuar
    const START = [3, 2, 0, 1];

    function itemsHtml(T) {
        return T.opts
            .map(function (text, i) {
                const ink =
                    COLORS[i] === LIGHT
                        ? ' style="background-color:' + COLORS[i] + ';color:#1e293b"'
                        : ' style="background-color:' + COLORS[i] + '"';
                return (
                    '<div class="howto-or-item"' +
                    ink +
                    '><i></i><span>' +
                    Kit.esc(text) +
                    '</span><b>&#8801;</b></div>'
                );
            })
            .join('');
    }

    /**
     * Construye el escenario dentro de `host` y devuelve la API de primitivas.
     * @param {Element} host - Contenedor (se vacía)
     * @param {Object} T - Textos del idioma
     * @returns {Object}
     */
    function createStage(host, T) {
        const inner =
            '<p class="howto-or-hint">' +
            Kit.esc(T.hint) +
            '</p>' +
            '<div class="howto-or-list">' +
            itemsHtml(T) +
            '</div>' +
            '<div class="howto-footer"><div class="howto-finish howto-or-send">' +
            Kit.esc(T.btn) +
            '</div></div>';
        const api = Kit.createStage(host, T, inner);
        const list = api.q('.howto-or-list');
        const items = api.qa('.howto-or-item');
        const send = api.q('.howto-or-send');
        let order = START.slice();

        function layout() {
            order.forEach(function (opt, slot) {
                items[opt].style.top = slot * SLOT + 'px';
                items[opt].querySelector('i').textContent = String(slot + 1);
            });
        }

        api.slotOf = function (opt) {
            return order.indexOf(opt);
        };
        /** Dedo sobre un elemento (por su índice en T.opts) */
        api.fingerToItem = function (opt) {
            api.fingerSlow(false);
            api.fingerTo(items[opt]);
        };
        /** Dedo sobre un hueco de la lista (0 = arriba) */
        api.fingerToSlot = function (slot) {
            api.fingerSlow(false);
            api.fingerTo(list, 0, slot * SLOT + SLOT / 2 - list.offsetHeight / 2);
        };
        api.fingerToSend = function () {
            api.fingerSlow(false);
            api.fingerTo(send);
        };
        api.pulseItems = function (on) {
            items.forEach(function (n) {
                Kit.toggle(n, 'howto-pulse', on);
            });
        };
        api.grab = function (opt, on) {
            Kit.toggle(items[opt], 'howto-or-grab', on);
        };
        /** Mueve un elemento a otro hueco: los demás se desplazan */
        api.move = function (opt, slot) {
            order = order.filter(function (o) {
                return o !== opt;
            });
            order.splice(slot, 0, opt);
            layout();
        };
        api.sendTap = function (on) {
            Kit.toggle(send, 'howto-tap', on);
        };
        api.sendGlow = function (on) {
            Kit.toggle(send, 'howto-glow', on);
        };
        api.reset = function () {
            order = START.slice();
            items.forEach(function (n) {
                n.className = 'howto-or-item';
            });
            send.className = 'howto-finish howto-or-send';
            layout();
            api.resetCommon();
        };
        layout();
        return api;
    }

    root.XiroHowToUi = root.XiroHowToUi || {};
    root.XiroHowToUi.order = { createStage: createStage };
})(typeof window !== 'undefined' ? window : this);
