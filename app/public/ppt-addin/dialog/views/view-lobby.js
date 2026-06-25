/**
 * @module view-lobby
 * @description Vista del lobby: QR + unión de jugadores + inicio de juego.
 *   Conecta a Socket.IO como presentador (nickname 'HOST').
 *   Al iniciar: emite start-game → notifica task pane → cierra.
 *   El sessionId lo genera el backend (POST /api/addin/create-session) para
 *   garantizar formato correcto (PIN-DDDD) y validar el PIN.
 * @depends [shared/api]
 */

const ViewLobby = (() => {

    let _socket = null;
    let _meta = null;
    let _session = null;
    let _players = [];

    function mount(container, { meta, session }) {
        _meta = meta;
        _session = session;
        _players = [];

        container.innerHTML = `
            <div class="view-lobby">
                <p class="lobby-pin" id="vl-pin">Creando sesión…</p>
                <p class="lobby-url" id="vl-url"></p>
                <div id="dlg-qr"></div>
                <p class="lobby-players-count" id="vl-count">0 jugadores</p>
                <div id="dlg-players-list"></div>
                <button id="vl-start" class="dlg-btn dlg-btn-primary" disabled>
                    Lobby completado ▶
                </button>
            </div>
        `;

        document.getElementById('vl-start').addEventListener('click', _onStart);
        _initSession();
    }

    /**
     * Obtiene (o reutiliza) el sessionId desde el backend, luego conecta al lobby.
     */
    async function _initSession() {
        try {
            let sessionId = _session.sessionId;

            if (!sessionId) {
                const pin = _meta.pin || _session.pin;
                const result = await XiroApi.createSession(pin); // eslint-disable-line no-undef
                sessionId = result.sessionId;

                // Notificar al task pane para que guarde la sesión
                const data = {
                    sessionId,
                    pin,
                    gameId: _meta.gameId,
                    gameType: _meta.gameType || '',
                    mode: _meta.mode || 'individual',
                    teams: _meta.teams || [],
                    playerId: _session.playerId || crypto.randomUUID(),
                };
                _notifyParent({ event: 'session-created', data });
                _session.sessionId = sessionId;
                _session.playerId = data.playerId;
            }

            _updatePinDisplay(sessionId);
            _connectSocket(sessionId);
        } catch (err) {
            const pinEl = document.getElementById('vl-pin');
            if (pinEl) pinEl.textContent = 'Error: ' + err.message;
        }
    }

    function _connectSocket(sessionId) {
        const pin = _meta.pin || _session.pin;
        const playerId = _session.playerId || crypto.randomUUID();
        const token = localStorage.getItem('adminToken') || '';

        if (!token) {
            const pinEl = document.getElementById('vl-pin');
            if (pinEl) pinEl.textContent = 'Error lobby: token del panel ausente';
            return;
        }

        _socket = io({ auth: { playerId }, transports: ['websocket'], upgrade: false, path: '/socket.io/' }); // eslint-disable-line no-undef

        _socket.on('connect', () => {
            const lobbyData = {
                pin, sessionId, playerId, token,
                isTeamMode: _meta.mode === 'teams'
            };
            if (_meta.mode === 'teams' && _meta.teams) {
                lobbyData.teamConfig = { isTeamMode: true, teams: (_meta.teams || []).map(name => ({ name, color: '#7c3aed', players: [] })) };
            }
            _socket.emit('join-presenter-lobby', lobbyData);
        });

        _socket.on('player-joined', (data) => {
            const nick = typeof data === 'string' ? data : (data.nickname || data);
            if (nick && nick !== 'HOST' && !_players.includes(nick)) {
                _players.push(nick);
                _renderPlayers();
            }
        });

        _socket.on('join-error', (d) => {
            const pinEl = document.getElementById('vl-pin');
            if (pinEl) pinEl.textContent = 'Error lobby: ' + (d.message || '');
        });
    }

    function _updatePinDisplay(sessionId) {
        const pinEl = document.getElementById('vl-pin');
        const urlEl = document.getElementById('vl-url');
        const qrEl = document.getElementById('dlg-qr');
        const joinUrl = window.location.origin + '/jugador.html?session=' + encodeURIComponent(sessionId);

        if (pinEl) pinEl.textContent = sessionId;
        if (urlEl) urlEl.textContent = joinUrl;

        if (qrEl) {
            const img = document.createElement('img');
            img.src = '/api/qr?url=' + encodeURIComponent(joinUrl);
            img.alt = 'QR para unirse';
            img.style.cssText = 'width:500px;height:500px;border-radius:.5rem;display:block;margin:0 auto';
            qrEl.innerHTML = '';
            qrEl.appendChild(img);
        }
    }

    function _renderPlayers() {
        const countEl = document.getElementById('vl-count');
        const listEl = document.getElementById('dlg-players-list');
        const startBtn = document.getElementById('vl-start');
        if (countEl) countEl.textContent = _players.length + ' jugador' + (_players.length !== 1 ? 'es' : '');
        if (listEl) listEl.innerHTML = _players.map(n => `<span class="player-chip">${_esc(n)}</span>`).join('');
        if (startBtn) startBtn.disabled = _players.length === 0;
    }

    function _onStart() {
        const sessionId = _session.sessionId;
        if (!_socket || !sessionId) return;
        const btn = document.getElementById('vl-start');
        if (btn) { btn.disabled = true; btn.textContent = 'Completado ✓'; }

        // Desconectar del lobby. El task-pane cerrará este diálogo y
        // avanzará la diapositiva. Al llegar a la pregunta, un nuevo
        // diálogo se abrirá automáticamente y emitirá start-game.
        _socket.disconnect();
        _notifyParent({ event: 'lobby-done' });
        // No llamamos window.close() aquí: messageParent + window.close()
        // tiene race conditions. El task-pane cierra el diálogo desde su lado.
    }

    function unmount() {
        if (_socket) { try { _socket.disconnect(); } catch (_) { } _socket = null; }
    }

    return { mount, unmount };
})();
