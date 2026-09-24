window.TVApp = window.TVApp || {};
window.TVApp.Lobby = (function () {
    'use strict';

    const getEl = window.TVApp.Utils.getEl;
    const clearCache = window.TVApp.Utils.clearCache;
    const escapeHtml = window.TVApp.Utils.escapeHtml;
    const getURLParameter = window.TVApp.Utils.getURLParameter;
    const xhr = window.TVApp.Utils.xhr;

    function generarNumerosAleatorios(length) {
        let str = '';
        for (let i = 0; i < length; i++) {
            str += Math.floor(Math.random() * 10).toString();
        }
        return str;
    }

    // Generar sessionId único (PIN-XXXX donde XXXX son 4 dígitos aleatorios)
    function generateSessionId(pinParam) {
        return pinParam.toUpperCase() + '-' + generarNumerosAleatorios(4);
    }

    function fetchPresenterPins(adminToken, callback) {
        const x = new XMLHttpRequest();
        x.open('GET', '/api/presenter-pins', true);
        if (adminToken) x.setRequestHeader('Authorization', 'Bearer ' + adminToken);
        x.onreadystatechange = function () {
            if (x.readyState === 4) {
                if (x.status === 200) {
                    try { callback(null, JSON.parse(x.responseText)); }
                    catch (e) { callback(e, null); }
                } else {
                    callback(new Error('HTTP ' + x.status), null);
                }
            }
        };
        x.onerror = function () { callback(new Error('Network error'), null); };
        x.send();
    }

    function mostrarSelectorPIN() {
        const state = window.TVApp.State;
        const adminToken = '';

        fetchPresenterPins(adminToken, function (err, data) {
            if (err || !Array.isArray(data)) {
                getEl('main-container').innerHTML = '<div class="pin-selector"><div class="final-trophy">⚠</div><h1 class="pin-selector-title">' + _t('Error al cargar PINs', null, 'Error al cargar PINs') + '</h1><p class="pin-selector-subtitle">' + (err ? err.message : _t('Error desconocido', null, 'Error desconocido')) + '</p><button data-tv-action="retry-pin-selector" class="btn btn-secondary">' + _t('Reintentar', null, 'Reintentar') + '</button></div>';
                clearCache();
                return;
            }
            state.todosLosPins = data;
            renderizarPINs();
        });
    }

    function renderizarPINs() {
        const state = window.TVApp.State;
        const pinsTextos = {
            'Juego Personalizado': _t('tv.lobby.type.custom', null, 'Juegos Personalizados'),
            'Juego': _t('tv.lobby.type.games', null, 'Juegos'),
            'Banco': _t('tv.lobby.type.banks', null, 'Bancos de Preguntas')
        };
        const pinsFiltrados = state.filtroActivo === 'todos' ? state.todosLosPins : state.todosLosPins.filter(function (p) { return p.type === state.filtroActivo; });

        const tabsHTML = '<div class="pin-tabs">'
            + '<button data-tv-action="change-filter" data-filter="Juego Personalizado" class="pin-tab ' + (state.filtroActivo === 'Juego Personalizado' ? 'pin-tab-active' : '') + '">' + _t('tv.lobby.filter.custom', null, 'Personalizados') + '</button>'
            + '<button data-tv-action="change-filter" data-filter="Juego" class="pin-tab ' + (state.filtroActivo === 'Juego' ? 'pin-tab-active' : '') + '">' + _t('tv.lobby.filter.games', null, 'Juegos') + '</button>'
            + '<button data-tv-action="change-filter" data-filter="Banco" class="pin-tab ' + (state.filtroActivo === 'Banco' ? 'pin-tab-active' : '') + '">' + _t('tv.lobby.filter.banks', null, 'Bancos') + '</button>'
            + '<button data-tv-action="change-filter" data-filter="todos" class="pin-tab ' + (state.filtroActivo === 'todos' ? 'pin-tab-active' : '') + '">' + _t('tv.lobby.filter.all', null, 'Todos') + '</button>'
            + '</div>';

        let cardsHTML = '';
        if (pinsFiltrados.length === 0) {
            const emptyMsg = state.filtroActivo === 'todos'
                ? _t('tv.lobby.empty.all', null, 'No hay PINs disponibles. Crea un juego o banco primero.')
                : _t('tv.lobby.empty.by_type', { type: pinsTextos[state.filtroActivo] || state.filtroActivo }, 'No hay {type} disponibles.').replace('{type}', pinsTextos[state.filtroActivo] || state.filtroActivo);
            cardsHTML = '<p style="color:#999;text-align:center;margin:40px 0">' + emptyMsg + '</p>';
        } else {
            cardsHTML = '<div class="pins-grid">';
            for (let i = 0; i < pinsFiltrados.length; i++) {
                const p = pinsFiltrados[i];
                cardsHTML += '<div class="pin-card" data-tv-action="select-pin" data-pin="' + escapeHtml(p.pin) + '"><div class="pin-card-type">' + escapeHtml(p.type) + '</div><div class="pin-card-pin">' + escapeHtml(p.pin) + '</div><div class="pin-card-name">' + escapeHtml(p.name) + '</div></div>';
            }
            cardsHTML += '</div>';
        }
        getEl('main-container').innerHTML = '<div class="pin-selector"><h1 class="pin-selector-title">' + _t('tv.lobby.title', null, 'Selecciona un Juego') + '</h1><p class="pin-selector-subtitle">' + _t('tv.lobby.subtitle', null, 'Elige el juego o banco que deseas presentar') + '</p>' + tabsHTML + cardsHTML + '</div>';
        clearCache();
    }

    function cambiarFiltro(tipo) {
        window.TVApp.State.filtroActivo = tipo;
        renderizarPINs();
    }

    function seleccionarPIN(selectedPin) {
        if (window.TVApp.Teams) {
            window.TVApp.Teams.mostrarSeleccionModo(selectedPin);
        }
    }

    function iniciarLobby() {
        const state = window.TVApp.State;
        console.log('=== INICIANDO LOBBY ===');
        console.log('PIN:', state.pin);
        console.log('presenterPlayerId:', state.playerId);

        state.pin = state.pin.toUpperCase();

        const mode = getURLParameter('mode');
        const teamsParam = getURLParameter('teams');

        if (mode === 'teams' && teamsParam) {
            try {
                state.isTeamMode = true;
                state.teamConfig = { teams: JSON.parse(decodeURIComponent(teamsParam)) };
                console.log('Modo equipos activado:', state.teamConfig);
            } catch (e) {
                console.log('Error parseando equipos:', e);
                state.isTeamMode = false;
                state.teamConfig = null;
            }
        }

        state.sessionId = generateSessionId(state.pin);
        console.log('SessionId generado:', state.sessionId);

        const baseUrl = window.location.protocol + '//' + window.location.host;
        const url = baseUrl + '/jugador.html?session=' + encodeURIComponent(state.sessionId);
        const qrUrl = baseUrl + '/api/qr?url=' + encodeURIComponent(url);

        getEl('main-container').innerHTML = '<div class="header"><table style="width:100%"><tr><td class="header-cell"><img src="/images/logo.svg" class="logo" alt="Logo"></td><td class="header-cell header-center"><div class="pin-box"><div class="pin-label">' + _t('tv.lobby.pin_label', null, 'PIN DE ACCESO') + '</div><div class="pin-number" id="display-pin">' + state.sessionId + '</div><img src="' + qrUrl + '" alt="Código QR" style="margin-top:10px;border-radius:8px" width="200" height="200"><div class="pin-url">' + url + '</div></div></td><td class="header-cell header-right"><button id="btn-empezar" data-tv-action="start-game" class="btn" disabled>' + _t('tv.lobby.btn_start', null, '¡EMPEZAR!') + '</button></td></tr></table></div><div class="players-section"><div class="players-title">' + _t('tv.lobby.players_label', null, 'Jugadores: ') + '<span class="player-badge" id="p-count">0</span></div><div id="p-list" class="players-grid"></div></div>';
        clearCache();

        if (state.isTeamMode && state.teamConfig && window.TVApp.Teams) {
            window.TVApp.Teams.renderTeamLobby();
        }

        xhr('GET', '/api/quizzes/validate/' + encodeURIComponent(state.pin), function (err, data) {
            if (err || !data || !data.exists) {
                console.log('Error validando PIN en tv-lobby:', err);
                getEl('main-container').innerHTML = '<div class="pin-selector"><div class="final-trophy">⚠</div><h1 class="pin-selector-title">' + _t('Error de Conexión', null, 'Error de Conexión') + '</h1><p class="pin-selector-subtitle">' + _t('PIN No Válido o Error de servidor.', null, 'PIN No Válido o Error de servidor.') + '</p><button data-tv-action="go-tv-home" class="btn btn-secondary">' + _t('Volver', null, 'Volver') + '</button></div>';
                clearCache();
                return;
            }

            state.gameType = data.gameType || 'standard';
            console.log('✅ PIN validado en TV, gameType:', state.gameType);

            const adminToken = localStorage.getItem('adminToken') || '';

            const lobbyData = {
                pin: state.pin,
                sessionId: state.sessionId,
                playerId: state.playerId,
                isTeamMode: state.isTeamMode
            };

            if (adminToken) {
                lobbyData.token = adminToken;
            }

            if (state.teamConfig) {
                lobbyData.teamConfig = state.teamConfig;
            }

            const safeLobbyData = {
                pin: lobbyData.pin,
                sessionId: lobbyData.sessionId,
                playerId: lobbyData.playerId,
                isTeamMode: lobbyData.isTeamMode
            };
            if (lobbyData.teamConfig) safeLobbyData.teamConfig = lobbyData.teamConfig;
            if (lobbyData.token) safeLobbyData.token = '[redacted]';

            console.log('Enviando join-presenter-lobby:', safeLobbyData);
            if (window.TVApp.socket) {
                window.TVApp.socket.emit('join-presenter-lobby', lobbyData);
            }
            console.log('join-presenter-lobby enviado');
        });
    }

    return {
        mostrarSelectorPIN: mostrarSelectorPIN,
        cambiarFiltro: cambiarFiltro,
        seleccionarPIN: seleccionarPIN,
        iniciarLobby: iniciarLobby
    };
})();
