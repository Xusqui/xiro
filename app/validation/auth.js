/**
 * @fileoverview Esquemas de autenticación del panel (login, registro, contraseña, email) y de licencias
 * de usuario. Reexportado desde validation/index.js.
 */

const Joi = require('joi');
const { LIMITS, usernameSchema, passwordSchema, emailSchema } = require('./primitives');

const loginSchema = Joi.object({
    username: usernameSchema,
    password: passwordSchema,
    acceptTerms: Joi.boolean().valid(true)
});

// Registro
const registerSchema = Joi.object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
        'any.only': 'Las contraseñas no coinciden',
        'string.empty': 'La confirmación de contraseña es requerida',
        'any.required': 'La confirmación de contraseña es requerida'
    }),
    acceptTerms: Joi.boolean().valid(true).required().messages({
        'any.only': 'Debes aceptar los términos y la política de privacidad',
        'any.required': 'Debes aceptar los términos y la política de privacidad'
    })
});

const changePasswordSchema = Joi.object({
    currentPassword: passwordSchema,
    newPassword: Joi.string()
        .min(LIMITS.PASSWORD_MIN)
        .max(LIMITS.PASSWORD_MAX)
        .invalid(Joi.ref('currentPassword'))
        .required()
        .messages({
            'string.empty': 'La nueva contraseña es requerida',
            'string.min': `La nueva contraseña debe tener al menos ${LIMITS.PASSWORD_MIN} caracteres`,
            'string.max': `La nueva contraseña no puede exceder ${LIMITS.PASSWORD_MAX} caracteres`,
            'any.invalid': 'La nueva contraseña debe ser distinta a la actual',
            'any.required': 'La nueva contraseña es requerida'
        }),
    confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
        'any.only': 'La confirmación no coincide con la nueva contraseña',
        'string.empty': 'La confirmación de nueva contraseña es requerida',
        'any.required': 'La confirmación de nueva contraseña es requerida'
    })
});

const passwordResetRequestSchema = Joi.object({
    email: emailSchema
});

const passwordResetConfirmSchema = Joi.object({
    token: Joi.string().trim().min(10).max(255).required().messages({
        'string.empty': 'El token es requerido',
        'any.required': 'El token es requerido'
    }),
    newPassword: Joi.string()
        .min(LIMITS.PASSWORD_MIN)
        .max(LIMITS.PASSWORD_MAX)
        .required()
        .messages({
            'string.empty': 'La nueva contraseña es requerida',
            'string.min': `La nueva contraseña debe tener al menos ${LIMITS.PASSWORD_MIN} caracteres`,
            'string.max': `La nueva contraseña no puede exceder ${LIMITS.PASSWORD_MAX} caracteres`,
            'any.required': 'La nueva contraseña es requerida'
        }),
    confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
        'any.only': 'La confirmación no coincide con la nueva contraseña',
        'string.empty': 'La confirmación de nueva contraseña es requerida',
        'any.required': 'La confirmación de nueva contraseña es requerida'
    })
});

const changeEmailRequestSchema = Joi.object({
    currentPassword: passwordSchema,
    newEmail: emailSchema,
    confirmNewEmail: Joi.string().valid(Joi.ref('newEmail')).required().messages({
        'any.only': 'La confirmación no coincide con el nuevo correo',
        'string.empty': 'La confirmación de correo es requerida',
        'any.required': 'La confirmación de correo es requerida'
    })
});

// Compra integrada de licencia: plan elegido
const userLicenseCheckoutSchema = Joi.object({
    planCode: Joi.string().trim().min(2).max(32).required().messages({
        'string.empty': 'El plan es requerido',
        'any.required': 'El plan es requerido',
        'string.min': 'Plan no válido',
        'string.max': 'Plan no válido'
    })
});

// Liberación de contenido de editores (toggle del administrador)
const licenseExemptionSchema = Joi.object({
    exempt: Joi.boolean().required().messages({
        'boolean.base': 'El campo exempt debe ser booleano',
        'any.required': 'El campo exempt es requerido'
    })
});

// Licencia individual del usuario (vacía = eliminarla)
const userLicenseSchema = Joi.object({
    license: Joi.string().trim().allow('').max(160).required().messages({
        'string.max': 'La licencia no puede exceder 160 caracteres',
        'string.base': 'La licencia debe ser un texto',
        'any.required': 'El campo license es requerido'
    })
});

module.exports = {
    loginSchema,
    registerSchema,
    changePasswordSchema,
    passwordResetRequestSchema,
    passwordResetConfirmSchema,
    changeEmailRequestSchema,
    userLicenseCheckoutSchema,
    licenseExemptionSchema,
    userLicenseSchema
};
