/* eslint-disable no-var -- ES5 a propósito: tv.html debe funcionar en WebOS 3.5 */
/*
 * Avatares de los jugadores en la TV: mapa apodo → avatar que se llena con 'player-joined'
 * y con el ack 'get-avatars' (en cada 'join-success'). Las vistas marcan el nombre con
 * data-avatar-of y core/avatar-chips.js pone la imagen delante (estilo en línea: tv.css no
 * usa variables ni grid).
 */
window.TVApp = window.TVApp || {};
window.TVApp.Avatars = (function () {
    'use strict';

    var avatars = {};
    var chips = null;

    function catalog() {
        return window.XiroAvatars;
    }

    function ensureChips() {
        if (chips || !catalog() || !window.XiroAvatarChips || !document.body) return chips;
        chips = window.XiroAvatarChips.attach({
            root: document.body,
            catalog: catalog(),
            lookup: function (nickname) {
                return Object.prototype.hasOwnProperty.call(avatars, nickname) ? avatars[nickname] : null;
            },
            style: 'width:1.3em;height:1.3em;vertical-align:middle;margin-right:8px'
        });
        return chips;
    }

    function remember(nickname, id) {
        if (!nickname || !catalog()) return;
        if (catalog().isKnown(id)) avatars[nickname] = id;
        else delete avatars[nickname];
        if (ensureChips()) chips.repaint();
    }

    function request(socket) {
        if (!socket || !ensureChips()) return;
        socket.emit('get-avatars', {}, function (res) {
            if (!res || !res.ok) return;
            avatars = {};
            var list = res.avatars || {};
            for (var nickname in list) {
                if (Object.prototype.hasOwnProperty.call(list, nickname) && catalog().isKnown(list[nickname])) {
                    avatars[nickname] = list[nickname];
                }
            }
            chips.repaint();
        });
    }

    return { remember: remember, request: request };
})();
