// Cabecera fija y compacta de los editores de banco, mezcla, personalizado y trivial:
// una barra (volver, portada, nombre, PIN y resumen de ajustes) que abre el panel
// «Ajustes» (visibilidad, idioma, portada y puntuación). Cada editor pone sus ids, así
// su guardado y su snapshot de cambios sin guardar leen los mismos campos que antes.
// Contenido del panel y resumen en editor-header-settings.js, comportamiento en
// editor-header-ui.js y estilos en css/admin-editor-header.css.

/**
 * HTML de la cabecera de un editor.
 *
 * @param {Object} cfg
 * @param {Object|null} cfg.entity - Banco o juego (id, name, pin, visible_to_presenter, language, image_url, use_streaks…)
 * @param {'plum'|'green'|'blue'|'orange'} cfg.accent - Color del editor
 * @param {string} cfg.icon - Icono Font Awesome del editor (sin «fas»)
 * @param {string} cfg.kind - Nombre del editor ya traducido («Banco de Preguntas»)
 * @param {string} cfg.hiddenHtml - Inputs ocultos propios del editor (id, propietario)
 * @param {{action: string, label: string}} cfg.back - Expresión data-admin-click y texto del botón volver
 * @param {{id: string, label: string, placeholder?: string}} cfg.name
 * @param {{id: string, label: string, placeholder?: string, help?: string, maxlength?: number}} cfg.pin
 * @param {{id: string, label: string, help?: string}} cfg.visible
 * @param {string} cfg.languageId
 * @param {string} cfg.coverKind - Clave de GAME_COVER_KIND_STYLES
 * @param {string} cfg.randomPrefix - Prefijo de renderRandomPointsHtml
 * @param {Object} cfg.streaks - { keys, toggle, panel, threshold, bonus, onToggle }
 * @param {Object} cfg.doubleStreaks - { keys, toggle, panel, threshold, bonus, onToggle }
 * @param {string} [cfg.extraGeneralHtml] - Campos extra de la sección General
 * @returns {string}
 */
function renderEditorHeader(cfg) {
    const entity = cfg.entity || {};
    const open = !entity.id;
    const panelId = `xeh-panel-${cfg.coverKind}`;
    const ids = _ehSummaryIds(cfg);
    const settingsLabel = _t('admin.editor.settings', null, 'Ajustes');
    const pin = cfg.pin;

    return `
        <div class="xiro-editor-sticky-header xeh-host xeh--${cfg.accent}">
            <div class="xeh" data-xeh data-xeh-icon="${cfg.icon}" data-xeh-ids="${escapeHtml(JSON.stringify(ids))}">
                ${cfg.hiddenHtml}
                <button type="button" class="xeh__back" data-admin-click="${cfg.back.action}" title="${cfg.back.label}" aria-label="${cfg.back.label}">
                    <i class="fas fa-arrow-left" aria-hidden="true"></i>
                </button>
                <span class="xeh__tile" title="${cfg.kind}" data-xeh-tile>${_ehTileHtml(entity.image_url, cfg.icon)}</span>
                <label class="sr-only" for="${cfg.name.id}">${cfg.name.label}</label>
                <input type="text" id="${cfg.name.id}" class="xeh__name" value="${escapeHtml(entity.name ?? '')}"
                    placeholder="${cfg.name.placeholder || cfg.name.label}" autocomplete="off">
                <label class="xeh__pin"${pin.help ? ` title="${pin.help}"` : ''}>
                    <span class="xeh__pin-label" aria-hidden="true">PIN</span>
                    <input type="text" id="${pin.id}" value="${escapeHtml(entity.pin ?? '')}" aria-label="${pin.label}"
                        placeholder="${pin.placeholder || ''}"${pin.maxlength ? ` maxlength="${pin.maxlength}"` : ''} autocomplete="off" spellcheck="false">
                </label>
                <button type="button" class="xeh__settings" aria-expanded="${open}" aria-controls="${panelId}"
                    data-xeh-toggle data-admin-click="toggleEditorSettings(this)">
                    <span class="xeh__chips" data-xeh-chips>${_ehChipsHtml(_ehStateFromEntity(entity))}</span>
                    <span class="xeh__settings-label"><i class="fas fa-sliders" aria-hidden="true"></i>${settingsLabel}</span>
                    <i class="fas fa-chevron-down xeh__chevron" aria-hidden="true"></i>
                </button>
            </div>
            <div class="xeh-panel" id="${panelId}" role="region" aria-label="${settingsLabel}" data-xeh-panel${open ? '' : ' hidden'}>
                <div class="xeh-panel__grid">
                    <section class="xeh-panel__section">
                        <h3 class="xeh-panel__title">${_t('admin.editor.section_general', null, 'General')}</h3>
                        ${_ehGeneralHtml(cfg, entity)}
                    </section>
                    <section class="xeh-panel__section">
                        <h3 class="xeh-panel__title">${_t('admin.editor.section_scoring', null, 'Puntuación')}</h3>
                        ${_ehStreakHtml(cfg.streaks, entity, false)}
                        ${_ehStreakHtml(cfg.doubleStreaks, entity, true)}
                        ${renderRandomPointsHtml(cfg.randomPrefix, entity)}
                    </section>
                </div>
                <div class="xeh-panel__foot">
                    <span class="xeh-panel__id">${entity.id ? `ID ${escapeHtml(entity.id)}` : ''}</span>
                    <button type="button" class="xeh-panel__done" data-admin-click="closeEditorSettings(this)">${_t('admin.editor.done', null, 'Listo')}</button>
                </div>
            </div>
        </div>`;
}

/** Ids que lee el resumen de la barra para mantenerse al día. */
function _ehSummaryIds(cfg) {
    return {
        visible: cfg.visible.id,
        language: cfg.languageId,
        cover: GAME_COVER_KIND_STYLES[cfg.coverKind]?.hiddenId || '',
        streaks: cfg.streaks.toggle,
        streakThreshold: cfg.streaks.threshold,
        double: cfg.doubleStreaks.toggle,
        doubleThreshold: cfg.doubleStreaks.threshold,
        random: `${cfg.randomPrefix}UseRandomPoints`
    };
}

/** Estado del resumen a partir del banco o juego recién cargado. */
function _ehStateFromEntity(entity) {
    return {
        visible: entity.visible_to_presenter !== false,
        language: entity.language,
        streaks: !!entity.use_streaks,
        streakThreshold: entity.streak_threshold ?? 3,
        double: !!entity.use_double_streaks,
        doubleThreshold: entity.double_streak_threshold ?? 5,
        random: !!entity.use_random_points
    };
}
