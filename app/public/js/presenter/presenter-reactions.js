/**
 * @fileoverview Reacciones con emoji en el escenario del presentador. Pide el estado de la
 * sala al unirse o reconectar, pinta las ráfagas ('reactions') con la corriente compartida
 * (core/reactions-stream.js) solo si están activas, y deja silenciarlas o reactivarlas
 * desde el menú ⋯ o con la tecla R, con un aviso breve en el escenario.
 *
 * Los módulos UMD de core (catálogo, plan y corriente) se cargan con <script> en
 * presentador.html. Expone window.XiroPresenterReactions para el menú.
 */

import { getSocket } from './presenter-socket-config.js?v=20260922172926';

const TOGGLE_ID = 'reactions-toggle-btn';
const TOAST_MS = 1800;
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function t(key, fallback) {
    return typeof _t === 'function' ? _t(key, null, fallback) : fallback;
}

/** Tecla R sin modificadores y fuera de un campo de texto. */
export function isReactionsShortcut(event) {
    if (event.key !== 'r' && event.key !== 'R') return false;
    if (event.repeat || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return false;
    const target = event.target;
    return !(target && typeof target.closest === 'function' && target.closest(EDITABLE_SELECTOR));
}

function ensureElement(doc, className, setup) {
    let el = doc.querySelector('.' + className);
    if (!el) {
        el = doc.createElement('div');
        el.className = className;
        setup(el);
        doc.body.appendChild(el);
    }
    return el;
}

/**
 * @param {Object} deps
 * @param {{ emit: Function }} deps.socket
 * @param {Document} [deps.doc]
 * @param {Function} deps.createStream - XiroReactionsStream.createReactionsStream
 */
export function createPresenterReactions({ socket, doc = document, createStream }) {
    const layer = ensureElement(doc, 'rxs-layer', el => el.setAttribute('aria-hidden', 'true'));
    const toast = ensureElement(doc, 'rxs-toast', el => {
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
    });
    const stream = createStream({ container: layer });
    let state = { enabled: false, set: [] };
    let pending = false;
    let toastTimer = null;

    function syncToggle() {
        const btn = doc.getElementById(TOGGLE_ID);
        if (!btn) return;
        const label = state.enabled
            ? t('reactions.presenter.mute', 'Silenciar reacciones')
            : t('reactions.presenter.unmute', 'Activar reacciones');
        btn.hidden = state.set.length === 0;
        btn.title = label + ' (R)';
        const icon = doc.getElementById('reactions-toggle-icon');
        if (icon) icon.className = 'fas ' + (state.enabled ? 'fa-comment-slash' : 'fa-face-smile');
        const text = doc.getElementById('reactions-toggle-label');
        if (text) text.textContent = label;
    }

    function announce() {
        toast.textContent = state.enabled
            ? t('reactions.presenter.unmuted', 'Reacciones activadas')
            : t('reactions.presenter.muted', 'Reacciones silenciadas');
        toast.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('is-visible'), TOAST_MS);
    }

    function apply(next) {
        if (!next) return;
        state = { enabled: next.enabled === true, set: Array.isArray(next.set) ? next.set : [] };
        if (!state.enabled) stream.clear();
        syncToggle();
    }

    function request() {
        socket.emit('get-reactions', {}, res => {
            if (res && res.ok) apply(res);
        });
    }

    function onBurst(payload) {
        if (state.enabled && payload && payload.c) stream.push(payload.c, state.set);
    }

    function toggle() {
        if (pending || state.set.length === 0) return;
        pending = true;
        socket.emit('set-reactions', { enabled: !state.enabled }, res => {
            pending = false;
            if (!res || !res.ok) return;
            apply(res);
            announce();
        });
    }

    return { request, apply, onBurst, toggle, refreshLabels: syncToggle };
}

export function registerPresenterReactions() {
    if (!window.XiroReactionsStream) return;
    const socket = getSocket();
    const reactions = createPresenterReactions({
        socket,
        createStream: window.XiroReactionsStream.createReactionsStream
    });
    socket.on('join-success', reactions.request);
    socket.on('reconnected-success', reactions.request);
    socket.on('reactions-state', reactions.apply);
    socket.on('reactions', reactions.onBurst);
    window.addEventListener('xiro:language-changed', reactions.refreshLabels);
    document.addEventListener('keydown', event => {
        if (!isReactionsShortcut(event)) return;
        event.preventDefault();
        reactions.toggle();
    });
    window.XiroPresenterReactions = { toggle: reactions.toggle };
}
