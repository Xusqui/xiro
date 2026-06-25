/**
 * @module lobby
 * @description Gestiona el estado del lobby: recibe eventos de jugadores
 *   en tiempo real y notifica a taskpane.js para actualizar la UI.
 *   Expone métodos para iniciar partida y gestionar la sesión.
 * @depends [state, socket-client, qr-renderer, session]
 * @server-events
 *   ESCUCHA: join-success, player-joined, player-left
 *   EMITE:   start-game (vía XiroSession)
 * @server-endpoints []
 */

const XiroLobby = {

    // Callback registrado por taskpane.js para actualizar la UI
    _onUpdate: null,

    // ── Arranque ─────────────────────────────────────────────

    /**
     * Inicia la escucha de eventos de lobby y registra el callback de UI.
     * Llamar una vez cuando se muestre la pantalla de lobby.
     *
     * @param {Function} onUpdate — fn({ players, playerCount, sessionId, joinUrl })
     */
    start(onUpdate) {
        this._onUpdate = onUpdate || (() => { });
        this._registerEvents();

        // Estado inicial desde state.js (puede haber jugadores previos al recuperar sesión)
        this._notify();
    },

    /** Para la escucha de eventos de lobby. Llamar al salir de esta pantalla. */
    stop() {
        this._onUpdate = null;
        XiroSocket.off('join-success', this._handleJoinSuccess);   // eslint-disable-line no-undef
        XiroSocket.off('player-joined', this._handlePlayerJoined);  // eslint-disable-line no-undef
        XiroSocket.off('player-left', this._handlePlayerLeft);    // eslint-disable-line no-undef
    },

    // ── Acciones ─────────────────────────────────────────────

    /**
     * Inicia la partida. Valida que haya al menos un jugador.
     * @throws {Error} si no hay jugadores
     */
    startGame() {
        const players = XiroState.get('lobbyPlayers');  // eslint-disable-line no-undef
        if (!players || players.length === 0) {
            throw new Error('Necesitas al menos 1 jugador para iniciar.');
        }
        XiroSession.startGame();                        // eslint-disable-line no-undef
    },

    /**
     * Devuelve la URL QR de unión para el jugador.
     * @returns {string}
     */
    getJoinUrl() {
        const sid = XiroState.get('sessionId');         // eslint-disable-line no-undef
        return sid ? XiroQR.buildJoinUrl(sid) : '';     // eslint-disable-line no-undef
    },

    /**
     * Renderiza el QR en el canvas proporcionado.
     * @param {HTMLCanvasElement} canvas
     * @param {number} [size=160]
     */
    renderQR(canvas, size) {
        const url = this.getJoinUrl();
        if (url) XiroQR.render(canvas, url, size || 160);  // eslint-disable-line no-undef
    },

    // ── Eventos Socket.IO ─────────────────────────────────────

    _registerEvents() {
        // join-success: el servidor confirma el lobby y devuelve la lista inicial
        this._handleJoinSuccess = (data) => {
            const players = Array.isArray(data.players) ? data.players : [];
            XiroState.set({ lobbyPlayers: players, totalPlayers: players.length });  // eslint-disable-line no-undef
            this._notify();
        };

        // player-joined: nuevo jugador se unió; el servidor envía la lista actualizada
        this._handlePlayerJoined = (data) => {
            const players = Array.isArray(data.players) ? data.players : [];
            XiroState.set({ lobbyPlayers: players, totalPlayers: players.length });  // eslint-disable-line no-undef
            this._notify();
        };

        // player-left: un jugador abandonó el lobby
        this._handlePlayerLeft = (data) => {
            const players = Array.isArray(data.players)
                ? data.players
                : (XiroState.get('lobbyPlayers') || []).filter(p => p !== data.nickname);  // eslint-disable-line no-undef
            XiroState.set({ lobbyPlayers: players, totalPlayers: players.length });      // eslint-disable-line no-undef
            this._notify();
        };

        XiroSocket.on('join-success', this._handleJoinSuccess);   // eslint-disable-line no-undef
        XiroSocket.on('player-joined', this._handlePlayerJoined);  // eslint-disable-line no-undef
        XiroSocket.on('player-left', this._handlePlayerLeft);    // eslint-disable-line no-undef
    },

    _notify() {
        if (!this._onUpdate) return;
        const players = XiroState.get('lobbyPlayers') || [];      // eslint-disable-line no-undef
        const sessionId = XiroState.get('sessionId');               // eslint-disable-line no-undef
        this._onUpdate({
            players,
            playerCount: players.length,
            sessionId,
            joinUrl: this.getJoinUrl(),
        });
    },
};
