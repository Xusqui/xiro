/**
 * @fileoverview Escenario de la instrucción «matching» (emparejar): un móvil con la pantalla del jugador (pregunta,
 * columna izquierda fija con fichas de colores, columna derecha que se arrastra y botón de enviar), el panel de
 * ejemplo (parejas acertadas y cuándo la respuesta es correcta) y el panel de pasos, en el lienzo lógico de 1280x720
 * de howto-core.js. Usa el marco común de howto-kit.js. ES5 (lo carga también tv.html). Los textos llegan en `T`
 * (howto-matching-text.js); nada viene de la base de datos ni del usuario. El guion está en howto-matching.js.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;
    // Colores de las fichas de la izquierda: rojo, azul, amarillo, verde
    const COLORS = ['#dc2626', '#2563eb', '#eab308', '#22c55e'];
    const LIGHT = '#eab308'; // fondo claro: el juego pone tinta oscura encima
    const SLOT = 74; // alto de cada hueco (px del lienzo)
    // Orden de la columna derecha al principio (índice = pareja correcta en la izquierda): Berlín, Roma, París, Madrid.
    // Tras colocar Madrid y París, Italia y Alemania quedan cruzadas: es el «2 de 4» que se explica al puntuar
    const START = [3, 2, 1, 0];

    function leftHtml(T) {
        return T.left
            .map(function (text, i) {
                const ink = COLORS[i] === LIGHT ? ';color:#1e293b' : '';
                return (
                    '<div class="howto-mt-left" style="top:' +
                    i * SLOT +
                    'px;background-color:' +
                    COLORS[i] +
                    ink +
                    '"><span>' +
                    Kit.esc(text) +
                    '</span></div>'
                );
            })
            .join('');
    }

    function rightHtml(T) {
        return T.right
            .map(function (text) {
                return '<div class="howto-mt-right"><span>' + Kit.esc(text) + '</span><b>&#8801;</b></div>';
            })
            .join('');
    }

    function arrowsHtml(T) {
        return T.left
            .map(function (text, i) {
                return '<div class="howto-mt-arrow" style="top:' + i * SLOT + 'px">&#8596;</div>';
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
            '<div class="howto-mt-board">' +
            leftHtml(T) +
            arrowsHtml(T) +
            rightHtml(T) +
            '</div>' +
            '<div class="howto-footer"><div class="howto-finish howto-mt-send">' +
            Kit.esc(T.btn) +
            '</div></div>';
        const api = Kit.createStage(host, T, inner);
        const board = api.q('.howto-mt-board');
        const rights = api.qa('.howto-mt-right');
        const lefts = api.qa('.howto-mt-left');
        const arrows = api.qa('.howto-mt-arrow');
        const send = api.q('.howto-mt-send');
        let order = START.slice();

        function layout() {
            order.forEach(function (partner, slot) {
                rights[partner].style.top = slot * SLOT + 'px';
                const ok = partner === slot;
                Kit.toggle(rights[partner], 'howto-mt-ok', ok);
                Kit.toggle(arrows[slot], 'howto-mt-ok', ok);
                // la ficha de la derecha toma el color de su pareja al quedar bien puesta
                rights[partner].style.backgroundColor = ok ? COLORS[partner] : '';
                rights[partner].style.color = ok && COLORS[partner] !== LIGHT ? '#fff' : ok ? '#1e293b' : '';
            });
        }

        /** Dedo sobre un elemento de la derecha (por el índice de su pareja) */
        api.fingerToRight = function (partner) {
            api.fingerSlow(false);
            api.fingerTo(rights[partner]);
        };
        /** Dedo sobre un hueco de la columna derecha (0 = arriba) */
        api.fingerToRightSlot = function (slot) {
            api.fingerSlow(false);
            const dx = rights[0].offsetLeft + rights[0].offsetWidth / 2 - board.offsetWidth / 2;
            api.fingerTo(board, dx, slot * SLOT + SLOT / 2 - board.offsetHeight / 2);
        };
        api.fingerToSend = function () {
            api.fingerSlow(false);
            api.fingerTo(send);
        };
        api.pulseRight = function (on) {
            rights.forEach(function (n) {
                Kit.toggle(n, 'howto-pulse', on);
            });
        };
        api.grab = function (partner, on) {
            Kit.toggle(rights[partner], 'howto-mt-grab', on);
        };
        /** Mueve un elemento de la derecha a otro hueco: los demás se desplazan */
        api.move = function (partner, slot) {
            order = order.filter(function (p) {
                return p !== partner;
            });
            order.splice(slot, 0, partner);
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
            rights.forEach(function (n) {
                n.className = 'howto-mt-right';
            });
            arrows.forEach(function (n) {
                n.className = 'howto-mt-arrow';
            });
            send.className = 'howto-finish howto-mt-send';
            layout();
            api.resetCommon();
        };
        void lefts;
        layout();
        return api;
    }

    root.XiroHowToUi = root.XiroHowToUi || {};
    root.XiroHowToUi.matching = { createStage: createStage };
})(typeof window !== 'undefined' ? window : this);
