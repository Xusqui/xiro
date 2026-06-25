/**
 * @fileoverview Response Handler - Envía respuesta al cliente
 * @module application/chain/ResponseHandler
 */

const Handler = require('./Handler');
const logger = require('../../config/logger');

class ResponseHandler extends Handler {
    /**
     * @param {Function} responseMapper - Función para formatear la respuesta
     */
    constructor(responseMapper) {
        super();
        this.responseMapper = responseMapper;
    }

    handle(context) {
        const { socket, commandResult, callback } = context;

        logger.debug('ResponseHandler processing', {
            hasCommandResult: !!commandResult,
            hasCallback: !!callback && typeof callback === 'function',
            success: commandResult?.success,
            reason: commandResult?.reason
        });

        if (!commandResult) {
            // Si no hay resultado del comando, continuar
            return super.handle(context);
        }

        const response = this.responseMapper
            ? this.responseMapper(commandResult, context)
            : commandResult;

        logger.debug('ResponseHandler sending response', {
            hasCallback: !!callback && typeof callback === 'function',
            response
        });

        // Enviar acknowledgment si existe callback
        if (callback && typeof callback === 'function') {
            callback(response);
        }

        // Emitir eventos adicionales si es necesario
        if (!commandResult.success && commandResult.reason && socket) {
            const errorPayload = {
                message: commandResult.message || commandResult.reason
            };
            if (commandResult.code) {
                errorPayload.code = commandResult.code;
                if (commandResult.params) {
                    errorPayload.params = commandResult.params;
                }
            }
            socket.emit('error', errorPayload);
        }

        // Retornar el response mapeado (este es el último handler de la cadena)
        return response;
    }
}

module.exports = ResponseHandler;
