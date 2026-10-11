/**
 * @fileoverview Relojes de la música: cuándo cae el próximo compás, cuánto dura un
 * tiempo y el vigilante del reloj de Tone.js. Tone programa con un reloj en un
 * Worker creado desde un Blob; si la CSP lo bloquea (falta worker-src blob:) no hay
 * excepción: el reloj no late y no suena nada. watchClock lo detecta y cambia a un
 * reloj con setTimeout.
 */

const WATCH_MS = 500;

/**
 * @param {object} Tone
 * @param {() => void} onFallback  Aviso cuando hubo que cambiar de reloj
 */
export function watchClock(Tone, onFallback) {
    const context = Tone.getContext();
    let ticked = false;
    const onTick = () => {
        ticked = true;
    };
    context.on('tick', onTick);
    setTimeout(() => {
        context.off('tick', onTick);
        if (ticked) return;
        context.clockSource = 'timeout';
        onFallback();
    }, WATCH_MS);
}

/** Arranca el Transport si está parado; devuelve el tick del próximo compás (4/4). */
export function startAtNextBar(Tone) {
    const transport = Tone.getTransport();
    if (transport.state === 'started') {
        const perBar = transport.PPQ * 4;
        const now = transport.getTicksAtTime(Tone.now());
        return Math.ceil((now + 1) / perBar) * perBar;
    }
    transport.position = 0;
    transport.start('+0.05');
    return 0;
}

export function beatsToSeconds(transport, beats) {
    return (60 / transport.bpm.value) * beats;
}

/** Ejecuta fn cuando el reloj de audio llegue a `time` (limpieza, no música). */
export function afterAudioTime(Tone, time, fn) {
    const ms = Math.max(0, (time - Tone.immediate()) * 1000) + 200;
    setTimeout(fn, ms);
}

/**
 * Cuantiza un "momento" (revelación, puesto del podio): arranca en el siguiente tiempo y
 * el golpe cae en la siguiente división de `gridBeats` tiempos (4 = compás, 2 = medio
 * compás), con al menos `minBeats` tiempos de preparación.
 */
export function quantizeHit(Tone, minBeats, gridBeats = 4) {
    const transport = Tone.getTransport();
    const beat = transport.PPQ;
    const bar = beat * 4;
    const grid = beat * gridBeats;
    const now = transport.getTicksAtTime(Tone.now());
    const startTick = Math.ceil((now + 1) / beat) * beat;
    let hitTick = Math.ceil(startTick / grid) * grid;
    if (hitTick - startTick < minBeats * beat) hitTick += grid;
    return { startTick, hitTick, beats: (hitTick - startTick) / beat, bar };
}
