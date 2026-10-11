/**
 * @fileoverview Controles de la música en el menú ⋯ del presentador: pausar/reanudar y
 * volumen. La pausa se recuerda en localStorage (si el navegador lo permite); el
 * volumen arranca en el del panel de administración (pestaña «Música») y lo que se
 * mueva aquí vale solo para esta partida.
 */

const KEY_PAUSED = 'xiro_music_paused';
const DEFAULT_VOLUME = 0.8;

function readPref(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writePref(key, value) {
    try {
        localStorage.setItem(key, String(value));
    } catch { }
}

/**
 * Muestra el bloque de música del menú y devuelve su estado.
 * @param {{ paused: (on: boolean) => void, volume: (v: number) => void }} on
 */
export function bindMusicControls(on) {
    const block = document.getElementById('stage-music');
    const button = document.getElementById('music-toggle-btn');
    const label = document.getElementById('music-toggle-label');
    const icon = document.getElementById('music-toggle-icon');
    const slider = document.getElementById('music-volume');
    const state = {
        paused: readPref(KEY_PAUSED) === 'true',
        volume: DEFAULT_VOLUME
    };

    function render() {
        const text = state.paused
            ? _t('presenter.music.resume', null, 'Reanudar música')
            : _t('presenter.music.pause', null, 'Pausar música');
        if (label) label.textContent = text;
        if (button) button.title = text;
        if (icon) icon.className = state.paused ? 'fas fa-play' : 'fas fa-pause';
    }

    if (slider) {
        slider.value = String(state.volume);
        slider.addEventListener('input', () => {
            state.volume = Number(slider.value);
            on.volume(state.volume);
        });
    }
    render();
    window.addEventListener('xiro:language-changed', render);

    return {
        state,
        /** Enseña los controles en el menú (solo con «Música de la partida» activada). */
        show() {
            if (block) block.hidden = false;
        },
        /** Pone el deslizador en el volumen del admin (sin avisar: el motor ya lo aplica). */
        syncVolume(volume) {
            state.volume = volume;
            if (slider) slider.value = String(volume);
        },
        togglePause() {
            state.paused = !state.paused;
            writePref(KEY_PAUSED, state.paused);
            render();
            on.paused(state.paused);
        }
    };
}
