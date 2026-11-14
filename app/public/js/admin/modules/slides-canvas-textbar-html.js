/**
 * @fileoverview Texto tipo Word, marcado de la barra de formato, en grupos como en un procesador
 * de textos: letra (fuente y tamaño), carácter (negrita, cursiva, subrayado, tachado, superíndice,
 * subíndice, color y resaltado), alineación, listas (viñetas, números y sangría) y párrafo
 * (espaciado y estilo). Para que quepa en una fila, el espaciado (interlineado, antes y después) y
 * los tipos de numeración (1., a., i.) van en paneles dentro de la barra que abren sus botones
 * [data-tb-pop] (slides-canvas-textbar-pop.js). Los grupos se separan con espacio, sin rayas que
 * queden colgando al partirse la barra. Textos: claves admin.canvas.tb.* (slides-canvas-i18n.js).
 * Los campos que se quedan el foco llevan data-keep-edit: elegir en ellos aparca la edición en vez
 * de terminarla (slides-canvas-textedit.js).
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
    // Tipos de lista numerada del menú, con la muestra de cómo empiezan
    const NUMBERED = [
        ['number', '1.'],
        ['alpha', 'a.'],
        ['roman', 'i.']
    ];
    const STYLES = ['title', 'subtitle', 'quote'];
    // Flechas arriba y abajo junto a tres líneas: el espaciado del párrafo
    const SPACING_ICON = '<path d="M3 2v12M1 4l2-2 2 2M1 12l2 2 2-2"/><path d="M8 4h7M8 8h7M8 12h7"/>';
    const IDS = {
        spacing: 'xsceTbSpacing',
        numbering: 'xsceTbNumbering',
        lineHeight: 'xsceTbLineHeight',
        spaceBefore: 'xsceTbSpaceBefore',
        spaceAfter: 'xsceTbSpaceAfter'
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
    const svg = paths => '<svg class="xsce-tb-svg" viewBox="0 0 16 16" aria-hidden="true">' + paths + '</svg>';
    const idOf = key => (IDS[key] ? ' id="' + IDS[key] + '"' : '');

    function select(key, label, options, extraClass) {
        const items = options.map(o => '<option value="' + o[0] + '"' + (o[2] || '') + '>' + o[1] + '</option>');
        return (
            '<select class="xsce-tb-select' +
            (extraClass ? ' ' + extraClass : '') +
            '"' +
            idOf(key) +
            ' data-tb="' +
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
        const fonts = E.FONT_OPTIONS.map(f => [
            f[0],
            th(f[1]),
            ' style="font-family:' + families[f[0]].replace(/"/g, '') + '"'
        ]);
        return (
            select('font', 'tb.font', fonts, 'xsce-tb-font') +
            button('data-tb-step="-' + SIZE_STEP + '"', icon('fa-minus'), 'tb.smaller') +
            '<span class="xsce-tb-field"><input type="number" class="xsce-tb-size" data-tb="size" data-keep-edit min="8" max="400"' +
            named('tb.size') +
            '><span class="xsce-tb-unit" aria-hidden="true">px</span></span>' +
            button('data-tb-step="' + SIZE_STEP + '"', icon('fa-plus'), 'tb.bigger')
        );
    }

    /** Campo de color con lo que lo nombra delante (un icono, o el botón del rotulador). */
    function swatch(key, lead, label) {
        return (
            '<span class="xsce-tb-color">' +
            lead +
            '<input type="color" class="xsce-swatch" data-tb="' +
            key +
            '" data-keep-edit' +
            named(label) +
            '></span>'
        );
    }

    /**
     * Rotulador, como en Word: aplica el último color de resaltado elegido, que se ve en la raya
     * de debajo. El color lo pone slides-canvas-textbar.js en data-tb-mark.
     */
    function marker() {
        return button(
            'data-tb-mark=""',
            icon('fa-highlighter') + '<span class="xsce-tb-mark" aria-hidden="true"></span>',
            'tb.highlight_apply'
        );
    }

    function charGroup() {
        return (
            TOGGLES.map(t => button('data-tb-toggle="' + t[0] + '"', icon(t[1]), 'tb.' + t[0], true)).join('') +
            SCRIPTS.map(s => button('data-tb-script="' + s[0] + '"', icon(s[1]), 'tb.' + s[0], true)).join('') +
            swatch('color', icon('fa-font'), 'tb.color') +
            swatch('highlight', marker(), 'tb.highlight') +
            button('data-tb-clear="highlight"', icon('fa-eraser'), 'tb.highlight_clear')
        );
    }

    /** Botón que abre un panel de la barra (slides-canvas-textbar-pop.js). */
    function popButton(key, popup, face, label) {
        const attrs =
            'data-tb-pop="' +
            key +
            '" aria-haspopup="' +
            popup +
            '" aria-expanded="false" aria-controls="' +
            IDS[key] +
            '"';
        return button(attrs, face, label);
    }

    function panel(key, role, label, body) {
        return (
            '<div class="xsce-tb-pop xsce-tb-pop--' +
            key +
            '" id="' +
            IDS[key] +
            '" role="' +
            role +
            '" aria-label="' +
            th(label) +
            '" data-keep-edit hidden>' +
            body +
            '</div>'
        );
    }

    function alignGroup() {
        return ALIGNS.map(a => button('data-tb-align="' + a[0] + '"', icon(a[1]), 'tb.align_' + a[0], true)).join('');
    }

    function numberingItem(item) {
        return (
            '<button type="button" class="xsce-tb-item" role="menuitemradio" aria-checked="false" tabindex="-1" data-tb-list="' +
            item[0] +
            '" aria-label="' +
            th('tb.list_' + item[0]) +
            '">' +
            glyph(item[1]) +
            '<span>' +
            th('tb.list_' + item[0]) +
            '</span></button>'
        );
    }

    /** Viñetas, números (refleja el tipo de numeración; el menú elige entre 1., a. e i.) y sangría. */
    function listGroup() {
        return (
            button('data-tb-list="bullet"', icon('fa-list-ul'), 'tb.list_bullet', true) +
            button('data-tb-list="number" data-tb-numbered', icon('fa-list-ol'), 'tb.list_number', true) +
            popButton('numbering', 'menu', icon('fa-caret-down'), 'tb.numbering_more') +
            panel('numbering', 'menu', 'tb.numbering_more', NUMBERED.map(numberingItem).join('')) +
            button('data-tb-indent="-1"', icon('fa-outdent'), 'tb.indent_less') +
            button('data-tb-indent="1"', icon('fa-indent'), 'tb.indent_more')
        );
    }

    /** Cara del botón de números para un tipo de numeración. */
    const numberedFace = kind => (kind === 'number' ? icon('fa-list-ol') : glyph(NUMBERED.find(n => n[0] === kind)[1]));

    function row(key, label, control) {
        return '<label class="xsce-tb-label" for="' + IDS[key] + '">' + th(label) + '</label>' + control;
    }

    function spaceField(key, label) {
        return row(
            key,
            label,
            '<span class="xsce-tb-num-wrap"><input type="number" class="xsce-tb-num" id="' +
                IDS[key] +
                '" data-tb="' +
                key +
                '" data-keep-edit min="0" max="200" step="4" placeholder="0"' +
                named(label) +
                '><span class="xsce-tb-unit" aria-hidden="true">px</span></span>'
        );
    }

    /** Espaciado (en su panel) y estilo de párrafo. */
    function paraGroup() {
        const lang = document.documentElement.lang || undefined;
        const heights = [['', th('tb.line_auto')]].concat(
            root.XiroSlideCanvasRichText.LINE_HEIGHTS.map(h => [String(h), h.toLocaleString(lang)])
        );
        const styles = [['', th('tb.style_normal')]].concat(STYLES.map(s => [s, th('tb.style_' + s)]));
        const spacing =
            row('lineHeight', 'tb.line_height', select('lineHeight', 'tb.line_height', heights)) +
            spaceField('spaceBefore', 'tb.space_before') +
            spaceField('spaceAfter', 'tb.space_after');
        return (
            popButton('spacing', 'dialog', svg(SPACING_ICON), 'tb.spacing') +
            panel('spacing', 'dialog', 'tb.spacing', spacing) +
            select('style', 'tb.style', styles)
        );
    }

    /**
     * @returns {string} HTML de la barra, sin valores: los pone textbar.render(). Al final, el
     * aviso visible de qué hacer mientras no hay texto seleccionado (lo muestra render()).
     */
    function html() {
        const groups = [fontGroup(), charGroup(), alignGroup(), listGroup(), paraGroup()]
            .map(group => '<span class="xsce-tb-group">' + group + '</span>')
            .join('');
        // La barra de herramientas es esta fila: un <fieldset> no admite role="toolbar"
        const toolbar =
            '<div class="xsce-tb-row" role="toolbar" aria-label="' + th('text_format') + '">' + groups + '</div>';
        return toolbar + '<span class="xsce-tb-idle" hidden>' + th('tb.idle') + '</span>';
    }

    E.textbarHtml = { html, numberedFace };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.textbarHtml;
})();
