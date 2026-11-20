// Campos de «Toca la imagen» (hotspot) en el admin: API ↔ editor (bank-question-mapping.js) y
// JSON de exportación/importación (question-format.js). En el JSON van con los nombres de la BD;
// la imagen incrustada (image_data) la añaden y la recuperan las funciones de hotspot-json.js.

/** Área guardada (JSONB o texto) → objeto del editor, o null si no es válida. */
function _hotspotAreaOf(raw) {
    return window.XiroHotspot ? window.XiroHotspot.parseArea(raw) : null;
}

/** API → editor: área, tolerancia y puntos (en hotspot) y crédito de la imagen (en todos). */
function hotspotFieldsFromApi(q, questionType) {
    const credit = { imageCredit: q.image_credit || null };
    if (questionType !== 'hotspot') return credit;
    return {
        ...credit,
        maxPoints: q.max_points ?? null,
        hotspotArea: _hotspotAreaOf(q.hotspot_area),
        hotspotTolerance: q.hotspot_tolerance ?? null
    };
}

/** Editor → guardado. Fuera de hotspot, área y tolerancia van a null. */
function hotspotFieldsForSave(q) {
    const credit = { imageCredit: q.imageCredit || null };
    if (q.type !== 'hotspot') return { ...credit, hotspotArea: null, hotspotTolerance: null };
    return {
        ...credit,
        maxPoints: Number(q.maxPoints) || null,
        hotspotArea: q.hotspotArea || null,
        hotspotTolerance: Number(q.hotspotTolerance) || null
    };
}

/** Exportación: campos del tipo con los nombres de la BD. */
function hotspotFieldsForExport(q) {
    return {
        max_points: q.maxPoints ?? q.max_points ?? null,
        hotspot_area: _hotspotAreaOf(q.hotspotArea ?? q.hotspot_area),
        hotspot_tolerance: q.hotspotTolerance ?? q.hotspot_tolerance ?? null,
        image_credit: q.imageCredit ?? q.image_credit ?? null
    };
}

/** Importación (JSON exportado o resultado de la IA) → campos del editor. */
function hotspotFieldsForImport(q) {
    return {
        maxPoints: q.maxPoints ?? q.max_points ?? null,
        hotspotArea: _hotspotAreaOf(q.hotspotArea ?? q.hotspot_area),
        hotspotTolerance: q.hotspotTolerance ?? q.hotspot_tolerance ?? null,
        imageCredit: q.imageCredit ?? q.image_credit ?? null,
        imageData: q.image_data || null,
        options: []
    };
}
