/**
 * @fileoverview Renderizado de slides (comentarios e info)
 */

import { getIsTeamMode, getTeamConfig, getCurrentQuestionIndex, getTotalQuestions, getPlayersData } from './presenter-state.js?v=20260917154426';
import { removeFloatingCards, showAbandonButton, showTerminateButton } from './presenter-utils.js?v=20260917154426';
import { cleanupRevealElements } from './presenter-reveal.js?v=20260917154426';
import { cleanupPodio } from './presenter-podio.js?v=20260917154426';
import { showChamaleonOverlay } from './presenter-chamaleon.js?v=20260917154426';
import { escapeHtml, sanitizeResourceUrl, encodeInlineArg } from '../core/sanitize.js?v=20260917154426';

export { renderTextImageSlide } from './presenter-slide-text-image.js?v=20260917154426';

/**
 * Renderizar slide de comentario (con asignación manual de puntos)
 */
export function renderCommentSlide(slide) {
    removeFloatingCards();
    cleanupRevealElements();
    cleanupPodio();
    showChamaleonOverlay();

    window.canShowRanking = false;
    window.currentSlideType = 'comment';
    window.currentQuestionType = slide?.question_type || null;

    // Limpiar timer de pregunta anterior
    clearInterval(window.timerInterval);
    window.timerInterval = null;

    const lobbyMain = document.getElementById('lobby-main');
    const isTeamMode = getIsTeamMode();
    const teamConfig = getTeamConfig();
    const playersData = getPlayersData();

    let pointsGrid = '';

    if (isTeamMode && teamConfig && teamConfig.teams) {
        const teamColors = {
            red: 'bg-red-600',
            blue: 'bg-blue-600',
            green: 'bg-green-600',
            yellow: 'bg-yellow-500',
            purple: 'bg-purple-600',
            pink: 'bg-pink-600',
            orange: 'bg-orange-600',
            cyan: 'bg-cyan-600',
            lime: 'bg-lime-500'
        };

        pointsGrid = teamConfig.teams.map(team => {
            const safeTeamName = escapeHtml(team.name);
            const encodedTeamName = encodeInlineArg(team.name);
            return `
                <div class="${teamColors[team.color] || 'bg-purple-600'} backdrop-blur rounded-xl p-4 flex flex-col items-center gap-3 border-2 border-white/30">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-users text-white text-xl"></i>
                        <span class="text-white font-bold text-lg truncate w-full text-center">${safeTeamName}</span>
                    </div>
                    <span class="text-white/90 text-sm">${team.players.length} ${team.players.length === 1 ? _t('presenter.slides.player_singular', null, 'jugador') : _t('presenter.slides.player_plural', null, 'jugadores')}</span>
                    <div class="flex gap-2">
                        <button data-presenter-action="assign-points" data-target-name="${encodedTeamName}" data-points="1" data-is-team="true" class="bg-green-500 hover:bg-green-600 text-white w-12 h-12 rounded-full font-bold transition shadow-lg text-lg">
                            +1
                        </button>
                        <button data-presenter-action="assign-points" data-target-name="${encodedTeamName}" data-points="5" data-is-team="true" class="bg-blue-500 hover:bg-blue-600 text-white w-12 h-12 rounded-full font-bold transition shadow-lg text-lg">
                            +5
                        </button>
                        <button data-presenter-action="assign-points" data-target-name="${encodedTeamName}" data-points="10" data-is-team="true" class="bg-purple-500 hover:bg-purple-600 text-white w-12 h-12 rounded-full font-bold transition shadow-lg text-lg">
                            +10
                        </button>
                    </div>
                    <p class="text-white/70 text-xs italic text-center mt-1">${_t('presenter.slides.points_per_player', null, 'Los puntos se suman a cada jugador')}</p>
                </div>
            `;
        }).join('');
    } else {
        // MODO INDIVIDUAL
        pointsGrid = Object.keys(playersData).map(nick => {
            const safeNick = escapeHtml(nick);
            const encodedNick = encodeInlineArg(nick);
            return `
            <div class="bg-white/20 backdrop-blur rounded-xl p-4 flex flex-col items-center gap-2">
                <span class="text-white font-bold text-sm truncate w-full text-center">${safeNick}</span>
                <span class="text-white/80 text-xs">${playersData[nick].score || 0} pts</span>
                <div class="flex gap-2">
                    <button data-presenter-action="assign-points" data-target-name="${encodedNick}" data-points="1" data-is-team="false" class="bg-green-500 hover:bg-green-600 text-white w-10 h-10 rounded-full font-bold transition">
                        +1
                    </button>
                    <button data-presenter-action="assign-points" data-target-name="${encodedNick}" data-points="5" data-is-team="false" class="bg-blue-500 hover:bg-blue-600 text-white w-10 h-10 rounded-full font-bold transition">
                        +5
                    </button>
                    <button data-presenter-action="assign-points" data-target-name="${encodedNick}" data-points="10" data-is-team="false" class="bg-purple-500 hover:bg-purple-600 text-white w-10 h-10 rounded-full font-bold transition">
                        +10
                    </button>
                </div>
            </div>
        `;
        }).join('');
    }

    const safeCommentText = escapeHtml(slide?.comment_text || '');

    lobbyMain.style.display = 'flex';
    lobbyMain.innerHTML = _tHtml(`
        <div class="h-full w-full flex flex-col items-center justify-center pt-10 px-10 pb-16">
            <div class="text-center mb-10">
                <div class="inline-block bg-amber-500 text-white px-6 py-3 rounded-full mb-8">
                    <i class="fas fa-comment text-3xl"></i>
                </div>
                <h1 class="text-8xl font-black text-center uppercase italic mb-6 drop-shadow-lg text-white leading-tight">${safeCommentText}</h1>
                <p class="text-2xl text-slate-300 italic">${_t('presenter.slides.assign_manually', null, 'El presentador puede asignar puntos manualmente')}${isTeamMode ? ' ' + _t('presenter.slides.to_teams', null, 'a los equipos') : ''}</p>
            </div>
            
            <div class="w-full max-w-4xl bg-white/10 backdrop-blur-sm rounded-3xl p-8 mt-8">
                <h3 class="text-2xl font-bold text-white mb-4 text-center">${_t('presenter.slides.assign_points', null, 'Asignar Puntos')} ${isTeamMode ? _t('presenter.slides.per_team', null, 'por Equipo') : ''}</h3>
                <div id="manual-points-grid" class="grid ${isTeamMode ? 'grid-cols-2' : 'grid-cols-3'} gap-3 max-h-96 overflow-y-auto">
                    ${pointsGrid}
                </div>
            </div>
            
            <button id="btn-next" data-presenter-action="next-question" class="fixed bottom-10 right-10 bg-white text-slate-900 px-10 py-5 rounded-3xl font-black text-2xl shadow-2xl hover:bg-purple-600 hover:text-white transition italic uppercase" style="z-index: 10000;">
                ${window.isTrivialGame ? _t('presenter.slides.next_round', null, 'Siguiente Ronda') : (getCurrentQuestionIndex() >= getTotalQuestions() - 1 ? _t('presenter.slides.view_ranking', null, 'Ver Ránking') : _t('presenter.slides.next', null, 'Siguiente'))}
                <i class="fas ${window.isTrivialGame ? 'fa-rotate-right' : (getCurrentQuestionIndex() >= getTotalQuestions() - 1 ? 'fa-trophy' : 'fa-chevron-right')} ml-2"></i>
            </button>
        </div>
    `);
}

/**
 * Renderizar slide de información (sin puntos)
 */
export function renderInfoSlide(slide) {
    removeFloatingCards();
    cleanupRevealElements();
    cleanupPodio();
    showChamaleonOverlay();

    window.canShowRanking = false;
    window.currentSlideType = 'info';
    window.currentQuestionType = slide?.question_type || null;

    // Limpiar timer de pregunta anterior
    clearInterval(window.timerInterval);
    window.timerInterval = null;

    const safeCommentText = escapeHtml(slide?.comment_text || '');

    const lobbyMain = document.getElementById('lobby-main');
    lobbyMain.style.display = 'flex';
    lobbyMain.innerHTML = _tHtml(`
        <div class="h-full w-full flex flex-col items-center justify-center pt-10 px-10 pb-16">
            <div class="text-center mb-10">
                <div class="inline-block bg-blue-500 text-white px-6 py-3 rounded-full mb-8">
                    <i class="fas fa-info-circle text-3xl"></i>
                </div>
                <h1 class="text-8xl font-black text-center uppercase italic mb-6 drop-shadow-lg text-white leading-tight" style="white-space: pre-line;">${safeCommentText}</h1>
                <p class="text-2xl text-slate-300 italic">${_t('presenter.slides.info_no_points', null, 'Información - Sin asignación de puntos')}</p>
            </div>
            
            <button id="btn-next" data-presenter-action="next-question" class="fixed bottom-10 right-10 bg-white text-slate-900 px-10 py-5 rounded-3xl font-black text-2xl shadow-2xl hover:bg-blue-600 hover:text-white transition italic uppercase" style="z-index: 10000;">
                ${window.isTrivialGame ? _t('presenter.slides.next_round', null, 'Siguiente Ronda') : (getCurrentQuestionIndex() >= getTotalQuestions() - 1 ? _t('presenter.slides.view_ranking', null, 'Ver Ránking') : _t('presenter.slides.next', null, 'Siguiente'))}
                <i class="fas ${window.isTrivialGame ? 'fa-rotate-right' : (getCurrentQuestionIndex() >= getTotalQuestions() - 1 ? 'fa-trophy' : 'fa-chevron-right')} ml-2"></i>
            </button>
        </div>
    `);
    showAbandonButton();
    showTerminateButton();
}

/**
 * Renderizar slide de texto (título + cuerpo, sin puntos)
 */
export function renderTextSlide(slide) {
    removeFloatingCards();
    cleanupRevealElements();
    cleanupPodio();
    showChamaleonOverlay();

    window.canShowRanking = false;
    window.currentSlideType = 'text';
    window.currentQuestionType = slide?.question_type || null;

    clearInterval(window.timerInterval);
    window.timerInterval = null;

    const lobbyMain = document.getElementById('lobby-main');
    lobbyMain.style.display = 'flex';

    const title = escapeHtml(slide?.slide_title || '');
    const body = escapeHtml(slide?.slide_body || '');

    lobbyMain.innerHTML = _tHtml(`
        <div class="h-full w-full flex flex-col items-center justify-center pt-10 px-10 pb-28 gap-8" style="background: radial-gradient(circle at 20% 20%, rgba(56,189,248,0.25), transparent 35%), radial-gradient(circle at 80% 15%, rgba(236,72,153,0.22), transparent 35%), radial-gradient(circle at 50% 85%, rgba(251,191,36,0.2), transparent 40%), linear-gradient(135deg, #312e81 0%, #6d28d9 40%, #1d4ed8 100%);">
            <div class="text-center" style="width: 85%; max-width: 1400px;">
                <h1 class="font-black uppercase italic drop-shadow-lg text-white leading-tight" style="white-space: pre-line; font-size: clamp(2.4rem, 5.2vw, 6rem);">${title}</h1>
            </div>

            <div class="text-center" style="width: 85%; max-width: 1400px;">
                <div class="bg-black/35 backdrop-blur-sm rounded-3xl px-10 py-8 border border-white/15 shadow-2xl">
                    <div class="text-slate-100 font-semibold" style="white-space: pre-line; font-size: clamp(1.4rem, 3vw, 3rem); line-height: 1.35;">${body}</div>
                </div>
            </div>

            <button id="btn-next" data-presenter-action="next-question" class="fixed bottom-10 right-10 bg-white text-slate-900 px-10 py-5 rounded-3xl font-black text-2xl shadow-2xl hover:bg-indigo-600 hover:text-white transition italic uppercase" style="z-index: 10000;">
                ${window.isTrivialGame ? _t('presenter.slides.next_round', null, 'Siguiente Ronda') : (getCurrentQuestionIndex() >= getTotalQuestions() - 1 ? _t('presenter.slides.view_ranking', null, 'Ver Ránking') : _t('presenter.slides.next', null, 'Siguiente'))}
                <i class="fas ${window.isTrivialGame ? 'fa-rotate-right' : (getCurrentQuestionIndex() >= getTotalQuestions() - 1 ? 'fa-trophy' : 'fa-chevron-right')} ml-2"></i>
            </button>
        </div>
    `);
    showAbandonButton();
    showTerminateButton();
}

/**
 * Renderizar slide de imagen (solo imagen a pantalla completa, sin puntos)
 */
export function renderImageSlide(slide) {
    removeFloatingCards();
    cleanupRevealElements();
    cleanupPodio();
    showChamaleonOverlay();

    window.canShowRanking = false;
    window.currentSlideType = 'image';
    window.currentQuestionType = slide?.question_type || null;

    clearInterval(window.timerInterval);
    window.timerInterval = null;

    const lobbyMain = document.getElementById('lobby-main');
    lobbyMain.style.display = 'flex';

    const imageUrl = sanitizeResourceUrl(slide?.slide_image || '');

    lobbyMain.innerHTML = _tHtml(`
        <div class="h-full w-full flex items-center justify-center" style="background: #111827; padding: 0; margin: 0;">
            ${imageUrl
            ? `<img src="${imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; display: block;" />`
            : '<div style="color: rgba(255,255,255,0.3); text-align: center;"><i class="fas fa-image fa-6x"></i></div>'
        }
            <button id="btn-next" data-presenter-action="next-question" class="fixed bottom-10 right-10 bg-white text-slate-900 px-10 py-5 rounded-3xl font-black text-2xl shadow-2xl hover:bg-indigo-600 hover:text-white transition italic uppercase" style="z-index: 10000;">
                ${window.isTrivialGame ? _t('presenter.slides.next_round', null, 'Siguiente Ronda') : (getCurrentQuestionIndex() >= getTotalQuestions() - 1 ? _t('presenter.slides.view_ranking', null, 'Ver Ránking') : _t('presenter.slides.next', null, 'Siguiente'))}
                <i class="fas ${window.isTrivialGame ? 'fa-rotate-right' : (getCurrentQuestionIndex() >= getTotalQuestions() - 1 ? 'fa-trophy' : 'fa-chevron-right')} ml-2"></i>
            </button>
        </div>
    `);
    showAbandonButton();
    showTerminateButton();
}
