/**
 * @fileoverview Batería por estilos (pop de plató, disco, subida…) con fills cada 4 y
 * 8 compases, platillo en el tiempo que sigue a un fill, notas fantasma, charles
 * abierto y timbales; y humanización (intensidad
 * variable y microdesajustes) para que no suene a caja de ritmos de catálogo.
 * Devuelve golpes { step, vel, offset? } en semicorcheas de la sección.
 *
 * Export dual (Jest con require; navegador en self.XiroMusic.groove).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.groove = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const BAR = 16;
    const BAR_TICKS = 768; // PPQ 192 × 4
    const PIECES = ['kick', 'snare', 'clap', 'hatC', 'hatO', 'timp', 'crash'];
    const ALL_SIXTEENTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

    // Patrón base por compás: pasos de cada pieza (los fills se superponen aparte).
    // crash: probabilidad de platillo tras un fill pequeño (tras el grande, siempre)
    const STYLES = {
        intro: { kick: [], snare: [], clap: [], hatC: [], hatO: [], timpBars: [0, 4], ghost: 0 },
        light: { kick: [0], snare: [], clap: [], hatC: [2, 6, 10, 14], hatO: [], ghost: 0 },
        pop: { kick: [0, 6, 8], snare: [4, 12], clap: [12], hatC: [0, 2, 4, 6, 8, 10, 12, 14], hatO: [], openEvery: 2, ghost: 0.35, crash: 0.5 },
        disco: { kick: [0, 4, 8, 12], snare: [4, 12], clap: [4, 12], hatC: [0, 4, 8, 12], hatO: [2, 6, 10, 14], ghost: 0.25, crash: 0.6 },
        build: { kick: [0, 4, 8, 12], snare: [4, 12], clap: [], hatC: ALL_SIXTEENTHS, hatO: [], timpBars: [0, 2, 4], roll: true, ghost: 0 },
        // Pregunta: latido → corcheas → semicorcheas según sube la tensión
        qPulse: { kick: [0, 8], snare: [], clap: [], hatC: [4, 12], hatO: [], ghost: 0 },
        q8: { kick: [0, 8, 10], snare: [4, 12], clap: [], hatC: [0, 2, 4, 6, 8, 10, 12, 14], hatO: [], ghost: 0.2, crash: 0.3 },
        q16: { kick: [0, 4, 8, 12], snare: [4, 12], clap: [12], hatC: ALL_SIXTEENTHS, hatO: [], openEvery: 1, ghost: 0.3, crash: 0.6 }
    };

    const SMALL_FILLS = [[13, 14, 15], [14, 15], [12, 14, 15]];
    const BIG_FILLS = [
        [8, 10, 12, 13, 14, 15],
        [8, 11, 12, 14, 15],
        [6, 8, 10, 11, 12, 13, 14, 15]
    ];

    function emptyKit() {
        const out = {};
        PIECES.forEach(function (p) { out[p] = []; });
        return out;
    }

    function push(list, step, vel) {
        list.push({ step: step, vel: vel });
    }

    /** Fill de caja en crescendo dentro del compás que empieza en `base`. */
    function fillBar(out, base, steps) {
        steps.forEach(function (s, i) {
            push(out.snare, base + s, 0.35 + 0.5 * (i + 1) / steps.length);
        });
    }

    /** Redoble de la subida: corcheas y luego semicorcheas en crescendo en los dos últimos compases. */
    function rollBars(out, bars) {
        const start = (bars - 2) * BAR;
        for (let s = 0; s < 2 * BAR; s++) {
            if (s < BAR && s % 2 === 1) continue;
            push(out.snare, start + s, 0.25 + 0.65 * (s / (2 * BAR)));
        }
    }

    function hatVel(step) {
        if (step % 4 === 0) return 0.28;
        return step % 2 === 0 ? 0.36 : 0.16;
    }

    /**
     * Un mismo paso solo una vez por pieza (los fills pisan el patrón): se queda el más
     * fuerte. Donde suena el charles abierto no suena el cerrado (lo cortaría).
     */
    function dedupe(out) {
        const open = {};
        out.hatO.forEach(function (h) { open[h.step] = true; });
        out.hatC = out.hatC.filter(function (h) { return !open[h.step]; });
        PIECES.forEach(function (piece) {
            const byStep = {};
            out[piece].forEach(function (h) {
                if (!byStep[h.step] || byStep[h.step].vel < h.vel) byStep[h.step] = h;
            });
            out[piece] = Object.keys(byStep).map(Number).sort(function (a, b) { return a - b; })
                .map(function (s) { return byStep[s]; });
        });
        return out;
    }

    /**
     * Añade el compás `bar` a `ctx.out`.
     * ctx: { rng, out, style, phrase: { startBar, bars }, bigFill } — phrase dice dónde cae el
     * compás en su frase (fill grande al final; startBar: compás absoluto del primero).
     */
    function addBar(ctx, bar) {
        const { rng, out, style, phrase, bigFill } = ctx;
        const base = bar * BAR;
        const hasSnare = style.snare.length > 0;
        const absBar = phrase.startBar + bar;
        const isLast = absBar % phrase.bars === phrase.bars - 1;
        const isFourth = absBar % 4 === 3 && !isLast;
        const fillFrom = isLast && hasSnare && !style.roll ? bigFill[0] : (isFourth && hasSnare ? 12 : BAR);
        const hatScale = style.roll ? 0.5 + bar / phrase.bars : 1;
        style.kick.forEach(function (s) { push(out.kick, base + s, s === 0 ? 0.95 : 0.75); });
        style.snare.forEach(function (s) { if (s < fillFrom) push(out.snare, base + s, 0.7); });
        style.clap.forEach(function (s) { if (s < fillFrom) push(out.clap, base + s, 0.6); });
        style.hatC.forEach(function (s) { if (s < fillFrom || style.roll) push(out.hatC, base + s, hatVel(s) * hatScale); });
        style.hatO.forEach(function (s) { push(out.hatO, base + s, 0.3); });
        if (style.openEvery && bar % style.openEvery === 1) push(out.hatO, base + 14, 0.32);
        if (style.ghost && rng.chance(style.ghost)) push(out.snare, base + rng.pick([7, 9, 15]), 0.14);
        if (isFourth && hasSnare) fillBar(out, base, rng.pick(SMALL_FILLS));
        if (isLast && hasSnare && !style.roll) fillBar(out, base, bigFill);
        if (style.timpBars && style.timpBars.indexOf(bar) !== -1) push(out.timp, base, 0.8);
        addCrash(ctx, bar, absBar);
    }

    /**
     * Platillo en el primer tiempo que sigue a un fill: tras el grande (fin de frase),
     * siempre; tras uno pequeño, a veces. El de la entrada de una sección lo pone la
     * partitura (music-scores), que sabe qué sección venía antes.
     */
    function addCrash(ctx, bar, absBar) {
        const { rng, out, style, phrase } = ctx;
        if (!style.crash || !style.snare.length || bar === 0 && phrase.startBar === 0) return;
        const prev = absBar - 1;
        const afterBig = prev % phrase.bars === phrase.bars - 1;
        const afterSmall = !afterBig && prev % 4 === 3;
        if (afterBig) push(out.crash, bar * BAR, 0.85);
        else if (afterSmall && rng.chance(style.crash)) push(out.crash, bar * BAR, 0.6);
    }

    /**
     * Batería de una sección de `bars` compases.
     * Fill pequeño al final de cada 4 compases y grande en el último de la frase (si el
     * estilo lleva caja). Para secciones de 1 compás (pregunta), `phrase` dice dónde cae
     * el compás dentro de su frase: { startBar, bars }.
     */
    function generateDrums(rng, styleName, bars, phrase) {
        const style = STYLES[styleName];
        const out = emptyKit();
        if (!style) return out;
        const where = phrase || { startBar: 0, bars: bars };
        const bigFill = rng.pick(BIG_FILLS);
        const ctx = { rng, out, style, phrase: where, bigFill };
        for (let bar = 0; bar < bars; bar++) addBar(ctx, bar);
        if (style.roll) rollBars(out, bars);
        if (styleName === 'intro') push(out.snare, bars * BAR - 2, 0.5); // anacrusa hacia la A
        return dedupe(out);
    }

    /**
     * Humanización: intensidad ±velJitter y retraso de 0..maxTicks ticks (nunca
     * adelanta, así ningún evento cae antes del inicio de la sección). Los golpes en
     * el primer tiempo de cada compás quedan clavados para no perder el pulso.
     */
    function humanize(rng, events, opts) {
        return events.map(function (e) {
            const onDownbeat = e.step !== undefined ? e.step % BAR === 0 : e.tick % BAR_TICKS === 0;
            const baseVel = e.vel !== undefined ? e.vel : (opts.baseVel || 0.7);
            const vel = Math.max(0.05, Math.min(1, baseVel + (rng.next() * 2 - 1) * opts.velJitter));
            const offset = onDownbeat ? 0 : Math.round(rng.next() * opts.maxTicks);
            return Object.assign({}, e, { vel: vel, offset: offset });
        });
    }

    return { STYLES, PIECES, generateDrums, humanize };
});
