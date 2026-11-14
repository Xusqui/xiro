/**
 * @fileoverview Texto tipo Word, edición en el lienzo: formato de la selección que execCommand no
 * da bien. La fuente y el tamaño de una palabra van en un <span> con estilo propio (fontSize de
 * execCommand solo admite siete tamaños); el formato de párrafo cambia los <div> de las líneas
 * tocadas por la selección (atributos data-* y su estilo pintado, core/slide-canvas-richtext-html.js).
 * Amplía XiroCanvasEditor.textEdit; se carga después de slides-canvas-textedit.js.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});
    const T = E.textEdit;

    const lineNodes = box => Array.prototype.filter.call(box.children, n => n.tagName === 'DIV' || n.tagName === 'P');

    /** La selección dentro del cuadro abierto (vuelve a ella si la edición estaba aparcada), o null. */
    function currentRange() {
        const box = T.box();
        if (!box) return null;
        const selection = T.restore();
        if (!selection || !selection.rangeCount) return null;
        const range = selection.getRangeAt(0);
        return box.contains(range.commonAncestorContainer) ? range : null;
    }

    /** El trozo de la selección que cae dentro de una línea. */
    function clip(range, line) {
        const part = document.createRange();
        part.selectNodeContents(line);
        if (line.contains(range.startContainer)) part.setStart(range.startContainer, range.startOffset);
        if (line.contains(range.endContainer)) part.setEnd(range.endContainer, range.endOffset);
        return part;
    }

    /** Envuelve un trozo en un span con el estilo; lo de dentro pierde esas propiedades (si no, mandaría). */
    function wrap(part, css) {
        const span = document.createElement('span');
        Object.keys(css).forEach(key => (span.style[key] = css[key]));
        const fragment = part.extractContents();
        fragment.querySelectorAll('[style]').forEach(n => Object.keys(css).forEach(key => (n.style[key] = '')));
        span.appendChild(fragment);
        part.insertNode(span);
        return span;
    }

    /** Deja seleccionado lo que se acaba de envolver, para encadenar cambios (− y + del tamaño). */
    function reselect(first, last) {
        const range = document.createRange();
        range.setStart(first, 0);
        range.setEnd(last, last.childNodes.length);
        const selection = root.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    /**
     * Estilo en línea sobre la selección, línea a línea (un span nunca contiene párrafos).
     * @param {Object} css - Propiedades de estilo { fontFamily, fontSize }.
     * @returns {boolean} false sin selección (un cursor sin texto no cambia nada).
     */
    function style(css) {
        const range = currentRange();
        if (!range || range.collapsed) return false;
        const lines = lineNodes(T.box()).filter(line => range.intersectsNode(line));
        const parts = lines.length ? lines.map(line => clip(range, line)) : [range.cloneRange()];
        const spans = parts.filter(part => !part.collapsed).map(part => wrap(part, css));
        if (!spans.length) return false;
        reselect(spans[0], spans[spans.length - 1]);
        T.save();
        return true;
    }

    /** Pinta el formato de un párrafo en su <div>: atributos, clases y estilo, como el render común. */
    function paint(line, para, boxList) {
        const H = root.XiroSlideCanvasRichTextHtml;
        Object.keys(H.PARA_DATA).forEach(key => {
            if (para[key] === undefined) line.removeAttribute(H.PARA_DATA[key]);
            else line.setAttribute(H.PARA_DATA[key], para[key]);
        });
        const kind = H.kindOf(para, boxList);
        line.className = H.paraClass(para, kind);
        const css = H.paraCss(para, kind);
        if (css) line.setAttribute('style', css);
        else line.removeAttribute('style');
        if (kind) line.setAttribute('data-mark', H.markOf(kind, para.indent || 0, 1));
        else line.removeAttribute('data-mark');
    }

    /**
     * Cambia el formato de los párrafos que toca la selección.
     * @param {Function} change - Recibe el formato de un párrafo y devuelve el nuevo.
     * @returns {boolean} false sin selección en el cuadro.
     */
    function paragraph(change) {
        const range = currentRange();
        const el = E.getSelected();
        if (!range || !el) return false;
        const RT = root.XiroSlideCanvasRichText;
        lineNodes(T.box())
            .filter(line => range.intersectsNode(line))
            .forEach(line => {
                const clean = RT.normalizeParas([change(E.richTextDom.paraOf(line))], '', el.props);
                paint(line, clean ? clean[0] : {}, el.props.list);
            });
        T.save();
        return true;
    }

    /** @returns {Object|null} Formato al principio de la selección (fuente, tamaño…), o null. */
    function selectionFormat() {
        const range = currentRange();
        const el = E.getSelected();
        return range && el ? E.richTextDom.formatAt(range.startContainer, T.box(), el.props) : null;
    }

    Object.assign(T, { style, paragraph, selectionFormat });

    if (typeof module !== 'undefined' && module.exports) module.exports = T;
})();
