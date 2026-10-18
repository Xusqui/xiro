/**
 * @fileoverview Diapositiva de vídeo en el móvil del jugador: el vídeo solo se ve en la
 * pantalla del presentador, así que aquí solo se avisa de que miren allí.
 */

import { getNickname, clearOrderState, setCanAnswer, setCurrentSlideType } from './player-state.js?v=20260922172926';
import { escapeHtml } from '../core/sanitize.js?v=20260922172926';
import { appendSlideFooter } from '../core/slide-footer-dom.js?v=20261017120000';

export function renderizarSlideVideo(slide) {
    clearOrderState();
    setCanAnswer(false);
    setCurrentSlideType('video');

    document.body.innerHTML = _tHtml(`
        <div class="h-screen w-screen flex flex-col items-center justify-center text-white text-center p-8 overflow-hidden" style="background: radial-gradient(circle at 50% 30%, rgba(239,68,68,0.25), transparent 45%), linear-gradient(135deg, #111827 0%, #3f2746 60%, #7f1d1d 100%);">
            <div class="bg-aubergine-600 px-6 py-3 rounded-full mb-8 shadow-2xl">
                <p class="font-black text-xl uppercase">${escapeHtml(getNickname())}</p>
            </div>
            <div class="inline-block bg-red-600 text-white px-6 py-3 rounded-full mb-8 shadow-2xl border border-white/20">
                <i class="fas fa-film text-3xl"></i>
            </div>
            <h1 class="text-5xl md:text-7xl font-black uppercase italic mb-6 drop-shadow-2xl leading-tight animate-fade-in">${_t('player.slides.video_title', null, 'Vídeo')}</h1>
            <p class="text-2xl text-aubergine-50 font-semibold">${_t('player.slides.video_watch_screen', null, 'Mira la pantalla del presentador')}</p>
            <div class="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-aubergine-500 via-plum-500 to-aubergine-400"></div>
        </div>
    `);
    appendSlideFooter(document.body, slide, 'player');
}
