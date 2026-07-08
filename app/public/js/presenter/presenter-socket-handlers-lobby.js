/**
 * @fileoverview Socket handlers del presentador - Parte 1
 * Manejo de lobby, jugadores y equipos
 */

import { getSocket } from './presenter-socket-config.js?v=20260708162526';
import {
    getSessionId, setSessionId, getTotalPlayers, setTotalPlayers,
    getConnectedPlayers, addConnectedPlayer, removeConnectedPlayer,
    getPlayersData, setPlayerData, deletePlayerData,
    getTeamConfig, setTeamConfig, getIsTeamMode
} from './presenter-state.js?v=20260708162526';
import { mostrarQR, renderTeamLobby, updatePlayersPanel } from './presenter-game-ui.js?v=20260708162526';
import { updateAnswerCounter } from './presenter-answer-counter.js?v=20260708162526';
import { volverAJuegos } from './presenter-lobby.js?v=20260708162526';
import { mostrarLobbyMain } from './presenter-utils.js?v=20260708162526';
import { handlePlayerRejoined } from './presenter-player-rejoined-handler.js?v=20260708162526';
import { handleGameAbandoned } from './presenter-session-control.js?v=20260708162526';
import { mostrarModalMensaje } from '../shared/modal.js?v=20260708162526';

/**
 * Registrar manejadores de socket para lobby y jugadores
 */
export function registerLobbySocketHandlers() {
    const socket = getSocket();

    // Error al unirse al lobby
    socket.on('join-error', (data) => {
        console.error('❌ join-error recibido del servidor:', data);
        window._xiroReconnectJoinFallbackTried = false;
        window._xiroFreshJoinPending = false;
        window._xiroPendingLobbyData = null;
        mostrarModalMensaje(
            _t('presenter.session.error_title', null, 'Error del presentador'),
            data.message || data.reason || _t('presenter.session.error_unknown', null, 'Error desconocido'),
            'error'
        );

        if (data.reason === 'invalid-pin' || data.reason === 'server-error') {
            mostrarLobbyMain(`
                <div class="h-full w-full flex flex-col items-center justify-center p-10">
                    <i class="fas fa-exclamation-triangle text-red-500 text-8xl mb-6"></i>
                    <h1 class="text-4xl font-black text-white mb-4">${_t('presenter.session.lobby_error_title', null, 'Error al Crear Lobby')}</h1>
                    <p class="text-slate-400 mb-2 text-xl">${data.message || _t('presenter.session.lobby_error_msg', null, 'No se pudo crear el lobby')}</p>
                    <button data-presenter-action="volver-juegos" class="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-full text-white font-bold uppercase transition shadow-lg">
                        <i class="fas fa-list mr-2"></i>${_t('presenter.selector.actions.show_games', null, 'Volver a juegos')}
                    </button>
                </div>
            `);
        }
    });

    // Confirmación exitosa de join
    socket.on('join-success', (data) => {
        console.log('✅ join-success recibido del servidor:', data);
        console.log('✅ Lobby creado correctamente - Esperando jugadores...');

        window._xiroReconnectJoinFallbackTried = false;
        window._xiroFreshJoinPending = false;
        window._xiroPendingLobbyData = null;

        if (typeof data.sessionSecret === 'string' && data.sessionSecret.length > 0) {
            sessionStorage.setItem('xiro_presenter_sessionSecret', data.sessionSecret);
            localStorage.setItem('xiro_presenter_sessionSecret', data.sessionSecret);
        }

        // Sincronizar sessionId con el roomId que el servidor asignó
        if (data.roomId && data.roomId !== getSessionId()) {
            console.warn('⚠️ sessionId local difiere del servidor. Actualizando...', {
                local: getSessionId(),
                servidor: data.roomId
            });
            setSessionId(data.roomId);
            document.getElementById('display-pin').innerText = _t(data.roomId);
            mostrarQR(data.roomId);
        }

        // Si el servidor devuelve asignaciones de equipos más recientes, usarlas.
        // Esto cubre el caso en que el presentador carga una partida ya en curso donde
        // los jugadores ya seleccionaron equipo pero el teamConfig local (de URL) tiene
        // players: [] vacíos, provocando que los colores no aparezcan hasta el próximo team-update.
        if (getIsTeamMode() && data.teamMode && Array.isArray(data.teamMode.teams)) {
            const serverTeams = data.teamMode.teams;
            const hasAssignments = serverTeams.some(t => Array.isArray(t.players) && t.players.length > 0);
            if (hasAssignments) {
                const currentConfig = getTeamConfig() || {};
                setTeamConfig({ ...currentConfig, teams: serverTeams });
            }
        }

        // Asegurar que se muestren los equipos desde el inicio
        if (getIsTeamMode() && getTeamConfig()) {
            renderTeamLobby();
            updatePlayersPanel();
        }
    });

    // Jugador se unió
    socket.on('player-joined', (data) => {
        console.log('🎯 player-joined event received:', data);

        const nick = typeof data === 'string' ? data : data.nickname || data;
        if (nick === 'HOST') return;

        const playersData = getPlayersData();
        const connectedPlayers = getConnectedPlayers();
        const alreadyKnown = playersData[nick] !== undefined || connectedPlayers.includes(nick);

        const existingCard = document.querySelector(`[data-nickname="${nick}"]`);

        if (existingCard) {
            // Ya existe, restaurar apariencia
            console.log(`🔄 ${nick} ya tiene tarjeta, restaurando apariencia`);
            existingCard.classList.remove('opacity-50', 'grayscale');
            const indicator = existingCard.querySelector('.disconnected-indicator');
            if (indicator) indicator.remove();
            existingCard.classList.add('animate-pulse');
            setTimeout(() => existingCard.classList.remove('animate-pulse'), 2000);
        } else {
            // No existe, crear nueva
            if (!alreadyKnown) {
                setTotalPlayers(getTotalPlayers() + 1);
                document.getElementById('p-count').innerText = _t(getTotalPlayers());
            }

            if (getIsTeamMode() && getTeamConfig()) {
                console.log(`👥 ${nick} unido en modo equipos`);
                renderTeamLobby();
            } else {
                // Modo individual
                const playerDiv = document.createElement('div');
                playerDiv.className = 'bg-white text-slate-900 p-3 rounded-xl font-black text-center animate-bounce uppercase italic text-sm';
                playerDiv.setAttribute('data-nickname', nick);
                playerDiv.textContent = _t(nick);
                document.getElementById('p-list').appendChild(playerDiv);
            }
        }

        // Agregar a la lista de jugadores conectados
        if (!connectedPlayers.includes(nick)) {
            addConnectedPlayer(nick);
            if (!playersData[nick]) {
                setPlayerData(nick, { score: 0, answered: false, correct: null });
            }
        }
        updatePlayersPanel();

        if (getTotalPlayers() > 0) {
            const btn = document.getElementById('btn-empezar');
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '';
                btn.style.cursor = '';
            }
        }
    });

    // Jugador reconectado
    socket.on('player-rejoined', (data) => {
        const nick = typeof data === 'string' ? data : data.nickname || data;
        handlePlayerRejoined(nick);
    });

    socket.on('game-abandoned', (data) => {
        handleGameAbandoned(data);
    });

    // Jugador se fue
    socket.on('player-left', (data) => {
        const nick = typeof data === 'string' ? data : data.nickname || data;
        if (nick === 'HOST') return;

        removeConnectedPlayer(nick);
        deletePlayerData(nick);
        updatePlayersPanel();
        updateAnswerCounter();

        const playerElements = document.querySelectorAll('[data-nickname]');
        playerElements.forEach(elem => {
            if (elem.getAttribute('data-nickname') === nick) {
                elem.remove();
                setTotalPlayers(getTotalPlayers() - 1);
                document.getElementById('p-count').innerText = _t(getTotalPlayers());
            }
        });

        if (getTotalPlayers() === 0) {
            const btn = document.getElementById('btn-empezar');
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        }
    });

    // Actualización de equipos
    socket.on('team-update', (data) => {
        const currentTeamConfig = getTeamConfig();
        if (!currentTeamConfig || !getIsTeamMode()) return;

        // CRÍTICO: Preservar isTeamMode y solo actualizar teams
        setTeamConfig({
            isTeamMode: currentTeamConfig.isTeamMode,
            teams: data.teams
        });

        console.log('🔄 Actualización de equipos recibida:', getTeamConfig());

        if (document.getElementById('p-list')) {
            renderTeamLobby();
        }
        updatePlayersPanel();
    });
}
