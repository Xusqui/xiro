/**
 * @fileoverview Layout del presentador para preguntas word_cloud («Nube de palabras»). Durante la
 * pregunta proyecta el lienzo, que se llena en directo con las palabras de los jugadores y un
 * botón para ocultar cada una; al revelar pinta la nube final, sin botones. Una vez revelada,
 * las actualizaciones que lleguen tarde no repintan nada. La colocación y el pintado están en
 * core/word-cloud-layout.js y core/word-cloud-render.js (window.XiroWordCloudRender).
 */

function stageElement() {
    return document.getElementById('wc-stage');
}

/**
 * HTML del área de la pregunta: el lienzo vacío de la nube.
 * @returns {string}
 */
export function renderWordCloudPresenter() {
    return `
        <div id="wc-stage" class="wc-stage">
            <div id="wc-cloud" class="wc-cloud"></div>
        </div>`;
}

function paintCloud(cloud, options) {
    const stage = stageElement();
    const canvas = document.getElementById('wc-cloud');
    if (!stage || !canvas || !window.XiroWordCloudRender) return 0;
    return window.XiroWordCloudRender.render(canvas, cloud, options);
}

/**
 * Pinta la nube en directo con un botón para ocultar cada palabra.
 * @param {{words: Array<{key: string, text: string, count: number}>}} cloud - Nube de `word-cloud-update`
 * @param {{width?: number, height?: number, onHide: function(string): void, hideLabel?: string}} options
 * @returns {number} Palabras pintadas (0 si no hay escenario o la pregunta ya se reveló)
 */
export function updateWordCloudOnStage(cloud, options) {
    const stage = stageElement();
    if (!stage || stage.getAttribute('data-wc-closed')) return 0;
    return paintCloud(cloud, options);
}

/**
 * Pinta la nube final (sin botones) y cierra el escenario a nuevas actualizaciones.
 * @param {{words: Array<{key: string, text: string, count: number}>}} cloud - `wordCloud` del reveal
 * @param {{width?: number, height?: number}} [options]
 */
export function revealWordCloudOnStage(cloud, options) {
    const stage = stageElement();
    if (!stage) return;
    stage.setAttribute('data-wc-closed', '1');
    paintCloud(cloud, { width: options && options.width, height: options && options.height });
}
