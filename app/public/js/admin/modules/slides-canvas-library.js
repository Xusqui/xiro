/**
 * @fileoverview Biblioteca de diapositivas libres en el selector de plantillas (#lienzoBiblioteca): lista con
 * miniaturas, usar una en el juego, exportarla, cambiarle el nombre, eliminarla e importar archivos .xiroslide;
 * y «Guardar en biblioteca» desde la tarjeta de una diapositiva del juego. API: /api/canvas-slides/library
 * (routes/canvas-slide-library.routes.js); un editor solo cambia lo que guardó. Reutiliza helpers globales:
 * fetchWithAuth(), mostrarEditorLienzo(), mostrarModalError(), mostrarModalConfirmacion(), escapeHtml() y los
 * de slides-canvas-export.js y slides-canvas-import.js.
 */

const _LIENZO_LIBRARY_URL = '/api/canvas-slides/library';
const _LIENZO_LIBRARY_MAX_NAME = 120;
let _lienzoLibraryItems = [];

/** Cabecera de la sección (título e «Importar a la biblioteca») seguida del contenido. */
function _lienzoLibraryShell(body) {
    const th = window.XiroCanvasEditor.th;
    return `
            <div class="xsce-lib-head">
                <h4 id="lienzoBibliotecaTitulo">${th('library.title')}</h4>
                <button type="button" class="xsce-btn xsce-btn--ghost xsce-btn--sm" data-admin-click="importarABibliotecaLienzo()">
                    <i class="fas fa-file-import" aria-hidden="true"></i>${th('library.import')}
                </button>
            </div>
            <p class="xsce-lib-intro">${th('library.intro')}</p>
            ${body}`;
}

function _lienzoLibraryMessage(key) {
    return `<p class="xsce-lib-empty">${window.XiroCanvasEditor.th(key)}</p>`;
}

/** Pinta la sección con ese contenido, si el selector sigue abierto. */
function _lienzoLibraryPaint(body) {
    const box = document.getElementById('lienzoBiblioteca');
    if (box) box.innerHTML = _lienzoLibraryShell(body);
}

function _lienzoLibraryItemHtml(item) {
    const E = window.XiroCanvasEditor;
    const th = E.th;
    const id = Number(item.id);
    const R = window.XiroSlideCanvasRender;
    const stage = R ? R.stageHtml(item.slide_canvas || {}, { mode: 'thumb', labels: E.videoLabels() }) : '';
    const author = item.created_by_username ? th('library.by', { user: item.created_by_username }) : '';
    const action = (fn, icon, key, extraClass) => `
                    <button type="button" class="xsce-icon-btn${extraClass || ''}" data-admin-click="${fn}(${id})" title="${th(key)}" aria-label="${th(key)}">
                        <i class="fas ${icon}" aria-hidden="true"></i>
                    </button>`;
    return `
            <div class="xsce-lib-item">
                <button type="button" class="xsce-tpl" data-admin-click="usarSlideBiblioteca(${id})" title="${th('library.use')}">
                    <span class="xsce-tpl-thumb xsce-thumb--sm" aria-hidden="true" data-i18n-skip="true">${stage}</span>
                    <span class="xsce-tpl-name" data-i18n-skip="true">${escapeHtml(item.name || '')}</span>
                    <span class="xsce-tpl-desc" data-i18n-skip="true">${author}</span>
                </button>
                <div class="xsce-lib-actions">
                    ${action('exportarSlideBiblioteca', 'fa-file-export', 'library.export')}
                    ${action('renombrarSlideBiblioteca', 'fa-pen', 'library.rename')}
                    ${action('eliminarSlideBiblioteca', 'fa-trash', 'library.delete', ' xsce-icon-btn--danger')}
                </div>
            </div>`;
}

/** Pinta la lista cargada en _lienzoLibraryItems. */
function _lienzoRenderLibrary() {
    _lienzoLibraryPaint(
        _lienzoLibraryItems.length
            ? `<div class="xsce-lib-grid">${_lienzoLibraryItems.map(_lienzoLibraryItemHtml).join('')}</div>`
            : _lienzoLibraryMessage('library.empty')
    );
}

/** Pide la biblioteca al servidor y la pinta en el selector de plantillas. */
async function cargarBibliotecaLienzo() {
    if (!document.getElementById('lienzoBiblioteca')) return;
    _lienzoLibraryPaint(_lienzoLibraryMessage('library.loading'));
    try {
        const res = await fetchWithAuth(_LIENZO_LIBRARY_URL);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const items = await res.json();
        _lienzoLibraryItems = Array.isArray(items) ? items : [];
        _lienzoRenderLibrary();
    } catch (_err) {
        _lienzoLibraryPaint(_lienzoLibraryMessage('library.load_error'));
    }
}

/** Llama a la API de la biblioteca; enseña el error y devuelve null si falla. */
async function _lienzoLibraryRequest(url, method, body) {
    const E = window.XiroCanvasEditor;
    try {
        const res = await fetchWithAuth(url, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : {},
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) return data;
        mostrarModalError(E.th('library.error_title'), E.pkg.errorHtml(data), 'error');
    } catch (_err) {
        mostrarModalError(E.th('library.error_title'), E.th('io.error.generic'), 'error');
    }
    return null;
}

function _lienzoLibraryItem(id) {
    return _lienzoLibraryItems.find(item => Number(item.id) === Number(id)) || null;
}

/** Diálogo para escribir el nombre; onName recibe el nombre ya recortado. */
function _lienzoAskName(titleKey, value, onName) {
    const E = window.XiroCanvasEditor;
    E.ioDialog.open({
        title: E.t(titleKey),
        label: E.t('library.name_label'),
        value: value,
        maxLength: _LIENZO_LIBRARY_MAX_NAME,
        icon: 'fa-bookmark',
        confirmLabel: E.t('library.save'),
        onConfirm: (raw, ui) => {
            const name = raw.trim();
            if (!name) {
                ui.setStatus(E.t('library.name_required'), false);
                return false;
            }
            onName(name);
            return true;
        }
    });
}

/** Clic en una miniatura: abre una copia en el editor; entra en el juego al pulsar Aplicar. */
function usarSlideBiblioteca(id) {
    const item = _lienzoLibraryItem(id);
    if (!item) return;
    document.getElementById('modalLienzoPlantillas')?.remove();
    mostrarEditorLienzo(null, null, JSON.parse(JSON.stringify(item.slide_canvas)));
}

async function exportarSlideBiblioteca(id) {
    const item = _lienzoLibraryItem(id);
    if (!item) return;
    const text = await _lienzoPackageText([item.slide_canvas], window.XiroSlidePackage.MAX_PACKAGE_BYTES);
    if (text) window.XiroCanvasEditor.pkg.download(text, item.name);
}

function renombrarSlideBiblioteca(id) {
    const item = _lienzoLibraryItem(id);
    if (!item) return;
    _lienzoAskName('library.rename_title', item.name, async name => {
        if (await _lienzoLibraryRequest(`${_LIENZO_LIBRARY_URL}/${Number(id)}`, 'PATCH', { name })) {
            await cargarBibliotecaLienzo();
        }
    });
}

function eliminarSlideBiblioteca(id) {
    const item = _lienzoLibraryItem(id);
    if (!item) return;
    const th = window.XiroCanvasEditor.th;
    mostrarModalConfirmacion(
        th('library.delete_title'),
        th('library.delete_msg', { name: item.name }),
        async () => {
            if (await _lienzoLibraryRequest(`${_LIENZO_LIBRARY_URL}/${Number(id)}`, 'DELETE')) {
                await cargarBibliotecaLienzo();
            }
        },
        null,
        th('library.delete_confirm'),
        th('cancel')
    );
}

/** Botón «Guardar en biblioteca» de la tarjeta de una diapositiva libre del juego. */
function guardarSlideEnBiblioteca(idx) {
    const canvas = _lienzoCanvasAt(idx);
    if (!canvas) return;
    const E = window.XiroCanvasEditor;
    _lienzoAskName('library.save_title', _lienzoDefaultName(canvas, idx), async name => {
        const saved = await _lienzoLibraryRequest(_LIENZO_LIBRARY_URL, 'POST', { name, slide_canvas: canvas });
        if (saved) mostrarModalError(E.th('library.saved_title'), E.th('library.saved'), 'success');
    });
}

/** Guarda en la biblioteca cada diapositiva importada; el nombre sale de su primer texto o del archivo. */
async function _lienzoSaveImported(result, fileName) {
    const E = window.XiroCanvasEditor;
    const base = String(fileName || '').replace(/\.[^.]+$/, '') || E.t('library.title');
    let saved = 0;
    for (let i = 0; i < result.slides.length; i++) {
        const canvas = result.slides[i].slide_canvas;
        const fallback = result.slides.length > 1 ? `${base} ${i + 1}` : base;
        const name = (window.XiroSlidePackage.firstText(canvas) || fallback).slice(0, _LIENZO_LIBRARY_MAX_NAME);
        if (await _lienzoLibraryRequest(_LIENZO_LIBRARY_URL, 'POST', { name, slide_canvas: canvas })) saved++;
    }
    await cargarBibliotecaLienzo();
    if (result.warnings && result.warnings.length) E.pkg.showWarnings(result.warnings, 'io.warnings_title');
    else if (saved) mostrarModalError(E.th('library.saved_title'), E.th('library.imported', { n: saved }), 'success');
}

/** Botón «Importar a la biblioteca» de la sección. */
function importarABibliotecaLienzo() {
    _lienzoChooseFile(async file => {
        const result = await _lienzoSendPackage(file);
        if (result) await _lienzoSaveImported(result, file.name);
    });
}
