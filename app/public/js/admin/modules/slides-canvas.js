/**
 * @fileoverview Editor de la diapositiva libre (slide_type 'canvas') en el editor de juegos
 * personalizados: pantalla completa con cabecera, barra de herramientas, barra de formato,
 * lienzo 16:9 y panel de propiedades (estilos en admin-slide-canvas-ui.css), y conversión de
 * las diapositivas antiguas. El selector de plantillas está en slides-canvas-picker.js.
 *
 * «Aplicar» deja la diapositiva en currentCustomGameQuestions (la barra de guardado marca
 * «Cambios sin guardar»); el juego se guarda en la BD con el botón Guardar de siempre.
 * Reutiliza helpers globales: dibujarPreguntasPersonalizadas(), mostrarModalError(),
 * mostrarModalConfirmacion() y currentCustomGameQuestions.
 */

let _lienzoDelegationReady = false;

const _LIENZO_LEGACY_FIELDS = { comment_text: null, slide_title: null, slide_body: null, slide_image: null, slide_image_position: null, slide_video: null, slide_footer: null };

// Atajos que se recuerdan al pie (admin.canvas.hint_<id>_key y admin.canvas.hint_<id>)
const _LIENZO_HINTS = ['dblclick', 'shift', 'alt', 'arrows', 'delete', 'undo'];

function _lienzoAskMedia(template) {
    const E = window.XiroCanvasEditor;
    if (template === 'image' || template === 'text_image') {
        const box = template === 'image' ? { x: 0, y: 0, w: 1920, h: 1080 } : { x: 960, y: 0, w: 960, h: 1080 };
        E.media.openImage((r) => E.addElement('image', Object.assign({ props: { src: r.src, ratio: r.ratio || null, fit: 'contain' } }, box)));
    } else if (template === 'video') {
        E.media.openVideo((r) => E.addElement('video', { x: 160, y: 90, w: 1600, h: 900, props: { url: r.url, autoplay: true } }));
    }
}

/** Subtítulo de la cabecera: qué diapositiva se está editando (datos guardados en el modal). */
function _lienzoSubtitle(modal) {
    const th = window.XiroCanvasEditor.th;
    if (modal.dataset.index === '') return th('subtitle_new');
    const n = Number(modal.dataset.index) + 1;
    return th(modal.dataset.converted === '1' ? 'subtitle_converted' : 'subtitle_edit', { n });
}

function _lienzoModalHtml(modal) {
    const E = window.XiroCanvasEditor;
    const th = E.th;
    return `
        <header class="xsce-header">
            <span class="xsce-tile"><i class="fas fa-object-group" aria-hidden="true"></i></span>
            <div class="xsce-heading">
                <h3 id="lienzoTitulo">${th('title')}</h3>
                <p>${_lienzoSubtitle(modal)}</p>
            </div>
            <div class="xsce-actions">
                <button type="button" data-canvas-action="cancel" class="xsce-btn xsce-btn--ghost">${th('cancel')}</button>
                <button type="button" data-canvas-action="apply" class="xsce-btn xsce-btn--primary"><i class="fas fa-check" aria-hidden="true"></i>${th('apply')}</button>
            </div>
        </header>
        <div class="xsce-bars">
            ${E.toolbar.html()}
            <fieldset id="lienzoTextbar" class="xsce-textbar xsce-bar" aria-label="${th('text_format')}" disabled></fieldset>
        </div>
        <div class="xsce-workspace">
            <div class="xsce-desk"><div id="lienzoStageHost" class="xsce-host"></div></div>
            <aside id="lienzoProps" class="xsce-panel" aria-label="${th('properties')}"></aside>
        </div>
        <p class="xsce-hints">
            ${_LIENZO_HINTS.map((id) => `<span><kbd>${th('hint_' + id + '_key')}</kbd>${th('hint_' + id)}</span>`).join('')}
        </p>`;
}

/** Pinta la interfaz del editor y le engancha escenario, puntero, panel y barras (sin tocar el estado). */
function _lienzoMount(modal) {
    const E = window.XiroCanvasEditor;
    modal.innerHTML = _lienzoModalHtml(modal);
    E.stage.attach(document.getElementById('lienzoStageHost'));
    E.pointer.attach(document.getElementById('lienzoStageHost'));
    E.props.attach(document.getElementById('lienzoProps'));
    E.textbar.attach(document.getElementById('lienzoTextbar'));
    E.onRender(E.toolbar.refresh);
    E.toolbar.refresh(E.state);
}

function _lienzoUnmount() {
    const E = window.XiroCanvasEditor;
    E.stage.detach();
    E.pointer.detach();
    E.props.detach();
    E.textbar.detach();
    E.offRender(E.toolbar.refresh);
}

/**
 * Abre el editor con la diapositiva de la posición index (o una nueva desde una plantilla).
 * @param {number|null} index - Posición en currentCustomGameQuestions, o null si es nueva
 * @param {string} [template] - Plantilla para una diapositiva nueva
 * @param {Object} [canvas] - Lienzo de partida (conversión de una diapositiva antigua)
 */
function mostrarEditorLienzo(index, template, canvas) {
    const E = window.XiroCanvasEditor;
    const isEdit = Number.isInteger(index);
    const start = canvas || (isEdit ? currentCustomGameQuestions[index].slide_canvas : _lienzoTemplateCanvas(template));
    const modal = document.createElement('div');
    modal.id = 'modalLienzo';
    modal.className = 'xsce-shell';
    modal.dataset.index = isEdit ? String(index) : '';
    modal.dataset.converted = canvas ? '1' : '';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'lienzoTitulo');
    document.body.appendChild(modal);
    E.open(start, isEdit ? index : null);
    _lienzoMount(modal);
    if (!isEdit && !canvas) _lienzoAskMedia(template);
}

function editarSlideLienzo(index) {
    mostrarEditorLienzo(index);
}

/** Abre una diapositiva antigua convertida; solo se sustituye al pulsar Aplicar. */
function convertirSlideALienzo(index) {
    const canvas = window.XiroSlideCanvas.fromLegacySlide(currentCustomGameQuestions[index]);
    if (canvas) mostrarEditorLienzo(index, null, canvas);
}

function _lienzoClose() {
    _lienzoUnmount();
    window.XiroCanvasEditor.media.close();
    const modal = document.getElementById('modalLienzo');
    if (modal) modal.remove();
}

function _lienzoApply() {
    const E = window.XiroCanvasEditor;
    const canvas = E.getCanvas();
    if (JSON.stringify(canvas).length > window.XiroSlideCanvas.MAX_JSON_BYTES) {
        mostrarModalError(_t('admin.common.validation_title'), E.t('too_big'), 'warning');
        return;
    }
    const index = E.state.index;
    const item = Object.assign({}, _LIENZO_LEGACY_FIELDS, { slide_type: 'canvas', slide_canvas: canvas, question_id: null });
    if (Number.isInteger(index)) {
        currentCustomGameQuestions[index] = Object.assign(item, { position: currentCustomGameQuestions[index].position });
    } else {
        currentCustomGameQuestions.push(Object.assign(item, { position: currentCustomGameQuestions.length }));
    }
    _lienzoClose();
    dibujarPreguntasPersonalizadas();
}

function _lienzoCancel() {
    const E = window.XiroCanvasEditor;
    if (!E.state.dirty) {
        _lienzoClose();
        return;
    }
    mostrarModalConfirmacion(E.t('discard_title'), E.t('discard_msg'), _lienzoClose, null, E.t('discard_confirm'), E.t('discard_keep'));
}

function initSlideLienzoDelegation() {
    if (_lienzoDelegationReady) return;
    _lienzoDelegationReady = true;

    document.addEventListener('click', (event) => {
        // Clic fuera del cuadro de plantillas: se cierra sin elegir
        if (event.target.id === 'modalLienzoPlantillas') {
            event.target.remove();
            return;
        }
        const template = event.target.closest('[data-lienzo-template]');
        if (template) {
            document.getElementById('modalLienzoPlantillas')?.remove();
            const id = template.dataset.lienzoTemplate;
            if (id !== 'close') mostrarEditorLienzo(null, id);
            return;
        }
        const action = event.target.closest('#modalLienzo [data-canvas-action]');
        if (!action || action.disabled) return;
        const name = action.dataset.canvasAction;
        if (name === 'apply') _lienzoApply();
        else if (name === 'cancel') _lienzoCancel();
        else window.XiroCanvasEditor.toolbar.handle(name);
    });

    // Cambio de idioma con el editor abierto: se vuelve a pintar con los textos nuevos sin
    // perder la diapositiva, la selección ni el historial de deshacer
    window.addEventListener('xiro:language-changed', () => {
        const modal = document.getElementById('modalLienzo');
        if (modal) {
            _lienzoUnmount();
            _lienzoMount(modal);
        }
        if (document.getElementById('modalLienzoPlantillas')) {
            document.getElementById('modalLienzoPlantillas').remove();
            mostrarSelectorLienzo();
        }
    });

    // Escape cierra (preguntando si hay cambios) salvo que lo haya usado el editor para deseleccionar
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') document.getElementById('modalLienzoPlantillas')?.remove();
        if (event.key !== 'Escape' || event.defaultPrevented || !document.getElementById('modalLienzo')) return;
        const E = window.XiroCanvasEditor;
        // Con un elemento seleccionado, Escape solo deselecciona (slides-canvas-pointer.js)
        if (document.getElementById('modalLienzoMedia') || E.stage.isEditingText() || E.state.selectedId) return;
        _lienzoCancel();
    });
}

initSlideLienzoDelegation();
