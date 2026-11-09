/**
 * @fileoverview Redis Pub/Sub para sincronización cross-worker
 * @module sockets/sync/RedisSyncBus
 */

const { createClient } = require('redis');
const logger = require('../../config/logger');
const { getWorkerContext } = require('../../config/log-context');
const cacheInvalidationBus = require('../../services/cache-invalidation-bus');

const { parseRedisMessage } = require('./redis-sync-payloads');
const inboundLobbyHandlers = require('./redis-sync-inbound-lobby');
const inboundGameHandlers = require('./redis-sync-inbound-game');
const inboundControlHandlers = require('./redis-sync-inbound-control');
const domainPublishers = require('./redis-sync-publishers');

/**
 * Bus Redis Pub/Sub (singleton por worker) que sincroniza entre workers lo que no cubre el adaptador de
 * Socket.IO: estado de partida, lobby, revelado, rachas, temporizador y configuración en caliente.
 * Sin Redis funciona en modo degradado: no publica ni se suscribe y cada worker sigue con su estado local.
 */
class RedisSyncBus {
    constructor() {
        this.syncPub = null;
        this.syncSub = null;
        this.syncReady = null;
        this.syncAvailable = false;
        this.io = null;
        this.state = null;
    }

    /**
     * Devuelve la instancia única del worker, creándola la primera vez.
     * @returns {RedisSyncBus}
     */
    static getInstance() {
        if (!RedisSyncBus._instance) {
            RedisSyncBus._instance = new RedisSyncBus();
        }
        return RedisSyncBus._instance;
    }

    /**
     * Inicializa Redis y suscripciones
     * @param {object} io - Socket.IO instance
     * @param {object} state - Global state { lobbyPlayers, activeGames, teamConfigs, players }
     * @returns {Promise<void>} Se resuelve también si Redis falla o tarda más de 15 s (modo degradado); nunca rechaza
     */
    initialize(io, state = {}) {
        if (this.syncReady) return this.syncReady;

        this.io = io;
        this.state = state;

        const INIT_TIMEOUT_MS = 15000; // 15 s máx para conectar a Redis
        const connectPromise = (async () => {
            const url = process.env.REDIS_URL || 'redis://redis:6379';
            this.syncPub = createClient({ url, password: process.env.REDIS_PASSWORD || undefined });
            this.syncSub = this.syncPub.duplicate();

            this.syncPub.on('error', err => logger.error('syncPub redis error', err));
            this.syncSub.on('error', err => logger.error('syncSub redis error', err));

            await Promise.all([this.syncPub.connect(), this.syncSub.connect()]);

            // Setup subscriptions
            await this.setupSubscriptions();
            this.syncAvailable = true;
        })();

        let initTimer;
        const timeoutPromise = new Promise((_, reject) => {
            initTimer = setTimeout(
                () => reject(new Error('RedisSyncBus init timed out after ' + INIT_TIMEOUT_MS + 'ms')),
                INIT_TIMEOUT_MS
            );
        });

        this.syncReady = Promise.race([connectPromise, timeoutPromise])
            .catch(err => {
                logger.error('RedisSyncBus initialization failed — cross-worker sync unavailable', {
                    error: err.message
                });
                // No re-lanzar: las operaciones que llamen await this.syncReady continuarán
                // sin pub/sub (degraded mode). El fallo ya fue logueado.
            })
            .finally(() => {
                // Promise.race no cancela al perdedor: sin esto el temporizador seguía vivo 15 s
                clearTimeout(initTimer);
            });

        return this.syncReady;
    }

    async setupSubscriptions() {
        await this.registerLobbySubscriptions();
        await this.registerGameSubscriptions();
        await this.registerSessionAndPlayerSubscriptions();
        await this.registerRevealSubscriptions();
        await this.registerStreakTimerAndConfigSubscriptions();
        await cacheInvalidationBus.attach(this.syncPub, this.syncSub);

        logger.info('✅ RedisSyncBus subscriptions initialized', getWorkerContext());
    }

    async registerLobbySubscriptions() {
        await this.syncSub.subscribe('lobby-created', roomId => {
            const { lobbyPlayers } = this.state;
            if (!lobbyPlayers.has(roomId)) {
                lobbyPlayers.set(roomId, []);
            }
        });

        await this.syncSub.subscribe('lobby-player-joined', message => {
            this.handleLobbyPlayerJoined(message);
        });

        await this.syncSub.subscribe('lobby-player-left', message => {
            this.handleLobbyPlayerLeft(message);
        });
    }

    async registerGameSubscriptions() {
        await this.syncSub.subscribe('game-started', message => {
            this.handleGameStartedSync(message);
        });

        await this.syncSub.subscribe('game-state-updated', message => {
            this.handleGameStateUpdatedSync(message);
        });

        await this.syncSub.subscribe('next-question-sync', message => {
            this.handleNextQuestionSync(message);
        });

        await this.syncSub.subscribe('slide-review-sync', message => {
            this.handleSlideReviewSync(message);
        });

        await this.syncSub.subscribe('team-config-sync', message => {
            const data = parseRedisMessage(message, 'team-config-sync');
            if (!data) {
                return;
            }
            this.state.teamConfigs.set(data.roomId, data.teamConfig);
        });

        await this.syncSub.subscribe('team-membership-sync', message => {
            this.handleTeamMembershipSync(message);
        });
    }

    async registerSessionAndPlayerSubscriptions() {
        await this.syncSub.subscribe('session-abandoned', message => {
            this.handleSessionAbandonedSync(message);
        });

        await this.syncSub.subscribe('player-data-sync', message => {
            this.handlePlayerDataSync(message);
        });

        await this.syncSub.subscribe('player-answered-sync', _message => {
            // Redis adapter auto-propagates io.to(room).emit().
        });

        await this.syncSub.subscribe('player-disconnected-sync', message => {
            this.handlePlayerDisconnectedSync(message);
        });
    }

    async registerRevealSubscriptions() {
        await this.syncSub.subscribe('reveal-answer-sync', message => {
            const data = parseRedisMessage(message, 'reveal-answer-sync');
            if (!data) {
                return;
            }

            this.io.to(data.roomId + ':presenter').emit('reveal-answer', data.presenterPayload);
            this.io.to(data.roomId + ':players').emit('reveal-answer', data.playerPayload);
        });

        await this.syncSub.subscribe('question-revealed', message => {
            this.handleQuestionRevealedSync(message);
        });
    }

    async registerStreakTimerAndConfigSubscriptions() {
        await this.syncSub.subscribe('streak-reset-sync', message => {
            this.handleStreakResetSync(message);
        });

        await this.syncSub.subscribe('streak-restored-sync', message => {
            this.handleStreakRestoredSync(message);
        });

        await this.syncSub.subscribe('timer-paused-sync', message => {
            this.handleTimerPausedSync(message);
        });

        await this.syncSub.subscribe('timer-resumed-sync', message => {
            this.handleTimerResumedSync(message);
        });

        await this.syncSub.subscribe('config-updated', message => {
            this.handleConfigUpdatedSync(message);
        });
    }

    /**
     * Publica en un canal tras esperar a la inicialización. Sin conexión no publica.
     * @param {string} channel - Canal
     * @param {Object|string} data - Mensaje; los objetos se serializan a JSON
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación
     */
    async publish(channel, data) {
        await this.syncReady;
        // Modo degradado (Redis no conectó o aún no se inicializó): sin pub/sub,
        // cada worker sigue con su estado local en lugar de fallar.
        if (!this.syncAvailable) {
            logger.debug('RedisSyncBus sin conexión: publicación omitida', { channel });
            return;
        }
        await this.syncPub.publish(channel, typeof data === 'string' ? data : JSON.stringify(data));
    }

    /**
     * Se suscribe a un canal tras esperar a la inicialización. Sin conexión no se suscribe.
     * @param {string} channel - Canal
     * @param {function(string): void} handler - Recibe el mensaje en crudo
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la suscripción
     */
    async subscribe(channel, handler) {
        await this.syncReady;
        if (!this.syncAvailable) {
            logger.debug('RedisSyncBus sin conexión: suscripción omitida', { channel });
            return;
        }
        await this.syncSub.subscribe(channel, handler);
    }
}

// Singleton
RedisSyncBus._instance = null;

// Handlers de mensajes entrantes y publicadores de dominio: métodos del bus repartidos por tema. Se
// definen como los de la clase (no enumerables) para que el prototipo no cambie al moverlos de fichero.
for (const handlers of [inboundLobbyHandlers, inboundGameHandlers, inboundControlHandlers, domainPublishers]) {
    for (const [name, handler] of Object.entries(handlers)) {
        Object.defineProperty(RedisSyncBus.prototype, name, { value: handler, writable: true, configurable: true });
    }
}

module.exports = { RedisSyncBus };
