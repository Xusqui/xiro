/**
 * @fileoverview Tarjeta de la diapositiva libre en la lista del juego personalizado
 * (miniatura real del lienzo) y botón «Convertir a diapositiva libre» de las antiguas.
 * Lo usa custom-question-cards.js (_CUSTOM_SLIDE_CARDS y renderCustomQuestionCard).
 * Textos: claves admin.canvas.* (slides-canvas-i18n.js).
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
