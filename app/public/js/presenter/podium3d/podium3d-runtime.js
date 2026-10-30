/**
 * @fileoverview Bucle del podio 3D: sube cada bloque cuando le llega su puesto, lanza el
 * confeti al aterrizar el 1º, mueve la cámara y coloca las etiquetas. Con «reducir
 * movimiento» los bloques aparecen ya montados, sin confeti, y solo se pinta si algo cambia.
 */

import { createPodiumScene } from './podium3d-scene.js?v=20261031120000';
import { createConfetti } from './podium3d-confetti.js?v=20261031120000';
import { createLabels } from './podium3d-labels.js?v=20261031120000';
import {
    BLOCK,
    CAMERA,
    cameraAzimuth,
    fitDistance,
    punchScale,
    springRise,
    squashWidth
} from './podium3d-plan.js?v=20261031120000';

const LABEL_AT = 0.32; // s desde que sale el bloque: casi en lo alto del rebote
const CONFETTI_AT = 0.3;
const RING_AT = 0.12;
const SETTLE_SECONDS = 1.7;
const LABEL_LIFT = 0.16; // separación entre el techo del bloque y la base de la etiqueta

/** Techos de los bloques ya montados, para que el confeti se pose encima. */
function obstaclesOf(blocks, revealAt) {
    const halfW = (BLOCK.width / 2) * 0.96;
    const halfD = (BLOCK.depth / 2) * 0.96;
    return blocks
        .filter(b => revealAt.has(b.spec.place))
        .map(b => ({ minX: b.spec.x - halfW, maxX: b.spec.x + halfW, minZ: -halfD, maxZ: halfD, top: b.top() }));
}

export function startPodiumRuntime({ stage, entries, avatarImages = [], onLost }) {
    const canvas = stage.querySelector('canvas');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const view = createPodiumScene(canvas, entries.length, avatarImages);
    const confetti = reduced ? null : createConfetti(view.scene);
    const labels = createLabels(stage.querySelector('.podium3d-labels'), entries);
    const byPlace = new Map(view.blocks.map(b => [b.spec.place, b]));
    const revealAt = new Map();
    const start = performance.now();
    let last = start;
    let size = { w: 0, h: 0 };
    let distance = fitDistance(16 / 9);
    let punchAt = null;
    let confettiFlying = false;
    let burstDone = false;
    let dirty = true;
    let frame = 0;

    function resize() {
        const rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        size = { w: rect.width, h: rect.height };
        view.setSize(size.w, size.h);
        distance = fitDistance(view.aspect());
        dirty = true;
    }
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();

    const onContextLost = event => {
        event.preventDefault();
        onLost(new Error('webglcontextlost'));
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    function anchor(place) {
        const block = byPlace.get(place);
        if (!block || !revealAt.has(place)) return null;
        return view.project(block.spec.x, block.top() + LABEL_LIFT, 0, size.w, size.h);
    }

    /** Anima los bloques ya revelados. Devuelve true si alguno sigue moviéndose. */
    function stepBlocks(t) {
        let moving = false;
        view.blocks.forEach(block => {
            const at = revealAt.get(block.spec.place);
            if (at === undefined) return;
            const local = t - at;
            const rise = reduced ? 1 : springRise(local);
            block.setRise(rise, reduced ? 1 : squashWidth(rise));
            block.setRing(reduced ? -1 : local - RING_AT);
            if (reduced || local >= LABEL_AT) labels.show(block.spec.place);
            if (!reduced && local < SETTLE_SECONDS) moving = true;
            if (block.spec.place === 1 && confetti && !burstDone && local >= CONFETTI_AT) {
                burstDone = true;
                confetti.burst({ x: block.spec.x, y: block.spec.height * 0.92, z: 0.55, spread: BLOCK.width * 0.62 });
                confettiFlying = true;
                punchAt = t;
            }
        });
        return moving;
    }

    function step(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = (now - start) / 1000;
        const moving = stepBlocks(t);
        if (confettiFlying) confettiFlying = confetti.update(dt, obstaclesOf(view.blocks, revealAt));

        if (reduced && !dirty) return;
        // Quieto del todo (solo queda el vaivén lento): basta con 30 fps
        const settled = !moving && !confettiFlying && t > CAMERA.approachSeconds;
        frame++;
        if (settled && !dirty && frame % 2) return;

        const punch = punchAt === null ? 1 : punchScale(t - punchAt);
        view.placeCamera(cameraAzimuth(t, reduced), distance * punch);
        view.render();
        labels.update(anchor);
        dirty = false;
    }
    view.renderer.setAnimationLoop(step);

    return {
        reveal(place) {
            if (!byPlace.has(place) || revealAt.has(place)) return;
            revealAt.set(place, (performance.now() - start) / 1000);
            dirty = true;
        },
        destroy() {
            view.renderer.setAnimationLoop(null);
            observer.disconnect();
            canvas.removeEventListener('webglcontextlost', onContextLost);
            confetti?.dispose();
            labels.dispose();
            view.dispose();
        }
    };
}
