/**
 * @fileoverview Bootstrap de Event Handlers
 * @module domain/events/handlers/bootstrap
 * 
 * Inicializa todos los event handlers del sistema.
 * Se llama durante el startup del servidor.
 */

const EventBus = require('../EventBus');
const logger = require('../../../config/logger');
const { registerAllHandlers, unregisterAllHandlers } = require('./index');

let registeredHandlers = [];

/**
 * Inicializa todos los event handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} dependencies - Dependencias opcionales (db, cache, etc.)
 * @returns {Array} Array de handlers registrados
 */
function initializeEventHandlers(io, dependencies = {}) {
    try {
        logger.info('🎯 Initializing event handlers...');

        // Registrar todos los handlers
        registeredHandlers = registerAllHandlers(EventBus, io, dependencies);

        logger.info(`✅ Event handlers initialized successfully (${registeredHandlers.length} handlers)`);

        return registeredHandlers;
    } catch (error) {
        logger.error('❌ Failed to initialize event handlers', { error: error.message });
        throw error;
    }
}

/**
 * Limpia todos los event handlers (para shutdown)
 */
function cleanupEventHandlers() {
    if (registeredHandlers.length > 0) {
        logger.info('🧹 Cleaning up event handlers...');
        unregisterAllHandlers(registeredHandlers, logger);
        registeredHandlers = [];
        logger.info('✅ Event handlers cleaned up');
    }
}

/**
 * Obtiene handlers registrados
 * @returns {Array} Handlers activos
 */
function getRegisteredHandlers() {
    return registeredHandlers;
}

module.exports = {
    initializeEventHandlers,
    cleanupEventHandlers,
    getRegisteredHandlers
};
