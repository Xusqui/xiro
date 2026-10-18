/**
 * @fileoverview Builders para la interfaz de actualizaciones del panel admin.
 * No realiza fetch ni accede al DOM directamente.
 */

/** Formatea una fecha ISO en español o devuelve cadena vacía. */
function _updFormatDate(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

/** Genera la tarjeta de versión con estado actual y disponible. */
function _updVersionCard(data) {
    const current = escapeHtml(data.current || '');
    const latest = data.latest ? escapeHtml(data.latest) : '—';
    const checkedAt = _updFormatDate(data.checkedAt);
    const dateStr = checkedAt ? _t('admin.updates.checked_at', { date: checkedAt }) : '';

    return `
        <div class="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-2xl p-6 shadow-sm">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                    <i class="fas fa-cloud-download-alt text-lg"></i>
                </div>
                <div>
                    <h3 class="font-black text-blue-900">${_t('admin.updates.title')}</h3>
                    <p class="text-sm text-blue-700">${_t('admin.updates.subtitle')}</p>
                </div>
            </div>

            <div class="bg-white rounded-xl border border-slate-200 p-4 mb-4">
                <div class="grid grid-cols-2 gap-2">
                    <div><span class="font-bold text-slate-700">${_t('admin.updates.current')}</span></div>
                    <div class="font-mono text-slate-900">${current}</div>
                    <div><span class="font-bold text-slate-700">${_t('admin.updates.latest')}</span></div>
                    <div class="font-mono text-slate-900">${latest}</div>
                </div>
                ${dateStr ? `<p class="text-sm text-slate-500 mt-2">${dateStr}</p>` : ''}
                <button data-update-action="check" class="mt-3 flex items-center gap-1.5 text-blue-700 hover:text-blue-800 font-medium">
                    <i class="fas fa-sync-alt"></i> ${_t('admin.updates.check_now')}
                </button>
            </div>
        </div>`;
}

/** Genera un elemento de paso para el progreso. */
function _updStepItem(label, iconClass) {
    return `
        <li class="flex items-start gap-2 mb-2">
            <i class="${iconClass} mt-0.5"></i>
            <span>${label}</span>
        </li>`;
}

/** Genera la tarjeta de estado según el resultado del check. */
function _updActionCard(data) {
    if (data.error) {
        return `
            <div class="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-4">
                <p class="font-bold text-amber-800">${_t('admin.updates.check_error', { error: escapeHtml(data.error) })}</p>
            </div>`;
    }

    if (data.updateAvailable) {
        if (data.mode === 'button') {
            const sessionsWarning = data.activeSessions > 0
                ? `<div class="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-4"><p class="font-bold text-amber-800">${_t('admin.updates.active_sessions', { count: data.activeSessions })}</p></div>`
                : '';

            return `
                <div class="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-4">
                    <p class="font-bold text-emerald-800">${_t('admin.updates.available', { version: escapeHtml(data.latest) })}</p>
                </div>
                ${sessionsWarning}
                <p class="text-sm text-slate-600 mb-3">${_t('admin.updates.what_happens')}</p>
                <button data-update-action="start" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all">
                    ${_t('admin.updates.btn_update')}
                </button>
                <div id="update-confirm" class="hidden bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mt-4">
                    <p class="font-bold text-amber-800"></p>
                    <div class="flex gap-2 mt-2">
                        <button data-update-action="start-force" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">${_t('admin.updates.btn_update_anyway')}</button>
                        <button data-update-action="cancel" class="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-sm font-medium">${_t('admin.updates.btn_cancel')}</button>
                    </div>
                </div>
                <p id="update-start-error" class="hidden text-sm text-red-600 mt-2"></p>`;
        } else {
            const commands = data.updaterReason === 'source_install'
                ? 'git pull\n./manage.sh update'
                : 'cd /opt/xiro\ndocker compose pull\ndocker compose up -d';
            return `
                <div class="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-4">
                    <p class="font-bold text-emerald-800">${_t('admin.updates.available', { version: escapeHtml(data.latest) })}</p>
                </div>

                <div class="bg-white border-2 border-slate-200 rounded-xl p-4 mb-4">
                    <h3 class="font-bold text-slate-800">${_t('admin.updates.manual_title')}</h3>
                    <p class="mt-2 text-slate-700">${_t('admin.updates.reason.' + data.updaterReason, { detail: escapeHtml(data.updaterDetail || '') })}</p>
                    <p class="mt-2 text-slate-700">${_t('admin.updates.manual_help')}</p>
                    <pre class="font-mono text-sm bg-slate-100 p-3 rounded mt-2 overflow-x-auto">${commands}</pre>
                </div>`;
        }
    } else {
        return `
            <div class="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 mb-4">
                <p class="font-bold text-slate-800">${_t('admin.updates.up_to_date')}</p>
            </div>`;
    }
}

/** Icono de un paso: hecho, en curso, fallido o pendiente. */
function _updStepIcon(index, stepIndex, state, inRollback) {
    if (state === 'done' || index < stepIndex) return 'text-emerald-600 fas fa-check-circle';
    if (index !== stepIndex) return 'text-slate-400 fas fa-circle';
    if (state === 'running' && !inRollback) return 'text-cyan-600 fas fa-spin fa-circle-notch';
    return 'text-red-600 fas fa-times-circle';
}

/** Genera la tarjeta de progreso de actualización. */
function _updProgressCard(progress, targetVersion) {
    const steps = ['backup', 'snapshot', 'pull', 'recreate', 'verify'];
    const inRollback = progress.step === 'rollback' || progress.state === 'rolled_back';
    // En la vuelta atrás, backup, snapshot y pull ya se hicieron (falló recreate o verify)
    const stepIndex = inRollback ? steps.indexOf('recreate') : steps.indexOf(progress.step);
    const running = progress.state === 'running';

    let stepHtml = '';
    for (let i = 0; i < steps.length; i++) {
        stepHtml += _updStepItem(_t('admin.updates.step.' + steps[i]), _updStepIcon(i, stepIndex, progress.state, inRollback));
    }
    if (inRollback) {
        const icon = running ? 'text-cyan-600 fas fa-spin fa-circle-notch' : 'text-amber-600 fas fa-check-circle';
        stepHtml += _updStepItem(_t('admin.updates.step.rollback'), icon);
    }

    let statusText = '';
    if (progress.state === 'done') {
        statusText = _t('admin.updates.done', { version: escapeHtml(targetVersion) });
    } else if (progress.state === 'failed') {
        statusText = _t('admin.updates.failed', { error: escapeHtml(progress.error || '') });
    } else if (progress.state === 'rolled_back') {
        statusText = _t('admin.updates.rolled_back', { error: escapeHtml(progress.error || '') });
    }

    const logContent = escapeHtml(progress.log ? progress.log.join('\n') : '');

    return `
        <div class="bg-white border-2 border-slate-200 rounded-xl p-4 mb-4">
            <h3 class="font-bold text-slate-800">${_t('admin.updates.progress_title', { version: escapeHtml(targetVersion) })}</h3>
            <ol class="list-decimal list-inside mt-2 space-y-1">
                ${stepHtml}
            </ol>

            ${statusText ? `<p class="mt-2 font-medium">${statusText}</p>` : ''}

            <details class="mt-3">
                <summary class="cursor-pointer text-slate-700 font-medium">${_t('admin.updates.show_log')}</summary>
                <pre class="font-mono text-xs bg-slate-100 p-3 rounded mt-2 overflow-x-auto">${logContent}</pre>
            </details>

            <p id="update-reconnecting" class="hidden text-sm text-slate-500 mt-2">${_t('admin.updates.reconnecting')}</p>
        </div>`;
}

/** Renderiza todo el panel de actualizaciones. */
function _updRenderPanel(data) {
    const versionCard = _updVersionCard(data);
    const running = data.progress && data.progress.state === 'running';
    const inner = running ? _updProgressCard(data.progress, data.progress.targetVersion) : _updActionCard(data);

    return `
        <div class="space-y-4">
            ${versionCard}
            <div id="update-action-area">${inner}</div>
        </div>`;
}
