/**
 * @fileoverview Command Execution Handler - Ejecuta un comando CQRS
 * @module application/chain/CommandExecutionHandler
 */

const Handler = require('./Handler');
const logger = require('../../config/logger');

class CommandExecutionHandler extends Handler {
    /**
     * @param {Class} CommandClass - Clase del comando a ejecutar
     * @param {Function} payloadMapper - Función para mapear datos a payload del comando
     */
    constructor(CommandClass, payloadMapper) {
        super();
        this.CommandClass = CommandClass;
        this.payloadMapper = payloadMapper;
    }

    async handle(context) {
        const payload = this.payloadMapper
            ? this.payloadMapper(context)
            : context.validatedData;

        logger.debug('CommandExecutionHandler executing', {
            commandName: this.CommandClass.name,
            answerType: payload?.answerType,
            hasSelectedIndices: Array.isArray(payload?.selectedIndices),
            selectedIndicesLength: payload?.selectedIndices?.length
        });

        const command = new this.CommandClass(payload);
        const result = await command.execute(context.dependencies);

        logger.debug('CommandExecutionHandler result', {
            commandName: this.CommandClass.name,
            success: result?.success,
            reason: result?.reason
        });

        // Añadir resultado al contexto
        context.commandResult = result;

        // SIEMPRE continuar la cadena para que ResponseHandler pueda llamar el callback
        // incluso si el comando falló
        return super.handle(context);
    }
}

module.exports = CommandExecutionHandler;
