/* eslint-disable no-var -- ES5 a propósito: tv.html debe funcionar en WebOS 3.5 */
/*
 * Reacciones con emoji en la TV: misma corriente que el presentador
 * (core/reactions-stream.js), por la columna derecha. La TV se une a la sala del
 * presentador, así que recibe las ráfagas ('reactions') y los cambios de estado
 * ('reactions-state'). No tiene interruptor: lo silencia el presentador.
 * tv-socket-connection.js llama a attach(socket) en cada 'join-success'.
 */
window.TVApp = window.TVApp || {};
window.TVApp.Reactions = (function () {
    'use strict';

    var attachedSocket = null;
    var stream = null;
    var state = { enabled: false, set: [] };

    function ensureStream() {
        if (stream) return stream;
        var layer = document.createElement('div');
        layer.className = 'rxs-layer';
        layer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(layer);
        stream = window.XiroReactionsStream.createReactionsStream({ container: layer });
        return stream;
    }

    function apply(next) {
        if (!next) return;
        state = { enabled: next.enabled === true, set: next.set || [] };
        if (!state.enabled) ensureStream().clear();
    }

    function onBurst(payload) {
        if (state.enabled && payload && payload.c) ensureStream().push(payload.c, state.set);
    }

    function attach(socket) {
        if (!window.XiroReactionsStream || !socket) return;
        if (attachedSocket !== socket) {
            attachedSocket = socket;
            socket.on('reactions', onBurst);
            socket.on('reactions-state', apply);
        }
        socket.emit('get-reactions', {}, function (res) {
            if (res && res.ok) apply(res);
        });
    }

    return { attach: attach };
})();
