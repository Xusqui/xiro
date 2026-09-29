/**
 * @module state
 * @description Singleton de estado local del add-in. Fuente única de verdad
 *   compartida entre módulos. Sin lógica de negocio — solo datos.
 * @depends []
 * @server-events []
 * @server-endpoints []
 *
 * Uso:
 *   XiroState.set('sessionId', 'ABC-1234');
 *   const sid = XiroState.get('sessionId');
 *   XiroState.on('sessionId', (val) => console.log('cambió a', val));
 */

// Todos los campos del estado con sus valores iniciales
const INITIAL = {
    // Identificación del presentador (persiste entre sesiones via localStorage)
    playerId: null,

    // Modo del task pane: 'edit' | 'present'
    taskpaneMode: 'edit',

    // Referencia al objeto Dialog activo de la Dialog API de Office.js
    dialog: null,

    // Session keeper: estado que persiste entre diálogos durante la presentación
    // Ver taskpane-present/session-keeper.js
    sessionKeeper: null,
};

// Estado mutable (deep copy del inicial)
const _state = Object.assign({}, INITIAL);

// Listeners por clave: { key: [fn, ...] }
const _listeners = {};

const XiroState = {
    /**
     * Obtiene el valor de una clave.
     * @param {string} key
     * @returns {*}
     */
    get(key) {
        return _state[key];
    },

    /**
     * Actualiza una clave y notifica a los listeners.
     * Admite objeto parcial para actualizar varios campos.
     * @param {string|Object} keyOrObj
     * @param {*} [value]
     */
    set(keyOrObj, value) {
        if (typeof keyOrObj === 'object' && keyOrObj !== null) {
            Object.entries(keyOrObj).forEach(([k, v]) => this._setOne(k, v));
        } else {
            this._setOne(keyOrObj, value);
        }
    },

    _setOne(key, value) {
        _state[key] = value;
        (_listeners[key] || []).forEach(fn => {
            try { fn(value); } catch (e) { console.error('[XiroState] listener error:', e); }
        });
    },

    /**
     * Registra un callback para cuando una clave cambia.
     * @param {string} key
     * @param {Function} fn
     * @returns {Function} unsubscribe
     */
    on(key, fn) {
        if (!_listeners[key]) _listeners[key] = [];
        _listeners[key].push(fn);
        return () => this.off(key, fn);
    },

    /**
     * Elimina un listener registrado.
     * @param {string} key
     * @param {Function} fn
     */
    off(key, fn) {
        if (!_listeners[key]) return;
        _listeners[key] = _listeners[key].filter(cb => cb !== fn);
    },

    /** Resetea el estado al inicial (salvo playerId). */
    reset() {
        const pid = _state.playerId;
        Object.assign(_state, INITIAL);
        _state.playerId = pid;
    },

    /** Devuelve snapshot del estado para depuración. */
    snapshot() {
        return Object.assign({}, _state);
    },
};
