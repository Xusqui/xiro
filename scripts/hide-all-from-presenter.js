#!/usr/bin/env node
/**
 * Pone todos los juegos, bancos de preguntas, juegos personalizados y
 * juegos trivial como NO visibles para el presentador.
 *
 * Uso:
 *   node scripts/hide-all-from-presenter.js            # aplica el cambio
 *   node scripts/hide-all-from-presenter.js --dry-run  # solo muestra cuántas filas afectaría
 */

const { pool } = require('../app/config/database');
const logger = require('../app/config/logger');

const TABLES = ['question_banks', 'games', 'custom_games', 'trivial_games'];

async function hideAllFromPresenter({ dryRun = false } = {}) {
    for (const table of TABLES) {
        if (dryRun) {
            const { rows } = await pool.query(
                `SELECT COUNT(*) FROM ${table} WHERE visible_to_presenter = true`
            );
            logger.info(`[dry-run] ${table}: ${rows[0].count} fila(s) pasarían a no visibles`);
            continue;
        }

        const result = await pool.query(
            `UPDATE ${table} SET visible_to_presenter = false WHERE visible_to_presenter = true`
        );
        logger.info(`${table}: ${result.rowCount} fila(s) marcada(s) como no visibles`);
    }
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    try {
        await hideAllFromPresenter({ dryRun });
        logger.info(dryRun ? 'Dry-run completado, no se modificó nada.' : 'Listo: todo oculto para el presentador.');
        process.exit(0);
    } catch (error) {
        logger.error('Error ocultando elementos para el presentador:', error.message);
        process.exit(1);
    }
}

main();
