/**
 * @fileoverview Esquema Joi del sobre de un paquete .xiroslide (diapositivas libres que viajan entre
 * instalaciones de XiRo). Cada lienzo se valida después con canvasSchema, cuando las referencias
 * asset:<id> ya son URLs de /uploads/ (services/slide-package/import.service.js).
 */
'use strict';

const Joi = require('joi');
const { FORMAT, ASSET_ID_RE, IMAGE_MIMES, MAX_SLIDES, MAX_ASSETS } = require('../../public/js/core/slide-package');

// Base64 estándar sin saltos de línea; el tamaño de cada imagen se comprueba al decodificarla
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

const assetSchema = Joi.object({
    id: Joi.string().pattern(ASSET_ID_RE).required(),
    mime: Joi.string()
        .valid(...IMAGE_MIMES)
        .required(),
    name: Joi.string().max(255).allow(''),
    data: Joi.string().pattern(BASE64_RE).required()
}).unknown(true);

const slideSchema = Joi.object({
    slide_type: Joi.string().valid('canvas').required(),
    slide_canvas: Joi.object().required()
}).unknown(true);

const packageSchema = Joi.object({
    format: Joi.string().valid(FORMAT).required(),
    formatVersion: Joi.number().integer().min(1).required(),
    generator: Joi.object().unknown(true),
    exportedAt: Joi.string().max(64),
    slides: Joi.array().items(slideSchema).min(1).max(MAX_SLIDES).required(),
    assets: Joi.array().items(assetSchema).max(MAX_ASSETS).unique('id').default([])
}).unknown(true);

/**
 * Valida el sobre de un paquete ya parseado.
 * @param {Object} data - Paquete leído del fichero
 * @returns {{ value: Object|null, error: string|null }}
 */
function validatePackage(data) {
    const { value, error } = packageSchema.validate(data, { abortEarly: true });
    return error ? { value: null, error: error.message } : { value, error: null };
}

module.exports = { packageSchema, validatePackage };
