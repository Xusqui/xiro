/**
 * @fileoverview Modales para slides tipo "text-image" (título + cuerpo + imagen) en juegos personalizados.
 * Reutiliza: mostrarModalError(), dibujarPreguntasPersonalizadas(), _iniciarDropZone(),
 *            _subirArchivoImagen(), _escapeAttrImagen(), escapeHtmlForAttribute()
 */

let _slideTextoImagenDelegationReady = false;

function mostrarModalTextoImagen() {
    const modal = document.createElement('div');
    modal.id = 'modalTextoImagen';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center overflow-y-auto py-4';
    modal.innerHTML = _tHtml(`
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4">
            <h3 class="text-2xl font-black text-violet-600 mb-2 flex items-center gap-2">
                <i class="fas fa-columns"></i> Diapositiva Texto + Imagen
            </h3>
            <p class="text-sm text-slate-600 mb-4">Título y texto a un lado, imagen al otro. La imagen solo es visible en el presentador.</p>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Título</label>
            <input id="tiTextoImagenTitulo" type="text" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-violet-500 outline-none transition mb-4" placeholder="Ej: El sistema solar" />
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Texto</label>
            <textarea id="tiTextoImagenCuerpo" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-violet-500 outline-none resize-none mb-4" rows="5" placeholder="Ej: El Sol ocupa el 99,8% de la masa total del sistema solar..."></textarea>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Posición de la imagen</label>
            <div class="flex gap-4 mb-4">
                <label class="flex-1 flex items-center gap-2 cursor-pointer border-2 border-violet-200 rounded-xl p-3 hover:border-violet-500 transition has-[:checked]:border-violet-600 has-[:checked]:bg-violet-50">
                    <input type="radio" name="tiImagenPos" value="left" class="accent-violet-600" /> <span class="font-bold text-slate-700"><i class="fas fa-arrow-left mr-1 text-violet-500"></i>Imagen a la izquierda</span>
                </label>
                <label class="flex-1 flex items-center gap-2 cursor-pointer border-2 border-violet-200 rounded-xl p-3 hover:border-violet-500 transition has-[:checked]:border-violet-600 has-[:checked]:bg-violet-50">
                    <input type="radio" name="tiImagenPos" value="right" checked class="accent-violet-600" /> <span class="font-bold text-slate-700"><i class="fas fa-arrow-right mr-1 text-violet-500"></i>Imagen a la derecha</span>
                </label>
            </div>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Imagen</label>
            <div id="dropZoneTI" class="w-full h-32 border-2 border-dashed border-violet-300 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-violet-500 hover:bg-violet-50 transition select-none mb-3">
                <i class="fas fa-cloud-upload-alt text-4xl text-violet-400"></i>
                <p class="text-sm text-slate-500 font-semibold">Arrastra la imagen aquí o haz clic</p>
                <p id="tiUploadStatus" class="text-xs text-blue-600 hidden"></p>
            </div>
            <input type="file" id="tiImagenFile" accept="image/*" class="hidden" />
            <div id="tiPreviewWrap" class="hidden mb-3"><img id="tiPreviewImg" src="" class="w-full max-h-36 object-contain rounded-xl border border-slate-200" /></div>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">O pega una URL externa</label>
            <input id="tiImagenUrl" type="text" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-violet-500 outline-none transition mb-4" placeholder="https://... o /uploads/..." />
            <div class="flex gap-3 mt-4">
                <button data-slide-text-image-action="close-create-modal" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">Cancelar</button>
                <button data-slide-text-image-action="add-slide" class="flex-1 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-bold transition">
                    <i class="fas fa-plus mr-2"></i>Añadir
                </button>
            </div>
        </div>
    `);
    document.body.appendChild(modal);
    _iniciarDropZone({
        dropZoneId: 'dropZoneTI', fileInputId: 'tiImagenFile', statusMsgId: 'tiUploadStatus',
        urlInputId: 'tiImagenUrl', previewImgId: 'tiPreviewImg', previewWrapId: 'tiPreviewWrap'
    });
}

function cerrarModalTextoImagen() {
    const modal = document.getElementById('modalTextoImagen');
    if (modal) modal.remove();
}

function agregarSlideTextoImagen() {
    const titulo = document.getElementById('tiTextoImagenTitulo')?.value?.trim();
    const cuerpo = document.getElementById('tiTextoImagenCuerpo')?.value?.trim();
    const finalUrl = document.getElementById('tiImagenUrl')?.value?.trim();
    const posRadio = document.querySelector('input[name="tiImagenPos"]:checked');
    const posicion = posRadio ? posRadio.value : 'right';

    if (!titulo) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, escribe un título', 'warning');
    if (!cuerpo) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, escribe el texto', 'warning');
    if (!finalUrl) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, sube una imagen o introduce una URL', 'warning');

    currentCustomGameQuestions.push({
        slide_type: 'text-image',
        slide_title: titulo,
        slide_body: cuerpo,
        slide_image: finalUrl,
        slide_image_position: posicion,
        question_id: null,
        position: currentCustomGameQuestions.length
    });
    dibujarPreguntasPersonalizadas();
    cerrarModalTextoImagen();
}

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
            <h3 class="text-2xl font-black text-violet-600 mb-4 flex items-center gap-2">
                <i class="fas fa-edit"></i> Editar Diapositiva Texto + Imagen
            </h3>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Título</label>
            <input id="editTITitulo" type="text" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-violet-500 outline-none transition mb-4" value="${escapeHtmlForAttribute(slide.slide_title || '')}" />
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Texto</label>
            <textarea id="editTICuerpo" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-violet-500 outline-none resize-none mb-4" rows="5">${escapeHtml(slide.slide_body)}</textarea>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Posición de la imagen</label>
            <div class="flex gap-4 mb-4">
                <label class="flex-1 flex items-center gap-2 cursor-pointer border-2 border-violet-200 rounded-xl p-3 hover:border-violet-500 transition">
                    <input type="radio" name="editTIImagenPos" value="left" ${posLeft} class="accent-violet-600" /> <span class="font-bold text-slate-700"><i class="fas fa-arrow-left mr-1 text-violet-500"></i>Izquierda</span>
                </label>
                <label class="flex-1 flex items-center gap-2 cursor-pointer border-2 border-violet-200 rounded-xl p-3 hover:border-violet-500 transition">
                    <input type="radio" name="editTIImagenPos" value="right" ${posRight} class="accent-violet-600" /> <span class="font-bold text-slate-700"><i class="fas fa-arrow-right mr-1 text-violet-500"></i>Derecha</span>
                </label>
            </div>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">Imagen actual</label>
            <div id="editTIPreviewWrap" class="w-full h-24 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border mb-3">
                <img id="editTIPreviewImg" src="${_escapeAttrImagen(currentSrc)}" class="max-w-full max-h-full object-contain" />
            </div>
            <div id="dropZoneEditTI" class="w-full h-28 border-2 border-dashed border-violet-300 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-violet-500 hover:bg-violet-50 transition select-none mb-3">
                <i class="fas fa-cloud-upload-alt text-3xl text-violet-400"></i>
                <p class="text-sm text-slate-500 font-semibold">Arrastra una nueva imagen aquí o haz clic</p>
                <p id="editTIUploadStatus" class="text-xs text-blue-600 hidden"></p>
            </div>
            <input type="file" id="editTIImagenFile" accept="image/*" class="hidden" />
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">O URL externa</label>
            <input id="editTIImagenUrl" type="text" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-violet-500 outline-none transition mb-4" value="${_escapeAttrImagen(currentSrc)}" />
            <div class="flex gap-3 mt-4">
                <button data-slide-text-image-action="close-edit-modal" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">Cancelar</button>
                <button data-slide-text-image-action="save-slide" data-index="${index}" class="flex-1 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-bold transition">
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
        dropZoneId: 'dropZoneEditTI', fileInputId: 'editTIImagenFile', statusMsgId: 'editTIUploadStatus',
        urlInputId: 'editTIImagenUrl', previewImgId: 'editTIPreviewImg', previewWrapId: 'editTIPreviewWrap'
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

    if (!titulo) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, escribe un título', 'warning');
    if (!cuerpo) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, escribe el texto', 'warning');
    if (!finalUrl) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, sube una imagen o introduce una URL', 'warning');

    currentCustomGameQuestions[index].slide_title = titulo;
    currentCustomGameQuestions[index].slide_body = cuerpo;
    currentCustomGameQuestions[index].slide_image = finalUrl;
    currentCustomGameQuestions[index].slide_image_position = posicion;

    dibujarPreguntasPersonalizadas();
    cerrarModalEditTextoImagen();
}

function initSlideTextoImagenDelegation() {
    if (_slideTextoImagenDelegationReady) return;
    _slideTextoImagenDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-slide-text-image-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.slideTextImageAction;
        switch (action) {
            case 'close-create-modal':
                cerrarModalTextoImagen();
                break;
            case 'add-slide':
                agregarSlideTextoImagen();
                break;
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
