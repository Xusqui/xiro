'use strict';

/**
 * @fileoverview Estilos de las diapositivas libres que diseña la IA: fondo, superficie de tarjetas,
 * textos, acentos y tonos (positive, negative, neutral, accent) con el color de texto que va encima.
 * Contraste comprobado en __tests__/canvas-slides-themes.test.js: textos ≥ 4.5:1 y tonos ≥ 3:1 con su
 * texto (encima solo va letra grande y en negrita). 'claro' reproduce las figuras de charla (fig01).
 */

const THEMES = {
    claro: {
        bg: '#ffffff',
        surface: '#eef2f6',
        title: '#1f3a5f',
        text: '#1f3a5f',
        muted: '#5b6670',
        line: '#6c757d',
        accent: ['#1f3a5f', '#ffffff'],
        accent2: ['#d9614c', '#ffffff'],
        tones: { positive: ['#2a9d8f', '#ffffff'], negative: ['#d9614c', '#ffffff'], neutral: ['#6c757d', '#ffffff'] }
    },
    noche: {
        bg: '#1e1b2e',
        surface: '#2b2640',
        title: '#ffffff',
        text: '#ffffff',
        muted: '#b9b3d1',
        line: '#b9b3d1',
        accent: ['#8ab817', '#1e1b2e'],
        accent2: ['#f9b518', '#1e1b2e'],
        tones: { positive: ['#8ab817', '#1e1b2e'], negative: ['#e65453', '#ffffff'], neutral: ['#5a5476', '#ffffff'] }
    },
    ciruela: {
        bg: '#482045',
        surface: '#5f285b',
        title: '#ffffff',
        text: '#ffffff',
        muted: '#e4abde',
        line: '#e4abde',
        accent: ['#f9b518', '#482045'],
        accent2: ['#8ab817', '#172300'],
        tones: { positive: ['#8ab817', '#172300'], negative: ['#e65453', '#ffffff'], neutral: ['#8a3d85', '#ffffff'] }
    },
    oceano: {
        bg: '#082f49',
        surface: '#0c4a6e',
        title: '#ffffff',
        text: '#ffffff',
        muted: '#bae6fd',
        line: '#bae6fd',
        accent: ['#22d3ee', '#082f49'],
        accent2: ['#f9b518', '#082f49'],
        tones: { positive: ['#10b981', '#082f49'], negative: ['#f87171', '#082f49'], neutral: ['#155e75', '#ffffff'] }
    },
    jungla: {
        bg: '#172300',
        surface: '#283801',
        title: '#ffffff',
        text: '#ffffff',
        muted: '#c9e898',
        line: '#c9e898',
        accent: ['#8ab817', '#172300'],
        accent2: ['#f9b518', '#172300'],
        tones: { positive: ['#8ab817', '#172300'], negative: ['#e65453', '#ffffff'], neutral: ['#445e02', '#ffffff'] }
    },
    papel: {
        bg: '#fdf6e3',
        surface: '#f3e7cc',
        title: '#3b2f2f',
        text: '#3b2f2f',
        muted: '#6b5e57',
        line: '#6b5e57',
        accent: ['#b45309', '#ffffff'],
        accent2: ['#94438e', '#ffffff'],
        tones: { positive: ['#3f7d20', '#ffffff'], negative: ['#b42318', '#ffffff'], neutral: ['#6b5e57', '#ffffff'] }
    }
};

const THEME_NAMES = Object.keys(THEMES);
const DEFAULT_THEME = 'noche';
const TONES = ['accent', 'accent2', 'positive', 'negative', 'neutral'];

/** Tema por nombre; el de por defecto si no existe. */
function getTheme(name) {
    return THEMES[name] || THEMES[DEFAULT_THEME];
}

/**
 * Colores [relleno, texto] de un tono del tema. Sin tono válido, alterna los acentos según la posición
 * para que las tarjetas de una misma diapositiva no salgan todas iguales.
 * @param {Object} theme
 * @param {string|null} tone
 * @param {number} [index]
 * @returns {[string, string]}
 */
function toneColors(theme, tone, index = 0) {
    if (tone === 'accent' || tone === 'accent2') return theme[tone];
    if (tone && theme.tones[tone]) return theme.tones[tone];
    const cycle = [theme.accent, theme.accent2, theme.tones.positive, theme.tones.negative];
    return cycle[index % cycle.length];
}

module.exports = { THEMES, THEME_NAMES, DEFAULT_THEME, TONES, getTheme, toneColors };
