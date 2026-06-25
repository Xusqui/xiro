/**
 * @fileoverview Admin Disconnect Service - Desconexión forzada de jugadores
 * @module services/AdminDisconnectService
 * 
 * Responsabilidades:
 * - Desconectar jugador específico por nickname
 * - Desconectar todos los jugadores de una sala
 * - Validar permisos y existencia de sala/jugador
 * 
 * Reemplaza: disconnect-helper.js (script manual)
 */

const logger = require('../config/logger');

class AdminDisconnectService {
    constructor(io) {
        this.io = io;
    }

    /**
     * Desconectar un jugador específico de una sala
     * 
     * @param {string} pin - PIN de la sala
     * @param {string} nickname - Nickname del jugador
     * @returns {Promise<Object>} Resultado de la operación
     */
    async disconnectPlayer(pin, nickname) {
        try {
            // Obtener todos los sockets de la sala de jugadores
            const playersRoom = `${pin}:players`;
            const sockets = await this.io.in(playersRoom).fetchSockets();

            if (sockets.length === 0) {
                return {
                    success: false,
                    error: 'No players found in room',
                    code: 'NO_PLAYERS_IN_ROOM',
                    pin,
                    nickname
                };
            }

            // Buscar jugador por nickname
            const targetSocket = sockets.find(socket =>
                socket.data?.nickname?.toLowerCase() === nickname.toLowerCase()
            );

            if (!targetSocket) {
                return {
                    success: false,
                    error: 'Player not found',
                    code: 'PLAYER_NOT_FOUND',
                    pin,
                    nickname,
                    availablePlayers: sockets
                        .map(s => s.data?.nickname)
                        .filter(Boolean)
                };
            }

            // Desconectar socket
            logger.warn('Admin force disconnect player', {
                pin,
                nickname,
                socketId: targetSocket.id
            });

            targetSocket.disconnect(true);

            return {
                success: true,
                message: 'Player disconnected successfully',
                code: 'PLAYER_DISCONNECTED',
                pin,
                nickname,
                socketId: targetSocket.id
            };
        } catch (error) {
            logger.error('Error disconnecting player', {
                pin,
                nickname,
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                pin,
                nickname
            };
        }
    }

    /**
     * Desconectar todos los jugadores de una sala
     * 
     * @param {string} pin - PIN de la sala
     * @returns {Promise<Object>} Resultado de la operación
     */
    async disconnectAll(pin) {
        try {
            const playersRoom = `${pin}:players`;
            const sockets = await this.io.in(playersRoom).fetchSockets();

            if (sockets.length === 0) {
                return {
                    success: false,
                    error: 'No players found in room',
                    code: 'NO_PLAYERS_IN_ROOM',
                    pin
                };
            }

            const disconnected = [];

            // Desconectar todos
            for (const socket of sockets) {
                disconnected.push({
                    nickname: socket.data?.nickname || 'unknown',
                    socketId: socket.id
                });
                socket.disconnect(true);
            }

            logger.warn('Admin force disconnect all players', {
                pin,
                count: disconnected.length
            });

            return {
                success: true,
                message: `${disconnected.length} players disconnected`,
                code: 'PLAYERS_DISCONNECTED',
                params: { count: disconnected.length },
                pin,
                disconnected
            };
        } catch (error) {
            logger.error('Error disconnecting all players', {
                pin,
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                pin
            };
        }
    }

    /**
     * Obtener lista de jugadores conectados en una sala
     * 
     * @param {string} pin - PIN de la sala
     * @returns {Promise<Object>} Lista de jugadores
     */
    async getConnectedPlayers(pin) {
        try {
            const playersRoom = `${pin}:players`;
            const sockets = await this.io.in(playersRoom).fetchSockets();

            const players = sockets.map(socket => ({
                nickname: socket.data?.nickname || 'unknown',
                socketId: socket.id,
                connected: socket.connected
            }));

            return {
                success: true,
                pin,
                count: players.length,
                players
            };
        } catch (error) {
            logger.error('Error getting connected players', {
                pin,
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                pin
            };
        }
    }
}

module.exports = AdminDisconnectService;
