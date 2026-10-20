/**
 * @fileoverview Escenas disponibles y cómo se generan sus secciones. Lo usa
 * MusicEngine; las funciones puras ya están en self.XiroMusic (el motor las importa
 * antes que este módulo).
 *
 * build(seed, index, options, tension) devuelve la partitura de la sección `index`.
 */

const { arrangement, loops, scores } = self.XiroMusic;

// Mejoras que se pueden apagar por separado (setOption)
export const DEFAULT_OPTIONS = {
    sections: true,
    humanize: true,
    fx: true,
    motif: true,
    cadence: true,
    reactions: true
};

export const SCENES = {
    lobby: {
        bpm: scores.LOBBY.bpm,
        swing: scores.LOBBY.swing,
        build: (seed, index, options) =>
            scores.buildSection(seed, arrangement.planSection(seed, index, options), options)
    },
    // Pregunta: compás a compás, para que cada uno se genere con la tensión del momento;
    // los niveles de capa, el filtro y el tempo los mueve la tensión (MusicEngine.setTension);
    // `question` = { final } de la pregunta (la última entra con timbal y platillo)
    question: {
        bpm: scores.LOBBY.bpm,
        swing: 0.08,
        sectionBars: 1,
        lookahead: 1,
        levelsFromPlan: false,
        build: (seed, index, options, tension, question) =>
            scores.buildSection(seed, arrangement.planQuestionBar(seed, index, tension, question), options)
    },
    // Marcador tras la revelación: entra despacio (relajar la tensión sin cortes)
    leaderboard: {
        bpm: scores.LOBBY.bpm,
        swing: scores.LOBBY.swing,
        fadeInBeats: 8,
        build: (seed, index, options) =>
            scores.buildSection(seed, loops.planLoopSection('leaderboard', seed, index), options)
    },
    // Podio: espera solemne mientras salen los puestos (el redoble y los puestos los pone triggerPodium)
    podium: {
        bpm: scores.LOBBY.bpm,
        swing: scores.LOBBY.swing,
        fadeInBeats: 4,
        build: (seed, index, options) =>
            scores.buildSection(seed, loops.planLoopSection('podium', seed, index), options)
    },
    // Final del podio tras el ganador: tema A, entra de golpe (el tutti)
    podiumFinale: {
        bpm: scores.LOBBY.bpm,
        swing: scores.LOBBY.swing,
        fadeInBeats: 0.25,
        build: (seed, index, options) => scores.buildSection(seed, loops.planPodiumFinale(seed, index), options)
    },
    // Tablero del Trivial: espera tranquila entre tiradas
    board: {
        bpm: scores.LOBBY.bpm,
        swing: scores.LOBBY.swing,
        fadeInBeats: 8,
        build: (seed, index, options) => scores.buildSection(seed, loops.planLoopSection('board', seed, index), options)
    }
};
