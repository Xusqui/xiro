/**
 * @fileoverview Esquemas de bancos de preguntas, juegos y juegos personalizados (REST).
 * Reexportado desde validation/index.js.
 */

const Joi = require('joi');
const {
    LIMITS,
    languageSchema,
    pinSchema,
    nameSchema,
    dbIdSchema,
    imageUrlSchema,
    randomPointsFields
} = require('./primitives');
const { questionSchema } = require('./questions');
const { slideVideoSchema } = require('../application/validators/VideoSlideValidator');
const { slideCanvasSchema } = require('../application/validators/CanvasSlideValidator');
const { slideHowToSchema } = require('../application/validators/HowToSlideValidator');

// Banco de preguntas (guardar)
const saveBankSchema = Joi.object({
    id: dbIdSchema.allow(null).optional(),
    name: nameSchema.required(),
    pin: pinSchema.allow(null, '').optional(),
    language: languageSchema,
    image_url: imageUrlSchema,
    visible_to_presenter: Joi.boolean().default(true).optional(),
    use_streaks: Joi.boolean().default(false).optional(),
    streak_threshold: Joi.number().integer().min(1).max(20).default(3).optional(),
    streak_bonus_percentage: Joi.number().min(0).max(2).default(0.5).optional(),
    use_double_streaks: Joi.boolean().default(false).optional(),
    double_streak_threshold: Joi.number().integer().min(1).max(20).default(5).optional(),
    double_streak_bonus_percentage: Joi.number().min(0).max(2).default(1.0).optional(),
    ...randomPointsFields,
    // Qué hacer con las preguntas borradas que usa algún juego personalizado (sin él, 409)
    removed_in_use: Joi.string().valid('delete', 'keep').optional(),
    questions: Joi.array()
        .items(questionSchema)
        .min(1)
        .max(LIMITS.MAX_QUESTIONS_PER_BANK)
        .required()
        .messages({
            'array.min': 'Debe haber al menos una pregunta',
            'array.max': `No puede haber más de ${LIMITS.MAX_QUESTIONS_PER_BANK} preguntas`
        })
});

// Crear banco (solo nombre)
const createBankSchema = Joi.object({
    name: nameSchema.required()
});

// Configuración de banco en juego
// question_count == null => el banco entra en el pool compartido del juego
// (ver gameSchema.pool_question_count)
const gameBankConfigSchema = Joi.object({
    bank_id: dbIdSchema.required(),
    question_count: Joi.number().integer().min(1).max(LIMITS.MAX_QUESTIONS_PER_BANK).allow(null).optional().messages({
        'number.min': 'Debe seleccionar al menos 1 pregunta'
    })
});

// Crear/Actualizar juego
const gameSchema = Joi.object({
    name: nameSchema.required(),
    pin: pinSchema.allow('').optional(),
    language: languageSchema,
    image_url: imageUrlSchema,
    visible_to_presenter: Joi.boolean().default(true).optional(),
    use_streaks: Joi.boolean().default(false).optional(),
    streak_threshold: Joi.number().integer().min(1).max(20).default(3).optional(),
    streak_bonus_percentage: Joi.number().min(0).max(2).default(0.5).optional(),
    use_double_streaks: Joi.boolean().default(false).optional(),
    double_streak_threshold: Joi.number().integer().min(1).max(20).default(5).optional(),
    double_streak_bonus_percentage: Joi.number().min(0).max(2).default(1.0).optional(),
    ...randomPointsFields,
    pool_question_count: Joi.number().integer().min(1).max(LIMITS.MAX_QUESTIONS_PER_BANK).allow(null).optional(),
    banks: Joi.array().items(gameBankConfigSchema).min(1).required().messages({
        'array.min': 'Debe seleccionar al menos un banco de preguntas'
    })
}).custom((value, helpers) => {
    const hasPoolBank = value.banks.some(b => b.question_count === null || b.question_count === undefined);
    if (hasPoolBank && !value.pool_question_count) {
        return helpers.message('Debes indicar el total de preguntas del pool cuando hay bancos sin cantidad fija');
    }
    if (!hasPoolBank && value.pool_question_count) {
        return helpers.message('El total de preguntas del pool solo aplica si hay bancos sin cantidad fija');
    }
    return value;
});

// Pregunta de juego personalizado
const customGameQuestionSchema = Joi.object({
    slide_type: Joi.string()
        .valid('question', 'comment', 'info', 'text', 'image', 'text-image', 'video', 'canvas', 'howto')
        .default('question'),
    question_id: dbIdSchema.allow(null).when('slide_type', {
        is: 'question',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    comment_text: Joi.string()
        .max(LIMITS.COMMENT_TEXT_MAX)
        .trim()
        .when('slide_type', {
            is: Joi.valid('comment', 'info'),
            then: Joi.required(),
            otherwise: Joi.allow(null, '').optional()
        }),
    slide_title: Joi.string()
        .max(LIMITS.SLIDE_TITLE_MAX)
        .trim()
        .when('slide_type', {
            is: Joi.valid('text', 'text-image'),
            then: Joi.required(),
            otherwise: Joi.allow(null, '').optional()
        }),
    slide_body: Joi.string()
        .max(LIMITS.SLIDE_BODY_MAX)
        .trim()
        .when('slide_type', {
            is: Joi.valid('text', 'text-image'),
            then: Joi.required(),
            otherwise: Joi.allow(null, '').optional()
        }),
    slide_image: Joi.string()
        .max(2048)
        .trim()
        .when('slide_type', {
            is: Joi.valid('image', 'text-image'),
            then: Joi.required(),
            otherwise: Joi.allow(null, '').optional()
        }),
    slide_image_position: Joi.string()
        .valid('left', 'right')
        .when('slide_type', {
            is: 'text-image',
            then: Joi.required(),
            otherwise: Joi.allow(null, '').optional()
        }),
    // URL de la diapositiva de vídeo (archivo, YouTube, Vimeo o Dailymotion)
    slide_video: slideVideoSchema,
    // Diapositiva libre (canvas) - contiene elementos gráficos personalizados
    slide_canvas: slideCanvasSchema,
    // Diapositiva de instrucciones (howto): solo elige un tema de una lista cerrada
    slide_howto: slideHowToSchema,
    // Pie opcional de las diapositivas especiales (texto plano; los clientes lo escapan)
    slide_footer: Joi.string().max(LIMITS.SLIDE_FOOTER_MAX).trim().allow(null, '').optional()
});

// Crear juego personalizado
const createCustomGameSchema = Joi.object({
    name: nameSchema.required(),
    pin: pinSchema.allow('').optional(),
    language: languageSchema,
    image_url: imageUrlSchema,
    visible_to_presenter: Joi.boolean().default(true).optional(),
    use_streaks: Joi.boolean().default(false).optional(),
    streak_threshold: Joi.number().integer().min(1).max(20).default(3).optional(),
    streak_bonus_percentage: Joi.number().min(0).max(2).default(0.5).optional(),
    use_double_streaks: Joi.boolean().default(false).optional(),
    double_streak_threshold: Joi.number().integer().min(1).max(20).default(5).optional(),
    double_streak_bonus_percentage: Joi.number().min(0).max(2).default(1.0).optional(),
    ...randomPointsFields,
    questions: Joi.array().items(customGameQuestionSchema).min(0).optional().messages({
        'array.min': 'Debe haber al menos una pregunta o comentario'
    })
});

// Actualizar juego personalizado
const updateCustomGameSchema = Joi.object({
    name: nameSchema.required(),
    pin: pinSchema.required(),
    language: languageSchema,
    image_url: imageUrlSchema,
    visible_to_presenter: Joi.boolean().default(true).optional(),
    use_streaks: Joi.boolean().default(false).optional(),
    streak_threshold: Joi.number().integer().min(1).max(20).default(3).optional(),
    streak_bonus_percentage: Joi.number().min(0).max(2).default(0.5).optional(),
    use_double_streaks: Joi.boolean().default(false).optional(),
    double_streak_threshold: Joi.number().integer().min(1).max(20).default(5).optional(),
    double_streak_bonus_percentage: Joi.number().min(0).max(2).default(1.0).optional(),
    ...randomPointsFields,
    questions: Joi.array().items(customGameQuestionSchema).min(1).required().messages({
        'array.min': 'Debe haber al menos una pregunta o comentario'
    })
});

// Validar PIN query param
const validatePinQuerySchema = Joi.object({
    pin: pinSchema.required(),
    excludeId: dbIdSchema.optional()
});

// Mezclar bancos de preguntas
const mergeBanksSchema = Joi.object({
    bankIds: Joi.array().items(dbIdSchema).min(2).required().messages({
        'array.min': 'Debes seleccionar al menos 2 bancos para mezclar',
        'array.base': 'bankIds debe ser un array'
    }),
    name: nameSchema.required(),
    pin: pinSchema.allow(null, '').optional(),
    visible_to_presenter: Joi.boolean().default(true).optional(),
    use_streaks: Joi.boolean().default(false).optional(),
    streak_threshold: Joi.number().integer().min(1).max(20).default(3).optional(),
    streak_bonus_percentage: Joi.number().min(0).max(2).default(0.5).optional(),
    use_double_streaks: Joi.boolean().default(false).optional(),
    double_streak_threshold: Joi.number().integer().min(1).max(20).default(5).optional(),
    double_streak_bonus_percentage: Joi.number().min(0).max(2).default(1.0).optional(),
    ...randomPointsFields
});

module.exports = {
    saveBankSchema,
    createBankSchema,
    gameBankConfigSchema,
    gameSchema,
    customGameQuestionSchema,
    createCustomGameSchema,
    updateCustomGameSchema,
    validatePinQuerySchema,
    mergeBanksSchema
};
