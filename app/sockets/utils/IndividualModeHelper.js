/**
 * @fileoverview Individual Mode Helper - Verificación de respuestas en modo individual
 */

const logger = require('../../config/logger');
const { hasAnswered } = require('../../domain/services/AnswerStateService');

/**
 * Verifica si todos los jugadores respondieron en modo individual
 * @param {Object} game - Estado del juego
 * @param {Map} players - Map global de players (de este worker)
 * @param {Object} io - Socket.io instance para obtener sockets cross-worker
 * @param {Number} currentIndex - Índice de la pregunta actual
 * @returns {Boolean} true si todos respondieron
 */
async function checkAllPlayersAnswered(game, players, io, currentIndex) {
    if (!game || !players || !io || currentIndex === undefined) {
        logger.warn('checkAllPlayersAnswered: Missing parameters', {
            hasGame: !!game,
            hasPlayers: !!players,
            hasIo: !!io,
            currentIndex
        });
        return false;
    }

    // CRÍTICO: Obtener sockets cross-worker para verificar en todos los workers.
    // Hacemos esto PRIMERO para derivar activePlayers de una fuente sincronizada (Redis),
    // evitando que game.players diverja entre workers cuando jugadores se reconectan.
    const roomId = game.sessionId || game.roomId || game.pin;
    logger.debug('Using roomId for socket search:', roomId);

    const allSockets = await io.in(`${roomId}:players`).fetchSockets();
    logger.debug('Sockets found in room:', {
        room: `${roomId}:players`,
        socketsCount: allSockets.length,
        sockets: allSockets.map(s => ({ id: s.id, nickname: s.data?.nickname }))
    });

    // Crear índice de sockets por nickname para O(1) lookup (evita O(n²) con allSockets.find)
    const socketByNickname = new Map();
    for (const s of allSockets) {
        if (s.data?.nickname) socketByNickname.set(s.data.nickname, s);
    }

    // Derivar activePlayers desde los sockets — consistente en TODOS los workers
    // porque fetchSockets() consulta Redis y devuelve el mismo resultado en cualquier worker.
    // Antes: game.players.filter(...) divergía por worker cuando un jugador reconectaba
    // y solo se añadía al worker que procesó la reconexión.
    const activePlayers = [...socketByNickname.keys()].filter(nickname => nickname !== 'HOST');

    logger.debug('checkAllPlayersAnswered INICIO', {
        gamePlayers: game.players,
        activePlayers,
        activePlayersCount: activePlayers.length,
        currentIndex,
        gameRoomId: game.roomId,
        gamePin: game.pin,
        gameSessionId: game.sessionId
    });

    if (activePlayers.length === 0) {
        logger.warn('No active players found in socket room');
        return false;
    }

    // Crear índice de players por nickname+roomId para O(1) lookup
    const playerIndex = new Map();
    for (const player of players.values()) {
        if (player.roomId === roomId || player.roomId === `${roomId}`) {
            playerIndex.set(player.nickname, player);
        }
    }

    logger.debug('Player index size:', playerIndex.size, 'entries:', Array.from(playerIndex.keys()));

    // Verificar que cada jugador activo haya respondido usando player.answers

    const answeredPlayers = [];
    const notAnsweredPlayers = [];

    activePlayers.forEach(nickname => {
        const localPlayer = playerIndex.get(nickname);
        const playerSocket = socketByNickname.get(nickname);

        if (localPlayer) {
            logger.debug('Player found in playerIndex:', {
                nickname,
                answers: localPlayer.answers
            });
        }

        if (playerSocket?.data) {
            logger.debug('Player found in socket.data:', {
                nickname,
                answers: playerSocket.data.answers
            });
        }

        if (!localPlayer && !playerSocket?.data) {
            // Player has no socket and no local data — they are disconnected.
            // Disconnected players cannot answer, so exclude them from both lists
            // to avoid permanently blocking the "all answered" threshold.
            logger.warn('Player not found in playerIndex nor sockets (disconnected) - skipping:', nickname);
            return;
        }

        const answeredInLocal = hasAnswered(localPlayer?.answers, currentIndex);
        const answeredInSocket = hasAnswered(playerSocket?.data?.answers, currentIndex);
        const answered = answeredInLocal || answeredInSocket;

        logger.info('Player answer status:', {
            nickname,
            currentIndex,
            answered,
            answeredInLocal,
            answeredInSocket,
            playerAnswers: localPlayer?.answers,
            socketAnswers: playerSocket?.data?.answers
        });

        if (answered) {
            answeredPlayers.push(nickname);
        } else {
            notAnsweredPlayers.push(nickname);
        }
    });

    const answeredCount = answeredPlayers.length;
    const connectedCount = answeredPlayers.length + notAnsweredPlayers.length;

    logger.info(`Modo individual - Respondieron ${answeredCount}/${connectedCount} jugadores conectados (de ${activePlayers.length} activos)`, {
        answeredPlayers,
        notAnsweredPlayers,
        allAnswered: notAnsweredPlayers.length === 0
    });

    return notAnsweredPlayers.length === 0;
}

module.exports = {
    checkAllPlayersAnswered
};
