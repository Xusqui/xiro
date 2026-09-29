/**
 * @fileoverview Metadata y estilos de los parámetros de configuración
 * Consumido por config-panel-fields.js y config-panel.js
 */

const CONFIG_META = {
    MAX_PLAYERS_PER_GAME: {
        label: 'admin.config.meta.MAX_PLAYERS_PER_GAME.label',
        description: 'admin.config.meta.MAX_PLAYERS_PER_GAME.desc',
        badge: 'inmediato', unit: 'admin.config.unit.players', icon: 'fa-users', iconColor: 'bg-blue-500',
    },
    MAX_LOBBIES: {
        label: 'admin.config.meta.MAX_LOBBIES.label',
        description: 'admin.config.meta.MAX_LOBBIES.desc',
        badge: 'reinicio', unit: 'lobbies', icon: 'fa-layer-group', iconColor: 'bg-violet-500',
    },
    QUESTION_TIME_LIMIT: {
        label: 'admin.config.meta.QUESTION_TIME_LIMIT.label',
        description: 'admin.config.meta.QUESTION_TIME_LIMIT.desc',
        badge: 'inmediato', unit: 'admin.config.unit.seconds', icon: 'fa-stopwatch', iconColor: 'bg-green-500',
    },
    GAME_CLEANUP_INTERVAL: {
        label: 'admin.config.meta.GAME_CLEANUP_INTERVAL.label',
        description: 'admin.config.meta.GAME_CLEANUP_INTERVAL.desc',
        badge: 'próximo ciclo', unit: 'ms', icon: 'fa-recycle', iconColor: 'bg-teal-500',
    },
    BASE_POINTS: {
        label: 'admin.config.meta.BASE_POINTS.label',
        description: 'admin.config.meta.BASE_POINTS.desc',
        badge: 'siguiente pregunta', unit: 'pts', icon: 'fa-star', iconColor: 'bg-yellow-500',
    },
    MAX_TIME_BONUS: {
        label: 'admin.config.meta.MAX_TIME_BONUS.label',
        description: 'admin.config.meta.MAX_TIME_BONUS.desc',
        badge: 'siguiente pregunta', unit: 'pts', icon: 'fa-bolt', iconColor: 'bg-orange-400',
    },
    STREAK_THRESHOLD: {
        label: 'admin.config.meta.STREAK_THRESHOLD.label',
        description: 'admin.config.meta.STREAK_THRESHOLD.desc',
        unit: 'admin.config.unit.correct', icon: 'fa-fire', iconColor: 'bg-red-500',
        disabled: true,
    },
    STREAK_BONUS_PERCENTAGE: {
        label: 'admin.config.meta.STREAK_BONUS_PERCENTAGE.label',
        description: 'admin.config.meta.STREAK_BONUS_PERCENTAGE.desc',
        unit: '×', icon: 'fa-chart-line', iconColor: 'bg-pink-500',
        disabled: true,
    },
    LOG_LEVEL: {
        label: 'admin.config.meta.LOG_LEVEL.label',
        description: 'admin.config.meta.LOG_LEVEL.desc',
        badge: 'inmediato', unit: '', icon: 'fa-terminal', iconColor: 'bg-slate-500',
    },
    LOG_MAX_SIZE: {
        label: 'admin.config.meta.LOG_MAX_SIZE.label',
        description: 'admin.config.meta.LOG_MAX_SIZE.desc',
        badge: 'próxima rotación', unit: '', icon: 'fa-hdd', iconColor: 'bg-amber-500',
    },
    LOG_MAX_FILES: {
        label: 'admin.config.meta.LOG_MAX_FILES.label',
        description: 'admin.config.meta.LOG_MAX_FILES.desc',
        badge: 'próxima rotación', unit: '', icon: 'fa-calendar-alt', iconColor: 'bg-orange-500',
    },
    RECONNECTION_TIMEOUT: {
        label: 'admin.config.meta.RECONNECTION_TIMEOUT.label',
        description: 'admin.config.meta.RECONNECTION_TIMEOUT.desc',
        badge: 'inmediato', unit: 'min', icon: 'fa-wifi', iconColor: 'bg-sky-500',
        msMultiplier: 60000,
    },
    INACTIVE_GAME_THRESHOLD: {
        label: 'admin.config.meta.INACTIVE_GAME_THRESHOLD.label',
        description: 'admin.config.meta.INACTIVE_GAME_THRESHOLD.desc',
        badge: 'próximo ciclo', unit: 'h', icon: 'fa-hourglass-end', iconColor: 'bg-slate-400',
        msMultiplier: 3600000,
    },
    EMPTY_LOBBY_TIMEOUT: {
        label: 'admin.config.meta.EMPTY_LOBBY_TIMEOUT.label',
        description: 'admin.config.meta.EMPTY_LOBBY_TIMEOUT.desc',
        badge: 'próximo ciclo', unit: 'min', icon: 'fa-door-open', iconColor: 'bg-rose-400',
        msMultiplier: 60000,
    },
    TOP_PLAYERS_DURING_GAME: {
        label: 'admin.config.meta.TOP_PLAYERS_DURING_GAME.label',
        description: 'admin.config.meta.TOP_PLAYERS_DURING_GAME.desc',
        badge: 'inmediato', unit: 'admin.config.unit.players', icon: 'fa-trophy', iconColor: 'bg-yellow-500',
    },
    CORS_ORIGIN: {
        label: 'admin.config.meta.CORS_ORIGIN.label',
        description: 'admin.config.meta.CORS_ORIGIN.desc',
        badge: 'inmediato', unit: '', icon: 'fa-shield-alt', iconColor: 'bg-cyan-500',
    },
    ALLOWED_ORIGINS: {
        label: 'admin.config.meta.ALLOWED_ORIGINS.label',
        description: 'admin.config.meta.ALLOWED_ORIGINS.desc',
        badge: 'inmediato', unit: '', icon: 'fa-plug', iconColor: 'bg-sky-600',
    },
    UMAMI_SERVER_URL: {
        label: 'admin.config.meta.UMAMI_SERVER_URL.label',
        description: 'admin.config.meta.UMAMI_SERVER_URL.desc',
        badge: 'inmediato', unit: '', icon: 'fa-chart-bar', iconColor: 'bg-indigo-500',
    },
    UMAMI_WEBSITE_ID: {
        label: 'admin.config.meta.UMAMI_WEBSITE_ID.label',
        description: 'admin.config.meta.UMAMI_WEBSITE_ID.desc',
        badge: 'inmediato', unit: '', icon: 'fa-id-badge', iconColor: 'bg-indigo-400',
    },
    BACKUP_SCHEDULE: {
        label: 'admin.config.meta.BACKUP_SCHEDULE.label',
        description: 'admin.config.meta.BACKUP_SCHEDULE.desc',
        badge: 'próximo ciclo', unit: '', icon: 'fa-clock', iconColor: 'bg-blue-600',
        labelMap: {
            'disabled': 'admin.config.meta.BACKUP_SCHEDULE.opt_disabled',
            '0 2 * * *': 'admin.config.meta.BACKUP_SCHEDULE.opt_daily',
            '0 2 * * 0': 'admin.config.meta.BACKUP_SCHEDULE.opt_weekly',
            '0 2 1 * *': 'admin.config.meta.BACKUP_SCHEDULE.opt_monthly',
        },
    },
    BACKUP_RETENTION_DAYS: {
        label: 'admin.config.meta.BACKUP_RETENTION_DAYS.label',
        description: 'admin.config.meta.BACKUP_RETENTION_DAYS.desc',
        badge: 'próximo ciclo', unit: 'admin.config.unit.days', icon: 'fa-database', iconColor: 'bg-indigo-600',
    },
    // ── Contacto / SMTP ──────────────────────────────────────────────────────
    SMTP_HOST: {
        label: 'admin.config.meta.SMTP_HOST.label',
        description: 'admin.config.meta.SMTP_HOST.desc',
        badge: 'inmediato', unit: '', icon: 'fa-server', iconColor: 'bg-slate-500',
    },
    SMTP_PORT: {
        label: 'admin.config.meta.SMTP_PORT.label',
        description: 'admin.config.meta.SMTP_PORT.desc',
        badge: 'inmediato', unit: '', icon: 'fa-plug', iconColor: 'bg-slate-400',
    },
    SMTP_SECURE: {
        label: 'admin.config.meta.SMTP_SECURE.label',
        description: 'admin.config.meta.SMTP_SECURE.desc',
        badge: 'inmediato', unit: '', icon: 'fa-lock', iconColor: 'bg-green-500',
        labelMap: {
            'true': 'admin.config.meta.SMTP_SECURE.opt_true',
            'false': 'admin.config.meta.SMTP_SECURE.opt_false',
        },
    },
    SMTP_USER: {
        label: 'admin.config.meta.SMTP_USER.label',
        description: 'admin.config.meta.SMTP_USER.desc',
        badge: 'inmediato', unit: '', icon: 'fa-user', iconColor: 'bg-blue-500',
    },
    SMTP_PASS: {
        label: 'admin.config.meta.SMTP_PASS.label',
        description: 'admin.config.meta.SMTP_PASS.desc',
        badge: 'inmediato', unit: '', icon: 'fa-key', iconColor: 'bg-amber-500',
    },
    SMTP_FROM: {
        label: 'admin.config.meta.SMTP_FROM.label',
        description: 'admin.config.meta.SMTP_FROM.desc',
        badge: 'inmediato', unit: '', icon: 'fa-envelope', iconColor: 'bg-purple-500',
    },
    CONTACT_TOKEN_SECRET: {
        label: 'admin.config.meta.CONTACT_TOKEN_SECRET.label',
        description: 'admin.config.meta.CONTACT_TOKEN_SECRET.desc',
        badge: 'inmediato', unit: '', icon: 'fa-shield-alt', iconColor: 'bg-red-500',
    },
};

const UI_FIREWORKS_META = {
    fireworksShellSize: {
        label: 'admin.config.fw.fireworksShellSize.label',
        description: 'admin.config.fw.fireworksShellSize.desc',
        unit: '', icon: 'fa-expand', iconColor: 'bg-purple-500',
        min: 0, max: 16, step: 1, defaultValue: 2,
    },
    fireworksFinaleMode: {
        label: 'admin.config.fw.fireworksFinaleMode.label',
        description: 'admin.config.fw.fireworksFinaleMode.desc',
        icon: 'fa-star', iconColor: 'bg-pink-500',
    },
    fireworksSimSpeed: {
        label: 'admin.config.fw.fireworksSimSpeed.label',
        description: 'admin.config.fw.fireworksSimSpeed.desc',
        unit: '×', icon: 'fa-tachometer-alt', iconColor: 'bg-cyan-500',
        min: 0.1, max: 3, step: 0.1, defaultValue: 1,
    },
    fireworksLaunchIntervalMin: {
        label: 'admin.config.fw.fireworksLaunchIntervalMin.label',
        description: 'admin.config.fw.fireworksLaunchIntervalMin.desc',
        unit: 'ms', icon: 'fa-clock', iconColor: 'bg-indigo-500',
        min: 100, max: 3000, step: 50, defaultValue: 900,
    },
    fireworksLaunchIntervalMax: {
        label: 'admin.config.fw.fireworksLaunchIntervalMax.label',
        description: 'admin.config.fw.fireworksLaunchIntervalMax.desc',
        unit: 'ms', icon: 'fa-history', iconColor: 'bg-blue-500',
        min: 100, max: 3000, step: 50, defaultValue: 1500,
    },
    fireworksMaxFinaleCount: {
        label: 'admin.config.fw.fireworksMaxFinaleCount.label',
        description: 'admin.config.fw.fireworksMaxFinaleCount.desc',
        unit: '', icon: 'fa-layer-group', iconColor: 'bg-red-500',
        min: 8, max: 64, step: 4, defaultValue: 32,
    },
    fireworksTrailIntensity: {
        label: 'admin.config.fw.fireworksTrailIntensity.label',
        description: 'admin.config.fw.fireworksTrailIntensity.desc',
        unit: '', icon: 'fa-wind', iconColor: 'bg-teal-500',
        min: 0.05, max: 0.3, step: 0.01, defaultValue: 0.175,
    },
    fireworksStarWidth: {
        label: 'admin.config.fw.fireworksStarWidth.label',
        description: 'admin.config.fw.fireworksStarWidth.desc',
        unit: 'px', icon: 'fa-circle', iconColor: 'bg-amber-500',
        min: 1, max: 6, step: 0.5, defaultValue: 3,
    },
    fireworksSparkWidth: {
        label: 'admin.config.fw.fireworksSparkWidth.label',
        description: 'admin.config.fw.fireworksSparkWidth.desc',
        unit: 'px', icon: 'fa-dot-circle', iconColor: 'bg-orange-500',
        min: 0.5, max: 4, step: 0.25, defaultValue: 1,
    },
    fireworksSound: {
        label: 'admin.config.fw.fireworksSound.label',
        description: 'admin.config.fw.fireworksSound.desc',
        icon: 'fa-volume-up', iconColor: 'bg-green-500',
    },
};

const CONFIG_BADGE_COLORS = {
    'inmediato': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'reinicio': 'bg-red-100 text-red-700 border border-red-200',
    'próximo ciclo': 'bg-amber-100 text-amber-700 border border-amber-200',
    'próxima rotación': 'bg-amber-100 text-amber-700 border border-amber-200',
    'siguiente pregunta': 'bg-sky-100 text-sky-700 border border-sky-200',
};
