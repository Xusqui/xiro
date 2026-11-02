/**
 * @fileoverview Escenario de la instrucción «word_search» (Sopa de letras): un móvil con la pantalla
 * del jugador y un panel de pasos, en un lienzo lógico de 1280x720 que se escala al hueco. ES5
 * (lo carga también tv.html). Los textos llegan en `T` (howto-word-search-text.js); nada viene de la
 * base de datos ni del usuario. El guion temporal está en howto-word-search.js.
 */
(function (root) {
    'use strict';

    // Colores de las fichas de respuesta del juego (rojo, azul, amarillo, verde)
    const COLORS = ['#dc2626', '#2563eb', '#eab308', '#22c55e', '#94438e', '#ec4899'];
    const LIGHT = '#eab308'; // fondo claro: el juego pone tinta oscura encima
    const N = 10;
    // Posición fija de las 4 palabras (la longitud la da cada idioma: 2-7, la 3.ª hasta 5, XIRO son 4)
    const PLACES = [
        { r: 2, c: 1, dr: 0, dc: 1 },
        { r: 4, c: 0, dr: 1, dc: 1 },
        { r: 8, c: 9, dr: 0, dc: -1 },
        { r: 1, c: 8, dr: 1, dc: 0 }
    ];

    function wordCells(place, length) {
        const out = [];
        for (let i = 0; i < length; i++) out.push([place.r + place.dr * i, place.c + place.dc * i]);
        return out;
    }

    function buildGrid(T) {
        const grid = [];
        let seed = 7;
        for (let r = 0; r < N; r++) {
            grid.push([]);
            for (let c = 0; c < N; c++) grid[r].push('');
        }
        T.words.forEach(function (word, w) {
            const chars = word.split('');
            wordCells(PLACES[w], chars.length).forEach(function (p, i) { grid[p[0]][p[1]] = chars[i]; });
        });
        const alphabet = T.alphabet.split('');
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (grid[r][c]) continue;
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                grid[r][c] = alphabet[Math.floor((seed / 0x7fffffff) * alphabet.length)];
            }
        }
        return grid;
    }

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

    function skeleton(T) {
        return (
            '<div class="howto-phone"><div class="howto-screen">' +
            '<div class="howto-nick">' + esc(T.nick) + '</div>' +
            '<div class="howto-question">' + esc(T.q) + '</div>' +
            '<div class="howto-play"><div class="howto-grid"></div>' +
            '<p class="howto-help">' + esc(T.help) + '</p><div class="howto-words"></div></div>' +
            '<div class="howto-footer"><p class="howto-progress"><span class="howto-count">0</span>/4</p>' +
            '<div class="howto-finish">' + esc(T.finish) + '</div></div>' +
            '<div class="howto-sent"><img class="howto-sent-icon" src="/images/chamaleon/chamaleon.svg" alt=""><h3>' + esc(T.sentTitle) + '</h3>' +
            '<p>' + esc(T.sentBody) + '</p></div>' +
            '<div class="howto-finger"></div></div></div>' +
            '<div class="howto-side"><h1><small>' + esc(T.kicker) + '</small>' + esc(T.title) + '</h1>' +
            '<ol class="howto-steps"></ol><div class="howto-caption"></div></div>' +
            '<div class="howto-intro"><img class="howto-intro-logo" src="/images/logo.svg" alt="XiRo!">' +
            '<h2>' + esc(T.introName) + '</h2><p>' + esc(T.introLabel) + '</p></div>'
        );
    }

    /**
     * Construye el escenario dentro de `host` y devuelve la API de primitivas.
     * @param {Element} host - Contenedor (se vacía)
     * @param {Object} T - Textos del idioma
     * @returns {Object}
     */
    function createStage(host, T) {
        const grid = buildGrid(T);
        const stage = el('div', 'howto-stage howto-intro-on', null, skeleton(T));
        const cells = [];
        const chips = [];
        const steps = [];
        let found = 0;
        const q = function (sel) { return stage.querySelector(sel); };
        const finger = q('.howto-finger');

        host.innerHTML = '';
        host.appendChild(stage);
        grid.forEach(function (row, r) {
            const rowEl = el('div', 'howto-row', q('.howto-grid'));
            cells.push([]);
            row.forEach(function (ch) { cells[r].push(el('div', 'howto-cell', rowEl, esc(ch))); });
        });
        T.words.forEach(function (w) {
            chips.push(el('div', 'howto-word', q('.howto-words'), '<span>' + esc(w) + '</span><span class="howto-half">💡½</span>'));
        });
        T.steps.forEach(function (s, i) {
            steps.push(el('li', 'howto-step', q('.howto-steps'),
                '<i class="howto-n">' + (i + 1) + '</i><div><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>'));
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
        function toggle(node, cls, on) { node.classList[on ? 'add' : 'remove'](cls); }
        function eachCell(fn) { cells.forEach(function (row) { row.forEach(fn); }); }
        function cellsOf(i) { return wordCells(PLACES[i], T.words[i].split('').length); }

        const api = {
            stage: stage,
            cellsOf: cellsOf,
            fingerTo: function (r, c, slow) { toggle(finger, 'howto-slow', slow); place(cells[r][c]); },
            fingerToFinish: function () { toggle(finger, 'howto-slow', false); place(q('.howto-finish')); },
            fingerToChip: function (i) { toggle(finger, 'howto-slow', false); place(chips[i]); },
            fingerOn: function (on) { toggle(finger, 'howto-on', on); },
            fingerDown: function (on) { toggle(finger, 'howto-down', on); },
            mark: function (list, cls) { list.forEach(function (p) { cells[p[0]][p[1]].classList.add(cls); }); },
            unmark: function (list, cls) { list.forEach(function (p) { cells[p[0]][p[1]].classList.remove(cls); }); },
            clearSel: function () { eachCell(function (n) { n.classList.remove('howto-sel', 'howto-anchor'); }); },
            setFound: function (i) {
                const color = COLORS[i];
                cellsOf(i).forEach(function (p, k) {
                    const n = cells[p[0]][p[1]];
                    n.classList.remove('howto-sel', 'howto-anchor', 'howto-hint');
                    n.classList.add('howto-found');
                    n.style.backgroundColor = color;
                    n.style.color = color === LIGHT ? '#1e293b' : '';
                    n.style.animationDelay = k * 40 + 'ms';
                });
                chips[i].classList.add('howto-is-found');
                chips[i].style.backgroundColor = color;
                chips[i].style.color = color === LIGHT ? '#1e293b' : '';
                found += 1;
                q('.howto-count').textContent = String(found);
            },
            pulseChips: function (on) { chips.forEach(function (n) { toggle(n, 'howto-pulse', on); }); },
            tapChip: function (i, on) { toggle(chips[i], 'howto-tap', on); },
            hintChip: function (i) { chips[i].classList.add('howto-hinted'); },
            finishGlow: function (on) { toggle(q('.howto-finish'), 'howto-glow', on); },
            finishTap: function (on) { toggle(q('.howto-finish'), 'howto-tap', on); },
            intro: function (on) { toggle(stage, 'howto-intro-on', on); },
            sent: function (on) { toggle(q('.howto-sent'), 'howto-on', on); },
            caption: function (html) { q('.howto-caption').innerHTML = html; },
            step: function (n) {
                steps.forEach(function (li, i) { toggle(li, 'howto-active', i === n); toggle(li, 'howto-done', i < n); });
            }
        };
        api.reset = function () {
            found = 0;
            q('.howto-count').textContent = '0';
            eachCell(function (n) { n.className = 'howto-cell'; n.style.backgroundColor = ''; n.style.color = ''; n.style.animationDelay = ''; });
            chips.forEach(function (n) { n.className = 'howto-word'; n.style.backgroundColor = ''; n.style.color = ''; });
            q('.howto-finish').className = 'howto-finish';
            api.sent(false);
            api.intro(true);
            finger.className = 'howto-finger';
            api.step(-1);
        };
        return api;
    }

    root.XiroHowToUi = root.XiroHowToUi || {};
    root.XiroHowToUi.wordSearch = { createStage: createStage };
})(typeof window !== 'undefined' ? window : this);
