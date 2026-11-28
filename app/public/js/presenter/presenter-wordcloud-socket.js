/**
 * @fileoverview Socket del presentador para «Nube de palabras». El servidor envía la nube en
 * directo (`word-cloud-update`, agrupada y con las ráfagas juntas); aquí se repinta en el
 * escenario con un botón por palabra. Ese botón envía `word-cloud-hide` con la clave de la
 * palabra: es el servidor quien la oculta y reenvía la nube ya sin ella.
 */

import { updateWordCloudOnStage } from './presenter-wordcloud-layout.js?v=20260922172926';

function hideLabel() {
    return _t('presenter.wordcloud.hide', null, 'Ocultar palabra');
}

/**
 * Registra los eventos de la nube de palabras en el socket del presentador.
 * @param {Object} socket - Socket.IO del presentador
 */
export function registerWordCloudSocket(socket) {
    socket.on('word-cloud-update', cloud => {
        if (!cloud || !Array.isArray(cloud.words)) return;
        updateWordCloudOnStage(cloud, {
            hideLabel: hideLabel(),
            onHide: wordKey => socket.emit('word-cloud-hide', { wordKey })
        });
    });
}
