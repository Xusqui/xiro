/**
 * @fileoverview Diálogo para elegir la imagen o el vídeo de un elemento de la diapositiva
 * libre (o la imagen de fondo). Reutiliza la subida de archivos del admin
 * (_subirArchivoImagen de slides-image.js → /api/upload) y la validación de vídeo de
 * core/video-source.js. Mientras está abierto (#modalLienzoMedia) el editor ignora los atajos.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = root.XiroCanvasEditor = root.XiroCanvasEditor || {};

    const MODAL_ID = 'modalLienzoMedia';
    const TEXTS = {
        image: { title: 'Imagen', placeholder: 'https://... o /uploads/...', hint: 'Sube un archivo o pega la dirección de una imagen' },
        video: { title: 'Vídeo', placeholder: 'https://www.youtube.com/watch?v=... o /uploads/video.mp4', hint: 'YouTube, Vimeo, Dailymotion o un archivo .mp4, .webm, .ogg o .mov' }
    };

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
        const t = TEXTS[kind];
        const esc = root.XiroSlideCanvasRender.escapeText;
        const upload = kind === 'image'
            ? '<label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Subir archivo</label>'
              + '<input id="lienzoMediaFile" type="file" accept="image/*" class="w-full text-sm mb-4">'
            : '';
        return '<div class="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">'
            + '<h3 class="text-xl font-black text-plum-700 mb-4">' + esc(t.title) + '</h3>' + upload
            + '<label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Dirección</label>'
            + '<input id="lienzoMediaUrl" type="text" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-plum-500 outline-none" placeholder="' + esc(t.placeholder) + '">'
            + '<p id="lienzoMediaStatus" class="text-xs text-slate-500 mt-2">' + esc(t.hint) + '</p>'
            + '<div class="flex gap-3 mt-6">'
            + '<button type="button" data-lienzo-media="cancel" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-3 rounded-xl font-bold transition">Cancelar</button>'
            + '<button type="button" data-lienzo-media="accept" class="flex-1 bg-camaleon-600 hover:bg-camaleon-700 text-white px-4 py-3 rounded-xl font-bold transition">Añadir</button>'
            + '</div></div>';
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
            if (!source) return setStatus('La URL del vídeo no es compatible', false);
            close();
            return onDone({ url });
        }
        if (!root.XiroSlideCanvas.isSafeMediaUrl(url)) return setStatus('La imagen debe estar en /uploads/ o ser una URL http(s)', false);
        setStatus('Comprobando la imagen…', true);
        loadRatio(url, (ratio) => {
            if (ratio === false) return setStatus('No se ha podido cargar la imagen', false);
            close();
            onDone({ src: url, ratio });
        });
    }

    function open(kind, onDone) {
        close();
        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'fixed inset-0 bg-slate-900/80 flex items-center justify-center';
        modal.style.zIndex = '70';
        modal.innerHTML = modalHtml(kind);
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            const action = e.target.closest('[data-lienzo-media]');
            if (action) action.getAttribute('data-lienzo-media') === 'accept' ? accept(kind, onDone) : close();
        });
        modal.addEventListener('keydown', (e) => {
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
        openImage: (onDone) => open('image', onDone),
        openVideo: (onDone) => open('video', onDone),
        close
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.media;
})();
