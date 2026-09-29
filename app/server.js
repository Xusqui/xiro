const cluster = require('cluster');
const os = require('os');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createSocketRoleMiddleware } = require('./sockets/utils/SocketRoleMiddleware');
const cacheWarmingService = require('./services/CacheWarmingService');
const logger = require('./config/logger');

const PORT = Number(process.env.PORT) || 3000;
const WORKERS = 4;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const GLOBAL_ROOM = 'partida_global';

const createRedisClient = async () => {
    const client = createClient({
        url: REDIS_URL,
        password: process.env.REDIS_PASSWORD || undefined
    });
    client.on('error', (err) => {
        logger.error('Redis client error', err);
    });
    client.on('connect', () => {
        logger.info(`[${process.pid}] Redis connected via ${REDIS_URL}`);
    });
    client.on('ready', () => {
        logger.info(`[${process.pid}] Redis ready (adapter usable)`);
    });
    await client.connect();
    return client;
};

const bootstrapWorker = async () => {
    const adapterPub = await createRedisClient();
    const adapterSub = adapterPub.duplicate();
    await adapterSub.connect();

    const stateClient = adapterPub.duplicate();
    await stateClient.connect();

    const stateSubscriber = adapterPub.duplicate();
    await stateSubscriber.connect();

    logger.info(`[${process.pid}] Redis adapter clients connected`);

    let inMemoryState = null;

    const refreshStateFromRedis = async () => {
        const stored = await stateClient.get('estado_partida');
        if (stored) {
            inMemoryState = JSON.parse(stored);
        }
    };

    await refreshStateFromRedis();

    await stateSubscriber.subscribe('estado_partida_sync', (message) => {
        try {
            inMemoryState = JSON.parse(message);
        } catch (err) {
            logger.error('Invalid sync payload', err);
        }
    });

    const httpServer = http.createServer();

    // Convertir CORS_ORIGIN a array para Socket.IO
    const corsOrigin = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
        : '*';

    const io = new Server(httpServer, {
        serveClient: false,
        cors: {
            origin: corsOrigin,
            methods: ['GET', 'POST'],
            credentials: true
        },
        // Configuración para soportar 2000+ conexiones simultáneas
        maxHttpBufferSize: 64e3,        // 64KB — suficiente para el estado del juego (antes 1MB)
        connectTimeout: 10000,          // Abortar handshakes lentos tras 10s
        pingInterval: 10000,            // Ping cada 10s
        pingTimeout: 5000,              // Timeout después de 5s sin respuesta
        transports: ['websocket', 'polling'],
        allowUpgrades: true,
        httpCompression: true,          // Comprime respuestas HTTP/polling
        perMessageDeflate: {
            threshold: 512              // Comprimir frames WS desde 512B (antes 1024)
        }
    });

    io.adapter(createAdapter(adapterPub, adapterSub));

    // Middleware de autenticación/asignación de rol
    io.use(createSocketRoleMiddleware());

    io.on('connection', (socket) => {
        socket.join(GLOBAL_ROOM);
        logger.debug(`[${process.pid}] connection established role=${socket.data.role} joined=${GLOBAL_ROOM}`);

        if (inMemoryState) {
            socket.emit('estado:sync', inMemoryState);
        }

        socket.on('host:actualiza_estado', (payload, ack) => {
            if (socket.data.role !== 'host') {
                if (typeof ack === 'function') {
                    ack({ ok: false, error: 'solo_host' });
                }
                return;
            }

            inMemoryState = payload;
            const serialized = JSON.stringify(payload);

            // Fire-and-forget persistence and cross-worker sync to avoid blocking the socket loop.
            void Promise.allSettled([
                stateClient.set('estado_partida', serialized),
                stateClient.publish('estado_partida_sync', serialized)
            ]).catch((err) => {
                logger.error('Persist/sync error', err);
            });

            io.to(GLOBAL_ROOM).emit('estado:sync', payload);
            if (typeof ack === 'function') {
                ack({ ok: true });
            }
        });

        socket.on('cliente:solicita_estado', (ack) => {
            if (typeof ack === 'function') {
                ack({ estado: inMemoryState, role: socket.data.role });
            }
        });
    });

    httpServer.listen(PORT, async () => {
        logger.info(`Worker ${process.pid} listening on port ${PORT}`);

        // Precarga de caché de juegos populares al arrancar
        logger.info(`[${process.pid}] Starting cache warming for popular games...`);
        try {
            const warmingResult = await cacheWarmingService.warmPopularGames(10);
            if (warmingResult.success) {
                logger.info(`[${process.pid}] Cache warming completed: ${warmingResult.warmedCount} games loaded`);
            } else {
                logger.warn(`[${process.pid}] Cache warming failed:`, warmingResult.error || warmingResult.reason);
            }
        } catch (error) {
            logger.error(`[${process.pid}] Cache warming error:`, error.message);
        }
    });
};

if (cluster.isPrimary) {
    logger.info(`Primary ${process.pid} booting ${WORKERS} workers; redis at ${REDIS_URL}`);
    for (let i = 0; i < Math.min(WORKERS, os.cpus().length); i += 1) {
        cluster.fork();
    }

    cluster.on('exit', (worker) => {
        logger.warn(`Worker ${worker.process.pid} died, restarting`);
        cluster.fork();
    });
} else {
    bootstrapWorker().catch((err) => {
        logger.error('Worker bootstrap failed', err);
        process.exit(1);
    });
}
