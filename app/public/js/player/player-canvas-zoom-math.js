/**
 * @fileoverview Matemática del visor a pantalla completa de la diapositiva libre en el móvil
 * del jugador: zoom por pellizco, desplazamiento con un dedo y doble toque.
 *
 * Una vista es { scale, x, y }: el contenido (del tamaño de la pantalla, size = { w, h }) se pinta
 * con transform-origin 0 0 y translate(x, y) scale(scale). Funciones puras, sin DOM.
 */

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const DOUBLE_TAP_ZOOM = 2.5;

// + 0 convierte -0 en 0 (translate(-0px) es igual, pero así las vistas se comparan sin sorpresas)
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value)) + 0;
}

function distance(points) {
    return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
}

function midpoint(points) {
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
}

/** Vista a escala scale con el punto from del contenido llevado al punto to de la pantalla. */
function scaleAround(view, scale, from, to, size) {
    const k = scale / view.scale;
    return clampView({ scale, x: to.x - (from.x - view.x) * k, y: to.y - (from.y - view.y) * k }, size);
}

/**
 * Zoom entre MIN_ZOOM y MAX_ZOOM y desplazamiento sin dejar ver nada fuera del contenido.
 * @param {{scale: number, x: number, y: number}} view - Vista propuesta.
 * @param {{w: number, h: number}} size - Tamaño del visor en px.
 * @returns {{scale: number, x: number, y: number}} Vista válida.
 */
export function clampView(view, size) {
    const scale = clamp(view.scale, MIN_ZOOM, MAX_ZOOM);
    return {
        scale,
        x: clamp(view.x, size.w - size.w * scale, 0),
        y: clamp(view.y, size.h - size.h * scale, 0)
    };
}

/**
 * Pellizco: la escala sigue a la distancia entre los dos dedos y el punto medio entre ellos
 * se queda bajo los dedos (así también se desplaza mientras se pellizca).
 * @param {Object} start - Vista al apoyar el segundo dedo.
 * @param {Array<{x: number, y: number}>} from - Los dos dedos al empezar.
 * @param {Array<{x: number, y: number}>} to - Los dos dedos ahora.
 * @param {{w: number, h: number}} size - Tamaño del visor.
 * @returns {Object} Vista nueva.
 */
export function pinchView(start, from, to, size) {
    const startDistance = distance(from);
    if (!startDistance) return clampView(start, size);
    const scale = clamp((start.scale * distance(to)) / startDistance, MIN_ZOOM, MAX_ZOOM);
    return scaleAround(start, scale, midpoint(from), midpoint(to), size);
}

/** Un dedo mueve la vista ampliada; sin zoom no hay nada que mover. */
export function panView(start, from, to, size) {
    if (start.scale <= MIN_ZOOM) return clampView(start, size);
    return clampView({ scale: start.scale, x: start.x + to.x - from.x, y: start.y + to.y - from.y }, size);
}

/** Doble toque: amplía en el punto tocado o, si ya estaba ampliada, vuelve al tamaño normal. */
export function toggleZoomAt(view, point, size) {
    if (view.scale > MIN_ZOOM) return { scale: MIN_ZOOM, x: 0, y: 0 };
    return scaleAround(view, DOUBLE_TAP_ZOOM, point, point, size);
}

/**
 * Punto de la pantalla en coordenadas del contenido. Girado, el contenido va rotado 90° a la
 * derecha (se lee con el móvil girado a la izquierda): su x es la y de la pantalla.
 * @param {{x: number, y: number}} point - Punto relativo al visor.
 * @param {{w: number, h: number}} screen - Tamaño del visor (pantalla).
 * @param {boolean} rotated - Si el contenido va girado.
 * @returns {{x: number, y: number}}
 */
export function toContentPoint(point, screen, rotated) {
    return rotated ? { x: point.y, y: screen.w - point.x } : { x: point.x, y: point.y };
}

/** @returns {{w: number, h: number}} Tamaño del contenido: girado, ancho y alto intercambiados. */
export function contentSize(screen, rotated) {
    return rotated ? { w: screen.h, h: screen.w } : { w: screen.w, h: screen.h };
}

/** @returns {string} Valor de CSS transform para la vista. */
export function viewTransform(view) {
    return 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.scale + ')';
}
