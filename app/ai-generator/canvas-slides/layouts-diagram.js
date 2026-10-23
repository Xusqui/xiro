'use strict';

/**
 * @fileoverview Diseños de diagrama de las diapositivas que crea la IA: árbol de una caja raíz a 2-4 ramas
 * con su resultado (flow, como «una misma evidencia, tres veredictos»), proceso en fila con flechas
 * (process) y línea de tiempo (timeline). Misma firma que layouts-text.js.
 */

const { text, shape, segment, iconCircle, header, footer } = require('./elements');
const { boxHeight, fitBalanced, textWidth, balance } = require('./text-fit');
const { toneColors } = require('./themes');
const { rowTitles } = require('./layouts-grid');

const BRANCH_GAPS = { 2: 96, 3: 58, 4: 40 };

/** Caja con borde (rama) o rellena (raíz, resultado) y su texto centrado. */
function box(b, value, { fill, stroke, ink, max }) {
    const fit = fitBalanced(value, { bold: true, w: b.w, h: b.h, max, min: 28, maxLines: 3 });
    return [
        shape('rect', b, { fill, stroke, strokeWidth: 3, radius: 14 }),
        text(b, fit.text, { size: fit.size, bold: true, color: ink, align: 'center', valign: 'middle' })
    ];
}

/** Medidas del árbol: caja raíz, separación de las flechas y alto de los resultados que caben en `room`. */
function flowMetrics(slide, room) {
    const longest = Math.max(...slide.root.split('\n').map(line => textWidth(line, { bold: true, size: 42 })));
    const rootW = Math.min(1100, Math.max(560, longest + 160));
    const rootH = Math.max(150, boxHeight(slide.root, { bold: true, size: 42, w: rootW - 64 }) + 40);
    const hasResult = slide.branches.some(b => b.result);
    const m = { rootW, rootH, arrowGap: 150, branchH: 160, resultH: hasResult ? 180 : 0, hasResult };
    const needed = () => m.rootH + m.arrowGap + m.branchH + (hasResult ? 24 + m.resultH : 0);
    while (needed() > room && m.arrowGap > 90) m.arrowGap -= 10;
    while (needed() > room && m.resultH > 130) m.resultH -= 10;
    m.offset = Math.max(0, (room - needed()) / 2);
    return m;
}

/** Raíz arriba, flechas a 2-4 ramas y, debajo de cada rama, su resultado en el color de su tono. */
function flow(slide, ctx) {
    const t = ctx.theme;
    const head = header(slide, t);
    const foot = footer(slide, t);
    const m = flowMetrics(slide, foot.limit - head.bottom);
    const n = slide.branches.length;
    const gap = BRANCH_GAPS[n];
    const colW = (1728 - gap * (n - 1)) / n;
    const top = head.bottom + m.offset;
    const rootBottom = top + m.rootH;
    const branchTop = rootBottom + m.arrowGap;
    const centers = slide.branches.map((_, i) => 96 + i * (colW + gap) + colW / 2);
    // Flechas antes que la raíz: la caja tapa su arranque
    const els = [...head.elements, ...centers.map(cx => segment('arrow', [960, rootBottom], [cx, branchTop - 12], { color: t.line, width: 6 }))];
    els.push(...box({ x: 960 - m.rootW / 2, y: top, w: m.rootW, h: m.rootH }, slide.root, { fill: t.accent[0], ink: t.accent[1], max: 42 }));
    slide.branches.forEach((branch, i) => {
        const colors = toneColors(t, branch.tone, i + 1);
        const x = centers[i] - colW / 2;
        els.push(...box({ x, y: branchTop, w: colW, h: m.branchH }, branch.title, { fill: t.surface, stroke: colors[0], ink: t.title, max: 38 }));
        if (branch.result) {
            els.push(...box({ x, y: branchTop + m.branchH + 24, w: colW, h: m.resultH }, branch.result, { fill: colors[0], ink: colors[1], max: 36 }));
        }
    });
    return [...els, ...foot.elements];
}

/** De 2 a 5 tarjetas en fila unidas por flechas: icono (o número), título y texto. */
function processLayout(slide, ctx) {
    const t = ctx.theme;
    const head = header(slide, t);
    const foot = footer(slide, t);
    const room = foot.limit - head.bottom;
    const n = slide.nodes.length;
    const gap = 72;
    const w = (1728 - gap * (n - 1)) / n;
    const inner = w - 32;
    const titles = rowTitles(slide.nodes.map(s => s.title), { w: inner, max: 40, min: 28 });
    const textNeed = Math.max(0, ...slide.nodes.map(s => (s.text ? boxHeight(balance(s.text, { size: 32, w: inner }), { size: 32, w: inner }) : 0)));
    const h = Math.min(room, Math.max(360, 210 + titles.h - 8 + textNeed + 32));
    const top = head.bottom + (room - h) / 2;
    const els = [...head.elements];
    slide.nodes.forEach((node, i) => {
        const x = 96 + i * (w + gap);
        const colors = toneColors(t, node.tone, i);
        els.push(shape('rect', { x, y: top, w, h }, { fill: t.surface, radius: 28 }));
        els.push(...iconCircle(ctx, { cx: x + w / 2, cy: top + 110, d: 140, icon: node.icon, colors }));
        if (!node.icon) els.push(numberLabel(i, { cx: x + w / 2, cy: top + 110, color: colors[1] }));
        const ty = top + 210;
        els.push(text({ x: x + 16, y: ty, w: inner, h: titles.h }, titles.values[i], { size: titles.size, bold: true, color: t.title, align: 'center' }));
        if (node.text) {
            const th = top + h - 24 - (ty + titles.h - 8);
            const body = fitBalanced(node.text, { w: inner, h: th, max: 32, min: 24 });
            els.push(text({ x: x + 16, y: ty + titles.h - 8, w: inner, h: th }, body.text, { size: body.size, color: t.muted, align: 'center' }));
        }
        if (i < n - 1) els.push(segment('arrow', [x + w + 12, top + h / 2], [x + w + gap - 12, top + h / 2], { color: t.line, width: 6 }));
    });
    return [...els, ...foot.elements];
}

function numberLabel(i, { cx, cy, color }) {
    return text({ x: cx - 80, y: cy - 80, w: 160, h: 160 }, String(i + 1), { font: 'display', size: 88, color, align: 'center', valign: 'middle' });
}

/** De 2 a 6 hitos sobre una línea horizontal: fecha encima y texto debajo. */
function timeline(slide, ctx) {
    const t = ctx.theme;
    const head = header(slide, t);
    const foot = footer(slide, t);
    const n = slide.events.length;
    const step = 1440 / (n - 1);
    const colW = Math.min(520, step - 24);
    const room = foot.limit - head.bottom;
    const textNeed = Math.max(...slide.events.map(e => boxHeight(balance(e.text, { size: 34, w: colW }), { size: 34, w: colW })));
    const block = 160 + 48 + textNeed;
    const lineY = head.bottom + Math.max(0, (room - block) / 2) + 160;
    const textH = Math.min(foot.limit - (lineY + 48), textNeed + 16);
    const els = [...head.elements, segment('line', [200, lineY], [1720, lineY], { color: t.line + '88', width: 6 })];
    slide.events.forEach((event, i) => {
        const cx = 240 + i * step;
        const x = Math.max(24, Math.min(1896 - colW, cx - colW / 2));
        const date = fitBalanced(event.date.toUpperCase(), { font: 'display', w: colW, max: 64, min: 40, maxLines: 1 });
        const body = fitBalanced(event.text, { w: colW, h: textH, max: 34, min: 24 });
        els.push(
            text({ x, y: lineY - 160, w: colW, h: 128 }, date.text, { font: 'display', size: date.size, color: t.accent2[0], align: 'center', valign: 'bottom' }),
            shape('ellipse', { x: cx - 22, y: lineY - 22, w: 44, h: 44 }, { fill: t.accent[0], stroke: t.bg, strokeWidth: 6 }),
            text({ x, y: lineY + 48, w: colW, h: textH }, body.text, { size: body.size, color: t.text, align: 'center' })
        );
    });
    return [...els, ...foot.elements];
}

module.exports = { flow, process: processLayout, timeline };
