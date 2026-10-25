/**
 * @fileoverview Preguntas que el guardado de un banco va a borrar y que usa
 * algún juego personalizado. Borrarlas las quita de esos juegos (la FK de
 * custom_game_questions es ON DELETE CASCADE), así que el editor pregunta antes.
 * @module services/db/bank-question-usage
 */

/** Decisiones que acepta el guardado del banco ante preguntas en uso. */
const REMOVED_IN_USE = Object.freeze({ DELETE: 'delete', KEEP: 'keep' });

/**
 * Preguntas del banco ausentes del payload (se van a borrar) que usa algún
 * juego personalizado.
 * @param {Object} client - Cliente pg dentro de la transacción
 * @param {number} bankId
 * @param {Array<Object>} questions - Preguntas del payload; las existentes llevan `id`
 * @returns {Promise<Array<{ id: number, question_text: string, custom_games: Array<{ id: number, name: string }> }>>}
 */
async function findRemovedQuestionsInUse(client, bankId, questions) {
    const keptIds = (Array.isArray(questions) ? questions : []).filter(q => q.id).map(q => Number(q.id));
    const res = await client.query(
        `SELECT q.id, q.question_text, cg.id AS custom_game_id, cg.name AS custom_game_name
         FROM questions q
         INNER JOIN custom_game_questions cgq ON cgq.question_id = q.id
         INNER JOIN custom_games cg ON cg.id = cgq.custom_game_id
         WHERE q.bank_id = $1 AND NOT (q.id = ANY($2::int[]))
         ORDER BY q.id, cg.name`,
        [bankId, keptIds]
    );

    const byQuestion = new Map();
    for (const row of Array.isArray(res?.rows) ? res.rows : []) {
        if (!byQuestion.has(row.id)) {
            byQuestion.set(row.id, { id: row.id, question_text: row.question_text, custom_games: [] });
        }
        const games = byQuestion.get(row.id).custom_games;
        if (!games.some(g => g.id === row.custom_game_id)) {
            games.push({ id: row.custom_game_id, name: row.custom_game_name });
        }
    }
    return [...byQuestion.values()];
}

module.exports = { findRemovedQuestionsInUse, REMOVED_IN_USE };
