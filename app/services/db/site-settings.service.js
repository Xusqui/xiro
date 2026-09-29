'use strict';

const { pool } = require('../../config/database');

function _normalizeUpdatedAtMs(updatedAtValue) {
    if (!updatedAtValue) return 0;
    const updatedAtMs = new Date(updatedAtValue).getTime();
    return Number.isFinite(updatedAtMs) ? updatedAtMs : 0;
}

async function getSiteLicenseWithMeta(queryable = pool) {
    await queryable.query(
        'INSERT INTO site_settings (id, license) VALUES (1, \'\') ON CONFLICT (id) DO NOTHING',
        []
    );

    const result = await queryable.query(
        'SELECT license, updated_at FROM site_settings WHERE id = 1 LIMIT 1',
        []
    );

    const row = result.rows[0] || {};
    return {
        license: String(row.license || '').trim(),
        updatedAtMs: _normalizeUpdatedAtMs(row.updated_at)
    };
}

async function getSiteLicense(queryable = pool) {
    const licenseState = await getSiteLicenseWithMeta(queryable);
    return licenseState.license;
}

async function setSiteLicense(license, queryable = pool) {
    const normalizedLicense = String(license || '').trim();
    const result = await queryable.query(
        `INSERT INTO site_settings (id, license)
         VALUES (1, $1)
         ON CONFLICT (id)
         DO UPDATE SET license = EXCLUDED.license, updated_at = NOW()
         RETURNING license`,
        [normalizedLicense]
    );

    return String(result.rows[0]?.license || normalizedLicense).trim();
}

module.exports = {
    getSiteLicense,
    getSiteLicenseWithMeta,
    setSiteLicense
};
