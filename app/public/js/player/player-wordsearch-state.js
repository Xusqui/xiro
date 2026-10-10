/**
 * @fileoverview Estado de la Sopa de letras en el jugador: palabras de la
 * pregunta actual y selecciones acertadas. Se copia en sessionStorage para no
 * perder lo encontrado si el móvil se desconecta y vuelve a la misma pregunta.
 */

// { key, words, found: [{ r1, c1, r2, c2, index }], hints: [{ index, row, col }] }
let current = null;

function loadList(key) {
    try {
        const parsed = JSON.parse(sessionStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveList(key, list) {
    try {
        sessionStorage.setItem(key, JSON.stringify(list));
    } catch {
        // Sin sessionStorage (modo privado): el progreso solo vive en memoria
    }
}

function saveProgress() {
    saveList(current.key, current.found);
}

/** Empieza (o retoma tras reconectar) la sopa de la pregunta identificada por `key`. */
export function startWordSearch(key, words) {
    current = { key, words, found: loadList(key), hints: loadList(`${key}:hints`) };
    return current;
}

/** Pista recibida del servidor para la palabra `index` (empieza en row, col). */
export function addHint(index, row, col) {
    if (!current || current.hints.some(h => h.index === index)) return;
    current.hints.push({ index, row, col });
    saveList(`${current.key}:hints`, current.hints);
}

export function hasHint(index) {
    return !!current && current.hints.some(h => h.index === index);
}

export function hasActiveWordSearch() {
    return current !== null;
}

/** true en la posición de cada palabra ya encontrada */
export function getFoundFlags() {
    if (!current) return [];
    const flags = current.words.map(() => false);
    current.found.forEach(sel => { flags[sel.index] = true; });
    return flags;
}

export function addFoundWord(selection) {
    if (!current) return;
    current.found.push(selection);
    saveProgress();
}

/** Selecciones para el servidor (solo coordenadas; él vuelve a leer las letras). */
export function getFoundSelections() {
    if (!current) return [];
    return current.found.map(({ r1, c1, r2, c2 }) => ({ r1, c1, r2, c2 }));
}

export function clearWordSearchState() {
    current = null;
}
