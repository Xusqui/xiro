'use strict';

/**
 * @fileoverview Diseños de texto de las diapositivas que crea la IA: portada (cover), mensaje centrado
 * (statement), texto, lista (bullets), cita (quote) y cifra destacada (stat). Cada función recibe la
 * diapositiva ya saneada (spec.js) y el contexto { theme, icon(nombre, color), asset(svg), photo(imagen) } y devuelve
 * los elementos del lienzo de 1920x1080. Los textos se equilibran (text-fit.js) antes de medir su caja.
 */

const { LEFT, WIDTH, text, shape, image, iconCircle, header, footer, stackCentered, pill } = require('./elements');
const { boxHeight, fitBalanced, balance } = require('./text-fit');
const { donutSvg } = require('./icons');
const { coverPhoto } = require('./layouts-media');

/** Titular grande: en Bebas Neue (mayúsculas) si es corto; si no, DM Sans en negrita. */
function headline(value, { w, short, display, sans }) {
    const big = value.length <= short;
    const font = big ? 'display' : 'sans';
    const fit = fitBalanced(big ? value.toUpperCase() : value, big ? { font, w, ...display } : { bold: true, w, ...sans });
    return { ...fit, font, bold: !big, big, h: boxHeight(fit.text, { font, bold: !big, size: fit.size, w }) };
}

/** Portada: antetítulo, título grande, subtítulo y etiqueta; a la derecha, una foto o un icono en un círculo. */
function cover(slide, ctx) {
    const t = ctx.theme;
    const w = slide.image ? 960 : slide.icon ? 1100 : WIDTH;
    const title = headline(slide.title, { w, short: 40, display: { max: 184, min: 110, maxLines: 2 }, sans: { max: 96, min: 64, maxLines: 3 } });
    const sub = slide.subtitle ? fitBalanced(slide.subtitle, { w, max: 48, min: 36, maxLines: 3 }) : null;
    const blocks = [];
    if (slide.kicker) blocks.push({ key: 'kicker', h: 80 });
    blocks.push({ key: 'title', h: title.h, gap: -16 });
    if (sub) blocks.push({ key: 'subtitle', h: boxHeight(sub.text, { size: sub.size, w }), gap: title.big ? -40 : -8 });
    if (slide.tag) blocks.push({ key: 'tag', h: 88, gap: 32 });
    const ys = stackCentered(blocks, { top: 80, bottom: 1000 });
    const els = [];
    if (slide.image) els.push(...coverPhoto(ctx, slide.image));
    else if (slide.icon) {
        els.push(shape('ellipse', { x: 1236, y: 240, w: 600, h: 600 }, { stroke: t.line + '55', strokeWidth: 4 }));
        els.push(...iconCircle(ctx, { cx: 1536, cy: 540, d: 500, icon: slide.icon, colors: t.accent2 }));
    }
    blocks.forEach((b, i) => {
        const box = { x: LEFT, y: ys[i], w, h: b.h };
        if (b.key === 'kicker') els.push(text(box, slide.kicker.toUpperCase(), { font: 'condensed', size: 40, bold: true, color: t.accent2[0] }));
        if (b.key === 'title') els.push(text(box, title.text, { font: title.font, size: title.size, bold: title.bold, color: t.title }));
        if (b.key === 'subtitle') els.push(text(box, sub.text, { size: sub.size, color: t.muted }));
        if (b.key === 'tag') els.push(...pillLeft(slide.tag, ys[i], t));
    });
    return els;
}

/** Píldora alineada a la izquierda (portada). */
function pillLeft(label, y, theme) {
    const list = pill(label, { cx: 0, y, colors: theme.accent });
    const dx = 96 - list[0].x;
    return list.map(el => ({ ...el, x: el.x + dx }));
}

/** Mensaje centrado: icono, titular, texto y etiqueta (pausas, avisos, transiciones). */
function statement(slide, ctx) {
    const t = ctx.theme;
    const title = headline(slide.title, { w: 1600, short: 30, display: { max: 180, min: 100, maxLines: 2 }, sans: { max: 96, min: 64, maxLines: 3 } });
    const body = slide.text ? fitBalanced(slide.text, { w: 1500, max: 52, min: 36, maxLines: 4 }) : null;
    const blocks = [];
    if (slide.icon) blocks.push({ key: 'icon', h: 280 });
    blocks.push({ key: 'title', h: title.h, gap: 24 });
    if (body) blocks.push({ key: 'text', h: boxHeight(body.text, { size: body.size, w: 1500 }), gap: title.big ? -40 : 0 });
    if (slide.tag) blocks.push({ key: 'tag', h: 88, gap: 40 });
    const ys = stackCentered(blocks, { top: 60, bottom: 1020 });
    const els = [];
    blocks.forEach((b, i) => {
        const y = ys[i];
        if (b.key === 'icon') els.push(...iconCircle(ctx, { cx: 960, cy: y + 140, d: 280, icon: slide.icon, colors: t.accent }));
        if (b.key === 'title') {
            els.push(text({ x: 160, y, w: 1600, h: b.h }, title.text, { font: title.font, size: title.size, bold: title.bold, color: t.title, align: 'center' }));
        }
        if (b.key === 'text') els.push(text({ x: 210, y, w: 1500, h: b.h }, body.text, { size: body.size, color: t.muted, align: 'center' }));
        if (b.key === 'tag') els.push(...pill(slide.tag, { cx: 960, y, colors: t.accent2 }));
    });
    return els;
}

/** Título y un párrafo. */
function textLayout(slide, ctx) {
    const t = ctx.theme;
    const head = header(slide, t);
    const foot = footer(slide, t);
    const room = foot.limit - head.bottom;
    const fit = fitBalanced(slide.text, { w: WIDTH, h: room, max: 56, min: 32, eager: false });
    const h = Math.min(room, boxHeight(fit.text, { size: fit.size, w: WIDTH }));
    const body = text({ x: LEFT, y: head.bottom + (room - h) / 4, w: WIDTH, h }, fit.text, { size: fit.size, color: t.text });
    return [...head.elements, body, ...foot.elements];
}

/** Título y de 2 a 6 puntos con marcador de color. */
function bullets(slide, ctx) {
    const t = ctx.theme;
    const head = header(slide, t);
    const foot = footer(slide, t);
    const room = foot.limit - head.bottom;
    const w = 1688;
    const lay = s => slide.items.map(item => {
        const value = balance(item, { size: s, w, eager: false });
        return { value, h: boxHeight(value, { size: s, w }) };
    });
    const height = (list, s) => list.reduce((sum, r) => sum + r.h, 0) + Math.round(s * 0.5) * (list.length - 1);
    let size = 56;
    let rows = lay(size);
    while (size > 32 && height(rows, size) > room) {
        size -= 4;
        rows = lay(size);
    }
    const gap = Math.round(size * 0.5);
    const els = [...head.elements];
    let y = head.bottom + Math.max(0, (room - height(rows, size)) / 4);
    rows.forEach(row => {
        els.push(shape('ellipse', { x: 100, y: y + 16 + size * 0.6 - 11, w: 22, h: 22 }, { fill: t.accent[0] }));
        els.push(text({ x: 136, y, w, h: row.h }, row.value, { size, color: t.text }));
        y += row.h + gap;
    });
    return [...els, ...foot.elements];
}

/** Cita grande con comillas decorativas y autor. */
function quote(slide, ctx) {
    const t = ctx.theme;
    const w = 1600;
    const fit = fitBalanced(slide.quote, { font: 'elegant', w, max: 72, min: 44, maxLines: 5, eager: false });
    const blocks = [{ key: 'quote', h: boxHeight(fit.text, { font: 'elegant', size: fit.size, w }) }];
    if (slide.author) blocks.push({ key: 'author', h: 80, gap: 24 });
    const ys = stackCentered(blocks, { top: 220, bottom: 1000 });
    const els = [text({ x: 64, y: 12, w: 400, h: 420 }, '“', { font: 'elegant', size: 320, color: t.accent2[0] })];
    els.push(text({ x: 160, y: ys[0], w, h: blocks[0].h }, fit.text, { font: 'elegant', size: fit.size, italic: true, color: t.title }));
    if (slide.author) {
        els.push(text({ x: 160, y: ys[1], w, h: 80 }, '— ' + slide.author.toUpperCase(), { font: 'condensed', size: 40, bold: true, color: t.muted }));
    }
    return els;
}

/** Cifra en grande: dentro de un anillo de progreso si es un porcentaje, o sola en el color de acento. */
function statFigure(slide, t, ctx) {
    const pct = /^(\d{1,3}(?:[.,]\d+)?)\s?%$/.exec(slide.value);
    const percent = pct ? parseFloat(pct[1].replace(',', '.')) : NaN;
    if (percent >= 0 && percent <= 100) {
        const fit = fitBalanced(slide.value, { font: 'display', w: 520, max: 200, min: 96, maxLines: 1 });
        return [
            image({ x: 120, y: 180, w: 720, h: 720 }, ctx.asset(donutSvg(percent, t.accent[0], t.title))),
            text({ x: 220, y: 360, w: 520, h: 360 }, slide.value, { font: 'display', size: fit.size, color: t.title, align: 'center', valign: 'middle' })
        ];
    }
    const fit = fitBalanced(slide.value, { font: 'display', w: 840, max: 260, min: 120, maxLines: 1 });
    return [text({ x: 80, y: 240, w: 840, h: 600 }, slide.value, { font: 'display', size: fit.size, color: t.accent2[0], align: 'center', valign: 'middle' })];
}

/** Cifra destacada con explicación a la derecha. */
function stat(slide, ctx) {
    const t = ctx.theme;
    const foot = footer(slide, t);
    const els = statFigure(slide, t, ctx);
    const w = 840;
    const body = fitBalanced(slide.text, { bold: true, w, max: 72, min: 44, maxLines: 4 });
    const label = slide.label ? fitBalanced(slide.label.toUpperCase(), { font: 'condensed', bold: true, w, max: 56, min: 36, maxLines: 2 }) : null;
    const blocks = [];
    if (label) blocks.push({ key: 'label', h: boxHeight(label.text, { font: 'condensed', bold: true, size: label.size, w }) });
    blocks.push({ key: 'text', h: boxHeight(body.text, { bold: true, size: body.size, w }), gap: -8 });
    const ys = stackCentered(blocks, { top: 120, bottom: foot.limit });
    blocks.forEach((b, i) => {
        const box = { x: 1000, y: ys[i], w, h: b.h };
        if (b.key === 'label') els.push(text(box, label.text, { font: 'condensed', size: label.size, bold: true, color: t.accent[0] }));
        if (b.key === 'text') els.push(text(box, body.text, { size: body.size, bold: true, color: t.title }));
    });
    return [...els, ...foot.elements];
}

module.exports = { cover, statement, text: textLayout, bullets, quote, stat };
