/**
 * @fileoverview Modales para slides de comentario e informativos
 * Código extraído 1:1 del original admin.js
 */

let _slidesCommentInfoDelegationReady = false;

// ===== MODAL DE COMENTARIO (ACTIVIDAD LIBRE) =====

function mostrarModalComentario() {
    const modal = document.createElement('div');
    modal.id = 'modalComentario';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center';
    modal.innerHTML = _tHtml(`
                <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                    <h3 class="text-2xl font-black text-amber-600 mb-4 flex items-center gap-2">
                        <i class="fas fa-comment"></i> Actividad Libre
                    </h3>
                    <p class="text-sm text-slate-600 mb-4">Añade una actividad donde podrás asignar puntos manualmente (ej: pictionary, imitar, etc.).</p>
                    <textarea id="textoComentario" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-amber-500 outline-none resize-none" rows="4" placeholder="Ej: Pictionary por equipos o Imita un elefante"></textarea>
                    <div class="flex gap-3 mt-6">
                        <button data-slide-ci-action="close-comment-create" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">
                            Cancelar
                        </button>
                        <button data-slide-ci-action="add-comment-create" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold transition">
                            <i class="fas fa-plus mr-2"></i>Añadir
                        </button>
                    </div>
                </div>
            `);
    document.body.appendChild(modal);
    document.getElementById('textoComentario').focus();
}

function cerrarModalComentario() {
    const modal = document.getElementById('modalComentario');
    if (modal) modal.remove();
}

function agregarSlideComentario() {
    const texto = document.getElementById('textoComentario').value.trim();
    if (!texto) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, escribe un comentario', 'warning');
        return;
    }

    currentCustomGameQuestions.push({
        slide_type: 'comment',
        comment_text: texto,
        question_id: null,
        position: currentCustomGameQuestions.length
    });

    dibujarPreguntasPersonalizadas();
    cerrarModalComentario();
}

// ===== MODAL DE SLIDE INFORMATIVO =====

function mostrarModalInfo() {
    const modal = document.createElement('div');
    modal.id = 'modalInfo';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center';
    modal.innerHTML = _tHtml(`
                <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                    <h3 class="text-2xl font-black text-blue-600 mb-4 flex items-center gap-2">
                        <i class="fas fa-info-circle"></i> Slide Informativo
                    </h3>
                    <p class="text-sm text-slate-600 mb-4">Añade información que se mostrará sin asignación de puntos. Solo aparecerá el botón "Siguiente".</p>
                    <textarea id="textoInfo" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 outline-none resize-none" rows="4" placeholder="Ej: ¡Descanso! o Recordatorio: beber agua"></textarea>
                    <div class="flex gap-3 mt-6">
                        <button data-slide-ci-action="close-info-create" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">
                            Cancelar
                        </button>
                        <button data-slide-ci-action="add-info-create" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-bold transition">
                            <i class="fas fa-plus mr-2"></i>Añadir
                        </button>
                    </div>
                </div>
            `);
    document.body.appendChild(modal);
    document.getElementById('textoInfo').focus();
}

function cerrarModalInfo() {
    const modal = document.getElementById('modalInfo');
    if (modal) modal.remove();
}

function agregarSlideInfo() {
    const texto = document.getElementById('textoInfo').value.trim();
    if (!texto) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, escribe el texto informativo', 'warning');
        return;
    }

    currentCustomGameQuestions.push({
        slide_type: 'info',
        comment_text: texto,
        question_id: null,
        position: currentCustomGameQuestions.length
    });

    dibujarPreguntasPersonalizadas();
    cerrarModalInfo();
}

// ===== EDITAR SLIDE DE COMENTARIO =====

function editarSlideComentario(index) {
    const slide = currentCustomGameQuestions[index];
    if (!slide || slide.slide_type !== 'comment') return;

    const modal = document.createElement('div');
    modal.id = 'modalEditComentario';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center';
    modal.innerHTML = _tHtml(`
                <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                    <h3 class="text-2xl font-black text-amber-600 mb-4 flex items-center gap-2">
                        <i class="fas fa-edit"></i> Editar Actividad Libre
                    </h3>
                    <p class="text-sm text-slate-600 mb-4">Modifica el texto de la actividad.</p>
                    <textarea id="textoEditComentario" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-amber-500 outline-none resize-none" rows="4" placeholder="Ej: Pictionary por equipos o Imita un elefante">${escapeHtml(slide.comment_text)}</textarea>
                    <div class="flex gap-3 mt-6">
                        <button data-slide-ci-action="close-comment-edit" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">
                            Cancelar
                        </button>
                        <button data-slide-ci-action="save-comment-edit" data-index="${index}" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold transition">
                            <i class="fas fa-save mr-2"></i>Guardar
                        </button>
                    </div>
                </div>
            `);
    document.body.appendChild(modal);
    document.getElementById('textoEditComentario').focus();
}

function cerrarModalEditComentario() {
    const modal = document.getElementById('modalEditComentario');
    if (modal) modal.remove();
}

function guardarEditComentario(index) {
    const texto = document.getElementById('textoEditComentario').value.trim();
    if (!texto) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, escribe un comentario', 'warning');
        return;
    }

    currentCustomGameQuestions[index].comment_text = texto;
    dibujarPreguntasPersonalizadas();
    cerrarModalEditComentario();
}

// ===== EDITAR SLIDE INFORMATIVO =====

function editarSlideInfo(index) {
    const slide = currentCustomGameQuestions[index];
    if (!slide || slide.slide_type !== 'info') return;

    const modal = document.createElement('div');
    modal.id = 'modalEditInfo';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center';
    modal.innerHTML = _tHtml(`
                <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                    <h3 class="text-2xl font-black text-blue-600 mb-4 flex items-center gap-2">
                        <i class="fas fa-edit"></i> Editar Slide Informativo
                    </h3>
                    <p class="text-sm text-slate-600 mb-4">Modifica el texto informativo.</p>
                    <textarea id="textoEditInfo" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 outline-none resize-none" rows="4" placeholder="Ej: ¡Descanso! o Recordatorio: beber agua">${escapeHtml(slide.comment_text)}</textarea>
                    <div class="flex gap-3 mt-6">
                        <button data-slide-ci-action="close-info-edit" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">
                            Cancelar
                        </button>
                        <button data-slide-ci-action="save-info-edit" data-index="${index}" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-bold transition">
                            <i class="fas fa-save mr-2"></i>Guardar
                        </button>
                    </div>
                </div>
            `);
    document.body.appendChild(modal);
    document.getElementById('textoEditInfo').focus();
}

function cerrarModalEditInfo() {
    const modal = document.getElementById('modalEditInfo');
    if (modal) modal.remove();
}

function guardarEditInfo(index) {
    const texto = document.getElementById('textoEditInfo').value.trim();
    if (!texto) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, escribe el texto informativo', 'warning');
        return;
    }

    currentCustomGameQuestions[index].comment_text = texto;
    dibujarPreguntasPersonalizadas();
    cerrarModalEditInfo();
}

function initSlidesCommentInfoDelegation() {
    if (_slidesCommentInfoDelegationReady) return;
    _slidesCommentInfoDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-slide-ci-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.slideCiAction;
        switch (action) {
            case 'close-comment-create':
                cerrarModalComentario();
                break;
            case 'add-comment-create':
                agregarSlideComentario();
                break;
            case 'close-info-create':
                cerrarModalInfo();
                break;
            case 'add-info-create':
                agregarSlideInfo();
                break;
            case 'close-comment-edit':
                cerrarModalEditComentario();
                break;
            case 'save-comment-edit': {
                const commentIndex = Number(actionElement.dataset.index);
                if (Number.isInteger(commentIndex)) guardarEditComentario(commentIndex);
                break;
            }
            case 'close-info-edit':
                cerrarModalEditInfo();
                break;
            case 'save-info-edit': {
                const infoIndex = Number(actionElement.dataset.index);
                if (Number.isInteger(infoIndex)) guardarEditInfo(infoIndex);
                break;
            }
            default:
                break;
        }
    });
}

initSlidesCommentInfoDelegation();
