/**
 * @fileoverview Ajustes de la música que se eligen en el panel de administración
 * (pestaña «Música») y que el presentador aplica en cada partida: juego de sonidos,
 * tempo base, semilla, volumen general, tic-tac y mezcla por capa. Datos puros.
 *
 * Lo comparten el servidor (config/music-settings.js valida antes de guardar), el
 * admin (formulario y escucha) y el presentador (normaliza lo que llega).
 *
 * Export dual (Jest/Node con require; navegador en self.XiroMusic.settings). En el
 * navegador lee self.XiroMusic.sampleMap al usarse, no al cargarse.
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(() => module.require('./music-sample-map.js'));
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.settings = factory(() => root.XiroMusic.sampleMap);
    }
})(typeof self !== 'undefined' ? self : this, function (sampleMap) {
    'use strict';

    const LAYERS = ['pad', 'brass', 'piano', 'bass', 'drums', 'arp', 'melody'];
    // Mezcla por defecto en dB (ajustada de oído el 2026-10-11)
    const LAYER_DB = { pad: 0, brass: -5, piano: -4, bass: -4, drums: 0, arp: -2, melody: 0 };
    const TICK_SOUNDS = ['claves', 'wood', 'xstick', 'bip', 'mech'];
    const SOUND_GROUPS = ['brass', 'piano', 'melody', 'bass', 'drums', 'reverb'];
    const SEED_MODES = ['session', 'fixed'];
    const SEED_PATTERN = /^[a-z0-9_-]{1,32}$/i;
    const TEMPO = { min: 80, max: 140, base: 112 };
    const DB = { min: -40, max: 6 };
    const VOLUME = { min: 0, max: 1 };

    /** Valores admitidos por grupo de sonidos (claves de los bancos del mapa de muestras). */
    function soundOptions() {
        const map = sampleMap();
        return {
            brass: Object.keys(map.BRASS_BANKS),
            melody: Object.keys(map.MELODY_BANKS),
            piano: Object.keys(map.PIANO_BANKS),
            bass: Object.keys(map.BASS_BANKS),
            drums: Object.keys(map.DRUM_KITS),
            reverb: Object.keys(map.REVERBS)
        };
    }

    function defaultMix() {
        const mix = {};
        LAYERS.forEach((layer) => { mix[layer] = { db: LAYER_DB[layer], muted: false }; });
        return mix;
    }

    function defaults() {
        return {
            sounds: Object.assign({}, sampleMap().DEFAULT_SOUNDS),
            tempo: TEMPO.base,
            seedMode: 'session',
            seed: '',
            volume: 0.8,
            tick: 'wood',
            mix: defaultMix()
        };
    }

    const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const inRange = (v, r) => typeof v === 'number' && Number.isFinite(v) && v >= r.min && v <= r.max;

    function soundsError(sounds) {
        if (!isObject(sounds)) return 'sounds debe ser un objeto';
        const options = soundOptions();
        const bad = Object.keys(sounds).find((g) => !Object.hasOwn(options, g) || !options[g].includes(sounds[g]));
        return bad ? `Sonido no válido para ${bad}` : null;
    }

    function mixError(mix) {
        if (!isObject(mix)) return 'mix debe ser un objeto';
        const bad = Object.keys(mix).find((layer) => {
            const ch = mix[layer];
            return !LAYERS.includes(layer) || !isObject(ch) || !inRange(ch.db, DB) || typeof ch.muted !== 'boolean';
        });
        return bad ? `Mezcla no válida en ${bad}` : null;
    }

    function seedError(raw) {
        if (raw.seedMode !== undefined && !SEED_MODES.includes(raw.seedMode)) return 'seedMode debe ser session o fixed';
        if (raw.seed !== undefined && raw.seed !== '' && !(typeof raw.seed === 'string' && SEED_PATTERN.test(raw.seed))) {
            return 'La semilla admite letras, números, - y _ (máximo 32)';
        }
        if (raw.seedMode === 'fixed' && !raw.seed) return 'Con semilla fija hay que escribir una semilla';
        return null;
    }

    /** Primer problema de `raw` (texto) o null si es válido. Las claves ausentes valen. */
    function firstError(raw) {
        if (!isObject(raw)) return 'Los ajustes de música deben ser un objeto';
        const unknown = Object.keys(raw).find((key) => !Object.hasOwn(defaults(), key));
        if (unknown) return `Ajuste de música desconocido: ${unknown}`;
        if (raw.sounds !== undefined && soundsError(raw.sounds)) return soundsError(raw.sounds);
        if (raw.tempo !== undefined && !(Number.isInteger(raw.tempo) && inRange(raw.tempo, TEMPO))) {
            return `tempo debe ser un entero entre ${TEMPO.min} y ${TEMPO.max}`;
        }
        if (raw.volume !== undefined && !inRange(raw.volume, VOLUME)) return 'volume debe estar entre 0 y 1';
        if (raw.tick !== undefined && !TICK_SOUNDS.includes(raw.tick)) return 'Sonido del tic-tac no válido';
        if (raw.mix !== undefined && mixError(raw.mix)) return mixError(raw.mix);
        return seedError(raw);
    }

    function normalizeMix(out, mix) {
        LAYERS.forEach((layer) => {
            const ch = mix[layer];
            if (!isObject(ch)) return;
            if (inRange(ch.db, DB)) out.mix[layer].db = ch.db;
            if (typeof ch.muted === 'boolean') out.mix[layer].muted = ch.muted;
        });
    }

    /**
     * Ajustes completos a partir de lo guardado: rellena con los valores por defecto y
     * descarta lo que no valga (nunca lanza; para el presentador y el admin).
     */
    function normalize(raw) {
        const out = defaults();
        if (!isObject(raw)) return out;
        const options = soundOptions();
        if (isObject(raw.sounds)) {
            SOUND_GROUPS.forEach((g) => {
                if (options[g].includes(raw.sounds[g])) out.sounds[g] = raw.sounds[g];
            });
        }
        if (Number.isInteger(raw.tempo) && inRange(raw.tempo, TEMPO)) out.tempo = raw.tempo;
        if (typeof raw.seed === 'string' && SEED_PATTERN.test(raw.seed)) out.seed = raw.seed;
        if (raw.seedMode === 'fixed' && out.seed) out.seedMode = 'fixed';
        if (inRange(raw.volume, VOLUME)) out.volume = raw.volume;
        if (TICK_SOUNDS.includes(raw.tick)) out.tick = raw.tick;
        if (isObject(raw.mix)) normalizeMix(out, raw.mix);
        return out;
    }

    /** Semilla de una partida: la fija si el admin la eligió; si no, la de la sesión. */
    function seedFor(settings, sessionSeed) {
        return settings && settings.seedMode === 'fixed' && settings.seed ? settings.seed : String(sessionSeed);
    }

    /** Factor de tempo frente al de las partituras (112 bpm). */
    function tempoScale(settings) {
        return (settings && settings.tempo ? settings.tempo : TEMPO.base) / TEMPO.base;
    }

    return {
        LAYERS, LAYER_DB, TICK_SOUNDS, SOUND_GROUPS, SEED_MODES, TEMPO, DB, VOLUME,
        soundOptions, defaults, firstError, normalize, seedFor, tempoScale
    };
});
