/**
 * @module view-waiting
 * @description Vista de espera: "Continúa con tu presentación".
 *   Se muestra en diapositivas sin marcador XIRO o durante la carga inicial.
 * @depends [dialog-router (_esc)]
 */

const ViewWaiting = (() => ({
    mount(container, { msg } = {}) {
        const safeMsg = _esc(msg || 'Continúa con tu presentación'); // eslint-disable-line no-undef
        container.innerHTML = `
            <div class="view-waiting">
                <span class="xiro-logo">⚡</span>
                <p class="waiting-title">Xiro!</p>
                <p class="waiting-msg">${safeMsg}</p>
            </div>`;
    },
    unmount() {},
}))();
