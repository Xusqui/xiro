/**
 * @fileoverview Servicio de dominio para preguntas tipo word_search (Sopa de letras)
 * Generación de la rejilla, lectura de selecciones y cálculo de puntuación.
 *
 * ARQUITECTURA: Domain Service (Clean Architecture)
 * - Funciones puras y testeables (el azar se inyecta con `rng`)
 * - Sin dependencias de infraestructura
 *
 * Modelo: las palabras viven en options[].option_text (orden = order_index).
 * La rejilla (ws_grid, array de filas de texto) y las posiciones (ws_placements)
 * se generan al arrancar la partida; las posiciones NUNCA se envían al jugador.
 */

const { SCORING, WORD_SEARCH } = require('../../config/game-constants');

// 8 direcciones [dr, dc]: → ← ↓ ↑ ↘ ↖ ↙ ↗
const DIRECTIONS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
const FILLER_ALPHABET = 'ABCDEFGHIJLMNOPRSTUVZ';
const MAX_LAYOUT_ATTEMPTS = 40;
const MAX_FILL_ATTEMPTS = 25;
// Marcas diacríticas combinantes (U+0300-U+036F) y la tilde de la Ñ (U+0303) tras NFD.
// Con fromCharCode para que se vean en el código (como literales serían invisibles).
const COMBINING_MARKS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');
const COMBINING_TILDE = String.fromCharCode(0x303);

/**
 * Normaliza una palabra: mayúsculas, sin diacríticos (Ç→C, Ü→U…), conserva Ñ,
 * descarta todo lo que no sea letra A-Z/Ñ.
 * @param {string} word
 * @returns {string}
 */
function normalizeSearchWord(word) {
    if (!word) return '';
    // NFD separa la tilde de la Ñ: se recompone antes de quitar el resto de diacríticos
    return String(word)
        .normalize('NFD')
        .replaceAll(`N${COMBINING_TILDE}`, 'Ñ')
        .replaceAll(`n${COMBINING_TILDE}`, 'ñ')
        .replace(COMBINING_MARKS, '')
        .toUpperCase()
        .replace(/[^A-ZÑ]/g, '');
}

/** Palabras normalizadas de una pregunta, en el orden de sus opciones */
function getQuestionWords(question) {
    const options = Array.isArray(question?.options) ? question.options : [];
    return options.map(opt => normalizeSearchWord(opt?.option_text ?? opt?.optionText ?? opt?.text));
}

function randomItem(list, rng) {
    return list[Math.floor(rng() * list.length)];
}

/** Posiciones válidas para `word` en la dirección dada sobre la matriz `cells` */
function candidatesFor(word, [dr, dc], cells, size) {
    const result = [];
    const last = word.length - 1;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const endR = row + dr * last;
            const endC = col + dc * last;
            if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;
            let fits = true;
            let newCells = 0;
            for (let i = 0; i <= last && fits; i++) {
                const current = cells[row + dr * i][col + dc * i];
                if (current === null) newCells++;
                else if (current !== word[i]) fits = false;
            }
            // Exigir al menos una celda nueva: una palabra no puede quedar tapada por otra
            if (fits && newCells > 0) result.push({ row, col });
        }
    }
    return result;
}

/** Intenta colocar todas las palabras; devuelve las posiciones o null */
function layoutWords(words, cells, size, rng) {
    const placements = [];
    for (const word of words) {
        const options = DIRECTIONS
            .map(dir => ({ dir, spots: candidatesFor(word, dir, cells, size) }))
            .filter(o => o.spots.length > 0);
        if (options.length === 0) return null;

        const { dir: [dr, dc], spots } = randomItem(options, rng);
        const { row, col } = randomItem(spots, rng);
        [...word].forEach((letter, i) => { cells[row + dr * i][col + dc * i] = letter; });
        placements.push({ word, row, col, dr, dc });
    }
    return placements;
}

/**
 * Cuenta las apariciones de `word` en la rejilla (8 direcciones).
 * Un palíndromo cuenta dos veces (se lee igual en ambos sentidos).
 * @param {Array<string|string[]>} grid
 * @param {string} word
 * @returns {number}
 */
function countOccurrences(grid, word) {
    let count = 0;
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            count += DIRECTIONS.filter(dir => matchesAt(grid, word, r, c, dir)).length;
        }
    }
    return count;
}

/** ¿Se lee `word` desde (r, c) en la dirección [dr, dc]? Fuera de la rejilla = no */
function matchesAt(grid, word, r, c, [dr, dc]) {
    for (let i = 0; i < word.length; i++) {
        const row = grid[r + dr * i];
        if (!row || row[c + dc * i] !== word[i]) return false;
    }
    return true;
}

/** Rellena huecos sin crear copias accidentales; devuelve filas o null */
function fillGrid(cells, words, rng) {
    // Letras raras de las palabras (Ñ, K, X…) también en el relleno: si no, delatan la palabra
    const extra = [...new Set(words.join(''))].filter(l => !FILLER_ALPHABET.includes(l)).join('');
    const pool = FILLER_ALPHABET + extra;
    const expected = words.map(w => countOccurrences(cells, w));
    for (let attempt = 0; attempt < MAX_FILL_ATTEMPTS; attempt++) {
        const filled = cells.map(row => row.map(letter => letter ?? pool[Math.floor(rng() * pool.length)]));
        if (words.every((w, i) => countOccurrences(filled, w) === expected[i])) {
            return filled.map(row => row.join(''));
        }
    }
    return null;
}

/**
 * Genera una sopa de letras con todas las palabras.
 * @param {string[]} rawWords
 * @param {{ size?: number, rng?: Function }} [opts]
 * @returns {{ grid: string[], placements: Array<{word,row,col,dr,dc}> }}
 * @throws {Error} WORD_SEARCH_NO_WORDS | WORD_SEARCH_WORD_TOO_LONG | WORD_SEARCH_PLACEMENT_FAILED
 */
function generateGrid(rawWords, { size = WORD_SEARCH.GRID_SIZE, rng = Math.random } = {}) {
    const words = (rawWords || []).map(normalizeSearchWord);
    if (words.length === 0 || words.some(w => !w)) throw new Error('WORD_SEARCH_NO_WORDS');
    if (words.some(w => w.length > size)) throw new Error('WORD_SEARCH_WORD_TOO_LONG');

    // Las más largas primero: son las que menos huecos encuentran
    const byLength = [...words].sort((a, b) => b.length - a.length);
    for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt++) {
        const cells = Array.from({ length: size }, () => Array(size).fill(null));
        const placements = layoutWords(byLength, cells, size, rng);
        if (!placements) continue;
        const grid = fillGrid(cells, words, rng);
        if (grid) return { grid, placements };
    }
    throw new Error('WORD_SEARCH_PLACEMENT_FAILED');
}

/**
 * Prepara una pregunta word_search para jugarla: opciones por order_index,
 * palabras normalizadas (ws_words), rejilla (ws_grid) y posiciones (ws_placements).
 * No lanza: con datos inválidos deja ws_grid a null (la pregunta no puntúa).
 * @param {Object} question
 * @param {Function} [rng]
 * @returns {Object}
 */
function prepareWordSearchQuestion(question, rng = Math.random) {
    const options = [...(question?.options || [])]
        .sort((a, b) => (a.order_index ?? a.orderIndex ?? 0) - (b.order_index ?? b.orderIndex ?? 0));
    const prepared = { ...question, options, ws_words: getQuestionWords({ options }) };
    try {
        const { grid, placements } = generateGrid(prepared.ws_words, { rng });
        return { ...prepared, ws_grid: grid, ws_placements: placements };
    } catch {
        return { ...prepared, ws_grid: null, ws_placements: [] };
    }
}

/**
 * Lee las letras de una selección recta (horizontal, vertical o diagonal 45°).
 * @param {string[]} grid
 * @param {{r1:number,c1:number,r2:number,c2:number}} sel
 * @returns {string|null} Letras de inicio a fin, o null si la selección no es válida
 */
function readSelection(grid, sel) {
    if (!Array.isArray(grid) || !sel || typeof sel !== 'object') return null;
    const { r1, c1, r2, c2 } = sel;
    const size = grid.length;
    const inside = v => Number.isInteger(v) && v >= 0 && v < size;
    if (![r1, c1, r2, c2].every(inside)) return null;

    const dr = r2 - r1;
    const dc = c2 - c1;
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;

    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    let letters = '';
    for (let i = 0; i <= steps; i++) {
        letters += grid[r1 + Math.sign(dr) * i][c1 + Math.sign(dc) * i];
    }
    return letters;
}

function toIndexSet(list) {
    return new Set((Array.isArray(list) ? list : []).map(Number).filter(Number.isInteger));
}

/**
 * Índice de la palabra que forma una selección (en cualquier sentido), o -1.
 * @param {Object} question - Pregunta preparada (ws_grid)
 * @param {{r1:number,c1:number,r2:number,c2:number}} sel
 * @param {boolean[]} [skip] - Palabras que no hay que volver a buscar
 * @returns {number}
 */
function matchSelection(question, sel, skip = []) {
    const letters = readSelection(question?.ws_grid, sel);
    if (!letters) return -1;
    const reversed = [...letters].reverse().join('');
    return getQuestionWords(question).findIndex((w, i) => !skip[i] && (w === letters || w === reversed));
}

/**
 * Bonus de tiempo proporcional a lo conseguido: cada palabra gana, como un
 * acierto de quiz, hasta MAX_TIME_BONUS según el tiempo que quedaba al enviar
 * (una palabra con pista, la mitad). Terminar pronto con pocas palabras no da
 * el bonus completo.
 */
function wordSearchTimeBonus(basePoints, timeElapsed, questionTimeLimit) {
    if (!(basePoints > 0) || !(questionTimeLimit > 0) || !Number.isFinite(timeElapsed)) return 0;
    const timeLeftRatio = Math.max(0, questionTimeLimit - Math.max(0, timeElapsed)) / questionTimeLimit;
    return Math.round(basePoints * (SCORING.MAX_TIME_BONUS / SCORING.BASE_POINTS) * timeLeftRatio * 100) / 100;
}

/**
 * Evalúa las selecciones del jugador: BASE_POINTS por palabra encontrada más
 * el bonus de tiempo (wordSearchTimeBonus).
 * Solo se evalúan tantas selecciones como palabras (anti-abuso).
 * En equipos, `sharedFound` son las palabras que ya encontró el equipo (validadas
 * en el servidor) y `hintedWords`, las pistas del equipo: valen para todos.
 * @param {{ question: Object, found: Array, hintedWords?: number[], sharedFound?: number[],
 *           timeElapsed?: number, questionTimeLimit?: number }} params
 * @returns {{ isCorrect, pointsEarned, isSurvey, details }}
 */
function processWordSearchAnswer({ question, found, hintedWords = [], sharedFound = [], timeElapsed, questionTimeLimit }) {
    const hinted = toIndexSet(hintedWords);
    const shared = toIndexSet(sharedFound);
    const words = getQuestionWords(question);
    const wordsFound = words.map((_, i) => shared.has(i));
    const grid = question?.ws_grid;
    const selections = Array.isArray(found) && Array.isArray(grid) ? found.slice(0, words.length) : [];

    selections.forEach(sel => {
        const index = matchSelection(question, sel, wordsFound);
        if (index !== -1) wordsFound[index] = true;
    });

    const foundCount = wordsFound.filter(Boolean).length;
    // Palabra encontrada con pista: la mitad de puntos
    const basePoints = wordsFound.reduce((sum, isFound, i) => {
        if (!isFound) return sum;
        return sum + (hinted.has(i) ? SCORING.BASE_POINTS / 2 : SCORING.BASE_POINTS);
    }, 0);
    const timeBonus = wordSearchTimeBonus(basePoints, timeElapsed, questionTimeLimit);
    return {
        isCorrect: words.length > 0 && foundCount === words.length,
        pointsEarned: Math.round((basePoints + timeBonus) * 100) / 100,
        isSurvey: false,
        details: {
            strategy: 'word_search',
            basePoints,
            timeBonus,
            foundCount,
            totalWords: words.length,
            words,
            wordsFound,
            hintedWords: words.map((_, i) => hinted.has(i)),
            foundWords: words.filter((_, i) => wordsFound[i])
        }
    };
}

/**
 * Casilla donde empieza la palabra `wordIndex` (pista a demanda), o null.
 * @param {Object} question - Pregunta preparada (ws_placements)
 * @param {number} wordIndex - Índice en el orden de las opciones
 * @returns {{row: number, col: number}|null}
 */
function getWordStart(question, wordIndex) {
    const word = getQuestionWords(question)[wordIndex];
    if (!word) return null;
    const placement = (question?.ws_placements || []).find(p => p.word === word);
    return placement ? { row: placement.row, col: placement.col } : null;
}

/**
 * Acción de racha (mismo criterio que matching):
 * todas → true (+1) · ≥ mitad → null (se mantiene) · < mitad → false (a 0)
 */
function getWordSearchStreakAction(foundCount, totalWords) {
    if (totalWords === 0) return null;
    if (foundCount === totalWords) return true;
    if (foundCount < totalWords / 2) return false;
    return null;
}

module.exports = {
    WORD_SEARCH,
    DIRECTIONS,
    normalizeSearchWord,
    getQuestionWords,
    generateGrid,
    prepareWordSearchQuestion,
    countOccurrences,
    readSelection,
    matchSelection,
    processWordSearchAnswer,
    wordSearchTimeBonus,
    getWordStart,
    getWordSearchStreakAction
};
