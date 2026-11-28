/**
 * @fileoverview HTML compartido de la entrada de «Nube de palabras» (word_cloud): una casilla por
 * cada palabra que el jugador puede enviar (20 caracteres), un único botón Enviar que manda las
 * rellenadas, y las palabras ya enviadas. Lo usan el móvil
 * del jugador y el modo individual; estilos en css/word-cloud.css. Todo lo que escribe el
 * jugador y todos los textos de la interfaz van escapados.
 *
 * ES5 a propósito (webOS 3.5): nada de =>, plantillas, ?., ?? ni spread.
 * Expone window.XiroWordCloudView y module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    // En el navegador, el global de word-cloud-text.js; en Node (tests), el módulo
    const Text = root.XiroWordCloudText || (typeof module !== 'undefined' && module.require ? module.require('./word-cloud-text') : null);

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function limit(maxWords) {
        if (typeof maxWords !== 'number' || !(maxWords >= Text.MIN_WORDS)) return Text.DEFAULT_MAX_WORDS;
        return Math.min(Math.floor(maxWords), Text.MAX_WORDS);
    }

    /**
     * Palabras que le quedan por enviar al jugador.
     * @param {*} maxWords - Máximo de la pregunta (un valor inválido cuenta como 1)
     * @param {number} sentCount - Palabras ya enviadas
     * @returns {number}
     */
    function remaining(maxWords, sentCount) {
        return Math.max(0, limit(maxWords) - (Number(sentCount) || 0));
    }

    function sentListHtml(sentWords) {
        if (!sentWords.length) return '';
        const items = sentWords.map(function (word) {
            return '<li class="wc-sent__word">' + escapeHtml(word) + '</li>';
        });
        return '<ul class="wc-sent">' + items.join('') + '</ul>';
    }

    function fieldHtml(labels, position, total) {
        const name = escapeHtml(total > 1 ? labels.placeholder + ' ' + position : labels.placeholder);
        return '<input type="text" class="wc-input__field" data-wc-input maxlength="' + Text.MAX_WORD_LENGTH + '"' +
            ' autocomplete="off" autocapitalize="off" spellcheck="false"' +
            ' placeholder="' + escapeHtml(labels.placeholder) + '" aria-label="' + name + '">';
    }

    function formHtml(labels, count) {
        const fields = [];
        for (let i = 1; i <= count; i++) fields.push(fieldHtml(labels, i, count));
        // Con varias casillas se avisa de que no hace falta rellenarlas todas
        const hint = count > 1
            ? '<p class="wc-input__left" data-wc-left aria-live="polite">' + escapeHtml(labels.upTo.replace('{n}', String(count))) + '</p>'
            : '';
        return '<form class="wc-input" data-wc-form>' + fields.join('') + hint +
            '<button type="submit" class="wc-input__send" data-wc-send>' + escapeHtml(labels.send) + '</button>' +
            '</form>';
    }

    /**
     * Entrada de palabras: una casilla por cada palabra que aún puede enviar y un solo botón; o,
     * ya enviadas (o sin cupo), solo el aviso y las palabras.
     * @param {Object} options
     * @param {number} options.maxWords - Máximo de palabras por jugador
     * @param {string[]} [options.sentWords] - Palabras que el jugador ya envió
     * @param {boolean} [options.finished] - Si ya pulsó Enviar: no se admiten más
     * @param {{placeholder: string, send: string, upTo: string, done: string}} options.labels - `upTo` lleva {n}
     * @returns {string}
     */
    function inputHtml(options) {
        const sentWords = options.sentWords || [];
        const left = remaining(options.maxWords, sentWords.length);
        if (left === 0 || options.finished) {
            return '<p class="wc-done">' + escapeHtml(options.labels.done) + '</p>' + sentListHtml(sentWords);
        }
        return formHtml(options.labels, left) + sentListHtml(sentWords);
    }

    const api = Object.freeze({
        remaining: remaining,
        inputHtml: inputHtml
    });

    root.XiroWordCloudView = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
