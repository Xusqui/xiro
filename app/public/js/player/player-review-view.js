/**
 * @fileoverview Pantalla del jugador al revisar una pregunta ya revelada de un juego
 * personalizado (el presentador ha vuelto atrás): su resultado de entonces, la
 * respuesta correcta y la justificación. No se puede volver a responder.
 * Sin imports (los helpers llegan como parámetro): se prueba cargando el fuente.
 */

function verdictText(isCorrect) {
    if (isCorrect === true) return _t('player.answer.correct', null, '¡BIEN!');
    if (isCorrect === false) return _t('player.answer.wrong', null, '¡FALLASTE!');
    // Encuestas: no hay correcta
    return _t('player.review.answered', null, 'Respondiste');
}

function resultHtml(result, escapeHtml) {
    if (!result) return '';
    if (!result.answered) {
        return `<p class="text-2xl font-black mt-4">${_t('player.review.not_answered', null, 'No respondiste')}</p>`;
    }
    const points =
        result.pointsEarned > 0
            ? `<p class="text-xl font-bold">${_t('player.review.points', { points: result.pointsEarned }, '+{points} puntos')}</p>`
            : '';
    const team = result.team
        ? `<p class="text-sm opacity-80">${escapeHtml(_t('player.review.team_answer', { team: result.team }, 'Respuesta de tu equipo ({team})'))}</p>`
        : '';
    return `<div class="mt-4">
               <p class="text-3xl font-black">${verdictText(result.isCorrect)}</p>
               ${points}
               ${team}
           </div>`;
}

/**
 * @param {Object} state - Respuesta de 'get-review-state': { question, currentIndex, totalQuestions, reveal, result }
 * @param {Object} helpers - { escapeHtml, correctAnswerBlockHtml }
 * @returns {string}
 */
export function reviewScreenHtml(state, { escapeHtml, correctAnswerBlockHtml }) {
    const { question, currentIndex, totalQuestions, reveal, result } = state || {};
    const title = _t(
        'player.review.title',
        { n: (currentIndex ?? 0) + 1, total: totalQuestions ?? '?' },
        'Repaso · Pregunta {n} de {total}'
    );
    const questionText = question?.question_text
        ? `<h2 class="text-xl font-black mt-2 break-words">${escapeHtml(question.question_text)}</h2>`
        : '';
    const justification = reveal?.justification
        ? `<div class="mt-2 bg-black/30 rounded-xl p-4 w-full max-w-sm text-sm leading-relaxed">${escapeHtml(reveal.justification)}</div>`
        : '';

    return `
        <div class="time-up-container" data-review-screen="1" data-reveal-shown="1">
            <i class="fas fa-rotate-left"></i>
            <p class="text-sm uppercase font-bold opacity-80">${title}</p>
            ${questionText}
            ${resultHtml(result, escapeHtml)}
            ${reveal ? correctAnswerBlockHtml(reveal) : ''}
            ${justification}
        </div>
    `;
}
