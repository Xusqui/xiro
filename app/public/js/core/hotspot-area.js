/**
 * @fileoverview Núcleo compartido de «Toca la imagen» (hotspot): reglas del área correcta y
 * geometría del toque.
 *
 * El área es un polígono sobre la imagen principal de la pregunta, en coordenadas relativas 0-1
 * (así no depende del tamaño con que cada pantalla pinte la imagen) más `aspect` = ancho / alto,
 * que hace falta para medir distancias reales: la tolerancia se expresa en % del ancho.
 *   { points: [{ x: 0.21, y: 0.33 }, …], aspect: 1.5 }
 *
 * Lo comparten el servidor (validación, puntuación) y el editor (dibujo del polígono).
 * ES5 a propósito (webOS 3.5): nada de =>, plantillas, ?., ?? ni spread.
 * Expone window.XiroHotspot y module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    let LIMITS = {
        MIN_POINTS: 3,
        MAX_POINTS: 30,
        MAX_ASPECT: 10,
        DEFAULT_MAX_POINTS: 100,
        INSIDE_BONUS: 20,
        DEFAULT_TOLERANCE: 5,
        MIN_TOLERANCE: 1,
        MAX_TOLERANCE: 100
    };

    // Distancias por debajo de esto son el propio borde (errores de coma flotante)
    let EDGE_EPSILON = 1e-9;

    function round4(value) {
        return Math.round(value * 10000) / 10000;
    }

    function isUnit(value) {
        return typeof value === 'number' && isFinite(value) && value >= 0 && value <= 1;
    }

    /**
     * Toque o vértice válido, redondeado a 4 decimales.
     * @param {*} raw - Se espera { x, y } con números entre 0 y 1
     * @returns {{x: number, y: number}|null} null si no es válido
     */
    function normalizeTap(raw) {
        if (!raw || !isUnit(raw.x) || !isUnit(raw.y)) return null;
        return { x: round4(raw.x), y: round4(raw.y) };
    }

    function isValidAspect(aspect) {
        return typeof aspect === 'number' && isFinite(aspect) && aspect > 0 && aspect <= LIMITS.MAX_ASPECT;
    }

    /**
     * Por qué no vale un área, para los mensajes del editor y del servidor.
     * @param {*} raw - Área tal como llega
     * @returns {string|null} 'missing' | 'too_few_points' | 'too_many_points' | 'bad_point' | 'bad_aspect',
     *   o null si es válida
     */
    function areaError(raw) {
        if (!raw || !Array.isArray(raw.points)) return 'missing';
        if (raw.points.length < LIMITS.MIN_POINTS) return 'too_few_points';
        if (raw.points.length > LIMITS.MAX_POINTS) return 'too_many_points';
        for (let i = 0; i < raw.points.length; i++) {
            if (!normalizeTap(raw.points[i])) return 'bad_point';
        }
        return isValidAspect(raw.aspect) ? null : 'bad_aspect';
    }

    /**
     * Copia válida del área, con coordenadas y proporción redondeadas a 4 decimales.
     * @param {*} raw - Área tal como llega
     * @returns {{points: Array<{x: number, y: number}>, aspect: number}|null} null si no es válida
     */
    function normalizeArea(raw) {
        if (areaError(raw)) return null;
        let points = [];
        for (let i = 0; i < raw.points.length; i++) points.push(normalizeTap(raw.points[i]));
        return { points: points, aspect: round4(raw.aspect) };
    }

    /**
     * Área guardada, como objeto (JSONB de pg) o como texto JSON (importaciones, tests).
     * @param {*} raw
     * @returns {{points: Array<{x: number, y: number}>, aspect: number}|null} null si no es válida
     */
    function parseArea(raw) {
        if (typeof raw !== 'string') return normalizeArea(raw);
        try {
            return normalizeArea(JSON.parse(raw));
        } catch (e) {
            return null;
        }
    }

    // Pasa un punto a «anchos de imagen» en los dos ejes: y se escala por alto / ancho
    function toWidthUnits(point, aspect) {
        return { x: point.x, y: point.y / aspect };
    }

    function distanceToSegment(p, a, b) {
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let lengthSq = dx * dx + dy * dy;
        let t = lengthSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));
        let cx = a.x + t * dx - p.x;
        let cy = a.y + t * dy - p.y;
        return Math.sqrt(cx * cx + cy * cy);
    }

    function distanceToEdges(tap, area) {
        let p = toWidthUnits(tap, area.aspect);
        let points = area.points;
        let best = Infinity;
        for (let i = 0; i < points.length; i++) {
            let a = toWidthUnits(points[i], area.aspect);
            let b = toWidthUnits(points[(i + 1) % points.length], area.aspect);
            best = Math.min(best, distanceToSegment(p, a, b));
        }
        return best;
    }

    // Ray casting: cuántas aristas cruza una semirrecta horizontal desde el toque
    function crossesOddTimes(tap, points) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            let a = points[i];
            let b = points[j];
            let straddles = a.y > tap.y !== b.y > tap.y;
            if (straddles && tap.x < ((b.x - a.x) * (tap.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    }

    /**
     * ¿Cae el toque dentro del área? El borde cuenta como dentro.
     * @param {{x: number, y: number}} tap - Toque normalizado
     * @param {{points: Array, aspect: number}} area - Área normalizada
     * @returns {boolean}
     */
    function isInside(tap, area) {
        if (distanceToEdges(tap, area) <= EDGE_EPSILON) return true;
        return crossesOddTimes(tap, area.points);
    }

    /**
     * Distancia del toque al área, en anchos de imagen (0,1 = un 10 % del ancho); 0 si cae dentro.
     * @param {{x: number, y: number}} tap - Toque normalizado
     * @param {{points: Array, aspect: number}} area - Área normalizada
     * @returns {number}
     */
    function distanceToArea(tap, area) {
        if (isInside(tap, area)) return 0;
        return distanceToEdges(tap, area);
    }

    /**
     * Tolerancia en % del ancho: a esa distancia del área el toque ya da 0 puntos.
     * @param {*} raw - Valor guardado (número o texto numérico)
     * @returns {number} Entre MIN_TOLERANCE y MAX_TOLERANCE; DEFAULT_TOLERANCE si falta o no es positivo
     */
    function normalizeTolerance(raw) {
        let value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
        if (typeof value !== 'number' || !isFinite(value) || value <= 0) return LIMITS.DEFAULT_TOLERANCE;
        return Math.min(LIMITS.MAX_TOLERANCE, Math.max(LIMITS.MIN_TOLERANCE, value));
    }

    let api = {
        LIMITS: LIMITS,
        areaError: areaError,
        normalizeArea: normalizeArea,
        parseArea: parseArea,
        normalizeTap: normalizeTap,
        isInside: isInside,
        distanceToArea: distanceToArea,
        normalizeTolerance: normalizeTolerance
    };

    root.XiroHotspot = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
