/**
 * @fileoverview Precarga de los vídeos de las diapositivas de vídeo (solo presentador).
 *
 * Los archivos de vídeo se descargan en <video preload="auto"> ocultos, uno detrás de
 * otro y solo los LOOKAHEAD siguientes, para no competir con la red de la partida.
 * Al llegar su diapositiva, el elemento ya cargado se mueve a la pantalla
 * (takePreloadedVideo) y arranca al instante. YouTube, Vimeo y Dailymotion no se
 * pueden guardar: solo se abre antes la conexión con su servidor (preconnect).
 */

const LOOKAHEAD = 2;
const LOAD_TIMEOUT_MS = 90000;
const HOLDER_ID = 'video-preload-holder';
// Fuera de pantalla y no con display:none: Safari no precarga vídeos ocultos así
const HOLDER_STYLE =
    'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';

let videoSlides = [];
const pool = new Map();
let queue = [];
let loadingUrl = null;
const preconnected = new Set();

function getHolder() {
    let holder = document.getElementById(HOLDER_ID);
    if (!holder) {
        holder = document.createElement('div');
        holder.id = HOLDER_ID;
        holder.setAttribute('aria-hidden', 'true');
        holder.style.cssText = HOLDER_STYLE;
        document.body.appendChild(holder);
    }
    return holder;
}

/**
 * Crea un <video> listo para precargar
 * @param {string} url - URL del vídeo
 * @returns {HTMLVideoElement} Elemento video creado
 */
export function createVideoElement(url) {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.src = url;
    return video;
}

/**
 * Corta la descarga y libera la memoria del vídeo
 * @param {HTMLVideoElement} video - Elemento video a liberar
 */
export function releaseVideo(video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
}

function loadNext() {
    if (loadingUrl || queue.length === 0) return;
    const url = queue.shift();
    if (pool.has(url)) {
        loadNext();
        return;
    }
    const video = createVideoElement(url);
    video.muted = true;
    loadingUrl = url;
    pool.set(url, video);
    let timer = null;
    const done = () => {
        if (loadingUrl !== url) return;
        clearTimeout(timer);
        loadingUrl = null;
        loadNext();
    };
    video.addEventListener('canplaythrough', done, { once: true });
    video.addEventListener('error', done, { once: true });
    timer = setTimeout(done, LOAD_TIMEOUT_MS);
    getHolder().appendChild(video);
}

function preconnect(embedUrl) {
    let origin;
    try {
        origin = new URL(embedUrl).origin;
    } catch {
        return;
    }
    if (preconnected.has(origin)) return;
    preconnected.add(origin);
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    document.head.appendChild(link);
}

/**
 * Olvida la partida (nueva partida o fin)
 */
function clearVideoPreloads() {
    pool.forEach(video => releaseVideo(video));
    pool.clear();
    queue = [];
    loadingUrl = null;
    videoSlides = [];
}

/**
 * Mueve la ventana de precarga a los vídeos que siguen al índice actual
 * @param {number} currentIndex - Índice actual de la pregunta
 */
export function advanceVideoPreloads(currentIndex) {
    const upcoming = videoSlides
        .filter(slide => slide.index > currentIndex)
        .slice(0, LOOKAHEAD)
        .map(slide => slide.url);
    const keep = new Set(upcoming);
    pool.forEach((video, url) => {
        if (keep.has(url)) return;
        pool.delete(url);
        if (url === loadingUrl) loadingUrl = null;
        releaseVideo(video);
    });
    queue = upcoming.filter(url => !pool.has(url));
    loadNext();
}

/**
 * Arranca la precarga con todas las preguntas de la partida (game-started)
 * @param {Array} questions - Array de preguntas
 * @param {number} currentIndex - Índice actual de la pregunta
 */
export function planVideoPreloads(questions, currentIndex) {
    clearVideoPreloads();
    const parse = window.XiroVideoSource?.parseVideoSource;
    if (!parse || !Array.isArray(questions)) return;
    questions.forEach((q, index) => {
        if (!q) return;

        // Manejar videos normales
        if (q.slide_type === 'video') {
            const source = parse(q.slide_video);
            if (!source) return;
            if (source.kind === 'file') {
                videoSlides.push({ index, url: source.url });
            } else {
                preconnect(source.embedUrl);
            }
        }

        // Manejar videos en canvas
        if (q.slide_type === 'canvas' && q.slide_canvas && Array.isArray(q.slide_canvas.elements)) {
            q.slide_canvas.elements.forEach(element => {
                if (element && element.type === 'video' && element.video_source) {
                    const source = element.video_source;
                    if (source.kind === 'file') {
                        videoSlides.push({ index, url: source.url });
                    } else {
                        preconnect(source.embedUrl);
                    }
                }
            });
        }
    });
    advanceVideoPreloads(Number.isInteger(currentIndex) ? currentIndex : 0);
}

/**
 * Entrega el vídeo ya cargado de esa URL, o null
 * @param {string} url - URL del vídeo
 * @returns {HTMLVideoElement|null} Elemento video o null si no encontrado
 */
export function takePreloadedVideo(url) {
    const video = pool.get(url);
    if (!video) return null;
    pool.delete(url);
    video.muted = false;
    return video;
}
