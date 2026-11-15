'use strict';

/**
 * @fileoverview Diseños de datos de las diapositivas que crea la IA: tabla (table) y gráfico (chart). El gráfico
 * va vinculado a una tabla de datos oculta de su mismo lienzo (la que se edita con «Editar datos»); los ids son
 * fijos y válidos para que el vínculo sobreviva a la importación. Misma firma que layouts-text.js:
 * (diapositiva saneada, contexto) → elementos.
 */

const { LEFT, WIDTH, header, footer } = require('./elements');
const { boxHeight } = require('./text-fit');

const TABLE_ID = 'el_data';
const CHART_ID = 'el_chart';
const MIN_TABLE_SIZE = 20;
const FEW_CATEGORIES = 6;
const HIDDEN_ROW_HEIGHT = 60;
const MAX_ALT = 300;

const sum = list => list.reduce((total, n) => total + n, 0);

/** Tamaño de letra de la tabla según su número de columnas. */
function sizeFor(columns) {
    if (columns <= 3) return 36;
    return columns === 4 ? 32 : 28;
}

/** Alto de cada fila: el de su celda con más líneas (text-fit descuenta 16 px por lado; la tabla, menos). */
function rowHeights(rows, size) {
    const w = Math.round(WIDTH / rows[0].length - size) + 32;
    return rows.map((row, i) => Math.max(...row.map(cell => boxHeight(cell || ' ', { size, bold: i === 0, w }))));
}

/** Tamaño de letra y alto con los que la tabla cabe en `room`; baja la letra hasta MIN_TABLE_SIZE. */
function fitTable(rows, room) {
    let size = sizeFor(rows[0].length);
    let heights = rowHeights(rows, size);
    while (size > MIN_TABLE_SIZE && sum(heights) > room) {
        size -= 4;
        heights = rowHeights(rows, size);
    }
    return { size, height: Math.min(room, sum(heights)) };
}

/** Elemento tabla con cabecera sobre el color de tarjeta del estilo; `extra` añade id y hidden. */
function tableElement(rows, { y, h, size, theme }, extra = {}) {
    return {
        ...extra,
        type: 'table',
        x: LEFT,
        y: Math.round(y),
        w: WIDTH,
        h: Math.round(h),
        rotation: 0,
        props: {
            rows,
            font: 'sans',
            size,
            color: theme.text,
            align: 'left',
            header: true,
            fill: null,
            bandFill: null,
            headerFill: theme.surface,
            borderColor: theme.muted,
            borderWidth: 1
        }
    };
}

/** Tabla de datos: título, la tabla con la primera fila como cabecera y la nota al pie. */
function table(slide, ctx) {
    const head = header(slide, ctx.theme);
    const foot = footer(slide, ctx.theme);
    const rows = [slide.columns, ...slide.rows];
    const fit = fitTable(rows, foot.limit - head.bottom);
    const data = tableElement(rows, { y: head.bottom, h: fit.height, size: fit.size, theme: ctx.theme }, { role: 'table' });
    return [...head.elements, data, ...foot.elements];
}

const cellValue = value => (value === null ? '' : String(value));

/** Filas de la tabla de datos: nombres de serie arriba, categorías a la izquierda (series en columnas). */
function dataRows(slide) {
    const names = ['', ...slide.series.map(serie => serie.name)];
    const body = slide.categories.map((category, i) => [category, ...slide.series.map(serie => cellValue(serie.values[i]))]);
    return [names, ...body];
}

/** Texto alternativo: cada serie con sus valores por categoría. */
function altText(slide) {
    const part = serie => {
        const values = slide.categories.map((category, i) => `${category} ${cellValue(serie.values[i]) || '–'}`);
        return (serie.name ? `${serie.name}: ` : '') + values.join(', ');
    };
    return slide.series.map(part).join('. ').slice(0, MAX_ALT);
}

function chartElement(slide, { y, h, theme }) {
    return {
        id: CHART_ID,
        type: 'chart',
        role: 'chart',
        x: LEFT,
        y: Math.round(y),
        w: WIDTH,
        h: Math.round(h),
        rotation: 0,
        props: {
            source: { tableId: TABLE_ID, seriesIn: 'columns' },
            kind: slide.kind,
            stacked: false,
            seriesColors: [],
            legend: true,
            values: slide.categories.length <= FEW_CATEGORIES,
            grid: true,
            font: 'sans',
            size: 32,
            color: theme.text,
            alt: altText(slide)
        }
    };
}

/** Gráfico: título, el gráfico y su tabla de datos oculta (vinculada por id), y la nota al pie. */
function chart(slide, ctx) {
    const head = header(slide, ctx.theme);
    const foot = footer(slide, ctx.theme);
    const room = foot.limit - head.bottom;
    const rows = dataRows(slide);
    const data = tableElement(
        rows,
        { y: head.bottom, h: Math.min(room, rows.length * HIDDEN_ROW_HEIGHT), size: 32, theme: ctx.theme },
        { id: TABLE_ID, hidden: true }
    );
    return [...head.elements, data, chartElement(slide, { y: head.bottom, h: room, theme: ctx.theme }), ...foot.elements];
}

module.exports = { table, chart };
