/**
 * trivial-highlights-renderer.js
 * Renderiza los anillos de casillas disponibles y el overlay de orden de turno.
 * Requiere: trivial-board-geometry.js cargado antes.
 * Sin sintaxis de módulos. Compatible Chrome 40+.
 * Namespace: window.TrivialShared
 */
window.TrivialShared = window.TrivialShared || {};

(function (ns) {
    'use strict';

    const CASILLA_R = 13;

    /**
     * Actualiza los highlights de casillas disponibles.
     * Firma unificada:
     *   - Presenter: updateBoardHighlights(positions, onSelectFn, labelsArray)
     *   - TV:        updateBoardHighlights(positions, labelsArray)
     *   - Limpiar:   updateBoardHighlights([], null)
     */
    ns.updateBoardHighlights = function (positions, onSelectOrLabels, labelsArr) {
        let onSelect = null;
        let labels = [];
        if (typeof onSelectOrLabels === 'function') {
            onSelect = onSelectOrLabels;
            labels = labelsArr || [];
        } else {
            labels = onSelectOrLabels || [];
        }

        const container = document.getElementById('trivial-board-svg');
        if (!container) return;

        // Leer N y M del contenedor o del SVG interno
        let N = container._boardN;
        let M = container._boardM;
        if (!N || !M) {
            const svg = container.querySelector('svg');
            if (svg) {
                N = svg._boardN;
                M = svg._boardM;
            }
        }
        if (!N || !M) return;

        const layer = document.getElementById('board-hilight');
        if (!layer) return;

        layer.innerHTML = '';
        window._trivialOnSelectPos = onSelect;
        if (!positions || positions.length === 0) return;

        let html = '';
        for (let j = 0; j < positions.length; j++) {
            const pos = positions[j];
            const pC = ns.posToXY(pos, N, M);
            const label = labels[j] || '';
            const pL = ns.labelXY(pos, N, M);
            const cx = pC.x.toFixed(1);
            const cy = pC.y.toFixed(1);

            // Halo exterior pulsante
            html += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (CASILLA_R + 9) + '"' +
                    ' fill="rgba(251,191,36,0.30)" stroke="none" pointer-events="none">' +
                    '<animate attributeName="r" values="' + (CASILLA_R+7) + ';' + (CASILLA_R+14) + ';' + (CASILLA_R+7) + '" dur="0.9s" repeatCount="indefinite"/>' +
                    '<animate attributeName="fill-opacity" values="0.30;0.06;0.30" dur="0.9s" repeatCount="indefinite"/>' +
                    '</circle>';

            // Anillo dorado clicable
            html += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (CASILLA_R + 4) + '"' +
                    ' fill="rgba(251,191,36,0.45)" stroke="#fbbf24" stroke-width="3"' +
                    ' cursor="pointer" data-avail-pos="' + pos + '">' +
                    '<animate attributeName="stroke-opacity" values="1;0.2;1" dur="0.9s" repeatCount="indefinite"/>' +
                    '</circle>';

            if (label !== '') {
                html += '<text x="' + pL.x.toFixed(1) + '" y="' + (pL.y + 4).toFixed(1) + '"' +
                        ' text-anchor="middle" font-size="11" font-weight="bold" fill="#fbbf24"' +
                        ' pointer-events="none">' + label + '</text>';
            }
        }

        layer.innerHTML = html;
    };

    ns.showTurnOrderOverlay = function (boardContainer, turnOrder) {
        if (!boardContainer || !turnOrder || turnOrder.length === 0) return;
        const existing = document.getElementById('trv-turn-order-overlay');
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

        const el = document.createElement('div');
        el.id = 'trv-turn-order-overlay';
        el.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;z-index:20;cursor:pointer;';

        let rows = '';
        for (let i = 0; i < turnOrder.length; i++) {
            rows += '<div style="display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.07)">' +
                '<span style="width:26px;height:26px;border-radius:50%;background:#fbbf24;color:#1e293b;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (i + 1) + '</span>' +
                '<span style="color:#fff;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">' + turnOrder[i] + '</span></div>';
        }

        el.innerHTML = '<div style="background:rgba(15,23,42,0.94);border:2px solid rgba(251,191,36,0.4);border-radius:16px;padding:22px 28px;min-width:180px;max-width:260px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.7);">' +
            '<div style="color:#fbbf24;font-size:1.1rem;font-weight:900;letter-spacing:.8px;margin-bottom:14px">🎲 Orden de tiradas</div>' +
            '<div style="display:flex;flex-direction:column;gap:6px">' + rows + '</div>' +
            '<div style="color:#64748b;font-size:11px;margin-top:14px">Toca para continuar</div>' +
            '</div>';

        let dismissed = false;
        const dismiss = function () {
            if (dismissed) return;
            dismissed = true;
            el.style.transition = 'opacity 0.4s';
            el.style.opacity = '0';
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
        };
        el.addEventListener('click', dismiss);
        setTimeout(dismiss, 5500);
        boardContainer.appendChild(el);
    };

})(window.TrivialShared);
