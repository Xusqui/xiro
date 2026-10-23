'use strict';

/**
 * @fileoverview Diseño de pregunta de las diapositivas que crea la IA: enunciado y de 2 a 4 opciones con los
 * colores y la sombra 3D de los botones del jugador de XiRo (css/jugador-quiz.css), sin marcar la correcta.
 * Misma firma que layouts-text.js: (diapositiva saneada, contexto) → elementos.
 */

const { LEFT, WIDTH, text, shape } = require('./elements');
const { boxHeight, fitBalanced } = require('./text-fit');

// [color, sombra 3D, texto] de cada opción
const OPTION_COLORS = [
    ['#dc2626', '#7f1d1d', '#ffffff'],
    ['#2563eb', '#1e40af', '#ffffff'],
    ['#eab308', '#854d0e', '#1e1b2e'],
    ['#16a34a', '#14532d', '#ffffff']
];
const LETTERS = ['A', 'B', 'C', 'D'];

/** Pregunta con 2 a 4 opciones en los colores de los botones de XiRo (sin marcar la correcta). */
function question(slide, ctx) {
    const t = ctx.theme;
    const els = [];
    let y = 64;
    if (slide.kicker) {
        els.push(text({ x: LEFT, y, w: WIDTH, h: 76 }, slide.kicker.toUpperCase(), { font: 'condensed', size: 36, bold: true, color: t.accent2[0] }));
        y += 60;
    }
    const q = fitBalanced(slide.question, { bold: true, w: WIDTH, max: 72, min: 48, maxLines: 3 });
    const qH = boxHeight(q.text, { bold: true, size: q.size, w: WIDTH });
    els.push(text({ x: LEFT, y, w: WIDTH, h: qH }, q.text, { size: q.size, bold: true, color: t.title }));
    const rows = slide.options.length > 2 ? 2 : 1;
    const free = 1000 - (y + qH + 40) - 12;
    const h = Math.min(260, (free - 32 * (rows - 1)) / rows);
    const top = y + qH + 40 + Math.max(0, (free - (h * rows + 32 * (rows - 1))) / 2);
    slide.options.forEach((option, i) => {
        const [fill, shadow, ink] = OPTION_COLORS[i];
        const x = 96 + (i % 2) * 876;
        const oy = top + Math.floor(i / 2) * (h + 32);
        const fit = fitBalanced(option, { bold: true, w: 660, h: h - 32, max: 52, min: 36, maxLines: 2 });
        els.push(
            shape('rect', { x, y: oy + 12, w: 852, h }, { fill: shadow, radius: 28 }),
            shape('rect', { x, y: oy, w: 852, h }, { fill, radius: 28 }),
            shape('ellipse', { x: x + 40, y: oy + h / 2 - 52, w: 104, h: 104 }, { fill: '#00000033' }),
            text({ x: x + 12, y: oy + h / 2 - 80, w: 160, h: 160 }, LETTERS[i], { font: 'display', size: 72, color: ink, align: 'center', valign: 'middle' }),
            text({ x: x + 168, y: oy + 16, w: 660, h: h - 32 }, fit.text, { size: fit.size, bold: true, color: ink, valign: 'middle' })
        );
    });
    return els;
}

module.exports = { question };
