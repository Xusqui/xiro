/**
 * @fileoverview Editor de bancos: exportar a JSON y guardar (lo llama la barra de guardado).
 * Antes de enviar, cada pregunta se valida (question-editor-validation.js); el servidor
 * vuelve a validarlo todo y, si rechaza una pregunta, se señala igual.
 */

// ===== EXPORTAR BANCO =====

// Exportar el banco actualmente en edición al formato de la base de datos
function exportarBanco() {
    const id = document.getElementById('editId').value;
    const name = document.getElementById('editName').value || 'banco';

    if (!id)
        return mostrarModalError(
            _t('admin.common.warning_title', null, '⚠️ Advertencia'),
            _t('admin.banks.error_export_saved', null, 'Sólo se puede exportar un banco guardado previamente'),
            'warning'
        );
    if (!preguntasData || preguntasData.length === 0)
        return mostrarModalError(
            _t('admin.common.warning_title', null, '⚠️ Advertencia'),
            _t('admin.banks.error_export_empty', null, 'El banco no tiene preguntas para exportar'),
            'warning'
        );

    const preguntasValidas = preguntasData.filter(q => (q.questionText || q.question_text || '').trim() !== '');

    const language = document.getElementById('editBankLanguage')?.value || 'es';

    const payload = {
        name: name,
        type: 'quiz',
        language: language,
        questions: preguntasValidas.map(q => mapQuestionForExport(q))
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
    a.href = url;
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    _warnSkippedOnExport(preguntasData.length - preguntasValidas.length);
}

/** El JSON exportado deja fuera las preguntas sin enunciado: se avisa de cuántas. */
function _warnSkippedOnExport(skipped) {
    if (skipped <= 0) return;
    mostrarModalError(
        _t('admin.common.warning_title', null, '⚠️ Advertencia'),
        _t('admin.banks.export_skipped', { n: skipped }, 'Se han dejado fuera {n} pregunta(s) sin enunciado.'),
        'warning'
    );
}

// ===== GUARDAR BANCO =====

function _readBankForm() {
    return {
        id: document.getElementById('editId').value,
        ownerUserId: document.getElementById('editOwnerUserId')?.value || null,
        name: document.getElementById('editName').value,
        pin: document.getElementById('editBankPin').value.trim(),
        language: document.getElementById('editBankLanguage')?.value || 'es',
        visibleToPresenter: document.getElementById('editBankVisibleToPresenter').checked,
        imageUrl: document.getElementById('editBankImageUrl')?.value || null
    };
}

function _readBankStreaks() {
    return {
        use_streaks: document.getElementById('editBankUseStreaks')?.checked ?? false,
        streak_threshold: parseInt(document.getElementById('editBankStreakThreshold')?.value || '3', 10),
        streak_bonus_percentage: parseFloat(document.getElementById('editBankStreakBonusPercentage')?.value || '0.50'),
        use_double_streaks: document.getElementById('editBankUseDoubleStreaks')?.checked ?? false,
        double_streak_threshold: parseInt(document.getElementById('editBankDoubleStreakThreshold')?.value || '5', 10),
        double_streak_bonus_percentage: parseFloat(
            document.getElementById('editBankDoubleStreakBonusPercentage')?.value || '1.00'
        )
    };
}

/** Mensaje de validación del banco, o null si se puede guardar. */
function _bankValidationError(form, randomPoints) {
    const randomPointsCheck = validateRandomPointsConfig(randomPoints);
    if (!randomPointsCheck.valid) return randomPointsCheck.message;
    if (!form.name) return _t('admin.banks.error_name', null, 'Por favor, ponle un nombre al banco');
    if (preguntasData.length === 0) return _t('admin.banks.error_questions', null, 'Añade al menos una pregunta');
    return null;
}

/**
 * Resultado para la barra de guardado. Se recarga un banco nuevo (para tener los
 * IDs de las preguntas) y uno que conservó preguntas en uso (para que reaparezcan).
 */
async function _afterBankSaved(id, data) {
    const kept = Number(data.keptQuestions) || 0;
    const message = kept
        ? _t('admin.banks.success_saved_kept', { n: kept })
        : _t('admin.banks.success_saved', null, '¡Banco guardado correctamente!');
    if ((!id || kept) && data.id) {
        document.getElementById('editId').value = data.id;
        await cargarEditorBanco(data.id);
        announceSaveBarSaved(message);
    }
    return { ok: true, message };
}

function _sendBank(payload) {
    return fetchWithAuth('/api/banks/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

/** Envía el banco; si quita preguntas que usa algún juego personalizado, pregunta y reenvía. */
async function _postBank(payload) {
    const res = await _sendBank(payload);
    if (res.status !== 409) return res;
    const conflict = await res
        .clone()
        .json()
        .catch(() => ({}));
    if (conflict.code !== 'BANK_QUESTIONS_IN_USE') return res;
    const decision = await preguntarBorradoPreguntasEnUso(conflict.inUse || []);
    return _sendBank({ ...payload, removed_in_use: decision });
}

/**
 * Guarda el banco (lo llama la barra de guardado común).
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
async function guardarBanco() {
    const form = _readBankForm();
    const randomPoints = readRandomPointsConfig('bank');

    const validationError = _bankValidationError(form, randomPoints);
    if (validationError) return { ok: false, message: escapeHtml(validationError) };
    if (form.id && !canModifyOwnedResource(form.ownerUserId)) {
        showOwnershipDeniedModal('este banco');
        return { ok: false, message: _t('admin.savebar.error_ownership') };
    }

    // Ninguna pregunta se descarta en silencio: la primera incompleta se señala y se corrige
    const problem = findFirstQuestionProblem(preguntasData);
    if (problem) return { ok: false, message: showQuestionProblem(problem) };
    clearQuestionErrors();

    const payload = {
        id: form.id ? parseInt(form.id, 10) : null,
        name: form.name,
        pin: form.pin || null,
        language: form.language,
        visible_to_presenter: form.visibleToPresenter,
        ..._readBankStreaks(),
        image_url: form.imageUrl,
        ...randomPoints,
        questions: preguntasData.map(mapBankQuestionForSave)
    };

    try {
        const res = await _postBank(payload);
        if (res.ok) return _afterBankSaved(form.id, await res.json());
        const err = await res.json().catch(() => ({}));
        const serverProblem = questionProblemFromServer(err);
        if (serverProblem) return { ok: false, message: showQuestionProblem(serverProblem) };
        return { ok: false, message: escapeHtml(err.message || err.error || _t('admin.tools.error_unknown')) };
    } catch {
        return { ok: false, message: _t('admin.common.error_server', null, 'Error de conexión con el servidor') };
    }
}
