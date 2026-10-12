/**
 * @fileoverview Esquema y validación para preguntas tipo fill_blanks («Completa la frase»).
 * La IA devuelve la frase con las palabras a adivinar entre corchetes (el mismo
 * formato que el JSON de bancos); aquí se valida con las reglas del núcleo
 * (1-3 huecos, 4-14 letras, solo letras) y se convierte a marcadores + opciones,
 * que es lo que acepta saveBankComplete.
 */

const FB = require('../../public/js/core/fill-blanks-text.js');

const MARKER = /\{\{\d+\}\}/g;

/** Frase válida y con algo de contexto además de los huecos */
function validate(q) {
    if (!q || typeof q.question_text !== 'string') return false;
    const parsed = FB.parseEditorText(q.question_text);
    if (parsed.errors.length > 0) return false;
    return parsed.text.replace(MARKER, '').trim().length > 0;
}

function normalize(q) {
    const parsed = FB.parseEditorText(q.question_text);
    return {
        questionText: parsed.text,
        type: 'fill_blanks',
        tipo_contenido: 'texto',
        url_recurso: null,
        time_limit: q.time_limit || 45,
        options: parsed.words.map((word, index) => ({
            optionText: word,
            isCorrect: true,
            justification: null,
            order_index: index
        }))
    };
}

module.exports = { validate, normalize };
