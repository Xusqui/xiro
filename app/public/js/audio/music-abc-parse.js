/**
 * @fileoverview Lectura de un ABC (primera pieza, primera voz): cabecera (T, M, L, Q, K), acordes entre
 * comillas y notas con su tiempo (en redondas) y su MIDI. Entiende alteraciones, armadura, octavas,
 * longitudes, silencios, ritmo roto (> <), ligaduras, tresillos y la anacrusa; ignora decoraciones, notas
 * de adorno, letras y repeticiones (no las expande). Datos puros, sin DOM.
 *
 * Export dual (Jest/Node con require; navegador en self.XiroMusic.abcParse).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(() => module.require('./music-abc-keys.js'), () => module.require('./music-abc-text.js'));
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.abcParse = factory(() => root.XiroMusic.abcKeys, () => root.XiroMusic.abcText);
    }
})(typeof self !== 'undefined' ? self : this, function (keysOf, textOf) {
    'use strict';

    const DEFAULT_UNIT = 1 / 8;
    const MAX_TITLE = 60;
    const NOTE_IN_GROUP = /([\^_=]*)([A-Ga-g])([,']*)/;

    function newState(fifths) {
        return {
            fifths, unit: DEFAULT_UNIT, time: 0, notes: [], chords: [], pickup: null, barAccidentals: new Map(),
            tieMidi: null, tuplet: null, broken: 1, voice: null, firstVoice: null
        };
    }

    const count = (text, char) => text.split(char).length - 1;

    function midiOf(group, state) {
        const text = textOf();
        const upper = group.letter.toUpperCase();
        const octave = (group.letter === upper ? 4 : 5) + count(group.octave, "'") - count(group.octave, ',');
        const slot = upper + octave;
        const written = text.accidentalValue(group.acc);
        if (written !== null) state.barAccidentals.set(slot, written);
        const shift = state.barAccidentals.has(slot) ? state.barAccidentals.get(slot) : text.keySignatureShift(state.fifths, upper);
        return 12 * (octave + 1) + text.SEMITONE[upper] + shift;
    }

    /** Duración en redondas: unidad × multiplicador × tresillo × ritmo roto pendiente. */
    function durationOf(lengthText, state) {
        let factor = 1;
        if (state.tuplet && state.tuplet.left > 0) {
            factor = state.tuplet.factor;
            state.tuplet.left--;
        }
        const duration = state.unit * textOf().multiplier(lengthText) * factor * state.broken;
        state.broken = 1;
        return duration;
    }

    function applyBroken(duration, mods, state) {
        const arrows = count(mods, '>') - count(mods, '<');
        if (arrows === 0) return duration;
        const shortened = 0.5 ** Math.abs(arrows);
        state.broken = arrows > 0 ? shortened : 2 - shortened;
        return duration * (arrows > 0 ? 2 - shortened : shortened);
    }

    function addNote(group, state) {
        const midi = midiOf(group, state);
        const duration = applyBroken(durationOf(group.len, state), group.mods, state);
        if (state.tieMidi === midi && state.notes.length) state.notes.at(-1).dur += duration;
        else state.notes.push({ time: state.time, dur: duration, midi });
        state.tieMidi = group.mods.includes('-') ? midi : null;
        state.time += duration;
    }

    function addRest(token, length, state) {
        const bars = token === 'Z' ? Number(length) || 1 : 0;
        state.time += bars || durationOf(length, state);
        state.tieMidi = null;
    }

    function addGroup(groups, state) {
        const inner = NOTE_IN_GROUP.exec(groups.group);
        if (!inner) return addRest('z', groups.groupLen, state);
        return addNote({ acc: inner[1], letter: inner[2], octave: inner[3], len: groups.groupLen, mods: '' }, state);
    }

    function startTuplet(spec, state) {
        const [p, q, r] = spec.split(':').map(Number);
        state.tuplet = { left: r || p, factor: (q || textOf().TUPLET_Q[p] || 2) / p };
    }

    function onBar(state) {
        state.barAccidentals = new Map();
        if (state.pickup === null) state.pickup = state.time > textOf().EPS && state.time < 1 - textOf().EPS ? state.time : 0;
    }

    function handleToken(groups, state) {
        if (groups.chord !== undefined) {
            if (!/^[\^_<>@]/.test(groups.chord)) state.chords.push({ time: state.time, symbol: groups.chord });
        } else if (groups.bar !== undefined) onBar(state);
        else if (groups.field === 'L') state.unit = textOf().fraction(groups.fieldValue) || state.unit;
        else if (groups.tuplet !== undefined) startTuplet(groups.tuplet, state);
        else if (groups.group !== undefined) addGroup(groups, state);
        else if (groups.letter !== undefined) addNote(groups, state);
        else if (groups.rest !== undefined) addRest(groups.rest, groups.restLen, state);
    }

    /** ¿Es una línea de música de la primera voz? Las V: eligen voz; las demás líneas de campo se ignoran. */
    function acceptLine(line, state) {
        const voice = /^V:\s*(\S+)/.exec(line);
        if (voice) {
            state.voice = voice[1];
            if (state.firstVoice === null) state.firstVoice = voice[1];
            return false;
        }
        if (/^[A-Za-z]:/.test(line)) return false;
        return state.firstVoice === null || state.voice === state.firstVoice;
    }

    /**
     * Lee la primera pieza de un texto ABC.
     * @param {string} abc
     * @returns {{title: string, tempo: ?number, key: Object, pickup: number, chords: Array<{time: number, symbol: string}>, notes: Array<{time: number, dur: number, midi: number}>, total: number}}
     * @throws {Error} con `code`: ABC_EMPTY, ABC_KEY_MISSING, ABC_KEY_INVALID o ABC_METER
     */
    function parseAbc(abc) {
        const text = textOf();
        if (typeof abc !== 'string' || !abc.trim()) throw text.codedError('ABC_EMPTY');
        const tune = text.splitTune(abc);
        if (!tune.hasKey) throw text.codedError('ABC_KEY_MISSING');
        const key = keysOf().parseKey(tune.fields.K);
        if (!key) throw text.codedError('ABC_KEY_INVALID');
        const barLength = text.barLengthOf(tune.fields.M);
        if (barLength === null || Math.abs(barLength - 1) > text.EPS) throw text.codedError('ABC_METER');
        const state = newState(key.fifths);
        state.unit = text.fraction(tune.fields.L || '') || DEFAULT_UNIT;
        for (const line of tune.body) {
            if (acceptLine(line, state)) for (const match of line.matchAll(text.TOKEN)) handleToken(match.groups, state);
        }
        return {
            title: (tune.fields.T || '').slice(0, MAX_TITLE), tempo: text.tempoOf(tune.fields.Q), key,
            pickup: state.pickup || 0, chords: state.chords, notes: state.notes, total: state.time
        };
    }

    return { parseAbc };
});
