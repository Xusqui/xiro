/**
 * @fileoverview Drag and Drop Upload Module
 * Gestiona la funcionalidad de arrastrar y soltar archivos para uploads
 * Proporciona feedback visual y validación de archivos
 */

/**
 * Configurar drag-and-drop en un elemento
 * @param {HTMLElement} dropZone - Elemento donde se puede soltar archivos
 * @param {Object} config - Configuración
 * @param {Function} config.onFileSelected - Callback cuando se suelta un archivo válido
 * @param {Array<string>} config.acceptedTypes - Tipos MIME aceptados
 * @param {number} config.maxSize - Tamaño máximo en bytes
 * @param {string} config.dropZoneActiveClass - Clase CSS cuando está activo
 */
function setupDragAndDrop(dropZone, config) {
    const {
        onFileSelected,
        acceptedTypes = [],
        maxSize = 5 * 1024 * 1024,
        dropZoneActiveClass = 'drag-active'
    } = config;

    if (!dropZone) {
        console.warn('setupDragAndDrop: dropZone element not found');
        return;
    }

    // Prevenir comportamiento por defecto en todos los eventos relevantes
    const preventDefaults = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    // Añadir clase visual cuando se arrastra sobre el elemento
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add(dropZoneActiveClass);
        }, false);
    });

    // Remover clase visual cuando se sale del elemento
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove(dropZoneActiveClass);
        }, false);
    });

    // Manejar el drop
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length === 0) return;

        // Solo tomar el primer archivo
        const file = files[0];

        // Validar tipo
        if (acceptedTypes.length > 0 && !isFileTypeAccepted(file, acceptedTypes)) {
            showError('Tipo de archivo no permitido');
            return;
        }

        // Validar tamaño
        if (file.size > maxSize) {
            const maxSizeMB = (maxSize / 1024 / 1024).toFixed(1);
            const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
            showError(`Archivo demasiado grande. Max: ${maxSizeMB}MB, Actual: ${fileSizeMB}MB`);
            return;
        }

        // Archivo válido, ejecutar callback
        if (typeof onFileSelected === 'function') {
            onFileSelected(file);
        }
    }, false);
}

/**
 * Verificar si el tipo de archivo es aceptado
 * @param {File} file - Archivo a validar
 * @param {Array<string>} acceptedTypes - Lista de tipos MIME aceptados
 * @returns {boolean}
 */
function isFileTypeAccepted(file, acceptedTypes) {
    // Verificar tipo exacto
    if (acceptedTypes.includes(file.type)) {
        return true;
    }

    // Verificar wildcards (ej: "image/*", "audio/*")
    for (const type of acceptedTypes) {
        if (type.endsWith('/*')) {
            const category = type.split('/')[0];
            if (file.type.startsWith(category + '/')) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Mostrar mensaje de error temporalmente
 * @param {string} message - Mensaje de error
 */
function showError(message) {
    // Crear toast de error
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-up';
    toast.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fas fa-exclamation-circle"></i>
            <span class="font-bold">${message}</span>
        </div>
    `;

    document.body.appendChild(toast);

    // Remover después de 3 segundos
    setTimeout(() => {
        toast.classList.add('animate-fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Añadir indicador visual de "arrastra aquí" a un elemento
 * @param {HTMLElement} element - Elemento a decorar
 */
function addDragIndicator(element) {
    if (!element) return;

    const indicator = document.createElement('div');
    indicator.className = 'drag-indicator';
    indicator.innerHTML = `
        <div class="flex flex-col items-center justify-center gap-2 text-plum-400">
            <i class="fas fa-cloud-upload-alt text-3xl"></i>
            <p class="text-sm font-bold">Arrastra un archivo aquí</p>
            <p class="text-xs opacity-75">o haz clic para seleccionar</p>
        </div>
    `;

    element.appendChild(indicator);
}

// Export para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setupDragAndDrop,
        isFileTypeAccepted,
        addDragIndicator
    };
}
