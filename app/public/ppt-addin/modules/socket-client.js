/**
 * @module socket-client
 * @description Singleton de la conexión Socket.IO con Xiro.
 *   Gestiona conexión inicial, reconexión automática con backoff,
 *   y despacho de eventos al resto de módulos vía bus de listeners.
 * @depends [state]
 * @server-events
 *   ESCUCHA: join-success, join-error, player-joined, player-left,
 *            game-started, game-start-error, new-question, answer-result,
 *            answer-result-batch, ranking-update, reveal-answer, timer-paused,
 *            timer-resumed, game-ended, results-ready, reconnected-success,
 *            reconnect-failed
 *   EMITE:   join-lobby, start-game, next-question, reveal-answer,
 *            pause-timer, resume-timer, end-game, reconnect-presenter
 * @server-endpoints []
 *
 * Compatibilidad:
 *   - PowerPoint Desktop (Win/Mac): requiere websocket nativo (sin polling)
 *   - PowerPoint Online: idem
 *   - El socket se conecta al mismo origen que el HTML (sin URL explícita)
 */

// Eventos de juego que se reenvían automáticamente a los listeners
const GAME_EVENTS = [
    'join-success', 'join-error',
    'player-joined', 'player-left',
    'game-started', 'game-start-error',
    'new-question', 'answer-result', 'answer-result-batch',
    'ranking-update', 'reveal-answer',
    'timer-paused', 'timer-resumed',
    'game-ended', 'results-ready',
    'reconnected-success', 'reconnect-failed',
    'next-question-error', 'error',
];

const XiroSocket = {
    _socket: null,

    // 'disconnected' | 'connecting' | 'connected' | 'error'
    _status: 'disconnected',

    // listeners internos: { event: [fn, ...] }
    _listeners: {},

    // ── Ciclo de vida ─────────────────────────────────────────

    /**
     * Establece conexión al servidor Xiro.
     * @param {string} playerId — UUID estable del presentador
     */
    connect(playerId) {
        if (this._socket && this._socket.connected) return;
        this.disconnect();            // limpia socket anterior
        this._updateStatus('connecting');

        // io() sin URL: conecta al mismo origen que el HTML del taskpane
        // (xiro.pro/ppt-addin/taskpane.html → wss://xiro.pro/socket.io/)
        this._socket = io({           // eslint-disable-line no-undef
            auth: { playerId },
            transports: ['websocket'],  // WebSocket directo; polling no es fiable en Office
            upgrade: false,
            reconnection: true,
            reconnectionDelay: 500,
            reconnectionDelayMax: 4000,
            reconnectionAttempts: Infinity,
            timeout: 10000,
            path: '/socket.io/',
            withCredentials: false,
        });

        this._socket.on('connect', () => {
            this._updateStatus('connected');
        });

        this._socket.on('disconnect', (reason) => {
            this._updateStatus('disconnected');
            console.warn('[XiroSocket] Desconectado:', reason);
        });

        this._socket.on('connect_error', (err) => {
            this._updateStatus('error');
            console.error('[XiroSocket] Error de conexión:', err.message);
        });

        // Al reconectar automáticamente, emitir reconnect-presenter
        this._socket.io.on('reconnect', () => {
            const playerId = XiroState.get('playerId');  // eslint-disable-line no-undef
            const sessionId = XiroState.get('sessionId'); // eslint-disable-line no-undef
            if (playerId && sessionId) {
                console.log('[XiroSocket] Reconectado — emitiendo reconnect-presenter');
                this._socket.emit('reconnect-presenter', { playerId, token: localStorage.getItem('adminToken') || '' });
            }
            this._updateStatus('connected');
        });

        // Reenvía todos los eventos de juego al bus de listeners
        GAME_EVENTS.forEach(ev => {
            this._socket.on(ev, (...args) => this._dispatch(ev, ...args));
        });
    },

    /** Desconecta y limpia el socket actual. */
    disconnect() {
        if (this._socket) {
            this._socket.disconnect();
            this._socket = null;
        }
        this._updateStatus('disconnected');
    },

    // ── API pública ──────────────────────────────────────────

    /**
     * Emite un evento al servidor.
     * @param {string} event
     * @param {*} [data]
     */
    emit(event, data) {
        if (!this._socket || !this._socket.connected) {
            console.warn(`[XiroSocket] Emit ignorado (no conectado): "${event}"`);
            return;
        }
        this._socket.emit(event, data);
    },

    /**
     * Suscribe a un evento del bus interno.
     * @param {string} event
     * @param {Function} callback
     * @returns {Function} unsubscribe
     */
    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
        return () => this.off(event, callback);
    },

    off(event, callback) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    },

    /** @returns {'disconnected'|'connecting'|'connected'|'error'} */
    getStatus() { return this._status; },

    // ── Privados ─────────────────────────────────────────────

    _updateStatus(newStatus) {
        this._status = newStatus;
        this._dispatch('_statusChange', newStatus);
    },

    _dispatch(event, ...args) {
        (this._listeners[event] || []).forEach(cb => {
            try { cb(...args); } catch (e) {
                console.error(`[XiroSocket] Error en listener "${event}":`, e);
            }
        });
    },
};
