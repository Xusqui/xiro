/**
 * @fileoverview Tarjeta «Compartir (ABC)» de la pestaña Música del admin: exporta la canción de la rejilla
 * (acordes y motivo) y el tempo a ABC, el formato estándar de intercambio de partituras, y la importa desde
 * un texto pegado o un archivo .abc (también de internet), rellenando la tarjeta «Canción», el tempo y el
 * motivo. No guarda nada: el admin escucha, retoca y pulsa «Guardar».
 * Depende de: config-panel-music-song.js (musicSongFormValue), config-panel-music-song-ai.js
 * (applyMusicSongReply), config-panel-music-controls.js (_musicT, _musicCardHead), self.XiroMusic.abcExport
 * y abcImport.
 */

const _SONG_ABC_MAX_BYTES = 200000;
const _SONG_ABC_ACCEPT = '.abc,.txt,text/plain';
const _SONG_ABC_FILE_NAME = 'xiro-cancion.abc';
const _SONG_ABC_DEFAULT_TEMPO = 112;

function _songAbcStatus(root, state, text) {
    const status = root.querySelector('#xm-song-abc-status');
    status.dataset.state = state;
    status.textContent = text;
}

/**
 * HTML de la tarjeta «Compartir (ABC)».
 * @returns {string}
 */
function renderMusicSongAbc() {
    return `<section class="xm-card xm-song-abc" aria-labelledby="xm-title-song_abc">
        ${_musicCardHead('fa-file-lines', 'song_abc')}
        <textarea id="xm-song-abc" rows="6" aria-label="${escapeHtml(_musicT('song_abc.title'))}" spellcheck="false" placeholder="${escapeHtml(_musicT('song.abc_placeholder'))}"></textarea>
        <div class="xm-song-abc__row">
            <button type="button" class="xm-btn" data-music-action="song-abc-export">${_musicT('song.abc_export')}</button>
            <button type="button" class="xm-btn" data-music-action="song-abc-import">${_musicT('song.abc_import')}</button>
            <button type="button" class="xm-btn" data-music-action="song-abc-download">${_musicT('song.abc_download')}</button>
            <button type="button" class="xm-btn" data-music-action="song-abc-open">${_musicT('song.abc_open')}</button>
            <input type="file" id="xm-song-abc-file" accept="${_SONG_ABC_ACCEPT}" hidden>
        </div>
        <p class="xm-song-abc__status" id="xm-song-abc-status" role="status" aria-live="polite"></p>
    </section>`;
}

function _songAbcTempo(root) {
    const slider = root.querySelector('#xm-tempo');
    const tempo = slider ? Number(slider.value) : NaN;
    return Number.isFinite(tempo) ? tempo : _SONG_ABC_DEFAULT_TEMPO;
}

/**
 * Escribe en el texto el ABC de la canción de la rejilla y del tempo del control.
 * @param {Element} root Raíz de la pestaña (#xm-root).
 * @returns {string} El ABC escrito.
 */
function exportMusicSongAbc(root) {
    const abc = self.XiroMusic.abcExport.songToAbc({ song: musicSongFormValue(root), tempo: _songAbcTempo(root) });
    root.querySelector('#xm-song-abc').value = abc;
    _songAbcStatus(root, 'ok', _musicT('song.abc_exported'));
    return abc;
}

function _songAbcWarnings(codes) {
    return codes.map(code => _musicT('song.abc_warn_' + code)).join(' · ');
}

/**
 * Lee el ABC del texto y rellena la tarjeta «Canción», el tempo (si el ABC lo trae) y el motivo.
 * @param {Element} root Raíz de la pestaña (#xm-root).
 * @returns {boolean} true si se importó.
 */
function importMusicSongAbc(root) {
    try {
        const { song, tempo, title, warnings } = self.XiroMusic.abcImport.abcToSong(root.querySelector('#xm-song-abc').value);
        applyMusicSongReply(root, { song, tempo, title });
        const done = _musicT('song.abc_imported', { title });
        _songAbcStatus(root, 'ok', warnings.length ? `${done} ${_songAbcWarnings(warnings)}` : done);
        return true;
    } catch (error) {
        _songAbcStatus(root, 'error', _musicT('song.abc_error_' + (error.code || 'FAILED')));
        return false;
    }
}

/**
 * Carga un archivo .abc en el texto y lo importa.
 * @param {Element} root Raíz de la pestaña (#xm-root).
 * @param {File} file
 * @returns {Promise<boolean>} true si se importó.
 */
function loadMusicSongAbcFile(root, file) {
    if (file.size > _SONG_ABC_MAX_BYTES) {
        _songAbcStatus(root, 'error', _musicT('song.abc_error_TOO_BIG'));
        return Promise.resolve(false);
    }
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => {
            root.querySelector('#xm-song-abc').value = String(reader.result);
            resolve(importMusicSongAbc(root));
        };
        reader.onerror = () => {
            _songAbcStatus(root, 'error', _musicT('song.abc_error_FAILED'));
            resolve(false);
        };
        reader.readAsText(file);
    });
}

/**
 * Descarga el ABC del texto (o, si está vacío, el de la rejilla) como xiro-cancion.abc.
 * @param {Element} root Raíz de la pestaña (#xm-root).
 */
function downloadMusicSongAbc(root) {
    const text = root.querySelector('#xm-song-abc').value.trim() ? root.querySelector('#xm-song-abc').value : exportMusicSongAbc(root);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = _SONG_ABC_FILE_NAME;
    link.click();
    URL.revokeObjectURL(url);
}

/** Carga el archivo, lo importa y, si entra, refresca el guardado y la escucha. */
function _songAbcImportFile(root, file) {
    return loadMusicSongAbcFile(root, file).then(applied => {
        if (!applied) return;
        refreshSaveBar();
        musicPreview.update(_musicFormSettings(root));
    });
}

/**
 * Un archivo elegido en el selector.
 * @param {Element} root Raíz de la pestaña (#xm-root).
 * @param {HTMLInputElement} input El selector de archivo.
 */
function onMusicSongAbcFile(root, input) {
    const file = input.files && input.files[0];
    if (!file) return;
    _songAbcImportFile(root, file).then(() => {
        input.value = '';
    });
}

/** Soltar un .abc sobre el cuadro de texto equivale a elegirlo. Delegado: la pestaña se repinta. */
function _songAbcBindDrop() {
    if (typeof attachFileDrop !== 'function') return;
    attachFileDrop(document, {
        selector: '#xm-song-abc',
        accept: _SONG_ABC_ACCEPT,
        onFiles: ([file]) => {
            const root = document.getElementById('xm-root');
            if (root) _songAbcImportFile(root, file);
        }
    });
}

document.addEventListener('DOMContentLoaded', _songAbcBindDrop);

// Acciones de los botones de la tarjeta, que config-panel-music.js suma a las suyas
const _MUSIC_SONG_ABC_ACTIONS = {
    'song-abc-export': root => exportMusicSongAbc(root),
    'song-abc-import': root => importMusicSongAbc(root),
    'song-abc-download': root => downloadMusicSongAbc(root),
    'song-abc-open': root => root.querySelector('#xm-song-abc-file').click()
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderMusicSongAbc, exportMusicSongAbc, importMusicSongAbc, loadMusicSongAbcFile, downloadMusicSongAbc };
}
