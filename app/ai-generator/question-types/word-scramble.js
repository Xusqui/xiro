/**
 * @fileoverview Esquema y validación para preguntas tipo word_scramble (anagrama)
 * La respuesta es correctWord en MAYÚSCULAS. Sin opciones.
 */

const EXAMPLE = {
    question_text: 'Disciplina científica que estudia los seres vivos',
    type: 'word_scramble',
    tipo_contenido: 'texto',
    url_recurso: null,
    time_limit: 30,
    correctWord: 'BIOLOGIA',
    options: []
};

function validate(q) {
    return typeof q.correctWord === 'string' && q.correctWord.length > 0;
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

module.exports = { EXAMPLE, validate, normalize };
