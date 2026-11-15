/**
 * @fileoverview Esquema Joi de las props de un gráfico de la diapositiva libre (fase E). Acepta solo
 * lo que escribe normalizeChartProps (core/slide-canvas-chart.js). El vínculo con su tabla
 * (source.tableId) se comprueba a nivel de lienzo en CanvasSlideValidator.js (hasBadChartSource).
 */

'use strict';

const Joi = require('joi');
const { FONTS } = require('../../public/js/core/slide-canvas-model');
const { KINDS, STACKABLE, SERIES_IN, MAX_SERIES, MAX_ALT } = require('../../public/js/core/slide-canvas-chart');

const COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const ID_RE = /^el_[a-z0-9]{4,16}$/;

const chartPropsSchema = Joi.object({
    source: Joi.object({
        tableId: Joi.string().pattern(ID_RE).allow('').required(),
        seriesIn: Joi.string()
            .valid(...SERIES_IN)
            .required()
    })
        .unknown(false)
        .required(),
    kind: Joi.string().valid(...KINDS),
    // Solo columnas, barras y área se apilan (normalizeChartProps lo pone a false en las demás)
    stacked: Joi.when('kind', {
        is: Joi.valid(...STACKABLE),
        then: Joi.boolean(),
        otherwise: Joi.boolean().valid(false)
    }),
    seriesColors: Joi.array().items(Joi.string().pattern(COLOR_RE).allow(null)).max(MAX_SERIES),
    legend: Joi.boolean(),
    values: Joi.boolean(),
    grid: Joi.boolean(),
    font: Joi.string().valid(...Object.keys(FONTS)),
    size: Joi.number().integer().min(12).max(120),
    color: Joi.string().pattern(COLOR_RE),
    alt: Joi.string().max(MAX_ALT).allow('')
}).unknown(false);

/**
 * ¿Hay algún gráfico cuyo vínculo no apunta a una tabla del mismo lienzo?
 * @param {Array<Object>} elements - Elementos del lienzo.
 * @returns {boolean}
 */
function hasBadChartSource(elements) {
    const tables = new Set(elements.filter(el => el && el.type === 'table').map(el => el.id));
    return elements.some(el => {
        const tableId = el && el.type === 'chart' && el.props && el.props.source ? el.props.source.tableId : '';
        return Boolean(tableId) && !tables.has(tableId);
    });
}

module.exports = { chartPropsSchema, hasBadChartSource };
