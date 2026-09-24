/**
 * trivial-token-renderer.js
 * Renderiza y anima los tokens de jugadores/equipos sobre el SVG del tablero.
 * Requiere: trivial-board-geometry.js cargado antes.
 * Sin sintaxis de módulos. Compatible Chrome 40+.
 * Namespace: window.TrivialShared
 */
window.TrivialShared = window.TrivialShared || {};

(function (ns) {
    'use strict';

    // ViewBox is "-22 -22 444 444". Using transform-box:view-box + percentage
    // translate means the browser handles all scaling automatically:
    //   translate(x/444*100%, y/444*100%) shifts from the element's natural
    //   SVG origin (user 0,0 = CSS 22/444*W from top-left) by x/444*W,
    //   landing at (22+x)/444*W CSS pixels from SVG origin. No DOM query needed.
    function toVBPct(coord) {
        return (coord / 444 * 100).toFixed(3) + '%';
    }

    function animateBounce(inner) {
        if (!inner) return;
        const cls = inner.className.baseVal || '';
        inner.className.baseVal = cls.replace(' trivial-bounce', '');
        void inner.getBoundingClientRect();
        inner.className.baseVal += ' trivial-bounce';
    }

    function getTokenColorStyle(colorStr) {
        if (!colorStr) {
            return { bg: '#ffffff', stroke: '#1e293b', text: '#1e293b' };
        }
        const colorMap = {
            'red': '#ef4444',
            'blue': '#3b82f6',
            'green': '#22c55e',
            'yellow': '#eab308',
            'purple': '#a855f7',
            'pink': '#ec4899',
            'orange': '#f97316',
            'cyan': '#06b6d4',
            'lime': '#84cc16'
        };
        let hex = colorMap[colorStr.toLowerCase()] || colorStr;
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
        }
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
            return { bg: '#ffffff', stroke: '#1e293b', text: '#1e293b' };
        }
        
        // Blend 97% white and 3% base color to get a very pale tint background (almost white)
        const bgR = Math.round(255 * 0.97 + r * 0.03);
        const bgG = Math.round(255 * 0.97 + g * 0.03);
        const bgB = Math.round(255 * 0.97 + b * 0.03);
        
        const bgHex = '#' + 
            ('0' + bgR.toString(16)).slice(-2) + 
            ('0' + bgG.toString(16)).slice(-2) + 
            ('0' + bgB.toString(16)).slice(-2);
            
        // Use the base color for stroke and text, but darken it if it's too light/bright (like yellow or lime)
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        let strokeColor = '#' + hex;
        let textColor = '#' + hex;
        
        if (brightness > 165) {
            // Darken by 35% to make sure it is clearly visible on a pale background
            const darkR = Math.max(0, Math.round(r * 0.65));
            const darkG = Math.max(0, Math.round(g * 0.65));
            const darkB = Math.max(0, Math.round(b * 0.65));
            const darkHex = '#' + 
                ('0' + darkR.toString(16)).slice(-2) + 
                ('0' + darkG.toString(16)).slice(-2) + 
                ('0' + darkB.toString(16)).slice(-2);
            strokeColor = darkHex;
            textColor = darkHex;
        }
        
        return {
            bg: bgHex,
            stroke: strokeColor,
            text: textColor
        };
    }

    function createTokenEl(safeId, x, y, isActive, color, label, fontSize) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.id = safeId;
        g.style.setProperty('transform-box', 'view-box');
        g.style.transform = 'translate(' + toVBPct(x) + ', ' + toVBPct(y) + ')';
        
        const style = getTokenColorStyle(color);
        console.log('createTokenEl:', { safeId: safeId, color: color, label: label, fontSize: fontSize, style: style });

        // Build SVG elements programmatically rather than innerHTML to ensure full compatibility with older Smart TV browser engines
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('class', 'trivial-active-ring');
        ring.setAttribute('r', '15');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', '#FFD700');
        ring.setAttribute('stroke-width', '2.5');
        ring.setAttribute('visibility', isActive ? 'visible' : 'hidden');

        const anim1 = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        anim1.setAttribute('attributeName', 'r');
        anim1.setAttribute('values', '15;19;15');
        anim1.setAttribute('dur', '1.6s');
        anim1.setAttribute('repeatCount', 'indefinite');
        anim1.setAttribute('calcMode', 'spline');
        anim1.setAttribute('keySplines', '0.4 0 0.6 1;0.4 0 0.6 1');
        ring.appendChild(anim1);

        const anim2 = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        anim2.setAttribute('attributeName', 'stroke-opacity');
        anim2.setAttribute('values', '0.9;0.1;0.9');
        anim2.setAttribute('dur', '1.6s');
        anim2.setAttribute('repeatCount', 'indefinite');
        anim2.setAttribute('calcMode', 'spline');
        anim2.setAttribute('keySplines', '0.4 0 0.6 1;0.4 0 0.6 1');
        ring.appendChild(anim2);

        g.appendChild(ring);

        const inner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        inner.setAttribute('class', 'trivial-inner');

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'team-color-circle');
        circle.setAttribute('r', '11');
        circle.setAttribute('fill', style.bg);
        circle.setAttribute('stroke', style.stroke);
        circle.setAttribute('stroke-width', '2.5');
        inner.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '0');
        text.setAttribute('y', '3.5');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', fontSize);
        text.setAttribute('fill', style.text);
        text.setAttribute('font-weight', '900');
        text.setAttribute('font-family', 'sans-serif');
        text.textContent = label;
        inner.appendChild(text);

        g.appendChild(inner);
        return g;
    }

    function removeStale(layer, seen) {
        const tokens = layer.querySelectorAll('[id^="token-"]');
        for (let i = 0; i < tokens.length; i++) {
            if (!seen[tokens[i].id]) tokens[i].parentNode.removeChild(tokens[i]);
        }
    }

    // Paleta de colores para fichas individuales (por índice en turnOrder)
    const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];

    ns.updateBoardTokens = function (players, categories, M, currentTurnNick, turnOrder) {
        const container = document.getElementById('trivial-board-svg');
        if (!container || !container._boardN) return;
        const N = container._boardN;
        const layer = document.getElementById('board-tokens');
        if (!layer) return;

        const seen = {};
        turnOrder = turnOrder || [];
        const nickList = Object.keys(players);

        for (const nick in players) {
            const p = players[nick];
            if (!p) continue;
            const xy = ns.posToXY(p.position || 'center', N, M);
            const safeId = 'token-' + nick.replace(/[^a-zA-Z0-9]/g, '_');
            seen[safeId] = true;
            const isActive = (nick === currentTurnNick);

            const orderIdx = turnOrder.indexOf(nick);
            const colorIdx = orderIdx >= 0 ? orderIdx : nickList.indexOf(nick);
            const color = PLAYER_COLORS[colorIdx % PLAYER_COLORS.length];
            
            const nameParts = nick.trim().split(/[\s\-_.]+/);
            let initials = '';
            if (nameParts.length >= 2 && nameParts[0].length > 0 && nameParts[1].length > 0) {
                initials = (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase();
            } else {
                initials = nick.replace(/\s+/g, '').slice(0, 2).toUpperCase();
            }
            initials = initials || '?';
            
            const fontSize = initials.length > 1 ? '7.5' : '9.5';

            console.log('Token Render (player):', { nick: nick, initials: initials, fontSize: fontSize, safeId: safeId, isActive: isActive });
            let g = layer.querySelector('#' + safeId);
            if (!g) {
                g = createTokenEl(safeId, xy.x, xy.y, isActive, color, initials, fontSize);
                layer.appendChild(g);
                (function (el) {
                    window.requestAnimationFrame(function () { el.setAttribute('class', 'trivial-token'); });
                })(g);
            } else {
                const ring = g.querySelector('.trivial-active-ring');
                if (ring) ring.setAttribute('visibility', isActive ? 'visible' : 'hidden');
                
                const circle = g.querySelector('.team-color-circle');
                const text = g.querySelector('text');
                const style = getTokenColorStyle(color);
                
                if (circle) {
                    circle.setAttribute('fill', style.bg);
                    circle.setAttribute('stroke', style.stroke);
                    circle.setAttribute('stroke-width', '2.5');
                }
                if (text) {
                    text.textContent = initials;
                    text.setAttribute('x', '0');
                    text.setAttribute('y', '3.5');
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('fill', style.text);
                    text.setAttribute('font-size', fontSize);
                }

                const newT = 'translate(' + toVBPct(xy.x) + ', ' + toVBPct(xy.y) + ')';
                if (g.style.transform !== newT) {
                    g.style.transform = newT;
                    const inner = g.querySelector('.trivial-inner');
                    if (inner) {
                        setTimeout((function (inn) { return function () { animateBounce(inn); }; })(inner), 560);
                    }
                }
            }
        }
        removeStale(layer, seen);
    };

    ns.updateBoardTokensTeam = function (players, teamConfig, M, currentTurn, turnOrder) {
        const container = document.getElementById('trivial-board-svg');
        if (!container || !container._boardN) return;
        const N = container._boardN;
        const layer = document.getElementById('board-tokens');
        if (!layer) return;

        const teams = (teamConfig && teamConfig.teams) ? teamConfig.teams : [];
        const seen = {};
        turnOrder = turnOrder || [];

        for (let i = 0; i < teams.length; i++) {
            const team = teams[i];
            const teamName = team.name;
            const color = team.color || '#888';
            const safeId = 'token-' + teamName.replace(/[^a-zA-Z0-9]/g, '_');
            seen[safeId] = true;

            let memberNick = null;
            if (team.players && players) {
                for (let j = 0; j < team.players.length; j++) {
                    if (players[team.players[j]]) { memberNick = team.players[j]; break; }
                }
            }
            const pos = memberNick ? (players[memberNick].position || 'center') : 'center';
            const xy = ns.posToXY(pos, N, M);
            const isActive = (teamName === currentTurn);
            const posNum = turnOrder.indexOf(teamName) >= 0 ? turnOrder.indexOf(teamName) + 1 : 0;
            
            let teamInitials = '';
            const teamParts = teamName.trim().split(/[\s\-_.]+/);
            if (teamParts.length >= 2 && teamParts[0].length > 0 && teamParts[1].length > 0) {
                teamInitials = (teamParts[0].charAt(0) + teamParts[1].charAt(0)).toUpperCase();
            } else {
                teamInitials = teamName.replace(/\s+/g, '').slice(0, 2).toUpperCase();
            }
            teamInitials = teamInitials || '?';
            
            const label = teamInitials;
            const fontSize = label.length > 1 ? '7.5' : '9.5';
            console.log('Token Render (team):', { teamName: teamName, initials: teamInitials, label: label, fontSize: fontSize, safeId: safeId, isActive: isActive });

            let g = layer.querySelector('#' + safeId);
            if (!g) {
                g = createTokenEl(safeId, xy.x, xy.y, isActive, color, label, fontSize);
                layer.appendChild(g);
                (function (el) {
                    window.requestAnimationFrame(function () { el.setAttribute('class', 'trivial-token'); });
                })(g);
            } else {
                const ring = g.querySelector('.trivial-active-ring');
                if (ring) ring.setAttribute('visibility', isActive ? 'visible' : 'hidden');
                
                const circle = g.querySelector('.team-color-circle');
                const text = g.querySelector('text');
                const style = getTokenColorStyle(color);
                
                if (circle) {
                    circle.setAttribute('fill', style.bg);
                    circle.setAttribute('stroke', style.stroke);
                    circle.setAttribute('stroke-width', '2.5');
                }
                if (text) {
                    text.textContent = label;
                    text.setAttribute('x', '0');
                    text.setAttribute('y', '3.5');
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('fill', style.text);
                    text.setAttribute('font-size', fontSize);
                }

                const newT = 'translate(' + toVBPct(xy.x) + ', ' + toVBPct(xy.y) + ')';
                if (g.style.transform !== newT) {
                    g.style.transform = newT;
                    const inner = g.querySelector('.trivial-inner');
                    if (inner) {
                        setTimeout((function (inn) { return function () { animateBounce(inn); }; })(inner), 560);
                    }
                }
            }
        }
        removeStale(layer, seen);
    };

})(window.TrivialShared);
