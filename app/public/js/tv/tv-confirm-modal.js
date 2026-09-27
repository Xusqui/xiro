window.TVApp = window.TVApp || {};
/**
 * Modal de confirmación de la TV (finalizar / abortar partida).
 * Construido con DOM y estilos inline: tv.html no carga Tailwind de presentador.
 */
window.TVApp.ConfirmModal = (function () {
    'use strict';

    function showConfirmModal(title, message, onConfirm) {
        const existing = document.getElementById('xiro-tv-confirm-modal');
        if (existing) existing.parentNode.removeChild(existing);

        const overlay = document.createElement('div');
        overlay.id = 'xiro-tv-confirm-modal';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.75)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '10000';

        const modal = document.createElement('div');
        modal.style.background = '#ffffff';
        modal.style.borderRadius = '14px';
        modal.style.maxWidth = '380px';
        modal.style.width = '90%';
        modal.style.padding = '24px 20px';
        modal.style.fontFamily = 'Arial, sans-serif';
        modal.style.boxShadow = '0 16px 40px rgba(0,0,0,0.4)';

        const titleEl = document.createElement('div');
        titleEl.textContent = _t(title);
        titleEl.style.fontSize = '18px';
        titleEl.style.fontWeight = '800';
        titleEl.style.marginBottom = '10px';

        const msgEl = document.createElement('div');
        msgEl.textContent = _t(message);
        msgEl.style.fontSize = '14px';
        msgEl.style.lineHeight = '1.5';
        msgEl.style.color = '#444';

        const actions = document.createElement('div');
        actions.style.marginTop = '20px';
        actions.style.display = 'flex';
        actions.style.justifyContent = 'flex-end';

        const btnCancel = document.createElement('button');
        btnCancel.textContent = _t('tv.game.cancel', null, 'Cancelar');
        btnCancel.style.padding = '9px 18px';
        btnCancel.style.background = '#e5e7eb';
        btnCancel.style.color = '#333';
        btnCancel.style.border = 'none';
        btnCancel.style.borderRadius = '999px';
        btnCancel.style.fontWeight = '700';
        btnCancel.style.cursor = 'pointer';
        btnCancel.style.fontSize = '13px';
        btnCancel.onclick = function () {
            overlay.parentNode.removeChild(overlay);
        };

        const btnConfirm = document.createElement('button');
        btnConfirm.textContent = _t('tv.game.confirm', null, 'Confirmar');
        btnConfirm.style.marginLeft = '10px';
        btnConfirm.style.padding = '9px 18px';
        btnConfirm.style.background = '#dc2626';
        btnConfirm.style.color = '#ffffff';
        btnConfirm.style.border = 'none';
        btnConfirm.style.borderRadius = '999px';
        btnConfirm.style.fontWeight = '700';
        btnConfirm.style.cursor = 'pointer';
        btnConfirm.style.fontSize = '13px';
        btnConfirm.onclick = function () {
            overlay.parentNode.removeChild(overlay);
            onConfirm();
        };

        actions.appendChild(btnCancel);
        actions.appendChild(btnConfirm);
        modal.appendChild(titleEl);
        modal.appendChild(msgEl);
        modal.appendChild(actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    return {
        show: showConfirmModal
    };
})();
