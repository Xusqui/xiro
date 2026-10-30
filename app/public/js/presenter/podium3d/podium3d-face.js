/**
 * @fileoverview Cara frontal de un bloque del podio 3D: el puesto grabado y, si el jugador
 * tiene avatar, el avatar incrustado debajo en una placa clara. Las medidas salen de
 * faceLayout (podium3d-plan.js); aquí solo se pintan las texturas y los planos.
 */

import * as THREE from '/vendor/three/three-0.170.0.module.min.js';
import { BLOCK, faceLayout } from './podium3d-plan.js?v=20261031120000';

const NUMERAL_FONT = '"Bebas Neue", ui-sans-serif, system-ui, sans-serif';
const TEXTURE_SIZE = 256;

function squareCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    return canvas;
}

function toTexture(canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

/** Puesto grabado: tinta del color del bloque y un filo claro debajo, como un relieve hundido. */
function numeralTexture(place, ink) {
    const size = TEXTURE_SIZE;
    const canvas = squareCanvas();
    const ctx = canvas.getContext('2d');
    ctx.font = `400 ${size * 0.86}px ${NUMERAL_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = size * 0.55;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.fillText(String(place), size / 2, y + 5);
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = ink;
    ctx.fillText(String(place), size / 2, y);
    return toTexture(canvas);
}

/** Avatar sobre una placa redonda clara con un filo oscuro abajo, hundida en la cara. */
function avatarTexture(image) {
    const size = TEXTURE_SIZE;
    const canvas = squareCanvas();
    const ctx = canvas.getContext('2d');
    const r = size * 0.46;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2 + 6, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.fill();
    const inner = size * 0.66;
    ctx.drawImage(image, (size - inner) / 2, (size - inner) / 2, inner, inner);
    return toTexture(canvas);
}

function facePlane(texture, size, y) {
    const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        roughness: 0.55,
        polygonOffset: true,
        polygonOffsetFactor: -2
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    mesh.position.set(0, y, BLOCK.depth / 2 + 0.002);
    return mesh;
}

/**
 * Añade a `block` (el mesh del bloque) el número y, con `avatarImage`, el avatar.
 * Devuelve `dispose()` para liberar geometrías, materiales y texturas.
 */
export function addBlockFace(block, spec, avatarImage) {
    const layout = faceLayout(spec.height, Boolean(avatarImage));
    const planes = [facePlane(numeralTexture(spec.place, spec.ink), layout.numeral.size, layout.numeral.y)];
    if (layout.avatar) planes.push(facePlane(avatarTexture(avatarImage), layout.avatar.size, layout.avatar.y));
    planes.forEach(plane => block.add(plane));
    return {
        dispose() {
            planes.forEach(plane => {
                plane.geometry.dispose();
                plane.material.map.dispose();
                plane.material.dispose();
            });
        }
    };
}
