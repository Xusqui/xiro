/**
 * @fileoverview Esquemas de eventos de socket de la partida (iniciar, avanzar, pausar, reanudar,
 * estado, reconexión del presentador, terminar y abandonar). Reexportado desde validation/index.js.
 */

const Joi = require('joi');
const { pinSchema, sessionIdSchema, uuidSchema } = require('./primitives');

// Start game
const startGameSchema = Joi.object({
    roomIdOrPin: Joi.alternatives().try(pinSchema, sessionIdSchema).required().messages({
        'alternatives.match': 'Se requiere un PIN o session ID válido'
    })
});

// Next question
const nextQuestionSchema = Joi.object({
    roomIdOrPin: Joi.alternatives().try(pinSchema, sessionIdSchema).required().messages({
        'alternatives.match': 'Se requiere un PIN o session ID válido'
    })
});

// Pause timer
const pauseTimerSchema = Joi.object({
    roomIdOrPin: Joi.alternatives().try(pinSchema, sessionIdSchema).required().messages({
        'alternatives.match': 'Se requiere un PIN o session ID válido'
    })
});

// Resume timer
const resumeTimerSchema = Joi.object({
    roomIdOrPin: Joi.alternatives().try(pinSchema, sessionIdSchema).required().messages({
        'alternatives.match': 'Se requiere un PIN o session ID válido'
    })
});

// Get current state
const getCurrentStateSchema = Joi.object({
    playerId: uuidSchema.required(),
    roomId: Joi.alternatives().try(pinSchema, sessionIdSchema).required().messages({
        'alternatives.match': 'Se requiere un PIN o session ID válido'
    })
});

// Reconnect presenter
const reconnectPresenterSchema = Joi.object({
    playerId: uuidSchema.required(),
    token: Joi.string().allow('').optional(),
    sessionId: sessionIdSchema.optional()
});

// End game (manual)
const endGameSchema = Joi.object({
    roomIdOrPin: Joi.alternatives().try(pinSchema, sessionIdSchema).required().messages({
        'alternatives.match': 'Se requiere un PIN o session ID válido'
    }),
    reason: Joi.string().valid('manual', 'emergency', 'cancelled').default('manual').messages({
        'any.only': 'Razón de finalización inválida'
    })
});

// Abandon game (presenter hard stop)
const abandonGameSchema = Joi.object({
    roomIdOrPin: Joi.alternatives().try(pinSchema, sessionIdSchema).required().messages({
        'alternatives.match': 'Se requiere un PIN o session ID válido'
    }),
    reason: Joi.string().valid('abandoned', 'concluded').default('abandoned').messages({
        'any.only': 'Razón de abandono inválida'
    })
});

module.exports = {
    startGameSchema,
    nextQuestionSchema,
    pauseTimerSchema,
    resumeTimerSchema,
    getCurrentStateSchema,
    reconnectPresenterSchema,
    endGameSchema,
    abandonGameSchema
};
