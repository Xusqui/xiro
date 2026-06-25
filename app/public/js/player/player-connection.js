/**
 * @fileoverview Gestión de conexión y reconexión del jugador
 * Maneja eventos de socket, wake lock y detección de modo reposo
 */

import { socket, playerId } from './player-socket-config.js?v=20260625151006';
import { mostrarModalMensaje } from '../shared/modal.js?v=20260625151006';
import { activarWakeLock, setupWakeLockVisibilityHandlers, hasActiveWakeLockSession } from './player-wake-lock.js?v=20260625151006';
import {
    getPin, setPin, getNickname, setNickname,
    getSessionId, setSessionId, getIsReconnecting, setIsReconnecting,
    getPendingAnswer, getSendingAnswer
} from './player-state.js?v=20260625151006';

export { activarWakeLock };
/**
 * Eliminar overlay de desconexión
 */
export function removeDisconnectOverlay() {
    const overlays = document.querySelectorAll('#disconnect-overlay');
    if (overlays.length > 0) {
        overlays.forEach((overlay) => overlay.remove());
        console.log('✅ Overlay de desconexión eliminado');
    }
}

/**
 * Registrar eventos de conexión
 * @param {Function} enviarPendiente - Función para reenviar respuestas pendientes
 */
export function registerConnectionEvents(enviarPendiente) {
    const handleConnect = async () => {
        console.log('✅ Socket conectado:', socket.id);
        removeDisconnectOverlay();

        // Tras recarga, reactivar wake lock lo antes posible si hay sesión activa
        if (hasActiveWakeLockSession()) {
            await activarWakeLock('socket-connect');
        }

        // Si tenemos datos de sesión guardados, intentar reconexión
        // CRITICAL: Only attempt reconnection if we're NOT on the login screen
        // (getPin() will be set if we're in an active game context)
        const currentPin = getPin();
        const currentNickname = getNickname();
        const lastPin = localStorage.getItem('xiro_lastPin');
        const lastNickname = localStorage.getItem('xiro_lastNickname');
        const lastSessionId = localStorage.getItem('xiro_lastSessionId');
        // window.name es per-ventana incluso en Chrome incognito (a diferencia
        // de sessionStorage/localStorage, que se comparten entre ventanas del
        // mismo perfil incognito). Lo usamos como marcador fiable de que esta
        // ventana es la dueña de la sesión y puede reconectar.
        let windowOwnsSession = false;
        try { windowOwnsSession = window.name && window.name.startsWith('xiro:'); } catch (_) { }
        const tabSessionSecret = sessionStorage.getItem('xiro_sessionSecret');

        // Only reconnect if we have CURRENT session data (not just old localStorage)
        if (windowOwnsSession && tabSessionSecret && currentPin && currentNickname && lastPin && lastNickname && !getIsReconnecting()) {
            console.log('🔄 Sesión activa detectada en connect - Intentando reconexión...');

            setIsReconnecting(true);
            setPin(currentPin);
            setSessionId(lastSessionId || currentPin);
            setNickname(currentNickname);

            // Mostrar UI de reconexión
            const displayName = currentNickname || _t('player.connection.player_tag', 'JUGADOR');
            const mainContainer = document.getElementById('main-container');
            if (mainContainer) {
                mainContainer.innerHTML = _tHtml(`
                    <div class="text-center">
                        <div class="w-20 h-20 border-8 border-white border-t-transparent rounded-full animate-spin mb-6 mx-auto"></div>
                        <h2 class="text-3xl font-black italic mb-4">🔄 RECONECTANDO...</h2>
                        <p class="text-xl font-semibold text-white/90 mb-2">${displayName.toUpperCase()}</p>
                        <p class="text-base text-white/70">Restaurando tu sesión</p>
                    </div>
                `);
            }

            // Emitir reconexión (reconnected-success/reconnect-failed handlers in player-reconnection.js)
            socket.emit('reconnect-player', { playerId, sessionSecret: tabSessionSecret });
        }

        // Reenviar respuesta pendiente si existe
        if (typeof enviarPendiente === 'function' && getPendingAnswer() && !getSendingAnswer()) {
            console.log('🔁 Reenviando respuesta pendiente tras reconexión');
            enviarPendiente();
        }
    };

    socket.on('connect', handleConnect);

    // FIX: If socket already connected before handlers were registered
    // (happens when WebSocket connects faster than DOMContentLoaded fires),
    // trigger the handler manually to avoid missing the connect event.
    if (socket.connected) {
        console.log('⚡ Socket ya conectado antes de registrar handlers — ejecutando handleConnect manualmente');
        handleConnect();
    }

    socket.on('disconnect', (reason) => {
        console.log('🔌 Desconectado:', reason);

        // Si fue desconexión del servidor (no manual), mostrar UI
        if (reason !== 'io client disconnect' && getNickname()) {
            console.log('⚠️ Desconexión detectada - Socket.IO intentará reconectar automáticamente');

            removeDisconnectOverlay();

            // Mostrar pantalla de desconexión
            const mainContainer = document.getElementById('main-container');
            if (mainContainer) {
                mainContainer.innerHTML = _tHtml(`
                    <div class="text-center">
                        <div class="w-20 h-20 border-8 border-orange-500 border-t-transparent rounded-full animate-spin mb-6 mx-auto"></div>
                        <h2 class="text-3xl font-black italic mb-4">⚠️ DESCONECTADO</h2>
                        <p class="text-xl font-semibold text-white/90 mb-2">${getNickname().toUpperCase()}</p>
                        <p class="text-base text-white/70">Reconectando automáticamente...</p>
                    </div>
                `);
            }

            // Si el servidor nos desconectó, forzar reconexión manual
            if (reason === 'io server disconnect') {
                console.log('🔄 Servidor desconectó - Forzando reconexión manual en 500ms...');
                setTimeout(() => {
                    if (!socket.connected) {
                        console.log('🔄 Ejecutando socket.connect() manual...');
                        socket.connect();
                    }
                }, 500);
            }
        }
    });

    // On auto-reconnect the 'connect' handler above already fires and emits reconnect-player.
    // This handler only logs the event for debugging.
    socket.io.on('reconnect', (attemptNumber) => {
        console.log(`✅ [EVENT] reconnect - Reconectado después de ${attemptNumber} intentos`);
    });

    socket.on('force-disconnect', (data) => {
        console.log('⚠️ Desconectado por:', data.reason);
        mostrarModalMensaje(
            _t('player.connection.disconnected', 'Desconectado'),
            _t('player.connection.disconnected_prefix', 'Has sido desconectado:') + ' ' + (data.reason === 'replaced' ? _t('player.connection.other_device', 'Conectado desde otro dispositivo') : data.reason),
            'warning',
            _t('player.connection.retry', 'Reintentar'),
            () => location.reload()
        );
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 [EVENT] reconnect_attempt #${attemptNumber}`);
    });

    socket.on('reconnect_error', (error) => {
        console.error('❌ [EVENT] reconnect_error:', error);
    });

    socket.on('reconnect_failed', () => {
        console.error('❌ [EVENT] reconnect_failed - Socket.IO ha dejado de intentar reconectar');
    });

    socket.on('connect_error', (error) => {
        console.error('❌ [EVENT] connect_error:', error);
    });
}

/**
 * Configurar detección de visibilitychange
 */
export function setupVisibilityDetection() {
    setupWakeLockVisibilityHandlers(() => {
        if (!socket.connected && getPin() && getNickname()) {
            console.log('🔄 Conexión perdida, forzando reconexión...');
            socket.connect();
        }
    });
}
