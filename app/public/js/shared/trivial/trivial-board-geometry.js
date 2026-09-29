/**
 * trivial-board-geometry.js
 * Geometría pura del tablero Trivial: constantes SVG y funciones de coordenadas.
 * Sin sintaxis de módulos (import/export). Compatible Chrome 40+.
 * Namespace: window.TrivialShared
 */
window.TrivialShared = window.TrivialShared || {};

(function (ns) {
    'use strict';

    const CX = 200, CY = 200, OUTER_R = 183, INNER_R = 30, CASILLA_R = 13;

    ns.CX = CX;
    ns.CY = CY;
    ns.OUTER_R = OUTER_R;
    ns.INNER_R = INNER_R;
    ns.CASILLA_R = CASILLA_R;

    ns.posToXY = function (pos, N, M) {
        if (pos === 'center') return { x: CX, y: CY };
        const parts = pos.split(':');
        if (parts[0] === 'outer') {
            const i = parseInt(parts[1], 10);
            const angle = (i / M) * 2 * Math.PI - Math.PI / 2;
            return { x: CX + OUTER_R * Math.cos(angle), y: CY + OUTER_R * Math.sin(angle) };
        }
        if (parts[0] === 'spoke') {
            const k = parseInt(parts[1], 10), s = parseInt(parts[2], 10);
            const a = (k / N) * 2 * Math.PI - Math.PI / 2;
            const r = (INNER_R + 1 + CASILLA_R) + (s - 1) * 27.5;
            return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
        }
        return { x: CX, y: CY };
    };

    ns.isHQ = function (i, N, M) {
        for (let k = 0; k < N; k++) {
            if (Math.floor(k * M / N) === i) return k;
        }
        return -1;
    };

    ns.labelXY = function (pos, N, M) {
        const parts = pos.split(':');
        if (parts[0] === 'outer') {
            const angO = (parseInt(parts[1], 10) / M) * 2 * Math.PI - Math.PI / 2;
            const rO = OUTER_R + CASILLA_R + 13;
            return { x: CX + rO * Math.cos(angO), y: CY + rO * Math.sin(angO) };
        }
        if (parts[0] === 'spoke') {
            const k = parseInt(parts[1], 10), s = parseInt(parts[2], 10);
            const angS = (k / N) * 2 * Math.PI - Math.PI / 2;
            const baseR = (INNER_R + 1 + CASILLA_R) + (s - 1) * 27.5;
            const offset = CASILLA_R + 11;
            return {
                x: CX + baseR * Math.cos(angS) - offset * Math.sin(angS),
                y: CY + baseR * Math.sin(angS) + offset * Math.cos(angS)
            };
        }
        return ns.posToXY(pos, N, M);
    };

    ns.playerColor = function (nickname) {
        let hue = 0;
        for (let i = 0; i < nickname.length; i++) hue += nickname.charCodeAt(i);
        hue = hue % 360;
        return 'hsl(' + hue + ', 75%, 60%)';
    };

})(window.TrivialShared);
