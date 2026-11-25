/* global config, Script, ListWidget, Color, Font, LinearGradient, Alert, Keychain, Data */

// Variables used by Scriptable.
// icon-color: blue; icon-glyph: chart-line
// Script: XIRO Metrics Widget

// Config
// /api/health y /api/metrics exigen sesión de admin: el widget inicia sesión con una
// cuenta admin guardada en el Keychain de iOS y envía el JWT como Bearer.
// Para cambiar de cuenta: Keychain.remove('xiro_widget_user') y Keychain.remove('xiro_widget_pass').
const BASE_URL = 'https://xiro.pro';
const KEY_USER = 'xiro_widget_user';
const KEY_PASS = 'xiro_widget_pass';
const KEY_TOKEN = 'xiro_widget_token';

// Entry
(async () => {
    try {
        const data = await fetchMetrics();
        const widget = createWidget(data);
        if (config.runsInWidget) {
            Script.setWidget(widget);
        } else {
            await widget.presentMedium();
            Script.setWidget(widget);
        }
        Script.complete();
    } catch (err) {
        const w = new ListWidget();
        w.addText('Error obteniendo métricas');
        w.addSpacer();
        const t = w.addText(err.message || String(err));
        t.textColor = Color.red();
        if (!config.runsInWidget) await w.presentMedium();
        Script.complete();
    }
})();

// Fetch metrics

/** Lanza un error con el mensaje del servidor si la respuesta no es 2xx. */
function assertOk(req, body) {
    const status = req.response?.statusCode || 0;
    if (status >= 200 && status < 300) return;
    const err = new Error(body?.error || `HTTP ${status}`);
    err.status = status;
    throw err;
}

/** Pide usuario y contraseña (solo desde la app) y los guarda en el Keychain. */
async function askCredentials() {
    const alert = new Alert();
    alert.title = 'XIRO: cuenta de administrador';
    alert.addTextField('Usuario');
    alert.addSecureTextField('Contraseña');
    alert.addAction('Guardar');
    alert.addCancelAction('Cancelar');
    if ((await alert.present()) === -1) throw new Error('Credenciales no configuradas');
    Keychain.set(KEY_USER, alert.textFieldValue(0).trim());
    Keychain.set(KEY_PASS, alert.textFieldValue(1));
}

/** Devuelve las credenciales guardadas; el widget no puede mostrar diálogos. */
async function getCredentials() {
    if (!Keychain.contains(KEY_USER) || !Keychain.contains(KEY_PASS)) {
        if (config.runsInWidget) throw new Error('Abre el script en Scriptable para configurar la cuenta');
        await askCredentials();
    }
    return { username: Keychain.get(KEY_USER), password: Keychain.get(KEY_PASS) };
}

/** Inicia sesión y guarda el JWT. Si las credenciales son incorrectas, las borra para volver a pedirlas. */
async function login() {
    const req = new Request(`${BASE_URL}/api/admin-login`);
    req.method = 'POST';
    req.timeoutInterval = 10;
    req.headers = { 'Content-Type': 'application/json' };
    req.body = JSON.stringify(await getCredentials());
    const body = await req.loadJSON();
    if (req.response?.statusCode === 401) {
        Keychain.remove(KEY_USER);
        Keychain.remove(KEY_PASS);
    }
    assertOk(req, body);
    Keychain.set(KEY_TOKEN, body.token);
    return body.token;
}

/** Token guardado si le quedan más de 5 min de vida; así no se provoca un 401 (y su warning) al caducar. */
function cachedToken() {
    if (!Keychain.contains(KEY_TOKEN)) return null;
    const token = Keychain.get(KEY_TOKEN);
    try {
        const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const { exp } = JSON.parse(Data.fromBase64String(padded).toRawString());
        return exp * 1000 - Date.now() > 5 * 60 * 1000 ? token : null;
    } catch (_err) {
        // Token ilegible en el Keychain: se descarta y se inicia sesión de nuevo
        return null;
    }
}

async function getAuthed(path, token) {
    const req = new Request(`${BASE_URL}${path}`);
    req.timeoutInterval = 10;
    req.headers = { Authorization: `Bearer ${token}` };
    const body = await req.loadJSON();
    assertOk(req, body);
    return body;
}

function loadBoth(token) {
    return Promise.all([getAuthed('/api/health', token), getAuthed('/api/metrics', token)]);
}

/** Lee health y métricas con sesión admin; si el token ya no vale (p. ej. usuario desactivado), reintenta una vez. */
async function fetchMetrics() {
    let pair;
    try {
        pair = await loadBoth(cachedToken() || (await login()));
    } catch (err) {
        if (err.status !== 401) throw err;
        pair = await loadBoth(await login());
    }
    const [health, metrics] = pair;
    return { ...health, metrics };
}

function formatUptime(seconds) {
    if (!seconds) return '0s';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function addCard(parent, titleText, icon) {
    const card = parent.addStack();
    card.layoutVertically();
    card.backgroundColor = new Color('#1f2937', 0.55);
    card.cornerRadius = 6;
    card.setPadding(1.2, 2.4, 1.2, 2.4);
    const iconText = card.addText(icon);
    iconText.font = Font.systemFont(9);
    card.addSpacer(0.2);
    const title = card.addText(titleText);
    title.font = Font.semiboldSystemFont(6);
    title.textColor = new Color('#9ca3af');
    card.addSpacer(0.4);
    return card;
}

function addCompactKV(stack, key, value, highlight = false) {
    const row = stack.addStack();
    row.layoutHorizontally();
    const k = row.addText(key);
    k.font = Font.systemFont(7);
    k.textColor = new Color('#6b7280');
    row.addSpacer();
    const v = row.addText(value);
    v.font = Font.semiboldMonospacedSystemFont(highlight ? 8 : 7);
    v.textColor = highlight ? new Color('#60a5fa') : Color.white();
}

function addHeader(widget, metrics) {
    const header = widget.addStack();
    header.layoutHorizontally();
    header.centerAlignContent();
    const title = header.addText('🎮 XIRO');
    title.font = Font.boldSystemFont(12);
    title.textColor = Color.white();
    header.addSpacer(4);
    const updated = header.addText(
        new Date(metrics.timestamp || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    );
    updated.font = Font.systemFont(8);
    updated.textColor = new Color('#9ca3af');
}

function addSystemCard(row, metrics) {
    const sysCard = addCard(row, 'System', '⚙️');
    addCompactKV(sysCard, 'Up', formatUptime(metrics.uptime));
    addCompactKV(sysCard, 'RAM', `${metrics.memory?.heap?.usedMB}MB`);
}

function addHttpCard(row, metrics) {
    const httpCard = addCard(row, 'HTTP', '📡');
    addCompactKV(httpCard, 'Req/m', String(metrics.metrics?.http?.requests_per_minute || 0), true);
    addCompactKV(httpCard, 'Total', String(metrics.metrics?.http?.total_requests || 0));
}

function addPlayersCard(row, metrics) {
    const playersCard = addCard(row, 'Players', '👥');
    const activePlayers = metrics.players?.connected || 0;
    const pText = playersCard.addText(String(activePlayers));
    pText.font = Font.boldSystemFont(12);
    pText.textColor = new Color('#34d399');
    playersCard.addSpacer(0.2);
    addCompactKV(playersCard, 'Total', String(metrics.metrics?.players?.total_connections_ever || 0));
}

function getDbStatusBadge(database) {
    const dbStatus = database?.status || 'unknown';
    if (dbStatus === 'healthy') {
        return { label: '✓ OK', color: new Color('#34d399') };
    }
    if (dbStatus === 'slow') {
        return { label: '⚠ Slow', color: new Color('#f59e0b') };
    }
    return { label: '✗ Error', color: new Color('#ef4444') };
}

function addDatabaseCard(row, metrics) {
    const dbCard = addCard(row, 'Database', '🗄️');
    const dbBadge = getDbStatusBadge(metrics.database);
    const dbStatusText = dbCard.addText(dbBadge.label);
    dbStatusText.font = Font.boldSystemFont(9);
    dbStatusText.textColor = dbBadge.color;
    dbCard.addSpacer(0.2);
    addCompactKV(dbCard, 'Lat', `${metrics.database?.latencyMs || 0}ms`, metrics.database?.latencyMs > 50);
    addCompactKV(
        dbCard,
        'Q Avg',
        `${metrics.metrics?.database?.avg_query_time_ms || 0}ms`,
        metrics.metrics?.database?.avg_query_time_ms > 50
    );
}

function addGamesCard(row, metrics) {
    const gamesCard = addCard(row, 'Games', '🎯');
    const activeGames = metrics.games?.active || 0;
    const gText = gamesCard.addText(String(activeGames));
    gText.font = Font.boldSystemFont(12);
    gText.textColor = new Color('#f59e0b');
    gamesCard.addSpacer(0.2);
    addCompactKV(gamesCard, 'Total', String(metrics.metrics?.games?.total_created || 0));
}

function getCacheHitColor(hitRate) {
    if (hitRate > 70) {
        return new Color('#34d399');
    }
    if (hitRate > 40) {
        return new Color('#f59e0b');
    }
    return new Color('#ef4444');
}

function addCacheCard(row, metrics) {
    const cacheCard = addCard(row, 'Cache', '💾');
    const hitRate = parseFloat((metrics.cache?.questionBanks?.hitRate || '0%').replace('%', ''));
    const hitText = cacheCard.addText(`${hitRate.toFixed(0)}%`);
    hitText.font = Font.boldSystemFont(12);
    hitText.textColor = getCacheHitColor(hitRate);
    cacheCard.addSpacer(0.2);
    addCompactKV(cacheCard, 'Hits', String(metrics.cache?.questionBanks?.hits || 0));
}

function addPoolCard(row, metrics) {
    const poolCard = addCard(row, 'Pool', '🔌');
    const poolIdle = metrics.database?.pool?.idle || 0;
    const poolTotal = metrics.database?.pool?.total || 0;
    addCompactKV(poolCard, 'Idle', `${poolIdle}/${poolTotal}`);
    addCompactKV(poolCard, 'Wait', String(metrics.database?.pool?.waiting || 0));
}

function addLobbiesCard(row, metrics) {
    const lobbiesCard = addCard(row, 'Lobbies', '🚪');
    const activeLobbies = metrics.games?.lobbies || 0;
    const lobText = lobbiesCard.addText(String(activeLobbies));
    lobText.font = Font.boldSystemFont(12);
    lobText.textColor = new Color('#8b5cf6');
    lobbiesCard.addSpacer(0.2);
    addCompactKV(lobbiesCard, 'Max', String(metrics.games?.maxLobbies || 10));
}

function addMetricRow(widget) {
    const row = widget.addStack();
    row.layoutHorizontally();
    row.spacing = 4;
    return row;
}

function createWidget(metrics) {
    const w = new ListWidget();
    const bg = new LinearGradient();
    bg.locations = [0, 1];
    bg.colors = [new Color('#131a2b'), new Color('#0b0f1a')];
    w.backgroundGradient = bg;
    w.setPadding(30, 8, 4, 8);

    addHeader(w, metrics);

    w.addSpacer(1);

    const row1 = addMetricRow(w);
    addSystemCard(row1, metrics);
    addHttpCard(row1, metrics);
    addPlayersCard(row1, metrics);
    addDatabaseCard(row1, metrics);

    w.addSpacer(1);

    const row2 = addMetricRow(w);
    addGamesCard(row2, metrics);
    addCacheCard(row2, metrics);
    addPoolCard(row2, metrics);
    addLobbiesCard(row2, metrics);

    w.addSpacer(1);

    return w;
}

// End of file
