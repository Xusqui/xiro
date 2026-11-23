'use strict';

/**
 * @fileoverview Respuesta de la IA (texto) -> { title, tempo, song } válido para los ajustes de música.
 * La validación es la misma que la de los ajustes guardados (music-settings.js), así que lo que sale de
 * aquí lo acepta el servidor al guardar y el motor al sonar.
 */

const musicSettings = require('../../public/js/audio/music-settings.js');
const { stripMarkdown } = require('../response-parser');

const TEMPO = { min: 80, max: 140, base: 112 };
const MAX_TITLE = 60;

function invalid(message) {
    const error = new Error(message);
    error.code = 'AI_MUSIC_INVALID';
    return error;
}

function parseObject(text) {
    let parsed;
    try {
        parsed = JSON.parse(stripMarkdown(String(text)));
    } catch {
        throw invalid('La respuesta no es un JSON válido');
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw invalid('La respuesta no es un objeto JSON');
    }
    return parsed;
}

function tempoOf(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return TEMPO.base;
    return Math.min(TEMPO.max, Math.max(TEMPO.min, Math.round(value)));
}

function titleOf(value) {
    return typeof value === 'string' ? value.trim().slice(0, MAX_TITLE) : '';
}

/**
 * Valida y normaliza la respuesta de la IA.
 * @param {string} text - Texto devuelto por el modelo (JSON, quizá con vallas de código)
 * @returns {{title: string, tempo: number, song: {tonic: number, mode: string, chords: Array, motif?: Object}}}
 * @throws {Error} con `code` 'AI_MUSIC_INVALID' si no es una canción válida
 */
function parseSongReply(text) {
    const reply = parseObject(text);
    const candidate = { tonic: reply.tonic, mode: reply.mode, chords: reply.chords };
    if (reply.motif !== undefined && reply.motif !== null) candidate.motif = reply.motif;
    const problem = musicSettings.songError(candidate);
    if (problem) throw invalid(problem);
    return { title: titleOf(reply.title), tempo: tempoOf(reply.tempo), song: musicSettings.normalize({ song: candidate }).song };
}

module.exports = { parseSongReply, TEMPO };
