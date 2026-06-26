/**
 * @fileoverview Configuración de PostgreSQL y funciones de inicialización
 * Gestiona el pool de conexiones y las migraciones de base de datos
 */

require('./env');
const { Pool } = require('pg');
const logger = require('./logger');
const DatabaseCircuitBreaker = require('../infrastructure/resilience/DatabaseCircuitBreaker');

// Configuración del pool de conexiones
const rawPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    min: parseInt(process.env.DB_POOL_MIN) || 5,
    max: parseInt(process.env.DB_POOL_MAX) || 30, // Aumentado de 20 a 30 para alta concurrencia
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 20000, // Reducido de 30000 a 20000 - liberar conexiones más rápido
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
    statement_timeout: 30000,
    query_timeout: 30000,
});

// Wrapper con Circuit Breaker
const pool = new DatabaseCircuitBreaker(rawPool, {
    readFailureThreshold: 5,
    writeFailureThreshold: 3,
    readTimeout: 30000,
    writeTimeout: 30000
});

// Manejo de eventos del pool - minimizar logs repetidos
// Solo loguear errores de conexión críticos
rawPool.on('error', (err, _client) => {
    logger.error('Unexpected error on idle PostgreSQL client', { error: err.message });
});

// Loguear solo la primera conexión establecida
let connectedOnce = false;
rawPool.on('connect', () => {
    if (!connectedOnce) {
        logger.debug('New PostgreSQL connection established');
        connectedOnce = true;
    }
});

// Mantener handler remove para compatibilidad y limitar ruido (máx. 1 log cada 30s)
let lastRemoveLogAt = 0;
rawPool.on('remove', () => {
    const now = Date.now();
    if (now - lastRemoveLogAt >= 30000) {
        logger.debug('PostgreSQL connection removed from pool');
        lastRemoveLogAt = now;
    }
});

const MIGRATION_QUERIES = [
    'ALTER TABLE options ADD COLUMN IF NOT EXISTS justification TEXT',
    'ALTER TABLE options ADD COLUMN IF NOT EXISTS order_index INTEGER',
    'ALTER TABLE questions ADD COLUMN IF NOT EXISTS bank_id INTEGER REFERENCES question_banks(id) ON DELETE CASCADE',
    'ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(30) DEFAULT \'quiz\'',
    'ALTER TABLE questions ALTER COLUMN question_type TYPE VARCHAR(30)',
    'ALTER TABLE questions ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT 20',
    'ALTER TABLE questions ADD COLUMN IF NOT EXISTS tipo_contenido VARCHAR(10) DEFAULT \'texto\'',
    'ALTER TABLE questions ADD COLUMN IF NOT EXISTS url_recurso TEXT',
    'ALTER TABLE questions ADD COLUMN IF NOT EXISTS correct_answer NUMERIC',
    'ALTER TABLE questions ADD COLUMN IF NOT EXISTS max_points INTEGER',
    'ALTER TABLE questions ADD COLUMN IF NOT EXISTS hint_text TEXT',
    'ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS pin VARCHAR(10) UNIQUE',
    'ALTER TABLE custom_game_questions ADD COLUMN IF NOT EXISTS slide_image_position VARCHAR(5) CHECK (slide_image_position IN (\'left\', \'right\'))',
    'ALTER TABLE custom_game_questions ADD COLUMN IF NOT EXISTS slide_title TEXT',
    'ALTER TABLE custom_game_questions ADD COLUMN IF NOT EXISTS slide_body TEXT'
];

const INDEX_QUERIES = [
    'CREATE INDEX IF NOT EXISTS idx_questions_bank_id ON questions(bank_id)',
    'CREATE INDEX IF NOT EXISTS idx_options_question_id ON options(question_id)',
    'CREATE INDEX IF NOT EXISTS idx_game_banks_game_id ON game_banks(game_id)',
    'CREATE INDEX IF NOT EXISTS idx_game_banks_bank_id ON game_banks(bank_id)',
    'CREATE INDEX IF NOT EXISTS idx_games_pin ON games(pin)',
    'CREATE INDEX IF NOT EXISTS idx_question_banks_pin ON question_banks(pin)',
    'CREATE INDEX IF NOT EXISTS idx_custom_games_pin ON custom_games(pin)',
    'CREATE INDEX IF NOT EXISTS idx_custom_game_questions_game_id ON custom_game_questions(custom_game_id)',
    'CREATE INDEX IF NOT EXISTS idx_custom_game_questions_question_id ON custom_game_questions(question_id)',
    'CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id)',
    'CREATE INDEX IF NOT EXISTS idx_quizzes_pin ON quizzes(pin)'
];

async function runDbQueries(queries) {
    for (const query of queries) {
        await pool.query(query);
    }
}

function logDatabaseReady() {
    logger.info('✅ Database ready and connected', {
        poolMin: rawPool.options.min,
        poolMax: rawPool.options.max
    });
}

async function wait(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

const INITIAL_SCHEMA_QUERY = `
    -- Nueva estructura
    CREATE TABLE IF NOT EXISTS question_banks (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      pin VARCHAR(10) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS site_settings (
      id SMALLINT PRIMARY KEY,
      license TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      pin VARCHAR(10) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS game_banks (
      id SERIAL PRIMARY KEY,
      game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
      bank_id INTEGER REFERENCES question_banks(id) ON DELETE RESTRICT,
      question_count INTEGER NOT NULL,
      UNIQUE(game_id, bank_id)
    );
    
    -- Mantener compatibilidad con estructura antigua
    CREATE TABLE IF NOT EXISTS quizzes (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      pin VARCHAR(10) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
      bank_id INTEGER REFERENCES question_banks(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      time_limit INTEGER DEFAULT 20
    );
    
    CREATE TABLE IF NOT EXISTS options (
      id SERIAL PRIMARY KEY,
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
      option_text TEXT NOT NULL,
      is_correct BOOLEAN DEFAULT FALSE
    );

    -- Tabla para juegos personalizados con preguntas seleccionadas manualmente
    CREATE TABLE IF NOT EXISTS custom_games (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      pin VARCHAR(10) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS custom_game_questions (
      id SERIAL PRIMARY KEY,
      custom_game_id INTEGER REFERENCES custom_games(id) ON DELETE CASCADE,
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      slide_type VARCHAR(20) DEFAULT 'question',
      comment_text TEXT,
      UNIQUE(custom_game_id, position)
    );
    
    -- Añadir columnas si no existen (migración)
    DO $$ 
    BEGIN
      BEGIN
        ALTER TABLE custom_game_questions ADD COLUMN slide_type VARCHAR(20) DEFAULT 'question';
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END;
      BEGIN
        ALTER TABLE custom_game_questions ADD COLUMN comment_text TEXT;
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END;
      BEGIN
        ALTER TABLE custom_game_questions ADD COLUMN slide_image TEXT;
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END;
      BEGIN
        ALTER TABLE custom_game_questions ADD COLUMN slide_image_position VARCHAR(5) CHECK (slide_image_position IN ('left', 'right'));
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END;
      BEGIN
        ALTER TABLE custom_game_questions ALTER COLUMN question_id DROP NOT NULL;
      EXCEPTION
        WHEN others THEN NULL;
      END;
    END $$;
`;

/**
 * Inicializa la base de datos con tablas, índices y migraciones
 * @param {number} retries - Número de reintentos
 * @param {number} delay - Tiempo de espera entre reintentos (ms)
 * @returns {Promise<void>}
 */
const initDB = async (retries = 5, delay = 3000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await pool.query(INITIAL_SCHEMA_QUERY);

            await runDbQueries(MIGRATION_QUERIES);
            await runDbQueries(INDEX_QUERIES);

            logDatabaseReady();
            return;
        } catch (err) {
            logger.error('Database initialization failed', {
                attempt: `${attempt}/${retries}`,
                error: err.message
            });
            if (attempt === retries) {
                logger.error('Failed to connect to database after all retries. Exiting...');
                process.exit(1);
            }
            logger.warn(`Retrying in ${delay / 1000} seconds...`);
            await wait(delay);
        }
    }
};

module.exports = {
    pool,
    initDB
};
