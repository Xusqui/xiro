#!/usr/bin/env node

/**
 * @fileoverview CLI para gestión de migraciones
 * Uso: node migrate.js [comando]
 * Comandos:
 *   up       - Ejecutar migraciones pendientes
 *   status   - Ver estado de migraciones
 *   create   - Crear nueva migración
 */

const { runPendingMigrations, getMigrationsStatus } = require('./migration-runner');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');

const command = process.argv[2];

async function main() {
    try {
        switch (command) {
            case 'up': {
                logger.info('Ejecutando migraciones...');
                const result = await runPendingMigrations();
                logger.info(`${result.executed} migracion(es) ejecutada(s)`);
                if (result.migrations.length > 0) {
                    logger.info('Detalle:');
                    result.migrations.forEach(m => {
                        logger.info(`${m.filename} (${m.executionTime}ms)`);
                    });
                }
                break;
            }

            case 'status': {
                logger.info('Estado de migraciones:');
                const status = await getMigrationsStatus();
                logger.info(`Total: ${status.total}`);
                logger.info(`Ejecutadas: ${status.executed}`);
                logger.info(`Pendientes: ${status.pending}`);

                if (status.migrations.length > 0) {
                    logger.info('Migraciones:');
                    status.migrations.forEach(m => {
                        const icon = m.executed ? '✅' : '⏳';
                        logger.info(`${icon} ${m.filename}`);
                    });
                }
                break;
            }

            case 'create': {
                const migrationName = process.argv[3];
                if (!migrationName) {
                    logger.error('Error: Especifica el nombre de la migracion');
                    logger.info('Uso: node migrate.js create nombre_migracion');
                    process.exit(1);
                }

                const timestamp = new Date().toISOString()
                    .replace(/[-:]/g, '')
                    .replace(/T/, '')
                    .slice(0, 14);

                const filename = `${timestamp}_${migrationName}.sql`;
                const filepath = path.join(__dirname, filename);

                const template = `-- =====================================================
-- Migración: ${filename.replace('.sql', '')}
-- Descripción: [Describe los cambios aquí]
-- Autor: Sistema
-- Fecha: ${new Date().toISOString().split('T')[0]}
-- =====================================================

-- Escribe tu migración SQL aquí

-- Ejemplo:
-- ALTER TABLE tabla ADD COLUMN nueva_columna VARCHAR(255);

-- Log de finalización
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Migración ejecutada exitosamente';
END $$;
`;

                await fs.writeFile(filepath, template);
                logger.info(`Migracion creada: ${filename}`);
                break;
            }

            default:
                logger.info('CLI de Migraciones de Base de Datos');
                logger.info('Uso: node migrate.js [comando]');
                logger.info('Comandos disponibles:');
                logger.info('  up       - Ejecutar migraciones pendientes');
                logger.info('  status   - Ver estado de migraciones');
                logger.info('  create   - Crear nueva migracion');
                logger.info('Ejemplos:');
                logger.info('  node migrate.js up');
                logger.info('  node migrate.js status');
                logger.info('  node migrate.js create add_new_table');
                break;
        }

        process.exit(0);
    } catch (error) {
        logger.error('Error:', error.message);
        process.exit(1);
    }
}

main();
