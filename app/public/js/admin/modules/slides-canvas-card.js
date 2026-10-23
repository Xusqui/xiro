/**
 * @fileoverview Tarjeta de la diapositiva libre en la lista del juego personalizado (miniatura real del
 * lienzo y acciones exportar, copiar y guardar en la biblioteca), botón «Convertir a diapositiva libre»
 * de las antiguas y botón «Exportar diapositivas libres» del editor del juego.
 * Lo usan custom-question-cards.js (_CUSTOM_SLIDE_CARDS y renderCustomQuestionCard) y
 * personalizados-expanded.js. Textos: claves admin.canvas.* (slides-canvas-i18n.js).
 */

/** Cuerpo de la tarjeta: miniatura a escala 1/8 y número de elementos. */
function customCanvasCardBody(q) {
    const canvas = q.slide_canvas || {};
    const count = Array.isArray(canvas.elements) ? canvas.elements.length : 0;
    const thumb = window.XiroSlideCanvasRender
        ? window.XiroSlideCanvasRender.stageHtml(canvas, {
            mode: 'thumb',
            labels: window.XiroCanvasEditor.videoLabels()
        })
        : '';
    const th = window.XiroCanvasEditor.th;
    return `
                            <div class="flex-1 min-w-0 flex items-center gap-4">
                                <div class="xsce-thumb shrink-0" style="position:relative;width:240px;height:135px;border-radius:8px;overflow:hidden;">${thumb}</div>
                                <div class="min-w-0">
                                    <span class="text-[10px] font-bold uppercase tracking-widest text-plum-600"><i class="fas fa-object-group mr-1"></i>${th('title')}</span>
                                    <p class="text-xs text-slate-500 mt-1">${count === 1 ? th('panel.count_one') : th('panel.count_many', { n: count })}</p>
                                </div>
                            </div>`;
}

/** Botón para pasar una diapositiva antigua al lienzo (no cambia nada hasta pulsar Aplicar). */
function customCanvasConvertButton(idx) {
    const th = window.XiroCanvasEditor.th;
    return `
                        <div class="mt-3 flex justify-end">
                            <button type="button" data-admin-click="convertirSlideALienzo(${idx})" class="text-xs font-bold text-plum-700 hover:text-plum-900 flex items-center gap-1" title="${th('card.convert_help')}">
                                <i class="fas fa-wand-magic-sparkles"></i> ${th('card.convert')}
                            </button>
                        </div>`;
}

/** Acciones de una diapositiva libre del juego: exportar, copiar y guardar en la biblioteca. */
function customCanvasCardTools(idx) {
    const th = window.XiroCanvasEditor.th;
    const button = (fn, icon, label, help) => `
                            <button type="button" data-admin-click="${fn}(${idx})" class="text-xs font-bold text-plum-700 hover:text-plum-900 flex items-center gap-1" title="${th(help)}">
                                <i class="fas ${icon}" aria-hidden="true"></i> ${th(label)}
                            </button>`;
    return `
                        <div class="mt-3 flex justify-end flex-wrap gap-4">
                            ${button('exportarSlideLienzo', 'fa-file-export', 'io.export', 'io.export_help')}
                            ${button('copiarSlideLienzo', 'fa-copy', 'io.copy', 'io.copy_help')}
                            ${button('guardarSlideEnBiblioteca', 'fa-bookmark', 'io.save_library', 'io.save_library_help')}
                        </div>`;
}

/** Pie extra de una diapositiva del juego: acciones si es libre; «Convertir» si es antigua (no Actividad). */
function customCanvasCardExtra(q, idx) {
    if (q.slide_type === 'canvas') return customCanvasCardTools(idx);
    return q.slide_type !== 'comment' ? customCanvasConvertButton(idx) : '';
}

/** Botón «Exportar diapositivas libres» bajo el de PDF en el editor del juego personalizado. */
function customCanvasExportAllHtml() {
    const th = window.XiroCanvasEditor.th;
    return `
            <div class="mt-4">
                <button type="button" data-admin-click="exportarTodasLasSlidesLienzo()" class="w-full bg-plum-50 text-plum-700 border-2 border-plum-200 px-6 py-3 rounded-2xl font-bold hover:bg-plum-100 hover:border-plum-300 transition flex items-center justify-center gap-3" title="${th('io.export_all_help')}">
                    <i class="fas fa-file-export" aria-hidden="true"></i> ${th('io.export_all')}
                </button>
            </div>`;
}
