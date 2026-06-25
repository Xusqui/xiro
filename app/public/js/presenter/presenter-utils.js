/**
 * @fileoverview Utilidades UI del presentador
 * Funciones auxiliares para manejo de UI, texto, fullscreen, QR, etc.
 */

// Guardar el HTML original del lobby al cargar la página
let originalLobbyHTML = null;

/**
 * Guardar el HTML original del lobby para poder restaurarlo después
 */
export function saveOriginalLobbyHTML() {
    if (!originalLobbyHTML) {
        const lobbyMain = document.getElementById('lobby-main');
        if (lobbyMain) {
            originalLobbyHTML = lobbyMain.innerHTML;
            console.log('💾 HTML original del lobby guardado');
        }
    }
}

/**
 * Restaurar el HTML original del lobby
 */
export function restoreLobbyHTML() {
    if (originalLobbyHTML) {
        const lobbyMain = document.getElementById('lobby-main');
        if (!lobbyMain) {
            console.warn('⚠️ lobby-main no existe. Creando contenedor de fallback.');
            const fallback = document.createElement('div');
            fallback.id = 'lobby-main';
            fallback.className = 'h-full flex flex-col p-6';
            fallback.style.width = 'calc(100% - 200px)';
            document.body.appendChild(fallback);
            fallback.innerHTML = _tHtml(originalLobbyHTML);
        } else {
            lobbyMain.innerHTML = _tHtml(originalLobbyHTML);
        }
        showAbandonButton();
        console.log('✅ HTML del lobby restaurado');
    }
}

/**
 * Helper para mostrar el lobby-main y actualizar su contenido
 * Evita FOUC (Flash of Unstyled Content)
 */
export function mostrarLobbyMain(htmlContent) {
    const lobbyMain = document.getElementById('lobby-main');
    if (!lobbyMain) {
        console.warn('⚠️ lobby-main no existe. Creando contenedor de fallback.');
        const fallback = document.createElement('div');
        fallback.id = 'lobby-main';
        fallback.className = 'h-full flex flex-col p-6';
        fallback.style.width = 'calc(100% - 200px)';
        fallback.innerHTML = _tHtml(htmlContent);
        document.body.appendChild(fallback);
        return;
    }
    lobbyMain.innerHTML = _tHtml(htmlContent);
    lobbyMain.style.display = 'flex';

    // Mostrar el botón de abandonar cuando lobby-main está visible
    showAbandonButton();
}

/**
 * Genera un sessionId único en formato PIN-XXXX
 * @param {string} pin - PIN del juego
 * @returns {string} sessionId en formato PIN-XXXX
 */
export function generateSessionId(pin) {
    const randomNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${pin.toUpperCase()}-${randomNumber}`;
}

/**
 * Ajusta el tamaño del texto de las opciones automáticamente
 */
export function adjustTextSize() {
    const optionTexts = document.querySelectorAll('.option-text');

    optionTexts.forEach(textElement => {
        const parent = textElement.parentElement;
        if (!parent) return;

        // Obtener dimensiones del contenedor
        const containerWidth = parent.clientWidth - 100;
        const containerHeight = parent.clientHeight - 40;

        // Tamaños a probar en orden descendente
        const sizes = [
            Math.min(containerHeight * 0.35, containerWidth * 0.08),
            Math.min(containerHeight * 0.30, containerWidth * 0.07),
            Math.min(containerHeight * 0.25, containerWidth * 0.06),
            Math.min(containerHeight * 0.22, containerWidth * 0.05),
            Math.min(containerHeight * 0.18, containerWidth * 0.04),
            Math.min(containerHeight * 0.15, containerWidth * 0.035),
            Math.min(containerHeight * 0.12, containerWidth * 0.03),
            Math.min(containerHeight * 0.10, containerWidth * 0.025)
        ];

        // Probar cada tamaño hasta encontrar uno que quepa
        let optimalSize = sizes[sizes.length - 1];
        for (let size of sizes) {
            textElement.style.fontSize = size + 'px';

            if (textElement.scrollHeight <= containerHeight &&
                textElement.scrollWidth <= containerWidth) {
                optimalSize = size;
                break;
            }
        }

        textElement.style.fontSize = optimalSize + 'px';
    });
}

/**
 * Ajusta el tamaño del título de la pregunta para que no exceda ~20% de la altura
 */
export function adjustQuestionTitleSize() {
    const title = document.getElementById('question-title');
    if (!title) return;

    const maxHeight = window.innerHeight * 0.20;
    let fontSize = Math.min(48, Math.max(24, window.innerWidth * 0.03));

    title.style.fontSize = fontSize + 'px';
    title.style.lineHeight = '1.15';

    // Reducir gradualmente hasta que quepa
    while (title.scrollHeight > maxHeight && fontSize > 16) {
        fontSize -= 2;
        title.style.fontSize = fontSize + 'px';
    }
}

/**
 * Mostrar código QR del juego
 * @param {string} sessionIdParam - ID de sesión
 */
export function mostrarQR(sessionIdParam) {
    const overlay = document.createElement('div');
    overlay.id = 'qr-overlay';
    overlay.className = 'fixed inset-0 bg-slate-900/95 flex items-center justify-center z-50 backdrop-blur-sm';

    const joinUrl = `${window.location.protocol}//${window.location.host}/join.html?session=${sessionIdParam}`;

    overlay.innerHTML = _tHtml(`
        <div class="bg-white rounded-3xl p-12 max-w-md shadow-2xl relative">
            <button data-presenter-action="close-overlay" data-overlay-id="qr-overlay" 
                class="absolute top-4 right-4 w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition">
                <i class="fas fa-times text-slate-600"></i>
            </button>
            
            <h2 class="text-3xl font-black text-center mb-6 text-slate-800">
                <i class="fas fa-qrcode mr-2"></i>Escanea para unirte
            </h2>
            
            <div id="qr-code-container" class="bg-white p-4 rounded-2xl mb-6 flex items-center justify-center"></div>
            
            <div class="text-center space-y-3">
                <p class="text-sm text-slate-500">O visita:</p>
                <div class="bg-slate-100 rounded-lg px-4 py-3">
                    <p class="font-mono text-sm text-slate-700 break-all">${joinUrl}</p>
                </div>
                <p class="text-xs text-slate-400 mt-2">Sesión: <span class="font-mono">${sessionIdParam}</span></p>
            </div>
        </div>
    `);

    document.body.appendChild(overlay);

    // Generar QR usando qrcodejs
    if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById('qr-code-container'), {
            text: joinUrl,
            width: 256,
            height: 256,
            colorDark: '#1e293b',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    }
}

/**
 * Toggle fullscreen
 */
export function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error('Error al activar fullscreen:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

/**
 * Actualizar ícono de fullscreen
 */
export function updateFullscreenIcon() {
    const icon = document.getElementById('fullscreen-icon');
    if (icon) {
        if (document.fullscreenElement) {
            icon.className = 'fas fa-compress';
        } else {
            icon.className = 'fas fa-expand';
        }
    }
}

/**
 * Remover tarjetas flotantes (animación de respuestas)
 */
export function removeFloatingCards() {
    const existingCards = document.querySelectorAll('.floating-card');
    existingCards.forEach(card => {
        card.style.animation = 'none';
        card.remove();
    });
}

/**
 * Genera el HTML del botón de abandonar juego
 * Para usar en todas las pantallas del presentador
 * @returns {string} HTML del botón de abandonar
 */
export function getAbandonButtonHTML() {
    return `
        <div class="flex justify-center items-center mt-4" style="min-height: 3rem;">
            <button data-presenter-action="abandon-game"
                class="bg-red-900/60 hover:bg-red-800 text-red-100 px-6 py-2.5 rounded-lg transition-all duration-200 shadow-lg backdrop-blur-sm border border-red-700/50"
                title="Abandonar sesión">
                <i class="fas fa-door-open mr-2"></i>Abandonar juego
            </button>
        </div>
    `;
}

/**
 * Muestra el botón de abandonar juego (elemento fixed en HTML)
 * Llamar después de cualquier actualización de lobby-main
 */
export function showAbandonButton() {
    const wrapper = document.getElementById('game-action-btns');
    if (wrapper) wrapper.style.display = 'flex';
}

/**
 * Oculta el contenedor de controles de partida. Resetea el botón Terminar para la siguiente sesión.
 */
export function hideAbandonButton() {
    const wrapper = document.getElementById('game-action-btns');
    if (wrapper) wrapper.style.display = 'none';
    hideTerminateButton();
}

/**
 * Muestra el botón de terminar partida (solo durante juego activo)
 */
export function showTerminateButton() {
    const btn = document.getElementById('terminate-btn');
    if (btn) btn.style.display = 'block';
}

/**
 * Oculta el botón de terminar partida
 */
export function hideTerminateButton() {
    const btn = document.getElementById('terminate-btn');
    if (btn) btn.style.display = 'none';
}

// Listener para cambios en fullscreen
if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', updateFullscreenIcon);
}
