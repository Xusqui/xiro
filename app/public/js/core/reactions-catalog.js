/**
 * @fileoverview Catálogo de reacciones con emoji en directo: los identificadores que
 * existen, los seis que se ofrecen por defecto y la validación del conjunto que el admin
 * elige en Configuración → Interfaz. Los iconos son Fluent Emoji Flat (MIT, Microsoft) en
 * /images/reactions/<id>.svg.
 *
 * Lo comparten el servidor (config/ui-settings.js valida antes de guardar), el admin, el
 * jugador, el presentador y la TV. ES5: tv.html también lo carga.
 * Export dual: require en Node/Jest; self.XiroReactions en el navegador.
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.XiroReactions = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const CATALOG = [
        'clap', 'laugh', 'wow', 'love', 'fire', 'party',
        'thumbsup', 'raise', 'hundred', 'starstruck', 'hearteyes', 'rofl',
        'cool', 'sweat', 'thinking', 'mindblown', 'scream', 'cry',
        'muscle', 'rocket', 'trophy', 'star', 'sparkles', 'eyes',
        'brain', 'lizard'
    ];
    const DEFAULT_SET = ['clap', 'laugh', 'wow', 'love', 'fire', 'party'];
    const SET_SIZE = 6;

    function isKnown(id) {
        return typeof id === 'string' && CATALOG.indexOf(id) !== -1;
    }

    /** null si el conjunto es válido; si no, el motivo. */
    function firstError(set) {
        if (!Array.isArray(set)) return 'reactionSet debe ser una lista';
        if (set.length !== SET_SIZE) return 'reactionSet debe tener ' + SET_SIZE + ' reacciones';
        for (let i = 0; i < set.length; i++) {
            if (!isKnown(set[i])) return 'Reacción desconocida en la posición ' + (i + 1);
            if (set.indexOf(set[i]) !== i) return 'Reacción repetida en la posición ' + (i + 1);
        }
        return null;
    }

    /** Copia del conjunto si es válido; si no, copia del conjunto por defecto. */
    function normalize(set) {
        return (firstError(set) === null ? set : DEFAULT_SET).slice();
    }

    function iconUrl(id) {
        return '/images/reactions/' + id + '.svg';
    }

    function labelKey(id) {
        return 'reactions.names.' + id;
    }

    return {
        CATALOG: CATALOG,
        DEFAULT_SET: DEFAULT_SET,
        SET_SIZE: SET_SIZE,
        isKnown: isKnown,
        firstError: firstError,
        normalize: normalize,
        iconUrl: iconUrl,
        labelKey: labelKey
    };
});
