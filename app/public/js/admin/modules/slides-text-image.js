/**
 * @fileoverview Modales para slides tipo "text-image" (título + cuerpo + imagen) en juegos personalizados.
 * Reutiliza: mostrarModalError(), dibujarPreguntasPersonalizadas(), _iniciarDropZone(),
 *            _subirArchivoImagen(), _escapeAttrImagen(), escapeHtmlForAttribute()
 */

let _slideTextoImagenDelegationReady = false;

function editarSlideTextoImagen(index) {
    const slide = currentCustomGameQuestions[index];
    if (!slide || slide.slide_type !== 'text-image') return;

    const currentSrc = slide.slide_image || '';
    const posLeft = slide.slide_image_position === 'left' ? 'checked' : '';
    const posRight = slide.slide_image_position !== 'left' ? 'checked' : '';

    const modal = document.createElement('div');
    modal.id = 'modalEditTextoImagen';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center overflow-y-auto py-4';
    modal.innerHTML = _tHtml(`
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4">
            <h3 class="text-2xl font-black text-plum-600 mb-4 flex items-center gap-2">
                <i class="fas fa-edit"></i> Editar Diapositiva Texto + Imagen
            </h3>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Título</label>
            <input id="editTITitulo" type="text" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-plum-500 outline-none transition mb-4" value="${escapeHtmlForAttribute(slide.slide_title || '')}" />
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Texto</label>
            <textarea id="editTICuerpo" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-plum-500 outline-none resize-none mb-4" rows="5">${escapeHtml(slide.slide_body)}</textarea>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Posición de la imagen</label>
            <div class="flex gap-4 mb-4">
                <label class="flex-1 flex items-center gap-2 cursor-pointer border-2 border-plum-200 rounded-xl p-3 hover:border-plum-500 transition">
                    <input type="radio" name="editTIImagenPos" value="left" ${posLeft} class="accent-plum-600" /> <span class="font-bold text-slate-700"><i class="fas fa-arrow-left mr-1 text-plum-500"></i>Izquierda</span>
                </label>
                <label class="flex-1 flex items-center gap-2 cursor-pointer border-2 border-plum-200 rounded-xl p-3 hover:border-plum-500 transition">
                    <input type="radio" name="editTIImagenPos" value="right" ${posRight} class="accent-plum-600" /> <span class="font-bold text-slate-700"><i class="fas fa-arrow-right mr-1 text-plum-500"></i>Derecha</span>
                </label>
            </div>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">Imagen actual</label>
            <div id="editTIPreviewWrap" class="w-full h-24 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border mb-3">
                <img id="editTIPreviewImg" src="${_escapeAttrImagen(currentSrc)}" class="max-w-full max-h-full object-contain" />
            </div>
            <div id="dropZoneEditTI" class="w-full h-28 border-2 border-dashed border-plum-300 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-plum-500 hover:bg-plum-50 transition select-none mb-3">
                <i class="fas fa-cloud-upload-alt text-3xl text-plum-400"></i>
                <p class="text-sm text-slate-500 font-semibold">Arrastra una nueva imagen aquí o haz clic</p>
                <p id="editTIUploadStatus" class="text-xs text-blue-600 hidden"></p>
            </div>
            <input type="file" id="editTIImagenFile" accept="image/*" class="hidden" />
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">O URL externa</label>
            <input id="editTIImagenUrl" type="text" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-plum-500 outline-none transition mb-4" value="${_escapeAttrImagen(currentSrc)}" />
            ${slideFooterFieldHtml(slide.slide_footer)}
            <div class="flex gap-3 mt-4">
                <button data-slide-text-image-action="close-edit-modal" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">Cancelar</button>
                <button data-slide-text-image-action="save-slide" data-index="${index}" class="flex-1 bg-camaleon-600 hover:bg-camaleon-700 text-white px-6 py-3 rounded-xl font-bold transition">
                    <i class="fas fa-save mr-2"></i>Guardar
                </button>
            </div>
        </div>
    `);
    document.body.appendChild(modal);

    const previewImg = document.getElementById('editTIPreviewImg');
    if (previewImg) {
        previewImg.addEventListener('error', function () {
            previewImg.style.display = 'none';
        });
    }

    _iniciarDropZone({
        dropZoneId: 'dropZoneEditTI',
        fileInputId: 'editTIImagenFile',
        statusMsgId: 'editTIUploadStatus',
        urlInputId: 'editTIImagenUrl',
        previewImgId: 'editTIPreviewImg',
        previewWrapId: 'editTIPreviewWrap'
    });
}

function cerrarModalEditTextoImagen() {
    const modal = document.getElementById('modalEditTextoImagen');
    if (modal) modal.remove();
}

function guardarEditTextoImagen(index) {
    const titulo = document.getElementById('editTITitulo')?.value?.trim();
    const cuerpo = document.getElementById('editTICuerpo')?.value?.trim();
    const finalUrl = document.getElementById('editTIImagenUrl')?.value?.trim();
    const posRadio = document.querySelector('input[name="editTIImagenPos"]:checked');
    const posicion = posRadio ? posRadio.value : 'right';

    if (!titulo)
        return mostrarModalError(
            _t('admin.common.validation_title', null, '⚠️ Validación'),
            'Por favor, escribe un título',
            'warning'
        );
    if (!cuerpo)
        return mostrarModalError(
            _t('admin.common.validation_title', null, '⚠️ Validación'),
            'Por favor, escribe el texto',
            'warning'
        );
    if (!finalUrl)
        return mostrarModalError(
            _t('admin.common.validation_title', null, '⚠️ Validación'),
            'Por favor, sube una imagen o introduce una URL',
            'warning'
        );

    currentCustomGameQuestions[index].slide_title = titulo;
    currentCustomGameQuestions[index].slide_body = cuerpo;
    currentCustomGameQuestions[index].slide_image = finalUrl;
    currentCustomGameQuestions[index].slide_image_position = posicion;

    currentCustomGameQuestions[index].slide_footer = readSlideFooterField();

    dibujarPreguntasPersonalizadas();
    cerrarModalEditTextoImagen();
}

function initSlideTextoImagenDelegation() {
    if (_slideTextoImagenDelegationReady) return;
    _slideTextoImagenDelegationReady = true;

    document.addEventListener('click', event => {
        const actionElement = event.target.closest('[data-slide-text-image-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.slideTextImageAction;
        switch (action) {
            case 'close-edit-modal':
                cerrarModalEditTextoImagen();
                break;
            case 'save-slide': {
                const index = Number(actionElement.dataset.index);
                if (Number.isInteger(index)) guardarEditTextoImagen(index);
                break;
            }
            default:
                break;
        }
    });
}

initSlideTextoImagenDelegation();
