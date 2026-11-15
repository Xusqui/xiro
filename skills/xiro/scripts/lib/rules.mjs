/**
 * Reglas del formato .xiroslide y de la diapositiva libre de XiRo. Ya no son una copia a mano:
 * delegan en los módulos reales de XiRo copiados en lib/xiro/ (sync-xiro.mjs), así que siguen al
 * día con solo volver a sincronizar:
 *   public/js/core/slide-package.js                   sobre del paquete, límites, mapCanvasMedia, fileNameFor
 *   public/js/core/slide-canvas-model.js (+ style, richtext, table, path)   normalizeCanvas
 *   application/validators/CanvasSlideValidator.js    esquema Joi del lienzo (con CanvasText/TableSchema)
 *   application/validators/SlidePackageValidator.js   esquema Joi del sobre
 */

import { model, pkg, canvasSchema, validatePackage } from './xiro.mjs';

export const FORMAT = pkg.FORMAT;
export const FORMAT_VERSION = pkg.FORMAT_VERSION;
export const FILE_EXTENSION = '.xiroslide';
export const ASSET_PREFIX = 'asset:';
export const MAX_SLIDES = pkg.MAX_SLIDES;
export const MAX_ASSETS = pkg.MAX_ASSETS;
export const MAX_ASSET_BYTES = pkg.MAX_ASSET_BYTES;
export const MAX_PACKAGE_BYTES = pkg.MAX_PACKAGE_BYTES;
export const MAX_CLIPBOARD_BYTES = pkg.MAX_CLIPBOARD_BYTES;
export const MIME_EXTENSIONS = pkg.MIME_EXTENSIONS;
export const IMAGE_MIMES = pkg.IMAGE_MIMES;

export const WIDTH = model.WIDTH;
export const HEIGHT = model.HEIGHT;
export const CANVAS_VERSION = model.VERSION;
export const MIN_SIZE = model.MIN_SIZE;
export const MAX_URL = model.MAX_URL;
export const MAX_TEXT = model.MAX_TEXT;
export const MAX_ELEMENTS = model.MAX_ELEMENTS;
export const MAX_JSON_BYTES = model.MAX_JSON_BYTES;
export const FONTS = model.FONTS;
export const FONT_KEYS = Object.keys(model.FONTS);
export const ELEMENT_TYPES = model.ELEMENT_TYPES;
export const SHAPES = model.SHAPES;
export const DEFAULT_BACKGROUND = model.DEFAULT_BACKGROUND;
// slide-canvas-model.js no las exporta; son las mismas expresiones
export const COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
export const ID_RE = /^el_[a-z0-9]{4,16}$/;
export const GROUP_ID_RE = model.GROUP_ID_RE;

export const isColor = model.isColor;
export const isSafeMediaUrl = model.isSafeMediaUrl;
export const normalizeCanvas = model.normalizeCanvas;
export const normalizeElement = model.normalizeElement;
export const collectMediaRefs = model.collectMediaRefs;
export const assetRef = pkg.assetRef;
export const assetIdOf = pkg.assetIdOf;
export const isLocalUpload = pkg.isLocalUpload;
export const mapCanvasMedia = pkg.mapCanvasMedia;
export const fileNameFor = pkg.fileNameFor;
export const firstText = pkg.firstText;

/** Props normalizadas de un elemento de ese tipo, o null si XiRo lo descartaría. */
export function propsOf(type, props) {
    const el = model.normalizeElement({ id: 'el_probe', type, x: 0, y: 0, w: 100, h: 100, props });
    return el ? el.props : null;
}

export const textProps = p => propsOf('text', p);
export const shapeProps = p => propsOf('shape', p);

/** «elements[2].props.runs[0].size» → «elemento 3 · props.runs[0].size». */
function pathLabel(segments) {
    if (segments[0] !== 'elements' || typeof segments[1] !== 'number') return segments.join('.') || 'lienzo';
    const rest = segments.slice(2).reduce((acc, s) => (typeof s === 'number' ? `${acc}[${s}]` : acc ? `${acc}.${s}` : s), '');
    return `elemento ${segments[1] + 1}${rest ? ` · ${rest}` : ''}`;
}

/** Errores del lienzo ya listo para guardar (con URLs de /uploads/), con el canvasSchema real de XiRo. */
export function canvasSchemaErrors(canvas) {
    const { error } = canvasSchema.validate(canvas, { abortEarly: false });
    if (!error) return [];
    return [...new Set(error.details.map(d => `${pathLabel(d.path)}: ${d.message}`))];
}

/** Primer error del sobre (como SlidePackageValidator de XiRo), o null si es válido. */
export function envelopeError(data) {
    return validatePackage(data).error;
}
