/**
 * @fileoverview Entry point de la aplicación Xiro!
 * Arquitectura modular que integra Express, Socket.io y PostgreSQL
 * 
 * Estructura:
 * - /config: Configuración y constantes
 * - /state: Estado global compartido
 * - /middlewares: Seguridad, autenticación y manejo de errores
 * - /services: Lógica de negocio y servicios de BD
 * - /routes: Endpoints REST API
 * - /sockets: Gestión de WebSockets
 */

const express = require('express');
const http = require('http');
const compression = require('compression');

// ===== CONFIGURACIÓN =====
const {
    PORT,
    MAX_PLAYERS_PER_GAME,
    QUESTION_TIME_LIMIT,
    GAME_CLEANUP_INTERVAL
} = require('./config/constants');
const { pool, initDB } = require('./config/database');
const logger = require('./config/logger');
const { getWorkerContext } = require('./config/log-context');
// ===== MIDDLEWARES =====
const { configureHelmet, configureCORS } = require('./middlewares/security');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const maintenanceMiddleware = require('./middlewares/maintenanceMode');
const tvAccessGuard = require('./middlewares/tvAccessGuard');
const standaloneAccessGuard = require('./middlewares/standaloneAccessGuard');
const assetVersioningMiddleware = require('./middlewares/assetVersioning');
const metricsMiddleware = require('./middlewares/metrics.middleware');

// ===== RUTAS =====
const aiGeneratorRoutes = require('./ai-generator');
const aiGeneratorConfigRoutes = require('./ai-generator/config-routes');
const healthRoutes = require('./routes/health.routes');
const adminRoutes = require('./routes/admin.routes');
const adminRemoteRoutes = require('./routes/admin.remote.routes');
const adminPasswordResetRoutes = require('./routes/admin-password-reset.routes');
const configRoutes = require('./routes/config.routes');
const siteStateRoutes = require('./routes/site-state.routes');
const userLicenseRoutes = require('./routes/user-license.routes');
const userLicenseCheckoutRoutes = require('./routes/user-license-checkout.routes');
const licenseExemptionsRoutes = require('./routes/license-exemptions.routes');
const gameRoutes = require('./routes/game.routes');
const pinsRoutes = require('./routes/pins.routes');
const metricsRoutes = require('./routes/metrics.routes');
const qrRoutes = require('./routes/qr.routes');
const searchRoutes = require('./routes/search.routes');
const trivialRoutes = require('./routes/trivial.routes');
const uiSettingsRoutes = require('./routes/ui-settings.routes');
const resultsRoutes = require('./routes/results.routes');
const contactRoutes = require('./routes/contact.routes');
const addinLogRoutes = require('./routes/addin-log.routes');

// ===== SOCKETS =====
const { initializeSocketIO } = require('./sockets/socket.manager');
const { setupSocketHandlers } = require('./sockets/socket.handlers');

// ===== SERVICIOS DE APLICACIÓN =====
const { initializeIdempotencyService } = require('./application/services/idempotency');
const AckManager = require('./sockets/services/AckManager');

// ===== HEALTH & SHUTDOWN =====
const healthCheckService = require('./infrastructure/health/HealthCheckService');
const { sendInstallPing } = require('./services/telemetry.service');
const workerRegistry = require('./infrastructure/health/WorkerRegistry');
const { registerShutdownHandlers } = require('./infrastructure/shutdown/GracefulShutdown');

// ===== INICIALIZACIÓN DE EXPRESS =====
const app = express();
const server = http.createServer(app);

// ===== INSTANCIA GLOBAL DE ACK MANAGER =====
const ackManager = new AckManager({
    timeout: 5000,    // 5 segundos para recibir ACK
    maxRetries: 3,    // Máximo 3 reintentos
    retryDelay: 1000  // 1 segundo entre reintentos
});

// Monitorear fallos de entrega
ackManager.on('message-failed', (data) => {
    logger.error('Message delivery failed after retries', {
        messageId: data.messageId,
        event: data.event,
        attempts: data.attempts,
        reason: data.reason
    });
});

// ===== CONFIGURAR MIDDLEWARES DE SEGURIDAD =====
// El servidor corre detrás del proxy inverso del Synology (Nginx).
// 'trust proxy' permite leer la IP real del cliente desde X-Forwarded-For.
app.set('trust proxy', 1);
app.use(configureHelmet());
app.use(configureCORS());
app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    next();
});

// ===== MIDDLEWARES DE EXPRESS =====
app.use(metricsMiddleware); // Registrar métricas de requests

// Compresión Gzip/Brotli para reducir ancho de banda del NAS
// Las rutas /api/ quedan excluidas para mitigar el ataque BREACH
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression'] || req.path.startsWith('/api/')) {
            return false;
        }
        return compression.filter(req, res);
    },
    threshold: 1024, // Solo comprimir si > 1KB
    level: 6 // Balance entre CPU y compresión (1-9)
}));

// Bloquea acceso directo a /tv.html si la tarjeta de TV está deshabilitada.
app.use(tvAccessGuard);

// Bloquea acceso directo a /standalone.html si la tarjeta de Standalone está deshabilitada.
app.use(standaloneAccessGuard);

// Reescribe ?v=... de assets (.js/.css/.svg) con hash de contenido antes de servir estático
app.use(assetVersioningMiddleware);

app.use(express.static('public', {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));
app.use(express.json({ limit: '10mb' }));

// ===== MODO MANTENIMIENTO =====
// Activar con MAINTENANCE_MODE=true o creando .maintenance.lock en la raíz del proyecto
app.use(maintenanceMiddleware);

// ===== REGISTRAR RUTAS =====
app.use(healthRoutes);
app.use(adminRoutes);
app.use(adminRemoteRoutes);
app.use(adminPasswordResetRoutes);
app.use(configRoutes);
app.use(siteStateRoutes);
app.use(userLicenseRoutes);
app.use(userLicenseCheckoutRoutes);
app.use(licenseExemptionsRoutes);
app.use(gameRoutes);
app.use(pinsRoutes);
app.use(searchRoutes);
app.use(metricsRoutes);
app.use('/api/qr', qrRoutes);
app.use(trivialRoutes);
app.use(uiSettingsRoutes);
app.use(resultsRoutes);
app.use(contactRoutes);
app.use(addinLogRoutes);

app.use(aiGeneratorRoutes);
app.use(aiGeneratorConfigRoutes);

// ===== MANEJO DE ERRORES =====
app.use(notFoundHandler);
app.use(errorHandler);

// ===== INICIALIZAR SOCKET.IO Y MANEJADORES =====
let io = null;

async function startServer() {
    try {
        // Inicializar IdempotencyService (NUEVO - Week 16.1)
        await initializeIdempotencyService({
            ttl: 300, // 5 minutos
            prefix: 'idempotency:'
        });
        logger.info('✅ IdempotencyService initialized', getWorkerContext());

        // Inicializar Socket.IO (ahora async para Redis Adapter)
        io = await initializeSocketIO(server, { ackManager });

        // Almacenar io y ackManager en app para acceso desde routes
        app.set('io', io);
        app.set('ackManager', ackManager);

        // Configurar manejadores de Socket.IO
        setupSocketHandlers(io, ackManager);

        logger.info('Socket.IO initialized and ready', getWorkerContext());
    } catch (error) {
        logger.error('Failed to initialize Socket.IO', error);
        throw error;
    }
}

// ===== INICIALIZAR BASE DE DATOS Y LUEGO MIGRACIONES =====
const { runPendingMigrations } = require('./migrations/migration-runner');

// IMPORTANTE: En modo cluster, solo el worker 0 debe inicializar la base de datos
// para evitar condiciones de carrera (múltiples workers intentando crear las mismas tablas).
const isMasterWorker = process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE;

if (isMasterWorker) {
    logger.info('👑 Worker maestro (0): Inicializando base de datos...', getWorkerContext());
    initDB().then(() => {
        return runPendingMigrations();
    })
        .then(result => {
            if (result && result.executed > 0) {
                logger.info(`✅ ${result.executed} migración(es) ejecutada(s)`, getWorkerContext());
            }
        })
        .catch(error => {
            logger.error('❌ Error ejecutando inicialización o migraciones:', error);
            // No detener el servidor, solo registrar el error
        });
} else {
    logger.info('👷 Worker secundario: Saltando inicialización de BD', getWorkerContext());
}

// ===== GRACEFUL SHUTDOWN =====
registerShutdownHandlers({ server, io, pool, ackManager });

// ===== MANEJO DE EXCEPCIONES NO CAPTURADAS =====
// (uncaughtException y unhandledRejection ahora gestionados por GracefulShutdown)

// ===== INICIAR SERVIDOR =====
async function main() {
    try {
        await startServer();
        await workerRegistry.start();

        server.listen(PORT, () => {
            // Iniciar health checks periódicos (cada 30s)
            healthCheckService.setIO(io);
            healthCheckService.start();

            // Ping anónimo de instalación (opt-out: XIRO_TELEMETRY=false, ver README)
            sendInstallPing();

            logger.info('🚀 XIRO! Server started', {
                ...getWorkerContext(),
                port: PORT,
                environment: process.env.NODE_ENV,
                maxPlayers: MAX_PLAYERS_PER_GAME,
                questionTimeLimit: QUESTION_TIME_LIMIT,
                cleanupInterval: GAME_CLEANUP_INTERVAL / 60000,
                mode: 'cluster'
            });
            logger.info('📂 Modular architecture loaded', {
                ...getWorkerContext(),
                modules: ['Config & Database', 'Security & Auth', 'Routes', 'Socket.io with Redis Adapter', 'Global State in Redis']
            });
        });
    } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
}

if (require.main === module) {
    // ===== VALIDACIÓN DE SECRETOS =====
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        console.error('FATAL: JWT_SECRET no definido o demasiado corto (mínimo 32 caracteres). Abortando.');
        process.exit(1);
    }
    main();
}

module.exports = { app, server, startServer };
