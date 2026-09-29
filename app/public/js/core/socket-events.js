/**
 * @fileoverview Lista canónica de eventos Socket.IO
 * @description Define TODOS los eventos del sistema con sus payloads
 * @created 2025-02-05
 * @week Semana 19 - Frontend Cleanup
 */

/**
 * @typedef {Object} SocketEvent
 * @property {string} name - Nombre del evento
 * @property {string} description - Descripción del evento
 * @property {string} direction - 'backend→frontend' o 'frontend→backend'
 * @property {Object} payload - Estructura del payload
 */

// ============================================================================
// 🔌 CONEXIÓN Y LIFECYCLE
// ============================================================================

export const CONNECTION_EVENTS = {
    /** Conexión establecida con el servidor (nativo Socket.IO) */
    CONNECT: 'connect',

    /** Desconexión del servidor (nativo Socket.IO) */
    DISCONNECT: 'disconnect',

    /** Error de conexión (nativo Socket.IO) */
    CONNECT_ERROR: 'connect_error',

    /** 
     * Servidor fuerza desconexión del cliente (ej: sesión duplicada)
     * @payload {Object} { reason: string }
     */
    FORCE_DISCONNECT: 'force-disconnect',

    /** 
     * Servidor se está reiniciando
     * @payload {Object} { message: string, timestamp: number }
     */
    SERVER_RESTARTING: 'server-restarting',
};

// ============================================================================
// 🚪 JOIN/LEAVE FLOW
// ============================================================================

export const JOIN_EVENTS = {
    /**
     * Unirse a sala (frontend → backend)
     * @emit {Object} { pin: string, nickname: string, isTeamMode?: boolean }
     */
    JOIN_GAME: 'join-game',

    /**
     * Join exitoso (backend → frontend)
     * @payload {Object} { 
     *   roomId: string, 
     *   nickname: string, 
     *   isTeamMode: boolean,
     *   team?: string,
     *   players: Array<{nickname: string, team?: string}>
     * }
     */
    JOIN_SUCCESS: 'join-success',

    /**
     * Error al unirse (backend → frontend)
     * @payload {Object} { error: string, code?: string }
     */
    JOIN_ERROR: 'join-error',

    /**
     * Nuevo jugador se unió a la sala (backend → frontend)
     * @payload {Object} { nickname: string, team?: string, totalPlayers: number }
     */
    PLAYER_JOINED: 'player-joined',

    /**
     * Jugador salió de la sala (backend → frontend)
     * @payload {Object} { nickname: string, totalPlayers: number }
     */
    PLAYER_LEFT: 'player-left',

    /**
     * Jugador se reconectó (backend → frontend)
     * @payload {string} nickname
     */
    PLAYER_REJOINED: 'player-rejoined',
};

// ============================================================================
// 🎮 GAME FLOW
// ============================================================================

export const GAME_EVENTS = {
    /**
     * Iniciar juego (frontend → backend)
     * @emit {Object} { pin: string }
     */
    START_GAME: 'start-game',

    /**
     * Juego iniciado exitosamente (backend → frontend)
     * Usa AckManager con retry logic
     * @payload {Object} {
     *   bank: string,
     *   totalQuestions: number,
     *   timerDuration: number,
     *   isTeamMode: boolean,
     *   questions?: Array (solo para presentador),
     *   players?: Array (solo para presentador)
     * }
     */
    GAME_STARTED: 'game-started',

    /**
     * Error al iniciar juego (backend → frontend)
     * @payload {Object} { error: string }
     */
    GAME_START_ERROR: 'game-start-error',

    /**
     * Cuenta regresiva antes de iniciar (backend → frontend)
     * @payload {Object} { countdown: number, startTime: number }
     */
    COUNTDOWN_START: 'countdown-start',

    /**
     * Juego terminado (backend → frontend)
     * @payload {Object} {
     *   ranking: Array<{nickname: string, score: number, team?: string}>,
     *   totalQuestions: number,
     *   winners: Array<string>
     * }
     */
    GAME_ENDED: 'game-ended',
};

// ============================================================================
// ❓ QUESTION FLOW
// ============================================================================

export const QUESTION_EVENTS = {
    /**
     * Siguiente pregunta (frontend → backend)
     * @emit {Object} { pin: string }
     */
    NEXT_QUESTION: 'next-question',

    /**
     * Nueva pregunta disponible (backend → frontend)
     * @payload {Object} {
     *   question: string,
     *   options: Array<string>,
     *   correctAnswer?: string (solo para presentador),
     *   imageUrl?: string,
     *   questionNumber: number,
     *   totalQuestions: number,
     *   timerDuration: number
     * }
     */
    NEW_QUESTION: 'new-question',

    /**
     * Revelar respuesta correcta (backend → frontend)
     * @payload {Object} {
     *   correctAnswer: string,
     *   correctIndex: number,
     *   explanation?: string
     * }
     */
    REVEAL_ANSWER: 'reveal-answer',

    /**
     * Jugador bloqueado (tiempo agotado) (backend → frontend)
     * @payload {Object} { message: string }
     */
    BLOCKED_ANSWER: 'blocked-answer',
};

// ============================================================================
// ✅ ANSWER FLOW
// ============================================================================

export const ANSWER_EVENTS = {
    /**
     * Enviar respuesta (frontend → backend)
     * @emit {Object} { 
     *   pin: string, 
     *   answer: string, 
     *   timeToAnswer: number 
     * }
     */
    SUBMIT_ANSWER: 'submit-answer',

    /**
     * Resultado de respuesta individual (backend → frontend)
     * Usa AckManager con retry logic
     * @payload {Object} {
     *   isCorrect: boolean,
     *   score: number,
     *   timeBonus?: number,
     *   correctAnswer: string,
     *   nickname: string,
     *   team?: string
     * }
     */
    ANSWER_RESULT: 'answer-result',

    /**
     * Batch de respuestas (optimización) (backend → frontend)
     * Solo para presentador
     * @payload {Object} {
     *   answers: Array<{
     *     nickname: string,
     *     isCorrect: boolean,
     *     score: number,
     *     team?: string
     *   }>,
     *   count: number,
     *   questionNumber: number
     * }
     */
    ANSWER_RESULT_BATCH: 'answer-result-batch',

    /**
     * Respuesta pendiente (modo equipo) (backend → frontend)
     * @payload {Object} { 
     *   message: string, 
     *   waitingFor: Array<string> 
     * }
     */
    ANSWER_PENDING: 'answer-pending',

    /**
     * Error al enviar respuesta (backend → frontend)
     * @payload {Object} { error: string, code?: string }
     */
    ANSWER_ERROR: 'answer-error',
};

// ============================================================================
// 📊 UPDATES Y NOTIFICACIONES
// ============================================================================

export const UPDATE_EVENTS = {
    /**
     * Actualización de ranking (backend → frontend)
     * Usa BroadcastOptimizer con debouncing (50-200ms)
     * @payload {Object} {
     *   ranking: Array<{nickname: string, score: number, team?: string}>
     * }
     */
    RANKING_UPDATE: 'ranking-update',

    /**
     * Actualización de equipo (backend → frontend)
     * @payload {Object} {
     *   teams: Object<string, Array<string>>,
     *   teamScores?: Object<string, number>
     * }
     */
    TEAM_UPDATE: 'team-update',

    /**
     * Timer pausado (backend → frontend)
     * @payload {Object} { remainingTime: number }
     */
    TIMER_PAUSED: 'timer-paused',

    /**
     * Timer reanudado (backend → frontend)
     * @payload {Object} { remainingTime: number }
     */
    TIMER_RESUMED: 'timer-resumed',

    /**
     * Posición final del jugador (backend → frontend)
     * Emitido durante cleanup
     * @payload {Object} {
     *   position: number,
     *   totalPlayers: number,
     *   score: number
     * }
     */
    PLAYER_FINAL_POSITION: 'player-final-position',
};

// ============================================================================
// 🔄 RECONEXIÓN
// ============================================================================

export const RECONNECTION_EVENTS = {
    /**
     * Reconexión exitosa (backend → frontend)
     * @payload {Object} {
     *   gameState: Object,
     *   currentQuestion?: Object,
     *   score: number,
     *   nickname: string
     * }
     */
    RECONNECTED_SUCCESS: 'reconnected-success',

    /**
     * Reconexión fallida (backend → frontend)
     * @payload {Object} { error: string, reason: string }
     */
    RECONNECT_FAILED: 'reconnect-failed',

    /**
     * Estado actual del juego (backend → frontend)
     * @payload {Object} { 
     *   gameState: string, 
     *   currentQuestion?: Object,
     *   players?: Array,
     *   ranking?: Array
     * }
     */
    CURRENT_STATE: 'current-state',

    /**
     * Error de estado (backend → frontend)
     * @payload {Object} { error: string, code?: string }
     */
    STATE_ERROR: 'state-error',

    /**
     * Presentador reconectado (backend → frontend)
     * Solo para jugadores
     * @payload {Object} { timestamp: number }
     */
    PRESENTER_RECONNECTED: 'presenter-reconnected',
};

// ============================================================================
// 🛠️ ADMIN/CONTROL
// ============================================================================

export const ADMIN_EVENTS = {
    /**
     * Pausar timer (frontend → backend)
     * @emit {Object} { pin: string }
     */
    PAUSE_TIMER: 'pause-timer',

    /**
     * Reanudar timer (frontend → backend)
     * @emit {Object} { pin: string }
     */
    RESUME_TIMER: 'resume-timer',

    /**
     * Cambiar equipo de jugador (frontend → backend)
     * @emit {Object} { pin: string, nickname: string, newTeam: string }
     */
    CHANGE_TEAM: 'change-team',

    /**
     * Expulsar jugador (frontend → backend)
     * @emit {Object} { pin: string, nickname: string }
     */
    KICK_PLAYER: 'kick-player',
};

// ============================================================================
// 📑 LISTA COMPLETA DE EVENTOS
// ============================================================================

/**
 * Todos los eventos del sistema organizados por categoría
 */
export const ALL_EVENTS = {
    ...CONNECTION_EVENTS,
    ...JOIN_EVENTS,
    ...GAME_EVENTS,
    ...QUESTION_EVENTS,
    ...ANSWER_EVENTS,
    ...UPDATE_EVENTS,
    ...RECONNECTION_EVENTS,
    ...ADMIN_EVENTS,
};

/**
 * Lista plana de todos los eventos (para validación)
 */
export const EVENT_LIST = Object.values(ALL_EVENTS);

/**
 * Eventos que usan AckManager (requieren acknowledgment)
 */
export const ACK_EVENTS = [
    ANSWER_EVENTS.ANSWER_RESULT,
    GAME_EVENTS.GAME_STARTED,
];

/**
 * Eventos que usan BroadcastOptimizer (con debouncing)
 */
export const OPTIMIZED_EVENTS = [
    UPDATE_EVENTS.RANKING_UPDATE,
];

/**
 * Eventos que usan AnswerBatchService (batching)
 */
export const BATCH_EVENTS = [
    ANSWER_EVENTS.ANSWER_RESULT_BATCH,
];

// ============================================================================
// 🚫 EVENTOS DEPRECADOS (NO USAR)
// ============================================================================

/**
 * Eventos deprecados que YA NO se usan
 * @deprecated Mantener aquí para referencia histórica
 */
export const DEPRECATED_EVENTS = {
    /** @deprecated Usar NEW_QUESTION en su lugar */
    NEXT_QUESTION_DATA: 'next-question-data',

    /** @deprecated Usar GAME_ENDED en su lugar */
    GAME_OVER: 'game-over',

    /** @deprecated Usar PLAYER_LEFT → PLAYER_REJOINED en su lugar */
    PLAYER_DISCONNECTED_TEMP: 'player-disconnected-temp',

    /** @deprecated No se usa en el backend actual */
    PLAYER_ANSWERED: 'player-answered',

    /** @deprecated Sincronización global no implementada */
    ESTADO_SYNC: 'estado:sync',
};

// ============================================================================
// 🔍 HELPERS DE VALIDACIÓN
// ============================================================================

/**
 * Verifica si un evento es válido
 * @param {string} eventName - Nombre del evento
 * @returns {boolean}
 */
export function isValidEvent(eventName) {
    return EVENT_LIST.includes(eventName);
}

/**
 * Verifica si un evento está deprecado
 * @param {string} eventName - Nombre del evento
 * @returns {boolean}
 */
export function isDeprecatedEvent(eventName) {
    return Object.values(DEPRECATED_EVENTS).includes(eventName);
}

/**
 * Verifica si un evento requiere acknowledgment
 * @param {string} eventName - Nombre del evento
 * @returns {boolean}
 */
export function requiresAck(eventName) {
    return ACK_EVENTS.includes(eventName);
}

/**
 * Obtiene información sobre un evento
 * @param {string} eventName - Nombre del evento
 * @returns {Object|null}
 */
export function getEventInfo(eventName) {
    if (isDeprecatedEvent(eventName)) {
        return {
            name: eventName,
            status: 'deprecated',
            warning: 'Este evento está deprecado y no debe usarse',
        };
    }

    if (!isValidEvent(eventName)) {
        return null;
    }

    return {
        name: eventName,
        status: 'active',
        requiresAck: requiresAck(eventName),
        isOptimized: OPTIMIZED_EVENTS.includes(eventName),
        isBatched: BATCH_EVENTS.includes(eventName),
    };
}

// ============================================================================
// 📚 EXPORT DEFAULT
// ============================================================================

export default {
    CONNECTION_EVENTS,
    JOIN_EVENTS,
    GAME_EVENTS,
    QUESTION_EVENTS,
    ANSWER_EVENTS,
    UPDATE_EVENTS,
    RECONNECTION_EVENTS,
    ADMIN_EVENTS,
    ALL_EVENTS,
    DEPRECATED_EVENTS,
    isValidEvent,
    isDeprecatedEvent,
    requiresAck,
    getEventInfo,
};
