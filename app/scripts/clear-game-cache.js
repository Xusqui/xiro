#!/usr/bin/env node
/**
 * Script para limpiar toda la caché de juegos
 * Uso: node clear-game-cache.js
 */

const { questionBankCache, fileCacheService } = require('../services/cache.service');
const logger = require('../config/logger');

function clearGameCache() {
    try {
        logger.info('Limpiando cache de juegos...');

        // Limpiar caché de bancos de preguntas y juegos completos
        const statsBeforeQuestions = questionBankCache.getStats();
        logger.info(`Estado antes - Bancos/Juegos en cache: ${statsBeforeQuestions.size}`);

        questionBankCache.invalidateAll();
        logger.info('Cache de bancos de preguntas y juegos limpiada');

        // Limpiar caché de archivos estáticos
        const statsBeforeFiles = fileCacheService.getStats();
        logger.info(`Estado antes - Archivos en cache: ${statsBeforeFiles.size}`);

        fileCacheService.clearAll();
        logger.info('Cache de archivos estaticos limpiada');

        logger.info('Cache de juegos completamente limpiada');

        // Mostrar estadísticas finales
        const statsAfterQuestions = questionBankCache.getStats();
        const statsAfterFiles = fileCacheService.getStats();
        logger.info('Estadisticas finales:');
        logger.info(`- Bancos/Juegos: ${statsAfterQuestions.size} items`);
        logger.info(`- Archivos: ${statsAfterFiles.size} items`);

        process.exit(0);
    } catch (error) {
        logger.error('Error limpiando cache:', error.message);
        logger.error('Error clearing game cache', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

// Ejecutar
clearGameCache();
