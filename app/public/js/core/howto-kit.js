/**
 * @fileoverview Piezas comunes de las instrucciones animadas (howto) nuevas: el marco (móvil con apodo y pregunta,
 * panel de pasos con pie de texto, rótulo de intro), el dedo, la pantalla «enviada», el panel de ejemplo de puntos
 * y el envoltorio del guion que desplaza el tiempo por la intro. Cada tema aporta solo su pantalla interior, sus
 * primitivas y su guion. Los textos llegan en `T` (howto-<tema>-text.js); nada viene de la base de datos ni del
 * usuario. ES5 (lo carga también tv.html). Los temas quiz, word_search y multiple_choice llevan su propia copia.
 */
(function (root) {
    'use strict';

    const PAD_MS = 500;
    const INTRO_MS = 3200; // rótulo «<tipo de pregunta> · Instrucciones» antes de la primera escena

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

    function toggle(node, cls, on) {
        node.classList[on ? 'add' : 'remove'](cls);
    }

    /**
     * Construye el escenario: `inner` es el HTML de la pantalla del móvil entre la pregunta y los avisos
     * (casillas, lista, huecos, teclado...). Devuelve el escenario y las primitivas comunes.
     * @param {Element} host - Contenedor (se vacía)
     * @param {Object} T - Textos del idioma (nick, q, kicker, title, steps, introName, introLabel, sentTitle,
     *   sentBody, sExample, sTotal)
     * @param {string} inner - HTML interior de la pantalla
     * @param {string} [questionClass] - Clase extra de la pregunta (p. ej. una pregunta con hueco)
     * @returns {Object}
     */
    function createStage(host, T, inner, questionClass) {
        const html =
            '<div class="howto-phone"><div class="howto-screen">' +
            '<div class="howto-nick">' +
            esc(T.nick) +
            '</div>' +
            '<div class="howto-question ' +
            (questionClass || '') +
            '">' +
            (T.qHtml || esc(T.q)) +
            '</div>' +
            inner +
            '<div class="howto-sent"><img class="howto-sent-icon" src="/images/chamaleon/chamaleon.svg" alt=""><h3>' +
            esc(T.sentTitle) +
            '</h3><p>' +
            esc(T.sentBody) +
            '</p></div>' +
            '<div class="howto-score"><p class="howto-mtag">' +
            esc(T.sExample) +
            '</p><div class="howto-score-rows"></div>' +
            '<div class="howto-score-total"><b>' +
            esc(T.sTotal) +
            '</b><em></em></div></div>' +
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
            '</p></div>';
        const stage = el('div', 'howto-stage howto-intro-on', null, html);
        const steps = [];
        const q = function (sel) {
            return stage.querySelector(sel);
        };
        const qa = function (sel) {
            return Array.prototype.slice.call(stage.querySelectorAll(sel));
        };
        const finger = q('.howto-finger');
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
        function metrics() {
            const screen = q('.howto-screen');
            const s = screen.getBoundingClientRect();
            return { s: s, k: s.width / screen.offsetWidth || 1 };
        }
        const api = {
            stage: stage,
            q: q,
            qa: qa,
            finger: finger,
            /** Pone el dedo en el centro de un elemento de la pantalla, con un desplazamiento opcional (dx, dy) */
            fingerTo: function (target, dx, dy) {
                const m = metrics();
                const e = target.getBoundingClientRect();
                finger.style.left = (e.left - m.s.left + e.width / 2) / m.k + (dx || 0) + 'px';
                finger.style.top = (e.top - m.s.top + e.height / 2) / m.k + (dy || 0) + 'px';
            },
            fingerSlow: function (on) {
                toggle(finger, 'howto-slow', on);
            },
            fingerOn: function (on) {
                toggle(finger, 'howto-on', on);
            },
            fingerDown: function (on) {
                toggle(finger, 'howto-down', on);
            },
            sent: function (on) {
                toggle(q('.howto-sent'), 'howto-on', on);
            },
            scoreOn: function (on) {
                toggle(score, 'howto-on', on);
            },
            scoreClear: function () {
                scoreRows.innerHTML = '';
                scoreTotal.textContent = '';
            },
            /** Fila del ejemplo: kind = ok | bad | miss | perfect | info; `value` ya va con su signo o unidad */
            scoreRow: function (kind, label, value) {
                const row = el(
                    'div',
                    'howto-score-row howto-score-' + kind + (String(value).length > 4 ? ' howto-score-long' : ''),
                    scoreRows,
                    '<span>' + esc(label) + '</span><em>' + esc(value) + '</em>'
                );
                void row.offsetWidth; // reflujo: así se ve la transición de entrada
                row.classList.add('howto-show');
            },
            scoreTotal: function (text) {
                scoreTotal.textContent = text;
            },
            /** Muestra u oculta la línea del total (hay ejemplos sin total) */
            totalOn: function (on) {
                q('.howto-score-total').style.display = on ? '' : 'none';
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
            },
            /** Quita lo común; el tema añade lo suyo y debe llamar a esto desde su propio reset */
            resetCommon: function () {
                api.sent(false);
                api.scoreOn(false);
                api.scoreClear();
                api.totalOn(true);
                api.intro(true);
                finger.className = 'howto-finger';
                api.step(-1);
            }
        };
        return api;
    }

    /**
     * Envoltorio del guion: se escribe desde 0 y la intro lo desplaza INTRO_MS.
     * @param {Object} base - El constructor de howto-core.js (dur, at, sfx, scene)
     * @param {Object} ui - Escenario (reset, intro)
     * @returns {{h: Object, frac: function(number, number): number}}
     */
    function script(base, ui) {
        const h = {
            dur: base.dur,
            at: function (t, fn) {
                base.at(t + INTRO_MS, fn);
            },
            sfx: function (t, name) {
                base.sfx(t + INTRO_MS, name);
            },
            scene: function (t, u, step, clip) {
                base.scene(t + INTRO_MS, u, step, clip);
            }
        };
        base.at(0, function () {
            ui.reset();
        });
        base.at(INTRO_MS - 100, function () {
            ui.intro(false);
        });
        return {
            h: h,
            frac: function (clip, f) {
                return Math.round(h.dur(clip) * f);
            }
        };
    }

    root.XiroHowToKit = {
        PAD_MS: PAD_MS,
        INTRO_MS: INTRO_MS,
        esc: esc,
        el: el,
        toggle: toggle,
        createStage: createStage,
        script: script
    };
})(typeof window !== 'undefined' ? window : this);
