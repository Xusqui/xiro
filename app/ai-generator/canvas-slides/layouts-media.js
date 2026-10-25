'use strict';

/**
 * @fileoverview Diseños con imagen de las diapositivas que crea la IA: imagen grande con título y pie (image),
 * texto o puntos junto a una imagen (split) y la foto de la portada (cover, en layouts-text.js). La imagen
 * llega ya resuelta (media.js) con su proporción, así que su caja la respeta sin recortar ni dejar bandas;
 * ctx.photo() la mete en el paquete. Una foto de Wikimedia Commons lleva su crédito al pie (elements.credit).
 */

const { LEFT, WIDTH, text, shape, image, contain, credit, header, stackCentered } = require('./elements');
const { boxHeight, fitBalanced, balance } = require('./text-fit');

const RIGHT = 1840;
const GAP = 64;
const PHOTO_RADIUS = 24;
const DEFAULT_RATIO = 4 / 3;
// Más estrecha que esto, una foto sola deja mucho hueco a los lados: va junto al texto (split)
const PORTRAIT_RATIO = 0.85;

/** Límite inferior del contenido: con crédito al pie queda más arriba. */
function bottomOf(img) {
    return img.credit ? 976 : 1000;
}

/** Elemento de la imagen en box: las fotos con las esquinas redondeadas; los dibujos y logos, tal cual. */
function photo(ctx, img, box) {
    const rounded = img.mime === 'image/jpeg' || img.mime === 'image/webp';
    return image(box, ctx.photo(img), { fit: img.ratio ? 'cover' : 'contain', ratio: img.ratio || null, radius: rounded ? PHOTO_RADIUS : 0 });
}

/** Imagen grande centrada, con título y subtítulo arriba y pie de foto debajo; una vertical con textos, como split. */
function imageLayout(slide, ctx) {
    const t = ctx.theme;
    const img = slide.image;
    if (img.ratio && img.ratio < PORTRAIT_RATIO && (slide.title || slide.caption)) return split({ ...slide, text: slide.caption || '' }, ctx);
    const head = header(slide, t);
    const top = slide.title || slide.subtitle ? head.bottom : 80;
    const bottom = bottomOf(img);
    const cap = slide.caption ? fitBalanced(slide.caption, { w: 1600, max: 44, min: 32, maxLines: 2 }) : null;
    const capH = cap ? boxHeight(cap.text, { size: cap.size, w: 1600 }) : 0;
    const size = contain(img.ratio || DEFAULT_RATIO, WIDTH, bottom - top - capH);
    const y = top + (bottom - top - size.h - capH) / 2;
    const els = [...head.elements, photo(ctx, img, { x: 960 - size.w / 2, y, w: size.w, h: size.h })];
    if (cap) els.push(text({ x: 160, y: y + size.h, w: 1600, h: capH }, cap.text, { size: cap.size, color: t.muted, align: 'center' }));
    return [...els, ...credit(img, t)];
}

/** Párrafo de la columna de split, con la letra que quepa en el alto que queda. */
function splitText(value, t, w, budget) {
    const fit = fitBalanced(value, { w, h: budget, max: 48, min: 30, eager: false });
    const h = Math.min(budget, boxHeight(fit.text, { size: fit.size, w }));
    return { h, make: (y, x) => [text({ x, y, w, h }, fit.text, { size: fit.size, color: t.text })] };
}

/** Puntos con marcador de color de la columna de split, con la letra que quepa en el alto que queda. */
function splitItems(items, t, w, budget) {
    const textW = w - 56;
    const lay = size =>
        items.map(item => {
            const value = balance(item, { size, w: textW, eager: false });
            return { value, h: boxHeight(value, { size, w: textW }) };
        });
    const total = (rows, size) => rows.reduce((sum, r) => sum + r.h, 0) + Math.round(size * 0.4) * (rows.length - 1);
    let size = 44;
    let rows = lay(size);
    while (size > 28 && total(rows, size) > budget) {
        size -= 4;
        rows = lay(size);
    }
    const make = (y, x) => {
        const els = [];
        let at = y;
        rows.forEach(row => {
            els.push(shape('ellipse', { x: x + 20, y: at + 16 + size * 0.6 - 10, w: 20, h: 20 }, { fill: t.accent[0] }));
            els.push(text({ x: x + 56, y: at, w: textW, h: row.h }, row.value, { size, color: t.text }));
            at += row.h + Math.round(size * 0.4);
        });
        return els;
    };
    return { h: total(rows, size), make };
}

/** Bloques de la columna de texto de split: título, subtítulo y párrafo o puntos, para el ancho w. */
function splitColumn(slide, t, w, room) {
    const blocks = [];
    if (slide.title) {
        const fit = fitBalanced(slide.title, { bold: true, w, max: 72, min: 48, maxLines: 3 });
        const h = boxHeight(fit.text, { bold: true, size: fit.size, w });
        blocks.push({ h, make: (y, x) => [text({ x, y, w, h }, fit.text, { size: fit.size, bold: true, color: t.title })] });
    }
    if (slide.subtitle) {
        const fit = fitBalanced(slide.subtitle, { w, max: 40, min: 30, maxLines: 2 });
        const h = boxHeight(fit.text, { size: fit.size, w });
        blocks.push({ h, gap: -16, make: (y, x) => [text({ x, y, w, h }, fit.text, { size: fit.size, color: t.muted })] });
    }
    const gap = blocks.length ? 32 : 0;
    if (!slide.items && !slide.text) return blocks;
    const used = blocks.reduce((sum, b) => sum + b.h + (b.gap || 0), 0) + gap;
    const body = slide.items ? splitItems(slide.items, t, w, room - used) : splitText(slide.text, t, w, room - used);
    return [...blocks, { ...body, gap }];
}

/** Texto (o puntos) a la izquierda y la imagen a la derecha, los dos centrados en vertical. */
function split(slide, ctx) {
    const t = ctx.theme;
    const img = slide.image;
    const bottom = bottomOf(img);
    const size = contain(img.ratio || DEFAULT_RATIO, 820, bottom - 80);
    const box = { x: RIGHT - size.w, y: 80 + (bottom - 80 - size.h) / 2, w: size.w, h: size.h };
    const w = Math.round(box.x - GAP - LEFT);
    const blocks = splitColumn(slide, t, w, bottom - 80);
    const ys = stackCentered(blocks, { top: 80, bottom });
    const els = blocks.flatMap((b, i) => b.make(ys[i], LEFT));
    return [...els, photo(ctx, img, box), ...credit(img, t)];
}

/** Foto de la portada a la derecha (de x 1080 a 1840), centrada en vertical, con su crédito si lo tiene. */
function coverPhoto(ctx, img) {
    const bottom = bottomOf(img);
    const size = contain(img.ratio || DEFAULT_RATIO, 760, bottom - 160);
    const box = { x: 1460 - size.w / 2, y: 80 + (bottom - 80 - size.h) / 2, w: size.w, h: size.h };
    return [photo(ctx, img, box), ...credit(img, ctx.theme)];
}

module.exports = { image: imageLayout, split, coverPhoto };
