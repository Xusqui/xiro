/**
 * @fileoverview Pestaña «Música»: mesa de mezcla. Una tira por capa (fader vertical
 * en dB, lectura y botón de silencio) y «Restaurar mezcla». La pestaña
 * (config-panel-music.js) la pinta, lee su valor y avisa de los cambios.
 * Depende de: config-panel-music-controls.js (_musicT, _musicCardHead) y music-settings.js.
 */

const _formatDb = db => (db > 0 ? '+' : '') + db + ' dB';

function _renderMusicStrip(layer, channel) {
    const DB = self.XiroMusic.settings.DB;
    const name = _musicT('layer.' + layer);
    const muteLabel = 'M, ' + _musicT('mix.mute', { layer: name });
    return `<div class="xm-strip" data-layer="${layer}" data-muted="${channel.muted}">
        <span class="xm-strip__name" id="xm-layer-${layer}">${name}</span>
        <input type="range" class="xm-strip__fader" min="${DB.min}" max="${DB.max}" step="1" value="${channel.db}"
            data-music-layer="${layer}" aria-orientation="vertical" aria-labelledby="xm-layer-${layer}" aria-valuetext="${_formatDb(channel.db)}">
        <output class="xm-strip__db" data-music-db="${layer}" aria-hidden="true">${_formatDb(channel.db)}</output>
        <button type="button" class="xm-strip__mute" data-music-action="mute" data-layer="${layer}"
            aria-pressed="${channel.muted}" aria-label="${muteLabel}" title="${_musicT('mix.mute', { layer: name })}">M</button>
    </div>`;
}

function _renderMusicMix(s) {
    const strips = self.XiroMusic.settings.LAYERS.map(layer => _renderMusicStrip(layer, s.mix[layer])).join('');
    return `<section class="xm-card" aria-labelledby="xm-title-mix">
        ${_musicCardHead('fa-sliders', 'mix')}
        <div class="xm-desk">${strips}</div>
        <div class="xm-desk-foot">
            <button type="button" class="xm-btn" data-music-action="reset-mix">
                <i class="fas fa-rotate-left" aria-hidden="true"></i> ${_musicT('mix.reset')}
            </button>
        </div>
    </section>`;
}

/** Mezcla del formulario: { capa: { db, muted } }. */
function musicMixSnapshot(root) {
    const mix = {};
    root.querySelectorAll('.xm-strip').forEach(strip => {
        mix[strip.dataset.layer] = {
            db: Number(strip.querySelector('[data-music-layer]').value),
            muted: strip.querySelector('[data-music-action="mute"]').getAttribute('aria-pressed') === 'true'
        };
    });
    return mix;
}

/** Al mover un fader: lectura en dB (también para lectores de pantalla). */
function updateMusicFader(input) {
    const text = _formatDb(Number(input.value));
    input.setAttribute('aria-valuetext', text);
    const out = input.closest('.xm-strip').querySelector('[data-music-db]');
    if (out) out.textContent = text;
}

function toggleMusicMute(button) {
    const muted = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(muted));
    button.closest('.xm-strip').dataset.muted = String(muted);
}

/** Vuelve a la mezcla por defecto (sin guardar: lo marca la barra de guardado). */
function resetMusicMix(root) {
    const defaults = self.XiroMusic.settings.defaults().mix;
    root.querySelectorAll('.xm-strip').forEach(strip => {
        const channel = defaults[strip.dataset.layer];
        const fader = strip.querySelector('[data-music-layer]');
        fader.value = String(channel.db);
        updateMusicFader(fader);
        strip.querySelector('[data-music-action="mute"]').setAttribute('aria-pressed', 'false');
        strip.dataset.muted = 'false';
    });
}
