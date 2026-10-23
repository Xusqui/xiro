/**
 * @fileoverview Esquemas Joi de la biblioteca de diapositivas libres: guardar (nombre + lienzo) y renombrar.
 * El lienzo se valida con el mismo esquema que al guardar un juego personalizado.
 */
'use strict';

const Joi = require('joi');
const { canvasSchema } = require('./CanvasSlideValidator');

const MAX_NAME = 120;
const nameSchema = Joi.string().trim().min(1).max(MAX_NAME).required();

const createLibrarySlideSchema = Joi.object({
    name: nameSchema,
    slide_canvas: canvasSchema.required()
});

const renameLibrarySlideSchema = Joi.object({ name: nameSchema });

module.exports = { createLibrarySlideSchema, renameLibrarySlideSchema, MAX_NAME };
