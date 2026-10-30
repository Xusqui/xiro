/**
 * @fileoverview Sección «Reacciones con emoji» del tab Interfaz del panel de configuración:
 * interruptor (emojiReactions) y selector de los 6 emojis de la barra del jugador
 * (reactionSet), en el orden en que se eligen, con una vista previa de la barra.
 * Se guarda con la barra común (config-panel-ui.js → uiTabSnapshot / saveUiTab).
 * Depende de: core/reactions-catalog.js (window.XiroReactions), checkbox.js y
 * admin-savebar.js (refreshSaveBar).
 */

/** Emojis elegidos en el formulario (aún sin guardar), en orden. */
let _reactionsSet = [];

function _rxCatalog() {
    return window.XiroReactions;
}

function _rxAttr(text) {
    return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function _rxName(id) {
    return _t(_rxCatalog().labelKey(id), null, id);
}

function _rxCountText() {
    const total = _rxCatalog().SET_SIZE;
    return _t('reactions.admin.count', { n: _reactionsSet.length, total }, '{n} de {total}');
}

function _rxOptionHtml(id) {
    const name = _rxAttr(_rxName(id));
    const order = _reactionsSet.indexOf(id);
    const blocked = order === -1 && _reactionsSet.length >= _rxCatalog().SET_SIZE;
    return `<button type="button" class="rx-pick" data-config-action="pick-reaction" data-reaction="${id}"
            aria-pressed="${order !== -1}" aria-label="${name}" title="${name}" ${blocked ? 'disabled' : ''}>
        <img src="${_rxCatalog().iconUrl(id)}" alt="" width="28" height="28" loading="lazy">
        <span class="rx-pick__order" aria-hidden="true">${order === -1 ? '' : order + 1}</span>
    </button>`;
}

function _rxPreviewHtml() {
    return _reactionsSet
        .map(id => `<span class="rx-preview__key"><img src="${_rxCatalog().iconUrl(id)}" alt="" width="24" height="24"></span>`)
        .join('');
}

function renderReactionsSection(settings) {
    const catalog = _rxCatalog();
    const enabled = settings.emojiReactions !== false;
    _reactionsSet = catalog.normalize(settings.reactionSet);

    return `<div class="bg-white rounded-2xl border-2 border-slate-200 p-5">
        <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-face-smile text-amber-600 text-base"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-800 text-sm">${_t('reactions.admin.title', null, 'Reacciones con emoji')}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${_t('reactions.admin.desc')}</p>
                </div>
            </div>
            ${renderCheckbox({ key: 'emojiReactions', id: 'ui-switch-emojiReactions', checked: enabled, label: _t('reactions.admin.title', null, 'Reacciones con emoji'), action: 'toggle-reactions-enabled' })}
        </div>
        <div id="reactions-picker" class="mt-5 pt-5 border-t border-slate-100" ${enabled ? '' : 'hidden'}>
            <div class="flex items-center justify-between gap-3 mb-1">
                <p class="font-bold text-slate-800 text-sm">${_t('reactions.admin.set_label')}</p>
                <div class="flex items-center gap-3">
                    <span id="reactions-set-count" class="rx-count${_reactionsSet.length < catalog.SET_SIZE ? ' rx-count--incomplete' : ''}">${_rxCountText()}</span>
                    <button type="button" data-config-action="reset-reaction-set" class="rx-reset">${_t('reactions.admin.reset')}</button>
                </div>
            </div>
            <p class="text-xs text-slate-500 mb-4">${_t('reactions.admin.set_hint')}</p>
            <div id="reactions-preview" class="rx-preview" aria-hidden="true">${_rxPreviewHtml()}</div>
            <div class="rx-pick-grid" role="group" aria-label="${_rxAttr(_t('reactions.admin.set_label'))}">
                ${catalog.CATALOG.map(_rxOptionHtml).join('')}
            </div>
        </div>
    </div>`;
}

/** Marca, numera y bloquea las opciones, el contador y la vista previa según _reactionsSet. */
function _syncReactionsPicker() {
    const full = _reactionsSet.length >= _rxCatalog().SET_SIZE;
    document.querySelectorAll('[data-config-action="pick-reaction"]').forEach(btn => {
        const order = _reactionsSet.indexOf(btn.dataset.reaction);
        btn.setAttribute('aria-pressed', String(order !== -1));
        btn.disabled = full && order === -1;
        btn.querySelector('.rx-pick__order').textContent = order === -1 ? '' : String(order + 1);
    });
    const count = document.getElementById('reactions-set-count');
    if (count) {
        count.textContent = _rxCountText();
        count.classList.toggle('rx-count--incomplete', !full);
    }
    const preview = document.getElementById('reactions-preview');
    if (preview) preview.innerHTML = _rxPreviewHtml();
}

function _rxChanged() {
    _syncReactionsPicker();
    if (typeof refreshSaveBar === 'function') refreshSaveBar();
}

function toggleReactionPick(id) {
    if (!_rxCatalog().isKnown(id)) return;
    const index = _reactionsSet.indexOf(id);
    if (index !== -1) _reactionsSet.splice(index, 1);
    else if (_reactionsSet.length < _rxCatalog().SET_SIZE) _reactionsSet.push(id);
    else return;
    _rxChanged();
}

function resetReactionSet() {
    _reactionsSet = _rxCatalog().DEFAULT_SET.slice();
    _rxChanged();
}

function toggleReactionsEnabled(enabled) {
    const picker = document.getElementById('reactions-picker');
    if (picker) picker.hidden = !enabled;
    if (typeof refreshSaveBar === 'function') refreshSaveBar();
}

function reactionsSnapshot() {
    return {
        emojiReactions: Boolean(document.getElementById('ui-switch-emojiReactions')?.checked),
        reactionSet: _reactionsSet.slice()
    };
}

/** Mensaje si el formulario no se puede guardar; null si está bien. */
function reactionsSaveError(snapshot) {
    const size = _rxCatalog().SET_SIZE;
    if (snapshot.reactionSet.length === size) return null;
    return _t('reactions.admin.incomplete', { n: size }, 'Elige {n} emojis para guardar');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderReactionsSection,
        toggleReactionPick,
        resetReactionSet,
        toggleReactionsEnabled,
        reactionsSnapshot,
        reactionsSaveError
    };
}
