/**
 * @fileoverview Diapositiva libre en el móvil del jugador: el mismo lienzo que el presentador,
 * escalado a la pantalla. Los vídeos no se reproducen aquí (el jugador no recibe su URL):
 * su rectángulo muestra «Mira la pantalla del presentador».
 */

import { getNickname, clearOrderState, setCanAnswer, setCurrentSlideType } from './player-state.js?v=20260922172926';
import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

let mounted = null;

export function renderizarSlideLienzo(slide) {
    clearOrderState();
    setCanAnswer(false);
    setCurrentSlideType('canvas');

    if (mounted) mounted.destroy();
    mounted = null;

    document.body.innerHTML = _tHtml(`
        <div class="h-screen w-screen flex flex-col items-center text-white overflow-hidden" style="background:#000;">
            <div class="bg-aubergine-600 px-6 py-3 rounded-full mt-4 mb-4 shadow-2xl">
                <p class="font-black text-xl uppercase">${escapeHtml(getNickname())}</p>
            </div>
            <div id="player-canvas-host" style="position:relative;width:100%;flex:1;min-height:0;"></div>
        </div>
    `);

    const host = document.getElementById('player-canvas-host');
    if (!host || !slide?.slide_canvas) return;
    mounted = window.XiroSlideCanvasRender.mount(host, slide.slide_canvas, {
        mode: 'player',
        labels: { videoOnScreen: _t('player.slides.video_watch_screen', null, 'Mira la pantalla del presentador') }
    });
}
