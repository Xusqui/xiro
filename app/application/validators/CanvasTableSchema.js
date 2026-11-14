/**
 * @fileoverview Esquema Joi de las props de una tabla de la diapositiva libre (fase D).
 * Acepta solo lo que escribe normalizeTableProps (core/slide-canvas-table.js): filas
 * rectangulares de texto plano dentro de los límites y estilos acotados. Lo usa
 * CanvasSlideValidator.js en la rama del tipo 'table'.
 */

'use strict';

const Joi = require('joi');
const { FONTS } = require('../../public/js/core/slide-canvas-model');
const { MAX_ROWS, MAX_COLS, MAX_CELL, ALIGNS } = require('../../public/js/core/slide-canvas-table');

const COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

/**
 * Todas las filas deben tener el mismo número de columnas (normalizeCanvas las rellena).
 * @param {Array<Array<string>>} rows - Filas de la tabla
 * @param {Object} helpers - Helpers de Joi
 * @returns {Array<Array<string>>|Error} - Filas si son rectangulares, error si no
 */
const checkRectangular = (rows, helpers) =>
    rows.every(row => row.length === rows[0].length) ? rows : helpers.error('canvasSlide.raggedTable');

const nullableColor = Joi.string().pattern(COLOR_RE).allow(null);

const tablePropsSchema = Joi.object({
    rows: Joi.array()
        .items(Joi.array().items(Joi.string().max(MAX_CELL).allow('')).min(1).max(MAX_COLS))
        .min(1)
        .max(MAX_ROWS)
        .required()
        .custom(checkRectangular),
    font: Joi.string().valid(...Object.keys(FONTS)),
    size: Joi.number().integer().min(8).max(200),
    color: Joi.string().pattern(COLOR_RE),
    align: Joi.string().valid(...ALIGNS),
    header: Joi.boolean(),
    fill: nullableColor,
    bandFill: nullableColor,
    headerFill: nullableColor,
    borderColor: nullableColor,
    borderWidth: Joi.number().integer().min(0).max(20)
})
    .unknown(false)
    .messages({ 'canvasSlide.raggedTable': 'Todas las filas de la tabla deben tener las mismas columnas' });

module.exports = { tablePropsSchema };
