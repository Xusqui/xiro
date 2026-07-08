/**
 * @fileoverview Panel lateral de jugadores del presentador
 * Actualización y renderizado del panel de jugadores conectados
 */

import { getConnectedPlayers, getPlayersData, getIsTeamMode, getTeamConfig } from './presenter-state.js?v=20260708133604';
import { getTeamColorStyle } from './presenter-team-config.js?v=20260708133604';

/** nick → <div> element kept across renders */
const playerCards = new Map();
/** nick → last rendered fingerprint to skip unchanged cards */
const playerFingerprints = new Map();
const WAITING_PLAYERS_SELECTOR = '[data-empty-state="waiting-players"]';
const WAITING_PLAYERS_HTML = '<div data-empty-state="waiting-players" class="text-slate-500 text-xs italic text-center py-8">Esperando jugadores...</div>';

function isLobbyPhaseActive() {
    return Boolean(document.getElementById('btn-empezar'));
}

function removeWaitingPlayersPlaceholder(panel) {
    panel.querySelectorAll(WAITING_PLAYERS_SELECTOR).forEach(node => node.remove());

    // Compatibilidad con placeholder legado del HTML inicial sin data-attribute.
    panel.querySelectorAll('.text-slate-500.text-xs.italic.text-center.py-8').forEach(node => {
        if (node.textContent?.trim() === 'Esperando jugadores...') {
            node.remove();
        }
    });
}

function cardFingerprint(data, index, isTeamMode, teamKey = '') {
    const si = data.streakInfo;
    return `${index}|${data.score}|${data.answered}|${data.correct}|${isTeamMode}|${si ? si.current + '|' + si.isInDoubleStreak : ''}|${teamKey}`;
}

/**
 * Construir lookup de equipos por jugador
 */
export function buildTeamLookup() {
    const isTeamMode = getIsTeamMode();
    const teamConfig = getTeamConfig();

    if (!isTeamMode || !teamConfig || !Array.isArray(teamConfig.teams)) return {};

    return teamConfig.teams.reduce((acc, team) => {
        if (!team || !Array.isArray(team.players)) return acc;
        team.players.forEach(player => {
            const nickname = typeof player === 'string' ? player : player?.nickname;
            if (nickname) acc[nickname] = team;
        });
        return acc;
    }, {});
}

/**
 * Actualizar panel de jugadores en la barra lateral
 */
export function updatePlayersPanel() {
    const panel = document.getElementById('players-sidebar-list');
    if (!panel) return;

    const count = document.getElementById('players-sidebar-count');
    const connectedPlayers = getConnectedPlayers();
    const playersData = getPlayersData();
    const isTeamMode = getIsTeamMode();

    if (count) {
        count.textContent = _t(connectedPlayers.length);
    }

    const teamLookup = buildTeamLookup();

    if (connectedPlayers.length === 0) {
        playerCards.clear();
        playerFingerprints.clear();
        panel.innerHTML = _tHtml(isLobbyPhaseActive() ? WAITING_PLAYERS_HTML : '');
    } else {
        removeWaitingPlayersPlaceholder(panel);

        // Ordenar por puntuación
        const sortedPlayers = [...connectedPlayers].sort((a, b) => {
            const scoreA = playersData[a]?.score || 0;
            const scoreB = playersData[b]?.score || 0;
            return scoreB - scoreA;
        });

        const renderPlayerCard = (nick, index) => {
            const data = playersData[nick] || { score: 0, answered: false, correct: null };
            let statusIcon = '<i class="fas fa-clock text-yellow-400" style="font-size: 10px;"></i>';
            let statusClass = '';

            if (isTeamMode) {
                if (data.answered) {
                    statusIcon = '<i class="fas fa-check-circle text-white" style="font-size: 10px;"></i>';
                    statusClass = 'bg-blue-900/30';
                }
            } else {
                if (data.correct === true) {
                    statusIcon = '<i class="fas fa-check-circle text-green-400" style="font-size: 10px;"></i>';
                    statusClass = 'bg-green-900/30';
                } else if (data.correct === false) {
                    statusIcon = '<i class="fas fa-times-circle text-red-400" style="font-size: 10px;"></i>';
                    statusClass = 'bg-red-900/30';
                } else if (data.answered) {
                    statusIcon = '<i class="fas fa-check-circle text-blue-400" style="font-size: 10px;"></i>';
                    statusClass = 'bg-blue-900/30';
                }
            }

            // Medallas para top 3
            let medal = '';
            if (index === 0 && data.score > 0) medal = '<i class="fas fa-crown text-yellow-400 mr-1" style="font-size: 10px;"></i>';
            else if (index === 1 && data.score > 0) medal = '<i class="fas fa-medal text-slate-300 mr-1" style="font-size: 10px;"></i>';
            else if (index === 2 && data.score > 0) medal = '<i class="fas fa-medal text-amber-600 mr-1" style="font-size: 10px;"></i>';

            const team = teamLookup[nick];
            const teamStyle = team ? getTeamColorStyle(team.color) : null;
            const cardStyle = teamStyle
                ? `style="border-left: 4px solid ${teamStyle.solid}; background-image: linear-gradient(90deg, ${teamStyle.tint}, transparent);"`
                : '';
            const nameStyle = teamStyle ? `style="color: ${teamStyle.text};"` : '';

            // Streak fire badge (shown next to name)
            const streakInfo = data.streakInfo;
            let streakFire = '';

            // Only show badge if streaks are enabled and player is in a streak
            if (streakInfo && streakInfo.isInStreak) {
                const isDouble = streakInfo.isInDoubleStreak;
                if (isDouble) {
                    // Doble racha: fondo rojo intenso con dos fuegos y número
                    streakFire = `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded" style="background:linear-gradient(135deg,#dc2626,#b91c1c);box-shadow:0 0 8px rgba(239,68,68,0.6);flex-shrink:0" title="¡Doble racha! ${streakInfo.current} aciertos consecutivos">
                        <i class="fas fa-fire" style="font-size:10px;color:#fef2f2;filter:drop-shadow(0 0 2px #fca5a5)"></i>
                        <i class="fas fa-fire" style="font-size:10px;color:#fef2f2;filter:drop-shadow(0 0 2px #fca5a5)"></i>
                        <span style="font-size:9px;font-weight:900;color:#fef2f2;line-height:1">${streakInfo.current}</span>
                    </span>`;
                } else {
                    // Racha normal: fondo naranja con un fuego y número
                    streakFire = `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded" style="background:linear-gradient(135deg,#f97316,#ea580c);box-shadow:0 0 6px rgba(249,115,22,0.5);flex-shrink:0" title="¡En racha! ${streakInfo.current} aciertos consecutivos">
                        <i class="fas fa-fire" style="font-size:10px;color:#ffedd5;filter:drop-shadow(0 0 2px #fed7aa)"></i>
                        <span style="font-size:9px;font-weight:900;color:#ffedd5;line-height:1">${streakInfo.current}</span>
                    </span>`;
                }
            }

            return `
                <div class="bg-slate-700/50 ${statusClass} px-2 py-1 rounded-lg text-xs font-semibold transition-all" ${cardStyle}>
                    <div class="flex items-center justify-between mb-1 gap-2">
                        <div class="flex items-center flex-1 min-w-0 gap-1">
                            ${statusIcon}
                            <span class="uppercase truncate" title="${nick}" ${nameStyle}>${nick}</span>
                            ${streakFire}
                        </div>
                        ${medal}
                    </div>
                    <div class="flex justify-between items-center text-[10px] mt-1 gap-1">
                        <span class="text-slate-400">Puntos:</span>
                        <span class="text-purple-300 font-bold">${data.score.toFixed(1)}</span>
                    </div>
                </div>
            `;
        };

        // Incremental diff: only touch DOM nodes that changed
        const incomingSet = new Set(sortedPlayers);

        // Remove departed players
        for (const [nick, el] of playerCards) {
            if (!incomingSet.has(nick)) {
                el.remove();
                playerCards.delete(nick);
                playerFingerprints.delete(nick);
            }
        }

        // Insert/update and reorder via appendChild (moves existing nodes cheaply)
        sortedPlayers.forEach((nick, index) => {
            const team = teamLookup[nick];
            const teamKey = team ? `${team.name || ''}|${team.color || ''}` : '';
            const fp = cardFingerprint(playersData[nick] || { score: 0, answered: false, correct: null }, index, isTeamMode, teamKey);
            let el = playerCards.get(nick);
            if (!el) {
                el = document.createElement('div');
                playerCards.set(nick, el);
            }
            if (fp !== playerFingerprints.get(nick)) {
                el.innerHTML = _tHtml(renderPlayerCard(nick, index));
                playerFingerprints.set(nick, fp);
            }
            // appendChild moves existing node to end — preserves sort order without cloning
            panel.appendChild(el);
        });
    }
}

/**
 * Renderizar equipos en el lobby
 */
export function renderTeamLobby() {
    const teamConfig = getTeamConfig();
    const isTeamMode = getIsTeamMode();
    const playersData = getPlayersData();

    if (!teamConfig || !isTeamMode) return;

    const pList = document.getElementById('p-list');
    if (!pList) return;

    // Cambiar grid a 2 columnas para equipos
    pList.className = 'grid gap-4';
    pList.style.display = 'grid';
    pList.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
    pList.style.columnGap = '1rem';
    pList.style.rowGap = '0.25rem';
    pList.style.gridAutoRows = 'min-content';
    pList.style.alignItems = 'start';
    pList.style.alignContent = 'start';

    const teamColors = {
        red: 'bg-red-600',
        blue: 'bg-blue-600',
        green: 'bg-green-600',
        yellow: 'bg-yellow-500',
        purple: 'bg-purple-600',
        pink: 'bg-pink-600',
        orange: 'bg-orange-600',
        cyan: 'bg-cyan-600',
        lime: 'bg-lime-500'
    };

    // Optimización: Usar renderList si está disponible
    if (typeof window.renderList === 'function') {
        window.renderList(pList, teamConfig.teams, (team) => `
            <div style="align-self: stretch;">
                <div class="${teamColors[team.color] || 'bg-purple-600'} rounded-2xl p-6 border-b-4 border-black/20" style="height: 100%; display: flex; flex-direction: column;">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-2xl font-black italic text-white">
                            <i class="fas fa-users mr-2"></i>${team.name.toUpperCase()}
                        </h3>
                        <span class="bg-white/30 px-4 py-2 rounded-full text-white font-black">
                            ${team.players.length} ${team.players.length === 1 ? 'jugador' : 'jugadores'}
                        </span>
                    </div>
                    <div class="grid grid-cols-4 gap-3">
                        ${team.players.map(player => {
            const playerScore = playersData[player] ? playersData[player].score : 0;
            return `
                                <div class="bg-white text-slate-900 px-2 py-2 rounded-lg font-black text-center uppercase italic text-xs inline-flex mx-auto whitespace-nowrap" data-nickname="${player}">
                                    <div>${player}</div>
                                </div>
                            `;
        }).join('') || '<p class="text-white/70 italic col-span-4 text-center py-4">Esperando jugadores...</p>'}
                    </div>
                </div>
            </div>
        `);
    } else {
        pList.innerHTML = teamConfig.teams.map(team => `
            <div style="align-self: stretch;">
                <div class="${teamColors[team.color] || 'bg-purple-600'} rounded-2xl p-6 border-b-4 border-black/20" style="height: 100%; display: flex; flex-direction: column;">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-2xl font-black italic text-white">
                            <i class="fas fa-users mr-2"></i>${team.name.toUpperCase()}
                        </h3>
                        <span class="bg-white/30 px-4 py-2 rounded-full text-white font-black">
                            ${team.players.length} ${team.players.length === 1 ? 'jugador' : 'jugadores'}
                        </span>
                    </div>
                    <div class="grid grid-cols-4 gap-3">
                        ${team.players.map(player => {
            const playerScore = playersData[player] ? playersData[player].score : 0;
            return `
                                <div class="bg-white text-slate-900 px-2 py-2 rounded-lg font-black text-center uppercase italic text-xs inline-flex mx-auto whitespace-nowrap" data-nickname="${player}">
                                    <div>${player}</div>
                                </div>
                            `;
        }).join('') || '<p class="text-white/70 italic col-span-4 text-center py-4">Esperando jugadores...</p>'}
                    </div>
                </div>
            </div>
        `).join('');
    }
}
