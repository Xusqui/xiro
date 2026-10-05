(function initAppVersion() {
    'use strict';

    // Pinta la versión en ejecución (GET /api/version) en cada .xiro-app-version del footer.
    let ENDPOINT = '/api/version';

    function _render(version) {
        let targets = document.querySelectorAll('.xiro-app-version');
        for (let i = 0; i < targets.length; i++) {
            targets[i].textContent = ' · v' + version;
        }
    }

    function _load() {
        if (!document.querySelector('.xiro-app-version')) return;

        let xhr = new XMLHttpRequest();
        xhr.open('GET', ENDPOINT, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4 || xhr.status !== 200) return;
            try {
                let payload = JSON.parse(xhr.responseText);
                if (payload && typeof payload.version === 'string' && payload.version) {
                    _render(payload.version);
                }
            } catch (_error) {
                // Respuesta no válida: el footer se queda sin versión.
            }
        };
        xhr.send();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _load);
    } else {
        _load();
    }
})();
