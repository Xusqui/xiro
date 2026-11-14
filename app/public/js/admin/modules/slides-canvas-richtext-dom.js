/**
 * @fileoverview Texto tipo Word, editor: lee el cuadro editable (contenteditable) como texto plano,
 * tramos y párrafos (core/slide-canvas-richtext.js). Entiende lo que generan los navegadores al
 * editar: <b>/<i>/<u>/<s>/<sup>/<sub>, <font color|face>, spans con estilo (execCommand con
 * styleWithCSS), <br> y líneas en <div>/<p>. El formato de cada trozo se resuelve de fuera hacia
 * dentro, así que un estilo interior anula al exterior. El de cada párrafo sale de los atributos
 * data-* que pinta el editor (PARA_DATA de core/slide-canvas-richtext-html.js).
 *
 * Como en el navegador, un <br> al final de un bloque no abre otra línea: solo la mantiene visible.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const BLOCKS = ['DIV', 'P', 'LI'];
    const ZERO_WIDTH_RE = /\u200b/g;
    const NUMERIC_PARA = ['indent', 'lineHeight', 'spaceBefore', 'spaceAfter'];
    const TAG_FORMAT = {
        B: { bold: true },
        STRONG: { bold: true },
        I: { italic: true },
        EM: { italic: true },
        U: { underline: true },
        S: { strike: true },
        STRIKE: { strike: true },
        DEL: { strike: true },
        SUP: { script: 'sup' },
        SUB: { script: 'sub' }
    };
    const VERTICAL = { super: 'sup', sub: 'sub' };

    function hex2(n) {
        return ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2);
    }

    /** Color CSS (#rgb, #rrggbb, rgb(), rgba()) a #rrggbb[aa], o null. */
    function toHex(value) {
        const v = String(value || '')
            .trim()
            .toLowerCase();
        if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(v)) return v;
        if (/^#[0-9a-f]{3}$/.test(v)) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
        const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(v);
        if (!m) return null;
        const alpha = m[4] === undefined || Number(m[4]) >= 1 ? '' : hex2(Number(m[4]) * 255);
        return '#' + hex2(m[1]) + hex2(m[2]) + hex2(m[3]) + alpha;
    }

    function weightIsBold(weight) {
        if (weight === 'bold' || weight === 'bolder') return true;
        if (weight === 'normal' || weight === 'lighter') return false;
        const n = parseInt(weight, 10);
        return Number.isFinite(n) ? n >= 600 : null;
    }

    const firstFamily = value => String(value).replace(/["']/g, '').toLowerCase().split(',')[0].trim();

    /** Fuente del lienzo (clave de FONTS) por la primera familia de su pila, o null. */
    function fontKey(value) {
        const fonts = root.XiroSlideCanvas && root.XiroSlideCanvas.FONTS;
        if (!fonts || !value) return null;
        const first = firstFamily(value);
        return Object.keys(fonts).find(key => firstFamily(fonts[key]) === first) || null;
    }

    /** Resaltado: transparente o con alfa 0 lo quita (undefined); null si no se entiende. */
    function highlightOf(value) {
        const hex = toHex(value);
        if (value === 'transparent' || (hex && hex.length === 9 && hex.slice(7) === '00')) return undefined;
        return hex;
    }

    function styleFormat(s, f) {
        const bold = s.fontWeight ? weightIsBold(s.fontWeight) : null;
        if (bold !== null) f.bold = bold;
        if (s.fontStyle) f.italic = s.fontStyle === 'italic' || s.fontStyle === 'oblique';
        const decoration = s.textDecorationLine || s.textDecoration;
        if (decoration) {
            f.underline = decoration.indexOf('underline') >= 0;
            f.strike = decoration.indexOf('line-through') >= 0;
        }
        if (s.color && toHex(s.color)) f.color = toHex(s.color);
        if (s.verticalAlign) f.script = VERTICAL[s.verticalAlign];
        if (s.backgroundColor && highlightOf(s.backgroundColor) !== null) f.highlight = highlightOf(s.backgroundColor);
        if (fontKey(s.fontFamily)) f.font = fontKey(s.fontFamily);
        const px = /^(\d+(?:\.\d+)?)px$/.exec(s.fontSize || '');
        if (px) f.size = Number(px[1]);
    }

    function paraOf(el) {
        const map = root.XiroSlideCanvasRichTextHtml ? root.XiroSlideCanvasRichTextHtml.PARA_DATA : {};
        const para = {};
        Object.keys(map).forEach(key => {
            const value = el.getAttribute(map[key]);
            if (value !== null) para[key] = NUMERIC_PARA.indexOf(key) >= 0 ? Number(value) : value;
        });
        return para;
    }

    /** Formato de un elemento a partir del de su padre: etiqueta, atributos y estilo en línea. */
    function formatOf(el, parent) {
        const f = Object.assign({}, parent, TAG_FORMAT[el.tagName]);
        if (el.tagName === 'FONT') {
            if (toHex(el.getAttribute('color'))) f.color = toHex(el.getAttribute('color'));
            if (fontKey(el.getAttribute('face'))) f.font = fontKey(el.getAttribute('face'));
        }
        if (BLOCKS.indexOf(el.tagName) >= 0) f.para = paraOf(el);
        styleFormat(el.style, f);
        return f;
    }

    const hasContent = n => (n.nodeType === 3 ? !!n.nodeValue.replace(ZERO_WIDTH_RE, '') : n.nodeType === 1);

    /** Un <br> sin nada detrás dentro de su bloque solo mantiene la línea visible. */
    function isTrailing(br, box) {
        for (let n = br; n !== box; n = n.parentNode) {
            for (let s = n.nextSibling; s; s = s.nextSibling) if (hasContent(s)) return false;
            if (BLOCKS.indexOf(n.parentNode.tagName) >= 0) return true;
        }
        return true;
    }

    function newLine(ctx, format) {
        ctx.pieces.push(Object.assign({}, format, { text: '\n' }));
        ctx.line++;
        ctx.used = ctx.content = ctx.afterBlock = false;
    }

    /** La línea actual existe; su párrafo es el del primero que la abre (o el de un bloque con data-*). */
    function useLine(ctx, para, force) {
        if (!ctx.used || force) ctx.paras[ctx.line] = para;
        ctx.used = true;
    }

    function addText(ctx, text, format) {
        const clean = text.replace(ZERO_WIDTH_RE, '');
        if (!clean) return;
        clean.split('\n').forEach((part, k) => {
            if (k > 0 || ctx.afterBlock) newLine(ctx, format);
            useLine(ctx, format.para);
            if (!part) return;
            ctx.pieces.push(Object.assign({}, format, { text: part }));
            ctx.content = true;
        });
    }

    function addBreak(ctx, br, format) {
        if (ctx.afterBlock) newLine(ctx, format);
        useLine(ctx, format.para);
        if (!isTrailing(br, ctx.box)) newLine(ctx, format);
    }

    function addBlock(ctx, el, outer) {
        const inner = formatOf(el, outer);
        if (ctx.content || (ctx.used && ctx.afterBlock)) newLine(ctx, outer);
        useLine(ctx, inner.para, Object.keys(inner.para).length > 0);
        ctx.afterBlock = false;
        walk(el, inner, ctx);
        ctx.afterBlock = true;
    }

    function walk(node, format, ctx) {
        node.childNodes.forEach(child => {
            if (child.nodeType === 3) return addText(ctx, child.nodeValue, format);
            if (child.nodeType !== 1) return;
            if (child.tagName === 'BR') return addBreak(ctx, child, format);
            if (BLOCKS.indexOf(child.tagName) >= 0) return addBlock(ctx, child, format);
            walk(child, formatOf(child, format), ctx);
        });
    }

    /** Formato del cuadro con el que empieza la lectura. */
    function startFormat(base) {
        return {
            bold: !!base.bold,
            italic: !!base.italic,
            underline: !!base.underline,
            color: base.color,
            font: base.font,
            size: base.size
        };
    }

    /**
     * Lee el contenido editable.
     * @param {HTMLElement} box - Cuadro contenteditable.
     * @param {Object} base - Props del cuadro (formato, alineación y lista).
     * @returns {{text: string, runs: Array<Object>|null, paras: Array<Object>|undefined}} Texto plano,
     *   tramos (null sin formato propio) y párrafos (undefined sin formato de párrafo).
     */
    function read(box, base) {
        const RT = root.XiroSlideCanvasRichText;
        const start = startFormat(base);
        const ctx = { box, pieces: [], paras: [], line: 0, used: false, content: false, afterBlock: false };
        walk(box, start, ctx);
        const text = RT.runsText(ctx.pieces) || '';
        const raw = [];
        for (let i = 0; i <= ctx.line; i++) raw.push(ctx.paras[i] || {});
        return {
            text,
            runs: RT.normalizeRuns(ctx.pieces, start),
            paras: RT.normalizeParas(raw, text, base) || undefined
        };
    }

    /**
     * Formato en un punto del cuadro (para el − y + del tamaño escribiendo).
     * @param {Node} node - Nodo dentro del cuadro.
     * @param {HTMLElement} box - Cuadro contenteditable.
     * @param {Object} base - Props del cuadro.
     * @returns {Object} Formato resuelto de fuera hacia dentro.
     */
    function formatAt(node, box, base) {
        const chain = [];
        for (let n = node && node.nodeType === 3 ? node.parentNode : node; n && n !== box; n = n.parentNode)
            chain.unshift(n);
        return chain.reduce((format, el) => formatOf(el, format), startFormat(base));
    }

    E.richTextDom = { read, toHex, formatAt, paraOf };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.richTextDom;
})();
