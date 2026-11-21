/**
 * @fileoverview «Toca la imagen» (hotspot) en el modo individual, como player-hotspot-ui.js: tocar la
 * imagen pone una chincheta (se puede mover) y «Enviar» manda el toque; al agotarse el tiempo se envía
 * sola la chincheta puesta. El resultado enseña la imagen
 * con el toque y, al revelar, el área correcta. HTML compartido en core/hotspot-view.js.
 */

'use strict';

globalThis.StandaloneQuestionHotspot = (() => {
    const { escapeHtml, t, submitAnswer } = StandaloneQuestionCommon;
    let imageUrl = null;
    let tap = null;
    // Margen para que el envío automático llegue antes de que el servidor cierre la pregunta
    const AUTO_SUBMIT_MARGIN_MS = 400;
    let autoSubmitTimer = null;

    function view() {
        return window.XiroHotspotView;
    }

    function wireStage(stage, button) {
        stage.addEventListener('click', event => {
            const img = stage.querySelector('.hs-stage__img');
            const point = view().pointFromClick(img.getBoundingClientRect(), event.clientX, event.clientY);
            if (!point) return;
            tap = point;
            stage.querySelector('.hs-pin')?.remove();
            stage.insertAdjacentHTML('beforeend', view().pinHtml(tap, 'own'));
            button.disabled = false;
        });
    }

    function render(container, question, { onSubmitted }) {
        imageUrl = question.url_recurso || null;
        tap = null;
        container.innerHTML = `
            <div class="pl-viewport">
                <div class="pl-nickname-bar"><p>${escapeHtml(StandaloneState.get().nickname)}</p></div>
                <div class="pl-question-panel"><h2>${escapeHtml(question.question_text)}</h2></div>
                <div class="pl-input-area hs-standalone">
                    <p class="pl-numeric-note"><i class="fas fa-location-dot"></i> ${t('standalone.game.hotspot_instructions', 'Toca la imagen donde está la respuesta')}</p>
                    ${view().stageHtml({ imageUrl: imageUrl || '', id: 'hs-question' })}
                </div>
                <div class="pl-submit-bar">
                    <button type="button" class="pl-submit-btn" data-standalone-action="submit-hotspot" disabled>
                        <i class="fas fa-paper-plane"></i> ${t('standalone.game.submit', 'Enviar respuesta')}
                    </button>
                </div>
            </div>
        `;
        const button = container.querySelector('[data-standalone-action="submit-hotspot"]');
        wireStage(container.querySelector('#hs-question'), button);
        const send = createSender(question, button, onSubmitted);
        button.addEventListener('click', send);
        scheduleAutoSubmit(question, send);
    }

    /**
     * Envío del toque, desde el botón o al agotarse el tiempo. Sin toque, ya enviado o con
     * otra pregunta en pantalla no hace nada; si el servidor lo rechaza deja volver a enviar.
     */
    function createSender(question, button, onSubmitted) {
        let sent = false;
        return async () => {
            if (!tap || sent || StandaloneState.get().currentQuestion !== question) return;
            sent = true;
            clearTimeout(autoSubmitTimer);
            button.disabled = true;
            const ack = await submitAnswer({ tap: { x: tap.x, y: tap.y } }, 'hotspot');
            if (ack && ack.ok === false) {
                sent = false;
                StandaloneState.get().answered = false;
                button.disabled = false;
                return;
            }
            onSubmitted();
        };
    }

    // Como en la sopa de letras: la chincheta puesta se envía sola justo antes de acabar el tiempo
    function scheduleAutoSubmit(question, send) {
        clearTimeout(autoSubmitTimer);
        if (typeof question.time_limit === 'number' && question.time_limit > 0) {
            autoSubmitTimer = setTimeout(send, Math.max(0, question.time_limit * 1000 - AUTO_SUBMIT_MARGIN_MS));
        }
    }

    function verdict(details) {
        if (details.inside) return t('standalone.game.hotspot_inside', '¡Dentro!');
        if (details.distancePercent === null || details.distancePercent === undefined) {
            return t('standalone.game.incorrect', 'Incorrecto');
        }
        return `${t('standalone.game.hotspot_distance', 'Distancia al área')}: ${details.distancePercent} %`;
    }

    /** Resultado: veredicto, puntos y la imagen con el toque (el área se añade al revelar). */
    function resultMessage(data, pointsPill) {
        const details = data.hotspotDetails;
        const stage = imageUrl ? view().stageHtml({ imageUrl, ownTap: details.tap || null, id: 'hs-result' }) : '';
        return `
            <i class="fas fa-location-dot pl-reveal-icon"></i>
            <h2>${escapeHtml(verdict(details))}</h2>
            ${pointsPill(data.points)}
            <div class="pl-reveal-box hs-standalone">${stage}</div>
        `;
    }

    /** Verde dentro, amarillo fuera con puntos (como la numérica aproximada), rojo sin puntos; null si no es hotspot. */
    function resultColor(data) {
        const details = data.hotspotDetails;
        if (!details) return null;
        if (details.inside) return 'bg-green-500';
        return data.points > 0 ? 'bg-yellow-500' : 'bg-red-500';
    }

    /** Pantalla de tiempo agotado: la imagen con el área (payload hotspot del reveal). */
    function revealStage(hotspot) {
        if (!hotspot || !imageUrl) return '';
        return `<div class="pl-reveal-box hs-standalone">${view().stageHtml({ imageUrl, area: hotspot.area })}</div>`;
    }

    /** Revelación que llega después del resultado: dibuja el área sobre su imagen. */
    function applyReveal(container, hotspot) {
        const stage = container.querySelector('#hs-result');
        if (!stage || !hotspot || stage.querySelector('.hs-svg')) return;
        stage.querySelector('.hs-stage__img').insertAdjacentHTML('afterend', view().areaSvg(hotspot.area));
    }

    return { render, resultMessage, resultColor, revealStage, applyReveal };
})();
