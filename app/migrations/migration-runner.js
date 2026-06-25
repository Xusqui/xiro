/**
 * @fileoverview Sistema de migraciones de base de datos
 * Gestiona la ejecución y seguimiento de migraciones SQL
 */

const { pool } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');
const { getWorkerContext } = require('../config/log-context');

const MIGRATION_LOCK_KEY_1 = 91734;
const MIGRATION_LOCK_KEY_2 = 240214;

async function acquireMigrationLock(client) {
    const result = await client.query(
        'SELECT pg_try_advisory_lock($1, $2) AS locked',
        [MIGRATION_LOCK_KEY_1, MIGRATION_LOCK_KEY_2]
    );
    return result.rows[0]?.locked === true;
}

async function releaseMigrationLock(client) {
    await client.query('SELECT pg_advisory_unlock($1, $2)', [
        MIGRATION_LOCK_KEY_1,
        MIGRATION_LOCK_KEY_2
    ]);
}

/**
 * Crear tabla de control de migraciones si no existe
 */
async function ensureMigrationsTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            version VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            execution_time_ms INTEGER
        );
        
        CREATE INDEX IF NOT EXISTS idx_schema_migrations_version 
        ON schema_migrations(version);
        
        COMMENT ON TABLE schema_migrations IS 'Control de migraciones ejecutadas';
    `;

    await pool.query(query);
    logger.info('Tabla schema_migrations verificada', getWorkerContext());
}

/**
 * Obtener migraciones ya ejecutadas
 */
async function getExecutedMigrations() {
    await ensureMigrationsTable();
    const result = await pool.query(
        'SELECT version FROM schema_migrations ORDER BY version'
    );
    return result.rows.map(row => row.version);
}

/**
 * Registrar migración ejecutada
 */
async function recordMigration(version, name, executionTimeMs) {
    await pool.query(
        'INSERT INTO schema_migrations (version, name, execution_time_ms) VALUES ($1, $2, $3)',
        [version, name, executionTimeMs]
    );
}

/**
 * Obtener lista de archivos de migración disponibles
 */
async function getAvailableMigrations() {
    const migrationsDir = __dirname;
    const files = await fs.readdir(migrationsDir);

    return files
        .filter(file => file.endsWith('.sql') && file.match(/^\d{14}_.*\.sql$/))
        .sort();
}

/**
 * Ejecutar una migración SQL
 */
async function executeMigration(filename) {
    const filePath = path.join(__dirname, filename);
    const sql = await fs.readFile(filePath, 'utf8');

    const version = filename.split('_')[0];
    const name = filename.replace(/^\d{14}_/, '').replace('.sql', '');

    logger.info(`Ejecutando migración: ${filename}`, getWorkerContext());

    const startTime = Date.now();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');

        const executionTime = Date.now() - startTime;
        await recordMigration(version, name, executionTime);

        logger.info(`✅ Migración ${filename} ejecutada exitosamente en ${executionTime}ms`, getWorkerContext());
        return { success: true, filename, executionTime };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`❌ Error ejecutando migración ${filename}:`, error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Ejecutar todas las migraciones pendientes
 */
async function runPendingMigrations() {
    logger.info('🔍 Verificando migraciones pendientes...', getWorkerContext());

    const lockClient = await pool.connect();
    let lockAcquired = false;

    try {
        lockAcquired = await acquireMigrationLock(lockClient);

        if (!lockAcquired) {
            logger.info('⏭️ Otro worker ya está ejecutando migraciones. Se omite en este proceso.', getWorkerContext());
            return { executed: 0, migrations: [], skipped: true };
        }

        const executed = await getExecutedMigrations();
        const available = await getAvailableMigrations();

        const pending = available.filter(file => {
            const version = file.split('_')[0];
            return !executed.includes(version);
        });

        if (pending.length === 0) {
            logger.info('✅ No hay migraciones pendientes', getWorkerContext());
            return { executed: 0, migrations: [] };
        }

        logger.info(`📋 ${pending.length} migración(es) pendiente(s)`, getWorkerContext());

        const results = [];
        for (const migration of pending) {
            try {
                const result = await executeMigration(migration);
                results.push(result);
            } catch (error) {
                logger.error(`❌ Migración fallida: ${migration}`);
                throw error;
            }
        }

        logger.info(`✅ ${results.length} migración(es) ejecutada(s) exitosamente`, getWorkerContext());
        return { executed: results.length, migrations: results };
    } finally {
        if (lockAcquired) {
            try {
                await releaseMigrationLock(lockClient);
            } catch (unlockError) {
                logger.warn('⚠️ No se pudo liberar migration lock', { error: unlockError.message });
            }
        }
        lockClient.release();
    }
}

/**
 * Obtener estado de migraciones
 */
async function getMigrationsStatus() {
    const executed = await getExecutedMigrations();
    const available = await getAvailableMigrations();

    const status = available.map(file => {
        const version = file.split('_')[0];
        return {
            version,
            name: file.replace(/^\d{14}_/, '').replace('.sql', ''),
            filename: file,
            executed: executed.includes(version)
        };
    });

    return {
        total: available.length,
        executed: executed.length,
        pending: available.length - executed.length,
        migrations: status
    };
}

module.exports = {
    runPendingMigrations,
    getMigrationsStatus,
    executeMigration,
    ensureMigrationsTable
};
