/**
 * Validación de un banco de preguntas (JSON formato 2, el de public/data/schema.json de XiRo).
 * Las reglas son las del prompt que XiRo da a una IA externa (admin.tools.upload_ai_prompt):
 * si cambian allí, cambian aquí (ver references/banco.md).
 */

export const QUESTION_TYPES = ['quiz', 'survey', 'order', 'numeric_approximation', 'hotspot', 'word_scramble', 'multiple_choice', 'matching', 'word_search', 'fill_blanks', 'survey_multiple'];
const TOLERANCE_MODES = ['absolute', 'percentage', 'hybrid'];
const MEDIA_REF = /^media:[a-z0-9]+$/;
const isInt = n => Number.isInteger(n);
const isText = s => typeof s === 'string' && s.trim().length > 0;
const letterCount = s => [...s].length;
const onlyLetters = s => /^\p{L}+$/u.test(s);

const optionsOf = q => (Array.isArray(q.options) ? q.options : []);
const correctCount = q => optionsOf(q).filter(o => o.is_correct === true).length;

function checkMediaRef(value, where, media, errors) {
    if (value === null || value === undefined) return;
    if (typeof value !== 'string' || !MEDIA_REF.test(value) || !(value.slice(6) in media)) errors.push(`${where}: referencia de recurso no válida (${JSON.stringify(value)}); déjala en null`);
}

function needOptions(q, where, min, max, errors) {
    const n = optionsOf(q).length;
    if (n < min || n > max) errors.push(`${where}: lleva ${n} opciones y tienen que ser de ${min} a ${max}`);
    optionsOf(q).forEach((o, i) => {
        if (!isText(o.option_text)) errors.push(`${where}: la opción ${i + 1} no tiene option_text`);
        else if (o.option_text.length > 500) errors.push(`${where}: la opción ${i + 1} pasa de 500 caracteres`);
    });
}

function checkQuiz(q, where, errors) {
    needOptions(q, where, 2, 6, errors);
    if (correctCount(q) !== 1) errors.push(`${where}: un quiz tiene exactamente 1 opción con is_correct true (tiene ${correctCount(q)})`);
}

function checkSurvey(q, where, errors) {
    needOptions(q, where, 2, 6, errors);
    if (correctCount(q)) errors.push(`${where}: una encuesta no tiene respuesta correcta (is_correct siempre false)`);
}

function checkOrder(q, where, errors) {
    needOptions(q, where, 2, 6, errors);
    const indexes = optionsOf(q).map(o => o.order_index).sort((a, b) => a - b);
    if (!indexes.every((v, i) => v === i)) errors.push(`${where}: order_index debe ser 0, 1, 2… sin huecos ni repetidos`);
}

function checkNumeric(q, where, errors) {
    if (!isInt(q.correctAnswer)) errors.push(`${where}: correctAnswer debe ser un entero (sin decimales)`);
    if (!isInt(q.maxPoints) || q.maxPoints <= 0) errors.push(`${where}: maxPoints debe ser un entero mayor que 0`);
    if (!TOLERANCE_MODES.includes(q.toleranceMode)) errors.push(`${where}: toleranceMode debe ser ${TOLERANCE_MODES.join(', ')}`);
    for (const field of ['toleranceValue', 'toleranceCap']) {
        if (typeof q[field] !== 'number' || !(q[field] > 0)) errors.push(`${where}: ${field} debe ser un número mayor que 0`);
    }
}

function isUpperWord(word, min, max) {
    return typeof word === 'string' && onlyLetters(word) && word === word.toUpperCase() && letterCount(word) >= min && letterCount(word) <= max;
}

function checkScramble(q, where, errors) {
    if (!isUpperWord(q.correctWord, 7, 10)) errors.push(`${where}: correctWord debe ser UNA palabra en MAYÚSCULAS de 7 a 10 letras, solo letras (${JSON.stringify(q.correctWord)})`);
}

const MC_FIELDS = { mc_points_per_correct: 1, mc_penalty_per_incorrect: 0, mc_perfect_bonus: 0 };

function checkMultipleChoice(q, where, errors) {
    needOptions(q, where, 2, 6, errors);
    if (correctCount(q) < 1) errors.push(`${where}: necesita al menos una opción con is_correct true`);
    for (const [field, min] of Object.entries(MC_FIELDS)) {
        if (!isInt(q[field]) || q[field] < min || q[field] > 100) errors.push(`${where}: ${field} es obligatorio, entero de ${min} a 100`);
    }
}

function checkMatching(q, where, errors) {
    needOptions(q, where, 2, 6, errors);
    optionsOf(q).forEach((o, i) => {
        if (!isText(o.match_value)) errors.push(`${where}: la opción ${i + 1} no tiene match_value`);
    });
}

function checkWordSearch(q, where, errors) {
    needOptions(q, where, 2, 6, errors);
    const words = optionsOf(q).map(o => o.option_text);
    words.forEach(w => {
        if (!isUpperWord(w, 3, 10)) errors.push(`${where}: «${w}» debe ir en MAYÚSCULAS, solo letras, de 3 a 10`);
        else if (q.question_text.toUpperCase().includes(w)) errors.push(`${where}: la consigna contiene la palabra oculta «${w}»`);
    });
    if (new Set(words).size !== words.length) errors.push(`${where}: palabras repetidas`);
    if (!optionsOf(q).every((o, i) => o.is_correct === true && o.order_index === i)) errors.push(`${where}: todas las opciones con is_correct true y order_index 0, 1, 2…`);
}

function checkFillBlanks(q, where, errors) {
    const blanks = [...q.question_text.matchAll(/\[([^\]]*)\]/g)].map(m => m[1]);
    if (blanks.length < 1 || blanks.length > 3) errors.push(`${where}: lleva ${blanks.length} palabras entre corchetes y tienen que ser de 1 a 3`);
    blanks.forEach(w => {
        if (!onlyLetters(w) || letterCount(w) < 4 || letterCount(w) > 14) errors.push(`${where}: [${w}] debe ser UNA palabra de 4 a 14 letras, solo letras`);
    });
    if (q.options !== undefined) errors.push(`${where}: fill_blanks no lleva options`);
}

function checkHotspot(q, where, errors) {
    if (q.options !== undefined) errors.push(`${where}: hotspot no lleva options`);
    if (q.tipo_contenido !== 'imagen') errors.push(`${where}: hotspot lleva tipo_contenido "imagen"`);
    for (const field of ['url_recurso', 'hotspot_area', 'hotspot_tolerance']) {
        if (q[field] !== null) errors.push(`${where}: ${field} debe ser null (la imagen y el área se añaden en XiRo!)`);
    }
}

const CHECKS = {
    quiz: checkQuiz, survey: checkSurvey, survey_multiple: checkSurvey, order: checkOrder, numeric_approximation: checkNumeric,
    word_scramble: checkScramble, multiple_choice: checkMultipleChoice, matching: checkMatching, word_search: checkWordSearch,
    fill_blanks: checkFillBlanks, hotspot: checkHotspot
};

function checkQuestion(q, index, media, errors) {
    const where = `Pregunta ${index + 1}`;
    if (!q || typeof q !== 'object') return errors.push(`${where}: no es un objeto`);
    if (!QUESTION_TYPES.includes(q.type)) return errors.push(`${where}: tipo desconocido ${JSON.stringify(q.type)}`);
    if (!isText(q.question_text)) errors.push(`${where}: falta question_text`);
    if (!isInt(q.time_limit) || q.time_limit < 5 || q.time_limit > 120) errors.push(`${where}: time_limit debe ser un entero de 5 a 120 segundos`);
    if (typeof q.question_text === 'string' && q.question_text.length > 2000) errors.push(`${where}: question_text pasa de 2000 caracteres`);
    if (!['texto', 'imagen', 'audio'].includes(q.tipo_contenido)) errors.push(`${where}: tipo_contenido debe ser texto, imagen o audio`);
    checkMediaRef(q.url_recurso, `${where} url_recurso`, media, errors);
    checkMediaRef(q.question_image_url, `${where} question_image_url`, media, errors);
    optionsOf(q).forEach((o, i) => checkMediaRef(o.option_image_url, `${where} opción ${i + 1} option_image_url`, media, errors));
    if (isText(q.question_text)) CHECKS[q.type](q, where, errors);
}

/**
 * Valida un banco ya parseado.
 * @param {object} bank
 * @returns {string[]} errores en español; vacío si XiRo lo aceptaría
 */
export function validateBank(bank) {
    const errors = [];
    if (!bank || typeof bank !== 'object' || Array.isArray(bank)) return ['El banco debe ser un único objeto JSON'];
    if (!isText(bank.name)) errors.push('Falta name (nombre del banco)');
    if (bank.format_version !== 2) errors.push('format_version debe ser 2');
    const media = bank.media && typeof bank.media === 'object' ? bank.media : {};
    checkMediaRef(bank.image_url, 'image_url', media, errors);
    if (!Array.isArray(bank.questions) || !bank.questions.length || bank.questions.length > 500) errors.push('questions debe ser una lista de 1 a 500 preguntas');
    else bank.questions.forEach((q, i) => checkQuestion(q, i, media, errors));
    return errors;
}
