'use strict';

/**
 * @fileoverview Saneado de los diseños de datos de la IA: tabla (table) y gráfico (chart). La tabla mantiene su
 * cabecera y filas rectangulares; el gráfico acepta números como texto y los redondea a 2 decimales (así «1.234»
 * nunca se lee como mil doscientos treinta y cuatro). Lo que no se puede dibujar se descarta con el diseño entero.
 */

const { KINDS } = require('../../public/js/core/slide-canvas-chart');

const MAX_COLUMNS = 6;
const MAX_ROWS = 8;
const MAX_CATEGORIES = 12;
const MAX_SERIES = 4;
const MAX_ABS_VALUE = 1e9;
const ROUND_KINDS = ['pie', 'doughnut'];
// Nombres que usan a veces los modelos para el mismo tipo de gráfico
const KIND_ALIASES = {
    columnas: 'column',
    columns: 'column',
    barras: 'bar',
    bars: 'bar',
    linea: 'line',
    línea: 'line',
    lineas: 'line',
    líneas: 'line',
    área: 'area',
    sectores: 'pie',
    tarta: 'pie',
    pastel: 'pie',
    circular: 'pie',
    anillo: 'doughnut',
    donut: 'doughnut'
};

const asArray = value => (Array.isArray(value) ? value : []);

/** Tipo de gráfico válido, por nombre o alias; 'column' si no se reconoce. */
function kindOf(value) {
    const name = String(value || '').trim().toLowerCase();
    return KINDS.includes(name) ? name : KIND_ALIASES[name] || 'column';
}

/** Número redondeado a 2 decimales (acepta texto con coma decimal); null si no es un número razonable. */
function amount(value) {
    let n = NaN;
    if (typeof value === 'number') n = value;
    else if (typeof value === 'string' && value.trim()) n = Number(value.trim().replace(',', '.'));
    return Number.isFinite(n) && Math.abs(n) <= MAX_ABS_VALUE ? Math.round(n * 100) / 100 : null;
}

/** Saneador de «table»: columnas de 2 a 6 y hasta 8 filas rectangulares; null si no queda nada que mostrar. */
function tableSanitizer({ str }) {
    return s => {
        const columns = asArray(s.columns).slice(0, MAX_COLUMNS).map(v => str(v, 40));
        const rows = asArray(s.rows)
            .filter(Array.isArray)
            .slice(0, MAX_ROWS)
            .map(row => columns.map((_, i) => str(row[i], 60)))
            .filter(row => row.some(Boolean));
        return columns.length >= 2 && columns.some(Boolean) && rows.length ? { columns, rows } : null;
    };
}

/** Series con un valor por categoría (huecos = null); se descartan las que no traen ningún número. */
function seriesOf(raw, categories, { str, obj }) {
    return raw
        .slice(0, MAX_SERIES * 2)
        .map(entry => {
            const values = asArray(obj(entry).values);
            return { name: str(obj(entry).name, 40), values: categories.map((_, i) => amount(values[i])) };
        })
        .filter(serie => serie.values.some(v => v !== null));
}

/** Saneador de «chart»: de 2 a 12 categorías y de 1 a 4 series (una sola en sectores y anillo). */
function chartSanitizer(helpers) {
    return s => {
        const categories = asArray(s.categories).slice(0, MAX_CATEGORIES).map(v => helpers.str(v, 30));
        if (categories.length < 2 || categories.some(name => !name)) return null;
        const kind = kindOf(s.kind);
        // Una lista suelta «values» vale como serie única
        const raw = Array.isArray(s.series) ? s.series : [{ name: s.label, values: s.values }];
        const series = seriesOf(raw, categories, helpers).slice(0, ROUND_KINDS.includes(kind) ? 1 : MAX_SERIES);
        return series.length ? { kind, categories, series } : null;
    };
}

/**
 * Saneadores de los diseños de datos.
 * @param {{str: Function, obj: Function}} helpers - Utilidades de spec.js (texto limpio y objeto seguro)
 * @returns {{table: Function, chart: Function}}
 */
function dataSanitizers(helpers) {
    return { table: tableSanitizer(helpers), chart: chartSanitizer(helpers) };
}

module.exports = { dataSanitizers };
