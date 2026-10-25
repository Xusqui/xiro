'use strict';

/**
 * @fileoverview De las diapositivas saneadas (spec.js) al paquete .xiroslide: cada diseño se convierte en los
 * elementos del lienzo con los colores del estilo elegido, y los iconos, los gráficos SVG y las fotos
 * descargadas (media.js) van como imágenes del paquete (asset:aN); las adjuntas, con su URL de /uploads/.
 * generator.js lo pasa por importSlidePackage, igual que «Importar archivo».
 */

const SlidePackage = require('../../public/js/core/slide-package');
const { getTheme } = require('./themes');
const { iconSvg } = require('./icons');
const { cover, statement, text, bullets, quote, stat } = require('./layouts-text');
const { cards, steps, comparison } = require('./layouts-grid');
const { question } = require('./layouts-question');
const { flow, process, timeline } = require('./layouts-diagram');
const { image, split } = require('./layouts-media');

// Un maquetador por diseño de spec.js (LAYOUTS)
const BUILDERS = { cover, statement, text, bullets, quote, stat, cards, steps, comparison, question, flow, process, timeline, image, split };

/** Imágenes del paquete sin repetir: cada contenido distinto es un asset. */
function assetRegistry() {
    const assets = [];
    const refs = new Map();
    const addData = (data, mime) => {
        if (!refs.has(data)) {
            const id = 'a' + (assets.length + 1);
            assets.push({ id, mime, name: `${id}.${SlidePackage.MIME_EXTENSIONS[mime]}`, data });
            refs.set(data, SlidePackage.assetRef(id));
        }
        return refs.get(data);
    };
    const add = svg => addData(Buffer.from(svg, 'utf8').toString('base64'), 'image/svg+xml');
    const addImage = img => (img.src ? img.src : addData(img.buffer.toString('base64'), img.mime));
    return { assets, add, addImage };
}

/**
 * Paquete .xiroslide con las diapositivas diseñadas.
 * @param {Object[]} slides - Diapositivas saneadas (con layout)
 * @param {string} themeName - Estilo de themes.js
 * @returns {Object} Paquete (formato de core/slide-package.js)
 */
function buildPackage(slides, themeName) {
    const theme = getTheme(themeName);
    const registry = assetRegistry();
    const ctx = {
        theme,
        asset: registry.add,
        photo: registry.addImage,
        icon: (name, color) => {
            const svg = iconSvg(name, color);
            return svg ? registry.add(svg) : null;
        }
    };
    const canvases = slides.map(slide => ({
        version: 1,
        background: { color: theme.bg, image: null },
        elements: BUILDERS[slide.layout](slide, ctx)
    }));
    return SlidePackage.createPackage({ slides: canvases, assets: registry.assets, appVersion: null });
}

module.exports = { buildPackage, LAYOUT_BUILDERS: BUILDERS };
