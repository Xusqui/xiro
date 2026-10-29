/**
 * @fileoverview Fuegos artificiales de fondo del podio final, con la configuración del admin.
 */

let fireworksController = null;

/**
 * Cargar configuración de fuegos artificiales
 */
async function loadFireworksConfig() {
    try {
        const response = await fetch('/api/ui-settings');
        if (!response.ok) throw new Error('Error al cargar configuración');
        const settings = await response.json();
        return {
            shellSize: settings.fireworksShellSize !== undefined ? settings.fireworksShellSize : 2,
            finaleMode: settings.fireworksFinaleMode !== false,
            simSpeed: settings.fireworksSimSpeed !== undefined ? settings.fireworksSimSpeed : 1,
            launchIntervalMin:
                settings.fireworksLaunchIntervalMin !== undefined ? settings.fireworksLaunchIntervalMin : 900,
            launchIntervalMax:
                settings.fireworksLaunchIntervalMax !== undefined ? settings.fireworksLaunchIntervalMax : 1500,
            maxFinaleCount: settings.fireworksMaxFinaleCount !== undefined ? settings.fireworksMaxFinaleCount : 32,
            trailIntensity: settings.fireworksTrailIntensity !== undefined ? settings.fireworksTrailIntensity : 0.175,
            starWidth: settings.fireworksStarWidth !== undefined ? settings.fireworksStarWidth : 3,
            sparkWidth: settings.fireworksSparkWidth !== undefined ? settings.fireworksSparkWidth : 1,
            soundEnabled: settings.fireworksSound === true
        };
    } catch (error) {
        console.warn('⚠️ Error al cargar configuración de fuegos, usando defaults:', error);
        return {
            shellSize: 2,
            finaleMode: true,
            simSpeed: 1,
            launchIntervalMin: 900,
            launchIntervalMax: 1500,
            maxFinaleCount: 32,
            trailIntensity: 0.175,
            starWidth: 3,
            sparkWidth: 1,
            soundEnabled: false
        };
    }
}

/**
 * Iniciar fuegos artificiales de fondo
 * @param {{ behindPodium?: boolean }} [options] behindPodium: con el podio 3D, los fuegos
 *   quedan detrás de bloques, título y filas en vez de cubrirlos (fireworks.css)
 */
export async function startFireworks({ behindPodium = false } = {}) {
    // Detener fuegos previos si existen
    if (fireworksController) {
        fireworksController.destroy();
    }

    // Verificar que FireworksController esté disponible
    if (typeof FireworksController === 'undefined') {
        console.warn('⚠️ FireworksController no disponible, fuegos artificiales deshabilitados');
        return;
    }

    try {
        // Cargar configuración
        const config = await loadFireworksConfig();
        console.log('🎆 Configuración de fuegos artificiales:', config);

        // Crear contenedor para fuegos artificiales si no existe
        let fireworksContainer = document.getElementById('fireworks-podium-container');
        if (!fireworksContainer) {
            fireworksContainer = document.createElement('div');
            fireworksContainer.id = 'fireworks-podium-container';
            document.body.appendChild(fireworksContainer);
        }
        fireworksContainer.classList.toggle('fireworks-podium-container--behind', behindPodium);

        // Inicializar controlador con configuración
        fireworksController = new FireworksController('fireworks-podium-container');
        fireworksController.setShellSize(config.shellSize);
        fireworksController.setAutoLaunch(true); // Siempre activo
        fireworksController.setFinaleMode(config.finaleMode);
        fireworksController.simSpeed = config.simSpeed;

        // Configurar intervalos de lanzamiento
        fireworksController.launchIntervalMin = config.launchIntervalMin;
        fireworksController.launchIntervalMax = config.launchIntervalMax;

        // Configurar parámetros avanzados
        fireworksController.maxFinaleCount = config.maxFinaleCount;
        fireworksController.trailIntensity = config.trailIntensity;
        fireworksController.starWidth = config.starWidth;
        fireworksController.sparkWidth = config.sparkWidth;
        fireworksController.transparentTrails = behindPodium;
        fireworksController.setSoundEnabled(config.soundEnabled);

        fireworksController.start();

        console.log('🎆 Fuegos artificiales iniciados con configuración personalizada');
    } catch (error) {
        console.error('❌ Error al iniciar fuegos artificiales:', error);
    }
}

/**
 * Detener y limpiar fuegos artificiales
 */
export function stopFireworks() {
    if (fireworksController) {
        fireworksController.destroy();
        fireworksController = null;

        // Eliminar contenedor
        const container = document.getElementById('fireworks-podium-container');
        if (container) {
            container.remove();
        }

        console.log('🎆 Fuegos artificiales detenidos');
    }
}
