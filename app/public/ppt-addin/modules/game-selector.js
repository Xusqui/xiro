/**
 * @module game-selector
 * @description Carga la lista de juegos disponibles y expone los datos
 *   seleccionados para que taskpane.js decida la transición de pantalla.
 *   NO accede al DOM directamente — devuelve datos con callbacks.
 * @depends [state, api]
 * @server-events []
 * @server-endpoints
 *   GET /api/presenter-pins → [{pin, name, type, question_count}]
 */

const XiroGameSelector = {

    // Caché de la última lista cargada
    _games: [],

    // Filtro activo: 'todos' | 'bank' | 'custom' | 'trivial'
    _filter: 'todos',

    // ── Carga de juegos ───────────────────────────────────────

    /**
     * Carga los juegos desde el servidor y los normaliza.
     * @returns {Promise<Array>} lista normalizada de juegos
     */
    async load() {
        const raw = await XiroApi.getPresenterPins();   // eslint-disable-line no-undef

        // Normalizar tipo al inglés para uso interno
        this._games = raw.map(g => ({
            pin: g.pin || '',
            name: g.name || g.pin || '',
            type: this._normalizeType(g.type || ''),
            questionCount: Number(g.question_count) || 0,
        }));

        return this._games;
    },

    /**
     * Normaliza el tipo de juego al conjunto canónico.
     * @param {string} raw
     * @returns {'bank'|'custom'|'trivial'|'mix'}
     */
    _normalizeType(raw) {
        const t = raw.toLowerCase();
        if (/banco|bank/.test(t)) return 'bank';
        if (/trivial/.test(t)) return 'trivial';
        if (/mezcla|mix/.test(t)) return 'mix';
        return 'custom';
    },

    // ── Filtrado ──────────────────────────────────────────────

    /**
     * Devuelve los juegos filtrados por tipo.
     * @param {string} [filter='todos']
     * @returns {Array}
     */
    getFiltered(filter) {
        const f = filter || this._filter;
        this._filter = f;
        if (f === 'todos') return this._games;
        return this._games.filter(g => g.type === f);
    },

    /** Etiqueta legible para tipo de juego. */
    typeLabel(type) {
        return { bank: 'Banco', custom: 'Personalizado', trivial: 'Trivial', mix: 'Mix' }[type] || type;
    },

    // ── Selección ─────────────────────────────────────────────

    /**
     * Registra la selección del usuario en el estado global.
     * @param {{ pin, name, type, questionCount }} game
     */
    select(game) {
        XiroState.set({                          // eslint-disable-line no-undef
            selectedPin: game.pin,
            selectedGameName: game.name,
            selectedQuestionCount: game.questionCount,
        });
    },

    /** Limpia la selección actual. */
    clearSelection() {
        XiroState.set({                          // eslint-disable-line no-undef
            selectedPin: null,
            selectedGameName: '',
            selectedQuestionCount: 0,
        });
    },

    /** @returns {boolean} true si hay un juego seleccionado */
    hasSelection() {
        return !!XiroState.get('selectedPin');   // eslint-disable-line no-undef
    },
};
