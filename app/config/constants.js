/**
 * @fileoverview Constantes y configuración de variables de entorno
 * Centraliza todas las constantes del sistema para facilitar el mantenimiento
 */

require('./env'); // Garantiza que los secretos *_FILE se resuelven antes de leer process.env

module.exports = {
    // ===== JWT & SEGURIDAD =====
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: '12h',

    // ===== LÍMITES DE WEBSOCKET =====
    MAX_ACTIVE_LOBBIES: parseInt(process.env.MAX_LOBBIES) || 10,
    MAX_PLAYERS_PER_LOBBY: parseInt(process.env.MAX_PLAYERS_PER_LOBBY) || 1000,
    MAX_PLAYERS_PER_GAME: parseInt(process.env.MAX_PLAYERS_PER_GAME) || 1000,
    MAX_TOTAL_PLAYERS: parseInt(process.env.MAX_TOTAL_PLAYERS) || 10000,

    // ===== RATE LIMITING =====
    RATE_LIMIT_WINDOW_MS: 2000, // 2 segundos
    MAX_JOIN_ATTEMPTS: 5, // Máximo 5 intentos de join por ventana
    MAX_RATE_LIMIT_ENTRIES: 5000,

    // ===== JUEGO =====
    QUESTION_TIME_LIMIT: parseInt(process.env.QUESTION_TIME_LIMIT) || 30,
    GAME_CLEANUP_INTERVAL: parseInt(process.env.GAME_CLEANUP_INTERVAL) || 3600000, // 1 hora

    // ===== RECONEXIÓN =====
    // NOTA: RECONNECTION_TIMEOUT y CLEANUP_INTERVAL se definen en game-constants.js (TIMEOUTS)
    // para evitar duplicación. Usar: require('./game-constants').TIMEOUTS.RECONNECTION_TIMEOUT

    // ===== CORS =====
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://xiro.pro,https://www.xiro.pro,https://test.xiro.pro,http://localhost:3000,http://localhost',
    SERVER_HOST: process.env.SERVER_HOST || 'xiro.pro',

    // ===== ALLOWED ORIGINS =====
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : [
            'https://xiro.pro',
            'https://www.xiro.pro',
            'https://test.xiro.pro',
            'http://localhost:3000',
            'http://localhost'
        ],

    // ===== MULTIMEDIA =====
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB para imágenes
    MAX_AUDIO_SIZE: 10 * 1024 * 1024, // 10MB para audio
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    ALLOWED_AUDIO_TYPES: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'],

    // ===== ENVIRONMENT =====
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3000,

    // ===== PUNTUACIÓN DE EQUIPOS =====
    TEAM_SCORE_LAMBDA: parseFloat(process.env.TEAM_SCORE_LAMBDA) || 0.5,
};
