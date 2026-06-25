/**
 * @fileoverview Métricas de progreso para panel de espera del presentador
 */

function parseCounterValue(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return null;

    const value = Number.parseInt((element.textContent || '').trim(), 10);
    return Number.isFinite(value) ? value : null;
}

export function getNumericProgressMetrics(playersData = {}) {
    const playerEntries = Object.entries(playersData)
        .filter(([nickname]) => nickname !== 'HOST');

    const totalFromState = playerEntries.length;
    const answeredFromState = playerEntries
        .reduce((acc, [, player]) => acc + (player?.answered === true ? 1 : 0), 0);

    const answeredFromDom = parseCounterValue('ans-count');
    const totalFromDom = parseCounterValue('ans-total');

    const total = totalFromState > 0
        ? totalFromState
        : Math.max(0, totalFromDom || 0);

    const answered = totalFromState > 0
        ? answeredFromState
        : Math.max(0, answeredFromDom || 0);

    const safeAnswered = Math.min(answered, total || answered);
    const progress = total > 0
        ? Math.round((safeAnswered / total) * 100)
        : 0;

    return {
        answered: safeAnswered,
        total,
        pending: Math.max(0, total - safeAnswered),
        progress
    };
}
