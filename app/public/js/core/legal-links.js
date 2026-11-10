/**
 * @fileoverview Enlaces a los textos legales en los contenedores [data-legal-links].
 * Llevan data-i18n, así que i18n-dom traduce la etiqueta; el destino lo elige este
 * script según el idioma, al cargar y en cada evento xiro:language-changed. Si el
 * texto no está en el idioma de la interfaz, una nota final dice en cuál está.
 */
(function () {
    'use strict';

    // Los textos solo existen en español e inglés. Las lenguas cooficiales leen el
    // español, que es además la versión que rige (ley española); el resto, el inglés.
    const SPANISH_TEXT_LANGUAGES = new Set(['es', 'ca', 'eu', 'gl']);

    const NOTE_KEYS = { es: 'common.legal.text_in_spanish', en: 'common.legal.text_in_english' };

    const LINKS = [
        ['common.legal.notice', 'Aviso legal', 'aviso-legal.html', 'legal-notice.html'],
        ['common.legal.privacy', 'Privacidad', 'privacidad.html', 'privacy.html'],
        ['common.legal.cookies', 'Cookies', 'cookies.html', 'cookies.html'],
        ['common.legal.terms', 'Términos', 'terminos.html', 'terms.html'],
        ['common.legal.refunds', 'Reembolsos', 'reembolsos.html', 'refunds.html'],
        ['common.legal.accessibility', 'Accesibilidad', 'accesibilidad.html', 'accessibility.html']
    ];

    /** @type {Array<{link: HTMLAnchorElement, entry: string[]}>} */
    const renderedLinks = [];
    /** @type {HTMLSpanElement[]} */
    const notes = [];

    /** @returns {string} Código de idioma de dos letras de la interfaz ('es' si no se sabe) */
    function currentLanguage() {
        const api = window.XiroI18n;
        const language = api && typeof api.getLanguage === 'function' ? api.getLanguage() : document.documentElement.lang;
        return String(language || 'es').slice(0, 2).toLowerCase();
    }

    function pointLink({ link, entry }, textLanguage) {
        const [, , spanishFile, englishFile] = entry;
        link.href = textLanguage === 'es' ? `/legal/${spanishFile}` : `/legal/en/${englishFile}`;
        link.hreflang = textLanguage;
    }

    // Sin i18n cargado no hay con qué traducir la nota: se queda oculta hasta el evento.
    function updateNote(note, language, textLanguage) {
        const api = window.XiroI18n;
        const visible = textLanguage !== language && Boolean(api) && typeof api.t === 'function';
        note.hidden = !visible;
        note.textContent = visible ? ` (${api.t(NOTE_KEYS[textLanguage])})` : '';
    }

    function refreshLinks() {
        const language = currentLanguage();
        const textLanguage = SPANISH_TEXT_LANGUAGES.has(language) ? 'es' : 'en';
        renderedLinks.forEach(rendered => pointLink(rendered, textLanguage));
        notes.forEach(note => updateNote(note, language, textLanguage));
    }

    function createLink([key, label]) {
        const link = document.createElement('a');
        link.className = 'underline underline-offset-2';
        link.setAttribute('data-i18n', key);
        link.textContent = label;
        return link;
    }

    function fillContainer(container) {
        LINKS.forEach((entry, index) => {
            if (index > 0) container.append(' · ');
            const link = createLink(entry);
            renderedLinks.push({ link, entry });
            container.append(link);
        });
        const note = document.createElement('span');
        note.hidden = true;
        notes.push(note);
        container.append(note);
    }

    document.querySelectorAll('[data-legal-links]').forEach(fillContainer);
    refreshLinks();
    window.addEventListener('xiro:language-changed', refreshLinks);
})();
