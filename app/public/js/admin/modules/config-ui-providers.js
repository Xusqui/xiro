/**
 * @fileoverview Filas plegables de proveedor en la pestaña "IA" del panel de configuración.
 * _renderAIRow pinta la fila común (cabecera con estado, cuerpo, borrar, error) y
 * _renderAIProviderRow el cuerpo de los proveedores en la nube (Groq, Gemini): API key y modelo.
 * La clave guardada nunca se muestra en el campo: se indica enmascarada en el placeholder
 * y, si se deja vacío, el servidor conserva la guardada.
 * Depende de: config-ui.js (AI_PROVIDER_META) cargado previamente.
 */

/**
 * Fila común de proveedor.
 * @param {string} provider - id del proveedor
 * @param {{ configured?: boolean }} info - estado guardado
 * @param {boolean} isActive - es el proveedor principal guardado
 * @param {{ subtitle: string, body: string, deleteLabel: string }} parts
 */
function _renderAIRow(provider, info, isActive, parts) {
    const meta = AI_PROVIDER_META[provider];
    const configured = info.configured === true;
    const status = configured
        ? `<span class="aic-badge aic-badge--ok"><i class="fas fa-check-circle"></i> ${_t('admin.groq.configured')}</span>`
        : `<span class="aic-badge aic-badge--muted">${_t('admin.groq.not_configured')}</span>`;

    return `
        <details class="aic-row" id="ai-row-${provider}" data-provider="${provider}" ${isActive ? 'data-primary open' : ''}>
            <summary class="aic-row__summary">
                <span class="aic-row__icon"><i class="fas ${meta.icon}"></i></span>
                <span class="aic-row__titles">
                    <span class="aic-row__title">${_t(meta.titleKey)}</span>
                    <span class="aic-row__subtitle">${parts.subtitle}</span>
                </span>
                <span class="aic-row__badges">
                    <span class="aic-badge aic-badge--primary"><i class="fas fa-star"></i> ${_t('admin.ai.badge_active')}</span>
                    ${status}
                </span>
                <i class="fas fa-chevron-down aic-row__chevron" aria-hidden="true"></i>
            </summary>
            <div class="aic-row__body">
                ${parts.body}
                <p class="aic-row__error" id="ai-error-${provider}" role="alert" hidden></p>
                ${configured ? `
                <div class="aic-row__footer">
                    <button type="button" data-admin-action="ai-delete-key" data-provider="${provider}" class="aic-btn aic-btn--danger-text">
                        <i class="fas fa-trash-alt"></i> ${parts.deleteLabel}
                    </button>
                </div>` : ''}
            </div>
        </details>`;
}

/** Fila de Groq o Gemini. */
function _renderAIProviderRow(provider, info, isActive) {
    const meta = AI_PROVIDER_META[provider];
    const model = info.model || meta.models[0].id;

    // Si el modelo guardado no está en la lista (p. ej. GROQ_MODEL), se ofrece igualmente
    const models = meta.models.some(m => m.id === model)
        ? meta.models
        : [{ id: model, label: model }, ...meta.models];
    const modelOptions = models.map(m =>
        `<option value="${escapeHtml(m.id)}" ${model === m.id ? 'selected' : ''}>${escapeHtml(m.label)}</option>`
    ).join('');

    const keyPlaceholder = info.maskedKey
        ? _t('admin.ai.key_saved', { key: info.maskedKey })
        : meta.placeholder;

    const body = `
        <div class="aic-fields">
            <div class="aic-field">
                <label for="ai-key-input-${provider}" class="aic-label">${_t('admin.ai.label_key')}</label>
                <input id="ai-key-input-${provider}" type="password" autocomplete="new-password" spellcheck="false"
                    placeholder="${escapeHtml(keyPlaceholder)}" class="aic-input aic-input--mono">
                <p class="aic-hint">${info.maskedKey ? _t('admin.ai.key_keep_desc') : _t('admin.ai.key_new_desc')}</p>
            </div>
            <div class="aic-field">
                <label for="ai-model-select-${provider}" class="aic-label">${_t('admin.groq.label_model')}</label>
                <select id="ai-model-select-${provider}" class="aic-input aic-select">${modelOptions}</select>
                <p class="aic-hint">${_t('admin.groq.model_desc')}</p>
            </div>
        </div>`;

    return _renderAIRow(provider, info, isActive, {
        subtitle: _t('admin.ai.cloud_subtitle'),
        body,
        deleteLabel: _t('admin.groq.btn_delete')
    });
}
