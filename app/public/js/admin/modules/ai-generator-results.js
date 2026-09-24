/**
 * @fileoverview Vista Generador IA – Paso 3 (Resultado) e importación
 * Depende de: ai-generator.js (estado aiGenResult, aiGenConfig, aiGenText)
 * Reutiliza: fetchWithAuth (core/api.js), QUESTION_TYPE_LABELS (ai-generator.js)
 */

let _aiResultsDelegationReady = false;

// ===== PASO 3: LOADING =====

function _renderAIStep3Loading(total) {
    document.getElementById('editorArea').innerHTML = _tHtml(`
    <div class="max-w-3xl mx-auto p-10 flex flex-col items-center justify-center min-h-96 gap-6">
        <img src="/images/chamaleon/inteligencia-artificial.svg" alt="" class="w-28 h-28">
        <h2 class="text-2xl font-black text-slate-800">Generando ${total} preguntas con IA...</h2>
        <p class="text-slate-500 text-center">La IA está procesando el documento. Puede tardar de 30 segundos a varios minutos.</p>
        <div class="w-full max-w-md bg-slate-200 rounded-full h-3 overflow-hidden">
            <div class="bg-indigo-500 h-3 rounded-full animate-pulse" style="width:60%"></div>
        </div>
    </div>`);
}

// ===== PASO 3: RESULTADO =====

function _renderAIStep3Result(data) {
    const hasErrors = data.results.some(r => r.error);
    document.getElementById('editorArea').innerHTML = _tHtml(`
    <div class="max-w-4xl mx-auto p-10">
        <div class="flex items-center gap-4 mb-8">
            <img src="/images/chamaleon/inteligencia-artificial.svg" alt="" class="w-16 h-16 flex-shrink-0">
            <div>
                <h1 class="text-2xl font-black text-slate-900">${data.totalGenerated} preguntas generadas</h1>
                <p class="text-slate-500 text-sm">${hasErrors ? 'Algunos tipos tuvieron errores' : 'Generación correcta'}</p>
            </div>
        </div>
        ${data.results.map(r => `
        <div class="mb-4 bg-white rounded-xl border ${r.error ? 'border-red-300' : 'border-slate-200'} shadow-sm overflow-hidden">
            <button data-ai-results-action="toggle-section" class="w-full flex items-center justify-between p-4 font-bold text-left hover:bg-slate-50 transition">
                <span>${(QUESTION_TYPE_LABELS.find(t => t.type === r.type) || { label: r.type }).label}
                    <span class="ml-2 text-sm font-normal ${r.error ? 'text-red-600' : 'text-slate-500'}">
                        ${r.error ? 'Error: ' + r.error.slice(0, 80) : r.questions.length + ' preguntas'}</span>
                </span>
                <i class="fas fa-chevron-down text-slate-400 transition-transform"></i>
            </button>
            <div class="ai-section-body hidden p-4 border-t border-slate-100 max-h-64 overflow-y-auto">
                ${r.error
        ? `<div class="text-red-600 text-sm p-3 bg-red-50 rounded-lg">${r.error}
                        <button data-ai-results-action="regenerate-type" data-type="${r.type}"
                            class="mt-2 block text-sm bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold transition">
                            <i class="fas fa-redo mr-1"></i>Regenerar solo este tipo</button></div>`
        : r.questions.map((q, i) => `<p class="text-sm py-1 border-b border-slate-50 last:border-0">${i + 1}. ${q.questionText}</p>`).join('')
}
            </div>
        </div>`).join('')}
        <div class="flex gap-4 mt-8">
            <button data-ai-results-action="import-bank"
                class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 text-lg">
                <i class="fas fa-cloud-upload-alt"></i>Importar banco</button>
            <button data-ai-results-action="download-json"
                class="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 text-lg">
                <i class="fas fa-download"></i>Descargar JSON</button>
        </div>
        <div id="ai-import-status" class="mt-4 hidden"></div>
    </div>`);
}

// ===== PASO 3: ERROR GLOBAL =====

function _renderAIStep3Error(message) {
    document.getElementById('editorArea').innerHTML = _tHtml(`
    <div class="max-w-3xl mx-auto p-10 text-center">
        <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i class="fas fa-exclamation-triangle text-red-500 text-4xl"></i></div>
        <h2 class="text-2xl font-black text-slate-800 mb-4">Error al generar</h2>
        <p class="text-red-600 font-bold mb-8 bg-red-50 p-4 rounded-xl">${message}</p>
        <button data-ai-results-action="retry-step2"
            class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-4 rounded-xl transition">
            <i class="fas fa-redo mr-2"></i>Reintentar</button>
    </div>`);
}

// ===== ACCIONES =====

function _aiToggleSection(btn) {
    const body = btn.nextElementSibling;
    const icon = btn.querySelector('.fa-chevron-down');
    body.classList.toggle('hidden');
    icon.style.transform = body.classList.contains('hidden') ? '' : 'rotate(180deg)';
}

async function _aiRegenerateType(type) {
    if (!aiGenConfig || !aiGenText) return;
    const prevResult = aiGenResult && aiGenResult.results ? aiGenResult.results.find(r => r.type === type) : null;
    const count = prevResult ? Math.max(prevResult.questions.length, 1) : 1;
    try {
        const res = await fetchWithAuth('/api/ai-generator/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: aiGenText, config: Object.assign({}, aiGenConfig, { [type]: count }) })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const idx = aiGenResult.results.findIndex(r => r.type === type);
        if (idx >= 0) {
            aiGenResult.results[idx] = data.results.find(r => r.type === type) || aiGenResult.results[idx];
            aiGenResult.bankPayload.questions = aiGenResult.results.flatMap(r => r.questions);
            aiGenResult.totalGenerated = aiGenResult.bankPayload.questions.length;
        }
        _renderAIStep3Result(aiGenResult);
    } catch (err) { mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), err.message, 'error'); }
}

async function _aiImportBank() {
    if (!aiGenResult || !aiGenResult.bankPayload) return;
    const statusEl = document.getElementById('ai-import-status');
    statusEl.className = 'mt-4 p-4 bg-blue-50 rounded-xl text-blue-700 font-bold text-sm';
    statusEl.innerHTML = _tHtml('<i class="fas fa-circle-notch fa-spin mr-2"></i>Importando banco...');
    statusEl.classList.remove('hidden');
    try {
        const res = await fetchWithAuth('/api/banks/save-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aiGenResult.bankPayload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error desconocido');
        statusEl.className = 'mt-4 p-4 bg-green-50 rounded-xl text-green-700 font-bold text-sm';
        statusEl.innerHTML = '<i class="fas fa-check mr-2"></i>¡Banco importado correctamente! ID: ' + data.id +
            ' <button data-ai-results-action="go-banks" class="ml-4 underline">Ver bancos</button>';
    } catch (err) {
        statusEl.className = 'mt-4 p-4 bg-red-50 rounded-xl text-red-700 font-bold text-sm';
        statusEl.innerHTML = _tHtml('<i class="fas fa-times mr-2"></i>Error: ' + escapeHtml(err.message));
    }
}

function _aiDownloadJSON() {
    if (!aiGenResult || !aiGenResult.bankPayload) return;
    const blob = new Blob([JSON.stringify(aiGenResult.bankPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (aiGenResult.bankPayload.name || 'banco').replace(/\s+/g, '_') + '_ai.json';
    a.click();
    URL.revokeObjectURL(url);
}

function _initAIResultsDelegation() {
    if (_aiResultsDelegationReady) return;
    _aiResultsDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-ai-results-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.aiResultsAction;
        switch (action) {
            case 'toggle-section':
                _aiToggleSection(actionElement);
                break;
            case 'regenerate-type':
                if (actionElement.dataset.type) _aiRegenerateType(actionElement.dataset.type);
                break;
            case 'import-bank':
                _aiImportBank();
                break;
            case 'download-json':
                _aiDownloadJSON();
                break;
            case 'retry-step2':
                if (typeof _renderAIStep2 === 'function') _renderAIStep2();
                break;
            case 'go-banks':
                if (typeof mostrarVista === 'function') mostrarVista('bancos');
                break;
            default:
                break;
        }
    });
}

_initAIResultsDelegation();
