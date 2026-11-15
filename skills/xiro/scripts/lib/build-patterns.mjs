/**
 * Atajos del spec que el generador expande antes de construir los elementos:
 *   - `layout` + `role`: un elemento con role y sin caja (x, y, w, h) se coloca en el hueco de su patrón maestro de XiRo
 *     (core/slide-canvas-layouts.js: SLOTS), con el tamaño, la alineación y el alineado vertical del hueco si no los
 *     pones. Las imágenes se ajustan al hueco respetando su proporción.
 *   - gráfico con `props.data` (categorías y series): crea la tabla de datos oculta y el vínculo.
 *   - altura automática de una tabla sin `h`.
 * Solo se expande lo que falta: lo que el spec escribe explícitamente no se toca.
 */

import { layouts } from './xiro.mjs';
import { SpecError, isObj, clean } from './spec-values.mjs';

const SLOT_OF = new WeakMap();
const CONTENT_ROLES = ['body', 'table', 'chart'];
const BOX_KEYS = ['x', 'y', 'w', 'h'];
const MAX_CATEGORIES = 24;
const MAX_SERIES = 8;
const MAX_TABLE_HEIGHT = 1000;

const hasBox = el => BOX_KEYS.some(k => el[k] !== undefined) || el.from !== undefined || el.to !== undefined;
const slotRole = role => (CONTENT_ROLES.indexOf(role) >= 0 ? 'body' : role);

/** Hueco que XiRo le dio a este elemento (para ajustar una imagen), o null. */
export const slotOf = el => SLOT_OF.get(el) || null;

/**
 * Coloca en los huecos del patrón los elementos con role y sin caja.
 * @param {Object[]} elements - Elementos del spec (se devuelven copias solo de los que cambian)
 * @param {string|null} layout - Patrón de la diapositiva
 * @param {string} where - «Diapositiva N», para los mensajes
 * @returns {Object[]}
 */
export function placeInSlots(elements, layout, where) {
    const slots = layout ? layouts.SLOTS[layout] : null;
    const used = {};
    return elements.map((input, j) => {
        if (!isObj(input) || !clean(input).role || hasBox(input)) return input;
        const at = `${where} · elemento ${j + 1} (${input.type}, role ${JSON.stringify(input.role)})`;
        if (!slots) throw new SpecError(`${at}: falta la posición (x, y, w, h). Pon la caja a mano o añade "layout" a la diapositiva para que XiRo use el hueco de su patrón`);
        const role = slotRole(input.role);
        const mine = slots.filter(s => s.role === role);
        const n = used[role] || 0;
        if (n >= mine.length) {
            throw new SpecError(`${at}: no queda hueco «${role}» en el patrón «${layout}» (huecos: ${slots.map(s => s.role).join(', ') || 'ninguno'}). Pon la caja a mano`);
        }
        used[role] = n + 1;
        const slot = mine[n];
        const copy = { ...input };
        if (input.type === 'image') SLOT_OF.set(copy, slot);
        else Object.assign(copy, { x: slot.x, y: slot.y, w: slot.w, h: slot.h });
        if (input.type === 'text' && slot.size) copy.props = { size: slot.size, align: slot.align, valign: slot.valign, ...(isObj(input.props) ? input.props : {}) };
        return copy;
    });
}

/** Caja de una imagen dentro de su hueco: lo más grande que cabe con su proporción, centrada. */
export function slotImageBox(slot, ratio) {
    const r = ratio > 0 ? ratio : slot.w / slot.h;
    const wide = r >= slot.w / slot.h;
    const w = Math.round(wide ? slot.w : slot.h * r);
    const h = Math.round(wide ? slot.w / r : slot.h);
    return { x: slot.x + Math.round((slot.w - w) / 2), y: slot.y + Math.round((slot.h - h) / 2), w, h, rotation: 0 };
}

/** Altura de una tabla sin h: cada fila ocupa lo de una línea de letra más el relleno de la celda. */
export function autoTableHeight(props) {
    return Math.min(MAX_TABLE_HEIGHT, props.rows.length * (Math.round(props.size * 1.2) + 32));
}

function dataError(where, message) {
    return new SpecError(`${where} · props.data: ${message}`);
}

function readData(data, where) {
    if (!isObj(data)) throw dataError(where, 'debe ser { categories: [...], series: [{ name, values: [...] }] }');
    const categories = Array.isArray(data.categories) ? data.categories : [];
    if (categories.length < 2 || categories.length > MAX_CATEGORIES) throw dataError(where, `hacen falta de 2 a ${MAX_CATEGORIES} categorías; recibidas ${categories.length}`);
    const series = Array.isArray(data.series) ? data.series : [];
    if (series.length < 1 || series.length > MAX_SERIES) throw dataError(where, `hacen falta de 1 a ${MAX_SERIES} series; recibidas ${series.length}`);
    series.forEach((serie, i) => {
        const values = isObj(serie) && Array.isArray(serie.values) ? serie.values : [];
        const name = isObj(serie) && typeof serie.name === 'string' ? serie.name : `serie ${i + 1}`;
        if (values.length > categories.length) throw dataError(where, `la serie «${name}» tiene ${values.length} valores y hay ${categories.length} categorías`);
        if (!values.some(v => typeof v === 'number' && Number.isFinite(v))) throw dataError(where, `la serie «${name}» no tiene ningún número (los valores deben ser números; usa null para un hueco)`);
    });
    return { categories, series };
}

/** Filas de la tabla de datos: nombres de serie arriba, categorías a la izquierda (series en columnas). */
function dataRows({ categories, series }) {
    const header = ['', ...series.map(serie => (typeof serie.name === 'string' ? serie.name : ''))];
    const body = categories.map((category, i) => [category, ...series.map(serie => (typeof serie.values[i] === 'number' ? serie.values[i] : ''))]);
    return [header, ...body];
}

function freeId(base, taken) {
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}${n}`;
    taken.add(id);
    return id;
}

/**
 * Cada gráfico con `props.data` pasa a ser una tabla de datos oculta (id fijo) y un gráfico vinculado a ella.
 * @param {Object[]} elements - Elementos del spec
 * @param {string} where - «Diapositiva N»
 * @returns {Object[]}
 */
export function expandChartData(elements, where) {
    const taken = new Set(elements.filter(isObj).map(el => el.id).filter(Boolean));
    return elements.flatMap((input, j) => {
        const props = isObj(input) && isObj(input.props) ? clean(input.props) : null;
        if (!input || input.type !== 'chart' || !props || props.data === undefined) return [input];
        const at = `${where} · elemento ${j + 1} (chart)`;
        if (props.source !== undefined) throw new SpecError(`${at}: usa "data" o "source", no los dos (con "data" la skill crea la tabla de datos y el vínculo)`);
        const data = readData(props.data, at);
        const tableId = freeId(`el_dat${j}`, taken);
        const { data: _omit, ...rest } = props;
        const table = {
            id: tableId,
            type: 'table',
            hidden: true,
            x: input.x,
            y: input.y,
            w: input.w,
            h: input.h,
            props: { rows: dataRows(data), size: 32, color: '#ffffff', header: true, headerFill: null, borderColor: null, borderWidth: 0 }
        };
        return [table, { ...input, props: { ...rest, source: { tableId, seriesIn: 'columns' } } }];
    });
}
