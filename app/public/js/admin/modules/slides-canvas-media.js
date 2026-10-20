/**
 * @fileoverview Diálogo para elegir la imagen o el vídeo de un elemento de la diapositiva
 * libre (o la imagen de fondo). Reutiliza la subida de archivos del admin
 * (_subirArchivoImagen de slides-image.js → /api/upload) y la validación de vídeo de
 * core/video-source.js. Mientras está abierto (#modalLienzoMedia) el editor ignora los atajos.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const MODAL_ID = 'modalLienzoMedia';
    // Textos: claves admin.canvas.media.<tipo>_* (slides-canvas-i18n.js)
    const ICONS = { image: 'fa-image', video: 'fa-film' };

    function close() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.remove();
    }

    function setStatus(text, ok) {
        const status = document.getElementById('lienzoMediaStatus');
        if (!status) return;
        status.className = 'text-xs mt-2 ' + (ok ? 'text-green-600' : 'text-red-600');
        status.textContent = text;
    }

    function modalHtml(kind) {
        const th = XiroCanvasEditor.th;
        const upload =
            kind === 'image'
                ? '<label class="xsce-label" for="lienzoMediaFile">' +
                  th('media.upload') +
                  '</label>' +
                  '<input id="lienzoMediaFile" type="file" accept="image/*" class="xsce-file">'
                : '';
        return (
            '<div class="xsce-dialog" role="dialog" aria-modal="true" aria-labelledby="lienzoMediaTitulo" style="max-width:460px">' +
            '<div class="xsce-dialog-head"><span class="xsce-tile"><i class="fas ' +
            ICONS[kind] +
            '" aria-hidden="true"></i></span>' +
            '<div class="xsce-heading"><h3 id="lienzoMediaTitulo">' +
            th('media.' + kind + '_title') +
            '</h3></div></div>' +
            upload +
            '<label class="xsce-label" for="lienzoMediaUrl">' +
            th('media.address') +
            '</label>' +
            '<input id="lienzoMediaUrl" type="text" class="xsce-input" placeholder="' +
            th('media.' + kind + '_placeholder') +
            '">' +
            '<p id="lienzoMediaStatus" class="text-xs text-slate-500 mt-2">' +
            th('media.' + kind + '_hint') +
            '</p>' +
            '<div class="xsce-dialog-foot">' +
            '<button type="button" data-lienzo-media="cancel" class="xsce-btn xsce-btn--ghost">' +
            th('cancel') +
            '</button>' +
            '<button type="button" data-lienzo-media="accept" class="xsce-btn xsce-btn--primary"><i class="fas fa-plus" aria-hidden="true"></i>' +
            th('media.add') +
            '</button>' +
            '</div></div>'
        );
    }

    /** Lee la proporción natural de la imagen; null si no carga (se usa 16:9 por defecto). */
    function loadRatio(src, done) {
        const img = new Image();
        img.onload = () => done(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null);
        img.onerror = () => done(false);
        img.src = src;
    }

    function accept(kind, onDone) {
        const url = (document.getElementById('lienzoMediaUrl').value || '').trim();
        if (kind === 'video') {
            const source = root.XiroVideoSource ? root.XiroVideoSource.parseVideoSource(url) : null;
            if (!source) return setStatus(XiroCanvasEditor.t('media.bad_video'), false);
            close();
            return onDone({ url });
        }
        if (!root.XiroSlideCanvas.isSafeMediaUrl(url))
            return setStatus(XiroCanvasEditor.t('media.bad_image_url'), false);
        setStatus(XiroCanvasEditor.t('media.checking'), true);
        loadRatio(url, ratio => {
            if (ratio === false) return setStatus(XiroCanvasEditor.t('media.load_error'), false);
            close();
            onDone({ src: url, ratio });
        });
    }

    function open(kind, onDone) {
        close();
        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'xsce-overlay-dim';
        modal.style.zIndex = '70';
        modal.innerHTML = modalHtml(kind);
        document.body.appendChild(modal);
        modal.addEventListener('click', e => {
            const action = e.target.closest('[data-lienzo-media]');
            if (action) action.getAttribute('data-lienzo-media') === 'accept' ? accept(kind, onDone) : close();
        });
        modal.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Escape') close();
            if (e.key === 'Enter') accept(kind, onDone);
        });
        const file = document.getElementById('lienzoMediaFile');
        if (file) {
            file.addEventListener('change', async () => {
                if (!file.files.length || typeof root._subirArchivoImagen !== 'function') return;
                const url = await root._subirArchivoImagen(file.files[0], 'lienzoMediaStatus');
                if (url) document.getElementById('lienzoMediaUrl').value = url;
            });
        }
        document.getElementById('lienzoMediaUrl').focus();
    }

    XiroCanvasEditor.media = {
        openImage: onDone => open('image', onDone),
        openVideo: onDone => open('video', onDone),
        close
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.media;
})();
