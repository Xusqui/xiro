/**
 * @fileoverview Funciones compartidas entre módulos
 * dibujarPreguntas y utilidades de renderizado
 * Código extraído 1:1 del original admin.js
 */

window._t = window._t || ((k, v, f) => window.XiroI18n?.t(k, v, f) ?? f ?? k);

/**
 * Pinta la lista de preguntas del editor de bancos, o su estado vacío. Conserva el scroll;
 * el foco va al campo pedido con setQuestionFocus o, si no, al que lo tenía.
 */
function dibujarPreguntas() {
    const contenedor = document.getElementById('listaPreguntasDOM');
    if (!contenedor) return;

    const activeId = document.activeElement?.id || null;
    const parent = contenedor.parentElement;
    const scrollPosition = parent ? parent.scrollTop : 0;
    const windowScrollY = window.scrollY;

    contenedor.innerHTML = preguntasData.length
        ? preguntasData
            .map((q, qIdx) => {
                normalizeQuestionDefaults(q);
                return questionCardHtml(q, qIdx);
            })
            .join('')
        : bankQuestionsEmptyHtml();
    if (typeof actualizarCabeceraPreguntas === 'function') actualizarCabeceraPreguntas();

    requestAnimationFrame(() => {
        if (parent) parent.scrollTop = scrollPosition;
        window.scrollTo(0, windowScrollY);
    });
    afterQuestionsRender(contenedor, activeId);
}

function ensureOrderIndexes(question) {
    if (!question || !Array.isArray(question.options)) return;
    question.options.forEach((opt, index) => {
        opt.order_index = index;
    });
}

function moverOpcion(qIdx, oIdx, delta) {
    const question = preguntasData[qIdx];
    if (!question || !Array.isArray(question.options)) return;

    const targetIndex = oIdx + delta;
    if (targetIndex < 0 || targetIndex >= question.options.length) return;

    const options = question.options;
    const [moved] = options.splice(oIdx, 1);
    options.splice(targetIndex, 0, moved);
    ensureOrderIndexes(question);
    // El foco sigue a la opción movida (en el borde, a la flecha que queda activa)
    const atEdge = targetIndex === 0 || targetIndex === options.length - 1;
    const arrow = (delta < 0) !== atEdge ? 'up' : 'down';
    setQuestionFocus(`opt-${arrow}-${qIdx}-${targetIndex}`);
    dibujarPregunta(qIdx);
}

/**
 * Tipos sin opciones clásicas: anagrama (palabra), sopa de letras (palabras a esconder) y
 * Completa la frase (las palabras van entre corchetes en la frase). Devuelve true si lo aplicó.
 */
function applyWordTypeDefaults(question, newType) {
    if (newType === 'word_scramble') {
        question.options = [];
        question.correctWord = question.correctWord || '';
        return true;
    }
    if (newType === 'word_search') {
        // 3 palabras vacías y tiempo de sobra para buscarlas
        question.options = [0, 1, 2].map(i => ({
            optionText: '',
            isCorrect: true,
            justification: null,
            order_index: i
        }));
        question.time_limit = Math.max(Number(question.time_limit) || 0, 90);
        return true;
    }
    if (newType === 'fill_blanks') {
        question.options = [];
        question.time_limit = Math.max(Number(question.time_limit) || 0, 45);
        return true;
    }
    return false;
}

/**
 * Cambiar tipo de pregunta y limpiar opciones si es necesario
 */
function cambiarTipoPregunta(qIdx, newType) {
    const question = preguntasData[qIdx];
    if (!question) return;

    question.type = newType;

    // Anagrama, sopa de letras y Completa la frase
    if (applyWordTypeDefaults(question, newType)) {
        dibujarPregunta(qIdx);
        return;
    }

    // Para preguntas de aproximación numérica, limpiar opciones
    if (newType === 'numeric_approximation') {
        question.options = [];
        question.toleranceMode = question.toleranceMode || 'hybrid';
        question.toleranceValue = Number(question.toleranceValue) || 25;
        if (question.toleranceCap === undefined) question.toleranceCap = 1000;
    }
    // Para preguntas de emparejamiento, inicializar 2 pares vacíos
    else if (newType === 'matching') {
        question.options = [
            { optionText: '', match_value: '', isCorrect: false, order_index: 0 },
            { optionText: '', match_value: '', isCorrect: false, order_index: 1 }
        ];
    }
    // Para preguntas de selección múltiple, asegurar opciones y campos de puntuación
    else if (newType === 'multiple_choice') {
        if (!Array.isArray(question.options) || question.options.length === 0) {
            question.options = [
                { optionText: '', isCorrect: true, justification: null, order_index: 0 },
                { optionText: '', isCorrect: false, justification: null, order_index: 1 }
            ];
        }
        // Asegurar valores por defecto para campos de puntuación
        if (question.mcPointsPerCorrect === undefined) question.mcPointsPerCorrect = 10;
        if (question.mcPenaltyPerIncorrect === undefined) question.mcPenaltyPerIncorrect = 10;
        if (question.mcPerfectBonus === undefined) question.mcPerfectBonus = 20;
    }
    // Para otros tipos, asegurar que hay al menos 2 opciones
    else if (!Array.isArray(question.options) || question.options.length === 0) {
        question.options = [
            { optionText: '', isCorrect: true, justification: null, order_index: 0 },
            { optionText: '', isCorrect: false, justification: null, order_index: 1 }
        ];
    }

    dibujarPregunta(qIdx);
}

/**
 * 🆕 Mostrar modal de error centrado con botón de cerrar
 * @param {string} titulo - Título del error (ej: "❌ Error")
 * @param {string} mensaje - Mensaje detallado del error
 * @param {string} tipo - Tipo de modal: 'error' (rojo), 'success' (verde), 'warning' (naranja), 'info' (azul)
 */
function _ensureAdminModalStyles() {
    if (document.getElementById('xiro-admin-modal-styles')) return;
    const s = document.createElement('style');
    s.id = 'xiro-admin-modal-styles';
    s.textContent = `
        @keyframes xiro-fade-in { from { opacity:0 } to { opacity:1 } }
        @keyframes xiro-zoom-in { from { opacity:0; transform:scale(.88) } to { opacity:1; transform:scale(1) } }
        .xiro-admin-overlay { animation: xiro-fade-in .2s ease-out both }
        .xiro-admin-dialog  { animation: xiro-zoom-in .22s cubic-bezier(.16,1,.3,1) both }
    `;
    document.head.appendChild(s);
}

function mostrarModalError(titulo, mensaje, tipo = 'error') {
    // Remover modal anterior si existe
    const modalAnterior = document.getElementById('modalErrorGlobal');
    if (modalAnterior) modalAnterior.remove();
    _ensureAdminModalStyles();

    // Definir colores según tipo
    const colores = {
        error: {
            bg: 'bg-red-50',
            border: 'border-red-300',
            texto: 'text-red-900',
            boton: 'bg-red-600 hover:bg-red-700'
        },
        success: {
            bg: 'bg-green-50',
            border: 'border-green-300',
            texto: 'text-green-900',
            boton: 'bg-green-600 hover:bg-green-700'
        },
        warning: {
            bg: 'bg-yellow-50',
            border: 'border-yellow-300',
            texto: 'text-yellow-900',
            boton: 'bg-yellow-600 hover:bg-yellow-700'
        },
        info: {
            bg: 'bg-blue-50',
            border: 'border-blue-300',
            texto: 'text-blue-900',
            boton: 'bg-blue-600 hover:bg-blue-700'
        }
    };

    const estilos = colores[tipo] || colores.error;

    const modal = document.createElement('div');
    modal.id = 'modalErrorGlobal';
    modal.className = 'fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4 xiro-admin-overlay';
    modal.innerHTML = _tHtml(`
        <div class="bg-white rounded-2xl shadow-2xl ${estilos.bg} border-2 ${estilos.border} max-w-md w-full p-8 xiro-admin-dialog">
            <div class="flex flex-col items-center text-center">
                <h2 class="text-2xl font-black ${estilos.texto} mb-4">${titulo}</h2>
                <p class="${estilos.texto} text-sm leading-relaxed mb-8">${mensaje}</p>
                
                <button data-admin-click="document.getElementById('modalErrorGlobal').remove()"
                    class="w-full ${estilos.boton} text-white px-8 py-4 rounded-xl font-bold transition transform active:scale-95 flex items-center justify-center gap-2">
                    <i class="fas fa-times"></i>
                    ${_t('admin.common.close', null, 'Cerrar')}
                </button>
            </div>
        </div>
    `);

    document.body.appendChild(modal);

    // Cerrar al hacer clic fuera del modal
    modal.addEventListener('click', e => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Cerrar con tecla Escape
    const closeOnEscape = e => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    };
    document.addEventListener('keydown', closeOnEscape);
}

/**
 * 🆕 Modal de confirmación (reemplaza confirm())
 * @param {string} titulo - Título del modal (ej: "⚠️ Confirmar")
 * @param {string} mensaje - Mensaje de confirmación
 * @param {Function} onConfirm - Callback al confirmar
 * @param {Function} onCancel - Callback al cancelar (opcional)
 * @param {string} textoConfirm - Texto del botón confirmar (defecto: "Confirmar")
 * @param {string} textoCancelar - Texto del botón cancelar (defecto: "Cancelar")
 */
/**
 * Diálogo de confirmación. El foco empieza en "Cancelar": Intro no confirma por accidente.
 * @param {string} titulo
 * @param {string} mensaje - HTML ya escapado
 * @param {Function} [onConfirm]
 * @param {Function} [onCancel]
 * @param {string} [textoConfirm]
 * @param {string} [textoCancelar]
 * @param {{ danger?: boolean }} [opciones] - danger: el botón de confirmar avisa de que se pierde algo
 */
// Firma posicional usada por 20+ llamadas del admin: se mantiene a propósito
// eslint-disable-next-line max-params
function mostrarModalConfirmacion(titulo, mensaje, onConfirm, onCancel, textoConfirm, textoCancelar, opciones = {}) {
    textoConfirm = textoConfirm ?? _t('admin.common.confirm', null, 'Confirmar');
    textoCancelar = textoCancelar ?? _t('admin.common.cancel', null, 'Cancelar');
    // Remover modal anterior si existe
    const modalAnterior = document.getElementById('modalConfirmacionGlobal');
    if (modalAnterior) modalAnterior.remove();
    _ensureAdminModalStyles();

    const modal = document.createElement('div');
    modal.id = 'modalConfirmacionGlobal';
    modal.className = 'fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4 xiro-admin-overlay';
    modal.innerHTML = _tHtml(`
        <div class="bg-white rounded-2xl shadow-2xl border-2 border-yellow-300 max-w-md w-full p-8 xiro-admin-dialog"
            role="alertdialog" aria-modal="true" aria-labelledby="modalConfirmacionTitulo" aria-describedby="modalConfirmacionMensaje">
            <div class="flex flex-col items-center text-center">
                <h2 id="modalConfirmacionTitulo" class="text-2xl font-black text-yellow-900 mb-4">${titulo}</h2>
                <p id="modalConfirmacionMensaje" class="text-yellow-800 text-sm leading-relaxed mb-8">${mensaje}</p>
                
                <div class="flex gap-3 w-full">
                    <button data-admin-click="document.getElementById('modalConfirmacionGlobal').remove()" 
                        class="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-800 px-6 py-3 rounded-xl font-bold transition transform active:scale-95">
                        ${textoCancelar}
                    </button>
                    <button id="btnConfirmarModal"
                        class="flex-1 ${opciones.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'} text-white px-6 py-3 rounded-xl font-bold transition transform active:scale-95">
                        ${textoConfirm}
                    </button>
                </div>
            </div>
        </div>
    `);

    document.body.appendChild(modal);

    // Configurar eventos
    const btnConfirmar = document.getElementById('btnConfirmarModal');

    btnConfirmar.addEventListener('click', () => {
        modal.remove();
        if (onConfirm) onConfirm();
    });

    const btnCancelar = modal.querySelector('button:first-child');
    btnCancelar.addEventListener('click', () => {
        modal.remove();
        if (onCancel) onCancel();
    });

    // Cerrar al hacer clic fuera del modal
    modal.addEventListener('click', e => {
        if (e.target === modal) {
            modal.remove();
            if (onCancel) onCancel();
        }
    });

    // Cerrar con tecla Escape
    const closeOnEscape = e => {
        if (e.key === 'Escape') {
            modal.remove();
            if (onCancel) onCancel();
            document.removeEventListener('keydown', closeOnEscape);
        }
    };
    document.addEventListener('keydown', closeOnEscape);

    btnCancelar.focus();
}

/**
 * Oculta/muestra al presentador TODOS los recursos de una página de listado
 * (bancos, mezclas de preguntas, personalizados o trivial), respetando la
 * propiedad del recurso (un editor sólo afecta a los suyos, el admin a todos).
 * @param {string} apiPath - endpoint bulk, ej: '/api/banks/visibility-all'
 * @param {boolean} visible
 * @param {Function} renderFn - vista a refrescar tras aplicar el cambio
 */
function toggleAllVisibleToPresenter(apiPath, visible, renderFn) {
    mostrarModalConfirmacion(
        _t('admin.common.confirmation_title', null, '⚠️ Confirmación'),
        visible
            ? _t('admin.common.confirm_show_all_msg', null, '¿Deseas mostrar todos estos juegos al presentador?')
            : _t('admin.common.confirm_hide_all_msg', null, '¿Deseas ocultar todos estos juegos al presentador?'),
        async () => {
            try {
                const res = await fetchWithAuth(apiPath, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ visible })
                });
                if (res.ok) {
                    await renderFn();
                } else {
                    const err = await res.json();
                    mostrarModalError(
                        _t('admin.common.error_title', null, '❌ Error'),
                        err.message ||
                            err.error ||
                            _t('admin.common.error_generic', null, 'No se pudo completar la acción'),
                        'error'
                    );
                }
            } catch {
                mostrarModalError(
                    _t('admin.common.error_title', null, '❌ Error'),
                    _t('admin.common.error_server', null, 'Error de conexión con el servidor'),
                    'error'
                );
            }
        },
        null,
        _t('admin.common.confirm', null, 'Confirmar'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}
