#!/usr/bin/env node
/**
 * Script para crear partida de prueba para load testing
 * Crea un juego con PIN "TEST123" para Artillery
 */

const { Pool } = require('pg');
const logger = require('../config/logger');

// Configuración de la base de datos (usa variables de entorno del contenedor)
const pool = new Pool({
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'xiro_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function createTestGame() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Verificar si ya existe
        const existing = await client.query(
            'SELECT id FROM games WHERE pin = $1',
            ['TEST123']
        );

        if (existing.rows.length > 0) {
            logger.info('Partida TEST123 ya existe', { id: existing.rows[0].id });
            await client.query('ROLLBACK');
            return;
        }

        // Crear el juego
        const gameResult = await client.query(
            'INSERT INTO games (name, pin, visible_to_presenter) VALUES ($1, $2, $3) RETURNING *',
            ['Load Test Game', 'TEST123', true]
        );

        const gameId = gameResult.rows[0].id;
        logger.info('Juego creado con PIN: TEST123', { id: gameId });

        // Obtener primer banco de preguntas disponible
        const bankResult = await client.query(
            'SELECT id FROM question_banks LIMIT 1'
        );

        if (bankResult.rows.length > 0) {
            const bankId = bankResult.rows[0].id;

            // Asociar banco al juego
            await client.query(
                'INSERT INTO game_banks (game_id, bank_id, question_count) VALUES ($1, $2, $3)',
                [gameId, bankId, 10]
            );

            logger.info('Banco asociado al juego');
        } else {
            logger.warn('No hay bancos de preguntas disponibles');
        }

        await client.query('COMMIT');
        logger.info('Partida lista para load testing con Artillery');

    } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Error:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

createTestGame().catch(err => {
    logger.error('Error fatal:', err);
    process.exit(1);
});
