// Tarjetas de la lista "Preguntas Seleccionadas" del editor de juegos
// personalizados (dibujarPreguntasPersonalizadas, en personalizados-expanded.js).

// Clases literales por color (definidas a mano en css/common.css).
const _CUSTOM_CARD_COLORS = {
    amber: { btn: 'bg-amber-600 hover:bg-amber-500', input: 'text-amber-700 text-center border border-amber-300 rounded bg-white focus:outline-none focus:border-amber-500' },
    blue: { btn: 'bg-blue-600 hover:bg-blue-500', input: 'text-blue-700 text-center border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500' },
    aubergine: { btn: 'bg-aubergine-700 hover:bg-aubergine-600', input: 'text-aubergine-700 text-center border border-aubergine-300 rounded bg-white focus:outline-none focus:border-aubergine-500' },
    pink: { btn: 'bg-pink-700 hover:bg-pink-600', input: 'text-pink-700 text-center border border-pink-300 rounded bg-white focus:outline-none focus:border-pink-500' },
    plum: { btn: 'bg-plum-700 hover:bg-plum-600', input: 'text-plum-700 text-center border border-plum-300 rounded bg-white focus:outline-none focus:border-plum-500' },
    slate: { btn: 'bg-slate-700 hover:bg-slate-600', input: 'text-slate-500 text-center border border-slate-300 rounded bg-white focus:outline-none focus:border-slate-500' }
};

/** Botones subir/bajar y campo de posición. */
function _customMoveControls(idx, total, color) {
    const c = _CUSTOM_CARD_COLORS[color];
    return `
                            <div class="flex flex-col gap-2">
                                <button data-admin-click="moverPreguntaArriba(${idx})" class="${c.btn} text-white w-8 h-8 rounded flex items-center justify-center transition text-xs" ${idx === 0 ? 'disabled style="opacity: 0.3;"' : ''}>
                                    <i class="fas fa-chevron-up"></i>
                                </button>
                                <input type="number" min="1" max="${total}" value="${idx + 1}" data-admin-change="moverPreguntaAPosicion(${idx}, this.value - 1)" class="w-8 text-xs font-bold ${c.input} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" title="Editar posición" />
                                <button data-admin-click="moverPreguntaAbajo(${idx})" class="${c.btn} text-white w-8 h-8 rounded flex items-center justify-center transition text-xs" ${idx === total - 1 ? 'disabled style="opacity: 0.3;"' : ''}>
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                            </div>`;
}

function _customDeleteButton(idx, withTitle) {
    return `<button data-admin-click="eliminarPreguntaPersonalizada(${idx})" class="text-red-500 hover:text-red-700 w-8 h-8 flex items-center justify-center"${withTitle ? ' title="Eliminar"' : ''}>
                                    <i class="fas fa-trash"></i>
                                </button>`;
}

/** Columna de editar + eliminar de las diapositivas. */
function _customSlideActions(idx, editFn, editClass) {
    return `
                            <div class="flex flex-col gap-2">
                                <button data-admin-click="${editFn}(${idx})" class="${editClass} w-8 h-8 flex items-center justify-center" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                ${_customDeleteButton(idx, true)}
                            </div>`;
}

/** Tarjeta completa: controles de posición, contenido y acciones. */
function _customCardShell(card) {
    return `
                    <div class="${card.wrapClass} p-4 rounded-xl border-2">
                        <div class="flex items-start gap-4">
                            ${_customMoveControls(card.idx, card.total, card.color)}
                            ${card.body}
                            ${card.actions}
                        </div>
                    </div>
                `;
}

function _customSlideImageUrl(q) {
    if (!q.slide_image) return '';
    return q.slide_image.startsWith('/') ? q.slide_image : '/' + q.slide_image;
}

function _customCommentBody(q) {
    return `<div class="flex-1">
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold"><i class="fas fa-comment mr-1"></i>${_t('admin.custom.slide_activity', null, 'ACTIVIDAD LIBRE')}</span>
                                </div>
                                <p class="font-bold text-lg text-amber-900">${q.comment_text ? escapeHtml(q.comment_text) : _t('admin.custom.slide_no_text', null, 'Sin texto')}</p>
                                <p class="text-xs text-amber-600 mt-1 italic"><i class="fas fa-hand-pointer mr-1"></i>${_t('admin.custom.slide_activity_help', null, 'El presentador podrá asignar puntos manualmente')}</p>
                            </div>`;
}

function _customInfoBody(q) {
    return `<div class="flex-1">
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold"><i class="fas fa-info-circle mr-1"></i>${_t('admin.custom.slide_info', null, 'SLIDE INFORMATIVO')}</span>
                                </div>
                                <p class="font-bold text-lg text-blue-900">${q.comment_text ? escapeHtml(q.comment_text) : _t('admin.custom.slide_no_text', null, 'Sin texto')}</p>
                                <p class="text-xs text-blue-600 mt-1 italic"><i class="fas fa-eye mr-1"></i>${_t('admin.custom.slide_info_help', null, 'Solo se muestra (sin asignación de puntos)')}</p>
                            </div>`;
}

function _customTextBody(q) {
    const bodyPreview = (q.slide_body || '').split('\n').filter(Boolean)[0] || 'Sin texto';
    return `<div class="flex-1">
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="bg-aubergine-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fas fa-align-left mr-1"></i>${_t('admin.custom.slide_text', null, 'DIAPOSITIVA TEXTO')}</span>
                                </div>
                                <p class="font-black text-lg text-aubergine-900">${q.slide_title ? escapeHtml(q.slide_title) : _t('admin.custom.slide_no_title', null, 'Sin título')}</p>
                                <p class="text-sm text-aubergine-800 mt-1" style="white-space: pre-line;">${escapeHtml(bodyPreview)}</p>
                                <p class="text-xs text-aubergine-600 mt-2 italic"><i class="fas fa-eye mr-1"></i>${_t('admin.custom.slide_info_help', null, 'Solo se muestra (sin asignación de puntos)')}</p>
                            </div>`;
}

function _customImageBody(q) {
    const imageUrl = _customSlideImageUrl(q);
    return `<div class="flex-1 flex gap-4">
                                ${imageUrl ? `<div class="w-32 h-24 bg-black rounded flex-shrink-0 flex items-center justify-center overflow-hidden"><img src="${imageUrl}" class="max-w-full max-h-full object-contain" /></div>` : '<div class="w-32 h-24 bg-gray-300 rounded flex-shrink-0 flex items-center justify-center"><i class="fas fa-image text-gray-500 text-2xl"></i></div>'}
                                <div>
                                    <div class="flex items-center gap-2 mb-2">
                                        <span class="bg-pink-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fas fa-image mr-1"></i>${_t('admin.custom.slide_image_badge', null, 'DIAPOSITIVA IMAGEN')}</span>
                                    </div>
                                    <p class="text-xs text-pink-600 mt-2 italic"><i class="fas fa-eye mr-1"></i>${_t('admin.custom.slide_image_help', null, 'Se muestra a pantalla completa')}</p>
                                </div>
                            </div>`;
}

function _customTextImageBody(q) {
    const imageUrl = _customSlideImageUrl(q);
    const isLeft = q.slide_image_position === 'left';
    const titlePreview = (q.slide_title || '').substring(0, 60);
    const bodyPreview = (q.slide_body || '').split('\n')[0].substring(0, 80);
    return `<div class="flex-1 flex gap-4">
                                ${imageUrl ? `<div class="w-28 h-20 bg-black rounded flex-shrink-0 flex items-center justify-center overflow-hidden"><img src="${imageUrl}" class="max-w-full max-h-full object-contain" /></div>` : '<div class="w-28 h-20 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center"><i class="fas fa-columns text-gray-400 text-2xl"></i></div>'}
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                                        <span class="bg-plum-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fas fa-columns mr-1"></i>${_t('admin.custom.slide_text_image', null, 'TEXTO + IMAGEN')}</span>
                                        <span class="bg-plum-100 text-plum-700 px-2 py-1 rounded text-xs font-bold"><i class="fas ${isLeft ? 'fa-arrow-left' : 'fa-arrow-right'} mr-1"></i>${isLeft ? _t('admin.custom.slide_img_left', null, 'Imagen izquierda') : _t('admin.custom.slide_img_right', null, 'Imagen derecha')}</span>
                                    </div>
                                    <p class="font-black text-sm text-plum-900">${escapeHtml(titlePreview)}</p>
                                    <p class="text-xs text-plum-700 mt-1">${escapeHtml(bodyPreview)}</p>
                                    <p class="text-xs text-plum-500 mt-2 italic"><i class="fas fa-eye mr-1"></i>${_t('admin.custom.slide_text_image_help', null, 'Imagen solo visible en el presentador')}</p>
                                </div>
                            </div>`;
}

// Etiquetas de tipo de pregunta: [tipo, clases, clave i18n, texto por defecto]
const _CUSTOM_TYPE_BADGES = [
    ['numeric_approximation', 'bg-emerald-100 text-emerald-700', 'admin.custom.badge_numeric', 'NUMÉRICA'],
    ['order', 'bg-orange-100 text-orange-700', 'admin.custom.badge_order', 'ORDENA'],
    ['word_scramble', 'bg-yellow-100 text-yellow-700', 'admin.custom.badge_scramble', 'ANAGRAMA'],
    ['multiple_choice', 'bg-cyan-100 text-cyan-700', 'admin.custom.badge_multiple', 'MÚLTIPLE']
];

function _customQuestionBody(q) {
    const badges = _CUSTOM_TYPE_BADGES
        .filter(([type]) => q.question_type === type)
        .map(([, cls, key, fallback]) => `<span class="${cls} px-2 py-1 rounded text-xs font-bold">${_t(key, null, fallback)}</span>`)
        .join('');
    const answer = q.question_type === 'survey'
        ? _t('admin.custom.survey_answer', null, 'Encuesta (votos)')
        : escapeHtml(formatCorrectAnswerDisplayFrontend(extractCorrectAnswerFrontend(q)));
    return `<div class="flex-1">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="bg-plum-100 text-plum-700 px-2 py-1 rounded text-xs font-bold">${escapeHtml(q.bank_name)}</span>
                                ${badges}
                            </div>
                            <p class="font-medium text-sm text-slate-800">${escapeHtml(q.question_text)}</p>
                            <p class="text-xs text-green-600 mt-1"><i class="fas fa-check-circle mr-1"></i>${answer}</p>
                        </div>`;
}

// Diapositivas: [envoltorio, color, cuerpo, función de editar, clases del botón editar]
const _CUSTOM_SLIDE_CARDS = {
    comment: ['bg-amber-50 border-amber-300', 'amber', _customCommentBody, 'editarSlideComentario', 'text-amber-600 hover:text-amber-800'],
    info: ['bg-blue-50 border-blue-300', 'blue', _customInfoBody, 'editarSlideInfo', 'text-blue-600 hover:text-blue-800'],
    text: ['bg-aubergine-50 border-aubergine-300', 'aubergine', _customTextBody, 'editarSlideTexto', 'text-aubergine-700 hover:text-aubergine-900'],
    image: ['bg-pink-50 border-pink-300', 'pink', _customImageBody, 'editarSlideImagen', 'text-pink-700 hover:text-pink-900'],
    'text-image': ['bg-plum-50 border-plum-300', 'plum', _customTextImageBody, 'editarSlideTextoImagen', 'text-plum-700 hover:text-plum-900']
};

/** HTML de una entrada de la lista (diapositiva o pregunta de banco). */
function renderCustomQuestionCard(q, idx, total) {
    const slide = Object.hasOwn(_CUSTOM_SLIDE_CARDS, q.slide_type) ? _CUSTOM_SLIDE_CARDS[q.slide_type] : null;
    if (slide) {
        const [wrapClass, color, bodyFn, editFn, editClass] = slide;
        return _customCardShell({ idx, total, wrapClass, color, body: bodyFn(q), actions: _customSlideActions(idx, editFn, editClass) });
    }
    return _customCardShell({
        idx, total, wrapClass: 'bg-slate-50 border-slate-200', color: 'slate',
        body: _customQuestionBody(q),
        actions: _customDeleteButton(idx, false)
    });
}
