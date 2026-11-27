/**
 * @fileoverview Grupo «Tema» de la barra «Añadir contenido» del editor del juego personalizado (fase F4): el tema
 * actual (nombre y muestras), «Cambiar tema» (abre el diálogo con las diapositivas del juego) y «Deshacer tema»
 * a nivel de juego, solo cuando hay algo que deshacer. Aplicar reescribe las diapositivas en
 * currentCustomGameQuestions y repinta la lista; no se guarda nada hasta guardar el juego. Script clásico: lo usan
 * personalizados-expanded.js y los data-admin-click. Textos: admin.canvas.theme.*
 */

// Último aviso (aplicado o deshecho); se borra al pintar el editor de nuevo
let _temaEstado = '';

function _temaBarHtml() {
    const E = window.XiroCanvasEditor;
    const escape = window.XiroSlideCanvasRender.escapeText;
    const theme = E.gameTheme.current();
    const name = theme ? E.themeDialog.nameOf(theme) : E.t('theme.card_none');
    const swatches = theme ? E.themeDialog.swatchesHtml(theme) : '';
    const undo = E.gameTheme.canUndo()
        ? `<button type="button" class="xsce-theme-bar-btn" data-admin-click="deshacerTemaLienzo()"><i class="fas fa-rotate-left" aria-hidden="true"></i> ${E.th('theme.undo_game')}</button>`
        : '';
    return `<span id="lienzoTemaBarra" class="xsce-theme-bar" role="group" aria-label="${E.th('theme.card_title')}">
                <button type="button" class="xsce-theme-bar-btn xsce-theme-bar-btn--primary" data-admin-click="abrirTemaLienzo()" aria-label="${escape(E.t('theme.bar_aria', { name: name }))}">
                    <i class="fas fa-palette" aria-hidden="true"></i> ${E.th('theme.section')}
                    <span class="xsce-theme-name">${escape(name)}</span>${swatches}
                </button>${undo}
                <span id="lienzoTemaEstado" class="xsce-theme-status" role="status">${escape(_temaEstado)}</span>
            </span>`;
}

/** Grupo «Tema» para la barra del editor del juego personalizado (sin avisos de antes). */
function customCanvasThemeBarHtml() {
    _temaEstado = '';
    return _temaBarHtml();
}

/** Repinta el grupo si está en la página; si el foco estaba en él, vuelve a «Tema» (el botón pulsado puede haber desaparecido). */
function refrescarTemaLienzo() {
    const group = document.getElementById('lienzoTemaBarra');
    if (!group) return;
    const hadFocus = group.contains(document.activeElement);
    group.outerHTML = _temaBarHtml();
    if (hadFocus) document.querySelector('#lienzoTemaBarra [data-admin-click="abrirTemaLienzo()"]').focus();
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

/** «Tema»: abre el diálogo con las diapositivas del juego. */
function abrirTemaLienzo() {
    window.XiroCanvasEditor.themeDialog.open({ slides: currentCustomGameQuestions, onApply: _temaAplicar });
}

/** «Deshacer tema»: vuelve a las diapositivas y al tema de antes de la última aplicación. */
function deshacerTemaLienzo() {
    const state = window.XiroCanvasEditor.gameTheme.undo();
    if (!state) return;
    currentCustomGameQuestions = state.slides;
    _temaEstado = window.XiroCanvasEditor.t('theme.undone');
    dibujarPreguntasPersonalizadas();
    refrescarTemaLienzo();
}
