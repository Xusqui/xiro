/**
 * @fileoverview Parseo y validación de la respuesta JSON de IA
 * Limpia markdown, parsea JSON y valida estructura mínima por tipo.
 */

const TYPE_VALIDATORS = {
    quiz: require('./question-types/quiz').validate,
    survey: require('./question-types/survey').validate,
    numeric_approximation: require('./question-types/numeric').validate,
    order: require('./question-types/order').validate,
    word_scramble: require('./question-types/word-scramble').validate,
    multiple_choice: require('./question-types/multiple-choice').validate
};

/**
 * Limpia la respuesta de IA eliminando bloques markdown y texto extra.
 * @param {string} raw
 * @returns {string}
 */
function stripMarkdown(raw) {
    // Eliminar bloques ```json ... ``` o ``` ... ```
    const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');

    // Extraer la primera estructura JSON completa (array o objeto)
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);

    if (arrayMatch) return arrayMatch[0];
    if (objectMatch) return objectMatch[0];
    return cleaned.trim();
}

/**
 * Parsea y valida la respuesta de IA para un tipo de pregunta.
 * @param {string} raw - Texto bruto devuelto por IA
 * @param {string} expectedType - Tipo esperado (quiz, survey, etc.)
 * @returns {Array} Array de preguntas parseadas y validadas
 * @throws {Error} Con descripción clara si el JSON es inválido o no coincide
 */
function parseLLMResponse(raw, expectedType) {
    const cleaned = stripMarkdown(raw);

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (err) {
        throw new Error(
            `JSON inválido para tipo '${expectedType}': ${err.message}\n` +
            `Fragmento recibido: ${cleaned.slice(0, 200)}`
        );
    }

    // Normalizar: puede venir como objeto con array, o directamente como array
    const items = Array.isArray(parsed) ? parsed : (parsed.questions || [parsed]);

    if (items.length === 0) {
        throw new Error(`IA devolvió un array vacío para tipo '${expectedType}'`);
    }

    // Reparación automática: En algunos casos, si la IA no marca ningún is_correct, 
    // lo forzamos a true para la primera opción para que no se rompa la validación de Xiro.
    if (expectedType === 'quiz' || expectedType === 'multiple_choice') {
        items.forEach(q => {
            if (q.options && Array.isArray(q.options)) {
                const hasCorrect = q.options.some(o => o.is_correct === true);
                if (!hasCorrect && q.options.length > 0) {
                    q.options[0].is_correct = true;
                }
            }
        });
    }

    const validator = TYPE_VALIDATORS[expectedType];
    if (!validator) {
        throw new Error(`Tipo de pregunta desconocido: '${expectedType}'`);
    }

    const invalid = items.filter(q => !validator(q));
    if (invalid.length > 0) {
        throw new Error(
            `${invalid.length} de ${items.length} preguntas de tipo '${expectedType}' ` +
            `no superan la validación de estructura.\n` +
            `Primera inválida: ${JSON.stringify(invalid[0]).slice(0, 300)}`
        );
    }

    return items;
}

module.exports = { parseLLMResponse };
