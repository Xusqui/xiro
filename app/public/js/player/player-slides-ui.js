/**
 * @fileoverview Renderizado de slides de comentario e info
 */

import { getNickname, clearOrderState, setCanAnswer, setCurrentSlideType } from './player-state.js?v=20260918181418';
import { renderizarSlideTextoImagen } from './player-slide-text-image-ui.js?v=20260918181418';
import { escapeHtml, sanitizeResourceUrl } from '../core/sanitize.js?v=20260918181418';
export { renderizarSlideTextoImagen };

/**
 * Renderizar slide de comentario
 */
export function renderizarSlideComentario(slide) {
    clearOrderState();
    setCanAnswer(false);
    setCurrentSlideType('comment');
    const safeNickname = escapeHtml(getNickname());
    const safeCommentText = escapeHtml(slide?.comment_text || '');

    document.body.innerHTML = _tHtml(`
                <div class="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-700 via-purple-600 to-pink-600 text-white text-center p-8 overflow-hidden">
                    <div class="bg-purple-600 px-6 py-3 rounded-full mb-8 shadow-2xl">
                        <p class="font-black text-xl uppercase">${safeNickname}</p>
                    </div>
                    <div class="max-w-4xl">
                        <div class="inline-block bg-amber-500 text-white px-6 py-3 rounded-full mb-8 shadow-2xl animate-pulse">
                            <i class="fas fa-comment text-3xl"></i>
                        </div>
                        <h1 class="text-6xl md:text-8xl font-black uppercase italic mb-6 drop-shadow-2xl leading-tight animate-fade-in">${safeCommentText}</h1>
                        <p class="text-2xl text-purple-200 italic font-semibold mt-8">
                            El presentador asignará puntos...
                        </p>
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500"></div>
                </div>
            `);
}

/**
 * Renderizar slide de informacion
 */
export function renderizarSlideInfo(slide) {
    clearOrderState();
    setCanAnswer(false);
    setCurrentSlideType('info');
    const safeNickname = escapeHtml(getNickname());
    const safeCommentText = escapeHtml(slide?.comment_text || '');

    document.body.innerHTML = _tHtml(`
                <div class="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-700 via-cyan-600 to-blue-600 text-white text-center p-8 overflow-hidden">
                    <div class="bg-blue-600 px-6 py-3 rounded-full mb-8 shadow-2xl">
                        <p class="font-black text-xl uppercase">${safeNickname}</p>
                    </div>
                    <div class="max-w-4xl">
                        <div class="inline-block bg-blue-500 text-white px-6 py-3 rounded-full mb-8 shadow-2xl animate-pulse">
                            <i class="fas fa-info-circle text-3xl"></i>
                        </div>
                        <h1 class="text-6xl md:text-8xl font-black uppercase italic mb-6 drop-shadow-2xl leading-tight animate-fade-in" style="white-space: pre-line;">${safeCommentText}</h1>
                        <p class="text-2xl text-blue-200 italic font-semibold mt-8">
                            ℹ️ Información
                        </p>
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-400"></div>
                </div>
            `);
}

/**
 * Renderizar slide de texto (título + cuerpo)
 */
export function renderizarSlideTexto(slide) {
    clearOrderState();
    setCanAnswer(false);
    setCurrentSlideType('text');

    const safeNickname = escapeHtml(getNickname());
    const title = escapeHtml(slide?.slide_title || '');
    const body = escapeHtml(slide?.slide_body || '');

    document.body.innerHTML = _tHtml(`
        <div class="h-screen w-screen flex flex-col items-center justify-center text-white text-center p-8 overflow-hidden" style="background: radial-gradient(circle at 15% 20%, rgba(56,189,248,0.25), transparent 35%), radial-gradient(circle at 85% 15%, rgba(244,114,182,0.22), transparent 32%), radial-gradient(circle at 50% 85%, rgba(251,191,36,0.2), transparent 38%), linear-gradient(135deg, #312e81 0%, #6d28d9 40%, #1d4ed8 100%);">
            <div class="bg-indigo-600 px-6 py-3 rounded-full mb-8 shadow-2xl">
                <p class="font-black text-xl uppercase">${safeNickname}</p>
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

/**
 * Renderizar slide de imagen (imagen a pantalla completa).
 * La imagen ya está en la caché del navegador gracias a la precarga con jitter
 * que se lanzó al inicio del juego → carga instantánea, sin pico de red.
 */
export function renderizarSlideImagen(slide) {
    clearOrderState();
    setCanAnswer(false);
    setCurrentSlideType('image');

    const imageUrl = sanitizeResourceUrl(slide?.slide_image || '');

    document.body.innerHTML = _tHtml(`
        <div class="h-screen w-screen flex items-center justify-center overflow-hidden" style="background: #111827;">
            ${imageUrl
            ? `<img src="${imageUrl}" style="max-width: 100vw; max-height: 100vh; width: auto; height: auto; object-fit: contain; display: block;" />`
            : '<div style="color: rgba(255,255,255,0.3); text-align: center;"><i class="fas fa-image fa-6x"></i></div>'
        }
        </div>
    `);
}
