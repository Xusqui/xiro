/**
 * @fileoverview Formato de intercambio de las diapositivas libres entre instalaciones de XiRo
 * (fichero .xiroslide): un JSON con las diapositivas y sus imágenes locales en base64.
 * Lo comparten el servidor (importación) y el admin (exportación, portapapeles, biblioteca).
 * Expone window.XiroSlidePackage y module.exports (Node/Jest). No lo carga tv.html.
 */
(function (root) {
    'use strict';

    const FORMAT = 'xiro-slide';
    const FORMAT_VERSION = 1;
    const FILE_EXTENSION = '.xiroslide';
    const ASSET_PREFIX = 'asset:';
    const ASSET_ID_RE = /^a\d{1,3}$/;
    const MAX_SLIDES = 100;
    const MAX_ASSETS = 500;
    const MAX_ASSET_BYTES = 5 * 1024 * 1024;
    const MAX_PACKAGE_BYTES = 25 * 1024 * 1024;
    const MAX_CLIPBOARD_BYTES = 5 * 1024 * 1024;
    const MIME_EXTENSIONS = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg'
    };
    const IMAGE_MIMES = Object.keys(MIME_EXTENSIONS);
    const NAME_EXTENSIONS = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml'
    };
    const MAX_NAME = 60;

    /**
     * @param {string} id - ID del recurso
     * @returns {string} Referencia al recurso
     */
    function assetRef(id) {
        return ASSET_PREFIX + id;
    }

    /**
     * @param {string} value - Valor a comprobar
     * @returns {string|null} ID del recurso o null si no es una referencia válida
     */
    function assetIdOf(value) {
        if (typeof value !== 'string' || !value.startsWith(ASSET_PREFIX)) return null;
        const id = value.slice(ASSET_PREFIX.length);
        return ASSET_ID_RE.test(id) ? id : null;
    }

    /**
     * @param {string} value - Valor a comprobar
     * @returns {boolean} Si es una referencia válida a un recurso
     */
    function isAssetRef(value) {
        return assetIdOf(value) !== null;
    }

    /**
     * @param {string} value - Valor a comprobar
     * @returns {boolean} Si es una URL local de subida
     */
    function isLocalUpload(value) {
        return typeof value === 'string' && value.startsWith('/uploads/');
    }

    /**
     * @param {string} name - Nombre del archivo
     * @returns {string|null} MIME type o null si no se reconoce
     */
    function mimeFromName(name) {
        const base = String(name || '').split(/[?#]/)[0];
        const lastDot = base.lastIndexOf('.');
        if (lastDot === -1) return null;
        const ext = base.slice(lastDot + 1).toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(NAME_EXTENSIONS, ext)) return null;
        return NAME_EXTENSIONS[ext];
    }

    /**
     * @param {string} url - URL a procesar
     * @returns {string} URL sin cambios
     */
    function keep(url) {
        return url;
    }

    /**
     * Copia del lienzo con cada imagen (fondo y elementos 'image') pasada por mappers.image(url) y
     * cada vídeo (elementos 'video') por mappers.video(url). Si el mapper devuelve null, el elemento
     * se quita (o el fondo se queda sin imagen). Sin mapper, la URL se conserva.
     * @returns {{canvas: Object, dropped: number}}
     */
    function mapCanvasMedia(canvas, mappers) {
        const copy = JSON.parse(JSON.stringify(canvas || {}));
        const image = (mappers && mappers.image) || keep;
        const video = (mappers && mappers.video) || keep;
        let dropped = 0;
        if (copy.background && typeof copy.background === 'object' && copy.background.image) {
            const bg = image(copy.background.image);
            if (bg === null) dropped++;
            copy.background.image = bg;
        }
        const list = Array.isArray(copy.elements) ? copy.elements : [];
        copy.elements = list.filter(el => {
            const props = el && el.props && typeof el.props === 'object' ? el.props : null;
            if (!props) return true;
            const key = el.type === 'image' ? 'src' : el.type === 'video' ? 'url' : null;
            if (!key || typeof props[key] !== 'string') return true;
            const next = (key === 'src' ? image : video)(props[key]);
            if (next === null) {
                dropped++;
                return false;
            }
            props[key] = next;
            return true;
        });
        return { canvas: copy, dropped: dropped };
    }

    /**
     * @param {Object} options - Opciones para crear el paquete
     * @returns {Object} Paquete listo para exportar
     */
    function createPackage(options) {
        const o = options || {};
        return {
            format: FORMAT,
            formatVersion: FORMAT_VERSION,
            generator: { app: 'XiRo', version: o.appVersion || null },
            exportedAt: o.exportedAt || new Date().toISOString(),
            slides: (o.slides || []).map(canvas => ({ slide_type: 'canvas', slide_canvas: canvas })),
            assets: o.assets || []
        };
    }

    /**
     * @param {string} name - Nombre del archivo
     * @returns {string} Nombre de archivo válido
     */
    function fileNameFor(name) {
        const base = String(name || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, MAX_NAME)
            .replace(/-+$/, '');
        return (base || 'diapositiva') + FILE_EXTENSION;
    }

    /**
     * @param {Object} canvas - Lienzo a procesar
     * @returns {string} Primer texto encontrado
     */
    function firstText(canvas) {
        if (!canvas || !Array.isArray(canvas.elements)) return '';
        for (const el of canvas.elements) {
            if (el && el.type === 'text' && el.props && typeof el.props.text === 'string') {
                const lines = String(el.props.text || '').split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed) return trimmed.slice(0, MAX_NAME);
                }
            }
        }
        return '';
    }

    const api = {
        FORMAT,
        FORMAT_VERSION,
        FILE_EXTENSION,
        ASSET_PREFIX,
        ASSET_ID_RE,
        MAX_SLIDES,
        MAX_ASSETS,
        MAX_ASSET_BYTES,
        MAX_PACKAGE_BYTES,
        MAX_CLIPBOARD_BYTES,
        MIME_EXTENSIONS,
        IMAGE_MIMES,
        assetRef,
        assetIdOf,
        isAssetRef,
        isLocalUpload,
        mimeFromName,
        mapCanvasMedia,
        createPackage,
        fileNameFor,
        firstText
    };

    root.XiroSlidePackage = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
