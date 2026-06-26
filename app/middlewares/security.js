/**
 * @fileoverview Middlewares de seguridad (Helmet, CORS, Rate Limiting)
 */

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const runtimeConfig = require('../config/runtime-config');
const { DEFAULT_ORIGINS, parseOriginList } = require('../config/origin-list');
const { getRedisClient, isRedisAvailable } = require('../config/redis');

/**
 * Obtiene logger de forma lazy para evitar dependencia circular
 * @private
 */
function getLogger() {
    try {
        return require('../config/logger');
    } catch (err) {
        return console;
    }
}

function parseBooleanFlag(value) {
    const explicit = String(value || '').trim().toLowerCase();
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    return null;
}

function shouldFailClosedLimiter(envVarName) {
    const explicit = parseBooleanFlag(process.env[envVarName]);
    if (explicit !== null) return explicit;

    const global = parseBooleanFlag(process.env.SENSITIVE_LIMITERS_FAIL_CLOSED);
    if (global !== null) return global;

    return process.env.NODE_ENV === 'production';
}

function shouldFailClosedLoginLimiter() {
    return shouldFailClosedLimiter('LOGIN_LIMITER_FAIL_CLOSED');
}

function shouldFailClosedPanicRestartLimiter() {
    return shouldFailClosedLimiter('PANIC_RESTART_LIMITER_FAIL_CLOSED');
}

function shouldFailClosedAccountMutationLimiter() {
    return shouldFailClosedLimiter('ACCOUNT_MUTATION_LIMITER_FAIL_CLOSED');
}

function shouldFailClosedPresenterPinsLimiter() {
    return shouldFailClosedLimiter('PRESENTER_PINS_LIMITER_FAIL_CLOSED');
}

function getAllowedCorsOrigins() {
    return parseOriginList(runtimeConfig.get('CORS_ORIGIN'), DEFAULT_ORIGINS);
}

/**
 * Configura Helmet para seguridad HTTP
 */
const configureHelmet = () => {
    return (req, res, next) => {
        // Extraer host de Umami de forma dinámica
        const umamiUrl = runtimeConfig.get('UMAMI_SERVER_URL');
        let umamiHost = '';
        if (umamiUrl) {
            try {
                umamiHost = new URL(umamiUrl).origin;
            } catch (e) {
                // Ignore invalid URL
            }
        }

        // Extraer orígenes WS permitidos desde CORS
        const allowedOrigins = getAllowedCorsOrigins();
        const wsOrigins = allowedOrigins.map(o => {
            try {
                const u = new URL(o);
                return (u.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + u.host;
            } catch (e) { return ''; }
        }).filter(Boolean);

        const scriptSrc = [
            '\'self\'',
            'https://cdnjs.cloudflare.com',
            'https://cdn.jsdelivr.net',
            'https://appsforoffice.microsoft.com',
            // Inline <script> blocks (hashes calculados sin whitespace strip)
            '\'sha256-kFqSCZo0ilAnq5DWM22z6cLoTm9NnVlsj22FttxlMeY=\'', // presentador.html L55: playerId
            '\'sha256-5BX3O2TUKJjWd+tx8lwWOsz5mcSyRjQHbccKr0d1rc8=\'', // presentador.html L79: loader timer
            '\'sha256-OfhqrFMR6qqwC7YY1k29dFBtDCJRjDn4uO4X58+3kzw=\'', // presentador.html L182: fireworks sound + ui-settings
            // index.html: inline script moved to /js/core/index-init.js (served from 'self')
            '\'sha256-crohukbLplnIHj8edMMOcYjlkk4PvtIugzYuH+gMzSQ=\'', // tv.html: playerId
            '\'sha256-vTn/awFFDzR64Qc8YcBgdBdumGtduNXODPeaqT7FIFc=\'', // contact.html: form handler
            '\'sha256-cxxpClMEX/wv6RWwz6Y1F0amAkNF0A1RcbfTz0sbqg0=\'', // juego-concluido.html / juego-finalizado-presentador.html
            '\'sha256-GN5mcXaPICRaVYTyha8rvCUnuZOH8P7yITutSD0PRK4=\'', // ppt-redirect.html
            '\'sha256-ul/v0CisU7Zqw8SY+9SvXyoYEdITat4Z8gaRKnu25ak=\'', // fireworks-preview.html
            '\'sha256-mZePbndl4uPdyeeTQsFi6cXwv6oogpzP1E8QIml4rXY=\'', // xiro-results-viewer.html
        ];
        if (umamiHost) scriptSrc.push(umamiHost);

        const connectSrc = [
            '\'self\'',
            'ws://localhost:*',
            ...wsOrigins,
            'https://api-gateway.umami.dev', // Umami analytics endpoint
            'https://cdn.jsdelivr.net',      // qr-code-styling sourcemaps
        ];
        if (umamiHost) connectSrc.push(umamiHost);

        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ['\'self\''],
                    scriptSrc: [...scriptSrc, '\'unsafe-inline\'', '\'unsafe-eval\''],
                    scriptSrcAttr: ['\'none\''],
                    styleSrc: [
                        '\'self\'',
                        'https://cdnjs.cloudflare.com',
                        'https://fonts.googleapis.com',
                        '\'unsafe-inline\'',  // Requerido por bloques <style> y atributos style=""
                    ],
                    fontSrc: [
                        '\'self\'',
                        'https://cdnjs.cloudflare.com',
                        'https://fonts.gstatic.com',
                    ],
                    connectSrc: connectSrc,
                    imgSrc: ['\'self\'', 'data:', 'blob:'],
                    objectSrc: ['\'none\''],
                    baseUri: ['\'self\''],
                },
            },
            crossOriginEmbedderPolicy: false,
            // cross-origin allows assets to be loaded by the add-in WebView
            crossOriginResourcePolicy: { policy: 'cross-origin' },
            frameguard: { action: 'sameorigin' },
            // cross-origin-opener-policy: same-origin no es necesario para esta app
            crossOriginOpenerPolicy: false,
        })(req, res, next);
    };
};

/**
 * Configura CORS para permitir requests desde dominios autorizados
 */
const configureCORS = () => {
    return cors({
        origin: (origin, callback) => {
            const allowedOrigins = getAllowedCorsOrigins();

            // Permitir requests sin origin (Postman, curl, mobile apps nativas,
            // y PowerPoint Desktop cuyo WebView no envía origin)
            if (!origin) {
                return callback(null, true);
            }

            // Verificar lista explícita o dominio del add-in de PowerPoint
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                getLogger().warn(`CORS bloqueado: origin="${origin}" no está en la lista permitida`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    });
};

let redisClient = null;
let redisLoginLimiter = null;
let redisPanicRestartLimiter = null;
let redisAccountMutationLimiter = null;
let redisPresenterPinsLimiter = null;
let redisPinValidationLimiter = null;

function createRedisLimiter(config, prefix) {
    const storeOptions = {
        sendCommand: (...args) => redisClient.sendCommand(args)
    };

    if (prefix) {
        storeOptions.prefix = prefix;
    }

    return rateLimit({
        ...config,
        store: new RedisStore(storeOptions)
    });
}

const loginLimiterConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 intentos por ventana
    message: {
        error: 'Demasiados intentos de login',
        message: 'Has excedido el número de intentos permitidos. Intenta de nuevo en 15 minutos.',
        code: 'LOGIN_RATE_LIMITED',
        params: { minutes: 15 }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
    }
};

const panicRestartLimiterConfig = {
    windowMs: 10 * 60 * 1000, // 10 minutos
    max: 2, // máximo 2 reinicios por ventana
    message: {
        error: 'Rate limit excedido',
        message: 'Solo se permiten 2 reinicios cada 10 minutos. Espera antes de intentarlo de nuevo.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || (req.connection && req.connection.remoteAddress) || 'unknown'
};

const accountMutationLimiterConfig = {
    windowMs: 10 * 60 * 1000, // 10 minutos
    max: 6, // evitar abuso de cambios sensibles por cuenta
    message: {
        error: 'Demasiadas solicitudes',
        message: 'Has excedido el número de intentos permitidos para operaciones de cuenta. Intenta de nuevo en unos minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        const userId = req.user?.userId || 'anonymous';
        return `${ip}:${userId}`;
    }
};

const pinValidationLimiterConfig = {
    windowMs: 60 * 1000, // 1 minuto
    max: 40, // suficiente para uso legítimo (edición rápida); bloquea enumeración
    message: {
        error: 'Demasiadas solicitudes',
        message: 'Has excedido el límite de validaciones de PIN. Intenta de nuevo en un minuto.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || (req.connection && req.connection.remoteAddress) || 'unknown'
};

const presenterPinsLimiterConfig = {
    windowMs: 60 * 1000, // 1 minuto
    max: 30,
    message: {
        error: 'Demasiadas solicitudes',
        message: 'Has excedido el límite de consultas de PINs visibles. Intenta de nuevo en un minuto.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || (req.connection && req.connection.remoteAddress) || 'unknown'
};

const memoryPanicRestartLimiter = rateLimit(panicRestartLimiterConfig);
const memoryAccountMutationLimiter = rateLimit(accountMutationLimiterConfig);
const memoryPresenterPinsLimiter = rateLimit(presenterPinsLimiterConfig);
const memoryPinValidationLimiter = rateLimit(pinValidationLimiterConfig);
const memoryLoginLimiter = rateLimit(loginLimiterConfig);

if (process.env.NODE_ENV !== 'test') {
    void getRedisClient()
        .then((client) => {
            redisClient = client;
            redisLoginLimiter = createRedisLimiter(loginLimiterConfig);
            redisPanicRestartLimiter = createRedisLimiter(panicRestartLimiterConfig, 'rl:panic:');
            redisAccountMutationLimiter = createRedisLimiter(accountMutationLimiterConfig, 'rl:account:');
            redisPresenterPinsLimiter = createRedisLimiter(presenterPinsLimiterConfig, 'rl:presenter-pins:');
            redisPinValidationLimiter = createRedisLimiter(pinValidationLimiterConfig, 'rl:pin-val:');
        })
        .catch((error) => {
            // Usar getLogger con fallback a stderr si logger no está disponible
            const log = getLogger();
            if (typeof log.warn === 'function') {
                log.warn('Rate limit Redis unavailable; using memory store', { error: error.message });
            } else {
                process.stderr.write(`Rate limit Redis unavailable; using memory store ${error.message}\n`);
            }
        });
}

/**
 * Rate limiter agresivo para panic-restart / reload-server (DoS de aplicación)
 */
const panicRestartLimiter = (req, res, next) => {
    if (redisClient && isRedisAvailable() && redisPanicRestartLimiter) {
        return redisPanicRestartLimiter(req, res, next);
    }

    if (shouldFailClosedPanicRestartLimiter()) {
        const log = getLogger();
        if (typeof log.error === 'function') {
            log.error('Panic restart limiter fail-closed: Redis backend unavailable', {
                ip: req.ip || req.connection.remoteAddress
            });
        }

        return res.status(503).json({
            error: 'Servicio temporalmente no disponible',
            message: 'El control de reinicios protegidos no está disponible en este momento. Inténtalo más tarde.'
        });
    }

    return memoryPanicRestartLimiter(req, res, next);
};

/**
 * Rate limiter para login (prevenir fuerza bruta)
 */
const loginLimiter = (req, res, next) => {
    if (redisClient && isRedisAvailable() && redisLoginLimiter) {
        return redisLoginLimiter(req, res, next);
    }

    if (shouldFailClosedLoginLimiter()) {
        const log = getLogger();
        if (typeof log.error === 'function') {
            log.error('Login limiter fail-closed: Redis backend unavailable', {
                ip: req.ip || req.connection.remoteAddress
            });
        }

        return res.status(503).json({
            error: 'Servicio temporalmente no disponible',
            message: 'El control de intentos de acceso no está disponible en este momento. Inténtalo más tarde.'
        });
    }

    return memoryLoginLimiter(req, res, next);
};

/**
 * Resetea el contador del rate limiter de login.
 * Se llama tras un inicio de sesión exitoso.
 */
const resetLoginLimiter = (req) => {
    const key = loginLimiterConfig.keyGenerator(req, null);
    if (redisClient && isRedisAvailable() && redisLoginLimiter) {
        if (typeof redisLoginLimiter.resetKey === 'function') {
            redisLoginLimiter.resetKey(key);
        }
    } else {
        if (typeof memoryLoginLimiter.resetKey === 'function') {
            memoryLoginLimiter.resetKey(key);
        }
    }
};

/**
 * Rate limiter para operaciones sensibles de cuenta autenticada
 */
const accountMutationLimiter = (req, res, next) => {
    if (redisClient && isRedisAvailable() && redisAccountMutationLimiter) {
        return redisAccountMutationLimiter(req, res, next);
    }

    if (shouldFailClosedAccountMutationLimiter()) {
        const log = getLogger();
        if (typeof log.error === 'function') {
            log.error('Account mutation limiter fail-closed: Redis backend unavailable', {
                ip: req.ip || req.connection.remoteAddress,
                userId: req.user?.userId || 'anonymous'
            });
        }

        return res.status(503).json({
            error: 'Servicio temporalmente no disponible',
            message: 'El control de frecuencia para operaciones de cuenta no está disponible. Inténtalo más tarde.'
        });
    }

    return memoryAccountMutationLimiter(req, res, next);
};

/**
 * Rate limiter para descubrimiento de PINs visibles al presentador.
 */
const presenterPinsLimiter = (req, res, next) => {
    if (redisClient && isRedisAvailable() && redisPresenterPinsLimiter) {
        return redisPresenterPinsLimiter(req, res, next);
    }

    if (shouldFailClosedPresenterPinsLimiter()) {
        const log = getLogger();
        if (typeof log.error === 'function') {
            log.error('Presenter pins limiter fail-closed: Redis backend unavailable', {
                ip: req.ip || req.connection.remoteAddress
            });
        }

        return res.status(503).json({
            error: 'Servicio temporalmente no disponible',
            message: 'El control de consultas de PIN visibles no está disponible en este momento. Inténtalo más tarde.'
        });
    }

    return memoryPresenterPinsLimiter(req, res, next);
};

/**
 * Rate limiter para endpoints de validación de PIN (previene enumeración de PINs).
 */
const pinValidationLimiter = (req, res, next) => {
    if (redisClient && isRedisAvailable() && redisPinValidationLimiter) {
        return redisPinValidationLimiter(req, res, next);
    }

    return memoryPinValidationLimiter(req, res, next);
};

// Compatibilidad de tests/utilidades: exponer opciones base del limiter
loginLimiter.options = loginLimiterConfig;

module.exports = {
    configureHelmet,
    configureCORS,
    loginLimiter,
    resetLoginLimiter,
    panicRestartLimiter,
    accountMutationLimiter,
    presenterPinsLimiter,
    pinValidationLimiter
};
