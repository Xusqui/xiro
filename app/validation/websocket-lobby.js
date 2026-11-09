/**
 * @fileoverview Esquemas de eventos de socket del lobby (unirse, reconectar, equipos, respuestas y puntos).
 * Reexportado desde validation/index.js.
 */

const Joi = require('joi');
const { LIMITS, pinSchema, sessionIdSchema, nicknameSchema, uuidSchema, teamNameSchema } = require('./primitives');

// Join lobby
const joinLobbySchema = Joi.object({
    pin: pinSchema.optional(), // PIN original (para validación en DB)
    sessionId: sessionIdSchema.optional(), // ID de sesión único (PIN-XXXX)
    nickname: nicknameSchema.required(),
    playerId: uuidSchema.required(),
    // Avatar elegido al unirse (id del catálogo; AvatarsFeature comprueba que esté activo)
    avatar: Joi.string()
        .max(32)
        .pattern(/^[a-z0-9-]+$/)
        .allow(null, '')
        .optional(),
    // Optional for presenter reclaim hardening. When present, it is checked
    // server-side against the stored presenter secret.
    sessionSecret: Joi.string().allow('').optional(),
    isTeamMode: Joi.boolean().optional(), // Modo equipos (solo para HOST)
    teamConfig: Joi.object({
        teams: Joi.array()
            .items(
                Joi.object({
                    name: teamNameSchema.required(),
                    color: Joi.string().required()
                })
            )
            .required()
    }).optional() // Configuración de equipos (solo para HOST)
})
    .or('pin', 'sessionId') // Al menos uno debe estar presente
    .messages({
        'object.missing': 'Se requiere pin o sessionId'
    });

// Join presenter lobby (flujo separado; token de panel opcional para metadata)
const joinPresenterLobbySchema = Joi.object({
    pin: pinSchema.optional(),
    sessionId: sessionIdSchema.optional(),
    playerId: uuidSchema.required(),
    token: Joi.string().allow('').optional(),
    sessionSecret: Joi.string().allow('').optional(),
    isTeamMode: Joi.boolean().optional(),
    teamConfig: Joi.object({
        teams: Joi.array()
            .items(
                Joi.object({
                    name: teamNameSchema.required(),
                    color: Joi.string().required()
                })
            )
            .required()
    }).optional()
})
    .or('pin', 'sessionId')
    .messages({
        'object.missing': 'Se requiere pin o sessionId'
    });

// Reconnect player
// A-03 hardening: reconnect requires explicit sessionSecret in all cases.
const reconnectPlayerSchema = Joi.object({
    playerId: uuidSchema.required(),
    sessionSecret: Joi.string().trim().min(1).required().messages({
        'string.empty': 'Se requiere sessionSecret para reconectar',
        'any.required': 'Se requiere sessionSecret para reconectar'
    })
});

/** Opciones marcadas en selección múltiple / encuesta de selección múltiple (sin repetir). */
function selectedIndicesSchema(minSelected) {
    return Joi.array()
        .items(
            Joi.number()
                .integer()
                .min(0)
                .max(LIMITS.MAX_OPTIONS - 1)
        )
        .min(minSelected)
        .max(LIMITS.MAX_OPTIONS)
        .unique()
        .optional()
        .messages({
            'array.unique': 'Opción repetida',
            'array.min': 'Debe seleccionar al menos 1 opción',
            'array.max': 'No puede seleccionar más de 6 opciones'
        });
}

// Submit answer
const submitAnswerSchema = Joi.object({
    pin: pinSchema.optional(),
    sessionId: sessionIdSchema.optional(),
    nickname: nicknameSchema.required(),
    answerType: Joi.string().valid('order', 'multiple_choice', 'survey_multiple').optional(),
    index: Joi.number()
        .integer()
        .min(0)
        .max(LIMITS.MAX_OPTIONS - 1)
        .optional()
        .messages({
            'number.min': 'Índice de respuesta inválido',
            'number.max': 'Índice de respuesta inválido'
        }),
    order: Joi.array()
        .items(
            Joi.number()
                .integer()
                .min(0)
                .max(LIMITS.MAX_OPTIONS - 1)
        )
        .min(LIMITS.MIN_OPTIONS)
        .max(LIMITS.MAX_OPTIONS)
        .optional()
        .messages({
            'array.min': `Debe haber al menos ${LIMITS.MIN_OPTIONS} opciones`,
            'array.max': `No puede haber más de ${LIMITS.MAX_OPTIONS} opciones`
        }),
    // La encuesta de selección múltiple admite enviar sin marcar ninguna
    selectedIndices: Joi.when('answerType', {
        is: 'survey_multiple',
        then: selectedIndicesSchema(0),
        otherwise: selectedIndicesSchema(1)
    })
}).or('pin', 'sessionId');

// Manual points (soporta nickname único o array de nicknames para equipos)
const manualPointsSchema = Joi.object({
    pin: pinSchema.optional(),
    sessionId: sessionIdSchema.optional(),
    nickname: nicknameSchema.optional(),
    nicknames: Joi.array().items(nicknameSchema).min(1).max(50).optional().messages({
        'array.min': 'Debe haber al menos un jugador',
        'array.max': 'No se pueden asignar puntos a más de 50 jugadores a la vez'
    }),
    points: Joi.number().integer().min(-1000).max(1000).required().messages({
        'number.min': 'Puntos fuera de rango permitido',
        'number.max': 'Puntos fuera de rango permitido'
    })
})
    .or('pin', 'sessionId')
    .or('nickname', 'nicknames');

// Leave lobby
const leaveLobbySchema = Joi.object({
    playerId: uuidSchema.optional(),
    roomId: Joi.alternatives().try(pinSchema, sessionIdSchema).optional()
});

// Select team
const selectTeamSchema = Joi.object({
    pin: pinSchema.optional(),
    sessionId: sessionIdSchema.optional(),
    nickname: nicknameSchema.required(),
    teamIndex: Joi.number().integer().min(0).max(10).required().messages({
        'number.min': 'Índice de equipo inválido',
        'number.max': 'Índice de equipo inválido (máximo 10 equipos)'
    })
}).or('pin', 'sessionId');

module.exports = {
    joinLobbySchema,
    joinPresenterLobbySchema,
    reconnectPlayerSchema,
    submitAnswerSchema,
    manualPointsSchema,
    leaveLobbySchema,
    selectTeamSchema
};
