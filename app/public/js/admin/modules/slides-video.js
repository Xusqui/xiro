/**
 * @fileoverview Modales de la diapositiva de vídeo de los juegos personalizados: una URL
 * (YouTube, Vimeo, Dailymotion o archivo de vídeo) que solo se reproduce en el presentador.
 * Comprueba la URL con core/video-source.js (window.XiroVideoSource) y muestra una vista
 * previa. Reutiliza helpers globales: mostrarModalError(), dibujarPreguntasPersonalizadas(),
 * slideFooterFieldHtml() y currentCustomGameQuestions.
 */

let _slideVideoDelegationReady = false;
let _videoPreviewTimer = null;

const _VIDEO_PROVIDER_LABELS = {
    youtube: 'YouTube',
    vimeo: 'Vimeo',
    dailymotion: 'Dailymotion',
    file: 'Archivo de vídeo'
};
const _VIDEO_PREVIEW_DELAY_MS = 400;
const _VIDEO_URL_HINT = 'Pega la dirección de YouTube, Vimeo, Dailymotion o de un archivo .mp4, .webm, .ogg o .mov';
const _VIDEO_URL_UNSUPPORTED =
    'La URL del vídeo no es compatible: usa YouTube, Vimeo, Dailymotion o un archivo .mp4, .webm, .ogg o .mov';

function _parseVideoUrl(url) {
    return window.XiroVideoSource ? window.XiroVideoSource.parseVideoSource(url) : null;
}

function _videoModalHtml(opts) {
    return `
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
            <h3 class="text-2xl font-black text-red-600 mb-4 flex items-center gap-2">
                <i class="fas ${opts.icon}"></i> ${opts.title}
            </h3>
            <p class="text-sm text-slate-600 mb-4">El vídeo se reproduce <b>solo en la pantalla del presentador</b>, ocupando todo el espacio. Los jugadores verán un aviso para que miren la pantalla.</p>
            <div class="mb-2">
                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">URL del vídeo</label>
                <input id="videoUrl" type="text" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-red-500 outline-none transition" placeholder="https://www.youtube.com/watch?v=... o /uploads/video.mp4" value="${escapeHtml(opts.url || '')}" />
                <p id="videoUrlStatus" class="text-xs text-slate-500 mt-2"></p>
            </div>
            <div id="videoPreview" class="hidden w-full bg-black rounded-xl overflow-hidden mb-2" style="height: 200px;"></div>
            ${slideFooterFieldHtml(opts.footer || '')}
            <div class="flex gap-3 mt-6">
                ${opts.actions}
            </div>
        </div>
    `;
}

function _renderVideoStatus(source, url) {
    const statusEl = document.getElementById('videoUrlStatus');
    if (!statusEl) return;

    if (!url) {
        statusEl.className = 'text-xs text-slate-500 mt-2';
        statusEl.textContent = _VIDEO_URL_HINT;
    } else if (!source) {
        statusEl.className = 'text-xs text-red-600 mt-2';
        statusEl.textContent = _VIDEO_URL_UNSUPPORTED;
    } else {
        statusEl.className = 'text-xs text-green-600 mt-2';
        statusEl.textContent = '✓ ' + _VIDEO_PROVIDER_LABELS[source.kind];
    }
}

function _renderVideoPreview(source) {
    const preview = document.getElementById('videoPreview');
    if (!preview) return;

    preview.innerHTML = '';

    if (!source) {
        preview.classList.add('hidden');
        return;
    }

    preview.classList.remove('hidden');

    let el;
    if (source.kind === 'file') {
        el = document.createElement('video');
        el.src = source.url;
        el.controls = true;
        el.preload = 'metadata';
        el.muted = true;
        el.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    } else {
        el = document.createElement('iframe');
        el.src = source.embedUrl;
        el.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
        el.allowFullscreen = true;
        el.referrerPolicy = 'strict-origin-when-cross-origin';
        el.title = 'Vista previa del vídeo';
        el.style.cssText = 'width:100%;height:100%;border:0;';
    }

    preview.appendChild(el);
}

function _refreshVideoPreview() {
    const url = (document.getElementById('videoUrl')?.value || '').trim();
    const source = url ? _parseVideoUrl(url) : null;
    _renderVideoStatus(source, url);
    _renderVideoPreview(source);
}

function mostrarModalVideo() {
    const modal = document.createElement('div');
    modal.id = 'modalVideo';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center';
    modal.innerHTML = _tHtml(
        _videoModalHtml({
            title: 'Diapositiva de Vídeo',
            icon: 'fa-film',
            url: '',
            footer: '',
            actions: `
            <button data-slide-video-action="close-create-modal" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">Cancelar</button>
            <button data-slide-video-action="add-slide" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition">
                <i class="fas fa-plus mr-2"></i>Añadir
            </button>
        `
        })
    );
    document.body.appendChild(modal);
    _refreshVideoPreview();
    document.getElementById('videoUrl')?.focus();
}

function cerrarModalVideo() {
    const modal = document.getElementById('modalVideo');
    if (modal) modal.remove();
}

function _readValidVideoUrl() {
    const urlInput = document.getElementById('videoUrl');
    if (!urlInput) return null;

    const url = urlInput.value.trim();

    if (!url) {
        mostrarModalError(
            _t('admin.common.validation_title', null, '⚠️ Validación'),
            'Por favor, introduce la URL del vídeo',
            'warning'
        );
        return null;
    }

    if (!_parseVideoUrl(url)) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), _VIDEO_URL_UNSUPPORTED, 'warning');
        return null;
    }

    return url;
}

function agregarSlideVideo() {
    const url = _readValidVideoUrl();
    if (!url) return;

    currentCustomGameQuestions.push({
        slide_type: 'video',
        slide_footer: readSlideFooterField(),
        slide_video: url,
        question_id: null,
        position: currentCustomGameQuestions.length
    });

    dibujarPreguntasPersonalizadas();
    cerrarModalVideo();
}

function editarSlideVideo(index) {
    const slide = currentCustomGameQuestions[index];
    if (!slide || slide.slide_type !== 'video') return;

    const modal = document.createElement('div');
    modal.id = 'modalEditVideo';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center';
    modal.innerHTML = _tHtml(
        _videoModalHtml({
            title: 'Editar Diapositiva de Vídeo',
            icon: 'fa-edit',
            url: slide.slide_video,
            footer: slide.slide_footer,
            actions: `
            <button data-slide-video-action="close-edit-modal" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">Cancelar</button>
            <button data-slide-video-action="save-slide" data-index="${index}" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition">
                <i class="fas fa-save mr-2"></i>Guardar
            </button>
        `
        })
    );
    document.body.appendChild(modal);
    _refreshVideoPreview();
}

function cerrarModalEditVideo() {
    const modal = document.getElementById('modalEditVideo');
    if (modal) modal.remove();
}

function guardarEditVideo(index) {
    const url = _readValidVideoUrl();
    if (!url) return;

    currentCustomGameQuestions[index].slide_video = url;
    currentCustomGameQuestions[index].slide_footer = readSlideFooterField();

    dibujarPreguntasPersonalizadas();
    cerrarModalEditVideo();
}

function customVideoCardBody(q) {
    const source = _parseVideoUrl(q.slide_video);
    const label = source ? _VIDEO_PROVIDER_LABELS[source.kind] : 'URL no compatible';
    const url = q.slide_video || '';

    return `
        <div class="flex-1 flex gap-4">
            <div class="w-32 h-24 bg-black rounded flex-shrink-0 flex items-center justify-center"><i class="fas fa-film text-red-400 text-3xl"></i></div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                    <span class="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fas fa-film mr-1"></i>${_t('admin.custom.slide_video_badge', null, 'DIAPOSITIVA VÍDEO')}</span>
                    <span class="${source ? 'text-red-700' : 'text-red-500'} text-xs font-bold">${escapeHtml(label)}</span>
                </div>
                <p class="text-xs text-red-900 truncate" title="${escapeHtml(url)}">${escapeHtml(url)}</p>
                <p class="text-xs text-red-600 mt-2 italic"><i class="fas fa-eye mr-1"></i>${_t('admin.custom.slide_video_help', null, 'Solo se reproduce en el presentador')}</p>
            </div>
        </div>
    `;
}

function initSlideVideoDelegation() {
    if (_slideVideoDelegationReady) return;
    _slideVideoDelegationReady = true;

    document.addEventListener('click', event => {
        const actionElement = event.target.closest('[data-slide-video-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.slideVideoAction;
        switch (action) {
            case 'close-create-modal':
                cerrarModalVideo();
                break;
            case 'add-slide':
                agregarSlideVideo();
                break;
            case 'close-edit-modal':
                cerrarModalEditVideo();
                break;
            case 'save-slide': {
                const index = Number(actionElement.dataset.index);
                if (Number.isInteger(index)) guardarEditVideo(index);
                break;
            }
            default:
                break;
        }
    });

    document.addEventListener('input', event => {
        if (event.target && event.target.id === 'videoUrl') {
            clearTimeout(_videoPreviewTimer);
            _videoPreviewTimer = setTimeout(_refreshVideoPreview, _VIDEO_PREVIEW_DELAY_MS);
        }
    });
}

initSlideVideoDelegation();
