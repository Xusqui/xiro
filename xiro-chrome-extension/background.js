const TARGET_PATH = '/presentador.html';

// Detecta cuando una pestaña navega a presentador.html
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'loading') return;
    if (!changeInfo.url) return;

    let url;
    try {
        url = new URL(changeInfo.url);
    } catch {
        return;
    }

    if (url.pathname !== TARGET_PATH) return;

    // Busca si ya hay otra pestaña con presentador.html
    chrome.tabs.query({}, (allTabs) => {
        const existing = allTabs.find(
            (t) => t.id !== tabId && isPresenterTab(t.url)
        );

        if (existing) {
            // Reutiliza la pestaña existente: navega allí y cierra la nueva
            chrome.tabs.update(existing.id, { url: changeInfo.url, active: true });
            chrome.windows.update(existing.windowId, { focused: true });
            chrome.tabs.remove(tabId);
        }
        // Si no existe ninguna, dejamos que esta nueva pestaña sea la del presentador
    });
});

function isPresenterTab(tabUrl) {
    if (!tabUrl) return false;
    try {
        const u = new URL(tabUrl);
        return u.pathname === TARGET_PATH || u.pathname === '/ppt-redirect.html';
    } catch {
        return false;
    }
}
