/**
 * @fileoverview Escenario de la instrucción «multiple_choice» (respuesta múltiple): un móvil con la pantalla
 * del jugador (pregunta, seis casillas de colores que se marcan con un visto y el botón de enviar), el panel de
 * puntos del ejemplo (correctas suman, incorrectas restan, bonus de perfección) y el panel de pasos, en el
 * lienzo lógico de 1280x720 de howto-core.js. ES5 (lo carga también tv.html). Los textos llegan en `T`
 * (howto-multiple-choice-text.js); nada viene de la base de datos ni del usuario. El guion temporal está en
 * howto-multiple-choice.js. La intro y el panel de pasos comparten estilos con el resto de temas (css/howto.css).
 */
(function (root) {
    'use strict';

    // Colores de las casillas del juego: rojo, azul, amarillo, verde, morado y rosa
    const COLORS = ['#dc2626', '#2563eb', '#eab308', '#22c55e', '#9333ea', '#ec4899'];
    const LIGHT = '#eab308'; // fondo claro: el juego pone tinta oscura encima

    function esc(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function el(tag, cls, parent, html) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (html) node.innerHTML = html;
        if (parent) parent.appendChild(node);
        return node;
    }

    function tilesHtml(T) {
        return T.opts
            .map(function (text, i) {
                const ink = COLORS[i] === LIGHT ? ' style="color:#1e293b"' : '';
                return (
                    '<div class="howto-tile howto-mc-tile" style="background-color:' +
                    COLORS[i] +
                    '"' +
                    ink +
                    '><span>' +
                    esc(text) +
                    '</span><b class="howto-mc-check">&#10003;</b></div>'
                );
            })
            .join('');
    }

    function skeleton(T) {
        return (
            '<div class="howto-phone"><div class="howto-screen">' +
            '<div class="howto-nick">' +
            esc(T.nick) +
            '</div>' +
            '<div class="howto-question">' +
            esc(T.q) +
            '</div>' +
            '<p class="howto-mc-hint">' +
            esc(T.hint) +
            '</p>' +
            '<div class="howto-tiles howto-mc-tiles">' +
            tilesHtml(T) +
            '</div>' +
            '<div class="howto-footer"><div class="howto-finish howto-mc-send">' +
            esc(T.btn) +
            '</div></div>' +
            '<div class="howto-sent"><img class="howto-sent-icon" src="/images/chamaleon/chamaleon.svg" alt=""><h3>' +
            esc(T.sentTitle) +
            '</h3>' +
            '<p>' +
            esc(T.sentBody) +
            '</p></div>' +
            '<div class="howto-score"><p class="howto-mtag">' +
            esc(T.sExample) +
            '</p><div class="howto-score-rows"></div>' +
            '<div class="howto-score-total"><b>' +
            esc(T.sTotal) +
            '</b><em>0</em></div></div>' +
            '<div class="howto-finger"></div></div></div>' +
            '<div class="howto-side"><h1><small>' +
            esc(T.kicker) +
            '</small>' +
            esc(T.title) +
            '</h1>' +
            '<ol class="howto-steps"></ol><div class="howto-caption"></div></div>' +
            '<div class="howto-intro"><img class="howto-intro-logo" src="/images/logo.svg" alt="XiRo!">' +
            '<h2>' +
            esc(T.introName) +
            '</h2><p>' +
            esc(T.introLabel) +
            '</p></div>'
        );
    }

    /**
     * Construye el escenario dentro de `host` y devuelve la API de primitivas.
     * @param {Element} host - Contenedor (se vacía)
     * @param {Object} T - Textos del idioma
     * @returns {Object}
     */
    function createStage(host, T) {
        const stage = el('div', 'howto-stage howto-intro-on', null, skeleton(T));
        const steps = [];
        const q = function (sel) {
            return stage.querySelector(sel);
        };
        const qa = function (sel) {
            return Array.prototype.slice.call(stage.querySelectorAll(sel));
        };
        const finger = q('.howto-finger');
        const tiles = qa('.howto-mc-tile');
        const send = q('.howto-mc-send');
        const score = q('.howto-score');
        const scoreRows = q('.howto-score-rows');
        const scoreTotal = q('.howto-score-total em');

        host.innerHTML = '';
        host.appendChild(stage);
        T.steps.forEach(function (s, i) {
            steps.push(
                el(
                    'li',
                    'howto-step',
                    q('.howto-steps'),
                    '<i class="howto-n">' +
                        (i + 1) +
                        '</i><div><b>' +
                        esc(s[0]) +
                        '</b><span>' +
                        esc(s[1]) +
                        '</span></div>'
                )
            );
        });

        // El lienzo está escalado con transform: se mide en píxeles de pantalla y se divide por la escala
        function place(target) {
            const screen = q('.howto-screen');
            const s = screen.getBoundingClientRect();
            const e = target.getBoundingClientRect();
            const k = s.width / screen.offsetWidth || 1;
            finger.style.left = (e.left - s.left + e.width / 2) / k + 'px';
            finger.style.top = (e.top - s.top + e.height / 2) / k + 'px';
        }
        function toggle(node, cls, on) {
            node.classList[on ? 'add' : 'remove'](cls);
        }
        function signed(n) {
            return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
        }

        const api = {
            stage: stage,
            fingerToTile: function (i) {
                toggle(finger, 'howto-slow', false);
                place(tiles[i]);
            },
            fingerToSend: function () {
                toggle(finger, 'howto-slow', false);
                place(send);
            },
            fingerOn: function (on) {
                toggle(finger, 'howto-on', on);
            },
            fingerDown: function (on) {
                toggle(finger, 'howto-down', on);
            },
            pulseTiles: function (on) {
                tiles.forEach(function (n) {
                    toggle(n, 'howto-pulse', on);
                });
            },
            tapTile: function (i, on) {
                toggle(tiles[i], 'howto-tap', on);
            },
            /** Marca o desmarca una casilla (visto verde sobre la ficha) */
            mark: function (i, on) {
                toggle(tiles[i], 'howto-mc-on', on);
            },
            sendTap: function (on) {
                toggle(send, 'howto-tap', on);
            },
            sendGlow: function (on) {
                toggle(send, 'howto-glow', on);
            },
            sent: function (on) {
                toggle(q('.howto-sent'), 'howto-on', on);
            },
            scoreOn: function (on) {
                toggle(score, 'howto-on', on);
            },
            scoreClear: function () {
                scoreRows.innerHTML = '';
                scoreTotal.textContent = '0';
            },
            /** Fila del ejemplo: kind = ok (correcta marcada), bad (incorrecta marcada), miss (correcta sin marcar), perfect */
            scoreRow: function (kind, name, value) {
                const label =
                    kind === 'perfect'
                        ? T.sPerfect
                        : name + ' · ' + T[kind === 'ok' ? 'sCorrect' : kind === 'bad' ? 'sWrong' : 'sMissed'];
                const row = el(
                    'div',
                    'howto-score-row howto-score-' + kind,
                    scoreRows,
                    '<span>' + esc(label) + '</span><em>' + esc(signed(value)) + '</em>'
                );
                // fuerza el reflujo para que la transición de entrada se vea
                void row.offsetWidth;
                row.classList.add('howto-show');
            },
            scoreTotal: function (n) {
                scoreTotal.textContent = signed(n) + ' ' + T.ptsUnit;
            },
            intro: function (on) {
                toggle(stage, 'howto-intro-on', on);
            },
            caption: function (html) {
                q('.howto-caption').innerHTML = html;
            },
            step: function (n) {
                steps.forEach(function (li, i) {
                    toggle(li, 'howto-active', i === n);
                    toggle(li, 'howto-done', i < n);
                });
            }
        };
        api.reset = function () {
            tiles.forEach(function (n) {
                n.className = 'howto-tile howto-mc-tile';
            });
            send.className = 'howto-finish howto-mc-send';
            api.sent(false);
            api.scoreOn(false);
            api.scoreClear();
            api.intro(true);
            finger.className = 'howto-finger';
            api.step(-1);
        };
        return api;
    }

    root.XiroHowToUi = root.XiroHowToUi || {};
    root.XiroHowToUi.multiple_choice = { createStage: createStage };
})(typeof window !== 'undefined' ? window : this);
