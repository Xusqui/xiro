(function () {
    'use strict';

    const prefetchedUrls = new Set();
    const preloadedModules = new Set();

    function canUseSpeculativeLoading() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!connection) return true;

        if (connection.saveData) return false;

        const type = String(connection.effectiveType || '').toLowerCase();
        if (type.indexOf('2g') !== -1) return false;
        if (type.indexOf('3g') !== -1) return false;

        return true;
    }

    function appendHint(rel, href, asType) {
        if (!href) return;

        const link = document.createElement('link');
        link.rel = rel;
        link.href = href;
        if (asType) link.as = asType;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    }

    function prefetchPage(url) {
        if (!url || prefetchedUrls.has(url)) return;
        prefetchedUrls.add(url);

        // Best effort: if prefetch is not supported, the browser simply ignores it.
        appendHint('prefetch', url, 'document');
    }

    function preloadModule(url) {
        if (!url || preloadedModules.has(url)) return;
        preloadedModules.add(url);

        // modulepreload helps avoid import waterfall when navigating to ESM-heavy pages.
        appendHint('modulepreload', url, 'script');
    }

    function setupSmartPrefetch(config) {
        if (!config || !config.selector) return;
        if (!canUseSpeculativeLoading()) return;

        const target = document.querySelector(config.selector);
        if (!target) return;

        const pageUrl = config.pageUrl || target.getAttribute('href');
        const moduleUrls = Array.isArray(config.moduleUrls) ? config.moduleUrls : [];
        const hoverDelayMs = Number(config.hoverDelayMs || 120);

        let hoverTimer = null;
        let activated = false;

        function runLightWarmup() {
            if (activated) return;
            prefetchPage(pageUrl);
        }

        function runHeavyWarmup() {
            if (activated) return;
            activated = true;
            prefetchPage(pageUrl);
            moduleUrls.forEach(preloadModule);
        }

        function onPointerEnter() {
            runLightWarmup();
            clearTimeout(hoverTimer);
            hoverTimer = window.setTimeout(runHeavyWarmup, hoverDelayMs);
        }

        function onPointerLeave() {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }

        function onFocus() {
            runLightWarmup();
            runHeavyWarmup();
        }

        function onTouchStart() {
            runLightWarmup();
            runHeavyWarmup();
        }

        target.addEventListener('mouseenter', onPointerEnter, { passive: true });
        target.addEventListener('mouseleave', onPointerLeave, { passive: true });
        target.addEventListener('focusin', onFocus, { passive: true });
        target.addEventListener('touchstart', onTouchStart, { passive: true, once: true });

        // Optional viewport hint: small warmup when card is visible and user is likely to click.
        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        runLightWarmup();
                        observer.disconnect();
                    }
                });
            }, { rootMargin: '120px' });
            observer.observe(target);
        }
    }

    window.setupSmartPrefetch = setupSmartPrefetch;
})();
