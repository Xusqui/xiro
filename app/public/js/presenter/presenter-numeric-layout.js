/**
 * @fileoverview Helpers de pregunta numérica en presentador
 */

/** Pista de una pregunta numérica (cadena vacía si el presentador no dio ninguna). */
export function numericHintOf(q = {}) {
    return (q.hint_text || q.hint || q.hintText || '').trim();
}

/** Escape de HTML para cualquier texto que este módulo llegue a insertar. */
export function escapeHtml(text = '') {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
