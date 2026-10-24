/**
 * @fileoverview Ritmo de aparición del podio: del 10º al 4º en unos 2 s y después el 3º,
 * el 2º y el 1º. Con la música sonando, cada uno sale en su nota (aviso 'xiro:podium-hit'
 * que emite el motor en el instante del golpe); sin música, a un ritmo fijo.
 */

const REST_SECONDS = 2; // filas del 10º al 4º, en total
const MAX_ROW_STEP = 0.3;
const FALLBACK_STEP_MS = 550; // sin música: un puesto cada ~negra
const SAFETY_MS = 9000; // si la música no avisa, se enseñan igualmente

/** Retraso (s) de la fila `index` (0 = 1º) cuando hay `total` filas: la 10ª primero. */
export function restRowDelay(index, total) {
    const rest = Math.max(1, total - 3);
    const step = Math.min(MAX_ROW_STEP, REST_SECONDS / rest);
    return (total - 1 - index) * step;
}

/**
 * Programa la salida del 3º, 2º y 1º en `container` (filas con data-place y la clase
 * podium-row-wait). `onReveal(place)` avisa de cada salida (el podio 3D sube su bloque);
 * puede llegar más de una vez por puesto. Devuelve una función para cancelarlo.
 */
export function startPodiumReveal(container, total, onReveal) {
    const timers = [];
    const reveal = place => {
        const row = container.querySelector(`.podium-row[data-place="${place}"]`);
        if (row) row.classList.remove('podium-row-wait');
        onReveal?.(place);
    };
    const revealAll = () => [3, 2, 1].forEach(reveal);
    const onHit = e => reveal(e.detail.place);
    const music = window.XiroPresenterMusic;

    if (music && music.drivesPodium()) {
        document.addEventListener('xiro:podium-hit', onHit);
        timers.push(setTimeout(revealAll, SAFETY_MS));
    } else {
        const restMs = restRowDelay(3, total) * 1000 + 400;
        [3, 2, 1].forEach((place, i) => timers.push(setTimeout(() => reveal(place), restMs + i * FALLBACK_STEP_MS)));
    }
    return () => {
        timers.forEach(clearTimeout);
        document.removeEventListener('xiro:podium-hit', onHit);
    };
}
