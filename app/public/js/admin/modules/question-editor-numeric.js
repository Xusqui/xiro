// Editor de preguntas del admin: secciones de las preguntas numéricas y de anagrama.

function _numberFieldHtml({ id, label, aside, value, attrs, input, help }) {
    return `
                            <div>
                                <label class="xq-label" for="${id}">${label}${aside ? ` <span class="xq-label__aside">${aside}</span>` : ''}</label>
                                <input type="number" id="${id}" value="${value}" ${attrs} class="xq-field"${help ? ` aria-describedby="${id}-help"` : ''}
                                    data-admin-input="${input}">
                                ${help ? `<p class="xq-hint" id="${id}-help">${help}</p>` : ''}
                            </div>`;
}

function _toleranceModeHtml(q, qIdx) {
    const mode = q.toleranceMode || 'hybrid';
    const option = (value, key, fallback) =>
        `<option value="${value}"${mode === value ? ' selected' : ''}>${_t(key, null, fallback)}</option>`;
    return `
                            <div>
                                <label class="xq-label" for="num-mode-${qIdx}">${_t('admin.q.num_mode_label', null, 'Cómo se mide el margen')}</label>
                                <select id="num-mode-${qIdx}" class="xq-field" data-admin-change="preguntasData[${qIdx}].toleranceMode = this.value; dibujarPregunta(${qIdx})">
                                    ${option('hybrid', 'admin.q.num_mode_hybrid', 'Porcentaje con tope (el menor de los dos)')}
                                    ${option('percentage', 'admin.q.num_mode_percentage', 'Porcentaje de la respuesta')}
                                    ${option('absolute', 'admin.q.num_mode_absolute', 'Unidades de más o de menos')}
                                </select>
                            </div>`;
}

function _toleranceFieldsHtml(q, qIdx, isHybridToleranceMode) {
    const absolute = q.toleranceMode === 'absolute';
    const value = _numberFieldHtml({
        id: `num-value-${qIdx}`,
        label: absolute ? _t('admin.q.num_value_units', null, 'Margen (unidades)') : _t('admin.q.num_value_pct', null, 'Margen (%)'),
        value: q.toleranceValue ?? 25,
        attrs: 'min="0.01" step="0.01" placeholder="25"',
        input: `preguntasData[${qIdx}].toleranceValue = Number(this.value) || 25`,
        help: absolute
            ? _t('admin.q.num_value_units_help', null, 'Puntúa quien quede a esta distancia o menos de la respuesta')
            : _t('admin.q.num_value_pct_help', null, 'Puntúa quien quede a este porcentaje o menos de la respuesta')
    });
    if (!isHybridToleranceMode) return value;
    return value + _numberFieldHtml({
        id: `num-cap-${qIdx}`,
        label: _t('admin.q.num_cap_label', null, 'Tope del margen (unidades)'),
        aside: _t('admin.q.optional', null, 'opcional'),
        value: q.toleranceCap ?? '',
        attrs: 'min="0.01" step="0.01" placeholder="1000"',
        input: `preguntasData[${qIdx}].toleranceCap = this.value === '' ? null : (Number(this.value) || null)`,
        help: _t('admin.q.num_cap_help', null, 'El margen nunca pasa de este número. Vacío: solo el porcentaje.')
    });
}

/** Numérica (aproximación): respuesta, puntos, margen y pista. */
function numericEditorHtml(q, qIdx, isHybridToleranceMode) {
    const answer = _numberFieldHtml({
        id: `num-answer-${qIdx}`,
        label: _t('admin.q.num_answer_label', null, 'Respuesta correcta (número entero)'),
        value: q.correctAnswer ?? '',
        attrs: 'step="1" placeholder="123456"',
        input: `preguntasData[${qIdx}].correctAnswer = parseInt(this.value) || null`
    });
    const points = _numberFieldHtml({
        id: `num-points-${qIdx}`,
        label: _t('admin.q.num_points_label', null, 'Puntos máximos'),
        value: q.maxPoints ?? '',
        attrs: 'min="1" step="1" placeholder="100"',
        input: `preguntasData[${qIdx}].maxPoints = Math.max(1, parseInt(this.value) || 0)`,
        help: _t('admin.q.num_points_help', null, 'Los consigue quien acierta exacto; cuanto más lejos, menos')
    });
    const hint = `
                            <div class="xq-fields-span">
                                <label class="xq-label" for="num-hint-${qIdx}">${_t('admin.q.num_hint_label', null, 'Pista para el presentador')} <span class="xq-label__aside">${_t('admin.q.optional', null, 'opcional')}</span></label>
                                <textarea id="num-hint-${qIdx}" rows="2" class="xq-field" data-admin-input="preguntasData[${qIdx}].hint = this.value"
                                    placeholder="${escapeHtml(_t('admin.q.num_hint_placeholder', null, 'Se muestra al presentador mientras espera las respuestas'))}">${escapeHtml(q.hint || '')}</textarea>
                            </div>`;
    const help = questionHelpHtml(q, [
        _t('admin.q.num_help_play', null, 'Los jugadores escriben un número'),
        _t('admin.q.num_help_points', null, 'Los puntos bajan cuanto más se alejan, hasta 0 fuera del margen'),
        _t('admin.q.num_help_exact', null, 'Acertar exacto suma 20 puntos extra')
    ]);
    return questionSectionHtml(
        _t('admin.q.answer_single', null, 'Respuesta'),
        _t('admin.q.num_hint', null, 'Una sola respuesta numérica, sin opciones.'),
        `<div class="xq-fields-2">${answer}${points}${_toleranceModeHtml(q, qIdx)}${_toleranceFieldsHtml(q, qIdx, isHybridToleranceMode)}${hint}</div>${help}`
    );
}

/** Anagrama: palabra correcta. */
function wordScrambleEditorHtml(q, qIdx) {
    const field = `
                        <div>
                            <label class="xq-label" for="word-${qIdx}">${_t('admin.q.word_label', null, 'Palabra correcta')} <span class="xq-label__aside">${_t('admin.q.word_aside', null, '7-10 letras, sin tildes')}</span></label>
                            <input type="text" id="word-${qIdx}" maxlength="10" value="${escapeHtml(q.correctWord || '')}" placeholder="LIBERTAD"
                                data-admin-input="preguntasData[${qIdx}].correctWord = this.value.replace(/[^A-Za-zÁáÉéÍíÓóÚúÜüÑñ]/g,'').toUpperCase()"
                                class="xq-field xq-field--word">
                        </div>`;
    const help = questionHelpHtml(q, [
        _t('admin.q.word_help_statement', null, 'El enunciado es la definición de la palabra'),
        _t('admin.q.word_help_letters', null, 'Los jugadores ven 10 letras barajadas, que incluyen las de la palabra'),
        _t('admin.q.word_help_play', null, 'Pulsan las letras en orden para formarla'),
        _t('admin.q.word_help_points', null, 'Puntuación: 20 pts base + hasta 20 pts de bonus por tiempo')
    ]);
    return questionSectionHtml(
        _t('admin.q.answer_single', null, 'Respuesta'),
        _t('admin.q.word_hint', null, 'El jugador ve 10 letras barajadas y descubre la palabra oculta.'),
        field + help
    );
}
