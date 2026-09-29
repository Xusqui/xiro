/**
 * @fileoverview Guard de cambios sin guardar para editores del panel admin
 *
 * [TAG:OBJETIVO]
 * - Avisar al usuario antes de salir de un editor con cambios no guardados.
 * - Reutilizable para: bancos, juegos mezcla y juegos personalizados.
 *
 * [TAG:USO]
 * 1) setUnsavedChangesGuard('bancos', () => ({ ...snapshotActual }))
 * 2) navigateWithUnsavedChangesGuard(() => mostrarVista('bancos'))
 * 3) markUnsavedChangesAsSaved() tras guardar con éxito
 * 4) clearUnsavedChangesGuard() al abandonar editor definitivamente
 */

let unsavedGuardState = null;

function stableStringify(value) {
    return JSON.stringify(value);
}

function buildGuardSignature(getSnapshot) {
    try {
        return stableStringify(getSnapshot());
    } catch (error) {
        return null;
    }
}

/**
 * Inicializa/actualiza el guard de un editor.
 * @param {string} editorType - 'bancos' | 'juegos' | 'personalizados'
 * @param {Function} getSnapshot - Función que devuelve snapshot serializable del estado actual
 */
function setUnsavedChangesGuard(editorType, getSnapshot) {
    const initialSignature = buildGuardSignature(getSnapshot);
    unsavedGuardState = {
        editorType,
        getSnapshot,
        initialSignature
    };
}

/**
 * Limpia el guard activo.
 */
function clearUnsavedChangesGuard() {
    unsavedGuardState = null;
}

/**
 * Marca como guardado el estado actual.
 */
function markUnsavedChangesAsSaved() {
    if (!unsavedGuardState) return;
    unsavedGuardState.initialSignature = buildGuardSignature(unsavedGuardState.getSnapshot);
}

/**
 * Determina si hay cambios pendientes.
 * @returns {boolean}
 */
function hasUnsavedChanges() {
    if (!unsavedGuardState) return false;
    const currentSignature = buildGuardSignature(unsavedGuardState.getSnapshot);

    if (unsavedGuardState.initialSignature === null || currentSignature === null) {
        return false;
    }

    return currentSignature !== unsavedGuardState.initialSignature;
}

/**
 * Ejecuta acción de navegación con validación de cambios pendientes.
 * @param {Function} onContinue - Acción a ejecutar si no hay cambios o usuario confirma descarte
 */
function navigateWithUnsavedChangesGuard(onContinue) {
    if (!hasUnsavedChanges()) {
        onContinue();
        return;
    }

    mostrarModalConfirmacion(
        _t('admin.unsaved.title', null, '⚠️ Cambios sin guardar'),
        _t('admin.unsaved.msg_exit', null, 'Tienes cambios sin guardar. Si sales ahora, se perderán. ¿Quieres continuar?'),
        () => {
            clearUnsavedChangesGuard();
            onContinue();
        },
        null,
        _t('admin.unsaved.btn_exit', null, 'Salir sin guardar'),
        _t('admin.unsaved.btn_keep', null, 'Seguir editando')
    );
}

/**
 * Ejecuta una acción crítica (logout, panic, etc.) con validación previa.
 * @param {Function} onContinue - Acción a ejecutar tras confirmación
 */
function executeWithUnsavedChangesGuard(onContinue) {
    if (!hasUnsavedChanges()) {
        onContinue();
        return;
    }

    mostrarModalConfirmacion(
        _t('admin.unsaved.title', null, '⚠️ Cambios sin guardar'),
        _t('admin.unsaved.msg_navigate', null, 'Tienes cambios sin guardar. Si continúas, se perderán. ¿Quieres continuar?'),
        () => {
            clearUnsavedChangesGuard();
            onContinue();
        },
        null,
        _t('admin.unsaved.btn_continue', null, 'Continuar sin guardar'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}

/**
 * Handler para beforeunload - advierte al cerrar pestaña/ventana
 */
function handleBeforeUnload(event) {
    if (hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = '';
        return '';
    }
}

/**
 * Inicializa el listener de beforeunload para advertir al cerrar pestaña
 */
function initializeBeforeUnloadGuard() {
    window.addEventListener('beforeunload', handleBeforeUnload);
}

// Inicializar el guard de beforeunload automáticamente
if (typeof window !== 'undefined') {
    initializeBeforeUnloadGuard();
}
