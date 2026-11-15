/**
 * Props del spec que llegaron con los formatVersion 2 a 5 de XiRo: estilo de cualquier elemento
 * (opacidad, sombra, grupo, bloqueo), texto tipo Word (tramos, párrafos, listas multinivel), formas
 * libres y su catálogo, borde y texto alternativo de las imágenes, tablas y degradado del fondo, y con
 * el formatVersion 6 los gráficos vinculados a una tabla y los elementos ocultos.
 * Aquí solo se comprueban con mensajes claros; quien deja el valor final es normalizeElement de XiRo.
 */

import crypto from 'node:crypto';
import * as R from './rules.mjs';
import { richText, table, chart, presets, style } from './xiro.mjs';
import { SpecError, isObj, clean, unknownKeys, colorValue, intValue, boolValue, enumValue } from './spec-values.mjs';

export const ELEMENT_STYLE_KEYS = ['opacity', 'shadow', 'locked', 'groupId', 'hidden'];
export const TEXT_EXTRA_KEYS = ['underline', 'list', 'runs', 'paras'];
export const PATH_KEYS = ['d', 'viewBox', 'preset'];
export const IMAGE_EXTRA_KEYS = ['alt', 'borderWidth', 'borderColor'];
export const TABLE_KEYS = ['rows', 'font', 'size', 'color', 'align', 'header', 'fill', 'bandFill', 'headerFill', 'borderColor', 'borderWidth'];
export const CHART_KEYS = ['source', 'kind', 'stacked', 'seriesColors', 'legend', 'values', 'grid', 'font', 'size', 'color', 'alt'];
export const TEXT_ALIGNS = richText.ALIGNS;
const RUN_KEYS = ['text', 'bold', 'italic', 'underline', 'strike', 'color', 'font', 'size', 'script', 'highlight'];
const PARA_KEYS = ['align', 'list', 'indent', 'lineHeight', 'spaceBefore', 'spaceAfter', 'style'];
const SHADOWS = Object.keys(style.SHADOW_PRESETS);
const quoted = list => list.map(x => `"${x}"`).join(' | ');

/* ---------- Estilo de cualquier elemento ---------- */

function shadowFrom(v, where) {
    if (typeof v === 'string') return { ...style.SHADOW_PRESETS[enumValue(v, SHADOWS, where, 'shadow')] };
    if (!isObj(v)) throw new SpecError(`${where}: "shadow" debe ser ${quoted(SHADOWS)} o { x, y, blur, color }`);
    const s = clean(v);
    unknownKeys(s, ['x', 'y', 'blur', 'color'], `${where} · shadow`);
    return {
        x: intValue(s.x === undefined ? 0 : s.x, -100, 100, where, 'shadow.x'),
        y: intValue(s.y === undefined ? 0 : s.y, -100, 100, where, 'shadow.y'),
        blur: intValue(s.blur === undefined ? 0 : s.blur, 0, 100, where, 'shadow.blur'),
        color: colorValue(s.color, where, 'shadow.color', false)
    };
}

/** Un nombre cualquiera ("titulo") pasa a un id de grupo estable de esa diapositiva (g_ + 8). */
function groupIdFrom(v, where, ctx) {
    if (typeof v !== 'string' || !v.trim()) throw new SpecError(`${where}: "groupId" debe ser un nombre de grupo`);
    if (R.GROUP_ID_RE.test(v)) return v;
    const hex = crypto.createHash('sha1').update(`${ctx.seed}|grupo|${v.trim()}`).digest('hex');
    return 'g_' + parseInt(hex.slice(0, 10), 16).toString(36).padStart(8, '0').slice(-8);
}

/** opacity, shadow, locked, groupId y hidden del elemento (solo los que trae el spec; hidden solo si es true). */
export function elementStyleFrom(raw, where, ctx) {
    const out = {};
    if (raw.opacity !== undefined) {
        if (typeof raw.opacity !== 'number' || !(raw.opacity >= 0.05 && raw.opacity <= 1)) {
            throw new SpecError(`${where}: "opacity" debe ser un número entre 0.05 y 1; recibido ${JSON.stringify(raw.opacity)}`);
        }
        out.opacity = raw.opacity;
    }
    if (raw.shadow !== undefined && raw.shadow !== null) out.shadow = shadowFrom(raw.shadow, where);
    if (raw.locked !== undefined) out.locked = boolValue(raw.locked, where, 'locked');
    if (raw.groupId !== undefined) out.groupId = groupIdFrom(raw.groupId, where, ctx);
    if (raw.hidden !== undefined && boolValue(raw.hidden, where, 'hidden')) out.hidden = true;
    return out;
}

/* ---------- Texto tipo Word ---------- */

function runFrom(input, w) {
    if (!isObj(input)) throw new SpecError(`${w}: debe ser un objeto { text, bold, color… }`);
    const r = clean(input);
    unknownKeys(r, RUN_KEYS, w);
    if (typeof r.text !== 'string' || !r.text) throw new SpecError(`${w}: "text" debe ser un texto no vacío`);
    const run = { text: r.text.replace(/\r\n?/g, '\n') };
    for (const k of ['bold', 'italic', 'underline', 'strike']) if (r[k] !== undefined) run[k] = boolValue(r[k], w, k);
    if (r.color !== undefined) run.color = colorValue(r.color, w, 'color', false);
    if (r.highlight !== undefined && r.highlight !== null) run.highlight = colorValue(r.highlight, w, 'highlight', false);
    if (r.font !== undefined) run.font = enumValue(r.font, R.FONT_KEYS, w, 'font');
    if (r.size !== undefined) run.size = intValue(r.size, 8, 400, w, 'size');
    if (r.script !== undefined) run.script = enumValue(r.script, richText.SCRIPTS, w, 'script');
    return run;
}

function runsFrom(v, where) {
    if (!Array.isArray(v) || !v.length) throw new SpecError(`${where}: "runs" debe ser una lista de tramos { text, bold, color… }`);
    if (v.length > richText.MAX_RUNS) throw new SpecError(`${where}: ${v.length} tramos (máx. ${richText.MAX_RUNS})`);
    return v.map((input, i) => runFrom(input, `${where} · runs[${i}]`));
}

function paraFrom(input, w, boxList) {
    if (input === null || input === undefined) return {};
    if (!isObj(input)) throw new SpecError(`${w}: debe ser un objeto { align, list, indent… } o null`);
    const q = clean(input);
    unknownKeys(q, PARA_KEYS, w);
    const para = {};
    if (q.align !== undefined) para.align = enumValue(q.align, richText.ALIGNS, w, 'align');
    if (q.list !== undefined) {
        para.list = enumValue(q.list, [...richText.LISTS, 'none'], w, 'list');
        if (para.list === 'none' && !boxList) throw new SpecError(`${w}: "list": "none" solo sirve si el cuadro entero es una lista ("list" en props)`);
    }
    if (q.indent !== undefined) para.indent = intValue(q.indent, 0, richText.MAX_INDENT, w, 'indent');
    if (q.lineHeight !== undefined) para.lineHeight = enumValue(q.lineHeight, richText.LINE_HEIGHTS, w, 'lineHeight');
    if (q.spaceBefore !== undefined) para.spaceBefore = intValue(q.spaceBefore, 0, richText.MAX_SPACE, w, 'spaceBefore');
    if (q.spaceAfter !== undefined) para.spaceAfter = intValue(q.spaceAfter, 0, richText.MAX_SPACE, w, 'spaceAfter');
    if (q.style !== undefined) para.style = enumValue(q.style, richText.PARA_STYLES, w, 'style');
    return para;
}

/**
 * Subrayado, lista, tramos y párrafos del texto, sobre `out` (que ya trae text y el formato del cuadro).
 * Con tramos, el texto sale de ellos.
 */
export function richTextFrom(p, out, where, ctx) {
    if (p.underline !== undefined && boolValue(p.underline, where, 'underline')) out.underline = true;
    if (p.list !== undefined && p.list !== null) out.list = enumValue(p.list, richText.LISTS, where, 'list');
    if (p.runs !== undefined) {
        out.runs = runsFrom(p.runs, where);
        const text = out.runs.map(r => r.text).join('');
        if (typeof p.text === 'string' && p.text.replace(/\r\n?/g, '\n') !== text) {
            throw new SpecError(`${where}: "text" y "runs" no dicen lo mismo; con "runs" quita "text" (sale de los tramos)`);
        }
        out.text = text;
    }
    if (p.paras === undefined) return;
    if (!Array.isArray(p.paras)) throw new SpecError(`${where}: "paras" debe ser una lista, un párrafo por línea del texto`);
    out.paras = p.paras.map((input, i) => paraFrom(input, `${where} · paras[${i}]`, out.list));
    const lines = out.text.split('\n').length;
    if (out.paras.length !== lines) {
        ctx.warnings.push(`${where}: "paras" tiene ${out.paras.length} párrafos y el texto ${lines} líneas; XiRo pone uno por línea (rellena o recorta)`);
    }
}

/* ---------- Formas libres ---------- */

/** d y viewBox de una forma "path", desde "preset" (catálogo de XiRo) o desde un trazado propio. */
export function pathFrom(p, where) {
    if (p.preset !== undefined) {
        if (p.d !== undefined || p.viewBox !== undefined) throw new SpecError(`${where}: usa "preset" o "d" + "viewBox", no los dos`);
        const d = presets.get(p.preset);
        if (!d) throw new SpecError(`${where}: "preset" debe ser ${quoted(presets.list().map(x => x.name))}; recibido ${JSON.stringify(p.preset)}`);
        return { d, viewBox: presets.VIEWBOX.slice() };
    }
    if (typeof p.d !== 'string' || !p.d.trim()) throw new SpecError(`${where}: una forma "path" necesita "preset" o "d" (trazado SVG)`);
    const viewBox = p.viewBox === undefined ? [100, 100] : p.viewBox;
    if (!Array.isArray(viewBox) || viewBox.length !== 2 || !viewBox.every(n => typeof n === 'number' && n > 0 && n <= 1e6)) {
        throw new SpecError(`${where}: "viewBox" debe ser [ancho, alto] del sistema de coordenadas de "d" (por defecto [100, 100])`);
    }
    return { d: p.d, viewBox };
}

/* ---------- Imágenes ---------- */

export function imageExtrasFrom(p, where) {
    const out = {};
    if (p.alt !== undefined) {
        if (typeof p.alt !== 'string') throw new SpecError(`${where}: "alt" debe ser un texto`);
        if (p.alt.length > style.MAX_ALT) throw new SpecError(`${where}: "alt" tiene ${p.alt.length} caracteres (máx. ${style.MAX_ALT})`);
        out.alt = p.alt;
    }
    if (p.borderWidth !== undefined) out.borderWidth = intValue(p.borderWidth, 0, 40, where, 'borderWidth');
    if (p.borderColor !== undefined) out.borderColor = colorValue(p.borderColor, where, 'borderColor', false);
    return out;
}

/* ---------- Tablas ---------- */

function rowsFrom(rows, where, ctx) {
    if (!Array.isArray(rows) || !rows.length) throw new SpecError(`${where}: "rows" debe ser una lista de filas, cada una una lista de celdas`);
    if (rows.length > table.MAX_ROWS) throw new SpecError(`${where}: ${rows.length} filas (máx. ${table.MAX_ROWS})`);
    const cols = Math.max(...rows.map(r => (Array.isArray(r) ? r.length : 0)));
    return rows.map((row, i) => {
        const w = `${where} · rows[${i}]`;
        if (!Array.isArray(row) || !row.length) throw new SpecError(`${w}: debe ser una lista de celdas`);
        if (row.length > table.MAX_COLS) throw new SpecError(`${w}: ${row.length} columnas (máx. ${table.MAX_COLS})`);
        if (row.length < cols) ctx.warnings.push(`${w}: tiene ${row.length} celdas y otras filas ${cols}; XiRo la rellena con celdas vacías`);
        return row.map((cell, j) => {
            if (typeof cell !== 'string' && typeof cell !== 'number') throw new SpecError(`${w}[${j}]: la celda debe ser un texto o un número`);
            const text = String(cell).replace(/\r\n?/g, '\n');
            if (text.length > table.MAX_CELL) throw new SpecError(`${w}[${j}]: ${text.length} caracteres (máx. ${table.MAX_CELL})`);
            return text;
        });
    });
}

/** Filas del spec: «rows» solas, o «columns» (cabeceras) + «rows» (el cuerpo), como el generador de IA de XiRo. */
function rowsSource(p, where) {
    if (p.columns === undefined) return p.rows;
    if (!Array.isArray(p.columns) || !p.columns.length) throw new SpecError(`${where}: "columns" debe ser la lista de cabeceras`);
    if (!Array.isArray(p.rows)) throw new SpecError(`${where}: con "columns" hace falta "rows": la lista de filas, sin la cabecera`);
    return [p.columns, ...p.rows];
}

/** Props de una tabla tal y como las da el spec (normalizeTableProps de XiRo pone el resto). */
export function tablePropsFrom(p, where, ctx) {
    const out = { rows: rowsFrom(rowsSource(p, where), where, ctx) };
    if (p.font !== undefined) out.font = enumValue(p.font, R.FONT_KEYS, where, 'font');
    if (p.size !== undefined) out.size = intValue(p.size, 8, 200, where, 'size');
    if (p.color !== undefined) out.color = colorValue(p.color, where, 'color', false);
    if (p.align !== undefined) out.align = enumValue(p.align, table.ALIGNS, where, 'align');
    if (p.header !== undefined) out.header = boolValue(p.header, where, 'header');
    for (const k of ['fill', 'bandFill', 'headerFill', 'borderColor']) if (p[k] !== undefined) out[k] = colorValue(p[k], where, k, true);
    if (p.borderWidth !== undefined) out.borderWidth = intValue(p.borderWidth, 0, 20, where, 'borderWidth');
    if (out.header !== false && p.headerFill === undefined) ctx.warnings.push(`${where}: sin "headerFill", XiRo pinta la cabecera de violeta #7c3aed (usa null si no la quieres)`);
    if (p.borderColor === undefined && out.borderWidth !== 0) ctx.warnings.push(`${where}: sin "borderColor", XiRo pone bordes blancos de ${out.borderWidth || 2} px`);
    return out;
}

/* ---------- Gráficos ---------- */

function chartSourceFrom(src, where) {
    if (!isObj(src)) throw new SpecError(`${where}: "source" debe ser { tableId: "el_…", seriesIn: "columns" | "rows" }`);
    const s = clean(src);
    unknownKeys(s, ['tableId', 'seriesIn'], `${where} · source`);
    if (typeof s.tableId !== 'string' || !R.ID_RE.test(s.tableId)) {
        throw new SpecError(`${where}: "source.tableId" debe ser el "id" (el_ + 4 a 16 letras minúsculas o cifras) de una tabla de esta diapositiva`);
    }
    const seriesIn = s.seriesIn === undefined ? 'columns' : enumValue(s.seriesIn, chart.SERIES_IN, where, 'source.seriesIn');
    return { tableId: s.tableId, seriesIn };
}

/** Props de un gráfico tal y como las da el spec (normalizeChartProps de XiRo pone el resto). */
export function chartPropsFrom(p, where) {
    const out = { source: chartSourceFrom(p.source, where) };
    out.kind = p.kind === undefined ? 'column' : enumValue(p.kind, chart.KINDS, where, 'kind');
    if (p.stacked !== undefined) {
        out.stacked = boolValue(p.stacked, where, 'stacked');
        if (out.stacked && chart.STACKABLE.indexOf(out.kind) < 0) throw new SpecError(`${where}: "stacked" solo vale en ${chart.STACKABLE.map(k => `"${k}"`).join(', ')}`);
    }
    if (p.seriesColors !== undefined) {
        if (!Array.isArray(p.seriesColors) || p.seriesColors.length > chart.MAX_SERIES) throw new SpecError(`${where}: "seriesColors" debe ser una lista de hasta ${chart.MAX_SERIES} colores (o null = automático)`);
        out.seriesColors = p.seriesColors.map(c => (c === null ? null : colorValue(c, where, 'seriesColors', false)));
    }
    for (const k of ['legend', 'values', 'grid']) if (p[k] !== undefined) out[k] = boolValue(p[k], where, k);
    if (p.font !== undefined) out.font = enumValue(p.font, R.FONT_KEYS, where, 'font');
    if (p.size !== undefined) out.size = intValue(p.size, 12, 120, where, 'size');
    if (p.color !== undefined) out.color = colorValue(p.color, where, 'color', false);
    if (p.alt !== undefined) {
        if (typeof p.alt !== 'string' || p.alt.length > chart.MAX_ALT) throw new SpecError(`${where}: "alt" debe ser un texto de hasta ${chart.MAX_ALT} caracteres`);
        out.alt = p.alt;
    }
    return out;
}

/* ---------- Fondo ---------- */

/** Degradado del fondo: del color del fondo a "to", con "angle" en grados (180 = de arriba abajo). */
export function gradientFrom(g, where) {
    if (!isObj(g)) throw new SpecError(`${where}: "gradient" debe ser { to: color, angle: 0–359 }`);
    const v = clean(g);
    unknownKeys(v, ['to', 'angle'], `${where} · gradient`);
    return { to: colorValue(v.to, where, 'gradient.to', false), angle: v.angle === undefined ? 180 : intValue(v.angle, 0, 359, where, 'gradient.angle') };
}
