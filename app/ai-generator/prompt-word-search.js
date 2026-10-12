/**
 * @fileoverview Prompt de «Sopa de letras» (word_search) para el generador de IA.
 * Va aparte de prompt-builder.js (ya al límite de tamaño) y reutiliza sus helpers.
 * La IA devuelve la consigna y las palabras en options, el formato del JSON de
 * bancos; question-types/word-search.js las valida y normaliza.
 * Se piden candidatas de más: los modelos cuentan mal las letras y el parser
 * descarta las que no cumplen (el controlador se queda con las pedidas).
 */

const builder = require('./prompt-builder');
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

const RULES = `REGLAS: cada sopa de letras tiene una consigna clara y entre ${MIN_WORDS} y ${MAX_WORDS} palabras `
    + '(mejor 4 o 5) que son términos REALES y relevantes del tema; cada palabra es UNA sola palabra en MAYÚSCULAS '
    + `de entre ${MIN_WORD_LENGTH} y ${MAX_WORD_LENGTH} letras y SOLO letras (sin espacios, números, guiones, apóstrofos `
    + 'ni signos), sin repetir dentro de la misma sopa; la consigna NO contiene las palabras ocultas; '
    + 'todas las opciones llevan is_correct=true y order_index correlativo desde 0';

const COUNT_HINT = 'Cuenta las letras de cada palabra antes de responder: EBRO (4) y GUADIANA (8) valen; '
    + 'GUADALQUIVIR (12), RIO TAJO (dos palabras) y COVID-19 (números y guion) NO valen.';

/**
 * @param {string} text - Documento o tema
 * @param {number} count - Preguntas pedidas (se piden WORD_SEARCH_EXTRA de más)
 * @param {string} dificultad - BAJA | MEDIA | ALTA
 * @param {{ previousQuestions?: string[], mode?: 'document'|'prompt', language?: string }} [options]
 * @returns {string}
 */
function buildWordSearchPrompt(text, count, dificultad, { previousQuestions = [], mode = 'document', language = 'es' } = {}) {
    const lang = builder.getLanguageName(language);
    const candidates = count + WORD_SEARCH_EXTRA;
    const difficulty = builder.DIFICULTAD_INSTRUCCION[dificultad] || 'media';
    const exclusion = builder.getExclusionInstruction(previousQuestions);

    if (mode === 'prompt') {
        const safeText = text.trim().slice(0, builder.MAX_PROMPT_CHARS);
        return `Eres un generador experto de sopas de letras educativas. El usuario te indica un tema.
Genera ${candidates} sopas de letras en ${lang} sobre ese tema, cada una con una consigna y palabras distintas. Dificultad: ${difficulty}.${exclusion}
IMPORTANTE: Usa términos clave reales del tema (nombres, lugares, conceptos). NO generes sopas sobre la instrucción.
Responde SOLO con un array JSON:
${SCHEMA}

${RULES}, en ${lang}. ${COUNT_HINT}
NO copies estos ejemplos. Genera sopas de letras REALES sobre el siguiente tema:

${safeText}`;
    }

    return `${builder.wrapDocumentInput(builder.getText(text))}

${builder.INJECTION_GUARD}Genera ${candidates} sopas de letras en ${lang}, cada una con una consigna y palabras distintas, sobre el texto anterior, entre las etiquetas user_input. Dificultad: ${difficulty}. ${exclusion}
Responde SOLO con un array JSON:
${SCHEMA}

${RULES}, en ${lang}. ${COUNT_HINT}
NO copies estos ejemplos. Genera sopas de letras NUEVAS basadas en ese texto.`;
}

module.exports = { buildWordSearchPrompt, WORD_SEARCH_EXTRA };
