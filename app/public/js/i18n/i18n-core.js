(function (global) {
    'use strict';

    const CONFIG = {
        defaultLanguage: 'es',
        supported: ['es', 'en', 'fr', 'ca', 'eu', 'gl', 'de', 'pt', 'zh', 'ja'],
        storageKey: 'xiro_lang',
        queryParam: 'lang',
        version: '20260918004156'
    };

    const state = {
        language: CONFIG.defaultLanguage,
        dictionary: { keys: {}, literals: {}, patterns: [] },
        readyPromise: null,
        explicitSections: null,
        dynamicSections: new Set()
    };

    const rootDictionaryCache = new Map();
    const pageDictionaryCache = new Map();

    const TRANSLATABLE_HTML_ATTRS = ['placeholder', 'title', 'aria-label'];
    const NON_TRANSLATABLE_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
    let internalHtmlSetDepth = 0;

    function normalizeLanguage(value) {
        const short = String(value || '').trim().toLowerCase().split('-')[0];
        return CONFIG.supported.includes(short) ? short : CONFIG.defaultLanguage;
    }

    function getStoredLanguage() {
        try { return localStorage.getItem(CONFIG.storageKey); } catch (_) { return null; }
    }

    function setStoredLanguage(language) {
        try { localStorage.setItem(CONFIG.storageKey, language); } catch (_) { }
    }

    function getQueryLanguage() {
        try { return new URLSearchParams(global.location.search || '').get(CONFIG.queryParam); }
        catch (_) { return null; }
    }

    function detectInitialLanguage() {
        return normalizeLanguage(getQueryLanguage() || getStoredLanguage() || global.navigator?.language);
    }

    function normalizeSection(value) {
        return String(value || '').trim().toLowerCase().replace(/-/g, '_');
    }

    function parseSections(input) {
        if (!input) return new Set();
        const raw = Array.isArray(input) ? input : String(input).split(',');
        const out = new Set();

        raw.forEach((entry) => {
            const section = normalizeSection(entry);
            if (!section) return;
            out.add(section);
        });

        return out;
    }

    function readSectionsFromDom() {
        if (typeof document === 'undefined') return new Set();

        const fromGlobal = parseSections(global.__xiroI18nSections);
        if (fromGlobal.size) return fromGlobal;

        const meta = document.querySelector('meta[name="xiro-i18n-sections"]');
        if (meta?.content) {
            const fromMeta = parseSections(meta.content);
            if (fromMeta.size) return fromMeta;
        }

        const htmlAttr = document.documentElement?.dataset?.i18nSections;
        if (htmlAttr) {
            const fromHtml = parseSections(htmlAttr);
            if (fromHtml.size) return fromHtml;
        }

        const bodyAttr = document.body?.dataset?.i18nSections;
        if (bodyAttr) {
            const fromBody = parseSections(bodyAttr);
            if (fromBody.size) return fromBody;
        }

        return new Set();
    }

    function normalizePathname(pathname) {
        const value = String(pathname || '/').trim().toLowerCase();
        if (!value) return '/';
        return value.startsWith('/') ? value : `/${value}`;
    }

    function detectPageSection(pathname) {
        const normalized = normalizePathname(pathname).replace(/\/+$/, '');
        if (!normalized || normalized === '/') return 'index';
        const pieces = normalized.split('/').filter(Boolean);
        const last = pieces[pieces.length - 1] || 'index';
        return last.replace(/\.html$/, '').replace(/-/g, '_') || 'index';
    }

    function getPageSections(pathname) {
        const normalized = normalizePathname(pathname);
        const section = detectPageSection(normalized);
        const sections = new Set(['common']);

        if (section) sections.add(section);

        if (section === 'presentador') {
            sections.add('presenter');
            sections.add('presenter_main');
            sections.add('presenter_lobby');
        }

        if (section === 'jugador') {
            sections.add('player');
            sections.add('player_main');
        }

        if (section === 'admin') {
            sections.add('admin');
            sections.add('admin_main');
        }

        if (normalized.startsWith('/error/')) {
            sections.add('error_pages');
        }

        if (normalized.includes('/ppt-addin/taskpane.html')) {
            sections.add('ppt_taskpane');
        }

        if (section.startsWith('manual')) {
            sections.add('manual_shells');
        }

        if (section === 'manual_admin') {
            const toolTabs = ['partidas', 'puntuacion', 'logging', 'conexion', 'backup', 'licencia', 'correo', 'equipos', 'fuegos', 'interfaz', 'ia', 'historial', 'botrunner', 'mantenimiento'];
            toolTabs.forEach(t => sections.add('manual_admin_tools_' + t));
        }


        if (section === 'manual_jugador') {
            sections.add('manual_jugador');
        }

        if (section === 'manual_admin') {
            sections.add('manual_admin');
        }

        return sections;
    }

    function getIncludeSection(includePath, code) {
        const resolved = resolveIncludePath(includePath);
        if (!resolved) return null;
        const fileName = resolved.split('/').pop() || '';
        const prefix = `language_${code}_`;
        if (!fileName.startsWith(prefix) || !fileName.endsWith('.json')) return null;
        return fileName.slice(prefix.length, -5).toLowerCase();
    }

    function isSectionEnabled(section, activeSections) {
        const normalized = normalizeSection(section);
        if (!normalized) return false;
        if (activeSections.has(normalized)) return true;
        const group = normalized.split('_')[0];
        return activeSections.has(group);
    }

    function resolveActiveSections(pathname) {
        const domConfigured = readSectionsFromDom();
        const base = state.explicitSections && state.explicitSections.size
            ? state.explicitSections
            : (domConfigured.size ? domConfigured : getPageSections(pathname));

        const sections = new Set(base);
        sections.add('common');
        state.dynamicSections.forEach((section) => sections.add(section));
        return sections;
    }

    function selectIncludesForPage(includes, code, sections) {
        const selected = (includes || []).filter((includePath) => {
            const section = getIncludeSection(includePath, code);
            if (!section) return true;
            return isSectionEnabled(section, sections);
        });

        return { selected, sections };
    }

    function getPageCacheKey(code, sections) {
        return `${code}|${Array.from(sections).sort().join(',')}`;
    }

    async function fetchJson(url) {
        const separator = url.includes('?') ? '&' : '?';
        // Cache aggressively per version; bump CONFIG.version to invalidate.
        const response = await fetch(`${url}${separator}v=${CONFIG.version}`, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Dictionary request failed: ${url}`);
        return response.json();
    }

    function mergeDictionary(target, source) {
        if (!source || typeof source !== 'object') return;
        Object.assign(target.keys, source.keys || {});
        Object.assign(target.literals, source.literals || {});
        if (Array.isArray(source.patterns)) target.patterns.push(...source.patterns);
    }

    function resolveIncludePath(includePath) {
        if (typeof includePath !== 'string') return null;
        if (includePath.startsWith('/')) return includePath;
        return `/js/i18n/${includePath.replace(/^\/+/, '')}`;
    }

    async function loadDictionary(language) {
        const code = normalizeLanguage(language);
        let root = rootDictionaryCache.get(code);
        if (!root) {
            root = await fetchJson(`/js/i18n/${code}/language_${code}.json`);
            rootDictionaryCache.set(code, root);
        }

        const merged = { keys: {}, literals: {}, patterns: [] };

        const includes = Array.isArray(root.includes) ? root.includes : [];
        const sections = resolveActiveSections(global.location.pathname);
        const { selected } = selectIncludesForPage(includes, code, sections);
        const pageCacheKey = getPageCacheKey(code, sections);

        if (pageDictionaryCache.has(pageCacheKey)) {
            return pageDictionaryCache.get(pageCacheKey);
        }

        const includeParts = await Promise.all(selected.map(async (includePath) => {
            const resolved = resolveIncludePath(includePath);
            if (!resolved) return null;

            try {
                return await fetchJson(resolved);
            } catch (error) {
                console.warn('[i18n] include skipped', resolved, error?.message || error);
                return null;
            }
        }));

        includeParts.forEach((part) => mergeDictionary(merged, part));

        mergeDictionary(merged, root);
        pageDictionaryCache.set(pageCacheKey, merged);
        return merged;
    }

    function clearDictionaryCaches() {
        pageDictionaryCache.clear();
    }

    function setSections(sections, options) {
        const opts = options || {};
        const parsed = parseSections(sections);
        state.explicitSections = parsed.size ? parsed : null;
        clearDictionaryCaches();

        if (opts.reload && state.readyPromise) {
            return setLanguage(state.language, false);
        }

        return Promise.resolve(state.language);
    }

    function addSections(sections, options) {
        const opts = options || {};
        const parsed = parseSections(sections);
        let changed = false;

        parsed.forEach((section) => {
            if (state.dynamicSections.has(section)) return;
            state.dynamicSections.add(section);
            changed = true;
        });

        if (changed) {
            clearDictionaryCaches();
            if (opts.reload && state.readyPromise) {
                return setLanguage(state.language, false);
            }
        }

        return Promise.resolve(state.language);
    }

    function getSections() {
        const base = state.explicitSections && state.explicitSections.size
            ? state.explicitSections
            : readSectionsFromDom();
        const sections = new Set(base);
        if (!sections.size) {
            resolveActiveSections(global.location.pathname).forEach((section) => sections.add(section));
        }
        state.dynamicSections.forEach((section) => sections.add(section));
        return Array.from(sections).sort();
    }

    function interpolate(template, vars) {
        if (!vars || typeof vars !== 'object') return String(template || '');
        return String(template || '').replace(/\{(\w+)\}/g, (_, key) => {
            return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`;
        });
    }

    function keyValue(key, fallbackValue) {
        const raw = Object.prototype.hasOwnProperty.call(state.dictionary.keys, key)
            ? state.dictionary.keys[key]
            : fallbackValue;
        return raw == null ? '' : String(raw);
    }

    function translateLiteralExact(text) {
        const normalized = String(text || '');
        if (Object.prototype.hasOwnProperty.call(state.dictionary.literals, normalized)) {
            return state.dictionary.literals[normalized];
        }

        for (let i = 0; i < state.dictionary.patterns.length; i += 1) {
            const pattern = state.dictionary.patterns[i];
            try {
                const regex = new RegExp(pattern.from, pattern.flags || '');
                if (regex.test(normalized)) {
                    return normalized.replace(regex, pattern.to);
                }
            } catch (_) { }
        }

        return normalized;
    }

    function translateLiteral(text) {
        const original = String(text ?? '');
        if (!original.trim()) return original;
        const leading = (original.match(/^\s*/) || [''])[0];
        const trailing = (original.match(/\s*$/) || [''])[0];
        return `${leading}${translateLiteralExact(original.trim())}${trailing}`;
    }

    function hasKey(key) {
        return Object.prototype.hasOwnProperty.call(state.dictionary.keys, String(key || ''));
    }

    function t(key, vars, fallbackValue) {
        return interpolate(keyValue(key, fallbackValue || key), vars);
    }

    function tSmart(key, vars, fallbackValue) {
        const resolvedKey = String(key || '');
        if (hasKey(resolvedKey)) {
            return t(resolvedKey, vars, fallbackValue || resolvedKey);
        }

        const literal = fallbackValue != null ? String(fallbackValue) : resolvedKey;
        return __(literal, vars, literal);
    }

    function __(input, vars, fallbackValue) {
        if (typeof input !== 'string') return input;
        const byKey = keyValue(input, null);
        if (byKey) return interpolate(byKey, vars);
        return interpolate(translateLiteral(input), vars) || fallbackValue || input;
    }

    function translateTextNodeValue(value) {
        const original = String(value ?? '');
        if (!original.trim()) return original;

        const leading = (original.match(/^\s*/) || [''])[0];
        const trailing = (original.match(/\s*$/) || [''])[0];
        const core = original.trim();

        return `${leading}${tSmart(core, null, core)}${trailing}`;
    }

    function shouldTranslateTag(tagName) {
        return !NON_TRANSLATABLE_TAGS.has(String(tagName || '').toUpperCase());
    }

    function tHtml(html) {
        if (typeof html !== 'string') return html;
        if (typeof document === 'undefined') return html;
        if (!html.trim()) return html;

        const tpl = document.createElement('template');
        internalHtmlSetDepth += 1;
        try {
            tpl.innerHTML = html;
        } finally {
            internalHtmlSetDepth -= 1;
        }

        const textWalker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT, null);
        let node = textWalker.nextNode();
        while (node) {
            const parentTag = node.parentElement?.tagName;
            if (shouldTranslateTag(parentTag)) {
                node.textContent = translateTextNodeValue(node.textContent || '');
            }
            node = textWalker.nextNode();
        }

        const elements = tpl.content.querySelectorAll('*');
        elements.forEach((el) => {
            if (!shouldTranslateTag(el.tagName)) return;

            TRANSLATABLE_HTML_ATTRS.forEach((attrName) => {
                if (!el.hasAttribute(attrName)) return;
                const attrValue = el.getAttribute(attrName) || '';
                if (!attrValue.trim()) return;
                el.setAttribute(attrName, tSmart(attrValue, null, attrValue));
            });
        });

        return tpl.innerHTML;
    }

    function tHtmlApply(value, targetElement) {
        if (typeof value !== 'string') return value;
        if (!shouldTranslateTag(targetElement?.tagName)) return value;
        return tHtml(value);
    }

    function shouldTranslateTextTarget(target) {
        if (!target || typeof target !== 'object') return false;

        if (target.nodeType === 3) {
            const parentTag = target.parentElement?.tagName;
            if (!shouldTranslateTag(parentTag)) return false;
            if (target.parentElement?.closest?.('[data-i18n-skip="true"]')) return false;
            return true;
        }

        if (target.nodeType === 1) {
            if (!shouldTranslateTag(target.tagName)) return false;
            if (target.closest?.('[data-i18n-skip="true"]')) return false;
            return true;
        }

        if (target.nodeType === 9) {
            return true;
        }

        return false;
    }

    function tTextApply(value, target) {
        if (typeof value !== 'string') return value;
        if (!shouldTranslateTextTarget(target)) return value;
        return translateTextNodeValue(value);
    }

    function tAttributeApply(name, value) {
        if (typeof value !== 'string') return value;
        const attrName = String(name || '').toLowerCase();
        if (!TRANSLATABLE_HTML_ATTRS.includes(attrName)) return value;
        if (!value.trim()) return value;
        return tSmart(value, null, value);
    }

    function patchHtmlInjectionPoints() {
        if (typeof Element === 'undefined') return;

        const proto = Element.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'innerHTML');

        if (descriptor && typeof descriptor.set === 'function' && !descriptor.set.__xiroI18nPatched) {
            const nativeSet = descriptor.set;
            const nativeGet = descriptor.get;

            const patchedSet = function patchedInnerHTML(value) {
                if (internalHtmlSetDepth > 0) {
                    return nativeSet.call(this, value);
                }
                return nativeSet.call(this, tHtmlApply(value, this));
            };
            patchedSet.__xiroI18nPatched = true;

            Object.defineProperty(proto, 'innerHTML', {
                configurable: descriptor.configurable,
                enumerable: descriptor.enumerable,
                get: nativeGet,
                set: patchedSet
            });
        }

        if (typeof proto.insertAdjacentHTML === 'function' && !proto.insertAdjacentHTML.__xiroI18nPatched) {
            const nativeInsertAdjacentHTML = proto.insertAdjacentHTML;

            const patchedInsertAdjacentHTML = function patchedIAH(position, text) {
                return nativeInsertAdjacentHTML.call(this, position, tHtmlApply(text, this));
            };

            patchedInsertAdjacentHTML.__xiroI18nPatched = true;
            proto.insertAdjacentHTML = patchedInsertAdjacentHTML;
        }

        if (typeof proto.insertAdjacentText === 'function' && !proto.insertAdjacentText.__xiroI18nPatched) {
            const nativeInsertAdjacentText = proto.insertAdjacentText;

            const patchedInsertAdjacentText = function patchedIAT(position, text) {
                return nativeInsertAdjacentText.call(this, position, tTextApply(text, this));
            };

            patchedInsertAdjacentText.__xiroI18nPatched = true;
            proto.insertAdjacentText = patchedInsertAdjacentText;
        }

        if (typeof proto.setAttribute === 'function' && !proto.setAttribute.__xiroI18nPatched) {
            const nativeSetAttribute = proto.setAttribute;

            const patchedSetAttribute = function patchedSetAttribute(name, value) {
                return nativeSetAttribute.call(this, name, tAttributeApply(name, value));
            };

            patchedSetAttribute.__xiroI18nPatched = true;
            proto.setAttribute = patchedSetAttribute;
        }

        const nodeProto = Node.prototype;
        const textContentDescriptor = Object.getOwnPropertyDescriptor(nodeProto, 'textContent');
        if (textContentDescriptor && typeof textContentDescriptor.set === 'function' && !textContentDescriptor.set.__xiroI18nPatched) {
            const nativeSetTextContent = textContentDescriptor.set;
            const nativeGetTextContent = textContentDescriptor.get;

            const patchedSetTextContent = function patchedTextContent(value) {
                return nativeSetTextContent.call(this, tTextApply(value, this));
            };

            patchedSetTextContent.__xiroI18nPatched = true;

            Object.defineProperty(nodeProto, 'textContent', {
                configurable: textContentDescriptor.configurable,
                enumerable: textContentDescriptor.enumerable,
                get: nativeGetTextContent,
                set: patchedSetTextContent
            });
        }

        const nodeValueDescriptor = Object.getOwnPropertyDescriptor(nodeProto, 'nodeValue');
        if (nodeValueDescriptor && typeof nodeValueDescriptor.set === 'function' && !nodeValueDescriptor.set.__xiroI18nPatched) {
            const nativeSetNodeValue = nodeValueDescriptor.set;
            const nativeGetNodeValue = nodeValueDescriptor.get;

            const patchedSetNodeValue = function patchedNodeValue(value) {
                if (this.nodeType !== 3) return nativeSetNodeValue.call(this, value);
                return nativeSetNodeValue.call(this, tTextApply(value, this));
            };

            patchedSetNodeValue.__xiroI18nPatched = true;

            Object.defineProperty(nodeProto, 'nodeValue', {
                configurable: nodeValueDescriptor.configurable,
                enumerable: nodeValueDescriptor.enumerable,
                get: nativeGetNodeValue,
                set: patchedSetNodeValue
            });
        }

        if (typeof HTMLElement !== 'undefined') {
            const innerTextDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText');
            if (innerTextDescriptor && typeof innerTextDescriptor.set === 'function' && !innerTextDescriptor.set.__xiroI18nPatched) {
                const nativeSetInnerText = innerTextDescriptor.set;
                const nativeGetInnerText = innerTextDescriptor.get;

                const patchedSetInnerText = function patchedInnerText(value) {
                    return nativeSetInnerText.call(this, tTextApply(value, this));
                };

                patchedSetInnerText.__xiroI18nPatched = true;

                Object.defineProperty(HTMLElement.prototype, 'innerText', {
                    configurable: innerTextDescriptor.configurable,
                    enumerable: innerTextDescriptor.enumerable,
                    get: nativeGetInnerText,
                    set: patchedSetInnerText
                });
            }
        }

        if (typeof Document !== 'undefined') {
            const titleDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
            if (titleDescriptor && typeof titleDescriptor.set === 'function' && !titleDescriptor.set.__xiroI18nPatched) {
                const nativeSetTitle = titleDescriptor.set;
                const nativeGetTitle = titleDescriptor.get;

                const patchedSetTitle = function patchedTitle(value) {
                    return nativeSetTitle.call(this, tTextApply(value, this));
                };

                patchedSetTitle.__xiroI18nPatched = true;

                Object.defineProperty(Document.prototype, 'title', {
                    configurable: titleDescriptor.configurable,
                    enumerable: titleDescriptor.enumerable,
                    get: nativeGetTitle,
                    set: patchedSetTitle
                });
            }
        }
    }

    async function setLanguage(language, persist) {
        const requested = normalizeLanguage(language);
        let effective = requested;
        let dictionary;

        try {
            dictionary = await loadDictionary(requested);
        } catch (_) {
            effective = CONFIG.defaultLanguage;
            dictionary = await loadDictionary(effective);
        }

        state.language = effective;
        state.dictionary = dictionary;

        if (persist) setStoredLanguage(state.language);

        global.dispatchEvent(new CustomEvent('xiro:language-changed', { detail: { language: state.language } }));
        return state.language;
    }

    async function init() {
        if (state.readyPromise) return state.readyPromise;
        state.readyPromise = setLanguage(detectInitialLanguage(), true);
        return state.readyPromise;
    }

    patchHtmlInjectionPoints();

    global.XiroI18n = {
        init,
        t,
        tSmart,
        tHtml,
        tHtmlApply,
        __,
        setLanguage,
        setSections,
        addSections,
        getSections,
        getLanguage: () => state.language,
        getDictionary: () => state.dictionary,
        getSupportedLanguages: () => CONFIG.supported.slice(),
        translateLiteral
    };

    global._t = global._t || ((key, vars, fallbackValue) => global.XiroI18n.tSmart(key, vars, fallbackValue));
    global._tHtml = global._tHtml || ((html) => global.XiroI18n.tHtml(html));
    global._tHtmlApply = global._tHtmlApply || ((value, targetElement) => global.XiroI18n.tHtmlApply(value, targetElement));
    global.__ = (input, vars, fallbackValue) => global.XiroI18n.__(input, vars, fallbackValue);
    void init();
})(window);
