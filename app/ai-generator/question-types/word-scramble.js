/**
 * @fileoverview Esquema y validación para preguntas tipo word_scramble (anagrama)
 * La respuesta es correctWord en MAYÚSCULAS. Sin opciones.
 */

// Una sola palabra de 7 a 10 letras, como exige la subida de bancos
const WORD_PATTERN = /^\p{L}{7,10}$/u;

function validate(q) {
    return typeof q.correctWord === 'string' && WORD_PATTERN.test(q.correctWord.trim());
}

function normalize(q) {
    return {
        questionText: q.question_text,
        type: 'word_scramble',
        tipo_contenido: 'texto',
        url_recurso: null,
        time_limit: q.time_limit || 30,
        correctWord: (q.correctWord || '').toUpperCase().replace(/\s+/g, ''),
        options: []
    };
}

module.exports = { validate, normalize };
