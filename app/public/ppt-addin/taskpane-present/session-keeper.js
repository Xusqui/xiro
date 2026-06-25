/**
 * @module session-keeper
 * @description Mantiene el estado de sesión entre diálogos durante la presentación.
 *   El socket se mantiene ABIERTO en el task pane durante toda la presentación.
 *   Cada diálogo abre su propia conexión temporal.
 * @depends [shared/state, modules/socket-client]
 */

const XiroSessionKeeper = (() => {

    // Estado persistente durante toda la presentación
    let _state = {
        sessionId: null,
        gameId: null,
        pin: null,
        mode: 'individual',
        teams: [],
        questionIndex: -1,
        socket: null,
        playerId: null,
        dbSessionId: null,
        gameType: null,
    };

    /**
     * Inicia o actualiza la sesión con datos llegados desde el diálogo de lobby.
     * @param {{ sessionId, gameId, pin, mode, teams, playerId }} data
     */
    function init(data) {
        _state.sessionId = data.sessionId || _state.sessionId;
        _state.gameId = data.gameId || _state.gameId;
        _state.pin = data.pin || _state.pin;
        _state.mode = data.mode || _state.mode;
        _state.teams = data.teams || _state.teams;
        _state.playerId = data.playerId || _state.playerId;
        _state.gameType = data.gameType || _state.gameType;
        _state.questionIndex = -1; // reiniciar índice en nueva sesión

        // Reconectar socket del task pane a la sesión
        _connectSocket();
    }

    /**
     * Devuelve el estado actual. El diálogo lo recibe como `session` en el init payload.
     * @returns {object}
     */
    function getState() {
        return Object.assign({}, _state, { socket: null }); // no pasar socket al diálogo
    }

    /**
     * Objeto completo que se envía al diálogo al abrirse.
     * @returns {{ meta: null, session: object }}
     */
    function getInitPayload() {
        return {
            sessionId: _state.sessionId,
            gameId: _state.gameId,
            pin: _state.pin,
            mode: _state.mode,
            teams: _state.teams,
            questionIndex: _state.questionIndex,
            playerId: _state.playerId,
            dbSessionId: _state.dbSessionId,
            gameType: _state.gameType,
        };
    }

    /**
     * Actualiza el índice de la última pregunta presentada.
     * @param {number} n
     */
    function setQuestionIndex(n) {
        _state.questionIndex = n;
    }

    /**
     * Limpia el estado al terminar la presentación.
     */
    function reset() {
        if (_state.socket) {
            try { _state.socket.disconnect(); } catch (_) { }
        }
        _state = {
            sessionId: null, gameId: null, pin: null,
            mode: 'individual', teams: [], questionIndex: -1,
            socket: null, playerId: null, dbSessionId: null, gameType: null,
        };
    }

    /**
     * Abre (o reconecta) el socket persistente del task pane.
     * @private
     */
    function _connectSocket() {
        if (!_state.sessionId || !_state.playerId) return;

        // Usar socket-client si está disponible
        if (typeof XiroSocketClient === 'undefined') return; // eslint-disable-line no-undef

        if (_state.socket && _state.socket.connected) {
            // Ya conectado — reconectar como presentador por si perdió la sala
            _state.socket.emit('reconnect-presenter', {
                playerId: _state.playerId,
                token: localStorage.getItem('adminToken') || ''
            });
            return;
        }

        _state.socket = XiroSocketClient.connect(); // eslint-disable-line no-undef

        _state.socket.once('connect', () => {
            _state.socket.emit('reconnect-presenter', {
                playerId: _state.playerId,
                token: localStorage.getItem('adminToken') || ''
            });
        });

        _state.socket.on('results-ready', (data) => {
            if (data && data.sessionId) {
                _state.dbSessionId = data.sessionId;
                XiroLog.debug('session-keeper', 'dbSessionId stored: ' + data.sessionId); // eslint-disable-line no-undef
            }
        });
    }

    /**
     * Emite el evento de fin de juego correcto según el tipo de juego.
     * Llamado desde slide-watcher al detectar diapositiva de podio.
     */
    function emitEndGame() {
        const socket = _state.socket;
        const roomId = _state.sessionId;   // full roomId e.g. "DIATERMIA-7294"
        if (!socket || !socket.connected || !roomId) {
            XiroLog.warn('session-keeper', 'emitEndGame: no hay socket conectado'); // eslint-disable-line no-undef
            return false;
        }
        const isTrivial = (_state.gameType || '').toLowerCase() === 'trivial';
        if (isTrivial) {
            socket.emit('trivial-end-game', { roomId });
            XiroLog.info('session-keeper', 'trivial-end-game emitido', { roomId }); // eslint-disable-line no-undef
        } else {
            socket.emit('end-game', { roomIdOrPin: roomId, reason: 'completed' });
            XiroLog.info('session-keeper', 'end-game emitido', { roomId }); // eslint-disable-line no-undef
        }
        return true;
    }

    return { init, getState, getInitPayload, setQuestionIndex, reset, emitEndGame };
})();
