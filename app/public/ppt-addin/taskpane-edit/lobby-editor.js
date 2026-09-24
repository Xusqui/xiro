/**
 * @module lobby-editor
 * @description Formulario para configurar una diapositiva de lobby.
 *   Permite elegir juego, modo (individual/equipos) y nombres de equipos.
 * @depends [shared/api, taskpane-edit/notes-writer]
 */

const XiroLobbyEditor = (() => {

    let _container = null;
    let _games = [];
    let _currentMeta = null;  // meta existente para pre-rellenar el form

    /**
     * Monta el editor en el contenedor.
     * @param {HTMLElement} container
     * @param {{ role:'lobby', gameId?:number, mode?:string, teams?:string[] }|null} existingMeta
     */
    async function mount(container, existingMeta) {
        _container = container;
        _currentMeta = existingMeta;
        _container.innerHTML = '<p class="editor-loading">Cargando juegos…</p>';

        try {
            const pins = await XiroApi.getPresenterPins(); // eslint-disable-line no-undef
            _games = pins;
            _render();
        } catch (err) {
            _container.innerHTML = `<p class="editor-error">Error al cargar juegos: ${_esc(err.message)}</p>`;
        }
    }

    function _render() {
        const sel = _currentMeta?.gameId;
        const mode = _currentMeta?.mode || 'individual';
        const teams = _currentMeta?.teams || ['Equipo A', 'Equipo B'];

        const game = _games.find(g => String(g.id) === String(sel));
        const gameCards = _games.map(g => {
            const picked = sel && String(g.id) === String(sel) ? ' active' : '';
            return `<button class="game-card${picked}" data-pin="${_esc(g.pin)}" data-id="${_esc(String(g.id || ''))}" data-type="${_esc(g.type || '')}">${_esc(g.name)}</button>`;
        }).join('');

        const teamRows = teams.map((t, i) =>
            `<div class="team-row">
                <span class="team-row__num">${i + 1}</span>
                <input class="team-name-input" data-i="${i}" type="text" maxlength="30" value="${_esc(t)}" placeholder="Equipo ${i + 1}">
            </div>`
        ).join('');

        _container.innerHTML = `
            <div class="editor-field">
                <p class="tp-section-title">Juego</p>
                <div class="game-cards" id="le-game-cards">${gameCards}</div>
                <input type="hidden" id="le-game-pin"  value="${sel ? (game?.pin || '') : ''}">
                <input type="hidden" id="le-game-id"   value="${sel || ''}">
                <input type="hidden" id="le-game-type" value="${sel ? (game?.type || '') : ''}">
            </div>
            <div class="editor-field">
                <p class="tp-section-title">Modo</p>
                <div class="mode-toggle">
                    <button class="mode-btn${mode === 'individual' ? ' active' : ''}" data-mode="individual">Individual</button>
                    <button class="mode-btn${mode === 'teams' ? ' active' : ''}" data-mode="teams">Equipos</button>
                </div>
            </div>
            <div class="editor-field ${mode === 'teams' ? '' : 'hidden'}" id="le-teams-section">
                <p class="tp-section-title">Equipos</p>
                <div id="le-teams-list">${teamRows}</div>
                <div class="team-controls">
                    <button id="le-team-minus" class="team-ctrl-btn">−</button>
                    <span id="le-team-count">${teams.length} equipos</span>
                    <button id="le-team-plus"  class="team-ctrl-btn">+</button>
                </div>
            </div>
            <button id="le-save" class="save-btn">Guardar en diapositiva</button>
        `;

        // Game cards
        _container.querySelectorAll('.game-card').forEach(btn => {
            btn.addEventListener('click', () => {
                _container.querySelectorAll('.game-card').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('le-game-pin').value = btn.dataset.pin;
                document.getElementById('le-game-id').value = btn.dataset.id;
                document.getElementById('le-game-type').value = btn.dataset.type || '';
            });
        });

        // Mode toggle
        _container.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                _container.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('le-teams-section').classList.toggle('hidden', btn.dataset.mode !== 'teams');
            });
        });

        document.getElementById('le-team-minus').addEventListener('click', () => _resizeTeams(-1));
        document.getElementById('le-team-plus').addEventListener('click', () => _resizeTeams(+1));
        document.getElementById('le-save').addEventListener('click', _onSave);
    }

    function _onModeChange(e) {
        const sec = document.getElementById('le-teams-section');
        sec.classList.toggle('hidden', e.target.value !== 'teams');
    }

    function _resizeTeams(delta) {
        const inputs = document.querySelectorAll('.team-name-input');
        const names = Array.from(inputs).map(i => i.value || '');
        const next = Math.max(2, Math.min(8, names.length + delta));
        while (names.length < next) names.push(`Equipo ${names.length + 1}`);
        const trimmed = names.slice(0, next);
        document.getElementById('le-teams-list').innerHTML = trimmed.map((t, i) =>
            `<div class="team-row">
                <span class="team-row__num">${i + 1}</span>
                <input class="team-name-input" data-i="${i}" type="text" maxlength="30" value="${_esc(t)}" placeholder="Equipo ${i + 1}">
            </div>`
        ).join('');
        document.getElementById('le-team-count').textContent = next + ' equipos';
    }

    async function _onSave() {
        const btn = document.getElementById('le-save');
        const pin = document.getElementById('le-game-pin').value;
        const gameId = Number(document.getElementById('le-game-id').value) || null;
        const gameType = document.getElementById('le-game-type').value || '';
        const modeBtn = _container.querySelector('.mode-btn.active');
        const modeVal = modeBtn ? modeBtn.dataset.mode : 'individual';

        if (!pin) { alert('Selecciona un juego.'); return; }

        const meta = { role: 'lobby', pin, gameId, gameType, mode: modeVal };

        if (modeVal === 'teams') {
            meta.teams = Array.from(document.querySelectorAll('.team-name-input'))
                .map(i => (i.value || '').trim() || `Equipo ${Number(i.dataset.i) + 1}`);
        }

        btn.disabled = true; btn.textContent = 'Guardando…';
        try {
            await XiroNotesWriter.writeXiroMeta(meta); // eslint-disable-line no-undef
            btn.textContent = '✓ Guardado';
            if (typeof XiroEditPanel !== 'undefined') XiroEditPanel.refresh(); // eslint-disable-line no-undef
            setTimeout(() => { if (btn.isConnected) btn.textContent = 'Guardar en diapositiva'; }, 2000);
        } catch (err) {
            alert('Error al guardar: ' + err.message);
            btn.textContent = 'Guardar en diapositiva';
        } finally { btn.disabled = false; }
    }

    function _esc(str) {
        return String(str).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
    }

    function unmount() { if (_container) _container.innerHTML = ''; }

    return { mount, unmount };
})();
