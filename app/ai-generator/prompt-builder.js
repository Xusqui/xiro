/**
 * @fileoverview Prompts por tipo de pregunta (quiz, encuesta, numérica, ordenar, anagrama, selección múltiple).
 * Cada tipo solo declara su rol, tarea, pautas, reglas y esquema; prompt-markdown.js compone el Markdown.
 * Los esquemas usan marcadores abstractos <…>, sin contenido real que el modelo copie.
 * Firma común: (text, count, dificultad, { previousQuestions, previousAnswers, mode, language }) → string
 * Los tipos con respuesta correcta declaran uniqueAnswers: la respuesta no puede repetirse entre preguntas.
 */

const { composePrompt } = require('./prompt-markdown');

const optionLine = (text, isCorrect, justification, orderIndex = null) =>
    `      {"option_text": "<${text}>", "is_correct": ${isCorrect}, "justification": ${justification ? `"<${justification}>"` : 'null'}, "order_index": ${orderIndex}}`;

/** Esquema JSON de ejemplo: un array con una pregunta. */
function schemaFor(type, timeLimit, { questionText, fields = [], options = [] }) {
    const optionsJson = options.length ? `[\n${options.join(',\n')}\n    ]` : '[]';
    return `[
  {
    "question_text": "<${questionText}>",
    "type": "${type}",
    "tipo_contenido": "texto",
    "url_recurso": null,
    "time_limit": ${timeLimit},
${fields.map(field => `    ${field},\n`).join('')}    "options": ${optionsJson}
  }
]`;
}

const QUIZ_SCHEMA = schemaFor('quiz', 30, {
    questionText: 'pregunta',
    options: [
        optionLine('opción correcta', true, 'por qué es correcta'),
        ...[1, 2, 3, 4, 5].map(n => optionLine(`distractor ${n}`, false))
    ]
});

/**
 * Prompt de preguntas de opciones (quiz).
 * @param {string} text - Texto del documento, o tema libre en modo prompt
 * @param {number} count - Número de preguntas
 * @param {string} dificultad - BAJA | MEDIA | ALTA
 * @param {{previousQuestions?: string[], mode?: string, language?: string}} [options]
 * @returns {string} Prompt
 */
function buildQuizPrompt(text, count, dificultad, options = {}) {
    return composePrompt(text, {
        role: 'Eres un generador experto de preguntas de quiz educativas. El usuario te indica un tema o te da una instrucción.',
        task: 'preguntas de quiz',
        item: 'preguntas',
        count,
        dificultad,
        topicGuidance: [
            'Usa tu conocimiento enciclopédico para crear preguntas reales, variadas y ÚNICAS sobre el tema.'
        ],
        rules: ['Exactamente 6 opciones por pregunta.', 'Exactamente 1 opción con is_correct=true.'],
        schema: QUIZ_SCHEMA,
        uniqueAnswers: true,
        options
    });
}

const SURVEY_SCHEMA = schemaFor('survey', 30, {
    questionText: 'pregunta de opinión',
    options: [1, 2, 3].map(n => optionLine(`opción ${n}`, false))
});

/**
 * Prompt de preguntas de encuesta (opinión, sin respuesta correcta; la dificultad no aplica).
 * @param {string} text - Texto del documento, o tema libre en modo prompt
 * @param {number} count - Número de preguntas
 * @param {string} _dificultad - Se ignora
 * @param {{previousQuestions?: string[], mode?: string, language?: string}} [options]
 * @returns {string} Prompt
 */
function buildSurveyPrompt(text, count, _dificultad, options = {}) {
    return composePrompt(text, {
        role: 'Eres un generador experto de encuestas educativas. El usuario te indica un tema.',
        task: 'preguntas de encuesta (opinión, sin respuesta correcta)',
        item: 'preguntas',
        count,
        topicGuidance: ['Usa tu conocimiento para crear preguntas de opinión reales sobre el tema.'],
        rules: ['Todas las opciones con is_correct=false.', 'Entre 2 y 5 opciones por pregunta.'],
        schema: SURVEY_SCHEMA,
        options
    });
}

const NUMERIC_SCHEMA = schemaFor('numeric_approximation', 30, {
    questionText: 'pregunta cuya respuesta es un número',
    fields: [
        '"correctAnswer": <número entero, sin decimales>',
        '"toleranceMode": "hybrid"',
        '"toleranceValue": <porcentaje, mayor que 0>',
        '"toleranceCap": <margen máximo en las unidades de la respuesta, mayor que 0>',
        '"hint": "<pista sin revelar el número exacto>"'
    ]
});

/**
 * Prompt de preguntas numéricas (numeric_approximation).
 * @param {string} text - Texto del documento, o tema libre en modo prompt
 * @param {number} count - Número de preguntas
 * @param {string} dificultad - BAJA | MEDIA | ALTA
 * @param {{previousQuestions?: string[], mode?: string, language?: string}} [options]
 * @returns {string} Prompt
 */
function buildNumericPrompt(text, count, dificultad, options = {}) {
    const source =
        options.mode === 'prompt'
            ? 'correctAnswer es un número histórico, científico o real relacionado con el tema.'
            : 'correctAnswer es un número real mencionado en el documento.';
    return composePrompt(text, {
        role: 'Eres un generador experto de preguntas numéricas educativas. El usuario te indica un tema.',
        task: 'preguntas numéricas (la respuesta es un número)',
        item: 'preguntas',
        count,
        dificultad,
        topicGuidance: ['Usa tu conocimiento para crear preguntas con cifras reales del tema.'],
        rules: [
            source,
            'options=[].',
            "toleranceMode 'hybrid' acepta respuestas a menos de toleranceValue % de correctAnswer, sin pasar de toleranceCap unidades: ajusta ambos a la magnitud y precisión de cada respuesta (un año admite pocos años de margen; una población de millones, miles o más).",
            'toleranceValue y toleranceCap siempre MAYORES QUE 0, nunca 0.',
            'correctAnswer siempre ENTERO: si la cifra real tiene decimales, pregunta en otra unidad (p. ej. metros en vez de kilómetros) o redondea e indícalo en el enunciado.'
        ],
        schema: NUMERIC_SCHEMA,
        uniqueAnswers: true,
        options
    });
}

const ORDINALS = ['primero', 'segundo', 'tercero', 'cuarto'];
const ORDER_SCHEMA = schemaFor('order', 45, {
    questionText: 'instrucción para ordenar elementos',
    options: ORDINALS.map((ordinal, i) => optionLine(`elemento ${i + 1}`, false, `por qué va ${ordinal}`, i))
});

/**
 * Prompt de preguntas de ordenar secuencia (order).
 * @param {string} text - Texto del documento, o tema libre en modo prompt
 * @param {number} count - Número de preguntas
 * @param {string} dificultad - BAJA | MEDIA | ALTA
 * @param {{previousQuestions?: string[], mode?: string, language?: string}} [options]
 * @returns {string} Prompt
 */
function buildOrderPrompt(text, count, dificultad, options = {}) {
    return composePrompt(text, {
        role: 'Eres un generador experto de preguntas de ordenar secuencia. El usuario te indica un tema.',
        task: 'preguntas de ordenar secuencia',
        item: 'preguntas',
        count,
        dificultad,
        topicGuidance: [
            'Usa tu conocimiento para crear secuencias cronológicas, de procesos o rangos reales del tema.'
        ],
        rules: [
            'Entre 4 y 6 elementos por pregunta.',
            'order_index empieza en 0.',
            'is_correct=false en todas las opciones.'
        ],
        schema: ORDER_SCHEMA,
        options
    });
}

// Candidatas de más: los modelos no cuentan bien las letras y el parser
// descarta las que no tienen 7-10 (el controlador se queda con las pedidas).
const WORD_SCRAMBLE_EXTRA = 3;
const WORD_SCRAMBLE_SCHEMA = schemaFor('word_scramble', 30, {
    questionText: 'definición o pista de la palabra',
    fields: ['"correctWord": "PALABRA"']
});

/**
 * Prompt de anagramas (word_scramble). Pide WORD_SCRAMBLE_EXTRA candidatas de más, porque algunas se descartan al validar.
 * @param {string} text - Texto del documento, o tema libre en modo prompt
 * @param {number} count - Número de preguntas
 * @param {string} dificultad - BAJA | MEDIA | ALTA
 * @param {{previousQuestions?: string[], mode?: string, language?: string}} [options]
 * @returns {string} Prompt
 */
function buildWordScramblePrompt(text, count, dificultad, options = {}) {
    const source = options.mode === 'prompt' ? 'un término clave real del tema' : 'un término clave del documento';
    return composePrompt(text, {
        role: 'Eres un generador experto de preguntas de adivinar palabra. El usuario te indica un tema.',
        task: 'preguntas de adivinar palabra',
        item: 'preguntas',
        count: count + WORD_SCRAMBLE_EXTRA,
        dificultad,
        guidance: ['Cada pregunta con una palabra distinta.'],
        topicGuidance: ['Usa términos clave reales del tema (personajes, lugares, conceptos, fechas).'],
        rules: [
            'correctWord es UNA sola palabra en MAYÚSCULAS con EXACTAMENTE entre 7 y 10 letras (ni más ni menos), sin espacios, guiones, números ni signos; si el término no cumple esa longitud, elige otro.',
            'Cuenta las letras una a una antes de responder: VOLCANES (8) y MURCIÉLAGO (10) valen; FOTOSÍNTESIS (12) y ÁTOMO (5) NO valen.',
            `correctWord es ${source}.`,
            'options=[].'
        ],
        schema: WORD_SCRAMBLE_SCHEMA,
        uniqueAnswers: true,
        options
    });
}

const MULTIPLE_CHOICE_SCHEMA = schemaFor('multiple_choice', 45, {
    questionText: 'pregunta con varias respuestas correctas',
    options: [
        optionLine('correcta 1', true, 'por qué es correcta'),
        optionLine('correcta 2', true, 'por qué es correcta'),
        optionLine('incorrecta 1', false),
        optionLine('incorrecta 2', false)
    ]
});

/**
 * Prompt de preguntas de selección múltiple (varias respuestas correctas).
 * @param {string} text - Texto del documento, o tema libre en modo prompt
 * @param {number} count - Número de preguntas
 * @param {string} dificultad - BAJA | MEDIA | ALTA
 * @param {{previousQuestions?: string[], mode?: string, language?: string}} [options]
 * @returns {string} Prompt
 */
function buildMultipleChoicePrompt(text, count, dificultad, options = {}) {
    return composePrompt(text, {
        role: 'Eres un generador experto de preguntas de selección múltiple educativas. El usuario te indica un tema.',
        task: 'preguntas de selección múltiple (varias respuestas correctas)',
        item: 'preguntas',
        count,
        dificultad,
        topicGuidance: ['Usa tu conocimiento para crear preguntas reales con varias respuestas correctas del tema.'],
        rules: ['Entre 4 y 8 opciones por pregunta.', 'Entre 2 y 6 opciones con is_correct=true.'],
        schema: MULTIPLE_CHOICE_SCHEMA,
        uniqueAnswers: true,
        options
    });
}

module.exports = {
    buildQuizPrompt,
    buildSurveyPrompt,
    buildNumericPrompt,
    buildOrderPrompt,
    buildWordScramblePrompt,
    buildMultipleChoicePrompt
};
