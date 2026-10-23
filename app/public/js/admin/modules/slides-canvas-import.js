/**
 * @fileoverview Importar diapositivas libres desde un archivo .xiroslide o desde el portapapeles. El servidor
 * valida el paquete y guarda sus imágenes (POST /api/canvas-slides/import); aquí se decide dónde van: una sola
 * diapositiva se abre en el editor (entra en el juego al pulsar Aplicar) y varias se añaden al final del juego
 * tras confirmar. La biblioteca (slides-canvas-library.js) reutiliza _lienzoChooseFile y _lienzoSendPackage.
 * Reutiliza helpers globales: currentCustomGameQuestions, dibujarPreguntasPersonalizadas(), mostrarEditorLienzo(),
 * mostrarModalError(), mostrarModalConfirmacion() y fetchWithAuth().
 */

const _LIENZO_IMPORT_INPUT = 'lienzoImportarArchivo';

/** Abre el selector de archivos y pasa el elegido a onFile. */
function _lienzoChooseFile(onFile) {
    document.getElementById(_LIENZO_IMPORT_INPUT)?.remove();
    const input = document.createElement('input');
    input.type = 'file';
    input.id = _LIENZO_IMPORT_INPUT;
    input.accept = '.xiroslide,.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        input.remove();
        if (file) onFile(file);
    });
    document.body.appendChild(input);
    input.click();
}

/** Envía el paquete al servidor: { slides, warnings }, o null tras enseñar el error. */
async function _lienzoSendPackage(file) {
    const E = window.XiroCanvasEditor;
    const form = new FormData();
    form.append('file', file, file.name || 'diapositivas.xiroslide');
    try {
        const res = await fetchWithAuth('/api/canvas-slides/import', { method: 'POST', body: form });
        const body = await res.json().catch(() => ({}));
        if (res.ok) return body;
        mostrarModalError(E.th('io.error_title'), E.pkg.errorHtml(body), 'error');
    } catch (_err) {
        mostrarModalError(E.th('io.error_title'), E.th('io.error.generic'), 'error');
    }
    return null;
}

/** Texto del portapapeles: con la API si se puede; si no, diálogo para pegarlo a mano. */
async function _lienzoReadPaste(onText) {
    const E = window.XiroCanvasEditor;
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.readText) {
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
                onText(text);
                return;
            }
        } catch (_err) {
            // Sin permiso: se pega a mano
        }
    }
    E.ioDialog.open({
        title: E.t('io.paste_title'),
        hint: E.t('io.paste_hint'),
        multiline: true,
        icon: 'fa-paste',
        confirmLabel: E.t('io.paste_import'),
        onConfirm: value => {
            if (!value.trim()) return false;
            onText(value);
            return true;
        }
    });
}

/** Añade al final del juego las diapositivas importadas (quedan sin guardar hasta pulsar Guardar). */
function _lienzoAppendSlides(canvases) {
    canvases.forEach(canvas => {
        currentCustomGameQuestions.push(
            Object.assign({}, _LIENZO_LEGACY_FIELDS, {
                slide_type: 'canvas',
                slide_canvas: canvas,
                question_id: null,
                position: currentCustomGameQuestions.length
            })
        );
    });
    dibujarPreguntasPersonalizadas();
}

// Textos (claves admin.canvas.*) de la confirmación y los avisos; la IA pasa los suyos (slides-canvas-ai.js)
const _LIENZO_ADD_TEXTS = {
    manyTitle: 'io.import_many_title',
    many: 'io.import_many',
    manyConfirm: 'io.import_many_confirm',
    warningsTitle: 'io.warnings_title'
};

/** Una diapositiva va al editor; varias, al final del juego tras confirmar. */
function _lienzoAddToGame(result, texts) {
    const E = window.XiroCanvasEditor;
    const keys = Object.assign({}, _LIENZO_ADD_TEXTS, texts);
    const canvases = result.slides.map(slide => slide.slide_canvas);
    const showWarnings = () => E.pkg.showWarnings(result.warnings, keys.warningsTitle);
    if (canvases.length === 1) {
        document.getElementById('modalLienzoPlantillas')?.remove();
        mostrarEditorLienzo(null, null, canvases[0]);
        showWarnings();
        return;
    }
    const n = canvases.length;
    mostrarModalConfirmacion(
        E.th(keys.manyTitle),
        E.th(keys.many, { n }),
        () => {
            document.getElementById('modalLienzoPlantillas')?.remove();
            _lienzoAppendSlides(canvases);
            showWarnings();
        },
        null,
        E.th(keys.manyConfirm, { n }),
        E.th('cancel')
    );
}

/** Botón «Importar archivo» del selector de diapositivas libres. */
function importarSlidesLienzo() {
    _lienzoChooseFile(async file => {
        const result = await _lienzoSendPackage(file);
        if (result) _lienzoAddToGame(result);
    });
}

/** Botón «Pegar» del selector de diapositivas libres. */
function pegarSlidesLienzo() {
    _lienzoReadPaste(async text => {
        const file = new File([text], 'portapapeles.xiroslide', { type: 'application/json' });
        const result = await _lienzoSendPackage(file);
        if (result) _lienzoAddToGame(result);
    });
}
