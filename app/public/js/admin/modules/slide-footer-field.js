/**
 * @fileoverview Campo «Pie de diapositiva» (slide_footer, opcional) de los modales
 * de diapositivas especiales: Actividad, Info, Texto, Imagen y Texto+Imagen.
 * Solo hay un modal abierto a la vez, así que el textarea usa un id fijo.
 * El texto se guarda tal cual (plano); quien lo pinta lo escapa (core/slide-footer.js).
 */

const SLIDE_FOOTER_FIELD_ID = 'slideFooterInput';
const SLIDE_FOOTER_MAX_LENGTH = 300;
let _slideFooterFieldReady = false;

/**
 * HTML del campo, con el valor actual escapado.
 * @param {string|null} [value]
 * @returns {string}
 */
function slideFooterFieldHtml(value) {
    const current = typeof value === 'string' ? value : '';
    return `
        <div class="mt-4">
            <label for="${SLIDE_FOOTER_FIELD_ID}" class="block text-sm font-bold text-slate-700 mb-1">
                ${_t('admin.custom.slide_footer_label', null, 'Pie de diapositiva (opcional)')}
            </label>
            <textarea id="${SLIDE_FOOTER_FIELD_ID}" maxlength="${SLIDE_FOOTER_MAX_LENGTH}" rows="2"
                class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-plum-500 outline-none resize-none text-sm"
                placeholder="${escapeHtml(_t('admin.custom.slide_footer_placeholder', null, 'Ej: Fuente: Wikipedia · Se ve en pequeño al pie de la pantalla'))}">${escapeHtml(current)}</textarea>
            <p class="text-xs text-slate-400 text-right"><span id="slideFooterCount">${current.length}</span>/${SLIDE_FOOTER_MAX_LENGTH}</p>
        </div>`;
}

/**
 * Valor del campo: texto recortado, o null si está vacío o el modal no lo tiene.
 * @returns {string|null}
 */
function readSlideFooterField() {
    const el = document.getElementById(SLIDE_FOOTER_FIELD_ID);
    if (!el) return null;
    const text = el.value.replace(/\r\n?/g, '\n').trim().slice(0, SLIDE_FOOTER_MAX_LENGTH);
    return text || null;
}

function initSlideFooterField() {
    if (_slideFooterFieldReady) return;
    _slideFooterFieldReady = true;
    document.addEventListener('input', event => {
        if (event.target?.id !== SLIDE_FOOTER_FIELD_ID) return;
        const counter = document.getElementById('slideFooterCount');
        if (counter) counter.textContent = String(event.target.value.length);
    });
}

initSlideFooterField();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { slideFooterFieldHtml, readSlideFooterField, SLIDE_FOOTER_MAX_LENGTH };
}
