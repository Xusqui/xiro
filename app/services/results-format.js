/**
 * @fileoverview Formatos para exportar resultados: escape CSV (incluida la
 * inyección de fórmulas), fechas, duraciones, tipo de juego y nombres de fichero.
 */

// Primer carácter con el que Excel/LibreOffice/Sheets interpretan la celda como fórmula
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(?:[.,]\d+)?$/;

/**
 * Escapa un valor para CSV con separador ';'.
 * - Inyección de fórmulas: antepone ' a los textos que empiezan por = + - @ tab o \r
 *   para que la hoja de cálculo los trate como texto (los números negativos se dejan).
 * - Si contiene punto y coma, doble comilla o salto de línea lo envuelve en comillas.
 */
function escapeCsv(val) {
    if (val === null || val === undefined) return '';
    let str = String(val);
    if (FORMULA_TRIGGER.test(str) && !PLAIN_NUMBER.test(str)) {
        str = `'${str}`;
    }
    if (/[;"\n\r]/.test(str)) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

/** Parte de un nombre de fichero segura para la cabecera Content-Disposition. */
function safeFilenamePart(value) {
    return String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '_');
}

/** Devuelve la fecha formateada como "DD/MM/YYYY HH:MM" en la zona local del servidor */
function formatDateTime(date) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "5m 32s" o "-" */
function formatDuration(ms) {
    if (!ms || ms < 0) return '-';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}m ${sec}s`;
}

/** Nombre legible de tipo de juego */
function formatGameType(type) {
    const labels = {
        custom_game: 'Personalizado',
        bank: 'Banco de preguntas',
        game: 'Juego',
        quiz: 'Quiz',
        trivial: 'Trivial'
    };
    return labels[type] || (type || '-');
}

/** Nombre seguro para el archivo descargado */
function buildFilename(pin, playedAt) {
    const d = new Date(playedAt);
    const dateStr = d.toISOString().slice(0, 10); // "2026-03-19"
    return `xiro-${safeFilenamePart(pin)}-${dateStr}.csv`;
}

function buildLogsFilename(pin, playedAt, ext = 'txt') {
    const d = new Date(playedAt);
    const dateStr = d.toISOString().slice(0, 10);
    return `xiro-logs-${safeFilenamePart(pin)}-${dateStr}.${safeFilenamePart(ext)}`;
}

function getSessionLogs(session) {
    return Array.isArray(session?.session_logs) ? session.session_logs : [];
}

module.exports = {
    escapeCsv,
    safeFilenamePart,
    formatDateTime,
    formatDuration,
    formatGameType,
    buildFilename,
    buildLogsFilename,
    getSessionLogs
};
