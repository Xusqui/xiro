/**
 * @fileoverview Rastro de diagnóstico de la música: los últimos pasos (escenas, sucesos
 * del juego, reloj) se guardan al momento en localStorage. Si el navegador se cuelga,
 * al volver se ve en /dev/music cuál fue el último paso.
 */

const KEY = 'xiro_music_trace';
const MAX_ENTRIES = 40;

export function trace(message) {
    try {
        const list = JSON.parse(localStorage.getItem(KEY) || '[]');
        list.push(`${new Date().toISOString().slice(11, 23)} ${message}`);
        localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ENTRIES)));
    } catch { }
}

export function readTrace() {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
        return [];
    }
}
