/**
 * @fileoverview Renderizado de slide text-image para el presentador.
 * Muestra texto e imagen en dos columnas con layout configurable.
 */

import { getCurrentQuestionIndex, getTotalQuestions } from './presenter-state.js?v=20260708113433';
import { removeFloatingCards, showAbandonButton, showTerminateButton } from './presenter-utils.js?v=20260708113433';
import { cleanupRevealElements } from './presenter-reveal.js?v=20260708113433';
import { cleanupPodio } from './presenter-podio.js?v=20260708113433';
import { showChamaleonOverlay } from './presenter-chamaleon.js?v=20260708113433';

export function renderTextImageSlide(slide) {
    removeFloatingCards();
    cleanupRevealElements();
    cleanupPodio();
    showChamaleonOverlay();

    window.canShowRanking = false;
    window.currentSlideType = 'text-image';
    window.currentQuestionType = slide?.question_type || null;

    clearInterval(window.timerInterval);
    window.timerInterval = null;

    const lobbyMain = document.getElementById('lobby-main');
    lobbyMain.style.display = 'flex';

    const title = slide?.slide_title || '';
    const body = slide?.slide_body || '';
    const imageUrl = slide?.slide_image || '';
    const pos = slide?.slide_image_position || 'right';

    const textCol = `
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:1.5rem;">
            <h1 style="font-weight:900; text-transform:uppercase; font-style:italic; color:#fff; line-height:1.15; font-size:clamp(2rem,4.5vw,5rem); white-space:pre-line; text-shadow:0 4px 24px rgba(0,0,0,.5);">${title}</h1>
            <div class="bg-black/35 backdrop-blur-sm rounded-3xl px-8 py-7 border border-white/15 shadow-2xl">
                <div style="color:#f1f5f9; font-weight:600; white-space:pre-line; font-size:clamp(1.2rem,2.5vw,2.4rem); line-height:1.35;">${body}</div>
            </div>
        </div>`;

    const imgCol = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">
            ${imageUrl
            ? `<img src="${imageUrl}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,0.5);" />`
            : '<div style="color:rgba(255,255,255,.3);text-align:center;font-size:4rem;"><i class="fas fa-image"></i></div>'
        }
        </div>`;

    const leftCol = pos === 'left' ? imgCol : textCol;
    const rightCol = pos === 'left' ? textCol : imgCol;

    const isLast = getCurrentQuestionIndex() >= getTotalQuestions() - 1;
    const btnLabel = window.isTrivialGame ? _t('presenter.slides.next_round', null, 'Siguiente Ronda') : (isLast ? _t('presenter.slides.view_ranking', null, 'Ver Ránking') : _t('presenter.slides.next', null, 'Siguiente'));
    const btnIcon = window.isTrivialGame ? 'fa-rotate-right' : (isLast ? 'fa-trophy' : 'fa-chevron-right');

    lobbyMain.innerHTML = _tHtml(`
        <div class="h-full w-full flex items-center px-10 pb-20 pt-8 gap-8" style="background:radial-gradient(circle at 20% 20%,rgba(56,189,248,.25),transparent 35%),radial-gradient(circle at 80% 15%,rgba(236,72,153,.22),transparent 35%),radial-gradient(circle at 50% 85%,rgba(251,191,36,.2),transparent 40%),linear-gradient(135deg,#312e81 0%,#6d28d9 40%,#1d4ed8 100%);">
            ${leftCol}
            ${rightCol}
            <button id="btn-next" data-presenter-action="next-question" class="fixed bottom-10 right-10 bg-white text-slate-900 px-10 py-5 rounded-3xl font-black text-2xl shadow-2xl hover:bg-indigo-600 hover:text-white transition italic uppercase" style="z-index:10000;">
                ${btnLabel} <i class="fas ${btnIcon} ml-2"></i>
            </button>
        </div>
    `);

    showAbandonButton();
    showTerminateButton();
}
