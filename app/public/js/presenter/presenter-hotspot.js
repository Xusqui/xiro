/**
 * @fileoverview «Toca la imagen» (hotspot) en el presentador: al lanzar la pregunta, la imagen en
 * su escenario con el crédito (si viene de Wikimedia Commons); al revelar, el área correcta, los
 * toques de todos los jugadores (anónimos, por franja) y cuántos cayeron dentro.
 * HTML compartido en core/hotspot-view.js; estilos en css/hotspot.css.
 */

import { escapeHtml, sanitizeResourceUrl } from '../core/sanitize.js?v=20260922172926';

function creditHtml(credit) {
    if (!credit) return '';
    return `<p class="hs-credit text-white/80 text-center">${escapeHtml(credit)}</p>`;
}

/** Imagen de la pregunta (sin el área: se dibuja al revelar) y su crédito. */
export function hotspotMediaHtml(q) {
    return `
                <div class="stage-question-media hs-presenter flex-1 flex flex-col items-center justify-center mb-6 px-6">
                    ${window.XiroHotspotView.stageHtml({ imageUrl: sanitizeResourceUrl(q.url_recurso || ''), id: 'hs-presenter' })}
                    ${creditHtml(q.image_credit)}
                </div>`;
}

/** Aviso bajo la imagen: la respuesta se da tocando en el móvil. */
export function hotspotDevicesNoteHtml() {
    return `
                <div class="stage-devices-note pb-14 text-center">
                    <p class="jungle-veil inline-block px-6 py-3 text-white text-2xl italic">
                        <i class="fas fa-location-dot mr-2" aria-hidden="true"></i>
                        ${_t('presenter.game.hotspot_devices', null, 'Tocad la imagen en vuestros móviles')}
                    </p>
                </div>`;
}

/** Tarjeta del revelado: cuántos tocaron dentro del área. */
export function hotspotRevealCardHtml(hotspot) {
    const text = hotspot.respondents > 0
        ? _t('presenter.reveal.hotspot_inside', { n: hotspot.insideCount, total: hotspot.respondents }, '{n} de {total} dentro del área')
        : _t('presenter.reveal.hotspot_nobody', null, 'Nadie ha respondido');
    return `<div class="jungle-veil text-center text-white text-3xl font-black italic px-8 py-3 mb-4 mx-auto rounded-2xl">
                <i class="fas fa-location-dot text-red-400 mr-2" aria-hidden="true"></i>${text}
            </div>`;
}

/**
 * Dibuja el área y los toques sobre la imagen de la pregunta.
 * @param {{area: Object, taps: Array}} hotspot - Payload hotspot del revelado
 * @returns {boolean} false si la imagen no está en pantalla
 */
export function revealHotspotOnStage(hotspot) {
    const stage = document.getElementById('hs-presenter');
    if (!stage) return false;
    stage.querySelector('.hs-stage__img').insertAdjacentHTML('afterend', window.XiroHotspotView.areaSvg(hotspot.area));
    (hotspot.taps || []).forEach(tap => stage.insertAdjacentHTML('beforeend', window.XiroHotspotView.pinHtml(tap, tap.band)));
    return true;
}
