(function initUmami() {
    'use strict';

    function injectScript(serverUrl, websiteId) {
        if (!serverUrl || !websiteId) return;
        const script = document.createElement('script');
        script.defer = true;
        script.src = serverUrl;
        script.setAttribute('data-website-id', websiteId);
        document.head.appendChild(script);
    }

    // Try to get from sessionStorage to avoid fetch on every page load
    const cachedConfig = sessionStorage.getItem('xiro_umami_config');
    if (cachedConfig) {
        try {
            const data = JSON.parse(cachedConfig);
            injectScript(data.umamiServerUrl, data.umamiWebsiteId);
            return;
        } catch (e) {
            // Error parsing cached data, fallback to fetch
        }
    }

    // fetch public UI settings
    fetch('/api/ui-settings')
        .then(res => {
            if (!res.ok) throw new Error('ui-settings fetch failed');
            return res.json();
        })
        .then(data => {
            if (data && data.umamiServerUrl && data.umamiWebsiteId) {
                sessionStorage.setItem('xiro_umami_config', JSON.stringify({
                    umamiServerUrl: data.umamiServerUrl,
                    umamiWebsiteId: data.umamiWebsiteId
                }));
                injectScript(data.umamiServerUrl, data.umamiWebsiteId);
            }
        })
        .catch(() => {
            // Ignorar errores silenciosamente para no asustar a los usuarios si hay un adblocker o falla la red
        });
})();
