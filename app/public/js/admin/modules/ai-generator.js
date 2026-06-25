/**
 * @fileoverview Vista Generador IA – Pasos 1 (Documento) y 2 (Configuración)
 * Reutiliza: fetchWithAuth (core/api.js).
 * El paso 3 y las acciones están en ai-generator-results.js.
 */

// ===== ESTADO COMPARTIDO (accedido también por ai-generator-results.js) =====
let aiGenStep = 1;
let aiGenText = '';
let aiGenConfig = {};
let aiGenResult = null;
let aiGenMode = 'document'; // 'document' | 'prompt'
let _aiGeneratorDelegationReady = false;

const QUESTION_TYPE_LABELS = [
    { type: 'quiz', label: 'Test (quiz)', icon: 'fa-check-circle', color: 'purple' },
    { type: 'survey', label: 'Encuesta (survey)', icon: 'fa-poll', color: 'blue' },
    { type: 'numeric_approximation', label: 'Aproximación numérica', icon: 'fa-hashtag', color: 'amber' },
    { type: 'order', label: 'Ordenar secuencia', icon: 'fa-sort', color: 'green' },
    { type: 'word_scramble', label: 'Adivinar palabra', icon: 'fa-font', color: 'pink' },
    { type: 'multiple_choice', label: 'Selección múltiple', icon: 'fa-tasks', color: 'indigo' }
];

// ===== PUNTO DE ENTRADA =====

async function renderVistaAIGenerator() {
    aiGenStep = 1; aiGenText = ''; aiGenConfig = {}; aiGenResult = null; aiGenMode = 'document';
    _renderAIStep1();
}

// ===== PASO 1: DOCUMENTO =====

function _renderAIStep1() {
    document.getElementById('editorArea').innerHTML = _tHtml(`
    <div class="max-w-3xl mx-auto p-10">
        <div class="flex items-center gap-4 mb-6">
            <img src="/images/chamaleon/inteligencia-artificial.svg" alt="" class="w-16 h-16 flex-shrink-0">
            <div><h1 class="text-3xl font-black text-slate-900">Generador IA de Preguntas</h1>
                <p class="text-slate-500 text-sm">100% local con IA · Sin conexión a internet</p></div>
            <div id="ai-status-badge" class="ml-auto text-xs px-3 py-1 rounded-full font-bold bg-slate-200 text-slate-600">
                <i class="fas fa-circle-notch fa-spin mr-1"></i>Comprobando IA...</div>
        </div>
        <div class="flex gap-2 mb-6 text-sm font-bold">
            <span class="px-4 py-1.5 rounded-full bg-indigo-600 text-white">1 · Fuente</span>
            <span class="px-4 py-1.5 rounded-full bg-slate-200 text-slate-500">2 · Configurar</span>
            <span class="px-4 py-1.5 rounded-full bg-slate-200 text-slate-500">3 · Resultado</span>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
            <div>
                <label class="block text-sm font-bold text-slate-700 mb-2">Nombre del banco *</label>
                <input id="ai-bank-name" type="text" placeholder="Ej: Fisiología Digestiva – Módulo 3"
                    class="w-full border-2 border-slate-100 rounded-xl p-3 focus:border-indigo-500 outline-none transition">
            </div>
            <div>
                <label class="block text-sm font-bold text-slate-700 mb-2">Dificultad</label>
                <div class="flex gap-3">${['BAJA', 'MEDIA', 'ALTA'].map(d => `
                    <label class="flex-1 cursor-pointer"><input type="radio" name="ai-dificultad" value="${d}" ${d === 'MEDIA' ? 'checked' : ''} class="sr-only">
                    <div class="text-center py-3 rounded-xl border-2 ${d === 'MEDIA' ? 'border-indigo-500' : 'border-slate-200'} font-bold text-sm transition ai-dif-btn" data-val="${d}">${d}</div></label>`).join('')}
                </div>
            </div>

            <!-- Tabs: Documento / Prompt libre -->
            <div>
                <div class="flex rounded-xl border border-slate-200 overflow-hidden mb-4">
                    <button id="ai-tab-doc" data-ai-gen-action="switch-tab" data-mode="document"
                        class="flex-1 py-2.5 text-sm font-bold transition bg-indigo-600 text-white">
                        <i class="fas fa-file-upload mr-1"></i> Subir documento
                    </button>
                    <button id="ai-tab-prompt" data-ai-gen-action="switch-tab" data-mode="prompt"
                        class="flex-1 py-2.5 text-sm font-bold transition bg-white text-slate-500 hover:bg-slate-50">
                        <i class="fas fa-pencil-alt mr-1"></i> Escribir tema
                    </button>
                </div>

                <!-- Panel documento -->
                <div id="ai-panel-document">
                    <div id="ai-drop-zone" class="border-3 border-dashed border-indigo-300 rounded-xl p-8 text-center bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer">
                        <i class="fas fa-file-upload text-4xl text-indigo-400 mb-3"></i>
                        <p class="font-bold text-indigo-800">Arrastra aquí o haz clic para seleccionar</p>
                        <p class="text-xs text-slate-400 mt-1">.pdf · .docx · .txt</p>
                    </div>
                    <input type="file" id="ai-file-input" accept=".pdf,.docx,.doc,.txt" class="hidden">
                    <div id="ai-file-info" class="hidden mt-3 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-sm">
                        <i class="fas fa-check-circle text-green-600 text-xl"></i>
                        <div><p id="ai-file-name" class="font-bold text-green-800"></p>
                            <p id="ai-word-count" class="text-green-600"></p></div>
                        <button data-ai-gen-action="clear-file" class="ml-auto text-slate-400 hover:text-red-500 transition"><i class="fas fa-times"></i></button>
                    </div>
                    <div id="ai-upload-error" class="hidden mt-2 text-red-600 text-sm font-bold"></div>
                </div>

                <!-- Panel prompt libre -->
                <div id="ai-panel-prompt" class="hidden">
                    <textarea id="ai-free-prompt"
                        placeholder="Ej: Haz preguntas sobre la Primera República Española, cubriendo causas, principales figuras, instituciones y su caída. Mezcla datos cronológicos con consecuencias históricas."
                        rows="6"
                        class="w-full border-2 border-slate-200 rounded-xl p-4 text-sm focus:border-indigo-500 outline-none transition resize-none"
                        data-ai-gen-action="prompt-input"></textarea>
                    <p class="text-xs text-slate-400 mt-1"><i class="fas fa-info-circle mr-1"></i>Describe el tema con el mayor detalle posible. Puedes indicar subtemas, enfoques o ejemplos concretos.</p>
                </div>
            </div>

            <button data-ai-gen-action="go-step2" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition text-lg">
                Siguiente <i class="fas fa-arrow-right ml-2"></i></button>
        </div>
    </div>`);
    _initAIStep1Events();
    _checkIAStatus();
}

function _initAIStep1Events() {
    const dz = document.getElementById('ai-drop-zone');
    const fi = document.getElementById('ai-file-input');
    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('bg-indigo-100'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('bg-indigo-100'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('bg-indigo-100'); if (e.dataTransfer.files[0]) _aiUploadFile(e.dataTransfer.files[0]); });
    fi.addEventListener('change', () => { if (fi.files[0]) _aiUploadFile(fi.files[0]); });
    document.querySelectorAll('.ai-dif-btn').forEach(btn => {
        btn.closest('label').querySelector('input').addEventListener('change', () => {
            document.querySelectorAll('.ai-dif-btn').forEach(b => b.classList.replace('border-indigo-500', 'border-slate-200'));
            btn.classList.replace('border-slate-200', 'border-indigo-500');
        });
    });
}

function _aiSwitchTab(mode) {
    aiGenMode = mode;
    aiGenText = '';
    const tabDoc = document.getElementById('ai-tab-doc');
    const tabPrompt = document.getElementById('ai-tab-prompt');
    const panelDoc = document.getElementById('ai-panel-document');
    const panelPrompt = document.getElementById('ai-panel-prompt');
    if (mode === 'document') {
        tabDoc.className = 'flex-1 py-2.5 text-sm font-bold transition bg-indigo-600 text-white';
        tabPrompt.className = 'flex-1 py-2.5 text-sm font-bold transition bg-white text-slate-500 hover:bg-slate-50';
        panelDoc.classList.remove('hidden');
        panelPrompt.classList.add('hidden');
    } else {
        tabPrompt.className = 'flex-1 py-2.5 text-sm font-bold transition bg-indigo-600 text-white';
        tabDoc.className = 'flex-1 py-2.5 text-sm font-bold transition bg-white text-slate-500 hover:bg-slate-50';
        panelPrompt.classList.remove('hidden');
        panelDoc.classList.add('hidden');
        setTimeout(() => document.getElementById('ai-free-prompt')?.focus(), 50);
    }
}

function _aiPromptInput(val) {
    aiGenText = val.trim();
}

async function _aiUploadFile(file) {
    const errEl = document.getElementById('ai-upload-error');
    errEl.classList.add('hidden');
    document.getElementById('ai-drop-zone').innerHTML = _tHtml('<i class="fas fa-circle-notch fa-spin text-2xl text-indigo-400"></i><p class="mt-2 text-indigo-600 font-bold">Procesando...</p>');
    const fd = new FormData();
    fd.append('document', file);
    try {
        const res = await fetchWithAuth('/api/ai-generator/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al procesar el documento');
        aiGenText = data.text;
        document.getElementById('ai-file-info').classList.remove('hidden');
        document.getElementById('ai-file-name').textContent = _t(file.name);
        document.getElementById('ai-word-count').textContent = _t(data.wordCount.toLocaleString() + ' palabras extraídas');
        document.getElementById('ai-drop-zone').innerHTML = _tHtml('<i class="fas fa-check text-green-500 text-2xl"></i><p class="mt-2 text-green-600 font-bold">Documento listo</p>');
    } catch (err) {
        errEl.textContent = _t(err.message);
        errEl.classList.remove('hidden');
        document.getElementById('ai-drop-zone').innerHTML = _tHtml('<i class="fas fa-file-upload text-4xl text-indigo-400 mb-3"></i><p class="font-bold text-indigo-800">Arrastra aquí o haz clic</p>');
    }
}

function _aiClearFile() {
    aiGenText = '';
    document.getElementById('ai-file-info').classList.add('hidden');
    document.getElementById('ai-drop-zone').innerHTML = _tHtml('<i class="fas fa-file-upload text-4xl text-indigo-400 mb-3"></i><p class="font-bold text-indigo-800">Arrastra aquí o haz clic para seleccionar</p><p class="text-xs text-slate-400 mt-1">.pdf · .docx · .txt</p>');
}

async function _checkIAStatus() {
    try {
        const res = await fetchWithAuth('/api/ai-generator/status');
        const data = await res.json();
        const badge = document.getElementById('ai-status-badge');
        if (!badge) return;
        if (data.available) {
            badge.className = 'ml-auto text-xs px-3 py-1 rounded-full font-bold bg-green-100 text-green-700';
            badge.innerHTML = _tHtml('<i class="fas fa-circle text-green-500 mr-1"></i>IA lista · ' + data.model);
        } else {
            badge.className = 'ml-auto text-xs px-3 py-1 rounded-full font-bold bg-red-100 text-red-700';
            badge.innerHTML = _tHtml('<i class="fas fa-circle text-red-500 mr-1"></i>IA no disponible');
        }
    } catch { /* silencioso */ }
}

function _aiGoToStep2() {
    const name = document.getElementById('ai-bank-name')?.value?.trim();
    if (!name) { mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Introduce un nombre para el banco', 'warning'); return; }
    if (aiGenMode === 'prompt') {
        const promptVal = document.getElementById('ai-free-prompt')?.value?.trim();
        if (!promptVal) { mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Escribe un tema o descripción para generar las preguntas', 'warning'); return; }
        aiGenText = promptVal;
    } else {
        if (!aiGenText) { mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Primero sube un documento', 'warning'); return; }
    }
    aiGenConfig = { name, dificultad: document.querySelector('input[name="ai-dificultad"]:checked')?.value || 'MEDIA' };
    _renderAIStep2();
}

// ===== PASO 2: CONFIGURACIÓN =====

function _renderAIStep2() {
    document.getElementById('editorArea').innerHTML = _tHtml(`
    <div class="max-w-3xl mx-auto p-10">
        <button data-ai-gen-action="back-step1" class="mb-6 text-slate-600 hover:text-indigo-600 font-bold flex items-center gap-2">
            <i class="fas fa-arrow-left"></i> Volver</button>
        <div class="flex items-center gap-4 mb-6">
            <img src="/images/chamaleon/inteligencia-artificial.svg" alt="" class="w-16 h-16 flex-shrink-0">
            <div><h1 class="text-2xl font-black text-slate-900">Configurar preguntas</h1>
                <p class="text-slate-500 text-sm">Banco: <strong>${aiGenConfig.name}</strong> · Dificultad: ${aiGenConfig.dificultad}</p></div>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-4">
            ${QUESTION_TYPE_LABELS.map(t => `
            <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div class="w-10 h-10 bg-${t.color}-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i class="fas ${t.icon} text-${t.color}-600"></i></div>
                <span class="flex-1 font-semibold text-slate-700">${t.label}</span>
                <input type="number" min="0" max="20" value="0" id="ai-count-${t.type}"
                    data-ai-gen-action="update-total"
                    class="w-20 border-2 border-slate-200 rounded-lg p-2 text-center font-bold focus:border-indigo-500 outline-none">
            </div>`).join('')}
            <div class="pt-4 border-t border-slate-200 flex items-center justify-between">
                <span class="text-slate-600 font-bold">Total de preguntas:</span>
                <span id="ai-total-count" class="text-2xl font-black text-indigo-600">0</span>
            </div>
            <button data-ai-gen-action="generate-bank" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition text-lg mt-4">
                <i class="fas fa-magic mr-2"></i>Generar banco con IA</button>
        </div>
    </div>`);
}

function _initAIGeneratorDelegation() {
    if (_aiGeneratorDelegationReady) return;
    _aiGeneratorDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-ai-gen-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.aiGenAction;
        switch (action) {
            case 'switch-tab':
                if (actionElement.dataset.mode) _aiSwitchTab(actionElement.dataset.mode);
                break;
            case 'clear-file':
                _aiClearFile();
                break;
            case 'go-step2':
                _aiGoToStep2();
                break;
            case 'back-step1':
                renderVistaAIGenerator();
                break;
            case 'generate-bank':
                _aiGenerate();
                break;
            default:
                break;
        }
    });

    document.addEventListener('input', (event) => {
        const actionElement = event.target.closest('[data-ai-gen-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.aiGenAction;
        if (action === 'prompt-input') {
            _aiPromptInput(actionElement.value);
            return;
        }
        if (action === 'update-total') {
            _aiUpdateTotal();
        }
    });
}

function _aiUpdateTotal() {
    const total = QUESTION_TYPE_LABELS.reduce((s, t) => s + (parseInt(document.getElementById('ai-count-' + t.type)?.value) || 0), 0);
    const el = document.getElementById('ai-total-count');
    if (el) el.textContent = _t(total);
}

async function _aiGenerate() {
    const counts = {};
    let total = 0;
    QUESTION_TYPE_LABELS.forEach(t => {
        const val = parseInt(document.getElementById('ai-count-' + t.type)?.value) || 0;
        counts[t.type] = val;
        total += val;
    });
    if (total === 0) { mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'Indica al menos 1 pregunta en algún tipo', 'warning'); return; }

    _renderAIStep3Loading(total);

    try {
        const res = await fetchWithAuth('/api/ai-generator/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: aiGenText, mode: aiGenMode, config: Object.assign({}, aiGenConfig, counts) })
        });
        if (res.status === 504 || res.status === 502) {
            throw new Error('Tiempo de espera agotado (504). El proxy del servidor cortó la conexión. Aumenta el timeout del proxy inverso en DSM o reduce el número de preguntas.');
        }
        let data;
        try { data = await res.json(); } catch { throw new Error(`Error HTTP ${res.status} — respuesta no JSON del servidor`); }
        if (!res.ok || data.error) throw new Error(data.error || 'Error desconocido del servidor');
        aiGenResult = data;
        _renderAIStep3Result(data);
    } catch (err) {
        _renderAIStep3Error(err.message);
    }
}

_initAIGeneratorDelegation();


