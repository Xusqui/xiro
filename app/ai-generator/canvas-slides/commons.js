'use strict';

/**
 * @fileoverview Fotos libres de Wikimedia Commons para las diapositivas con IA, cuando el usuario pide imágenes
 * sin adjuntarlas: la IA escribe una búsqueda corta en inglés y aquí se elige la primera foto que sirve
 * (JPEG, PNG o WebP de 800 px o más, proporción entre 1:2 y 5:2, con licencia y sin temas para adultos en el
 * título ni en las categorías), se descarga a 1600 px de ancho y se devuelve con su crédito (autor, licencia y
 * fuente), que la diapositiva enseña al pie. Las peticiones pasan por remote-image.js, con las mismas
 * protecciones que una importación.
 *
 * Con { drawings: true } (mapas y diagramas de «Toca la imagen») la búsqueda no se limita a fotos y
 * acepta SVG: se descarga su miniatura, que Commons sirve en PNG, nunca el SVG.
 */

const { fetchRemote } = require('../../services/slide-package/remote-image');

const API = 'https://commons.wikimedia.org/w/api.php';
const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const SVG_MIME = 'image/svg+xml';
const MIN_WIDTH = 800;
const MIN_HEIGHT = 450;
const ADULT_RE = /\b(?:nud(?:e|es|ity|ism|ist|ists)|naked|sex|sexual|porn\w*|erotic\w*|genital\w*|penis|vulva|vagina|breasts?|topless|nsfw|lingerie)\b/i;
const MAX_API_BYTES = 1024 * 1024;
const MAX_ARTIST = 40;
const ENTITIES = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&#039;': "'", '&nbsp;': ' ', '&lt;': '<', '&gt;': '>' };

/**
 * URL de búsqueda: 10 resultados con su información y categorías. Sin dibujos, filetype:bitmap deja fuera
 * dibujos, PDF y vídeos; con dibujos, lo que no es imagen lo descarta usable().
 */
function searchUrl(query, { drawings = false } = {}) {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        generator: 'search',
        gsrsearch: drawings ? query : `${query} filetype:bitmap`,
        gsrnamespace: '6',
        gsrlimit: '10',
        prop: 'imageinfo|categories',
        clshow: '!hidden',
        cllimit: 'max',
        iiprop: 'url|size|mime|extmetadata',
        iiurlwidth: '1600',
        iiextmetadatafilter: 'LicenseShortName|Artist'
    });
    return `${API}?${params}`;
}

/** Texto sin etiquetas HTML ni entidades, en una sola línea. */
function plainText(html) {
    return String(html || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&(?:amp|quot|#0?39|nbsp|lt|gt);/g, entity => ENTITIES[entity])
        .replace(/\s+/g, ' ')
        .trim();
}

/** Crédito de la foto: «autor · licencia · Wikimedia Commons» (sin autor si no lo indica). */
function creditOf(meta) {
    const artist = plainText(meta.Artist && meta.Artist.value);
    const license = plainText(meta.LicenseShortName && meta.LicenseShortName.value);
    const who = artist.length > MAX_ARTIST ? artist.slice(0, MAX_ARTIST - 1).trim() + '…' : artist;
    return [who, license, 'Wikimedia Commons'].filter(Boolean).join(' · ');
}

/** Tamaño y formato: foto grande o, con dibujos, un SVG con miniatura PNG (su tamaño nominal no importa). */
function usableFormat(info, drawings) {
    if (drawings && info.mime === SVG_MIME) return Boolean(info.thumburl);
    return PHOTO_MIMES.includes(info.mime) && info.width >= MIN_WIDTH && info.height >= MIN_HEIGHT;
}

/** true si la página sirve: formato y tamaño, proporción razonable, con licencia y sin temas para adultos. */
function usable(page, drawings) {
    const info = page.imageinfo && page.imageinfo[0];
    if (!info || !usableFormat(info, drawings)) return false;
    const ratio = info.width / info.height;
    if (ratio < 0.5 || ratio > 2.5) return false;
    const categories = (page.categories || []).map(c => c.title).join(' ');
    const meta = info.extmetadata || {};
    return Boolean(meta.LicenseShortName && meta.LicenseShortName.value) && !ADULT_RE.test(`${page.title} ${categories}`);
}

/**
 * Primera foto que sirve de la respuesta de la API, por orden de relevancia.
 * @param {Object} data - JSON de la búsqueda (searchUrl)
 * @param {{drawings?: boolean}} [o] - drawings: acepta SVG (mapas, diagramas)
 * @returns {{url: string, credit: string, title: string}|null}
 */
function pickPhoto(data, { drawings = false } = {}) {
    const pages = ((data && data.query && data.query.pages) || []).slice().sort((a, b) => (a.index || 0) - (b.index || 0));
    const page = pages.find(candidate => usable(candidate, drawings));
    if (!page) return null;
    const info = page.imageinfo[0];
    return { url: info.thumburl || info.url, credit: creditOf(info.extmetadata), title: page.title };
}

/**
 * Busca y descarga una foto libre de Commons.
 * @param {string} query - 2 a 4 palabras, mejor en inglés
 * @param {Object} [o]
 * @param {AbortSignal} [o.signal]
 * @param {Function} [o.fetch] - Como fetchRemote (inyectable en tests)
 * @param {boolean} [o.drawings] - Admite mapas y diagramas SVG (se descarga su miniatura PNG)
 * @returns {Promise<{buffer: Buffer, credit: string}|null>} null si no hay ninguna que sirva
 */
async function searchPhoto(query, { signal, fetch = fetchRemote, drawings = false } = {}) {
    const res = await fetch(searchUrl(query, { drawings }), { accept: 'application/json', maxBytes: MAX_API_BYTES, signal });
    let data;
    try {
        data = JSON.parse(res.body.toString('utf8'));
    } catch (_err) {
        return null;
    }
    const photo = pickPhoto(data, { drawings });
    if (!photo) return null;
    const image = await fetch(photo.url, { signal });
    return { buffer: image.body, credit: photo.credit };
}

module.exports = { searchPhoto, pickPhoto, searchUrl, creditOf };
