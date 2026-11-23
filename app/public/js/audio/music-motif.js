/**
 * @fileoverview Motivo melódico propio de la canción (pestaña «Música» del admin): el mismo
 * formato que genera `music-melody.js` (ritmo de hasta 2 compases y contorno en grados de la
 * escala respecto a la primera nota), pero escrito a mano o por la IA. Datos puros.
 *
 * Export dual (Jest/Node con require; navegador en self.XiroMusic.motif).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.motif = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const LIMITS = { steps: 32, minNotes: 3, maxNotes: 10, minDegree: -4, maxDegree: 7 };

    const isInt = (value) => Number.isInteger(value);

    function slotError(slot, previousEnd) {
        if (!Array.isArray(slot) || slot.length !== 2 || !isInt(slot[0]) || !isInt(slot[1])) {
            return 'Cada nota del motivo es un par [inicio, duración] de enteros';
        }
        if (slot[0] < 0 || slot[1] < 1) return 'Una nota del motivo empieza en 0 o más y dura 1 o más pasos';
        if (slot[0] < previousEnd) return 'Las notas del motivo van en orden y no se solapan';
        return slot[0] + slot[1] > LIMITS.steps ? 'El motivo cabe en 2 compases (32 pasos)' : null;
    }

    function rhythmError(rhythm) {
        let previousEnd = 0;
        for (const slot of rhythm) {
            const error = slotError(slot, previousEnd);
            if (error) return error;
            previousEnd = slot[0] + slot[1];
        }
        return null;
    }

    function contourError(rel) {
        const outOfRange = rel.some((degree) => !isInt(degree) || degree < LIMITS.minDegree || degree > LIMITS.maxDegree);
        if (outOfRange) return `El contorno del motivo usa enteros de ${LIMITS.minDegree} a ${LIMITS.maxDegree}`;
        return rel[0] === 0 ? null : 'El contorno del motivo empieza en 0';
    }

    /**
     * Primer problema del motivo (texto) o null si vale.
     * @param {*} motif { rhythm: [[inicio, duración]…], rel: [grado…] }, pasos de semicorchea.
     * @returns {?string}
     */
    function motifError(motif) {
        if (motif === null || typeof motif !== 'object' || Array.isArray(motif)) return 'El motivo debe ser un objeto';
        const { rhythm, rel } = motif;
        if (!Array.isArray(rhythm) || !Array.isArray(rel)) return 'El motivo necesita ritmo (rhythm) y contorno (rel)';
        if (rhythm.length < LIMITS.minNotes || rhythm.length > LIMITS.maxNotes) {
            return `El motivo tiene de ${LIMITS.minNotes} a ${LIMITS.maxNotes} notas`;
        }
        if (rhythm.length !== rel.length) return 'El ritmo y el contorno del motivo tienen las mismas notas';
        return rhythmError(rhythm) || contourError(rel);
    }

    /**
     * Copia profunda de un motivo válido (solo ritmo y contorno).
     * @param {{rhythm: Array, rel: Array}} motif
     * @returns {{rhythm: Array<Array<number>>, rel: Array<number>}}
     */
    function copyMotif(motif) {
        return { rhythm: motif.rhythm.map((slot) => [slot[0], slot[1]]), rel: motif.rel.slice() };
    }

    return { LIMITS, motifError, copyMotif };
});
