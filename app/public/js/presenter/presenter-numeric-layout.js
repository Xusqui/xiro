/**
 * @fileoverview Helpers de pregunta numérica en presentador
 */

/** Pista de una pregunta numérica (cadena vacía si el presentador no dio ninguna). */
export function numericHintOf(q = {}) {
    return (q.hint_text || q.hint || q.hintText || '').trim();
}
