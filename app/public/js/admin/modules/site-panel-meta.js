/* ===== LICENSE PANEL: META/HELPERS ===== */

const _LICENSE_STATUS_FIELDS = [
    String.fromCharCode(118, 97, 108, 105, 100),
    String.fromCharCode(101, 120, 112, 105, 114, 101, 115, 65, 116),
    String.fromCharCode(114, 101, 97, 115, 111, 110)
];

function _licenseField(data, fieldIndex, fallback = null) {
    if (!data || typeof data !== 'object') return fallback;
    const key = _LICENSE_STATUS_FIELDS[fieldIndex];
    return data[key] !== undefined ? data[key] : fallback;
}

function _formatLicenseExpiry(expiryValue) {
    return _formatAdminDate(expiryValue, { withTime: true });
}
