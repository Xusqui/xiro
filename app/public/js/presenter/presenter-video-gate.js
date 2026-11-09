/**
 * @fileoverview Botón previo a los reproductores de YouTube, Vimeo y Dailymotion: el
 * dispositivo no se conecta con esos servicios hasta que el presentador lo toca.
 */

const PROVIDER_NAMES = { youtube: 'YouTube', vimeo: 'Vimeo', dailymotion: 'Dailymotion' };
const IFRAME_ALLOW = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
const GATE_STYLE =
    'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.75rem;' +
    'background:#000;color:#fff;border:0;cursor:pointer;font-size:2rem;font-weight:800;padding:1rem;text-align:center;';
const NOTICE_STYLE = 'font-size:1rem;font-weight:500;';

// El vídeo ocupa todo el hueco y conserva su proporción (bandas negras si hace falta)
export const MEDIA_STYLE = 'width:100%;height:100%;object-fit:contain;border:0;background:#000;display:block;';

function createEmbedFrame(source) {
    const iframe = document.createElement('iframe');
    iframe.src = `${source.embedUrl}&autoplay=1`;
    iframe.allow = IFRAME_ALLOW;
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.title = 'Vídeo';
    iframe.style.cssText = MEDIA_STYLE;
    return iframe;
}

function createLine(text, style) {
    const line = document.createElement('span');
    line.textContent = text;
    if (style) line.style.cssText = style;
    return line;
}

/**
 * @param {{kind: string, embedUrl: string}} source - Resultado de parseVideoSource
 * @returns {HTMLButtonElement} Botón que se sustituye por el reproductor al tocarlo
 */
export function createVideoGate(source) {
    const provider = PROVIDER_NAMES[source.kind] || source.kind;
    const gate = document.createElement('button');
    gate.type = 'button';
    gate.style.cssText = GATE_STYLE;
    gate.append(
        createLine(_t('presenter.video_gate.load', { provider }, `Cargar vídeo de ${provider}`)),
        createLine(_t('presenter.video_gate.notice', { provider }, `Al cargarlo, este dispositivo se conectará con ${provider}.`), NOTICE_STYLE)
    );
    gate.addEventListener('click', () => gate.replaceWith(createEmbedFrame(source)), { once: true });
    return gate;
}
