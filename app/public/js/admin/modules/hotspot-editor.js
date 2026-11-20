// Editor de preguntas del admin: sección de «Toca la imagen» (hotspot). Sobre la imagen principal
// de la pregunta se dibuja el área correcta con clics: cada clic añade un vértice en coordenadas
// relativas 0-1 (así el área no depende del tamaño con que cada pantalla pinte la imagen). Reglas
// del área en core/hotspot-area.js (window.XiroHotspot). Estilos en css/admin-hotspot-editor.css.

/**
 * Punto relativo 0-1 de un clic sobre el escenario, recortado a la imagen.
 * @param {{left: number, top: number, width: number, height: number}} rect - Caja del escenario
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{x: number, y: number}}
 */
function hotspotPointFromClick(rect, clientX, clientY) {
    const clamp = (value) => Math.min(1, Math.max(0, value));
    const round = (value) => Math.round(value * 10000) / 10000;
    return {
        x: round(clamp((clientX - rect.left) / rect.width)),
        y: round(clamp((clientY - rect.top) / rect.height))
    };
}

/** Clic sobre la imagen: añade un vértice (el primero guarda la proporción de la imagen). */
function añadirVerticeHotspot(qIdx, event, stage) {
    const q = preguntasData[qIdx];
    const img = stage.querySelector('img');
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    const area = q.hotspotArea || { points: [], aspect: img.naturalWidth / img.naturalHeight };
    if (area.points.length >= window.XiroHotspot.LIMITS.MAX_POINTS) return;
    const point = hotspotPointFromClick(stage.getBoundingClientRect(), event.clientX, event.clientY);
    q.hotspotArea = { points: [...area.points, point], aspect: Math.round(area.aspect * 10000) / 10000 };
    dibujarPregunta(qIdx);
}

/** Quita el último vértice; sin vértices, la pregunta queda sin área. */
function deshacerVerticeHotspot(qIdx) {
    const q = preguntasData[qIdx];
    if (!q.hotspotArea) return;
    const points = q.hotspotArea.points.slice(0, -1);
    q.hotspotArea = points.length ? { ...q.hotspotArea, points } : null;
    dibujarPregunta(qIdx);
}

// Los campos numéricos llaman a estas funciones: data-admin-input solo admite una lista cerrada de
// expresiones (admin-inline-parser.js) y una asignación no admitida se descartaría sin guardar nada.

/** Puntos máximos: entero positivo; vacío o 0, los de por defecto. */
function cambiarPuntosHotspot(qIdx, input) {
    const value = parseInt(input.value, 10);
    const { DEFAULT_MAX_POINTS } = window.XiroHotspot.LIMITS;
    preguntasData[qIdx].maxPoints = Number.isFinite(value) && value !== 0 ? Math.max(1, value) : DEFAULT_MAX_POINTS;
}

/** Margen en % del ancho: entero entre el mínimo y el máximo; vacío, el de por defecto. */
function cambiarMargenHotspot(qIdx, input) {
    preguntasData[qIdx].hotspotTolerance = Math.round(window.XiroHotspot.normalizeTolerance(input.value));
}

/** Al subir o quitar la imagen principal: el área dibujada sobre la anterior ya no vale. */
function alCambiarImagenHotspot(question) {
    if (question.type === 'hotspot') question.hotspotArea = null;
}

/** Borra el área entera. */
function borrarAreaHotspot(qIdx) {
    preguntasData[qIdx].hotspotArea = null;
    dibujarPregunta(qIdx);
}

function _hotspotShapeSvg(area) {
    const points = area ? area.points : [];
    if (!points.length) return '';
    const list = points.map((p) => `${p.x},${p.y}`).join(' ');
    const shape = points.length >= window.XiroHotspot.LIMITS.MIN_POINTS
        ? `<polygon points="${list}" class="xq-hotspot__area"/>`
        : `<polyline points="${list}" class="xq-hotspot__line"/>`;
    // Los vértices se pintan en HTML: dentro de un SVG estirado (preserveAspectRatio none) serían óvalos
    const dots = points.map((p) => `<span class="xq-hotspot__vertex" style="left:${p.x * 100}%;top:${p.y * 100}%"></span>`).join('');
    return `<svg class="xq-hotspot__svg" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">${shape}</svg>${dots}`;
}

function _hotspotStageHtml(q, qIdx) {
    const count = q.hotspotArea ? q.hotspotArea.points.length : 0;
    const status = count >= window.XiroHotspot.LIMITS.MIN_POINTS
        ? _t('admin.q.hotspot_vertices', { n: count }, '{n} vértices')
        : _t('admin.q.hotspot_need_vertices', { n: count }, '{n} vértices: hacen falta al menos 3');
    return `
                        <div class="xq-hotspot__stage" id="hs-stage-${qIdx}" data-admin-click="añadirVerticeHotspot(${qIdx}, event, this)"
                            role="img" aria-label="${escapeHtml(_t('admin.q.hotspot_stage_label', null, 'Imagen de la pregunta: haz clic para marcar los vértices del área correcta'))}">
                            <img src="${escapeHtml(q.url_recurso)}" alt="" draggable="false">
                            ${_hotspotShapeSvg(q.hotspotArea)}
                        </div>
                        <div class="xq-hotspot__bar">
                            <span class="xq-hint" id="hs-status-${qIdx}" aria-live="polite">${status}</span>
                            <button type="button" id="hs-undo-${qIdx}" class="xq-btn xq-btn--dashed" data-admin-click="deshacerVerticeHotspot(${qIdx})"${count ? '' : ' disabled'}>
                                <i class="fas fa-rotate-left" aria-hidden="true"></i> ${_t('admin.q.hotspot_undo', null, 'Deshacer punto')}</button>
                            <button type="button" id="hs-clear-${qIdx}" class="xq-btn xq-btn--danger-link" data-admin-click="borrarAreaHotspot(${qIdx})"${count ? '' : ' disabled'}>
                                <i class="fas fa-trash-alt" aria-hidden="true"></i> ${_t('admin.q.hotspot_clear', null, 'Borrar área')}</button>
                        </div>`;
}

function _hotspotNoImageHtml(qIdx) {
    return `
                        <div class="xq-hotspot__empty">
                            <p class="xq-hint">${_t('admin.q.hotspot_no_image', null, 'Sube la imagen (mapa, esquema, foto…) sobre la que los jugadores tocarán.')}</p>
                            <button type="button" id="upload-btn-${qIdx}" data-admin-click="abrirSelectorArchivo(${qIdx})" class="xq-btn xq-btn--add">
                                <i class="fas fa-upload" aria-hidden="true"></i> ${_t('admin.q.hotspot_upload', null, 'Subir imagen')}</button>
                        </div>`;
}

function _hotspotFieldsHtml(q, qIdx) {
    const { LIMITS } = window.XiroHotspot;
    const points = _numberFieldHtml({
        id: `hs-max-${qIdx}`,
        label: _t('admin.q.hotspot_max_label', null, 'Puntos máximos'),
        value: q.maxPoints ?? LIMITS.DEFAULT_MAX_POINTS,
        attrs: `min="1" step="1" placeholder="${LIMITS.DEFAULT_MAX_POINTS}"`,
        input: `cambiarPuntosHotspot(${qIdx}, this)`,
        help: _t('admin.q.hotspot_max_help', { bonus: LIMITS.INSIDE_BONUS }, 'Dentro del área se suman además {bonus} de bonus')
    });
    const tolerance = _numberFieldHtml({
        id: `hs-tol-${qIdx}`,
        label: _t('admin.q.hotspot_tol_label', null, 'Margen (% del ancho de la imagen)'),
        value: q.hotspotTolerance ?? LIMITS.DEFAULT_TOLERANCE,
        attrs: `min="${LIMITS.MIN_TOLERANCE}" max="${LIMITS.MAX_TOLERANCE}" step="1" placeholder="${LIMITS.DEFAULT_TOLERANCE}"`,
        input: `cambiarMargenHotspot(${qIdx}, this)`,
        help: _t('admin.q.hotspot_tol_help', null, 'Fuera del área los puntos bajan con la distancia y son 0 a esta distancia')
    });
    return `<div class="xq-fields-2">${points}${tolerance}</div>
                        <div>
                            <label class="xq-label" for="hs-credit-${qIdx}">${_t('admin.q.hotspot_credit_label', null, 'Crédito de la imagen')}
                                <span class="xq-label__aside">${_t('admin.q.optional', null, 'opcional')}</span></label>
                            <input type="text" id="hs-credit-${qIdx}" maxlength="300" class="xq-field" value="${escapeHtml(q.imageCredit || '')}"
                                data-admin-input="preguntasData[${qIdx}].imageCredit = this.value">
                        </div>`;
}

/** Sección de «Toca la imagen»: imagen con el área, campos de puntuación y ayuda. */
function hotspotEditorSectionHtml(q, qIdx) {
    const hasImage = q.tipo_contenido === 'imagen' && Boolean(q.url_recurso);
    const body = `
                        ${hasImage ? _hotspotStageHtml(q, qIdx) : _hotspotNoImageHtml(qIdx)}
                        ${_hotspotFieldsHtml(q, qIdx)}
                        ${questionHelpHtml(q, [
                            _t('admin.q.hotspot_help_1', null, 'Haz clic sobre la imagen para marcar los vértices del área correcta (de 3 a 30).'),
                            _t('admin.q.hotspot_help_2', null, 'El jugador toca la imagen en su móvil: dentro del área gana los puntos máximos más el bonus; cerca, menos puntos.'),
                            _t('admin.q.hotspot_help_3', null, 'Al cambiar la imagen se borra el área.')
                        ])}`;
    return questionSectionHtml(
        _t('admin.q.hotspot_title', null, 'Área correcta'),
        _t('admin.q.hotspot_hint', null, 'Marca sobre la imagen la zona que hay que tocar'),
        body
    );
}
