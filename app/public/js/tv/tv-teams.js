window.TVApp = window.TVApp || {};
window.TVApp.Teams = (function () {
    'use strict';

    const getEl = window.TVApp.Utils.getEl;
    const clearCache = window.TVApp.Utils.clearCache;
    const escapeHtml = window.TVApp.Utils.escapeHtml;
    const showTvModal = window.TVApp.Utils.showTvModal;

    const TEAM_COLORS = [
        { name: 'Rojo', value: 'red', bg: '#dc2626', border: '#b91c1c' },
        { name: 'Azul', value: 'blue', bg: '#2563eb', border: '#1d4ed8' },
        { name: 'Verde', value: 'green', bg: '#16a34a', border: '#15803d' },
        { name: 'Amarillo', value: 'yellow', bg: '#eab308', border: '#ca8a04' },
        { name: 'Morado', value: 'purple', bg: '#7c3aed', border: '#6d28d9' },
        { name: 'Rosa', value: 'pink', bg: '#ec4899', border: '#db2777' },
        { name: 'Naranja', value: 'orange', bg: '#ea580c', border: '#c2410c' },
        { name: 'Cian', value: 'cyan', bg: '#0891b2', border: '#0e7490' },
        { name: 'Lima', value: 'lime', bg: '#65a30d', border: '#4d7c0f' }
    ];

    const DEFAULT_TEAM_NAMES = ['Águilas', 'Tigres', 'Leones', 'Delfines', 'Halcones', 'Panteras', 'Lobos', 'Osos', 'Zorros'];

    function mostrarSeleccionModo(selectedPin) {
        getEl('main-container').innerHTML = _tHtml('<div class="pin-selector"><h1 class="pin-selector-title">¿Cómo quieres jugar?</h1><p class="pin-selector-subtitle">PIN: <strong>' + selectedPin + '</strong></p><div class="mode-grid"><div class="mode-card" data-tv-action="teams-mode-individual" data-pin="' + selectedPin + '"><div class="mode-icon">👤</div><h2 class="mode-title">INDIVIDUAL</h2><p class="mode-desc">Cada jugador compite por su cuenta</p></div><div class="mode-card" data-tv-action="teams-mode-team" data-pin="' + selectedPin + '"><div class="mode-icon">👤👤</div><h2 class="mode-title">POR EQUIPOS</h2><p class="mode-desc">Los jugadores se unen en equipos</p></div></div><button data-tv-action="go-tv-home" class="btn btn-secondary">Volver</button></div>');
        clearCache();
    }

    function configurarModoIndividual(selectedPin) {
        const state = window.TVApp.State;
        state.isTeamMode = false;
        state.teamConfig = null;
        window.location.href = '/tv.html?pin=' + selectedPin.toUpperCase();
    }

    function mostrarConfiguracionEquipos(selectedPin) {
        let html = '<div class="pin-selector"><h1 class="pin-selector-title">Configurar Equipos</h1><p class="pin-selector-subtitle">PIN: <strong>' + selectedPin + '</strong></p>';
        html += '<p style="font-size:18px;margin:20px 0;color:#ccc">¿Cuántos equipos?</p>';
        html += '<div class="teams-number-grid">';
        for (let i = 2; i <= 9; i++) {
            html += '<button class="team-number-btn" data-tv-action="teams-select-num" data-num-teams="' + i + '" data-pin="' + selectedPin + '">' + i + '</button>';
        }
        html += '</div><button data-tv-action="teams-back-mode" data-pin="' + selectedPin + '" class="btn btn-secondary" style="margin-top:20px">Volver</button></div>';
        getEl('main-container').innerHTML = _tHtml(html);
        clearCache();
    }

    function seleccionarNumEquipos(numTeams, selectedPin) {
        let html = '<div class="pin-selector"><h1 class="pin-selector-title">Nombra los ' + numTeams + ' Equipos</h1><p class="pin-selector-subtitle">Asigna un nombre y color a cada equipo</p>';
        html += '<div class="teams-config-form">';
        for (let i = 0; i < numTeams; i++) {
            html += '<div class="team-config-row"><span class="team-number">#' + (i + 1) + '</span>';
            html += '<input type="text" id="team-name-' + i + '" class="team-name-input" placeholder="Nombre equipo ' + (i + 1) + '" value="' + (DEFAULT_TEAM_NAMES[i] || 'Equipo ' + (i + 1)) + '">';
            html += '<select id="team-color-' + i + '" class="team-color-select">';
            for (let j = 0; j < TEAM_COLORS.length; j++) {
                const selected = j === (i % TEAM_COLORS.length) ? ' selected' : '';
                html += '<option value="' + TEAM_COLORS[j].value + '"' + selected + '>' + TEAM_COLORS[j].name + '</option>';
            }
            html += '</select></div>';
        }
        html += '</div><button data-tv-action="teams-confirm" data-num-teams="' + numTeams + '" data-pin="' + selectedPin + '" class="btn" style="margin-top:20px;padding:15px 40px;font-size:20px">✓ CONFIRMAR</button>';
        html += '<button data-tv-action="teams-back-config" data-pin="' + selectedPin + '" class="btn btn-secondary" style="margin-left:10px">Volver</button></div>';
        getEl('main-container').innerHTML = _tHtml(html);
        clearCache();
    }

    function isValidTeamName(name, pattern, minLen, maxLen) {
        if (!name) return false;
        if (name.length < minLen || name.length > maxLen) return false;
        return pattern.test(name);
    }

    function confirmarEquipos(numTeams, selectedPin) {
        const state = window.TVApp.State;
        const teams = [];
        const teamNamePattern = /^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s._-]+$/;
        for (let i = 0; i < numTeams; i++) {
            const nameInput = getEl('team-name-' + i);
            const colorSelect = getEl('team-color-' + i);
            const name = nameInput ? (nameInput.value.trim() || DEFAULT_TEAM_NAMES[i] || 'Equipo ' + (i + 1)) : 'Equipo ' + (i + 1);
            if (!isValidTeamName(name, teamNamePattern, 2, 30)) {
                showTvModal(
                    _t('presenter.team.name_invalid', null, 'Nombre inválido'),
                    _t('presenter.team.name_validation', null, 'El nombre del equipo solo puede contener letras, números, espacios y guiones (2-30 caracteres).'),
                    'warning'
                );
                if (nameInput) {
                    nameInput.focus();
                    nameInput.select();
                }
                return;
            }
            const colorValue = colorSelect ? colorSelect.value : TEAM_COLORS[i % TEAM_COLORS.length].value;
            let colorObj = null;
            for (let j = 0; j < TEAM_COLORS.length; j++) {
                if (TEAM_COLORS[j].value === colorValue) { colorObj = TEAM_COLORS[j]; break; }
            }
            if (!colorObj) colorObj = TEAM_COLORS[0];
            teams.push({ name: name, color: colorValue, colorName: colorObj.name, bg: colorObj.bg, border: colorObj.border, players: [], score: 0 });
        }
        state.isTeamMode = true;
        state.teamConfig = { teams: teams };
        window.location.href = '/tv.html?pin=' + selectedPin.toUpperCase() + '&mode=teams&teams=' + encodeURIComponent(JSON.stringify(teams));
    }

    function renderTeamLobby() {
        const state = window.TVApp.State;
        if (!state.teamConfig || !state.isTeamMode) return;
        const pList = getEl('p-list');
        if (!pList) return;
        pList.className = 'teams-lobby-grid';
        let html = '';
        for (let i = 0; i < state.teamConfig.teams.length; i++) {
            const team = state.teamConfig.teams[i];
            html += '<div class="team-box" style="background-color:' + team.bg + ';border:3px solid ' + team.border + '">';
            html += '<div class="team-box-header">' + escapeHtml(team.name) + '</div><div class="team-box-players">';
            if (team.players && team.players.length > 0) {
                for (let j = 0; j < team.players.length; j++) {
                    html += '<div class="team-player-item">' + escapeHtml(team.players[j]) + '</div>';
                }
            } else {
                html += '<div style="color:rgba(255,255,255,0.5);font-style:italic;padding:10px;font-size:12px">Esperando jugadores...</div>';
            }
            html += '</div></div>';
        }
        pList.innerHTML = _tHtml(html);
    }

    return {
        mostrarSeleccionModo: mostrarSeleccionModo,
        configurarModoIndividual: configurarModoIndividual,
        mostrarConfiguracionEquipos: mostrarConfiguracionEquipos,
        seleccionarNumEquipos: seleccionarNumEquipos,
        confirmarEquipos: confirmarEquipos,
        renderTeamLobby: renderTeamLobby
    };
})();
