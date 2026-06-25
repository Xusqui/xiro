const { Pool } = require('pg');
const fs = require('fs');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'xiro'
});

async function exportBank(bankIdOrName) {
    try {
        // Buscar el banco por ID o nombre
        let bankQuery;
        let bankParams;

        if (isNaN(bankIdOrName)) {
            // Es un nombre
            bankQuery = 'SELECT * FROM question_banks WHERE name ILIKE $1';
            bankParams = [`%${bankIdOrName}%`];
        } else {
            // Es un ID
            bankQuery = 'SELECT * FROM question_banks WHERE id = $1';
            bankParams = [parseInt(bankIdOrName)];
        }

        const bankResult = await pool.query(bankQuery, bankParams);

        if (bankResult.rows.length === 0) {
            logger.error('No se encontro ningun banco con ese criterio');
            process.exit(1);
        }

        const bank = bankResult.rows[0];
        logger.info(`Exportando banco: "${bank.name}" (ID: ${bank.id}, PIN: ${bank.pin || 'sin PIN'})`);

        // Obtener todas las preguntas con sus opciones
        const questionsResult = await pool.query(`
            SELECT q.id, q.question_text,
                json_agg(
                    json_build_object(
                        'optionText', o.option_text,
                        'isCorrect', o.is_correct,
                        'justification', o.justification
                    ) ORDER BY o.id
                ) as options
            FROM questions q
            LEFT JOIN options o ON q.id = o.question_id
            WHERE q.bank_id = $1
            GROUP BY q.id
            ORDER BY q.id
        `, [bank.id]);

        const exportData = {
            bank: {
                id: bank.id,
                name: bank.name,
                pin: bank.pin,
                created_at: bank.created_at
            },
            questions: questionsResult.rows.map(q => ({
                questionText: q.question_text,
                options: q.options
            }))
        };

        // Generar nombre de archivo
        const fileName = `banco_${bank.id}_${bank.name.toLowerCase().replace(/\s+/g, '_')}.json`;

        // Guardar archivo JSON
        fs.writeFileSync(fileName, JSON.stringify(exportData, null, 2), 'utf8');

        logger.info(`Exportacion completada: ${questionsResult.rows.length} preguntas`);
        logger.info(`Archivo generado: ${fileName}`);

    } catch (error) {
        logger.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

// Obtener parámetro de línea de comandos
const bankIdOrName = process.argv[2];

if (!bankIdOrName) {
    logger.info('Uso: node export-bank.js <ID_o_nombre_del_banco>');
    logger.info('Ejemplos:');
    logger.info('  node export-bank.js 1');
    logger.info('  node export-bank.js "Medicina"');
    logger.info('  node export-bank.js "Religion Catolica"');
    process.exit(1);
}

exportBank(bankIdOrName);
