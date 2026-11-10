/**
 * @fileoverview Campos del editor de preguntas que crecen con su texto (textarea[data-autogrow]):
 * un enunciado o una opción larga se parte en líneas y se lee entera, en lugar de quedar
 * cortada en un campo de una línea. Donde el navegador soporta `field-sizing: content`
 * (css/admin-question-editor.css) lo hace el CSS; si no, se ajusta la altura aquí.
 * Los campos con data-single-line siguen siendo una sola línea lógica: Intro no inserta
 * saltos y los que llegan al pegar pasan a espacios (el juego no muestra saltos de línea).
 * Exporta (globales): autoGrowField, autoGrowFields
 */

const _AUTOGROW_NATIVE = typeof CSS !== 'undefined' && Boolean(CSS.supports?.('field-sizing', 'content'));
const _LINE_BREAKS = /\s*[\r\n]+\s*/g;
let _autogrowResizeTimer = null;

/** Ajusta la altura de un campo a su texto (solo sin soporte nativo y si está visible). */
function autoGrowField(field) {
    if (_AUTOGROW_NATIVE || !field?.isConnected || !field.offsetParent) return;
    const borders = field.offsetHeight - field.clientHeight;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight + borders}px`;
}

/** Ajusta todos los campos que crecen dentro de root. */
function autoGrowFields(root) {
    root?.querySelectorAll?.('textarea[data-autogrow]').forEach(autoGrowField);
}

/** Cambia los saltos de línea por espacios sin mover el cursor de su sitio en el texto. */
function _flattenLineBreaks(field) {
    if (!/[\r\n]/.test(field.value)) return;
    const caret = field.value.slice(0, field.selectionStart).replace(_LINE_BREAKS, ' ').length;
    field.value = field.value.replace(_LINE_BREAKS, ' ');
    field.setSelectionRange(caret, caret);
}

function _initQuestionAutogrow() {
    // En captura: el texto ya va limpio cuando el puente data-admin-input lo guarda
    document.addEventListener(
        'keydown',
        event => {
            if (event.key !== 'Enter' || event.isComposing) return;
            if (event.target?.matches?.('textarea[data-single-line]')) event.preventDefault();
        },
        true
    );
    document.addEventListener(
        'input',
        event => {
            const field = event.target;
            if (!field?.matches?.('textarea[data-autogrow]')) return;
            if (field.hasAttribute('data-single-line')) _flattenLineBreaks(field);
            autoGrowField(field);
        },
        true
    );
    // Al cambiar el ancho cambian los cortes de línea (sin soporte nativo)
    window.addEventListener('resize', () => {
        clearTimeout(_autogrowResizeTimer);
        _autogrowResizeTimer = setTimeout(() => autoGrowFields(document.getElementById('listaPreguntasDOM')), 150);
    });
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    _initQuestionAutogrow();
}
