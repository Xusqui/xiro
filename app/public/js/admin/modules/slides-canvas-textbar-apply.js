/**
 * @fileoverview Texto tipo Word, barra de formato: qué hace cada control. Escribiendo, el formato
 * de carácter va a la selección (execCommand o un span con estilo, slides-canvas-textedit-format.js)
 * y el de párrafo a los párrafos de la selección. Sin escribir, va a todo el cuadro: la fuente, el
 * tamaño, el color y la alineación del cuadro quitan ese formato de los tramos y párrafos para que
 * se vea en todo el texto; tachado, superíndice y resaltado (que el cuadro no tiene) se aplican a
 * todos los tramos, y el formato de párrafo a todos los párrafos.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const SIZE = { min: 8, max: 400 };
    // Botón de la barra → orden de execCommand para la selección
    const COMMANDS = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough' };
    const SCRIPT_COMMANDS = { sup: 'superscript', sub: 'subscript' };
    // Formato que el cuadro tiene como propiedad propia (el resto solo existe en los tramos)
    const BOX_FLAGS = ['bold', 'italic', 'underline'];
    const NUMERIC_PARA = ['lineHeight', 'spaceBefore', 'spaceAfter'];

    const RT = () => root.XiroSlideCanvasRichText;
    const editing = () => !!(E.textEdit && E.textEdit.isEditing());
    const clampSize = n => Math.min(SIZE.max, Math.max(SIZE.min, Math.round(n)));
    const lineCount = el => el.props.text.split('\n').length;

    function update(el, props, silent) {
        E.updateElement(el.id, { props, silent });
    }

    /** Cambio en el cuadro entero; el formato que también tienen los tramos se quita de ellos. */
    function boxProp(el, key, value, silent) {
        const props = { [key]: value };
        if (el.props.runs) props.runs = RT().stripOverride(el.props.runs, key);
        update(el, props, silent);
    }

    function withKey(object, key, value) {
        const copy = Object.assign({}, object);
        if (value === undefined || value === null) delete copy[key];
        else copy[key] = value;
        return copy;
    }

    const allRuns = el => el.props.runs || [{ text: el.props.text }];
    const everyRun = (el, test) => allRuns(el).every(test);

    /** Formato de carácter en todos los tramos (undefined lo quita). */
    function setOnRuns(el, key, value) {
        update(el, { runs: allRuns(el).map(run => withKey(run, key, value)) });
    }

    /** @returns {Array<Object>} Formato de cada línea del texto ({} sin formato propio). */
    function paras(el) {
        const list = [];
        for (let i = 0; i < lineCount(el); i++) list.push(Object.assign({}, (el.props.paras || [])[i]));
        return list;
    }

    /** Cambio de formato en los párrafos: los de la selección escribiendo; si no, todos. */
    function onParas(el, change) {
        if (editing()) return E.textEdit.paragraph(change);
        update(el, { paras: paras(el).map(change) });
        return true;
    }

    function stripParas(el, key) {
        return el.props.paras ? el.props.paras.map(para => withKey(para, key)) : undefined;
    }

    function setSize(el, size, silent) {
        if (!editing()) return boxProp(el, 'size', clampSize(size), silent);
        if (!silent) E.textEdit.style({ fontSize: clampSize(size) + 'px' });
    }

    function step(el, delta) {
        const current = editing() ? E.textEdit.selectionFormat() : null;
        setSize(el, (current ? current.size : el.props.size) + delta);
    }

    function toggle(el, key) {
        if (editing()) return E.textEdit.format(COMMANDS[key]);
        if (BOX_FLAGS.indexOf(key) >= 0) return boxProp(el, key, !el.props[key]);
        setOnRuns(el, key, everyRun(el, run => run[key]) ? undefined : true);
    }

    function script(el, kind) {
        if (editing()) return E.textEdit.format(SCRIPT_COMMANDS[kind]);
        setOnRuns(el, 'script', everyRun(el, run => run.script === kind) ? undefined : kind);
    }

    function highlight(el, color) {
        if (editing()) return E.textEdit.format('hiliteColor', color || 'transparent');
        setOnRuns(el, 'highlight', color || undefined);
    }

    function align(el, value) {
        if (!editing()) return update(el, { align: value, paras: stripParas(el, 'align') });
        onParas(el, para => withKey(para, 'align', value));
    }

    /** Pulsar la lista que ya tiene quita la lista; 'none' anula en un párrafo la del cuadro. */
    function list(el, kind) {
        const boxList = el.props.list || null;
        if (!editing()) return update(el, { list: boxList === kind ? null : kind, paras: stripParas(el, 'list') });
        onParas(el, para => {
            const current = root.XiroSlideCanvasRichTextHtml.kindOf(para, boxList);
            if (current === kind) return withKey(para, 'list', boxList ? 'none' : undefined);
            return withKey(para, 'list', kind === boxList ? undefined : kind);
        });
    }

    function indent(el, delta) {
        onParas(el, para => withKey(para, 'indent', Math.max(0, (para.indent || 0) + delta) || undefined));
    }

    /** Interlineado, espacios y estilo de párrafo; vacío (o 0) vuelve al normal. */
    function paraValue(el, key, raw) {
        const value = NUMERIC_PARA.indexOf(key) >= 0 ? Number(raw) || undefined : raw || undefined;
        onParas(el, para => withKey(para, key, value));
    }

    /**
     * Campo de la barra cambiado ('input' llega con silent: vista previa sin historial).
     * @param {Object} el - Texto seleccionado.
     * @param {string} key - data-tb del campo.
     * @param {string} value - Valor del campo.
     * @param {boolean} silent - true en 'input', false en 'change'.
     */
    function field(el, key, value, silent) {
        if (key === 'size') return Number.isFinite(parseFloat(value)) && setSize(el, parseFloat(value), silent);
        if (key === 'color' && editing()) return silent || E.textEdit.format('foreColor', value);
        if (key === 'color') return boxProp(el, 'color', value, silent);
        if (silent) return;
        if (key === 'font' && editing()) return E.textEdit.style({ fontFamily: root.XiroSlideCanvas.FONTS[value] });
        if (key === 'font') return boxProp(el, 'font', value);
        if (key === 'highlight') return highlight(el, value);
        paraValue(el, key, value);
    }

    /**
     * Botón de la barra pulsado.
     * @param {Object} el - Texto seleccionado.
     * @param {HTMLElement} button - Botón con su data-tb-*.
     */
    function click(el, button) {
        const attr = name => button.getAttribute('data-tb-' + name);
        if (attr('step')) step(el, Number(attr('step')));
        if (attr('toggle')) toggle(el, attr('toggle'));
        if (attr('script')) script(el, attr('script'));
        if (attr('clear')) highlight(el, null);
        if (attr('align')) align(el, attr('align'));
        if (attr('list')) list(el, attr('list'));
        if (attr('indent')) indent(el, Number(attr('indent')));
    }

    E.textFormat = { field, click, paras };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.textFormat;
})();
