/**
 * @fileoverview Texto enriquecido de la diapositiva libre (fase C): los datos.
 *
 * props.text sigue siendo el texto plano completo (lo leen los clientes antiguos, la IA y la
 * búsqueda). props.runs, si existe, lo trocea en tramos con formato de carácter propio sobre el
 * del cuadro: cada tramo guarda solo lo que difiere (negrita, cursiva, subrayado, tachado,
 * color, fuente, tamaño, superíndice/subíndice y resaltado). props.paras, si existe, da formato
 * a cada párrafo (una entrada por línea): alineación, lista y nivel, sangría, interlineado,
 * espacios y estilo. Un cuadro sin formato propio no tiene ni runs ni paras.
 * El HTML está en slide-canvas-richtext-html.js; innerHtml se mantiene aquí por compatibilidad.
 * ES5 a propósito (webOS 3.5). Expone window.XiroSlideCanvasRichText y module.exports.
 */
(function (root) {
    'use strict';

    const MAX_TEXT = 2000;
    const MAX_RUNS = 300;
    const MAX_INDENT = 8;
    const MAX_SPACE = 200;
    const FLAGS = ['bold', 'italic', 'underline', 'strike'];
    const FORMAT_KEYS = FLAGS.concat(['color', 'font', 'size', 'script', 'highlight']);
    const LISTS = ['bullet', 'number', 'alpha', 'roman'];
    const ALIGNS = ['left', 'center', 'right', 'justify'];
    const SCRIPTS = ['sup', 'sub'];
    const PARA_STYLES = ['title', 'subtitle', 'quote'];
    const LINE_HEIGHTS = [1, 1.15, 1.5, 2, 2.5, 3];
    const COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

    /** Módulo hermano: require en Node/Jest, global en el navegador (se busca al usarlo). */
    function dep(file, globalName) {
        return typeof module !== 'undefined' && module.exports
            ? // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
              require(file)
            : root[globalName];
    }

    function clampInt(v, min, max) {
        if (typeof v !== 'number' || !isFinite(v)) return null;
        return Math.min(max, Math.max(min, Math.round(v)));
    }

    /** Copia un color válido si difiere del cuadro; false si no es un color. */
    function copyColor(raw, base, run, key) {
        const v = raw[key];
        if (v === undefined || v === null) return true;
        if (typeof v !== 'string' || !COLOR_RE.test(v)) return false;
        if (v !== base[key]) run[key] = v;
        return true;
    }

    function copyFontAndSize(raw, base, run) {
        const fonts = dep('./slide-canvas-model', 'XiroSlideCanvas').FONTS;
        if (
            typeof raw.font === 'string' &&
            Object.prototype.hasOwnProperty.call(fonts, raw.font) &&
            raw.font !== base.font
        )
            run.font = raw.font;
        const size = clampInt(raw.size, 8, 400);
        if (size !== null && size !== base.size) run.size = size;
    }

    /** Tramo limpio con solo sus diferencias respecto a base, o null si no es válido. */
    function cleanRun(raw, base) {
        if (!raw || typeof raw !== 'object' || typeof raw.text !== 'string') return null;
        const run = { text: raw.text.replace(/\r\n?/g, '\n') };
        for (let i = 0; i < FLAGS.length; i++) {
            const key = FLAGS[i];
            if (typeof raw[key] === 'boolean' && raw[key] !== !!base[key]) run[key] = raw[key];
        }
        if (!copyColor(raw, base, run, 'color') || !copyColor(raw, {}, run, 'highlight')) return null;
        copyFontAndSize(raw, base, run);
        if (SCRIPTS.indexOf(raw.script) >= 0) run.script = raw.script;
        return run;
    }

    function sameFormat(a, b) {
        for (let i = 0; i < FORMAT_KEYS.length; i++) if (a[FORMAT_KEYS[i]] !== b[FORMAT_KEYS[i]]) return false;
        return true;
    }

    function hasOverrides(run) {
        return Object.keys(run).length > 1;
    }

    /** Une los tramos contiguos con el mismo formato, quita los vacíos y recorta el texto. */
    function compact(list) {
        const out = [];
        let room = MAX_TEXT;
        for (let i = 0; i < list.length && room > 0; i++) {
            const run = list[i];
            run.text = run.text.slice(0, room);
            room -= run.text.length;
            if (!run.text) continue;
            const last = out[out.length - 1];
            if (last && sameFormat(last, run)) last.text += run.text;
            else out.push(run);
        }
        return out.slice(0, MAX_RUNS);
    }

    function cleanList(raw, base) {
        const list = [];
        for (let i = 0; i < raw.length; i++) {
            const run = cleanRun(raw[i], base);
            if (!run) return null;
            list.push(run);
        }
        return compact(list);
    }

    /**
     * Tramos normalizados frente al formato del cuadro.
     * @param {Array<Object>} raw - Tramos de entrada { text, bold, italic, underline, strike, color,
     *   font, size, script, highlight }.
     * @param {Object} base - Formato del cuadro { bold, italic, underline, color, font, size }.
     * @returns {Array<Object>|null} null si no es válido o si no queda ningún formato propio.
     */
    function normalizeRuns(raw, base) {
        const runs = Array.isArray(raw) ? cleanList(raw, base || {}) : null;
        if (!runs) return null;
        for (let j = 0; j < runs.length; j++) if (hasOverrides(runs[j])) return runs;
        return null;
    }

    /**
     * Texto plano de unos tramos de entrada, tengan o no formato propio.
     * @param {*} raw - Tramos de entrada.
     * @returns {string|null} null si no son tramos válidos.
     */
    function runsText(raw) {
        const runs = Array.isArray(raw) ? cleanList(raw, {}) : null;
        return runs ? textOf(runs) : null;
    }

    /** @returns {string} Texto plano de los tramos. */
    function textOf(runs) {
        let text = '';
        for (let i = 0; i < runs.length; i++) text += runs[i].text;
        return text;
    }

    /**
     * Quita un formato de todos los tramos (cuando se cambia en el cuadro entero).
     * @param {Array<Object>} runs - Tramos.
     * @param {string} key - Formato de carácter (bold, color, font, size…).
     * @returns {Array<Object>} Copia sin ese formato.
     */
    function stripOverride(runs, key) {
        return runs.map(function (run) {
            const copy = {};
            for (const k in run) if (k !== key) copy[k] = run[k];
            return copy;
        });
    }

    /** «Sin lista» solo tiene sentido si el cuadro entero es una lista. */
    function paraList(value, boxList) {
        if (value === 'none') return boxList ? 'none' : null;
        return LISTS.indexOf(value) >= 0 && value !== boxList ? value : null;
    }

    function setIf(out, key, value) {
        if (value) out[key] = value;
    }

    function cleanPara(raw, base) {
        const p = {};
        if (!raw || typeof raw !== 'object') return p;
        if (ALIGNS.indexOf(raw.align) >= 0 && raw.align !== base.align) p.align = raw.align;
        setIf(p, 'list', paraList(raw.list, base.list));
        setIf(p, 'indent', clampInt(raw.indent, 0, MAX_INDENT));
        if (LINE_HEIGHTS.indexOf(raw.lineHeight) >= 0) p.lineHeight = raw.lineHeight;
        setIf(p, 'spaceBefore', clampInt(raw.spaceBefore, 0, MAX_SPACE));
        setIf(p, 'spaceAfter', clampInt(raw.spaceAfter, 0, MAX_SPACE));
        if (PARA_STYLES.indexOf(raw.style) >= 0) p.style = raw.style;
        return p;
    }

    /**
     * Formato por párrafo, uno por línea del texto (se rellena o se recorta).
     * @param {*} raw - Párrafos de entrada.
     * @param {string} text - Texto plano del cuadro.
     * @param {Object} base - Formato del cuadro { align, list }.
     * @returns {Array<Object>|null} null si no es un array o ningún párrafo tiene formato propio.
     */
    function normalizeParas(raw, text, base) {
        if (!Array.isArray(raw)) return null;
        const count = String(text).split('\n').length;
        const out = [];
        let any = false;
        for (let i = 0; i < count; i++) {
            const para = cleanPara(raw[i], base || {});
            if (Object.keys(para).length) any = true;
            out.push(para);
        }
        return any ? out : null;
    }

    /** HTML del contenido (slide-canvas-richtext-html.js); sin ese módulo, el texto escapado. */
    function innerHtml(p, escape, options) {
        const html = dep('./slide-canvas-richtext-html', 'XiroSlideCanvasRichTextHtml');
        return html ? html.innerHtml(p, escape, options) : escape(p.text);
    }

    const api = {
        MAX_TEXT: MAX_TEXT,
        MAX_RUNS: MAX_RUNS,
        MAX_INDENT: MAX_INDENT,
        MAX_SPACE: MAX_SPACE,
        LISTS: LISTS,
        ALIGNS: ALIGNS,
        SCRIPTS: SCRIPTS,
        PARA_STYLES: PARA_STYLES,
        LINE_HEIGHTS: LINE_HEIGHTS,
        normalizeRuns: normalizeRuns,
        normalizeParas: normalizeParas,
        textOf: textOf,
        runsText: runsText,
        stripOverride: stripOverride,
        innerHtml: innerHtml
    };

    root.XiroSlideCanvasRichText = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
