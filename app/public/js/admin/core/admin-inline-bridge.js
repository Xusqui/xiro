// Puente de atributos data-admin-click / data-admin-change / data-admin-input: ejecuta
// llamadas a funciones globales y asignaciones simples, usando admin-inline-parser.js.

let _adminInlineBridgeReady = false;

function _runAdminInlineAssignment(statement, element) {
    const optionAssignment = statement.match(/^([A-Za-z_$][\w$]*)\[(\d+)\]\.options\[(\d+)\]\.([A-Za-z_$][\w$]*)\s*=\s*(.+)$/);
    if (optionAssignment) {
        const [, rootName, rootIdxRaw, optionIdxRaw, property, expression] = optionAssignment;
        const rootCollection = globalThis[rootName];
        const rootIdx = Number(rootIdxRaw);
        const optionIdx = Number(optionIdxRaw);

        if (!Array.isArray(rootCollection) || !rootCollection[rootIdx]?.options?.[optionIdx]) {
            return false;
        }

        const value = _evalAdminInlineValue(expression, element);
        if (typeof value === 'undefined') {
            return false;
        }

        rootCollection[rootIdx].options[optionIdx][property] = value;
        return true;
    }

    const rootAssignment = statement.match(/^([A-Za-z_$][\w$]*)\[(\d+)\]\.([A-Za-z_$][\w$]*)\s*=\s*(.+)$/);
    if (!rootAssignment) {
        return false;
    }

    const [, rootName, rootIdxRaw, property, expression] = rootAssignment;
    const rootCollection = globalThis[rootName];
    const rootIdx = Number(rootIdxRaw);

    if (!Array.isArray(rootCollection) || !rootCollection[rootIdx]) {
        return false;
    }

    const value = _evalAdminInlineValue(expression, element);
    if (typeof value === 'undefined') {
        return false;
    }

    rootCollection[rootIdx][property] = value;
    return true;
}

function _runAdminInlineCall(statement, event, element) {
    const removeMatch = statement.match(/^document\.getElementById\((['"])(.+?)\1\)\.remove\(\)$/);
    if (removeMatch) {
        const modal = document.getElementById(removeMatch[2]);
        if (modal && typeof modal.remove === 'function') {
            modal.remove();
        }
        return true;
    }

    if (statement === 'navigateWithUnsavedChangesGuard(() => renderVistaTrivial())') {
        if (typeof navigateWithUnsavedChangesGuard === 'function' && typeof renderVistaTrivial === 'function') {
            navigateWithUnsavedChangesGuard(() => renderVistaTrivial());
        }
        return true;
    }

    const callMatch = statement.match(/^([\p{L}_$][\p{L}\p{N}_$]*)\((.*)\)$/su);
    if (!callMatch) {
        return false;
    }

    const [, functionName, argSource] = callMatch;
    const handler = globalThis[functionName];
    if (typeof handler !== 'function') {
        return false;
    }

    const args = argSource.trim()
        ? _splitAdminInlineTopLevel(argSource, ',').map((token) => _evalAdminInlineArg(token, event, element))
        : [];

    handler(...args);
    return true;
}

function _runDelegatedInlineExpression(code, event, element) {
    if (!code) return;
    try {
        const statements = _splitAdminInlineTopLevel(code, ';');
        for (const statement of statements) {
            if (!statement) continue;
            if (_runAdminInlineAssignment(statement, element)) continue;
            if (_runAdminInlineCall(statement, event, element)) continue;
            console.warn('[admin-inline-bridge] Expresión no soportada por bridge seguro:', statement);
        }
    } catch (error) {
        console.error('[admin-inline-bridge] Error ejecutando expresion delegada:', error, code);
    }
}

function setupAdminInlineAttributeBridge() {
    if (_adminInlineBridgeReady) return;
    _adminInlineBridgeReady = true;

    document.addEventListener('click', (event) => {
        const element = event.target.closest('[data-admin-click]');
        if (!element) return;
        _runDelegatedInlineExpression(element.getAttribute('data-admin-click'), event, element);
    });

    document.addEventListener('change', (event) => {
        const element = event.target.closest('[data-admin-change]');
        if (!element) return;
        _runDelegatedInlineExpression(element.getAttribute('data-admin-change'), event, element);
    });

    document.addEventListener('input', (event) => {
        const element = event.target.closest('[data-admin-input]');
        if (!element) return;
        _runDelegatedInlineExpression(element.getAttribute('data-admin-input'), event, element);
    });
}
