/**
 * @fileoverview Estado de MusicEngine para depurar y para el puente del
 * presentador: escena, sección, tempo, tonalidad, acordes, opciones y tensión.
 */

/** @param {import('./music-engine.js').MusicEngine} engine */
export function engineStatus(engine) {
    const current = engine.director.state.current;
    const section = current ? current.currentSection() : null;
    const plan = section ? section.plan : null;
    return {
        scene: engine.sceneName,
        seed: engine.seed,
        bpm: engine.transport.bpm.value,
        position: engine.transport.position,
        context: engine.Tone.getContext().state,
        section: plan ? { index: plan.index, type: plan.type, cycle: plan.cycle } : null,
        key: plan ? plan.key : null,
        chords: plan ? plan.chords : null,
        options: Object.assign({}, engine.options),
        samples: Boolean(engine.bank),
        sounds: Object.assign({}, engine.sounds),
        paused: engine.paused,
        tension: engine.tension,
        tensionParams: engine.sceneName === 'question' ? engine.lastTensionParams : null
    };
}
