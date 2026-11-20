/**
 * @fileoverview Catálogo de los tipos de pregunta de los bancos: qué tipos existen y
 * las reglas declarativas de cada uno. Es la única lista de tipos; los demás puntos que
 * conocen los tipos (CHECK de BD, Joi, selector del editor, filtro de Trivial, pantallas
 * del jugador) deben coincidir con ella, y __tests__/question-types.contract.test.js lo
 * comprueba. Para añadir un tipo: entrada aquí y seguir los fallos de ese test.
 *
 * Campos de cada tipo:
 *  - survey:       encuesta, sin respuesta correcta (no puntúa, no toca rachas).
 *  - randomPoints: puntúa «acierto/fallo + bonus de tiempo», así que admite la
 *                  puntuación aleatoria del juego (en fill_blanks, por palabra).
 *  - trivial:      el modo Trivial puede elegirlo. survey_multiple no: el filtro es un
 *                  literal SQL en services/db/trivial.service.js, sin interpolar.
 *  - answerShape:  qué envía el jugador: option (un índice), selection (varios),
 *                  order, matching, number, text, found (selecciones de la sopa) o
 *                  words (una palabra por hueco) o tap (un punto { x, y } de la imagen).
 *  - detailsField: campo de la respuesta guardada con el detalle del tipo (null si no hay).
 *  - solution:     qué es la solución que se revela: option (una opción), options (varias),
 *                  none (encuestas), order, pairs, value (número), word (palabra),
 *                  words (las de la sopa), blanks (las de los huecos) o area (el polígono
 *                  de la imagen).
 *
 * El orden es el del selector del editor (question-type-picker.js).
 * Para webOS 3.5 (tv.html): nada de =>, plantillas, ?., ?? ni spread (lo vigila ESLint).
 * Expone window.XiroQuestionTypes y module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    const CATALOG = [
        entry('quiz', { randomPoints: true, answerShape: 'option', solution: 'option' }),
        entry('multiple_choice', {
            answerShape: 'selection',
            detailsField: 'multipleChoiceDetails',
            solution: 'options'
        }),
        entry('survey', { survey: true, answerShape: 'option', solution: 'none' }),
        entry('survey_multiple', {
            survey: true,
            trivial: false,
            answerShape: 'selection',
            detailsField: 'surveyMultipleDetails',
            solution: 'none'
        }),
        entry('order', { answerShape: 'order', detailsField: 'orderDetails', solution: 'order' }),
        entry('matching', { answerShape: 'matching', detailsField: 'matchingDetails', solution: 'pairs' }),
        entry('numeric_approximation', { answerShape: 'number', detailsField: 'numericDetails', solution: 'value' }),
        entry('hotspot', { answerShape: 'tap', detailsField: 'hotspotDetails', solution: 'area' }),
        entry('word_scramble', {
            randomPoints: true,
            answerShape: 'text',
            detailsField: 'wordScrambleDetails',
            solution: 'word'
        }),
        entry('word_search', { answerShape: 'found', detailsField: 'wordSearchDetails', solution: 'words' }),
        entry('fill_blanks', {
            randomPoints: true,
            answerShape: 'words',
            detailsField: 'fillBlanksDetails',
            solution: 'blanks'
        })
    ];

    /** Valores por defecto: puntúa, sin puntos aleatorios, Trivial puede elegirlo, sin detalle. */
    function entry(id, facts) {
        const base = { id: id, survey: false, randomPoints: false, trivial: true, detailsField: null };
        Object.keys(facts).forEach(function (key) {
            base[key] = facts[key];
        });
        return base;
    }

    const BY_ID = {};
    CATALOG.forEach(function (entry) {
        BY_ID[entry.id] = Object.freeze(entry);
    });

    /** Descriptor del tipo, o null si no es un tipo del catálogo. */
    function find(type) {
        if (typeof type !== 'string') return null;
        return Object.prototype.hasOwnProperty.call(BY_ID, type) ? BY_ID[type] : null;
    }

    /**
     * Descripción completa del tipo.
     * @param {*} type
     * @returns {Object|null} Descriptor inmutable, o null si no es un tipo del catálogo.
     */
    function get(type) {
        return find(type);
    }

    /**
     * Forma de la solución. Sin tipo conocido (preguntas antiguas), una opción correcta.
     * @param {*} type
     * @returns {string}
     */
    function solutionOf(type) {
        const found = find(type);
        return found === null ? 'option' : found.solution;
    }

    /**
     * Identificadores de todos los tipos, en el orden del selector del editor.
     * @returns {string[]} Copia nueva en cada llamada.
     */
    function ids() {
        return CATALOG.map(function (entry) {
            return entry.id;
        });
    }

    /**
     * @param {*} type
     * @returns {boolean} Si es un tipo del catálogo.
     */
    function isKnown(type) {
        return find(type) !== null;
    }

    /**
     * @param {*} type
     * @returns {boolean} Si es una encuesta (simple o de selección múltiple).
     */
    function isSurvey(type) {
        const entry = find(type);
        return entry !== null && entry.survey;
    }

    /**
     * Un tipo desconocido puntúa: solo las encuestas no lo hacen.
     * @param {*} type
     * @returns {boolean} Si una pregunta de este tipo asigna puntos.
     */
    function isScored(type) {
        return !isSurvey(type);
    }

    /**
     * @param {*} type
     * @returns {boolean} Si admite la puntuación aleatoria del juego.
     */
    function allowsRandomPoints(type) {
        const entry = find(type);
        return entry !== null && entry.randomPoints;
    }

    /**
     * @param {*} type
     * @returns {boolean} Si el modo Trivial puede elegir preguntas de este tipo.
     */
    function allowedInTrivial(type) {
        const entry = find(type);
        return entry !== null && entry.trivial;
    }

    const api = Object.freeze({
        ids: ids,
        get: get,
        solutionOf: solutionOf,
        isKnown: isKnown,
        isSurvey: isSurvey,
        isScored: isScored,
        allowsRandomPoints: allowsRandomPoints,
        allowedInTrivial: allowedInTrivial
    });

    root.XiroQuestionTypes = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
