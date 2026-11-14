/**
 * @fileoverview HTML del texto enriquecido de la diapositiva libre (fase C), común a las seis
 * pantallas, el editor y el PDF. Los datos (tramos y párrafos) están en slide-canvas-richtext.js.
 *
 * Sin props.paras el HTML es el de siempre (tramos en línea y listas con la marca como texto).
 * Con párrafos, cada línea es un <div class="xsc-p"> con su formato; la marca de lista va en
 * data-mark y la pinta CSS (::before con attr(), sin contadores CSS, para webOS 3.5), así que
 * no es texto editable. Todo el texto se escapa; las marcas y estilos salen de valores cerrados.
 * ES5 a propósito (webOS 3.5). Expone window.XiroSlideCanvasRichTextHtml y module.exports.
 */
(function (root) {
    'use strict';

    // CSS de cada formato cuando el tramo lo activa y cuando lo quita
    const FLAG_CSS = {
        bold: ['font-weight:700', 'font-weight:400'],
        italic: ['font-style:italic', 'font-style:normal']
    };
    const BULLETS = ['•', '◦', '▪'];
    // Valores y cifras romanas en minúscula, de mayor a menor
    const ROMAN_VALUES = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const ROMAN_DIGITS = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i'];
    const INDENT_EM = 1.5;
    // Formato de cada párrafo en atributos data-* (solo en el editor), para leerlo de vuelta al escribir
    const PARA_DATA = {
        align: 'data-align',
        list: 'data-list',
        indent: 'data-indent',
        lineHeight: 'data-lh',
        spaceBefore: 'data-before',
        spaceAfter: 'data-after',
        style: 'data-style'
    };

    function dep(file, globalName) {
        return typeof module !== 'undefined' && module.exports
            ? // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
              require(file)
            : root[globalName];
    }

    function cssColor(hex) {
        return dep('./slide-canvas-style', 'XiroSlideCanvasStyle').cssColor(hex);
    }

    /** Subrayado y tachado comparten text-decoration; sin ninguno de los dos, null. */
    function decoration(run) {
        if (run.underline === undefined && run.strike === undefined) return null;
        const lines = [];
        if (run.underline) lines.push('underline');
        if (run.strike) lines.push('line-through');
        return 'text-decoration:' + (lines.length ? lines.join(' ') : 'none');
    }

    function runCss(run) {
        const parts = [];
        if (typeof run.bold === 'boolean') parts.push(FLAG_CSS.bold[run.bold ? 0 : 1]);
        if (typeof run.italic === 'boolean') parts.push(FLAG_CSS.italic[run.italic ? 0 : 1]);
        const deco = decoration(run);
        if (deco) parts.push(deco);
        if (run.color) parts.push('color:' + cssColor(run.color));
        if (run.font) parts.push('font-family:' + dep('./slide-canvas-model', 'XiroSlideCanvas').FONTS[run.font]);
        if (run.size) parts.push('font-size:' + run.size + 'px');
        // Sin tamaño propio, superíndice y subíndice se pintan más pequeños, como en Word
        if (run.script)
            parts.push(
                'vertical-align:' + (run.script === 'sup' ? 'super' : 'sub') + (run.size ? '' : ';font-size:0.6em')
            );
        if (run.highlight) parts.push('background-color:' + cssColor(run.highlight));
        return parts.join(';');
    }

    function runHtml(run, escape) {
        const css = runCss(run);
        return css ? '<span style="' + css + '">' + escape(run.text) + '</span>' : escape(run.text);
    }

    /** Los tramos repartidos en líneas (un tramo que cruza un salto se parte en dos). */
    function splitLines(runs) {
        const lines = [[]];
        for (let i = 0; i < runs.length; i++) {
            const pieces = runs[i].text.split('\n');
            for (let k = 0; k < pieces.length; k++) {
                if (k > 0) lines.push([]);
                if (pieces[k]) lines[lines.length - 1].push(Object.assign({}, runs[i], { text: pieces[k] }));
            }
        }
        return lines;
    }

    function lineHtml(line, escape) {
        if (!line.length) return '\u200b';
        return line
            .map(function (run) {
                return runHtml(run, escape);
            })
            .join('');
    }

    function alpha(n) {
        let s = '';
        while (n > 0) {
            n--;
            s = String.fromCharCode(97 + (n % 26)) + s;
            n = Math.floor(n / 26);
        }
        return s;
    }

    function roman(n) {
        let s = '';
        for (let i = 0; i < ROMAN_VALUES.length; i++) {
            while (n >= ROMAN_VALUES[i]) {
                s += ROMAN_DIGITS[i];
                n -= ROMAN_VALUES[i];
            }
        }
        return s;
    }

    /**
     * Marca de un elemento de lista.
     * @param {string} kind - bullet | number | alpha | roman
     * @param {number} level - Nivel de sangría (las viñetas cambian por nivel).
     * @param {number} n - Posición en su nivel, desde 1.
     * @returns {string}
     */
    function markOf(kind, level, n) {
        if (kind === 'number') return n + '.';
        if (kind === 'alpha') return alpha(n) + '.';
        if (kind === 'roman') return roman(n) + '.';
        return BULLETS[level % BULLETS.length];
    }

    /** Listas sin párrafos (formato anterior): la marca es texto dentro de la línea. */
    function listHtml(runs, kind, escape) {
        let n = 0;
        return splitLines(runs)
            .map(function (line) {
                if (!line.length) return '<div class="xsc-li">\u200b</div>';
                n++;
                return (
                    '<div class="xsc-li"><span class="xsc-li-mark">' +
                    markOf(kind, 0, n) +
                    '</span>' +
                    lineHtml(line, escape) +
                    '</div>'
                );
            })
            .join('');
    }

    /** Siguiente marca del nivel: los niveles más hondos y los cambios de tipo empiezan de nuevo. */
    function nextMark(counters, kind, level) {
        counters.length = level + 1;
        const last = counters[level];
        const n = last && last.kind === kind ? last.n + 1 : 1;
        counters[level] = { kind: kind, n: n };
        return kind === 'number' ? numberPath(counters, level) : markOf(kind, level, n);
    }

    /** Numeración multinivel (1.2.1.): se corta en un nivel que falta o que es de otro tipo. */
    function numberPath(counters, level) {
        let path = '';
        for (let i = level; i >= 0 && counters[i] && counters[i].kind === 'number'; i--)
            path = counters[i].n + '.' + path;
        return path;
    }

    function paraCss(para, kind) {
        const parts = [];
        if (para.align) parts.push('text-align:' + para.align);
        if (para.lineHeight) parts.push('line-height:' + para.lineHeight);
        if (para.spaceBefore) parts.push('margin-top:' + para.spaceBefore + 'px');
        if (para.spaceAfter) parts.push('margin-bottom:' + para.spaceAfter + 'px');
        const level = (para.indent || 0) + (kind ? 1 : 0);
        if (level) parts.push('padding-left:' + level * INDENT_EM + 'em');
        return parts.join(';');
    }

    /** Tipo de lista del párrafo: el suyo, el del cuadro o ninguno ('none' anula el del cuadro). */
    function kindOf(para, boxList) {
        return para.list === 'none' ? null : para.list || boxList || null;
    }

    function paraClass(para, kind) {
        return 'xsc-p' + (para.style ? ' xsc-p--' + para.style : '') + (kind ? ' xsc-p--li' : '');
    }

    /** Los valores salen de listas cerradas y números ya normalizados: no hace falta escaparlos. */
    function paraData(para) {
        let out = '';
        for (const key in PARA_DATA) if (para[key] !== undefined) out += ' ' + PARA_DATA[key] + '="' + para[key] + '"';
        return out;
    }

    function paraHtml(para, kind, mark, body, editable) {
        const css = paraCss(para, kind);
        const attrs = [
            ' class="' + paraClass(para, kind) + '"',
            css ? ' style="' + css + '"' : '',
            kind ? ' data-mark="' + mark + '"' : '',
            editable ? paraData(para) : ''
        ];
        return '<div' + attrs.join('') + '>' + body + '</div>';
    }

    /**
     * Marca de lista de cada párrafo; el editor la usa para renumerar mientras se escribe.
     * @param {Array<Object>} paras - Un párrafo por línea.
     * @param {string|null} boxList - Lista del cuadro.
     * @returns {Array<string|null>} null en los párrafos sin lista (cortan la numeración).
     */
    function marksOf(paras, boxList) {
        const counters = [];
        return paras.map(function (para) {
            const kind = kindOf(para, boxList);
            if (kind) return nextMark(counters, kind, para.indent || 0);
            counters.length = 0;
            return null;
        });
    }

    function paragraphsHtml(p, escape, editable) {
        const lines = splitLines(p.runs || [{ text: p.text }]);
        const paras = lines.map(function (line, i) {
            return (p.paras && p.paras[i]) || {};
        });
        const marks = marksOf(paras, p.list);
        return lines
            .map(function (line, i) {
                return paraHtml(paras[i], kindOf(paras[i], p.list), marks[i], lineHtml(line, escape), editable);
            })
            .join('');
    }

    /**
     * HTML del contenido del cuadro (dentro de .xsc-text-inner).
     * @param {Object} p - Props del texto normalizadas.
     * @param {Function} escape - Escapado de texto a HTML.
     * @param {Object} [options] - { editable: true } para el editor: siempre un <div> por línea, con
     *   su formato en atributos data-*.
     * @returns {string}
     */
    function innerHtml(p, escape, options) {
        const editable = !!(options && options.editable);
        if (p.paras || editable) return paragraphsHtml(p, escape, editable);
        const runs = p.runs || [{ text: p.text }];
        if (p.list) return listHtml(runs, p.list, escape);
        if (!p.runs) return escape(p.text);
        return lineHtml(runs, escape);
    }

    const api = {
        PARA_DATA: PARA_DATA,
        markOf: markOf,
        marksOf: marksOf,
        kindOf: kindOf,
        paraClass: paraClass,
        paraCss: paraCss,
        innerHtml: innerHtml
    };

    root.XiroSlideCanvasRichTextHtml = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
