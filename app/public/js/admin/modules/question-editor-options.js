// Editor de preguntas del admin: reparto por tipo y secciones con opciones (quiz,
// encuestas, ordenar y selección múltiple). Emparejar está en matching-editor.js.
// La respuesta correcta se marca con un control visible con texto ("Correcta"), no
// solo con el color del borde.

/** Sección propia del tipo de pregunta, bajo el enunciado. */
function questionTypeSectionHtml(q, qIdx, isHybridToleranceMode) {
    if (q.type === 'numeric_approximation') return numericEditorHtml(q, qIdx, isHybridToleranceMode);
    if (q.type === 'hotspot') return hotspotEditorSectionHtml(q, qIdx);
    if (q.type === 'word_scramble') return wordScrambleEditorHtml(q, qIdx);
    if (q.type === 'matching') return matchingEditorSectionHtml(q, qIdx);
    if (q.type === 'word_search') return wordSearchEditorSectionHtml(q, qIdx);
    if (q.type === 'fill_blanks') return fillBlanksEditorSectionHtml(q, qIdx);
    if (q.type === 'multiple_choice') return multipleChoiceEditorHtml(q, qIdx);
    if (q.type === 'order') return orderEditorHtml(q, qIdx);
    if (q.type === 'survey' || q.type === 'survey_multiple') return surveyEditorHtml(q, qIdx);
    if (q.type === 'word_cloud') return wordCloudEditorHtml(q, qIdx);
    return quizEditorHtml(q, qIdx);
}

const WORD_CLOUD_MAX_WORDS = 5;

/** Palabras por jugador acotadas a 1..5 (valor ausente o inválido: 1). */
function _wordCloudWordsLimit(raw) {
    return Math.min(WORD_CLOUD_MAX_WORDS, Math.max(1, Math.round(Number(raw)) || 1));
}

/** Relleno del slider: 0 % en 1 palabra, 100 % en 5. */
function _wordCloudFillPercent(words) {
    return ((words - 1) / (WORD_CLOUD_MAX_WORDS - 1)) * 100;
}

/** Slider de palabras: guarda el valor en la pregunta y refresca relleno y número de la derecha. */
function setWordCloudMaxWords(qIdx, rawValue) {
    const words = _wordCloudWordsLimit(rawValue);
    preguntasData[qIdx].maxWords = words;
    const slider = document.getElementById(`wc-max-${qIdx}`);
    if (!slider) return;
    slider.style.setProperty('--v', _wordCloudFillPercent(words));
    const output = document.getElementById(`wc-max-value-${qIdx}`);
    if (output) output.textContent = String(words);
}

/** Nube de palabras: sin opciones ni respuesta correcta; solo cuántas palabras escribe cada jugador (1 a 5). */
function wordCloudEditorHtml(q, qIdx) {
    const current = _wordCloudWordsLimit(q.maxWords);
    const action = `setWordCloudMaxWords(${qIdx}, this.value)`;
    const body = `
                        <div>
                            <label class="xq-label" for="wc-max-${qIdx}">${_t('admin.q.wordcloud_max', null, 'Palabras por jugador')}</label>
                            <div class="xq-range">
                                <input type="range" id="wc-max-${qIdx}" class="xq-range__input" min="1" max="${WORD_CLOUD_MAX_WORDS}" step="1" value="${current}"
                                    style="--v: ${_wordCloudFillPercent(current)}" data-admin-input="${action}" data-admin-change="${action}">
                                <output class="xq-range__value" id="wc-max-value-${qIdx}" for="wc-max-${qIdx}">${current}</output>
                            </div>
                        </div>`;
    return questionSectionHtml(
        _t('admin.q.wordcloud_title', null, 'Nube de palabras'),
        _t('admin.q.wordcloud_hint', null, 'Sin respuesta correcta: cada jugador escribe palabras de hasta 20 letras y se agrupan en una nube.'),
        body
    );
}

/** Control "Correcta" de una opción: radio (quiz) o casilla (selección múltiple). */
function _correctToggleHtml(opt, qIdx, oIdx, multiple) {
    const n = oIdx + 1;
    const action = multiple ? `marcarCorrectaMultiple(${qIdx}, ${oIdx})` : `marcarCorrecta(${qIdx}, ${oIdx})`;
    const label = _t('admin.q.mark_correct', { n }, 'La opción {n} es correcta');
    return `<label class="xq-correct" title="${label}">
                                            <input type="${multiple ? 'checkbox' : 'radio'}" id="correct-${qIdx}-${oIdx}" class="xq-correct__input"${multiple ? '' : ` name="correct_${qIdx}"`}
                                                ${opt.isCorrect ? 'checked' : ''} aria-label="${label}" data-admin-change="${action}">
                                            <i class="${opt.isCorrect ? 'fas fa-circle-check' : 'far fa-circle'}" aria-hidden="true"></i><span aria-hidden="true">${_t('admin.q.correct', null, 'Correcta')}</span>
                                        </label>`;
}

/** Fila de una opción: control a la izquierda (correcta o número), texto, imagen y quitar. */
function _optionRowHtml(q, qIdx, opt, oIdx, leadHtml) {
    const removable = q.options.length > 2;
    const label = _t('admin.q.option_remove', { n: oIdx + 1 }, 'Quitar la opción {n}');
    return `
                                    <div class="xq-option${opt.isCorrect && leadHtml.includes('xq-correct') ? ' is-correct' : ''}">
                                        ${leadHtml}
                                        ${optionTextInputHtml(opt, qIdx, oIdx)}
                                        ${optionImageHtml(opt, qIdx, oIdx)}
                                        ${removable ? optionIconButtonHtml(`opt-del-${qIdx}-${oIdx}`, `eliminarOpcion(${qIdx}, ${oIdx})`, 'fa-xmark', label) : ''}
                                    </div>`;
}

function _optionsGridHtml(q, qIdx, leadFor) {
    return `
                        <div class="xq-options">
                            ${q.options.map((opt, oIdx) => _optionRowHtml(q, qIdx, opt, oIdx, leadFor(opt, oIdx))).join('')}
                        </div>
                        <p class="xq-hint">${_t('admin.q.option_image_drop', null, 'Para poner una imagen en una opción, arrástrala sobre su fila.')}</p>
                        ${addOptionButtonHtml(q, qIdx)}`;
}

const _optionNumberHtml = (_opt, oIdx) => `<span class="xq-num" aria-hidden="true">${oIdx + 1}</span>`;

/** Quiz: una respuesta correcta y su justificación. */
function quizEditorHtml(q, qIdx) {
    const body = _optionsGridHtml(q, qIdx, (opt, oIdx) => _correctToggleHtml(opt, qIdx, oIdx, false)) + justificationHtml(q, qIdx);
    return questionSectionHtml(
        _t('admin.q.answers', null, 'Respuestas'),
        _t('admin.q.quiz_hint', null, 'Escribe las opciones y marca cuál es la correcta.'),
        body
    );
}

/** Encuestas: sin respuesta correcta. */
function surveyEditorHtml(q, qIdx) {
    const hint =
        q.type === 'survey_multiple'
            ? _t('admin.q.survey_multiple_note', null, 'Cada jugador marca las opciones que quiera, o ninguna. Al revelar se ve qué parte de los que respondieron eligió cada opción, así que los porcentajes pueden sumar más del 100 %.')
            : _t('admin.q.survey_note', null, 'Sin respuesta correcta: cada jugador vota una opción y al revelar se ve el reparto de votos.');
    return questionSectionHtml(_t('admin.q.answers', null, 'Respuestas'), hint, _optionsGridHtml(q, qIdx, _optionNumberHtml));
}

/** Ordenar: una columna, en el orden correcto, con flechas y un dato por opción. */
function orderEditorHtml(q, qIdx) {
    const last = q.options.length - 1;
    const rows = q.options
        .map((opt, oIdx) => {
            const n = oIdx + 1;
            const up = optionIconButtonHtml(`opt-up-${qIdx}-${oIdx}`, `moverOpcion(${qIdx}, ${oIdx}, -1)`, 'fa-arrow-up', _t('admin.q.option_up', { n }, 'Subir la opción {n}'), oIdx === 0);
            const down = optionIconButtonHtml(`opt-down-${qIdx}-${oIdx}`, `moverOpcion(${qIdx}, ${oIdx}, 1)`, 'fa-arrow-down', _t('admin.q.option_down', { n }, 'Bajar la opción {n}'), oIdx === last);
            const remove = q.options.length > 2
                ? optionIconButtonHtml(`opt-del-${qIdx}-${oIdx}`, `eliminarOpcion(${qIdx}, ${oIdx})`, 'fa-xmark', _t('admin.q.option_remove', { n }, 'Quitar la opción {n}'))
                : '';
            const detail = _t('admin.q.order_detail', { n }, 'Dato de la opción {n} al revelar');
            return `
                                    <div class="xq-option xq-option--order">
                                        <div class="xq-option__line">${_optionNumberHtml(opt, oIdx)}${optionTextInputHtml(opt, qIdx, oIdx)}${up}${down}${remove}</div>
                                        <input type="text" class="xq-option__detail" value="${escapeHtml(opt.justification || '')}" aria-label="${detail}"
                                            placeholder="${escapeHtml(_t('admin.q.order_detail_placeholder', null, 'Dato que se muestra al revelar (opcional)'))}"
                                            data-admin-input="preguntasData[${qIdx}].options[${oIdx}].justification = this.value">
                                    </div>`;
        })
        .join('');
    return questionSectionHtml(
        _t('admin.q.answers_order', null, 'Opciones en el orden correcto'),
        _t('admin.q.order_hint', null, 'Escríbelas de la primera a la última; el jugador tendrá que ordenarlas.'),
        `<div class="xq-options xq-options--list">${rows}</div>${addOptionButtonHtml(q, qIdx)}`
    );
}
