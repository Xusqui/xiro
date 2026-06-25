/**
 * @fileoverview Precarga de imágenes con jitter para slides tipo "image"
 *
 * Problema: cuando N jugadores reciben un slide de imagen, todos sus navegadores
 * hacen la petición HTTP simultáneamente → burst de N × tamaño_imagen en un instante.
 *
 * Solución: al inicio del juego el servidor envía la lista de URLs de imágenes
 * de toda la partida (imagePreloads). Cada dispositivo las descarga en segundo
 * plano con un retraso aleatorio. Cuando llega el slide, la imagen ya está en la
 * caché del navegador → carga instantánea y sin pico de red.
 *
 * Con MAX_JITTER_MS = 12000 y 100 jugadores, en lugar de 100 peticiones en <1s
 * se distribuyen ~8-9 peticiones por segundo durante 12 segundos.
 */

/**
 * Máximo jitter adaptado al número de imágenes a precargar.
 * Pocos recursos no necesitan 12 s de dispersión; reducir la espera
 * acelera la caché sin crear picos de red.
 *
 * @param {number} count - Número de imágenes únicas
 * @returns {number} Milisegundos máximos de jitter
 */
function maxJitter(count) {
    if (count <= 10) return 2000;
    if (count <= 30) return 5000;
    return 8000;
}

/**
 * Precarga una lista de URLs de imagen en segundo plano con jitter aleatorio.
 * Inocuo si la lista está vacía o es null.
 *
 * @param {string[]} urls - URLs de imagen a precargar
 */
export function preloadGameImages(urls) {
    if (!Array.isArray(urls) || urls.length === 0) return;

    const unique = [...new Set(urls.filter(Boolean))];
    const jitterMs = maxJitter(unique.length);

    console.debug(`[preloader] ${unique.length} images, maxJitter=${jitterMs}ms`);

    unique.forEach((url, index) => {
        // Jitter aleatorio + offset por índice: evita que múltiples imágenes
        // del mismo juego coincidan aunque el jitter aleatorio sea similar.
        const delay = Math.random() * jitterMs + index * 400;
        setTimeout(() => {
            const img = new Image();
            img.src = url;
        }, delay);
    });
}
