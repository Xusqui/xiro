/**
 * @fileoverview Modal con campo de texto (pedir un dato y continuar al confirmar)
 */

import { tr, ensureModalStyles } from './modal.js?v=20260828103529';

function buildInputModal({ title, message, type, placeholder, initialValue, confirmText, cancelText, onConfirm, onCancel }) {
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
        <input type="text" class="xiro-modal-input" />
        <div class="xiro-modal-actions"></div>
    `;

    modal.querySelector('.xiro-modal-title').textContent = tr(title || 'Aviso');
    modal.querySelector('.xiro-modal-message').textContent = tr(message || '');

    const input = modal.querySelector('.xiro-modal-input');
    input.placeholder = tr(placeholder || '');
    input.value = initialValue || '';
    input.maxLength = 20;

    const actions = modal.querySelector('.xiro-modal-actions');

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'xiro-modal-btn xiro-modal-btn-secondary';
    cancelBtn.textContent = tr(cancelText || 'Cancelar');
    cancelBtn.addEventListener('click', () => close('cancel'));
    actions.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'xiro-modal-btn xiro-modal-btn-primary';
    confirmBtn.textContent = tr(confirmText || 'Aceptar');
    confirmBtn.addEventListener('click', attemptConfirm);
    actions.appendChild(confirmBtn);

    function attemptConfirm() {
        const value = input.value.trim();
        if (!value) {
            input.classList.add('is-invalid');
            input.focus();
            return;
        }
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
        if (typeof onConfirm === 'function') onConfirm(value);
    }

    function close(action) {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
        if (action === 'cancel' && typeof onCancel === 'function') onCancel();
    }

    input.addEventListener('input', () => input.classList.remove('is-invalid'));
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            attemptConfirm();
        }
    });

    function onKeyDown(event) {
        if (event.key === 'Escape') close('cancel');
    }

    overlay.addEventListener('click', (event) => {
        // Ver mismo comentario en modal.js: evita cierre por el click sintético
        // que en móviles puede generar el tap que abrió el modal.
        if (Date.now() - openedAt < 400) return;
        if (event.target === overlay) close('cancel');
    });

    document.addEventListener('keydown', onKeyDown);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 50);
}

export function mostrarModalInput(titulo, mensaje, opciones = {}) {
    buildInputModal({
        title: titulo,
        message: mensaje,
        type: opciones.tipo || 'info',
        placeholder: opciones.placeholder,
        initialValue: opciones.valorInicial,
        confirmText: opciones.textoConfirm,
        cancelText: opciones.textoCancelar,
        onConfirm: opciones.onConfirm,
        onCancel: opciones.onCancel
    });
}
