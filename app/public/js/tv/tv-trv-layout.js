window.TVApp = window.TVApp || {};
window.TVApp.TrvLayout = (function () {
    'use strict';

    const getEl = window.TVApp.Utils.getEl;
    const clearCache = window.TVApp.Utils.clearCache;
    const escapeHtml = window.TVApp.Utils.escapeHtml;

    function buildTrivialLayout() {
        let html = '<div style="display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden">';

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
        const el = getEl('trv-category-legend');
        if (!el || !state || !state.categories || !state.categories.length) return;

        let html = '<div style="font-size:18px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.6px;padding:2px 4px 4px">BANCOS</div>';

        for (let i = 0; i < state.categories.length; i++) {
            const c = state.categories[i];
            const col = c.color || '#888';
            const name = c.bank_name || c.category_name || 'Desconocido';

            html += '<div style="display:flex;align-items:center;padding:12px 14px;background:rgba(30,41,59,0.85);border-radius:8px;border-left:4px solid ' + col + ';margin-bottom:14px">';
            html += '<span style="width:18px;height:18px;border-radius:50%;flex-shrink:0;background:' + col + ';box-shadow:0 0 8px ' + col + ';margin-right:14px"></span>';
            html += '<span style="font-size:18px;color:#fff;font-weight:700;line-height:1.2;word-break:break-word">' + escapeHtml(name) + '</span></div>';
        }
        el.innerHTML = _tHtml(html);
    }

    /** Fichas (quesitos) conseguidas: una bolita por categoría, apagada si no se tiene. */
    function wedgesHtml(tokens, categories) {
        let html = '';
        for (let w = 0; w < tokens.length; w++) {
            const filled = tokens[w];
            const col = categories[w] ? categories[w].color : '#888';
            const op = filled ? 1 : 0.2;
            const sh = filled ? '0 0 6px 2px ' + col : 'none';
            const bdr = '1.5px solid rgba(255,255,255,' + (filled ? '0.9' : '0.2') + ')';
            html += '<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:' + col + ';opacity:' + op + ';box-shadow:' + sh + ';border:' + bdr + ';margin:2px"></span>';
        }
        return html;
    }

    /** Tarjeta de un jugador o equipo; resaltada si tiene el turno. */
    function scoreCardHtml(card) {
        const bg = card.active ? 'rgba(234,179,8,0.18)' : 'rgba(51,65,85,0.5)';
        const border = card.active ? 'rgba(234,179,8,0.5)' : 'transparent';
        let html = '<div style="border-radius:8px;padding:8px 12px;background:' + bg + ';border:2px solid ' + border + ';margin-bottom:8px">';
        html += '<div style="display:flex;align-items:center;margin-bottom:6px">';
        html += '<span style="width:22px;height:22px;border-radius:50%;background:' + card.badgeBg + ';color:' + card.badgeColor + ';font-size:12px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:6px">' + card.position + '</span>';
        html += '<span style="color:#fff;font-size:14px;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">' + escapeHtml(card.name) + '</span></div>';
        html += '<div style="display:flex;flex-wrap:wrap">' + card.wedges + '</div>';
        if (card.members) html += '<div style="color:#94a3b8;font-size:11px;margin-top:6px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + card.members + '</div>';
        return html + '</div>';
    }

    function isTeamGame(state, players) {
        if (state.teamMode) return true;
        for (const nick in players) {
            if (players[nick].teamName) return true;
        }
        return false;
    }

    /** Equipos de la partida; si el estado no trae teamConfig, se reconstruyen desde los jugadores. */
    function resolveTeams(state, players) {
        if (state.teamConfig && state.teamConfig.teams && state.teamConfig.teams.length) {
            return state.teamConfig.teams;
        }
        const teamMap = {};
        const teams = [];
        for (const nick in players) {
            const teamName = players[nick].teamName;
            if (!teamName) continue;
            if (!teamMap[teamName]) {
                teamMap[teamName] = { name: teamName, color: '#888', players: [] };
                teams.push(teamMap[teamName]);
            }
            teamMap[teamName].players.push(nick);
        }
        return teams;
    }

    /** Fichas del equipo; si no hay, las del primer jugador (forma antigua del estado). */
    function teamTokens(state, team, players) {
        const tokens = (state.teamTokens && state.teamTokens[team.name]) ? state.teamTokens[team.name] : [];
        if (tokens.length === 0 && team.players && team.players[0] && players[team.players[0]]) {
            return players[team.players[0]].token || [];
        }
        return tokens;
    }

    function teamCardsHtml(state, players, categories, turnOrder) {
        const teams = resolveTeams(state, players);
        let html = '';
        for (let i = 0; i < teams.length; i++) {
            const team = teams[i];
            let position = turnOrder.indexOf(team.name) + 1;
            if (position <= 0) position = i + 1;
            html += scoreCardHtml({
                active: team.name === state.currentTurn,
                badgeBg: team.color || '#888',
                badgeColor: '#fff',
                position: position,
                name: team.name,
                wedges: wedgesHtml(teamTokens(state, team, players), categories),
                members: (team.players || []).map(function (member) { return escapeHtml(member); }).join(', ')
            });
        }
        return html;
    }

    function playerCardsHtml(state, players, categories, turnOrder) {
        const ordered = turnOrder.length ? turnOrder : Object.keys(players);
        let html = '';
        for (let j = 0; j < ordered.length; j++) {
            const nick = ordered[j];
            if (!players[nick]) continue;
            html += scoreCardHtml({
                active: nick === state.currentTurn,
                badgeBg: '#fbbf24',
                badgeColor: '#1e293b',
                position: j + 1,
                name: nick,
                wedges: wedgesHtml(players[nick].token || [], categories)
            });
        }
        return html;
    }

    function refreshPlayerScores(state) {
        const panel = getEl('trv-player-scores');
        if (!panel || !state) return;

        const players = state.players || {};
        const categories = state.categories || [];
        const turnOrder = state.turnOrder || [];

        if (isTeamGame(state, players)) {
            // Sin equipos aún: se deja el panel como está (igual que antes)
            if (resolveTeams(state, players).length === 0) return;
            panel.innerHTML = _tHtml(teamCardsHtml(state, players, categories, turnOrder));
            return;
        }
        panel.innerHTML = _tHtml(playerCardsHtml(state, players, categories, turnOrder));
    }

    function setStatus(turn, phase) {
        const t = getEl('trv-turn');
        const p = getEl('trv-phase');
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
