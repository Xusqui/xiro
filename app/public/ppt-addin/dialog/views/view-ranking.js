/**
 * @module view-ranking
 * @description Vista de ranking intermedio tras revelar respuesta.
 *   Muestra top-5 y botón "Continuar presentación" → cierra el diálogo.
 * @depends [dialog-router]
 */

const ViewRanking = (() => {

    function mount(container, { meta, session, revealData }) {
        const ranking = (revealData && revealData.ranking) || [];

        container.innerHTML = `
            <div class="view-ranking">
                <h2 class="ranking-title">📊 Ranking</h2>
                <div class="ranking-list" id="vr-list"></div>
                <button class="dlg-btn dlg-btn-primary" id="vr-continue">
                    Siguiente diapositiva ▶
                </button>
            </div>
        `;

        _renderList(ranking.slice(0, 10));

        document.getElementById('vr-continue').addEventListener('click', () => {
            _notifyParent({ event: 'question-done', index: meta.index });
            window.close();
        });
    }

    function _renderList(ranking) {
        const el = document.getElementById('vr-list');
        if (!el) return;
        if (!ranking.length) {
            el.innerHTML = '<p style="color:#64748b;text-align:center">Sin datos de ranking</p>';
            return;
        }
        el.innerHTML = ranking.map((r, i) => `
            <div class="ranking-row">
                <span class="ranking-pos">${i + 1}</span>
                <span class="ranking-name">${_esc(r.name || r.nickname || '—')}</span>
                <span class="ranking-pts">${r.pts ?? r.score ?? 0} pts</span>
            </div>
        `).join('');
    }

    function unmount() { }

    return { mount, unmount };
})();
