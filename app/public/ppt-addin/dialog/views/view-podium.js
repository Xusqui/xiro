/**
 * @module view-podium
 * @description Vista del podio final.
 *   Llama a GET /api/results/session/:id para obtener ranking final.
 *   Botón "Insertar" → task pane inserta la diapositiva.
 *   Botón "Cerrar" → cierra el diálogo.
 * @depends [shared/api]
 */

const ViewPodium = (() => {

    let _podiumData = null;
    let _meta = null;
    let _session = null;

    function mount(container, { meta, session }) {
        _meta = meta;
        _session = session;
        container.innerHTML = `<div class="view-podium"><p style="color:#94a3b8">Cargando podio…</p></div>`;
        _loadPodium(container);
    }

    function _setLoading(container, msg) {
        container.innerHTML = `<div class="view-podium"><p style="color:#94a3b8">${_esc(msg)}</p></div>`; // eslint-disable-line no-undef
    }

    function _log(level, msg, data) {
        apiPost('/api/addin-log', { level, module: 'view-podium', message: msg, data }).catch(() => { }); // eslint-disable-line no-undef
    }

    async function _loadPodium(container) {
        // Si ya tenemos el ID de BD (capturado antes via results-ready), cargamos directamente.
        if (_session.dbSessionId) {
            _log('info', 'loadPodium: using cached dbSessionId', { dbSessionId: _session.dbSessionId });
            return _fetchAndRender(container, _session.dbSessionId, null);
        }

        const sessionId = _session.sessionId;   // roomId completo, ej. "DIATERMIA-7294"
        const pin = _session.pin;         // PIN del juego, ej. "DIATERMIA"
        const gameType = (_session.gameType || '');

        _log('info', 'loadPodium: start', { sessionId, pin, gameType });

        if (!sessionId && !pin) {
            _setLoading(container, 'Error: sin sesión disponible.');
            _log('warn', 'loadPodium: no session data');
            return;
        }

        _setLoading(container, 'Finalizando partida…');

        // Pedir al servidor que finalice la partida vía HTTP.
        // Es fire-and-forget: si falla (ej. ya terminó), continuamos igualmente.
        if (sessionId) {
            try {
                const endRes = await apiPost('/api/addin/end-game', { sessionId, gameType }); // eslint-disable-line no-undef
                _log('info', 'loadPodium: end-game ok', endRes);
            } catch (endErr) {
                _log('warn', 'loadPodium: end-game error (ignorado)', { error: endErr.message });
            }
        }

        // Usar sessionId (roomId completo, ej. "DIATERMIA-7329") para el lookup en BD
        // porque saveGameSession guarda el roomId completo como pin, no el pin corto.
        return _fetchAndRender(container, null, sessionId || pin);
    }

    async function _fetchAndRender(container, dbSessionId, pin) {
        const MAX_RETRIES = 5;
        const RETRY_MS = 2500;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                let data;
                if (dbSessionId) {
                    data = await apiGet('/api/results/session/' + encodeURIComponent(dbSessionId) + '/export.json'); // eslint-disable-line no-undef
                } else if (pin) {
                    data = await apiGet('/api/results/' + encodeURIComponent(pin) + '/export.json'); // eslint-disable-line no-undef
                } else {
                    throw new Error('Sin identificador de sesión disponible');
                }
                _podiumData = data.final_ranking || data.ranking || [];
                _log('info', 'fetchAndRender: ok', { ranking: _podiumData.length, attempt });
                _render(container, _podiumData);
                return;
            } catch (err) {
                _log('warn', 'fetchAndRender: error attempt=' + attempt, { error: err.message, dbSessionId, pin });
                const isNotFound = err.message && (err.message.includes('404') || err.message.includes('No hay'));
                if (isNotFound && attempt < MAX_RETRIES) {
                    _setLoading(container, `Esperando resultados… (${attempt + 1}/${MAX_RETRIES})`);
                    await new Promise(r => setTimeout(r, RETRY_MS));
                } else {
                    container.innerHTML = `
                        <div class="view-podium">
                            <p style="color:#ef4444">Error cargando podio: ${_esc(err.message)}</p>
                            <button class="dlg-btn dlg-btn-ghost" id="vp-close-error">Cerrar</button>
                        </div>`;
                    const closeBtn = document.getElementById('vp-close-error');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => window.close());
                    }
                    return;
                }
            }
        }
    }

    function _render(container, ranking) {
        const top3 = ranking.slice(0, 3);
        const medals = ['🥇', '🥈', '🥉'];
        const slotClass = ['p1', 'p2', 'p3'];

        const top3Html = top3.map((r, i) => `
            <div class="podium-slot ${slotClass[i]}">
                <span class="podium-medal">${medals[i]}</span>
                <span class="podium-name">${_esc(r.name || r.nickname || '—')}</span>
                <span class="podium-score">${r.pts ?? r.score ?? 0} pts</span>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="view-podium">
                <h2 class="podium-title">🏆 Podio Final</h2>
                <div class="podium-top3">${top3Html}</div>
                <div class="podium-actions">
                    <button class="dlg-btn dlg-btn-primary" id="vp-continue">
                        Continuar ▶
                    </button>
                </div>
            </div>
        `;

        document.getElementById('vp-continue').addEventListener('click', () => {
            _notifyParent({ event: 'question-done', index: -1 }); // eslint-disable-line no-undef
        });
    }

    function unmount() { }

    return { mount, unmount };
})();
