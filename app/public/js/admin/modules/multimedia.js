/**
 * @fileoverview Gestión de multimedia (imágenes y audio)
 * Funciones extraídas 1:1 del original admin.js
 */

// ===== FUNCIONES DE MULTIMEDIA =====
async function subirArchivo(qIdx, file) {
    // Validar tipo y tamaño
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isAudio = ALLOWED_AUDIO_TYPES.some(type => file.type.includes(type.split('/')[1]));

    if (!isImage && !isAudio) {
        mostrarModalError(_t('admin.media.error_type_title', null, '❌ Tipo no permitido'), _t('admin.media.error_type_msg', null, 'Solo se permiten imágenes (JPG, PNG, GIF, WebP) y audio (MP3, WAV, OGG)'), 'error');
        return;
    }

    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_AUDIO_SIZE;
    const maxSizeMB = isImage ? '5MB' : '10MB';

    if (file.size > maxSize) {
        mostrarModalError(_t('admin.media.error_size_title', null, '❌ Archivo demasiado grande'), `El archivo excede el límite de ${maxSizeMB}. Tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`, 'error');
        return;
    }

    // Crear FormData
    const formData = new FormData();
    formData.append('file', file);

    // Mostrar indicador de carga
    const uploadBtn = document.getElementById(`upload-btn-${qIdx}`);
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = _tHtml('<i class="fas fa-spinner fa-spin"></i> Subiendo...');
    uploadBtn.disabled = true;

    try {
        const response = await fetchWithAuth('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();

            // Actualizar pregunta con URL del recurso
            preguntasData[qIdx].tipo_contenido = data.tipo_contenido;
            preguntasData[qIdx].url_recurso = data.url;

            mostrarModalError(_t('admin.common.success_title', null, '✅ Éxito'), `Archivo subido correctamente: ${data.filename}`, 'success');
            dibujarPreguntas();
        } else {
            const error = await response.json();
            mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), `Error al subir archivo: ${error.error}`, 'error');
            uploadBtn.innerHTML = _tHtml(originalText);
            uploadBtn.disabled = false;
        }
    } catch (err) {
        console.error('Error subiendo archivo:', err);
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.common.error_server', null, 'Error de conexión al subir el archivo'), 'error');
        uploadBtn.innerHTML = _tHtml(originalText);
        uploadBtn.disabled = false;
    }
}

function eliminarRecurso(qIdx) {
    mostrarModalConfirmacion(
        _t('admin.media.confirm_delete_title', null, '⚠️ Eliminar recurso'),
        _t('admin.media.confirm_delete_msg', null, '¿Deseas eliminar este recurso multimedia?'),
        () => {
            preguntasData[qIdx].tipo_contenido = 'texto';
            preguntasData[qIdx].url_recurso = null;
            dibujarPreguntas();
        },
        null,
        _t('admin.common.delete', null, 'Eliminar'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}

function abrirSelectorArchivo(qIdx) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp,audio/mpeg,audio/mp3,audio/wav,audio/ogg';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            subirArchivo(qIdx, file);
        }
    };
    input.click();
}

/**
 * Inicializar drag-and-drop en todas las cajas de upload
 */
function inicializarDragAndDrop() {
    // Buscar todas las drop-zones
    const dropZones = document.querySelectorAll('[id^="drop-zone-"]');

    dropZones.forEach(dropZone => {
        // Extraer índice de pregunta del ID (drop-zone-0, drop-zone-1, etc)
        const qIdx = parseInt(dropZone.id.split('-')[2]);

        if (isNaN(qIdx)) return;

        // Configurar drag-and-drop usando el módulo
        if (typeof setupDragAndDrop !== 'function') {
            console.warn('setupDragAndDrop not loaded');
            return;
        }

        setupDragAndDrop(dropZone, {
            onFileSelected: (file) => {
                subirArchivo(qIdx, file);
            },
            acceptedTypes: [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'audio/mpeg',
                'audio/mp3',
                'audio/wav',
                'audio/ogg',
                'audio/webm'
            ],
            maxSize: 10 * 1024 * 1024, // 10MB (el mayor de los dos límites)
            dropZoneActiveClass: 'drag-active'
        });
    });
}

// ===== IMAGEN PEQUEÑA DE ENUNCIADO =====

/**
 * Sube una imagen pequeña de enunciado (≤ 25 KB) al servidor
 * y actualiza preguntasData[qIdx].question_image_url
 * @param {number} qIdx - Índice de la pregunta
 * @param {File} file - Archivo de imagen seleccionado
 */
async function subirImagenPregunta(qIdx, file) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        mostrarModalError(
            _t('admin.media.error_type_title', null, '❌ Tipo no permitido'),
            _t('admin.q_img.error_type', null, 'Solo se permiten imágenes JPG, PNG, GIF o WebP para el enunciado'),
            'error'
        );
        return;
    }

    if (file.size > MAX_QUESTION_IMAGE_SIZE) {
        const kbActual = (file.size / 1024).toFixed(1);
        mostrarModalError(
            _t('admin.media.error_size_title', null, '❌ Imagen demasiado grande'),
            _t('admin.q_img.error_size', null, `La imagen supera los 200 KB (tamaño actual: ${kbActual} KB). Usa una imagen de máximo 200×200 px.`).replace('${kbActual}', kbActual),
            'error'
        );
        return;
    }

    const btnId = `q-img-btn-${qIdx}`;
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.innerHTML = _tHtml('<i class="fas fa-spinner fa-spin"></i> Subiendo...');
        btn.disabled = true;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetchWithAuth('/api/upload/question-image', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            preguntasData[qIdx].question_image_url = data.url;
            dibujarPreguntas();
        } else {
            const error = await response.json();
            mostrarModalError(
                _t('admin.common.error_title', null, '❌ Error'),
                error.error || _t('admin.q_img.error_upload', null, 'Error al subir la imagen del enunciado'),
                'error'
            );
            if (btn) {
                btn.innerHTML = _tHtml('<i class="fas fa-image mr-1"></i> Subir imagen');
                btn.disabled = false;
            }
        }
    } catch (err) {
        console.error('Error subiendo imagen de enunciado:', err);
        mostrarModalError(
            _t('admin.common.error_title', null, '❌ Error'),
            _t('admin.common.error_server', null, 'Error de conexión al subir la imagen'),
            'error'
        );
        if (btn) {
            btn.innerHTML = _tHtml('<i class="fas fa-image mr-1"></i> Subir imagen');
            btn.disabled = false;
        }
    }
}

/**
 * Elimina la imagen de enunciado de una pregunta
 * @param {number} qIdx - Índice de la pregunta
 */
function eliminarImagenPregunta(qIdx) {
    preguntasData[qIdx].question_image_url = null;
    dibujarPreguntas();
}

/**
 * Abre el selector de archivo para la imagen de enunciado
 * @param {number} qIdx - Índice de la pregunta
 */
function abrirSelectorImagenPregunta(qIdx) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            subirImagenPregunta(qIdx, file);
        }
    };
    input.click();
}

// ===== IMAGEN PEQUEÑA DE OPCIÓN DE RESPUESTA =====

/**
 * Handler seguro para subida de imágenes (usado por data-admin-change para evitar CSP unsafe-inline)
 * @param {HTMLInputElement} input - Elemento input file
 * @param {number} qIdx - Índice de la pregunta
 * @param {number} oIdx - Índice de la opción
 */
function onImagenOpcionChange(input, qIdx, oIdx) {
    if (input && input.files && input.files.length > 0) {
        subirImagenOpcion(qIdx, oIdx, input.files[0]);
        input.value = ''; // limpiar input para permitir subir la misma imagen de nuevo
    }
}

/**
 * Sube una imagen pequeña de opción de respuesta (≤ 25 KB) al servidor
 * y actualiza preguntasData[qIdx].options[oIdx].option_image_url
 * @param {number} qIdx - Índice de la pregunta
 * @param {number} oIdx - Índice de la opción
 * @param {File} file - Archivo de imagen seleccionado
 */
async function subirImagenOpcion(qIdx, oIdx, file) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        mostrarModalError(
            _t('admin.media.error_type_title', null, '❌ Tipo no permitido'),
            _t('admin.q_img.error_type', null, 'Solo se permiten imágenes JPG, PNG, GIF o WebP'),
            'error'
        );
        return;
    }

    if (file.size > MAX_QUESTION_IMAGE_SIZE) {
        const kbActual = (file.size / 1024).toFixed(1);
        mostrarModalError(
            _t('admin.media.error_size_title', null, '❌ Imagen demasiado grande'),
            `La imagen supera los 200 KB (${kbActual} KB). Usa una imagen de máximo 200×200 px.`,
            'error'
        );
        return;
    }

    const btnId = `opt-img-btn-${qIdx}-${oIdx}`;
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetchWithAuth('/api/upload/question-image', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            preguntasData[qIdx].options[oIdx].option_image_url = data.url;
            dibujarPreguntas();
        } else {
            const error = await response.json();
            mostrarModalError(
                _t('admin.common.error_title', null, '❌ Error'),
                error.error || 'Error al subir la imagen de la opción',
                'error'
            );
            if (btn) { btn.innerHTML = '<i class="fas fa-image"></i>'; btn.disabled = false; }
        }
    } catch (err) {
        console.error('Error subiendo imagen de opción:', err);
        mostrarModalError(
            _t('admin.common.error_title', null, '❌ Error'),
            _t('admin.common.error_server', null, 'Error de conexión al subir la imagen'),
            'error'
        );
        if (btn) { btn.innerHTML = '<i class="fas fa-image"></i>'; btn.disabled = false; }
    }
}

/**
 * Elimina la imagen de una opción de respuesta
 * @param {number} qIdx - Índice de la pregunta
 * @param {number} oIdx - Índice de la opción
 */
function eliminarImagenOpcion(qIdx, oIdx) {
    preguntasData[qIdx].options[oIdx].option_image_url = null;
    dibujarPreguntas();
}

/**
 * Abre el selector de archivo para la imagen de una opción
 * @param {number} qIdx - Índice de la pregunta
 * @param {number} oIdx - Índice de la opción
 */
function abrirSelectorImagenOpcion(qIdx, oIdx) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            subirImagenOpcion(qIdx, oIdx, file);
        }
    };
    input.click();
}
