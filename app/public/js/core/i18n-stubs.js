/* eslint-disable no-var -- ES5 a propósito: tv.html debe funcionar en WebOS 3.5 */
/*
 * Stubs ES5 de las funciones de traducción (_t, _tHtml, _tHtmlApply) para
 * páginas que NO cargan i18n-core.js — hoy solo tv.html, que debe funcionar
 * en WebOS 3.5 (motor JS antiguo, sin ES6+; i18n-core.js no parsea allí).
 * Devuelven el fallback/texto original sin traducir.
 * Fichero externo (no inline) para que lo permita la CSP via 'self'.
 */
window._t = window._t || function (k, v, f) {
    var text = f != null ? String(f) : (k != null ? String(k) : '');
    if (!v || typeof v !== 'object') return text;
    // Sustituye {nombre} por vars.nombre, como _t de i18n-core (p. ej. "JUGÁIS POR {points} PUNTOS")
    return text.replace(/\{(\w+)\}/g, function (match, name) {
        return Object.prototype.hasOwnProperty.call(v, name) && v[name] != null ? String(v[name]) : match;
    });
};
window._tHtml = window._tHtml || function (h) { return h != null ? String(h) : ''; };
window._tHtmlApply = window._tHtmlApply || function (v) { return v != null ? String(v) : ''; };
