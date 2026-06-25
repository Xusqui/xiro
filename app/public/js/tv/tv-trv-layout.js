window.TVApp = window.TVApp || {};
window.TVApp.TrvLayout = (function () {
    'use strict';

    var getEl = window.TVApp.Utils.getEl;
    var clearCache = window.TVApp.Utils.clearCache;

    function buildTrivialLayout() {
        var html = '<div style="display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden">';

        // Status bar
        html += '<div id="trv-status" style="flex-shrink:0;background:rgba(15,23,42,0.92);border-radius:12px;';
        html += 'padding:8px 16px;display:flex;align-items:center;justify-content:center;text-align:center">';
        html += '<div id="trv-turn" style="color:#fbbf24;font-size:1.4rem;font-weight:900;letter-spacing:.5px"></div>';
        html += '<div id="trv-phase" style="color:#94a3b8;font-size:1rem;padding-left:12px"></div>';
        html += '</div>';

        // Main content row
        html += '<div style="flex:1;min-height:0;display:flex;align-items:stretch;margin-top:10px">';

        // Panel Izquierdo: Leyenda de Bancos (Categorías)
        html += '<div id="trv-category-legend" style="width:280px;flex-shrink:0;display:flex;flex-direction:column;padding:16px;background:rgba(15,23,42,0.6);border-radius:10px;overflow-y:auto;margin-right:12px"></div>';

        // Panel Central: Tablero SVG
        html += '<div style="flex:1;display:flex;align-items:center;justify-content:center;position:relative;min-width:0;margin-right:12px">';
        html += '<div id="trivial-board-svg" style="height:100%;width:100%;max-width:calc(100vh - 120px);aspect-ratio:1/1;position:relative;display:flex;align-items:center;justify-content:center"></div>';
        html += '</div>';

        // Panel Derecho: Ranking / Jugadores
        html += '<div id="trv-player-scores" style="width:280px;flex-shrink:0;display:flex;flex-direction:column;overflow-y:auto;padding:8px;background:rgba(15,23,42,0.6);border-radius:10px"></div>';
        html += '</div>'; // End Main Row

        html += '</div>'; // End Outer Flex

        getEl('main-container').innerHTML = _tHtml(html);
        clearCache();
    }

    function buildCategoryLegend(state) {
        var el = getEl('trv-category-legend');
        if (!el || !state || !state.categories || !state.categories.length) return;

        var html = '<div style="font-size:18px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.6px;padding:2px 4px 4px">BANCOS</div>';

        for (var i = 0; i < state.categories.length; i++) {
            var c = state.categories[i];
            var col = c.color || '#888';
            var name = c.bank_name || c.category_name || 'Desconocido';

            html += '<div style="display:flex;align-items:center;padding:12px 14px;background:rgba(30,41,59,0.85);border-radius:8px;border-left:4px solid ' + col + ';margin-bottom:14px">';
            html += '<span style="width:18px;height:18px;border-radius:50%;flex-shrink:0;background:' + col + ';box-shadow:0 0 8px ' + col + ';margin-right:14px"></span>';
            html += '<span style="font-size:18px;color:#fff;font-weight:700;line-height:1.2;word-break:break-word">' + name + '</span></div>';
        }
        el.innerHTML = _tHtml(html);
    }

    function refreshPlayerScores(state) {
        var panel = getEl('trv-player-scores');
        if (!panel || !state) return;

        var categories = state.categories || [];
        var currentTurn = state.currentTurn;
        var turnOrder = state.turnOrder || [];
        var players = state.players || {};

        var isTeamMode = state.teamMode || false;
        var pKeys = Object.keys(players);
        for (var k = 0; k < pKeys.length; k++) {
            if (players[pKeys[k]].teamName) isTeamMode = true;
        }

        var html = '';

        if (isTeamMode) {
            var teamCfg = state.teamConfig;
            if (!teamCfg || !teamCfg.teams || !teamCfg.teams.length) {
                var teamMap = {};
                for (var nk in players) {
                    var tg = players[nk].teamName;
                    if (!tg) continue;
                    if (!teamMap[tg]) teamMap[tg] = { name: tg, color: '#888', players: [] };
                    teamMap[tg].players.push(nk);
                }
                var tArr = [];
                for (var key in teamMap) tArr.push(teamMap[key]);
                teamCfg = { teams: tArr };
            }
            if (!teamCfg || !teamCfg.teams || !teamCfg.teams.length) return;

            for (var i = 0; i < teamCfg.teams.length; i++) {
                var team = teamCfg.teams[i];
                var tName = team.name;
                var tColor = team.color || '#888';
                var isActive = (tName === currentTurn);
                var bg = isActive ? 'rgba(234,179,8,0.18)' : 'rgba(51,65,85,0.5)';
                var border = isActive ? 'rgba(234,179,8,0.5)' : 'transparent';

                var rawTokens = (state.teamTokens && state.teamTokens[tName]) ? state.teamTokens[tName] : [];
                if (rawTokens.length === 0 && team.players && team.players[0] && players[team.players[0]]) {
                    rawTokens = players[team.players[0]].token || [];
                }

                var wedges = '';
                for (var w = 0; w < rawTokens.length; w++) {
                    var filled = rawTokens[w];
                    var col = categories[w] ? categories[w].color : '#888';
                    var op = filled ? 1 : 0.2;
                    var sh = filled ? '0 0 6px 2px ' + col : 'none';
                    var bdr = '1.5px solid rgba(255,255,255,' + (filled ? '0.9' : '0.2') + ')';
                    wedges += '<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:' + col + ';opacity:' + op + ';box-shadow:' + sh + ';border:' + bdr + ';margin:2px"></span>';
                }

                var members = (team.players || []).join(', ');
                var turnPos = turnOrder.indexOf(tName) + 1;
                if (turnPos <= 0) turnPos = i + 1;

                html += '<div style="border-radius:8px;padding:8px 12px;background:' + bg + ';border:2px solid ' + border + ';margin-bottom:8px">';
                html += '<div style="display:flex;align-items:center;margin-bottom:6px">';
                html += '<span style="width:22px;height:22px;border-radius:50%;background:' + tColor + ';color:#fff;font-size:12px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:6px">' + turnPos + '</span>';
                html += '<span style="color:#fff;font-size:14px;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">' + tName + '</span></div>';
                html += '<div style="display:flex;flex-wrap:wrap">' + wedges + '</div>';
                if (members) html += '<div style="color:#94a3b8;font-size:11px;margin-top:6px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + members + '</div>';
                html += '</div>';
            }
        } else {
            var ordered = turnOrder.length ? turnOrder : Object.keys(players);
            for (var j = 0; j < ordered.length; j++) {
                var nick = ordered[j];
                var p = players[nick];
                if (!p) continue;
                var pos = j + 1;
                var pActive = (nick === currentTurn);
                var pBg = pActive ? 'rgba(234,179,8,0.18)' : 'rgba(51,65,85,0.5)';
                var pBorder = pActive ? 'rgba(234,179,8,0.5)' : 'transparent';

                var pWedges = '';
                var pTokens = p.token || [];
                for (var pw = 0; pw < pTokens.length; pw++) {
                    var pFilled = pTokens[pw];
                    var pCol = categories[pw] ? categories[pw].color : '#888';
                    var pOp = pFilled ? 1 : 0.2;
                    var pSh = pFilled ? '0 0 6px 2px ' + pCol : 'none';
                    var pBdr = '1.5px solid rgba(255,255,255,' + (pFilled ? '0.9' : '0.2') + ')';
                    pWedges += '<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:' + pCol + ';opacity:' + pOp + ';box-shadow:' + pSh + ';border:' + pBdr + ';margin:2px"></span>';
                }

                html += '<div style="border-radius:8px;padding:8px 12px;background:' + pBg + ';border:2px solid ' + pBorder + ';margin-bottom:8px">';
                html += '<div style="display:flex;align-items:center;margin-bottom:6px">';
                html += '<span style="width:22px;height:22px;border-radius:50%;background:#fbbf24;color:#1e293b;font-size:12px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:6px">' + pos + '</span>';
                html += '<span style="color:#fff;font-size:14px;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">' + nick + '</span></div>';
                html += '<div style="display:flex;flex-wrap:wrap">' + pWedges + '</div></div>';
            }
        }
        panel.innerHTML = _tHtml(html);
    }

    function setStatus(turn, phase) {
        var t = getEl('trv-turn');
        var p = getEl('trv-phase');
        if (t) t.textContent = _t(turn ? '🎲 TURNO: ' + turn : '');
        if (p) p.textContent = _t(phase || '');
    }

    return {
        buildTrivialLayout: buildTrivialLayout,
        buildCategoryLegend: buildCategoryLegend,
        refreshPlayerScores: refreshPlayerScores,
        setStatus: setStatus
    };
})();
