/**
 * @fileoverview Ajustes de la música del admin (music-settings.js) sobre MusicEngine:
 * opciones de creación (semilla, sonidos, tempo) y lo que se aplica con el motor ya
 * en marcha (tempo, tic-tac, mezcla por capa, sonidos). Lo usan el presentador al
 * arrancar la partida y la escucha previa del panel de administración.
 */

import './music-sample-map.js?v=20260922172926';
import './music-settings.js?v=20260922172926';

const S = () => self.XiroMusic.settings;

/** Ajustes completos (con valores por defecto) a partir de lo guardado. */
export function normalizeMusicSettings(raw) {
    return S().normalize(raw);
}

/** Opciones de loadMusicEngine para una partida: la semilla fija o la de la sesión. */
export function engineOptions(settings, sessionSeed) {
    return { seed: S().seedFor(settings, sessionSeed), sounds: settings.sounds, tempo: settings.tempo };
}

/** Mezcla por capa y tic-tac (al momento). */
export function applyMix(engine, settings) {
    engine.cues.setTickSound(settings.tick);
    S().LAYERS.forEach((layer) => {
        const channel = settings.mix[layer];
        engine.mixer.setLayerVolume(layer, channel.db);
        engine.mixer.setLayerMuted(layer, channel.muted);
    });
}

/**
 * Todo lo aplicable con el motor en marcha. El tempo y la semilla regeneran la escena
 * (entra en el siguiente compás), así que solo se tocan si cambian.
 * @returns {Promise<object>} cuando los sonidos nuevos están cargados
 */
export function applyMusicSettings(engine, settings, seed) {
    applyMix(engine, settings);
    if (S().tempoScale(settings) !== engine.tempoScale) engine.setTempo(settings.tempo);
    if (seed && String(seed) !== engine.seed) engine.setSeed(seed);
    return engine.setSounds(settings.sounds);
}
