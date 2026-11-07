// Portada: XiRo (abajo a la derecha) parpadea cada 3-5 s y cada 15-20 s caza con la
// lengua una mosca que entra por abajo. Sustituye a la <img class="player-chameleon">;
// si falla la carga del SVG o el usuario prefiere menos movimiento, la imagen se queda.
// Coordenadas en unidades del SVG del camaleón (caja de 1024), que no se transforma.
(function () {
    'use strict';
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const SRC = '/images/chamaleon/chamaleon.svg';
    const MOUTH = { x: 205, y: 350 }; // base de la lengua, oculta tras la cabeza
    const FEET = { x: 512, y: 880 }; // pivote al inclinarse y masticar
    const ZONE = { x0: -1000, x1: 60, y0: -250, y1: 760 };
    const FLY_EVERY = [15, 20];
    const BLINK_EVERY = [3, 5];

    const SCENE = `
      <g class="xh-tongue" style="display:none">
        <path class="xh-t-out" fill="none" stroke="#0e1311" stroke-width="42" stroke-linecap="round"/>
        <path class="xh-t-in" fill="none" stroke="#ef5b86" stroke-width="25" stroke-linecap="round"/>
        <circle class="xh-tip" r="34" fill="#0e1311"/><circle class="xh-tip" r="24" fill="#ef5b86"/>
        <circle class="xh-shine" r="8" fill="#ff9ab6"/>
      </g>
      <g class="xh-body"></g>
      <g class="xh-fly" style="display:none"><g class="xh-fly-body">
        <g class="xh-wings" opacity=".85">
          <ellipse cx="-6" cy="-20" rx="15" ry="26" fill="#d9f0ff" stroke="#0e1311" stroke-width="4" transform="rotate(-25 -6 -20)"/>
          <ellipse cx="10" cy="-20" rx="15" ry="26" fill="#eaf7ff" stroke="#0e1311" stroke-width="4" transform="rotate(20 10 -20)"/>
        </g>
        <ellipse cx="6" cy="0" rx="24" ry="15" fill="#3a3f55" stroke="#0e1311" stroke-width="5"/>
        <path d="M2 -12 v24 M14 -11 v22" stroke="#f9b518" stroke-width="5"/>
        <circle cx="-20" cy="-2" r="13" fill="#3a3f55" stroke="#0e1311" stroke-width="5"/>
        <circle cx="-25" cy="-6" r="5" fill="#ff4d4d"/>
        <path d="M-14 12 l-6 12 M0 14 l-2 13 M14 13 l4 12" stroke="#0e1311" stroke-width="4" stroke-linecap="round"/>
      </g></g>`;
    const LIDS = [
        { cx: 352, cy: 268, r: 54 },
        { cx: 650, cy: 286, r: 62 }
    ];

    const rand = (a, b) => a + Math.random() * (b - a);
    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    function buildScene(sourceSvg) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '-1100 -350 2124 1374');
        svg.setAttribute('class', 'xiro-hunt');
        svg.setAttribute('aria-hidden', 'true');
        // XML y no innerHTML: en la portada innerHTML no respeta los <path/> autocerrados
        // y anida las figuras (lengua sin relleno rosa, mosca con un solo ala)
        const parsed = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}">${SCENE}</svg>`, 'image/svg+xml');
        [...parsed.documentElement.children].forEach(n => svg.appendChild(document.importNode(n, true)));
        const body = svg.querySelector('.xh-body');
        const pupils = {};
        sourceSvg.querySelectorAll('path').forEach(p => {
            const node = document.importNode(p, true);
            const style = p.getAttribute('style') || '';
            const eye = style.includes('#111212') ? 'R' : style.includes('#12100e') ? 'L' : null;
            if (!eye) return body.appendChild(node);
            pupils[eye] = document.createElementNS(SVG_NS, 'g');
            pupils[eye].appendChild(node);
            body.appendChild(pupils[eye]);
        });
        const lids = LIDS.map(l => {
            const e = document.createElementNS(SVG_NS, 'ellipse');
            for (const [k, v] of Object.entries({
                cx: l.cx,
                cy: l.cy,
                rx: l.r,
                ry: l.r,
                fill: '#8ab817',
                stroke: '#0e1311',
                'stroke-width': 14
            }))
                e.setAttribute(k, v);
            e.style.display = 'none';
            body.appendChild(e);
            return { el: e, cx: l.cx, cy: l.cy };
        });
        const q = s => svg.querySelector(s);
        return {
            svg,
            body,
            lids,
            eyes: [
                { el: pupils.L, c: { x: 350, y: 270 }, max: 13, ox: 0, oy: 0 },
                { el: pupils.R, c: { x: 651, y: 287 }, max: 17, ox: 0, oy: 0 }
            ],
            tongue: q('.xh-tongue'),
            tLines: svg.querySelectorAll('.xh-t-out, .xh-t-in'),
            tips: svg.querySelectorAll('.xh-tip'),
            shine: q('.xh-shine'),
            fly: q('.xh-fly'),
            flyBody: q('.xh-fly-body'),
            wings: q('.xh-wings')
        };
    }

    function animate(v) {
        const fly = { x: 0, y: 0, vx: 0, vy: 0, visible: false, flap: true, wp: null };
        let phase = 'rest',
            t0 = 0,
            now = 0,
            wanderUntil = 0,
            restFor = rand(...FLY_EVERY);
        let hover = null,
            target = null,
            tip = { ...MOUTH },
            lean = 0,
            squash = 0;
        let nextBlink = rand(...BLINK_EVERY),
            blinkStart = -1;
        const setPhase = p => {
            phase = p;
            t0 = now;
        };
        const randPoint = () => ({ x: rand(ZONE.x0, ZONE.x1), y: rand(ZONE.y0, ZONE.y1) });
        const huntPoint = () => {
            for (;;) {
                const p = { x: rand(-900, 0), y: rand(-200, 650) };
                if (Math.hypot(p.x - MOUTH.x, p.y - MOUTH.y) > 400) return p;
            }
        };

        function spawnFly() {
            Object.assign(fly, {
                x: rand(-900, -100),
                y: 1000,
                vx: rand(-110, 110),
                vy: -350,
                visible: true,
                flap: true
            });
            fly.wp = randPoint();
            wanderUntil = now + rand(2.8, 4.8);
            setPhase('wander');
        }

        function steer(dt, goal, maxSpeed, arrive) {
            const dx = goal.x - fly.x,
                dy = goal.y - fly.y,
                d = Math.hypot(dx, dy) || 1;
            const speed = arrive ? Math.min(maxSpeed, d * 2.2) : maxSpeed;
            const k = Math.min(1, dt * 3.2),
                jitter = 1125 * (arrive ? Math.min(1, d / 100) : 1) * dt;
            fly.vx += ((dx / d) * speed - fly.vx) * k + rand(-1, 1) * jitter;
            fly.vy += ((dy / d) * speed - fly.vy) * k + rand(-1, 1) * jitter;
            fly.x += fly.vx * dt;
            fly.y += fly.vy * dt;
            return d;
        }

        function update(dt) {
            const el = now - t0;
            let leanGoal = 0;
            if (phase === 'rest') {
                if (el > restFor) spawnFly();
            } else if (phase === 'wander') {
                if (steer(dt, fly.wp, 375, false) < 60) fly.wp = randPoint();
                if (now > wanderUntil) {
                    hover = huntPoint();
                    setPhase('approach');
                }
            } else if (phase === 'approach') {
                if (steer(dt, hover, 400, true) < 18 && Math.hypot(fly.vx, fly.vy) < 100) setPhase('hover');
            } else if (phase === 'hover') {
                fly.x = lerp(fly.x, hover.x + Math.sin(now * 7) * 10, Math.min(1, dt * 8));
                fly.y = lerp(fly.y, hover.y + Math.cos(now * 9) * 8, Math.min(1, dt * 8));
                fly.vx *= 0.9;
                fly.vy *= 0.9;
                leanGoal = 3.5; // coge impulso
                if (el > 0.75) {
                    target = { x: fly.x, y: fly.y };
                    setPhase('strike');
                }
            } else if (phase === 'strike') {
                const e = 1 - Math.pow(1 - clamp(el / 0.14, 0, 1), 3);
                tip = { x: lerp(MOUTH.x, target.x, e), y: lerp(MOUTH.y, target.y, e) };
                leanGoal = -4;
                if (el >= 0.14) {
                    fly.flap = false;
                    setPhase('stick');
                }
            } else if (phase === 'stick') {
                tip = { ...target };
                Object.assign(fly, tip);
                leanGoal = -4;
                if (el > 0.1) setPhase('retract');
            } else if (phase === 'retract') {
                const e = Math.pow(clamp(el / 0.34, 0, 1), 3);
                tip = { x: lerp(target.x, MOUTH.x, e), y: lerp(target.y, MOUTH.y, e) };
                Object.assign(fly, tip);
                leanGoal = -2;
                if (el >= 0.34) {
                    fly.visible = false;
                    setPhase('gulp');
                }
            } else if (phase === 'gulp') {
                squash = Math.sin(el * 22) * Math.exp(-el * 3.5) * 0.06; // mastica
                if (el > 1.1) {
                    squash = 0;
                    restFor = rand(...FLY_EVERY);
                    setPhase('rest');
                }
            }
            lean = lerp(lean, leanGoal, Math.min(1, dt * (phase === 'strike' ? 30 : 8)));
        }

        function renderEyes() {
            for (const eye of v.eyes) {
                let gx = Math.sin(now * 0.7 + eye.max) * 4,
                    gy = Math.cos(now * 0.5) * 3;
                if (fly.visible) {
                    const dx = fly.x - eye.c.x,
                        dy = fly.y - eye.c.y,
                        d = Math.hypot(dx, dy) || 1;
                    const m = eye.max * Math.min(1, d / 150);
                    gx = (dx / d) * m;
                    gy = (dy / d) * m;
                }
                eye.ox = lerp(eye.ox, gx, 0.25);
                eye.oy = lerp(eye.oy, gy, 0.25);
                eye.el.setAttribute('transform', `translate(${eye.ox.toFixed(2)} ${eye.oy.toFixed(2)})`);
            }
            const busy = ['hover', 'strike', 'stick', 'retract'].includes(phase);
            if (blinkStart < 0 && now > nextBlink && !busy) blinkStart = now;
            let k = 0;
            if (blinkStart >= 0) {
                const p = (now - blinkStart) / 0.18;
                k = p < 1 ? Math.sin(p * Math.PI) : 0;
                if (p >= 1) {
                    blinkStart = -1;
                    nextBlink = now + rand(...BLINK_EVERY);
                }
            }
            for (const l of v.lids) {
                l.el.style.display = k > 0.02 ? '' : 'none';
                l.el.setAttribute(
                    'transform',
                    `translate(${l.cx} ${l.cy}) scale(1 ${k.toFixed(3)}) translate(${-l.cx} ${-l.cy})`
                );
            }
        }

        function renderTongue() {
            const out = ['strike', 'stick', 'retract'].includes(phase);
            v.tongue.style.display = out ? '' : 'none';
            if (!out) return;
            const dx = tip.x - MOUTH.x,
                dy = tip.y - MOUTH.y,
                len = Math.hypot(dx, dy) || 1;
            const full = Math.hypot(target.x - MOUTH.x, target.y - MOUTH.y) || 1;
            const sag = Math.sin(Math.PI * clamp(len / full, 0, 1)) * (phase === 'retract' ? 32 : 18);
            const mx = (MOUTH.x + tip.x) / 2 - (dy / len) * sag,
                my = (MOUTH.y + tip.y) / 2 + (dx / len) * sag;
            const d = `M${MOUTH.x} ${MOUTH.y} Q${mx.toFixed(1)} ${my.toFixed(1)} ${tip.x.toFixed(1)} ${tip.y.toFixed(1)}`;
            v.tLines.forEach(l => l.setAttribute('d', d));
            v.tips.forEach(c => {
                c.setAttribute('cx', tip.x);
                c.setAttribute('cy', tip.y);
            });
            v.shine.setAttribute('cx', tip.x - 9);
            v.shine.setAttribute('cy', tip.y - 9);
        }

        function renderFly() {
            v.fly.style.display = fly.visible ? '' : 'none';
            if (!fly.visible) return;
            const caught = phase === 'stick' || phase === 'retract';
            const flip = fly.vx > 25 && !caught && phase !== 'hover' ? -2 : 2;
            const rot = caught ? 25 : clamp(fly.vy * 0.04, -20, 20) * Math.sign(flip);
            v.fly.setAttribute(
                'transform',
                `translate(${fly.x.toFixed(1)} ${fly.y.toFixed(1)}) scale(${flip} 2) rotate(${rot.toFixed(1)})`
            );
            const w = fly.flap ? 0.25 + 0.75 * Math.abs(Math.sin(now * 55)) : 0.9;
            v.wings.setAttribute('transform', `translate(0 -8) scale(1 ${w.toFixed(2)}) translate(0 8)`);
            v.flyBody.setAttribute('transform', caught ? `rotate(${(Math.sin(now * 40) * 8).toFixed(1)})` : '');
        }

        let last = performance.now();
        function frame(ts) {
            const dt = Math.min(0.05, (ts - last) / 1000); // pestaña oculta: no da saltos
            last = ts;
            now += dt;
            update(dt);
            v.body.setAttribute(
                'transform',
                `translate(${FEET.x} ${FEET.y}) rotate(${lean.toFixed(2)}) scale(${(1 + squash).toFixed(3)} ${(1 - squash).toFixed(3)}) translate(${-FEET.x} ${-FEET.y})`
            );
            renderEyes();
            renderTongue();
            renderFly();
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    function start() {
        const img = document.querySelector('img.player-chameleon');
        if (!img || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        fetch(SRC)
            .then(res => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
            .then(text => {
                const source = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
                const view = buildScene(source);
                if (!view.eyes[0].el || !view.eyes[1].el) return;
                img.replaceWith(view.svg);
                animate(view);
            })
            .catch(() => {
                /* se queda la imagen estática */
            });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
