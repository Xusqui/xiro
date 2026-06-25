/**
 * @fileoverview Inicialización y configuración de Socket.io
 * 
 * Arquitectura sin sticky sessions:
 * - Redis Adapter sincroniza estado entre workers
 * - Clientes pueden conectarse a cualquier worker
 * - Events y rooms se propagan automáticamente
 */

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const {
    NODE_ENV
} = require('../config/constants');
const runtimeConfig = require('../config/runtime-config');
const { DEFAULT_ORIGINS, parseOriginList } = require('../config/origin-list');
const logger = require('../config/logger');
const { getWorkerContext } = require('../config/log-context');
const { initializeEventHandlers } = require('../domain/events/handlers/bootstrap');
const { activeGames, cleanupStaleSessions } = require('../state/globalState');

function createSocketServer(server) {
    return new Server(server, {
        pingTimeout: 60000,
        pingInterval: 25000,
        connectTimeout: 45000,
        maxHttpBufferSize: 1e6,
        cors: {
            origin: true,
            methods: ['GET', 'POST'],
            credentials: true,
            allowedHeaders: ['*']
        },
        transports: ['websocket'],
        allowUpgrades: false,
        upgradeTimeout: 30000,
        perMessageDeflate: false
    });
}

function createRedisAdapterClients() {
    const pubClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD || undefined,
        socket: {
            reconnectStrategy: (retries) => {
                if (retries % 10 === 0) {
                    logger.warn('Redis reconnecting (socket adapter)', { retries });
                }
                return Math.min(retries * 100, 3000);
            }
        }
    });

    return {
        pubClient,
        subClient: pubClient.duplicate()
    };
}

function attachRedisAdapterEventHandlers(pubClient, subClient) {
    pubClient.on('error', (err) => logger.error('Redis pub client error', err));
    subClient.on('error', (err) => logger.error('Redis sub client error', err));
    pubClient.on('end', () => logger.error('Redis pub client ended (adapter unavailable)'));
    subClient.on('end', () => logger.error('Redis sub client ended (adapter unavailable)'));
}

async function connectRedisAdapter(io, pubClient, subClient) {
    try {
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));

        logger.info('✅ Socket.IO initialized with Redis Adapter', {
            ...getWorkerContext({ mode: 'cluster' }),
            redis: process.env.REDIS_URL || 'redis://localhost:6379'
        });
    } catch (err) {
        logger.error('Failed to connect Redis', err);
        logger.warn('Socket.IO will work without adapter (single instance only)');
    }
}

function getClientIp(socket) {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return socket.handshake.address;
}

async function isRedisIpRateLimited(pubClient, ip, ipConnWindow, ipConnLimit) {
    try {
        if (!pubClient?.isReady) {
            return null;
        }

        const key = `socketio:ip:${ip}`;
        const count = await pubClient.incr(key);
        if (count === 1) {
            await pubClient.expire(key, ipConnWindow);
        }

        if (count > ipConnLimit) {
            logger.warn('Socket.IO IP rate limit exceeded', { ip, count });
            return true;
        }

        return false;
    } catch (_) {
        return null;
    }
}

function isMemoryIpRateLimited(ipConnCounts, ip, ipConnLimit) {
    const count = (ipConnCounts.get(ip) || 0) + 1;
    ipConnCounts.set(ip, count);

    if (count > ipConnLimit) {
        logger.warn('Socket.IO IP rate limit exceeded (in-memory)', { ip, count });
        return true;
    }

    return false;
}

function setupIpRateLimitMiddleware(io, pubClient) {
    const ipConnLimit = parseInt(process.env.SOCKETIO_IP_CONN_LIMIT, 10) || 30;
    const ipConnWindow = parseInt(process.env.SOCKETIO_IP_CONN_WINDOW, 10) || 60;
    const ipConnCounts = new Map();
    const ipCleanupInterval = setInterval(function () {
        ipConnCounts.clear();
    }, ipConnWindow * 1000);

    if (ipCleanupInterval.unref) {
        ipCleanupInterval.unref();
    }

    io.use(async (socket, next) => {
        const ip = getClientIp(socket);
        const redisLimited = await isRedisIpRateLimited(pubClient, ip, ipConnWindow, ipConnLimit);

        if (redisLimited === true) {
            return next(new Error('Too many connections'));
        }

        if (redisLimited === false) {
            return next();
        }

        if (isMemoryIpRateLimited(ipConnCounts, ip, ipConnLimit)) {
            return next(new Error('Too many connections'));
        }

        return next();
    });
}

function isBotUserAgent(userAgent) {
    const botKeywords = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget'];
    return botKeywords.some(kw => userAgent.toLowerCase().includes(kw));
}

function getAllowedSocketOrigins() {
    return parseOriginList(runtimeConfig.get('ALLOWED_ORIGINS'), DEFAULT_ORIGINS);
}

function setupOriginValidationMiddleware(io) {
    io.use((socket, next) => {
        if (NODE_ENV !== 'production') {
            return next();
        }

        const origin = socket.handshake.headers.origin;
        const userAgent = socket.handshake.headers['user-agent'];
        const allowedOrigins = getAllowedSocketOrigins();

        if (origin && !allowedOrigins.some(allowed => origin.startsWith(allowed))) {
            return next(new Error('Invalid origin'));
        }

        if (!userAgent) {
            return next(new Error('User-Agent required'));
        }

        if (isBotUserAgent(userAgent)) {
            return next(new Error('Bots not allowed'));
        }

        return next();
    });
}

function initializeSocketDomainHandlers(io, ackManager) {
    try {
        const BroadcastOptimizer = require('./services/BroadcastOptimizer');
        const broadcastOptimizer = new BroadcastOptimizer(io);

        initializeEventHandlers(io, {
            logger,
            activeGames,
            broadcastOptimizer,
            ackManager
        });
    } catch (error) {
        logger.error('Failed to initialize event handlers, continuing without them', { error: error.message });
    }
}

/**
 * Inicializa Socket.io con Redis Adapter para modo cluster
 * @param {http.Server} server - Servidor HTTP Express
 * @param {Object} options - Opciones de configuración
 * @param {AckManager} options.ackManager - Gestor de ACKs para mensajes críticos
 * @returns {Promise<Server>} - Instancia de Socket.io configurada
 */
async function initializeSocketIO(server, options = {}) {
    const { ackManager } = options;
    const io = createSocketServer(server);
    const { pubClient, subClient } = createRedisAdapterClients();

    attachRedisAdapterEventHandlers(pubClient, subClient);
    await connectRedisAdapter(io, pubClient, subClient);
    setupIpRateLimitMiddleware(io, pubClient);
    setupOriginValidationMiddleware(io);
    initializeSocketDomainHandlers(io, ackManager);

    const staleCleanup = setInterval(() => cleanupStaleSessions(io), 30 * 60 * 1000);
    if (staleCleanup.unref) staleCleanup.unref();

    return io;
}

module.exports = {
    initializeSocketIO
};
