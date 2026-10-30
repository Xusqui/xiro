/**
 * @fileoverview Bloques del podio 3D: caja redondeada con el puesto (y el avatar) en la cara,
 * sombra de contacto en el suelo y onda de aterrizaje. Cada bloque crece desde y = 0.
 */

import * as THREE from '/vendor/three/three-0.170.0.module.min.js';
import { BLOCK } from './podium3d-plan.js?v=20261031120000';
import { addBlockFace } from './podium3d-face.js?v=20261031120000';

/** Rectángulo redondeado centrado en el origen (planta del bloque). */
function roundedRect(width, depth, radius) {
    const w = width / 2;
    const d = depth / 2;
    const r = Math.min(radius, w, d);
    const shape = new THREE.Shape();
    shape.moveTo(-w + r, -d);
    shape.lineTo(w - r, -d);
    shape.quadraticCurveTo(w, -d, w, -d + r);
    shape.lineTo(w, d - r);
    shape.quadraticCurveTo(w, d, w - r, d);
    shape.lineTo(-w + r, d);
    shape.quadraticCurveTo(-w, d, -w, d - r);
    shape.lineTo(-w, -d + r);
    shape.quadraticCurveTo(-w, -d, -w + r, -d);
    return shape;
}

function blockGeometry(height) {
    const { width, depth, radius, bevel } = BLOCK;
    const shape = roundedRect(width - bevel * 2, depth - bevel * 2, radius);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: height - bevel * 2,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 5,
        curveSegments: 10
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, bevel, 0);
    return geometry;
}

/** Degradado radial de `inner` a transparente (sombras de contacto y foco del suelo). */
export function radialTexture(inner = 'rgba(0,0,0,1)', outer = 'rgba(0,0,0,0)') {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(1, outer);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function flatPlane(width, depth, material) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
}

/**
 * Construye un bloque y lo añade a `scene`, con el avatar del jugador en la cara si
 * `avatarImage` es una imagen cargada. Devuelve `setRise` / `setRing` para que el bucle
 * de animación solo toque números.
 */
export function createBlock(scene, spec, shadowTexture, avatarImage = null) {
    const material = new THREE.MeshPhysicalMaterial({
        color: spec.color,
        metalness: spec.metalness,
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.14
    });
    const mesh = new THREE.Mesh(blockGeometry(spec.height), material);
    mesh.position.x = spec.x;

    const face = addBlockFace(mesh, spec, avatarImage);

    const shadowMaterial = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        color: 0x000000,
        transparent: true,
        depthWrite: false,
        opacity: 0
    });
    const shadow = flatPlane(BLOCK.width * 1.9, BLOCK.depth * 2.1, shadowMaterial);
    shadow.position.set(spec.x, 0.002, 0.05);

    const ringMaterial = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 72), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(spec.x, 0.004, 0);
    ring.visible = false;

    mesh.scale.set(1, 0.0001, 1);
    mesh.visible = false;
    scene.add(shadow, ring, mesh);

    return {
        spec,
        /** Altura relativa 0..~1,1 y su aplastamiento en planta. */
        setRise(rise, width) {
            mesh.visible = rise > 0.001;
            mesh.scale.set(width, Math.max(0.0001, rise), width);
            shadowMaterial.opacity = 0.62 * Math.min(1, Math.max(0, rise));
        },
        /** Onda que se abre en el suelo durante 0,8 s desde que el bloque toca. */
        setRing(t) {
            const active = t >= 0 && t < 0.8;
            ring.visible = active;
            if (!active) return;
            const k = t / 0.8;
            ring.scale.setScalar(0.9 + k * 1.6);
            ringMaterial.opacity = 0.75 * (1 - k) * (1 - k);
        },
        /** Altura del techo del bloque en el mundo (para etiquetas y confeti). */
        top() {
            return spec.height * mesh.scale.y;
        },
        dispose() {
            [mesh, shadow, ring].forEach(m => m.geometry.dispose());
            face.dispose();
            [material, shadowMaterial, ringMaterial].forEach(m => m.dispose());
        }
    };
}
