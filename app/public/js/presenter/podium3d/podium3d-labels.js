/**
 * @fileoverview Nombre y puntos de cada puesto como HTML anclado al techo de su bloque:
 * texto nítido a cualquier tamaño y sin texturas. Se recolocan en cada fotograma con la
 * proyección de la cámara (solo transform, sin tocar el layout).
 */

function buildLabel(entry) {
    const root = document.createElement('div');
    root.className = `podium3d-label podium3d-label--p${entry.place}`;
    root.setAttribute('data-i18n-skip', '');

    const body = document.createElement('div');
    body.className = 'podium3d-label-body';

    const name = document.createElement('span');
    name.className = 'podium3d-name';
    name.textContent = entry.name;
    name.title = entry.name;

    // El color del equipo va junto a los puntos: el nombre queda libre para partirse en dos líneas
    const score = document.createElement('span');
    score.className = 'podium3d-points podium-score';
    if (entry.teamClass) {
        const dot = document.createElement('span');
        dot.className = `podium3d-team-dot ${entry.teamClass}`;
        score.appendChild(dot);
    }
    score.appendChild(document.createTextNode(entry.score));

    body.append(name, score);
    root.appendChild(body);
    return root;
}

/**
 * `entries`: [{ place, name, score, teamClass }]. `show(place)` las hace aparecer cuando
 * el bloque ya casi ha subido; `update(anchor)` las coloca en cada fotograma.
 */
export function createLabels(layer, entries) {
    const labels = new Map(entries.map(entry => [entry.place, buildLabel(entry)]));
    labels.forEach(el => layer.appendChild(el));

    return {
        show(place) {
            labels.get(place)?.classList.add('is-shown');
        },
        /** `anchor(place)` → { x, y } en píxeles del lienzo, o null si el bloque no se ve. */
        update(anchor) {
            labels.forEach((el, place) => {
                const p = anchor(place);
                if (!p) return;
                el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
            });
        },
        dispose() {
            labels.forEach(el => el.remove());
            labels.clear();
        }
    };
}
