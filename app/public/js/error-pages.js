(function () {
    'use strict';

    document.addEventListener('click', function (event) {
        const actionEl = event.target.closest('[data-error-action]');
        if (!actionEl) return;

        const action = actionEl.getAttribute('data-error-action');
        if (action === 'go-back') {
            window.history.back();
            return;
        }
        if (action === 'reload') {
            window.location.reload();
        }
    });
})();
