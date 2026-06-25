/**
 * trivial-board-builder.js
 * Construye el SVG estático del tablero Trivial e inyecta el scaffold.
 * Requiere: trivial-board-geometry.js cargado antes.
 * Sin sintaxis de módulos. Compatible Chrome 40+.
 * Namespace: window.TrivialShared
 */
window.TrivialShared = window.TrivialShared || {};

(function (ns) {
    'use strict';

    var CX = 200, CY = 200, OUTER_R = 183, INNER_R = 30, CASILLA_R = 13;

    ns.renderBoardBackground = function (container, state) {
        var categories = state.categories || [];
        var M = state.outerCasillas || 24;
        var N = categories.length;
        var colors = [];
        for (var c = 0; c < N; c++) colors.push(categories[c].color || '#888');

        var bg = '';

        for (var i = 0; i < M; i++) {
            var xy = ns.posToXY('outer:' + i, N, M);
            var hqK = ns.isHQ(i, N, M);
            var catIdx = i % N;
            var fill = (hqK >= 0 ? colors[hqK] : colors[catIdx]) || '#888';
            var stroke = hqK >= 0 ? 'none' : '#fff';
            var sw = hqK >= 0 ? 0 : 1.5;
            var xf = xy.x.toFixed(1), yf = xy.y.toFixed(1);

            bg += '<circle data-pos="outer:' + i + '" cx="' + xf + '" cy="' + yf + '" r="' + CASILLA_R + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            bg += '<circle cx="' + xf + '" cy="' + yf + '" r="' + CASILLA_R + '" fill="url(#circleShine)" pointer-events="none"/>';
            if (hqK >= 0) {
                bg += '<circle cx="' + xf + '" cy="' + yf + '" r="' + CASILLA_R + '" fill="none" stroke="#FFD700" stroke-width="3" pointer-events="none" style="will-change:opacity,r">';
                bg += '<animate attributeName="stroke-opacity" values="1;0.2;1" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>';
                bg += '<animate attributeName="r" values="' + CASILLA_R + ';' + (CASILLA_R + 2) + ';' + CASILLA_R + '" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>';
                bg += '</circle>';
                bg += '<text x="' + xf + '" y="' + (xy.y + 4).toFixed(1) + '" text-anchor="middle" font-size="10" fill="#fff" font-weight="bold">\u2736</text>';
            }
        }

        for (var k = 0; k < N; k++) {
            var p0 = ns.posToXY('center', N, M);
            var p5 = ns.posToXY('spoke:' + k + ':5', N, M);
            bg += '<line x1="' + p0.x + '" y1="' + p0.y + '" x2="' + p5.x + '" y2="' + p5.y + '" stroke="' + (colors[k] || '#888') + '" stroke-width="2" opacity="0.3"/>';
            var masterColorIdx = Math.floor(k * M / N) % N;
            for (var s = 1; s <= 5; s++) {
                var ps = ns.posToXY('spoke:' + k + ':' + s, N, M);
                var altIdx = (masterColorIdx + (6 - s)) % N;
                bg += '<circle data-pos="spoke:' + k + ':' + s + '" cx="' + ps.x.toFixed(1) + '" cy="' + ps.y.toFixed(1) + '" r="' + CASILLA_R + '" fill="' + (colors[altIdx] || '#888') + '" stroke="#fff" stroke-width="1.5"/>';
                bg += '<circle cx="' + ps.x.toFixed(1) + '" cy="' + ps.y.toFixed(1) + '" r="' + CASILLA_R + '" fill="url(#circleShine)" pointer-events="none"/>';
            }
        }

        bg += '<clipPath id="centerClip"><circle cx="' + CX + '" cy="' + CY + '" r="' + (INNER_R - 2) + '"/></clipPath>';
        bg += '<circle data-pos="center" cx="' + CX + '" cy="' + CY + '" r="' + INNER_R + '" fill="#1e293b" stroke="#fff" stroke-width="2"/>';
        bg += '<image href="/images/minilogo.svg" x="' + (CX - INNER_R + 2) + '" y="' + (CY - INNER_R + 2) + '" width="' + ((INNER_R - 2) * 2) + '" height="' + ((INNER_R - 2) * 2) + '" clip-path="url(#centerClip)" pointer-events="none"/>';

        var svgH = '<svg id="trivial-svg" viewBox="-22 -22 444 444" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;border-radius:50%;will-change:transform">';
        svgH += '<defs><style>';
        svgH += '.trivial-token{transition:transform 0.55s cubic-bezier(.4,0,.2,1);transform-box:view-box;}';
        svgH += '.trivial-token-circle{fill:white;stroke:#111;stroke-width:2;filter:url(#tokenGlow);}';
        svgH += '.trivial-inner{transform-box:fill-box;transform-origin:center;}';
        svgH += '@keyframes tokenBounce{0%{transform:scale(1)}30%{transform:scale(1.45)}65%{transform:scale(0.85)}85%{transform:scale(1.12)}100%{transform:scale(1)}}';
        svgH += '.trivial-bounce{animation:tokenBounce 0.42s ease-out forwards;}';
        svgH += '@keyframes availPulse{0%,100%{opacity:1;r:' + (CASILLA_R + 5) + '}50%{opacity:0.4;r:' + (CASILLA_R + 8) + '}}';
        svgH += '</style>';
        svgH += '<radialGradient id="boardBg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#1e3a5f" stop-opacity="1"/><stop offset="88%" stop-color="#0f1f3d" stop-opacity="0.97"/><stop offset="96%" stop-color="#0f1f3d" stop-opacity="0.6"/><stop offset="100%" stop-color="#0f1f3d" stop-opacity="0"/></radialGradient>';
        svgH += '<pattern id="dotgrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1.1" fill="rgba(255,255,255,0.11)"/></pattern>';
        svgH += '<radialGradient id="dotFade" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="white" stop-opacity="1"/><stop offset="88%" stop-color="white" stop-opacity="0.9"/><stop offset="100%" stop-color="white" stop-opacity="0"/></radialGradient>';
        svgH += '<mask id="dotMask"><circle cx="' + CX + '" cy="' + CY + '" r="199" fill="url(#dotFade)"/></mask>';
        svgH += '<radialGradient id="circleShine" cx="38%" cy="32%" r="65%"><stop offset="0%" stop-color="rgba(255,255,255,0.40)"/><stop offset="55%" stop-color="rgba(255,255,255,0.05)"/><stop offset="100%" stop-color="rgba(0,0,0,0.20)"/></radialGradient>';
        svgH += '<filter id="tokenGlow" x="-80%" y="-80%" width="260%" height="260%" color-interpolation-filters="sRGB">';
        svgH += '<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>';
        svgH += '<feColorMatrix in="blur" type="matrix" values="1 1 1 0 0.9 1 1 1 0 0.9 1 1 1 0 0.9 0 0 0 1 -0.15" result="halo"/>';
        svgH += '<feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge>';
        svgH += '</filter></defs>';
        svgH += '<circle cx="' + CX + '" cy="' + CY + '" r="199" fill="url(#boardBg)"/>';
        svgH += '<circle cx="' + CX + '" cy="' + CY + '" r="199" fill="url(#dotgrid)" mask="url(#dotMask)"/>';
        svgH += '<g id="board-bg" style="will-change:transform">' + bg + '</g>';
        svgH += '<g id="board-hilight"></g><g id="board-tokens"></g></svg>';

        container.innerHTML = svgH;
        container._boardN = N;
        container._boardM = M;

        container.addEventListener('click', function (e) {
            var pos = e.target && e.target.dataset && e.target.dataset.availPos;
            if (pos && typeof window._trivialOnSelectPos === 'function') {
                window._trivialOnSelectPos(pos);
            }
        });
    };

})(window.TrivialShared);
