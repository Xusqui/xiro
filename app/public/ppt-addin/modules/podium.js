/**
 * @module podium
 * @description Recibe el evento game-ended del servidor con el ranking final
 *   y notifica a taskpane.js para renderizar el podio. También gestiona
 *   el evento results-ready para el enlace de descarga de CSV.
 * @depends [state, socket-client]
 * @server-events
 *   ESCUCHA: game-ended, results-ready
 * @server-endpoints []
 */

const XiroPodium = {
    _onUpdate: null,

    // ── Arranque ─────────────────────────────────────────────

    /**
     * Registra callback de UI y escucha eventos de fin de juego.
     * @param {Function} onUpdate — fn({ ranking, csvUrl, isTeamMode, teams })
     */
    start(onUpdate) {
        this._onUpdate = onUpdate || (() => { });

        XiroSocket.on('game-ended', (ranking, ack) => {  // eslint-disable-line no-undef
            // Limpiar datos de sesión del almacenamiento para evitar auto-reconexión
            XiroSession.clearSavedSession();               // eslint-disable-line no-undef

            // Normalizar ranking: puede ser array directo o {ranking:[]}
            const list = Array.isArray(ranking)
                ? ranking
                : (ranking && Array.isArray(ranking.ranking) ? ranking.ranking : []);

            XiroState.set({ isGameActive: false });        // eslint-disable-line no-undef
            this._notify(list, null);

            if (typeof ack === 'function') ack();
        });

        XiroSocket.on('results-ready', (data) => {       // eslint-disable-line no-undef
            const dbId = data && data.sessionId;
            const csvUrl = dbId ? `/api/results/session/${encodeURIComponent(dbId)}/export.csv` : null;
            const curRanking = XiroState.get('podiumRanking') || [];  // eslint-disable-line no-undef
            this._notify(curRanking, csvUrl);
        });
    },

    stop() {
        this._onUpdate = null;
    },

    // ── Privados ─────────────────────────────────────────────

    _notify(ranking, csvUrl) {
        // Guardar el ranking en state para que slide-inserter pueda usarlo
        XiroState.set('podiumRanking', ranking);         // eslint-disable-line no-undef

        const isTeamMode = XiroState.get('mode') === 'teams';  // eslint-disable-line no-undef
        const teams = isTeamMode ? (XiroState.get('teamConfig') || {}).teams : null;  // eslint-disable-line no-undef

        if (this._onUpdate) {
            this._onUpdate({
                ranking,
                csvUrl,
                isTeamMode,
                teams,
                total: ranking.length,
            });
        }
    },
};
