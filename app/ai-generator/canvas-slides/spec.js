'use strict';

/**
 * @fileoverview Saneado de lo que devuelve la IA antes de diseñar las diapositivas: diseño (layout) conocido,
 * textos limpios (sin markdown ni viñetas) y recortados a su límite, listas con el número de elementos que
 * admite cada diseño, tonos e iconos de la lista. Lo que no se puede aprovechar se descarta con un aviso.
 */

const { ICON_NAMES } = require('./icons');
const { TONES, THEME_NAMES } = require('./themes');

// Nombres que usan a veces los modelos para el mismo diseño
const LAYOUT_ALIASES = {
    title: 'cover',
    portada: 'cover',
    mensaje: 'statement',
    texto: 'text',
    lista: 'bullets',
    list: 'bullets',
    tarjetas: 'cards',
    pasos: 'steps',
    proceso: 'process',
    diagram: 'flow',
    diagrama: 'flow',
    tree: 'flow',
    comparacion: 'comparison',
    cifra: 'stat',
    number: 'stat',
    cita: 'quote',
    pregunta: 'question'
};
const ELLIPSIS = '…';
// Viñeta o numeración al principio de una línea («- », «• », «1. », «2) »…)
const LIST_LINE = /^\s*(?:[-*•·]|\d+[.)])\s+/;

/** Texto limpio y recortado (por palabra, con …); '' si no hay texto. */
function str(value, max) {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    let s = Array.from(String(value).replace(/\r\n?/g, '\n'))
        .filter(ch => ch === '\n' || ch.charCodeAt(0) >= 32)
        .join('');
    s = s
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 6)
        .join('\n');
    if (s.length <= max) return s;
    const cut = s.slice(0, max - 1);
    const space = cut.lastIndexOf(' ');
    return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, '') + ELLIPSIS;
}

/** Punto de una lista: sin viñeta ni numeración inicial. */
function item(value, max) {
    return str(typeof value === 'string' ? value.replace(LIST_LINE, '') : value, max);
}

/** Lista saneada con map; null si quedan menos de min. */
function list(value, { min, max, map }) {
    const out = (Array.isArray(value) ? value : []).map(map).filter(Boolean).slice(0, max);
    return out.length >= min ? out : null;
}

const tone = v => (TONES.includes(v) ? v : null);
const icon = v => (typeof v === 'string' && ICON_NAMES.includes(v.trim().toLowerCase()) ? v.trim().toLowerCase() : null);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** Campo de texto opcional; se omite si queda vacío. */
function optional(target, key, value, max) {
    const s = str(value, max);
    if (s) target[key] = s;
}

const SANITIZERS = {
    cover: s => (str(s.title, 80) ? { title: str(s.title, 80), kicker: str(s.kicker, 40), subtitle: str(s.subtitle, 140), tag: str(s.tag, 40), icon: icon(s.icon) } : null),
    statement: s => (str(s.title, 80) ? { title: str(s.title, 80), text: str(s.text, 220), tag: str(s.tag, 40), icon: icon(s.icon) } : null),
    text: s => (str(s.text, 600) ? { text: str(s.text, 600) } : null),
    bullets: s => {
        const items = list(s.items, { min: 2, max: 6, map: v => item(v, 140) });
        return items ? { items } : null;
    },
    cards: s => {
        const cards = list(s.cards, { min: 2, max: 4, map: c => (str(obj(c).title, 60) ? { title: str(c.title, 60), text: str(c.text, 170), icon: icon(c.icon), tone: tone(c.tone) } : null) });
        return cards ? { cards } : null;
    },
    steps: s => {
        const steps = list(s.steps, { min: 2, max: 5, map: c => (str(obj(c).title, 48) ? { title: str(c.title, 48), text: str(c.text, 130) } : null) });
        return steps ? { steps } : null;
    },
    process: s => {
        const nodes = list(s.nodes, { min: 2, max: 5, map: c => (str(obj(c).title, 48) ? { title: str(c.title, 48), text: str(c.text, 120), icon: icon(c.icon), tone: tone(c.tone) } : null) });
        return nodes ? { nodes } : null;
    },
    flow: s => {
        const branches = list(s.branches, { min: 2, max: 4, map: c => (str(obj(c).title, 60) ? { title: str(c.title, 60), result: str(c.result, 80), tone: tone(c.tone) } : null) });
        return branches && str(s.root, 100) ? { root: str(s.root, 100), branches } : null;
    },
    comparison: s => {
        const side = c => {
            const items = list(obj(c).items, { min: 1, max: 6, map: v => item(v, 110) });
            return str(obj(c).title, 50) && items ? { title: str(c.title, 50), items, tone: tone(c.tone) } : null;
        };
        const left = side(s.left);
        const right = side(s.right);
        return left && right ? { left, right } : null;
    },
    stat: s => (str(s.value, 14) && str(s.text, 140) ? { value: str(s.value, 14), label: str(s.label, 50), text: str(s.text, 140) } : null),
    quote: s => (str(s.quote, 260) ? { quote: str(s.quote, 260), author: str(s.author, 60) } : null),
    timeline: s => {
        const events = list(s.events, { min: 2, max: 6, map: c => (str(obj(c).date, 20) && str(c.text, 100) ? { date: str(c.date, 20), text: str(c.text, 100) } : null) });
        return events ? { events } : null;
    },
    question: s => {
        const options = list(s.options, { min: 2, max: 4, map: v => item(v, 80) });
        return options && str(s.question, 180) ? { question: str(s.question, 180), kicker: str(s.kicker, 40), options } : null;
    }
};

const LAYOUTS = Object.keys(SANITIZERS);
// Diseños con título y subtítulo arriba y nota al pie (elements.js: header y footer)
const WITH_HEADER = ['text', 'bullets', 'cards', 'steps', 'process', 'flow', 'comparison', 'timeline'];

/** Un «texto» que en realidad es una lista (casi todas sus líneas empiezan por viñeta o número). */
function textAsList(raw) {
    const lines = typeof raw.text === 'string' ? raw.text.split('\n').filter(l => l.trim()) : [];
    return lines.length >= 2 && lines.filter(l => LIST_LINE.test(l)).length >= lines.length * 0.8 ? lines : null;
}

/** Diseño pedido, por nombre o alias; si no se reconoce, se deduce de los campos que trae. */
function layoutOf(raw) {
    const name = String(raw.layout || raw.type || '').trim().toLowerCase();
    if (SANITIZERS[name]) return name;
    if (LAYOUT_ALIASES[name]) return LAYOUT_ALIASES[name];
    if (Array.isArray(raw.items)) return 'bullets';
    if (Array.isArray(raw.cards)) return 'cards';
    return 'text';
}

/**
 * Diapositiva saneada (con layout, título, subtítulo y nota comunes) o null si no se puede aprovechar.
 * @param {Object} raw - Diapositiva tal y como la devuelve la IA
 * @returns {Object|null}
 */
function sanitizeSlide(raw) {
    let s = obj(raw);
    let layout = layoutOf(s);
    const listLines = layout === 'text' ? textAsList(s) : null;
    if (listLines) {
        s = { ...s, items: listLines };
        layout = 'bullets';
    }
    const body = SANITIZERS[layout](s);
    if (!body) return null;
    const slide = { layout };
    if (WITH_HEADER.includes(layout)) {
        optional(slide, 'title', s.title, 90);
        optional(slide, 'subtitle', s.subtitle, 140);
    }
    if (WITH_HEADER.includes(layout) || layout === 'stat') optional(slide, 'note', s.note, 220);
    return Object.assign(slide, body);
}

/**
 * Presentación saneada: estilo (si es válido) y como mucho `count` diapositivas aprovechables.
 * @param {Object|Array} data - JSON de la IA: { theme, slides: [...] } o directamente la lista
 * @param {number} count - Diapositivas pedidas
 * @returns {{theme: string|null, slides: Object[], dropped: number}} dropped: las que vinieron y no valían
 */
function sanitizeDeck(data, count) {
    const raw = Array.isArray(data) ? data : obj(data).slides;
    const all = (Array.isArray(raw) ? raw : [data]).slice(0, count);
    const slides = all.map(sanitizeSlide).filter(Boolean);
    const theme = THEME_NAMES.includes(obj(data).theme) ? data.theme : null;
    return { theme, slides, dropped: all.length - slides.length };
}

module.exports = { LAYOUTS, sanitizeDeck, sanitizeSlide, str };
