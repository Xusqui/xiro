/**
 * @fileoverview Prompt de «Completa la frase» (fill_blanks) para el generador de IA.
 * prompt-markdown.js compone el Markdown; aquí solo van rol, tarea, reglas y esquema.
 * La IA devuelve la frase con las palabras entre corchetes, el formato del JSON de
 * bancos; question-types/fill-blanks.js la valida y la convierte a marcadores.
 * Se piden candidatas de más: los modelos cuentan mal las letras y el parser
 * descarta las que no cumplen (el controlador se queda con las pedidas).
 */

const { composePrompt } = require('./prompt-markdown');

const FILL_BLANKS_EXTRA = 3;

const SCHEMA = `[
  {
    "question_text": "<frase completa y real con 1 a 3 palabras clave entre corchetes, p. ej. La capital de [Francia] es [Paris]>",
    "type": "fill_blanks",
    "tipo_contenido": "texto",
    "url_recurso": null,
    "time_limit": 45,
    "options": []
  }
]`;

const RULES = [
    'Cada frase es un dato REAL, completo y con sentido, con entre 1 y 3 palabras entre corchetes [así] que el jugador tiene que adivinar.',
    'Cada palabra entre corchetes es UNA sola palabra de entre 4 y 14 letras y SOLO letras (sin espacios, números, guiones, apóstrofos ni signos).',
    'El resto de la frase da contexto suficiente para deducirlas y no repite la palabra oculta.',
    'Cuenta las letras de cada palabra entre corchetes antes de responder: [Paris] (5) y [Roma] (4) valen; [Uso] (3), [Nueva York] (dos palabras) y [COVID-19] (números y guion) NO valen.',
    'options=[].'
];

/**
 * @param {string} text - Documento o tema
 * @param {number} count - Preguntas pedidas (se piden FILL_BLANKS_EXTRA de más)
 * @param {string} dificultad - BAJA | MEDIA | ALTA
 * @param {{ previousQuestions?: string[], mode?: 'document'|'prompt', language?: string }} [options]
 * @returns {string}
 */
function buildFillBlanksPrompt(text, count, dificultad, options = {}) {
    return composePrompt(text, {
        role: 'Eres un generador experto de frases para completar (rellenar huecos). El usuario te indica un tema.',
        task: 'frases para completar',
        item: 'frases',
        count: count + FILL_BLANKS_EXTRA,
        dificultad,
        guidance: ['Cada frase con palabras ocultas distintas.'],
        topicGuidance: ['Usa términos clave reales del tema (nombres, lugares, conceptos).'],
        rules: RULES,
        schema: SCHEMA,
        options
    });
}

module.exports = { buildFillBlanksPrompt, FILL_BLANKS_EXTRA };
