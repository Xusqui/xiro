/**
 * @fileoverview Renderizado de tarjetas de campo del panel de configuración
 * Requiere: config-panel-meta.js cargado previamente
 */

function _badgeLabel(badge) {
    const key = 'admin.config.badge.' + badge.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
    return _t(key, null, badge);
}

/* ===== TARJETA DE CAMPO ESTÁNDAR ===== */

function _renderConfigField(key, entry) {
    const meta = CONFIG_META[key] || { label: key, description: '', badge: '', unit: '', icon: 'fa-cog', iconColor: 'bg-slate-400' };
    const badgeClass = CONFIG_BADGE_COLORS[meta.badge] || 'bg-slate-100 text-slate-600';
    const mul = meta.msMultiplier || 1;
    let { value, type, min, max, values } = entry;

    const displayValue = mul > 1 ? value / mul : value;
    const displayMin = (mul > 1 && min !== undefined) ? min / mul : min;
    const displayMax = (mul > 1 && max !== undefined) ? max / mul : max;
    const step = (type === 'float' || mul > 1) ? '0.01' : '1';

    let input;
    if (type === 'enum' && values) {
        const opts = values.map(v => {
            const optLabel = (meta.labelMap && meta.labelMap[v]) ? _t(meta.labelMap[v], null, v) : v;
            return `<option value="${v}" ${v === String(value) ? 'selected' : ''}>${optLabel}</option>`;
        }).join('');
        input = `<select id="cfg-${key}" data-key="${key}" data-mul="1"
            class="px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-indigo-400 focus:outline-none bg-white font-mono text-sm w-36">
            ${opts}</select>`;
    } else if (entry.sensitive) {
        const placeholder = value ? _t('admin.config.server.sensitive_unchanged', null, '(sin cambios)') : _t('admin.config.server.sensitive_enter', null, 'Introduce el valor...');
        // type="text" + máscara CSS (no type="password"): evita que el gestor de contraseñas
        // del navegador trate este campo de configuración como una credencial de login y lo
        // autorrellene/vacíe de forma inesperada.
        input = `<div class="flex items-center gap-2 w-full">
            <div class="relative flex-1">
                <input type="text" id="cfg-${key}" data-key="${key}" data-mul="1" data-sensitive="true"
                    value="" placeholder="${placeholder}"
                    autocomplete="off" spellcheck="false" autocapitalize="off"
                    class="xiro-input-mask w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-indigo-400 focus:outline-none font-mono text-sm pr-10">
                <button type="button" data-config-action="toggle-sensitive" data-key="${key}" tabindex="-1"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <i id="eye-${key}" class="fas fa-eye text-xs"></i>
                </button>
            </div>
        </div>`;
    } else {
        const inputType = (type === 'int' || type === 'float') ? 'number' : 'text';
        const minAttr = displayMin !== undefined ? ` min="${displayMin}"` : '';
        const maxAttr = displayMax !== undefined ? ` max="${displayMax}"` : '';
        const widthCls = (type === 'string' || type === 'origin_list') ? 'w-full' : 'w-36';
        const disabledAttr = meta.disabled ? ' disabled' : '';
        const disabledCls = meta.disabled ? ' bg-slate-100 text-slate-400 cursor-not-allowed' : '';
        input = `<input type="${inputType}" id="cfg-${key}" data-key="${key}" data-mul="${mul}"
            value="${escapeHtml(String(displayValue))}" step="${step}"${minAttr}${maxAttr}${disabledAttr}
            class="px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-indigo-400 focus:outline-none font-mono text-sm ${widthCls}${disabledCls}">`;
    }
    const unit = meta.unit ? `<span class="text-slate-400 text-sm">${_t(meta.unit, null, meta.unit)}</span>` : '';

    return `
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow${meta.disabled ? ' opacity-60' : ''}">
            <div class="flex items-start gap-4">
                <div class="w-10 h-10 ${meta.iconColor} rounded-xl flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                    <i class="fas ${meta.icon} text-sm"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                        <label for="cfg-${key}" class="font-bold text-slate-800">${_t(meta.label, null, meta.label)}</label>
                        ${meta.badge ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}">${_badgeLabel(meta.badge)}</span>` : ''}
                    </div>
                    <p class="text-xs text-slate-500 mb-3 leading-relaxed">${_t(meta.description, null, meta.description)}</p>
                    <div class="flex items-center gap-2">${input}${unit}</div>
                </div>
            </div>
        </div>`;
}

/* ===== TARJETA LAMBDA (ESPECIAL) ===== */

function _renderLambdaCard(entry) {
    const { value, type, min, max } = entry;
    const step = type === 'float' ? '0.1' : '1';
    const minAttr = min !== undefined ? ` min="${min}"` : '';
    const maxAttr = max !== undefined ? ` max="${max}"` : '';
    return `
        <div class="mb-8">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-1 h-6 bg-purple-500 rounded-full"></div>
                <h2 class="text-xs font-black uppercase tracking-widest text-slate-500">${_t('admin.config.lambda.section_title')}</h2>
            </div>
            <div class="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-2xl p-6 shadow-sm">
                <div class="flex items-start gap-4 mb-5">
                    <div class="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-md">
                        <span class="text-xl font-black italic">λ</span>
                    </div>
                    <div>
                        <div class="flex items-center gap-2 mb-1 flex-wrap">
                            <p class="font-black text-purple-900">${_t('admin.config.lambda.card_title')}</p>
                            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">${_t('admin.config.badge.inmediato')}</span>
                        </div>
                        <p class="text-sm text-purple-700">${_t('admin.config.lambda.desc')}</p>
                    </div>
                </div>
                <div class="bg-white/80 rounded-xl p-4 mb-5 border border-purple-100 space-y-3">
                    <p class="text-xs font-bold text-slate-500 uppercase tracking-wide">${_t('admin.config.lambda.formula_section')}</p>
                    <p class="font-mono text-purple-800 bg-purple-50 px-3 py-2 rounded-lg text-xs">${_t('admin.config.lambda.formula')}</p>
                    <div class="grid grid-cols-3 gap-2 pt-1">
                        <div class="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                            <p class="font-black text-slate-800 text-lg">0</p>
                            <p class="text-xs text-slate-500 leading-tight">${_t('admin.config.lambda.val0_label')}</p>
                        </div>
                        <div class="bg-emerald-50 rounded-lg p-3 border border-emerald-100 text-center ring-2 ring-emerald-300">
                            <p class="font-black text-emerald-700 text-lg">0.5</p>
                            <p class="text-xs text-emerald-600 leading-tight">${_t('admin.config.lambda.val05_label')}</p>
                        </div>
                        <div class="bg-amber-50 rounded-lg p-3 border border-amber-100 text-center">
                            <p class="font-black text-amber-700 text-lg">1–2</p>
                            <p class="text-xs text-amber-600 leading-tight">${_t('admin.config.lambda.val12_label')}</p>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <label class="text-sm font-bold text-purple-900">${_t('admin.config.lambda.value_label')}</label>
                    <input type="number" id="cfg-TEAM_SCORE_LAMBDA" data-key="TEAM_SCORE_LAMBDA"
                        value="${escapeHtml(String(value))}" step="${step}"${minAttr}${maxAttr}
                        class="w-28 px-3 py-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none font-mono text-sm bg-white">
                    <span class="text-sm text-purple-500">${_t('admin.config.lambda.no_smoothing')}</span>
                </div>
            </div>
        </div>`;
}

/* ===== CAMPOS DE FIREWORKS (UI SETTINGS) ===== */

function _renderFireworksSlider(key, value, meta) {
    const { min, max, step, defaultValue } = meta;
    const hasDefault = defaultValue !== undefined;
    const label = _t(meta.label, null, meta.label);
    const labelWithDefault = hasDefault
        ? `${label} <span class="text-slate-400 font-normal">(${_t('admin.config.fireworks.default_prefix')}: ${defaultValue}${meta.unit})</span>`
        : label;
    return `
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-start gap-4">
                <div class="w-10 h-10 ${meta.iconColor} rounded-xl flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                    <i class="fas ${meta.icon} text-sm"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2 mb-1">
                        <p class="font-bold text-slate-800">${labelWithDefault}</p>
                        <span id="fw-value-${key}" class="text-lg font-mono font-black text-purple-600">${value}${meta.unit}</span>
                    </div>
                    <p class="text-xs text-slate-500 mb-4 leading-relaxed">${_t(meta.description, null, meta.description)}</p>
                    <input type="range" id="fw-${key}" data-fw-key="${key}"
                        value="${value}" min="${min}" max="${max}" step="${step}"
                        data-config-action="update-fireworks-slider" data-key="${key}"
                        class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600">
                    <div class="flex justify-between text-xs text-slate-400 mt-1">
                        <span>${min}${meta.unit}</span>
                        <span>${max}${meta.unit}</span>
                    </div>
                </div>
            </div>
        </div>`;
}

function _renderFireworksToggle(key, value, meta) {
    const isChecked = value === true;
    const bg = isChecked ? '#a855f7' : '#cbd5e1';
    const knobLeft = isChecked ? '22px' : '2px';
    return `
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-4 flex-1">
                    <div class="w-10 h-10 ${meta.iconColor} rounded-xl flex items-center justify-center text-white flex-shrink-0">
                        <i class="fas ${meta.icon} text-sm"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-slate-800 text-sm mb-1">${_t(meta.label, null, meta.label)}</p>
                        <p class="text-xs text-slate-500 leading-relaxed">${_t(meta.description, null, meta.description)}</p>
                    </div>
                </div>
                <div data-config-action="toggle-fireworks-setting" data-key="${key}" data-fw-checked="${isChecked}"
                     style="width:44px;height:24px;border-radius:12px;background:${bg};position:relative;cursor:pointer;transition:background .2s;flex-shrink:0">
                    <span style="display:block;position:absolute;top:2px;left:${knobLeft};width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.18)"></span>
                </div>
            </div>
        </div>`;
}
