/**
 * @fileoverview Secciones de Configuración → Servidor y su reparto en bloques para la
 * columna de navegación (config-panel-nav.js).
 * Va antes que config-panel.js, site-panel.js, update-panel.js y config-ui.js: Licencia,
 * Actualizaciones e IA registran su sección al cargar con _PARAM_SECTIONS.push.
 */

/* ===== SECCIONES ===== */

const _PARAM_SECTIONS = [
    {
        id: 'partidas',
        titleKey: 'admin.config.tab.partidas',
        icon: 'fa-gamepad',
        color: 'bg-aubergine-500',
        keys: ['MAX_PLAYERS_PER_GAME', 'MAX_LOBBIES', 'QUESTION_TIME_LIMIT', 'GAME_CLEANUP_INTERVAL']
    },
    {
        id: 'puntuacion',
        titleKey: 'admin.config.tab.puntuacion',
        icon: 'fa-star',
        color: 'bg-yellow-500',
        keys: ['BASE_POINTS', 'MAX_TIME_BONUS', 'STREAK_THRESHOLD', 'STREAK_BONUS_PERCENTAGE']
    },
    {
        id: 'logging',
        titleKey: 'admin.config.tab.logging',
        icon: 'fa-file-alt',
        color: 'bg-amber-500',
        keys: ['LOG_LEVEL', 'LOG_MAX_SIZE', 'LOG_MAX_FILES']
    },
    {
        id: 'conexion',
        titleKey: 'admin.config.tab.conexion',
        icon: 'fa-wifi',
        color: 'bg-sky-500',
        keys: [
            'RECONNECTION_TIMEOUT',
            'PRESENTER_RECONNECTION_TIMEOUT',
            'INACTIVE_GAME_THRESHOLD',
            'EMPTY_LOBBY_TIMEOUT',
            'TOP_PLAYERS_DURING_GAME',
            'CORS_ORIGIN',
            'ALLOWED_ORIGINS',
            'UMAMI_SERVER_URL',
            'UMAMI_WEBSITE_ID'
        ]
    },
    {
        id: 'backup',
        titleKey: 'admin.config.tab.backup',
        icon: 'fa-database',
        color: 'bg-blue-600',
        keys: ['BACKUP_SCHEDULE', 'BACKUP_RETENTION_DAYS']
    },
    {
        id: 'licencia',
        titleKey: 'admin.config.tab.licencia',
        icon: 'fa-certificate',
        color: 'bg-red-600',
        isLicense: true,
        keys: []
    },
    {
        id: 'smtp',
        titleKey: 'admin.config.tab.smtp',
        icon: 'fa-envelope',
        color: 'bg-plum-600',
        keys: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'CONTACT_TOKEN_SECRET']
    },
    {
        id: 'lambda',
        titleKey: 'admin.config.tab.lambda',
        icon: 'fa-users-cog',
        color: 'bg-plum-500',
        isLambda: true,
        keys: ['TEAM_SCORE_LAMBDA']
    },
    {
        id: 'fireworks',
        titleKey: 'admin.config.tab.fireworks',
        icon: 'fa-fire',
        color: 'bg-fuchsia-500',
        isFireworks: true,
        keys: []
    },
    { id: 'ui', titleKey: 'admin.config.tab.ui', icon: 'fa-eye', color: 'bg-emerald-500', isUi: true, keys: [] },
    {
        id: 'music',
        titleKey: 'admin.config.tab.music',
        icon: 'fa-music',
        color: 'bg-aubergine-700',
        isMusic: true,
        keys: []
    }
];

/* ===== BLOQUES DE LA COLUMNA ===== */

// Orden de la columna, de arriba abajo. Una sección que no figure en ningún bloque (una
// pestaña nueva registrada con push) va al final del último: nunca se queda sin botón.
// Las que no se hayan registrado (su módulo no está cargado) no aparecen.
const _CONFIG_NAV_GROUPS = [
    { id: 'juego', titleKey: 'admin.config.nav.group.juego', ids: ['partidas', 'puntuacion', 'lambda'] },
    { id: 'pantalla', titleKey: 'admin.config.nav.group.pantalla', ids: ['ui', 'music', 'fireworks'] },
    { id: 'conexiones', titleKey: 'admin.config.nav.group.conexiones', ids: ['conexion', 'smtp', 'groq'] },
    { id: 'sistema', titleKey: 'admin.config.nav.group.sistema', ids: ['licencia', 'updates', 'backup', 'logging'] }
];

/**
 * Bloques con las secciones registradas, en el orden de la columna.
 * @returns {Array<{ id: string, titleKey: string, sections: object[] }>}
 */
function configNavGroups() {
    const byId = new Map(_PARAM_SECTIONS.map(sec => [sec.id, sec]));
    const listed = new Set(_CONFIG_NAV_GROUPS.flatMap(group => group.ids));
    const groups = _CONFIG_NAV_GROUPS.map(group => ({
        id: group.id,
        titleKey: group.titleKey,
        sections: group.ids.filter(id => byId.has(id)).map(id => byId.get(id))
    }));
    groups[groups.length - 1].sections.push(..._PARAM_SECTIONS.filter(sec => !listed.has(sec.id)));
    return groups.filter(group => group.sections.length > 0);
}
