/**
 * @fileoverview Estado de «Completa la frase» en el jugador: lo escrito en cada hueco,
 * las letras destapadas por pistas, los huecos bloqueados por el equipo y la frase.
 * Se copia en sessionStorage para no perder lo escrito si el móvil se desconecta y
 * vuelve a la misma pregunta.
 *
 * Modelo por hueco i (longitud lengths[i]):
 *  - fixed[i]  { posición: letra } letras de pista (no se pueden borrar)
 *  - typed[i]  letras escritas por el jugador, que ocupan en orden las posiciones libres
 *  - locked[i] palabra ya validada por el servidor (equipos) o null
 * La palabra que se ve y se envía es la fusión de las tres (mergedWord).
 */

// { key, text, lengths, typed: string[], fixed: Object[], hints: number[], locked: (string|null)[] }
let current = null;

function load(key) {
    try {
        const parsed = JSON.parse(sessionStorage.getItem(key) || 'null');
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function save() {
    if (!current) return;
    try {
        const { typed, fixed, hints, locked } = current;
        sessionStorage.setItem(current.key, JSON.stringify({ typed, fixed, hints, locked }));
    } catch {
        // Sin sessionStorage (modo privado): el progreso solo vive en memoria
    }
}

/** Empieza (o retoma tras reconectar) la pregunta identificada por `key`. */
export function startFillBlanks(key, text, lengths) {
    const saved = load(key) || {};
    const n = lengths.length;
    const list = (value, fill) => Array.from({ length: n }, (_, i) => (Array.isArray(value) && value[i] !== undefined ? value[i] : fill()));
    current = {
        key,
        text,
        lengths: [...lengths],
        typed: list(saved.typed, () => ''),
        fixed: list(saved.fixed, () => ({})),
        hints: list(saved.hints, () => 0),
        locked: list(saved.locked, () => null)
    };
    return current;
}

export function hasActiveFillBlanks() {
    return current !== null;
}

export function getFillBlanksState() {
    return current;
}

export function clearFillBlanksState() {
    current = null;
}

/** Posiciones libres (sin letra de pista) del hueco */
export function freeCount(i) {
    if (!current) return 0;
    return current.lengths[i] - Object.keys(current.fixed[i]).length;
}

/** Guarda lo escrito (solo letras, en mayúsculas, hasta las posiciones libres) */
export function setTyped(i, letters) {
    if (!current || current.locked[i]) return;
    current.typed[i] = String(letters || '').toUpperCase().slice(0, freeCount(i));
    save();
}

/** Letra destapada por una pista (propia o del equipo) */
export function addHintLetter(i, position, letter, hintCount) {
    if (!current || !current.fixed[i]) return;
    // La letra tecleada que ocupaba esa posición se retira (no se desplaza a la siguiente casilla)
    if (window.XiroFillBlanks && !current.fixed[i][position]) {
        current.typed[i] = window.XiroFillBlanks.dropTypedAt(current.lengths[i], current.fixed[i], current.typed[i], position);
    }
    current.fixed[i][position] = String(letter || '').toUpperCase();
    current.hints[i] = Math.max(current.hints[i], Number(hintCount) || Object.keys(current.fixed[i]).length);
    current.typed[i] = current.typed[i].slice(0, freeCount(i));
    save();
}

/** Hueco resuelto (validado por el servidor en equipos) */
export function lockBlank(i, word) {
    if (!current) return;
    current.locked[i] = String(word || '').toUpperCase();
    save();
}

export function isLocked(i) {
    return Boolean(current?.locked[i]);
}

/**
 * Palabra que se ve en el hueco: las letras de pista en su sitio y las escritas en
 * las posiciones libres, en orden. Posición sin letra → ''.
 * @returns {string[]} una entrada por posición
 */
export function mergedLetters(i) {
    if (!current) return [];
    if (current.locked[i]) return [...current.locked[i]];
    const typed = [...current.typed[i]];
    return Array.from({ length: current.lengths[i] }, (_, pos) => current.fixed[i][pos] || typed.shift() || '');
}

export function mergedWord(i) {
    return mergedLetters(i).join('');
}

/** ¿Todas las posiciones tienen letra? */
export function isComplete(i) {
    return Boolean(current) && (Boolean(current.locked[i]) || current.typed[i].length === freeCount(i));
}

/** Posición donde cae la siguiente letra (-1 si el hueco está lleno o bloqueado) */
export function activePosition(i) {
    if (!current || current.locked[i] || isComplete(i)) return -1;
    return mergedLetters(i).findIndex((letter, pos) => !letter && !current.fixed[i][pos]);
}

/** Palabras de todos los huecos, para enviar ('' donde no hay nada) */
export function getWords() {
    if (!current) return [];
    return current.lengths.map((_, i) => mergedWord(i));
}
