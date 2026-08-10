/**
 * @fileoverview Control de sesion del presentador
 * Acciones para Xiro! partida y limpiar storage.
 */

import { getSocket } from './presenter-socket-config.js?v=20260810122358';
import {
    getSessionId,
    getPin,
    setSessionId,
    setPin,
    setIsTeamMode,
    setTeamConfig,
    setConnectedPlayers,
    setPlayersData,
    setTotalPlayers
} from './presenter-state.js?v=20260810122358';
import { updatePlayersPanel } from './presenter-game-ui.js?v=20260810122358';
import { cleanupPodio } from './presenter-podio.js?v=20260810122358';
import { cleanupRevealElements } from './presenter-reveal.js?v=20260810122358';
import { mostrarModalConfirmacion } from '../shared/modal.js?v=20260810122358';

let returnHomeInProgress = false;

function clearPresenterStorage() {
    localStorage.removeItem('xiro_presenter_sessionId');
    localStorage.removeItem('xiro_presenter_pin');
    sessionStorage.removeItem('xiro_presenter_sessionId');
    sessionStorage.removeItem('xiro_presenter_pin');
}

function resetPresenterState() {
    setSessionId(null);
    setPin(null);
    setIsTeamMode(false);
    setTeamConfig(null);
    setConnectedPlayers([]);
    setPlayersData({});
    setTotalPlayers(0);
}

function resetPresenterUI() {
    // Detener y limpiar el timer de preguntas
    if (window.timerInterval) {
        clearInterval(window.timerInterval);
        window.timerInterval = null;
    }
    window.timerPaused = false;
    window.currentSeconds = 0;

    // Limpiar fuegos artificiales del podio si estaban activos
    cleanupPodio();

    // Limpiar paneles de reveal (justificación/ranking) si estaban visibles
    cleanupRevealElements();

    // Ocultar el overlay de cuenta regresiva
    const countdownOverlay = document.getElementById('countdown-overlay');
    if (countdownOverlay) {
        countdownOverlay.classList.add('hidden');
    }

    // Resetear panel de jugadores
    const pCount = document.getElementById('p-count');
    if (pCount) pCount.innerText = _t('0');

    const pList = document.getElementById('p-list');
    if (pList) pList.innerHTML = _tHtml('');

    updatePlayersPanel();
}

function ensurePresenterSocketConnected() {
    const socket = getSocket();
    if (socket && !socket.connected) {
        socket.connect();
    }
}

async function returnToPresenterHome() {
    if (returnHomeInProgress) return;

    returnHomeInProgress = true;
    try {
        await goToPresenterHome();
    } finally {
        setTimeout(ensurePresenterSocketConnected, 250);
        setTimeout(() => {
            returnHomeInProgress = false;
        }, 500);
    }
}

async function goToPresenterHome() {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('reset');
    cleanUrl.searchParams.delete('session');
    cleanUrl.searchParams.delete('pin');
    cleanUrl.searchParams.delete('mode');
    cleanUrl.searchParams.delete('teams');
    window.history.replaceState({}, '', cleanUrl);

    const module = await import('./presenter-lobby.js?v=20260810122358');
    module.mostrarSelectorPIN();
}

function removeAbandonOverlay() {
    const overlay = document.getElementById('abandon-overlay');
    if (overlay) overlay.remove();
}

function removeInfoOverlay() {
    const overlay = document.getElementById('info-overlay');
    if (overlay) overlay.remove();
}

function showInfoOverlay({ title, message, buttonText = _t('presenter.session.btn_accept', null, 'Aceptar'), onClose }) {
    removeInfoOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'info-overlay';
    overlay.className = 'fixed inset-0 z-[9999] bg-slate-900/80 flex items-center justify-center backdrop-blur-md';
    overlay.innerHTML = _tHtml(`
        <div class="w-full max-w-sm min-h-[260px] bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl flex flex-col justify-center">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center">
                    <i class="fas fa-circle-info"></i>
                </div>
                <h2 class="text-2xl font-black text-white">${title}</h2>
            </div>
            <p class="text-slate-300 mb-6">${message}</p>
            <div class="flex justify-center">
                <button id="info-close" class="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-full font-bold">${buttonText}</button>
            </div>
        </div>
    `);

    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('info-close');
    closeBtn.addEventListener('click', () => {
        removeInfoOverlay();
        if (typeof onClose === 'function') onClose();
    });
}

function showAbandonOverlay({ onConfirm, onCancel }) {
    if (document.getElementById('abandon-overlay')) {
        return;
    }

    const confirmWords = [
        'JAEN',
        'CORDOBA',
        'SEVILLA',
        'HUELVA',
        'CADIZ',
        'MALAGA',
        'GRANADA',
        'ALMERIA'
    ];
    const confirmWord = confirmWords[Math.floor(Math.random() * confirmWords.length)];

    const overlay = document.createElement('div');
    overlay.id = 'abandon-overlay';
    overlay.className = 'fixed inset-0 z-[9999] bg-slate-900/80 flex items-center justify-center backdrop-blur-md';
    overlay.innerHTML = _tHtml(`
        <div class="w-full max-w-sm min-h-[320px] bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl flex flex-col justify-center">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-full bg-red-500/20 text-red-300 flex items-center justify-center">
                    <i class="fas fa-triangle-exclamation"></i>
                </div>
                <h2 class="text-2xl font-black text-white">${_t('presenter.session.abandon_title', null, '¿Abandonar partida?')}</h2>
            </div>
            <p class="text-slate-300 mb-6">${_t('presenter.session.abandon_msg_html', { confirmWord }, 'Escribe <span class="font-black text-red-300">{confirmWord}</span> para confirmar. Esto expulsará a todos los jugadores.').replace('{confirmWord}', confirmWord)}</p>
            <input id="abandon-input" type="text" placeholder="${confirmWord}"
                class="w-full bg-slate-900 text-white border border-slate-700 rounded-xl px-4 py-3 font-black uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-red-400" />
            <div class="flex justify-center gap-3 mt-6">
                <button id="abandon-cancel" class="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-full font-bold">${_t('presenter.session.cancel', null, 'Cancelar')}</button>
                <button id="abandon-confirm" class="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-full font-bold disabled:opacity-50 disabled:cursor-not-allowed" disabled>${_t('presenter.session.btn_confirm', null, 'Confirmar')}</button>
            </div>
        </div>
    `);

    document.body.appendChild(overlay);

    const input = document.getElementById('abandon-input');
    const cancelBtn = document.getElementById('abandon-cancel');
    const confirmBtn = document.getElementById('abandon-confirm');

    const syncConfirmState = () => {
        const value = input ? input.value.trim().toUpperCase() : '';
        confirmBtn.disabled = value !== confirmWord;
    };

    if (input) {
        input.focus();
        input.addEventListener('input', syncConfirmState);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                confirmBtn.click();
            } else if (event.key === 'Escape') {
                cancelBtn.click();
            }
        });
        syncConfirmState();
    }

    cancelBtn.addEventListener('click', () => {
        removeAbandonOverlay();
        if (typeof onCancel === 'function') onCancel();
    });

    confirmBtn.addEventListener('click', () => {
        if (confirmBtn.disabled) {
            if (input) input.focus();
            return;
        }
        removeAbandonOverlay();
        if (typeof onConfirm === 'function') onConfirm();
    });
}

export function abandonarJuego() {
    const sessionId = getSessionId();
    const pin = getPin();
    const roomIdOrPin = sessionId || pin;

    if (!roomIdOrPin) {
        showInfoOverlay({
            title: _t('presenter.session.no_session_title', null, 'Sin sesión activa'),
            message: _t('presenter.session.no_session_msg', null, 'No hay una sesión activa para Xiro!.'),
            buttonText: _t('presenter.session.understood', null, 'Entendido')
        });
        return;
    }

    showAbandonOverlay({
        onConfirm: () => {
            const socket = getSocket();
            console.log('🚪 Xiro! juego solicitado:', { roomIdOrPin });
            socket.emit('abandon-game', { roomIdOrPin, reason: 'abandoned' });

            cleanupPodio();

            clearPresenterStorage();
            resetPresenterState();
            resetPresenterUI();
            goToPresenterHome();

            setTimeout(ensurePresenterSocketConnected, 250);
        }
    });
}

export async function concluirJuegoYVolver() {
    const sessionId = getSessionId();
    const pin = getPin();
    const roomIdOrPin = sessionId || pin;

    if (roomIdOrPin) {
        const socket = getSocket();
        console.log('🏁 Finalizando sesion y volviendo:', { roomIdOrPin });
        socket.emit('abandon-game', { roomIdOrPin, reason: 'concluded' });
    }

    cleanupPodio();

    clearPresenterStorage();
    resetPresenterState();
    resetPresenterUI();
    await returnToPresenterHome();
}

export function terminarJuego() {
    const sessionId = getSessionId();
    const pin = getPin();
    const roomIdOrPin = sessionId || pin;

    if (!roomIdOrPin) return;

    mostrarModalConfirmacion(
        _t('presenter.session.end_title', null, '¿Terminar partida?'),
        _t('presenter.session.end_msg', null, 'Se finalizará el juego y se mostrará el podio con la clasificación actual.'),
        () => {
            // Detener cuenta atrás inmediatamente al confirmar, sin esperar al servidor
            clearInterval(window.timerInterval);
            window.timerInterval = null;
            const overlay = document.getElementById('countdown-overlay');
            if (overlay) overlay.classList.add('hidden');

            const socket = getSocket();
            if (window.isTrivialGame) {
                socket.emit('trivial-end-game', { roomId: roomIdOrPin });
            } else {
                socket.emit('end-game', { roomIdOrPin, reason: 'manual' });
            }
        },
        null,
        _t('presenter.session.end_yes', null, 'Sí, terminar'),
        _t('presenter.session.cancel', null, 'Cancelar'),
        'warning'
    );
}

export async function handleGameAbandoned(eventData) {
    const isObjectPayload = eventData && typeof eventData === 'object';
    const reason = isObjectPayload ? eventData.reason : undefined;
    const message = isObjectPayload ? eventData.message : eventData;

    clearPresenterStorage();
    resetPresenterState();
    resetPresenterUI();

    if (reason === 'concluded') {
        await returnToPresenterHome();
        return;
    }

    showInfoOverlay({
        title: _t('presenter.session.abandoned_title', null, 'Sesión abandonada'),
        message: _t('presenter.session.abandoned_msg', null, message || 'La sesión fue abandonada.'),
        buttonText: _t('presenter.session.btn_back_home', null, 'Volver al inicio'),
        onClose: () => {
            void returnToPresenterHome();
        }
    });
}
