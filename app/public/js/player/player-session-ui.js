/**
 * @fileoverview Templates y UI para gestión de sesión
 * Renderizado de pantallas de sesión, lobby y errores
 */

import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

export function mostrarErrorSesionNoEncontrada() {
    return `
        <img src="/images/logo.svg" alt="Logo"
            style="width: 100%; max-width: 384px; margin: 0 auto 2rem auto; filter: drop-shadow(0 10px 8px rgb(0 0 0 / 0.04));">
        <div id="login-box" class="bg-white p-8 rounded-3xl shadow-2xl text-slate-800 border-b-8 border-gray-200">
            <div class="text-center">
                <i class="fas fa-exclamation-triangle text-6xl text-red-500 mb-4"></i>
                <h2 class="text-2xl font-black text-slate-800 mb-2">${_t('player.session_ui.session_not_found', null, 'Sesión No Encontrada')}</h2>
                <p class="text-slate-500 mb-4">${_t('player.session_ui.session_not_found_msg', null, 'El código que ingresaste no corresponde a una sesión activa.')}</p>
                <p class="text-slate-600 font-semibold mb-6">${_t('player.session_ui.verify_qr_msg', null, 'Por favor, verifica que el presentador haya iniciado el juego y escanea el código QR que está mostrando.')}</p>
                <div class="bg-slate-100 p-6 rounded-lg mb-6">
                    <p class="text-sm text-slate-500">
                        <i class="fas fa-info-circle mr-2 text-blue-500"></i>
                        ${_t('player.session_ui.qr_auto_load', null, 'Una vez que escanees el QR correcto, se cargará la página automáticamente.')}
                    </p>
                </div>
                <button data-player-action="reload-page"
                    class="btn-glass-3d w-full bg-purple-600 text-white p-4 rounded-2xl font-black text-xl">
                    <i class="fas fa-redo mr-2"></i>${_t('player.session_ui.retry', null, 'INTENTAR DE NUEVO')}
                </button>
            </div>
        </div>
    `;
}

export function mostrarPantallaReconectando(nickname) {
    return `
        <div class="reconnecting-container">
            <div class="spinner"></div>
            <h2>${escapeHtml(_t('player.session_ui.reconnecting_title', { nickname: nickname.toUpperCase() }, '¡TODO LISTO, {nickname}!'))}</h2>
            <p class="status-text">${_t('player.session_ui.reconnecting_status', null, 'RECONECTANDO A TU PARTIDA...')}</p>
            <p class="status-subtext">${_t('player.session_ui.reconnecting_subtext', null, 'Esperando que el presentador avance a la siguiente pregunta')}</p>
        </div>
    `;
}

export function mostrarPantallaConectando() {
    return `
        <div class="loading-container">
            <div class="spinner spinner-purple"></div>
            <h2>${_t('player.session_ui.connecting', null, 'CONECTANDO...')}</h2>
            <p>${_t('player.session_ui.connecting_wait', null, 'Espera un momento')}</p>
        </div>
    `;
}

export function mostrarEquipoSeleccionado(nickname, teamName) {
    return `
        <div class="team-selected-container">
            <div class="success-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <h2>${_t('player.session_ui.reconnected', null, '¡RECONECTADO!')}</h2>
            <p class="player-name">${escapeHtml(nickname)}</p>
            <p class="team-name">${escapeHtml(_t('player.session_ui.team_label', { teamName }, 'EQUIPO: {teamName}'))}</p>
            <p class="status-text">${_t('player.session_ui.waiting_game_start', null, 'ESPERANDO INICIO DEL JUEGO...')}</p>
        </div>
    `;
}

export function mostrarLobbyReconectado(nickname) {
    return `
        <div class="app-container">
            <div id="main-container">
                <div class="lobby-container">
                    <div class="success-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h2>${_t('player.session_ui.reconnected', null, '¡RECONECTADO!')}</h2>
                    <p class="player-name">${escapeHtml(nickname)}</p>
                    <p class="status-text">${_t('player.session_ui.game_will_start', null, 'LA PARTIDA COMENZARÁ CUANDO EL PRESENTADOR INICIE EL JUEGO')}</p>
                    <button data-player-action="salir-lobby" class="btn-danger">
                        🚪 ${_t('player.session_ui.exit_game', null, 'SALIR DEL JUEGO')}
                    </button>
                </div>
            </div>
        </div>
    `;
}

export function mostrarLobbyNormal(nickname) {
    return `
        <div class="lobby-container">
            <h2 class="lobby-title">${escapeHtml(_t('player.session_ui.get_ready', { nickname }, '¡PREPÁRATE, {nickname}!'))}</h2>
            <p class="lobby-text">${_t('player.session_ui.game_will_start', null, 'LA PARTIDA COMENZARÁ CUANDO EL PRESENTADOR INICIE EL JUEGO')}</p>
            <button data-player-action="salir-lobby" class="btn-danger">
                🚪 ${_t('player.session_ui.exit_game', null, 'SALIR DEL JUEGO')}
            </button>
        </div>
    `;
}

export function mostrarErrorJoinLobby(errorMessage, lastNickname = '') {
    return `
        <img src="/images/logo.svg" alt="Logo"
            style="width: 100%; max-width: 384px; margin: 0 auto 2rem auto; filter: drop-shadow(0 10px 8px rgb(0 0 0 / 0.04));">
        <div id="login-box" class="bg-white p-8 rounded-3xl shadow-2xl text-slate-800 border-b-8 border-gray-200">
            <div id="step-2">
                <h2 class="text-slate-500 font-bold mb-4 uppercase text-sm">${_t('player.session_ui.your_name', null, '¿Tu nombre?')}</h2>
                <p class="text-red-600 font-bold mb-3 text-sm">⚠️ ${errorMessage}</p>
                <input type="text" id="nickname-input" placeholder="NOMBRE" maxlength="15" value="${lastNickname}"
                    class="w-full p-4 mb-4 border-4 border-red-300 rounded-2xl font-black text-2xl text-center focus:border-purple-500 outline-none uppercase">
                <button data-player-action="join-lobby"
                    class="btn-glass-3d w-full bg-green-600 text-white p-4 rounded-2xl font-black text-xl">¡LISTO!</button>
            </div>
        </div>
    `;
}

export function mostrarErrorSocketDesconectado() {
    return `
        <img src="/images/logo.svg" alt="Logo"
            style="width: 100%; max-width: 384px; margin: 0 auto 2rem auto; filter: drop-shadow(0 10px 8px rgb(0 0 0 / 0.04));">
        <div id="login-box" class="bg-white p-8 rounded-3xl shadow-2xl text-slate-800 border-b-8 border-gray-200">
            <div class="text-center">
                <i class="fas fa-wifi text-6xl text-orange-500 mb-4"></i>
                <h2 class="text-2xl font-black text-slate-800 mb-2">${_t('player.session_ui.connecting_server', null, 'Conectando al servidor...')}</h2>
                <p class="text-slate-500 mb-6">${_t('player.session_ui.connecting_wait_moment', null, 'Por favor, espera un momento')}</p>
                <div class="w-16 h-16 border-8 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <button data-player-action="join-lobby" class="btn-glass-3d w-full bg-purple-600 text-white p-4 rounded-2xl font-black text-xl mt-4">
                    ${_t('player.session_ui.retry_btn', null, 'REINTENTAR')}
                </button>
            </div>
        </div>
    `;
}
