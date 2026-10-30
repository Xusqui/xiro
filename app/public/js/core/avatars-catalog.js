/**
 * @fileoverview Catálogo de avatares de jugador: los identificadores que existen, los que
 * se ofrecen por defecto y la validación del conjunto que el admin elige en
 * Configuración → Interfaz. Los iconos son Fluent Emoji Flat (MIT, Microsoft) en
 * /images/avatars/<id>.svg.
 *
 * Lo comparten el servidor (config/ui-settings.js valida antes de guardar y el alta en el
 * lobby comprueba el avatar elegido), el admin, el jugador, el presentador y la TV.
 * ES5: tv.html también lo carga.
 * Export dual: require en Node/Jest; self.XiroAvatars en el navegador.
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.XiroAvatars = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const CATALOG = [
        'fox',
        'frog',
        'octopus',
        'unicorn',
        'panda',
        'tiger',
        'owl',
        'bee',
        'whale',
        'cactus',
        'donut',
        'rocket',
        'guitar',
        'rainbow',
        'watermelon',
        'alien',
        'cat',
        'dog',
        'lion',
        'monkey',
        'koala',
        'penguin',
        'rabbit',
        'bear',
        'pig',
        'cow',
        'hamster',
        'mouse',
        'chick',
        'turtle',
        'dolphin',
        'butterfly',
        'ladybug',
        'dragon',
        'trex',
        'hedgehog',
        'sloth',
        'otter',
        'flamingo',
        'parrot',
        'snail',
        'crab',
        'shark',
        'robot',
        'ghost',
        'pizza',
        'avocado',
        'soccer'
    ];
    const DEFAULT_SET = CATALOG.slice(0, 16);
    const MIN_SET = 4;

    function isKnown(id) {
        return typeof id === 'string' && CATALOG.indexOf(id) !== -1;
    }

    /** null si el conjunto es válido; si no, el motivo. */
    function firstError(set) {
        if (!Array.isArray(set)) return 'avatarSet debe ser una lista';
        if (set.length < MIN_SET) return 'avatarSet debe tener al menos ' + MIN_SET + ' avatares';
        if (set.length > CATALOG.length) return 'avatarSet tiene más avatares que el catálogo';
        for (let i = 0; i < set.length; i++) {
            if (!isKnown(set[i])) return 'Avatar desconocido en la posición ' + (i + 1);
            if (set.indexOf(set[i]) !== i) return 'Avatar repetido en la posición ' + (i + 1);
        }
        return null;
    }

    /** Copia del conjunto si es válido; si no, copia del conjunto por defecto. */
    function normalize(set) {
        return (firstError(set) === null ? set : DEFAULT_SET).slice();
    }

    /** El avatar si está activo y en el conjunto; si no, null (el jugador entra sin avatar). */
    function resolve(id, settings) {
        if (!settings || settings.enabled !== true || !isKnown(id)) return null;
        return normalize(settings.set).indexOf(id) !== -1 ? id : null;
    }

    function iconUrl(id) {
        return '/images/avatars/' + id + '.svg';
    }

    function labelKey(id) {
        return 'avatars.names.' + id;
    }

    return {
        CATALOG: CATALOG,
        DEFAULT_SET: DEFAULT_SET,
        MIN_SET: MIN_SET,
        isKnown: isKnown,
        firstError: firstError,
        normalize: normalize,
        resolve: resolve,
        iconUrl: iconUrl,
        labelKey: labelKey
    };
});
