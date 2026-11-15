/**
 * Origen de un vídeo (YouTube, Vimeo, Dailymotion o archivo directo): el de XiRo
 * (public/js/core/video-source.js, copiado en lib/xiro/).
 */

import { video } from './xiro.mjs';

export const parseVideoSource = url => video.parseVideoSource(url);
