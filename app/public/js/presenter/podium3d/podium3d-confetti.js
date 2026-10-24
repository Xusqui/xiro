/**
 * @fileoverview Confeti 3D del 1º: un InstancedMesh (una sola llamada de dibujo) con física
 * sencilla. Sale de dos cañones junto al bloque, aletea al caer y se queda tumbado en el
 * suelo o encima de los bloques, en vez de desaparecer.
 */

import * as THREE from '/vendor/three/three-0.170.0.module.min.js';
import { CONFETTI_COLORS } from './podium3d-plan.js?v=20261024120000';

const COUNT = 260;
const GRAVITY = -4.6;
const DRAG = 1.7; // por segundo
const TERMINAL = -1.05; // m/s: el papel cae despacio
// Al posarse, cada papel queda en su propia capa (0,8 mm de separación, 48 capas) y un poco
// inclinado: dos papeles en el mismo plano se pelean por el z-buffer y parpadean con la cámara
const REST_Y = 0.008;
const REST_LAYER = 0.0008;
const REST_LAYERS = 48;
const REST_TILT = 0.08; // radianes

export function createConfetti(scene) {
    const geometry = new THREE.PlaneGeometry(0.1, 0.056);
    const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.45, metalness: 0.15 });
    const mesh = new THREE.InstancedMesh(geometry, material, COUNT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const color = new THREE.Color();
    for (let i = 0; i < COUNT; i++) mesh.setColorAt(i, color.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]));

    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    const state = new Uint8Array(COUNT); // 0 apagado, 1 en el aire, 2 tumbado
    const delay = new Float32Array(COUNT);
    const spin = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const axes = Array.from({ length: COUNT }, () => new THREE.Vector3());
    const angles = new Float32Array(COUNT);
    const restQuat = Array.from({ length: COUNT }, () => new THREE.Quaternion());
    const restY = new Float32Array(COUNT);

    const dummy = new THREE.Object3D();
    const euler = new THREE.Euler();
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < COUNT; i++) mesh.setMatrixAt(i, hidden);
    let alive = 0;
    let clock = 0;

    /** Dispara todo el confeti desde (x ± spread, y, z), hacia arriba y hacia el centro. */
    function burst({ x = 0, y = 1, z = 0.5, spread = 1 } = {}) {
        for (let i = 0; i < COUNT; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            pos.set([x + side * spread, y, z], i * 3);
            vel.set([-side * (Math.random() * 2.2 - 0.2), 4 + Math.random() * 2.4, -0.8 + Math.random() * 1.9], i * 3);
            delay[i] = Math.random() * 0.28;
            spin[i] = 5 + Math.random() * 9;
            phase[i] = Math.random() * Math.PI * 2;
            axes[i].set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            angles[i] = Math.random() * Math.PI;
            const tilt = () => (Math.random() * 2 - 1) * REST_TILT;
            restQuat[i].setFromEuler(euler.set(-Math.PI / 2 + tilt(), tilt(), Math.random() * Math.PI * 2));
            restY[i] = REST_Y + (i % REST_LAYERS) * REST_LAYER;
            state[i] = 1;
        }
        alive = COUNT;
    }

    /** Altura del suelo bajo (x, z): el techo de un bloque si cae encima, o 0. */
    function groundAt(x, z, obstacles) {
        for (const o of obstacles) {
            if (x > o.minX && x < o.maxX && z > o.minZ && z < o.maxZ) return o.top;
        }
        return 0;
    }

    function updatePiece(i, dt, obstacles) {
        if (delay[i] > 0) {
            delay[i] -= dt;
            return;
        }
        const k = i * 3;
        const damp = Math.exp(-DRAG * dt);
        vel[k] *= damp;
        vel[k + 2] *= damp;
        vel[k + 1] = Math.max(TERMINAL, vel[k + 1] + GRAVITY * dt);
        const falling = vel[k + 1] < 0;
        const flutter = falling ? Math.sin(clock * 3.1 + phase[i]) * 0.55 : 0;
        pos[k] += (vel[k] + flutter) * dt;
        pos[k + 1] += vel[k + 1] * dt;
        pos[k + 2] += vel[k + 2] * dt;
        angles[i] += spin[i] * dt * (falling ? 0.6 : 1);

        const floor = groundAt(pos[k], pos[k + 2], obstacles);
        if (falling && pos[k + 1] <= floor + restY[i]) {
            pos[k + 1] = floor + restY[i];
            state[i] = 2;
            alive--;
            dummy.quaternion.copy(restQuat[i]);
        } else {
            dummy.quaternion.setFromAxisAngle(axes[i], angles[i]);
        }
        dummy.position.set(pos[k], pos[k + 1], pos[k + 2]);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }

    return {
        burst,
        /** Avanza `dt` segundos. Devuelve true mientras quede confeti en el aire. */
        update(dt, obstacles) {
            if (alive === 0) return false;
            clock += dt;
            for (let i = 0; i < COUNT; i++) if (state[i] === 1) updatePiece(i, dt, obstacles);
            mesh.instanceMatrix.needsUpdate = true;
            return alive > 0;
        },
        dispose() {
            scene.remove(mesh);
            geometry.dispose();
            material.dispose();
            mesh.dispose();
        }
    };
}
