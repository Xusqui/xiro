/**
 * @module taskpane-render
 * @description Funciones de renderizado DOM del task pane.
 *   Solo lista de juegos y filas de equipos — todo lo demás vive en el diálogo.
 * @depends [game-selector (XiroGameSelector), teams (XiroTeams)]
 */

/** Escapa texto para inserción segura como textContent no es necesario,
 *  pero sí para atributos data-* e innerHTML. */
function _esc(str) {
    return String(str || '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
}

// ── Pantalla: Selector de juegos ──────────────────────────────

/**
 * Renderiza la lista de juegos filtrada en #games-list.
 * @param {Array} games
 * @param {Function} onSelect — callback(gameEl) al hacer clic en un juego
 */
function renderGamesList(games, onSelect) {
    const list = document.getElementById('games-list');
    if (!games.length) {
        list.innerHTML = '<p class="loading">No hay juegos disponibles.</p>';
        return;
    }
    list.innerHTML = games.map((g, i) => `
    <div class="game-item" data-idx="${i}">
      <div>
        <div class="game-item-name">${_esc(g.name)}</div>
        <div class="game-item-meta">${g.questionCount ? g.questionCount + ' preguntas' : ''}</div>
      </div>
      <span class="game-type-badge">${_esc(XiroGameSelector.typeLabel(g.type))}</span>
    </div>`).join(''); // eslint-disable-line no-undef
    list.querySelectorAll('.game-item').forEach((el, i) =>
        el.addEventListener('click', () => onSelect(games[i], el)));
}



// ── Pantalla: Equipos ─────────────────────────────────────────

/**
 * Renderiza las filas de configuración de equipos.
 * @param {Array} teams
 */
function renderTeamRows(teams) {
    const list = document.getElementById('teams-list');
    list.innerHTML = teams.map((t, i) => `
    <div class="team-row" data-idx="${i}">
      <div class="team-color-swatch" style="background:#${_esc(t.color)}" data-idx="${i}"></div>
      <input class="team-name-input" type="text" value="${_esc(t.name)}"
             maxlength="30" data-idx="${i}" aria-label="Nombre del equipo ${i + 1}" />
    </div>`).join('');
    list.querySelectorAll('.team-name-input').forEach(inp =>
        inp.addEventListener('change', e =>
            XiroTeams.setTeamName(+e.target.dataset.idx, e.target.value)));  // eslint-disable-line no-undef
}


