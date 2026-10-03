/**
 * @fileoverview Modales para slides tipo "image" (solo imagen) en juegos personalizados.
 * Reutiliza helpers globales: mostrarModalError(), dibujarPreguntasPersonalizadas(),
 * currentCustomGameQuestions (estado global).
 */

let _slideImagenDelegationReady = false;

// ==============================
// [TAG:CREATE] Crear slide "image"
// ==============================

function mostrarModalImagen() {
    const modal = document.createElement('div');
    modal.id = 'modalImagen';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center';
    modal.innerHTML = _tHtml(`
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
            <h3 class="text-2xl font-black text-pink-600 mb-4 flex items-center gap-2">
                <i class="fas fa-image"></i> Diapositiva de Imagen
            </h3>
            <p class="text-sm text-slate-600 mb-4">Añade una imagen que se mostrará a <b>pantalla completa</b> (sin respuestas).</p>

            <div class="mb-4">
                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Arrastra y suelta la imagen aquí</label>
                <div id="dropZoneImagen"
                    class="w-full h-36 border-2 border-dashed border-pink-300 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-pink-500 hover:bg-pink-50 transition select-none"
                    title="Haz clic o arrastra una imagen">
                    <i class="fas fa-cloud-upload-alt text-4xl text-pink-400"></i>
                    <p class="text-sm text-slate-500 font-semibold">Arrastra la imagen aquí o haz clic para seleccionar</p>
                    <p id="uploadStatusMsg" class="text-xs text-blue-600 hidden"></p>
                </div>
                <input type="file" id="imagenFile" accept="image/*" class="hidden" />
            </div>

            <div id="previewWrapImagen" class="hidden mb-4">
                <img id="previewImagen" class="w-full max-h-40 object-contain rounded-xl border border-slate-200" />
            </div>

            <div class="mb-2">
                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">O pega una URL externa</label>
                <input id="imagenUrl" type="text" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-pink-500 outline-none transition" placeholder="https://... o /uploads/..." />
            </div>

            <div class="flex gap-3 mt-6">
                <button data-slide-image-action="close-create-modal" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">Cancelar</button>
                <button data-slide-image-action="add-slide" class="flex-1 bg-camaleon-600 hover:bg-camaleon-700 text-white px-6 py-3 rounded-xl font-bold transition">
                    <i class="fas fa-plus mr-2"></i>Añadir
                </button>
            </div>
        </div>
    `);
    document.body.appendChild(modal);
    _iniciarDropZone({
        dropZoneId: 'dropZoneImagen', fileInputId: 'imagenFile', statusMsgId: 'uploadStatusMsg',
        urlInputId: 'imagenUrl', previewImgId: 'previewImagen', previewWrapId: 'previewWrapImagen'
    });
}

function cerrarModalImagen() {
    const modal = document.getElementById('modalImagen');
    if (modal) modal.remove();
}

function _iniciarDropZone({ dropZoneId, fileInputId, statusMsgId, urlInputId, previewImgId, previewWrapId }) {
    const zone = document.getElementById(dropZoneId);
    const fileInput = document.getElementById(fileInputId);
    if (!zone || !fileInput) return;

    const upload = async (file) => {
        const url = await _subirArchivoImagen(file, statusMsgId);
        if (url) {
            const urlInput = document.getElementById(urlInputId);
            if (urlInput) urlInput.value = url;
            const previewImg = document.getElementById(previewImgId);
            const previewWrap = document.getElementById(previewWrapId);
            if (previewImg && previewWrap) {
                previewImg.src = url;
                previewWrap.classList.remove('hidden');
            }
            zone.innerHTML = _tHtml(`<i class="fas fa-check-circle text-3xl text-green-500"></i><p class="text-sm text-green-600 font-bold">Imagen subida correctamente</p>`);
        }
    };

    zone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) upload(fileInput.files[0]);
    });
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('border-pink-500', 'bg-pink-50');
    });
    zone.addEventListener('dragleave', () => {
        zone.classList.remove('border-pink-500', 'bg-pink-50');
    });
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('border-pink-500', 'bg-pink-50');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            upload(file);
        } else {
            mostrarModalError(_t('admin.common.warning_title', null, '⚠️ Advertencia'), 'Solo se admiten imágenes', 'warning');
        }
    });
}

async function _subirArchivoImagen(file, statusMsgId) {
    const statusEl = document.getElementById(statusMsgId);
    if (statusEl) {
        statusEl.className = 'text-xs text-blue-600';
        statusEl.innerHTML = _tHtml('<i class="fas fa-spinner fa-spin mr-1"></i>Subiendo...');
        statusEl.classList.remove('hidden');
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetchWithAuth('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (statusEl) {
            statusEl.className = 'text-xs text-green-600';
            statusEl.innerHTML = _tHtml('<i class="fas fa-check-circle mr-1"></i>Subida correcta');
        }
        return data.url || null;
    } catch (err) {
        if (statusEl) {
            statusEl.className = 'text-xs text-red-600';
            statusEl.innerHTML = _tHtml('<i class="fas fa-exclamation-circle mr-1"></i>Error al subir');
        }
        return null;
    }
}

function agregarSlideImagen() {
    const finalUrl = document.getElementById('imagenUrl')?.value?.trim();

    if (!finalUrl) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, sube una imagen o introduce una URL', 'warning');
        return;
    }

    currentCustomGameQuestions.push({
        slide_type: 'image',
        slide_image: finalUrl,
        question_id: null,
        position: currentCustomGameQuestions.length
    });

    dibujarPreguntasPersonalizadas();
    cerrarModalImagen();
}

// ==============================
// [TAG:EDIT] Editar slide "image"
// ==============================

function editarSlideImagen(index) {
    const slide = currentCustomGameQuestions[index];
    if (!slide || slide.slide_type !== 'image') return;

    const currentSrc = slide.slide_image || '';
    const modal = document.createElement('div');
    modal.id = 'modalEditImagen';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center';
    modal.innerHTML = _tHtml(`
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
            <h3 class="text-2xl font-black text-pink-600 mb-4 flex items-center gap-2">
                <i class="fas fa-edit"></i> Editar Diapositiva de Imagen
            </h3>

            <div class="mb-4">
                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">Imagen actual</label>
                <div id="previewWrapEditImagen" class="w-full h-28 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border">
                    <img id="previewEditImagen" src="${_escapeAttrImagen(currentSrc)}" class="max-w-full max-h-full object-contain" />
                </div>
            </div>

            <div class="mb-4">
                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Arrastra una nueva imagen aquí</label>
                <div id="dropZoneEditImagen"
                    class="w-full h-28 border-2 border-dashed border-pink-300 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-pink-500 hover:bg-pink-50 transition select-none">
                    <i class="fas fa-cloud-upload-alt text-3xl text-pink-400"></i>
                    <p class="text-sm text-slate-500 font-semibold">Arrastra aquí o haz clic</p>
                    <p id="editUploadStatus" class="text-xs text-blue-600 hidden"></p>
                </div>
                <input type="file" id="editImagenFile" accept="image/*" class="hidden" />
            </div>

            <div class="mb-2">
                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">O URL externa</label>
                <input id="editImagenUrl" type="text" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-pink-500 outline-none transition"
                    value="${_escapeAttrImagen(currentSrc)}" />
            </div>

            <div class="flex gap-3 mt-6">
                <button data-slide-image-action="close-edit-modal" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">Cancelar</button>
                <button data-slide-image-action="save-slide" data-index="${index}" class="flex-1 bg-camaleon-600 hover:bg-camaleon-700 text-white px-6 py-3 rounded-xl font-bold transition">
                    <i class="fas fa-save mr-2"></i>Guardar
                </button>
            </div>
        </div>
    `);
    document.body.appendChild(modal);

    const previewImg = document.getElementById('previewEditImagen');
    if (previewImg) {
        previewImg.addEventListener('error', function () {
            previewImg.style.display = 'none';
        });
    }

    _iniciarDropZone({
        dropZoneId: 'dropZoneEditImagen', fileInputId: 'editImagenFile', statusMsgId: 'editUploadStatus',
        urlInputId: 'editImagenUrl', previewImgId: 'previewEditImagen', previewWrapId: 'previewWrapEditImagen'
    });
}

function cerrarModalEditImagen() {
    const modal = document.getElementById('modalEditImagen');
    if (modal) modal.remove();
}

function guardarEditImagen(index) {
    const finalUrl = document.getElementById('editImagenUrl')?.value?.trim();

    if (!finalUrl) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, sube una imagen o introduce una URL', 'warning');
        return;
    }

    currentCustomGameQuestions[index].slide_image = finalUrl;
    dibujarPreguntasPersonalizadas();
    cerrarModalEditImagen();
}

function initSlideImagenDelegation() {
    if (_slideImagenDelegationReady) return;
    _slideImagenDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-slide-image-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.slideImageAction;
        switch (action) {
            case 'close-create-modal':
                cerrarModalImagen();
                break;
            case 'add-slide':
                agregarSlideImagen();
                break;
            case 'close-edit-modal':
                cerrarModalEditImagen();
                break;
            case 'save-slide': {
                const index = Number(actionElement.dataset.index);
                if (Number.isInteger(index)) guardarEditImagen(index);
                break;
            }
            default:
                break;
        }
    });
}

initSlideImagenDelegation();

// ==============================
// [TAG:SECURITY] Helpers
// ==============================

function _escapeAttrImagen(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
