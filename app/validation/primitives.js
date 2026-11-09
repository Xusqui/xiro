/**
 * @fileoverview Límites y esquemas Joi base reutilizables por el resto de dominios de validación.
 * Reexportado desde validation/index.js (la API pública de validation no cambia).
 */

const Joi = require('joi');
const { SUPPORTED_LANGUAGES } = require('../config/languages');
const {
    MIN_VALUE: RANDOM_POINTS_MIN_VALUE,
    MAX_VALUE: RANDOM_POINTS_MAX_VALUE,
    DEFAULT_MIN: RANDOM_POINTS_DEFAULT_MIN,
    DEFAULT_MAX: RANDOM_POINTS_DEFAULT_MAX
} = require('../application/validators/RandomPointsValidator');

const RANDOM_POINTS_LIMITS = {
    MIN_VALUE: RANDOM_POINTS_MIN_VALUE,
    MAX_VALUE: RANDOM_POINTS_MAX_VALUE,
    DEFAULT_MIN: RANDOM_POINTS_DEFAULT_MIN,
    DEFAULT_MAX: RANDOM_POINTS_DEFAULT_MAX
};

const languageSchema = Joi.string()
    .valid(...SUPPORTED_LANGUAGES)
    .required();

// ===== CONSTANTES DE VALIDACIÓN =====
const LIMITS = {
    NICKNAME_MIN: 2,
    NICKNAME_MAX: 20,
    TEAM_NAME_MIN: 2,
    TEAM_NAME_MAX: 30,
    PIN_MIN: 4,
    PIN_MAX: 10,
    NAME_MIN: 1,
    NAME_MAX: 255,
    QUESTION_TEXT_MAX: 2000,
    OPTION_TEXT_MAX: 500,
    JUSTIFICATION_MAX: 1000,
    COMMENT_TEXT_MAX: 500,
    SLIDE_TITLE_MAX: 120,
    SLIDE_BODY_MAX: 2000,
    SLIDE_FOOTER_MAX: 300,
    PASSWORD_MIN: 4,
    PASSWORD_MAX: 100,
    USERNAME_MIN: 3,
    USERNAME_MAX: 32,
    MAX_OPTIONS: 6,
    MIN_OPTIONS: 2,
    MAX_QUESTIONS_PER_BANK: 500
};

// ===== ESQUEMAS BASE REUTILIZABLES =====

// PIN: alfanumérico, 4-10 caracteres, se convierte a mayúsculas
const pinSchema = Joi.string()
    .alphanum()
    .min(LIMITS.PIN_MIN)
    .max(LIMITS.PIN_MAX)
    .uppercase()
    .trim()
    .messages({
        'string.alphanum': 'El PIN solo puede contener letras y números',
        'string.min': `El PIN debe tener al menos ${LIMITS.PIN_MIN} caracteres`,
        'string.max': `El PIN no puede exceder ${LIMITS.PIN_MAX} caracteres`
    });

// Nombre genérico (bancos, juegos, etc.)
const nameSchema = Joi.string()
    .min(LIMITS.NAME_MIN)
    .max(LIMITS.NAME_MAX)
    .trim()
    .pattern(/^[^<>"]*$/) // Sin < > ni comillas dobles: el nombre acaba en HTML y en atributos value="…"
    .messages({
        'string.min': 'El nombre no puede estar vacío',
        'string.max': `El nombre no puede exceder ${LIMITS.NAME_MAX} caracteres`,
        'string.pattern.base': 'El nombre contiene caracteres no permitidos'
    });

// Nickname de jugador: más restrictivo
const nicknameSchema = Joi.string()
    .min(LIMITS.NICKNAME_MIN)
    .max(LIMITS.NICKNAME_MAX)
    .trim()
    .pattern(/^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s._-]+$/)
    .messages({
        'string.min': `El nombre debe tener al menos ${LIMITS.NICKNAME_MIN} caracteres`,
        'string.max': `El nombre no puede exceder ${LIMITS.NICKNAME_MAX} caracteres`,
        'string.pattern.base': 'El nombre solo puede contener letras, números, espacios y guiones',
        'string.empty': 'El nombre no puede estar vacío'
    });

// Nombre de equipo: similar a nickname pero con longitud mayor
const teamNameSchema = Joi.string()
    .min(LIMITS.TEAM_NAME_MIN)
    .max(LIMITS.TEAM_NAME_MAX)
    .trim()
    .pattern(/^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s._-]+$/)
    .messages({
        'string.min': `El nombre del equipo debe tener al menos ${LIMITS.TEAM_NAME_MIN} caracteres`,
        'string.max': `El nombre del equipo no puede exceder ${LIMITS.TEAM_NAME_MAX} caracteres`,
        'string.pattern.base': 'El nombre del equipo solo puede contener letras, números, espacios y guiones',
        'string.empty': 'El nombre del equipo no puede estar vacío'
    });

// UUID v4
const uuidSchema = Joi.string().guid({ version: 'uuidv4' }).messages({
    'string.guid': 'Identificador de jugador inválido'
});

// Session ID: formato PIN-XXXX (ej: ABCD-1234 donde XXXX son 4 dígitos aleatorios)
const sessionIdSchema = Joi.string()
    .pattern(/^[A-Z0-9]{4,10}-\d{4}$/)
    .messages({
        'string.pattern.base': 'Session ID inválido. Formato esperado: PIN-XXXX'
    });

// ID numérico de base de datos
const dbIdSchema = Joi.number().integer().positive().messages({
    'number.base': 'ID inválido',
    'number.positive': 'ID debe ser positivo'
});

// Texto de pregunta
const questionTextSchema = Joi.string()
    .min(1)
    .max(LIMITS.QUESTION_TEXT_MAX)
    .trim()
    .messages({
        'string.empty': 'El texto de la pregunta no puede estar vacío',
        'string.max': `La pregunta no puede exceder ${LIMITS.QUESTION_TEXT_MAX} caracteres`
    });

// Texto de opción
const optionTextSchema = Joi.string()
    .min(1)
    .max(LIMITS.OPTION_TEXT_MAX)
    .trim()
    .messages({
        'string.empty': 'El texto de la opción no puede estar vacío',
        'string.max': `La opción no puede exceder ${LIMITS.OPTION_TEXT_MAX} caracteres`
    });

const usernameSchema = Joi.string()
    .min(LIMITS.USERNAME_MIN)
    .max(LIMITS.USERNAME_MAX)
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9._-]+$/)
    .required()
    .messages({
        'string.empty': 'El usuario es requerido',
        'string.min': `El usuario debe tener al menos ${LIMITS.USERNAME_MIN} caracteres`,
        'string.max': `El usuario no puede exceder ${LIMITS.USERNAME_MAX} caracteres`,
        'string.pattern.base': 'El usuario solo puede contener letras minúsculas, números, punto, guion y guion bajo',
        'any.required': 'El usuario es requerido'
    });

const passwordSchema = Joi.string()
    .min(LIMITS.PASSWORD_MIN)
    .max(LIMITS.PASSWORD_MAX)
    .required()
    .messages({
        'string.empty': 'La contraseña es requerida',
        'string.min': `La contraseña debe tener al menos ${LIMITS.PASSWORD_MIN} caracteres`,
        'string.max': `La contraseña no puede exceder ${LIMITS.PASSWORD_MAX} caracteres`,
        'any.required': 'La contraseña es requerida'
    });

const emailSchema = Joi.string()
    .email({ tlds: { allow: false } })
    .max(255)
    .trim()
    .lowercase()
    .required()
    .messages({
        'string.empty': 'El correo es requerido',
        'string.email': 'El correo no es válido',
        'string.max': 'El correo no puede exceder 255 caracteres',
        'any.required': 'El correo es requerido'
    });

// Imagen de portada de un juego/banco (URL relativa devuelta por /api/upload/game-cover-image)
const imageUrlSchema = Joi.string().max(2048).trim().allow(null, '').optional();

// Puntuación aleatoria por pregunta (mismos límites que RandomPointsValidator, que es
// quien valida el lado que no usa Joi — routes/trivial.routes.js — y el panel admin)
const randomPointsFields = {
    use_random_points: Joi.boolean().default(false).optional(),
    random_points_min: Joi.number()
        .integer()
        .min(RANDOM_POINTS_LIMITS.MIN_VALUE)
        .max(RANDOM_POINTS_LIMITS.MAX_VALUE)
        .default(RANDOM_POINTS_LIMITS.DEFAULT_MIN)
        .optional(),
    random_points_max: Joi.number()
        .integer()
        .min(RANDOM_POINTS_LIMITS.MIN_VALUE)
        .max(RANDOM_POINTS_LIMITS.MAX_VALUE)
        .default(RANDOM_POINTS_LIMITS.DEFAULT_MAX)
        .optional()
        .when('use_random_points', {
            is: true,
            then: Joi.number().min(Joi.ref('random_points_min')).messages({
                'number.min': 'El máximo de puntuación aleatoria debe ser mayor o igual que el mínimo'
            })
        })
};

module.exports = {
    LIMITS,
    RANDOM_POINTS_LIMITS,
    languageSchema,
    pinSchema,
    nameSchema,
    nicknameSchema,
    teamNameSchema,
    uuidSchema,
    sessionIdSchema,
    dbIdSchema,
    questionTextSchema,
    optionTextSchema,
    usernameSchema,
    passwordSchema,
    emailSchema,
    imageUrlSchema,
    randomPointsFields
};
