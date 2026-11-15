/**
 * @fileoverview Catálogo de los 10 temas de serie de las diapositivas libres (fase F). Cada tema tiene su
 * carácter (fondo claro u oscuro, par de fuentes propio) y cumple el contraste: texto y apagado 4.5:1 sobre el
 * fondo y cada acento 3:1. Los 6 acentos van en el orden que más separa los contiguos para daltonismo
 * (validado con el script de la skill dataviz): el primero es el acento principal y los demás, los colores de
 * serie de los gráficos. Peor caso: oceano, 7.7 de separación (vale con la leyenda y los huecos del gráfico).
 * Expone window.XiroSlideCanvasThemeCatalog y module.exports.
 */
(function (root) {
    'use strict';

    const THEMES = [
        {
            id: 'noche',
            name: 'Noche',
            palette: {
                bg: '#1e1b2e',
                text: '#ffffff',
                muted: '#b9b3d1',
                accents: ['#8ab817', '#3987e5', '#e65453', '#9085e9', '#f9b518', '#199e70']
            },
            fonts: { title: 'sans', body: 'sans' }
        },
        {
            id: 'claro',
            name: 'Claro',
            palette: {
                bg: '#ffffff',
                text: '#1f3a5f',
                muted: '#5b6670',
                accents: ['#1f3a5f', '#d9614c', '#2a9d8f', '#b7791f', '#6c5ce7', '#6c757d']
            },
            fonts: { title: 'serif', body: 'sans' }
        },
        {
            id: 'ciruela',
            name: 'Ciruela',
            palette: {
                bg: '#482045',
                text: '#ffffff',
                muted: '#e4abde',
                accents: ['#f9b518', '#22d3ee', '#e65453', '#b7a6ff', '#8ab817', '#e4abde']
            },
            fonts: { title: 'rounded', body: 'rounded' }
        },
        {
            id: 'oceano',
            name: 'Océano',
            palette: {
                bg: '#082f49',
                text: '#ffffff',
                muted: '#bae6fd',
                accents: ['#22d3ee', '#f9b518', '#10b981', '#fb923c', '#a78bfa', '#f87171']
            },
            fonts: { title: 'condensed', body: 'sans' }
        },
        {
            id: 'jungla',
            name: 'Jungla',
            palette: {
                bg: '#172300',
                text: '#ffffff',
                muted: '#c9e898',
                accents: ['#8ab817', '#22d3ee', '#f9b518', '#e65453', '#c9e898', '#fb923c']
            },
            fonts: { title: 'rounded', body: 'sans' }
        },
        {
            id: 'papel',
            name: 'Papel',
            palette: {
                bg: '#eceff1',
                text: '#14181c',
                muted: '#4a545c',
                accents: ['#b3261e', '#1d3557', '#2e7d32', '#6a1b9a', '#b45309', '#4a545c']
            },
            fonts: { title: 'elegant', body: 'serif' }
        },
        {
            id: 'grafito',
            name: 'Grafito',
            palette: {
                bg: '#17191c',
                text: '#f2f3f4',
                muted: '#a9b0b7',
                accents: ['#e8b04a', '#c58fbf', '#b9c76a', '#8fa7d6', '#e07a5f', '#6fb3a8']
            },
            fonts: { title: 'display', body: 'sans' }
        },
        {
            id: 'menta',
            name: 'Menta',
            palette: {
                bg: '#eaf6f2',
                text: '#0f3d3a',
                muted: '#3f6b66',
                accents: ['#0f766e', '#c2410c', '#7e22ce', '#a16207', '#1d4ed8', '#be185d']
            },
            fonts: { title: 'sans', body: 'rounded' }
        },
        {
            id: 'escuela',
            name: 'Escuela',
            palette: {
                bg: '#1f3a32',
                text: '#f4f1e8',
                muted: '#b7cbbf',
                accents: ['#f2c94c', '#7fc8e8', '#ffffff', '#f08a7a', '#c9e46f', '#d7b8f3']
            },
            fonts: { title: 'hand', body: 'rounded' }
        },
        {
            id: 'solar',
            name: 'Solar',
            palette: {
                bg: '#ffd23f',
                text: '#111111',
                muted: '#3a3300',
                accents: ['#111111', '#c2185b', '#0b5fa5', '#7a3e00', '#6a2ca0', '#1b7f3b']
            },
            fonts: { title: 'condensed', body: 'rounded' }
        }
    ];

    const api = { THEMES: THEMES };

    root.XiroSlideCanvasThemeCatalog = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
