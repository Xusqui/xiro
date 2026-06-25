window.TVApp = window.TVApp || {};
window.TVApp.SocketConnection = (function () {
    'use strict';

    var getEl = window.TVApp.Utils.getEl;
    var showTvModal = window.TVApp.Utils.showTvModal;
    var debounceUpdate = window.TVApp.Utils.debounceUpdate;
    var initAudio = window.TVApp.Audio.initAudio;
    var updatePlayersPanel = window.TVApp.RenderPlayers.updatePlayersPanel;

    function initSocket() {
        var state = window.TVApp.State;

        console.log('Inicializando socket con playerId:', state.playerId);

        // Configuración del socket - solo WebSocket
        var socket = io({
            auth: { playerId: state.playerId },
            transports: ['websocket'],
            upgrade: false,
            rememberUpgrade: false,
            reconnection: true,
            reconnectionDelay: 500,
            reconnectionDelayMax: 2000,
            reconnectionAttempts: Infinity,
            timeout: 10000,
            forceNew: false,
            path: '/socket.io/',
            withCredentials: false,
            autoConnect: true
        });

        window.TVApp.socket = socket;

        // Decodificar transparentemente eventos comprimidos
        (function () {
            var originalOn = socket.on;

            function decompressGzip(arrayBuffer) {
                if (typeof DecompressionStream === 'undefined') {
                    try {
                        if (typeof process !== 'undefined' && process.release && process.release.name === 'node') {
                            var zlib = eval("require('zlib')");
                            var decompressed = zlib.gunzipSync(new Uint8Array(arrayBuffer));
                            return Promise.resolve(JSON.parse(decompressed.toString('utf8')));
                        }
                    } catch (e) {
                        console.error('Node fallback decompression failed:', e);
                    }
                    return Promise.reject(new Error('DecompressionStream not supported'));
                }
                var ds = new DecompressionStream('gzip');
                var decompressedStream = new Response(arrayBuffer).body.pipeThrough(ds);
                return new Response(decompressedStream).text().then(function (text) {
                    return JSON.parse(text);
                });
            }

            socket.on = function (event, callback) {
                function decoderListener(payload) {
                    var self = this;
                    var args = Array.prototype.slice.call(arguments);
                    if (payload && payload._compressed === true) {
                        var isBase64 = typeof payload.data === 'string';
                        var promise;
                        if (isBase64) {
                            var binaryString = atob(payload.data);
                            var bytes = new Uint8Array(binaryString.length);
                            for (var i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            promise = decompressGzip(bytes.buffer);
                        } else {
                            promise = decompressGzip(payload.data);
                        }
                        promise.then(function (decompressedData) {
                            args[0] = decompressedData;
                            callback.apply(self, args);
                        }).catch(function (err) {
                            console.error('Failed to decompress socket payload:', err);
                            callback.apply(self, args);
                        });
                    } else {
                        callback.apply(self, args);
                    }
                }
                decoderListener.fn = callback;
                originalOn.call(socket, event, decoderListener);
                return socket;
            };
        })();

        // Eventos base
        socket.on('connect', function () {
            console.log('TV conectada - Socket ID:', socket.id);
            console.log('Transport:', socket.io.engine.transport.name);
            initAudio();
        });

        socket.on('disconnect', function (reason) {
            console.log('TV desconectada. Razon:', reason);
        });

        socket.on('connect_error', function (error) {
            console.log('Error de conexion:', error);
            showTvModal('Error de conexion', 'ERROR DE CONEXION: ' + (error.message || error), 'error');
        });

        // Eventos de sala y jugadores
        socket.on('join-success', function (data) {
            console.log('Lobby creado - join-success:', data);
            try {
                if (data && data.roomId && data.roomId !== state.sessionId) {
                    console.log('Actualizando sessionId:', data.roomId);
                    state.sessionId = data.roomId;
                    var displayPin = getEl('display-pin');
                    if (displayPin) displayPin.textContent = _t(state.sessionId);
                }
                if (state.isTeamMode && state.teamConfig && window.TVApp.Teams) {
                    window.TVApp.Teams.renderTeamLobby();
                }
            } catch (e) {
                console.log('Error en join-success:', e);
            }
        });

        socket.on('join-error', function (data) {
            console.log('Error uniendo lobby:', data);
            var msg = (data && data.message) ? data.message : 'Error al crear la sala';
            showTvModal('Error', msg, 'error');
        });

        socket.on('player-joined', function (data) {
            var nick = typeof data === 'string' ? data : data.nickname || data;
            if (nick === 'HOST') return;
            state.totalPlayers++;
            var el = getEl('p-count');
            if (el) el.textContent = _t(state.totalPlayers);

            if (state.connectedPlayers.indexOf(nick) === -1) {
                state.connectedPlayers.push(nick);
                state.playersData[nick] = { score: 0, answered: false, correct: null };
            }
            debounceUpdate(updatePlayersPanel);

            if (!state.isTeamMode) {
                var playerDiv = document.createElement('div');
                playerDiv.className = 'player-item';
                playerDiv.setAttribute('data-nickname', nick);
                playerDiv.textContent = _t(nick);
                var list = getEl('p-list');
                if (list) list.appendChild(playerDiv);
            }

            var btn = getEl('btn-empezar');
            if (btn && state.totalPlayers > 0) btn.disabled = false;
        });

        socket.on('player-rejoined', function (data) {
            var nick = typeof data === 'string' ? data : data.nickname || data;
            if (nick === 'HOST') return;
            var els = document.querySelectorAll('[data-nickname="' + nick + '"]');
            for (var i = 0; i < els.length; i++) {
                els[i].style.opacity = '1';
                els[i].style.filter = 'none';
            }
            if (state.playersData[nick]) state.playersData[nick].disconnected = false;
            debounceUpdate(updatePlayersPanel);
            window.TVApp.RenderPlayers.updateAnswerCounter();
        });

        socket.on('player-left', function (data) {
            var nick = typeof data === 'string' ? data : data.nickname || data;
            if (nick === 'HOST') return;
            var idx = state.connectedPlayers.indexOf(nick);
            if (idx > -1) {
                state.connectedPlayers.splice(idx, 1);
                delete state.playersData[nick];
            }
            debounceUpdate(updatePlayersPanel);
            window.TVApp.RenderPlayers.updateAnswerCounter();

            var els = document.querySelectorAll('[data-nickname="' + nick + '"]');
            for (var i = 0; i < els.length; i++) {
                els[i].remove();
                state.totalPlayers--;
                var el = getEl('p-count');
                if (el) el.textContent = _t(state.totalPlayers);
            }
            var btn = getEl('btn-empezar');
            if (btn && state.totalPlayers === 0) btn.disabled = true;
        });

        return socket;
    }

    return {
        initSocket: initSocket
    };
})();
