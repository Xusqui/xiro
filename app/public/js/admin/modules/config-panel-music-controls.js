/**
 * @fileoverview Pestaña «Música» del panel de configuración: piezas del formulario
 * (instrumentos en píldoras, tempo, semilla, volumen y tic-tac). Solo pintan HTML;
 * la pestaña (config-panel-music.js) las monta y lee sus valores.
 * Depende de: self.XiroMusic.settings (js/audio/music-settings.js) y escapeHtml/_t.
 */

const _MUSIC_SEED_MAX = 32;

function _musicT(key, vars) {
    return _t('admin.config.music.' + key, vars);
}

/** Nombre visible de una opción de sonido («synth» y «brass» dependen del grupo). */
function _musicOptionLabel(group, value) {
    if (value === 'synth') return _musicT('opt.synth_' + group);
    if (group === 'melody' && value === 'brass') return _musicT('opt.brass_melody');
    return _musicT('opt.' + value);
}

/** Cabecera de tarjeta: icono, título y descripción (como el resto de Configuración). */
function _musicCardHead(icon, key, extraClass) {
    return `<div class="xm-head${extraClass ? ' ' + extraClass : ''}">
        <div class="xm-head__icon"><i class="fas ${icon}" aria-hidden="true"></i></div>
        <div>
            <h3 class="xm-head__title" id="xm-title-${key}">${_musicT(key + '.title')}</h3>
            <p class="xm-head__desc">${_musicT(key + '.desc')}</p>
        </div>
    </div>`;
}

/**
 * Píldoras de radio. La de por defecto lleva una estrella (y el texto para lectores).
 * @param {{ name: string, values: string[], current: string, fallback?: string, labelOf: (v: string) => string, labelledBy: string }} o
 */
function _musicPills(o) {
    const pills = o.values
        .map(v => {
            const isDefault = v === o.fallback;
            const star = isDefault ? '<i class="fas fa-star" aria-hidden="true"></i>' : '';
            const mark = isDefault ? ` <span class="sr-only">${_musicT('default_mark')}</span>` : '';
            return (
                `<label class="xm-pill"><input type="radio" name="${o.name}" value="${escapeHtml(v)}"${v === o.current ? ' checked' : ''}>` +
                `<span>${star}${escapeHtml(o.labelOf(v))}${mark}</span></label>`
            );
        })
        .join('');
    return `<div class="xm-pills" role="radiogroup" aria-labelledby="${o.labelledBy}">${pills}</div>`;
}

function _renderMusicInstruments(s) {
    const S = self.XiroMusic.settings;
    const options = S.soundOptions();
    const fallback = S.defaults().sounds;
    const rows = S.SOUND_GROUPS.map(
        group => `
        <span class="xm-groups__label" id="xm-group-${group}">${_musicT('group.' + group)}</span>
        ${_musicPills({ name: 'xm-sound-' + group, values: options[group], current: s.sounds[group], fallback: fallback[group], labelOf: v => _musicOptionLabel(group, v), labelledBy: 'xm-group-' + group })}`
    ).join('');
    return `<section class="xm-card" aria-labelledby="xm-title-instruments">
        ${_musicCardHead('fa-guitar', 'instruments')}
        <div class="xm-groups">${rows}</div>
    </section>`;
}

function _renderMusicTempo(s) {
    const T = self.XiroMusic.settings.TEMPO;
    return `<div class="xm-range">
        <input type="range" id="xm-tempo" min="${T.min}" max="${T.max}" step="1" value="${s.tempo}"
            aria-labelledby="xm-title-tempo" aria-valuetext="${s.tempo} bpm">
        <output class="xm-range__value" id="xm-tempo-value" for="xm-tempo" aria-hidden="true">${s.tempo}<small>bpm</small></output>
        <div class="xm-range__scale"><span>${T.min} · ${_musicT('tempo.slow')}</span><span>${T.base}</span><span>${_musicT('tempo.fast')} · ${T.max}</span></div>
    </div>`;
}

function _renderMusicSeed(s) {
    const fixed = s.seedMode === 'fixed';
    const modes = _musicPills({
        name: 'xm-seed-mode',
        values: ['session', 'fixed'],
        current: s.seedMode,
        labelOf: v => _musicT('seed.mode_' + v),
        labelledBy: 'xm-title-seed'
    });
    return `${modes}
        <div class="xm-seed">
            <input type="text" id="xm-seed" class="xm-seed__input" maxlength="${_MUSIC_SEED_MAX}" value="${escapeHtml(s.seed)}"
                autocomplete="off" spellcheck="false" autocapitalize="off" aria-labelledby="xm-title-seed"
                aria-describedby="xm-seed-hint" placeholder="${_musicT('seed.placeholder')}"${fixed ? '' : ' disabled'}>
            <button type="button" class="xm-btn" data-music-action="random-seed"${fixed ? '' : ' disabled'}>
                <i class="fas fa-dice" aria-hidden="true"></i> ${_musicT('seed.random')}
            </button>
        </div>
        <p class="xm-hint" id="xm-seed-hint">${_musicT(fixed ? 'seed.hint_fixed' : 'seed.hint_session')}</p>`;
}

function _renderMusicTempoSeed(s) {
    return `<section class="xm-card" aria-labelledby="xm-title-tempo">
        ${_musicCardHead('fa-gauge-high', 'tempo')}
        ${_renderMusicTempo(s)}
        ${_musicCardHead('fa-seedling', 'seed', 'xm-head--sub')}
        ${_renderMusicSeed(s)}
    </section>`;
}

function _renderMusicVolumeTick(s) {
    const S = self.XiroMusic.settings;
    const pct = Math.round(s.volume * 100);
    const ticks = _musicPills({
        name: 'xm-tick',
        values: S.TICK_SOUNDS,
        current: s.tick,
        fallback: S.defaults().tick,
        labelOf: v => _musicT('tick.' + v),
        labelledBy: 'xm-title-tick'
    });
    return `<section class="xm-card xm-split">
        <div>
            ${_musicCardHead('fa-volume-high', 'volume')}
            <div class="xm-range">
                <input type="range" id="xm-volume" min="0" max="100" step="1" value="${pct}"
                    aria-labelledby="xm-title-volume" aria-valuetext="${pct} %">
                <output class="xm-range__value" id="xm-volume-value" for="xm-volume" aria-hidden="true">${pct}<small>%</small></output>
            </div>
        </div>
        <div>
            ${_musicCardHead('fa-clock', 'tick')}
            ${ticks}
        </div>
    </section>`;
}
