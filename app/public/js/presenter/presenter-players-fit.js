/**
 * @fileoverview Densidad de la columna de jugadores del presentador.
 * Con pocos jugadores, una fila por jugador (nombre · puntos). Si no caben,
 * la columna pasa a fichas en mosaico y la letra baja hasta que caben todas,
 * sin bajar de un mínimo legible (11 px): por debajo, la columna se desplaza.
 */

const MIN_PX = 11;
const FIT_STEPS = 7;
let frame = 0;
let resizeTimer = 0;

function overflows(panel) {
    return panel.scrollHeight > panel.clientHeight + 1;
}

/** Mayor tamaño de letra (px) con el que caben todas las fichas, entre MIN_PX y max. */
function fitChips(panel, max) {
    panel.style.setProperty('--stage-chip-size', `${max}px`);
    if (!overflows(panel)) return;
    let low = MIN_PX;
    let high = max;
    for (let i = 0; i < FIT_STEPS; i++) {
        const mid = (low + high) / 2;
        panel.style.setProperty('--stage-chip-size', `${mid}px`);
        if (overflows(panel)) high = mid;
        else low = mid;
    }
    panel.style.setProperty('--stage-chip-size', `${Math.floor(low)}px`);
}

/** Elige filas o fichas según quepan, y ajusta la letra de las fichas. */
export function fitPlayersPanel() {
    const panel = document.getElementById('players-sidebar-list');
    // Oculta (móvil o Top 5 del revelado en su lugar): nada que medir
    if (!panel || panel.getClientRects().length === 0) return;

    panel.dataset.density = 'rows';
    panel.style.removeProperty('--stage-chip-size');
    if (!overflows(panel)) return;

    const firstRow = panel.querySelector('.stage-player');
    const rowSize = firstRow ? parseFloat(getComputedStyle(firstRow).fontSize) : 16;
    panel.dataset.density = 'chips';
    fitChips(panel, Math.max(MIN_PX, rowSize || 16));
}

/** Un solo ajuste por fotograma aunque lleguen muchas respuestas seguidas. */
export function schedulePlayersPanelFit() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
        frame = 0;
        fitPlayersPanel();
    });
}

window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(schedulePlayersPanelFit, 150);
});
