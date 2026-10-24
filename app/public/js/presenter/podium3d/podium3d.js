/**
 * @fileoverview Entrada ligera del podio 3D. Decide si se usa (ajuste «Podio 3D» y WebGL2),
 * carga three.js solo al llegar al podio y, si algo falla, avisa para volver al podio de filas.
 * Los puestos que se revelan antes de que acabe la carga se guardan y se aplican al arrancar.
 */

const FONT_WAIT_MS = 1500;
let webgl2 = null;

function supportsWebGL2() {
    if (webgl2 !== null) return webgl2;
    try {
        const gl = document.createElement('canvas').getContext('webgl2');
        webgl2 = Boolean(gl);
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
        webgl2 = false;
    }
    return webgl2;
}

/** true si el admin no ha apagado «Podio 3D» y el navegador tiene WebGL2. */
export function wantsPodium3d(settings = window.__xiroUiSettings) {
    return (settings || {}).podio3d !== false && supportsWebGL2();
}

/** Los tres primeros del ranking con lo que necesitan las etiquetas (`teamClasses`: color → clase). */
export function podiumEntries(ranking, teamClasses = {}) {
    return ranking.slice(0, 3).map((p, i) => ({
        place: i + 1,
        name: String(p.name || ''),
        score: p.scoreLabel || `${p.pts} PTS`,
        teamClass: p.isTeam ? teamClasses[p.color] || 'bg-white/10' : null
    }));
}

/** El número grabado usa Bebas Neue: se espera a la fuente (con tope) antes de pintarlo. */
function fontsReady() {
    if (!document.fonts?.load) return Promise.resolve();
    const wait = new Promise(resolve => setTimeout(resolve, FONT_WAIT_MS));
    return Promise.race([document.fonts.load('400 64px "Bebas Neue"').catch(() => {}), wait]);
}

/**
 * Monta el podio 3D en `stage` (con su <canvas> y la capa .podium3d-labels).
 * `onFail()` se llama una sola vez si no se puede cargar o se pierde el contexto WebGL.
 */
export function mountPodium3d({ stage, entries, onFail }) {
    const revealed = [];
    let runtime = null;
    let destroyed = false;

    function destroy() {
        destroyed = true;
        runtime?.destroy();
        runtime = null;
    }

    function fail(error) {
        if (destroyed) return;
        console.warn('⚠️ Podio 3D no disponible, se muestra el podio de filas:', error);
        destroy();
        onFail();
    }

    Promise.all([import('./podium3d-runtime.js?v=20261024120000'), fontsReady()])
        .then(([mod]) => {
            if (destroyed) return;
            runtime = mod.startPodiumRuntime({ stage, entries, onLost: fail });
            revealed.forEach(place => runtime.reveal(place));
        })
        .catch(fail);

    return {
        reveal(place) {
            if (destroyed || revealed.includes(place)) return;
            revealed.push(place);
            runtime?.reveal(place);
        },
        destroy
    };
}
