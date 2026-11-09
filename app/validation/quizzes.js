/**
 * @fileoverview Esquemas de los endpoints de cuestionarios legacy (/api/quizzes) y de búsqueda de preguntas.
 * Reexportado desde validation/index.js.
 */

const Joi = require('joi');
const { pinSchema, dbIdSchema, sessionIdSchema } = require('./primitives');

// Rutas que antes no validaban su entrada (REVISION_CALIDAD, fase 2)
const presenterPinParamsSchema = Joi.object({ pin: pinSchema.required() });

const dbIdParamsSchema = Joi.object({ id: dbIdSchema.required() });

const createQuizSchema = Joi.object({
    title: Joi.string().trim().min(1).max(200).required().messages({
        'any.required': 'El título es obligatorio',
        'string.empty': 'El título es obligatorio',
        'string.max': 'El título no puede superar 200 caracteres'
    }),
    pin: pinSchema.allow(null, '').optional()
}).unknown(true);

// Cierre forzoso desde admin: sessionId o PIN suelto, el mismo contrato que roomId en
// los esquemas de socket, para que ninguna sala viva quede fuera del alcance del admin.
const adminSessionIdSchema = Joi.alternatives().try(sessionIdSchema, pinSchema);

const searchQuestionsQuerySchema = Joi.object({
    q: Joi.string().max(200).allow('').optional()
}).unknown(true);

module.exports = {
    presenterPinParamsSchema,
    dbIdParamsSchema,
    createQuizSchema,
    adminSessionIdSchema,
    searchQuestionsQuerySchema
};
