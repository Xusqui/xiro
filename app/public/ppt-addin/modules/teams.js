/**
 * @module teams
 * @description Gestión de configuración de equipos para modos en equipo.
 *   Define equipos (nombre, color, jugadores). Persiste la config en state.
 *   No accede al DOM — devuelve/recibe estructuras de datos.
 * @depends [state]
 * @server-events []
 * @server-endpoints []
 */

// Paleta de colores por defecto para equipos (hex sin #)
const DEFAULT_COLORS = ['E53935', '1E88E5', 'F4C20D', '2E7D32', '8E24AA', 'FF6D00'];
const DEFAULT_NAMES = ['Equipo 1', 'Equipo 2', 'Equipo 3', 'Equipo 4', 'Equipo 5', 'Equipo 6'];
const MIN_TEAMS = 2;
const MAX_TEAMS = 6;

const XiroTeams = {
    MIN_TEAMS,
    MAX_TEAMS,

    // ── Creación de configuración ─────────────────────────────

    /**
     * Genera la configuración inicial para N equipos.
     * @param {number} count — entre MIN_TEAMS y MAX_TEAMS
     * @returns {Object} teamConfig
     */
    buildConfig(count) {
        const n = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, count));
        const teams = Array.from({ length: n }, (_, i) => ({
            name: DEFAULT_NAMES[i] || `Equipo ${i + 1}`,
            color: DEFAULT_COLORS[i] || 'AAAAAA',
            players: [],
        }));
        return { isTeamMode: true, teams };
    },

    /**
     * Actualiza el nombre de un equipo y guarda en state.
     * @param {number} index
     * @param {string} name
     */
    setTeamName(index, name) {
        const cfg = this._getConfig();
        if (!cfg || !cfg.teams[index]) return;
        cfg.teams[index].name = this._sanitizeName(name);
        XiroState.set('teamConfig', cfg);          // eslint-disable-line no-undef
    },

    /**
     * Actualiza el color de un equipo y guarda en state.
     * @param {number} index
     * @param {string} color — hex sin #
     */
    setTeamColor(index, color) {
        const cfg = this._getConfig();
        if (!cfg || !cfg.teams[index]) return;
        cfg.teams[index].color = color.replace(/^#/, '').toUpperCase();
        XiroState.set('teamConfig', cfg);          // eslint-disable-line no-undef
    },

    /**
     * Cambia el número de equipos (preservando nombres/colores existentes).
     * @param {number} count
     */
    resize(count) {
        const n = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, count));
        const cfg = this._getConfig() || this.buildConfig(n);

        if (cfg.teams.length < n) {
            // Añadir equipos nuevos
            while (cfg.teams.length < n) {
                const i = cfg.teams.length;
                cfg.teams.push({
                    name: DEFAULT_NAMES[i] || `Equipo ${i + 1}`,
                    color: DEFAULT_COLORS[i] || 'AAAAAA',
                    players: [],
                });
            }
        } else {
            cfg.teams = cfg.teams.slice(0, n);
        }

        XiroState.set('teamConfig', cfg);          // eslint-disable-line no-undef
        return cfg;
    },

    /**
     * Inicializa la config con el número de equipos por defecto (2).
     * @returns {Object} teamConfig
     */
    init() {
        const cfg = this.buildConfig(MIN_TEAMS);
        XiroState.set({ mode: 'teams', teamConfig: cfg });  // eslint-disable-line no-undef
        return cfg;
    },

    /** Resetea al modo individual. */
    clear() {
        XiroState.set({ mode: 'individual', teamConfig: null });  // eslint-disable-line no-undef
    },

    /** @returns {Object|null} config actual desde state */
    getConfig() {
        return XiroState.get('teamConfig');        // eslint-disable-line no-undef
    },

    /** @returns {boolean} true si el modo actual es por equipos */
    isTeamMode() {
        return XiroState.get('mode') === 'teams'; // eslint-disable-line no-undef
    },

    /** @returns {Array<{label, color}>} opciones de color disponibles */
    colorOptions() {
        return DEFAULT_COLORS.map(hex => ({ label: `#${hex}`, color: hex }));
    },

    // ── Privados ─────────────────────────────────────────────

    _getConfig() {
        const cfg = XiroState.get('teamConfig');   // eslint-disable-line no-undef
        // Devolver copia superficial para evitar mutación accidental
        return cfg ? { ...cfg, teams: cfg.teams.map(t => ({ ...t })) } : null;
    },

    _sanitizeName(name) {
        // Eliminar caracteres problemáticos; máximo 30 caracteres
        return String(name).replace(/[<>"'&]/g, '').trim().slice(0, 30) || 'Equipo';
    },
};
