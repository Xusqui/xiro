/**
 * @fileoverview Avisos de fin de tiempo de la pregunta, independientes de la escena:
 * subida de ruido filtrado en los últimos 5 s y tic-tac en negras en los 3 últimos,
 * cuadrado con el pulso del Transport. Se programan a partir del tiempo que queda
 * (reloj del servidor) y se cancelan al pausar o revelar.
 *
 * El sonido del tic-tac se elige en el admin (pestaña «Música»): muestras del banco
 * (claves, madera, aro de caja, el bip del juego) o un reloj mecánico sintetizado.
 */

import { trace } from './music-trace.js?v=20260922172926';

// Niveles para destacar sobre la música en su punto más alto (tensión 1) sin taparla
const RISER_PEAK_GAIN = 1.2;
const RISER_TOP_HZ = 4000;
const SAMPLE_TICK_DB = 0;
const MECH_TICK_DB = 18;
const MECH_TICK_HZ = [2900, 2100]; // tic, tac del reloj mecánico
const DEFAULT_TICK = 'wood'; // elegido de oído
const MAX_TICKS = 32; // salvaguarda: el tic-tac son ~6 golpes; nunca un bucle desbocado
export const TICK_SOUND_NAMES = ['claves', 'wood', 'xstick', 'bip', 'mech'];

/**
 * @param {object} Tone
 * @param {object} output  Canal de avisos de la mezcla
 * @param {{ RISER_SECONDS: number, TICK_SECONDS: number }} timing
 */
export function createCues(Tone, output, timing) {
    const transport = Tone.getTransport();
    const riserGain = new Tone.Gain(0).connect(output);
    const riserFilter = new Tone.Filter({ type: 'bandpass', frequency: 300, Q: 1.2 }).connect(riserGain);
    const riser = new Tone.Noise('pink').connect(riserFilter);
    // Reloj mecánico: chasquido de ruido muy corto por un resonador estrecho
    const mechFilter = new Tone.Filter({ type: 'bandpass', frequency: MECH_TICK_HZ[0], Q: 9 }).connect(output);
    const mech = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.0005, decay: 0.018, sustain: 0, release: 0.005 },
        volume: MECH_TICK_DB
    }).connect(mechFilter);
    const samplers = {};
    let bank = null;
    let sound = DEFAULT_TICK;
    let tickIds = [];
    let tickCount = 0;
    let riserOn = false;

    function samplerFor(name) {
        if (!bank || name === 'mech') return null;
        if (!samplers[name]) {
            const kit = bank.tick(name);
            samplers[name] = { sampler: new Tone.Sampler({ urls: kit.urls, release: 0.1 }).connect(output), notes: kit.notes };
            samplers[name].sampler.volume.value = SAMPLE_TICK_DB;
        }
        return samplers[name];
    }

    const playTick = (time) => {
        const i = tickCount++ % 2;
        const s = samplerFor(sound);
        if (s) {
            s.sampler.triggerAttack(s.notes[i], time, 1);
            return;
        }
        mechFilter.frequency.setValueAtTime(MECH_TICK_HZ[i], time);
        mech.triggerAttackRelease('64n', time, 1);
    };

    function scheduleRiser(endTime) {
        const now = Tone.now();
        const start = Math.max(now, endTime - timing.RISER_SECONDS);
        if (endTime - start < 0.3) return;
        riser.start(start).stop(endTime + 0.05);
        riserOn = true;
        riserFilter.frequency.cancelScheduledValues(now);
        riserFilter.frequency.setValueAtTime(300, start);
        riserFilter.frequency.exponentialRampToValueAtTime(RISER_TOP_HZ, endTime);
        riserGain.gain.cancelScheduledValues(now);
        // Curva exponencial: discreto casi todo el rato y crece de verdad en el último segundo
        riserGain.gain.setValueAtTime(0.001, start);
        riserGain.gain.exponentialRampToValueAtTime(RISER_PEAK_GAIN, endTime - 0.05);
        riserGain.gain.linearRampToValueAtTime(0, endTime + 0.05);
    }

    /** Un tic en cada tiempo (negra) del Transport entre `fromTime` y `endTime`. */
    function scheduleTicks(fromTime, endTime) {
        const startTick = transport.getTicksAtTime(Math.max(Tone.now(), fromTime));
        const endTick = transport.getTicksAtTime(endTime);
        let count = 0;
        for (let t = Math.ceil(startTick / transport.PPQ) * transport.PPQ; t < endTick && count < MAX_TICKS; t += transport.PPQ) {
            tickIds.push(transport.scheduleOnce(playTick, `${t}i`));
            count++;
        }
        return { startTick, endTick, count };
    }

    return {
        useBank(loaded) {
            bank = loaded || null;
        },
        /** Sonido del tic-tac: uno de TICK_SOUND_NAMES (sin banco, siempre el mecánico). */
        setTickSound(name) {
            if (TICK_SOUND_NAMES.indexOf(name) !== -1) sound = name;
        },
        /** Prueba: cuatro tics en los próximos tiempos (el Transport tiene que estar en marcha). */
        preview() {
            if (transport.state !== 'started') return;
            tickCount = 0;
            const now = Tone.now();
            scheduleTicks(now, now + 4 * (60 / transport.bpm.value) + 0.05);
        },
        /** Programa los avisos para una pregunta a la que le quedan `remainingMs`. */
        start(remainingMs) {
            this.cancel();
            const endTime = Tone.now() + remainingMs / 1000;
            tickCount = 0;
            trace(`  avisos: quedan ${Math.round(remainingMs)} ms`);
            scheduleRiser(endTime);
            const ticks = scheduleTicks(endTime - timing.TICK_SECONDS, endTime);
            trace(`  tic-tac: ${ticks.count} golpes (ticks ${Math.round(ticks.startTick)}→${Math.round(ticks.endTick)})`);
        },
        cancel() {
            const now = Tone.now();
            tickIds.forEach((id) => transport.clear(id));
            tickIds = [];
            riserGain.gain.cancelScheduledValues(now);
            riserGain.gain.rampTo(0, 0.08, now);
            if (riserOn) riser.stop(now + 0.1);
            riserOn = false;
        },
        dispose() {
            this.cancel();
            [riser, riserFilter, riserGain, mech, mechFilter].forEach((node) => node.dispose());
            Object.values(samplers).forEach((s) => s.sampler.dispose());
        }
    };
}
