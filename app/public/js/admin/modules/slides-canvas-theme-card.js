/**
 * @fileoverview Tarjeta «Tema» del editor del juego personalizado (fase F4c): el tema actual con sus muestras,
 * «Cambiar tema» (abre el diálogo con las diapositivas del juego) y «Deshacer» a nivel de juego. Aplicar
 * reescribe las diapositivas en currentCustomGameQuestions y repinta la lista; no se guarda nada hasta guardar
 * el juego. Script clásico: lo usan personalizados-expanded.js y los data-admin-click. Textos: admin.canvas.theme.*
 */

// Último aviso (aplicado o deshecho); se borra al pintar el editor de nuevo
let _temaEstado = '';

function _temaCardHtml() {
    const E = window.XiroCanvasEditor;
    const theme = E.gameTheme.current();
    const name = theme ? E.themeDialog.nameOf(theme) : E.t('theme.card_none');
    const swatches = theme ? E.themeDialog.swatchesHtml(theme) : '';
    const undo = E.gameTheme.canUndo()
        ? `<button type="button" class="xsce-btn xsce-btn--ghost" data-admin-click="deshacerTemaLienzo()"><i class="fas fa-rotate-left" aria-hidden="true"></i> ${E.th('theme.undo')}</button>`
        : '';
    return `
            <div id="lienzoTemaCard" class="xsce-theme-card">
                <div class="xsce-theme-card-main">
                    <h4>${E.th('theme.card_title')}</h4>
                    <p class="xsce-theme-name">${window.XiroSlideCanvasRender.escapeText(name)}</p>
                    ${swatches}
                </div>
                <div class="xsce-theme-card-actions">
                    ${undo}
                    <button type="button" class="xsce-btn xsce-btn--ghost" data-admin-click="abrirTemaLienzo()"><i class="fas fa-palette" aria-hidden="true"></i> ${E.th('theme.card_change')}</button>
                </div>
                <p id="lienzoTemaEstado" class="xsce-theme-status" role="status">${window.XiroSlideCanvasRender.escapeText(_temaEstado)}</p>
            </div>`;
}

/** Tarjeta del tema para el editor del juego personalizado (sin avisos de antes). */
function customCanvasThemeCardHtml() {
    _temaEstado = '';
    return _temaCardHtml();
}

/** Repinta la tarjeta si está en la página. */
function refrescarTemaLienzo() {
    const card = document.getElementById('lienzoTemaCard');
    if (card) card.outerHTML = _temaCardHtml();
}

function _temaAplicado(changed) {
    const t = window.XiroCanvasEditor.t;
    if (changed === 0) return t('theme.applied_theme_only');
    return changed === 1 ? t('theme.applied_one') : t('theme.applied_many', { n: changed });
}

function _temaAplicar(theme) {
    const result = window.XiroCanvasEditor.gameTheme.apply(currentCustomGameQuestions, theme);
    if (!result) return;
    currentCustomGameQuestions = result.slides;
    _temaEstado = _temaAplicado(result.changed);
    dibujarPreguntasPersonalizadas();
    refrescarTemaLienzo();
}

/** «Cambiar tema»: abre el diálogo con las diapositivas del juego. */
function abrirTemaLienzo() {
    window.XiroCanvasEditor.themeDialog.open({ slides: currentCustomGameQuestions, onApply: _temaAplicar });
}

/** «Deshacer»: vuelve a las diapositivas y al tema de antes de la última aplicación. */
function deshacerTemaLienzo() {
    const state = window.XiroCanvasEditor.gameTheme.undo();
    if (!state) return;
    currentCustomGameQuestions = state.slides;
    _temaEstado = window.XiroCanvasEditor.t('theme.undone');
    dibujarPreguntasPersonalizadas();
    refrescarTemaLienzo();
}
