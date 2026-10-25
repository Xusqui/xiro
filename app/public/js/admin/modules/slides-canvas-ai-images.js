/**
 * @fileoverview Imágenes del diálogo «Generar con IA» de las diapositivas libres: el usuario adjunta hasta 4, que
 * se suben a /uploads/ al elegirlas (POST /api/upload, como las del editor) y van con la petición para que la IA
 * las coloque (campo images de POST /api/ai-generator/canvas-slides). Mientras se suben, Generar espera.
 * Reutiliza helpers globales: fetchWithAuth(), y _lienzoIaStatus() y _lienzoIaBusy() de slides-canvas-ai.js.
 */

const _LIENZO_IA_IMAGES_MAX = 4;
const _LIENZO_IA_IMAGES_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';
let _lienzoIaImages = [];

/** Campo «Imágenes (opcional)» del diálogo, con la explicación de las fotos libres. */
function _lienzoIaImagesFieldHtml() {
    const th = window.XiroCanvasEditor.th;
    return `
            <div class="xsce-field">
                <label class="xsce-label" for="lienzoIAImages">${th('ai.images_label')}</label>
                <input type="file" id="lienzoIAImages" class="xsce-file" accept="${_LIENZO_IA_IMAGES_ACCEPT}" multiple>
                <p class="text-xs text-slate-500">${th('ai.images_hint', { n: _LIENZO_IA_IMAGES_MAX })}</p>
            </div>`;
}

/** Olvida las imágenes elegidas (al abrir el diálogo). */
function _lienzoIaImagesReset() {
    _lienzoIaImages = [];
}

/** Sube una imagen a /uploads/ y devuelve { url, name }. */
async function _lienzoIaUploadImage(file) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetchWithAuth('/api/upload', { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || '');
    return { url: data.url, name: file.name };
}

/** Sube las imágenes elegidas, una detrás de otra (como mucho _LIENZO_IA_IMAGES_MAX); mientras, Generar espera. */
async function _lienzoIaReadImages(input) {
    const E = window.XiroCanvasEditor;
    const files = Array.from(input.files || []).slice(0, _LIENZO_IA_IMAGES_MAX);
    _lienzoIaImages = [];
    if (!files.length) return;
    input.disabled = true;
    _lienzoIaBusy(true);
    _lienzoIaStatus(E.t('ai.images_uploading'), null);
    try {
        const uploaded = [];
        for (const file of files) uploaded.push(await _lienzoIaUploadImage(file));
        _lienzoIaImages = uploaded;
        _lienzoIaStatus(E.t('ai.images_ready', { names: uploaded.map(img => img.name).join(', ') }), true);
    } catch (err) {
        input.value = '';
        _lienzoIaStatus(err.message || E.t('ai.error.images'), false);
    } finally {
        input.disabled = false;
        _lienzoIaBusy(false);
    }
}

/** Imágenes para la petición: [{ url, name }]. */
function _lienzoIaImagesPayload() {
    return _lienzoIaImages.slice();
}
