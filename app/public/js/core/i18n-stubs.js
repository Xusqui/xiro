/*
 * Stubs ES5 de las funciones de traducción (_t, _tHtml, _tHtmlApply) para
 * páginas que NO cargan i18n-core.js — hoy solo tv.html, que debe funcionar
 * en WebOS 3.5 (motor JS antiguo, sin ES6+; i18n-core.js no parsea allí).
 * Devuelven el fallback/texto original sin traducir.
 * Fichero externo (no inline) para que lo permita la CSP via 'self'.
 */
window._t = window._t || function (k, v, f) { return f != null ? f : (k != null ? String(k) : ''); };
window._tHtml = window._tHtml || function (h) { return h != null ? String(h) : ''; };
window._tHtmlApply = window._tHtmlApply || function (v) { return v != null ? String(v) : ''; };
