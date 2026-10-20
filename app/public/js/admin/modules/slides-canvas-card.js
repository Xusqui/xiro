/**
 * @fileoverview Tarjeta de la diapositiva libre en la lista del juego personalizado
 * (miniatura real del lienzo) y botón «Convertir a diapositiva libre» de las antiguas.
 * Lo usa custom-question-cards.js (_CUSTOM_SLIDE_CARDS y renderCustomQuestionCard).
 */

/** Cuerpo de la tarjeta: miniatura a escala 1/8 y número de elementos. */
function customCanvasCardBody(q) {
    const canvas = q.slide_canvas || {};
    const count = Array.isArray(canvas.elements) ? canvas.elements.length : 0;
    const thumb = window.XiroSlideCanvasRender ? window.XiroSlideCanvasRender.stageHtml(canvas, { mode: 'thumb' }) : '';
    return `
                            <div class="flex-1 min-w-0 flex items-center gap-4">
                                <div class="xsce-thumb shrink-0" style="position:relative;width:240px;height:135px;border-radius:8px;overflow:hidden;">${thumb}</div>
                                <div class="min-w-0">
                                    <span class="text-[10px] font-bold uppercase tracking-widest text-plum-600"><i class="fas fa-object-group mr-1"></i>Diapositiva libre</span>
                                    <p class="text-xs text-slate-500 mt-1">${count === 1 ? '1 elemento' : count + ' elementos'}</p>
                                </div>
                            </div>`;
}

/** Botón para pasar una diapositiva antigua al lienzo (no cambia nada hasta pulsar Aplicar). */
function customCanvasConvertButton(idx) {
    return `
                        <div class="mt-3 flex justify-end">
                            <button type="button" data-admin-click="convertirSlideALienzo(${idx})" class="text-xs font-bold text-plum-700 hover:text-plum-900 flex items-center gap-1" title="Abre esta diapositiva en el editor libre; se guarda solo si pulsas Aplicar">
                                <i class="fas fa-wand-magic-sparkles"></i> Convertir a diapositiva libre
                            </button>
                        </div>`;
}
