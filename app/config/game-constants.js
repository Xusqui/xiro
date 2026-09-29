/**
 * @fileoverview Constantes de lógica de juego y puntuación
 * Centraliza todos los números mágicos relacionados con la mecánica del juego
 * 
 * FASE 1 - Semana 3: Extracción de constantes
 * Fecha: 31 de enero de 2026
 */

module.exports = {
    // ===== PUNTUACIÓN =====
    SCORING: {
        // Puntos base por respuesta correcta
        BASE_POINTS: parseInt(process.env.BASE_POINTS) || 20,

        // Puntos máximos de bonus por tiempo
        MAX_TIME_BONUS: parseInt(process.env.MAX_TIME_BONUS) || 20,

        // Puntos totales máximos por pregunta
        MAX_POINTS_PER_QUESTION: 40, // BASE_POINTS + MAX_TIME_BONUS

        // Puntos mínimos por respuesta correcta (cuando se acaba el tiempo)
        MIN_POINTS_CORRECT: 20,

        // Puntos por respuesta incorrecta
        POINTS_INCORRECT: 0,

        // Puntos por no responder
        POINTS_NO_ANSWER: 0,

        // ===== ESTRATEGIAS DE PUNTUACIÓN =====
        STRATEGIES: {
            TIME_BASED: 'time_based',        // Estrategia por defecto (base + tiempo)
            STREAK_BONUS: 'streak_bonus',    // Racha de aciertos
            BETTING: 'betting',              // Apuesta de puntos (FUTURO: requiere UI)
        },

        // ===== CONFIGURACIÓN DE RACHAS =====
        STREAK: {
            // Umbral por defecto de respuestas correctas para activar racha
            DEFAULT_THRESHOLD: parseInt(process.env.STREAK_THRESHOLD) || 3,

            // Umbral por defecto de respuestas correctas para activar doble racha
            DEFAULT_DOUBLE_THRESHOLD: parseInt(process.env.DOUBLE_STREAK_THRESHOLD) || 5,

            // Bonus por defecto de racha individual (50% = 0.50)
            DEFAULT_BONUS_PERCENTAGE: parseFloat(process.env.STREAK_BONUS_PERCENTAGE) || 0.50,

            // Bonus por defecto de doble racha (100% = 1.00)
            DEFAULT_DOUBLE_BONUS_PERCENTAGE: parseFloat(process.env.DOUBLE_STREAK_BONUS_PERCENTAGE) || 1.00,

            // Bonus por defecto de racha de equipo (50% = 0.50)
            DEFAULT_TEAM_BONUS_PERCENTAGE: 0.50,

            // Racha máxima permitida (evitar bonuses infinitos)
            MAX_STREAK: 20,
        },

        // ===== CONFIGURACIÓN DE APUESTAS =====
        BETTING: {
            // Porcentaje mínimo de apuesta sobre puntos actuales (10% = 0.10)
            MIN_BET_PERCENTAGE: 0.10,

            // Apuesta mínima absoluta (si tiene < 100 puntos)
            MIN_BET_ABSOLUTE: 10,

            // Apuesta máxima absoluta
            MAX_BET_ABSOLUTE: 1000,

            // Permitir puntuación negativa al fallar apuesta
            ALLOW_NEGATIVE_SCORE: false,

            // Tiempo máximo para apostar (0 = esperar a todos, >0 = timeout en ms)
            MAX_BET_TIMEOUT_MS: 0, // FUTURO: configurable por juego

            // Incluir bonus de tiempo en apuestas
            INCLUDE_TIME_BONUS: true,
        },

        // ===== CONFIGURACIÓN DE PUNTUACIÓN ALEATORIA =====
        RANDOM_POINTS: {
            // Valor mínimo admitido para el rango (entero)
            MIN_VALUE: 1,

            // Tope superior admitido para el rango (alineado con runtime-config BASE_POINTS)
            MAX_VALUE: 500,

            // Valores por defecto al activar la casilla
            DEFAULT_MIN: 10,
            DEFAULT_MAX: 50,

            // Duración de la pantalla "JUGÁIS POR XXX PUNTOS" antes de mostrar la pregunta (ms)
            DEFAULT_REVEAL_MS: 3500,
        },
    },

    // ===== TIEMPO =====
    TIMING: {
        // Tiempo por defecto para responder una pregunta (segundos)
        DEFAULT_QUESTION_TIME: 30,

        // Tiempo mínimo permitido para una pregunta (segundos)
        MIN_QUESTION_TIME: 5,

        // Tiempo máximo permitido para una pregunta (segundos)
        MAX_QUESTION_TIME: 120,

        // Umbral de tiempo para considerar respuesta "rápida" (segundos)
        FAST_ANSWER_THRESHOLD: 5,

        // Umbral de tiempo para considerar respuesta "lenta" (segundos)
        SLOW_ANSWER_THRESHOLD: 10,
    },

    // ===== TIMEOUTS Y CLEANUP =====
    TIMEOUTS: {
        // Tiempo de espera para reconexión (milisegundos)
        RECONNECTION_TIMEOUT: parseInt(process.env.RECONNECTION_TIMEOUT) || 60000 * 2, // 2 minutos

        // Intervalo de limpieza de jugadores expirados (milisegundos)
        CLEANUP_INTERVAL: 10000, // 10 segundos

        // Tiempo de inactividad antes de limpiar un juego (milisegundos)
        INACTIVE_GAME_THRESHOLD: parseInt(process.env.INACTIVE_GAME_THRESHOLD) || 4 * 3600000, // 4 horas

        // Tiempo de inactividad antes de limpiar un lobby vacío (milisegundos)
        EMPTY_LOBBY_TIMEOUT: parseInt(process.env.EMPTY_LOBBY_TIMEOUT) || 5 * 60 * 1000, // 5 minutos

        // Intervalo de limpieza de juegos inactivos (milisegundos)
        INACTIVE_CLEANUP_INTERVAL: 3600000, // 1 hora

        // Intervalo de limpieza de lobbies vacíos (milisegundos)
        EMPTY_LOBBY_CLEANUP_INTERVAL: 120000, // 2 minutos

        // Intervalo de limpieza de rate limits (milisegundos)
        RATE_LIMIT_CLEANUP_INTERVAL: 300000, // 5 minutos

        // Tiempo de expiración adicional del rate limiter (milisegundos)
        RATE_LIMIT_EXPIRY_BUFFER: 60000, // 1 minuto
    },

    // ===== LÍMITES DE JUGADORES =====
    LIMITS: {
        // Máximo de jugadores totales en el servidor
        MAX_TOTAL_PLAYERS: parseInt(process.env.MAX_TOTAL_PLAYERS) || 10000,

        // Máximo de jugadores por juego/sala
        MAX_PLAYERS_PER_GAME: parseInt(process.env.MAX_PLAYERS_PER_GAME) || 1000,

        // Máximo de jugadores por lobby (en espera)
        MAX_PLAYERS_PER_LOBBY: parseInt(process.env.MAX_PLAYERS_PER_LOBBY) || 1000,

        // Máximo de lobbies activos simultáneos
        MAX_ACTIVE_LOBBIES: parseInt(process.env.MAX_LOBBIES) || 10,
    },

    // ===== RATE LIMITING =====
    RATE_LIMITS: {
        // Ventana de tiempo para rate limiting (milisegundos)
        WINDOW_MS: 5000, // 5 segundos

        // Máximo de intentos de join por ventana
        MAX_JOIN_ATTEMPTS: 3,

        // Máximo de respuestas por segundo (anti-spam)
        MAX_SUBMIT_ANSWER_PER_SECOND: 2,

        // Ventana para submit-answer (milisegundos)
        SUBMIT_ANSWER_WINDOW_MS: 1000,

        // Máximo de entradas en el rate limiter
        MAX_RATE_LIMIT_ENTRIES: 5000,
    },

    // ===== CACHÉ =====
    CACHE: {
        // TTL del caché de validación de PINs (milisegundos)
        PIN_VALIDATION_TTL: 5 * 60 * 1000, // 5 minutos

        // Intervalo de limpieza del caché de PINs (milisegundos)
        PIN_CACHE_CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutos
    },

    // ===== MODO EQUIPOS =====
    TEAMS: {
        // Lambda para cálculo de puntuación de equipos (penalización por tamaño)
        SCORE_LAMBDA: parseFloat(process.env.TEAM_SCORE_LAMBDA) || 0.5,

        // Número mínimo de equipos
        MIN_TEAMS: 2,

        // Número máximo de equipos
        MAX_TEAMS: 10,

        // Mínimo de jugadores por equipo
        MIN_PLAYERS_PER_TEAM: 1,

        // Máximo de jugadores por equipo (null = sin límite)
        MAX_PLAYERS_PER_TEAM: null,
    },

    // ===== RANKINGS Y BROADCASTS =====
    RANKING: {
        // Número de jugadores a mostrar en ranking durante el juego
        TOP_PLAYERS_DURING_GAME: parseInt(process.env.TOP_PLAYERS_DURING_GAME) || 5,

        // Throttling de broadcasts de ranking (milisegundos)
        RANKING_UPDATE_THROTTLE: 500,
    },

    // ===== ESTADOS DEL JUEGO =====
    GAME_STATES: {
        IDLE: 'idle',
        LOBBY: 'lobby',
        COUNTDOWN: 'countdown',
        QUESTION_ACTIVE: 'question_active',
        ANSWERING: 'answering',
        SCORING: 'scoring',
        RESULTS: 'results',
        GAME_OVER: 'game_over',
    },

    // ===== ESTADOS DEL JUGADOR =====
    PLAYER_STATES: {
        CONNECTED: 'connected',
        DISCONNECTED: 'disconnected',
        LOBBY_WAITING: 'lobby_waiting',
        PRESENTER_LOBBY: 'presenter_lobby',
        PRESENTER_CONNECTED: 'presenter_connected',
        PRESENTER_DISCONNECTED: 'presenter_disconnected',
    },

    // ===== ROLES =====
    ROLES: {
        PLAYER: 'player',
        PRESENTER: 'presenter',
        HOST: 'host',
    },

    // ===== NOMBRES ESPECIALES =====
    SPECIAL_NAMES: {
        HOST: 'HOST',
    },

    // ===== ROOMS DE SOCKET.IO =====
    ROOMS: {
        GLOBAL: 'partida_global',
        PLAYERS_SUFFIX: ':players',
        PRESENTER_SUFFIX: ':presenter',
    },

    // ===== TIPOS DE PREGUNTA =====
    QUESTION_TYPES: {
        MULTIPLE: 'multiple',
        QUIZ: 'quiz',
        SURVEY: 'survey',
        TRUE_FALSE: 'true_false',
        ORDER: 'order',
        SCRAMBLE: 'word_scramble',
        MATCHING: 'matching',
    },

    // ===== TIPOS DE PREGUNTA ELEGIBLES PARA PUNTUACIÓN ALEATORIA =====
    // Solo los tipos cuya puntuación es "acierto/fallo + bonus de tiempo".
    // Quedan fuera: survey (no puntúa), order y matching (puntos por posición/par),
    // numeric_approximation (puntos por cercanía) y multiple_choice (puntos por
    // opción con penalización, configurados en la propia pregunta).
    RANDOM_POINTS_ELIGIBLE_TYPES: ['quiz', 'word_scramble'],

    // ===== TIPOS DE SLIDE =====
    SLIDE_TYPES: {
        QUESTION: 'question',
        COMMENT: 'comment',
        INFO: 'info',
    },

    // ===== REDIS PUB/SUB CHANNELS =====
    REDIS_CHANNELS: {
        LOBBY_CREATED: 'lobby-created',
        GAME_STARTED: 'game-started',
        GAME_STATE_UPDATED: 'game-state-updated',
        NEXT_QUESTION_SYNC: 'next-question-sync',
        TEAM_CONFIG_SYNC: 'team-config-sync',
        PLAYER_ANSWERED_SYNC: 'player-answered-sync',
        REVEAL_ANSWER_SYNC: 'reveal-answer-sync',
    },

    // ===== MENSAJES DE ERROR =====
    ERROR_MESSAGES: {
        INVALID_PIN: 'El código de juego no existe. Verifica el PIN e intenta de nuevo.',
        INVALID_DATA: 'Datos inválidos',
        RATE_LIMIT: 'Demasiados intentos. Espera unos segundos.',
        SERVER_CAPACITY: 'Servidor al máximo de capacidad. Intenta más tarde.',
        ROOM_FULL: 'El juego está lleno (máx. {max} jugadores)',
        NICKNAME_TAKEN: 'Este nombre ya está en uso. Elige otro nombre.',
        SESSION_NOT_FOUND: 'Sesión no encontrada o expirada. Únete de nuevo.',
        GAME_ENDED: 'El juego ha finalizado.',
        GAME_CLOSED: 'El juego ya no acepta respuestas.',
        NAME_MISMATCH: 'Ya tienes una sesión activa con el nombre "{name}". Usa el mismo nombre o espera a que termine la partida.',
    },

    // ===== RAZONES DE DESCONEXIÓN =====
    DISCONNECT_REASONS: {
        REPLACED: 'replaced',
        EXPIRED: 'expired',
        VOLUNTARY: 'voluntary',
        ERROR: 'error',
    },
};
