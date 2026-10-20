/**
 * @fileoverview Renderiza diapositivas canvas en modo Standalone
 */

'use strict';

globalThis.StandaloneCanvasSlide = (() => {
    function _renderCanvas(container, question) {
        container.innerHTML = `
            <div class="pl-viewport" style="background:#000;">
                <div class="standalone-canvas-host" style="position:relative;width:100%;flex:1;min-height:0;"></div>
                <div class="pl-submit-bar" style="position:absolute; bottom:0; left:0; right:0;">
                    <button type="button" class="pl-submit-btn" data-standalone-action="continue-slide">
                        ${window.XiroI18n?.t('standalone.game.continue') || 'Continuar'}
                    </button>
                </div>
            </div>
        `;

        let host = container.querySelector('.standalone-canvas-host');
        if (host && question.slide_canvas) {
            window.XiroSlideCanvasRender.mount(host, question.slide_canvas, {
                mode: 'player',
                labels: {
                    videoOnScreen: window.XiroI18n?.t('standalone.game.video_presenter_only') || 'Este vídeo solo se ve en la pantalla del presentador'
                }
            });
        }
    }

    return {
        render: _renderCanvas
    };
})();