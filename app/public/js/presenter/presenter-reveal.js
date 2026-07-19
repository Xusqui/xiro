/**
 * @fileoverview Reveal answer - Mostrar respuesta correcta con justificación y ranking
 */

import { getPlayersData, getCurrentQuestionIndex, getTotalQuestions } from './presenter-state.js?v=20260719190748';
import { removeFloatingCards } from './presenter-utils.js?v=20260719190748';
import { updatePlayersPanel } from './presenter-players-panel.js?v=20260719190748';
import { calculatePercentages, createPercentageHTML } from './presenter-percentage-calculator.js?v=20260719190748';
import { getWordScrambleRevealHTML, revealWordScramble } from './presenter-wordscramble-layout.js?v=20260719190748';

function toPositiveNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getNumericToleranceConfig(question = {}) {
    const modeRaw = String(question.tolerance_mode ?? question.toleranceMode ?? '').toLowerCase();
    const mode = modeRaw === 'absolute' || modeRaw === 'percentage' || modeRaw === 'hybrid' || modeRaw === 'relative'
        ? modeRaw
        : 'hybrid';

    const value = toPositiveNumber(question.tolerance_value ?? question.toleranceValue) ?? 25;
    const cap = toPositiveNumber(question.tolerance_cap ?? question.toleranceCap);

    return {
        mode,
        value,
        cap: cap ?? (mode === 'hybrid' ? 1000 : null)
    };
}

function resolveToleranceWindowForDisplay(correctAnswer, toleranceConfig) {
    const absCorrect = Math.abs(Number(correctAnswer) || 0);
    const percentageTolerance = absCorrect * (toleranceConfig.value / 100);

    if (toleranceConfig.mode === 'absolute') {
        return toleranceConfig.value;
    }

    if (toleranceConfig.mode === 'percentage' || toleranceConfig.mode === 'relative' || toleranceConfig.mode === 'hybrid') {
        return toleranceConfig.cap
            ? Math.min(percentageTolerance, toleranceConfig.cap)
            : percentageTolerance;
    }

    return percentageTolerance;
}

function formatNumericToleranceLabel(correctAnswer, question = {}) {
    const toleranceConfig = getNumericToleranceConfig(question);
    const effectiveTolerance = resolveToleranceWindowForDisplay(correctAnswer, toleranceConfig);

    if (toleranceConfig.mode === 'absolute') {
        return `±${effectiveTolerance}`;
    }

    if (toleranceConfig.mode === 'percentage' || toleranceConfig.mode === 'relative') {
        return `±${effectiveTolerance.toFixed(2)} (${toleranceConfig.value}%)`;
    }

    return `±${effectiveTolerance.toFixed(2)} (${toleranceConfig.value}% hasta máx. ${toleranceConfig.cap})`;
}

/**
 * Limpiar elementos de reveal (ranking y justificación)
 * Debe llamarse antes de mostrar la siguiente pregunta
 */
export function cleanupRevealElements() {
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

    console.log('📝 Justificación:', data.justification);
    console.log('🏆 Ranking:', data.ranking);

    // Detener audio si el flag está presente
    if (data.stopAudio) {
        const audioElement = document.getElementById('question-audio');
        if (audioElement) {
            audioElement.pause();
            audioElement.currentTime = 0;
        }
    }

    // Actualizar puntuaciones del ranking
    const playersData = getPlayersData();
    if (data.ranking) {
        data.ranking.forEach(player => {
            if (playersData[player.name]) {
                playersData[player.name].score = player.pts;
            }
        });
    }

    // Marcar como incorrectos a los que NO respondieron
    Object.keys(playersData).forEach(nick => {
        if (!playersData[nick].answered) {
            playersData[nick].correct = false;
        }
    });
    updatePlayersPanel();

    clearInterval(window.timerInterval);
    document.getElementById('countdown-overlay').classList.add('hidden');

    // Soporte para preguntas de aproximación numérica
    const isNumericQuestion = window.currentQuestion && window.currentQuestion.question_type === 'numeric_approximation';
    const isWordScrambleQuestion = window.currentQuestion && window.currentQuestion.question_type === 'word_scramble';

    if (isNumericQuestion) {
        const correctAnswer = window.currentQuestion?.correct_answer ?? data.correctAnswer ?? '?';
        const maxPoints = window.currentQuestion?.max_points ?? data.maxPoints ?? 0;
        const toleranceQuestion = {
            ...(window.currentQuestion || {}),
            tolerance_mode: window.currentQuestion?.tolerance_mode ?? data.toleranceMode,
            tolerance_value: window.currentQuestion?.tolerance_value ?? data.toleranceValue,
            tolerance_cap: window.currentQuestion?.tolerance_cap ?? data.toleranceCap
        };
        const toleranceLabel = formatNumericToleranceLabel(correctAnswer, toleranceQuestion);

        // Mostrar información numérica
        const numericHTML = `
            <div class="justification-card" id="numeric-reveal-card" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 200px;
                background: linear-gradient(to right, #10b981, #059669);
                color: white;
                padding: 2rem 2rem;
                box-shadow: 0 10px 50px rgba(0,0,0,0.3);
                border-bottom: 8px solid white;
                z-index: 9999;
                min-height: 140px;
            ">
                <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 1.5rem; height: 100%;">
                    <div style="background-color: rgba(255, 255, 255, 0.2); padding: 1rem; border-radius: 1rem; flex-shrink: 0;">
                        <i class="fas fa-check-circle" style="font-size: 2.5rem; color: #ecfccb;"></i>
                    </div>
                    <div style="flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                        <div>
                            <h3 style="font-size: 1.75rem; font-weight: 900; text-transform: uppercase; font-style: italic; margin: 0 0 0.3rem 0;">${_t('presenter.reveal.correct_answer', null, 'Respuesta correcta')}</h3>
                            <p style="font-size: 0.95rem; opacity: 0.9; margin: 0;">${_t('presenter.reveal.tolerance', null, 'Tolerancia:')} ${toleranceLabel} ${_t('presenter.reveal.max_points', null, '· Puntos máximos:')} ${maxPoints}</p>
                        </div>
                        <div style="font-size: 3.2rem; font-weight: 900; color: #fef08a; line-height: 1;">${correctAnswer}</div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', _tHtml(numericHTML));

        // Mostrar ranking de respuestas
        if (data.ranking && !isInfoSlide && window.canShowRanking) {
            const rankingHTML = `
                <div id="ranking-card" style="
                    position: fixed;
                    top: 10rem;
                    right: 216px;
                    background: linear-gradient(135deg, rgb(147, 51, 234), rgb(37, 99, 235));
                    color: white;
                    border-radius: 1.5rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    padding: 1.5rem;
                    border: 4px solid white;
                    width: 24rem;
                    z-index: 9998;
                ">
                    <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                        <i class="fas fa-trophy" style="color: #fbbf24; font-size: 2rem; margin-right: 0.75rem;"></i>
                        <h3 style="font-size: 1.5rem; font-weight: 900; text-transform: uppercase; font-style: italic;">${_t('presenter.reveal.top_answers', null, 'Top Respuestas')}</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${data.ranking.filter(p => p.name !== 'HOST').slice(0, 5).map((p, i) => {
                const bgColor = i === 0 ? 'background: rgba(251, 191, 36, 0.3); border: 2px solid rgb(251, 191, 36);' : 'background: rgba(255, 255, 255, 0.1);';
                return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-radius: 0.75rem; ${bgColor}">
                                <span style="font-weight: 900; font-size: 1.125rem; text-transform: uppercase;">${i + 1}. ${p.name}</span>
                                <span style="font-weight: 900; font-size: 1.25rem;">${p.pts}</span>
                            </div>`;
            }).join('')}
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', _tHtml(rankingHTML));
        }
    } else if (isWordScrambleQuestion) {
        const correctWord = data.correctWord || window.currentQuestion?.correct_word || '';
        revealWordScramble(correctWord);
        document.body.insertAdjacentHTML('beforeend', _tHtml(getWordScrambleRevealHTML(correctWord)));

        // Mostrar ranking de respuestas si hay
        if (data.ranking && !isInfoSlide && window.canShowRanking) {
            const rankingHTML = `
                <div id="ranking-card" style="
                    position: fixed;
                    top: 10rem;
                    right: 216px;
                    background: linear-gradient(135deg, rgb(147, 51, 234), rgb(37, 99, 235));
                    color: white;
                    border-radius: 1.5rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    padding: 1.5rem;
                    border: 4px solid white;
                    width: 24rem;
                    z-index: 9998;
                ">
                    <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                        <i class="fas fa-trophy" style="color: #fbbf24; font-size: 2rem; margin-right: 0.75rem;"></i>
                        <h3 style="font-size: 1.5rem; font-weight: 900; text-transform: uppercase; font-style: italic;">${_t('presenter.reveal.top_answers', null, 'Top Respuestas')}</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${data.ranking.filter(p => p.name !== 'HOST').slice(0, 5).map((p, i) => {
                const bgColor = i === 0 ? 'background: rgba(251, 191, 36, 0.3); border: 2px solid rgb(251, 191, 36);' : 'background: rgba(255, 255, 255, 0.1);';
                return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-radius: 0.75rem; ${bgColor}">
                                <span style="font-weight: 900; font-size: 1.125rem; text-transform: uppercase;">${i + 1}. ${p.name}</span>
                                <span style="font-weight: 900; font-size: 1.25rem;">${p.pts}</span>
                            </div>`;
            }).join('')}
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', _tHtml(rankingHTML));
        }
    } else if (window.currentQuestion && window.currentQuestion.question_type === 'multiple_choice') {
        // Manejo para preguntas de selección múltiple - igual que quiz
        const correctIndices = data.correctIndices || [];
        const correctSet = new Set(correctIndices);

        // Marcar opciones correctas e incorrectas en el grid (estilo quiz)
        import('./presenter-multiplechoice-layout.js?v=20260719190748').then(module => {
            module.revealMultipleChoiceInGrid(correctIndices);
        });

        // Mostrar ranking de respuestas
        if (data.ranking && !isInfoSlide && window.canShowRanking) {
            const rankingHTML = `
                <div id="ranking-card" style="
                    position: fixed;
                    top: 10rem;
                    right: 216px;
                    background: linear-gradient(135deg, rgb(147, 51, 234), rgb(37, 99, 235));
                    color: white;
                    border-radius: 1.5rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    padding: 1.5rem;
                    border: 4px solid white;
                    width: 24rem;
                    z-index: 9998;
                ">
                    <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                        <i class="fas fa-trophy" style="color: #fbbf24; font-size: 2rem; margin-right: 0.75rem;"></i>
                        <h3 style="font-size: 1.5rem; font-weight: 900; text-transform: uppercase; font-style: italic;">${_t('presenter.reveal.top_answers', null, 'Top Respuestas')}</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${data.ranking.filter(p => p.name !== 'HOST').slice(0, 5).map((p, i) => {
                const bgColor = i === 0 ? 'background: rgba(251, 191, 36, 0.3); border: 2px solid rgb(251, 191, 36);' : 'background: rgba(255, 255, 255, 0.1);';
                return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-radius: 0.75rem; ${bgColor}">
                                <span style="font-weight: 900; font-size: 1.125rem; text-transform: uppercase;">${i + 1}. ${p.name}</span>
                                <span style="font-weight: 900; font-size: 1.25rem;">${p.pts}</span>
                            </div>`;
            }).join('')}
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', _tHtml(rankingHTML));
        }
    } else {
        // Manejo original para preguntas de opción múltiple
        const tarjetas = document.querySelectorAll('#options-grid > div');
        let correctCardIndex = -1;

        const isOrderQuestion = Array.isArray(data.correctOrder) && data.correctOrder.length > 0;
        const isMatchingQuestion = Array.isArray(data.correctMatches) && data.correctMatches.length > 0;

        if (isOrderQuestion) {
            // Para preguntas de orden, siempre posicionar arriba (las justificaciones van dentro de cada opción)
            renderOrderReveal(data.correctOrder, { topOffset: '7.5rem' });
        }

        if (isMatchingQuestion) {
            renderMatchingReveal(data.correctMatches, { topOffset: '7.5rem' });
        }

        // Calcular porcentajes para preguntas quiz (si no vienen del backend)
        const quizPercentages = data.percentages ? null : calculatePercentages(data.stats, tarjetas.length);

        tarjetas.forEach((tarjeta, i) => {
            if (isOrderQuestion) {
                tarjeta.classList.add('opacity-40');
                return;
            }

            if (isMatchingQuestion) {
                tarjeta.classList.add('opacity-40');
                return;
            }

            const esCorrecta = (i === data.correctIndex);
            const votos = data.stats[i] || 0;

            if (data.percentages) {
                // Survey: mostrar porcentajes según posición (izquierda=derecha, derecha=izquierda)
                const percentage = data.percentages[i]?.percentage || 0;
                const percentageHTML = createPercentageHTML(percentage, i);
                tarjeta.innerHTML += percentageHTML;
                tarjeta.classList.add('ring-4', 'ring-blue-400');
            } else {
                // Quiz: mostrar porcentajes en esquinas y marcar correcta
                const percentage = quizPercentages[i]?.percentage || 0;
                const percentageHTML = createPercentageHTML(percentage, i);
                tarjeta.innerHTML += percentageHTML;

                if (esCorrecta) {
                    correctCardIndex = i;
                    tarjeta.classList.add('ring-8', 'ring-white', 'scale-105', 'z-10');
                    tarjeta.innerHTML += `<div class="absolute -top-4 -right-4 bg-white text-green-600 w-14 h-14 rounded-full flex items-center justify-center text-3xl border-4 border-green-500 shadow-xl"><i class="fas fa-check"></i></div>`;
                } else {
                    tarjeta.classList.add('opacity-20', 'grayscale');
                }
            }
        });

        // Mostrar tarjeta de ranking (solo para quiz)
        console.log('🔍 Verificando ranking - Existe:', !!data.ranking, 'Longitud:', data.ranking?.length, 'canShowRanking:', window.canShowRanking);

        try {
            if (data.ranking && !data.percentages && !data.isSurvey && !isInfoSlide && window.canShowRanking) {
                // Determinar posición opuesta
                let positionClass = '';
                if (correctCardIndex === 0) positionClass = 'top-24 right-6';
                else if (correctCardIndex === 1) positionClass = 'top-24 left-6';
                else if (correctCardIndex === 2) positionClass = 'top-24 right-6';
                else if (correctCardIndex === 3) positionClass = 'top-24 left-6';
                else positionClass = 'top-24 right-6';

                let rankingItems = '';
                const filteredRanking = data.ranking.filter(p => p.name !== 'HOST');

                if (filteredRanking.length > 0) {
                    rankingItems = filteredRanking.slice(0, 5).map((p, i) => {
                        const bgColor = i === 0 ? 'background: rgba(251, 191, 36, 0.3); border: 2px solid rgb(251, 191, 36);' : 'background: rgba(255, 255, 255, 0.1);';
                        return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-radius: 0.75rem; ${bgColor}">
                            <span style="font-weight: 900; font-size: 1.125rem; text-transform: uppercase;">${i + 1}. ${p.name}</span>
                            <span style="font-weight: 900; font-size: 1.25rem;">${p.pts}</span>
                        </div>`;
                    }).join('');
                } else {
                    rankingItems = `<div style="text-align: center; color: rgba(255, 255, 255, 0.7); font-style: italic;">${_t('presenter.reveal.no_scores_yet', null, 'Aún no hay puntuaciones')}</div>`;
                }

                const rankingHTML = `
                    <div id="ranking-card" style="
                        position: fixed;
                        top: 22rem;
                        ${positionClass.includes('right') ? 'right: 216px;' : 'left: 1.5rem;'}
                        background: linear-gradient(135deg, rgb(147, 51, 234), rgb(37, 99, 235));
                        color: white;
                        border-radius: 1.5rem;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                        padding: 1.5rem;
                        border: 4px solid white;
                        width: 24rem;
                        z-index: 9998;
                    ">
                        <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                            <i class="fas fa-trophy" style="color: #fbbf24; font-size: 2rem; margin-right: 0.75rem;"></i>
                            <h3 style="font-size: 1.5rem; font-weight: 900; text-transform: uppercase; font-style: italic;">Top 5</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            ${rankingItems}
                        </div>
                    </div>
                `;
                console.log('✅ Insertando tarjeta de ranking en posición:', positionClass);
                document.body.insertAdjacentHTML('beforeend', _tHtml(rankingHTML));
            } else {
                console.log('⚠️ No se muestra ranking - ranking:', !!data.ranking, 'percentages:', !!data.percentages, 'canShow:', window.canShowRanking);
            }
        } catch (error) {
            console.error('❌ Error al mostrar ranking:', error);
        }

        // Mostrar tarjeta de justificación (solo para quiz, NO para preguntas de orden ni matching)
        if (data.justification && !data.percentages && !data.isSurvey && !isInfoSlide && !isOrderQuestion && !isMatchingQuestion && data.justification.trim() !== '') {
            console.log('✅ Mostrando tarjeta de justificación');
            const justificationHTML = `
                <div class="justification-card" style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 200px;
                    background: linear-gradient(to right, #9333ea, #2563eb);
                    color: white;
                    padding: 3rem 2rem;
                    box-shadow: 0 10px 50px rgba(0,0,0,0.3);
                    border-bottom: 8px solid white;
                    z-index: 9999;
                    min-height: 180px;
                ">
                    <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 2rem; height: 100%;">
                        <div style="background-color: rgba(255, 255, 255, 0.2); padding: 1.5rem; border-radius: 1.5rem; flex-shrink: 0;">
                            <i class="fas fa-lightbulb" style="font-size: 4rem; color: #fde047;"></i>
                        </div>
                        <div style="flex: 1;">
                            <h3 style="font-size: 2rem; font-weight: 900; text-transform: uppercase; font-style: italic; margin-bottom: 1rem; letter-spacing: 0.05em;">${_t('presenter.reveal.why_correct', null, '¿Por qué es correcta?')}</h3>
                            <p style="font-size: 1.5rem; font-weight: 500; line-height: 1.75;">${data.justification}</p>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', _tHtml(justificationHTML));
        } else {
            console.log('⚠️ No hay justificación para mostrar');
        }
    }

    // Mostrar botón de siguiente
    const btnNext = document.getElementById('btn-next');
    if (btnNext) {
        const isLast = getCurrentQuestionIndex() >= getTotalQuestions() - 1;
        let btnText = '';
        let btnIcon = '';

        if (window.isTrivialGame) {
            btnText = _t('presenter.game.next_round', null, 'Siguiente Ronda');
            btnIcon = 'fa-rotate-right';
        } else {
            if (isLast) {
                btnText = _t('presenter.game.view_ranking', null, 'Ver Ránking');
                btnIcon = 'fa-trophy';
            } else {
                btnText = _t('presenter.game.next_question', null, 'Siguiente Pregunta');
                btnIcon = 'fa-chevron-right';
            }
        }

        btnNext.innerHTML = _tHtml(`${btnText} <i class="fas ${btnIcon} ml-2"></i>`);
        btnNext.classList.remove('hidden');
    } else {
        console.log('⚠️ btn-next no existe (probablemente ya se mostró el podio)');
    }
}

function renderOrderReveal(correctOrder, options = {}) {
    const existing = document.getElementById('order-reveal-card');
    if (existing) existing.remove();

    const topOffset = options.topOffset || '7.5rem';

    const items = correctOrder.map((item, index) => {
        const text = item?.text || '';
        const justification = item?.justification || '';

        return `
            <div style="display:flex; align-items:center; gap:0.75rem; background: rgba(255,255,255,0.12); border: 2px solid rgba(255,255,255,0.3); border-radius: 1rem; padding: 0.75rem 1rem;">
                <span style="background: rgba(0,0,0,0.35); width: 2.25rem; height: 2.25rem; flex-shrink: 0; border-radius: 9999px; display:flex; align-items:center; justify-content:center; font-weight: 900;">${index + 1}</span>
                <div style="display: flex; flex-direction: column; gap: 0.25rem; flex: 1;">
                    <span style="font-weight: 800; text-transform: uppercase; font-style: italic;">${text}</span>
                    ${justification ? `<span style="font-size: 0.875rem; opacity: 0.85; font-weight: 500;">${justification}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');

    const html = `
        <div id="order-reveal-card" style="position: fixed; top: ${topOffset}; left: 50%; transform: translateX(-50%); width: 520px; max-width: 80vw; background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(79,70,229,0.95)); color: white; border-radius: 2rem; border: 4px solid white; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); padding: 1.5rem; z-index: 9998;">
            <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom: 1rem;">
                <i class="fas fa-sort-amount-down" style="font-size: 1.75rem; color: #a7f3d0;"></i>
                <h3 style="font-size: 1.5rem; font-weight: 900; text-transform: uppercase; font-style: italic; margin: 0;">${_t('presenter.reveal.correct_order', null, 'Orden correcto')}</h3>
            </div>
            <div style="display:flex; flex-direction: column; gap: 0.75rem;">${items}</div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', _tHtml(html));
}

function renderMatchingReveal(correctMatches, options = {}) {
    const existing = document.getElementById('matching-reveal-card');
    if (existing) existing.remove();

    const topOffset = options.topOffset || '7.5rem';

    const rows = correctMatches.map((pair, index) => `
        <div style="display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; gap:0.5rem; background: rgba(255,255,255,0.12); border: 2px solid rgba(255,255,255,0.3); border-radius: 1rem; padding: 0.6rem 0.75rem;">
            <span style="font-weight: 800; text-transform: uppercase; font-style: italic; text-align:right;">${pair.leftText}</span>
            <span style="color: #fde047; font-size: 1.2rem; font-weight: 900; flex-shrink: 0;">↔</span>
            <span style="font-weight: 800; text-transform: uppercase; font-style: italic; text-align:left;">${pair.rightText}</span>
        </div>
    `).join('');

    const html = `
        <div id="matching-reveal-card" style="position: fixed; top: ${topOffset}; left: 50%; transform: translateX(-50%); width: 560px; max-width: 82vw; background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(180,83,9,0.9)); color: white; border-radius: 2rem; border: 4px solid white; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); padding: 1.5rem; z-index: 9998;">
            <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom: 1rem;">
                <i class="fas fa-columns" style="font-size: 1.75rem; color: #fde047;"></i>
                <h3 style="font-size: 1.5rem; font-weight: 900; text-transform: uppercase; font-style: italic; margin: 0;">${_t('presenter.reveal.correct_pairs', null, 'Pares correctos')}</h3>
            </div>
            <div style="display:flex; flex-direction: column; gap: 0.6rem;">${rows}</div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', _tHtml(html));
}
