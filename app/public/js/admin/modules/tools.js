/**
 * @fileoverview Herramientas de administración y utilidades
 * Código extraído 1:1 del original admin.js
 */

// ===== PANIC RESTART =====

function panicRestart() {
    if (!isAdmin()) {
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.tools.panic_no_perm', null, 'No tienes permisos para usar el botón PANIC'), 'error');
        return;
    }

    executeWithUnsavedChangesGuard(() => {
        mostrarModalConfirmacion(
            _t('admin.tools.panic_title', null, '⚠️ ADVERTENCIA'),
            _t('admin.tools.panic_message', null, 'Esto reiniciará el contenedor Docker completo inmediatamente. Todas las partidas activas se perderán. ¿Continuar?'),
            async () => {
                try {
                    await fetchWithAuth('/api/panic-restart', { method: 'POST' });
                    mostrarModalError(_t('admin.tools.panic_success_title', null, '✅ Contenedor reiniciando'), _t('admin.tools.panic_success_msg', null, 'El contenedor Docker está reiniciando. La página se recargará en ~10 segundos...'), 'success');
                } catch (err) {
                    console.log('Contenedor reiniciando...');
                }
                setTimeout(() => { location.reload(); }, 10000);
            },
            null,
            _t('admin.tools.reload_btn', null, 'Reiniciar'),
            _t('admin.common.cancel', null, 'Cancelar')
        );
    });
}

// ===== REINICIAR SERVIDOR (pm2 reload) =====

function reloadServer() {
    if (!isAdmin()) {
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.tools.reload_no_perm', null, 'No tienes permisos para reiniciar el servidor'), 'error');
        return;
    }
    mostrarModalConfirmacion(
        _t('admin.tools.reload_title', null, '🔄 Reiniciar Servidor'),
        _t('admin.tools.reload_message', null, 'Recargará los workers del servidor uno a uno (pm2 reload). Las partidas activas pueden sufrir una breve interrupción. ¿Continuar?'),
        async () => {
            try {
                await fetchWithAuth('/api/admin/reload-server', { method: 'POST' });
                mostrarModalError(_t('admin.tools.reload_success_title', null, '✅ Recargando'), _t('admin.tools.reload_success_msg', null, 'Los workers se están recargando. La página se recargará en ~5 segundos...'), 'success');
            } catch (err) {
                console.log('Servidor recargando...');
            }
            setTimeout(() => { location.reload(); }, 5000);
        },
        null,
        _t('admin.tools.reload_btn', null, 'Reiniciar'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}

// ===== LIMPIAR ARCHIVOS HUÉRFANOS =====

function limpiarArchivosHuerfanos() {
    if (!isAdmin()) {
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.tools.cleanup_no_perm', null, 'No tienes permisos para limpiar archivos'), 'error');
        return;
    }

    mostrarModalConfirmacion(
        _t('admin.tools.cleanup_title', null, '⚠️ Confirmación'),
        _t('admin.tools.cleanup_message', null, '¿Estás seguro de que quieres eliminar los archivos huérfanos de uploads? Esta acción no se puede deshacer.'),
        async () => {
            try {
                const response = await fetchWithAuth('/api/uploads/cleanup', { method: 'POST' });
                const data = await response.json();

                if (data.success) {
                    if (data.deleted === 0) {
                        mostrarModalError(_t('admin.common.success_title', null, '✅ Éxito'), _t('admin.tools.cleanup_no_orphans', null, 'No se encontraron archivos huérfanos'), 'success');
                    } else {
                        mostrarModalError(_t('admin.common.success_title', null, '✅ Éxito'), `${data.message}`, 'success');
                    }
                } else {
                    mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), `${_t('admin.tools.error_prefix', null, 'Error:')} ${data.error}`, 'error');
                }
            } catch (err) {
                console.error('Error al limpiar archivos:', err);
                mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.common.error_server', null, 'Error de conexión con el servidor'), 'error');
            }
        },
        null,
        _t('admin.tools.cleanup_btn', null, 'Eliminar'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}

// ===== LIMPIAR CACHÉ =====

function limpiarCache() {
    if (!isAdmin()) {
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.tools.cache_no_perm', null, 'No tienes permisos para limpiar la caché'), 'error');
        return;
    }

    mostrarModalConfirmacion(
        _t('admin.tools.cache_title', null, '🧹 Limpiar Caché de Juegos'),
        _t('admin.tools.cache_message', null, '¿Estás seguro de que quieres limpiar la caché de juegos de la base de datos? Esto fuerza a recargar los juegos en la próxima petición.'),
        async () => {
            try {
                const response = await fetchWithAuth('/api/admin/clear-cache', { method: 'POST' });
                const data = await response.json();

                if (data.success) {
                    const gamesCleared = data.cleared.games || 0;
                    const removedLabel = gamesCleared === 1
                        ? _t('admin.tools.cache_removed_single', null, 'juego eliminado')
                        : _t('admin.tools.cache_removed_plural', null, 'juegos eliminados');
                    mostrarModalError(
                        _t('admin.tools.cache_success_title', null, '✅ Caché Limpiada'),
                        `${_t('admin.tools.cache_success_prefix', null, 'Caché de juegos limpiada exitosamente.')} ${gamesCleared} ${removedLabel} ${_t('admin.tools.cache_suffix', null, 'de la caché.')}`,
                        'success'
                    );
                } else {
                    mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), `${_t('admin.tools.cache_error_prefix', null, 'Error al limpiar caché:')} ${data.error}`, 'error');
                }
            } catch (err) {
                console.error('Error limpiando caché:', err);
                mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.common.error_server', null, 'Error de conexión con el servidor'), 'error');
            }
        },
        null,
        _t('admin.tools.cache_btn', null, 'Limpiar Caché'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}

// ===== CARGAR PREGUNTAS DESDE JSON =====

const AI_PROMPT_GENERAR_BANCO_FALLBACK = `Actúa como un generador experto de bancos de preguntas para la plataforma Xiro!.

Te he subido un archivo llamado schema.json que define la estructura exacta (campos, tipos de datos y formato) que debe tener un banco de preguntas válido.

Tu tarea:
1. Lee y analiza schema.json con atención: identifica los campos obligatorios, los tipos de pregunta soportados y el formato exacto de cada uno (incluyendo mayúsculas/minúsculas de las claves).
2. Debajo de este mensaje te voy a pegar una lista de preguntas y respuestas en texto libre.
3. Transforma esa lista en un ÚNICO objeto JSON que cumpla EXACTAMENTE la estructura de schema.json: mismos nombres de campo, mismos tipos de dato y misma jerarquía.
4. Si no indico el tipo de una pregunta, asume "quiz" (solo una correcta) con 4 opciones donde solo una es correcta.
5. Si el texto de alguna pregunta o respuesta es demasiado largo para leerse cómodamente en pantalla, recórtalo manteniendo su sentido y sus palabras clave. Aplícalo tanto a las preguntas como a las respuestas, sin alterar cuál es la respuesta correcta.
6. No añadas campos que no existan en el esquema ni omitas los obligatorios. No incluyas comentarios ni explicaciones.
7. En las preguntas "numeric_approximation": "correctAnswer" debe ser un número ENTERO, sin decimales (si el dato real tiene decimales, reformula la pregunta en otra unidad o redondéalo e indícalo en el enunciado); "maxPoints" debe ser un entero mayor que 0 (usa 100); "toleranceMode" debe ser "absolute", "percentage" o "hybrid"; "toleranceValue" y "toleranceCap" deben ser números MAYORES QUE 0, nunca 0 ni negativos, ajustados a la magnitud de la respuesta.
8. En las preguntas "word_scramble": "correctWord" debe ser UNA sola palabra en MAYÚSCULAS con EXACTAMENTE entre 7 y 10 letras, ni más ni menos, sin espacios, guiones, números ni signos. Si la respuesta no cumple esa longitud, elige otra palabra o reformula la pregunta.
9. Devuélveme SOLO el JSON final, válido y bien formado, listo para guardarlo como archivo .json.

Lista de preguntas y respuestas:
`;

function getPromptIA() {
    return _t('admin.tools.upload_ai_prompt', null, AI_PROMPT_GENERAR_BANCO_FALLBACK);
}

function copiarPromptIA() {
    navigator.clipboard.writeText(getPromptIA()).then(() => {
        const btn = document.getElementById('copyPromptBtn');
        if (!btn) return;
        const original = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-check mr-2"></i>${_t('admin.tools.upload_ai_prompt_copied', null, 'Copiado')}`;
        setTimeout(() => { btn.innerHTML = original; }, 2000);
    });
}

function mostrarCargarPreguntas() {
    executeWithUnsavedChangesGuard(() => {
        mostrarCargarPreguntasInner();
    });
}

function mostrarCargarPreguntasInner() {
    activeView = null; // Salir de la vista de grid
    if (typeof highlightSidebarNav === 'function') highlightSidebarNav('cargar-preguntas');
    const editorArea = document.getElementById('editorArea');
    editorArea.innerHTML = _tHtml(`
                <div class="h-full overflow-y-auto p-12">
                    <div class="w-[90%] mx-auto mb-6">
                        <div class="bg-gradient-to-br from-plum-50 to-white rounded-2xl shadow-lg p-8 border border-plum-100">
                            <label class="block text-slate-700 font-bold mb-3 text-sm uppercase tracking-wide">
                                <i class="fas fa-robot text-plum-600 mr-2"></i>${_t('admin.tools.upload_ai_help_title', null, '¿No tienes el JSON todavía? Genéralo con IA')}
                            </label>
                            <ol class="space-y-4 text-sm text-slate-700 list-decimal list-inside">
                                <li>
                                    ${_t('admin.tools.upload_ai_step1', null, 'Descarga el archivo de esquema:')}
                                    <a href="/data/schema.json" download="schema.json"
                                        class="inline-flex items-center gap-1 ml-1 text-plum-600 hover:text-plum-800 font-bold underline">
                                        <i class="fas fa-download"></i> schema.json
                                    </a>
                                </li>
                                <li>${_t('admin.tools.upload_ai_step2', null, 'Abre tu aplicación de Inteligencia Artificial favorita (ChatGPT, Claude, Gemini...) y sube el archivo schema.json que has descargado.')}</li>
                                <li>
                                    ${_t('admin.tools.upload_ai_step3', null, 'Copia y pégale el siguiente prompt:')}
                                    <div class="relative mt-2">
                                        <pre id="aiPromptText" class="bg-slate-900 text-slate-100 text-xs rounded-lg p-4 pr-24 overflow-x-auto whitespace-pre-wrap font-mono"></pre>
                                        <button type="button" id="copyPromptBtn"
                                            class="absolute top-2 right-2 bg-plum-600 hover:bg-plum-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition">
                                            <i class="fas fa-copy mr-2"></i>${_t('admin.tools.upload_ai_copy_btn', null, 'Copiar')}
                                        </button>
                                    </div>
                                </li>
                                <li>${_t('admin.tools.upload_ai_step4', null, 'A continuación del prompt, pega tu lista de preguntas y respuestas, y envíaselo a la IA. Descarga el .json que te devuelva y súbelo abajo.')}</li>
                            </ol>
                        </div>
                    </div>
                    <div class="max-w-2xl mx-auto">
                        <!-- Botón volver -->
                        <button data-admin-action="history-back"
                            class="mb-6 text-slate-600 hover:text-plum-600 font-bold flex items-center gap-2 transition">
                            <i class="fas fa-arrow-left"></i>
                            ${_t('admin.common.back', null, 'Volver')}
                        </button>

                        <div class="bg-gradient-to-br from-plum-50 to-white rounded-2xl shadow-lg p-8 border border-plum-100">
                            <div class="flex items-center gap-4 mb-8">
                                <div class="bg-gradient-to-br from-plum-600 to-plum-700 w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                    <i class="fas fa-cloud-upload-alt text-3xl"></i>
                                </div>
                                <div>
                                    <h1 class="text-2xl font-black text-plum-600">${_t('admin.tools.upload_title', null, 'Cargar Banco de Preguntas')}</h1>
                                    <p class="text-slate-500 text-sm">${_t('admin.tools.upload_subtitle', null, 'Importa archivos JSON con preguntas al sistema')}</p>
                                </div>
                            </div>

                            <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mb-6">
                                <label class="block text-slate-700 font-bold mb-3 text-sm uppercase tracking-wide">
                                    <i class="fas fa-file-code text-plum-600 mr-2"></i>${_t('admin.tools.upload_label', null, 'Archivo JSON')}
                                </label>
                                
                                <!-- Área de Drag & Drop -->
                                <div id="dropZone" class="border-3 border-dashed border-plum-300 rounded-xl p-8 text-center bg-plum-50 hover:bg-plum-100 transition-all cursor-pointer mb-4">
                                    <div class="flex flex-col items-center gap-3">
                                        <i class="fas fa-cloud-upload-alt text-5xl text-plum-600"></i>
                                        <p class="text-lg font-bold text-plum-900">${_t('admin.tools.upload_drag', null, 'Arrastra tu archivo JSON aquí')}</p>
                                        <p class="text-sm text-slate-600">${_t('admin.tools.upload_or', null, 'o')}</p>
                                        <button type="button" id="selectFileBtn" class="bg-plum-600 hover:bg-plum-700 text-white px-6 py-3 rounded-lg font-bold transition shadow-lg">
                                            <i class="fas fa-folder-open mr-2"></i>${_t('admin.tools.upload_btn', null, 'Seleccionar archivo')}
                                        </button>
                                        <p class="text-xs text-slate-500 mt-2">${_t('admin.tools.upload_formats', null, 'Formatos aceptados: .json')}</p>
                                    </div>
                                </div>
                                
                                <input type="file" id="fileInput" accept=".json,application/json" class="hidden">
                                
                                <div id="fileInfo" class="hidden bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-3">
                                            <i class="fas fa-file-code text-blue-600 text-2xl"></i>
                                            <div>
                                                <p id="fileName" class="font-bold text-blue-900"></p>
                                                <p id="fileSize" class="text-xs text-blue-600"></p>
                                            </div>
                                        </div>
                                        <button type="button" id="removeFile" class="text-red-500 hover:text-red-700 px-3 py-1 rounded-lg hover:bg-red-50 transition">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mb-8">
                                <label class="block text-slate-700 font-bold mb-3 text-sm uppercase tracking-wide">
                                    <i class="fas fa-lock text-plum-600 mr-2"></i>${_t('admin.tools.upload_pin_label', null, 'PIN del Banco (opcional)')}
                                </label>
                                <input type="text" id="bankPin" maxlength="10" placeholder="${_t('admin.tools.upload_pin_placeholder', null, 'Ej: MEDICOS2025')}"
                                    class="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-plum-500 focus:outline-none focus:ring-2 focus:ring-plum-200 transition font-mono">
                                <p class="text-slate-500 text-xs mt-2 flex items-center gap-1">
                                    <i class="fas fa-info-circle"></i>
                                    ${_t('admin.banks.help_pin', null, 'Si lo dejas vacío, se generará automáticamente un PIN de 6 dígitos')}
                                </p>
                            </div>

                            <div class="flex justify-center">
                                <button data-admin-action="load-bank-from-json"
                                    class="bg-camaleon-600 text-white px-12 py-5 rounded-2xl font-black text-xl hover:bg-camaleon-700 hover:shadow-2xl transition-all transform hover:scale-105 flex items-center gap-3 shadow-lg">
                                    <i class="fas fa-plus-circle text-2xl"></i>
                                    ${_t('admin.tools.upload_create_btn', null, 'Crear Banco de Preguntas')}
                                </button>
                            </div>

                            <div id="resultadoCarga" class="mt-6 hidden rounded-xl border-2"></div>
                        </div>
                    </div>
                </div>
            `);

    // Configurar drag & drop y selección de archivo
    setupFileUpload();

    // Rellenar el prompt de IA y activar el botón de copia
    const aiPromptText = document.getElementById('aiPromptText');
    if (aiPromptText) aiPromptText.textContent = getPromptIA();
    const copyPromptBtn = document.getElementById('copyPromptBtn');
    if (copyPromptBtn) copyPromptBtn.addEventListener('click', copiarPromptIA);
}

// ===== SETUP FILE UPLOAD (DRAG & DROP) =====

function setupFileUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const removeFile = document.getElementById('removeFile');

    // Prevenir comportamiento por defecto del drag & drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Efectos visuales para drag & drop
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('border-plum-500', 'bg-plum-200');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('border-plum-500', 'bg-plum-200');
        });
    });

    // Manejar drop
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFile(files[0]);
    });

    // Clic en zona de drop abre selector
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Clic en botón abre selector
    selectFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    // Manejar selección de archivo
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Botón para remover archivo
    removeFile.addEventListener('click', () => {
        clearFile();
    });

    function handleFile(file) {
        if (!file) return;

        // Validar que sea JSON
        if (!file.name.endsWith('.json') && file.type !== 'application/json') {
            mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.tools.upload_error_type', null, 'Por favor selecciona un archivo JSON válido'), 'error');
            return;
        }

        // Mostrar información del archivo
        fileName.textContent = _t(file.name);
        fileSize.textContent = _t(`${(file.size / 1024).toFixed(2)} ${_t('admin.tools.upload_size_unit_kb', null, 'KB')}`);
        fileInfo.classList.remove('hidden');
        dropZone.classList.add('hidden');

        // Leer el archivo
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                cuestionarioCargado = JSON.parse(e.target.result);

                const resultado = document.getElementById('resultadoCarga');
                resultado.classList.remove('hidden', 'bg-red-100');
                resultado.classList.add('bg-blue-100');
                resultado.innerHTML = _tHtml(`
                    <p class="text-blue-800 font-bold">${_t('admin.tools.upload_file_loaded_prefix', null, '✓ Archivo cargado:')} ${escapeHtml(cuestionarioCargado.name || file.name)}</p>
                    <p class="text-blue-700">${_t('admin.tools.upload_questions_prefix', null, 'Preguntas:')} ${cuestionarioCargado.questions?.length || 0}</p>
                `);
            } catch (err) {
                cuestionarioCargado = null;
                const resultado = document.getElementById('resultadoCarga');
                resultado.classList.remove('hidden', 'bg-blue-100');
                resultado.classList.add('bg-red-100');
                resultado.innerHTML = _tHtml(`<p class="text-red-800">${_t('admin.tools.upload_file_read_error_prefix', null, '❌ Error al leer el archivo:')} ${escapeHtml(err.message)}</p>`);
                clearFile();
            }
        };
        reader.onerror = () => {
            mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.tools.upload_read_error', null, 'Error al leer el archivo'), 'error');
            clearFile();
        };
        reader.readAsText(file);
    }

    function clearFile() {
        cuestionarioCargado = null;
        fileInput.value = '';
        fileInfo.classList.add('hidden');
        dropZone.classList.remove('hidden');

        const resultado = document.getElementById('resultadoCarga');
        resultado.classList.add('hidden');
        resultado.classList.remove('bg-blue-100', 'bg-red-100', 'bg-green-100');
    }
}

// ===== CARGAR BANCO DESDE JSON =====

async function cargarBancoDesdeJSON() {
    const resultado = document.getElementById('resultadoCarga');
    const pin = document.getElementById('bankPin').value.trim();

    if (!cuestionarioCargado) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), _t('admin.tools.upload_no_file', null, 'Debes seleccionar un archivo JSON primero'), 'warning');
        return;
    }

    resultado.classList.remove('hidden', 'bg-green-100', 'bg-red-100', 'bg-blue-100');
    resultado.innerHTML = _tHtml(`<p class="text-slate-600">${_t('admin.tools.upload_creating_bank_prefix', null, 'Creando banco')} "${escapeHtml(cuestionarioCargado.name)}"...</p>`);

    try {
        // Transformar el JSON de formato BD a formato API
        const bankData = {
            id: null,
            name: cuestionarioCargado.name,
            pin: pin || null,
            language: cuestionarioCargado.language || 'es',
            questions: cuestionarioCargado.questions.map(q => mapQuestionForImport(q))
        };

        const res = await fetchWithAuth('/api/banks/save-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bankData)
        });

        const data = await res.json();

        if (res.ok) {
            resultado.classList.add('bg-green-100');
            resultado.innerHTML = _tHtml(`
                        <p class="text-green-800 font-bold text-xl mb-2">${_t('admin.tools.upload_bank_created', null, '✅ Banco creado exitosamente')}</p>
                        <p class="text-green-700">${_t('admin.tools.upload_bank_id_prefix', null, 'ID del banco:')} ${data.id}</p>
                        <p class="text-green-700">${_t('admin.tools.upload_bank_name_prefix', null, 'Nombre:')} ${escapeHtml(cuestionarioCargado.name)}</p>
                        <p class="text-green-700">${_t('admin.tools.upload_questions_prefix', null, 'Preguntas:')} ${cuestionarioCargado.questions.length}</p>
                    `);

            // Volver a la vista de bancos después de 2 segundos
            setTimeout(() => {
                mostrarVista('bancos');
            }, 2000);
        } else {
            // Construir mensaje de error detallado
            let mensaje = data.message || data.error || _t('admin.tools.error_unknown', null, 'Error desconocido');

            if (data.details && Array.isArray(data.details) && data.details.length > 0) {
                const detalles = data.details.filter(d => d && d.trim()).join('\n  • ');
                mensaje += '\n\n  • ' + detalles;
            }

            // Agregar información de debugging en consola
            console.error('Error al cargar banco:', {
                error: data.error,
                message: data.message,
                details: data.details,
                bankData: bankData
            });

            mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), mensaje, 'error');
        }
    } catch (err) {
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), `${_t('admin.tools.upload_server_error_prefix', null, 'No se pudo conectar con el servidor:')} ${err.message}`, 'error');
    }
}

// ===== EXPORTAR JUEGO A PDF =====

async function exportarJuegoAPDF(gameId, gameName) {
    try {
        // Mostrar indicador de carga
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'pdf-loading';
        loadingDiv.className = 'fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center';
        loadingDiv.innerHTML = _tHtml(`
            <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
                <div class="w-16 h-16 border-4 border-plum-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h3 class="text-xl font-bold text-slate-800 mb-2">${_t('admin.tools.pdf_generating', null, 'Generando PDF...')}</h3>
                <p class="text-slate-600">${_t('admin.tools.pdf_please_wait', null, 'Por favor espera mientras se genera el documento')}</p>
            </div>
        `);
        document.body.appendChild(loadingDiv);

        // Hacer la petición al servidor
        const token = getAuthToken();
        const response = await fetch(`/api/custom-games/${gameId}/export-pdf`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Remover el indicador de carga
        loadingDiv.remove();

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || _t('admin.tools.pdf_generate_error', null, 'Error al generar el PDF'));
        }

        // Descargar el PDF
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${gameName.replace(/[^a-z0-9áéíóúñü\s_-]/gi, '').replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Mostrar mensaje de éxito
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center gap-3';
        successDiv.innerHTML = _tHtml(`
            <i class="fas fa-check-circle text-2xl"></i>
            <span class="font-bold">${_t('admin.tools.pdf_success', null, 'PDF generado correctamente')}</span>
        `);
        document.body.appendChild(successDiv);

        setTimeout(() => {
            successDiv.remove();
        }, 3000);

    } catch (error) {
        console.error('Error exportando PDF:', error);
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), `${_t('admin.tools.pdf_export_error_prefix', null, 'Error al exportar a PDF:')} ${error.message}`, 'error');
    }
}

// ===== BORRAR LOGS DEL BACKEND =====

function borrarLogs() {
    if (!isAdmin()) {
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.tools.logs_no_perm', null, 'No tienes permisos para borrar los logs'), 'error');
        return;
    }

    mostrarModalConfirmacion(
        _t('admin.tools.logs_title', null, '🗑️ Borrar Logs'),
        _t('admin.tools.logs_message', null, '¿Estás seguro de que quieres vaciar todos los archivos de log (backend, Redis y backup)?'),
        async () => {
            try {
                const response = await fetchWithAuth('/api/admin/clear-logs', { method: 'POST' });
                const data = await response.json();

                if (data.success) {
                    const cleared = data.results.filter(r => r.cleared).map(r => r.file).join(', ');
                    const failed = data.results.filter(r => !r.cleared).map(r => r.file).join(', ');
                    let msg = `${_t('admin.tools.logs_deleted_prefix', null, 'Logs borrados:')} ${cleared || _t('admin.tools.logs_none', null, 'ninguno')}`;
                    if (failed) msg += `\n${_t('admin.tools.logs_failed_prefix', null, 'Fallaron:')} ${failed}`;
                    mostrarModalError(_t('admin.tools.logs_success_title', null, '✅ Logs vaciados'), msg, 'success');
                } else {
                    mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), `${_t('admin.tools.error_prefix', null, 'Error:')} ${data.error}`, 'error');
                }
            } catch (err) {
                console.error('Error al borrar logs:', err);
                mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.common.error_server', null, 'Error de conexión con el servidor'), 'error');
            }
        },
        null,
        _t('admin.tools.logs_btn', null, 'Borrar Logs'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}
