// Comportamiento de la cabecera de los editores (editor-header.js): abrir y cerrar el
// panel «Ajustes» (botón, «Listo», Escape o clic fuera) y mantener al día el resumen
// de la barra mientras se cambian los ajustes. Los escuchadores de documento se
// instalan una sola vez y sirven para cualquier editor que esté en pantalla.

function _ehHost(el) {
    return el?.closest?.('.xeh-host') || null;
}

function _ehSetOpen(host, open, focusToggle) {
    if (!host) return;
    const toggle = host.querySelector('[data-xeh-toggle]');
    const panel = host.querySelector('[data-xeh-panel]');
    if (!toggle || !panel) return;
    toggle.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    if (open) return;
    refreshEditorHeaderSummary(host);
    if (focusToggle) toggle.focus();
}

/** Botón de la barra: abre o cierra el panel. */
function toggleEditorSettings(button) {
    _ehSetOpen(_ehHost(button), button.getAttribute('aria-expanded') !== 'true', false);
}

/** Botón «Listo» del panel. */
function closeEditorSettings(button) {
    _ehSetOpen(_ehHost(button), false, true);
}

/** Vuelve a pintar chips y miniatura de portada con los valores del formulario. */
function refreshEditorHeaderSummary(host) {
    const bar = host?.querySelector('[data-xeh]');
    if (!bar) return;
    let ids;
    try {
        ids = JSON.parse(bar.dataset.xehIds || '{}');
    } catch {
        return;
    }
    const field = id => (id ? document.getElementById(id) : null);
    const state = {
        visible: field(ids.visible)?.checked ?? true,
        language: field(ids.language)?.value,
        streaks: !!field(ids.streaks)?.checked,
        streakThreshold: field(ids.streakThreshold)?.value,
        double: !!field(ids.double)?.checked,
        doubleThreshold: field(ids.doubleThreshold)?.value,
        random: !!field(ids.random)?.checked
    };
    const chips = host.querySelector('[data-xeh-chips]');
    if (chips) chips.innerHTML = _ehChipsHtml(state);
    const tile = host.querySelector('[data-xeh-tile]');
    if (tile) tile.innerHTML = _ehTileHtml(field(ids.cover)?.value, bar.dataset.xehIcon);
}

function _ehOpenHost() {
    return _ehHost(document.querySelector('[data-xeh-panel]:not([hidden])'));
}

function _installEditorHeaderListeners() {
    if (window._xehListenersReady) return;
    window._xehListenersReady = true;

    document.addEventListener('keydown', e => {
        // Un diálogo encima (confirmación, error) se cierra antes que el panel
        if (e.key !== 'Escape' || document.querySelector('.xiro-admin-overlay')) return;
        const host = _ehOpenHost();
        if (host) _ehSetOpen(host, false, true);
    });

    document.addEventListener('pointerdown', e => {
        const host = _ehOpenHost();
        if (!host || host.contains(e.target) || e.target.closest?.('.xiro-admin-overlay')) return;
        _ehSetOpen(host, false, false);
    });

    // Lo que cambia dentro del panel se refleja en la barra. El idioma solo
    // escribe un input oculto al pulsar su bandera, por eso también se escucha click.
    for (const type of ['input', 'change', 'click']) {
        document.addEventListener(type, e => {
            const host = e.target.closest?.('[data-xeh-panel]') ? _ehHost(e.target) : null;
            if (host) setTimeout(() => refreshEditorHeaderSummary(host), 0);
        });
    }
}

if (typeof document !== 'undefined') _installEditorHeaderListeners();
