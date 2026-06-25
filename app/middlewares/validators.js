/**
 * @fileoverview Middlewares de validación reutilizables
 * Evita duplicación de lógica de validación en routes
 */

const dbService = require('../services/db.service');

/**
 * Mapeo de tipos de entidad a etiquetas legibles
 */
const TYPE_LABELS = {
    bank: 'un banco de preguntas',
    game: 'un juego',
    custom_game: 'un juego personalizado',
    quiz: 'un quiz'
};

/**
 * Construye mensaje de error para conflictos de PIN
 * @param {string} pin - PIN que está duplicado
 * @param {string} conflictType - Tipo de entidad donde existe el PIN
 * @returns {string} Mensaje de error formateado
 */
function buildPinConflictMessage(pin, conflictType) {
    const label = TYPE_LABELS[conflictType] || 'otra entidad';
    return `El PIN "${pin}" ya existe en ${label}. Los PINs deben ser únicos en todo el sistema.`;
}

/**
 * Middleware para validar que un PIN sea único globalmente
 * @param {string} entityType - Tipo de entidad ('bank', 'game', 'custom_game', 'quiz')
 * @returns {Function} Middleware de Express
 */
function validateUniquePIN(entityType) {
    return async (req, res, next) => {
        try {
            // Si no hay PIN o la función no está disponible, continuar
            if (!req.body.pin || typeof dbService.pinExistsGlobally !== 'function') {
                return next();
            }

            // Determinar ID a excluir (PUT usa params.id, POST puede usar body.id)
            const excludeId = req.params.id ? parseInt(req.params.id) : req.body.id;

            // Verificar conflictos de PIN
            const pinConflict = await dbService.pinExistsGlobally(req.body.pin, {
                excludeType: entityType,
                excludeId
            });

            if (pinConflict?.exists) {
                return res.status(400).json({
                    error: 'PIN duplicado',
                    message: buildPinConflictMessage(req.body.pin, pinConflict.conflictType),
                    code: 'PIN_DUPLICATE',
                    params: { pin: req.body.pin, conflictType: pinConflict.conflictType }
                });
            }

            next();
        } catch (err) {
            // Si falla la validación, pasar al handler de errores
            next(err);
        }
    };
}

/**
 * Middleware para validar que los bancos de un juego sean únicos
 * Previene que se asocien bancos duplicados a un mismo juego
 * @returns {Function} Middleware de Express
 */
function validateUniqueGameBanks(req, res, next) {
    const bankIds = (req.body.banks || []).map(b => b.bank_id);

    if (new Set(bankIds).size !== bankIds.length) {
        return res.status(400).json({
            error: 'Bancos repetidos',
            message: 'Tienes bancos repetidos. Los bancos de preguntas deben de ser únicos',
            code: 'DUPLICATE_BANKS_IN_GAME'
        });
    }

    next();
}

module.exports = {
    validateUniquePIN,
    validateUniqueGameBanks,
    buildPinConflictMessage
};
