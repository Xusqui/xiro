/* global config, Script, ListWidget, Color, Font, LinearGradient */

// Variables used by Scriptable.
// icon-color: blue; icon-glyph: chart-line
// Script: XIRO Metrics Widget

// Config
const METRICS_URL = 'https://xiro.pro/api/health'; // Health endpoint con métricas completas
const _REFRESH_SECONDS = 60; // Tiempo recomendado para widget

// Entry
(async () => {
    try {
        const data = await fetchMetrics(METRICS_URL);
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
async function fetchMetrics(url) {
    const healthReq = new Request(url);
    const metricsReq = new Request('https://xiro.pro/api/metrics');
    healthReq.timeoutInterval = 10;
    metricsReq.timeoutInterval = 10;

    const [health, metrics] = await Promise.all([
        healthReq.loadJSON(),
        metricsReq.loadJSON()
    ]);

    // Combinar ambos
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
    const updated = header.addText(new Date(metrics.timestamp || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
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
    addCompactKV(dbCard, 'Q Avg', `${metrics.metrics?.database?.avg_query_time_ms || 0}ms`, metrics.metrics?.database?.avg_query_time_ms > 50);
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
