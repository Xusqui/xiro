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
    const preventDefaults = e => {
        e.preventDefault();
        e.stopPropagation();
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    // Añadir clase visual cuando se arrastra sobre el elemento
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(
            eventName,
            () => {
                dropZone.classList.add(dropZoneActiveClass);
            },
            false
        );
    });

    // Remover clase visual cuando se sale del elemento
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(
            eventName,
            () => {
                dropZone.classList.remove(dropZoneActiveClass);
            },
            false
        );
    });

    // Manejar el drop
    dropZone.addEventListener(
        'drop',
        e => {
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
        },
        false
    );
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
 * Indica si un fichero encaja con el atributo accept de un <input type="file">
 * @param {File} file - Fichero a comprobar
 * @param {string} acceptAttr - Ej.: ".json,application/json,image/*"; vacío acepta todo
 * @returns {boolean}
 */
function acceptsFile(file, acceptAttr) {
    const rules = String(acceptAttr || '')
        .split(',')
        .map(rule => rule.trim().toLowerCase())
        .filter(Boolean);
    if (rules.length === 0) return true;
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    return rules.some(rule => {
        if (rule.startsWith('.')) return name.endsWith(rule);
        if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
        return type === rule;
    });
}

/**
 * Convierte un elemento (o, con selector, los descendientes que lo cumplan) en zona de drop.
 * Con selector el escucha va en la zona y no en cada elemento: sirve para bloques que se repintan con innerHTML.
 * Atarla dos veces con el mismo selector no duplica el escucha.
 * @param {EventTarget} zone - Elemento estable que recibe los eventos (puede ser document)
 * @param {Object} options
 * @param {string} [options.accept] - Atributo accept; vacío acepta todo
 * @param {boolean} [options.multiple] - true entrega todos los válidos; false solo el primero
 * @param {Function} options.onFiles - Recibe (files, target) con los ficheros válidos y el elemento que los recibió
 * @param {Function} [options.onReject] - Recibe (files, target) si ninguno es válido; por defecto, un aviso
 * @param {string} [options.activeClass] - Clase mientras se arrastra encima
 * @param {string} [options.selector] - Selector CSS de los elementos que aceptan el drop dentro de zone
 */
function attachFileDrop(zone, options) {
    if (!zone) return;
    const { accept = '', multiple = false, onFiles, onReject, activeClass = 'drag-active', selector } = options;
    const bound = zone._fileDropBound || (zone._fileDropBound = new Set());
    const key = selector || '';
    if (bound.has(key)) return;
    bound.add(key);

    const targetOf = event => {
        if (!selector) return zone;
        const origin = event.target;
        return origin && origin.closest ? origin.closest(selector) : null;
    };
    const markActive = event => {
        const target = targetOf(event);
        if (!target) return;
        event.preventDefault();
        target.classList.add(activeClass);
    };
    const clearActive = event => {
        const target = targetOf(event);
        if (target) target.classList.remove(activeClass);
    };
    const handleDrop = event => {
        const target = targetOf(event);
        if (!target) return;
        event.preventDefault();
        target.classList.remove(activeClass);
        const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
        if (files.length === 0) return;
        const valid = files.filter(file => acceptsFile(file, accept));
        if (valid.length === 0) {
            if (typeof onReject === 'function') onReject(files, target);
            else showError('Tipo de archivo no permitido');
            return;
        }
        onFiles(multiple ? valid : valid.slice(0, 1), target);
    };

    zone.addEventListener('dragenter', markActive);
    zone.addEventListener('dragover', markActive);
    zone.addEventListener('dragleave', clearActive);
    zone.addEventListener('drop', handleDrop);
}

/**
 * Pone ficheros en un <input type="file"> y dispara change, igual que si los hubiera elegido el usuario
 * @param {HTMLInputElement} input
 * @param {File[]} files
 */
function setInputFiles(input, files) {
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Hace que soltar un fichero sobre zone equivalga a elegirlo en el input (respeta su accept y su multiple)
 * @param {HTMLElement} zone - Zona donde se suelta
 * @param {HTMLInputElement} input - Input de archivo cuyo change ya gestiona la subida
 * @param {Object} [options] - Resto de opciones de attachFileDrop (activeClass, onReject)
 */
function forwardDropToInput(zone, input, options = {}) {
    attachFileDrop(zone, {
        ...options,
        accept: input.accept,
        multiple: input.multiple,
        onFiles: files => setInputFiles(input, files)
    });
}

/**
 * Mostrar mensaje de error temporalmente
 * @param {string} message - Mensaje de error
 */
function showError(message) {
    // Crear toast de error
    const toast = document.createElement('div');
    toast.className =
        'fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-up';
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

// Export para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setupDragAndDrop,
        acceptsFile,
        attachFileDrop,
        setInputFiles,
        forwardDropToInput
    };
}
