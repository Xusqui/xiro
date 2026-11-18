/**
 * @fileoverview Escenarios de las instrucciones «survey» (encuesta) y «survey_multiple» (encuesta múltiple): un móvil
 * con la pantalla del jugador (pregunta y cuatro opciones de colores; la múltiple añade las marcas con visto y el botón
 * «Enviar» / «Ninguna»), la pantalla «voto registrado» y la lista de resultados con barras y porcentajes (con la
 * elección del jugador marcada), más el panel de pasos, en el lienzo lógico de 1280x720 de howto-core.js. Usa el marco
 * común de howto-kit.js. ES5 (lo carga también tv.html). Los textos llegan en `T` (howto-survey-text.js y
 * howto-survey-multiple-text.js); nada viene de la base de datos ni del usuario. El guion está en howto-survey.js.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;
    // Colores de las opciones del juego: rojo, azul, amarillo, verde
    const COLORS = ['#dc2626', '#2563eb', '#eab308', '#22c55e'];
    const LIGHT = '#eab308'; // fondo claro: el juego pone tinta oscura encima

    function build(host, T, multi) {
        const tiles = T.opts
            .map(function (text, i) {
                const ink = COLORS[i] === LIGHT ? ';color:#1e293b' : '';
                return (
                    '<div class="howto-tile howto-sv-tile' +
                    (multi ? ' howto-mc-tile' : '') +
                    '" style="background-color:' +
                    COLORS[i] +
                    ink +
                    '"><span>' +
                    Kit.esc(text) +
                    '</span>' +
                    (multi ? '<b class="howto-mc-check">&#10003;</b>' : '') +
                    '</div>'
                );
            })
            .join('');
        const rows = T.opts
            .map(function (text) {
                return (
                    '<div class="howto-sv-row"><span>' +
                    Kit.esc(text) +
                    '</span><div class="howto-sv-track"><i></i></div><em>0 %</em></div>'
                );
            })
            .join('');
        const inner =
            (multi ? '<p class="howto-mc-hint">' + Kit.esc(T.hint) + '</p>' : '') +
            '<div class="howto-tiles howto-sv-tiles' +
            (multi ? ' howto-sv-multi' : '') +
            '">' +
            tiles +
            '</div>' +
            (multi
                ? '<div class="howto-footer"><div class="howto-finish howto-sv-send">' +
                  Kit.esc(T.btnNone) +
                  '</div></div>'
                : '') +
            '<div class="howto-sv-results"><p class="howto-mtag"></p>' +
            rows +
            '</div>';
        const api = Kit.createStage(host, Object.assign({ sExample: '', sTotal: '' }, T), inner);
        const tileEls = api.qa('.howto-sv-tile');
        const rowEls = api.qa('.howto-sv-row');
        const results = api.q('.howto-sv-results');
        const send = api.q('.howto-sv-send');

        api.fingerToTile = function (i) {
            api.fingerSlow(false);
            api.fingerTo(tileEls[i]);
        };
        api.fingerToSend = function () {
            api.fingerSlow(false);
            api.fingerTo(send);
        };
        api.pulseTiles = function (on) {
            tileEls.forEach(function (n) {
                Kit.toggle(n, 'howto-pulse', on);
            });
        };
        api.tapTile = function (i, on) {
            Kit.toggle(tileEls[i], 'howto-tap', on);
        };
        /** Encuesta simple: la opción elegida se destaca y las demás se apagan */
        api.choose = function (i) {
            tileEls.forEach(function (n, k) {
                Kit.toggle(n, k === i ? 'howto-picked' : 'howto-dim', true);
            });
        };
        /** Encuesta múltiple: marca o desmarca una opción; el botón dice «Enviar» si hay alguna marcada, si no «Ninguna» */
        api.mark = function (i, on) {
            Kit.toggle(tileEls[i], 'howto-mc-on', on);
            if (send) {
                const any = tileEls.some(function (n) {
                    return n.classList.contains('howto-mc-on');
                });
                send.textContent = any ? T.btn : T.btnNone;
            }
        };
        api.sendTap = function (on) {
            if (send) Kit.toggle(send, 'howto-tap', on);
        };
        api.sendGlow = function (on) {
            if (send) Kit.toggle(send, 'howto-glow', on);
        };
        api.resultsOn = function (on) {
            Kit.toggle(results, 'howto-on', on);
        };
        /** Rellena las barras con los porcentajes y el número de respuestas (la lista ya está visible) */
        api.fillResults = function (percents, respondents) {
            results.querySelector('.howto-mtag').textContent = respondents + ' ' + T.sResp;
            rowEls.forEach(function (row, i) {
                row.querySelector('i').style.width = percents[i] + '%';
                row.querySelector('em').textContent = percents[i] + ' %';
            });
        };
        /** Marca con un visto las opciones que votó el jugador */
        api.markMine = function (indices) {
            rowEls.forEach(function (row, i) {
                Kit.toggle(row, 'howto-sv-mine', indices.indexOf(i) >= 0);
            });
        };
        api.reset = function () {
            tileEls.forEach(function (n) {
                n.className = 'howto-tile howto-sv-tile' + (multi ? ' howto-mc-tile' : '');
            });
            if (send) {
                send.className = 'howto-finish howto-sv-send';
                send.textContent = T.btnNone;
            }
            results.className = 'howto-sv-results';
            rowEls.forEach(function (row) {
                row.className = 'howto-sv-row';
                row.querySelector('i').style.width = '0';
                row.querySelector('em').textContent = '0 %';
            });
            api.resetCommon();
        };
        return api;
    }

    root.XiroHowToUi = root.XiroHowToUi || {};
    root.XiroHowToUi.survey = {
        createStage: function (host, T) {
            return build(host, T, false);
        }
    };
    root.XiroHowToUi.survey_multiple = {
        createStage: function (host, T) {
            return build(host, T, true);
        }
    };
})(typeof window !== 'undefined' ? window : this);
