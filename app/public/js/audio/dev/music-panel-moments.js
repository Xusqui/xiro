/**
 * @fileoverview Panel de pruebas: revelación (fill y golpe; con «después, al marcador»,
 * el marcador entra en el golpe sin cortar la música) y puestos del podio (3º, 2º, 1º
 * con la escena «podium»).
 */

const $ = (id) => document.getElementById(id);
const revealNext = () => ($('dm-reveal-next').checked ? 'leaderboard' : null);

/**
 * @param {() => object|null} getEngine
 * @param {(msg: string) => void} log
 * @param {{ stop: () => void }} question  Simulador de pregunta (se para al revelar)
 */
export function bindMomentControls(getEngine, log, question) {
    function selectScene(name) {
        document.querySelector(`input[name="dm-scene"][value="${name}"]`).checked = true;
    }

    $('dm-reveal').addEventListener('click', () => {
        const engine = getEngine();
        if (!engine) return;
        question.stop();
        engine.triggerReveal(revealNext());
        log('Revelación programada en el siguiente tiempo');
    });

    $('dm-podium').addEventListener('click', () => {
        const engine = getEngine();
        if (!engine) return;
        selectScene('podium');
        engine.triggerPodium();
        log('Redoble del podio');
    });

    return {
        /** Avisos del motor de estos momentos; true si los ha atendido. */
        onEvent(type, detail) {
            const engine = getEngine();
            if (type === 'reveal') log('Golpe de la revelación');
            else if (type === 'revealDone') {
                log('Stinger terminando: entra el marcador');
                if ($('dm-reveal-next').checked && engine) {
                    selectScene('leaderboard');
                    engine.setScene('leaderboard');
                }
            } else if (type === 'podiumHit') {
                log(`¡Golpe del ${detail}º puesto! (aquí aparece en pantalla)`);
                if (detail === 1) selectScene('podium');
            } else if (type === 'podiumEnd') {
                log('Podio terminado: música parada');
                selectScene('idle');
            } else return false;
            return true;
        }
    };
}
