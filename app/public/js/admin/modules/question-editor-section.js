// Editor de preguntas del admin: piezas comunes de la sección de cada tipo. La sección
// toma el color de su tipo (variables --xq-* de la tarjeta, css/admin-question-type-picker.css),
// el mismo que su baldosa del selector y su chip de la cabecera.

/**
 * Sección de respuestas de un tipo.
 * @param {string} title - Título visible (p. ej. "Respuestas")
 * @param {string} hint - Qué hay que hacer, en una línea (puede ir vacío)
 * @param {string} bodyHtml - Campos de la sección
 * @returns {string}
 */
function questionSectionHtml(title, hint, bodyHtml) {
    return `
                    <section class="xq-section">
                        <div class="xq-section__head">
                            <h4 class="xq-section__title">${title}</h4>
                            ${hint ? `<p class="xq-section__hint">${hint}</p>` : ''}
                        </div>
                        ${bodyHtml}
                    </section>`;
}

/** Bloque plegable "Cómo funciona" (cerrado salvo que el usuario lo abra). */
function questionHelpHtml(q, items) {
    const open = isQuestionDetailsOpen(q, 'help', false);
    return `
                        <details class="xq-help" data-q-details="help"${open ? ' open' : ''}>
                            <summary>${_t('admin.q.how_it_works_toggle', null, 'Cómo funciona')}</summary>
                            <ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>
                        </details>`;
}

/** Botón de icono para una opción (quitar, subir, bajar…), con nombre accesible. */
function optionIconButtonHtml(id, action, icon, label, disabled = false) {
    return `<button type="button" id="${id}" class="xq-iconbtn xq-iconbtn--sm" data-admin-click="${action}" aria-label="${label}" title="${label}"${disabled ? ' disabled' : ''}><i class="fas ${icon}" aria-hidden="true"></i></button>`;
}

/** Imagen de una opción: miniatura con "Quitar", o el botón para añadirla (input de archivo alcanzable). */
function optionImageHtml(opt, qIdx, oIdx) {
    const n = oIdx + 1;
    if (opt.option_image_url) {
        const label = _t('admin.q.option_image_remove', { n }, 'Quitar la imagen de la opción {n}');
        return `<span class="xq-option__thumb"><img src="${escapeHtml(opt.option_image_url)}" width="40" height="40" alt="${_t('admin.q.option_image_alt', { n }, 'Imagen de la opción {n}')}">
                                            ${optionIconButtonHtml(`opt-img-btn-${qIdx}-${oIdx}`, `eliminarImagenOpcion(${qIdx}, ${oIdx})`, 'fa-xmark', label)}</span>`;
    }
    const label = _t('admin.q.option_image_add', { n }, 'Añadir imagen a la opción {n} (máx. 200 KB)');
    return `<label class="xq-iconbtn xq-iconbtn--sm xq-option__file" title="${label}"><i class="fas fa-image" aria-hidden="true"></i><input type="file" class="sr-only" aria-label="${label}"
                                            accept="image/jpeg,image/png,image/gif,image/webp" data-admin-change="onImagenOpcionChange(this, ${qIdx}, ${oIdx})"></label>`;
}

/**
 * Texto de una opción (nombre accesible propio, no el placeholder). Crece en altura y
 * parte el texto en líneas: una opción larga se lee entera sin desplazarse dentro del campo.
 */
function optionTextInputHtml(opt, qIdx, oIdx) {
    const label = _t('admin.q.option_n', { n: oIdx + 1 }, 'Opción {n}');
    return `<textarea id="opt-${qIdx}-${oIdx}" rows="1" class="xq-option__input" data-autogrow data-single-line
                                            aria-label="${label}" placeholder="${label}" data-admin-input="preguntasData[${qIdx}].options[${oIdx}].optionText = this.value">${escapeHtml(opt.optionText || '')}</textarea>`;
}

/** Botón "+ Añadir opción" (hasta 6). */
function addOptionButtonHtml(q, qIdx) {
    if (q.options.length >= 6) return '';
    return `
                        <button type="button" id="opt-add-${qIdx}" data-admin-click="añadirOpcion(${qIdx})" class="xq-btn xq-btn--dashed">
                            ${_t('admin.q.btn_add_option', null, '+ Añadir opción')}
                        </button>`;
}

/** Justificación de la respuesta correcta (quiz y selección múltiple). */
function justificationHtml(q, qIdx) {
    return `
                    <div>
                        <label class="xq-label" for="q-just-${qIdx}">${_t('admin.q.justification_label', null, 'Justificación de la respuesta correcta')}
                            <span class="xq-label__aside">${_t('admin.q.optional', null, 'opcional')}</span></label>
                        <textarea id="q-just-${qIdx}" rows="2" class="xq-field" data-autogrow data-admin-input="preguntasData[${qIdx}].justification = this.value"
                            placeholder="${escapeHtml(_t('admin.q.justification_placeholder', null, 'Se muestra al revelar la respuesta'))}">${escapeHtml(q.justification || '')}</textarea>
                    </div>`;
}
