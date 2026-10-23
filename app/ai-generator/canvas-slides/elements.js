'use strict';

/**
 * @fileoverview Piezas del lienzo para los diseños de la IA (texto, rect, elipse, línea, flecha, imagen)
 * con todas las props explícitas, y la cabecera y la nota al pie comunes. Coordenadas del lienzo lógico
 * de 1920x1080 (public/js/core/slide-canvas-model.js).
 */

const { boxHeight, fitSize, textWidth } = require('./text-fit');

const LEFT = 80; // cajas de texto: la letra empieza en x = 96 (relleno de 16)
const WIDTH = 1760;
const NOTE_Y = 1006;

/**
 * Caja de texto.
 * @param {{x: number, y: number, w: number, h: number}} box
 * @param {string} value - Texto (\n = salto de línea)
 * @param {Object} style - size, color y opcionales font, bold, italic, align, valign, fill
 */
function text(box, value, style) {
    return {
        type: 'text',
        ...roundBox(box),
        props: {
            text: value,
            font: style.font || 'sans',
            size: Math.round(style.size),
            bold: Boolean(style.bold),
            italic: Boolean(style.italic),
            color: style.color,
            align: style.align || 'left',
            valign: style.valign || 'top',
            fill: style.fill || null,
            fit: 'shrink'
        }
    };
}

function roundBox(box) {
    return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h), rotation: 0 };
}

/** Rectángulo (radius en px) o elipse; stroke null = sin borde. */
function shape(kind, box, { fill = null, stroke = null, strokeWidth = 0, radius = 0 } = {}) {
    return {
        type: 'shape',
        ...roundBox(box),
        props: { shape: kind, fill, stroke, strokeWidth: stroke ? strokeWidth : 0, radius: kind === 'rect' ? radius : 0 }
    };
}

/** Línea o flecha de `from` a `to` (la punta de la flecha queda en `to`). */
function segment(kind, from, to, { color, width = 6 }) {
    const len = Math.max(20, Math.round(Math.hypot(to[0] - from[0], to[1] - from[1])));
    const head = kind === 'arrow' ? Math.min(len / 2, Math.max(width * 3, 24)) : 0;
    const h = Math.max(40, Math.ceil(head * 1.2), width);
    const angle = Math.round((Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI);
    return {
        type: 'shape',
        x: Math.round((from[0] + to[0]) / 2 - len / 2),
        y: Math.round((from[1] + to[1]) / 2 - h / 2),
        w: len,
        h,
        rotation: angle === -180 ? 180 : angle,
        props: { shape: kind, fill: null, stroke: color, strokeWidth: width, radius: 0 }
    };
}

/** Imagen (ref asset:aN del paquete) que llena la caja. */
function image(box, ref, { fit = 'contain', ratio = 1 } = {}) {
    return { type: 'image', ...roundBox(box), props: { src: ref, ratio, lockRatio: true, fit, radius: 0 } };
}

/** Icono centrado en un círculo de color; sin icono, solo el círculo. */
function iconCircle(ctx, { cx, cy, d, icon, colors }) {
    const list = [shape('ellipse', { x: cx - d / 2, y: cy - d / 2, w: d, h: d }, { fill: colors[0] })];
    const ref = icon ? ctx.icon(icon, colors[1]) : null;
    if (ref) list.push(image({ x: cx - d * 0.3, y: cy - d * 0.3, w: d * 0.6, h: d * 0.6 }, ref));
    return list;
}

/**
 * Título y subtítulo arriba a la izquierda. Devuelve los elementos y dónde empieza el contenido.
 * @returns {{elements: Object[], bottom: number}}
 */
function header(slide, theme) {
    const elements = [];
    let y = 40;
    if (slide.title) {
        const size = fitSize(slide.title, { bold: true, w: WIDTH, max: 72, min: 52, maxLines: 2 });
        const h = boxHeight(slide.title, { bold: true, size, w: WIDTH });
        elements.push(text({ x: LEFT, y, w: WIDTH, h }, slide.title, { size, bold: true, color: theme.title }));
        y += h - 24;
    }
    if (slide.subtitle) {
        const size = fitSize(slide.subtitle, { w: WIDTH, max: 40, min: 32, maxLines: 2 });
        const h = boxHeight(slide.subtitle, { size, w: WIDTH });
        elements.push(text({ x: LEFT, y, w: WIDTH, h }, slide.subtitle, { size, color: theme.muted }));
        y += h;
    }
    return { elements, bottom: y + (slide.title || slide.subtitle ? 40 : 0) };
}

/**
 * Posiciones y de unos bloques apilados y centrados en vertical entre top y bottom.
 * @param {Array<{h: number, gap?: number}>} blocks - gap: separación con el bloque anterior (puede ser negativa)
 * @returns {number[]}
 */
function stackCentered(blocks, { top, bottom }) {
    const total = blocks.reduce((sum, b, i) => sum + b.h + (i ? b.gap || 0 : 0), 0);
    let y = Math.max(top, top + (bottom - top - total) / 2);
    return blocks.map((b, i) => {
        if (i) y += b.gap || 0;
        const at = y;
        y += b.h;
        return at;
    });
}

/** Píldora centrada en cx con el texto en mayúsculas (etiquetas, fechas, avisos). */
function pill(label, { cx, y, colors }) {
    const value = label.toUpperCase();
    const w = Math.min(1400, Math.max(320, textWidth(value, { font: 'condensed', bold: true, size: 40 }) + 120));
    const box = { x: cx - w / 2, y, w, h: 88 };
    return [
        shape('rect', box, { fill: colors[0], radius: 44 }),
        text(box, value, { font: 'condensed', size: 40, bold: true, color: colors[1], align: 'center', valign: 'middle' })
    ];
}

/** Nota al pie (fuentes, aclaraciones) y límite inferior del contenido. */
function footer(slide, theme) {
    if (!slide.note) return { elements: [], limit: 1000 };
    return {
        elements: [
            text({ x: LEFT, y: NOTE_Y, w: WIDTH, h: 68 }, slide.note, {
                size: fitSize(slide.note, { w: WIDTH, max: 28, min: 22, maxLines: 1 }),
                color: theme.muted
            })
        ],
        limit: 976
    };
}

module.exports = { LEFT, WIDTH, text, shape, segment, image, iconCircle, header, footer, stackCentered, pill };
