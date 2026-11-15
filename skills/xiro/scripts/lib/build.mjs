/**
 * Construye un paquete .xiroslide a partir de un spec JSON (formato en references/formato.md):
 * valida cada valor con mensajes claros, mete las imágenes en base64, calcula proporciones, ids y
 * líneas/flechas from/to, y comprueba el resultado con la misma simulación que «Importar archivo».
 */

import crypto from 'node:crypto';
import * as R from './rules.mjs';
import { prepareImage, readImageSource } from './media.mjs';
import { parseVideoSource } from './video.mjs';
import { theme as themeApi } from './xiro.mjs';
import { placeInSlots, expandChartData, slotOf, slotImageBox, autoTableHeight } from './build-patterns.mjs';
import { simulateImport, uploadNameFor, describeWarning } from './check.mjs';
import { SpecError, isObj, clean, unknownKeys, colorValue, intValue, boolValue, enumValue } from './spec-values.mjs';
import {
    ELEMENT_STYLE_KEYS,
    TEXT_EXTRA_KEYS,
    PATH_KEYS,
    IMAGE_EXTRA_KEYS,
    TABLE_KEYS,
    CHART_KEYS,
    TEXT_ALIGNS,
    elementStyleFrom,
    richTextFrom,
    pathFrom,
    imageExtrasFrom,
    tablePropsFrom,
    chartPropsFrom,
    gradientFrom
} from './build-extras.mjs';

export const TOOL_MARK = 'xiro-skill';

const ELEMENT_KEYS = ['id', 'type', 'x', 'y', 'w', 'h', 'rotation', 'props', 'from', 'to', 'role', ...ELEMENT_STYLE_KEYS];
const PROP_KEYS = {
    text: ['text', 'font', 'size', 'bold', 'italic', 'color', 'align', 'valign', 'fill', 'fit', ...TEXT_EXTRA_KEYS],
    shape: ['shape', 'fill', 'stroke', 'strokeWidth', 'radius', ...PATH_KEYS],
    image: ['src', 'svg', 'embed', 'ratio', 'lockRatio', 'fit', 'radius', ...IMAGE_EXTRA_KEYS],
    video: ['url', 'autoplay'],
    table: [...TABLE_KEYS, 'columns'],
    chart: CHART_KEYS
};
const BACKGROUND_KEYS = ['color', 'image', 'svg', 'embed', 'gradient'];
const NO_ITALIC = ['display', 'condensed', 'hand'];

const short = t => {
    const line = String(t).split('\n').find(l => l.trim()) || '';
    return line.trim().length > 28 ? line.trim().slice(0, 27) + '…' : line.trim();
};

function angle(v, where) {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new SpecError(`${where}: "rotation" debe ser un número de grados`);
    let a = Math.round(v) % 360;
    if (a > 180) a -= 360;
    if (a < -180) a += 360;
    return a;
}

/** Imágenes del paquete, sin repetir contenido: a1, a2... */
class AssetRegistry {
    constructor() {
        this.list = [];
        this.byHash = new Map();
    }

    add(prepared, name) {
        const hash = crypto.createHash('sha256').update(prepared.buffer).digest('hex');
        if (this.byHash.has(hash)) return this.byHash.get(hash);
        if (this.list.length >= R.MAX_ASSETS) throw new SpecError(`más de ${R.MAX_ASSETS} imágenes distintas`);
        const asset = {
            id: 'a' + (this.list.length + 1),
            mime: prepared.type,
            name: String(name || 'imagen').slice(0, 255),
            buffer: prepared.buffer,
            w: prepared.w,
            h: prepared.h,
            ratio: prepared.ratio,
            upload: uploadNameFor(prepared.buffer, prepared.type)
        };
        this.list.push(asset);
        this.byHash.set(hash, asset);
        return asset;
    }

    byId(id) {
        return this.list.find(a => a.id === id) || null;
    }
}

/** Imagen de src/svg: { ref, asset } (ref = asset:aN o la URL si embed es false); cada origen se lee una vez. */
async function resolveImage(source, ctx, where) {
    const key = JSON.stringify([source.svg, source.src, source.embed]);
    if (!ctx.images.has(key)) ctx.images.set(key, await loadImage(source, ctx, where));
    return ctx.images.get(key);
}

async function loadImage(source, ctx, where) {
    const { svg, src, embed } = source;
    if (svg !== undefined && src !== undefined) throw new SpecError(`${where}: usa "src" o "svg", no los dos`);
    if (embed !== undefined && typeof embed !== 'boolean') throw new SpecError(`${where}: "embed" debe ser true o false`);
    let input;
    if (svg !== undefined) {
        if (typeof svg !== 'string' || !svg.trim()) throw new SpecError(`${where}: "svg" debe ser el código <svg ...>...</svg>`);
        input = { buffer: Buffer.from(svg, 'utf8'), name: 'imagen.svg' };
    } else {
        if (typeof src !== 'string' || !src.trim()) throw new SpecError(`${where}: falta "src" (archivo o URL) o "svg"`);
        const s = src.trim();
        if (s.startsWith(R.ASSET_PREFIX)) throw new SpecError(`${where}: en el spec la imagen va como archivo, URL o "svg", no como ${s}`);
        if (s.startsWith('/uploads/')) {
            throw new SpecError(`${where}: ${s} es una ruta del servidor de XiRo; usa su URL completa (https://servidor${s}) o el archivo`);
        }
        if (/^https?:\/\//i.test(s) && embed === false) {
            if (!R.isSafeMediaUrl(s)) throw new SpecError(`${where}: URL de imagen no válida para XiRo (sin espacios ni comillas, máx. ${R.MAX_URL})`);
            ctx.warnings.push(`${where}: imagen enlazada (embed: false), no va dentro del archivo: XiRo la descarga al importar si su servidor llega a ${new URL(s).host} (hasta la 3.6.0 no se enseña)`);
            return { ref: s, asset: null };
        }
        try {
            input = await readImageSource(s, ctx.baseDir);
        } catch (err) {
            throw new SpecError(`${where}: ${s}: ${err.message}`);
        }
    }
    let prepared;
    try {
        prepared = prepareImage(input.buffer, input.name);
    } catch (err) {
        throw new SpecError(`${where}: ${err.message}`);
    }
    prepared.notes.forEach(n => ctx.notes.push(`${where}: imagen ${n}`));
    const asset = ctx.assets.add(prepared, input.name);
    return { ref: R.assetRef(asset.id), asset };
}

function textPropsFrom(p, where, ctx) {
    const out = {};
    if (p.text === undefined || p.text === null) out.text = '';
    else if (typeof p.text !== 'string') throw new SpecError(`${where}: "text" debe ser un texto`);
    else out.text = p.text.replace(/\r\n?/g, '\n');
    if (p.font !== undefined) out.font = enumValue(p.font, R.FONT_KEYS, where, 'font');
    if (p.size !== undefined) out.size = intValue(p.size, 8, 400, where, 'size');
    if (p.bold !== undefined) out.bold = boolValue(p.bold, where, 'bold');
    if (p.italic !== undefined) out.italic = boolValue(p.italic, where, 'italic');
    if (p.color !== undefined) out.color = colorValue(p.color, where, 'color', false);
    if (p.align !== undefined) out.align = enumValue(p.align, TEXT_ALIGNS, where, 'align');
    if (p.valign !== undefined) out.valign = enumValue(p.valign, ['top', 'middle', 'bottom'], where, 'valign');
    if (p.fill !== undefined) out.fill = colorValue(p.fill, where, 'fill', true);
    if (p.fit !== undefined) out.fit = enumValue(p.fit, ['wrap', 'shrink'], where, 'fit');
    richTextFrom(p, out, where, ctx);
    if (out.text.length > R.MAX_TEXT) throw new SpecError(`${where}: el texto tiene ${out.text.length} caracteres (máx. ${R.MAX_TEXT})`);
    if (!out.text.trim()) ctx.warnings.push(`${where}: texto vacío`);
    const props = R.textProps(out);
    if (out.runs && !props.runs) ctx.warnings.push(`${where}: los tramos de "runs" no cambian nada respecto al formato del cuadro; XiRo los quita`);
    if (props.font === 'display' && props.bold) ctx.warnings.push(`${where}: Bebas Neue (display) no tiene negrita; "bold" la engorda a la fuerza`);
    if (NO_ITALIC.indexOf(props.font) >= 0 && props.italic) ctx.warnings.push(`${where}: la fuente "${props.font}" no tiene cursiva; se inclina a la fuerza`);
    return props;
}

function shapePropsFrom(p, where, ctx) {
    const out = {};
    if (p.shape !== undefined) out.shape = enumValue(p.shape, R.SHAPES, where, 'shape');
    if (p.fill !== undefined) out.fill = colorValue(p.fill, where, 'fill', true);
    if (p.stroke !== undefined) out.stroke = colorValue(p.stroke, where, 'stroke', true);
    if (p.strokeWidth !== undefined) out.strokeWidth = intValue(p.strokeWidth, 0, 60, where, 'strokeWidth');
    if (p.radius !== undefined) out.radius = intValue(p.radius, 0, 540, where, 'radius');
    if (out.shape === 'path') Object.assign(out, pathFrom(p, where));
    else if (PATH_KEYS.some(k => p[k] !== undefined)) throw new SpecError(`${where}: "preset", "d" y "viewBox" solo valen con "shape": "path" (o "type": "path")`);
    const props = R.shapeProps(out);
    if (!props) throw new SpecError(`${where}: trazado "d" no válido para XiRo (solo comandos M L H V C S Q T A Z con sus números, máx. 8000 caracteres)`);
    const closed = props.shape === 'rect' || props.shape === 'ellipse' || props.shape === 'path';
    if (closed && p.stroke === undefined) ctx.warnings.push(`${where}: sin "stroke", XiRo le pone borde blanco de 6 px (usa "stroke": null si no lo quieres)`);
    if (closed && p.fill === undefined) ctx.warnings.push(`${where}: sin "fill", XiRo la rellena de violeta #7c3aed`);
    if (!closed && (props.stroke === null || props.strokeWidth === 0)) ctx.warnings.push(`${where}: línea/flecha invisible (sin stroke o grosor 0)`);
    if (props.shape === 'rect' && props.fill === null && props.stroke === null) ctx.warnings.push(`${where}: rectángulo invisible (sin fill ni stroke)`);
    return props;
}

/** Caja y giro de una línea/flecha dada por sus extremos (la punta de la flecha queda en "to"). */
function segmentBox(raw, props, where) {
    const pt = (v, name) => {
        if (!Array.isArray(v) || v.length !== 2 || !v.every(n => typeof n === 'number' && Number.isFinite(n))) {
            throw new SpecError(`${where}: "${name}" debe ser [x, y]`);
        }
        return v;
    };
    if (props.shape !== 'line' && props.shape !== 'arrow') throw new SpecError(`${where}: "from"/"to" solo valen para line y arrow`);
    if (['x', 'y', 'w', 'rotation'].some(k => raw[k] !== undefined)) throw new SpecError(`${where}: con "from"/"to" no pongas x, y, w ni rotation`);
    const [x1, y1] = pt(raw.from, 'from');
    const [x2, y2] = pt(raw.to, 'to');
    const len = Math.hypot(x2 - x1, y2 - y1);
    const w = Math.round(len);
    if (w < R.MIN_SIZE) throw new SpecError(`${where}: la línea mide ${w} px (mínimo ${R.MIN_SIZE})`);
    const head = props.shape === 'arrow' ? Math.min(w / 2, Math.max(props.strokeWidth * 3, 24)) : 0;
    const h = raw.h !== undefined ? intValue(raw.h, R.MIN_SIZE, 2160, where, 'h') : Math.max(40, Math.ceil(head * 1.2), props.strokeWidth);
    const rotation = Math.round((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI);
    return {
        x: Math.round((x1 + x2) / 2 - w / 2),
        y: Math.round((y1 + y2) / 2 - h / 2),
        w,
        h,
        rotation: rotation === -180 ? 180 : rotation
    };
}

function boxFrom(raw, where, sizeHint) {
    const box = {};
    box.x = intValue(raw.x, -1920, 3840, where, 'x');
    box.y = intValue(raw.y, -1080, 2160, where, 'y');
    let w = raw.w;
    let h = raw.h;
    if (sizeHint && w === undefined && h === undefined) throw new SpecError(`${where}: pon al menos "w" o "h" (el otro sale de la proporción de la imagen)`);
    if (sizeHint && h === undefined) h = intValue(w, R.MIN_SIZE, 3840, where, 'w') / sizeHint;
    if (sizeHint && w === undefined) w = intValue(h, R.MIN_SIZE, 2160, where, 'h') * sizeHint;
    box.w = intValue(w, R.MIN_SIZE, 3840, where, 'w');
    box.h = intValue(h, R.MIN_SIZE, 2160, where, 'h');
    box.rotation = raw.rotation === undefined ? 0 : angle(raw.rotation, where);
    return box;
}

function makeId(seed, used) {
    for (let n = 0; ; n++) {
        const hex = crypto.createHash('sha1').update(`${seed}|${n}`).digest('hex');
        const id = 'el_' + parseInt(hex.slice(0, 10), 16).toString(36).padStart(8, '0').slice(-8);
        if (!used.has(id)) return id;
    }
}

/** Cada gráfico apunta al id de una tabla de su misma diapositiva (XiRo, si no, lo dejaría sin datos). */
function checkChartTables(built, where) {
    const tables = new Set(built.filter(el => el.type === 'table').map(el => el.id));
    built
        .filter(el => el.type === 'chart' && !tables.has(el.props.source.tableId))
        .forEach(el => {
            throw new SpecError(`${where}: el gráfico apunta a "${el.props.source.tableId}", que no es el "id" de ninguna tabla de esta diapositiva (pon "id" en la tabla de datos)`);
        });
}

/** Rol del elemento en el tema (title, subtitle, body…): solo vale en los tipos que lo admiten. */
function roleFrom(value, type, where) {
    const role = themeApi.normalizeRole(value, type);
    if (role) return role;
    const valid = themeApi.ROLES.filter(r => themeApi.ROLE_TYPES[r].indexOf(type) >= 0);
    throw new SpecError(`${where}: "role" ${JSON.stringify(value)} no vale en un elemento ${type}; roles de ${type}: ${valid.map(r => `"${r}"`).join(' | ')}`);
}

async function buildElement(input, j, ctx) {
    if (!isObj(input)) throw new SpecError(`${ctx.where} · elemento ${j + 1}: debe ser un objeto`);
    const raw = clean(input);
    let type = raw.type;
    let p = isObj(raw.props) ? clean(raw.props) : raw.props === undefined ? {} : null;
    const textHint = p && typeof p.text === 'string' ? ` «${short(p.text)}»` : '';
    const where = `${ctx.where} · elemento ${j + 1} (${type}${textHint})`;
    if (p === null) throw new SpecError(`${where}: "props" debe ser un objeto`);
    if (R.SHAPES.indexOf(type) >= 0) {
        if (p.shape !== undefined && p.shape !== type) throw new SpecError(`${where}: type "${type}" y shape "${p.shape}" no coinciden`);
        p = { ...p, shape: type };
        type = 'shape';
    }
    if (R.ELEMENT_TYPES.indexOf(type) < 0) {
        throw new SpecError(`${where}: "type" debe ser text, shape, image, video, table, chart (o ${R.SHAPES.join(', ')})`);
    }
    unknownKeys(raw, ELEMENT_KEYS, where);
    unknownKeys(p, PROP_KEYS[type], `${where} · props`);
    let id = raw.id;
    if (id !== undefined && (typeof id !== 'string' || !R.ID_RE.test(id))) throw new SpecError(`${where}: "id" debe ser el_ + 4 a 16 letras minúsculas o cifras`);
    if (id !== undefined && ctx.usedIds.has(id)) throw new SpecError(`${where}: id repetido ${id}`);
    if (id === undefined) id = makeId(`${ctx.seed}|${j}`, ctx.usedIds);
    ctx.usedIds.add(id);

    let props;
    let box;
    if (type === 'text') {
        props = textPropsFrom(p, where, ctx);
        box = boxFrom(raw, where);
    } else if (type === 'shape') {
        props = shapePropsFrom(p, where, ctx);
        box = raw.from !== undefined || raw.to !== undefined ? segmentBox(raw, props, where) : boxFrom(raw, where);
    } else if (type === 'image') {
        const { ref, asset } = await resolveImage(p, ctx, where);
        const ratio = p.ratio === undefined ? (asset ? Math.round(asset.ratio * 10000) / 10000 : null) : p.ratio;
        if (ratio !== null && !(typeof ratio === 'number' && ratio >= 0.05 && ratio <= 20)) {
            throw new SpecError(`${where}: "ratio" debe ser un número entre 0.05 y 20 (o null)`);
        }
        const slot = slotOf(input);
        const missingSide = raw.w === undefined || raw.h === undefined;
        if (!slot && missingSide && ratio === null) throw new SpecError(`${where}: imagen enlazada sin proporción conocida: pon "w" y "h" (o "ratio")`);
        box = slot ? slotImageBox(slot, ratio) : boxFrom(raw, where, missingSide ? ratio : null);
        props = imageProps({
            src: ref,
            ratio,
            lockRatio: p.lockRatio === undefined ? true : boolValue(p.lockRatio, where, 'lockRatio'),
            fit: p.fit === undefined ? 'contain' : enumValue(p.fit, ['contain', 'cover'], where, 'fit'),
            radius: p.radius === undefined ? 0 : intValue(p.radius, 0, 540, where, 'radius'),
            ...imageExtrasFrom(p, where)
        });
    } else if (type === 'table') {
        props = R.propsOf('table', tablePropsFrom(p, where, ctx));
        // Sin h, la altura sale de las filas y del tamaño de letra
        box = boxFrom(raw.h === undefined ? { ...raw, h: autoTableHeight(props) } : raw, where);
    } else if (type === 'chart') {
        props = R.propsOf('chart', chartPropsFrom(p, where));
        box = boxFrom(raw, where);
    } else {
        const url = typeof p.url === 'string' ? p.url.trim() : '';
        const source = parseVideoSource(url);
        if (!source || url.startsWith('/')) {
            throw new SpecError(`${where}: "url" de vídeo no admitida; usa YouTube, Vimeo, Dailymotion o un .mp4/.webm/.ogg/.mov por http(s)`);
        }
        props = { url, autoplay: p.autoplay === undefined ? false : boolValue(p.autoplay, where, 'autoplay') };
        box = boxFrom(raw, where);
    }
    const role = raw.role === undefined ? null : roleFrom(raw.role, type, where);
    return finalElement({ id, type, x: box.x, y: box.y, w: box.w, h: box.h, rotation: box.rotation, props, ...elementStyleFrom(raw, where, ctx), ...(role ? { role } : {}) });
}

// Ruta provisional: XiRo solo acepta imágenes de /uploads/ o http(s), y aquí todavía son asset:aN
const SRC_STANDIN = '/uploads/xiro-skill-standin.png';

/** Props de una imagen normalizadas por XiRo, con su asset:aN de vuelta en src. */
function imageProps(props) {
    const out = R.propsOf('image', { ...props, src: SRC_STANDIN });
    return { ...out, src: props.src };
}

/** El elemento tal y como lo deja normalizeElement de XiRo (orden de claves y estilo incluidos). */
function finalElement(raw) {
    if (raw.type !== 'image') return R.normalizeElement(raw);
    const el = R.normalizeElement({ ...raw, props: { ...raw.props, src: SRC_STANDIN } });
    el.props.src = raw.props.src;
    return el;
}

async function buildBackground(input, ctx) {
    const where = `${ctx.where} · background`;
    if (input === undefined) return { color: R.DEFAULT_BACKGROUND, image: null };
    if (typeof input === 'string') return { color: colorValue(input, where, 'background', false), image: null };
    if (!isObj(input)) throw new SpecError(`${where}: debe ser un color o { color, image | svg, gradient }`);
    const bg = clean(input);
    unknownKeys(bg, BACKGROUND_KEYS, where);
    const color = bg.color === undefined ? R.DEFAULT_BACKGROUND : colorValue(bg.color, where, 'color', false);
    const out = { color, image: null };
    if (bg.image !== undefined || bg.svg !== undefined) out.image = (await resolveImage({ src: bg.image, svg: bg.svg, embed: bg.embed }, ctx, where)).ref;
    if (bg.gradient !== undefined && bg.gradient !== null) out.gradient = gradientFrom(bg.gradient, where);
    return out;
}

/** Lienzo con las referencias asset:aN cambiadas por lo que pondría XiRo (/uploads/slide-<hash>.<ext>). */
export function canvasAsImported(canvas, assets) {
    return R.mapCanvasMedia(canvas, {
        image: url => {
            const id = R.assetIdOf(url);
            return id ? `/uploads/${assets.byId(id).upload}` : url;
        }
    }).canvas;
}

function sameJson(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

/** Primera ruta donde difieren dos valores JSON («elements[2].props.ratio: 1.5 → 1.4»), para los errores internos. */
function firstDiff(a, b, where = '') {
    if (sameJson(a, b)) return null;
    if (!isObj(a) && !Array.isArray(a)) return `${where || 'raíz'}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`;
    if (!b || typeof b !== 'object') return `${where}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`;
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys) {
        const d = firstDiff(a[k], b[k], Array.isArray(a) ? `${where}[${k}]` : where ? `${where}.${k}` : k);
        if (d) return d;
    }
    return `${where}: mismo contenido con otro orden de claves`;
}

/**
 * Spec → paquete. Lanza SpecError con un mensaje claro si algo no vale.
 * @returns {Promise<{name, pkg, text, canvases, imported, assets, warnings, notes}>}
 */
export async function buildPackage(spec, { baseDir }) {
    if (!isObj(spec)) throw new SpecError('el spec debe ser un objeto JSON');
    const top = clean(spec);
    unknownKeys(top, ['name', 'slides', 'background', 'elements', 'layout'], 'spec');
    if (top.slides !== undefined && (top.elements !== undefined || top.background !== undefined || top.layout !== undefined)) {
        throw new SpecError('spec: usa "slides": [...] o, para una sola diapositiva, "background" + "elements"; no las dos cosas');
    }
    const slides = top.slides !== undefined ? top.slides : [{ background: top.background, elements: top.elements, layout: top.layout }];
    if (!Array.isArray(slides) || slides.length < 1 || slides.length > R.MAX_SLIDES) {
        throw new SpecError(`spec: "slides" debe tener de 1 a ${R.MAX_SLIDES} diapositivas`);
    }
    const assets = new AssetRegistry();
    const ctx = { baseDir, assets, warnings: [], notes: [], images: new Map() };
    const canvases = [];
    for (let i = 0; i < slides.length; i++) {
        ctx.where = `Diapositiva ${i + 1}`;
        if (!isObj(slides[i])) throw new SpecError(`${ctx.where}: debe ser un objeto { background, elements }`);
        const slide = clean(slides[i]);
        unknownKeys(slide, ['background', 'elements', 'layout'], ctx.where);
        const layout = slide.layout === undefined ? null : enumValue(slide.layout, themeApi.LAYOUTS, ctx.where, 'layout');
        const elements = slide.elements === undefined ? [] : slide.elements;
        if (!Array.isArray(elements)) throw new SpecError(`${ctx.where}: "elements" debe ser una lista`);
        if (elements.length > R.MAX_ELEMENTS) throw new SpecError(`${ctx.where}: ${elements.length} elementos (máx. ${R.MAX_ELEMENTS})`);
        if (!elements.length) ctx.warnings.push(`${ctx.where}: no tiene elementos`);
        ctx.usedIds = new Set();
        ctx.seed = `${top.name || ''}|${i}`;
        const background = await buildBackground(slide.background, ctx);
        const built = [];
        // Atajos: gráfico con data → tabla oculta + vínculo; role sin caja → hueco del patrón
        const prepared = placeInSlots(expandChartData(elements, ctx.where), layout, ctx.where);
        for (let j = 0; j < prepared.length; j++) built.push(await buildElement(prepared[j], j, ctx));
        checkChartTables(built, ctx.where);
        // layout va el último: es el orden en que lo escribe normalizeCanvas de XiRo
        canvases.push({ version: R.CANVAS_VERSION, background, elements: built, ...(layout ? { layout } : {}) });
    }

    const imported = canvases.map(c => canvasAsImported(c, assets));
    imported.forEach((canvas, i) => {
        const normalized = R.normalizeCanvas(canvas);
        if (!sameJson(normalized, canvas)) {
            throw new SpecError(`Diapositiva ${i + 1}: XiRo cambiaría algún valor al importarla (${firstDiff(canvas, normalized)}; error interno del generador)`);
        }
        const errors = R.canvasSchemaErrors(canvas);
        if (errors.length) throw new SpecError(`Diapositiva ${i + 1}: ${errors.join('; ')}`);
    });

    const name = (typeof top.name === 'string' && top.name.trim()) || R.firstText(canvases[0]) || 'diapositiva';
    const pkg = {
        format: R.FORMAT,
        formatVersion: R.FORMAT_VERSION,
        generator: { app: 'XiRo', version: null, tool: TOOL_MARK },
        exportedAt: new Date().toISOString(),
        slides: canvases.map(canvas => ({ slide_type: 'canvas', slide_canvas: canvas })),
        assets: assets.list.map(a => ({ id: a.id, mime: a.mime, name: a.name, data: a.buffer.toString('base64') }))
    };
    const text = JSON.stringify(pkg);
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > R.MAX_PACKAGE_BYTES) throw new SpecError(`el paquete ocupa ${(bytes / 1048576).toFixed(1)} MB (máx. 25 MB): reduce o quita imágenes`);
    if (bytes > R.MAX_CLIPBOARD_BYTES) ctx.warnings.push(`el paquete ocupa ${(bytes / 1048576).toFixed(1)} MB: mejor «Importar archivo» que «Pegar»`);

    const result = simulateImport(text);
    if (result.warnings.length) {
        throw new SpecError(`XiRo no lo importaría limpio: ${result.warnings.map(describeWarning).join('; ')}`);
    }
    if (!sameJson(result.slides, imported)) throw new SpecError('XiRo importaría algo distinto de lo generado (error interno del generador)');
    return { name, pkg, text, bytes, canvases, imported, assets: assets.list, warnings: ctx.warnings, notes: ctx.notes };
}

export { SpecError };
