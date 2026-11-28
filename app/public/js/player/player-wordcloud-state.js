/**
 * @fileoverview «Nube de palabras» en el móvil: máximo de palabras y palabras enviadas de la
 * pregunta en curso, el envío único del botón Enviar, la interpretación de la respuesta del
 * servidor y los avisos de rechazo. El jugador rellena hasta N casillas y el botón manda todas las
 * rellenadas en un solo mensaje: con eso queda como terminado, aunque no haya usado todas, y pasa
 * a ver la nube en directo. Sin imports: usa los núcleos globales (core/word-cloud-text.js y
 * core/word-cloud-view.js). El cupo y las repetidas los decide el servidor.
 */

// Fallos de red o del servidor: no se rechazó nada, se puede volver a pulsar Enviar
const RETRY_REASONS = ['server-error', 'rate-limited', 'wordcloud-unavailable'];

const NOTICES = {
    'duplicate-word': { key: 'player.wordcloud.duplicate', fallback: 'Ya enviaste esa palabra' },
    'word-not-allowed': { key: 'player.wordcloud.not_allowed', fallback: 'Esa palabra no está permitida' },
    'invalid-word': { key: 'player.wordcloud.invalid', fallback: 'Escribe una palabra válida (máximo 20 caracteres)' },
    'word-too-long': { key: 'player.wordcloud.invalid', fallback: 'Escribe una palabra válida (máximo 20 caracteres)' },
    'game-closed': { key: 'player.wordcloud.closed', fallback: 'Ya no se admiten palabras' },
    nothing: { key: 'player.wordcloud.nothing', fallback: 'Escribe al menos una palabra' },
    'some-rejected': {
        key: 'player.wordcloud.some_rejected',
        fallback: 'Algunas palabras no se enviaron (repetidas o no permitidas)'
    },
    'already-finished': { key: 'player.wordcloud.already_finished', fallback: 'Ya enviaste tus palabras' }
};
const GENERIC_NOTICE = { key: 'player.wordcloud.error', fallback: 'No se pudo enviar la palabra. Inténtalo de nuevo' };

let _maxWords = 1;
let _sentWords = [];
let _finished = false;

/** Nueva pregunta: fija su máximo (un valor no válido cuenta como 1) y olvida lo enviado. */
export function startWordCloud(maxWords) {
    _maxWords = window.XiroWordCloudView.remaining(maxWords, 0);
    _sentWords = [];
    _finished = false;
}

/** @returns {number} Palabras que el jugador puede enviar como máximo (casillas que se le ofrecen). */
export function getWordCloudMaxWords() {
    return _maxWords;
}

/** @returns {string[]} Palabras que el servidor aceptó en esta pregunta. */
export function getSentWords() {
    return _sentWords.slice();
}

/** @returns {boolean} Si el jugador ya pulsó Enviar y el servidor le dio por terminado. */
export function isWordCloudFinished() {
    return _finished;
}

/**
 * Aviso para el jugador cuando se rechaza lo que envió.
 * @param {string} reason - Motivo del servidor o del móvil
 * @returns {{key: string, fallback: string}} Clave de i18n y texto de reserva
 */
export function wordCloudNotice(reason) {
    return NOTICES[reason] || GENERIC_NOTICE;
}

// Casillas con texto, ya limpias; invalid si alguna rellenada no vale (p. ej. de más de 20 letras)
function filledWords(rawValues) {
    const text = window.XiroWordCloudText;
    const filled = rawValues.filter(value => text.cleanWord(value) !== '');
    return {
        words: filled.filter(value => text.isValidWord(value)).map(value => text.cleanWord(value)),
        invalid: filled.some(value => !text.isValidWord(value))
    };
}

function rejected(reason) {
    return { status: 'rejected', reason };
}

function applyAck(resp) {
    if (resp.ok && resp.wordCloud && resp.wordCloud.status === 'finished') {
        _finished = true;
        _sentWords = resp.wordCloud.accepted.slice();
        return { status: 'finished', someRejected: resp.wordCloud.rejected.length > 0, cloud: resp.wordCloud.cloud };
    }
    if (resp.ok) return rejected('game-closed');
    if (RETRY_REASONS.includes(resp.reason)) return { status: 'retry' };
    if (resp.reason === 'already-finished') {
        _finished = true;
        return { status: 'finished', someRejected: false };
    }
    return rejected(resp.reason);
}

/**
 * Lo que hace el botón Enviar: manda las casillas rellenadas en un solo mensaje. Si todas se
 * rechazan el jugador puede corregirlas; si falla la red, puede volver a pulsar.
 * @param {Object} options
 * @param {string[]} options.rawValues - Texto de cada casilla
 * @param {{pin?: string, sessionId?: string}} options.room
 * @param {string} options.nickname
 * @param {function(): string} options.newRequestId
 * @param {function(Object): Promise<Object>} options.send - Emite el submit-answer y devuelve su ack
 * @returns {Promise<{status: 'finished'|'rejected'|'retry', reason?: string, someRejected?: boolean, cloud?: Object}>}
 */
export async function sendWordCloudBatch(options) {
    const { words, invalid } = filledWords(options.rawValues);
    if (invalid) return rejected('invalid-word');
    if (words.length === 0) return rejected('nothing');
    const payload = {
        ...options.room,
        nickname: options.nickname,
        answerType: 'word_cloud',
        words,
        requestId: options.newRequestId()
    };
    let ack;
    try {
        ack = await options.send(payload);
    } catch {
        return { status: 'retry' };
    }
    return ack ? applyAck(ack) : { status: 'retry' };
}
