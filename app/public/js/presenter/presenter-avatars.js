/**
 * @fileoverview Avatares de los jugadores en el presentador: mapa apodo → avatar que se llena
 * con `player-joined` (alta nueva) y con el ack `get-avatars` (al unirse o reconectarse el
 * presentador). Las vistas no pintan el avatar: marcan el nombre con `data-avatar-of` y
 * core/avatar-chips.js pone la imagen delante. El podio 3D pide la URL con getAvatarUrl.
 */

import { getSocket } from './presenter-socket-config.js?v=20260922172926';

const avatars = new Map();
let chips = null;

function catalog() {
    return window.XiroAvatars;
}

/** Avatar de un apodo recién llegado (null si entró sin avatar). */
export function rememberAvatar(nickname, id) {
    if (!nickname) return;
    if (catalog()?.isKnown(id)) avatars.set(nickname, id);
    else avatars.delete(nickname);
    chips?.repaint();
}

/** URL del avatar de un jugador, o null. */
export function getAvatarUrl(nickname) {
    const id = avatars.get(nickname);
    return id ? catalog().iconUrl(id) : null;
}

/** Pide el mapa completo de la sala y repinta los avatares. */
export function requestAvatars() {
    getSocket().emit('get-avatars', {}, res => {
        if (!res || !res.ok) return;
        avatars.clear();
        Object.keys(res.avatars || {}).forEach(nickname => {
            if (catalog().isKnown(res.avatars[nickname])) avatars.set(nickname, res.avatars[nickname]);
        });
        chips?.repaint();
    });
}

export function registerPresenterAvatars() {
    if (!catalog() || !window.XiroAvatarChips) return;
    chips = window.XiroAvatarChips.attach({
        root: document.body,
        catalog: catalog(),
        lookup: nickname => avatars.get(nickname) || null,
        className: 'avatar-chip'
    });
    const socket = getSocket();
    socket.on('join-success', requestAvatars);
    socket.on('reconnected-success', requestAvatars);
}
