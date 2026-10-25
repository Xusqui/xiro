/**
 * @fileoverview Aviso al guardar un banco del que se han quitado preguntas que
 * usa algún juego personalizado (respuesta 409 BANK_QUESTIONS_IN_USE de
 * /api/banks/save-all). Borrarlas también las quita de esos juegos.
 */

const _IN_USE_TEXT_MAX = 80;
const _IN_USE_LIST_MAX = 5;

/** Enunciado corto: los huecos de «Completa la frase» ({{n}}) se ven como ___. */
function _inUseQuestionText(text) {
    const plain = String(text || '')
        .replace(/\{\{\d+\}\}/g, '___')
        .trim();
    return plain.length > _IN_USE_TEXT_MAX ? `${plain.slice(0, _IN_USE_TEXT_MAX - 1)}…` : plain;
}

/** Lista de preguntas con sus juegos; en spans porque el modal la mete en un <p>. */
function _inUseListHtml(inUse) {
    const items = inUse.slice(0, _IN_USE_LIST_MAX).map(q => {
        const games = q.custom_games.map(g => escapeHtml(g.name)).join(', ');
        return `<span class="block mt-3" data-i18n-skip="true">
                <strong>«${escapeHtml(_inUseQuestionText(q.question_text))}»</strong>
                <span class="block text-xs">${_t('admin.banks.in_use_games', { games })}</span>
            </span>`;
    });
    const rest = inUse.length - _IN_USE_LIST_MAX;
    if (rest > 0) {
        items.push(`<span class="block mt-3 text-xs">${_t('admin.banks.in_use_more', { n: rest })}</span>`);
    }
    return items.join('');
}

/**
 * Pregunta qué hacer con las preguntas en uso.
 * Cerrar el aviso (Escape o clic fuera) equivale a «No borrarla», que no borra nada.
 * @param {Array<{ question_text: string, custom_games: Array<{ name: string }> }>} inUse
 * @returns {Promise<'delete'|'keep'>}
 */
function preguntarBorradoPreguntasEnUso(inUse) {
    const one = inUse.length === 1;
    const message = `${_t(one ? 'admin.banks.in_use_msg_one' : 'admin.banks.in_use_msg_many', { n: inUse.length })}${_inUseListHtml(inUse)}`;
    return new Promise(resolve => {
        mostrarModalConfirmacion(
            _t('admin.banks.in_use_title'),
            message,
            () => resolve('delete'),
            () => resolve('keep'),
            _t(one ? 'admin.banks.in_use_delete_one' : 'admin.banks.in_use_delete_many'),
            _t(one ? 'admin.banks.in_use_keep_one' : 'admin.banks.in_use_keep_many')
        );
        // El foco empieza en la opción que no borra nada
        document.querySelector('#modalConfirmacionGlobal button')?.focus();
    });
}
