/**
 * @fileoverview Builders del modal de novedades previo a actualizar.
 * No realiza fetch ni accede al DOM directamente. El contenido del historial viene de GitHub,
 * así que todo pasa por escapeHtml antes de interpretar su Markdown.
 */

const _UCL_GITHUB_URL = 'https://github.com/Xusqui/xiro/blob/main/CHANGELOG.md';
const _UCL_SKELETON_ROWS = 3;

/**
 * Convierte el Markdown en línea del historial (negrita y código) en HTML seguro.
 * @param {string} text - Texto de un punto del historial
 * @returns {string} HTML con el texto escapado
 */
function _uclInlineHtml(text) {
    return escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * @param {{text: string, children: string[]}} item - Punto del historial
 * @returns {string} HTML del punto y sus subpuntos
 */
function _uclItemHtml(item) {
    const children = item.children.map(child => `<li>${_uclInlineHtml(child)}</li>`).join('');
    return `<li>${_uclInlineHtml(item.text)}${children ? `<ul>${children}</ul>` : ''}</li>`;
}

/**
 * @param {{version: string, date: string, items: Array}} entry - Versión del historial
 * @returns {string} HTML de la versión
 */
function _uclEntryHtml(entry) {
    return `
        <li class="xuc-entry" lang="es">
            <div class="xuc-entry-head">
                <h3 class="xuc-version">${escapeHtml(entry.version)}</h3>
                <span class="xuc-date">${escapeHtml(entry.date)}</span>
            </div>
            <ul class="xuc-items">${entry.items.map(_uclItemHtml).join('')}</ul>
        </li>`;
}

/**
 * @param {string} current - Versión instalada
 * @returns {string} HTML de la marca «Estás aquí»
 */
function _uclHereHtml(current) {
    return `
        <li class="xuc-here">
            <span class="xuc-here-pill">${_t('admin.updates.changelog.you_are_here')}<span class="xuc-here-version">${escapeHtml(current)}</span></span>
        </li>`;
}

/**
 * @param {boolean} expanded - Si el historial anterior está desplegado
 * @returns {string} HTML interior del botón que despliega el historial anterior
 */
function _uclOlderToggleLabel(expanded) {
    const key = expanded ? 'admin.updates.changelog.hide_older' : 'admin.updates.changelog.show_older';
    return `${_t(key)}<i class="fas fa-chevron-down xuc-older-chevron" aria-hidden="true"></i>`;
}

/**
 * @param {Array} entries - Versiones anteriores o iguales a la instalada
 * @returns {string} HTML de la lista del historial anterior
 */
function _uclOlderListHtml(entries) {
    return `<ol class="xuc-rail xuc-rail--older">${entries.map(_uclEntryHtml).join('')}</ol>`;
}

/** @returns {string} HTML del botón y del contenedor, aún vacío, del historial anterior */
function _uclOlderSectionHtml() {
    return `
        <button type="button" class="xuc-older-toggle" data-update-action="changelog-older" aria-expanded="false" aria-controls="xuc-older">
            ${_uclOlderToggleLabel(false)}
        </button>
        <div id="xuc-older" hidden></div>`;
}

/** @returns {string} HTML del estado de carga */
function _uclLoadingHtml() {
    const rows = '<li class="xuc-entry xuc-entry--skeleton"><span></span><span></span><span></span></li>'.repeat(_UCL_SKELETON_ROWS);
    return `
        <p class="xuc-sr-only" role="status">${_t('admin.updates.changelog.loading')}</p>
        <ol class="xuc-rail" aria-hidden="true">${rows}</ol>`;
}

/** @returns {string} HTML del estado sin historial disponible */
function _uclUnavailableHtml() {
    return `
        <div class="xuc-unavailable">
            <img src="/images/chamaleon/dizzy.svg" alt="" width="112" height="112">
            <h3>${_t('admin.updates.changelog.unavailable_title')}</h3>
            <p>${_t('admin.updates.changelog.unavailable_body')}</p>
            <a href="${_UCL_GITHUB_URL}" target="_blank" rel="noopener noreferrer">
                ${_t('admin.updates.changelog.view_on_github')}<i class="fas fa-external-link-alt" aria-hidden="true"></i>
            </a>
        </div>`;
}

/**
 * Genera el contenido del modal una vez resuelta la carga.
 * @param {Object} changelog - Respuesta de GET /api/admin/update/changelog
 * @returns {string} HTML del cuerpo del modal
 */
function _uclContentHtml(changelog) {
    if (!changelog.available) return _uclUnavailableHtml();

    const missingNote = changelog.targetDocumented
        ? ''
        : `<p class="xuc-note"><i class="fas fa-info-circle" aria-hidden="true"></i>${_t('admin.updates.changelog.target_missing', { version: escapeHtml(changelog.latest) })}</p>`;

    return `
        ${missingNote}
        <ol class="xuc-rail">${changelog.newer.map(_uclEntryHtml).join('')}${_uclHereHtml(changelog.current)}</ol>
        ${changelog.older.length > 0 ? _uclOlderSectionHtml() : ''}`;
}

/**
 * Genera el modal completo en estado de carga.
 * @param {{current: string, latest: string}} versions - Versión instalada y versión de destino
 * @returns {string} HTML del modal
 */
function _uclDialogHtml({ current, latest }) {
    return `
        <div class="xuc-overlay xiro-admin-overlay" data-i18n-skip="true">
            <section class="xuc-dialog" role="dialog" aria-modal="true" aria-labelledby="xuc-title">
                <header class="xuc-head">
                    <div>
                        <h2 id="xuc-title" class="xuc-title">${_t('admin.updates.changelog.title')}</h2>
                        <p class="xuc-route">
                            <span id="xuc-route-from">${escapeHtml(current)}</span>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                            <strong id="xuc-route-to">${escapeHtml(latest)}</strong>
                        </p>
                    </div>
                    <button type="button" class="xuc-close" data-update-action="changelog-close" aria-label="${escapeHtml(_t('admin.updates.changelog.close'))}">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </header>
                <div id="xuc-body" class="xuc-body" tabindex="0" aria-labelledby="xuc-title">${_uclLoadingHtml()}</div>
                <footer class="xuc-foot">
                    <p id="xuc-sessions" class="xuc-sessions" hidden></p>
                    <div class="xuc-foot-row">
                        <p class="xuc-foot-note">${_t('admin.updates.what_happens')}</p>
                        <div class="xuc-actions">
                            <button type="button" class="xuc-btn" data-update-action="changelog-close">${_t('admin.updates.changelog.later')}</button>
                            <button type="button" id="xuc-confirm" class="xuc-btn xuc-btn--primary" data-update-action="changelog-confirm" disabled></button>
                        </div>
                    </div>
                </footer>
            </section>
        </div>`;
}
