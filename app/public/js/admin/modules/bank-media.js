// Recursos de un banco en su JSON (formato 2): todas las imágenes y audios (portada, imagen o audio
// principal, imagen del enunciado, imágenes de las opciones) viajan una sola vez en la tabla «media»
// y cada sitio que los usa lleva «media:<clave>». Al exportar se leen de /uploads; al importar cada
// clave se sube una vez con POST /api/upload/bank-media (binario) y se sustituye por la URL nueva.

const BANK_MEDIA_FORMAT_VERSION = 2;
const BANK_MEDIA_REF_PREFIX = 'media:';
const BANK_MEDIA_UPLOADS_PREFIX = '/uploads/';
const BANK_MEDIA_QUESTION_FIELDS = ['url_recurso', 'question_image_url'];

// ===== Recorrido de los sitios con recurso (sin modificar el banco recibido) =====

/** Copia del objeto con `fn` aplicada al campo, solo si es texto. */
function _mapMediaField(object, field, fn) {
    return typeof object[field] === 'string' ? { ...object, [field]: fn(object[field]) } : object;
}

function _mapMediaQuestion(question, fn) {
    let mapped = question;
    for (const field of BANK_MEDIA_QUESTION_FIELDS) mapped = _mapMediaField(mapped, field, fn);
    if (!Array.isArray(mapped.options)) return mapped;
    return { ...mapped, options: mapped.options.map(option => _mapMediaField(option, 'option_image_url', fn)) };
}

/** Banco con `fn` aplicada a cada valor de portada, recurso, imagen del enunciado e imagen de opción. */
function _mapBankMediaSlots(bank, fn) {
    const mapped = _mapMediaField(bank, 'image_url', fn);
    const questions = Array.isArray(bank.questions) ? bank.questions : [];
    return { ...mapped, questions: questions.map(question => _mapMediaQuestion(question, fn)) };
}

/** Valores distintos de esos sitios que cumplen `accept`, en orden de aparición. */
function _distinctMediaValues(bank, accept) {
    const found = new Set();
    _mapBankMediaSlots(bank, value => {
        if (accept(value)) found.add(value);
        return value;
    });
    return [...found];
}

const _isMediaRef = value => value.startsWith(BANK_MEDIA_REF_PREFIX);

// ===== Exportar e importar (con dependencias inyectables en los tests) =====

/**
 * Exportación: mete en `media` cada fichero de /uploads una sola vez y sustituye sus URL por «media:<clave>».
 * Un recurso que no se puede leer conserva su URL y se lista en `failed`.
 * @param {Object} bank - Banco en formato JSON (image_url y questions)
 * @param {{readMedia?: Function}} [deps] - readMedia(url) → {mime, data en base64}
 * @returns {Promise<{bank: Object, failed: string[]}>}
 */
async function bundleBankMedia(bank, { readMedia = readBankMedia } = {}) {
    const urls = _distinctMediaValues(bank, value => value.startsWith(BANK_MEDIA_UPLOADS_PREFIX));
    const media = {};
    const keyByUrl = new Map();
    const failed = [];
    for (const url of urls) {
        try {
            const { mime, data } = await readMedia(url);
            const key = `m${keyByUrl.size + 1}`;
            media[key] = { mime, data };
            keyByUrl.set(url, key);
        } catch (err) {
            console.warn('No se pudo incluir el recurso en el JSON', url, err);
            failed.push(url);
        }
    }
    const mapped = _mapBankMediaSlots(bank, value =>
        keyByUrl.has(value) ? BANK_MEDIA_REF_PREFIX + keyByUrl.get(value) : value
    );
    return { bank: { ...mapped, format_version: BANK_MEDIA_FORMAT_VERSION, media }, failed };
}

/**
 * Importación: sube cada clave de `media` una sola vez y sustituye «media:<clave>» por la URL nueva.
 * Una clave que falta o cuya subida falla deja `null` en todos sus sitios y se lista en `failed`;
 * nunca queda una referencia «media:» en el resultado, que además no lleva la tabla `media`.
 * @param {Object} bank - Banco leído del JSON
 * @param {{upload?: Function}} [deps] - upload({mime, data}) → URL de /uploads
 * @returns {Promise<{bank: Object, failed: string[]}>}
 */
async function restoreBankMedia(bank, { upload = uploadBankMedia } = {}) {
    const table = bank.media && typeof bank.media === 'object' ? bank.media : {};
    const keys = _distinctMediaValues(bank, _isMediaRef).map(ref => ref.slice(BANK_MEDIA_REF_PREFIX.length));
    const urlByKey = new Map();
    const failed = [];
    for (const key of keys) {
        try {
            if (!Object.hasOwn(table, key)) throw new Error('La clave no está en media');
            urlByKey.set(key, await upload(table[key]));
        } catch (err) {
            console.warn('No se pudo subir el recurso del JSON', key, err);
            failed.push(key);
        }
    }
    const restored = _mapBankMediaSlots(bank, value =>
        _isMediaRef(value) ? (urlByKey.get(value.slice(BANK_MEDIA_REF_PREFIX.length)) ?? null) : value
    );
    delete restored.media;
    return { bank: restored, failed };
}

// ===== Lectura y subida reales =====

function _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/** Lee un fichero de /uploads como {mime, data en base64}. */
async function readBankMedia(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return { mime: blob.type, data: await _blobToBase64(blob) };
}

function _base64ToBlob({ mime, data }) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

/** Sube un recurso {mime, data} como fichero binario y devuelve la URL de /uploads. */
async function uploadBankMedia(entry) {
    const form = new FormData();
    form.append('file', _base64ToBlob(entry), 'media');
    const response = await fetchWithAuth('/api/upload/bank-media', { method: 'POST', body: form });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body.url;
}
