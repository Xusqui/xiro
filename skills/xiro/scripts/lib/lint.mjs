/**
 * Avisos de diseño que XiRo no comprueba pero que estropean una diapositiva: letra pequeña, cosas
 * fuera del lienzo, textos que se pisan, poco contraste con lo que tienen debajo e imágenes que no
 * llenan su caja. Trabaja sobre los lienzos tal y como quedarían en XiRo. El contraste se estima con
 * los colores del lienzo; si hay navegador, preview.mjs lo mide de verdad sobre la captura.
 */

import { WIDTH, HEIGHT } from './rules.mjs';

const MIN_FONT = 28;

export function rgba(hex) {
    const h = hex.slice(1);
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    };
}

export function over(top, bottom) {
    const a = top.a === undefined ? 1 : top.a;
    return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), a: 1 };
}

function luminance(c) {
    const ch = v => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

export function contrast(a, b) {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
}

export const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Umbral de contraste: 3:1 para letra grande (48 px, o 36 px en negrita), 4.5:1 para el resto. */
export function minContrast(props) {
    return props.size >= 48 || (props.bold && props.size >= 36) ? 3 : 4.5;
}

/** Caja que ocupa el elemento ya girado. */
function bounds(el) {
    const rad = (el.rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const w = el.w * cos + el.h * sin;
    const h = el.w * sin + el.h * cos;
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
}

/** ¿El punto cae dentro del elemento (con su giro)? */
function contains(el, px, py) {
    const rad = (-el.rotation * Math.PI) / 180;
    const dx0 = px - (el.x + el.w / 2);
    const dy0 = py - (el.y + el.h / 2);
    const dx = dx0 * Math.cos(rad) - dy0 * Math.sin(rad);
    const dy = dx0 * Math.sin(rad) + dy0 * Math.cos(rad);
    if (el.type === 'shape' && el.props.shape === 'ellipse') {
        return (dx * dx) / ((el.w / 2) * (el.w / 2)) + (dy * dy) / ((el.h / 2) * (el.h / 2)) <= 1;
    }
    return Math.abs(dx) <= el.w / 2 && Math.abs(dy) <= el.h / 2;
}

/** Color que queda debajo del punto antes del elemento index (null = hay una imagen debajo). */
function colorBelow(canvas, index, px, py) {
    let color = canvas.background.image ? null : rgba(canvas.background.color);
    for (let k = 0; k < index; k++) {
        const el = canvas.elements[k];
        if (!contains(el, px, py)) continue;
        if (el.type === 'image' || el.type === 'video') {
            color = null;
            continue;
        }
        const closed = el.type === 'shape' && (el.props.shape === 'rect' || el.props.shape === 'ellipse');
        const fill = closed || el.type === 'text' ? el.props.fill : null;
        if (!fill) continue;
        const f = rgba(fill);
        if (color) color = over(f, color);
        else if (f.a >= 0.85) color = { ...f, a: 1 };
    }
    return color;
}

export function elementLabel(i, el) {
    const t = el && el.type === 'text' ? (el.props.text.split('\n').find(l => l.trim()) || '').trim() : '';
    const txt = t ? ` «${t.length > 28 ? t.slice(0, 27) + '…' : t}»` : '';
    return `Diapositiva ${i + 1} · ${el ? el.type : '?'}${txt} (${el ? el.id : '?'})`;
}

/** Contraste estimado con los colores del lienzo (sin navegador). */
function checkContrast(canvas, k, el, where, out) {
    let below = colorBelow(canvas, k, el.x + el.w / 2, el.y + el.h / 2);
    if (el.props.fill) {
        const f = rgba(el.props.fill);
        below = below ? over(f, below) : f.a >= 0.85 ? { ...f, a: 1 } : null;
    }
    if (!below) {
        out.push(`${where}: texto sobre imagen; comprueba en la vista previa que se lee (pon debajo una capa translúcida, p. ej. rect #000000a0)`);
        return;
    }
    const fg = over(rgba(el.props.color), below);
    const ratio = contrast(fg, below);
    const min = minContrast(el.props);
    if (ratio < min) out.push(`${where}: contraste ${ratio.toFixed(1)}:1 entre ${hex(fg)} y el fondo ${hex(below)} (mínimo ${min}:1)`);
}

/**
 * Avisos de diseño de todas las diapositivas.
 * @param {Object[]} canvases - Lienzos tal y como quedarían en XiRo
 * @param {{contrast?: boolean, overlap?: boolean}} [options] - false en lo que se mide en la vista previa
 */
export function lintCanvases(canvases, options = {}) {
    const out = [];
    canvases.forEach((canvas, i) => {
        const els = canvas.elements;
        if (els.length > 35) out.push(`Diapositiva ${i + 1}: ${els.length} elementos; con tantos cuesta leerla de un vistazo`);
        els.forEach((el, k) => {
            const b = bounds(el);
            const where = elementLabel(i, el);
            if (el.type !== 'shape' && (b.x0 < -2 || b.y0 < -2 || b.x1 > WIDTH + 2 || b.y1 > HEIGHT + 2)) {
                out.push(`${where}: se sale del lienzo 1920×1080 y se verá cortado`);
            }
            if (el.type === 'image' && el.props.ratio && el.props.fit === 'contain') {
                const diff = Math.abs(el.w / el.h - el.props.ratio) / el.props.ratio;
                if (diff > 0.08) {
                    out.push(`${where}: la imagen (proporción ${el.props.ratio.toFixed(2)}) no llena su caja ${el.w}×${el.h} con fit "contain"; ajusta w/h o usa "cover"`);
                }
            }
            if (el.type !== 'text' || !el.props.text.trim()) return;
            if (el.props.size < MIN_FONT) out.push(`${where}: letra de ${el.props.size} px, poco legible en proyector o móvil (mínimo recomendado ${MIN_FONT})`);
            if (options.contrast !== false) checkContrast(canvas, k, el, where, out);
            for (let m = k + 1; options.overlap !== false && m < els.length; m++) {
                const other = els[m];
                if (other.type !== 'text' || !other.props.text.trim()) continue;
                const o = bounds(other);
                const ix = Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0);
                const iy = Math.min(b.y1, o.y1) - Math.max(b.y0, o.y0);
                if (ix > 32 && iy > 32) out.push(`${where}: su caja se pisa con la de ${elementLabel(i, other).split(' · ')[1]}`);
            }
        });
    });
    return out;
}
