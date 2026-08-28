/**
 * Selector de idioma de contenido reutilizable (banco/juego/personalizado/trivial/IA).
 * Fila de banderas clicables (mismos SVG que el switcher global, ver app/public/js/i18n/i18n-ui.js).
 * Guarda el valor en un <input type="hidden"> con el id pasado, para que el código
 * de guardado existente (document.getElementById(id).value) siga funcionando sin cambios.
 */

const LANGUAGE_NAMES = {
    es: 'Español', en: 'English', fr: 'Français', ca: 'Català', eu: 'Euskara',
    gl: 'Galego', de: 'Deutsch', pt: 'Português', zh: '中文', ja: '日本語'
};

const _LANG_BTN_BASE = 'inline-flex items-center justify-center w-10 h-8 p-1 rounded-lg cursor-pointer transition-all border-2';
const _LANG_BTN_ACTIVE = 'border-violet-600 bg-violet-50 scale-105';
const _LANG_BTN_INACTIVE = 'border-transparent bg-slate-50';

function renderLanguageSelect({ id, value } = {}) {
    const codes = (window.XiroI18n?.getSupportedLanguages?.() || Object.keys(LANGUAGE_NAMES));
    const selected = value || window.XiroI18n?.getLanguage?.() || 'es';

    const flags = codes.map((code) => {
        const label = LANGUAGE_NAMES[code] || code.toUpperCase();
        const active = code === selected;
        return `<button type="button"
                data-admin-click="selectContentLanguage('${id}', '${code}', this)"
                title="${label}" aria-label="${label}" aria-pressed="${active}"
                class="${_LANG_BTN_BASE} ${active ? _LANG_BTN_ACTIVE : _LANG_BTN_INACTIVE}">
            <img src="/images/flags/${code}.svg" alt=""
                class="w-full h-full object-cover rounded-lg border border-slate-300 bg-white/80">
        </button>`;
    }).join('');

    return `<div class="flex flex-wrap gap-2">${flags}</div>
        <input type="hidden" id="${id}" value="${selected}">`;
}

function selectContentLanguage(hiddenInputId, code, buttonEl) {
    const input = document.getElementById(hiddenInputId);
    if (input) input.value = code;

    const group = buttonEl?.parentElement;
    if (!group) return;

    Array.from(group.children).forEach((btn) => {
        const active = btn === buttonEl;
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.classList.remove(..._LANG_BTN_ACTIVE.split(' '), ..._LANG_BTN_INACTIVE.split(' '));
        btn.classList.add(...(active ? _LANG_BTN_ACTIVE : _LANG_BTN_INACTIVE).split(' '));
    });
}
