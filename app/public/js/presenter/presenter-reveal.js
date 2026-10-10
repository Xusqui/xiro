/**
 * @fileoverview Reveal answer - Mostrar respuesta correcta con justificación y ranking.
 * Coordina el reveal; las tarjetas están en presenter-reveal-cards.js, la numérica en
 * presenter-reveal-numeric.js y la rejilla de opciones en presenter-reveal-options.js.
 */

import { getPlayersData, getCurrentQuestionIndex, getTotalQuestions } from './presenter-state.js?v=20260922172926';
import { removeFloatingCards, fitSplitOptionText, fitSplitSolutionCards } from './presenter-utils.js?v=20260922172926';
import { updatePlayersPanel } from './presenter-players-panel.js?v=20260922172926';
import { getWordScrambleRevealHTML, revealWordScramble } from './presenter-wordscramble-layout.js?v=20260922172926';
import { revealWordSearchOnStage } from './presenter-wordsearch-layout.js?v=20260922172926';
import { rankingCardHtml, justificationCardHtml } from './presenter-reveal-cards.js?v=20260922172926';
import { numericRevealCardHtml, markNumericAnswerRevealed } from './presenter-reveal-numeric.js?v=20260922172926';
import { revealOptionCards } from './presenter-reveal-options.js?v=20260922172926';
import { removeCenteredNumericHint } from './presenter-numeric-layout.js?v=20260922172926';

/**
 * Limpiar elementos de reveal (ranking y justificación)
 * Debe llamarse antes de mostrar la siguiente pregunta
 */
export function cleanupRevealElements() {
    // Fuera el modo partido del revelado (opciones a la izquierda, solución a la derecha)
    document.body.classList.remove('stage-split');

    // Eliminar tarjeta(s) de ranking (Top 5)
    const rankingCards = document.querySelectorAll('#ranking-card');
    if (rankingCards.length > 0) {
        rankingCards.forEach(card => card.remove());
        console.log('🧹 Tarjeta(s) de ranking eliminadas:', rankingCards.length);
    }

    // Eliminar tarjeta(s) de justificación (quiz y word-scramble)
    const justificationCards = document.querySelectorAll('.justification-card, #word-scramble-reveal-card');
    if (justificationCards.length > 0) {
        justificationCards.forEach(card => card.remove());
        console.log('🧹 Tarjeta(s) de justificación eliminadas:', justificationCards.length);
    }

    const orderCard = document.getElementById('order-reveal-card');
    if (orderCard) {
        orderCard.remove();
        console.log('🧹 Tarjeta de orden eliminada');
    }

    const matchingCard = document.getElementById('matching-reveal-card');
    if (matchingCard) {
        matchingCard.remove();
        console.log('🧹 Tarjeta de matching eliminada');
    }
}

function insertHtml(html) {
    document.body.insertAdjacentHTML('beforeend', _tHtml(html));
}

function stopQuestionAudio() {
    const audioElement = document.getElementById('question-audio');
    if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
    }
}

/** Actualiza puntuaciones con el ranking y marca como fallo a quien no respondió. */
function applyRevealScores(data) {
    const playersData = getPlayersData();
    (data.ranking || []).forEach(player => {
        if (playersData[player.name]) {
            playersData[player.name].score = player.pts;
        }
    });
    Object.keys(playersData).forEach(nick => {
        if (!playersData[nick].answered) {
            playersData[nick].correct = false;
        }
    });
    updatePlayersPanel();
}

/**
 * Escenario por zonas: el ranking del revelado va dentro de la columna derecha
 * (sustituye a la lista de jugadores mientras está; ver presenter.css) en vez de
 * flotar encima de las opciones o de la solución.
 */
function insertSidebarRanking(html) {
    const header = document.getElementById('players-sidebar')?.firstElementChild;
    if (header) {
        header.insertAdjacentHTML('afterend', _tHtml(html));
        return;
    }
    insertHtml(html);
}

/** La respuesta (numérica, palabra) va bajo el enunciado, sin taparlo. */
function insertBelowTitle(html) {
    const title = document.getElementById('question-title');
    if (title) {
        title.insertAdjacentHTML('afterend', _tHtml(html));
        return;
    }
    insertHtml(html);
}

/**
 * Revelado con tarjeta de solución: las opciones pasan a una columna a la izquierda
 * y la solución ocupa la mitad derecha de la zona central (presenter.css, .stage-split).
 */
function enableSplitReveal() {
    // Con las opciones solo en los móviles la rejilla está oculta (offsetParent
    // null): la solución se ancla bajo el enunciado para no taparlo
    const grid = document.getElementById('options-grid');
    const title = document.getElementById('question-title');
    let top = grid?.offsetParent ? grid.getBoundingClientRect().top : 0;
    if (!top && title) top = title.getBoundingClientRect().bottom + 16;
    if (top) {
        document.documentElement.style.setProperty('--stage-content-top', `${Math.round(top)}px`);
    }
    document.body.classList.add('stage-split');
    // Una columna = otras proporciones: el texto se reajusta a cada tarjeta
    requestAnimationFrame(() => {
        fitSplitOptionText();
        fitSplitSolutionCards();
    });
}

/** Tarjeta "Top Respuestas" (numérica, anagrama, selección múltiple). */
function insertTopAnswersCard(data) {
    insertSidebarRanking(rankingCardHtml(data.ranking, {
        top: '0',
        sideCss: '',
        title: _t('presenter.reveal.top_answers', null, 'Top Respuestas')
    }));
}

function revealNumeric(data, showTopAnswers) {
    // La pista (capa fija bajo el título) ya no aporta nada y taparía la respuesta
    removeCenteredNumericHint();
    insertBelowTitle(numericRevealCardHtml(window.currentQuestion, data));
    markNumericAnswerRevealed(window.currentQuestion, data);
    if (showTopAnswers) insertTopAnswersCard(data);
}

function revealWordScrambleAnswer(data, showTopAnswers) {
    const correctWord = data.correctWord || window.currentQuestion?.correct_word || '';
    revealWordScramble(correctWord);
    insertBelowTitle(getWordScrambleRevealHTML(correctWord));
    if (showTopAnswers) insertTopAnswersCard(data);
}

function revealWordSearch(data, showTopAnswers) {
    revealWordSearchOnStage(data.wordSearch);
    if (showTopAnswers) insertTopAnswersCard(data);
}

function revealMultipleChoice(data, showTopAnswers) {
    const correctIndices = data.correctIndices || [];
    // Marca correctas e incorrectas en la rejilla (estilo quiz)
    import('./presenter-multiplechoice-layout.js?v=20260922172926').then(module => {
        module.revealMultipleChoiceInGrid(correctIndices);
    });
    if (showTopAnswers) insertTopAnswersCard(data);
}

/** Quiz, encuesta, orden y matching: rejilla de opciones + Top 5 + justificación (solo quiz). */
function revealOptions(data, isInfoSlide) {
    const { isOrderQuestion, isMatchingQuestion, matchingOnBoard } = revealOptionCards(data);
    const isScoredQuiz = !data.percentages && !data.isSurvey && !isInfoSlide;

    // En el Trivial no hay puntos: la columna ya muestra los quesitos
    if (data.ranking && isScoredQuiz && window.canShowRanking && !window.isTrivialGame) {
        try {
            insertSidebarRanking(rankingCardHtml(data.ranking, {
                top: '0',
                sideCss: '',
                title: 'Top 5',
                emptyMessage: _t('presenter.reveal.no_scores_yet', null, 'Aún no hay puntuaciones')
            }));
        } catch (error) {
            console.error('❌ Error al mostrar ranking:', error);
        }
    }

    const hasJustification = data.justification && data.justification.trim() !== '';
    const showJustification = hasJustification && isScoredQuiz && !isOrderQuestion && !isMatchingQuestion;
    // Matching revelado en su tablero no necesita la mitad derecha para la solución
    if (isOrderQuestion || (isMatchingQuestion && !matchingOnBoard) || showJustification) {
        enableSplitReveal();
    }
    if (showJustification) {
        insertHtml(justificationCardHtml(data.justification));
    }
}

export function nextButtonLabel() {
    if (window.isTrivialGame) {
        return [_t('presenter.game.next_round', null, 'Siguiente Ronda'), 'fa-rotate-right'];
    }
    const isLast = getCurrentQuestionIndex() >= getTotalQuestions() - 1;
    return isLast
        ? [_t('presenter.game.view_ranking', null, 'Ver Ránking'), 'fa-trophy']
        : [_t('presenter.game.next_question', null, 'Siguiente Pregunta'), 'fa-chevron-right'];
}

function showNextButton() {
    const btnNext = document.getElementById('btn-next');
    if (!btnNext) {
        console.log('⚠️ btn-next no existe (probablemente ya se mostró el podio)');
        return;
    }
    const [btnText, btnIcon] = nextButtonLabel();
    btnNext.innerHTML = _tHtml(`${btnText} <i class="fas ${btnIcon} ml-2"></i>`);
    btnNext.classList.remove('hidden');
}

/**
 * Manejar evento de revelar respuesta
 */
export function handleRevealAnswer(data) {
    console.log('📩 reveal-answer recibido');

    // Resync the trivial flag from the authoritative server payload. The
    // window flag is reset to false on page load and is NOT restored when the
    // presenter reconnects (reconnection re-emits reveal-answer but not
    // trivial-game-started), which would mislabel the "next" button.
    if (data && data.isTrivial) {
        window.isTrivialGame = true;
    }

    removeFloatingCards();

    const slideType = window.currentSlideType;
    const isInfoSlide = slideType === 'info' || slideType === 'comment' || slideType === 'text';
    if (isInfoSlide) {
        window.canShowRanking = false;
        cleanupRevealElements();
    }

    if (data.stopAudio) stopQuestionAudio();
    applyRevealScores(data);

    clearInterval(window.timerInterval);
    document.getElementById('countdown-overlay').classList.add('hidden');

    // Ya revelada, el botón no hace nada y confunde sobre la fase de la pregunta.
    // visibility (no display) para no mover el temporizador; la cabecera se
    // redibuja en la siguiente pregunta y el botón vuelve a aparecer.
    const revealButton = document.getElementById('btn-reveal-answer');
    if (revealButton) revealButton.style.visibility = 'hidden';

    const showTopAnswers = Boolean(data.ranking) && !isInfoSlide && window.canShowRanking && !window.isTrivialGame;
    const questionType = window.currentQuestion?.question_type;
    if (questionType === 'numeric_approximation') revealNumeric(data, showTopAnswers);
    else if (questionType === 'word_scramble') revealWordScrambleAnswer(data, showTopAnswers);
    else if (questionType === 'word_search') revealWordSearch(data, showTopAnswers);
    else if (questionType === 'multiple_choice') revealMultipleChoice(data, showTopAnswers);
    else revealOptions(data, isInfoSlide);

    showNextButton();
}
