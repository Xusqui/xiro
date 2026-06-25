/**
 * @fileoverview Sanitization helpers for browser-rendered HTML.
 */

export function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function sanitizeResourceUrl(value = '') {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return '';

    if (raw.startsWith('/')) {
        return escapeHtml(raw);
    }

    try {
        const parsed = new URL(raw, window.location.origin);
        const protocol = String(parsed.protocol || '').toLowerCase();
        const allowed = ['http:', 'https:', 'data:', 'blob:'];
        if (!allowed.includes(protocol)) return '';
        return escapeHtml(parsed.toString());
    } catch (_) {
        return '';
    }
}

export function encodeInlineArg(value = '') {
    return encodeURIComponent(String(value));
}
