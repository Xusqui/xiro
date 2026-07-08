/**
 * Módulo de validación para Xiro!
 * Usa Joi para validar todas las entradas de usuario
 */

const Joi = require('joi');

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
    PASSWORD_MIN: 4,
    PASSWORD_MAX: 100,
    USERNAME_MIN: 3,
    USERNAME_MAX: 32,
    MAX_OPTIONS: 6,
    MIN_OPTIONS: 2,
    MAX_QUESTIONS_PER_BANK: 500,
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
        'string.max': `El PIN no puede exceder ${LIMITS.PIN_MAX} caracteres`,
    });

// Nombre genérico (bancos, juegos, etc.)
const nameSchema = Joi.string()
    .min(LIMITS.NAME_MIN)
    .max(LIMITS.NAME_MAX)
    .trim()
    .pattern(/^[^<>]*$/) // No permite < o > para prevenir XSS básico
    .messages({
        'string.min': 'El nombre no puede estar vacío',
        'string.max': `El nombre no puede exceder ${LIMITS.NAME_MAX} caracteres`,
        'string.pattern.base': 'El nombre contiene caracteres no permitidos',
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
        'string.empty': 'El nombre no puede estar vacío',
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
        'string.empty': 'El nombre del equipo no puede estar vacío',
    });

// UUID v4
const uuidSchema = Joi.string()
    .guid({ version: 'uuidv4' })
    .messages({
        'string.guid': 'Identificador de jugador inválido',
    });

// Session ID: formato PIN-XXXX (ej: ABCD-1234 donde XXXX son 4 dígitos aleatorios)
const sessionIdSchema = Joi.string()
    .pattern(/^[A-Z0-9]{4,10}-\d{4}$/)
    .messages({
        'string.pattern.base': 'Session ID inválido. Formato esperado: PIN-XXXX',
    });

// ID numérico de base de datos
const dbIdSchema = Joi.number()
    .integer()
    .positive()
    .messages({
        'number.base': 'ID inválido',
        'number.positive': 'ID debe ser positivo',
    });

// Texto de pregunta
const questionTextSchema = Joi.string()
    .min(1)
    .max(LIMITS.QUESTION_TEXT_MAX)
    .trim()
    .messages({
        'string.empty': 'El texto de la pregunta no puede estar vacío',
        'string.max': `La pregunta no puede exceder ${LIMITS.QUESTION_TEXT_MAX} caracteres`,
    });

// Texto de opción
const optionTextSchema = Joi.string()
    .min(1)
    .max(LIMITS.OPTION_TEXT_MAX)
    .trim()
    .messages({
        'string.empty': 'El texto de la opción no puede estar vacío',
        'string.max': `La opción no puede exceder ${LIMITS.OPTION_TEXT_MAX} caracteres`,
    });

// ===== ESQUEMAS DE ENDPOINTS =====

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
        'any.required': 'El usuario es requerido',
    });

const passwordSchema = Joi.string()
    .min(LIMITS.PASSWORD_MIN)
    .max(LIMITS.PASSWORD_MAX)
    .required()
    .messages({
        'string.empty': 'La contraseña es requerida',
        'string.min': `La contraseña debe tener al menos ${LIMITS.PASSWORD_MIN} caracteres`,
        'string.max': `La contraseña no puede exceder ${LIMITS.PASSWORD_MAX} caracteres`,
        'any.required': 'La contraseña es requerida',
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
        'any.required': 'El correo es requerido',
    });

// Login
const loginSchema = Joi.object({
    username: usernameSchema,
    password: passwordSchema,
});

// Registro
const registerSchema = Joi.object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
            'any.only': 'Las contraseñas no coinciden',
            'string.empty': 'La confirmación de contraseña es requerida',
            'any.required': 'La confirmación de contraseña es requerida',
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
            'any.required': 'La nueva contraseña es requerida',
        }),
    confirmNewPassword: Joi.string()
        .valid(Joi.ref('newPassword'))
        .required()
        .messages({
            'any.only': 'La confirmación no coincide con la nueva contraseña',
            'string.empty': 'La confirmación de nueva contraseña es requerida',
            'any.required': 'La confirmación de nueva contraseña es requerida',
        })
});

const passwordResetRequestSchema = Joi.object({
    email: emailSchema
});

const passwordResetConfirmSchema = Joi.object({
    token: Joi.string()
        .trim()
        .min(10)
        .max(255)
        .required()
        .messages({
            'string.empty': 'El token es requerido',
            'any.required': 'El token es requerido',
        }),
    newPassword: Joi.string()
        .min(LIMITS.PASSWORD_MIN)
        .max(LIMITS.PASSWORD_MAX)
        .required()
        .messages({
            'string.empty': 'La nueva contraseña es requerida',
            'string.min': `La nueva contraseña debe tener al menos ${LIMITS.PASSWORD_MIN} caracteres`,
            'string.max': `La nueva contraseña no puede exceder ${LIMITS.PASSWORD_MAX} caracteres`,
            'any.required': 'La nueva contraseña es requerida',
        }),
    confirmNewPassword: Joi.string()
        .valid(Joi.ref('newPassword'))
        .required()
        .messages({
            'any.only': 'La confirmación no coincide con la nueva contraseña',
            'string.empty': 'La confirmación de nueva contraseña es requerida',
            'any.required': 'La confirmación de nueva contraseña es requerida',
        })
});

const changeEmailRequestSchema = Joi.object({
    currentPassword: passwordSchema,
    newEmail: emailSchema,
    confirmNewEmail: Joi.string()
        .valid(Joi.ref('newEmail'))
        .required()
        .messages({
            'any.only': 'La confirmación no coincide con el nuevo correo',
            'string.empty': 'La confirmación de correo es requerida',
            'any.required': 'La confirmación de correo es requerida',
        })
});

// Compra integrada de licencia: plan elegido
const userLicenseCheckoutSchema = Joi.object({
    planCode: Joi.string()
        .trim()
        .min(2)
        .max(32)
        .required()
        .messages({
            'string.empty': 'El plan es requerido',
            'any.required': 'El plan es requerido',
            'string.min': 'Plan no válido',
            'string.max': 'Plan no válido',
        })
});

// Liberación de contenido de editores (toggle del administrador)
const licenseExemptionSchema = Joi.object({
    exempt: Joi.boolean()
        .required()
        .messages({
            'boolean.base': 'El campo exempt debe ser booleano',
            'any.required': 'El campo exempt es requerido',
        })
});

// Licencia individual del usuario (vacía = eliminarla)
const userLicenseSchema = Joi.object({
    license: Joi.string()
        .trim()
        .allow('')
        .max(160)
        .required()
        .messages({
            'string.max': 'La licencia no puede exceder 160 caracteres',
            'string.base': 'La licencia debe ser un texto',
            'any.required': 'El campo license es requerido',
        })
});

// Opción de pregunta
const optionSchema = Joi.object({
    optionText: Joi.when('option_image_url', {
        is: Joi.string().min(1).exist(),
        then: optionTextSchema.allow('', null).optional(),
        otherwise: optionTextSchema.required(),
    }),
    isCorrect: Joi.boolean().required(),
    justification: Joi.string()
        .max(LIMITS.JUSTIFICATION_MAX)
        .allow(null, '')
        .optional(),
    order_index: Joi.number().integer().min(0).allow(null).optional(),
    orderIndex: Joi.number().integer().min(0).allow(null).optional(),
    match_value: Joi.string().max(200).allow(null, '').optional(),
    option_image_url: Joi.alternatives().try(
        Joi.string().uri({ relativeOnly: true }).max(2048),
        Joi.string().allow('').max(2048)
    ).allow(null)
        .optional(),
});

const orderOptionSchema = Joi.object({
    optionText: optionTextSchema.required(),
    order_index: Joi.number().integer().min(0).optional(),
    orderIndex: Joi.number().integer().min(0).optional(),
    justification: Joi.string()
        .max(LIMITS.JUSTIFICATION_MAX)
        .allow(null, '')
        .optional(),
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
        .valid('quiz', 'survey', 'order', 'numeric_approximation', 'word_scramble', 'multiple_choice', 'matching')
        .default('quiz'),
    tipo_contenido: Joi.string()
        .valid('texto', 'imagen', 'audio')
        .default('texto')
        .optional(),
    url_recurso: Joi.alternatives().try(
        Joi.string().uri({ relativeOnly: true }).max(2048),
        Joi.string().allow('').max(2048)
    ).allow(null)
        .optional(),
    question_image_url: Joi.alternatives().try(
        Joi.string().uri({ relativeOnly: true }).max(2048),
        Joi.string().allow('').max(2048)
    ).allow(null)
        .optional(),
    time_limit: Joi.number()
        .integer()
        .min(5)
        .max(120)
        .default(20)
        .optional()
        .messages({
            'number.min': 'El tiempo debe ser al menos 5 segundos',
            'number.max': 'El tiempo no puede exceder 120 segundos',
        }),
    correctWord: Joi.string()
        .min(7)
        .max(10)
        .when('type', {
            is: 'word_scramble',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null, ''),
        })
        .messages({
            'string.min': 'La palabra debe tener al menos 7 letras',
            'string.max': 'La palabra no puede exceder 10 letras',
            'any.required': 'La palabra correcta es requerida para preguntas de anagrama',
        }),
    correctAnswer: Joi.number()
        .integer()
        .when('type', {
            is: 'numeric_approximation',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null),
        })
        .messages({
            'number.base': 'La respuesta correcta debe ser un número entero',
            'any.required': 'La respuesta correcta es requerida para preguntas numéricas',
        }),
    maxPoints: Joi.number()
        .integer()
        .positive()
        .when('type', {
            is: 'numeric_approximation',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null),
        })
        .messages({
            'number.base': 'Los puntos máximos deben ser un número',
            'number.positive': 'Los puntos máximos deben ser mayor a 0',
            'any.required': 'Los puntos máximos son requeridos para preguntas numéricas',
        }),
    toleranceMode: Joi.string()
        .valid('absolute', 'percentage', 'hybrid')
        .when('type', {
            is: 'numeric_approximation',
            then: Joi.string().valid('absolute', 'percentage', 'hybrid').default('hybrid'),
            otherwise: Joi.optional().allow(null),
        }),
    toleranceValue: Joi.number()
        .positive()
        .when('type', {
            is: 'numeric_approximation',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null),
        })
        .messages({
            'number.base': 'El valor de tolerancia debe ser numérico',
            'number.positive': 'El valor de tolerancia debe ser mayor a 0',
            'any.required': 'El valor de tolerancia es requerido para preguntas numéricas',
        }),
    toleranceCap: Joi.number()
        .positive()
        .allow(null)
        .optional()
        .messages({
            'number.base': 'El límite de tolerancia debe ser numérico',
            'number.positive': 'El límite de tolerancia debe ser mayor a 0',
        }),
    hint: Joi.string()
        .max(300)
        .allow(null, '')
        .optional(),
    justification: Joi.string()
        .max(LIMITS.JUSTIFICATION_MAX)
        .allow(null, '')
        .optional(),
    mc_points_per_correct: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .when('type', {
            is: 'multiple_choice',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null),
        })
        .messages({
            'number.base': 'Los puntos por acierto deben ser un número entero',
            'number.min': 'Los puntos por acierto deben ser al menos 1',
            'number.max': 'Los puntos por acierto no pueden exceder 100',
            'any.required': 'Los puntos por acierto son requeridos para preguntas de selección múltiple',
        }),
    mc_penalty_per_incorrect: Joi.number()
        .integer()
        .min(0)
        .max(100)
        .when('type', {
            is: 'multiple_choice',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null),
        })
        .messages({
            'number.base': 'La penalización debe ser un número entero',
            'number.min': 'La penalización debe ser al menos 0',
            'number.max': 'La penalización no puede exceder 100',
            'any.required': 'La penalización es requerida para preguntas de selección múltiple',
        }),
    mc_perfect_bonus: Joi.number()
        .integer()
        .min(0)
        .max(100)
        .when('type', {
            is: 'multiple_choice',
            then: Joi.required(),
            otherwise: Joi.optional().allow(null),
        })
        .messages({
            'number.base': 'El bonus por perfección debe ser un número entero',
            'number.min': 'El bonus por perfección debe ser al menos 0',
            'number.max': 'El bonus por perfección no puede exceder 100',
            'any.required': 'El bonus por perfección es requerido para preguntas de selección múltiple',
        }),
    options: Joi.when('type', {
        is: Joi.valid('numeric_approximation', 'word_scramble'),
        then: Joi.optional(),
        otherwise: Joi.array()
            .items(Joi.when('type', {
                is: 'order',
                then: orderOptionSchema,
                otherwise: optionSchema
            }))
            .min(LIMITS.MIN_OPTIONS)
            .max(LIMITS.MAX_OPTIONS)
            .required()
    })
        .messages({
            'array.min': `Debe haber al menos ${LIMITS.MIN_OPTIONS} opciones`,
            'array.max': `No puede haber más de ${LIMITS.MAX_OPTIONS} opciones`,
        }),
});

// Banco de preguntas (guardar)
const saveBankSchema = Joi.object({
    id: dbIdSchema.allow(null).optional(),
    name: nameSchema.required(),
    pin: pinSchema.allow(null, '').optional(),
    visible_to_presenter: Joi.boolean().default(true).optional(),
    use_streaks: Joi.boolean().default(false).optional(),
    streak_threshold: Joi.number().integer().min(1).max(20).default(3).optional(),
    streak_bonus_percentage: Joi.number().min(0).max(2).default(0.50).optional(),
    use_double_streaks: Joi.boolean().default(false).optional(),
    double_streak_threshold: Joi.number().integer().min(1).max(20).default(5).optional(),
    double_streak_bonus_percentage: Joi.number().min(0).max(2).default(1.00).optional(),
    questions: Joi.array()
        .items(questionSchema)
        .min(1)
        .max(LIMITS.MAX_QUESTIONS_PER_BANK)
        .required()
        .messages({
            'array.min': 'Debe haber al menos una pregunta',
            'array.max': `No puede haber más de ${LIMITS.MAX_QUESTIONS_PER_BANK} preguntas`,
        }),
});

// Crear banco (solo nombre)
const createBankSchema = Joi.object({
    name: nameSchema.required(),
});

// Configuración de banco en juego
const gameBankConfigSchema = Joi.object({
    bank_id: dbIdSchema.required(),
    question_count: Joi.number()
        .integer()
        .min(1)
        .max(LIMITS.MAX_QUESTIONS_PER_BANK)
        .required()
        .messages({
            'number.min': 'Debe seleccionar al menos 1 pregunta',
        }),
});

// Crear/Actualizar juego
const gameSchema = Joi.object({
    name: nameSchema.required(),
    pin: pinSchema.allow('').optional(),
    visible_to_presenter: Joi.boolean().default(true).optional(),
    use_streaks: Joi.boolean().default(false).optional(),
    streak_threshold: Joi.number().integer().min(1).max(20).default(3).optional(),
    streak_bonus_percentage: Joi.number().min(0).max(2).default(0.50).optional(),
    use_double_streaks: Joi.boolean().default(false).optional(),
    double_streak_threshold: Joi.number().integer().min(1).max(20).default(5).optional(),
    double_streak_bonus_percentage: Joi.number().min(0).max(2).default(1.00).optional(),
    banks: Joi.array()
        .items(gameBankConfigSchema)
        .min(1)
        .required()
        .messages({
            'array.min': 'Debe seleccionar al menos un banco de preguntas',
        }),
});

// Pregunta de juego personalizado
const customGameQuestionSchema = Joi.object({
    slide_type: Joi.string()
        .valid('question', 'comment', 'info', 'text', 'image', 'text-image')
        .default('question'),
    question_id: dbIdSchema.allow(null).when('slide_type', {
        is: 'question',
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),
    comment_text: Joi.string()
        .max(LIMITS.COMMENT_TEXT_MAX)
        .trim()
        .when('slide_type', {
            is: Joi.valid('comment', 'info'),
            then: Joi.required(),
            otherwise: Joi.allow(null, '').optional(),
        }),
    slide_title: Joi.string()
        .max(LIMITS.SLIDE_TITLE_MAX)
        .trim()
        .when('slide_type', {
            is: Joi.valid('text', 'text-image'),
            then: Joi.required(),
            otherwise: Joi.allow(null, '').optional(),
        }),
    slide_body: Joi.string()
        .max(LIMITS.SLIDE_BODY_MAX)
        .trim()
        .when('slide_type', {
            is: Joi.valid('text', 'text-image'),
            then: Joi.required(),
            otherwise: Joi.allow(null, '').optional(),
        }),
    slide_image: Joi.string()
        .max(2048)
        .trim()
        .when('slide_type', {
            is: Joi.valid('image', 'text-image'),
            then: Joi.required(),
            otherwise: Joi.allow(null, '').optional(),
        }),
    slide_image_position: Joi.string()
        .valid('left', 'right')
        .when('slide_type', {
            is: 'text-image',
            then: Joi.required(),
            otherwise: Joi.allow(null, '').optional(),
        }),
});

// Crear juego personalizado
const createCustomGameSchema = Joi.object({
    name: nameSchema.required(),
    pin: pinSchema.allow('').optional(),
    visible_to_presenter: Joi.boolean().default(true).optional(),
    use_streaks: Joi.boolean().default(false).optional(),
    streak_threshold: Joi.number().integer().min(1).max(20).default(3).optional(),
    streak_bonus_percentage: Joi.number().min(0).max(2).default(0.50).optional(),
    use_double_streaks: Joi.boolean().default(false).optional(),
    double_streak_threshold: Joi.number().integer().min(1).max(20).default(5).optional(),
    double_streak_bonus_percentage: Joi.number().min(0).max(2).default(1.00).optional(),
    questions: Joi.array()
        .items(customGameQuestionSchema)
        .min(0)
        .optional()
        .messages({
            'array.min': 'Debe haber al menos una pregunta o comentario',
        }),
});

// Actualizar juego personalizado
const updateCustomGameSchema = Joi.object({
    name: nameSchema.required(),
    pin: pinSchema.required(),
    visible_to_presenter: Joi.boolean().default(true).optional(),
    use_streaks: Joi.boolean().default(false).optional(),
    streak_threshold: Joi.number().integer().min(1).max(20).default(3).optional(),
    streak_bonus_percentage: Joi.number().min(0).max(2).default(0.50).optional(),
    use_double_streaks: Joi.boolean().default(false).optional(),
    double_streak_threshold: Joi.number().integer().min(1).max(20).default(5).optional(),
    double_streak_bonus_percentage: Joi.number().min(0).max(2).default(1.00).optional(),
    questions: Joi.array()
        .items(customGameQuestionSchema)
        .min(1)
        .required()
        .messages({
            'array.min': 'Debe haber al menos una pregunta o comentario',
        }),
});

// ===== ESQUEMAS DE WEBSOCKET =====

// Join lobby
const joinLobbySchema = Joi.object({
    pin: pinSchema.optional(), // PIN original (para validación en DB)
    sessionId: sessionIdSchema.optional(), // ID de sesión único (PIN-UUID)
    nickname: nicknameSchema.required(),
    playerId: uuidSchema.required(),
    // Optional for presenter reclaim hardening. When present, it is checked
    // server-side against the stored presenter secret.
    sessionSecret: Joi.string().allow('').optional(),
    isTeamMode: Joi.boolean().optional(), // Modo equipos (solo para HOST)
    teamConfig: Joi.object({
        teams: Joi.array().items(
            Joi.object({
                name: teamNameSchema.required(),
                color: Joi.string().required()
            })
        ).required()
    }).optional() // Configuración de equipos (solo para HOST)
}).or('pin', 'sessionId') // Al menos uno debe estar presente
    .messages({
        'object.missing': 'Se requiere pin o sessionId',
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
        teams: Joi.array().items(
            Joi.object({
                name: teamNameSchema.required(),
                color: Joi.string().required()
            })
        ).required()
    }).optional()
}).or('pin', 'sessionId')
    .messages({
        'object.missing': 'Se requiere pin o sessionId',
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

// Submit answer
const submitAnswerSchema = Joi.object({
    pin: pinSchema.optional(),
    sessionId: sessionIdSchema.optional(),
    nickname: nicknameSchema.required(),
    answerType: Joi.string()
        .valid('order', 'multiple_choice')
        .optional(),
    index: Joi.number()
        .integer()
        .min(0)
        .max(LIMITS.MAX_OPTIONS - 1)
        .optional()
        .messages({
            'number.min': 'Índice de respuesta inválido',
            'number.max': 'Índice de respuesta inválido',
        }),
    order: Joi.array()
        .items(Joi.number().integer().min(0).max(LIMITS.MAX_OPTIONS - 1))
        .min(LIMITS.MIN_OPTIONS)
        .max(LIMITS.MAX_OPTIONS)
        .optional()
        .messages({
            'array.min': `Debe haber al menos ${LIMITS.MIN_OPTIONS} opciones`,
            'array.max': `No puede haber más de ${LIMITS.MAX_OPTIONS} opciones`,
        }),
    selectedIndices: Joi.array()
        .items(Joi.number().integer().min(0).max(LIMITS.MAX_OPTIONS - 1))
        .min(1)
        .max(6)
        .optional()
        .messages({
            'array.min': 'Debe seleccionar al menos 1 opción',
            'array.max': 'No puede seleccionar más de 6 opciones',
        })
}).or('pin', 'sessionId');

// Manual points (soporta nickname único o array de nicknames para equipos)
const manualPointsSchema = Joi.object({
    pin: pinSchema.optional(),
    sessionId: sessionIdSchema.optional(),
    nickname: nicknameSchema.optional(),
    nicknames: Joi.array()
        .items(nicknameSchema)
        .min(1)
        .max(50)
        .optional()
        .messages({
            'array.min': 'Debe haber al menos un jugador',
            'array.max': 'No se pueden asignar puntos a más de 50 jugadores a la vez',
        }),
    points: Joi.number()
        .integer()
        .min(-1000)
        .max(1000)
        .required()
        .messages({
            'number.min': 'Puntos fuera de rango permitido',
            'number.max': 'Puntos fuera de rango permitido',
        }),
}).or('pin', 'sessionId').or('nickname', 'nicknames');

// FASE 1 - Semana 3: Nuevos schemas para eventos sin validación

// Leave lobby
const leaveLobbySchema = Joi.object({
    playerId: uuidSchema.optional(),
    roomId: Joi.alternatives().try(pinSchema, sessionIdSchema).optional(),
});

// Select team
const selectTeamSchema = Joi.object({
    pin: pinSchema.optional(),
    sessionId: sessionIdSchema.optional(),
    nickname: nicknameSchema.required(),
    teamIndex: Joi.number()
        .integer()
        .min(0)
        .max(10)
        .required()
        .messages({
            'number.min': 'Índice de equipo inválido',
            'number.max': 'Índice de equipo inválido (máximo 10 equipos)',
        }),
}).or('pin', 'sessionId');

// Start game
const startGameSchema = Joi.object({
    roomIdOrPin: Joi.alternatives()
        .try(pinSchema, sessionIdSchema)
        .required()
        .messages({
            'alternatives.match': 'Se requiere un PIN o session ID válido',
        }),
});

// Next question
const nextQuestionSchema = Joi.object({
    roomIdOrPin: Joi.alternatives()
        .try(pinSchema, sessionIdSchema)
        .required()
        .messages({
            'alternatives.match': 'Se requiere un PIN o session ID válido',
        }),
});

// Pause timer
const pauseTimerSchema = Joi.object({
    roomIdOrPin: Joi.alternatives()
        .try(pinSchema, sessionIdSchema)
        .required()
        .messages({
            'alternatives.match': 'Se requiere un PIN o session ID válido',
        }),
});

// Resume timer
const resumeTimerSchema = Joi.object({
    roomIdOrPin: Joi.alternatives()
        .try(pinSchema, sessionIdSchema)
        .required()
        .messages({
            'alternatives.match': 'Se requiere un PIN o session ID válido',
        }),
});

// Get current state
const getCurrentStateSchema = Joi.object({
    playerId: uuidSchema.required(),
    roomId: Joi.alternatives()
        .try(pinSchema, sessionIdSchema)
        .required()
        .messages({
            'alternatives.match': 'Se requiere un PIN o session ID válido',
        }),
});

// Reconnect presenter
const reconnectPresenterSchema = Joi.object({
    playerId: uuidSchema.required(),
    token: Joi.string().allow('').optional(),
    sessionId: sessionIdSchema.optional(),
});

// End game (manual)
const endGameSchema = Joi.object({
    roomIdOrPin: Joi.alternatives()
        .try(pinSchema, sessionIdSchema)
        .required()
        .messages({
            'alternatives.match': 'Se requiere un PIN o session ID válido',
        }),
    reason: Joi.string()
        .valid('manual', 'emergency', 'cancelled')
        .default('manual')
        .messages({
            'any.only': 'Razón de finalización inválida',
        }),
});

// Abandon game (presenter hard stop)
const abandonGameSchema = Joi.object({
    roomIdOrPin: Joi.alternatives()
        .try(pinSchema, sessionIdSchema)
        .required()
        .messages({
            'alternatives.match': 'Se requiere un PIN o session ID válido',
        }),
    reason: Joi.string()
        .valid('abandoned', 'concluded')
        .default('abandoned')
        .messages({
            'any.only': 'Razón de abandono inválida',
        }),
});

// Validar PIN query param
const validatePinQuerySchema = Joi.object({
    pin: pinSchema.required(),
    excludeId: dbIdSchema.optional(),
});

// Mezclar bancos de preguntas
const mergeBanksSchema = Joi.object({
    bankIds: Joi.array()
        .items(dbIdSchema)
        .min(2)
        .required()
        .messages({
            'array.min': 'Debes seleccionar al menos 2 bancos para mezclar',
            'array.base': 'bankIds debe ser un array',
        }),
    name: nameSchema.required(),
    pin: pinSchema.allow(null, '').optional(),
    visible_to_presenter: Joi.boolean().default(true).optional(),
    use_streaks: Joi.boolean().default(false).optional(),
    streak_threshold: Joi.number().integer().min(1).max(20).default(3).optional(),
    streak_bonus_percentage: Joi.number().min(0).max(2).default(0.50).optional(),
    use_double_streaks: Joi.boolean().default(false).optional(),
    double_streak_threshold: Joi.number().integer().min(1).max(20).default(5).optional(),
    double_streak_bonus_percentage: Joi.number().min(0).max(2).default(1.00).optional(),
});

// ===== FUNCIONES DE VALIDACIÓN =====

/**
 * Valida datos contra un esquema Joi
 * @param {Object} schema - Esquema Joi
 * @param {Object} data - Datos a validar
 * @returns {{ value: Object, error: string|null }}
 */
function validate(schema, data) {
    const { value, error } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const messages = error.details.map(d => d.message).join('. ');
        return { value: null, error: messages };
    }

    return { value, error: null };
}

const SENSITIVE_LOG_KEY_PATTERN = /(password|token|secret|authorization|cookie|smtp|jwt|api[_-]?key|passphrase)/i;

function sanitizeForLogs(value, key = '') {
    if (SENSITIVE_LOG_KEY_PATTERN.test(String(key))) {
        return '[REDACTED]';
    }

    if (value === null || value === undefined) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map(item => sanitizeForLogs(item, key));
    }

    if (typeof value === 'object') {
        const sanitized = {};
        for (const [entryKey, entryValue] of Object.entries(value)) {
            sanitized[entryKey] = sanitizeForLogs(entryValue, entryKey);
        }
        return sanitized;
    }

    return value;
}

/**
 * Middleware Express para validar body
 * @param {Object} schema - Esquema Joi
 */
function validateBody(schema) {
    return (req, res, next) => {
        const { value, error } = validate(schema, req.body);
        if (error) {
            const logger = require('./config/logger');
            logger.warn('Validation error in request body', {
                endpoint: req.path,
                method: req.method,
                error: error,
                body: sanitizeForLogs(req.body)
            });
            return res.status(400).json({
                error: 'Datos inválidos',
                message: error,
                details: error.split('. ') // Desglosar los errores for debugging
            });
        }
        req.body = value; // Usar datos sanitizados
        next();
    };
}

/**
 * Middleware Express para validar query params
 * @param {Object} schema - Esquema Joi
 */
function validateQuery(schema) {
    return (req, res, next) => {
        const { value, error } = validate(schema, req.query);
        if (error) {
            return res.status(400).json({
                error: 'Parámetros inválidos',
                message: error,
            });
        }
        req.query = value;
        next();
    };
}

/**
 * Middleware Express para validar params de URL
 * @param {Object} schema - Esquema Joi
 */
function validateParams(schema) {
    return (req, res, next) => {
        const { value, error } = validate(schema, req.params);
        if (error) {
            return res.status(400).json({
                error: 'Parámetros de URL inválidos',
                message: error,
            });
        }
        req.params = value;
        next();
    };
}

/**
 * Valida datos de WebSocket y retorna resultado
 * @param {Object} schema - Esquema Joi
 * @param {Object} data - Datos del evento
 * @returns {{ valid: boolean, value: Object|null, error: string|null }}
 */
function validateSocket(schema, data) {
    const { value, error } = validate(schema, data);
    return {
        valid: !error,
        value,
        error,
    };
}

// ===== EXPORTACIONES =====
module.exports = {
    // Constantes
    LIMITS,

    // Esquemas
    schemas: {
        // Auth
        login: loginSchema,
        register: registerSchema,
        changePassword: changePasswordSchema,
        passwordResetRequest: passwordResetRequestSchema,
        passwordResetConfirm: passwordResetConfirmSchema,
        changeEmailRequest: changeEmailRequestSchema,
        userLicense: userLicenseSchema,
        userLicenseCheckout: userLicenseCheckoutSchema,
        licenseExemption: licenseExemptionSchema,

        // Bancos
        createBank: createBankSchema,
        saveBank: saveBankSchema,
        mergeBanks: mergeBanksSchema,
        validatePinQuery: validatePinQuerySchema,

        // Juegos
        game: gameSchema,

        // Juegos personalizados
        createCustomGame: createCustomGameSchema,
        updateCustomGame: updateCustomGameSchema,

        // WebSocket
        joinLobby: joinLobbySchema,
        joinPresenterLobby: joinPresenterLobbySchema,
        reconnectPlayer: reconnectPlayerSchema,
        submitAnswer: submitAnswerSchema,
        manualPoints: manualPointsSchema,

        // FASE 1 - Semana 3: Nuevos schemas
        leaveLobby: leaveLobbySchema,
        selectTeam: selectTeamSchema,
        startGame: startGameSchema,
        nextQuestion: nextQuestionSchema,
        pauseTimer: pauseTimerSchema,
        resumeTimer: resumeTimerSchema,
        getCurrentState: getCurrentStateSchema,
        reconnectPresenter: reconnectPresenterSchema,
        endGame: endGameSchema,
        abandonGame: abandonGameSchema,

        // Comunes
        dbId: dbIdSchema,
        pin: pinSchema,
        nickname: nicknameSchema,
    },

    // Funciones
    validate,
    validateBody,
    validateQuery,
    validateParams,
    validateSocket,
};
