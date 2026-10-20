/**
 * @fileoverview Editor de la diapositiva libre (slide_type 'canvas') en el editor de juegos
 * personalizados: selector de plantillas, modal a pantalla completa con lienzo 16:9,
 * barra de herramientas y panel de propiedades, y conversión de las diapositivas antiguas.
 *
 * «Aplicar» deja la diapositiva en currentCustomGameQuestions (la barra de guardado marca
 * «Cambios sin guardar»); el juego se guarda en la BD con el botón Guardar de siempre.
 * Reutiliza helpers globales: dibujarPreguntasPersonalizadas(), mostrarModalError(),
 * mostrarModalConfirmacion() y currentCustomGameQuestions.
 */

let _lienzoDelegationReady = false;

const _LIENZO_TEMPLATES = [
    ['blank', 'fa-square', 'En blanco'],
    ['text', 'fa-align-left', 'Título y texto'],
    ['info', 'fa-info-circle', 'Información'],
    ['image', 'fa-image', 'Imagen'],
    ['text-image', 'fa-columns', 'Texto e imagen'],
    ['video', 'fa-film', 'Vídeo']
];

const _LIENZO_LEGACY_FIELDS = { comment_text: null, slide_title: null, slide_body: null, slide_image: null, slide_image_position: null, slide_video: null, slide_footer: null };

function mostrarSelectorLienzo() {
    const modal = document.createElement('div');
    modal.id = 'modalLienzoPlantillas';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
            <h3 class="text-2xl font-black text-plum-700 mb-2 flex items-center gap-2"><i class="fas fa-object-group"></i> Diapositiva libre</h3>
            <p class="text-sm text-slate-600 mb-6">Elige un punto de partida. Después podrás mover, cambiar y añadir texto, figuras, imágenes y vídeos.</p>
            <div class="grid grid-cols-3 gap-3">
                ${_LIENZO_TEMPLATES.map(([id, icon, label]) => `
                    <button type="button" data-lienzo-template="${id}" class="border-2 border-slate-200 hover:border-plum-500 hover:bg-plum-50 rounded-xl p-4 flex flex-col items-center gap-2 font-bold text-slate-700 transition">
                        <i class="fas ${icon} text-2xl text-plum-600"></i>${label}
                    </button>`).join('')}
            </div>
            <div class="flex justify-end mt-6">
                <button type="button" data-lienzo-template="close" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">Cancelar</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

/** Lienzo inicial de cada plantilla (las de imagen y vídeo piden el recurso al abrir). */
function _lienzoTemplateCanvas(template) {
    const M = window.XiroSlideCanvas;
    if (template === 'text') return M.fromLegacySlide({ slide_type: 'text', slide_title: 'Título', slide_body: 'Escribe aquí el texto' });
    if (template === 'info') return M.fromLegacySlide({ slide_type: 'info', comment_text: 'Información' });
    if (template === 'text-image') return M.fromLegacySlide({ slide_type: 'text-image', slide_title: 'Título', slide_body: 'Texto', slide_image_position: 'right' });
    return M.createCanvas();
}

function _lienzoAskMedia(template) {
    const E = window.XiroCanvasEditor;
    if (template === 'image' || template === 'text-image') {
        const box = template === 'image' ? { x: 0, y: 0, w: 1920, h: 1080 } : { x: 960, y: 0, w: 960, h: 1080 };
        E.media.openImage((r) => E.addElement('image', Object.assign({ props: { src: r.src, ratio: r.ratio || null, fit: 'contain' } }, box)));
    } else if (template === 'video') {
        E.media.openVideo((r) => E.addElement('video', { x: 160, y: 90, w: 1600, h: 900, props: { url: r.url, autoplay: true } }));
    }
}

function _lienzoModalHtml() {
    return `
        <div class="flex items-center gap-3 flex-wrap">
            <h3 class="text-xl font-black text-white flex items-center gap-2 mr-2"><i class="fas fa-object-group"></i> Diapositiva libre</h3>
            <div class="rounded-xl overflow-hidden">${window.XiroCanvasEditor.toolbar.html()}</div>
            <div class="flex-1"></div>
            <button type="button" data-canvas-action="cancel" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2 rounded-xl font-bold transition">Cancelar</button>
            <button type="button" data-canvas-action="apply" class="bg-camaleon-600 hover:bg-camaleon-700 text-white px-5 py-2 rounded-xl font-bold transition"><i class="fas fa-check mr-2"></i>Aplicar</button>
        </div>
        <div class="xsce-textbar-row"><div id="lienzoTextbar" class="xsce-textbar" hidden></div></div>
        <div class="flex-1 min-h-0 flex gap-3">
            <div class="flex-1 min-w-0 flex items-center justify-center">
                <div id="lienzoStageHost" class="xsce-host" style="aspect-ratio:16/9;max-width:100%;max-height:100%;width:100%;"></div>
            </div>
            <aside id="lienzoProps" class="w-72 shrink-0 bg-white rounded-2xl p-4 overflow-y-auto"></aside>
        </div>
        <p class="text-xs text-slate-400">Doble clic para escribir en un texto · Mayús mantiene la proporción · Alt desactiva los imanes · Supr borra · Ctrl+Z deshace</p>`;
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
    modal.className = 'fixed inset-0 bg-slate-900/95 z-50 flex flex-col p-4 gap-3';
    modal.innerHTML = _lienzoModalHtml();
    document.body.appendChild(modal);
    E.open(start, isEdit ? index : null);
    E.stage.attach(document.getElementById('lienzoStageHost'));
    E.pointer.attach(document.getElementById('lienzoStageHost'));
    E.props.attach(document.getElementById('lienzoProps'));
    E.textbar.attach(document.getElementById('lienzoTextbar'));
    E.onRender(E.toolbar.refresh);
    E.toolbar.refresh(E.state);
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
    const E = window.XiroCanvasEditor;
    E.stage.detach();
    E.pointer.detach();
    E.props.detach();
    E.textbar.detach();
    E.offRender(E.toolbar.refresh);
    E.media.close();
    const modal = document.getElementById('modalLienzo');
    if (modal) modal.remove();
}

function _lienzoApply() {
    const E = window.XiroCanvasEditor;
    const canvas = E.getCanvas();
    if (JSON.stringify(canvas).length > window.XiroSlideCanvas.MAX_JSON_BYTES) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'La diapositiva es demasiado grande: quita algún elemento o acorta los textos', 'warning');
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
    if (!window.XiroCanvasEditor.state.dirty) {
        _lienzoClose();
        return;
    }
    mostrarModalConfirmacion('Descartar cambios', '¿Descartar los cambios de esta diapositiva?', _lienzoClose, null, 'Descartar', 'Seguir editando');
}

function initSlideLienzoDelegation() {
    if (_lienzoDelegationReady) return;
    _lienzoDelegationReady = true;

    document.addEventListener('click', (event) => {
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

    // Escape cierra (preguntando si hay cambios) salvo que lo haya usado el editor para deseleccionar
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || !document.getElementById('modalLienzo')) return;
        const E = window.XiroCanvasEditor;
        // Con un elemento seleccionado, Escape solo deselecciona (slides-canvas-pointer.js)
        if (document.getElementById('modalLienzoMedia') || E.stage.isEditingText() || E.state.selectedId) return;
        _lienzoCancel();
    });
}

initSlideLienzoDelegation();
