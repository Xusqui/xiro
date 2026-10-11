/**
 * @fileoverview Revelación de la respuesta, en funciones puras: fill de batería que
 * crece hasta el golpe y stinger de 2 compases. En la tonalidad mayor del lobby, así
 * la tensión en menor de la pregunta se resuelve. Tiempos en ticks (PPQ 192) desde el
 * inicio del fill o del golpe; todas las notas, diatónicas.
 *
 * Stinger de celebración (solo suena en el presentador): «¡TA-DAAAA!» de metales con
 * timbal, platillo y campanas.
 *
 * Export dual (Jest con require; navegador en self.XiroMusic.stingers).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(module.require('./music-theory.js'));
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.stingers = factory(root.XiroMusic.theory);
    }
})(typeof self !== 'undefined' ? self : this, function (theory) {
    'use strict';

    const BEAT = theory.PPQ;
    const STEP = theory.STEP_TICKS;
    const BAR = theory.BAR_TICKS;
    const STINGER_TICKS = 2 * BAR;
    const BRASS_RANGE = [58, 79];
    // Registros anchos: una figura de hasta dos octavas cabe entera en cualquier tonalidad
    const LEAD_RANGE = [60, 88];
    const BELLS_RANGE = [65, 100];

    const t = (ticks) => Math.round(ticks) + 'i';
    const name = theory.midiToName;

    /** Fill de `beats` tiempos: corcheas que pasan a semicorcheas en el último, en crescendo. */
    function buildRevealFill(beats) {
        const total = Math.max(1, beats) * BEAT;
        const snare = [];
        const kick = [];
        for (let tick = 0; tick < total; tick += STEP) {
            const lastBeat = tick >= total - BEAT;
            if (!lastBeat && (tick / STEP) % 2 === 1) continue;
            snare.push({ time: t(tick), vel: 0.3 + 0.65 * (tick / total) });
        }
        for (let tick = 0; tick < total; tick += BEAT) kick.push({ time: t(tick), vel: 0.6 });
        return { snare, kick, lengthTicks: total };
    }

    function voiced(key, degree, kind, range) {
        return theory.voiceLead(null, theory.chordMidi(key, degree, kind), range[0], range[1]);
    }

    function fold(midi, range) {
        return theory.fitToRange([midi], range[0], range[1])[0];
    }

    function chordEvent(tick, len, midi, vel, sus) {
        const e = { time: t(tick), dur: t(len), notes: midi.map(name), midi: midi, vel: vel };
        if (sus) e.sus = true;
        else e.low = name(Math.min.apply(null, midi) - 12);
        return e;
    }

    /** Desplaza la figura entera por octavas para que quepa en el registro (sin romper su forma). */
    function placeFigure(midis, range) {
        let shift = 0;
        const lo = Math.min.apply(null, midis);
        const hi = Math.max.apply(null, midis);
        while (lo + shift < range[0]) shift += 12;
        while (hi + shift > range[1] && lo + shift - 12 >= range[0]) shift -= 12;
        return midis.map((m) => (m + shift >= range[0] && m + shift <= range[1] ? m + shift : fold(m, range)));
    }

    /**
     * Notas por grados. opts: { range, vel, len (número o lista), y o bien
     * start + step (la nota i suena en start + i·step) o bien at (lista de ticks) }.
     */
    function noteEvents(key, degrees, opts) {
        const midis = placeFigure(degrees.map((d) => theory.degreeToMidi(key, d)), opts.range);
        return midis.map((midi, i) => {
            const tick = opts.at ? opts.at[i] : (opts.start || 0) + i * (opts.step || 0);
            const dur = Array.isArray(opts.len) ? opts.len[i] : opts.len;
            return { time: t(tick), dur: t(dur), note: name(midi), midi: midi, vel: opts.vel };
        });
    }

    /**
     * «¡TA-DAAAA!»: TA, golpe corto de metales en la dominante (una semicorchea); DAAAA,
     * justo después, tutti largo en la tónica (metales, trompeta aguda, timbal, platillo).
     */
    function hostStinger(key) {
        const da = STEP; // el TA dura una semicorchea
        const ta = voiced(key, 4, 'triad', BRASS_RANGE);
        const tonic = voiced(key, 0, 'add9', BRASS_RANGE);
        return {
            brass: [chordEvent(0, da, ta, 0.8), chordEvent(da, BEAT, tonic, 0.95), chordEvent(da, 7 * BEAT, tonic, 0.75, true)],
            lead: noteEvents(key, [4, 7], { at: [0, da], len: [da, 6 * BEAT], range: LEAD_RANGE, vel: 0.85 }),
            bells: noteEvents(key, [0, 2, 4, 7, 9, 11, 14], { start: da, step: STEP, len: 4 * STEP, range: BELLS_RANGE, vel: 0.5 }),
            pad: [chordEvent(da, 7 * BEAT, voiced(key, 0, 'add9', [55, 74]), 0.5, true)],
            timp: noteEvents(key, [4, 0], { at: [0, da], len: [da, 2 * BEAT], range: [41, 55], vel: 0.9 }),
            crash: [{ time: t(da), vel: 0.95 }],
            kick: [{ time: t(0), vel: 0.7 }, { time: t(da), vel: 0.95 }],
            lengthTicks: STINGER_TICKS
        };
    }

    /** Stinger de la revelación (pantalla del presentador) en la tonalidad `key`. */
    function buildStinger(key) {
        return hostStinger(key);
    }

    /*
     * Podio: un redoble cerrado antes del 3º y, a negras, los grados 1-3-4 de la
     * tonalidad (Do-Mi-Fa en Do mayor): 3º, 2º y 1º puesto. El 4º grado queda en el aire
     * y el final entra en el compás siguiente, en la misma tonalidad.
     */
    const PODIUM_STEP_TICKS = BEAT;          // negras (2 · BEAT = blancas)
    const PODIUM_NOTES = [
        { place: 3, degree: 0, vel: 0.75, crash: 0.5 },
        { place: 2, degree: 2, vel: 0.85, crash: 0 },
        { place: 1, degree: 3, vel: 0.95, crash: 0.95 }
    ];
    const PODIUM_BRASS_RANGE = [62, 79];
    const ROLL_TICKS = STEP / 2;             // fusas: redoble cerrado, no semicorcheas

    /** Redoble de `beats` tiempos a fusas, alternando manos y en crescendo hasta el golpe. */
    function buildPodiumRoll(beats) {
        const total = Math.max(1, beats) * BEAT;
        const snare = [];
        for (let tick = 0, i = 0; tick < total; tick += ROLL_TICKS, i++) {
            const swell = 0.12 + 0.6 * Math.pow(tick / total, 1.4);
            snare.push({ time: t(tick), vel: swell * (i % 2 === 0 ? 1 : 0.85) });
        }
        return { snare, lengthTicks: total };
    }

    /**
     * Las tres notas del podio en `key`: la nota de la escala, en octavas en toda la
     * sección de metales (más trombón abajo), trompeta una octava arriba y timbal en la
     * misma nota. La figura se coloca entera, así sube siempre (1-3-4). El 1º añade el
     * acorde del IV completo. `steps[i]` dice en qué tick sale cada puesto.
     */
    function buildPodiumReveal(key) {
        const out = { brass: [], lead: [], bells: [], pad: [], timp: [], crash: [], kick: [], steps: [] };
        const scale = PODIUM_NOTES.map((n) => theory.degreeToMidi(key, n.degree));
        const brassTop = placeFigure(scale, PODIUM_BRASS_RANGE);
        const trumpet = placeFigure(brassTop.map((m) => m + 12), LEAD_RANGE);
        const timp = placeFigure(scale, [40, 57]); // cabe la figura entera en cualquier tonalidad
        PODIUM_NOTES.forEach((n, i) => {
            const tick = i * PODIUM_STEP_TICKS;
            const last = i === PODIUM_NOTES.length - 1;
            const len = last ? 2 * PODIUM_STEP_TICKS : PODIUM_STEP_TICKS;
            const octaves = [brassTop[i] - 12, brassTop[i]];
            const notes = last ? octaves.concat(voiced(key, 3, 'triad', [brassTop[i] - 11, brassTop[i] - 1])) : octaves;
            out.brass.push(chordEvent(tick, len, notes.sort((a, b) => a - b), n.vel));
            out.lead.push({ time: t(tick), dur: t(len), note: name(trumpet[i]), midi: trumpet[i], vel: n.vel });
            out.timp.push({ time: t(tick), dur: t(len), note: name(timp[i]), midi: timp[i], vel: n.vel });
            out.bells = out.bells.concat(noteEvents(key, [n.degree + 7, n.degree + 9],
                { start: tick, step: STEP, len: 4 * STEP, range: BELLS_RANGE, vel: 0.35 }));
            out.kick.push({ time: t(tick), vel: n.vel });
            if (n.crash) out.crash.push({ time: t(tick), vel: n.crash });
            out.steps.push({ place: n.place, tick: tick });
        });
        out.lengthTicks = PODIUM_NOTES.length * PODIUM_STEP_TICKS + PODIUM_STEP_TICKS;
        return out;
    }

    return { STINGER_TICKS, PODIUM_STEP_TICKS, placeFigure, buildRevealFill, buildStinger, buildPodiumRoll, buildPodiumReveal };
});
