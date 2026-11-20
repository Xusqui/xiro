/**
 * @fileoverview Pantalla de resultado de «Toca la imagen» (hotspot) en el móvil: la imagen con el
 * toque del jugador y, en cuanto llega la revelación, el área correcta. Sin imports: usa los núcleos
 * globales (core/hotspot-view.js) y _t.
 */

/** Verde dentro del área, amarillo fuera con puntos (como la numérica aproximada), rojo sin puntos; null si no es hotspot. */
export function hotspotResultColor(data) {
    const details = data.hotspotDetails;
    if (!details) return null;
    if (details.inside) return 'bg-green-500';
    return data.points > 0 ? 'bg-yellow-500' : 'bg-red-500';
}

function verdictHtml(details) {
    if (details.inside) return _t('player.hotspot.inside', null, '¡Dentro!');
    if (details.distancePercent === null || details.distancePercent === undefined) {
        return _t('player.hotspot.no_tap', null, 'Sin toque');
    }
    return _t('player.hotspot.distance', { n: details.distancePercent }, 'A {n} % del área');
}

/**
 * HTML del resultado.
 * @param {Object} data - answer-result con hotspotDetails { inside, distancePercent, tap } y points
 * @param {string} rankingHTML
 * @param {{imageUrl: string|null, area: Object|null}} view - Imagen de la pregunta y área (si ya se reveló)
 * @returns {string}
 */
export function hotspotResultHtml(data, rankingHTML, view) {
    const details = data.hotspotDetails;
    const stage = view.imageUrl
        ? window.XiroHotspotView.stageHtml({ imageUrl: view.imageUrl, area: view.area, ownTap: details.tap || null, id: 'hs-result' })
        : '';
    return `
        <h2 class="text-4xl font-black italic uppercase">${verdictHtml(details)}</h2>
        <p class="text-3xl font-black mt-3 mb-4 bg-black/20 py-2 px-8 rounded-full">+${data.points} PTS</p>
        <div class="hs-result w-full max-w-md mx-auto">${stage}</div>
        ${rankingHTML}
    `;
}

/**
 * Al revelar: dibuja el área sobre la imagen del resultado si aún no la tenía.
 * @param {Object} area - Área de la revelación
 * @returns {boolean} true si había una pantalla de resultado de hotspot
 */
export function applyHotspotReveal(area) {
    const stage = document.getElementById('hs-result');
    if (!stage) return false;
    if (!stage.querySelector('.hs-svg')) {
        stage.querySelector('.hs-stage__img').insertAdjacentHTML('afterend', window.XiroHotspotView.areaSvg(area));
    }
    return true;
}
