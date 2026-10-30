/**
 * @fileoverview Podio 3D: medidas, colores y curvas de movimiento. Puro (sin three.js ni DOM)
 * para poder probarlo; la escena (podium3d-scene.js) solo lee lo que sale de aquí.
 *
 * Unidades de mundo: el suelo es y = 0 y el 1º queda en x = 0, el 2º a la izquierda y el
 * 3º a la derecha, como en un podio real visto desde el público.
 */

// Colores del escenario (DESIGN.md → Projection Stage Palette): oro, plata y bronce.
// `ink` es el número grabado en la cara del bloque (se pinta con transparencia).
const RANK_STYLES = {
    1: { color: '#fbbf24', ink: '#1c1917', metalness: 0.3, height: 1.6 },
    2: { color: '#e2e8f0', ink: '#64748b', metalness: 0.5, height: 1.15 },
    3: { color: '#d08a4f', ink: '#1c1917', metalness: 0.55, height: 0.82 }
};

// Confeti en la paleta de marca: ciruela, verde camaleón, ámbar, coral y blanco
export const CONFETTI_COLORS = ['#94438e', '#8ab817', '#f9b518', '#e65453', '#ffffff'];

export const BLOCK = { width: 1.5, depth: 1.3, gap: 0.14, radius: 0.16, bevel: 0.06 };

const SLOT_X = { 1: 0, 2: -1, 3: 1 };

/** Bloques que hay que construir para `count` puestos (1-3), en orden de puesto. */
export function planBlocks(count) {
    const places = [1, 2, 3].slice(0, Math.max(0, Math.min(3, count)));
    return places.map(place => ({
        place,
        x: SLOT_X[place] * (BLOCK.width + BLOCK.gap),
        ...RANK_STYLES[place]
    }));
}

const FACE = { fill: 0.86, numeralMax: 0.7, avatarMax: 0.6, gap: 0.03 };

/**
 * Cara frontal de un bloque de altura `height`: tamaño y centro (y) del número grabado y,
 * con `withAvatar`, del avatar debajo. Sin avatar, el número ocupa la cara como siempre.
 * Todo cabe entre y = 0 y y = height.
 */
export function faceLayout(height, withAvatar) {
    if (!withAvatar) return { numeral: { size: Math.min(0.82, height * 0.74), y: height * 0.5 }, avatar: null };
    const usable = height * FACE.fill;
    const numeral = Math.min(FACE.numeralMax, usable * 0.55);
    const avatar = Math.min(FACE.avatarMax, usable - numeral - FACE.gap);
    const top = (height + usable) / 2;
    const numeralY = top - numeral / 2;
    return {
        numeral: { size: numeral, y: numeralY },
        avatar: { size: avatar, y: numeralY - numeral / 2 - FACE.gap - avatar / 2 }
    };
}

/**
 * Muelle amortiguado de 0 a 1: el bloque sube, se pasa un poco y se asienta.
 * `t` en segundos desde que empieza; a partir de 1,6 s devuelve 1.
 */
export function springRise(t, { stiffness = 170, damping = 14 } = {}) {
    if (t <= 0) return 0;
    if (t > 1.6) return 1;
    const omega = Math.sqrt(stiffness);
    const zeta = damping / (2 * omega);
    if (zeta >= 1) return 1 - Math.exp(-omega * t) * (1 + omega * t);
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * omega * t);
    return 1 - decay * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
}

/** Aplastamiento al aterrizar: ancho que compensa la altura para que el bloque «pese». */
export function squashWidth(rise) {
    const stretch = Math.max(0.0001, rise);
    return Math.min(1.12, Math.max(0.9, 1 / Math.sqrt(stretch)));
}

const easeOutCubic = x => 1 - Math.pow(1 - x, 3);

export const CAMERA = {
    fov: 30,
    target: { x: 0, y: 0.78, z: 0 },
    elevation: 0.3, // radianes sobre el horizonte
    fromAzimuth: -0.34,
    toAzimuth: 0.1,
    approachSeconds: 13,
    swayAmplitude: 0.05,
    swayPeriod: 11
};

/** Distancia para que quepa un ancho `span` y un alto `rise` de mundo en un lienzo de aspecto `aspect`. */
export function fitDistance(aspect, { fov = CAMERA.fov, span = 5.6, rise = 3.2 } = {}) {
    const vHalf = (fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * Math.max(0.3, aspect));
    return Math.max(span / 2 / Math.tan(hHalf), rise / 2 / Math.tan(vHalf));
}

/** Ángulo de la cámara en el segundo `t`: barrido lento de izquierda a centro y vaivén suave. */
export function cameraAzimuth(t, reducedMotion = false) {
    if (reducedMotion) return CAMERA.toAzimuth;
    const k = easeOutCubic(Math.min(1, Math.max(0, t / CAMERA.approachSeconds)));
    const base = CAMERA.fromAzimuth + (CAMERA.toAzimuth - CAMERA.fromAzimuth) * k;
    const sway = Math.sin((t / CAMERA.swayPeriod) * Math.PI * 2) * CAMERA.swayAmplitude * k;
    return base + sway;
}

/** Posición de la cámara (radio `distance`) mirando a CAMERA.target. */
export function cameraPosition(azimuth, distance) {
    const flat = Math.cos(CAMERA.elevation) * distance;
    return {
        x: CAMERA.target.x + Math.sin(azimuth) * flat,
        y: CAMERA.target.y + Math.sin(CAMERA.elevation) * distance,
        z: CAMERA.target.z + Math.cos(azimuth) * flat
    };
}

/** Golpe de cámara cuando aterriza el 1º: se acerca un 3 % y vuelve en menos de un segundo. */
export function punchScale(t) {
    if (t <= 0 || t >= 0.9) return 1;
    return 1 - 0.03 * Math.sin((t / 0.9) * Math.PI) * Math.exp(-2.5 * t);
}
