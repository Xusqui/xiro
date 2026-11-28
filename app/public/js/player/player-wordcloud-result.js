/**
 * @fileoverview «Nube de palabras» en el móvil tras enviar: el jugador ve la nube en solo lectura
 * (sin botón de ocultar) donde antes estaba el campo de escribir, primero con la de la respuesta al
 * enviar, después con cada actualización en directo y al cerrar con la final. Se pinta con
 * core/word-cloud-render.js; el texto de los jugadores se pone siempre con textContent.
 * Sin imports: lo usan player-answer-wordcloud.js, player-answer-events.js y los tests.
 */

const RESULT_ATTR = 'data-wc-result';

/** ¿Está en pantalla la pregunta de nube (campo de escribir o ya el resultado)? */
export function isWordCloudScreen() {
    return Boolean(document.querySelector('[data-wc-area]'));
}

/** ¿Ya se ve la nube final? Un envío que se confirma tarde no debe repintar el campo encima. */
export function isWordCloudResultShown() {
    return Boolean(document.querySelector(`[${RESULT_ATTR}]`));
}

function newStage(area) {
    const stage = document.createElement('div');
    stage.className = 'wc-stage wc-stage--phone';
    stage.setAttribute(RESULT_ATTR, '');
    // El lienzo (.wc-cloud) es hijo del escenario: la clase lo posiciona de forma absoluta dentro de él
    stage.appendChild(document.createElement('div'));
    area.textContent = '';
    area.appendChild(stage);
    const notice = document.querySelector('[data-wc-notice]');
    if (notice) notice.textContent = '';
    return stage;
}

// Aviso de que nadie escribió, aparte del lienzo para no borrar sus palabras
function setEmptyText(stage, text) {
    let note = stage.querySelector('[data-wc-empty]');
    if (!text) {
        if (note) note.remove();
        return;
    }
    if (!note) {
        note = stage.appendChild(document.createElement('p'));
        note.setAttribute('data-wc-empty', '');
    }
    note.textContent = text;
}

/**
 * Pinta la nube donde estaba el campo de escribir: la que llega en la respuesta al enviar, cada
 * actualización en directo y la final del reveal. Reutiliza el escenario y las palabras que siguen,
 * para que crezcan con animación en vez de repintarse. Solo lectura (sin botón de ocultar).
 * @param {{words: Array<{key: string, text: string, count: number}>, total?: number}|undefined} cloud -
 *   Nube; sin ella solo se prepara el escenario, a la espera de la primera actualización
 * @param {{empty: string}} labels - Textos ya traducidos
 * @returns {boolean} false si la pantalla de la nube no está (no se toca nada)
 */
export function showWordCloudResult(cloud, labels) {
    const area = document.querySelector('[data-wc-area]');
    if (!area) return false;
    const stage = area.querySelector(`[${RESULT_ATTR}]`) || newStage(area);
    if (!cloud) return true;
    const words = cloud.words || [];
    window.XiroWordCloudRender.render(
        stage.firstElementChild,
        { words },
        { width: stage.clientWidth || 320, height: stage.clientHeight || 320 }
    );
    setEmptyText(stage, words.length ? null : labels.empty);
    return true;
}
