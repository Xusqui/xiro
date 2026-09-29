/**
 * @fileoverview Comment slide panel for presenter remote control.
 * Renders the manual point assignment grid for players or teams.
 */

const TEAM_COLORS = {
    red: '#dc2626', blue: '#2563eb', green: '#16a34a',
    yellow: '#ca8a04', purple: '#7c3aed', pink: '#db2777',
    orange: '#ea580c', cyan: '#0891b2', lime: '#65a30d'
};

function esc(str) {
    return String(str).replace(/[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
}

let assignPointsHandler = null;

export function setRemotePointsHandler(handler) {
    assignPointsHandler = typeof handler === 'function' ? handler : null;
}

function bindCommentPanelActions(panel) {
    if (!panel || panel.dataset.pointsBound === 'true') return;

    panel.addEventListener('click', (event) => {
        const pointsBtn = event.target.closest('[data-remote-points]');
        if (!pointsBtn) return;

        const targetName = pointsBtn.dataset.remoteTarget || '';
        const points = Number(pointsBtn.dataset.remotePoints || 0);
        const isTeam = pointsBtn.dataset.remoteIsTeam === 'true';
        if (!targetName || !Number.isFinite(points) || !assignPointsHandler) return;

        assignPointsHandler(targetName, points, isTeam);
    });

    panel.dataset.pointsBound = 'true';
}

function playerCard(nick, score) {
    return `
        <div class="rc-comment-card">
            <div class="rc-comment-name">${esc(nick)}</div>
            <div class="rc-comment-score" id="rc-score-${esc(nick)}">${score} pts</div>
            <div class="rc-comment-btns">
                <button data-remote-target="${esc(nick)}" data-remote-points="1" data-remote-is-team="false" class="rc-pts-btn rc-pts-green">+1</button>
                <button data-remote-target="${esc(nick)}" data-remote-points="5" data-remote-is-team="false" class="rc-pts-btn rc-pts-blue">+5</button>
                <button data-remote-target="${esc(nick)}" data-remote-points="10" data-remote-is-team="false" class="rc-pts-btn rc-pts-purple">+10</button>
            </div>
        </div>`;
}

function teamCard(team, teamScore) {
    const color = TEAM_COLORS[team.color] || '#7c3aed';
    return `
        <div class="rc-comment-card" style="border-left:4px solid ${color}">
            <div class="rc-comment-name">${esc(team.name)}</div>
            <div class="rc-comment-score" id="rc-score-team-${esc(team.name)}">${teamScore} pts</div>
            <div class="rc-comment-btns">
                <button data-remote-target="${esc(team.name)}" data-remote-points="1" data-remote-is-team="true" class="rc-pts-btn rc-pts-green">+1</button>
                <button data-remote-target="${esc(team.name)}" data-remote-points="5" data-remote-is-team="true" class="rc-pts-btn rc-pts-blue">+5</button>
                <button data-remote-target="${esc(team.name)}" data-remote-points="10" data-remote-is-team="true" class="rc-pts-btn rc-pts-purple">+10</button>
            </div>
        </div>`;
}

/**
 * Renders the comment panel with player/team point buttons.
 * @param {string} commentText
 * @param {Object} scores  - { nick: score }
 * @param {Object|null} teamConfig
 */
export function renderCommentPanel(commentText, scores, teamConfig) {
    const panel = document.getElementById('remote-comment-panel');
    if (!panel) return;

    const isTeam = teamConfig?.isTeamMode && teamConfig.teams?.length > 0;
    let cards = '';

    if (isTeam) {
        cards = teamConfig.teams.map(team => {
            const teamScore = team.players.reduce((s, p) => s + (scores[p] || 0), 0);
            return teamCard(team, teamScore);
        }).join('');
    } else {
        cards = Object.entries(scores).map(([nick, score]) => playerCard(nick, score)).join('');
    }

    panel.innerHTML = _tHtml(`
        <div class="rc-comment-title">${esc(commentText || 'Actividad libre')}</div>
        <div class="rc-comment-grid">${cards}</div>`);
    panel.style.display = 'flex';
    bindCommentPanelActions(panel);
}

/**
 * Refreshes score values in the panel after a ranking-update event.
 * @param {Array} ranking  - [{ nickname, score }]
 * @param {Object|null} teamConfig
 */
export function refreshCommentScores(ranking, teamConfig) {
    const isTeam = teamConfig?.isTeamMode && teamConfig.teams?.length > 0;

    if (isTeam) {
        const ps = {};
        ranking.forEach(r => { ps[r.nickname] = r.score; });
        teamConfig.teams.forEach(team => {
            const el = document.getElementById(`rc-score-team-${esc(team.name)}`);
            if (!el) return;
            const total = team.players.reduce((s, p) => s + (ps[p] || 0), 0);
            el.textContent = _t(`${total} pts`);
        });
    } else {
        ranking.forEach(r => {
            const el = document.getElementById(`rc-score-${esc(r.nickname)}`);
            if (el) el.textContent = _t(`${r.score} pts`);
        });
    }
}

/**
 * Hides the comment panel.
 */
export function hideCommentPanel() {
    const panel = document.getElementById('remote-comment-panel');
    if (panel) panel.style.display = 'none';
}
