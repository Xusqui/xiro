// player-reactions.js
// Bandeja de reacciones con emoji: se ve fuera de la pregunta abierta (las reglas están en
// player-reactions-logic.js) y manda cada toque al servidor con 'send-reaction'.

import '../core/reactions-catalog.js?v=20261030120000';
import './player-reactions-logic.js?v=20261030180000';
import { getSocket } from './player-socket-config.js?v=20260922172926';

const ECHO_MS = 600;
const COOL_MS = 300;
const EXIT_MS = 220;

const catalog = self.XiroReactions;
const model = self.XiroPlayerReactions.createReactionsModel();
let tray = null;
let renderedSet = '';
let hideTimer = null;

function t(key, params, fallback) {
    return typeof window._t === 'function' ? window._t(key, params, fallback) : fallback;
}

function labelFor(id) {
    const name = t(catalog.labelKey(id), null, id);
    return t('reactions.player.send', { name }, name);
}

// Las pantallas del jugador (diapositivas, reveal, resultado…) reescriben
// document.body.innerHTML y se llevan la bandeja: se vuelve a colgar del body.
function reattach() {
    if (!tray || tray.isConnected) return;
    document.body.appendChild(tray);
    document.body.classList.toggle('rx-tray-on', !tray.hidden && tray.classList.contains('is-open'));
}

function ensureTray() {
    if (tray) {
        reattach();
        return tray;
    }
    tray = document.createElement('div');
    tray.id = 'rx-tray';
    tray.className = 'rx-tray';
    tray.setAttribute('role', 'toolbar');
    tray.hidden = true;
    tray.addEventListener('click', onKeyClick);
    document.body.appendChild(tray);
    new MutationObserver(reattach).observe(document.body, { childList: true });
    return tray;
}

function renderKeys(set) {
    renderedSet = set.join(',');
    tray.setAttribute('aria-label', t('reactions.player.tray_label', null, 'Reacciones'));
    tray.replaceChildren(
        ...set.map(id => {
            const key = document.createElement('button');
            key.type = 'button';
            key.className = 'rx-key';
            key.dataset.rx = id;
            key.setAttribute('aria-label', labelFor(id));
            const img = document.createElement('img');
            img.src = catalog.iconUrl(id);
            img.alt = '';
            img.width = 32;
            img.height = 32;
            img.draggable = false;
            key.appendChild(img);
            return key;
        })
    );
}

function show() {
    clearTimeout(hideTimer);
    if (!tray.hidden) return;
    tray.hidden = false;
    document.body.classList.add('rx-tray-on');
    requestAnimationFrame(() => tray.classList.add('is-open'));
}

function hide() {
    if (tray.hidden) return;
    tray.classList.remove('is-open');
    document.body.classList.remove('rx-tray-on');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        tray.hidden = true;
    }, EXIT_MS);
}

function render() {
    ensureTray();
    const view = model.view();
    if (view.set.join(',') !== renderedSet) renderKeys(view.set);
    if (view.visible) show();
    else hide();
}

function dispatch(event) {
    model.dispatch(event);
    render();
}

function echo(key, id) {
    const img = document.createElement('img');
    img.className = 'rx-echo';
    img.src = catalog.iconUrl(id);
    img.alt = '';
    key.appendChild(img);
    setTimeout(() => img.remove(), ECHO_MS);
}

function cool(key) {
    key.classList.add('is-cooling');
    setTimeout(() => key.classList.remove('is-cooling'), COOL_MS);
}

function onKeyClick(event) {
    const key = event.target.closest('.rx-key');
    if (!key) return;
    const id = key.dataset.rx;
    if (!model.trySend(id)) {
        cool(key);
        return;
    }
    getSocket().emit('send-reaction', { r: id });
    echo(key, id);
    if (typeof navigator.vibrate === 'function') navigator.vibrate(10);
}

function refreshState() {
    getSocket().emit('get-reactions', {}, res => {
        if (res && res.ok) dispatch({ type: 'state', enabled: res.enabled, set: res.set });
    });
}

export function registerReactionEvents() {
    const socket = getSocket();
    const on = (event, toAction) => socket.on(event, data => dispatch(toAction(data || {})));

    on('join-success', () => ({ type: 'lobby' }));
    on('reconnected-success', snapshot => ({ type: 'snapshot', snapshot }));
    on('game-started', data => ({ type: 'question', question: data.firstQuestion }));
    on('new-question', data => ({ type: 'question', question: data.question, review: data.review === true }));
    // En una pregunta la abre el resultado propio: 'answer-result' llega solo a este
    // jugador al responder (en equipos, cuando responde todo el equipo; mientras tanto
    // llega 'answer-pending', que no la abre). Y el reveal, para quien no respondió.
    // 'ranking-update' no sirve: va a todos los jugadores cada vez que alguien puntúa.
    on('answer-result', () => ({ type: 'answered' }));
    ['reveal-answer', 'question-review'].forEach(event => on(event, () => ({ type: 'revealed' })));
    ['game-ended', 'trivial-game-ended', 'game-abandoned'].forEach(event => on(event, () => ({ type: 'ended' })));
    on('reactions-state', data => ({ type: 'state', enabled: data.enabled, set: data.set }));

    socket.on('join-success', refreshState);
    socket.on('reconnected-success', refreshState);
    window.addEventListener('xiro:language-changed', () => {
        renderedSet = '';
        render();
    });
}
