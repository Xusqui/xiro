// Contenido del panel «Ajustes» de la cabecera de los editores (editor-header.js) y
// resumen de la barra: chips de visibilidad, idioma y reglas de puntuación, y la
// portada en miniatura. Los campos conservan los ids y las funciones de cada editor.

/** Sección General: visible para el presentador, idioma, extras del editor y portada. */
function _ehGeneralHtml(cfg, entity) {
    const visible = cfg.visible;
    return `
                        <div class="xeh-row"${visible.help ? ` title="${visible.help}"` : ''}>
                            <span class="xeh-row__label"><i class="fas fa-eye" aria-hidden="true"></i>${visible.label}</span>
                            ${renderCheckbox({ id: visible.id, checked: entity.visible_to_presenter !== false, action: null })}
                        </div>
                        <div class="xeh-field">
                            <span class="xeh-field__label">${_t('common.label_language', null, 'Idioma de las preguntas')}</span>
                            ${renderLanguageSelect({ id: cfg.languageId, value: entity.language })}
                        </div>
                        ${cfg.extraGeneralHtml || ''}
                        ${renderGameCoverField(cfg.coverKind, entity.image_url)}`;
}

/** Interruptor de racha (o doble racha) con su umbral y su bonus. */
function _ehStreakHtml(s, entity, isDouble) {
    const k = s.keys;
    const on = isDouble ? entity.use_double_streaks : entity.use_streaks;
    const threshold = isDouble ? (entity.double_streak_threshold ?? 5) : (entity.streak_threshold ?? 3);
    const bonus = isDouble ? (entity.double_streak_bonus_percentage ?? 1.0) : (entity.streak_bonus_percentage ?? 0.5);
    const label = isDouble
        ? _t(`${k}.label_dbl_streaks`, null, 'Usar Dobles Rachas')
        : _t(`${k}.label_streaks`, null, 'Usar Rachas');
    const help = isDouble
        ? _t(
              `${k}.help_dbl_streaks`,
              null,
              'Bonus adicional para jugadores que superan un umbral mayor de aciertos consecutivos'
          )
        : _t(`${k}.help_streaks`, null, 'Aplica bonus de puntos a jugadores con respuestas correctas consecutivas');
    const thresholdLabel = isDouble
        ? _t(`${k}.dbl_threshold_label`, null, 'Preguntas para Doble Racha')
        : _t(`${k}.streak_threshold_label`, null, 'Preguntas para activar Racha');
    const bonusLabel = isDouble
        ? _t(`${k}.dbl_bonus_label`, null, 'Multiplicador bonus doble racha')
        : _t(`${k}.streak_bonus_label`, null, 'Multiplicador de bonus racha');
    const icon = isDouble ? 'fa-fire-alt text-red-500' : 'fa-fire text-orange-500';
    return `
                        <div class="xeh-row" title="${help}">
                            <span class="xeh-row__label"><i class="fas ${icon}" aria-hidden="true"></i>${label}</span>
                            ${renderCheckbox({ id: s.toggle, checked: on, action: null, attrs: `data-admin-change="${s.onToggle}"` })}
                        </div>
                        <div id="${s.panel}" class="${on ? '' : 'hidden'} xeh-sub">
                            <div>
                                <label class="xeh-field__label" for="${s.threshold}">${thresholdLabel}</label>
                                <input type="number" id="${s.threshold}" min="1" max="20" value="${threshold}" class="xeh-input">
                            </div>
                            <div>
                                <label class="xeh-field__label" for="${s.bonus}">${bonusLabel}</label>
                                <input type="number" id="${s.bonus}" min="0" max="2" step="0.05" value="${bonus}" class="xeh-input">
                            </div>
                        </div>`;
}

function _ehChip(icon, text, variant) {
    return `<span class="xeh-chip${variant ? ` xeh-chip--${variant}` : ''}"><i class="fas ${icon}" aria-hidden="true"></i>${text}</span>`;
}

/** Chip de una regla: en barras estrechas solo queda icono y número; el texto, en el título. */
function _ehRuleChip(icon, label, count, variant) {
    const suffix = count ? ` ×${count}` : '';
    return `<span class="xeh-chip xeh-chip--${variant}" title="${label}${suffix}"><i class="fas ${icon}" aria-hidden="true"></i><span class="xeh-chip__label">${label}</span>${suffix}</span>`;
}

/** Chips del resumen: siempre el idioma; «Oculto» y las reglas, solo si aplican. */
function _ehChipsHtml(state) {
    const fallbackLang = window.XiroI18n?.getLanguage?.() || 'es';
    const lang = /^[a-z]{2}$/.test(state.language || '')
        ? state.language
        : /^[a-z]{2}$/.test(fallbackLang)
          ? fallbackLang
          : 'es';
    // Visible es lo normal: solo se avisa cuando el presentador no lo verá
    const chips = state.visible
        ? []
        : [_ehChip('fa-eye-slash', _t('admin.editor.chip_hidden', null, 'Oculto'), 'muted')];
    chips.push(
        `<span class="xeh-chip"><img src="/images/flags/${lang}.svg" alt="" class="xeh-chip__flag">${lang.toUpperCase()}</span>`
    );
    if (state.streaks) {
        const n = parseInt(state.streakThreshold, 10) || 3;
        chips.push(_ehRuleChip('fa-fire', _t('admin.editor.chip_streaks', null, 'Racha'), n, 'streak'));
    }
    if (state.double) {
        const n = parseInt(state.doubleThreshold, 10) || 5;
        chips.push(_ehRuleChip('fa-fire-alt', _t('admin.editor.chip_double', null, 'Doble'), n, 'double'));
    }
    if (state.random) {
        chips.push(_ehRuleChip('fa-dice', _t('admin.editor.chip_random', null, 'Aleatoria'), 0, 'random'));
    }
    // Con espacios: la flexbox los ignora y el lector de pantalla separa los chips
    return chips.join(' ');
}

/** Portada en miniatura, o el icono del editor si no hay. */
function _ehTileHtml(imageUrl, icon) {
    const url = String(imageUrl || '');
    if (/^(\/uploads\/|https?:\/\/)/.test(url)) {
        return `<img src="${escapeHtml(url)}" alt="">`;
    }
    return `<i class="fas ${icon}" aria-hidden="true"></i>`;
}
