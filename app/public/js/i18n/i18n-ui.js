(function (global) {
    'use strict';

    let dialogsPatched = false;
    let customSwitcher = null;

    const LANGUAGE_FLAGS = {
        es: '/images/flags/es.svg',
        en: '/images/flags/en.svg',
        fr: '/images/flags/fr.svg',
        ca: '/images/flags/ca.svg',
        eu: '/images/flags/eu.svg',
        gl: '/images/flags/gl.svg',
        de: '/images/flags/de.svg',
        pt: '/images/flags/pt.svg',
        zh: '/images/flags/zh.svg',
        ja: '/images/flags/ja.svg'
    };

    const WRAPPER_CHROME_STYLE = 'z-index:10001;background:rgba(255,255,255,.74);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#0f172a;padding:8px 10px;border-radius:10px;border:1px solid rgba(148,163,184,.5);font:600 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;display:flex;gap:8px;align-items:center;box-shadow:0 8px 20px rgba(15,23,42,.15);';

    function i18n() { return global.XiroI18n || null; }
    function translate(text) {
        const api = i18n();
        return api ? api.translateLiteral(text || '') : String(text || '');
    }
    function t(key, fallback) {
        const api = i18n();
        return api ? api.t(key, null, fallback || key) : (fallback || key);
    }

    function languageName(code) {
        const normalized = String(code || '').trim().toLowerCase();
        return t(`language.${normalized}`, normalized.toUpperCase());
    }

    function languageOptionLabel(code) {
        const normalized = String(code || '').trim().toLowerCase();
        const flag = LANGUAGE_FLAGS[normalized] || '🏳️';
        const name = languageName(normalized);
        if (isSvgFlag(flag)) return name;
        return `${flag} ${name}`;
    }

    function isSvgFlag(value) {
        return typeof value === 'string' && /\.svg(?:$|[?#])/i.test(value);
    }

    function createFlagNode(code) {
        const normalized = String(code || '').trim().toLowerCase();
        const flag = LANGUAGE_FLAGS[normalized] || '🏳️';

        if (isSvgFlag(flag)) {
            const svgNode = document.createElement('img');
            svgNode.src = flag;
            svgNode.alt = '';
            svgNode.style.cssText = 'width:19px;height:14px;object-fit:cover;border-radius:2px;border:1px solid rgba(148,163,184,.55);background:rgba(255,255,255,.82);';
            return svgNode;
        }

        const emojiNode = document.createElement('span');
        emojiNode.style.cssText = 'display:inline-block;width:19px;text-align:center;font-size:13px;line-height:1;';
        emojiNode.textContent = flag;
        return emojiNode;
    }

    function ensureMenuMounted(menu) {
        if (menu.parentElement !== document.body) document.body.appendChild(menu);
    }

    /** Coloca el menú bajo el botón (o encima si no cabe) dentro del viewport. */
    function positionMenu(menu, trigger) {
        ensureMenuMounted(menu);
        const viewportHeight = global.innerHeight || document.documentElement.clientHeight || 0;
        const viewportWidth = global.innerWidth || document.documentElement.clientWidth || 0;
        const triggerRect = trigger.getBoundingClientRect();
        const spacing = 8;
        const widthLimit = Math.max(240, Math.min(420, viewportWidth - (spacing * 2)));

        menu.style.width = `${widthLimit}px`;

        const measuredWidth = Math.max(
            Math.min(Math.ceil(menu.getBoundingClientRect().width || widthLimit), widthLimit),
            Math.min(Math.ceil(triggerRect.width), widthLimit)
        );
        menu.style.width = `${measuredWidth}px`;

        const spaceBelow = Math.max(0, viewportHeight - triggerRect.bottom - spacing);
        const spaceAbove = Math.max(0, triggerRect.top - spacing);
        const preferredHeight = Math.min(menu.scrollHeight || 320, Math.max(120, viewportHeight - (spacing * 2)));
        const openUpwards = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
        const availableSpace = Math.max(0, Math.floor(openUpwards ? spaceAbove : spaceBelow));
        const maxHeight = Math.max(120, Math.min(preferredHeight, Math.max(120, availableSpace)));
        menu.style.maxHeight = `${maxHeight}px`;

        const leftMax = Math.max(spacing, viewportWidth - measuredWidth - spacing);
        const left = Math.min(leftMax, Math.max(spacing, Math.round(triggerRect.right - measuredWidth)));
        menu.style.left = `${left}px`;

        if (openUpwards) {
            const top = Math.max(spacing, Math.round(triggerRect.top - maxHeight - 4));
            menu.style.top = `${top}px`;
            menu.style.transformOrigin = 'bottom right';
            return;
        }

        const top = Math.min(
            Math.max(spacing, viewportHeight - maxHeight - spacing),
            Math.round(triggerRect.bottom + 4)
        );
        menu.style.top = `${top}px`;
        menu.style.transformOrigin = 'top right';
    }

    function getTileFlow(tile) {
        return tile.getAttribute('flow') === 'up' ? 'up' : 'down';
    }

    function setTileHiddenState(tile) {
        const flow = getTileFlow(tile);
        tile.style.opacity = '0';
        tile.style.transform = flow === 'up'
            ? 'translateY(14px) scale(.97)'
            : 'translateY(-14px) scale(.97)';
    }

    function setTileVisibleState(tile) {
        tile.style.opacity = '1';
        tile.style.transform = 'translateY(0) scale(1)';
    }

    function renderTrigger(trigger, select) {
        const selected = String(select.value || '').trim().toLowerCase();
        trigger.innerHTML = '';

        const left = document.createElement('span');
        left.style.cssText = 'display:inline-flex;align-items:center;gap:6px;min-width:0;';
        left.appendChild(createFlagNode(selected));

        const name = document.createElement('span');
        name.textContent = languageName(selected);
        name.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        left.appendChild(name);

        const caret = document.createElement('span');
        caret.textContent = '▾';
        caret.style.cssText = 'font-size:10px;opacity:.8;';

        trigger.appendChild(left);
        trigger.appendChild(caret);
    }

    /** Botón de un idioma en el menú; al pulsarlo cambia el select y llama a onPick. */
    function createMenuItem(select, option, flow, onPick) {
        const item = document.createElement('button');
        item.type = 'button';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', option.value === select.value ? 'true' : 'false');
        item.setAttribute('data-lang-item', '1');
        item.setAttribute('lang-selection', String(option.value || '').toUpperCase());
        item.setAttribute('tooltip', String(option.value || '').toUpperCase());
        item.setAttribute('flow', flow);
        item.title = String(option.value || '').toUpperCase();
        item.style.cssText = 'width:100%;display:flex;align-items:center;gap:8px;padding:8px;border:1px solid rgba(148,163,184,.35);background:rgba(255,255,255,.62);color:#0f172a;border-radius:8px;font:600 12px system-ui,-apple-system,Segoe UI,sans-serif;text-align:left;cursor:pointer;min-width:0;';

        if (option.value === select.value) {
            item.style.background = 'rgba(15,23,42,.09)';
            item.style.borderColor = 'rgba(15,23,42,.2)';
        }

        item.addEventListener('mouseenter', () => {
            if (option.value !== select.value) item.style.background = 'rgba(15,23,42,.05)';
        });
        item.addEventListener('mouseleave', () => {
            if (option.value !== select.value) item.style.background = 'rgba(255,255,255,.62)';
        });

        item.appendChild(createFlagNode(option.value));

        const text = document.createElement('span');
        text.textContent = languageName(option.value);
        text.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        item.appendChild(text);

        item.addEventListener('click', () => {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            onPick();
        });

        return item;
    }

    function createCustomSwitcher(select) {
        const container = document.createElement('div');
        container.id = 'xiro-lang-custom';
        container.setAttribute('data-i18n-skip', 'true');
        container.style.cssText = 'position:relative;min-width:170px;';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.id = 'xiro-lang-trigger';
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-controls', 'xiro-lang-menu');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.style.cssText = 'width:100%;display:inline-flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid rgba(148,163,184,.55);border-radius:6px;background:rgba(255,255,255,.82);color:#0f172a;padding:3px 8px;font:600 12px system-ui,-apple-system,Segoe UI,sans-serif;cursor:pointer;';

        const menu = document.createElement('div');
        menu.id = 'xiro-lang-menu';
        menu.setAttribute('role', 'dialog');
        menu.setAttribute('aria-modal', 'false');
        menu.setAttribute('aria-hidden', 'true');
        menu.style.cssText = 'display:none;position:fixed;left:0;top:0;z-index:2147483647;width:min(420px,calc(100vw - 20px));max-height:min(70vh,340px);overflow:auto;background:rgba(255,255,255,.98);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);border:1px solid rgba(148,163,184,.55);border-radius:12px;box-shadow:0 16px 32px rgba(15,23,42,.2);padding:8px;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(8px) scale(.98);transform-origin:top right;transition:opacity .2s ease,transform .2s cubic-bezier(.22,.61,.36,1),visibility 0s linear 0s;';

        let isOpen = false;
        let hideTimerId = null;

        function closeMenu() {
            if (!isOpen && menu.style.display === 'none') return;

            isOpen = false;
            trigger.setAttribute('aria-expanded', 'false');
            menu.setAttribute('aria-hidden', 'true');
            menu.style.transition = 'opacity .2s ease,transform .2s cubic-bezier(.22,.61,.36,1),visibility 0s linear .2s';

            const tiles = Array.from(menu.querySelectorAll('[data-lang-item="1"]'));
            tiles.forEach((tile, index) => {
                const delay = Math.min(index * 12, 96);
                tile.style.transition = `opacity .14s ease ${delay}ms, transform .18s ease ${delay}ms, background-color .12s ease, border-color .12s ease`;
                setTileHiddenState(tile);
            });

            menu.style.opacity = '0';
            menu.style.transform = 'translateY(8px) scale(.98)';
            menu.style.pointerEvents = 'none';
            menu.style.visibility = 'hidden';

            if (hideTimerId) global.clearTimeout(hideTimerId);
            hideTimerId = global.setTimeout(() => {
                if (!isOpen) menu.style.display = 'none';
            }, 210);
        }

        function openMenu() {
            ensureMenuMounted(menu);
            if (hideTimerId) {
                global.clearTimeout(hideTimerId);
                hideTimerId = null;
            }

            isOpen = true;
            menu.style.display = 'block';
            menu.style.transition = 'opacity .2s ease,transform .2s cubic-bezier(.22,.61,.36,1),visibility 0s linear 0s';
            menu.style.opacity = '0';
            menu.style.transform = 'translateY(8px) scale(.98)';
            menu.style.visibility = 'hidden';
            menu.style.pointerEvents = 'none';
            positionMenu(menu, trigger);
            trigger.setAttribute('aria-expanded', 'true');
            menu.setAttribute('aria-hidden', 'false');

            // Force style flush so the next frame transition is always visible.
            void menu.offsetHeight;

            const tiles = menu.querySelectorAll('[data-lang-item="1"]');
            tiles.forEach((tile) => {
                tile.style.transition = 'none';
                setTileHiddenState(tile);
            });

            global.requestAnimationFrame(() => {
                menu.style.visibility = 'visible';
                menu.style.opacity = '1';
                menu.style.transform = 'translateY(0) scale(1)';
                menu.style.pointerEvents = 'auto';

                tiles.forEach((tile, index) => {
                    const delay = Math.min(index * 24, 170);
                    tile.style.transition = `opacity .2s ease ${delay}ms, transform .24s cubic-bezier(.22,.61,.36,1) ${delay}ms, background-color .12s ease, border-color .12s ease`;
                    setTileVisibleState(tile);
                });
            });
        }

        function renderMenu() {
            menu.innerHTML = '';
            const title = document.createElement('div');
            title.textContent = t('language.label', 'Idioma');
            title.style.cssText = 'padding:2px 4px 9px 4px;font:700 11px/1.1 system-ui,-apple-system,Segoe UI,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#334155;';
            menu.appendChild(title);

            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;';

            const viewportWidth = global.innerWidth || document.documentElement.clientWidth || 0;
            if (viewportWidth < 400) grid.style.gridTemplateColumns = '1fr';

            const options = Array.from(select.options);
            const flowSplit = Math.ceil(options.length / 2);

            options.forEach((option, index) => {
                grid.appendChild(createMenuItem(select, option, index < flowSplit ? 'down' : 'up', closeMenu));
            });

            menu.appendChild(grid);
        }

        function sync() {
            renderTrigger(trigger, select);
            renderMenu();
            if (isOpen) positionMenu(menu, trigger);
        }

        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            if (isOpen) {
                closeMenu();
                return;
            }
            openMenu();
        });

        global.addEventListener('resize', () => {
            if (isOpen) positionMenu(menu, trigger);
        });

        global.addEventListener('scroll', () => {
            if (isOpen) positionMenu(menu, trigger);
        }, true);

        document.addEventListener('click', (event) => {
            if (!container.contains(event.target) && !menu.contains(event.target)) closeMenu();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeMenu();
        });

        container.appendChild(trigger);
        sync();

        return {
            element: container,
            sync
        };
    }

    function detectPageKey(pathname) {
        const value = String(pathname || '').toLowerCase();
        if (value === '/' || value.endsWith('/index.html')) return 'index';
        if (value.endsWith('/presentador.html')) return 'presentador';
        if (value.endsWith('/jugador.html')) return 'jugador';
        if (value.endsWith('/admin.html')) return 'admin';
        if (value.endsWith('/tv.html')) return 'tv';
        return 'default';
    }

    function applyWrapperStyle(wrapper, placementStyle) {
        wrapper.style.cssText = `${placementStyle}${WRAPPER_CHROME_STYLE}`;
    }

    function mountSwitcherByPage(wrapper) {
        const page = detectPageKey(global.location.pathname);

        if (page === 'index') {
            const contactLink = document.querySelector('a[href="./contact.html"], a[href="/contact.html"]');
            const line = contactLink ? contactLink.closest('p') : null;
            if (line && line.parentElement) {
                applyWrapperStyle(wrapper, 'position:static;margin:8px auto 0 auto;width:max-content;');
                line.insertAdjacentElement('afterend', wrapper);
                return;
            }
        }

        // Presentador: dentro del menú del operador (⋯), fuera de la vista del público
        const stageMenu = page === 'presentador' ? document.getElementById('stage-menu-panel') : null;
        if (stageMenu) {
            applyWrapperStyle(wrapper, 'position:static;');
            stageMenu.insertBefore(wrapper, stageMenu.querySelector('.stage-menu-footer'));
            return;
        }

        if (page === 'presentador' || page === 'tv') {
            applyWrapperStyle(wrapper, 'position:fixed;left:10px;bottom:calc(24px + env(safe-area-inset-bottom));');
            document.body.appendChild(wrapper);
            return;
        }

        if (page === 'jugador') {
            applyWrapperStyle(wrapper, 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(10px + env(safe-area-inset-bottom));');
            document.body.appendChild(wrapper);
            return;
        }

        if (page === 'admin') {
            applyWrapperStyle(wrapper, 'position:fixed;right:10px;bottom:calc(32px + env(safe-area-inset-bottom));');
            document.body.appendChild(wrapper);
            return;
        }

        // Móvil: en las páginas de contenido, fijo abajo tapaba formularios y textos;
        // va en el flujo, al final de la página
        if (global.matchMedia && global.matchMedia('(max-width: 767px)').matches) {
            applyWrapperStyle(wrapper, 'position:static;margin:16px auto calc(16px + env(safe-area-inset-bottom)) auto;width:max-content;');
            document.body.appendChild(wrapper);
            return;
        }

        applyWrapperStyle(wrapper, 'position:fixed;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));');
        document.body.appendChild(wrapper);
    }

    function patchDialogs() {
        if (dialogsPatched) return;
        dialogsPatched = true;

        const nativeAlert = typeof global.alert === 'function' ? global.alert.bind(global) : null;
        const nativeConfirm = typeof global.confirm === 'function' ? global.confirm.bind(global) : null;
        const nativePrompt = typeof global.prompt === 'function' ? global.prompt.bind(global) : null;

        if (nativeAlert) global.alert = (message) => nativeAlert(translate(message));
        if (nativeConfirm) global.confirm = (message) => nativeConfirm(translate(message));
        if (nativePrompt) global.prompt = (message, defaultValue) => nativePrompt(translate(message), defaultValue);
    }

    function refreshSwitcher() {
        const api = i18n();
        const label = document.getElementById('xiro-lang-label');
        const select = document.getElementById('xiro-lang-select');
        if (!label || !select || !api) return;

        label.textContent = t('language.label', 'Idioma');
        Array.from(select.options).forEach((option) => {
            option.textContent = languageOptionLabel(option.value);
        });
        select.value = api.getLanguage();
        if (customSwitcher) customSwitcher.sync();
    }

    function createSwitcher() {
        if (!document.body || document.getElementById('xiro-lang-switcher')) return;
        if (document.body.dataset.i18nSwitcher === 'off') return;
        if (global.location.pathname.startsWith('/ppt-addin/')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'xiro-lang-switcher';
        wrapper.setAttribute('data-i18n-skip', 'true');

        const label = document.createElement('label');
        label.id = 'xiro-lang-label';
        label.htmlFor = 'xiro-lang-select';

        const select = document.createElement('select');
        select.id = 'xiro-lang-select';
        select.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;opacity:0;pointer-events:none;';
        select.tabIndex = -1;
        select.setAttribute('aria-hidden', 'true');

        const supported = i18n() ? i18n().getSupportedLanguages() : ['es', 'en', 'fr', 'ca', 'eu', 'gl', 'de', 'pt', 'zh', 'ja'];
        supported.forEach((code) => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = languageOptionLabel(code);
            select.appendChild(option);
        });

        select.addEventListener('change', () => {
            if (customSwitcher) customSwitcher.sync();
            const api = i18n();
            if (api) void api.setLanguage(select.value, true);
        });

        customSwitcher = createCustomSwitcher(select);

        wrapper.appendChild(label);
        wrapper.appendChild(customSwitcher.element);
        wrapper.appendChild(select);
        mountSwitcherByPage(wrapper);
        refreshSwitcher();
    }

    function init() {
        patchDialogs();
        createSwitcher();
        refreshSwitcher();
    }

    global.addEventListener('xiro:language-changed', refreshSwitcher);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
