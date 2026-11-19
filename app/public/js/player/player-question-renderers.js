// player-question-renderers.js
// Qué pantalla abre el móvil para cada diapositiva y cada tipo de pregunta. Antes eran
// tres cadenas de if copiadas (inicio de partida, nueva pregunta y reconexión).
// Los tipos de pregunta son los de core/question-types.js; el contrato
// __tests__/question-types.contract.test.js exige una entrada para cada uno.

import {
    renderizarPregunta,
    renderizarPreguntaOrdena,
    renderizarPreguntaMatching,
    renderizarPreguntaNumerica,
    renderizarPreguntaWordScramble,
    renderizarPreguntaWordSearch,
    renderizarPreguntaFillBlanks,
    renderizarPreguntaMultipleChoice,
    renderizarPreguntaSurveyMultiple,
    renderizarSlideComentario,
    renderizarSlideInfo,
    renderizarSlideTexto,
    renderizarSlideImagen,
    renderizarSlideTextoImagen,
    renderizarSlideVideo,
    renderizarSlideHowTo
} from './player-question-ui.js?v=20260922172926';
import { renderizarSlideLienzo } from './player-slide-canvas-ui.js?v=20261019120000';

// Una diapositiva manda sobre question_type: la fila puede arrastrar el de la pregunta
const SLIDE_RENDERERS = Object.freeze({
    comment: renderizarSlideComentario,
    info: renderizarSlideInfo,
    text: renderizarSlideTexto,
    image: renderizarSlideImagen,
    'text-image': renderizarSlideTextoImagen,
    video: renderizarSlideVideo,
    canvas: renderizarSlideLienzo,
    howto: renderizarSlideHowTo
});

// quiz y survey comparten pantalla: la encuesta solo cambia el texto y el resultado
const QUESTION_RENDERERS = Object.freeze({
    quiz: renderizarPregunta,
    survey: renderizarPregunta,
    multiple_choice: renderizarPreguntaMultipleChoice,
    survey_multiple: renderizarPreguntaSurveyMultiple,
    order: renderizarPreguntaOrdena,
    matching: renderizarPreguntaMatching,
    numeric_approximation: renderizarPreguntaNumerica,
    word_scramble: renderizarPreguntaWordScramble,
    word_search: renderizarPreguntaWordSearch,
    fill_blanks: renderizarPreguntaFillBlanks
});

const ownEntry = (table, key) => (Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null);

/**
 * ¿Tiene el tipo de pregunta una pantalla registrada?
 * @param {string} questionType
 * @returns {boolean}
 */
export function hasQuestionRenderer(questionType) {
    return ownEntry(QUESTION_RENDERERS, questionType) !== null;
}

function pickRenderer(question) {
    const slideRenderer = ownEntry(SLIDE_RENDERERS, question.slide_type);
    if (slideRenderer) return slideRenderer;
    const questionRenderer = ownEntry(QUESTION_RENDERERS, question.question_type);
    if (questionRenderer) return questionRenderer;
    // Pregunta antigua sin tipo: es un quiz. Un tipo desconocido (cliente con caché
    // vieja tras añadir uno) también, pero se avisa para detectarlo.
    if (question.question_type) {
        console.warn('⚠️ Tipo de pregunta sin pantalla propia, se muestra como quiz:', question.question_type);
    }
    return renderizarPregunta;
}

/**
 * Abre la pantalla de la diapositiva o pregunta recibida.
 * @param {Object|null} question - Pregunta o diapositiva tal como llega del servidor
 * @returns {boolean} false si no llegó pregunta (no se toca la pantalla)
 */
export function renderQuestionScreen(question) {
    if (!question) {
        console.error('❌ Pantalla de pregunta pedida sin pregunta');
        return false;
    }
    pickRenderer(question)(question);
    return true;
}
