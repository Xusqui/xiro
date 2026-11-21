/**
 * @fileoverview Pantalla de «Toca la imagen» (hotspot) en el móvil: el enunciado y la imagen; tocar
 * pone una chincheta (se puede mover tocando otra vez) y «Enviar» manda el toque. El área nunca llega
 * al móvil antes de revelar. Estilos en css/hotspot.css.
 */

import { getNickname, setHaRespondido, setCanAnswer, setCurrentSlideType } from './player-state.js?v=20260922172926';
import { getResponsiveFontClass } from './player-question-utils.js?v=20260922172926';
import { startHotspot, setHotspotTap, getHotspotTap } from './player-hotspot-state.js?v=20261119180000';
import { escapeHtml, sanitizeResourceUrl } from '../core/sanitize.js?v=20260922172926';
import { t } from '../core/translate.js?v=20261105120000';

function drawPin() {
    const stage = document.getElementById('hs-question');
    const tap = getHotspotTap();
    if (!stage || !tap) return;
    stage.querySelector('.hs-pin')?.remove();
    const img = stage.querySelector('.hs-stage__img');
    img.insertAdjacentHTML('afterend', window.XiroHotspotView.pinHtml(tap, 'own'));
    const submit = document.getElementById('hs-submit');
    if (submit) submit.disabled = false;
}

function onStageClick(event) {
    const img = event.currentTarget.querySelector('.hs-stage__img');
    const point = window.XiroHotspotView.pointFromClick(img.getBoundingClientRect(), event.clientX, event.clientY);
    if (!point) return;
    setHotspotTap(point);
    drawPin();
}

/**
 * Pantalla de la pregunta «Toca la imagen».
 * @param {Object} pregunta - Pregunta saneada (sin el área)
 */
export function renderizarPreguntaHotspot(pregunta) {
    setHaRespondido(false);
    setCanAnswer(true);
    setCurrentSlideType('hotspot');
    startHotspot(sanitizeResourceUrl(pregunta.url_recurso || ''));

    document.body.innerHTML = _tHtml(`
        <div class="h-dvh w-screen flex flex-col bg-slate-900 overflow-hidden">
            <div class="bg-plum-600 relative px-3 py-2 text-center shrink-0" data-player-timer-slot>
                <p class="text-white font-black text-base uppercase">${escapeHtml(getNickname())}</p>
            </div>
            <div class="bg-white p-3 border-b-8 border-plum-600 text-slate-800 text-center max-h-[20vh] flex items-center justify-center shrink-0 overflow-y-auto">
                <h2 class="${getResponsiveFontClass(pregunta.question_text)} font-black italic hyphens-auto" lang="es">${escapeHtml(pregunta.question_text)}</h2>
            </div>
            <p class="text-center text-xs font-bold uppercase tracking-widest text-red-300 pt-2 shrink-0"><i class="fas fa-location-dot mr-1" aria-hidden="true"></i>${t('player.hotspot.instructions', 'Toca la imagen donde está la respuesta')}</p>
            <div class="flex-1 min-h-0 flex items-center justify-center p-3">
                ${window.XiroHotspotView.stageHtml({ imageUrl: sanitizeResourceUrl(pregunta.url_recurso || ''), id: 'hs-question' })}
            </div>
            <div class="p-3 bg-slate-900/60 border-t border-white/10 shrink-0">
                <button id="hs-submit" disabled class="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white py-4 rounded-2xl font-black uppercase text-xl shadow-lg transition active:scale-95">
                    <i class="fas fa-paper-plane mr-2" aria-hidden="true"></i>${t('player.hotspot.submit', 'Enviar')}
                </button>
            </div>
        </div>
    `);

    document.getElementById('hs-question').addEventListener('click', onStageClick);
    document.getElementById('hs-submit').addEventListener('click', () => window.enviarRespuestaHotspot());
}
