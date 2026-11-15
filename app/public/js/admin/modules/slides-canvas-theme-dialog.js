/**
 * @fileoverview Diálogo «Tema» del editor del juego personalizado (fase F4c): rejilla de temas con la vista
 * previa real de cada uno (grupo de radios con una sola parada de tabulador y flechas), el tema actual marcado
 * con texto, aviso de contraste, cuántas diapositivas cambiarían y «Aplicar a todo el juego», que solo se activa
 * si hace algo. El foco entra en el tema actual y vuelve a donde estaba al cerrar. Mientras está abierto
 * (#modalLienzoTema) las teclas no llegan al editor. Aplicar y deshacer son de slides-canvas-theme-card.js.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const MODAL_ID = 'modalLienzoTema';
    const HEX = /^#[0-9a-fA-F]{6}$/;
    let state = null;

    const esc = text => root.XiroSlideCanvasRender.escapeText(text);
    const themeApi = () => root.XiroSlideCanvasTheme;
    const radios = () => Array.from(document.querySelectorAll('#' + MODAL_ID + ' [role="radio"]'));

    /** Nombre del tema: traducido si es de serie, el suyo si es propio. */
    function nameOf(theme) {
        const stock = themeApi().THEMES.some(item => item.id === theme.id);
        return stock ? E.t('theme.name_' + theme.id) : theme.name;
    }

    /** Muestras de los 6 acentos del tema. */
    function swatchesHtml(theme) {
        const dots = theme.palette.accents
            .map(color => '<span class="xsce-theme-swatch" style="background:' + (HEX.test(color) ? color : '#000000') + '"></span>')
            .join('');
        return '<span class="xsce-theme-swatches" aria-hidden="true">' + dots + '</span>';
    }

    function thumbHtml(theme) {
        // «Portada»: título grande y centrado, que enseña la fuente del tema incluso en una miniatura
        const canvas = root.XiroSlideCanvasLayouts.createLayoutCanvas('cover', theme, {
            title: E.t('content.title'),
            subtitle: E.t('content.short_body')
        });
        const stage = root.XiroSlideCanvasRender.stageHtml(canvas, { mode: 'thumb' });
        return '<span class="xsce-tpl-thumb xsce-thumb--sm" aria-hidden="true" data-i18n-skip="true">' + stage + '</span>';
    }

    function warningsHtml(theme) {
        const found = themeApi().contrastWarnings(theme);
        const accents = found.filter(w => w.code === 'accent').length;
        const lines = found.filter(w => w.code !== 'accent').map(w => E.t('theme.contrast_' + w.code, { ratio: w.ratio }));
        if (accents) lines.push(E.t('theme.contrast_accent', { n: accents }));
        return lines
            .map(line => '<span class="xsce-theme-warning"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i>' + esc(line) + '</span>')
            .join('');
    }

    function cardHtml(theme, isCurrent, tab) {
        const label = font => E.t('font.' + font);
        const fonts = E.t('theme.fonts', { title: label(theme.fonts.title), body: label(theme.fonts.body) });
        return (
            '<button type="button" class="xsce-theme" role="radio" aria-checked="' + isCurrent + '" tabindex="' + (tab ? 0 : -1) +
            '" data-theme-id="' + esc(theme.id) + '">' +
            thumbHtml(theme) +
            '<span class="xsce-theme-name">' + esc(nameOf(theme)) +
            (isCurrent ? '<span class="xsce-theme-current">' + esc(E.t('theme.current')) + '</span>' : '') +
            '</span>' +
            swatchesHtml(theme) +
            '<span class="xsce-theme-fonts">' + esc(fonts) + '</span>' +
            warningsHtml(theme) +
            '</button>'
        );
    }

    function modalHtml(list, currentId, tabIndex) {
        const th = E.th;
        return (
            '<div class="xsce-dialog" role="dialog" aria-modal="true" aria-labelledby="lienzoTemaTitulo" style="max-width:960px">' +
            '<div class="xsce-dialog-head"><span class="xsce-tile"><i class="fas fa-palette" aria-hidden="true"></i></span>' +
            '<div class="xsce-heading"><h3 id="lienzoTemaTitulo">' + th('theme.title') + '</h3><p>' + th('theme.intro') + '</p></div></div>' +
            '<div class="xsce-theme-grid" role="radiogroup" aria-label="' + th('theme.group_label') + '">' +
            list.map((theme, i) => cardHtml(theme, theme.id === currentId, i === tabIndex)).join('') +
            '</div>' +
            '<div class="xsce-dialog-foot">' +
            '<p id="lienzoTemaResumen" class="xsce-theme-summary" aria-live="polite"></p>' +
            '<button type="button" data-lienzo-tema="cancel" class="xsce-btn xsce-btn--ghost">' + th('cancel') + '</button>' +
            '<button type="button" data-lienzo-tema="apply" class="xsce-btn xsce-btn--primary" disabled>' + th('theme.apply') + '</button>' +
            '</div></div>'
        );
    }

    function themeById(id) {
        return state.list.find(theme => theme.id === id) || null;
    }

    /** Resumen de lo que haría el tema elegido y si «Aplicar» tiene sentido. */
    function refreshSummary() {
        const summary = document.getElementById('lienzoTemaResumen');
        const apply = document.querySelector('#' + MODAL_ID + ' [data-lienzo-tema="apply"]');
        const theme = state.selected ? themeById(state.selected) : null;
        if (!theme) {
            summary.textContent = E.t('theme.pick');
            apply.disabled = true;
            return;
        }
        const current = E.gameTheme.current();
        const changed = root.XiroSlideCanvasThemeGame.applyThemeToGame(state.options.slides, theme, current).changed;
        const hasCanvas = state.options.slides.some(slide => slide && slide.slide_type === 'canvas' && slide.slide_canvas);
        if (!hasCanvas) summary.textContent = E.t('theme.affects_none');
        else summary.textContent = changed === 1 ? E.t('theme.affects_one') : E.t('theme.affects_many', { n: changed });
        apply.disabled = !(changed > 0 || !current || current.id !== theme.id);
    }

    function select(id, focus) {
        state.selected = id;
        radios().forEach(radio => {
            const on = radio.getAttribute('data-theme-id') === id;
            radio.setAttribute('aria-checked', on ? 'true' : 'false');
            radio.tabIndex = on ? 0 : -1;
            if (on && focus) radio.focus();
        });
        refreshSummary();
    }

    /** Flechas, Inicio y Fin dentro del grupo de radios, con vuelta en los extremos. */
    function moveWith(key, from) {
        const list = radios();
        const at = list.indexOf(from);
        const last = list.length - 1;
        const steps = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: last };
        if (!(key in steps)) return;
        const next = steps[key] > last ? 0 : steps[key] < 0 ? last : steps[key];
        select(list[next].getAttribute('data-theme-id'), true);
    }

    function onKey(event) {
        event.stopPropagation();
        if (event.key === 'Escape') return close();
        const radio = event.target.closest ? event.target.closest('[role="radio"]') : null;
        if (radio) moveWith(event.key, radio);
    }

    function onClick(event) {
        const overlay = document.getElementById(MODAL_ID);
        const radio = event.target.closest('[role="radio"]');
        const action = event.target.closest('[data-lienzo-tema]');
        if (radio) return select(radio.getAttribute('data-theme-id'), false);
        if (action && action.getAttribute('data-lienzo-tema') === 'apply') return applySelected();
        if (action || event.target === overlay) close();
    }

    function applySelected() {
        const theme = themeById(state.selected);
        const onApply = state.options.onApply;
        close();
        if (theme && onApply) onApply(theme);
    }

    /**
     * Abre el diálogo.
     * @param {Object} options
     * @param {Array} options.slides - Diapositivas del juego, para contar cuántas cambiarían
     * @param {Function} options.onApply - (tema) => void; se llama al pulsar «Aplicar a todo el juego»
     * @param {Array} [options.themes] - Temas propios, tras los de serie
     */
    function open(options) {
        close();
        const own = (options.themes || []).map(theme => themeApi().normalizeTheme(theme)).filter(Boolean);
        const current = E.gameTheme.current();
        const list = themeApi().THEMES.concat(own);
        const found = current ? list.findIndex(theme => theme.id === current.id) : -1;
        state = { options: options, list: list, selected: found >= 0 ? current.id : null, opener: document.activeElement };
        const overlay = document.createElement('div');
        overlay.id = MODAL_ID;
        overlay.className = 'xsce-overlay-dim';
        overlay.innerHTML = modalHtml(list, state.selected, Math.max(found, 0));
        overlay.addEventListener('click', onClick);
        overlay.addEventListener('keydown', onKey);
        document.body.appendChild(overlay);
        refreshSummary();
        radios()[Math.max(found, 0)].focus();
    }

    function close() {
        const overlay = document.getElementById(MODAL_ID);
        if (overlay) overlay.remove();
        const opener = state && state.opener;
        state = null;
        if (opener && opener.focus && document.contains(opener)) opener.focus();
    }

    E.themeDialog = { open: open, close: close, nameOf: nameOf, swatchesHtml: swatchesHtml };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.themeDialog;
})();
