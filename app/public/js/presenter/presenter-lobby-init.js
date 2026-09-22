/**
 * @fileoverview Inicialización del lobby del presentador
 * Validación de PIN y creación de sala de juego
 */

import { getSocket, getPresenterPlayerId } from './presenter-socket-config.js?v=20260922074829';
import {
    getSessionId, setSessionId, getPin, setPin,
    getIsTeamMode, setIsTeamMode, getTeamConfig, setTeamConfig,
    setGameType, getGameType
} from './presenter-state.js?v=20260922074829';
import { generateSessionId, mostrarLobbyMain, restoreLobbyHTML } from './presenter-utils.js?v=20260922074829';
import { mostrarQR, renderTeamLobby } from './presenter-game-ui.js?v=20260922074829';
import { volverAJuegos } from './presenter-lobby.js?v=20260922074829';

/**
 * Iniciar lobby del presentador
 */
export async function iniciarLobby() {
    const socket = getSocket();
    const pin = getPin();
    const presenterPlayerId = getPresenterPlayerId();

    // Solicitar fullscreen aquí mientras estamos en contexto de gesto del usuario
    // (antes de cualquier await). Así cuando el remoto inicie el juego vía socket,
    // el presentador ya estará en pantalla completa sin necesitar un segundo gesto.
    if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => { });
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        }
    }

    // Leer parámetros de modo de juego de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const teamsParam = urlParams.get('teams');

    if (mode === 'teams' && teamsParam) {
        try {
            setIsTeamMode(true);
            setTeamConfig({ teams: JSON.parse(decodeURIComponent(teamsParam)) });
            console.log('🎯 Modo equipos activado:', getTeamConfig());
        } catch (e) {
            console.error('Error parseando equipos:', e);
            setIsTeamMode(false);
            setTeamConfig(null);
        }
    }

    // Validar que el PIN existe en la base de datos antes de crear el lobby
    try {
        const response = await fetch(`/api/quizzes/validate/${pin}`);
        const data = await response.json();

        if (!data.exists) {
            mostrarLobbyMain(`
                <div class="h-full w-full flex flex-col items-center justify-center pt-10 px-10 pb-16">
                    <i class="fas fa-exclamation-triangle text-red-500 text-8xl mb-6"></i>
                    <h1 class="text-4xl font-black text-white mb-4">${_t('presenter.selector.invalid_pin.title', null, 'PIN No Válido')}</h1>
                    <p class="text-slate-400 mb-2 text-xl">${_t('presenter.selector.invalid_pin.message', {pin: String(pin)}, `El código <span class="font-mono bg-red-500/20 px-3 py-1 rounded">${pin}</span> no existe.`)}</p>
                    <p class="text-slate-500 mb-6">${_t('presenter.selector.invalid_pin.hint', null, 'Verifica el PIN o selecciona un juego de la lista.')}</p>
                    <button data-presenter-action="volver-juegos" class="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-full text-white font-bold uppercase transition shadow-lg">
                        <i class="fas fa-list mr-2"></i>${_t('presenter.selector.actions.show_games_available', null, 'Mostrar juegos disponibles')}
                    </button>
                </div>
            `);
            console.log(`🚫 PIN inválido: ${pin}`);
            return;
        }

        // PIN válido - generar sessionId único y continuar con el lobby
        const newSessionId = generateSessionId(pin);
        setSessionId(newSessionId);
        const resolvedGameType = data.gameType || 'standard';
        setGameType(resolvedGameType);
        window.isTrivialGame = (resolvedGameType === 'trivial');
        console.log(`✅ PIN ${pin} validado, generando sesión: ${newSessionId}, tipo: ${resolvedGameType}, isTrivialGame: ${window.isTrivialGame}`);

        // Guardar datos de sesión en AMBOS storages para reconexión
        // sessionStorage: persiste en F5 (misma pestaña) — fuente primaria
        // localStorage: persiste entre pestañas — fuente secundaria
        sessionStorage.setItem('xiro_presenter_sessionId', newSessionId);
        sessionStorage.setItem('xiro_presenter_pin', pin);
        sessionStorage.setItem('xiro_presenter_gameType', resolvedGameType);
        localStorage.setItem('xiro_presenter_sessionId', newSessionId);
        localStorage.setItem('xiro_presenter_pin', pin);
        localStorage.setItem('xiro_presenter_gameType', resolvedGameType);
        localStorage.setItem('xiro_presenter_playerId', presenterPlayerId);
        console.log('💾 Datos de presentador guardados en sessionStorage + localStorage para reconexión');

        // Actualizar URL con sessionId para que al recargar se mantenga la sesión
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('session', newSessionId);
        window.history.replaceState({}, '', newUrl);
        console.log('🔗 URL actualizada con sessionId:', newSessionId);

        // CRÍTICO: Restaurar el HTML original del lobby antes de mostrarlo
        restoreLobbyHTML();

        // Hacer visible el lobby principal
        document.getElementById('lobby-main').style.display = 'flex';

        document.getElementById('display-pin').innerText = _t(newSessionId);
        mostrarQR(newSessionId);

        // Mostrar equipos desde el inicio en modo equipos
        if (getIsTeamMode() && getTeamConfig()) {
            renderTeamLobby();
        }

        // Enviar sessionId al servidor para unirse a la sala única.
        // token del panel queda opcional para compatibilidad con sesiones autenticadas.
        const adminToken = localStorage.getItem('adminToken') || '';

        const lobbyData = {
            pin: pin,
            sessionId: newSessionId,
            playerId: presenterPlayerId,
            isTeamMode: getIsTeamMode()
        };

        if (adminToken) {
            lobbyData.token = adminToken;
        }

        const presenterSessionSecret =
            sessionStorage.getItem('xiro_presenter_sessionSecret') ||
            localStorage.getItem('xiro_presenter_sessionSecret');
        if (presenterSessionSecret) {
            lobbyData.sessionSecret = presenterSessionSecret;
        }

        // Solo incluir teamConfig si existe
        if (getTeamConfig()) {
            lobbyData.teamConfig = getTeamConfig();
        }

        console.log('📤 Preparado para enviar join-presenter-lobby con datos:', {
            ...lobbyData,
            token: lobbyData.token ? `${lobbyData.token.slice(0, 12)}...` : '(sin token)'
        });

        // CRÍTICO: Marcar join fresco pendiente ANTES de emitir para que handleConnect no
        // dispare reconnect-presenter mientras join-presenter-lobby está en tránsito o siendo
        // procesado. El flag se limpia en join-success / join-error.
        window._xiroFreshJoinPending = true;
        window._xiroPendingLobbyData = lobbyData;

        if (socket.connected) {
            console.log('✅ Socket ya conectado, enviando join-presenter-lobby inmediatamente');
            socket.emit('join-presenter-lobby', lobbyData);
        } else {
            console.log('⏳ Socket no conectado — handleConnect enviará join-presenter-lobby al conectar');
            // No usamos socket.once aquí: handleConnect (presenter-reconnection.js) reintenta
            // join-presenter-lobby en cada connect mientras _xiroFreshJoinPending sea true.

            // Si el socket no se conecta en 10 segundos, mostrar error
            setTimeout(() => {
                if (!socket.connected) {
                    console.error('❌ Timeout: Socket no se pudo conectar en 10 segundos');
                    mostrarLobbyMain(`
                        <div class="h-full w-full flex flex-col items-center justify-center pt-10 px-10 pb-16">
                            <i class="fas fa-exclamation-triangle text-red-500 text-8xl mb-6"></i>
                            <h1 class="text-4xl font-black text-white mb-4">${_t('presenter.selector.connection_error.title', null, 'Error de Conexión')}</h1>
                            <p class="text-slate-400 mb-2 text-xl">No se pudo conectar con el servidor WebSocket.</p>
                            <p class="text-slate-500 mb-6">Verifica que el servidor esté en funcionamiento.</p>
                            <button data-presenter-action="reload-page" class="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-full text-white font-bold uppercase transition shadow-lg mr-4">
                                <i class="fas fa-redo mr-2"></i>${_t('presenter.selector.actions.retry', null, 'Reintentar')}
                            </button>
                            <button data-presenter-action="volver-juegos" class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-full text-white font-bold uppercase transition mt-4">
                                <i class="fas fa-list mr-2"></i>${_t('presenter.selector.actions.back_list', null, 'Volver')}
                            </button>
                        </div>
                    `);
                }
            }, 10000);
        }

    } catch (err) {
        console.error('Error validando PIN:', err);
        mostrarLobbyMain(`
            <div class="h-full w-full flex flex-col items-center justify-center pt-10 px-10 pb-16">
                <i class="fas fa-exclamation-triangle text-yellow-500 text-8xl mb-6"></i>
                <h1 class="text-4xl font-black text-white mb-4">${_t('presenter.selector.connection_error.title', null, 'Error de Conexión')}</h1>
                <p class="text-slate-400 mb-6">${_t('presenter.selector.connection_error.message', null, 'No se pudo validar el PIN. Intenta de nuevo.')}</p>
                <button data-presenter-action="reload-page" class="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-full text-white font-bold uppercase transition shadow-lg mr-4">
                    <i class="fas fa-redo mr-2"></i>${_t('presenter.selector.actions.retry', null, 'Reintentar')}
                </button>
                <button data-presenter-action="volver-juegos" class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-full text-white font-bold uppercase transition mt-4">
                    <i class="fas fa-list mr-2"></i>${_t('presenter.selector.actions.show_games', null, 'Ver juegos')}
                </button>
            </div>
        `);
    }
}

/**
 * Empezar juego
 */
export function empezar() {
    const socket = getSocket();
    const sessionId = getSessionId();

    // Entrar en pantalla completa
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => { });
    } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen();
    }

    // Activar audio con interacción del usuario
    const tickSound = document.getElementById('tick-sound');
    if (tickSound) {
        tickSound.play().then(() => {
            tickSound.pause();
            tickSound.currentTime = 0;
        }).catch(() => { });
    }

    if (getGameType() === 'trivial') {
        socket.emit('trivial-start', {
            roomId: sessionId,
            isTeamMode: getIsTeamMode(),
            teamConfig: getTeamConfig()
        });
    } else {
        socket.emit('start-game', sessionId);
    }
}
