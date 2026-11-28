/**
 * @fileoverview Persistencia de «Nube de palabras»: solo las palabras agrupadas con su recuento,
 * sin autor ni palabras ocultas por el presentador. Cada guardado reemplaza lo anterior de esa
 * pregunta dentro de una transacción, así que repetirlo es seguro. Nunca lanza: un fallo se
 * registra y se devuelve false para no romper el autoguardado de la partida.
 * @module services/db/word-cloud-results.service
 */

'use strict';

const { pool } = require('../../config/database');
const logger = require('../../config/logger');

const MAX_WORD_LENGTH = 20;

const DELETE_SQL = 'DELETE FROM word_cloud_results WHERE game_session_id = $1 AND question_index = $2';
const INSERT_SQL = `
    INSERT INTO word_cloud_results (game_session_id, question_index, word, count)
    SELECT $1, $2, t.word, t.count
    FROM unnest($3::varchar[], $4::int[]) AS t(word, count)`;

/**
 * Junta las palabras con el mismo texto (suma recuentos) y recorta a la longitud de la columna.
 * @param {Array<{text: string, count: number}>} words
 * @returns {{texts: string[], counts: number[]}}
 */
function collapseWords(words) {
    const totals = new Map();
    for (const { text, count } of words) {
        const word = String(text).slice(0, MAX_WORD_LENGTH);
        totals.set(word, (totals.get(word) || 0) + count);
    }
    return { texts: [...totals.keys()], counts: [...totals.values()] };
}

async function replaceResults(client, { gameSessionId, questionIndex, words }) {
    await client.query('BEGIN');
    await client.query(DELETE_SQL, [gameSessionId, questionIndex]);
    const { texts, counts } = collapseWords(words);
    if (texts.length > 0) {
        await client.query(INSERT_SQL, [gameSessionId, questionIndex, texts, counts]);
    }
    await client.query('COMMIT');
}

/**
 * Guarda la nube final de una pregunta, reemplazando lo guardado antes.
 * @param {Object} options
 * @param {number} options.gameSessionId - Id de la partida en game_sessions
 * @param {number} options.questionIndex - Índice de la pregunta
 * @param {Array<{key: string, text: string, count: number}>} options.words - Palabras visibles agrupadas
 * @returns {Promise<boolean>} true si se guardó
 */
async function saveWordCloudResults({ gameSessionId, questionIndex, words }) {
    if (!Number.isInteger(gameSessionId) || gameSessionId < 1) return false;
    const client = await pool.connect();
    try {
        await replaceResults(client, { gameSessionId, questionIndex, words });
        return true;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        logger.error('No se pudo guardar la nube de palabras', { gameSessionId, questionIndex, error: error.message });
        return false;
    } finally {
        client.release();
    }
}

const SELECT_SQL = `
    SELECT question_index, word, count FROM word_cloud_results
    WHERE game_session_id = $1
    ORDER BY question_index, count DESC, word`;

/**
 * Nubes guardadas de una partida, para el visor de resultados.
 * @param {number} gameSessionId - Id de la partida en game_sessions
 * @returns {Promise<Object<number, Array<{word: string, count: number}>>>} Palabras por pregunta
 *   (de más a menos recuento); vacío si no hay o si falla la consulta
 */
async function loadWordClouds(gameSessionId) {
    if (!Number.isInteger(gameSessionId) || gameSessionId < 1) return {};
    try {
        const { rows } = await pool.query(SELECT_SQL, [gameSessionId]);
        const byQuestion = {};
        for (const { question_index: index, word, count } of rows) {
            (byQuestion[index] = byQuestion[index] || []).push({ word, count });
        }
        return byQuestion;
    } catch (error) {
        logger.error('No se pudieron leer las nubes de palabras', { gameSessionId, error: error.message });
        return {};
    }
}

module.exports = { saveWordCloudResults, loadWordClouds };
