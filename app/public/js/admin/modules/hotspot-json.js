// «Toca la imagen» (hotspot) en el JSON de los bancos: la imagen viaja con el resto de recursos
// (bank-media.js). Un banco con alguna pregunta hotspot sin imagen o sin área (las de la IA) se abre
// en el editor para completarlo antes de guardarlo.

/**
 * ¿Hay que completar alguna pregunta hotspot en el editor antes de guardar (sin imagen o sin área)?
 * @param {Array<Object>} questions - Preguntas en formato del editor o de guardado
 * @returns {boolean}
 */
function needsHotspotEditing(questions) {
    return questions.some(
        (q) => q.type === 'hotspot' && (!q.url_recurso || window.XiroHotspot.areaError(q.hotspotArea) !== null)
    );
}

/**
 * Abre un banco sin guardar en el editor para dibujar el área de sus preguntas hotspot (las de la
 * IA, o un JSON sin área). Se guarda después con la barra de guardado, como un banco nuevo.
 * @param {{name: string, language?: string, questions: Array<Object>}} bank - Preguntas en formato de guardado
 */
function abrirBancoParaCompletarHotspot(bank) {
    preguntasData = bank.questions.map((question) => ({ ...question, id: null }));
    activeView = null;
    renderEditorBanco({ name: bank.name || '', id: null, language: bank.language || 'es' });
    dibujarPreguntas();
    _bindBankSaveBar(null);
    mostrarModalError(
        _t('admin.common.warning_title', null, '⚠️ Advertencia'),
        _t('admin.q.hotspot_complete_notice', null, 'Marca el área correcta de las preguntas «Toca la imagen» (y sube su imagen si falta) y guarda el banco.'),
        'warning'
    );
}
