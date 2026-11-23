/**
 * @fileoverview Tarjeta «Canción» de la pestaña Música del admin: interruptor, tónica y
 * modo, y la rejilla de 8 compases donde cada uno entra con acorde propio (nota raíz +
 * calidad) o mantiene el anterior. Pinta, lee el formulario y mantiene la rejilla
 * coherente al cambiar una casilla. El modelo está en js/audio/music-song.js.
 * Depende de: self.XiroMusic.theory/song, config-panel-music-controls.js (_musicT,
 * _musicCardHead) y escapeHtml.
 */

const _SONG_PITCH_CLASSES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const _SONG_MODES = ['major', 'minor'];

function _songNote(pitchClass) {
    return _musicT('song.note_' + pitchClass);
}

function _songOptions(values, labelOf, selected) {
    return values
        .map(value => `<option value="${escapeHtml(String(value))}"${String(value) === String(selected) ? ' selected' : ''}>${escapeHtml(labelOf(value))}</option>`)
        .join('');
}

function _songNoteOptions(selected) {
    return _songOptions(_SONG_PITCH_CLASSES, _songNote, selected);
}

function _songQualityOptions(selected) {
    const qualities = Object.keys(self.XiroMusic.theory.QUALITIES);
    return _songOptions(qualities, quality => _musicT('song.quality_' + quality), selected);
}

function _songModePills(mode) {
    return _SONG_MODES
        .map(value => `<label class="xm-pill"><input type="radio" name="xm-song-mode" value="${value}"${value === mode ? ' checked' : ''}><span>${_musicT('song.mode_' + value)}</span></label>`)
        .join('');
}

function _songCellHtml(bar, cell) {
    const locked = cell.entry ? '' : ' disabled';
    return `<div class="xm-song-cell${cell.entry ? ' is-entry' : ''}" data-bar="${bar}">
        <label class="xm-song-cell__entry">
            <input type="checkbox" data-song-field="entry"${cell.entry ? ' checked' : ''}${bar === 1 ? ' disabled' : ''}>
            <span>${_musicT('song.bar', { n: bar })}</span>
        </label>
        <select data-song-field="root" aria-label="${_musicT('song.root')} ${bar}"${locked}>${_songNoteOptions(cell.root)}</select>
        <select data-song-field="quality" aria-label="${_musicT('song.quality')} ${bar}"${locked}>${_songQualityOptions(cell.quality)}</select>
    </div>`;
}

/**
 * HTML de la tarjeta «Canción».
 * @param {?{tonic: number, mode: string, chords: Array}} song Canción guardada; null = sin canción (el editor parte del ejemplo).
 * @returns {string}
 */
function renderMusicSong(song) {
    const model = self.XiroMusic.song;
    const data = song || model.exampleSong();
    const cells = model.cellsFromSong(data).map((cell, index) => _songCellHtml(index + 1, cell)).join('');
    return `<section class="xm-card xm-song" aria-labelledby="xm-title-song">
        ${_musicCardHead('fa-music', 'song')}
        <label class="xm-song-switch"><input type="checkbox" id="xm-song-enabled"${song ? ' checked' : ''}> <span>${_musicT('song.enabled')}</span></label>
        <div class="xm-song-key">
            <label for="xm-song-tonic">${_musicT('song.tonic')}</label>
            <select id="xm-song-tonic">${_songNoteOptions(data.tonic)}</select>
            <span class="sr-only" id="xm-song-mode-label">${_musicT('song.mode')}</span>
            <div class="xm-pills" role="radiogroup" aria-labelledby="xm-song-mode-label">${_songModePills(data.mode)}</div>
        </div>
        <div class="xm-song-grid">${cells}</div>
        <p class="xm-hint">${_musicT('song.hint')}</p>
    </section>`;
}

function _songField(cell, name) {
    return cell.querySelector(`[data-song-field="${name}"]`);
}

function _songDomCells(root) {
    return Array.from(root.querySelectorAll('.xm-song-cell')).map(cell => ({
        entry: _songField(cell, 'entry').checked,
        root: Number(_songField(cell, 'root').value),
        quality: _songField(cell, 'quality').value
    }));
}

/**
 * Deja la rejilla coherente: el compás 1 siempre entra, los compases que mantienen el
 * acorde copian el anterior y sus listas quedan desactivadas.
 * @param {Element} root Raíz de la pestaña (#xm-root).
 */
function syncMusicSong(root) {
    let previous = null;
    root.querySelectorAll('.xm-song-cell').forEach((cell, index) => {
        const entry = index === 0 || _songField(cell, 'entry').checked;
        const rootSelect = _songField(cell, 'root');
        const qualitySelect = _songField(cell, 'quality');
        if (!entry && previous) {
            rootSelect.value = String(previous.root);
            qualitySelect.value = previous.quality;
        }
        rootSelect.disabled = !entry;
        qualitySelect.disabled = !entry;
        cell.classList.toggle('is-entry', entry);
        previous = { root: Number(rootSelect.value), quality: qualitySelect.value };
    });
}

/** Motivo melódico guardado en el campo oculto de «Crear con IA» (null si no hay o no se lee). */
function _songMotifOf(root) {
    const input = root.querySelector('#xm-song-motif');
    if (!input || !input.value) return null;
    try {
        return JSON.parse(input.value);
    } catch (_error) {
        return null;
    }
}

/**
 * Canción tal como está en la rejilla, esté o no activado el interruptor (la usa la exportación a ABC).
 * @param {Element} root Raíz de la pestaña (#xm-root).
 * @returns {{tonic: number, mode: string, chords: Array, motif?: Object}}
 */
function musicSongFormValue(root) {
    const mode = root.querySelector('input[name="xm-song-mode"]:checked');
    const song = self.XiroMusic.song.songFromCells({
        tonic: Number(root.querySelector('#xm-song-tonic').value),
        mode: mode ? mode.value : 'minor',
        cells: _songDomCells(root)
    });
    const motif = _songMotifOf(root);
    if (motif) song.motif = motif;
    return song;
}

/**
 * Canción del formulario (la que se guarda).
 * @param {Element} root Raíz de la pestaña (#xm-root).
 * @returns {?{tonic: number, mode: string, chords: Array, motif?: Object}} null si el interruptor está apagado.
 */
function musicSongSnapshot(root) {
    return root.querySelector('#xm-song-enabled').checked ? musicSongFormValue(root) : null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderMusicSong, syncMusicSong, musicSongSnapshot, musicSongFormValue };
}
