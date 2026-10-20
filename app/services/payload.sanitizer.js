/**
 * @fileoverview Utilidades para sanitizar payloads de Socket.io
 * Previene exposición de datos sensibles y reduce tamaño de mensajes
 */

const { collectMediaRefs } = require('../public/js/core/slide-canvas-model');

/**
 * Sanitiza una pregunta para jugadores (elimina respuestas correctas)
 * @param {Object} question - Pregunta completa con opciones
 * @returns {Object} Pregunta clonada sin información sensible
 */
function sanitizeQuestionForPlayers(question) {
    if (!question) return null;

    // Clonar objeto para no mutar el original
    // slide_image se omite para slides tipo 'image': la imagen solo se muestra en
    // el presentador/TV. Omitirla evita que N jugadores descarguen simultáneamente
    // el mismo archivo de imagen, lo que saturaba la red.
    const sanitized = {
        id: question.id,
        question_text: question.question_text,
        question_type: question.question_type,
        time_limit: question.time_limit,
        hint_text: question.hint_text || question.hint,
        slide_type: question.slide_type,
        comment_text: question.comment_text,
        slide_title: question.slide_title,
        slide_body: question.slide_body,
        slide_image: question.slide_type === 'text-image' ? undefined : question.slide_image,
        slide_image_position: question.slide_image_position,
        slide_footer: question.slide_footer,
        tipo_contenido: question.tipo_contenido,
        url_recurso: question.url_recurso,
        question_image_url: question.question_image_url,
        // word_scramble: campos necesarios para el jugador (scrambled_letters no son sensibles)
        word_length: question.word_length,
        scrambled_letters: question.scrambled_letters,
        // word_search: rejilla y lista de palabras. ❌ NUNCA ws_placements (revelaría la solución)
        ws_grid: question.ws_grid,
        ws_words: question.ws_words,
        // fill_blanks: letras de cada hueco. ❌ NUNCA fb_words (es la solución)
        fb_lengths: question.fb_lengths
    };

    // fill_blanks: las opciones SON la solución (una palabra por hueco): no viajan al jugador
    if (question.question_type === 'fill_blanks') {
        sanitized.options = [];
        return sanitized;
    }

    // Sanitizar opciones: eliminar is_correct y justification
    if (question.options && Array.isArray(question.options)) {
        sanitized.options = question.options.map(opt => ({
            id: opt.id,
            // Compatibilidad: optionText > option_text > text
            optionText: opt.optionText || opt.option_text || opt.text,
            text: opt.text, // Para slides de comentario/info
            // Para preguntas tipo 'order' y 'matching' (necesitan order_index en el cliente)
            order_index: opt.order_index ?? opt.orderIndex ?? undefined,
            // Para preguntas tipo 'matching' (columna derecha visible al jugador)
            match_value: opt.match_value ?? undefined,
            option_image_url: opt.option_image_url ?? undefined
            // ❌ NO incluir: is_correct, isCorrect, justification
        }));
    }

    // Procesar canvas para quitar video_source y url de los elementos de vídeo
    if (question.slide_type === 'canvas' && question.slide_canvas) {
        sanitized.slide_canvas = sanitizeCanvasForPlayers(question.slide_canvas);
    }

    return sanitized;
}

/**
 * Sanitiza un canvas para jugadores (elimina urls y video_sources sensibles)
 * @param {Object} canvas - Canvas a sanitizar
 * @returns {Object} Canvas sanitizado
 */
function sanitizeCanvasForPlayers(canvas) {
    if (!canvas) return undefined;

    // Crear copia profunda del canvas
    const result = JSON.parse(JSON.stringify(canvas));

    // Procesar elementos
    if (result.elements && Array.isArray(result.elements)) {
        result.elements = result.elements.map(el => {
            if (el.type === 'video' && el.props) {
                // Crear una copia del elemento sin url ni video_source
                const { video_source: _source, ...rest } = el;
                const { url: _url, ...props } = el.props;
                return { ...rest, props };
            }
            return el;
        });
    }

    return result;
}

/**
 * Sanitiza un array de preguntas
 * @param {Array} questions - Array de preguntas
 * @returns {Array} Preguntas sanitizadas
 */
function sanitizeQuestionsForPlayers(questions) {
    if (!Array.isArray(questions)) return [];
    return questions.map(q => sanitizeQuestionForPlayers(q));
}

/**
 * Sanitiza payload de game-started para jugadores
 * @param {Object} payload - Payload original
 * @returns {Object} Payload sanitizado
 */
function sanitizeGameStartPayload(payload) {
    // Recopilar las URLs de todas las slides de imagen para precarga con jitter.
    // Los jugadores las descargan en segundo plano, distribuidas en el tiempo,
    // evitando que N dispositivos hagan N peticiones simultáneas cuando aparece el slide.
    const imagePreloads = (payload.questions || [])
        .filter(q => q.slide_type === 'image' && q.slide_image)
        .map(q => q.slide_image);

    // Agregar imágenes de slides canvas
    (payload.questions || []).forEach(q => {
        if (q.slide_type === 'canvas' && q.slide_canvas) {
            const refs = collectMediaRefs(q.slide_canvas);
            imagePreloads.push(...refs.images);
        }
    });

    return {
        firstQuestion: sanitizeQuestionForPlayers(payload.firstQuestion),
        totalQuestions: payload.totalQuestions,
        currentIndex: payload.currentIndex,
        imagePreloads: [...new Set(imagePreloads)],
        ...(typeof payload.randomPoints === 'number' && { randomPoints: payload.randomPoints })
    };
}

/**
 * Sanitiza payload de next-question para jugadores
 * @param {Object} payload - Payload original
 * @returns {Object} Payload sanitizado
 */
function sanitizeNextQuestionPayload(payload) {
    return {
        question: sanitizeQuestionForPlayers(payload.question),
        currentIndex: payload.currentIndex,
        totalQuestions: payload.totalQuestions
    };
}

/**
 * Calcula reducción de tamaño del payload
 * @param {Object} original - Payload original
 * @param {Object} sanitized - Payload sanitizado
 * @returns {Object} Estadísticas de reducción
 */
function calculatePayloadReduction(original, sanitized) {
    const originalSize = JSON.stringify(original).length;
    const sanitizedSize = JSON.stringify(sanitized).length;
    const reduction = originalSize - sanitizedSize;
    const reductionPercent = ((reduction / originalSize) * 100).toFixed(2);

    return {
        originalBytes: originalSize,
        sanitizedBytes: sanitizedSize,
        savedBytes: reduction,
        reductionPercent: reductionPercent + '%'
    };
}

module.exports = {
    sanitizeQuestionForPlayers,
    sanitizeQuestionsForPlayers,
    sanitizeGameStartPayload,
    sanitizeNextQuestionPayload,
    calculatePayloadReduction
};
