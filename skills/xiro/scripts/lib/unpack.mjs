/**
 * .xiroslide → spec editable: escribe spec.json y las imágenes en assets/ para cambiar una diapositiva
 * exportada de XiRo y volver a construirla con «build».
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import * as R from './rules.mjs';
import { detectImageType } from './media.mjs';
import { simulateImport, describeWarning } from './check.mjs';

/**
 * @param {string} text - Contenido del .xiroslide
 * @param {string} dir - Carpeta de destino
 * @param {string} name - Nombre para el spec
 * @returns {{specPath: string, files: string[], warnings: string[]}}
 */
export function unpackPackage(text, dir, name) {
    const { pkg, warnings } = simulateImport(text);
    mkdirSync(path.join(dir, 'assets'), { recursive: true });
    const files = new Map();
    for (const asset of pkg.assets) {
        const buffer = Buffer.from(asset.data, 'base64');
        const type = detectImageType(buffer) || asset.mime;
        const file = `assets/${asset.id}.${R.MIME_EXTENSIONS[type] || 'bin'}`;
        writeFileSync(path.join(dir, file), buffer);
        files.set(asset.id, file);
    }
    const imageSource = url => {
        const id = R.assetIdOf(url);
        if (id) return files.has(id) ? { src: files.get(id) } : null;
        return /^https?:\/\//i.test(url) ? { src: url, embed: false } : null;
    };
    const slides = pkg.slides.map(slide => {
        const c = slide.slide_canvas || {};
        const bg = c.background || {};
        const background = { color: bg.color || R.DEFAULT_BACKGROUND };
        const bgImage = bg.image ? imageSource(bg.image) : null;
        if (bgImage) {
            background.image = bgImage.src;
            if (bgImage.embed === false) background.embed = false;
        }
        if (bg.gradient) background.gradient = bg.gradient;
        const elements = (Array.isArray(c.elements) ? c.elements : []).flatMap(el => {
            if (!el || el.type !== 'image' || !el.props) return [el];
            const source = imageSource(el.props.src);
            if (!source) return [];
            return [{ ...el, props: { ...el.props, ...source } }];
        });
        return { background, elements };
    });
    const spec = { name, slides };
    const specPath = path.join(dir, 'spec.json');
    writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n');
    return { specPath, files: [...files.values()], warnings: warnings.map(describeWarning) };
}
