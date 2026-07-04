/**
 * @fileoverview Gestión de sesión del jugador
 * Validación de sesión, join-lobby y configuración inicial
 */

import { socket, playerId } from './player-socket-config.js?v=20260704215632';
import {
    getPin, setPin, getNickname, setNickname,
    getSessionId, setSessionId, getIsReconnecting, setIsReconnecting,
    setTeamMode, getJoinTimeoutId, setJoinTimeoutId, resetGameState
} from './player-state.js?v=20260704215632';
import { removeDisconnectOverlay, activarWakeLock } from './player-connection.js?v=20260704215632';
import {
    mostrarErrorSesionNoEncontrada,
    mostrarPantallaReconectando,
    mostrarPantallaConectando,
    mostrarEquipoSeleccionado,
    mostrarLobbyReconectado,
    mostrarLobbyNormal,
    mostrarErrorJoinLobby,
    mostrarErrorSocketDesconectado
} from './player-session-ui.js?v=20260704215632';
import { mostrarModalMensaje } from '../shared/modal.js?v=20260704215632';
import { getSavedSessionData, clearSavedSessionData, isSameSession } from './player-session-storage.js?v=20260704215632';

// ===== FUNCIONES DE SESIÓN =====

/**
 * Detectar sessionId en la URL
 */
export function getSessionFromURL() {
    const params = new URLSearchParams(window.location.search);
    // Acepta ?session= (QR) o ?pin= (enlace directo compartido)
    const session = params.get('session') || params.get('pin');
    if (session) {
        setSessionId(session);
        // Extraer PIN del sessionId (formato: PIN-UUID)
        return session.split('-')[0];
    }
    return null;
}

/**
 * Validar sesión con el backend
 */
export async function validarSession(sessionParam) {
    const session = (sessionParam || document.getElementById('session-input').value.trim()).toUpperCase();
    if (!session) return;

    // Extraer PIN del sessionId (formato: PIN-UUID)
    const pin = session.split('-')[0];
    setSessionId(session);

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.error('⏱️ Timeout validando sesión');
            mostrarModalMensaje(_t('player.session.connection_error_title', null, 'Error de conexión'), _t('player.session.validation_error', null, 'No se pudo validar la sesión. Inténtalo de nuevo.'), 'error');
            resolve();
        }, 5000);

        console.log('🔍 Validando sesión:', session, '(PIN:', pin, ')');
        socket.emit('validate-session', { sessionId: session });

        socket.once('session-validation-result', async (result) => {
            clearTimeout(timeout);
            console.log('📩 Resultado validación:', result);

            if (!result.valid) {
                console.error('❌ Sesión no válida:', result.reason);

                // Limpiar localStorage
                clearSavedSessionData();

                // Mostrar error
                document.getElementById('main-container').innerHTML = _tHtml(mostrarErrorSesionNoEncontrada());
                resolve();
                return;
            }

            // Sesión válida
            console.log('✅ Sesión validada correctamente');

            // Check if PIN is different from the previously stored one
            const currentPin = getPin();
            if (currentPin && currentPin !== pin) {
                console.log('🔄 PIN diferente detectado - limpiando datos de sesión anterior');
                console.log('   PIN anterior:', currentPin, '→ PIN nuevo:', pin);

                // Clear all session data when switching to a different game PIN
                localStorage.removeItem('xiro_lastPin');
                localStorage.removeItem('xiro_lastNickname');
                localStorage.removeItem('xiro_lastSessionId');
                localStorage.removeItem('xiro_lastTeamIndex');
                localStorage.removeItem('xiro_lastTeamName');

                // Clear module-level game state
                resetGameState();
            }

            setPin(pin);

            // Verificar si hay sesión activa con este PIN
            const {
                pin: savedPin,
                nickname: savedNickname,
                sessionId: savedSessionId
            } = getSavedSessionData();

            // Marcador de "esta ventana es la dueña de la sesión".
            // Usamos window.name porque es la ÚNICA forma de storage que está
            // aislada por-ventana en TODOS los navegadores, incluyendo Chrome
            // incognito (donde sessionStorage y localStorage se comparten entre
            // ventanas del mismo perfil incognito). Si window.name no tiene
            // nuestro marcador, esta es una ventana nueva y debe hacer login
            // normal, no reconectar con la identidad de otra ventana.
            let windowOwnsSession = false;
            try {
                windowOwnsSession = window.name && window.name.startsWith('xiro:');
            } catch (_) { windowOwnsSession = false; }
            const tabSessionSecret = sessionStorage.getItem('xiro_sessionSecret');

            // Solo reconectar si el sessionId es exactamente el mismo Y esta
            // ventana es la dueña de la sesión (window.name marker presente).
            if (windowOwnsSession && tabSessionSecret && savedPin === pin && savedSessionId === getSessionId() && savedNickname) {
                console.log('🔄 Sesión activa detectada (mismo sessionId), reconectando automáticamente:', savedNickname);
                console.log('[RECONNECT DEBUG] validarSession: detectada sesión activa, emitiendo reconnect-player');

                // Mostrar mensaje de reconexión
                document.getElementById('main-container').innerHTML = _tHtml(mostrarPantallaReconectando(savedNickname));

                // Reconectar automáticamente
                setNickname(savedNickname.toUpperCase());
                setIsReconnecting(true);
                await activarWakeLock();

                // Use reconnect-player (not join-lobby) to restore game state
                console.log('[RECONNECT DEBUG] ⚡ Emitiendo reconnect-player desde validarSession');
                socket.emit('reconnect-player', {
                    playerId: playerId,
                    sessionSecret: tabSessionSecret
                });

                resolve();
                return;
            } else if (savedSessionId && savedSessionId !== getSessionId()) {
                // SessionId diferente - limpiar datos
                console.log('🧹 SessionId diferente - limpiando datos de sesión anterior');
                clearSavedSessionData();

                // CRITICAL: Clear game state from previous game to avoid carrying over data
                resetGameState();
            }

            // Mostrar formulario de nombre
            document.getElementById('step-1').classList.add('hidden');
            document.getElementById('step-loading').classList.add('hidden');
            document.getElementById('step-2').classList.remove('hidden');
            setTimeout(() => document.getElementById('nickname-input').focus(), 100);
            resolve();
        });
    });
}

/**
 * Unirse al lobby
 */
export async function unirseAlLobby() {
    const nicknameInput = document.getElementById('nickname-input');
    const nickname = nicknameInput.value.trim().toUpperCase();
    if (!nickname) return;

    setNickname(nickname);

    // Verificar que el socket esté conectado
    if (!socket.connected) {
        console.error('⚠️ Socket no conectado. Esperando conexión...');
        document.getElementById('main-container').innerHTML = _tHtml(mostrarErrorSocketDesconectado());
        return;
    }

    // Activar Wake Lock
    await activarWakeLock();

    // Limpiar timeout anterior si existe
    const currentTimeout = getJoinTimeoutId();
    if (currentTimeout) {
        clearTimeout(currentTimeout);
        setJoinTimeoutId(null);
    }

    // Establecer timeout de seguridad (10 segundos)
    const timeoutId = setTimeout(() => {
        console.error('⏱️ Timeout: No se recibió respuesta del servidor en 10 segundos');
        setJoinTimeoutId(null);

        // Volver al formulario con mensaje de error
        document.getElementById('main-container').innerHTML = mostrarErrorJoinLobby(
            _t('player.session.server_error', null, 'No se pudo conectar con el servidor. Verifica que el presentador haya iniciado el juego e intenta de nuevo.'),
            getNickname()
        );

        setTimeout(() => {
            const input = document.getElementById('nickname-input');
            if (input) input.focus();
        }, 100);
    }, 10000);

    setJoinTimeoutId(timeoutId);

    // Emitir join-lobby
    socket.emit('join-lobby', {
        pin: getPin(),
        sessionId: getSessionId() || undefined,
        nickname: getNickname(),
        playerId: playerId
    });

    console.log('📤 join-lobby emitido:', { pin: getPin(), nickname: getNickname(), playerId });

    // Mostrar pantalla de carga
    document.getElementById('main-container').innerHTML = _tHtml(mostrarPantallaConectando());
}

/**
 * Registrar event handlers de sesión
 * @param {Function} mostrarSeleccionEquipo - Función para mostrar selección de equipos
 * @param {Function} salirDelLobby - Función para salir del lobby
 */
export function registerSessionEvents(mostrarSeleccionEquipo, salirDelLobby) {
    // ===== JOIN SUCCESS =====
    socket.on('join-success', (data) => {
        console.log('✅ join-success recibido:', data);
        console.log('[RECONNECT DEBUG] join-success recibido. isReconnecting =', getIsReconnecting());

        // When reconnecting via reconnect-player, the server sends reconnected-success,
        // NOT join-success. If join-success arrives during reconnection, it's from a
        // competing path (e.g., buffered validate-session → join-lobby).
        // Ignore it to avoid overwriting the correctly restored UI from reconnected-success.
        if (getIsReconnecting()) {
            console.log('⚠️ join-success ignorado — reconexión en progreso (esperando reconnected-success)');
            console.log('[RECONNECT DEBUG] join-success IGNORADO porque isReconnecting = true');
            return;
        }

        console.log('[RECONNECT DEBUG] join-success procesado normalmente (isReconnecting = false)');

        // Limpiar timeout de join-lobby si está activo
        const timeoutId = getJoinTimeoutId();
        if (timeoutId) {
            clearTimeout(timeoutId);
            setJoinTimeoutId(null);
        }

        // Eliminar overlay de desconexión si existe
        removeDisconnectOverlay();

        // Verificar si estábamos reconectando
        const wasReconnecting = false; // No longer needed since we early-return above

        // Actualizar sessionId/pin con el roomId confirmado
        if (data.roomId) {
            if (data.roomId.includes('-')) {
                setSessionId(data.roomId);
                console.log('✅ sessionId actualizado:', data.roomId);
            } else {
                setPin(data.roomId);
                setSessionId('');
                console.log('✅ pin actualizado:', data.roomId);
            }
        }

        // Guardar en localStorage
        localStorage.setItem('xiro_lastPin', getPin());
        localStorage.setItem('xiro_lastNickname', getNickname());
        if (getSessionId()) {
            localStorage.setItem('xiro_lastSessionId', getSessionId());
        }
        if (data.sessionSecret) {
            sessionStorage.setItem('xiro_sessionSecret', data.sessionSecret);
        }
        // Marcar esta ventana como dueña de la sesión (window.name es
        // per-ventana incluso en Chrome incognito, a diferencia de
        // sessionStorage/localStorage que se comparten entre ventanas).
        // IMPORTANTE: preservar el segmento pid=<uuid> que también vive en
        // window.name (ver player-socket-config.js) para no perder la
        // identidad per-ventana del jugador.
        try {
            const cur = window.name || '';
            const pidMatch = /(?:^|\|)pid=([0-9a-f-]{36})/i.exec(cur);
            const pidSuffix = pidMatch ? ('|pid=' + pidMatch[1]) : '';
            window.name = 'xiro:' + (getPin() || '') + ':' + Date.now() + pidSuffix;
        } catch (_) { }

        // Nota: La reconexión automática ya está configurada en player-socket-config.js
        // y manejada por registerConnectionEvents() en player-connection.js

        // Verificar si es modo equipos
        if (data.teamMode && data.teamMode.isTeamMode) {
            setTeamMode(data.teamMode);
            console.log('🎯 Modo equipos detectado:', data.teamMode);
            mostrarSeleccionEquipo();
        } else {
            // Modo individual — mostrar lobby normal
            document.getElementById('main-container').innerHTML = _tHtml(mostrarLobbyNormal(getNickname()));
        }
    });

    // ===== JOIN ERROR =====
    socket.on('join-error', (data) => {
        const errorMessage = data.message || data || _t('player.session.join_error', null, 'Error al unirse al juego');
        console.log(`❌ join-error recibido:`, { reason: data.reason, message: errorMessage });

        // Limpiar timeout de join-lobby si está activo
        const timeoutId = getJoinTimeoutId();
        if (timeoutId) {
            clearTimeout(timeoutId);
            setJoinTimeoutId(null);
        }

        // Detener reconexión automática
        setIsReconnecting(false);

        // Limpiar nickname y localStorage para evitar reconexiones automáticas
        setNickname("");
        localStorage.removeItem('xiro_lastNickname');

        // Casos especiales de error que requieren reload
        if (data.reason === 'invalid-player-id') {
            console.error('PlayerId inválido, recargando...');
            localStorage.removeItem('xiro_playerId');
            // Limpiar pid=<uuid> de window.name para forzar un playerId nuevo
            // tras el reload (el playerId vive en window.name, ver
            // player-socket-config.js).
            try {
                const cur = window.name || '';
                window.name = cur.replace(/(?:^|\|)pid=[0-9a-f-]{36}/i, '').replace(/^\|/, '');
            } catch (_) { }
            mostrarModalMensaje(_t('common.error_title', null, 'Error'), errorMessage, 'error', _t('common.btn_retry', null, 'Reintentar'), () => location.reload());
            return;
        }

        if (data.reason === 'name-mismatch') {
            console.error('⚠️ Intento de cambiar nombre durante sesión activa');
            localStorage.removeItem('xiro_lastPin');
            localStorage.removeItem('xiro_lastNickname');
            localStorage.removeItem('xiro_lastSessionId');
            mostrarModalMensaje(_t('common.error_title', null, 'Error'), errorMessage, 'error', _t('common.btn_retry', null, 'Reintentar'), () => location.reload());
            return;
        }

        if (data.reason === 'invalid-session' || data.reason === 'session-not-found' || data.reason === 'session-not-exist') {
            console.error('⚠️ Sesión no encontrada o expirada');
            localStorage.removeItem('xiro_lastPin');
            localStorage.removeItem('xiro_lastNickname');
            localStorage.removeItem('xiro_lastSessionId');
            document.getElementById('main-container').innerHTML = _tHtml(mostrarErrorSesionNoEncontrada());
            return;
        }

        if (data.reason === 'server-capacity') {
            document.getElementById('main-container').innerHTML = _tHtml(`
                <img src="/images/logo.svg" alt="Logo"
                    style="width: 100%; max-width: 384px; margin: 0 auto 2rem auto; filter: drop-shadow(0 10px 8px rgb(0 0 0 / 0.04));">
                <div id="login-box" class="bg-white p-8 rounded-3xl shadow-2xl text-slate-800 border-b-8 border-gray-200">
                    <div class="text-center">
                        <i class="fas fa-server text-6xl text-orange-500 mb-4"></i>
                        <h2 class="text-2xl font-black text-slate-800 mb-2">${_t('player.session.server_full_title', null, 'Servidor Lleno')}</h2>
                        <p class="text-slate-500 mb-4">${errorMessage}</p>
                        <button data-player-action="reload-page"
                            class="btn-glass-3d w-full bg-purple-600 text-white p-4 rounded-2xl font-black text-xl">${_t('common.btn_retry', null, 'Reintentar')}</button>
                    </div>
                </div>
            `);
            return;
        }

        if (data.reason === 'invalid-pin' || data.reason === 'server-error') {
            setPin("");
            document.getElementById('main-container').innerHTML = _tHtml(`
                <img src="/images/logo.svg" alt="Logo"
                    style="width: 100%; max-width: 384px; margin: 0 auto 2rem auto; filter: drop-shadow(0 10px 8px rgb(0 0 0 / 0.04));">
                <div id="login-box" class="bg-white p-8 rounded-3xl shadow-2xl text-slate-800 border-b-8 border-gray-200">
                    <div id="step-1">
                        <h2 class="text-slate-500 font-bold mb-4 uppercase text-sm">${_t('Código del Juego', null, 'Código del Juego')}</h2>
                        <p class="text-red-600 font-bold mb-3 text-sm">⚠️ ${errorMessage}</p>
                        <input type="text" id="pin-input" placeholder="000000" autofocus
                            class="w-full p-4 mb-4 border-4 border-red-300 rounded-2xl font-black text-3xl text-center focus:border-purple-500 outline-none uppercase">
                        <button data-player-action="validar-pin"
                            class="btn-glass-3d w-full bg-slate-900 text-white p-4 rounded-2xl font-black text-xl">${_t('player.session.btn_enter', null, 'INGRESAR')}</button>
                    </div>
                </div>
            `);
            setTimeout(() => {
                const input = document.getElementById('pin-input');
                if (input) input.focus();
            }, 100);
            return;
        }

        // Para otros errores (nickname-taken, room-full, validación, etc), volver al paso 2
        document.getElementById('main-container').innerHTML = _tHtml(mostrarErrorJoinLobby(errorMessage));
        setTimeout(() => {
            const input = document.getElementById('nickname-input');
            if (input) input.focus();
        }, 100);
    });
}

/**
 * Inicializar detección de sesión en la URL
 * Called from DOMContentLoaded — runs inline, no nested listener needed.
 */
export function initSessionDetection() {
    console.log('[RECONNECT DEBUG] initSessionDetection ejecutado');

    // If reconnect-player is already in flight (from connect handler),
    // don't start a parallel join-lobby path. Wait for reconnected-success/reconnect-failed.
    if (getIsReconnecting()) {
        console.log('🔄 Reconnection in progress — skipping session detection');
        console.log('[RECONNECT DEBUG] isReconnecting = true, saliendo');
        return;
    }

    // PRIORITY 1: Check for session in URL (from QR scan)
    // This takes precedence over old localStorage data
    const pinFromSession = getSessionFromURL();
    console.log('[RECONNECT DEBUG] pinFromSession =', pinFromSession);

    if (pinFromSession) {
        console.log('🔗 SessionId detectado en URL (QR scan) - auto-validando');
        const { sessionId: savedSessionId } = getSavedSessionData();
        const urlSessionId = getSessionId();
        const shouldPreserve = isSameSession(savedSessionId, urlSessionId);

        if (shouldPreserve) {
            console.log('[RECONNECT DEBUG] SessionId coincide con storage, conservando datos para reconexión automática');
        } else {
            console.log('[RECONNECT DEBUG] SessionId diferente, limpiando storage de sesión anterior');
            clearSavedSessionData();
        }

        // Ocultar step-1 inmediatamente y mostrar spinner mientras valida
        document.getElementById('step-1').classList.add('hidden');
        document.getElementById('step-loading').classList.remove('hidden');
        validarSession(getSessionId().toUpperCase());
        return;
    }

    // PRIORITY 2: If there's saved session data (nickname + pin), the connect handler in
    // player-connection.js will handle reconnection via reconnect-player.
    // Do NOT start a competing validarSession/join-lobby path here, because
    // Socket.IO buffers emits when disconnected — both reconnect-player AND
    // join-lobby would reach the server, and join-success would overwrite the
    // restored game UI with the "Prepárate" lobby screen.
    const {
        nickname: savedNickname,
        pin: savedPin,
        sessionId: savedSessionId
    } = getSavedSessionData();

    console.log('[RECONNECT DEBUG] localStorage values:', {
        savedNickname,
        savedPin,
        savedSessionId,
        isReconnecting: getIsReconnecting()
    });

    if (savedNickname && savedPin) {
        console.log('🔄 Sesión guardada detectada — delegando reconexión a connect handler (reconnect-player)');
        console.log('[RECONNECT DEBUG] Delegando a connect handler, saliendo');
        return;
    }
}
