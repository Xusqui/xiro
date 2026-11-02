/**
 * @fileoverview Escenario de la instrucción «quiz»: un móvil con la pantalla del jugador (pregunta y cuatro
 * respuestas de colores), las pantallas de puntos (sorteo, ejemplo de bonus de tiempo, resultado) y el panel
 * de pasos, en el lienzo lógico de 1280x720 de howto-core.js. ES5 (lo carga también tv.html). Los textos
 * llegan en `T` (howto-quiz-text.js); nada viene de la base de datos ni del usuario. El guion temporal está
 * en howto-quiz.js. La intro y el panel de pasos comparten estilos con el resto de temas (css/howto.css).
 */
(function (root) {
    'use strict';

    // Colores de las fichas de respuesta del juego (rojo, azul, amarillo, verde)
    const COLORS = ['#dc2626', '#2563eb', '#eab308', '#22c55e'];
    const LIGHT = '#eab308'; // fondo claro: el juego pone tinta oscura encima
    // Ejemplo del bonus de tiempo: base 20 y hasta 20 de bonus (valores por defecto del juego)
    const BASE = 20;
    const MAX_BONUS = 20;
    const SCALE = BASE + MAX_BONUS + 10; // ancho de la barra = 50 puntos
    const ROWS = [
        { label: 'mFast', bonus: 18 },
        { label: 'mSlow', bonus: 4 },
        { label: 'mWrong', bonus: 0, wrong: true }
    ];

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
                    '<div class="howto-tile" style="background-color:' +
                    COLORS[i] +
                    '"' +
                    ink +
                    '><i>' +
                    (i + 1) +
                    '</i><span>' +
                    esc(text) +
                    '</span></div>'
                );
            })
            .join('');
    }

    function meterHtml(T) {
        const rows = ROWS.map(function (row) {
            return (
                '<div class="howto-mrow"><b>' +
                esc(T[row.label]) +
                '</b><div class="howto-mbar">' +
                '<div class="howto-mtrack"><i class="howto-mbase"></i><i class="howto-mbonus"></i></div>' +
                '<em></em></div></div>'
            );
        }).join('');
        return (
            '<p class="howto-mtag">' +
            esc(T.mExample) +
            '</p>' +
            rows +
            '<p class="howto-mkey"><span class="howto-mbase"></span>' +
            esc(T.mBase) +
            '<span class="howto-mbonus"></span>' +
            esc(T.mBonus) +
            '</p>'
        );
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
            '<div class="howto-tiles">' +
            tilesHtml(T) +
            '</div>' +
            '<div class="howto-points howto-on"><p class="howto-points-head">' +
            esc(T.rpHead) +
            '</p>' +
            '<div class="howto-points-num">0</div><p class="howto-points-tail">' +
            esc(T.rpTail) +
            '</p>' +
            '<div class="howto-points-modes"><span class="howto-mode howto-mode-random howto-on">' +
            esc(T.modeRandom) +
            '</span>' +
            '<span class="howto-mode howto-mode-fixed">' +
            esc(T.modeFixed) +
            '</span></div></div>' +
            '<div class="howto-meter">' +
            meterHtml(T) +
            '</div>' +
            '<div class="howto-sent"><img class="howto-sent-icon" src="/images/chamaleon/chamaleon.svg" alt=""><h3>' +
            esc(T.sentTitle) +
            '</h3>' +
            '<p>' +
            esc(T.sentBody) +
            '</p></div>' +
            '<div class="howto-result"><img class="howto-sent-icon" src="/images/chamaleon/chamaleon.svg" alt="">' +
            '<h3></h3><div class="howto-result-pts"></div><p class="howto-streak">' +
            esc(T.streakLbl) +
            ' +50%</p></div>' +
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
        const tiles = qa('.howto-tile');
        const rows = qa('.howto-mrow');
        const result = q('.howto-result');

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
        function points(n) {
            return (n > 0 ? '+' : '') + n + ' ' + T.ptsUnit;
        }

        const api = {
            stage: stage,
            fingerToTile: function (i) {
                toggle(finger, 'howto-slow', false);
                place(tiles[i]);
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
            choose: function (i) {
                tiles.forEach(function (n, k) {
                    toggle(n, k === i ? 'howto-picked' : 'howto-dim', true);
                });
            },
            pointsOn: function (on) {
                toggle(q('.howto-points'), 'howto-on', on);
            },
            pointsValue: function (n) {
                q('.howto-points-num').textContent = String(n);
            },
            pointsMode: function (fixed) {
                toggle(q('.howto-mode-random'), 'howto-on', !fixed);
                toggle(q('.howto-mode-fixed'), 'howto-on', fixed);
            },
            meterOn: function (on) {
                toggle(q('.howto-meter'), 'howto-on', on);
            },
            meterRow: function (i) {
                const row = rows[i];
                const spec = ROWS[i];
                row.classList.add('howto-show');
                row.querySelector('.howto-mbase').style.width = (spec.wrong ? 0 : (BASE / SCALE) * 100) + '%';
                row.querySelector('.howto-mbonus').style.width = (spec.bonus / SCALE) * 100 + '%';
                row.querySelector('em').textContent = String(spec.wrong ? 0 : BASE + spec.bonus);
            },
            result: function (kind, n) {
                result.className = 'howto-result' + (kind ? ' howto-on howto-' + kind : '');
                if (!kind) return;
                result.querySelector('h3').textContent = kind === 'ok' ? T.okTitle : T.badTitle;
                api.resultPts(kind === 'ok' ? n : 0);
            },
            resultPts: function (n) {
                result.querySelector('.howto-result-pts').textContent = points(n);
            },
            streak: function (on) {
                toggle(result, 'howto-streaking', on);
            },
            intro: function (on) {
                toggle(stage, 'howto-intro-on', on);
            },
            sent: function (on) {
                toggle(q('.howto-sent'), 'howto-on', on);
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
                n.className = 'howto-tile';
            });
            rows.forEach(function (n) {
                n.className = 'howto-mrow';
                Array.prototype.forEach.call(n.querySelectorAll('i'), function (bar) {
                    bar.style.width = '0';
                });
                n.querySelector('em').textContent = '';
            });
            api.sent(false);
            api.meterOn(false);
            api.result(null);
            api.pointsOn(true);
            api.pointsMode(false);
            api.pointsValue(0);
            api.intro(true);
            finger.className = 'howto-finger';
            api.step(-1);
        };
        return api;
    }

    root.XiroHowToUi = root.XiroHowToUi || {};
    root.XiroHowToUi.quiz = { createStage: createStage };
})(typeof window !== 'undefined' ? window : this);
