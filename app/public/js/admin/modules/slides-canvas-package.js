/**
 * @fileoverview Paquetes .xiroslide en el admin: arma el paquete de una o varias diapositivas libres (las
 * imágenes de /uploads/ van dentro en base64, los SVG tal cual), lo descarga y traduce a texto los errores
 * y avisos de exportar o importar. El formato está en core/slide-package.js (window.XiroSlidePackage).
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    // Códigos de la API → claves admin.canvas.* (slides-canvas-i18n.js)
    const ERROR_KEYS = {
        SLIDE_PACKAGE_TOO_LARGE: 'io.error.too_large',
        SLIDE_PACKAGE_INVALID: 'io.error.invalid',
        SLIDE_PACKAGE_TOO_NEW: 'io.error.too_new',
        SLIDE_PACKAGE_EMPTY: 'io.error.empty',
        NO_FILE_PROVIDED: 'io.error.no_file',
        OWNER_FORBIDDEN: 'library.forbidden'
    };
    const WARNING_KEYS = {
        ASSET_UNSUPPORTED: 'io.warn.asset_unsupported',
        ASSET_TOO_LARGE: 'io.warn.asset_too_large',
        ASSET_UNREADABLE: 'io.warn.asset_unreadable',
        SVG_UNSAFE: 'io.warn.svg_unsafe',
        MEDIA_DROPPED: 'io.warn.media_dropped',
        ELEMENTS_DROPPED: 'io.warn.elements_dropped',
        SLIDE_SKIPPED: 'io.warn.slide_skipped',
        EXTERNAL_IMAGE: 'io.warn.external_image',
        LOCAL_VIDEO: 'io.warn.local_video'
    };

    let versionPromise = null;

    function format() {
        return root.XiroSlidePackage;
    }

    function warn(warnings, code) {
        warnings.push({ code });
        return null;
    }

    /** Contenido de un Blob en base64, sin la cabecera data:. */
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }

    /** Tipo admitido por el formato: el de la respuesta o, si no vale, el de la extensión. */
    function mimeOf(blob, url) {
        const type = String(blob.type || '')
            .split(';')[0]
            .trim()
            .toLowerCase();
        return format().IMAGE_MIMES.indexOf(type) >= 0 ? type : format().mimeFromName(url);
    }

    /** Imagen de /uploads/ como asset del paquete; null (con aviso) si no se puede incluir. */
    async function readAsset(url, id, warnings) {
        try {
            const res = await root.fetch(url, { credentials: 'same-origin' });
            if (!res.ok) return warn(warnings, 'ASSET_UNREADABLE');
            const blob = await res.blob();
            const mime = mimeOf(blob, url);
            if (!mime) return warn(warnings, 'ASSET_UNSUPPORTED');
            if (blob.size > format().MAX_ASSET_BYTES) return warn(warnings, 'ASSET_TOO_LARGE');
            const name = url.split(/[?#]/)[0].split('/').pop();
            return { id, mime, name, data: await blobToBase64(blob) };
        } catch (_err) {
            return warn(warnings, 'ASSET_UNREADABLE');
        }
    }

    /** Lee cada imagen local distinta una sola vez: url → id del asset (null si no se pudo incluir). */
    async function collectAssets(canvases, warnings) {
        const ids = new Map();
        const assets = [];
        for (const canvas of canvases) {
            for (const url of root.XiroSlideCanvas.collectMediaRefs(canvas).images) {
                if (!format().isLocalUpload(url) || ids.has(url)) continue;
                const asset =
                    assets.length < format().MAX_ASSETS
                        ? await readAsset(url, 'a' + (assets.length + 1), warnings)
                        : warn(warnings, 'ASSET_UNREADABLE');
                ids.set(url, asset ? asset.id : null);
                if (asset) assets.push(asset);
            }
        }
        return { ids, assets };
    }

    function imageRef(url, ids, warnings) {
        if (format().isLocalUpload(url)) return ids.get(url) ? format().assetRef(ids.get(url)) : null;
        warn(warnings, 'EXTERNAL_IMAGE');
        return url;
    }

    /** Un vídeo de este servidor solo se puede enlazar con su dirección completa. */
    function videoRef(url, warnings) {
        if (!format().isLocalUpload(url)) return url;
        warn(warnings, 'LOCAL_VIDEO');
        return root.location.origin + url;
    }

    /** Versión de XiRo (para el campo generator del paquete); null si no se sabe. */
    function appVersion() {
        if (!versionPromise) {
            versionPromise = root
                .fetch('/api/version', { credentials: 'same-origin' })
                .then(res => (res.ok ? res.json() : {}))
                .then(data => (data && data.version) || null)
                .catch(() => null);
        }
        return versionPromise;
    }

    /**
     * Arma el paquete con las diapositivas dadas, en ese orden.
     * @param {Object[]} canvases - Lienzos (slide_canvas)
     * @returns {Promise<{pkg: Object, warnings: Array<{code: string}>}>}
     */
    async function buildPackage(canvases) {
        const warnings = [];
        const { ids, assets } = await collectAssets(canvases, warnings);
        const slides = canvases.map(
            canvas =>
                format().mapCanvasMedia(canvas, {
                    image: url => imageRef(url, ids, warnings),
                    video: url => videoRef(url, warnings)
                }).canvas
        );
        const pkg = format().createPackage({ slides, assets, appVersion: await appVersion() });
        return { pkg, warnings };
    }

    /** Descarga el texto del paquete como fichero .xiroslide. */
    function download(text, name) {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = format().fileNameFor(name);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /** Mensaje (HTML escapado) de un error de la API { code, params }; el genérico si no se conoce. */
    function errorHtml(body) {
        const key = body && ERROR_KEYS[body.code];
        return XiroCanvasEditor.th(key || 'io.error.generic', (body && body.params) || undefined);
    }

    /** Lista HTML (escapada) de los avisos, sin repetir; '' si no hay ninguno conocido. */
    function warningsHtml(warnings) {
        const lines = [];
        (warnings || []).forEach(w => {
            const key = WARNING_KEYS[w && w.code];
            if (!key) return;
            const line = XiroCanvasEditor.th(key, w.params || undefined);
            if (lines.indexOf(line) < 0) lines.push(line);
        });
        return lines.length
            ? '<ul class="xsce-io-warnings">' + lines.map(line => '<li>' + line + '</li>').join('') + '</ul>'
            : '';
    }

    /** Enseña los avisos, si hay, en el modal de aviso del admin. */
    function showWarnings(warnings, titleKey) {
        const html = warningsHtml(warnings);
        if (html && typeof root.mostrarModalError === 'function') {
            root.mostrarModalError(XiroCanvasEditor.th(titleKey), html, 'warning');
        }
    }

    XiroCanvasEditor.pkg = { buildPackage, download, errorHtml, warningsHtml, showWarnings, blobToBase64 };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.pkg;
})();
