'use strict';

/**
 * @fileoverview Diseños en rejilla de las diapositivas que crea la IA: tarjetas (cards), pasos numerados
 * (steps) y comparación de dos columnas (comparison). Misma firma que layouts-text.js:
 * (diapositiva saneada, contexto) → elementos.
 */

const { text, shape, segment, iconCircle, header, footer } = require('./elements');
const { boxHeight, fitSize, fitBalanced, balance } = require('./text-fit');
const { toneColors } = require('./themes');

// Ancho de los puntos de la comparación: deja sitio al distintivo «VS» del centro
const COLUMN_ITEM_W = 852 - 160;

/** Número grande centrado en un círculo (la caja de texto es mayor que el círculo para que quepa). */
function numberCircle({ cx, cy, d, label, colors, size }) {
    const box = { x: cx - d / 2 - 24, y: cy - d / 2 - 24, w: d + 48, h: d + 48 };
    return [
        shape('ellipse', { x: cx - d / 2, y: cy - d / 2, w: d, h: d }, { fill: colors[0] }),
        text(box, label, { font: 'display', size: size || Math.round(d * 0.62), color: colors[1], align: 'center', valign: 'middle' })
    ];
}

/** Títulos de una fila con el mismo tamaño, equilibrados, y el alto de la caja más alta. */
function rowTitles(titles, { w, max, min }) {
    const size = Math.min(...titles.map(v => fitSize(v, { bold: true, w, max, min, maxLines: 2 })));
    const values = titles.map(v => balance(v, { bold: true, size, w }));
    return { size, values, h: Math.max(...values.map(v => boxHeight(v, { bold: true, size, w }))) };
}

/** Título y texto de una tarjeta a partir de y, hasta bottom. */
function cardText(card, { x, y, w, bottom, theme }) {
    const title = fitBalanced(card.title, { bold: true, w, max: 44, min: 30, maxLines: 2 });
    const titleH = boxHeight(title.text, { bold: true, size: title.size, w });
    const els = [text({ x, y, w, h: titleH }, title.text, { size: title.size, bold: true, color: theme.title })];
    if (card.text) {
        const h = Math.max(60, bottom - (y + titleH - 8));
        const body = fitBalanced(card.text, { w, h, max: 34, min: 26 });
        els.push(text({ x, y: y + titleH - 8, w, h }, body.text, { size: body.size, color: theme.muted }));
    }
    return els;
}

function iconOrNumber(ctx, { cx, cy, d, card, index, colors }) {
    if (card.icon) return iconCircle(ctx, { cx, cy, d, icon: card.icon, colors });
    return numberCircle({ cx, cy, d, label: String(index + 1), colors });
}

/** Una tarjeta: rejilla de 2x2 con icono a la izquierda, o columna con icono (o barra de color) arriba. */
function card(ctx, { item, index, box, grid }) {
    const t = ctx.theme;
    const { x, y, w, h } = box;
    const colors = toneColors(t, item.tone, index);
    const els = [shape('rect', box, { fill: t.surface, radius: 32 })];
    if (grid) {
        els.push(...iconOrNumber(ctx, { cx: x + 108, cy: y + h / 2, d: 120, card: item, index, colors }));
        return [...els, ...cardText(item, { x: x + 192, y: y + 40, w: w - 224, bottom: y + h - 24, theme: t })];
    }
    let ty = y + 40;
    if (item.icon) {
        els.push(...iconCircle(ctx, { cx: x + 110, cy: ty + 70, d: 140, icon: item.icon, colors }));
        ty += 180;
    } else {
        els.push(shape('rect', { x: x + 40, y: ty, w: 120, h: 20 }, { fill: colors[0], radius: 10 }));
        ty += 48;
    }
    return [...els, ...cardText(item, { x: x + 24, y: ty, w: w - 48, bottom: y + h - 24, theme: t })];
}

/** Alto que necesita una tarjeta en columna (icono o barra, título y texto) con ese ancho. */
function cardHeight(item, w) {
    const inner = w - 48;
    const title = fitBalanced(item.title, { bold: true, w: inner, max: 44, min: 30, maxLines: 2 });
    let h = 40 + (item.icon ? 180 : 48) + boxHeight(title.text, { bold: true, size: title.size, w: inner }) + 32;
    if (item.text) h += boxHeight(balance(item.text, { size: 34, w: inner }), { size: 34, w: inner }) - 8;
    return h;
}

/** De 2 a 4 tarjetas con icono (o barra de color), título y texto. Con 4, rejilla de 2x2. */
function cards(slide, ctx) {
    const t = ctx.theme;
    const head = header(slide, t);
    const foot = footer(slide, t);
    const room = foot.limit - head.bottom;
    const n = slide.cards.length;
    const grid = n === 4;
    const perRow = grid ? 2 : n;
    const gap = 32;
    const w = (1728 - gap * (perRow - 1)) / perRow;
    const fitted = Math.max(380, ...slide.cards.map(item => cardHeight(item, w)));
    const h = grid ? Math.min(320, (room - gap) / 2) : Math.min(fitted, room);
    const top = head.bottom + (room - (grid ? h * 2 + gap : h)) / 2;
    const els = [...head.elements];
    slide.cards.forEach((item, index) => {
        const box = { x: 96 + (index % perRow) * (w + gap), y: top + Math.floor(index / perRow) * (h + gap), w, h };
        els.push(...card(ctx, { item, index, box, grid }));
    });
    return [...els, ...foot.elements];
}

/** De 2 a 5 pasos en fila: círculo numerado unido por una línea, título y texto centrados. */
function steps(slide, ctx) {
    const t = ctx.theme;
    const head = header(slide, t);
    const foot = footer(slide, t);
    const n = slide.steps.length;
    const gap = 32;
    const w = (1728 - gap * (n - 1)) / n;
    const titles = rowTitles(slide.steps.map(s => s.title), { w, max: 44, min: 28 });
    const room = foot.limit - head.bottom;
    const textNeed = Math.max(0, ...slide.steps.map(s => (s.text ? boxHeight(balance(s.text, { size: 34, w }), { size: 34, w }) : 0)));
    const textH = Math.max(80, Math.min(room - 120 - 32 - titles.h, textNeed + 16));
    const top = head.bottom + Math.max(0, (room - (120 + 32 + titles.h + textH)) / 2);
    const cy = top + 60;
    const centers = slide.steps.map((_, i) => 96 + i * (w + gap) + w / 2);
    const els = [...head.elements, segment('line', [centers[0], cy], [centers[n - 1], cy], { color: t.line + '88', width: 6 })];
    slide.steps.forEach((step, i) => {
        const x = centers[i] - w / 2;
        els.push(...numberCircle({ cx: centers[i], cy, d: 120, label: String(i + 1), colors: t.accent }));
        els.push(text({ x, y: cy + 92, w, h: titles.h }, titles.values[i], { size: titles.size, bold: true, color: t.title, align: 'center' }));
        if (step.text) {
            const body = fitBalanced(step.text, { w, h: textH, max: 34, min: 24 });
            els.push(text({ x, y: cy + 84 + titles.h, w, h: textH }, body.text, { size: body.size, color: t.muted, align: 'center' }));
        }
    });
    return [...els, ...foot.elements];
}

/** Puntos de una columna de la comparación, equilibrados y con su alto, para un tamaño. */
function columnRows(col, size) {
    return col.items.map(item => {
        const value = balance(item, { size, w: COLUMN_ITEM_W, eager: false });
        return { value, h: boxHeight(value, { size, w: COLUMN_ITEM_W }) };
    });
}

/** Mayor tamaño (38 a 28) con el que los puntos de las dos columnas caben en `room`. */
function comparisonSize(columns, room) {
    const used = s => Math.max(...columns.map(col => columnRows(col, s).reduce((sum, r) => sum + r.h + 12, 0)));
    let size = 42;
    while (size > 28 && used(size) > room) size -= 2;
    return { size, used: used(size) };
}

/** Columna de la comparación: panel, barra de título con su tono y lista de puntos. */
function comparisonColumn(col, { x, top, h, size, colors, theme }) {
    const w = 852;
    const els = [
        shape('rect', { x, y: top, w, h }, { fill: theme.surface, radius: 28 }),
        shape('rect', { x, y: top, w, h: 120 }, { fill: colors[0], radius: 28 }),
        shape('rect', { x, y: top + 60, w, h: 60 }, { fill: colors[0] })
    ];
    const titleSize = fitSize(col.title, { bold: true, w: w - 64, max: 48, min: 32, maxLines: 1 });
    els.push(text({ x: x + 32, y: top, w: w - 64, h: 120 }, col.title, { size: titleSize, bold: true, color: colors[1], align: 'center', valign: 'middle' }));
    let y = top + 144;
    columnRows(col, size).forEach(row => {
        els.push(shape('ellipse', { x: x + 48, y: y + 16 + size * 0.6 - 10, w: 20, h: 20 }, { fill: colors[0] }));
        els.push(text({ x: x + 80, y, w: COLUMN_ITEM_W, h: row.h }, row.value, { size, color: theme.text }));
        y += row.h + 12;
    });
    return els;
}

/** Dos columnas enfrentadas con un distintivo «VS» en medio. */
function comparison(slide, ctx) {
    const t = ctx.theme;
    const head = header(slide, t);
    const foot = footer(slide, t);
    const room = foot.limit - head.bottom;
    const { size, used } = comparisonSize([slide.left, slide.right], room - 120 - 56);
    const h = Math.min(room, Math.max(360, 120 + 24 + used + 32));
    const top = head.bottom + (room - h) / 2;
    const left = comparisonColumn(slide.left, { x: 96, top, h, size, colors: toneColors(t, slide.left.tone, 0), theme: t });
    const right = comparisonColumn(slide.right, { x: 972, top, h, size, colors: toneColors(t, slide.right.tone, 1), theme: t });
    const vs = numberCircle({ cx: 960, cy: top + h / 2, d: 96, label: 'VS', colors: [t.title, t.bg], size: 48 });
    return [...head.elements, ...left, ...right, ...vs, ...foot.elements];
}

module.exports = { cards, steps, comparison, rowTitles };
