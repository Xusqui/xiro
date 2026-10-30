/**
 * @fileoverview Escena del podio 3D: renderer transparente sobre el velo del escenario, luz de
 * estudio con reflejos en los colores de marca, foco ciruela en el suelo y cámara.
 * Sin mapas de sombras: las sombras de contacto son texturas (más baratas en un proyector).
 */

import * as THREE from '/vendor/three/three-0.170.0.module.min.js';
import { CAMERA, cameraPosition, planBlocks } from './podium3d-plan.js?v=20261031120000';
import { createBlock, radialTexture } from './podium3d-blocks.js?v=20261031120000';

const MAX_PIXEL_RATIO = 2;

/** Panel emisivo para el entorno de reflejos (valores > 1 = luz HDR). */
function panel(scene, { w, h, color, intensity, position, lookAt }) {
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    material.color.multiplyScalar(intensity);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(...position);
    mesh.lookAt(...lookAt);
    scene.add(mesh);
}

/**
 * Estudio pequeño que solo sirve para los reflejos: caja oscura, una softbox blanca arriba,
 * ámbar a la izquierda y ciruela a la derecha. Da al oro y al barniz su brillo sin HDRI.
 */
function studioEnvironment(renderer) {
    const room = new THREE.Scene();
    const shell = new THREE.Mesh(
        new THREE.BoxGeometry(14, 9, 14),
        new THREE.MeshBasicMaterial({ color: 0x140d1a, side: THREE.BackSide })
    );
    shell.position.y = 3;
    room.add(shell);
    panel(room, { w: 7, h: 4, color: 0xffffff, intensity: 6, position: [0, 7, 1], lookAt: [0, 0, 0] });
    panel(room, { w: 3, h: 5, color: 0xf9b518, intensity: 3, position: [-6.5, 3, 1], lookAt: [0, 1, 0] });
    panel(room, { w: 3, h: 5, color: 0x94438e, intensity: 3.5, position: [6.5, 3, -1], lookAt: [0, 1, 0] });
    panel(room, { w: 6, h: 2, color: 0xffffff, intensity: 1.4, position: [0, 2, 6.8], lookAt: [0, 1, 0] });

    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromScene(room, 0.035);
    pmrem.dispose();
    room.traverse(obj => {
        if (obj.isMesh) {
            obj.geometry.dispose();
            obj.material.dispose();
        }
    });
    return target;
}

function addLights(scene) {
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a1530, 0.7));
    const key = new THREE.DirectionalLight(0xfff1d6, 2.4);
    key.position.set(-3, 6, 5);
    const rimCoral = new THREE.DirectionalLight(0xe65453, 1.6);
    rimCoral.position.set(4.5, 3, -5);
    const rimPlum = new THREE.DirectionalLight(0xb05baa, 1.4);
    rimPlum.position.set(-4.5, 2.5, -4);
    scene.add(key, rimCoral, rimPlum);
}

/** Foco del suelo: un disco ciruela que se funde con el velo, y un brillo cálido en el centro. */
function addFloor(scene, textures) {
    const make = (radius, map, opacity) => {
        const mesh = new THREE.Mesh(
            new THREE.CircleGeometry(radius, 72),
            new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity })
        );
        mesh.rotation.x = -Math.PI / 2;
        scene.add(mesh);
        return mesh;
    };
    return [make(3.7, textures.plum, 0.9), make(2.4, textures.warm, 0.5)];
}

/**
 * Crea la escena en `canvas` con un bloque por cada uno de los `count` primeros puestos (1-3).
 * `avatarImages[i]` es el avatar cargado del puesto i + 1, o null.
 * Lanza si el navegador no da contexto WebGL2.
 */
export function createPodiumScene(canvas, count, avatarImages = []) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const environment = studioEnvironment(renderer);
    scene.environment = environment.texture;
    addLights(scene);

    const textures = {
        shadow: radialTexture('rgba(0,0,0,0.9)'),
        plum: radialTexture('rgba(104,52,117,0.55)', 'rgba(104,52,117,0)'),
        warm: radialTexture('rgba(255,240,194,0.22)', 'rgba(255,240,194,0)')
    };
    const floor = addFloor(scene, textures);
    const blocks = planBlocks(count).map(spec =>
        createBlock(scene, spec, textures.shadow, avatarImages[spec.place - 1] || null)
    );

    const camera = new THREE.PerspectiveCamera(CAMERA.fov, 16 / 9, 0.1, 80);
    const target = new THREE.Vector3(CAMERA.target.x, CAMERA.target.y, CAMERA.target.z);
    const projected = new THREE.Vector3();

    return {
        scene,
        renderer,
        blocks,
        setSize(width, height) {
            renderer.setSize(width, height, false);
            camera.aspect = width / Math.max(1, height);
            camera.updateProjectionMatrix();
        },
        aspect: () => camera.aspect,
        placeCamera(azimuth, distance) {
            const p = cameraPosition(azimuth, distance);
            camera.position.set(p.x, p.y, p.z);
            camera.lookAt(target);
        },
        /** Punto del mundo a píxeles del lienzo (para anclar las etiquetas HTML). */
        project(x, y, z, width, height) {
            projected.set(x, y, z).project(camera);
            return { x: ((projected.x + 1) / 2) * width, y: ((1 - projected.y) / 2) * height };
        },
        render() {
            renderer.render(scene, camera);
        },
        dispose() {
            blocks.forEach(b => b.dispose());
            floor.forEach(m => {
                m.geometry.dispose();
                m.material.dispose();
            });
            Object.values(textures).forEach(t => t.dispose());
            environment.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
        }
    };
}
