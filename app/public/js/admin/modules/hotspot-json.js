// Imagen de «Toca la imagen» (hotspot) en el JSON de los bancos: al exportar va incrustada
// (image_data, data URL) para que el JSON funcione en otra instalación; al importar se sube con
// POST /api/upload/embedded-image, que la comprueba por sus bytes, y se usa la URL nueva.
// Un banco con alguna pregunta hotspot sin imagen o sin área (las de la IA) se abre en el editor.

/** Lee una imagen del servidor como data URL. */
async function _hotspotImageToDataUrl(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/** Sube un data URL y devuelve la URL de /uploads. */
async function _hotspotUploadDataUrl(dataUrl) {
    const response = await fetchWithAuth('/api/upload/embedded-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data.url;
}

/**
 * Exportación: añade image_data a las preguntas hotspot con imagen. Si una no se puede leer, sale sin ella.
 * @param {Array<Object>} questions - Preguntas ya mapeadas para exportar
 * @param {{toDataUrl?: Function}} [deps] - Inyectable en tests
 * @returns {Promise<Array<Object>>}
 */
async function embedHotspotImages(questions, { toDataUrl = _hotspotImageToDataUrl } = {}) {
    const result = [];
    for (const question of questions) {
        if (question.type !== 'hotspot' || !question.url_recurso) {
            result.push(question);
            continue;
        }
        try {
            result.push({ ...question, image_data: await toDataUrl(question.url_recurso) });
        } catch (err) {
            console.warn('No se pudo incrustar la imagen de la pregunta', question.url_recurso, err);
            result.push(question);
        }
    }
    return result;
}

/**
 * Importación: sube la imagen incrustada (imageData) y usa su URL; imageData se quita siempre
 * (el servidor no admite esa clave). Si la subida falla se conserva la ruta que traía.
 * @param {Array<Object>} questions - Preguntas mapeadas con mapQuestionForImport
 * @param {{upload?: Function}} [deps] - Inyectable en tests
 * @returns {Promise<Array<Object>>}
 */
async function restoreHotspotImages(questions, { upload = _hotspotUploadDataUrl } = {}) {
    const result = [];
    for (const { imageData, ...question } of questions) {
        if (!imageData) {
            result.push(question);
            continue;
        }
        try {
            result.push({ ...question, tipo_contenido: 'imagen', url_recurso: await upload(imageData) });
        } catch (err) {
            console.warn('No se pudo subir la imagen incrustada', err);
            result.push(question);
        }
    }
    return result;
}

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
