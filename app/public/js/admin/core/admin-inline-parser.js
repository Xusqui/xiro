// Lectura de las expresiones de data-admin-click / data-admin-change / data-admin-input
// (sin eval: la CSP no lo permite). La ejecución está en admin-inline-bridge.js.

function _splitAdminInlineTopLevel(source, delimiter) {
    const chunks = [];
    let current = '';
    let depth = 0;
    let quote = null;
    let escaped = false;

    for (const char of source) {
        if (quote) {
            current += char;
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === '\\') {
                escaped = true;
                continue;
            }
            if (char === quote) {
                quote = null;
            }
            continue;
        }

        if (char === '\'' || char === '"') {
            quote = char;
            current += char;
            continue;
        }

        if (char === '(' || char === '[' || char === '{') {
            depth += 1;
            current += char;
            continue;
        }

        if (char === ')' || char === ']' || char === '}') {
            depth = Math.max(0, depth - 1);
            current += char;
            continue;
        }

        if (char === delimiter && depth === 0) {
            chunks.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    if (current.trim()) {
        chunks.push(current.trim());
    }

    return chunks;
}

function _parseAdminInlineString(raw) {
    const quote = raw[0];
    if ((quote !== '\'' && quote !== '"') || raw[raw.length - 1] !== quote) {
        return null;
    }

    let result = '';
    for (let idx = 1; idx < raw.length - 1; idx += 1) {
        const char = raw[idx];
        if (char !== '\\') {
            result += char;
            continue;
        }

        idx += 1;
        if (idx >= raw.length - 1) break;
        const next = raw[idx];
        if (next === 'n') result += '\n';
        else if (next === 't') result += '\t';
        else if (next === 'r') result += '\r';
        else result += next;
    }

    return result;
}

// Expresiones fijas que el HTML del panel usa como argumento (p. ej.
// data-admin-change="setTiempo(0, Math.max(5, Math.min(120, parseInt(this.value) || 30)))").
// Se interpretan sin eval: cada una tiene aquí su implementación.
const _intOr = (fallback) => (value) => {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};
const _clamp = (min, max, value) => Math.max(min, Math.min(max, value));

const ADMIN_INLINE_VALUES = {
    'this.value': (value) => value,
    'this.value - 1': (value) => Number(value) - 1,
    'parseInt(this.value)': (value) => parseInt(value, 10),
    'parseInt(this.value) || null': _intOr(null),
    'parseInt(this.value) || 0': _intOr(0),
    'parseInt(this.value) || 30': _intOr(30),
    'Number(this.value) || 25': (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed !== 0 ? parsed : 25;
    },
    'this.value === \'\' ? null : (Number(this.value) || null)': (value) => {
        if (value === '') return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
    },
    'Math.max(5, Math.min(120, parseInt(this.value) || 30))': (value) => _clamp(5, 120, _intOr(30)(value)),
    'Math.max(1, parseInt(this.value) || 0)': (value) => Math.max(1, _intOr(0)(value)),
    'Math.max(1, Math.min(100, parseInt(this.value) || 10))': (value) => _clamp(1, 100, _intOr(10)(value)),
    'Math.max(0, Math.min(100, parseInt(this.value) || 10))': (value) => _clamp(0, 100, _intOr(10)(value)),
    'Math.max(0, Math.min(100, parseInt(this.value) || 20))': (value) => _clamp(0, 100, _intOr(20)(value))
};

const ADMIN_INLINE_LITERALS = { null: null, true: true, false: false };

function _evalAdminInlineValue(expression, element) {
    const normalized = expression.replace(/\s+/g, ' ').trim();
    const inputValue = element?.value ?? '';

    if (Object.hasOwn(ADMIN_INLINE_VALUES, normalized)) {
        return ADMIN_INLINE_VALUES[normalized](inputValue);
    }
    if (normalized.startsWith('this.value.replace(') && normalized.endsWith('.toUpperCase()')) {
        return String(inputValue)
            .replace(/[^A-Za-zÁáÉéÍíÓóÚúÜüÑñ]/g, '')
            .toUpperCase();
    }
    if (Object.hasOwn(ADMIN_INLINE_LITERALS, normalized)) return ADMIN_INLINE_LITERALS[normalized];
    if (/^-?\d+(\.\d+)?$/.test(normalized)) return Number(normalized);

    const parsedString = _parseAdminInlineString(normalized);
    return parsedString !== null ? parsedString : undefined;
}

function _evalAdminInlineArg(token, event, element) {
    const normalized = token.trim();

    if (normalized === 'event') return event;
    if (normalized === 'this') return element;

    const value = _evalAdminInlineValue(normalized, element);
    return typeof value === 'undefined' ? undefined : value;
}
