/**
 * @fileoverview Mapa del banco de muestras de la música (public/audio/music; créditos
 * y licencias en CREDITS.txt): qué fichero suena en cada nota de cada instrumento y
 * cómo elegir capa de intensidad y alternancia. Hay varios juegos de sonidos para
 * elegirlos en el admin: metales (VSCO 2 o Iowa con pp/mf/ff), piano (de cola o
 * eléctrico FM), melodía (metales,
 * saxos, flauta, clarinete, oboe, violines o sintetizada), bajo (a dedo, staccato,
 * Babyblue, contrabajo o sintetizado), batería (Big Rusty, Virtuosity o Naked Drums)
 * y reverb (generada o salas reales). Datos puros.
 *
 * Export dual (Jest con require; navegador en self.XiroMusic.sampleMap).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.sampleMap = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const BASE_URL = '/audio/music/';
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    const noteToMidi = (name) => {
        const m = /^([A-G]#?)(-?\d)$/.exec(name);
        return (Number(m[2]) + 1) * 12 + NOTE_NAMES.indexOf(m[1]);
    };
    const midiToName = (midi) => NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
    // En disco el sostenido va como 's' (C#4 → Cs4.flac)
    const fileOf = (dir, note, ext) => dir + '/' + note.replace('#', 's') + (ext || '.flac');

    function pitched(dir, notes, ext) {
        const urls = {};
        notes.forEach((note) => { urls[note] = fileOf(dir, note, ext); });
        return urls;
    }

    // Lead de metales: trompa (F3-C4), trombón agudo (D#4-F4) y trompeta (G4-C6)
    const LEAD_NOTES = ['F3', 'A3', 'C4', 'D#4', 'F4', 'G4', 'A#4', 'D5', 'F5', 'A5', 'C6'];
    const STAB_NOTES = ['F3', 'A3', 'C4', 'D#4', 'F4', 'G4', 'A#4', 'D5', 'F5', 'A5', 'C6'];

    const PITCHED = {
        lead: pitched('lead', LEAD_NOTES),
        trumpet: pitched('lead', ['G4', 'A#4', 'D5', 'F5', 'A5', 'C6']),
        stab: pitched('stab', STAB_NOTES),
        stabLow: pitched('stablow', ['A#2', 'F3', 'A#3', 'D4', 'F4']),
        bass: pitched('bass', ['E1', 'G1', 'A#1', 'C#2', 'E2', 'G2', 'A#2', 'C#3', 'E3', 'G3']),
        timp: pitched('timp', ['F2', 'B2', 'D3', 'E3', 'G3'])
    };

    /*
     * Sonidos del tic-tac (se elige uno). Cada golpe se mapea a su nota: el tic suena
     * tal cual (C5) y el tac se toca más grave desde C6 (Sampler transpone).
     */
    const TICK_SOUNDS = {
        claves: { urls: { C5: 'cues/clave_rr1.flac', C6: 'cues/clave_rr2.flac' }, notes: ['C5', 'G#5'] },
        wood: { urls: { C5: 'cues/wood_rr1.flac', C6: 'cues/wood_rr2.flac' }, notes: ['C5', 'G#5'] },
        xstick: { urls: { C5: 'cues/xstick_rr1.flac', C6: 'cues/xstick_rr2.flac' }, notes: ['C5', 'A#5'] },
        bip: { urls: { C5: 'cues/bip.flac' }, notes: ['C5', 'G4'] }
    };

    // Metales de la Universidad de Iowa: las mismas notas que VSCO, en pp, mf y ff
    const DYNAMICS = ['pp', 'mf', 'ff'];
    // Capas por dinámica: dir/Nota_dinámica.flac (missing: notas que faltan en alguna capa)
    const layered = (dir, notes, dyns, missing) => dyns.map((dyn) => {
        const urls = {};
        notes.filter((note) => !(missing && missing[dyn] && missing[dyn].includes(note))).forEach((note) => {
            urls[note] = dir + '/' + note.replace('#', 's') + '_' + dyn + '.flac';
        });
        return urls;
    });
    const iowa = (dir, notes) => layered(dir, notes, DYNAMICS);
    const BRASS_BANKS = {
        vsco: null, // PITCHED: una sola dinámica
        iowa: {
            lead: iowa('iowa/lead', LEAD_NOTES),
            trumpet: iowa('iowa/lead', ['G4', 'A#4', 'D5', 'F5', 'A5', 'C6']),
            stab: iowa('iowa/lead', STAB_NOTES),
            stabLow: iowa('iowa/stablow', ['A#2', 'F3', 'A#3', 'D4', 'F4'])
        }
    };

    // Bajos: el de siempre (a dedo), alternativas con muestras y uno sintetizado (sin capas)
    const BASS_NOTES = ['E1', 'G1', 'A#1', 'C#2', 'E2', 'G2', 'A#2', 'C#3', 'E3', 'G3'];
    const BASS_BANKS = {
        finger: null, // PITCHED.bass
        stac: [pitched('basses/stac', BASS_NOTES)],
        babyblue: [pitched('basses/babyblue', BASS_NOTES)],
        upright: [pitched('basses/upright', ['E1', 'G1', 'A#1', 'C2', 'E2', 'F#2', 'A2', 'C#3', 'E3', 'G#3'])],
        synth: []
    };

    // Piano: de cola (Salamander Grand Piano V3, CC BY 3.0; en MP3, cada tercera menor) o
    // eléctrico FM sintetizado (sin capas: el «E.Piano» del DX7)
    const PIANO_NOTES = ['F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6', 'F#6', 'A6'];
    const PIANO_BANKS = {
        epiano: [],
        grand: [pitched('piano/grand', PIANO_NOTES, '.mp3')]
    };

    // Melodía: metales (los del banco de metales, grupo lead), maderas de Iowa (pp, mf, ff),
    // violines de VSCO (p, f) o sintetizada (sin capas)
    const SCALE_A = ['A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5'];
    const MELODY_BANKS = {
        brass: null,
        altosax: layered('melody/altosax', SCALE_A, DYNAMICS),
        sopsax: layered('melody/sopsax', SCALE_A.concat('A5'), DYNAMICS),
        flute: layered('melody/flute', ['B3', 'D4', 'F4', 'G#4', 'B4', 'D5', 'F5', 'G#5'], DYNAMICS),
        clarinet: layered('melody/clarinet', SCALE_A.concat('A5'), DYNAMICS),
        oboe: layered('melody/oboe', ['A#3', 'C#4', 'E4', 'G4', 'A#4', 'C#5', 'E5', 'G5'], DYNAMICS, { pp: ['C#4'] }),
        violins: layered('melody/violins', ['G3', 'A3', 'B3', 'D4', 'F#4', 'A4', 'C5', 'E5', 'G5', 'B5'], ['p', 'f']),
        synth: []
    };

    // Batería: capas de intensidad (de suave a fuerte), cada una con sus alternancias
    const DRUM_LAYERS = {
        kick: [['kick/k_vl7_rr1', 'kick/k_vl7_rr2'], ['kick/k_vl11_rr1', 'kick/k_vl11_rr2'], ['kick/k_vl14_rr1', 'kick/k_vl14_rr2']],
        snare: [['snare/s_vl3_rr1', 'snare/s_vl3_rr2'], ['snare/s_vl6_rr1', 'snare/s_vl6_rr2'], ['snare/s_vl10_rr1', 'snare/s_vl10_rr2']],
        hatC: [['hatc/h_vl2_rr1', 'hatc/h_vl2_rr2'], ['hatc/h_vl5_rr1', 'hatc/h_vl5_rr2'], ['hatc/h_vl8_rr1', 'hatc/h_vl8_rr2']],
        hatO: [['hato/o_vl3'], ['hato/o_vl6']],
        crash: [['crash/cr_vl4']]
    };

    // Kits nuevos: tres capas con dos alternancias (charles abierto y crash, dos capas)
    function kitFiles(dir) {
        const rows = (piece, layers, rr) => [...Array(layers).keys()].map((l) =>
            [...Array(rr).keys()].map((r) => dir + '/' + piece + '/' + piece + '_l' + (l + 1) + '_rr' + (r + 1)));
        return { kick: rows('kick', 3, 2), snare: rows('snare', 3, 2), hatC: rows('hatc', 3, 2), hatO: rows('hato', 2, 1), crash: rows('crash', 2, 1) };
    }
    const DRUM_KITS = { rusty: DRUM_LAYERS, virtuosity: kitFiles('virtuosity'), naked: kitFiles('naked') };

    // Reverb: generada (Tone.Reverb) o respuesta al impulso de una sala real (CC0)
    const REVERBS = { generated: null, liverpool: 'ir/liverpool.flac', nordea: 'ir/nordea.flac', knights: 'ir/knights.flac' };

    // Por defecto (elegido de oído el 2026-10-11)
    const DEFAULT_SOUNDS = { brass: 'iowa', piano: 'epiano', melody: 'brass', bass: 'babyblue', drums: 'naked', reverb: 'liverpool' };
    const soundsOf = (sounds) => Object.assign({}, DEFAULT_SOUNDS, sounds);

    /** Capas de un instrumento afinado ([{ nota: fichero }], de suave a fuerte; [] = sintetizado). */
    function pitchedLayers(group, sounds) {
        const chosen = soundsOf(sounds);
        if (group === 'bass') return BASS_BANKS[chosen.bass] || [PITCHED.bass];
        if (group === 'melody') return MELODY_BANKS[chosen.melody] || [];
        if (group === 'piano') return PIANO_BANKS[chosen.piano] || [];
        const bank = BRASS_BANKS[chosen.brass];
        return bank && bank[group] ? bank[group] : [PITCHED[group]];
    }

    /**
     * Cada muestra de batería se toca en "su" nota (C1, C#1, …) para que el Sampler
     * no la transponga. notes[capa][alternancia] → nota.
     */
    function drumKit(piece, kit) {
        const urls = {};
        let midi = 24;
        const notes = DRUM_KITS[kit || DEFAULT_SOUNDS.drums][piece].map((layer) => layer.map((file) => {
            const name = midiToName(midi++);
            urls[name] = file + '.flac';
            return name;
        }));
        return { urls, notes };
    }

    /** Capa de intensidad para una velocidad 0..1 (umbrales repartidos por igual). */
    function layerFor(vel, layerCount) {
        return Math.max(0, Math.min(layerCount - 1, Math.floor(vel * layerCount)));
    }

    /** Distancia en semitonos a la muestra más cercana (cuánto hay que transponer). */
    function nearestDistance(urls, midi) {
        return Object.keys(urls).reduce((best, note) => Math.min(best, Math.abs(noteToMidi(note) - midi)), Infinity);
    }

    /** Todas las rutas del juego de sonidos con clave "grupo|capa|nota" (para cargarlas de una vez). */
    function allUrls(sounds) {
        const out = {};
        const chosen = soundsOf(sounds);
        Object.keys(PITCHED).concat('melody', 'piano').forEach((group) => {
            pitchedLayers(group, chosen).forEach((layer, i) => {
                Object.keys(layer).forEach((note) => { out[group + '|' + i + '|' + note] = layer[note]; });
            });
        });
        Object.keys(DRUM_LAYERS).forEach((piece) => {
            const kit = drumKit(piece, chosen.drums);
            Object.keys(kit.urls).forEach((note) => { out[piece + '|' + note] = kit.urls[note]; });
        });
        Object.keys(TICK_SOUNDS).forEach((name) => {
            Object.keys(TICK_SOUNDS[name].urls).forEach((note) => { out['tick:' + name + '|' + note] = TICK_SOUNDS[name].urls[note]; });
        });
        return out;
    }

    return {
        BASE_URL, PITCHED, BRASS_BANKS, PIANO_BANKS, MELODY_BANKS, BASS_BANKS, DRUM_LAYERS, DRUM_KITS, REVERBS, DEFAULT_SOUNDS, TICK_SOUNDS,
        noteToMidi, pitchedLayers, drumKit, layerFor, nearestDistance, allUrls
    };
});
