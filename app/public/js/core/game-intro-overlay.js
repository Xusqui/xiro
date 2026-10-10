/**
 * @fileoverview Intro de partida: logo de Xiro! animado + cuenta atrás 3-2-1-0.
 *
 * Overlay a pantalla completa que se muestra en presentador, TV y móviles al
 * recibir `game-intro`. El servidor gatea la espera (GameIntroManager). El iris
 * final se queda cerrado hasta que llega el arranque de la partida (release()),
 * para no dejar ver el lobby entre la intro y la primera pregunta.
 *
 * ES5 a propósito (tv.html). En navegadores sin @keyframes sin prefijo ni
 * transform-box se usa .gi-legacy: sin efectos, logo fijo y números a golpe.
 *
 * Expone window.XiroGameIntro = { show, hide, release, unlockAudio }.
 */

(function (global) {
    'use strict';

    let TOTAL_MS = 6400;
    let RELEASE_TIMEOUT_MS = 3000; // si el arranque no llega (partida cancelada), abrir igual
    let T = { bg: 460, logo: 800, up: 2150, count: 2400, step: 750, boom: 5030, iris: 5130, reveal: 5710 };
    // Margen del viewBox: el rebote del borde blanco y la caída de la i y el !
    // no deben recortarse aunque el navegador ignore overflow:visible.
    let PAD = { x: 160, top: 480 };
    let LETTERS = ['x', 'i', 'r', 'o', 'excl'];

    let root = null, timers = [], soundOn = false, released = false, holding = false;

    function fx() { return global.XiroGameIntroFx; }
    function $(cls) { return root.querySelector('.' + cls); }
    function later(ms, fn) { timers.push(setTimeout(fn, Math.max(0, ms))); }
    function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
    function sfx(name, arg) { if (soundOn) fx().play(name, arg); }

    function isLegacy() {
        let css = global.CSS;
        return !('animation' in document.body.style)
            || !(css && css.supports && css.supports('transform-box', 'fill-box'));
    }

    function build() {
        root = document.createElement('div');
        root.className = 'gi' + (isLegacy() ? ' gi-legacy' : '');
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML =
            '<div class="gi-bg"></div>' +
            '<div class="gi-stage">' +
                '<div class="gi-rays"><svg viewBox="-100 -100 200 200"></svg></div>' +
                '<div class="gi-logo"></div>' +
                '<div class="gi-count">' +
                    '<svg class="gi-ring" viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="46"/>' +
                    '<circle class="prog" cx="50" cy="50" r="46" transform="rotate(-90 50 50)"/></svg>' +
                    '<div class="gi-wave"></div><div class="gi-digit"></div>' +
                '</div>' +
            '</div>' +
            '<div class="gi-flash"></div>' +
            '<div class="gi-wipes"><div class="gi-wipe w1"></div><div class="gi-wipe w2"></div>' +
            '<div class="gi-wipe w3"></div><div class="gi-wipe w4"></div><div class="gi-wipe w5"></div></div>' +
            '<div class="gi-iris i1"></div><div class="gi-iris i2"></div><div class="gi-iris i3"></div>';
        document.body.appendChild(root);
        fx().buildRays(root.querySelector('.gi-rays svg'));
        loadLogo();
    }

    function loadLogo() {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', '/images/logo.svg');
        xhr.onload = function () {
            if (xhr.status !== 200) return;
            $('gi-logo').innerHTML = xhr.responseText.replace(/<\?xml[^>]*\?>/, '');
            prepareLogo($('gi-logo').querySelector('svg'));
        };
        xhr.send();
    }

    /** Agrupa el borde blanco y marca cada letra para animarla por separado. */
    function prepareLogo(svg) {
        if (!svg) return;
        let NS = 'http://www.w3.org/2000/svg';
        let vb = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
        let shift = document.createElementNS(NS, 'g');
        shift.setAttribute('transform', 'translate(' + (PAD.x - vb[0]) + ' ' + (PAD.top - vb[1]) + ')');
        while (svg.firstChild) shift.appendChild(svg.firstChild);
        svg.appendChild(shift);
        svg.setAttribute('viewBox', '0 0 ' + (vb[2] + PAD.x * 2) + ' ' + (vb[3] + PAD.top + PAD.x));
        svg.removeAttribute('width');
        svg.removeAttribute('height');

        let sticker = document.createElementNS(NS, 'g'), node = shift.firstElementChild;
        sticker.setAttribute('class', 'gi-sticker');
        shift.insertBefore(sticker, node);
        while (node && node.id !== 'x') { let next = node.nextElementSibling; sticker.appendChild(node); node = next; }

        for (let i = 0; i < LETTERS.length; i++) {
            let g = svg.querySelector('#' + LETTERS[i]);
            if (!g) continue;
            let drop = LETTERS[i] === 'i' || LETTERS[i] === 'excl';
            g.setAttribute('class', drop ? 'gi-l drop' : 'gi-l');
            g.removeAttribute('id'); // no ensuciar los ids de la página
        }
    }

    function reset() {
        for (let i = 0; i < timers.length; i++) clearTimeout(timers[i]);
        timers = [];
        if (!root) return;
        root.className = 'gi' + (isLegacy() ? ' gi-legacy' : '');
        let parts = root.querySelectorAll('.gi-l,.gi-sticker');
        for (let j = 0; j < parts.length; j++) parts[j].classList.remove('is-in');
        $('gi-digit').className = 'gi-digit';
        $('gi-digit').innerHTML = '';
    }

    function showDigit(n) {
        let d = $('gi-digit'), color = fx().DIGITS[n].color, prog = root.querySelector('.gi-ring .prog');
        d.className = 'gi-digit';
        d.innerHTML = '';
        d.appendChild(fx().digitSvg(n));
        restart(d, 'is-in');
        $('gi-wave').style.borderColor = color;
        restart($('gi-wave'), 'is-in');
        prog.style.stroke = color;
        prog.style.transition = 'none';
        prog.style.strokeDashoffset = '0';
        void prog.getBoundingClientRect();
        prog.style.transition = 'stroke-dashoffset ' + (T.step - 80) + 'ms linear';
        prog.style.strokeDashoffset = '289';
        restart($('gi-rays'), 'gi-rays-pulse');
        restart(root, 's-shake');
        root.classList.add('is-on', 's-bg', 's-logo-up', 's-count');
        sfx(n > 0 ? 'hit' : 'go');
        if (n > 0) later(T.step - 220, function () { d.classList.remove('is-in'); d.classList.add('is-out'); });
    }

    function explode() {
        let d = $('gi-digit');
        d.classList.remove('is-in');
        d.classList.add('is-boom');
        restart($('gi-flash'), 'is-in');
        $('gi-wave').style.borderColor = '#fff';
        restart($('gi-wave'), 'is-in');
        fx().confetti($('gi-count'));
        sfx('boom');
    }

    /**
     * Ejecuta la coreografía desde `offset` ms (0 normalmente; más si quien la ve
     * se reincorpora a mitad de intro). Lo ya pasado se aplica sin animar.
     */
    function run(offset) {
        function at(t, fn) { if (t >= offset) later(t - offset, fn); }
        let letters = root.querySelectorAll('.gi-l'), sticker = $('gi-sticker');

        root.classList.add('is-on');
        if (offset === 0) { void root.offsetWidth; root.classList.add('s-wipe'); sfx('whoosh'); }
        if (offset >= T.bg) root.classList.add('s-bg');
        if (offset >= T.logo + 620) {
            for (let i = 0; i < letters.length; i++) letters[i].classList.add('is-in');
            if (sticker) sticker.classList.add('is-in');
        }
        if (offset >= T.up) root.classList.add('s-logo-up');

        at(T.bg, function () { root.classList.add('s-bg'); });
        for (let k = 0; k < letters.length; k++) {
            (function (el, idx) {
                at(T.logo + idx * 110, function () { el.classList.add('is-in'); sfx('pop', idx); });
            })(letters[k], k);
        }
        at(T.logo + 620, function () { if (sticker) sticker.classList.add('is-in'); });
        at(T.logo + 950, function () { fx().glint($('gi-logo'), 81.8, 41.8); sfx('sparkle'); });
        at(T.logo + 1150, function () { fx().glint($('gi-logo'), 54.2, 51.3); });
        at(T.up, function () { root.classList.add('s-logo-up'); });
        [3, 2, 1, 0].forEach(function (n, idx) {
            at(T.count + idx * T.step, function () { showDigit(n); });
        });
        at(T.boom, explode);
        at(T.iris, function () { root.classList.add('s-iris'); sfx('swell'); });
        at(T.reveal, function () {
            if (released) { reveal(); return; }
            holding = true;
            later(RELEASE_TIMEOUT_MS, reveal);
        });
    }

    /** Abre el iris y deja ver lo que haya debajo (la primera pregunta o el tablero). */
    function reveal() {
        if (!root || !root.classList.contains('is-on') || root.classList.contains('s-iris-out')) return;
        holding = false;
        root.classList.add('s-covered', 's-iris-out');
        later(TOTAL_MS - T.reveal, reset);
    }

    /** La partida ya arrancó: si el iris está esperando cerrado, se abre ya. */
    function release() {
        released = true;
        if (holding) reveal();
    }

    /**
     * @param {Object} payload - { durationMs, startedAt, remainingMs? }
     * @param {Object} [opts]
     * @param {boolean} [opts.sound=false] - Solo el presentador lleva sonido
     */
    function show(payload, opts) {
        if (!fx() || !document.body) return;
        if (!root) build();
        reset();
        released = false;
        holding = false;
        soundOn = !!(opts && opts.sound);
        if (soundOn) fx().ensureAudio();
        // Reconexión a mitad de intro: empezar por lo que ya ha transcurrido
        let remaining = payload && payload.remainingMs;
        let offset = remaining ? Math.max(0, (payload.durationMs || T.reveal) - remaining) : 0;
        if (offset >= T.reveal) return;
        run(offset);
    }

    function hide() { reset(); }

    function unlockAudio() { if (fx()) fx().unlockAudio(); }

    // Precarga: overlay y logo listos antes de que llegue el evento
    function preload() { if (!root && fx()) build(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', preload);
    else preload();

    global.XiroGameIntro = { show: show, hide: hide, release: release, unlockAudio: unlockAudio };
})(window);
