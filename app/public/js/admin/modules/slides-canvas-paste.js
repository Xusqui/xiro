/**
 * @fileoverview Texto tipo Word, pegar con formato (fase C4). Lee el HTML del portapapeles (Word,
 * Google Docs, webs) a texto, tramos y párrafos, como «Usar tema de destino» de PowerPoint: se quedan
 * negrita, cursiva, subrayado, tachado, superíndice/subíndice, resaltado, listas con su tipo y nivel,
 * alineación, títulos y citas; color, fuente y tamaño son los del cuadro (Docs marca todo negro a 11pt
 * y Chrome copia de las webs el color y tamaño calculados, que no sirven en una diapositiva).
 *
 * Seguridad: el HTML se analiza con DOMParser (documento inerte: no ejecuta scripts ni carga imágenes)
 * y nunca se inserta. Lo que se pega es el HTML que genera el render común con los tramos y párrafos
 * ya normalizados, con el texto escapado.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    // Más grande que esto (imágenes incrustadas de Word, páginas enteras) se pega como texto plano
    const MAX_HTML = 2000000;
    const WORD_MARKER = '[style*="mso-list:Ignore"]';
    const SKIP = 'script,style,template,noscript,title,meta,link,iframe,object,svg,math,' + WORD_MARKER;
    const DROPPED = ['color', 'font', 'size'];
    const STYLE_TAGS = { H1: 'title', H2: 'subtitle', H3: 'subtitle', BLOCKQUOTE: 'quote' };
    const LIST_STYLES = {
        decimal: 'number',
        'lower-alpha': 'alpha',
        'upper-alpha': 'alpha',
        'lower-latin': 'alpha',
        'upper-latin': 'alpha',
        'lower-roman': 'roman',
        'upper-roman': 'roman',
        disc: 'bullet',
        circle: 'bullet',
        square: 'bullet'
    };
    const OL_TYPES = { a: 'alpha', A: 'alpha', i: 'roman', I: 'roman' };
    const ALIGNS = ['left', 'center', 'right', 'justify'];
    const MSO_LEVEL_RE = /mso-list:\s*l\d+\s+level(\d+)/i;
    const SHOW_TEXT = 4;
    const SHOW_COMMENT = 128;

    const isBlock = node => !!(node && node.nodeType === 1 && E.richTextDom.isBlock(node));

    function setPara(el, key, value) {
        el.setAttribute(root.XiroSlideCanvasRichTextHtml.PARA_DATA[key], value);
    }

    function nodesOf(doc, filter) {
        const walker = doc.createTreeWalker(doc.body, filter);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
    }

    /** Word escribe la marca de lista como texto (span mso-list:Ignore) y el nivel en mso-list. */
    function wordKind(marker) {
        const text = marker ? marker.textContent.trim() : '';
        if (/^\d+[.)]/.test(text)) return 'number';
        if (/^[ivx]+[.)]/i.test(text)) return 'roman';
        if (/^[a-z][.)]/i.test(text)) return 'alpha';
        return 'bullet';
    }

    function markWordLists(body) {
        body.querySelectorAll('[style*="mso-list"]').forEach(p => {
            const level = MSO_LEVEL_RE.exec(p.getAttribute('style'));
            if (!level) return;
            setPara(p, 'list', wordKind(p.querySelector(WORD_MARKER)));
            if (Number(level[1]) > 1) setPara(p, 'indent', Number(level[1]) - 1);
        });
    }

    function listStyle(el) {
        const match = /list-style-type:\s*([a-z-]+)/i.exec((el && el.getAttribute('style')) || '');
        return match ? LIST_STYLES[match[1].toLowerCase()] : undefined;
    }

    function listKind(li) {
        const list = /^(OL|UL)$/.test(li.parentNode.tagName) ? li.parentNode : null;
        const styled = listStyle(li) || listStyle(list);
        if (styled) return styled;
        if (!list || list.tagName === 'UL') return 'bullet';
        return OL_TYPES[list.getAttribute('type')] || 'number';
    }

    /** Nivel: aria-level (Google Docs) o listas anidadas (webs). */
    function listLevel(li) {
        const aria = parseInt(li.getAttribute('aria-level'), 10);
        if (aria > 0) return aria - 1;
        let depth = -1;
        for (let n = li.parentNode; n; n = n.parentNode) if (n.tagName === 'OL' || n.tagName === 'UL') depth++;
        return Math.max(0, depth);
    }

    /** Formato de párrafo en los atributos data-* que lee slides-canvas-richtext-dom.js. */
    function markParagraphs(body) {
        body.querySelectorAll('li').forEach(li => {
            setPara(li, 'list', listKind(li));
            if (listLevel(li)) setPara(li, 'indent', listLevel(li));
        });
        body.querySelectorAll('*').forEach(el => {
            if (STYLE_TAGS[el.tagName]) setPara(el, 'style', STYLE_TAGS[el.tagName]);
            const align = String(el.style.textAlign || el.getAttribute('align') || '').toLowerCase();
            if (isBlock(el) && ALIGNS.indexOf(align) >= 0) setPara(el, 'align', align);
        });
    }

    function isPre(node) {
        for (let n = node.parentNode; n && n.tagName !== 'BODY'; n = n.parentNode)
            if (n.tagName === 'PRE' || /^pre/.test(n.style.whiteSpace)) return true;
        return false;
    }

    /** Un espacio al principio o al final de un bloque (o junto a un <br>) no se ve en el navegador. */
    function atBlockEdge(node, side) {
        for (let n = node; n.parentNode; n = n.parentNode) {
            const sibling = n[side];
            if (sibling) return isBlock(sibling) || sibling.tagName === 'BR';
            if (isBlock(n.parentNode) || n.parentNode.tagName === 'BODY') return true;
        }
        return true;
    }

    /** Espacios y saltos del código HTML, juntados como en el navegador (white-space: normal). */
    function collapseSpaces(doc) {
        nodesOf(doc, SHOW_TEXT).forEach(text => {
            if (isPre(text)) return;
            let value = text.nodeValue.replace(/[ \t\r\n\f]+/g, ' ');
            if (atBlockEdge(text, 'previousSibling')) value = value.replace(/^ /, '');
            if (atBlockEdge(text, 'nextSibling')) value = value.replace(/ $/, '');
            if (value) text.nodeValue = value;
            else text.parentNode.removeChild(text);
        });
    }

    /** Una línea por fila (TR es bloque) y un tabulador entre celdas. */
    function markCells(doc) {
        doc.body.querySelectorAll('td, th').forEach(cell => {
            if (cell.previousElementSibling) cell.insertBefore(doc.createTextNode('\t'), cell.firstChild);
        });
    }

    function clean(doc) {
        markWordLists(doc.body);
        doc.body.querySelectorAll(SKIP).forEach(el => el.parentNode && el.parentNode.removeChild(el));
        nodesOf(doc, SHOW_COMMENT).forEach(comment => comment.parentNode.removeChild(comment));
        markParagraphs(doc.body);
        collapseSpaces(doc);
        markCells(doc);
    }

    /**
     * Lee el HTML del portapapeles.
     * @param {string} html - HTML de origen (no se ejecuta ni se inserta).
     * @param {Object} base - Props del cuadro.
     * @returns {{text: string, runs: Array<Object>|null, paras: Array<Object>|undefined}}
     */
    function read(html, base) {
        const RT = root.XiroSlideCanvasRichText;
        const doc = new root.DOMParser().parseFromString(String(html), 'text/html');
        clean(doc);
        const pasted = E.richTextDom.read(doc.body, base);
        let runs = pasted.runs;
        if (runs) DROPPED.forEach(key => (runs = RT.stripOverride(runs, key)));
        return { text: pasted.text, runs: runs ? RT.normalizeRuns(runs, base) : null, paras: pasted.paras };
    }

    /**
     * HTML seguro para pegar en el cuadro que se edita: una línea sin formato de párrafo va en línea
     * (se une a la del cursor); si no, un párrafo editable por línea.
     * @param {string} html - HTML del portapapeles.
     * @param {Object} props - Props del cuadro.
     * @returns {string|null} null si hay que pegar el texto plano (sin HTML, sin texto o demasiado grande).
     */
    function toEditable(html, props) {
        if (!html || html.length > MAX_HTML) return null;
        const pasted = read(html, props);
        if (!pasted.text.trim()) return null;
        const RT = root.XiroSlideCanvasRichText;
        const escape = root.XiroSlideCanvasRender.escapeText;
        if (!pasted.paras && pasted.text.indexOf('\n') < 0)
            return RT.innerHtml({ text: pasted.text, runs: pasted.runs }, escape);
        return RT.innerHtml(Object.assign({}, pasted, { list: props.list }), escape, { editable: true });
    }

    E.paste = { read, toEditable };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.paste;
})();
