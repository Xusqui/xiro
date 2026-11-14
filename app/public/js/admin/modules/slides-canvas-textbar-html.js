/**
 * @fileoverview Texto tipo Word, marcado de la barra de formato, en cuatro grupos como en un
 * procesador de textos: letra (fuente y tamaño), carácter (negrita, cursiva, subrayado, tachado,
 * superíndice, subíndice, color y resaltado), párrafo (alineación, listas y sangría) y espaciado
 * (interlineado, espacio antes y después, estilo). Textos: claves admin.canvas.tb.*
 * (slides-canvas-i18n.js). Los campos que se quedan el foco llevan data-keep-edit: elegir en
 * ellos aparca la edición en vez de terminarla (slides-canvas-textedit.js).
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const SIZE_STEP = 4;
    const TOGGLES = [
        ['bold', 'fa-bold'],
        ['italic', 'fa-italic'],
        ['underline', 'fa-underline'],
        ['strike', 'fa-strikethrough']
    ];
    const SCRIPTS = [
        ['sup', 'fa-superscript'],
        ['sub', 'fa-subscript']
    ];
    const ALIGNS = [
        ['left', 'fa-align-left'],
        ['center', 'fa-align-center'],
        ['right', 'fa-align-right'],
        ['justify', 'fa-align-justify']
    ];
    // Viñetas y números con icono; letras y romanos con su propia muestra de texto
    const LISTS = [
        ['bullet', 'fa-list-ul'],
        ['number', 'fa-list-ol'],
        ['alpha', null, 'a.'],
        ['roman', null, 'i.']
    ];
    const STYLES = ['title', 'subtitle', 'quote'];
    // Raya gruesa donde va el espacio, dos líneas de texto al otro lado
    const SPACE_ICONS = {
        spaceBefore: '<path d="M2 2.5h12" stroke-width="2"/><path d="M4 9h8M4 13h8"/>',
        spaceAfter: '<path d="M4 3h8M4 7h8"/><path d="M2 13.5h12" stroke-width="2"/>'
    };

    const th = (key, vars) => E.th(key, vars);
    const named = key => ' title="' + th(key) + '" aria-label="' + th(key) + '"';

    function button(attrs, face, key, pressable) {
        return (
            '<button type="button" class="xsce-tool xiro-toolbar-btn" ' +
            attrs +
            (pressable ? ' aria-pressed="false"' : '') +
            ' data-tooltip="' +
            th(key) +
            '" aria-label="' +
            th(key) +
            '">' +
            face +
            '</button>'
        );
    }

    const icon = name => '<i class="fas ' + name + '" aria-hidden="true"></i>';
    const glyph = text => '<span class="xsce-tb-glyph" aria-hidden="true">' + text + '</span>';
    const SEP = '<span class="xsce-sep" aria-hidden="true"></span>';

    function select(key, label, options, extraClass) {
        const items = options.map(o => '<option value="' + o[0] + '"' + (o[2] || '') + '>' + o[1] + '</option>');
        return (
            '<select class="xsce-tb-select' +
            (extraClass ? ' ' + extraClass : '') +
            '" data-tb="' +
            key +
            '" data-keep-edit' +
            named(label) +
            '>' +
            items.join('') +
            '</select>'
        );
    }

    function fontGroup() {
        const families = root.XiroSlideCanvas.FONTS;
        const fonts = E.FONT_OPTIONS.map(f => [f[0], th(f[1]), ' style="font-family:' + families[f[0]].replace(/"/g, '') + '"']);
        return (
            select('font', 'tb.font', fonts, 'xsce-tb-font') +
            button('data-tb-step="-' + SIZE_STEP + '"', icon('fa-minus'), 'tb.smaller') +
            '<input type="number" class="xsce-tb-size" data-tb="size" data-keep-edit min="8" max="400"' +
            named('tb.size') +
            '>' +
            button('data-tb-step="' + SIZE_STEP + '"', icon('fa-plus'), 'tb.bigger')
        );
    }

    function swatch(key, faIcon, label) {
        return (
            '<span class="xsce-tb-color">' +
            icon(faIcon) +
            '<input type="color" class="xsce-swatch" data-tb="' +
            key +
            '" data-keep-edit' +
            named(label) +
            '></span>'
        );
    }

    function charGroup() {
        return (
            TOGGLES.map(t => button('data-tb-toggle="' + t[0] + '"', icon(t[1]), 'tb.' + t[0], true)).join('') +
            SCRIPTS.map(s => button('data-tb-script="' + s[0] + '"', icon(s[1]), 'tb.' + s[0], true)).join('') +
            swatch('color', 'fa-font', 'tb.color') +
            swatch('highlight', 'fa-highlighter', 'tb.highlight') +
            button('data-tb-clear="highlight"', icon('fa-eraser'), 'tb.highlight_clear')
        );
    }

    function paraGroup() {
        return (
            ALIGNS.map(a => button('data-tb-align="' + a[0] + '"', icon(a[1]), 'tb.align_' + a[0], true)).join('') +
            SEP +
            LISTS.map(l => button('data-tb-list="' + l[0] + '"', l[1] ? icon(l[1]) : glyph(l[2]), 'tb.list_' + l[0], true)).join('') +
            button('data-tb-indent="-1"', icon('fa-outdent'), 'tb.indent_less') +
            button('data-tb-indent="1"', icon('fa-indent'), 'tb.indent_more')
        );
    }

    function spaceField(key) {
        return (
            '<span class="xsce-tb-field"><svg viewBox="0 0 16 16" aria-hidden="true">' +
            SPACE_ICONS[key] +
            '</svg><input type="number" class="xsce-tb-num" data-tb="' +
            key +
            '" data-keep-edit min="0" max="200" step="4" placeholder="0"' +
            named(key === 'spaceBefore' ? 'tb.space_before' : 'tb.space_after') +
            '></span>'
        );
    }

    function spacingGroup() {
        const lang = document.documentElement.lang || undefined;
        const heights = [['', th('tb.line_auto')]].concat(
            root.XiroSlideCanvasRichText.LINE_HEIGHTS.map(h => [String(h), h.toLocaleString(lang)])
        );
        const styles = [['', th('tb.style_normal')]].concat(STYLES.map(s => [s, th('tb.style_' + s)]));
        return (
            '<span class="xsce-tb-field">' +
            icon('fa-text-height') +
            select('lineHeight', 'tb.line_height', heights) +
            '</span>' +
            spaceField('spaceBefore') +
            spaceField('spaceAfter') +
            select('style', 'tb.style', styles)
        );
    }

    /** @returns {string} HTML de la barra, sin valores: los pone textbar.render(). */
    function html() {
        return [fontGroup(), charGroup(), paraGroup(), spacingGroup()]
            .map(group => '<span class="xsce-tb-group">' + group + '</span>')
            .join(SEP);
    }

    E.textbarHtml = { html };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.textbarHtml;
})();
