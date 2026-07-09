/**
 * @fileoverview Renderizado de slide text-image para el jugador.
 * Muestra SOLO el texto (igual que renderizarSlideTexto).
 * La imagen NO se recibe ni se muestra al jugador.
 */

import { getNickname, clearOrderState, setCanAnswer, setCurrentSlideType } from './player-state.js?v=20260709205314';

export function renderizarSlideTextoImagen(slide) {
    clearOrderState();
    setCanAnswer(false);
    setCurrentSlideType('text-image');

    const title = slide?.slide_title || '';
    const body = slide?.slide_body || '';

    document.body.innerHTML = _tHtml(`
        <div class="h-screen w-screen flex flex-col items-center justify-center text-white text-center p-8 overflow-hidden" style="background: radial-gradient(circle at 15% 20%, rgba(56,189,248,0.25), transparent 35%), radial-gradient(circle at 85% 15%, rgba(244,114,182,0.22), transparent 32%), radial-gradient(circle at 50% 85%, rgba(251,191,36,0.2), transparent 38%), linear-gradient(135deg, #312e81 0%, #6d28d9 40%, #1d4ed8 100%);">
            <div class="bg-indigo-600 px-6 py-3 rounded-full mb-8 shadow-2xl">
                <p class="font-black text-xl uppercase">${getNickname()}</p>
            </div>
            <div class="max-w-5xl">
                <div class="inline-block bg-blue-500 text-white px-6 py-3 rounded-full mb-8 shadow-2xl border border-white/20">
                    <i class="fas fa-info-circle text-3xl"></i>
                </div>
                <div class="bg-black/35 backdrop-blur-sm rounded-3xl px-8 py-7 border border-white/15 shadow-2xl">
                    <h1 class="text-5xl md:text-7xl font-black uppercase italic mb-6 drop-shadow-2xl leading-tight animate-fade-in" style="white-space: pre-line;">${title}</h1>
                    <div class="text-xl md:text-2xl text-indigo-50 font-semibold" style="white-space: pre-line;">${body}</div>
                </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400"></div>
        </div>
    `);
}
