/**
 * @fileoverview Cierre anticipado de «Nube de palabras»: si todos los jugadores conectados han
 * terminado (agotaron su cupo o pulsaron Enviar con menos palabras), se para el cronómetro y se revela, como el "todos respondieron" del resto de
 * tipos. El cierre manual del presentador sigue disponible siempre. Un fallo aquí nunca rompe el
 * envío de la palabra: se registra y la pregunta sigue abierta hasta que acabe el tiempo.
 * @module sockets/utils/WordCloudEarlyClose
 */

'use strict';

const logger = require('../../config/logger');
const { getRedisClient } = require('../../config/redis');
const { fetchActivePlayers } = require('./IndividualModeHelper');
const { acquireRevealLock } = require('./AtomicAnswerCounter');
const { revealAnswer, endGameIfLastQuestion } = require('./GameEndManager');
const { playerWordsKey, finishedKey } = require('./WordCloudSubmissions');

/**
 * @param {Object} options
 * @param {string} options.sPin - Sesión
 * @param {string|number} options.questionIndex - Pregunta
 * @param {string[]} options.activePlayers - Jugadores conectados
 * @param {number} options.maxWords - Cupo por jugador
 * @returns {Promise<boolean>} true si todos terminaron: cupo agotado o ya pulsaron Enviar
 */
async function everyoneExhaustedQuota({ sPin, questionIndex, activePlayers, maxWords }) {
    const client = await getRedisClient();
    const done = await Promise.all(
        activePlayers.map(async nickname => {
            const used = await client.sCard(playerWordsKey(sPin, questionIndex, nickname));
            if (Number(used) >= maxWords) return true;
            return Number(await client.exists(finishedKey(sPin, questionIndex, nickname))) === 1;
        })
    );
    return done.every(Boolean);
}

/**
 * Cierra la pregunta si todos los jugadores conectados agotaron su cupo.
 * @param {Object} options
 * @param {Object} options.io - Servidor Socket.IO
 * @param {Object} options.game - Partida activa
 * @param {string} options.sPin - Sesión
 * @param {string|number} options.questionIndex - Pregunta
 * @param {number} options.maxWords - Cupo por jugador
 * @param {Function} options.clearGameTimer - Para el cronómetro de la sesión
 * @returns {Promise<boolean>} true si esta llamada reveló la pregunta
 */
async function closeWhenQuotaExhausted({ io, game, sPin, questionIndex, maxWords, clearGameTimer }) {
    if (!game?.canAnswer) return false;
    try {
        const { activePlayers } = await fetchActivePlayers(io, sPin);
        if (activePlayers.length === 0) return false;
        if (!(await everyoneExhaustedQuota({ sPin, questionIndex, activePlayers, maxWords }))) return false;
        // Solo un worker revela: el cerrojo evita el doble revelado si dos jugadores terminan a la vez
        if (!(await acquireRevealLock({ roomId: sPin, questionIndex }))) return false;
        clearGameTimer(sPin);
        await revealAnswer({ roomId: sPin, game, io, timeExpired: false });
        await endGameIfLastQuestion({ game, roomId: sPin, io });
        return true;
    } catch (error) {
        logger.error('Nube de palabras: no se pudo comprobar el cierre anticipado', {
            roomId: sPin,
            error: error.message
        });
        return false;
    }
}

module.exports = { closeWhenQuotaExhausted };
