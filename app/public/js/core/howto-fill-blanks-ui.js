/**
 * @fileoverview Escenario de la instrucción «fill_blanks» (completa la frase): un móvil con la pantalla del jugador
 * (la frase con dos huecos de una casilla por letra, un botón de pista por hueco y el botón de enviar), el panel de
 * ejemplo de puntos (palabra acertada, pistas que bajan su valor, bonus de tiempo único, mitad de huecos = acierto) y
 * el panel de pasos, en el lienzo lógico de 1280x720 de howto-core.js. Usa el marco común de howto-kit.js. ES5 (lo
 * carga también tv.html). Los textos llegan en `T` (howto-fill-blanks-text.js); nada viene de la base de datos ni del
 * usuario. El guion temporal está en howto-fill-blanks.js.
 */
(function (root) {
    'use strict';

    const Kit = root.XiroHowToKit;

    function chars(word) {
        return Array.from ? Array.from(word) : word.split('');
    }

    /**
     * Construye el escenario dentro de `host` y devuelve la API de primitivas.
     * @param {Element} host - Contenedor (se vacía)
     * @param {Object} T - Textos del idioma (parts, words, labels, hintBtn, btn...)
     * @returns {Object}
     */
    function createStage(host, T) {
        const words = T.words.map(chars);
        const sentence = T.parts
            .map(function (part, i) {
                const blank =
                    i < words.length
                        ? '<span class="howto-fb-blank">' +
                          words[i]
                              .map(function () {
                                  return '<i class="howto-fb-cell"></i>';
                              })
                              .join('') +
                          '</span>'
                        : '';
                return Kit.esc(part) + blank;
            })
            .join('');
        const hints = words
            .map(function (_, i) {
                return '<div class="howto-fb-hint"><b>' + (i + 1) + '</b><span>' + Kit.esc(T.hintBtn) + '</span></div>';
            })
            .join('');
        const inner =
            '<div class="howto-fb-card"><div class="howto-fb-sentence">' +
            sentence +
            '</div></div>' +
            '<div class="howto-fb-hints">' +
            hints +
            '</div>' +
            '<div class="howto-footer"><div class="howto-finish howto-fb-send">' +
            Kit.esc(T.btn) +
            '</div></div>';
        const api = Kit.createStage(host, Object.assign({}, T, { q: '' }), inner);
        // En este tipo de pregunta la frase es el enunciado: se oculta la barra de pregunta del marco
        api.q('.howto-question').style.display = 'none';
        const blanks = api.qa('.howto-fb-blank');
        const hintBtns = api.qa('.howto-fb-hint');
        const send = api.q('.howto-fb-send');
        const cells = blanks.map(function (b) {
            return Array.prototype.slice.call(b.querySelectorAll('.howto-fb-cell'));
        });
        let typed = words.map(function () {
            return 0;
        });
        let hinted = words.map(function () {
            return [];
        });

        function paint(i) {
            cells[i].forEach(function (cell, pos) {
                const shown = pos < typed[i] || hinted[i].indexOf(pos) >= 0;
                cell.textContent = shown ? words[i][pos] : '';
                Kit.toggle(cell, 'howto-fb-hintcell', hinted[i].indexOf(pos) >= 0);
            });
        }

        api.fingerToBlank = function (i) {
            api.fingerSlow(false);
            api.fingerTo(blanks[i]);
        };
        api.fingerToHint = function (i) {
            api.fingerSlow(false);
            api.fingerTo(hintBtns[i]);
        };
        api.fingerToSend = function () {
            api.fingerSlow(false);
            api.fingerTo(send);
        };
        api.focusBlank = function (i, on) {
            Kit.toggle(blanks[i], 'howto-fb-focus', on);
        };
        api.pulseBlanks = function (on) {
            blanks.forEach(function (b) {
                Kit.toggle(b, 'howto-pulse', on);
            });
        };
        api.hintTap = function (i, on) {
            Kit.toggle(hintBtns[i], 'howto-tap', on);
        };
        /** Escribe las primeras `n` letras de la palabra del hueco `i` */
        api.fill = function (i, n) {
            typed[i] = n;
            paint(i);
        };
        /** Destapa la primera letra del hueco (pista): la casilla queda marcada y el botón gastado */
        api.hint = function (i) {
            hinted[i] = [0];
            Kit.toggle(hintBtns[i], 'howto-fb-used', true);
            paint(i);
        };
        api.sendTap = function (on) {
            Kit.toggle(send, 'howto-tap', on);
        };
        api.sendGlow = function (on) {
            Kit.toggle(send, 'howto-glow', on);
        };
        api.reset = function () {
            typed = words.map(function () {
                return 0;
            });
            hinted = words.map(function () {
                return [];
            });
            blanks.forEach(function (b, i) {
                b.className = 'howto-fb-blank';
                paint(i);
            });
            hintBtns.forEach(function (b) {
                b.className = 'howto-fb-hint';
            });
            send.className = 'howto-finish howto-fb-send';
            api.resetCommon();
        };
        return api;
    }

    root.XiroHowToUi = root.XiroHowToUi || {};
    root.XiroHowToUi.fill_blanks = { createStage: createStage };
})(typeof window !== 'undefined' ? window : this);
