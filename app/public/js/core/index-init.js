(function () {
    'use strict';

    // Chrome 38 / WebOS 3.5 (TVs antiguas objetivo, ver README) no soportan CSS
    // Grid ni backdrop-filter; los usamos como proxy de "dispositivo antiguo".
    function _isOldDevice() {
        if (!window.CSS || typeof CSS.supports !== 'function') return true;
        var hasGrid = CSS.supports('display', 'grid');
        var hasBackdropFilter = CSS.supports('backdrop-filter', 'blur(1px)') ||
            CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
        return !hasGrid || !hasBackdropFilter;
    }

    function _shouldShowTvCard(mode) {
        if (mode === 'old_devices_only') return _isOldDevice();
        return mode !== 'never';
    }

    function _applyUiSettings(s) {
        var cardTv = document.getElementById('card-tv');
        if (cardTv) cardTv.style.display = _shouldShowTvCard(s.tvCardMode) ? '' : 'none';

        var cardStandalone = document.getElementById('card-standalone');
        if (cardStandalone) cardStandalone.style.display = (s.showStandaloneCard === false) ? 'none' : '';
    }

    function _pollUiSettings() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/ui-settings', true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                try {
                    var r = JSON.parse(xhr.responseText);
                    _applyUiSettings(r);
                } catch (e) { }
            }
        };
        xhr.send();
    }

    _pollUiSettings();
    setInterval(_pollUiSettings, 3000);

    // Ambient background gradient is a nonessential loop; stop it while the tab is hidden.
    document.addEventListener('visibilitychange', function () {
        document.documentElement.classList.toggle('xiro-tab-hidden', document.hidden);
    });

    // Manual links live inside the big card <a>, so we cancel the card
    // navigation (capture phase) and route to the manual page instead.
    document.addEventListener('click', function (event) {
        var manualLink = event.target.closest('[data-index-manual-target]');
        if (!manualLink) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        var target = manualLink.getAttribute('data-index-manual-target');
        if (target) window.location.href = target;
    }, true);

    if (typeof setupSmartPrefetch === 'function') {
        setupSmartPrefetch({
            selector: '#card-presenter',
            pageUrl: './presentador.html',
            moduleUrls: ['/js/presenter/presenter-main.js?v=20260615-130507'],
            hoverDelayMs: 140
        });
    }
})();
