/**
 * @fileoverview Gestión de equipos del jugador
 * Selección de equipos y configuración de colores
 */

import { socket } from './player-socket-config.js?v=20260922172926';
import {
    getPin, getSessionId, getNickname,
    getTeamMode, setSelectedTeam
} from './player-state.js?v=20260922172926';

// ===== COLORES DE EQUIPOS =====

const TEAM_COLORS = {
    red: 'team-red',
    blue: 'team-blue',
    green: 'team-green',
    yellow: 'team-yellow',
    purple: 'team-purple',
    pink: 'team-pink',
    orange: 'team-orange',
    cyan: 'team-cyan',
    lime: 'team-lime'
};

// ===== FUNCIONES DE EQUIPOS =====

/**
 * Mostrar selector de equipos
 */
export function mostrarSeleccionEquipo() {
    const teamMode = getTeamMode();
    if (!teamMode || !teamMode.teams) return;

    const teamsHTML = teamMode.teams.map((team, index) => `
        <button data-player-action="select-team" data-team-index="${index}" 
                id="team-btn-${index}"
                class="team-button ${TEAM_COLORS[team.color] || 'team-purple'}">
            <span class="team-name">${team.name.toUpperCase()}</span>
            <div class="team-players-count">
                ${team.players.length > 0 ?
        `${team.players.length} ${team.players.length === 1 ? 'jugador' : 'jugadores'}` :
        _t('player.team.no_players', null, 'Sin jugadores aún')}
            </div>
        </button>
    `).join('');

    document.getElementById('main-container').innerHTML = _tHtml(`
        <div class="team-selection-container">
            <h2>¡HOLA, ${getNickname()}!</h2>
            <p class="subtitle">ELIGE TU EQUIPO</p>
            <div class="team-grid">
                ${teamsHTML}
            </div>
        </div>
    `);
}

/**
 * Seleccionar equipo
 */
export function seleccionarEquipo(teamIndex) {
    const teamMode = getTeamMode();
    if (!teamMode || !teamMode.teams[teamIndex]) return;

    setSelectedTeam(teamIndex);
    const team = teamMode.teams[teamIndex];

    console.log(`👥 Seleccionando equipo: ${team.name}`);

    // Guardar en localStorage para reconexiones
    localStorage.setItem('xiro_lastTeamIndex', teamIndex);
    localStorage.setItem('xiro_lastTeamName', team.name);
    console.log(`💾 Equipo guardado en localStorage: ${teamIndex} (${team.name})`);

    // Notificar al servidor
    socket.emit('select-team', {
        pin: getPin(),
        sessionId: getSessionId(),
        nickname: getNickname(),
        teamIndex: teamIndex
    });

    // Mostrar confirmación
    document.getElementById('main-container').innerHTML = _tHtml(`
        <div class="team-confirmation-container">
            <div class="success-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <h2>¡BIENVENIDO AL EQUIPO!</h2>
            <div class="team-info-box">
                <p class="team-info-label">Ahora eres parte de</p>
                <h3 class="team-info-name">${team.name.toUpperCase()}</h3>
            </div>
            <p class="waiting-text">${_t('player.team.waiting_start', null, 'Esperando a que el presentador inicie el juego...')}</p>
            <button data-player-action="salir-lobby" class="btn-danger">
                🚪 SALIR DEL JUEGO
            </button>
        </div>
    `);
}

/**
 * Registrar eventos de equipos
 */
export function registerTeamEvents() {
    // ===== TEAM UPDATE =====
    socket.on('team-update', (data) => {
        console.log('👥 team-update recibido:', data);

        const teamMode = getTeamMode();
        if (teamMode && teamMode.teams) {
            // Actualizar configuración de equipos
            teamMode.teams = data.teams;

            // CRÍTICO: No actualizar UI si estamos en pantalla de confirmación (evitar race condition)
            const mainContainer = document.getElementById('main-container');
            const inConfirmationScreen = mainContainer?.querySelector('.team-confirmation-container');

            if (inConfirmationScreen) {
                // Ya estamos en confirmación, no sobrescribir
                console.log('👥 En pantalla de confirmación, ignorando team-update UI');
                return;
            }

            // Si el jugador ya está en un equipo, actualizar UI
            const playerNick = getNickname();
            if (playerNick) {
                const playerTeam = data.teams.find(t => t.players.some(p => p.nickname === playerNick));
                if (playerTeam) {
                    // Jugador en equipo pero no en pantalla de confirmación → mostrar confirmación
                    console.log('👥 Jugador en equipo, actualizando UI');
                } else {
                    // Si no está en ningún equipo, mostrar selección
                    mostrarSeleccionEquipo();
                }
            }
        }
    });
}
