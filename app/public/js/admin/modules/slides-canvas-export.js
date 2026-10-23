/**
 * @fileoverview Exportar diapositivas libres del juego en edición: descargar una como archivo .xiroslide,
 * copiarla al portapapeles (para pegarla en otro juego o en otra instalación de XiRo) y descargar todas
 * las del juego en un solo archivo. Botones en slides-canvas-card.js; el paquete lo arma
 * slides-canvas-package.js. Reutiliza helpers globales: currentCustomGameQuestions y mostrarModalError().
 */

/** Lienzo de la diapositiva libre en la posición idx del juego, o null. */
function _lienzoCanvasAt(idx) {
    const q = currentCustomGameQuestions[idx];
    return q && q.slide_type === 'canvas' && q.slide_canvas ? q.slide_canvas : null;
}

/** Nombre propuesto: la primera línea de texto de la diapositiva o «Diapositiva N». */
function _lienzoDefaultName(canvas, idx) {
    return window.XiroSlidePackage.firstText(canvas) || window.XiroCanvasEditor.t('io.default_name', { n: idx + 1 });
}

/**
 * Texto JSON del paquete con esas diapositivas, o null si falla o supera el límite (el aviso ya se ha enseñado).
 * @param {Object[]} canvases - Lienzos a exportar
 * @param {number} limit - Bytes máximos (MAX_PACKAGE_BYTES o MAX_CLIPBOARD_BYTES)
 * @returns {Promise<string|null>}
 */
async function _lienzoPackageText(canvases, limit) {
    const E = window.XiroCanvasEditor;
    try {
        const { pkg, warnings } = await E.pkg.buildPackage(canvases);
        const text = JSON.stringify(pkg);
        if (new Blob([text]).size > limit) {
            const key = limit === window.XiroSlidePackage.MAX_CLIPBOARD_BYTES ? 'io.too_big_clipboard' : 'io.too_big';
            mostrarModalError(E.th('io.export_error_title'), E.th(key, { maxMb: Math.round(limit / 1048576) }), 'warning');
            return null;
        }
        E.pkg.showWarnings(warnings, 'io.export_warnings_title');
        return text;
    } catch (_err) {
        mostrarModalError(E.th('io.export_error_title'), E.th('io.error.generic'), 'error');
        return null;
    }
}

/** Botón «Exportar» de la tarjeta de una diapositiva libre. */
async function exportarSlideLienzo(idx) {
    const canvas = _lienzoCanvasAt(idx);
    if (!canvas) return;
    const text = await _lienzoPackageText([canvas], window.XiroSlidePackage.MAX_PACKAGE_BYTES);
    if (text) window.XiroCanvasEditor.pkg.download(text, _lienzoDefaultName(canvas, idx));
}

/** Botón «Exportar diapositivas libres» del editor de juegos personalizados. */
async function exportarTodasLasSlidesLienzo() {
    const E = window.XiroCanvasEditor;
    const canvases = currentCustomGameQuestions
        .filter(q => q.slide_type === 'canvas' && q.slide_canvas)
        .map(q => q.slide_canvas);
    if (!canvases.length) {
        mostrarModalError(E.th('io.export_error_title'), E.th('io.no_slides'), 'info');
        return;
    }
    const text = await _lienzoPackageText(canvases, window.XiroSlidePackage.MAX_PACKAGE_BYTES);
    const gameName = (document.getElementById('customGameName')?.value || '').trim() || E.t('title');
    if (text) E.pkg.download(text, E.t('io.all_file', { name: gameName }));
}

/** Botón «Copiar» de la tarjeta de una diapositiva libre. */
async function copiarSlideLienzo(idx) {
    const canvas = _lienzoCanvasAt(idx);
    if (!canvas) return;
    const text = await _lienzoPackageText([canvas], window.XiroSlidePackage.MAX_CLIPBOARD_BYTES);
    if (text) await _lienzoCopyText(text);
}

/** Copia con la API del portapapeles; sin ella (HTTP en la red local) o si falla, diálogo para copiar a mano. */
async function _lienzoCopyText(text) {
    const E = window.XiroCanvasEditor;
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            mostrarModalError(E.th('io.copied_title'), E.th('io.copied'), 'success');
            return;
        } catch (_err) {
            // Sin permiso o fuera del gesto del usuario: se copia a mano
        }
    }
    E.ioDialog.open({
        title: E.t('io.copy_title'),
        hint: E.t('io.copy_hint'),
        value: text,
        multiline: true,
        readonly: true,
        icon: 'fa-copy',
        confirmLabel: E.t('io.copy_button'),
        onConfirm: (_value, ui) => {
            ui.select();
            const ok = typeof document.execCommand === 'function' && document.execCommand('copy') === true;
            ui.setStatus(E.t(ok ? 'io.copied' : 'io.copy_failed'), ok);
            return false;
        }
    });
}
