/**
 * @fileoverview Piano de acompañamiento, en funciones puras, al estilo de plató de los 80:
 *  - 'stabs': golpea con los metales (mismos ticks que sus golpes a contratiempo) y
 *    pone el primer tiempo de cada compás con la mano izquierda; si no hay golpes de
 *    metal, hace los suyos con los mismos patrones;
 *  - 'arp': acorde partido en 3+3+2 semicorcheas (no choca con las corcheas rectas de
 *    las campanas) sobre la fundamental en la mano izquierda;
 *  - 'pulse': acordes repetidos a corcheas (empuje de la subida y de la pregunta tensa),
 *    en crescendo si la sección tiene varios compases.
 * Eventos en ticks: { tick, len, notes: [midi], vel }.
 *
 * Export dual (Jest con require; navegador en self.XiroMusic.piano). En el navegador
 * depende de theory y parts.
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(module.require('./music-theory.js'), module.require('./music-parts.js'));
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.piano = factory(root.XiroMusic.theory, root.XiroMusic.parts);
    }
})(typeof self !== 'undefined' ? self : this, function (theory, parts) {
    'use strict';

    const STEP = theory.STEP_TICKS;
    const BAR_TICKS = theory.BAR_TICKS;
    const RANGE = [55, 79];      // mano derecha (G3-G5)
    const LEFT = [43, 54];       // mano izquierda: la fundamental (G2-F#3)
    const ARP_RHYTHM = [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]];
    // Orden de las notas del acorde (índice en el voicing, de grave a agudo) por medio compás
    const ARP_SHAPES = [[0, 1, 2], [0, 2, 1], [1, 2, 3]];
    const STYLES = ['stabs', 'arp', 'pulse'];

    function leftRoot(key, chord) {
        return theory.fitToRange([theory.degreeToMidi(key, chord.d)], LEFT[0], LEFT[1])[0];
    }

    /** Golpes de los metales ({ tick, len, vel }) o, si no hay, los del piano con sus patrones. */
    function stabHits(rng, bars, brass) {
        const fromBrass = (brass || []).filter((e) => !e.sus).map((e) => ({ tick: e.tick, len: Math.min(e.len, 2 * STEP), vel: e.vel }));
        if (fromBrass.length) return fromBrass;
        const out = [];
        let pattern = null;
        for (let bar = 0; bar < bars; bar++) {
            if (bar % 2 === 0) pattern = rng.pick(parts.STAB_PATTERNS);
            pattern.forEach((slot) => out.push({ tick: bar * BAR_TICKS + slot[0] * STEP, len: slot[1] * STEP, vel: 0.62 }));
        }
        return out;
    }

    function stabLine(rng, ctx) {
        const byTick = {};
        const add = (tick, len, notes, vel) => {
            const prev = byTick[tick];
            if (prev && prev.vel >= vel) return;
            byTick[tick] = { tick, len, notes, vel };
        };
        ctx.chords.forEach((chord, bar) => {
            add(bar * BAR_TICKS, 4 * STEP, [leftRoot(ctx.key, chord)].concat(ctx.voicings[bar]), 0.6);
        });
        stabHits(rng, ctx.chords.length, ctx.brass).forEach((hit) => {
            const bar = Math.floor(hit.tick / BAR_TICKS);
            if (!ctx.voicings[bar]) return;
            const notes = hit.tick % BAR_TICKS === 0 ? [leftRoot(ctx.key, ctx.chords[bar])].concat(ctx.voicings[bar]) : ctx.voicings[bar];
            add(hit.tick, hit.len, notes, Math.min(0.85, hit.vel * 0.85));
        });
        return Object.keys(byTick).map(Number).sort((a, b) => a - b).map((tick) => byTick[tick]);
    }

    function arpLine(rng, ctx) {
        const shape = rng.pick(ARP_SHAPES);
        const out = [];
        ctx.chords.forEach((chord, bar) => {
            const voicing = ctx.voicings[bar];
            const base = bar * BAR_TICKS;
            out.push({ tick: base, len: 8 * STEP, notes: [leftRoot(ctx.key, chord)], vel: 0.5 });
            out.push({ tick: base + 8 * STEP, len: 8 * STEP, notes: [leftRoot(ctx.key, chord)], vel: 0.42 });
            ARP_RHYTHM.forEach((slot, i) => {
                const index = shape[i % 3] % voicing.length;
                // Segunda mitad del compás: la misma figura, una nota del acorde más arriba
                const note = i < 3 ? voicing[index] : voicing[(index + 1) % voicing.length];
                out.push({ tick: base + slot[0] * STEP, len: slot[1] * STEP, notes: [note], vel: slot[0] % 8 === 0 ? 0.52 : 0.4 });
            });
        });
        return out.sort((a, b) => a.tick - b.tick || a.notes[0] - b.notes[0]);
    }

    function pulseLine(ctx) {
        const out = [];
        const bars = ctx.chords.length;
        ctx.chords.forEach((chord, bar) => {
            const swell = bars > 1 ? 0.75 + 0.35 * (bar / (bars - 1)) : 1;
            for (let step = 0; step < 16; step += 2) {
                const vel = (step % 4 === 0 ? 0.55 : 0.4) * swell;
                const notes = step % 8 === 0 ? [leftRoot(ctx.key, chord)].concat(ctx.voicings[bar]) : ctx.voicings[bar];
                out.push({ tick: bar * BAR_TICKS + step * STEP, len: 2 * STEP - 12, notes, vel: Math.min(0.9, vel) });
            }
        });
        return out;
    }

    /**
     * Piano de una sección. ctx: { key, chords, voicings (mano derecha, MIDI, uno por
     * compás), style ('stabs' | 'arp' | 'pulse' | 'none'), brass (eventos de los metales
     * en ticks, para golpear con ellos) }.
     */
    function pianoLine(rng, ctx) {
        if (ctx.style === 'stabs') return stabLine(rng, ctx);
        if (ctx.style === 'arp') return arpLine(rng, ctx);
        if (ctx.style === 'pulse') return pulseLine(ctx);
        return [];
    }

    return { RANGE, LEFT, STYLES, pianoLine };
});
