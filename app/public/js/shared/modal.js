/**
 * @fileoverview Modal helpers for player and presenter UIs
 */

const MODAL_STYLE_ID = 'xiro-modal-styles';

export function tr(text) {
    if (typeof text !== 'string') return text;
    return window.XiroI18n?.translateLiteral
        ? window.XiroI18n.translateLiteral(text)
        : text;
}

export function ensureModalStyles() {
    if (document.getElementById(MODAL_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = MODAL_STYLE_ID;
    style.textContent = `
        @keyframes xiro-fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        @keyframes xiro-zoom-in {
            from { opacity: 0; transform: scale(0.88); }
            to   { opacity: 1; transform: scale(1); }
        }
        .xiro-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            padding: 20px;
            animation: xiro-fade-in 0.2s ease-out both;
        }
        .xiro-modal {
            background: #ffffff;
            color: #0f172a;
            border-radius: 20px;
            padding: 24px;
            width: 100%;
            max-width: 420px;
            border: 4px solid #e2e8f0;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
            font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
            animation: xiro-zoom-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .xiro-modal[data-type="info"] { border-color: #93c5fd; }
        .xiro-modal[data-type="warning"] { border-color: #facc15; }
        .xiro-modal[data-type="error"] { border-color: #fca5a5; }
        .xiro-modal[data-type="success"] { border-color: #86efac; }
        .xiro-modal-title {
            font-size: 20px;
            font-weight: 800;
            margin: 0;
        }
        .xiro-modal-message {
            margin-top: 12px;
            font-size: 16px;
            line-height: 1.45;
        }
        .xiro-modal-actions {
            margin-top: 20px;
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .xiro-modal-btn {
            border: none;
            border-radius: 999px;
            padding: 10px 18px;
            font-weight: 800;
            cursor: pointer;
            min-width: 120px;
        }
        .xiro-modal-btn-primary {
            background: #2563eb;
            color: #ffffff;
        }
        .xiro-modal-btn-secondary {
            background: #e2e8f0;
            color: #0f172a;
        }
        .xiro-modal-input {
            margin-top: 16px;
            width: 100%;
            padding: 10px 14px;
            border-radius: 12px;
            border: 2px solid #cbd5e1;
            font-size: 16px;
            box-sizing: border-box;
        }
        .xiro-modal-input:focus {
            outline: none;
            border-color: #2563eb;
        }
        .xiro-modal-input.is-invalid {
            border-color: #ef4444;
        }
    `;
    document.head.appendChild(style);
}

function buildModal({ title, message, type, showCancel, confirmText, cancelText, onConfirm, onCancel }) {
    ensureModalStyles();
    const openedAt = Date.now();

    const overlay = document.createElement('div');
    overlay.className = 'xiro-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'xiro-modal';
    modal.dataset.type = type || 'info';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
        <h2 class="xiro-modal-title"></h2>
        <div class="xiro-modal-message"></div>
        <div class="xiro-modal-actions"></div>
    `;

    modal.querySelector('.xiro-modal-title').textContent = tr(title || 'Aviso');
    modal.querySelector('.xiro-modal-message').textContent = tr(message || '');

    const actions = modal.querySelector('.xiro-modal-actions');

    if (showCancel) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'xiro-modal-btn xiro-modal-btn-secondary';
        cancelBtn.textContent = tr(cancelText || 'Cancelar');
        cancelBtn.addEventListener('click', () => close('cancel'));
        actions.appendChild(cancelBtn);
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'xiro-modal-btn xiro-modal-btn-primary';
    confirmBtn.textContent = tr(confirmText || 'Aceptar');
    confirmBtn.addEventListener('click', () => close('confirm'));
    actions.appendChild(confirmBtn);

    function close(action) {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);

        if (action === 'confirm' && typeof onConfirm === 'function') {
            onConfirm();
        }
        if (action === 'cancel' && typeof onCancel === 'function') {
            onCancel();
        }
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') {
            close(showCancel ? 'cancel' : 'confirm');
        }
    }

    overlay.addEventListener('click', (event) => {
        // En móviles, el tap que abre el modal puede generar un click sintético
        // tardío sobre el overlay y cerrarlo al instante. Ignoramos ese primer
        // tramo temporal para evitar falsos "Cancelar".
        if (Date.now() - openedAt < 400) {
            return;
        }

        if (event.target === overlay) {
            close(showCancel ? 'cancel' : 'confirm');
        }
    });

    document.addEventListener('keydown', onKeyDown);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

export function mostrarModalMensaje(titulo, mensaje, tipo = 'info', textoConfirm = 'Aceptar', onClose) {
    buildModal({
        title: titulo,
        message: mensaje,
        type: tipo,
        showCancel: false,
        confirmText: textoConfirm,
        onConfirm: onClose
    });
}

export function mostrarModalConfirmacion(titulo, mensaje, onConfirm, onCancel, textoConfirm = 'Confirmar', textoCancelar = 'Cancelar', tipo = 'warning') {
    buildModal({
        title: titulo,
        message: mensaje,
        type: tipo,
        showCancel: true,
        confirmText: textoConfirm,
        cancelText: textoCancelar,
        onConfirm: onConfirm,
        onCancel: onCancel
    });
}
