/**
 * @fileoverview Visor a pantalla completa de la diapositiva libre en el móvil del jugador (fase D):
 * tocar la diapositiva la abre; dos dedos amplían (pellizco), uno mueve la vista ampliada y el
 * doble toque alterna el zoom. Con el móvil en vertical la diapositiva se ve girada (apaisada).
 * Sigue abierto al pasar a otra diapositiva libre y se cierra solo cuando el jugador pasa a otra
 * pantalla (pregunta, podio…). La matemática está en player-canvas-zoom-math.js.
 */

import {
    clampView,
    pinchView,
    panView,
    toggleZoomAt,
    viewTransform,
    toContentPoint,
    contentSize
} from './player-canvas-zoom-math.js?v=20261114100000';

const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 10;
const IDENTITY = { scale: 1, x: 0, y: 0 };

let openViewer = null;
// Diapositiva libre que se está mostrando; si desaparece de la pantalla, el visor se cierra
let activeHost = null;

function esc(text) {
    return window.XiroSlideCanvasRender.escapeText(text || '');
}

function overlayHtml(labels) {
    return (
        '<div class="xsc-zoom" role="dialog" aria-modal="true" aria-label="' + esc(labels.hint) + '">' +
        '<button type="button" class="xsc-zoom-close" data-zoom-close aria-label="' + esc(labels.close) + '">' +
        '<i class="fas fa-xmark" aria-hidden="true"></i></button>' +
        '<div class="xsc-zoom-rotor"><div class="xsc-zoom-pan"><div class="xsc-zoom-host"></div></div></div></div>'
    );
}

function sizeOf(el) {
    return { w: el.clientWidth, h: el.clientHeight };
}

function isPortrait() {
    return !!(window.matchMedia && window.matchMedia('(orientation: portrait)').matches);
}

/** Gira el contenido si el móvil está en vertical y le da el tamaño apaisado; devuelve si gira. */
function layout(overlay, rotor) {
    const rotated = isPortrait();
    const size = contentSize(sizeOf(overlay), rotated);
    overlay.classList.toggle('xsc-zoom--rotated', rotated);
    rotor.style.width = rotated ? size.w + 'px' : '';
    rotor.style.height = rotated ? size.h + 'px' : '';
    return rotated;
}

/**
 * Gestos sobre el contenido. Cada vez que se apoya o levanta un dedo empieza un gesto nuevo
 * desde la vista actual; un gesto con dos dedos o que se ha movido no cuenta como toque.
 * @param {HTMLElement} pan - Capa que se amplía y desplaza.
 * @param {Function} frame - () => { overlay, screen, rotated }: el visor y si el contenido va girado.
 */
function attachGestures(pan, frame) {
    const pointers = new Map();
    let view = IDENTITY;
    let start = { view, points: [], moved: false };
    let lastTap = 0;

    const apply = next => {
        view = next;
        pan.style.transform = viewTransform(view);
    };
    const restart = moved => {
        start = { view, points: Array.from(pointers.values()), moved };
    };
    const size = () => contentSize(frame().screen, frame().rotated);

    function track(event) {
        const f = frame();
        const rect = f.overlay.getBoundingClientRect();
        pointers.set(event.pointerId, toContentPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top }, f.screen, f.rotated));
    }

    function onMove(event) {
        if (!pointers.has(event.pointerId)) return;
        track(event);
        const now = Array.from(pointers.values());
        if (now.length >= 2 && start.points.length >= 2) apply(pinchView(start.view, start.points.slice(0, 2), now.slice(0, 2), size()));
        else if (now.length === 1 && start.points.length === 1) apply(panView(start.view, start.points[0], now[0], size()));
        const first = start.points[0];
        if (first && Math.hypot(now[0].x - first.x, now[0].y - first.y) > TAP_SLOP_PX) start.moved = true;
    }

    function onUp(event) {
        const point = pointers.get(event.pointerId);
        pointers.delete(event.pointerId);
        const tap = point && !pointers.size && !start.moved;
        restart(start.moved && pointers.size > 0);
        if (!tap) return;
        // Doble toque: dos toques seguidos en menos de DOUBLE_TAP_MS
        if (Date.now() - lastTap < DOUBLE_TAP_MS) {
            apply(toggleZoomAt(view, point, size()));
            lastTap = 0;
        } else lastTap = Date.now();
    }

    pan.addEventListener('pointerdown', event => {
        track(event);
        restart(pointers.size > 1 || start.moved);
    });
    pan.addEventListener('pointermove', onMove);
    pan.addEventListener('pointerup', onUp);
    pan.addEventListener('pointercancel', onUp);
    return { reset: () => apply(clampView(IDENTITY, size())) };
}

/**
 * Abre la diapositiva a pantalla completa (solo un visor a la vez). Va fuera de <body>: las
 * pantallas del jugador sustituyen body.innerHTML, y el visor se cierra solo cuando con ese
 * cambio desaparece la diapositiva libre (activeHost).
 * @param {Object} canvas - slide_canvas de la diapositiva.
 * @param {{close: string, hint: string, videoOnScreen: string}} labels - Textos ya traducidos.
 * @returns {{close: Function, show: Function}} Cierre idempotente y cambio de diapositiva.
 */
export function openCanvasZoom(canvas, labels) {
    closeCanvasZoom();
    const previousFocus = document.activeElement;
    const holder = document.createElement('div');
    holder.innerHTML = overlayHtml(labels);
    const overlay = holder.firstElementChild;
    document.documentElement.appendChild(overlay);
    const rotor = overlay.querySelector('.xsc-zoom-rotor');
    const host = overlay.querySelector('.xsc-zoom-host');
    let rotated = layout(overlay, rotor);
    let mounted = null;
    const gestures = attachGestures(overlay.querySelector('.xsc-zoom-pan'), () => ({ overlay, screen: sizeOf(overlay), rotated }));
    const observer = new MutationObserver(() => {
        if (!activeHost || !activeHost.isConnected) viewer.close();
    });
    function onKey(event) {
        if (event.key === 'Escape') viewer.close();
    }
    function refit() {
        rotated = layout(overlay, rotor);
        if (mounted) mounted.refit();
        gestures.reset();
    }
    const viewer = {
        show(next) {
            if (mounted) mounted.destroy();
            mounted = window.XiroSlideCanvasRender.mount(host, next, { mode: 'player', labels });
            refit();
        },
        close() {
            if (openViewer !== viewer) return;
            openViewer = null;
            observer.disconnect();
            mounted.destroy();
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', refit);
            overlay.remove();
            if (previousFocus && previousFocus.focus) previousFocus.focus();
        }
    };
    viewer.show(canvas);
    overlay.querySelector('[data-zoom-close]').addEventListener('click', viewer.close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', refit);
    observer.observe(document.body, { childList: true });
    openViewer = viewer;
    overlay.querySelector('[data-zoom-close]').focus();
    return viewer;
}

/** Cierra el visor si está abierto. */
export function closeCanvasZoom() {
    if (openViewer) openViewer.close();
}

/**
 * Tocar la diapositiva pintada en host la abre en el visor; si el visor ya está abierto (venía
 * de otra diapositiva libre), pasa a mostrar esta. Añade la pista «Toca para ampliar».
 * @param {HTMLElement} host - Contenedor de la diapositiva del jugador.
 * @param {Object} canvas - slide_canvas.
 * @param {Object} labels - Textos ya traducidos (close, hint, videoOnScreen).
 * @returns {{disable: Function}} Quita el gesto y la pista (el visor sigue abierto).
 */
export function enableCanvasZoom(host, canvas, labels) {
    host.insertAdjacentHTML('beforeend', '<p class="xsc-zoom-hint">' + esc(labels.hint) + '</p>');
    const hint = host.lastElementChild;
    const open = () => openCanvasZoom(canvas, labels);
    host.addEventListener('click', open);
    activeHost = host;
    if (openViewer) openViewer.show(canvas);
    return {
        disable() {
            host.removeEventListener('click', open);
            hint.remove();
            if (activeHost === host) activeHost = null;
        }
    };
}
