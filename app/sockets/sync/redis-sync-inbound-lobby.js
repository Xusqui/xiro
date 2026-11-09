/**
 * @fileoverview Handlers de mensajes Redis entrantes sobre lobby, equipos, sesión y jugadores.
 * Son métodos de RedisSyncBus (usan this.state y this.io): RedisSyncBus.js los añade a su prototipo.
 */

const logger = require('../../config/logger');
const { addPlayerToLobby } = require('../utils/LobbyPlayerSync');
const { applyTeamMembership, emitLocalTeamUpdate } = require('../utils/TeamMembershipSync');
const { clearGameTimer, timerPausedState, roomPresenterMap } = require('../../state/globalState');
const { parseRedisMessage, toSetOrEmpty } = require('./redis-sync-payloads');

module.exports = {
    /**
     * `team-membership-sync`: aplica el cambio de equipo de un jugador a la copia local y avisa a los clientes de este
     * worker. Ignora los mensajes de este mismo worker.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handleTeamMembershipSync(message) {
        const data = parseRedisMessage(message, 'team-membership-sync');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const teamConfig = this.state.teamConfigs.get(data.roomId);
        if (!applyTeamMembership(teamConfig, data)) {
            return;
        }

        emitLocalTeamUpdate(this.io, data.roomId, teamConfig);
        logger.debug(`Equipo de ${data.nickname} actualizado en ${data.roomId} (desde worker ${data.originWorkerId})`);
    },

    /**
     * `lobby-player-joined`: añade el jugador al lobby local si no estaba. Ignora los mensajes de este mismo worker.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handleLobbyPlayerJoined(message) {
        const data = parseRedisMessage(message, 'lobby-player-joined');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const added = addPlayerToLobby(this.state.lobbyPlayers, data.roomId, data.nickname);
        if (added) {
            logger.debug(
                `Jugador ${data.nickname} añadido al lobby ${data.roomId} (desde worker ${data.originWorkerId})`
            );
        }
    },

    /**
     * `lobby-player-left`: quita el jugador del lobby local. Ignora los mensajes de este mismo worker.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handleLobbyPlayerLeft(message) {
        const data = parseRedisMessage(message, 'lobby-player-left');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const lobby = this.state.lobbyPlayers.get(data.roomId);
        if (!lobby) {
            return;
        }

        const idx = lobby.indexOf(data.nickname);
        if (idx === -1) {
            return;
        }

        lobby.splice(idx, 1);
        logger.debug(
            `Jugador ${data.nickname} eliminado del lobby ${data.roomId} (desde worker ${data.originWorkerId})`
        );
    },

    /**
     * `session-abandoned`: borra la sesión de los Maps locales (partida, lobby, equipos, presentador, jugadores) y
     * cancela su temporizador. Ignora los mensajes de este mismo worker.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handleSessionAbandonedSync(message) {
        const data = parseRedisMessage(message, 'session-abandoned');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const { roomId } = data;
        const { activeGames, lobbyPlayers, teamConfigs, players } = this.state;
        activeGames.delete(roomId);
        lobbyPlayers.delete(roomId);
        teamConfigs.delete(roomId);
        roomPresenterMap.delete(roomId);

        for (const [playerId, player] of players.entries()) {
            if (player.roomId === roomId) {
                players.delete(playerId);
            }
        }

        try {
            clearGameTimer(roomId);
            if (timerPausedState) {
                timerPausedState.delete(roomId);
            }
        } catch (err) {
            logger.warn('Failed to clear timers for abandoned session', { roomId, error: err.message });
        }
    },

    /**
     * `player-data-sync`: guarda los datos del jugador si son nuevos o más recientes (`lastSeen`) que los locales.
     * Ignora los mensajes de este mismo worker.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handlePlayerDataSync(message) {
        const data = parseRedisMessage(message, 'player-data-sync');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const { playerId, playerData, originWorkerId } = data;
        const normalizedPlayer = { ...playerData, answeredQuestions: toSetOrEmpty(playerData.answeredQuestions) };

        const existing = this.state.players.get(playerId);
        if (!existing || (normalizedPlayer.lastSeen && normalizedPlayer.lastSeen >= (existing.lastSeen || 0))) {
            this.state.players.set(playerId, normalizedPlayer);
            logger.debug(
                `Player data synced: ${normalizedPlayer.nickname} (playerId: ${playerId}, from worker ${originWorkerId})`
            );
        }
    },

    /**
     * `player-disconnected-sync`: marca al jugador como desconectado, salvo que la copia local ya lo esté. Ignora los
     * mensajes de este mismo worker.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handlePlayerDisconnectedSync(message) {
        const data = parseRedisMessage(message, 'player-disconnected-sync');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const { playerId, playerData, originWorkerId } = data;
        const existingPlayer = this.state.players.get(playerId);
        const canOverwrite =
            !existingPlayer ||
            (existingPlayer.status !== 'disconnected' && existingPlayer.status !== 'presenter_disconnected');

        if (!canOverwrite) {
            return;
        }

        const normalizedPlayer = { ...playerData, answeredQuestions: toSetOrEmpty(playerData.answeredQuestions) };
        const mergedPlayer = existingPlayer ? { ...existingPlayer, ...normalizedPlayer } : normalizedPlayer;

        this.state.players.set(playerId, mergedPlayer);
        logger.debug(
            `${mergedPlayer.nickname} marcado como ${mergedPlayer.status} (playerId: ${playerId}, desde worker ${originWorkerId})`
        );
    }
};
