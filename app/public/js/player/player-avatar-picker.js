/**
 * @fileoverview Selector de avatar del jugador, debajo del apodo. Lee el ajuste de Interfaz
 * (playerAvatars + avatarSet) de /api/ui-settings; si está apagado, no se muestra nada y el
 * jugador entra sin avatar. Recuerda la elección en localStorage para la próxima partida;
 * sin elección previa propone uno al azar del conjunto. El servidor vuelve a comprobar el
 * avatar (AvatarsFeature).
 */

const STORAGE_KEY = 'xiro_player_avatar';

let settingsPromise = null;
let chosen = null;

function catalog() {
    return window.XiroAvatars;
}

function readSaved() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function save(id) {
    try {
        localStorage.setItem(STORAGE_KEY, id);
    } catch {
        /* sin almacenamiento: vale para esta partida */
    }
}

function loadSettings() {
    if (!settingsPromise) {
        settingsPromise = fetch('/api/ui-settings')
            .then(res => (res.ok ? res.json() : {}))
            .then(settings => ({
                enabled: settings.playerAvatars !== false,
                set: catalog().normalize(settings.avatarSet)
            }))
            .catch(() => ({ enabled: false, set: [] }));
    }
    return settingsPromise;
}

function attr(text) {
    return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function optionHtml(id) {
    const name = attr(_t(catalog().labelKey(id), null, id));
    return `<button type="button" class="avp-option" data-avatar="${id}" aria-pressed="${id === chosen}"
            aria-label="${name}" title="${name}">
        <img src="${catalog().iconUrl(id)}" alt="" width="36" height="36" loading="lazy">
    </button>`;
}

function select(container, id) {
    chosen = id;
    save(id);
    container.querySelectorAll('.avp-option').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.avatar === id));
    });
}

function initialChoice(set) {
    if (set.indexOf(chosen) !== -1) return chosen;
    const saved = readSaved();
    if (set.indexOf(saved) !== -1) return saved;
    return set[Math.floor(Math.random() * set.length)];
}

/** Pinta el selector en #avatar-picker (paso del apodo o pantalla de error). */
export async function mountAvatarPicker() {
    const container = document.getElementById('avatar-picker');
    if (!container) return;
    const { enabled, set } = await loadSettings();
    if (!enabled || !set.length) {
        chosen = null;
        container.hidden = true;
        return;
    }
    chosen = initialChoice(set);
    save(chosen);
    const label = _t('avatars.player.label', null, 'Elige tu avatar');
    container.innerHTML = `<p class="avp-label">${label}</p>
        <div class="avp-grid" role="group" aria-label="${attr(label)}">${set.map(optionHtml).join('')}</div>`;
    container.hidden = false;
    container.onclick = event => {
        const btn = event.target.closest('.avp-option');
        if (btn && catalog().isKnown(btn.dataset.avatar)) select(container, btn.dataset.avatar);
    };
}

/** Avatar que se envía con join-lobby; antes de pintar el selector, el guardado. */
export function getChosenAvatar() {
    const id = chosen || readSaved();
    return catalog()?.isKnown(id) ? id : null;
}

/** <img> del avatar para las pantallas del jugador; '' si no hay. */
export function avatarImgHtml(id, className = 'avp-self') {
    if (!catalog()?.isKnown(id)) return '';
    return `<img class="${className}" src="${catalog().iconUrl(id)}" alt="" width="96" height="96">`;
}
