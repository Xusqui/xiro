/**
 * @fileoverview Modales para slides tipo "text" (título + cuerpo) en juegos personalizados
 *
 * [TAG:CONTEXT]
 * - Este módulo trabaja sobre el estado global `currentCustomGameQuestions`.
 * - Reutiliza helpers globales existentes: `mostrarModalError()` y `dibujarPreguntasPersonalizadas()`.
 * - Se carga como <script> normal (no ESModule), igual que el resto del admin.
 */

let _slideTextoDelegationReady = false;

// ==============================
// [TAG:CREATE] Crear slide "text"
// ==============================

function mostrarModalTexto() {
    const modal = document.createElement('div');
    modal.id = 'modalTexto';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center';
    modal.innerHTML = _tHtml(`
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
            <h3 class="text-2xl font-black text-aubergine-600 mb-4 flex items-center gap-2">
                <i class="fas fa-align-left"></i> Diapositiva de Texto
            </h3>
            <p class="text-sm text-slate-600 mb-4">Añade una diapositiva tipo PowerPoint/Keynote con un <b>título</b> y un <b>texto</b> debajo.</p>

            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Título</label>
            <input id="textoSlideTitulo" type="text" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-aubergine-500 outline-none transition" placeholder="Ej: Reglas de la ronda" />

            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest mt-4">Texto</label>
            <textarea id="textoSlideCuerpo" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-aubergine-500 outline-none resize-none" rows="6" placeholder="Ej: 1) Sin móviles\n2) 30s por pregunta\n3) ..."></textarea>

            <div class="flex gap-3 mt-6">
                <button data-slide-text-action="close-create-modal" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">Cancelar</button>
                <button data-slide-text-action="add-slide" class="flex-1 bg-camaleon-600 hover:bg-camaleon-700 text-white px-6 py-3 rounded-xl font-bold transition">
                    <i class="fas fa-plus mr-2"></i>Añadir
                </button>
            </div>
        </div>
    `);

    document.body.appendChild(modal);
    document.getElementById('textoSlideTitulo').focus();
}

function cerrarModalTexto() {
    const modal = document.getElementById('modalTexto');
    if (modal) modal.remove();
}

function agregarSlideTexto() {
    const titulo = document.getElementById('textoSlideTitulo')?.value?.trim();
    const cuerpo = document.getElementById('textoSlideCuerpo')?.value?.trim();

    // [TAG:VALIDATION]
    if (!titulo) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, escribe un título', 'warning');
        return;
    }
    if (!cuerpo) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, escribe el texto de la diapositiva', 'warning');
        return;
    }

    currentCustomGameQuestions.push({
        slide_type: 'text',
        slide_title: titulo,
        slide_body: cuerpo,
        question_id: null,
        position: currentCustomGameQuestions.length
    });

    dibujarPreguntasPersonalizadas();
    cerrarModalTexto();
}

// ==============================
// [TAG:EDIT] Editar slide "text"
// ==============================

function editarSlideTexto(index) {
    const slide = currentCustomGameQuestions[index];
    if (!slide || slide.slide_type !== 'text') return;

    const modal = document.createElement('div');
    modal.id = 'modalEditTexto';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center';
    modal.innerHTML = _tHtml(`
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
            <h3 class="text-2xl font-black text-aubergine-600 mb-4 flex items-center gap-2">
                <i class="fas fa-edit"></i> Editar Diapositiva de Texto
            </h3>
            <p class="text-sm text-slate-600 mb-4">Modifica el título y el texto.</p>

            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Título</label>
            <input id="textoEditSlideTitulo" type="text" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-aubergine-500 outline-none transition" value="${escapeHtmlForAttribute(slide.slide_title || '')}" />

            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest mt-4">Texto</label>
            <textarea id="textoEditSlideCuerpo" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-aubergine-500 outline-none resize-none" rows="6">${escapeHtml(slide.slide_body)}</textarea>

            <div class="flex gap-3 mt-6">
                <button data-slide-text-action="close-edit-modal" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">Cancelar</button>
                <button data-slide-text-action="save-slide" data-index="${index}" class="flex-1 bg-camaleon-600 hover:bg-camaleon-700 text-white px-6 py-3 rounded-xl font-bold transition">
                    <i class="fas fa-save mr-2"></i>Guardar
                </button>
            </div>
        </div>
    `);

    document.body.appendChild(modal);
    document.getElementById('textoEditSlideTitulo').focus();
}

function cerrarModalEditTexto() {
    const modal = document.getElementById('modalEditTexto');
    if (modal) modal.remove();
}

function guardarEditTexto(index) {
    const titulo = document.getElementById('textoEditSlideTitulo')?.value?.trim();
    const cuerpo = document.getElementById('textoEditSlideCuerpo')?.value?.trim();

    if (!titulo) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, escribe un título', 'warning');
        return;
    }
    if (!cuerpo) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Por favor, escribe el texto de la diapositiva', 'warning');
        return;
    }

    currentCustomGameQuestions[index].slide_title = titulo;
    currentCustomGameQuestions[index].slide_body = cuerpo;

    dibujarPreguntasPersonalizadas();
    cerrarModalEditTexto();
}

function initSlideTextoDelegation() {
    if (_slideTextoDelegationReady) return;
    _slideTextoDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-slide-text-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.slideTextAction;
        switch (action) {
            case 'close-create-modal':
                cerrarModalTexto();
                break;
            case 'add-slide':
                agregarSlideTexto();
                break;
            case 'close-edit-modal':
                cerrarModalEditTexto();
                break;
            case 'save-slide': {
                const index = Number(actionElement.dataset.index);
                if (Number.isInteger(index)) guardarEditTexto(index);
                break;
            }
            default:
                break;
        }
    });
}

initSlideTextoDelegation();

// ==============================
// [TAG:SECURITY] Helpers mínimos
// ==============================

function escapeHtmlForAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
