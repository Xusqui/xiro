/**
 * @fileoverview Diapositivas libres con IA: el botón «Generar con IA» del selector de diapositivas libres abre un
 * diálogo (qué se quiere, documento opcional, número de diapositivas, estilo e idioma) y lo envía a
 * POST /api/ai-generator/canvas-slides. Las diapositivas que vuelven entran igual que las importadas
 * (_lienzoAddToGame de slides-canvas-import.js): una se abre en el editor y varias van al final del juego.
 * El documento se convierte a Markdown con POST /api/ai-generator/upload, como en el Generador IA.
 * Reutiliza helpers globales: fetchWithAuth(), mostrarModalError(), renderLanguageSelect() y _lienzoAddToGame().
 */

const _LIENZO_IA_MODAL = 'modalLienzoIA';
const _LIENZO_IA_THEMES = ['auto', 'claro', 'noche', 'ciruela', 'oceano', 'jungla', 'papel'];
const _LIENZO_IA_MAX_SLIDES = 10;
const _LIENZO_IA_DOC_ACCEPT = '.pdf,.docx,.odt,.odp,.pptx,.epub,.rtf,.html,.htm,.md,.txt';
// Códigos de error de la API → claves admin.canvas.ai.error.*
const _LIENZO_IA_ERRORS = { AI_NOT_CONFIGURED: 'unavailable', AI_CANVAS_PROMPT_REQUIRED: 'empty', AI_CANVAS_PROMPT_TOO_LONG: 'too_long', AI_CANVAS_GENERATION_FAILED: 'failed' };
// Textos de _lienzoAddToGame para lo que llega de la IA (por defecto habla de «el archivo»)
const _LIENZO_IA_ADD_TEXTS = { manyTitle: 'ai.add_many_title', many: 'ai.add_many', manyConfirm: 'ai.add_many_confirm', warningsTitle: 'ai.warnings_title' };
let _lienzoIaDocument = '';
let _lienzoIaRequest = null;

/** Botón «Generar con IA» del selector: comprueba que hay IA configurada y abre el diálogo. */
async function generarSlidesLienzoIA() {
    const E = window.XiroCanvasEditor;
    let available = false;
    try {
        const res = await fetchWithAuth('/api/ai-generator/status');
        available = res.ok && (await res.json()).available === true;
    } catch (_err) {
        available = false;
    }
    if (!available) {
        mostrarModalError(E.th('ai.error_title'), E.th('ai.error.unavailable'), 'warning');
        return;
    }
    _lienzoIaOpen();
}

function _lienzoIaDialogHtml() {
    const th = window.XiroCanvasEditor.th;
    const gameLanguage = document.getElementById('customGameLanguage')?.value;
    const counts = Array.from({ length: _LIENZO_IA_MAX_SLIDES }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
    const themes = _LIENZO_IA_THEMES.map(id => `<option value="${id}">${th('ai.theme.' + id)}</option>`).join('');
    return `
        <div class="xsce-dialog" role="dialog" aria-modal="true" aria-labelledby="lienzoIATitulo" style="max-width:640px">
            <div class="xsce-dialog-head">
                <span class="xsce-tile"><i class="fas fa-magic" aria-hidden="true"></i></span>
                <div class="xsce-heading"><h3 id="lienzoIATitulo">${th('ai.title')}</h3><p>${th('ai.intro')}</p></div>
            </div>
            <div class="xsce-field">
                <label class="xsce-label" for="lienzoIAPrompt">${th('ai.prompt_label')}</label>
                <textarea id="lienzoIAPrompt" class="xsce-input xsce-textarea" rows="6" maxlength="4000"
                    placeholder="${th('ai.prompt_placeholder')}"></textarea>
            </div>
            <div class="xsce-field">
                <label class="xsce-label" for="lienzoIADoc">${th('ai.doc_label')}</label>
                <input type="file" id="lienzoIADoc" class="xsce-file" accept="${_LIENZO_IA_DOC_ACCEPT}">
            </div>
            <div class="xsce-grid2">
                <div class="xsce-field">
                    <label class="xsce-label" for="lienzoIACount">${th('ai.count_label')}</label>
                    <select id="lienzoIACount" class="xsce-input">${counts}</select>
                </div>
                <div class="xsce-field">
                    <label class="xsce-label" for="lienzoIATheme">${th('ai.theme_label')}</label>
                    <select id="lienzoIATheme" class="xsce-input">${themes}</select>
                </div>
            </div>
            <div class="xsce-field">
                <span class="xsce-label">${th('ai.language_label')}</span>
                ${renderLanguageSelect({ id: 'lienzoIALanguage', value: gameLanguage })}
            </div>
            <p id="lienzoIAStatus" class="text-xs text-slate-500 mt-2">${th('ai.hint')}</p>
            <div class="xsce-dialog-foot">
                <button type="button" data-lienzo-ia="cancel" class="xsce-btn xsce-btn--ghost">${th('cancel')}</button>
                <button type="button" data-lienzo-ia="generate" class="xsce-btn xsce-btn--primary">
                    <i class="fas fa-magic" aria-hidden="true"></i> ${th('ai.generate')}</button>
            </div>
        </div>`;
}

function _lienzoIaOpen() {
    _lienzoIaClose();
    _lienzoIaDocument = '';
    const modal = document.createElement('div');
    modal.id = _LIENZO_IA_MODAL;
    modal.className = 'xsce-overlay-dim';
    modal.style.zIndex = '75';
    modal.innerHTML = _lienzoIaDialogHtml();
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
        const action = event.target.closest('[data-lienzo-ia]')?.getAttribute('data-lienzo-ia');
        if (action === 'generate') _lienzoIaGenerate();
        if (action === 'cancel') _lienzoIaClose();
    });
    modal.addEventListener('change', event => {
        if (event.target.id === 'lienzoIADoc') _lienzoIaReadDocument(event.target);
    });
    // Las teclas no llegan al editor; Ctrl/⌘+Intro genera
    modal.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key === 'Escape') _lienzoIaClose();
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) _lienzoIaGenerate();
    });
    document.getElementById('lienzoIAPrompt').focus();
}

/** Cierra el diálogo y cancela la petición en curso, si la hay. */
function _lienzoIaClose() {
    if (_lienzoIaRequest) _lienzoIaRequest.abort();
    _lienzoIaRequest = null;
    document.getElementById(_LIENZO_IA_MODAL)?.remove();
}

function _lienzoIaStatus(text, ok) {
    const status = document.getElementById('lienzoIAStatus');
    if (!status) return;
    status.className = 'text-xs mt-2 ' + (ok === true ? 'text-green-600' : ok === false ? 'text-red-600' : 'text-slate-500');
    status.textContent = text;
}

function _lienzoIaBusy(busy) {
    const button = document.querySelector('[data-lienzo-ia="generate"]');
    if (!button) return;
    button.disabled = busy;
    button.querySelector('i').className = busy ? 'fas fa-circle-notch fa-spin' : 'fas fa-magic';
}

/** Convierte el documento elegido a Markdown en el servidor y lo guarda para la petición. */
async function _lienzoIaReadDocument(input) {
    const E = window.XiroCanvasEditor;
    const file = input.files && input.files[0];
    _lienzoIaDocument = '';
    if (!file) return;
    _lienzoIaStatus(E.t('ai.doc_reading'), null);
    const form = new FormData();
    form.append('document', file);
    try {
        const res = await fetchWithAuth('/api/ai-generator/upload', { method: 'POST', body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.text) throw new Error(data.error || '');
        _lienzoIaDocument = data.text;
        _lienzoIaStatus(E.t('ai.doc_ready', { n: Number(data.wordCount || 0).toLocaleString() }), true);
    } catch (err) {
        input.value = '';
        _lienzoIaStatus(err.message || E.t('ai.error.doc'), false);
    }
}

function _lienzoIaErrorText(res, data) {
    const E = window.XiroCanvasEditor;
    if (res && (res.status === 502 || res.status === 504) && !data.code) return E.t('ai.error.timeout');
    return E.t('ai.error.' + (_LIENZO_IA_ERRORS[data.code] || 'generic'));
}

/** Pide las diapositivas a la IA; las válidas pasan al juego como las importadas. */
async function _lienzoIaGenerate() {
    const E = window.XiroCanvasEditor;
    if (_lienzoIaRequest) return;
    const prompt = document.getElementById('lienzoIAPrompt').value.trim();
    if (!prompt && !_lienzoIaDocument) {
        _lienzoIaStatus(E.t('ai.error.empty'), false);
        return;
    }
    const body = {
        prompt,
        document: _lienzoIaDocument,
        count: Number(document.getElementById('lienzoIACount').value) || 1,
        theme: document.getElementById('lienzoIATheme').value,
        language: document.getElementById('lienzoIALanguage')?.value || 'es'
    };
    const request = new AbortController();
    _lienzoIaRequest = request;
    _lienzoIaBusy(true);
    _lienzoIaStatus(E.t('ai.generating'), null);
    try {
        const res = await fetchWithAuth('/api/ai-generator/canvas-slides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: request.signal
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error || !Array.isArray(data.slides) || !data.slides.length) {
            _lienzoIaStatus(_lienzoIaErrorText(res, data), false);
            return;
        }
        _lienzoIaRequest = null;
        _lienzoIaClose();
        document.getElementById('modalLienzoPlantillas')?.remove();
        _lienzoAddToGame(data, _LIENZO_IA_ADD_TEXTS);
    } catch (_err) {
        if (!request.signal.aborted) _lienzoIaStatus(E.t('ai.error.generic'), false);
    } finally {
        if (_lienzoIaRequest === request) _lienzoIaRequest = null;
        _lienzoIaBusy(false);
    }
}
