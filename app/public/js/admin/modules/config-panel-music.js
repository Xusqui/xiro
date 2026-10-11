/**
 * @fileoverview Pestaña «Música» del panel de configuración: «Música de la partida»
 * (sí/no), escucha previa, instrumentos, tempo, semilla, volumen, tic-tac y mezcla.
 * Lo guardado aquí es lo que suena en el presentador (ajustes de UI musicaPartida y
 * musicSettings, validados en el servidor con js/audio/music-settings.js).
 * Se guarda con la barra común (admin-savebar.js) vía postUiSettings (config-panel-ui.js).
 * Depende de: config-panel-ui.js, config-panel-music-controls.js, -mix.js y -preview.js.
 */

const _MUSIC_SCENES = ['lobby', 'question', 'leaderboard'];
const _MUSIC_SEED_PATTERN = /^[a-z0-9_-]{1,32}$/i;

function _renderMusicPlayer() {
    const scenes = _musicPills({
        name: 'xm-scene', values: _MUSIC_SCENES, current: 'lobby',
        labelOf: v => _musicT('scene.' + v), labelledBy: 'xm-scene-label'
    });
    return `<div class="xm-player" id="xm-player" data-state="idle">
        <button type="button" class="xm-play" data-music-action="toggle-preview" aria-describedby="xm-player-status">
            <i class="fas fa-play" aria-hidden="true"></i> <span>${_musicT('player.play')}</span>
        </button>
        <div class="xm-player__info">
            <span class="sr-only" id="xm-scene-label">${_musicT('player.scene')}</span>
            <div class="xm-scenes">${scenes}</div>
            <p class="xm-player__status" id="xm-player-status" role="status" aria-live="polite">${_musicT('player.idle')}</p>
        </div>
        <canvas class="xm-wave" id="xm-wave" width="240" height="80" aria-hidden="true"></canvas>
    </div>`;
}

function _renderMusicTab(ui) {
    musicPreview.stop(); // la pestaña se vuelve a pintar (descartar, cambio de pestaña…)
    musicPreview.warm();
    const s = self.XiroMusic.settings.normalize(ui.musicSettings);
    const enabled = ui.musicaPartida !== false;
    return `<div class="xm" id="xm-root" data-enabled="${enabled}">
        ${_renderUiSwitchCard({ key: 'musicaPartida', checked: enabled, icon: 'fa-music', iconBg: 'bg-green-100', iconColor: 'text-green-600', textKey: 'musica_partida' })}
        <p class="xm-off-note"><i class="fas fa-volume-xmark" aria-hidden="true"></i> ${_musicT('off_note')}</p>
        <div class="xm-body"${enabled ? '' : ' inert'}>
            ${_renderMusicPlayer()}
            ${_renderMusicInstruments(s)}
            ${_renderMusicTempoSeed(s)}
            ${_renderMusicVolumeTick(s)}
            ${_renderMusicMix(s)}
        </div>
    </div>`;
}

/* ===== ESTADO Y GUARDADO ===== */

function _musicRadio(root, name) {
    const input = root.querySelector(`input[name="${name}"]:checked`);
    return input ? input.value : null;
}

/** Ajustes tal como están en el formulario (los mismos que se guardan). */
function _musicFormSettings(root) {
    const sounds = {};
    self.XiroMusic.settings.SOUND_GROUPS.forEach(group => { sounds[group] = _musicRadio(root, 'xm-sound-' + group); });
    return {
        sounds,
        tempo: Number(root.querySelector('#xm-tempo').value),
        seedMode: _musicRadio(root, 'xm-seed-mode'),
        seed: root.querySelector('#xm-seed').value.trim(),
        volume: Number(root.querySelector('#xm-volume').value) / 100,
        tick: _musicRadio(root, 'xm-tick'),
        mix: musicMixSnapshot(root)
    };
}

function musicTabSnapshot() {
    const root = document.getElementById('xm-root');
    if (!root) return {};
    return {
        musicaPartida: Boolean(document.getElementById('ui-switch-musicaPartida')?.checked),
        musicSettings: _musicFormSettings(root)
    };
}

function saveMusicTab(initial) {
    const seedError = _validateMusicSeed();
    if (seedError) return Promise.resolve({ ok: false, message: escapeHtml(seedError) });
    return postUiSettings(changedSettings(musicTabSnapshot(), initial));
}

/* ===== INTERACCIÓN ===== */

/** Semilla: con modo fijo hace falta una válida. Marca el campo y devuelve el error (o null). */
function _validateMusicSeed() {
    const root = document.getElementById('xm-root');
    if (!root) return null;
    const input = root.querySelector('#xm-seed');
    const hint = root.querySelector('#xm-seed-hint');
    const fixed = _musicRadio(root, 'xm-seed-mode') === 'fixed';
    const error = fixed && !_MUSIC_SEED_PATTERN.test(input.value.trim()) ? _musicT('seed.invalid') : null;
    input.setAttribute('aria-invalid', String(Boolean(error)));
    hint.dataset.tone = error ? 'error' : '';
    hint.textContent = error || _musicT(fixed ? 'seed.hint_fixed' : 'seed.hint_session');
    return error;
}

const _randomMusicSeed = () => Math.floor(Math.random() * 0xFFFFFFF).toString(36);

function _onMusicSeedMode(root) {
    const fixed = _musicRadio(root, 'xm-seed-mode') === 'fixed';
    const input = root.querySelector('#xm-seed');
    input.disabled = !fixed;
    root.querySelector('[data-music-action="random-seed"]').disabled = !fixed;
    if (fixed && !input.value.trim()) input.value = _randomMusicSeed();
    _validateMusicSeed();
}

function _onMusicEnabled(root, enabled) {
    root.dataset.enabled = String(enabled);
    root.querySelector('.xm-body').toggleAttribute('inert', !enabled);
    if (!enabled) musicPreview.stop();
}

/** Lecturas junto a los deslizadores (y su texto para lectores de pantalla). */
function _onMusicInput(target) {
    if (target.id === 'xm-tempo') {
        document.getElementById('xm-tempo-value').innerHTML = `${target.value}<small>bpm</small>`;
        target.setAttribute('aria-valuetext', target.value + ' bpm');
    } else if (target.id === 'xm-volume') {
        document.getElementById('xm-volume-value').innerHTML = `${target.value}<small>%</small>`;
        target.setAttribute('aria-valuetext', target.value + ' %');
    } else if (target.dataset.musicLayer) {
        updateMusicFader(target);
    } else if (target.id === 'xm-seed') {
        _validateMusicSeed();
    }
}

const _MUSIC_CLICK_ACTIONS = {
    'toggle-preview': root => musicPreview.toggle(_musicFormSettings(root)),
    'random-seed': root => {
        root.querySelector('#xm-seed').value = _randomMusicSeed();
        _validateMusicSeed();
    },
    mute: (root, el) => toggleMusicMute(el),
    'reset-mix': root => resetMusicMix(root)
};

function _onMusicChange(root, target) {
    if (target.id === 'ui-switch-musicaPartida') {
        _onMusicEnabled(root, target.checked);
        return;
    }
    if (target.name === 'xm-scene') {
        musicPreview.setScene(target.value);
        return;
    }
    if (target.name === 'xm-seed-mode') _onMusicSeedMode(root);
    musicPreview.update(_musicFormSettings(root));
}

function _initMusicTabDelegation() {
    const rootOf = event => (event.target.closest ? event.target.closest('#xm-root') : null);
    document.addEventListener('input', event => {
        const root = rootOf(event);
        if (!root) return;
        _onMusicInput(event.target);
        musicPreview.update(_musicFormSettings(root));
    });
    document.addEventListener('change', event => {
        const root = rootOf(event);
        if (root) _onMusicChange(root, event.target);
    });
    document.addEventListener('click', event => {
        const root = rootOf(event);
        const el = root && event.target.closest('[data-music-action]');
        if (!el || !Object.hasOwn(_MUSIC_CLICK_ACTIONS, el.dataset.musicAction)) return;
        _MUSIC_CLICK_ACTIONS[el.dataset.musicAction](root, el);
        if (el.dataset.musicAction === 'toggle-preview') return;
        refreshSaveBar();
        musicPreview.update(_musicFormSettings(root));
    });
}

_initMusicTabDelegation();
