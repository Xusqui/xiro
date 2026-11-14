/**
 * @fileoverview Trazados SVG de la forma libre (shape 'path') de la diapositiva libre.
 *
 * Un trazado es texto que acaba dentro de un atributo d="…" en las seis pantallas y en el
 * PDF, así que no se valida con una expresión regular sola: se tokeniza y se reescribe en
 * forma canónica (comando, números con 3 decimales, espacios). Solo pasan los comandos
 * M L H V C S Q T A Z (mayúsculas y minúsculas) con su número de argumentos exacto y números
 * finitos; cualquier otro carácter invalida el trazado entero, así que no puede colarse marcado.
 *
 * scalePath lleva el trazado del viewBox de la forma a la caja del elemento. Se escala en el
 * propio trazado, no con viewBox/transform, para que el grosor del borde sea el mismo en todas
 * las pantallas (vector-effect no se comporta igual con el transform: scale() del escenario).
 * ES5 a propósito (webOS 3.5). Expone window.XiroSlideCanvasPath y module.exports.
 */
(function (root) {
    'use strict';

    const MAX_CHARS = 8000;
    const MAX_COMMANDS = 1000;
    const MAX_ABS = 1000000;
    const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
    const NUMBER_RE = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
    const SEPARATOR_RE = /[\s,]/;

    function skipSeparators(state) {
        while (state.pos < state.src.length && SEPARATOR_RE.test(state.src.charAt(state.pos))) state.pos++;
    }

    /** Número en la posición actual, o null. Las banderas de los arcos son un solo dígito 0/1. */
    function readArg(state, isFlag) {
        skipSeparators(state);
        if (isFlag) {
            let ch = state.src.charAt(state.pos);
            if (ch !== '0' && ch !== '1') return null;
            state.pos++;
            return Number(ch);
        }
        NUMBER_RE.lastIndex = state.pos;
        let match = NUMBER_RE.exec(state.src);
        if (!match || match.index !== state.pos) return null;
        let value = Number(match[0]);
        if (!isFinite(value) || Math.abs(value) > MAX_ABS) return null;
        state.pos += match[0].length;
        return value;
    }

    /** Un grupo de argumentos del comando; null si no empieza otro grupo, false si está mal. */
    function readGroup(state, upper) {
        let args = [];
        for (let k = 0; k < ARGS[upper]; k++) {
            let start = state.pos;
            let value = readArg(state, upper === 'A' && (k === 3 || k === 4));
            if (value === null) {
                state.pos = start;
                return k === 0 ? null : false;
            }
            args.push(value);
        }
        return args;
    }

    /** Argumentos del comando (uno o más grupos), o null si el número no cuadra. */
    function readArgs(state, upper) {
        let args = [];
        let group = readGroup(state, upper);
        while (group) {
            args = args.concat(group);
            state.groups++;
            group = readGroup(state, upper);
        }
        return group === false || !args.length ? null : args;
    }

    /**
     * Trocea un trazado en comandos.
     * @param {string} d - Atributo d de SVG.
     * @returns {Array<{cmd:string,args:Array<number>}>|null} null si no es un trazado válido.
     */
    function parsePath(d) {
        if (typeof d !== 'string' || !d || d.length > MAX_CHARS) return null;
        let state = { src: d, pos: 0, groups: 0 };
        let list = [];
        skipSeparators(state);
        while (state.pos < d.length) {
            let cmd = d.charAt(state.pos);
            let upper = cmd.toUpperCase();
            if (!Object.prototype.hasOwnProperty.call(ARGS, upper) || (!list.length && upper !== 'M')) return null;
            state.pos++;
            let args = upper === 'Z' ? [] : readArgs(state, upper);
            if (!args) return null;
            if (upper === 'Z') state.groups++;
            list.push({ cmd: cmd, args: args });
            if (state.groups > MAX_COMMANDS) return null;
            skipSeparators(state);
        }
        return list.length ? list : null;
    }

    function formatNumber(n) {
        let rounded = Math.round(n * 1000) / 1000;
        return String(rounded === 0 ? 0 : rounded);
    }

    function stringify(list) {
        let parts = [];
        for (let i = 0; i < list.length; i++) {
            parts.push(list[i].cmd + (list[i].args.length ? ' ' + list[i].args.map(formatNumber).join(' ') : ''));
        }
        return parts.join(' ');
    }

    /**
     * Forma canónica del trazado (lo que se guarda y se pinta).
     * @param {string} d - Trazado de entrada.
     * @returns {string|null} Trazado reescrito, o null si no es válido.
     */
    function normalizePath(d) {
        let list = parsePath(d);
        return list ? stringify(list) : null;
    }

    /** Factor de cada argumento según el comando: x, y o sin escalar (giro y banderas del arco). */
    function argScale(upper, k, sx, sy) {
        if (upper === 'H') return sx;
        if (upper === 'V') return sy;
        if (upper === 'A') {
            let arc = k % 7;
            if (arc === 2 || arc === 3 || arc === 4) return 1;
            return arc === 0 || arc === 5 ? sx : sy;
        }
        return k % 2 === 0 ? sx : sy;
    }

    /**
     * Trazado llevado de su viewBox a una caja de w x h.
     * @param {string} d - Trazado (se valida de nuevo).
     * @param {Array<number>} viewBox - [ancho, alto] del sistema de coordenadas del trazado.
     * @param {number} w - Ancho de la caja.
     * @param {number} h - Alto de la caja.
     * @returns {string} Trazado escalado, o '' si no es válido.
     */
    function scalePath(d, viewBox, w, h) {
        let list = parsePath(d);
        if (!list) return '';
        let sx = w / viewBox[0];
        let sy = h / viewBox[1];
        for (let i = 0; i < list.length; i++) {
            let upper = list[i].cmd.toUpperCase();
            for (let k = 0; k < list[i].args.length; k++) list[i].args[k] *= argScale(upper, k, sx, sy);
        }
        return stringify(list);
    }

    /** [ancho, alto] positivos y finitos, o null. */
    function normalizeViewBox(v) {
        if (!v || typeof v.length !== 'number' || v.length !== 2) return null;
        let w = Number(v[0]);
        let h = Number(v[1]);
        if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0 || w > MAX_ABS || h > MAX_ABS) return null;
        return [Math.round(w * 1000) / 1000, Math.round(h * 1000) / 1000];
    }

    const api = {
        MAX_CHARS: MAX_CHARS,
        MAX_COMMANDS: MAX_COMMANDS,
        parsePath: parsePath,
        normalizePath: normalizePath,
        normalizeViewBox: normalizeViewBox,
        scalePath: scalePath
    };

    root.XiroSlideCanvasPath = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
