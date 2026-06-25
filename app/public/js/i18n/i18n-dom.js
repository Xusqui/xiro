(function (global) {
    'use strict';

    const textBaseMap = new WeakMap();
    const attrBaseMap = new WeakMap();
    let observer = null;
    let titleBase = null;

    function i18n() { return global.XiroI18n || null; }
    function t(key, fallback) {
        const api = i18n();
        return api ? api.t(key, null, fallback || key) : (fallback || key);
    }
    function translate(text) {
        const api = i18n();
        const source = String(text ?? '');
        return api ? api.tSmart(source, null, source) : source;
    }

    function getAttrBase(element, attrName, currentValue) {
        if (!attrBaseMap.has(element)) attrBaseMap.set(element, {});
        const bucket = attrBaseMap.get(element);
        if (!Object.prototype.hasOwnProperty.call(bucket, attrName)) bucket[attrName] = currentValue;
        return bucket[attrName];
    }

    function translateElementAttributes(element) {
        const attrMap = [
            ['placeholder', 'i18nPlaceholder'],
            ['title', 'i18nTitle'],
            ['aria-label', 'i18nAriaLabel'],
            ['value', 'i18nValue']
        ];

        if (element.dataset.i18n) element.textContent = t(element.dataset.i18n, element.textContent || '');
        if (element.dataset.i18nHtml) element.innerHTML = t(element.dataset.i18nHtml, element.innerHTML || '');

        attrMap.forEach(([attrName, dataKey]) => {
            const explicitKey = element.dataset[dataKey];
            const current = element.getAttribute(attrName);
            if (!explicitKey && current == null) return;
            const base = getAttrBase(element, attrName, current || '');
            const translated = explicitKey ? t(explicitKey, base) : translate(base);
            if (translated !== current) element.setAttribute(attrName, translated);
        });
    }

    function translateTextNode(node) {
        if (!node || node.nodeType !== 3) return;
        const parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(parent.tagName)) return;
        if (parent.closest('[data-i18n-skip="true"]')) return;

        const current = node.nodeValue || '';
        if (!current.trim()) return;
        const base = textBaseMap.has(node) ? textBaseMap.get(node) : current;
        if (!textBaseMap.has(node)) textBaseMap.set(node, base);

        const translated = translate(base);
        if (translated !== current) node.nodeValue = translated;
    }

    function translateRoot(root) {
        if (!root) return;
        if (root.nodeType === 1) translateElementAttributes(root);

        if (root.querySelectorAll) {
            root.querySelectorAll('[data-i18n],[data-i18n-html],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label],[data-i18n-value]')
                .forEach(translateElementAttributes);
        }

        if (root.nodeType === 3) {
            translateTextNode(root);
            return;
        }

        if (!document.createTreeWalker) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) translateTextNode(node);
    }

    function refreshDocumentLanguage() {
        const api = i18n();
        if (document.documentElement && api) document.documentElement.lang = api.getLanguage();
        if (titleBase == null) titleBase = document.title || '';
        document.title = translate(titleBase);
    }

    function refreshDomTranslations() {
        refreshDocumentLanguage();
        if (document.head) translateRoot(document.head);
        if (document.body) translateRoot(document.body);
    }

    function startObserver() {
        if (observer || !document.body || typeof MutationObserver === 'undefined') return;
        observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'characterData') {
                    translateTextNode(mutation.target);
                    return;
                }
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 || node.nodeType === 3) translateRoot(node);
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    function init() {
        // Esperar a que el diccionario esté listo antes del primer render para
        // evitar que los elementos data-i18n muestren "..." mientras cargan los JSON.
        const api = global.XiroI18n;
        if (api && typeof api.init === 'function') {
            api.init().then(function () {
                refreshDomTranslations();
                startObserver();
            });
        } else {
            refreshDomTranslations();
            startObserver();
        }
    }

    global.addEventListener('xiro:language-changed', refreshDomTranslations);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    global.XiroI18nDom = { refresh: refreshDomTranslations };
})(window);
