/**
 * @fileoverview Logger estructurado con Winston
 * Proporciona logging con niveles, formato JSON y rotación de archivos
 */

const winston = require('winston');
const path = require('path');
require('winston-daily-rotate-file');
const Transport = require('winston-transport');

const { NODE_ENV } = require('./constants');
const { getLogsBufferService } = require('../services/logs-buffer.service');

// Definir niveles personalizados con colores
const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        debug: 4
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        http: 'magenta',
        debug: 'cyan'
    }
};

// Aplicar colores
winston.addColors(customLevels.colors);

// ─── Filtro de campos sensibles ──────────────────────────────────────────────
// Nunca se registran en consola ni en ficheros: password, token, JWT_SECRET,
// authorization, cookie, secret, apikey, etc.
const SENSITIVE_LOG_KEYS = new Set([
    'password', 'token', 'authorization', 'jwt_secret', 'jwt',
    'secret', 'cookie', 'apikey', 'api_key', 'x-api-key', 'x_api_key'
]);

function deepMaskSensitive(obj, depth = 0) {
    if (depth > 10 || obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => deepMaskSensitive(item, depth + 1));
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (SENSITIVE_LOG_KEYS.has(key.toLowerCase())) {
            result[key] = '***REDACTED***';
        } else if (typeof value === 'object') {
            result[key] = deepMaskSensitive(value, depth + 1);
        } else {
            result[key] = value;
        }
    }
    return result;
}

const sensitiveFieldsMask = winston.format((info) => {
    const { message: _message, level: _level, timestamp: _timestamp, ...metadata } = info;
    const masked = deepMaskSensitive(metadata);
    return Object.assign(Object.create(Object.getPrototypeOf(info)), info, masked);
});
// ─────────────────────────────────────────────────────────────────────────────

// Formato para consola (desarrollo)
const consoleFormat = winston.format.combine(
    sensitiveFieldsMask(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, workerId, pid: _pid, ...metadata }) => {
        let msg = `${timestamp}`;

        // Agregar workerId si está disponible
        if (workerId !== undefined) {
            msg += ` [Worker ${workerId}]`;
        }

        msg += ` [${level}] ${message}`;

        // Agregar metadata si existe
        if (Object.keys(metadata).length > 0) {
            // Filtrar campos internos de winston
            const filteredMetadata = Object.keys(metadata)
                .filter(key => !['level', 'timestamp', 'Symbol(level)', 'Symbol(message)'].includes(key))
                .reduce((obj, key) => {
                    obj[key] = metadata[key];
                    return obj;
                }, {});

            if (Object.keys(filteredMetadata).length > 0) {
                msg += ` ${JSON.stringify(filteredMetadata)}`;
            }
        }

        return msg;
    })
);

// Formato para archivos (producción) - JSON estructurado
const fileFormat = winston.format.combine(
    sensitiveFieldsMask(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Asegurar que los overrides persistidos (runtime-overrides.json) estén aplicados
// antes de leer LOG_LEVEL. runtime-config no depende de logger → sin dependencia circular.
require('./runtime-config');

// Obtener nivel de log desde variable de entorno (ya con overrides aplicados)
const logLevel = process.env.LOG_LEVEL || 'info';

// Crear transports según el entorno
const transports = [];

// Siempre loguear a consola
transports.push(
    new winston.transports.Console({
        format: consoleFormat,
        level: logLevel
    })
);

// En producción, agregar archivos con rotación
if (NODE_ENV === 'production') {
    // Logs de error (separados) - CRÍTICO
    transports.push(
        new winston.transports.DailyRotateFile({
            filename: path.join(__dirname, '../logs/error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            format: fileFormat,
            maxSize: '10m', // Reducido de 20m a 10m
            maxFiles: '7d',  // Reducido de 14d a 7d para NAS
            zippedArchive: true
        })
    );

    // Logs de warn (separados) - IMPORTANTE
    transports.push(
        new winston.transports.DailyRotateFile({
            filename: path.join(__dirname, '../logs/warn-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'warn',
            format: fileFormat,
            maxSize: '5m',
            maxFiles: '3d',
            zippedArchive: true
        })
    );

    // NOTA: En producción NO escribimos logs 'info' a disco para reducir I/O del NAS.
    // Los logs 'info' solo van a consola (stdout) y PM2 los maneja.
}

// Custom transport para buffer en Redis (logs en vivo compartidos entre workers)
class BufferTransport extends Transport {
    constructor(opts) {
        super(opts);
        this.bufferService = null; // Lazy initialization
        this.bufferServicePromise = null;
    }

    _getBufferService() {
        if (this.bufferService) {
            return Promise.resolve(this.bufferService);
        }

        if (!this.bufferServicePromise) {
            this.bufferServicePromise = Promise.resolve(getLogsBufferService(1000))
                .then(service => {
                    this.bufferService = service;
                    return service;
                })
                .catch(err => {
                    process.stderr.write(`BufferTransport: Failed to get logs buffer service ${err.message}\n`);
                    this.bufferServicePromise = null;
                    throw err;
                });
        }

        return this.bufferServicePromise;
    }

    log(info, callback) {
        setImmediate(() => {
            this.emit('logged', info);
        });

        const maskedInfo = deepMaskSensitive(info);

        // Añadir al buffer de Redis de forma asíncrona (fire-and-forget)
        Promise.resolve(this._getBufferService())
            .then(service => {
                return service.add({
                    level: maskedInfo.level,
                    message: maskedInfo.message,
                    timestamp: maskedInfo.timestamp,
                    metadata: maskedInfo
                });
            })
            .catch(err => {
                // Silenciar errores del buffer para no romper el logging principal
                process.stderr.write(`BufferTransport error: ${err.message}\n`);
            });

        callback();
    }
}

// Añadir buffer transport (siempre activo para logs en vivo, en Redis no en disco)
// Usa LOG_LEVEL en todos los entornos: la restricción a 'warn' en producción
// solo aplica a los ficheros de disco (ver nota arriba), no al visor en vivo.
transports.push(new BufferTransport({ level: logLevel }));

// Crear logger
const logger = winston.createLogger({
    levels: customLevels.levels,
    defaultMeta: {
        workerId: process.env.NODE_APP_INSTANCE || 'unknown',
        pid: process.pid
    },
    transports,
    exitOnError: false // No salir en errores no capturados
});

// Helpers para logging de diferentes tipos de eventos
logger.socket = (action, data) => {
    logger.info('Socket Event', {
        type: 'socket',
        action,
        ...data
    });
};

logger.db = (action, data) => {
    logger.debug('Database Operation', {
        type: 'database',
        action,
        ...data
    });
};

logger.game = (action, data) => {
    logger.info('Game Event', {
        type: 'game',
        action,
        ...data
    });
};

logger.auth = (action, data) => {
    logger.info('Auth Event', {
        type: 'auth',
        action,
        ...data
    });
};

logger.security = (action, data) => {
    logger.warn('Security Event', {
        type: 'security',
        action,
        ...data
    });
};

// Performance logging
logger.performance = (operation, duration, metadata = {}) => {
    logger.http('Performance', {
        type: 'performance',
        operation,
        duration_ms: duration,
        ...metadata
    });
};

// Stream para Morgan (HTTP logging)
logger.stream = {
    write: (message) => logger.http(message.trim())
};

/**
 * Cambia el nivel de log en tiempo de ejecución (sin reiniciar el servidor).
 * Actualiza el logger y todos sus transports.
 */
logger.setLogLevel = (newLevel) => {
    logger.level = newLevel;
    logger.transports.forEach(t => { t.level = newLevel; });
};

logger.isDebugEnabled = () => {
    return customLevels.levels[logger.level] >= customLevels.levels.debug;
};

module.exports = logger;
