// Editor del admin: campo «ruta o URL» junto a cada botón de subir imagen o audio. Sirve para
// reutilizar un fichero que ya está en /uploads (p. ej. el mismo mapa en 52 preguntas de «Toca la
// imagen») o traer uno de otra web. Lo comprueba POST /api/upload/from-ref (services/media-ref.js):
// una ruta local se usa tal cual y una URL externa la descarga el servidor una vez.
// Estilos en css/admin-media-ref.css.

/**
 * Dónde acaba la ruta aceptada en cada sitio. `kind` es el sitio del servidor, que fija los
 * tipos y el tamaño máximo (los mismos que su subida).
 */
const MEDIA_REF_TARGETS = {
    media: { kind: 'media', apply: (media, qIdx) => _applyQuestionMedia(media, qIdx) },
    hotspot: { kind: 'image', apply: (media, qIdx) => _applyQuestionMedia(media, qIdx) },
    question_image: {
        kind: 'small',
        apply: (media, qIdx) => {
            preguntasData[qIdx].question_image_url = media.url;
            dibujarPregunta(qIdx);
        }
    },
    option_image: {
        kind: 'small',
        apply: (media, qIdx, oIdx) => {
            preguntasData[qIdx].options[oIdx].option_image_url = media.url;
            dibujarPregunta(qIdx);
        }
    },
    cover: {
        kind: 'cover',
        apply: (media, coverKind) => {
            const hidden = document.getElementById(GAME_COVER_KIND_STYLES[coverKind].hiddenId);
            if (hidden) hidden.value = media.url;
            actualizarGameCoverPreview(coverKind);
        }
    }
};

// Como subirArchivo: la imagen nueva invalida el área de «Toca la imagen»
function _applyQuestionMedia(media, qIdx) {
    const question = preguntasData[qIdx];
    alCambiarImagenHotspot(question);
    question.tipo_contenido = media.tipo_contenido;
    question.url_recurso = media.url;
    dibujarPregunta(qIdx);
}

const MEDIA_REF_ERRORS = {
    REF_INVALID: () => _t('admin.media_ref.err_invalid', null, 'Escribe una ruta de /uploads/ o una dirección http(s)'),
    REF_NOT_FOUND: () => _t('admin.media_ref.err_not_found', null, 'No hay ningún fichero con ese nombre en /uploads/'),
    REF_TYPE: () => _t('admin.media_ref.err_type', null, 'El fichero no es una imagen o un audio admitido aquí'),
    REF_TOO_LARGE: (params) => _t('admin.media_ref.err_too_large', { kb: params?.kb ?? '?' }, 'El fichero pesa más de {kb} KB, el máximo de este sitio'),
    REF_BLOCKED: () => _t('admin.media_ref.err_blocked', null, 'Esa dirección no es pública'),
    REF_HTTP: () => _t('admin.media_ref.err_http', null, 'La web no ha devuelto el fichero'),
    REF_TIMEOUT: () => _t('admin.media_ref.err_timeout', null, 'La web tarda demasiado en responder'),
    REF_UNREACHABLE: () => _t('admin.media_ref.err_unreachable', null, 'No se ha podido conectar con esa web')
};

function _showMediaRefError(body) {
    const known = MEDIA_REF_ERRORS[body?.code];
    const message = known
        ? known(body.params)
        : body?.error || _t('admin.common.error_server', null, 'Error de conexión con el servidor');
    mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), message, 'error');
}

/**
 * Campo de texto, sin botón: lo comparten el campo en línea y el diálogo de las opciones.
 * @param {string} id - id del input
 * @param {string} submitId - id del botón que pulsa Intro
 */
function _mediaRefInputHtml(id, submitId) {
    const placeholder = _t('admin.media_ref.placeholder', null, '/uploads/mapa.jpg o https://…');
    return `<input type="text" id="${id}" class="xq-field xq-mediaref__input" inputmode="url" autocomplete="off" spellcheck="false"
                                        placeholder="${escapeHtml(placeholder)}" data-media-ref-submit="${submitId}">`;
}

/**
 * Campo «ruta o URL» con su botón «Usar».
 * @param {string} id - id del input; el botón es `${id}-use`
 * @param {string} action - Llamada de data-admin-click, p. ej. usarRutaMedia('hs-ref-0', 'hotspot', 0)
 * @returns {string} HTML
 */
function mediaRefFieldHtml(id, action) {
    return `
                                <div class="xq-mediaref">
                                    <label class="xq-mediaref__label" for="${id}">${_t('admin.media_ref.label', null, 'O usa una ruta o URL')}</label>
                                    <div class="xq-mediaref__row">
                                        ${_mediaRefInputHtml(id, `${id}-use`)}
                                        <button type="button" id="${id}-use" class="xq-btn xq-btn--dashed" data-admin-click="${action}">${_t('admin.media_ref.use', null, 'Usar')}</button>
                                    </div>
                                </div>`;
}

/**
 * Pide al servidor que compruebe la ruta o URL.
 * @param {string} ref
 * @param {string} kind - Sitio del servidor (media, image, small, cover)
 * @returns {Promise<{url: string, tipo_contenido: string}|null>} null si no vale (ya avisado)
 */
async function resolverRutaMedia(ref, kind) {
    try {
        const response = await fetchWithAuth('/api/upload/from-ref', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref, kind })
        });
        const body = await response.json();
        if (response.ok) return body;
        _showMediaRefError(body);
    } catch (err) {
        console.error('Error usando una ruta o URL:', err);
        _showMediaRefError(null);
    }
    return null;
}

/**
 * Aplica una ruta o URL a un sitio del editor.
 * @param {string} ref - Lo que ha escrito el usuario
 * @param {string} target - Clave de MEDIA_REF_TARGETS
 * @param {...*} args - Índices del sitio (pregunta, opción) o tipo de portada
 * @returns {Promise<boolean>} true si se ha aplicado
 */
async function aplicarRutaMedia(ref, target, ...args) {
    const handler = MEDIA_REF_TARGETS[target];
    if (!handler) return false;
    const media = await resolverRutaMedia(ref, handler.kind);
    if (!media) return false;
    handler.apply(media, ...args);
    return true;
}

/**
 * Botón «Usar» del campo: lee el campo y aplica la ruta.
 * @param {string} inputId
 * @param {string} target - Clave de MEDIA_REF_TARGETS
 * @param {...*} args - Índices del sitio o tipo de portada
 * @returns {Promise<boolean>} true si se ha aplicado
 */
async function usarRutaMedia(inputId, target, ...args) {
    const input = document.getElementById(inputId);
    if (!input) return false;
    const ref = input.value.trim();
    if (!ref) {
        input.focus();
        return false;
    }
    const button = document.getElementById(`${inputId}-use`);
    if (button) button.disabled = true;
    try {
        return await aplicarRutaMedia(ref, target, ...args);
    } finally {
        if (button) button.disabled = false;
    }
}

/** Imagen de una opción por ruta: en la fila no cabe un campo, va en un diálogo. */
function abrirRutaImagenOpcion(qIdx, oIdx) {
    const inputId = 'opt-ref-input';
    const field = `<label class="xq-mediaref__label" for="${inputId}">${_t('admin.media_ref.option_label', { n: oIdx + 1 }, 'Ruta o URL de la imagen de la opción {n} (máx. 200 KB)')}</label>
                ${_mediaRefInputHtml(inputId, 'btnConfirmarModal')}`;
    let input = null;
    mostrarModalConfirmacion(
        _t('admin.media_ref.option_title', null, 'Imagen ya subida o de otra web'),
        field,
        // El diálogo se quita del DOM antes de confirmar: se lee del campo que ya teníamos
        () => (input?.value.trim() ? aplicarRutaMedia(input.value.trim(), 'option_image', qIdx, oIdx) : false),
        null,
        _t('admin.media_ref.use', null, 'Usar'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
    input = document.getElementById(inputId);
    input?.focus();
}

// Intro en un campo de ruta pulsa su botón (data-admin-* no escucha teclas)
document.addEventListener?.('keydown', (event) => {
    const submitId = event.target?.dataset?.mediaRefSubmit;
    if (event.key !== 'Enter' || !submitId) return;
    event.preventDefault();
    document.getElementById(submitId)?.click();
});

// ===== Ruta del recurso ya puesto, para copiarla y reutilizarla en otras preguntas =====

const MEDIA_PATH_FEEDBACK_MS = 2000;

/**
 * Ruta de solo lectura con un botón «Copiar».
 * @param {string} id - id del input; el botón es `${id}-copy`
 * @param {string} url - Ruta guardada en la pregunta (/uploads/…)
 * @returns {string} HTML
 */
function mediaPathHtml(id, url) {
    return `
                                <div class="xq-mediaref">
                                    <label class="xq-mediaref__label" for="${id}">${_t('admin.media_ref.path_label', null, 'Ruta para reutilizarlo en otras preguntas')}</label>
                                    <div class="xq-mediaref__row">
                                        <input type="text" id="${id}" class="xq-field xq-mediaref__input xq-mediaref__input--path" value="${escapeHtml(url)}" readonly data-media-ref-select>
                                        <button type="button" id="${id}-copy" class="xq-btn xq-btn--dashed" data-admin-click="copiarRutaMedia('${id}')">${_t('admin.media_ref.copy', null, 'Copiar')}</button>
                                    </div>
                                </div>`;
}

// navigator.clipboard solo existe en contexto seguro: por HTTP en la red local queda execCommand
async function _copyText(input) {
    try {
        if (window.isSecureContext && navigator.clipboard) {
            await navigator.clipboard.writeText(input.value);
            return true;
        }
        return document.execCommand('copy');
    } catch (err) {
        console.error('No se ha podido copiar la ruta:', err);
        return false;
    }
}

/**
 * Botón «Copiar»: copia la ruta y lo dice en el botón un momento. Si el navegador no deja,
 * la ruta queda seleccionada para copiarla a mano.
 * @param {string} inputId
 * @returns {Promise<boolean>} true si se ha copiado
 */
async function copiarRutaMedia(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return false;
    input.select();
    const copied = await _copyText(input);
    const button = document.getElementById(`${inputId}-copy`);
    if (button) {
        const original = button.textContent;
        button.textContent = copied
            ? _t('admin.media_ref.copied', null, 'Copiada')
            : _t('admin.media_ref.copy_failed', null, 'Cópiala a mano');
        setTimeout(() => { button.textContent = original; }, MEDIA_PATH_FEEDBACK_MS);
    }
    return copied;
}

// Al entrar en la ruta se selecciona entera: más fácil de copiar con el teclado
document.addEventListener?.('focusin', (event) => {
    if (event.target?.dataset && 'mediaRefSelect' in event.target.dataset) event.target.select();
});
