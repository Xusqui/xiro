/**
 * @fileoverview Partitura de UNA sección (8 compases) a partir de su plan
 * (music-arrangement.js): combina melodía, acompañamiento y batería en eventos
 * listos para Tone.Part ({ time: 'Ni', dur: 'Ni', note(s), vel }). Todo se calcula
 * antes de sonar; los callbacks de audio no crean objetos ni hacen cálculos.
 *
 * Export dual (Jest con require; navegador en self.XiroMusic.scores). En el
 * navegador depende de prng, theory, melody, groove, parts y piano (en ese orden).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        const req = module.require.bind(module);
        module.exports = factory({
            prng: req('./music-prng.js'), theory: req('./music-theory.js'), melody: req('./music-melody.js'),
            groove: req('./music-groove.js'), parts: req('./music-parts.js'), piano: req('./music-piano.js')
        });
    } else {
        root.XiroMusic.scores = factory(root.XiroMusic);
    }
})(typeof self !== 'undefined' ? self : this, function (deps) {
    'use strict';

    const { prng, theory, melody, groove, parts, piano } = deps;

    const STEP = theory.STEP_TICKS;

    const RANGES = {
        pad: [55, 74],
        brass: [58, 79],
        piano: piano.RANGE,  // mano derecha; la izquierda (fundamental) va en piano.LEFT
        bass: [28, 43],     // E1-G2: registro de bajo (una octava por debajo de lo que sonaba)
        bells: [67, 93],
        melody: [57, 79],   // A3-G5: donde suenan bien trompa, trombón agudo y trompeta
        trumpet: [67, 84],  // doblaje a la octava en los clímax (G4-C6)
        timp: [41, 55]      // F2-G3: lo que cubren los cinco timbales
    };

    // Humanización por pista: [variación de intensidad, retraso máximo en ticks]
    const FEEL = { drums: [0.08, 6], bass: [0.06, 4], bells: [0.1, 5], melody: [0.06, 5], brass: [0.05, 3], piano: [0.07, 4] };

    const LOBBY = { bpm: 112, swing: 0.12 };

    const tick = (t) => Math.max(0, Math.round(t)) + 'i';

    function feel(rng, events, track, options, baseVel) {
        if (!options || options.humanize === false) return events;
        return groove.humanize(rng, events, { velJitter: FEEL[track][0], maxTicks: FEEL[track][1], baseVel: baseVel });
    }

    /** Notas por pasos (grados o MIDI) a eventos de Tone, plegando al registro de la pista. */
    function noteEvents(key, notes, range, vel, gap) {
        return notes.map(function (n) {
            const raw = n.midi !== undefined ? n.midi : theory.degreeToMidi(key, n.degree);
            const midi = theory.fitToRange([raw], range[0], range[1])[0];
            return {
                time: tick(n.step * STEP + (n.offset || 0)),
                dur: tick(n.len * STEP - (gap || 0)),
                note: theory.midiToName(midi),
                midi: midi,
                vel: n.vel !== undefined ? n.vel : vel
            };
        });
    }

    /** Acordes; los de metal cortos llevan además su fundamental una octava abajo (trombón). */
    function chordEvents(events, withLow) {
        return events.map(function (e) {
            const out = { time: tick(e.tick + (e.offset || 0)), dur: tick(e.len), notes: e.notes.map(theory.midiToName), midi: e.notes, vel: e.vel };
            if (e.sus) out.sus = true;
            else if (withLow) out.low = theory.midiToName(Math.min.apply(null, e.notes) - 12);
            return out;
        });
    }

    /** En los clímax, cada nota del tema lleva su doblaje de trompeta a la octava (o al unísono). */
    function withTrumpets(events, plan) {
        if (!plan.climax) return events;
        return events.map(function (e) {
            const up = e.midi + 12 <= RANGES.trumpet[1] ? e.midi + 12 : e.midi;
            return up >= RANGES.trumpet[0] ? Object.assign({ up: theory.midiToName(up) }, e) : e;
        });
    }

    function hitEvents(hits) {
        return hits.map(function (h) { return { time: tick(h.step * STEP + (h.offset || 0)), vel: h.vel }; });
    }

    function themeMelody(seed, plan, range, options) {
        const style = plan.styles.melody;
        if (style === 'none') return [];
        const chords = plan.chords;
        const variantRng = prng.createRng(seed, 'melody:' + plan.variant);
        const base = prng.createRng(seed, 'melody:base').pick([2, 4]) + (style === 'themeB' ? 2 : 0);
        if (options && options.motif === false) return melody.buildRandomPhrase(variantRng, chords, range, base);
        const motif = melody.generateMotif(prng.createRng(seed, style === 'themeB' ? 'motifB' : 'motifA'));
        if (style === 'response') return melody.buildFragmentPhrase(motif, chords, range, base);
        return melody.buildThemePhrase(motif, chords, range, base, variantRng);
    }

    /** Campanas: arpegio de la sección + respuesta a las notas largas de la melodía. */
    function bellEvents(seed, plan, melodyNotes, options) {
        const key = plan.key;
        const tones = plan.chords.map(function (c) {
            return theory.fitToRange(theory.chordMidi(key, c.d, c.k), RANGES.bells[0], RANGES.bells[0] + 14);
        });
        const arp = parts.bellLine(prng.createRng(seed, 'bells:' + plan.variant), tones, plan.styles.arp);
        const answer = melody.buildResponse(melodyNotes, theory.degreeRange(key, RANGES.bells[0], RANGES.bells[1]));
        const taken = {};
        arp.forEach(function (n) { taken[n.step] = true; });
        const merged = arp.map(function (n) { return Object.assign({ vel: n.step % 4 === 0 ? 0.42 : 0.3 }, n); })
            .concat(answer.filter(function (n) { return !taken[n.step]; }).map(function (n) { return Object.assign({ vel: 0.45 }, n); }));
        return feel(prng.createRng(seed, 'feel:bells:' + plan.variant), merged, 'bells', options);
    }

    /**
     * Platillos: al entrar el tema después de la intro o de una subida, al empezar cada
     * sección con batería de pop (detrás venía un fill), al entrar la última pregunta y
     * los que pone la batería tras sus fills.
     */
    function crashEvents(plan, fromDrums) {
        const style = groove.STYLES[plan.styles.drums];
        const theme = plan.styles.brass === 'stabs' && (plan.prevType === 'build' || plan.prevType === 'intro');
        const section = style && style.crash && plan.index > 0 && plan.type !== 'question';
        const entry = theme || section || plan.finalEntry ? [{ time: tick(0), vel: theme ? 0.8 : 0.75 }] : [];
        return entry.concat(fromDrums.filter((e) => !entry.length || e.time !== tick(0)));
    }

    /**
     * Partitura de la sección `plan` (ver arrangement.planSection).
     * options: { humanize: bool, motif: bool }
     */
    function buildSection(seed, plan, options) {
        const key = plan.key;
        const melodyRange = theory.degreeRange(key, RANGES.melody[0], RANGES.melody[1]);
        const melodyNotes = themeMelody(seed, plan, melodyRange, options);
        const padVoicings = parts.voiceChords(key, plan.chords, RANGES.pad);
        const brassVoicings = parts.voiceChords(key, plan.chords, RANGES.brass);
        // Pedal: con tensión alta el bajo se queda en la tónica bajo cualquier acorde
        const bassChords = plan.pedal ? plan.chords.map(() => ({ d: 0, k: 'triad' })) : plan.chords;
        const nextRoot = plan.pedal ? 0 : (plan.nextChord ? plan.nextChord.d : 0);
        const bass = parts.bassLine(prng.createRng(seed, 'bass:' + plan.variant), bassChords, plan.styles.bass, nextRoot);
        const drums = groove.generateDrums(prng.createRng(seed, 'drums:' + plan.variant), plan.styles.drums, plan.bars, plan.phrase);
        const brass = parts.brassLine(prng.createRng(seed, 'brass:' + plan.variant), brassVoicings, plan.styles.brass, plan.prevType);
        // Piano: golpea con los metales (mismos ticks) o parte el acorde
        const pianoLine = piano.pianoLine(prng.createRng(seed, 'piano:' + plan.variant), {
            key: key, chords: plan.chords, voicings: parts.voiceChords(key, plan.chords, RANGES.piano),
            style: plan.styles.piano, brass: brass
        });
        const drumFeel = prng.createRng(seed, 'feel:drums:' + plan.variant);
        const drumTrack = (piece) => hitEvents(feel(drumFeel, drums[piece], 'drums', options));

        return {
            plan: plan,
            key: key,
            chords: plan.chords,
            pad: chordEvents(parts.padLine(padVoicings, plan.chords, 0.5), false),
            brass: chordEvents(feel(prng.createRng(seed, 'feel:brass:' + plan.variant), brass, 'brass', options), true),
            piano: chordEvents(feel(prng.createRng(seed, 'feel:piano:' + plan.variant), pianoLine, 'piano', options), false),
            bass: noteEvents(key, feel(prng.createRng(seed, 'feel:bass:' + plan.variant), bass, 'bass', options, 0.75), RANGES.bass, 0.75, 6),
            bells: noteEvents(key, bellEvents(seed, plan, melodyNotes, options), RANGES.bells, 0.35, 0),
            melody: withTrumpets(noteEvents(key, feel(prng.createRng(seed, 'feel:melody:' + plan.variant), melodyNotes, 'melody', options, 0.7), RANGES.melody, 0.7, 8), plan),
            crash: crashEvents(plan, drumTrack('crash')),
            kick: drumTrack('kick'),
            snare: drumTrack('snare'),
            clap: drumTrack('clap'),
            hatC: drumTrack('hatC'),
            hatO: drumTrack('hatO'),
            // Última pregunta: timbal en la tónica al entrar (con el platillo de crashEvents)
            timp: drums.timp.concat(plan.finalEntry ? [{ step: 0, vel: 0.95 }] : []).map(function (h) {
                const chord = plan.chords[Math.floor(h.step / theory.STEPS_PER_BAR)];
                const midi = theory.fitToRange([theory.degreeToMidi(key, chord.d)], RANGES.timp[0], RANGES.timp[1])[0];
                return { time: tick(h.step * STEP), note: theory.midiToName(midi), midi: midi, vel: h.vel };
            })
        };
    }

    return { RANGES, LOBBY, buildSection };
});
