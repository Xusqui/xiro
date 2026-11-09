/**
 * @fileoverview Esquemas de opciones y preguntas (bancos y juegos). Reexportado desde validation/index.js.
 */

const Joi = require('joi');
const { LIMITS, dbIdSchema, optionTextSchema, questionTextSchema } = require('./primitives');
const { wordSearchOptionsSchema } = require('../application/validators/WordSearchQuestionValidator');
const {
    fillBlanksOptionsSchema,
    fillBlanksQuestionRule,
    fillBlanksRuleMessages
} = require('../application/validators/FillBlanksQuestionValidator');

// Opción de pregunta
const optionSchema = Joi.object({
    optionText: Joi.when('option_image_url', {
        is: Joi.string().min(1).exist(),
        then: optionTextSchema.allow('', null).optional(),
        otherwise: optionTextSchema.required()
    }),
    isCorrect: Joi.boolean().required(),
    justification: Joi.string().max(LIMITS.JUSTIFICATION_MAX).allow(null, '').optional(),
    order_index: Joi.number().integer().min(0).allow(null).optional(),
    orderIndex: Joi.number().integer().min(0).allow(null).optional(),
    match_value: Joi.string().max(200).allow(null, '').optional(),
    option_image_url: Joi.alternatives()
        .try(Joi.string().uri({ relativeOnly: true }).max(2048), Joi.string().allow('').max(2048))
        .allow(null)
        .optional()
});

const orderOptionSchema = Joi.object({
    optionText: optionTextSchema.required(),
    order_index: Joi.number().integer().min(0).optional(),
    orderIndex: Joi.number().integer().min(0).optional(),
    justification: Joi.string().max(LIMITS.JUSTIFICATION_MAX).allow(null, '').optional()
}).custom((value, helpers) => {
    if (value.order_index === undefined && value.orderIndex === undefined) {
        return helpers.error('any.required');
    }
    return value;
}, 'order_index required');

// Pregunta completa
const questionSchema = Joi.object({
    id: dbIdSchema.allow(null).optional(),
    questionText: questionTextSchema.required(),
    type: Joi.string()
        .valid(
            'quiz',
            'survey',
            'order',
            'numeric_approximation',
            'word_scramble',
            'multiple_choice',
            'matching',
            'word_search',
            'fill_blanks',
            'survey_multiple'
        )
        .default('quiz'),
    tipo_contenido: Joi.string().valid('texto', 'imagen', 'audio').default('texto').optional(),
    url_recurso: Joi.alternatives()
        .try(Joi.string().uri({ relativeOnly: true }).max(2048), Joi.string().allow('').max(2048))
        .allow(null)
        .optional(),
    question_image_url: Joi.alternatives()
        .try(Joi.string().uri({ relativeOnly: true }).max(2048), Joi.string().allow('').max(2048))
        .allow(null)
        .optional(),
    time_limit: Joi.number().integer().min(5).max(120).default(20).optional().messages({
        'number.min': 'El tiempo debe ser al menos 5 segundos',
        'number.max': 'El tiempo no puede exceder 120 segundos'
    }),
    correctWord: Joi.string()
        .min(7)
        .max(10)
        .when('type', {
            is: 'word_scramble',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null, '')
        })
        .messages({
            'string.min': 'La palabra debe tener al menos 7 letras',
            'string.max': 'La palabra no puede exceder 10 letras',
            'any.required': 'La palabra correcta es requerida para preguntas de anagrama'
        }),
    correctAnswer: Joi.number()
        .integer()
        .when('type', {
            is: 'numeric_approximation',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null)
        })
        .messages({
            'number.base': 'La respuesta correcta debe ser un número entero',
            'any.required': 'La respuesta correcta es requerida para preguntas numéricas'
        }),
    maxPoints: Joi.number()
        .integer()
        .positive()
        .when('type', {
            is: 'numeric_approximation',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null)
        })
        .messages({
            'number.base': 'Los puntos máximos deben ser un número',
            'number.positive': 'Los puntos máximos deben ser mayor a 0',
            'any.required': 'Los puntos máximos son requeridos para preguntas numéricas'
        }),
    toleranceMode: Joi.string()
        .valid('absolute', 'percentage', 'hybrid')
        .when('type', {
            is: 'numeric_approximation',
            then: Joi.string().valid('absolute', 'percentage', 'hybrid').default('hybrid'),
            otherwise: Joi.optional().allow(null)
        }),
    toleranceValue: Joi.number()
        .positive()
        .when('type', {
            is: 'numeric_approximation',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null)
        })
        .messages({
            'number.base': 'El valor de tolerancia debe ser numérico',
            'number.positive': 'El valor de tolerancia debe ser mayor a 0',
            'any.required': 'El valor de tolerancia es requerido para preguntas numéricas'
        }),
    toleranceCap: Joi.number().positive().allow(null).optional().messages({
        'number.base': 'El límite de tolerancia debe ser numérico',
        'number.positive': 'El límite de tolerancia debe ser mayor a 0'
    }),
    hint: Joi.string().max(300).allow(null, '').optional(),
    justification: Joi.string().max(LIMITS.JUSTIFICATION_MAX).allow(null, '').optional(),
    mc_points_per_correct: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .when('type', {
            is: 'multiple_choice',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null)
        })
        .messages({
            'number.base': 'Los puntos por acierto deben ser un número entero',
            'number.min': 'Los puntos por acierto deben ser al menos 1',
            'number.max': 'Los puntos por acierto no pueden exceder 100',
            'any.required': 'Los puntos por acierto son requeridos para preguntas de selección múltiple'
        }),
    mc_penalty_per_incorrect: Joi.number()
        .integer()
        .min(0)
        .max(100)
        .when('type', {
            is: 'multiple_choice',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null)
        })
        .messages({
            'number.base': 'La penalización debe ser un número entero',
            'number.min': 'La penalización debe ser al menos 0',
            'number.max': 'La penalización no puede exceder 100',
            'any.required': 'La penalización es requerida para preguntas de selección múltiple'
        }),
    mc_perfect_bonus: Joi.number()
        .integer()
        .min(0)
        .max(100)
        .when('type', {
            is: 'multiple_choice',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null)
        })
        .messages({
            'number.base': 'El bonus por perfección debe ser un número entero',
            'number.min': 'El bonus por perfección debe ser al menos 0',
            'number.max': 'El bonus por perfección no puede exceder 100',
            'any.required': 'El bonus por perfección es requerido para preguntas de selección múltiple'
        }),
    options: Joi.when('type', {
        switch: [
            { is: Joi.valid('numeric_approximation', 'word_scramble'), then: Joi.optional() },
            { is: 'word_search', then: wordSearchOptionsSchema },
            // Opcionales a nivel de clave: con la frase entre corchetes (JSON importado) las
            // palabras las genera fillBlanksQuestionRule, que exige después que cuadren
            { is: 'fill_blanks', then: fillBlanksOptionsSchema.optional() }
        ],
        otherwise: Joi.array()
            .items(
                Joi.when('type', {
                    is: 'order',
                    then: orderOptionSchema,
                    otherwise: optionSchema
                })
            )
            .min(LIMITS.MIN_OPTIONS)
            .max(LIMITS.MAX_OPTIONS)
            .required()
    }).messages({
        'array.min': `Debe haber al menos ${LIMITS.MIN_OPTIONS} opciones`,
        'array.max': `No puede haber más de ${LIMITS.MAX_OPTIONS} opciones`
    })
})
    // Completa la frase: corchetes → marcadores + palabras, y tantos huecos como palabras
    .custom(fillBlanksQuestionRule, 'fill_blanks question')
    .messages(fillBlanksRuleMessages);

module.exports = { optionSchema, orderOptionSchema, questionSchema };
