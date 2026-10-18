/**
 * @fileoverview Qué URLs admite la diapositiva de vídeo (archivo, YouTube, Vimeo, Dailymotion) y cómo se reproducen.
 * Expone window.XiroVideoSource y module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    const MAX_URL_LENGTH = 2048;
    const EMBED_ORIGINS = ['https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://player.vimeo.com', 'https://www.dailymotion.com', 'https://geo.dailymotion.com'];
    const FILE_EXTENSIONS = /\.(mp4|m4v|webm|ogv|ogg|mov)$/i;
    const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
    const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
    const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
    const DAILYMOTION_HOSTS = new Set(['dailymotion.com', 'www.dailymotion.com']);
    const YOUTUBE_PATH_PREFIXES = ['/embed/', '/shorts/', '/live/', '/v/'];

    /**
     * @param {string} value - Cadena con segundos de inicio
     * @returns {number} Segundos desde el inicio (0 o más)
     */
    function parseStartSeconds(value) {
        if (!value) return 0;
        const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(value);
        if (!match) return 0;
        const [, h, m, s] = match.map(Number);
        return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    }

    /**
     * @param {string} url - URL de archivo
     * @returns {{kind: string, url: string, id: null, start: number, embedUrl: null}}
     */
    function fileSource(url) {
        return { kind: 'file', url, id: null, start: 0, embedUrl: null };
    }

    /**
     * @param {string} trimmed - Ruta local ya recortada
     * @returns {Object|null} Objeto de archivo o null si inválido
     */
    function parseLocalPath(trimmed) {
        if (trimmed.includes('\\')) return null;
        const path = trimmed.split(/[?#]/)[0];
        if (!FILE_EXTENSIONS.test(path) || /[<>"']/.test(trimmed) || /\s/.test(trimmed)) return null;
        return fileSource(trimmed);
    }

    /**
     * @param {string} trimmed - URL HTTP ya recortada
     * @returns {Object|null} Objeto URL o null si inválido
     */
    function parseHttpUrl(trimmed) {
        try {
            const u = new URL(trimmed);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
            return u;
        } catch {
            return null;
        }
    }

    /**
     * @param {Object} u - Objeto URL
     * @param {string} host - Hostname de la URL
     * @returns {string|null} ID de YouTube o null si inválido
     */
    function youtubeId(u, host) {
        if (host === 'youtu.be') return u.pathname.split('/')[1];
        if (u.pathname === '/watch') return u.searchParams.get('v');
        if (YOUTUBE_PATH_PREFIXES.some(prefix => u.pathname.startsWith(prefix))) {
            const segments = u.pathname.split('/').filter(Boolean);
            return segments[1];
        }
        return null;
    }

    /**
     * @param {Object} u - Objeto URL
     * @param {string} host - Hostname de la URL
     * @param {string} trimmed - URL original recortada
     * @returns {Object|undefined|null} Objeto YouTube o undefined si no es YouTube, null si es YouTube pero inválido
     */
    function parseYouTube(u, host, trimmed) {
        if (!YOUTUBE_HOSTS.has(host) && host !== 'youtu.be') return undefined;
        const id = youtubeId(u, host);
        if (!id || !YOUTUBE_ID.test(id)) return null;
        const start = parseStartSeconds(u.searchParams.get('t') || u.searchParams.get('start'));
        const embedUrl = 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&playsinline=1&modestbranding=1' + (start > 0 ? '&start=' + start : '');
        return { kind: 'youtube', url: trimmed, id, start, embedUrl };
    }

    /**
     * @param {Object} u - Objeto URL
     * @param {string} host - Hostname de la URL
     * @returns {{id: string, hash: (string|null)}} ID y hash de Vimeo
     */
    function vimeoParts(u, host) {
        const segments = u.pathname.split('/').filter(Boolean);
        if (host === 'player.vimeo.com') {
            return { id: segments[1], hash: u.searchParams.get('h') };
        }
        const id = segments[0];
        let hash = null;
        if (segments.length > 1 && /^[a-f0-9]+$/i.test(segments[1])) {
            hash = segments[1];
        }
        return { id, hash };
    }

    /**
     * @param {Object} u - Objeto URL
     * @param {string} host - Hostname de la URL
     * @param {string} trimmed - URL original recortada
     * @returns {Object|undefined|null} Objeto Vimeo o undefined si no es Vimeo, null si es Vimeo pero inválido
     */
    function parseVimeo(u, host, trimmed) {
        if (!VIMEO_HOSTS.has(host)) return undefined;
        const { id, hash } = vimeoParts(u, host);
        if (!id || !/^\d+$/.test(id)) return null;
        const embedUrl = 'https://player.vimeo.com/video/' + id + '?dnt=1' + (hash ? '&h=' + hash : '');
        return { kind: 'vimeo', url: trimmed, id, start: 0, embedUrl };
    }

    /**
     * @param {Object} u - Objeto URL
     * @param {string} host - Hostname de la URL
     * @returns {string|null} Slug de Dailymotion o null si inválido
     */
    function dailymotionSlug(u, host) {
        if (host === 'dai.ly') return u.pathname.slice(1);
        const segments = u.pathname.split('/').filter(Boolean);
        if (segments[0] === 'video') return segments[1];
        if (segments[0] === 'embed' && segments[1] === 'video') return segments[2];
        return null;
    }

    /**
     * @param {Object} u - Objeto URL
     * @param {string} host - Hostname de la URL
     * @param {string} trimmed - URL original recortada
     * @returns {Object|undefined|null} Objeto Dailymotion o undefined si no es Dailymotion, null si es Dailymotion pero inválido
     */
    function parseDailymotion(u, host, trimmed) {
        if (!DAILYMOTION_HOSTS.has(host) && host !== 'dai.ly') return undefined;
        const slug = dailymotionSlug(u, host);
        if (!slug) return null;
        const id = slug.split('_')[0];
        if (!/^[a-z0-9]+$/i.test(id)) return null;
        const embedUrl = 'https://www.dailymotion.com/embed/video/' + id + '?queue-enable=false';
        return { kind: 'dailymotion', url: trimmed, id, start: 0, embedUrl };
    }

    /**
     * @param {string} input - URL o ruta local (/uploads/...)
     * @returns {{kind: string, url: string, id: (string|null), start: number, embedUrl: (string|null)}|null}
     */
    function parseVideoSource(input) {
        if (typeof input !== 'string') return null;
        const trimmed = input.trim();
        if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
        if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return parseLocalPath(trimmed);

        const u = parseHttpUrl(trimmed);
        if (!u) return null;
        const host = u.hostname.toLowerCase();
        for (const parser of PROVIDER_PARSERS) {
            const result = parser(u, host, trimmed);
            if (result !== undefined) return result;
        }
        return FILE_EXTENSIONS.test(u.pathname) ? fileSource(u.href) : null;
    }

    // Cada uno devuelve undefined si la URL no es de su servicio, null si lo es pero no vale
    const PROVIDER_PARSERS = [parseYouTube, parseVimeo, parseDailymotion];

    /**
     * @param {string} input - URL o ruta de archivo
     * @returns {boolean} Si la entrada es una URL válida de video soportada
     */
    function isSupportedVideoUrl(input) {
        return parseVideoSource(input) !== null;
    }

    const api = { parseVideoSource, isSupportedVideoUrl, parseStartSeconds, EMBED_ORIGINS, MAX_URL_LENGTH };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.XiroVideoSource = api;
})(typeof window !== 'undefined' ? window : null);
