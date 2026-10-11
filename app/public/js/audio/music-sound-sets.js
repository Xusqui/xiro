/**
 * @fileoverview Juego de sonidos de MusicEngine ({ brass, melody, bass, drums, reverb }, ver
 * music-sample-map.js): carga el banco de muestras elegido y la reverb. Al cambiar en
 * marcha, el banco nuevo se descarga sin cortar la música y la escena se rehace en el
 * compás siguiente; el banco viejo se libera cuando ya no lo usa nadie.
 */

import { loadSampleBank } from './music-samples.js?v=20260922172926';

// La escena vieja (y su crossfade) puede seguir usando el banco anterior un rato
const OLD_BANK_GRACE_MS = 15000;

/** Juego de sonidos completo a partir de uno parcial. */
export function resolveSounds(sounds) {
    return Object.assign({}, self.XiroMusic.sampleMap.DEFAULT_SOUNDS, sounds);
}

/** Banco de arranque del motor (en segundo plano) y su reverb. Resuelve con el motor. */
export function loadInitialSounds(engine) {
    if (engine.sounds.reverb !== 'generated') applyReverb(engine.mixer, engine.sounds);
    return loadSampleBank(engine.Tone, engine.sounds).then((bank) => {
        useBank(engine, bank);
        if (!bank) engine.emit('warn', 'No se pudieron cargar las muestras: se usan instrumentos sintetizados');
        return engine;
    });
}

/** Banco nuevo en el motor: los avisos lo usan ya y la escena que suena se rehace con él. */
function useBank(engine, bank) {
    engine.bank = bank;
    engine.cues.useBank(bank);
    if (engine.sceneName !== 'idle') engine.setScene(engine.sceneName, { force: true });
}

/** Aplica la reverb del juego (generada o sala real). */
export function applyReverb(mixer, sounds) {
    const map = self.XiroMusic.sampleMap;
    const file = map.REVERBS[sounds.reverb];
    return mixer.setReverb(file ? map.BASE_URL + file : null).catch(() => mixer.setReverb(null));
}

/**
 * Cambia el juego de sonidos del motor. Si cambian metales, melodía, bajo o batería, descarga el
 * banco nuevo y rehace la escena; la reverb cambia al momento.
 * @returns {Promise<object>} el juego de sonidos aplicado
 */
export async function switchSounds(engine, partial) {
    const before = engine.sounds;
    const next = resolveSounds(Object.assign({}, before, partial));
    engine.sounds = next;
    if (next.reverb !== before.reverb) await applyReverb(engine.mixer, next);
    if (['brass', 'melody', 'bass', 'drums'].every((group) => next[group] === before[group])) return next;
    const bank = await loadSampleBank(engine.Tone, next);
    if (engine.sounds !== next) {
        if (bank) bank.dispose(); // otro cambio llegó antes de terminar este
        return engine.sounds;
    }
    const old = engine.bank;
    useBank(engine, bank);
    if (old) setTimeout(() => old.dispose(), OLD_BANK_GRACE_MS);
    if (!bank) engine.emit('warn', 'No se pudo cargar ese juego de muestras: se usan instrumentos sintetizados');
    return next;
}
