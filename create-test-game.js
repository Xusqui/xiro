#!/usr/bin/env node
/**
 * Script para crear partida de prueba para load testing
 * Crea un juego con PIN "TEST123" para Artillery
 */

const { Pool } = require('pg');

// Configuración de la base de datos (ajustar según tu setup)
const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'xiro_db',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres'
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
            console.log('✅ Partida TEST123 ya existe (ID:', existing.rows[0].id, ')');
            await client.query('ROLLBACK');
            return;
        }

        // Crear el juego
        const gameResult = await client.query(
            'INSERT INTO games (name, pin, visible_to_presenter) VALUES ($1, $2, $3) RETURNING *',
            ['Load Test Game', 'TEST123', true]
        );

        const gameId = gameResult.rows[0].id;
        console.log('✅ Juego creado con PIN: TEST123 (ID:', gameId, ')');

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

            console.log('✅ Banco asociado al juego');
        } else {
            console.log('⚠️  No hay bancos de preguntas disponibles');
        }

        await client.query('COMMIT');
        console.log('\n🎯 Partida lista para load testing con Artillery');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

createTestGame().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
