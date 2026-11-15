/**
 * Carga los módulos reales de XiRo copiados en lib/xiro/ (sync-xiro.mjs). Son CommonJS/UMD:
 * se cargan con require() desde su sitio, así que sus require() relativos funcionan igual que en
 * el repo. Si falta la copia, explica cómo hacerla.
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VENDOR_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'xiro');

if (!existsSync(path.join(VENDOR_DIR, 'origin.json'))) {
    throw new Error(`faltan los módulos de XiRo en ${VENDOR_DIR}: ejecuta node scripts/sync-xiro.mjs <ruta a la carpeta app de XiRo>`);
}

const req = createRequire(path.join(VENDOR_DIR, 'index.js'));
const core = name => req(`./public/js/core/${name}`);

export const origin = JSON.parse(readFileSync(path.join(VENDOR_DIR, 'origin.json'), 'utf8'));
export const model = core('slide-canvas-model');
export const pkg = core('slide-package');
export const style = core('slide-canvas-style');
export const richText = core('slide-canvas-richtext');
export const table = core('slide-canvas-table');
export const chart = core('slide-canvas-chart');
export const theme = core('slide-canvas-theme');
export const layouts = core('slide-canvas-layouts');
export const presets = core('slide-canvas-path-presets');
export const render = core('slide-canvas-render');
export const video = core('video-source');
export const { canvasSchema } = req('./application/validators/CanvasSlideValidator');
export const { validatePackage } = req('./application/validators/SlidePackageValidator');
export const { isSafeSvg } = req('./services/slide-package/svg-guard');
export const { detectImageType } = req('./services/slide-package/image-type');
export const { decodeDataUri, MAX_REMOTE } = req('./services/slide-package/inline-images');

/** css/slide-canvas.css sin su @import (las fuentes van aparte, desde lib/xiro/public). */
export function canvasCss() {
    return readFileSync(path.join(VENDOR_DIR, 'public/css/slide-canvas.css'), 'utf8').replace(/@import[^;]*;/g, '');
}

/**
 * @font-face de las familias pedidas con los woff2 incrustados en data: (una página file:// no puede
 * cargar fuentes de otro file://: Chrome las trata como de otro origen).
 * @param {string[]} families - Nombres de familia ('DM Sans', 'Oswald'...)
 */
export function fontsCss(families) {
    const css = readFileSync(path.join(VENDOR_DIR, 'public/css/fonts.css'), 'utf8');
    return (css.match(/@font-face\{[^}]*\}/g) || [])
        .filter(rule => families.some(family => rule.includes(`font-family:'${family}'`)))
        .map(rule =>
            rule.replace(/url\(\/fonts\/([^)]+)\)/g, (_m, file) => {
                const data = readFileSync(path.join(VENDOR_DIR, 'public/fonts', path.basename(file))).toString('base64');
                return `url(data:font/woff2;base64,${data})`;
            })
        )
        .join('\n');
}
