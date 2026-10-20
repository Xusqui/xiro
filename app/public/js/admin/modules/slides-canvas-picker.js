/**
 * @fileoverview Selector de plantillas de la diapositiva libre (botón «Diapositiva libre» del
 * editor de juegos personalizados). Cada plantilla se ve con una miniatura real del lienzo
 * de partida (core/slide-canvas-render.js); las que piden imagen o vídeo al abrir muestran
 * un hueco en su lugar. Al elegir una, slides-canvas.js abre el editor (mostrarEditorLienzo).
 * Textos: claves admin.canvas.* (slides-canvas-i18n.js), también los del lienzo de partida.
 */

// [id, icono del hueco, hueco: 'full' | 'right' | null]; nombre y descripción en admin.canvas.tpl.<id>[_desc]
const _LIENZO_TEMPLATES = [
    ['blank', null, null],
    ['text', null, null],
    ['info', null, null],
    ['image', 'fa-image', 'full'],
    ['text_image', 'fa-image', 'right'],
    ['video', 'fa-play', 'full']
];

/** Lienzo inicial de cada plantilla (las de imagen y vídeo piden el recurso al abrir). */
function _lienzoTemplateCanvas(template) {
    const M = window.XiroSlideCanvas;
    const t = window.XiroCanvasEditor.t;
    if (template === 'text') return M.fromLegacySlide({ slide_type: 'text', slide_title: t('content.title'), slide_body: t('content.body') });
    if (template === 'info') return M.fromLegacySlide({ slide_type: 'info', comment_text: t('content.info') });
    if (template === 'text_image') return M.fromLegacySlide({ slide_type: 'text-image', slide_title: t('content.title'), slide_body: t('content.short_body'), slide_image_position: 'right' });
    return M.createCanvas();
}

function _lienzoTemplateThumb(id, icon, hole) {
    const R = window.XiroSlideCanvasRender;
    const stage = hole === 'full' || !R ? '' : R.stageHtml(_lienzoTemplateCanvas(id), { mode: 'thumb' });
    const ph = hole ? `<span class="xsce-tpl-ph xsce-tpl-ph--${hole}"><i class="fas ${icon}"></i></span>` : '';
    return `<span class="xsce-tpl-thumb xsce-thumb--sm" aria-hidden="true" data-i18n-skip="true">${stage}${ph}</span>`;
}

function mostrarSelectorLienzo() {
    const th = window.XiroCanvasEditor.th;
    const modal = document.createElement('div');
    modal.id = 'modalLienzoPlantillas';
    modal.className = 'xsce-overlay-dim';
    modal.innerHTML = `
        <div class="xsce-dialog" role="dialog" aria-modal="true" aria-labelledby="lienzoPlantillasTitulo" style="max-width:732px">
            <div class="xsce-dialog-head">
                <span class="xsce-tile"><i class="fas fa-object-group" aria-hidden="true"></i></span>
                <div class="xsce-heading">
                    <h3 id="lienzoPlantillasTitulo">${th('title')}</h3>
                    <p>${th('picker.intro')}</p>
                </div>
            </div>
            <div class="xsce-templates">
                ${_LIENZO_TEMPLATES.map(([id, icon, hole]) => `
                    <button type="button" class="xsce-tpl" data-lienzo-template="${id}">
                        ${_lienzoTemplateThumb(id, icon, hole)}
                        <span class="xsce-tpl-name">${th('tpl.' + id)}</span>
                        <span class="xsce-tpl-desc">${th('tpl.' + id + '_desc')}</span>
                    </button>`).join('')}
            </div>
            <div class="xsce-dialog-foot">
                <button type="button" data-lienzo-template="close" class="xsce-btn xsce-btn--ghost">${th('cancel')}</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.xsce-tpl').focus();
}
