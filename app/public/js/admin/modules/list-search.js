/**
 * @fileoverview Cajón de búsqueda de las listas del panel: bancos, mezclas, personalizados y Trivial.
 * Cada vista ya trae su lista completa, así que se filtra aquí ocultando tarjetas: sin peticiones
 * y sin repintar, para que la caja conserve el foco.
 */

const _LISTA_BUSQUEDA_RETARDO_MS = 120;

// Por vista y en memoria: volver del editor o borrar una tarjeta repinta la lista y no debe perder el filtro.
const _terminosBusquedaLista = new Map();
let _temporizadorBusquedaLista = null;

// Mismo criterio que la búsqueda del presentador: "matematicas" encuentra "Matemáticas"
function _normalizarBusquedaLista(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Atributo que marca una tarjeta como filtrable.
 * @param {{name: string, pin?: string|number|null}} elemento - Banco o juego de la tarjeta
 * @returns {string} Atributo HTML ya escapado
 */
function atributoBusquedaLista({ name, pin }) {
    const texto = _normalizarBusquedaLista([name, pin].filter(Boolean).join(' '));
    return `data-lista-busqueda="${escapeHtml(texto)}"`;
}

/**
 * HTML del cajón de búsqueda y de su aviso de «sin resultados».
 * @param {string} vista - Identificador literal de la vista (p. ej. 'bancos'), nunca dato de usuario
 * @returns {string} HTML listo para insertar encima de la rejilla de tarjetas
 */
function htmlBuscadorLista(vista) {
    const etiqueta = escapeHtml(_t('admin.list_search.label', null, 'Buscar por nombre o PIN'));
    return `
        <div class="w-full max-w-xl mx-auto mb-8 relative">
            <i class="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
            <input type="search" data-admin-input="buscarEnLista('${vista}', this.value)"
                value="${escapeHtml(_terminosBusquedaLista.get(vista) ?? '')}"
                autocomplete="off" spellcheck="false" maxlength="100"
                aria-label="${etiqueta}" placeholder="${etiqueta}"
                class="w-full pl-12 pr-5 py-3 rounded-full text-lg text-slate-900 bg-white border-2 border-slate-200 outline-none focus:border-plum-500 focus:ring-2 focus:ring-plum-200">
        </div>
        <p data-lista-busqueda-aviso role="status" class="text-center text-lg text-slate-500"></p>`;
}

function _actualizarAvisoBusquedaLista(terminoEscrito, hayVisibles) {
    const aviso = document.querySelector('[data-lista-busqueda-aviso]');
    if (!aviso) return;
    const termino = terminoEscrito.trim();
    aviso.textContent =
        termino && !hayVisibles
            ? _t('admin.list_search.no_results', { term: termino }, 'No hay resultados para «{term}».')
            : '';
}

/**
 * Aplica a las tarjetas pintadas el término guardado de la vista. Cada vista la llama tras
 * repintarse; cancela además cualquier filtrado pendiente de la vista anterior.
 * @param {string} vista - Identificador de la vista
 * @returns {void}
 */
function filtrarTarjetasLista(vista) {
    clearTimeout(_temporizadorBusquedaLista);
    const terminoEscrito = _terminosBusquedaLista.get(vista) ?? '';
    const termino = _normalizarBusquedaLista(terminoEscrito);
    let hayVisibles = false;

    document.querySelectorAll('#editorArea [data-lista-busqueda]').forEach(tarjeta => {
        const coincide = tarjeta.dataset.listaBusqueda.includes(termino);
        tarjeta.hidden = !coincide;
        hayVisibles ||= coincide;
    });
    _actualizarAvisoBusquedaLista(terminoEscrito, hayVisibles);
}

/**
 * Manejador del cajón: guarda el término y filtra con retardo.
 * @param {string} vista - Identificador de la vista
 * @param {string} valor - Texto escrito en la caja
 * @returns {void}
 */
function buscarEnLista(vista, valor) {
    _terminosBusquedaLista.set(vista, String(valor ?? ''));
    clearTimeout(_temporizadorBusquedaLista);
    _temporizadorBusquedaLista = setTimeout(() => filtrarTarjetasLista(vista), _LISTA_BUSQUEDA_RETARDO_MS);
}
