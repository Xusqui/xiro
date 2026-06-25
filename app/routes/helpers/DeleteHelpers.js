/**
 * @fileoverview Helpers para operaciones de eliminación
 * Centraliza lógica de verificación de uso antes de borrar
 */

const dbService = require('../../services/db.service');

/**
 * Mapeo de tipos de entidad a etiquetas en mensajes de error
 */
const ENTITY_LABELS = {
    bank: 'este banco',
    game: 'esta mezcla',
    custom_game: 'este juego personalizado'
};

/**
 * Middleware que verifica si una entidad está en uso antes de permitir su eliminación
 * Si está en uso, rechaza la petición con error 409 Conflict
 * @param {string} entityType - Tipo de entidad ('bank', 'game', 'custom_game')
 * @returns {Function} Middleware de Express
 */
function checkUsageBeforeDelete(entityType) {
    return async (req, res, next) => {
        try {
            const entityId = req.params.id;
            const used = await dbService.checkTrivialUsage(entityType, entityId);

            if (used.length) {
                const label = ENTITY_LABELS[entityType] || 'este elemento';
                const gameNames = used.map(g => g.name).join('", "');

                return res.status(409).json({
                    error: `No se puede eliminar: ${label} está en uso en el Trivial "${gameNames}"`,
                    code: 'RESOURCE_IN_USE_BY_TRIVIAL',
                    params: { entityType, gameNames }
                });
            }

            // No está en uso, continuar con eliminación
            next();
        } catch (err) {
            // Si falla la verificación, pasar al handler de errores
            next(err);
        }
    };
}

module.exports = {
    checkUsageBeforeDelete,
    ENTITY_LABELS
};
