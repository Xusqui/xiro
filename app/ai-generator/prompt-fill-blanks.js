/**
 * @fileoverview Prompt de «Completa la frase» (fill_blanks) para el generador de IA.
 * Va aparte de prompt-builder.js (ya al límite de tamaño) y reutiliza sus helpers.
 * La IA devuelve la frase con las palabras entre corchetes, el formato del JSON de
 * bancos; question-types/fill-blanks.js la valida y la convierte a marcadores.
 * Se piden candidatas de más: los modelos cuentan mal las letras y el parser
 * descarta las que no cumplen (el controlador se queda con las pedidas).
 */

const builder = require('./prompt-builder');

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

const RULES = 'REGLAS: cada frase es un dato REAL, completo y con sentido, con entre 1 y 3 palabras entre corchetes [así] '
    + 'que el jugador tiene que adivinar; cada palabra entre corchetes es UNA sola palabra de entre 4 y 14 letras y SOLO letras '
    + '(sin espacios, números, guiones, apóstrofos ni signos); el resto de la frase da contexto suficiente para deducirlas y no '
    + 'repite la palabra oculta; options=[]';

const COUNT_HINT = 'Cuenta las letras de cada palabra entre corchetes antes de responder: [Paris] (5) y [Roma] (4) valen; '
    + '[Uso] (3), [Nueva York] (dos palabras) y [COVID-19] (números y guion) NO valen.';

/**
 * @param {string} text - Documento o tema
 * @param {number} count - Preguntas pedidas (se piden FILL_BLANKS_EXTRA de más)
 * @param {string} dificultad - BAJA | MEDIA | ALTA
 * @param {{ previousQuestions?: string[], mode?: 'document'|'prompt', language?: string }} [options]
 * @returns {string}
 */
function buildFillBlanksPrompt(text, count, dificultad, { previousQuestions = [], mode = 'document', language = 'es' } = {}) {
    const lang = builder.getLanguageName(language);
    const candidates = count + FILL_BLANKS_EXTRA;
    const difficulty = builder.DIFICULTAD_INSTRUCCION[dificultad] || 'media';
    const exclusion = builder.getExclusionInstruction(previousQuestions);

    if (mode === 'prompt') {
        const safeText = text.trim().slice(0, builder.MAX_PROMPT_CHARS);
        return `Eres un generador experto de frases para completar (rellenar huecos). El usuario te indica un tema.
Genera ${candidates} frases para completar en ${lang} sobre ese tema, cada una con palabras ocultas distintas. Dificultad: ${difficulty}.${exclusion}
IMPORTANTE: Usa términos clave reales del tema (nombres, lugares, conceptos). NO generes frases sobre la instrucción.
Responde SOLO con un array JSON:
${SCHEMA}

${RULES}, en ${lang}. ${COUNT_HINT}
NO copies estos ejemplos. Genera frases REALES sobre el siguiente tema:

${safeText}`;
    }

    return `${builder.wrapDocumentInput(builder.getText(text))}

${builder.INJECTION_GUARD}Genera ${candidates} frases para completar en ${lang}, cada una con palabras ocultas distintas, sobre el texto anterior, entre las etiquetas user_input. Dificultad: ${difficulty}. ${exclusion}
Responde SOLO con un array JSON:
${SCHEMA}

${RULES}, en ${lang}. ${COUNT_HINT}
NO copies estos ejemplos. Genera frases NUEVAS basadas en ese texto.`;
}

module.exports = { buildFillBlanksPrompt, FILL_BLANKS_EXTRA };
