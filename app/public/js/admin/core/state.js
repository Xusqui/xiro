/**
 * @fileoverview Estado global y variables compartidas
 * Contiene las variables globales y utilidades base del original admin.js
 */

// ===== VARIABLES GLOBALES =====
let preguntasData = [];
let currentBanks = []; // Para el editor de juegos
let activeView = null; // Estado de la vista activa: 'bancos', 'juegos', 'personalizados'
let currentCustomGameQuestions = []; // Array de {question_id, question_text, bank_name, options}
let currentBankData = null; // Guardar los datos del banco actual
let cuestionarioCargado = null;

// Exponer al bridge seguro (let no es propiedad de globalThis, pero sí con defineProperty)
Object.defineProperty(globalThis, 'preguntasData', {
    get() { return preguntasData; },
    set(v) { preguntasData = v; },
    configurable: true,
    enumerable: false
});
Object.defineProperty(globalThis, 'currentBanks', {
    get() { return currentBanks; },
    set(v) { currentBanks = v; },
    configurable: true,
    enumerable: false
});

// ===== TIEMPO POR PREGUNTA =====
// Valor por defecto de time_limit en preguntas nuevas: QUESTION_TIME_LIMIT de
// Config → Servidor → Partidas. 30 s solo mientras llega /api/ui-settings.
let defaultQuestionTimeLimit = 30;

function setDefaultQuestionTimeLimit(value) {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) defaultQuestionTimeLimit = parsed;
}

function getDefaultQuestionTimeLimit() {
    return defaultQuestionTimeLimit;
}

if (typeof fetch === 'function') {
    fetch('/api/ui-settings')
        .then(r => r.json())
        .then(settings => setDefaultQuestionTimeLimit(settings.questionTimeLimit))
        .catch(() => { });
}

// ===== MULTIMEDIA - CONSTANTES =====
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_QUESTION_IMAGE_SIZE = 200 * 1024; // 200 KB — imagen de enunciado u opción
const MAX_GAME_COVER_IMAGE_SIZE = 1024 * 1024; // 1 MB — imagen de portada de juego/banco
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];

// Helper para escapar HTML y evitar que comillas/carácteres especiales rompan los inputs
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Contenido de un string JS entre comillas simples (escapa \ y '). Para argumentos
// de data-admin-click/data-admin-change se usa como escapeHtml(jsStringContent(x)):
// el navegador deshace el escape HTML y _parseAdminInlineString el de JS.
function jsStringContent(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
}
