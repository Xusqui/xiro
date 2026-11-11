/**
 * @fileoverview Prompt de «Sopa de letras» (word_search) para el generador de IA.
 * prompt-markdown.js compone el Markdown; aquí solo van rol, tarea, reglas y esquema.
 * La IA devuelve la consigna y las palabras en options, el formato del JSON de
 * bancos; question-types/word-search.js las valida y normaliza.
 * Se piden candidatas de más: los modelos cuentan mal las letras y el parser
 * descarta las que no cumplen (el controlador se queda con las pedidas).
 */

const { composePrompt } = require('./prompt-markdown');
const { WORD_SEARCH } = require('../config/game-constants');

const WORD_SEARCH_EXTRA = 2;
const { MIN_WORDS, MAX_WORDS, MIN_WORD_LENGTH, MAX_WORD_LENGTH } = WORD_SEARCH;

const SCHEMA = `[
  {
    "question_text": "<consigna breve que indica qué buscar, p. ej. Encuentra estos ríos de España>",
    "type": "word_search",
    "tipo_contenido": "texto",
    "url_recurso": null,
    "time_limit": 90,
    "options": [
      {"option_text": "<PALABRA 1>", "is_correct": true, "order_index": 0},
      {"option_text": "<PALABRA 2>", "is_correct": true, "order_index": 1},
      {"option_text": "<PALABRA 3>", "is_correct": true, "order_index": 2},
      {"option_text": "<PALABRA 4>", "is_correct": true, "order_index": 3}
    ]
  }
]`;

const RULES = [
    `Cada sopa de letras tiene una consigna clara y entre ${MIN_WORDS} y ${MAX_WORDS} palabras (mejor 4 o 5) que son términos REALES y relevantes del tema.`,
    `Cada palabra es UNA sola palabra en MAYÚSCULAS de entre ${MIN_WORD_LENGTH} y ${MAX_WORD_LENGTH} letras y SOLO letras (sin espacios, números, guiones, apóstrofos ni signos), sin repetir dentro de la misma sopa.`,
    'La consigna NO contiene las palabras ocultas.',
    'Todas las opciones llevan is_correct=true y order_index correlativo desde 0.',
    'Cuenta las letras de cada palabra antes de responder: EBRO (4) y GUADIANA (8) valen; GUADALQUIVIR (12), RIO TAJO (dos palabras) y COVID-19 (números y guion) NO valen.'
];

/**
 * @param {string} text - Documento o tema
 * @param {number} count - Preguntas pedidas (se piden WORD_SEARCH_EXTRA de más)
 * @param {string} dificultad - BAJA | MEDIA | ALTA
 * @param {{ previousQuestions?: string[], mode?: 'document'|'prompt', language?: string }} [options]
 * @returns {string}
 */
function buildWordSearchPrompt(text, count, dificultad, options = {}) {
    return composePrompt(text, {
        role: 'Eres un generador experto de sopas de letras educativas. El usuario te indica un tema.',
        task: 'sopas de letras',
        item: 'sopas de letras',
        count: count + WORD_SEARCH_EXTRA,
        dificultad,
        guidance: ['Cada sopa con una consigna y palabras distintas.'],
        topicGuidance: ['Usa términos clave reales del tema (nombres, lugares, conceptos).'],
        rules: RULES,
        schema: SCHEMA,
        options
    });
}

module.exports = { buildWordSearchPrompt, WORD_SEARCH_EXTRA };
