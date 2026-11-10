// Editor de preguntas del admin: bloque plegable "Más opciones" de la tarjeta (tiempo,
// imagen pequeña del enunciado y contenido multimedia). Casi nunca se tocan, por eso van
// al final y cerrados; se abren solos si la pregunta ya tiene imagen o multimedia.
// Las subidas y borrados están en multimedia.js.

function _questionTimeHtml(q, qIdx) {
    const fallback = getDefaultQuestionTimeLimit();
    return `
                            <div>
                                <label class="xq-label" for="q-time-${qIdx}"><i class="fas fa-clock" aria-hidden="true"></i> ${_t('admin.q.time_label', null, 'Tiempo para responder (segundos)')}</label>
                                <input type="number" id="q-time-${qIdx}" min="5" max="120" value="${q.time_limit || fallback}" placeholder="${fallback}"
                                    data-admin-input="preguntasData[${qIdx}].time_limit = Math.max(5, Math.min(120, parseInt(this.value) || getDefaultQuestionTimeLimit()))"
                                    class="xq-field xq-field--short" aria-describedby="q-time-help-${qIdx}">
                                <p class="xq-hint" id="q-time-help-${qIdx}">${_t('admin.q.time_help', { seconds: fallback }, 'Por defecto: {seconds} segundos (min: 5, max: 120)')}</p>
                            </div>`;
}

function _questionImageHtml(q, qIdx) {
    const label = `<p class="xq-label"><i class="fas fa-image" aria-hidden="true"></i> ${_t('admin.q.q_image_label', null, 'Imagen del enunciado')}
                                    <span class="xq-label__aside">${_t('admin.q.q_image_limits', null, 'máx. 200×200 px / 200 KB')}</span></p>`;
    if (!q.question_image_url) {
        return `
                            <div>${label}
                                <button type="button" id="q-img-btn-${qIdx}" data-admin-click="abrirSelectorImagenPregunta(${qIdx})" class="xq-btn xq-btn--dashed">
                                    <i class="fas fa-plus-circle" aria-hidden="true"></i> ${_t('admin.q.q_image_add', null, 'Añadir imagen pequeña (opcional)')}
                                </button>
                            </div>`;
    }
    return `
                            <div>${label}
                                <div class="xq-media-row">
                                    <img src="${escapeHtml(q.question_image_url)}" alt="${_t('admin.q.q_image_alt', null, 'Imagen del enunciado')}" width="64" height="64" class="xq-media-row__thumb">
                                    <p class="xq-media-row__url">${escapeHtml(q.question_image_url)}</p>
                                    <button type="button" id="q-img-btn-${qIdx}" data-admin-click="eliminarImagenPregunta(${qIdx})" class="xq-btn xq-btn--danger-link">
                                        <i class="fas fa-trash-alt" aria-hidden="true"></i> ${_t('admin.q.q_image_remove', null, 'Quitar imagen')}
                                    </button>
                                </div>
                            </div>`;
}

function _questionMediaUploadHtml(qIdx) {
    return `
                                <div id="drop-zone-${qIdx}" class="drop-zone xq-dropzone">
                                    <p class="xq-hint">${_t('admin.q.media_drop', null, 'Arrastra un archivo aquí o haz clic para seleccionar')}</p>
                                    <button type="button" id="upload-btn-${qIdx}" data-admin-click="abrirSelectorArchivo(${qIdx})" class="xq-btn xq-btn--add">
                                        <i class="fas fa-upload" aria-hidden="true"></i> ${_t('admin.q.media_upload', null, 'Subir imagen o audio')}
                                    </button>
                                    <p class="xq-hint">${_t('admin.q.media_limit', null, 'Máx.: 5 MB (imagen) / 10 MB (audio)')}</p>
                                </div>`;
}

function _questionMediaAttachedHtml(q, qIdx) {
    const isImage = q.tipo_contenido === 'imagen';
    const name = isImage ? _t('admin.q.media_image', null, 'Imagen') : _t('admin.q.media_audio', null, 'Audio');
    const note = isImage
        ? _t('admin.q.media_note_image', null, 'Con imagen, la pantalla del presentador oculta las opciones para que se vea bien; los jugadores las ven en el móvil como siempre.')
        : _t('admin.q.media_note_audio', null, 'El audio suena en la pantalla del presentador; en los móviles de los jugadores está silenciado.');
    const preview = isImage
        ? `<img src="${escapeHtml(q.url_recurso)}" alt="${_t('admin.q.media_preview_alt', null, 'Vista previa')}" class="xq-media-preview">`
        : `<div id="audio-container-${qIdx}" class="audio-placeholder" data-audio-src="${escapeHtml(q.url_recurso)}"></div>`;
    return `
                                <div class="xq-media-row">
                                    <i class="fas ${isImage ? 'fa-image' : 'fa-volume-up'} xq-media-row__icon" aria-hidden="true"></i>
                                    <div class="xq-media-row__url"><strong>${name}</strong><br>${escapeHtml(q.url_recurso)}</div>
                                    <button type="button" data-admin-click="eliminarRecurso(${qIdx})" class="xq-iconbtn xq-iconbtn--danger"
                                        aria-label="${_t('admin.q.media_remove', null, 'Quitar el contenido multimedia')}" title="${_t('admin.q.media_remove', null, 'Quitar el contenido multimedia')}">
                                        <i class="fas fa-trash" aria-hidden="true"></i>
                                    </button>
                                </div>
                                ${preview}
                                <p class="xq-hint">${note}</p>`;
}

function _questionMediaHtml(q, qIdx) {
    return `
                            <div>
                                <p class="xq-label"><i class="fas fa-photo-video" aria-hidden="true"></i> ${_t('admin.q.media_label', null, 'Contenido multimedia')}</p>
                                ${q.tipo_contenido === 'texto' ? _questionMediaUploadHtml(qIdx) : _questionMediaAttachedHtml(q, qIdx)}
                            </div>`;
}

/** Lo que ya lleva la pregunta, para leerlo con el bloque cerrado. */
function _moreOptionsSummary(q) {
    const parts = [_t('admin.q.more_time', { seconds: q.time_limit || getDefaultQuestionTimeLimit() }, '{seconds} s')];
    if (q.question_image_url) parts.push(_t('admin.q.q_image_label', null, 'Imagen del enunciado'));
    if (q.tipo_contenido === 'imagen') parts.push(_t('admin.q.media_image', null, 'Imagen'));
    if (q.tipo_contenido === 'audio') parts.push(_t('admin.q.media_audio', null, 'Audio'));
    return parts.map(escapeHtml).join(' · ');
}

/** Bloque "Más opciones" de la tarjeta. */
function questionMoreOptionsHtml(q, qIdx) {
    const hasExtras = Boolean(q.question_image_url) || (q.tipo_contenido && q.tipo_contenido !== 'texto');
    const open = isQuestionDetailsOpen(q, 'more', hasExtras);
    return `
                        <details class="xq-more" data-q-details="more"${open ? ' open' : ''}>
                            <summary class="xq-more__summary">
                                <span class="xq-more__icon" aria-hidden="true"><i class="fas fa-sliders"></i></span>
                                <span>${_t('admin.q.more_options', null, 'Más opciones')}</span>
                                <span class="xq-more__state">${_moreOptionsSummary(q)}</span>
                            </summary>
                            <div class="xq-more__body">
                                ${_questionTimeHtml(q, qIdx)}
                                ${_questionImageHtml(q, qIdx)}
                                ${_questionMediaHtml(q, qIdx)}
                            </div>
                        </details>`;
}
