/**
 * @fileoverview Esquemas Joi de los temas de las diapositivas libres: el tema (los mismos límites que
 * normalizeTheme de core/slide-canvas-theme.js, pero aquí se rechaza en vez de corregir), guardar un tema propio
 * (nombre + tema) y renombrarlo. themeSchema también valida custom_games.slide_theme (validation/banks-games.js).
 */
'use strict';

const Joi = require('joi');
const { FONTS } = require('../../public/js/core/slide-canvas-model');

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const THEME_ID_RE = /^[a-z0-9_-]{2,40}$/;
const MAX_THEME_NAME = 40;
const MAX_NAME = 120;

const color = Joi.string().pattern(COLOR_RE).required();
const fontKey = Joi.string()
    .valid(...Object.keys(FONTS))
    .required();

const themeSchema = Joi.object({
    id: Joi.string().pattern(THEME_ID_RE).required(),
    name: Joi.string().trim().min(1).max(MAX_THEME_NAME).required(),
    palette: Joi.object({
        bg: color,
        text: color,
        muted: color,
        accents: Joi.array().items(Joi.string().pattern(COLOR_RE)).length(6).required()
    })
        .unknown(false)
        .required(),
    fonts: Joi.object({ title: fontKey, body: fontKey }).unknown(false).required(),
    gradient: Joi.object({
        to: color,
        angle: Joi.number().integer().min(0).max(359).required()
    }).unknown(false)
}).unknown(false);

const nameSchema = Joi.string().trim().min(1).max(MAX_NAME).required();

const createThemeSchema = Joi.object({ name: nameSchema, theme: themeSchema.required() });

const renameThemeSchema = Joi.object({ name: nameSchema });

module.exports = { themeSchema, createThemeSchema, renameThemeSchema };
