window.TVApp = window.TVApp || {};
window.TVApp.RenderSlides = (function () {
    'use strict';

    const getEl = window.TVApp.Utils.getEl;
    const clearCache = window.TVApp.Utils.clearCache;
    const escapeHtml = window.TVApp.Utils.escapeHtml;
    const stopQuestionAudio = window.TVApp.Audio.stopQuestionAudio;

    function resetTimers() {
        const state = window.TVApp.State;
        if (state.rafHandle) {
            cancelAnimationFrame(state.rafHandle);
            state.rafHandle = null;
        }
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        const overlay = getEl('countdown-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    /** Pie de diapositiva (core/slide-footer.js escapa el texto). */
    function appendFooter(slide) {
        const html = window.XiroSlideFooter ? window.XiroSlideFooter.footerHtml(slide, 'tv') : '';
        if (html) getEl('main-container').insertAdjacentHTML('beforeend', html);
    }

    function renderCommentSlide(slide) {
        resetTimers();
        stopQuestionAudio();

        const state = window.TVApp.State;
        let playersHTML = '';
        for (const nick in state.playersData) {
            playersHTML += '<div class="manual-points-player"><div class="manual-points-player-name">' + escapeHtml(nick) + '</div><div class="manual-points-player-score">' + (state.playersData[nick].score || 0) + ' pts</div><div class="manual-points-buttons"><button class="btn-points-1" data-tv-action="assign-manual-points" data-nickname="' + escapeHtml(nick) + '" data-points="1">+1</button><button class="btn-points-5" data-tv-action="assign-manual-points" data-nickname="' + escapeHtml(nick) + '" data-points="5">+5</button><button class="btn-points-10" data-tv-action="assign-manual-points" data-nickname="' + escapeHtml(nick) + '" data-points="10">+10</button></div></div>';
        }

        const isTrivial = window.isTrivialGame;
        const isLast = state.totalQuestions > 0 && state.currentQuestionIndex >= state.totalQuestions - 1;
        const nextBtnText = (isLast && !isTrivial) ? 'Ver Ránking ★' : 'Siguiente →';

        getEl('main-container').innerHTML = _tHtml('<div class="comment-slide"><div class="comment-icon">💬</div><h1 class="comment-text" style="white-space:pre-line">' + escapeHtml(slide.comment_text) + '</h1><p style="font-size:18px;color:#999;margin:20px 0">El presentador puede asignar puntos manualmente</p><div class="manual-points"><div class="manual-points-title">Asignar Puntos</div>' + playersHTML + '</div></div><button id="btn-next" data-tv-action="next-question" class="btn btn-secondary btn-next">' + nextBtnText + '</button>');
        appendFooter(slide);
        clearCache();
    }

    function renderInfoSlide(slide) {
        resetTimers();
        stopQuestionAudio();

        const state = window.TVApp.State;
        const isTrivial = window.isTrivialGame;
        const isLast = state.totalQuestions > 0 && state.currentQuestionIndex >= state.totalQuestions - 1;
        const nextBtnText = (isLast && !isTrivial) ? 'Ver Ránking ★' : 'Siguiente →';

        getEl('main-container').innerHTML = _tHtml('<div class="comment-slide" style="background:#9a6ba9"><div class="comment-icon">ℹ️</div><h1 class="comment-text" style="white-space:pre-line">' + escapeHtml(slide.comment_text) + '</h1><p style="font-size:18px;color:#e0e0e0;margin:20px 0">Información - Sin asignación de puntos</p></div><button id="btn-next" data-tv-action="next-question" class="btn btn-secondary btn-next">' + nextBtnText + '</button>');
        appendFooter(slide);
        clearCache();
    }

    function renderTextSlide(slide) {
        resetTimers();
        stopQuestionAudio();

        const state = window.TVApp.State;
        const title = slide.slide_title || '';
        const body = slide.slide_body || '';
        const isTrivial = window.isTrivialGame;
        const isLast = state.totalQuestions > 0 && state.currentQuestionIndex >= state.totalQuestions - 1;
        const nextBtnText = (isLast && !isTrivial) ? 'Ver Ránking ★' : 'Siguiente →';

        getEl('main-container').innerHTML = _tHtml('<div class="comment-slide" style="background:radial-gradient(circle at 15% 20%, rgba(56,189,248,.25), transparent 35%), radial-gradient(circle at 85% 15%, rgba(244,114,182,.2), transparent 32%), radial-gradient(circle at 50% 85%, rgba(251,191,36,.18), transparent 38%), linear-gradient(135deg,#3f2746 0%,#0e7490 45%,#1d4ed8 100%)"><div class="comment-icon">📝</div><div style="background:rgba(0,0,0,.32);padding:28px 34px;border-radius:24px;border:1px solid rgba(255,255,255,.15);max-width:1080px;margin:0 auto"><h1 class="comment-text" style="white-space:pre-line">' + escapeHtml(title) + '</h1><div style="font-size:28px;line-height:1.2;color:#f8fafc;max-width:1000px;white-space:pre-line;margin:0 auto">' + escapeHtml(body) + '</div></div><p style="font-size:18px;color:#e2e8f0;margin:20px 0">Información - Sin asignación de puntos</p></div><button id="btn-next" data-tv-action="next-question" class="btn btn-secondary btn-next">' + nextBtnText + '</button>');
        appendFooter(slide);
        clearCache();
    }

    function renderImageSlide(slide) {
        resetTimers();
        stopQuestionAudio();

        const state = window.TVApp.State;
        const imageUrl = slide.slide_image || '';
        const isTrivial = window.isTrivialGame;
        const isLast = state.totalQuestions > 0 && state.currentQuestionIndex >= state.totalQuestions - 1;
        const nextBtnText = (isLast && !isTrivial) ? 'Ver Ránking ★' : 'Siguiente →';
        const imgHtml = imageUrl ? '<img src="' + escapeHtml(imageUrl) + '" style="max-width:100%;max-height:90vh;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.5);" />' : '<div style="color:#fff;font-size:3rem;opacity:.4"><i class="fas fa-image"></i></div>';

        getEl('main-container').innerHTML = _tHtml('<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#111827;min-height:100vh;">' + imgHtml + '</div><button id="btn-next" data-tv-action="next-question" class="btn btn-secondary btn-next">' + nextBtnText + '</button>');
        appendFooter(slide);
        clearCache();
    }

    function renderTextImageSlide(slide) {
        resetTimers();
        stopQuestionAudio();

        const state = window.TVApp.State;
        const title = slide.slide_title || '';
        const body = slide.slide_body || '';
        const imageUrl = slide.slide_image || '';
        const pos = slide.slide_image_position || 'right';
        const isTrivial = window.isTrivialGame;
        const isLast = state.totalQuestions > 0 && state.currentQuestionIndex >= state.totalQuestions - 1;
        const nextBtnText = (isLast && !isTrivial) ? 'Ver Ránking ★' : 'Siguiente →';

        const textCol = '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;margin-right:20px;"><h1 style="font-weight:900;text-transform:uppercase;font-style:italic;color:#fff;line-height:1.15;font-size:3rem;font-size:clamp(2rem,4.5vw,4rem);white-space:pre-line;">' + escapeHtml(title) + '</h1><div style="background:rgba(0,0,0,.32);padding:28px 34px;border-radius:24px;border:1px solid rgba(255,255,255,.15);margin-top:20px;"><div style="font-size:1.4rem;font-size:clamp(1.1rem,2.5vw,2rem);color:#f1f5f9;font-weight:600;white-space:pre-line;">' + escapeHtml(body) + '</div></div></div>';
        const imgHtml = imageUrl ? '<img src="' + escapeHtml(imageUrl) + '" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.5);" />' : '<div style="color:rgba(255,255,255,.3);text-align:center;font-size:4rem;"><i class="fas fa-image"></i></div>';
        const imgCol = '<div style="flex:1;display:flex;align-items:center;justify-content:center;">' + imgHtml + '</div>';
        const leftCol = pos === 'left' ? imgCol : textCol;
        const rightCol = pos === 'left' ? textCol : imgCol;

        getEl('main-container').innerHTML = _tHtml('<div class="comment-slide" style="background:radial-gradient(circle at 15% 20%,rgba(56,189,248,.25),transparent 35%),radial-gradient(circle at 85% 15%,rgba(244,114,182,.2),transparent 32%),radial-gradient(circle at 50% 85%,rgba(251,191,36,.18),transparent 38%),linear-gradient(135deg,#3f2746 0%,#0e7490 45%,#1d4ed8 100%)"><div style="display:flex;width:100%;height:100%;align-items:stretch;">' + leftCol + rightCol + '</div></div><button id="btn-next" data-tv-action="next-question" class="btn btn-secondary btn-next">' + nextBtnText + '</button>');
        appendFooter(slide);
        clearCache();
    }

    /** Diapositiva de vídeo: la TV es una pantalla de presentador y lo reproduce a toda pantalla. */
    function renderVideoSlide(slide) {
        resetTimers();
        stopQuestionAudio();

        const state = window.TVApp.State;
        const source = slide.video_source || null;
        const isTrivial = window.isTrivialGame;
        const isLast = state.totalQuestions > 0 && state.currentQuestionIndex >= state.totalQuestions - 1;
        const nextBtnText = (isLast && !isTrivial) ? 'Ver Ránking ★' : 'Siguiente →';
        const mediaStyle = 'width:100%;height:100%;object-fit:contain;border:0;background:#000;display:block;';
        let mediaHtml = '<div style="color:rgba(255,255,255,.5);text-align:center;font-size:2rem;font-weight:700;"><i class="fas fa-film" style="font-size:6rem;"></i><p style="margin-top:1.5rem;">No se puede reproducir este vídeo</p></div>';
        if (source && source.kind === 'file' && source.url) {
            mediaHtml = '<video id="tv-slide-video" src="' + escapeHtml(source.url) + '" autoplay controls playsinline preload="auto" style="' + mediaStyle + '"></video>';
        } else if (source && source.embedUrl) {
            mediaHtml = '<iframe src="' + escapeHtml(source.embedUrl + '&autoplay=1') + '" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="Vídeo" style="' + mediaStyle + '"></iframe>';
        }

        // Hueco inferior para que «Siguiente» no tape los controles del vídeo
        getEl('main-container').innerHTML = _tHtml('<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100vh;background:#111827;padding:20px 20px 110px;box-sizing:border-box;">' + mediaHtml + '</div><button id="btn-next" data-tv-action="next-question" class="btn btn-secondary btn-next">' + nextBtnText + '</button>');
        appendFooter(slide);
        clearCache();
    }

    return {
        renderCommentSlide: renderCommentSlide,
        renderInfoSlide: renderInfoSlide,
        renderTextSlide: renderTextSlide,
        renderImageSlide: renderImageSlide,
        renderTextImageSlide: renderTextImageSlide,
        renderVideoSlide: renderVideoSlide,
        resetTimers: resetTimers
    };
})();
