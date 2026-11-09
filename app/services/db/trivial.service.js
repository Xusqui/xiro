/**
 * @fileoverview Trivial game database operations
 * @module services/db/trivial.service
 */

const { pool } = require('../../config/database');
const logger = require('../../config/logger');
const { questionBankCache } = require('../cache.service');
const pinCache = require('../pin-cache.service');
const { assertEditorCanModifyResource, normalizeCreatorRole } = require('./resource-ownership.service');
const { DEFAULTS: RANDOM_POINTS_DEFAULTS } = require('./random-points-config.service');

/**
 * Lista todos los juegos Trivial con su creador y sus categorías (en orden de tablero), del más reciente al más
 * antiguo.
 * @returns {Promise<Object[]>} Filas de trivial_games con `created_by_username` y `categories`
 * @throws {Error} Si falla la consulta
 */
async function getAllTrivialGames() {
    const result = await pool.query(`
        SELECT tg.*, au.username AS created_by_username,
            json_agg(
                json_build_object(
                    'id', tc.id, 'category_name', tc.category_name,
                    'color', tc.color, 'bank_id', tc.bank_id,
                    'source_type', tc.source_type, 'source_id', tc.source_id,
                    'bank_name', qb.name, 'position', tc.position
                ) ORDER BY tc.position
            ) FILTER (WHERE tc.id IS NOT NULL) AS categories
        FROM trivial_games tg
        LEFT JOIN admin_users au ON au.id = tg.created_by_user_id
        LEFT JOIN trivial_categories tc ON tc.trivial_id = tg.id
        LEFT JOIN question_banks qb ON qb.id = tc.bank_id
        GROUP BY tg.id, au.username
        ORDER BY tg.created_at DESC
    `);
    return result.rows;
}

/**
 * Lee un juego Trivial y sus categorías.
 * @param {number} id - ID del juego
 * @returns {Promise<{game: Object, categories: Object[]}|null>} null si no existe
 * @throws {Error} Si falla la consulta
 */
async function getTrivialGameById(id) {
    const game = await pool.query('SELECT * FROM trivial_games WHERE id = $1', [id]);
    if (game.rows.length === 0) return null;

    const cats = await pool.query(
        `
        SELECT tc.*, qb.name AS bank_name
        FROM trivial_categories tc
        LEFT JOIN question_banks qb ON qb.id = CASE WHEN tc.source_type = 'bank' OR tc.source_type IS NULL THEN tc.source_id ELSE NULL END
        WHERE tc.trivial_id = $1
        ORDER BY tc.position
    `,
        [id]
    );

    return { game: game.rows[0], categories: cats.rows };
}

/**
 * Lee lo necesario para jugar un Trivial por su PIN (sin distinguir mayúsculas): tablero, rachas, puntos aleatorios y
 * categorías.
 * @param {string} pin - PIN del juego
 * @returns {Promise<Object|null>} Juego con `categories`, o null
 * @throws {Error} Si falla la consulta
 */
async function getTrivialGameByPin(pin) {
    const result = await pool.query(
        `
        SELECT tg.id, tg.name, tg.pin, tg.outer_casillas,
               tg.use_streaks, tg.streak_threshold, tg.streak_bonus_percentage,
               tg.use_double_streaks, tg.double_streak_threshold, tg.double_streak_bonus_percentage,
               tg.use_random_points, tg.random_points_min, tg.random_points_max,
            json_agg(
                json_build_object(
                    'id', tc.id, 'category_name', tc.category_name,
                    'color', tc.color, 'bank_id', tc.bank_id,
                    'source_type', tc.source_type, 'source_id', tc.source_id,
                    'bank_name', qb.name, 'position', tc.position
                ) ORDER BY tc.position
            ) FILTER (WHERE tc.id IS NOT NULL) AS categories
        FROM trivial_games tg
        LEFT JOIN trivial_categories tc ON tc.trivial_id = tg.id
        LEFT JOIN question_banks qb ON qb.id = CASE WHEN tc.source_type = 'bank' OR tc.source_type IS NULL THEN tc.source_id ELSE NULL END
        WHERE tg.pin = $1
        GROUP BY tg.id
    `,
        [String(pin).toUpperCase()]
    );
    return result.rows[0] || null;
}

// Mismo orden en el INSERT y en el UPDATE: rachas, imagen y puntuación aleatoria
function trivialSettingsParams(data) {
    const {
        use_streaks = false,
        streak_threshold = 3,
        streak_bonus_percentage = 0.5,
        use_double_streaks = false,
        double_streak_threshold = 5,
        double_streak_bonus_percentage = 1.0,
        image_url = null,
        use_random_points = false,
        random_points_min = RANDOM_POINTS_DEFAULTS.random_points_min,
        random_points_max = RANDOM_POINTS_DEFAULTS.random_points_max
    } = data;
    return [
        use_streaks,
        streak_threshold,
        streak_bonus_percentage,
        use_double_streaks,
        double_streak_threshold,
        double_streak_bonus_percentage,
        image_url,
        use_random_points,
        random_points_min,
        random_points_max
    ];
}

async function insertTrivialCategories(client, gameId, categories) {
    for (let i = 0; i < (categories || []).length; i++) {
        const cat = categories[i];
        const srcType = cat.source_type || 'bank';
        const srcId = cat.source_id || cat.bank_id || null;
        await client.query(
            'INSERT INTO trivial_categories (trivial_id, category_name, color, bank_id, source_type, source_id, position) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [gameId, cat.category_name, cat.color, srcType === 'bank' ? srcId : null, srcType, srcId, i]
        );
    }
}

function invalidateTrivialCaches(id, pin) {
    questionBankCache.invalidate(id, 'trivial');
    questionBankCache.invalidate(pin, 'trivial');
    if (typeof questionBankCache.invalidateGame === 'function') {
        questionBankCache.invalidateGame(id, 'trivial');
        questionBankCache.invalidateGame(pin, 'trivial');
    }

    pinCache.invalidate(pin);
    pinCache.invalidate(`presenter:${pin}`);
}

/**
 * Crea un juego Trivial con sus categorías en una transacción. Sin PIN se genera uno de 6 cifras.
 * @param {Object} data - Campos de trivial_games más `categories` ({category_name, color, source_type,
 *   source_id|bank_id}[], en orden de tablero); los que faltan toman su valor por defecto
 * @returns {Promise<Object>} Fila creada de trivial_games
 * @throws {Error} Si falla la consulta (p. ej. PIN duplicado, 23505); se hace ROLLBACK
 */
async function createTrivialGame(data) {
    const {
        name,
        language,
        categories,
        outer_casillas = 24,
        visible_to_presenter = true,
        created_by_role = 'admin',
        created_by_user_id = null
    } = data;
    const pin = (data.pin || Math.floor(100000 + Math.random() * 900000).toString()).toUpperCase();
    const ownerRole = normalizeCreatorRole(created_by_role);
    const ownerUserId =
        Number.isInteger(Number(created_by_user_id)) && Number(created_by_user_id) > 0
            ? Number(created_by_user_id)
            : null;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const res = await client.query(
            `INSERT INTO trivial_games
                (name, pin, language, outer_casillas, visible_to_presenter, created_by_role, created_by_user_id,
                 use_streaks, streak_threshold, streak_bonus_percentage,
                 use_double_streaks, double_streak_threshold, double_streak_bonus_percentage,
                 image_url,
                 use_random_points, random_points_min, random_points_max)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
            [
                name,
                pin,
                language,
                outer_casillas,
                visible_to_presenter,
                ownerRole,
                ownerUserId,
                ...trivialSettingsParams(data)
            ]
        );
        const gameId = res.rows[0].id;
        await insertTrivialCategories(client, gameId, categories);
        await client.query('COMMIT');
        return res.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Actualiza un juego Trivial, sustituye sus categorías e invalida sus cachés. Los fallos de guardado no se relanzan:
 * se registran y se devuelven.
 * @param {number} id - ID del juego
 * @param {Object} data - Campos de trivial_games más `categories` ({category_name, color, source_type,
 *   source_id|bank_id}[], en orden de tablero); los que faltan toman su valor por defecto
 * @param {number|null} [actorUserId=null] - Editor que actúa; null para un admin (sin comprobar propiedad)
 * @returns {Promise<{success: boolean, error?: string}>} success false con el mensaje si falla el guardado
 * @throws {Error} code 'NOT_FOUND' (404) u 'OWNER_FORBIDDEN' (403) si un editor no es el creador
 */
async function updateTrivialGame(id, data, actorUserId = null) {
    const { name, pin, language, categories, outer_casillas, visible_to_presenter = true } = data;
    const upperPin = String(pin).toUpperCase();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await assertEditorCanModifyResource('trivial', id, actorUserId, client);
        await client.query(
            `UPDATE trivial_games SET
                name=$1, pin=$2, language=$3, outer_casillas=$4, visible_to_presenter=$5,
                use_streaks=$6, streak_threshold=$7, streak_bonus_percentage=$8,
                use_double_streaks=$9, double_streak_threshold=$10, double_streak_bonus_percentage=$11,
                image_url=$12,
                use_random_points=$13, random_points_min=$14, random_points_max=$15
             WHERE id=$16`,
            [
                name,
                upperPin,
                language,
                outer_casillas,
                visible_to_presenter,
                ...trivialSettingsParams(data),
                id
            ]
        );
        await client.query('DELETE FROM trivial_categories WHERE trivial_id=$1', [id]);
        await insertTrivialCategories(client, id, categories);
        await client.query('COMMIT');

        invalidateTrivialCaches(id, upperPin);

        return { success: true };
    } catch (err) {
        await client.query('ROLLBACK');
        // Los rechazos de propiedad llevan su status (403/404) y la ruta los responde tal cual
        if (err.status) throw err;
        logger.error('Error updating trivial game', { error: err.message });
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Borra un juego Trivial e invalida sus cachés.
 * @param {number} id - ID del juego
 * @param {number|null} [actorUserId=null] - Editor que actúa; null para un admin (sin comprobar propiedad)
 * @returns {Promise<{success: true}>}
 * @throws {Error} code 'NOT_FOUND' (404) u 'OWNER_FORBIDDEN' (403) si un editor no es el creador
 * @throws {Error} Si falla la consulta
 */
async function deleteTrivialGame(id, actorUserId = null) {
    await assertEditorCanModifyResource('trivial', id, actorUserId, pool);

    // Obtener PIN antes de eliminar para invalidar caché
    const trivialRes = await pool.query('SELECT pin FROM trivial_games WHERE id=$1', [id]);
    const trivialPin = trivialRes.rows[0]?.pin;

    await pool.query('DELETE FROM trivial_games WHERE id=$1', [id]);

    // Invalidar caché
    if (trivialPin) {
        invalidateTrivialCaches(id, trivialPin);
    }

    return { success: true };
}

// Las consultas de getRandomQuestionFromBank y getTrivialCategoryQuestion llevan
// AND q.question_type <> 'survey_multiple': la encuesta de selección múltiple no tiene
// respuesta correcta que dé quesito, así que el tablero no la escoge.
/**
 * Escoge al azar una pregunta de un banco, con sus opciones, sin repetir las ya hechas.
 * @param {number} bankId - ID del banco
 * @param {number[]} [excludeIds=[]] - IDs de preguntas ya hechas en la partida
 * @returns {Promise<Object|null>} Pregunta con `options`, o null si no quedan
 * @throws {Error} Si falla la consulta
 */
async function getRandomQuestionFromBank(bankId, excludeIds = []) {
    const params = [bankId];
    let exclusion = '';
    if (excludeIds.length > 0) {
        const placeholders = excludeIds.map((_, i) => `$${i + 2}`).join(',');
        exclusion = `AND q.id NOT IN (${placeholders})`;
        params.push(...excludeIds);
    }
    const result = await pool.query(
        `SELECT q.*,
            (SELECT json_agg(o.* ORDER BY COALESCE(o.order_index, o.id))
             FROM options o WHERE o.question_id = q.id) AS options
         FROM questions q
         WHERE q.bank_id=$1 ${exclusion} AND q.question_type <> 'survey_multiple'
         ORDER BY RANDOM() LIMIT 1`,
        params
    );
    return result.rows[0] || null;
}

/**
 * Escoge al azar una pregunta para una categoría del tablero según su origen (banco, juego o juego personalizado), sin
 * repetir las ya hechas.
 * @param {'bank'|'game'|'custom_game'} sourceType - Origen de la categoría (cualquier otro valor se trata como banco)
 * @param {number} sourceId - ID del origen
 * @param {number[]} [excludeIds=[]] - IDs de preguntas ya hechas en la partida
 * @returns {Promise<Object|null>} Pregunta con `options`, o null si no quedan
 * @throws {Error} Si falla la consulta
 */
async function getTrivialCategoryQuestion(sourceType, sourceId, excludeIds = []) {
    const excl = excludeIds.length > 0 ? `AND q.id NOT IN (${excludeIds.map((_, i) => `$${i + 2}`).join(',')})` : '';
    const params = [sourceId, ...excludeIds];
    let sql;
    if (sourceType === 'game') {
        sql = `SELECT q.*, (SELECT json_agg(o.* ORDER BY COALESCE(o.order_index,o.id)) FROM options o WHERE o.question_id=q.id) AS options
               FROM questions q INNER JOIN game_banks gb ON q.bank_id=gb.bank_id WHERE gb.game_id=$1 ${excl} AND q.question_type <> 'survey_multiple' ORDER BY RANDOM() LIMIT 1`;
    } else if (sourceType === 'custom_game') {
        sql = `SELECT q.*, (SELECT json_agg(o.* ORDER BY COALESCE(o.order_index,o.id)) FROM options o WHERE o.question_id=q.id) AS options
               FROM questions q INNER JOIN custom_game_questions cgq ON q.id=cgq.question_id WHERE cgq.custom_game_id=$1 AND cgq.slide_type='question' ${excl} AND q.question_type <> 'survey_multiple' ORDER BY RANDOM() LIMIT 1`;
    } else {
        sql = `SELECT q.*, (SELECT json_agg(o.* ORDER BY COALESCE(o.order_index,o.id)) FROM options o WHERE o.question_id=q.id) AS options
               FROM questions q WHERE q.bank_id=$1 ${excl} AND q.question_type <> 'survey_multiple' ORDER BY RANDOM() LIMIT 1`;
    }
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
}

/**
 * Busca juegos Trivial que usan un origen como categoría, para impedir borrarlo.
 * @param {'bank'|'game'|'custom_game'} sourceType - Tipo de origen
 * @param {number} sourceId - ID del origen
 * @returns {Promise<{name: string}[]>} Hasta 5 nombres; vacío si se puede borrar
 * @throws {Error} Si falla la consulta
 */
async function checkTrivialUsage(sourceType, sourceId) {
    let whereClause;
    let params;
    if (sourceType === 'bank') {
        whereClause = '(tc.source_type = \'bank\' AND tc.source_id = $1) OR tc.bank_id = $1';
        params = [sourceId];
    } else {
        whereClause = 'tc.source_type = $2 AND tc.source_id = $1';
        params = [sourceId, sourceType];
    }
    const result = await pool.query(
        `SELECT tg.name FROM trivial_categories tc
         JOIN trivial_games tg ON tg.id = tc.trivial_id
         WHERE ${whereClause} LIMIT 5`,
        params
    );
    return result.rows; // array of { name } — empty means safe to delete
}

module.exports = {
    getAllTrivialGames,
    getTrivialGameById,
    getTrivialGameByPin,
    createTrivialGame,
    updateTrivialGame,
    deleteTrivialGame,
    getRandomQuestionFromBank,
    getTrivialCategoryQuestion,
    checkTrivialUsage
};
