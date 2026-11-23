/**
 * @fileoverview Tarjeta «Crear con IA» de la pestaña Música del admin: un texto libre (y, si se quiere, el
 * proveedor y el modelo de IA) pide una canción a POST /api/ai-generator/music-song y rellena la tarjeta
 * «Canción» (tónica, modo, acordes), el tempo y el motivo melódico. No guarda nada: el admin escucha,
 * retoca y pulsa «Guardar». El motivo vive en un campo oculto (#xm-song-motif) que lee musicSongSnapshot.
 * Depende de: config-panel-music-song.js (syncMusicSong), config-panel-music-controls.js (_musicT,
 * _musicCardHead), self.XiroMusic.song, escapeHtml y fetchWithAuth.
 */

const _SONG_AI_PROVIDERS = { groq: 'Groq', gemini: 'Gemini', ollama: 'Ollama' };
const _SONG_AI_ERRORS = {
    AI_MUSIC_INVALID: 'song.ai_error_invalid',
    AI_MUSIC_NO_PROVIDER: 'song.ai_error_no_provider'
};
const _SONG_AI_MAX_PROMPT = 500;

function _songAiEl(root, id) {
    return root.querySelector('#' + id);
}

function _songAiStatus(root, state, text) {
    const status = _songAiEl(root, 'xm-song-ai-status');
    status.dataset.state = state;
    status.textContent = text;
}

function _songMotifText(motif) {
    if (!motif) return _musicT('song.motif_none');
    return _musicT('song.motif_text', { count: motif.rel.length, contour: motif.rel.join(' ') });
}

function _songAiProviderOptions() {
    const first = `<option value="">${_musicT('song.ai_provider_default')}</option>`;
    return first + Object.entries(_SONG_AI_PROVIDERS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
}

/**
 * HTML de la tarjeta «Crear con IA», con el motivo de la canción guardada.
 * @param {?{motif?: {rhythm: Array, rel: Array<number>}}} song Canción guardada o null.
 * @returns {string}
 */
function renderMusicSongAi(song) {
    const motif = song && song.motif ? song.motif : null;
    return `<section class="xm-card xm-song-ai" aria-labelledby="xm-title-song_ai">
        ${_musicCardHead('fa-wand-magic-sparkles', 'song_ai')}
        <label for="xm-song-ai-prompt">${_musicT('song.ai_prompt')}</label>
        <textarea id="xm-song-ai-prompt" rows="2" maxlength="${_SONG_AI_MAX_PROMPT}" placeholder="${escapeHtml(_musicT('song.ai_placeholder'))}"></textarea>
        <div class="xm-song-ai__row">
            <select id="xm-song-ai-provider" aria-label="${escapeHtml(_musicT('song.ai_provider'))}">${_songAiProviderOptions()}</select>
            <select id="xm-song-ai-model" aria-label="${escapeHtml(_musicT('song.ai_model_default'))}" hidden><option value="">${_musicT('song.ai_model_default')}</option></select>
            <button type="button" class="xm-btn" data-music-action="song-generate">${_musicT('song.ai_generate')}</button>
        </div>
        <p class="xm-song-ai__status" id="xm-song-ai-status" role="status" aria-live="polite"></p>
        <div class="xm-song-motif">
            <input type="hidden" id="xm-song-motif" value="${motif ? escapeHtml(JSON.stringify(motif)) : ''}">
            <p class="xm-song-motif__text"><strong>${_musicT('song.motif_title')}</strong> <span id="xm-song-motif-text">${_songMotifText(motif)}</span></p>
            <button type="button" class="xm-btn xm-btn--quiet" data-music-action="song-motif-clear"${motif ? '' : ' hidden'}>${_musicT('song.motif_clear')}</button>
        </div>
    </section>`;
}

function _setSongMotif(root, motif) {
    _songAiEl(root, 'xm-song-motif').value = motif ? JSON.stringify(motif) : '';
    _songAiEl(root, 'xm-song-motif-text').textContent = _songMotifText(motif);
    root.querySelector('[data-music-action="song-motif-clear"]').hidden = !motif;
}

/**
 * Quita el motivo: la melodía vuelve a generarse sola.
 * @param {Element} root Raíz de la pestaña (#xm-root).
 */
function clearMusicSongMotif(root) {
    _setSongMotif(root, null);
}

function _fillSongGrid(root, song) {
    const cells = self.XiroMusic.song.cellsFromSong(song);
    root.querySelectorAll('.xm-song-cell').forEach((cell, index) => {
        const set = (name, value) => { cell.querySelector(`[data-song-field="${name}"]`).value = value; };
        cell.querySelector('[data-song-field="entry"]').checked = cells[index].entry;
        set('root', String(cells[index].root));
        set('quality', cells[index].quality);
    });
}

function _setSongTempo(root, tempo) {
    const slider = _songAiEl(root, 'xm-tempo');
    if (!slider || !Number.isFinite(tempo)) return;
    slider.value = String(tempo);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Vuelca la canción de la IA en el formulario: interruptor, tónica, modo, rejilla, tempo y motivo.
 * @param {Element} root Raíz de la pestaña (#xm-root).
 * @param {{tempo: ?number, song: {tonic: number, mode: string, chords: Array, motif?: Object}}} reply
 */
function applyMusicSongReply(root, reply) {
    const { song } = reply;
    _songAiEl(root, 'xm-song-enabled').checked = true;
    _songAiEl(root, 'xm-song-tonic').value = String(song.tonic);
    root.querySelector(`input[name="xm-song-mode"][value="${song.mode}"]`).checked = true;
    _fillSongGrid(root, song);
    _setSongMotif(root, song.motif || null);
    _setSongTempo(root, reply.tempo);
    syncMusicSong(root);
}

function _songAiRequestBody(root) {
    const body = { prompt: _songAiEl(root, 'xm-song-ai-prompt').value.trim() };
    const provider = _songAiEl(root, 'xm-song-ai-provider').value;
    const model = _songAiEl(root, 'xm-song-ai-model').value;
    if (provider) body.provider = provider;
    if (model) body.model = model;
    return body;
}

async function _songAiFetch(body) {
    const res = await fetchWithAuth('/api/ai-generator/music-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return res.json().catch(() => ({}));
}

/**
 * Pide la canción a la IA y la vuelca en el formulario.
 * @param {Element} root Raíz de la pestaña (#xm-root).
 * @returns {Promise<boolean>} true si se rellenó el formulario.
 */
async function requestMusicSong(root) {
    const body = _songAiRequestBody(root);
    if (!body.prompt) {
        _songAiStatus(root, 'error', _musicT('song.ai_empty'));
        return false;
    }
    const button = root.querySelector('[data-music-action="song-generate"]');
    button.disabled = true;
    _songAiStatus(root, 'busy', _musicT('song.ai_generating'));
    try {
        const data = await _songAiFetch(body);
        if (data.error || !data.song) {
            _songAiStatus(root, 'error', _musicT(_SONG_AI_ERRORS[data.code] || 'song.ai_error'));
            return false;
        }
        applyMusicSongReply(root, data);
        _songAiStatus(root, 'ok', _musicT('song.ai_done', { title: data.title || '' }));
        return true;
    } catch (_error) {
        _songAiStatus(root, 'error', _musicT('song.ai_error'));
        return false;
    } finally {
        button.disabled = false;
    }
}

function _songAiModelOptions(models) {
    const first = `<option value="">${_musicT('song.ai_model_default')}</option>`;
    return first + models.map(model => `<option value="${escapeHtml(model.name)}">${escapeHtml(model.name)}</option>`).join('');
}

async function _loadOllamaModels() {
    try {
        const res = await fetchWithAuth('/api/ai-generator/ollama/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        });
        const data = await res.json().catch(() => ({}));
        return data.success && Array.isArray(data.models) ? data.models : [];
    } catch (_error) {
        return [];
    }
}

/**
 * Con Ollama ofrece los modelos instalados; con otro proveedor oculta y reinicia el selector de modelo.
 * @param {Element} root Raíz de la pestaña (#xm-root).
 * @returns {Promise<void>}
 */
async function syncMusicSongAiModel(root) {
    const select = _songAiEl(root, 'xm-song-ai-model');
    const isOllama = _songAiEl(root, 'xm-song-ai-provider').value === 'ollama';
    select.hidden = !isOllama;
    select.innerHTML = _songAiModelOptions(isOllama ? await _loadOllamaModels() : []);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderMusicSongAi, applyMusicSongReply, clearMusicSongMotif, requestMusicSong, syncMusicSongAiModel };
}
