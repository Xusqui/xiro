/**
 * PM2 Ecosystem Configuration
 * 
 * ARQUITECTURA SIN STICKY SESSIONS:
 * - 4 workers independientes (cluster mode)
 * - Redis Adapter sincroniza estado entre workers
 * - Clientes pueden conectarse a cualquier worker
 * - Eventos/rooms se propagan automáticamente en Redis
 * - NO se requiere afinidad de sesión en Cloudflare
 * 
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 */

module.exports = {
    apps: [{
        name: 'xiro-backend',
        script: './index.js',

        // ===== CLUSTER MODE: MAX WORKERS (1 por hilo disponible) =====
        instances: 'max',
        exec_mode: 'cluster',
        instance_var: 'NODE_APP_INSTANCE', // PM2 setea: 0..N

        // ===== AUTO RESTART POLICY =====
        watch: false,
        max_memory_restart: '1G',

        // ===== ENVIRONMENT: PRODUCCIÓN =====
        env_production: {
            NODE_ENV: 'production',

            // Redis: Estado compartido (crítico para cluster sin sticky)
            REDIS_URL: process.env.REDIS_URL || 'redis://redis:6379',
            REDIS_HOST: process.env.REDIS_HOST || 'redis',
            REDIS_PORT: process.env.REDIS_PORT || 6379,
            REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',

            // PostgreSQL
            DB_USER: process.env.DB_USER || 'postgres',
            DB_HOST: process.env.DB_HOST || 'postgres',
            DB_NAME: process.env.DB_NAME || 'xiro_db',
            DB_PASSWORD: process.env.DB_PASSWORD,
            DB_PORT: process.env.DB_PORT || 5432,
            DB_POOL_MIN: 2,
            DB_POOL_MAX: 5,

            // Servidor
            PORT: process.env.PORT || 3000,
            SERVER_HOST: process.env.SERVER_HOST || 'xiro.pro',
            CORS_ORIGIN: process.env.CORS_ORIGIN,
            ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,

            // JWT
            JWT_SECRET: process.env.JWT_SECRET,

            // Game constraints
            MAX_PLAYERS_PER_GAME: 1000,
            MAX_TOTAL_PLAYERS: 10000,
            QUESTION_TIME_LIMIT: 20
        },

        // ===== ENVIRONMENT: DESARROLLO =====
        env_development: {
            NODE_ENV: 'development',
            REDIS_URL: 'redis://localhost:6379',
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
            DB_USER: 'postgres',
            DB_HOST: 'localhost',
            DB_NAME: 'xiro_db',
            DB_PASSWORD: 'postgres',
            DB_PORT: 5432,
            PORT: 3000,
            SERVER_HOST: 'localhost',
            CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost',
            ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost'
        },

        // ===== LOGGING =====
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,

        // ===== RESTART BEHAVIOR =====
        min_uptime: '10s',
        max_restarts: 10,
        listen_timeout: 3000,
        kill_timeout: 5000,

        // ===== NO STICKY SESSIONS NEEDED =====
        // Workers son totalmente independientes
        // Redis Adapter sincroniza todo automáticamente
    }]
};
