/**
 * @fileoverview Piezas de la intro de partida: dígitos con el estilo del logo,
 * confeti, destellos y efectos de sonido sintetizados (WebAudio, sin ficheros).
 *
 * Lo usa game-intro-overlay.js. ES5 a propósito: también se carga en tv.html,
 * que debe funcionar en navegadores de TV antiguos (webOS 3.5).
 *
 * Expone window.XiroGameIntroFx.
 */

(function (global) {
    'use strict';

    let NS = 'http://www.w3.org/2000/svg';
    let COLORS = { green: 'rgb(138,184,23)', yellow: 'rgb(249,181,24)', red: 'rgb(230,84,83)' };

    // Trazo central de cada dígito (caja 200x300) y su brillo blanco
    let DIGITS = {
        3: { color: COLORS.green,
            d: 'M 44 74 C 60 48 84 40 104 40 C 140 40 160 62 160 92 C 160 124 132 144 84 146 C 140 146 166 170 166 204 C 166 240 138 262 100 262 C 74 262 50 252 38 228',
            hl: 'M 60 62 C 72 52 86 48 100 48' },
        2: { color: COLORS.yellow,
            d: 'M 42 96 C 46 54 78 40 104 40 C 140 40 162 62 162 96 C 162 136 126 164 42 258 L 166 258',
            hl: 'M 52 88 C 56 68 70 56 88 52' },
        1: { color: COLORS.red,
            d: 'M 58 90 L 114 44 L 114 258',
            hl: 'M 104 78 L 104 140' },
        0: { color: COLORS.yellow,
            d: 'M 100 40 C 152 40 166 100 166 150 C 166 200 152 260 100 260 C 48 260 34 200 34 150 C 34 100 48 40 100 40 Z',
            hl: 'M 46 126 C 48 94 60 66 80 54' }
    };

    function svgEl(tag, attrs) {
        let el = document.createElementNS(NS, tag);
        for (let k in attrs) {
            if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
        }
        return el;
    }

    /** Dígito en capas: borde blanco, sombra y contorno negros, color y brillo. */
    function digitSvg(n) {
        let g = DIGITS[n];
        let svg = svgEl('svg', { viewBox: '0 0 200 300' });
        let layers = [
            { stroke: '#fefefe', w: 96 },
            { stroke: '#000', w: 58, t: 'translate(-5 7)' },
            { stroke: '#000', w: 58 },
            { stroke: g.color, w: 44 }
        ];
        for (let i = 0; i < layers.length; i++) {
            let p = svgEl('path', { d: g.d, fill: 'none', stroke: layers[i].stroke, 'stroke-width': layers[i].w,
                'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
            if (layers[i].t) p.setAttribute('transform', layers[i].t);
            svg.appendChild(p);
        }
        svg.appendChild(svgEl('path', { d: g.hl, fill: 'none', stroke: '#fefefe', 'stroke-width': 9, 'stroke-linecap': 'round' }));
        return svg;
    }

    function buildRays(svg) {
        for (let i = 0; i < 18; i++) {
            let a = (i / 18) * Math.PI * 2, b = a + Math.PI / 36;
            svg.appendChild(svgEl('polygon', {
                points: '0,0 ' + (Math.cos(a) * 100) + ',' + (Math.sin(a) * 100) + ' ' + (Math.cos(b) * 100) + ',' + (Math.sin(b) * 100),
                fill: i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(249,181,24,0.07)'
            }));
        }
    }

    /** Destello de cuatro puntas sobre el logo (posición en % del contenedor). */
    function glint(host, xPct, yPct) {
        let el = document.createElement('div');
        el.className = 'gi-glint';
        el.style.left = xPct + '%';
        el.style.top = yPct + '%';
        el.innerHTML = '<svg viewBox="-50 -50 100 100" width="100%" height="100%"><path d="M0 -50 C 6 -8 8 -6 50 0 C 8 6 6 8 0 50 C -6 8 -8 6 -50 0 C -8 -6 -6 -8 0 -50 Z" fill="#fff"/></svg>';
        host.appendChild(el);
        setTimeout(function () { el.className += ' is-in'; }, 20);
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
    }

    /** Confeti con contorno negro que sale disparado desde el 0. */
    function confetti(host) {
        let bits = [], palette = [COLORS.green, COLORS.yellow, COLORS.red, '#fefefe'];
        let unit = Math.min(global.innerWidth, global.innerHeight) / 100;
        for (let i = 0; i < 34; i++) {
            let el = document.createElement('div'), round = i % 3 === 0;
            el.className = 'gi-bit';
            el.style.width = (round ? 3.2 : 2) * unit + 'px';
            el.style.height = (round ? 3.2 : 5.2) * unit + 'px';
            el.style.borderRadius = round ? '50%' : unit + 'px';
            el.style.background = palette[i % 4];
            host.appendChild(el);
            let ang = Math.random() * Math.PI * 2, sp = (0.9 + Math.random() * 1.4) * unit * 2.2;
            bits.push({ el: el, x: 0, y: 0, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - unit, r: 0, vr: (Math.random() - 0.5) * 30 });
        }
        let t0 = null;
        function step(ts) {
            if (!t0) t0 = ts;
            let k = (ts - t0) / 900;
            for (let j = 0; j < bits.length; j++) {
                let b = bits[j];
                b.vy += unit * 0.09; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.r += b.vr;
                b.el.style.transform = 'translate(' + b.x + 'px,' + b.y + 'px) rotate(' + b.r + 'deg)';
                b.el.style.opacity = String(Math.max(0, 1 - k * k));
            }
            if (k < 1) { global.requestAnimationFrame(step); return; }
            for (let m = 0; m < bits.length; m++) { if (bits[m].el.parentNode) host.removeChild(bits[m].el); }
        }
        global.requestAnimationFrame(step);
    }

    /* ---------- Sonido (solo presentador) ---------- */
    let audio = null;

    function audioCtx() {
        let C = global.AudioContext || global.webkitAudioContext;
        if (!audio && C) audio = new C();
        if (audio && audio.state !== 'running') audio.resume(); // Safari: 'suspended' o 'interrupted'
        return audio;
    }

    /**
     * Desbloquea el audio. Debe llamarse dentro de un clic del usuario (botón
     * "Empezar"): Safari y Chrome solo dejan sonar un AudioContext activado así.
     */
    function unlockAudio() {
        let a = audioCtx();
        if (!a) return;
        let src = a.createBufferSource();
        src.buffer = a.createBuffer(1, 1, 22050);
        src.connect(a.destination);
        src.start(0);
    }

    /** Tono con barrido de frecuencia. o = { f, to, dur, type, vol, delay } */
    function tone(o) {
        let a = audio; if (!a) return;
        let t = a.currentTime + (o.delay || 0), osc = a.createOscillator(), g = a.createGain();
        osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(o.f, t);
        if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
        g.gain.setValueAtTime(o.vol || 0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + o.dur);
        osc.connect(g); g.connect(a.destination); osc.start(t); osc.stop(t + o.dur + 0.02);
    }

    function noise(dur, from, to, vol) {
        let a = audio; if (!a) return;
        let len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        let src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
        src.buffer = buf; f.type = 'bandpass'; f.Q.value = 1.2;
        f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(f); f.connect(g); g.connect(a.destination); src.start(t);
    }

    // 3, 2 y 1 con el mismo "bip"; el 0, una octava más agudo y más largo
    let SFX = {
        whoosh: function () { noise(0.7, 300, 3200, 0.5); },
        pop: function (i) { tone({ f: 320 + i * 90, to: 900 + i * 120, dur: 0.12, type: 'triangle', vol: 0.22 }); },
        sparkle: function () { tone({ f: 1800, to: 2600, dur: 0.15, type: 'sine', vol: 0.08 }); tone({ f: 2400, to: 3400, dur: 0.18, type: 'sine', vol: 0.06, delay: 0.06 }); },
        hit: function () { tone({ f: 160, to: 45, dur: 0.35, type: 'sine', vol: 0.7 }); tone({ f: 880, dur: 0.14, type: 'square', vol: 0.07 }); noise(0.18, 2000, 400, 0.25); },
        go: function () { tone({ f: 160, to: 45, dur: 0.35, type: 'sine', vol: 0.7 }); tone({ f: 1760, dur: 0.6, type: 'square', vol: 0.07 }); noise(0.18, 2000, 400, 0.25); },
        boom: function () { tone({ f: 120, to: 30, dur: 0.8, type: 'sine', vol: 0.9 }); noise(0.9, 1800, 120, 0.7); tone({ f: 660, to: 1320, dur: 0.25, type: 'triangle', vol: 0.15, delay: 0.05 }); },
        swell: function () { noise(0.5, 200, 2400, 0.45); tone({ f: 220, to: 880, dur: 0.45, type: 'triangle', vol: 0.12 }); }
    };

    /** Reproduce un efecto si el audio está activo; nunca rompe la animación. */
    function play(name, arg) {
        if (!audio || !SFX[name]) return;
        try { audioCtx(); SFX[name](arg); } catch (e) { /* sin sonido */ }
    }

    global.XiroGameIntroFx = {
        COLORS: COLORS,
        DIGITS: DIGITS,
        digitSvg: digitSvg,
        buildRays: buildRays,
        glint: glint,
        confetti: confetti,
        unlockAudio: unlockAudio,
        // Sin clic previo (partida arrancada desde el mando remoto) solo suena si
        // el navegador ya considera activada la página.
        ensureAudio: audioCtx,
        play: play
    };
})(window);
