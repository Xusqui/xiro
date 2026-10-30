/**
 * @fileoverview Sección «Avatares de jugador» del tab Interfaz del panel de configuración:
 * interruptor (playerAvatars) y selector de los avatares que se ofrecen al unirse
 * (avatarSet, 4 o más, en el orden del catálogo). Se guarda con la barra común
 * (config-panel-ui.js → uiTabSnapshot / saveUiTab). Reutiliza la rejilla de
 * admin-reactions.css.
 * Depende de: core/avatars-catalog.js (window.XiroAvatars), checkbox.js y
 * admin-savebar.js (refreshSaveBar).
 */

/** Avatares marcados en el formulario (aún sin guardar). */
let _avatarsSet = [];

function _avCatalog() {
    return window.XiroAvatars;
}

function _avAttr(text) {
    return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function _avName(id) {
    return _t(_avCatalog().labelKey(id), null, id);
}

function _avCountText() {
    return _t('avatars.admin.count', { n: _avatarsSet.length, total: _avCatalog().CATALOG.length }, '{n} de {total}');
}

function _avOptionHtml(id) {
    const name = _avAttr(_avName(id));
    const picked = _avatarsSet.indexOf(id) !== -1;
    return `<button type="button" class="rx-pick" data-config-action="pick-avatar" data-avatar="${id}"
            aria-pressed="${picked}" aria-label="${name}" title="${name}">
        <img src="${_avCatalog().iconUrl(id)}" alt="" width="32" height="32" loading="lazy">
        <span class="rx-pick__order" aria-hidden="true">${picked ? '✓' : ''}</span>
    </button>`;
}

function renderAvatarsSection(settings) {
    const catalog = _avCatalog();
    const enabled = settings.playerAvatars !== false;
    _avatarsSet = catalog.normalize(settings.avatarSet);

    return `<div class="bg-white rounded-2xl border-2 border-slate-200 p-5">
        <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-user-astronaut text-amber-600 text-base"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-800 text-sm">${_t('avatars.admin.title', null, 'Avatares de jugador')}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${_t('avatars.admin.desc')}</p>
                </div>
            </div>
            ${renderCheckbox({ key: 'playerAvatars', id: 'ui-switch-playerAvatars', checked: enabled, label: _t('avatars.admin.title', null, 'Avatares de jugador'), action: 'toggle-avatars-enabled' })}
        </div>
        <div id="avatars-picker" class="mt-5 pt-5 border-t border-slate-100" ${enabled ? '' : 'hidden'}>
            <div class="flex items-center justify-between gap-3 mb-1">
                <p class="font-bold text-slate-800 text-sm">${_t('avatars.admin.set_label')}</p>
                <div class="flex items-center gap-3">
                    <span id="avatars-set-count" class="rx-count${_avatarsSet.length < catalog.MIN_SET ? ' rx-count--incomplete' : ''}">${_avCountText()}</span>
                    <button type="button" data-config-action="select-all-avatars" class="rx-reset">${_t('avatars.admin.all')}</button>
                    <button type="button" data-config-action="reset-avatar-set" class="rx-reset">${_t('avatars.admin.reset')}</button>
                </div>
            </div>
            <p class="text-xs text-slate-500 mb-4">${_t('avatars.admin.set_hint', { n: catalog.MIN_SET })}</p>
            <div class="rx-pick-grid" role="group" aria-label="${_avAttr(_t('avatars.admin.set_label'))}">
                ${catalog.CATALOG.map(_avOptionHtml).join('')}
            </div>
        </div>
    </div>`;
}

/** Marca las opciones y actualiza el contador según _avatarsSet. */
function _syncAvatarsPicker() {
    document.querySelectorAll('[data-config-action="pick-avatar"]').forEach(btn => {
        const picked = _avatarsSet.indexOf(btn.dataset.avatar) !== -1;
        btn.setAttribute('aria-pressed', String(picked));
        btn.querySelector('.rx-pick__order').textContent = picked ? '✓' : '';
    });
    const count = document.getElementById('avatars-set-count');
    if (count) {
        count.textContent = _avCountText();
        count.classList.toggle('rx-count--incomplete', _avatarsSet.length < _avCatalog().MIN_SET);
    }
}

function _avChanged() {
    _syncAvatarsPicker();
    if (typeof refreshSaveBar === 'function') refreshSaveBar();
}

/** Mantiene el orden del catálogo, así el jugador ve siempre la misma rejilla. */
function toggleAvatarPick(id) {
    const catalog = _avCatalog();
    if (!catalog.isKnown(id)) return;
    const picked = _avatarsSet.indexOf(id) !== -1;
    _avatarsSet = catalog.CATALOG.filter(item => (item === id ? !picked : _avatarsSet.indexOf(item) !== -1));
    _avChanged();
}

function selectAllAvatars() {
    _avatarsSet = _avCatalog().CATALOG.slice();
    _avChanged();
}

function resetAvatarSet() {
    _avatarsSet = _avCatalog().DEFAULT_SET.slice();
    _avChanged();
}

function toggleAvatarsEnabled(enabled) {
    const picker = document.getElementById('avatars-picker');
    if (picker) picker.hidden = !enabled;
    if (typeof refreshSaveBar === 'function') refreshSaveBar();
}

function avatarsSnapshot() {
    return {
        playerAvatars: Boolean(document.getElementById('ui-switch-playerAvatars')?.checked),
        avatarSet: _avatarsSet.slice()
    };
}

/** Mensaje si el formulario no se puede guardar; null si está bien. */
function avatarsSaveError(snapshot) {
    const min = _avCatalog().MIN_SET;
    if (snapshot.avatarSet.length >= min) return null;
    return _t('avatars.admin.incomplete', { n: min }, 'Elige al menos {n} avatares para guardar');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderAvatarsSection,
        toggleAvatarPick,
        selectAllAvatars,
        resetAvatarSet,
        toggleAvatarsEnabled,
        avatarsSnapshot,
        avatarsSaveError
    };
}
