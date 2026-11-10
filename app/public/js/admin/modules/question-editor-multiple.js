// Editor de preguntas del admin: selección múltiple (de 1 a 6 correctas). Primero las
// opciones y cuáles son correctas; después, la puntuación que se aplica sobre ellas.

const _MC_SCORE_FIELDS = [
    {
        prop: 'mcPointsPerCorrect',
        id: 'mc-points',
        min: 1,
        fallback: 10,
        expr: 'Math.max(1, Math.min(100, parseInt(this.value) || 10))',
        label: ['admin.q.mc_points_label', 'Puntos por cada correcta marcada'],
        help: ['admin.q.mc_points_help', 'Se suman por cada opción correcta que marque el jugador (1-100)']
    },
    {
        prop: 'mcPenaltyPerIncorrect',
        id: 'mc-penalty',
        min: 0,
        fallback: 10,
        expr: 'Math.max(0, Math.min(100, parseInt(this.value) || 10))',
        label: ['admin.q.mc_penalty_label', 'Penalización por cada incorrecta marcada'],
        help: ['admin.q.mc_penalty_help', 'Se restan por cada opción incorrecta que marque (0-100)']
    },
    {
        prop: 'mcPerfectBonus',
        id: 'mc-bonus',
        min: 0,
        fallback: 20,
        expr: 'Math.max(0, Math.min(100, parseInt(this.value) || 20))',
        label: ['admin.q.mc_bonus_label', 'Bonus por selección perfecta'],
        help: ['admin.q.mc_bonus_help', 'Si marca todas las correctas y ninguna incorrecta (0-100)']
    }
];

function _mcScoreFieldHtml(q, qIdx, field) {
    const id = `${field.id}-${qIdx}`;
    return `
                            <div>
                                <label class="xq-label" for="${id}">${_t(field.label[0], null, field.label[1])}</label>
                                <input type="number" id="${id}" min="${field.min}" max="100" step="1" value="${q[field.prop] ?? field.fallback}" placeholder="${field.fallback}"
                                    class="xq-field" aria-describedby="${id}-help" data-admin-input="preguntasData[${qIdx}].${field.prop} = ${field.expr}">
                                <p class="xq-hint" id="${id}-help">${_t(field.help[0], null, field.help[1])}</p>
                            </div>`;
}

function _mcHelpItems() {
    return [
        _t('admin.q.mc_help_play', null, 'Los jugadores ven casillas y pueden marcar varias opciones'),
        _t('admin.q.mc_help_formula', null, 'Puntuación = correctas marcadas × puntos − incorrectas marcadas × penalización'),
        _t('admin.q.mc_help_bonus', null, 'Si la selección es perfecta se suma el bonus'),
        _t('admin.q.mc_help_negative', null, 'La puntuación puede ser negativa'),
        _t('admin.q.mc_help_streak', null, 'Solo las selecciones perfectas cuentan para la racha')
    ];
}

/** Selección múltiple: opciones con varias correctas, justificación y puntuación. */
function multipleChoiceEditorHtml(q, qIdx) {
    const options = `
                        <div class="xq-options">
                            ${q.options.map((opt, oIdx) => _optionRowHtml(q, qIdx, opt, oIdx, _correctToggleHtml(opt, qIdx, oIdx, true))).join('')}
                        </div>
                        ${addOptionButtonHtml(q, qIdx)}`;
    const scoring = `
                        <div class="xq-subsection">
                            <h5 class="xq-subsection__title">${_t('admin.q.mc_scoring', null, 'Puntuación')}</h5>
                            <div class="xq-fields-3">${_MC_SCORE_FIELDS.map(field => _mcScoreFieldHtml(q, qIdx, field)).join('')}</div>
                            ${questionHelpHtml(q, _mcHelpItems())}
                        </div>`;
    return questionSectionHtml(
        _t('admin.q.answers', null, 'Respuestas'),
        _t('admin.q.mc_hint', null, 'Marca todas las correctas (de 1 a 6). El jugador puede elegir varias.'),
        options + justificationHtml(q, qIdx) + scoring
    );
}
