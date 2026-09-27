/**
 * @fileoverview Funciones compartidas entre módulos
 * dibujarPreguntas y utilidades de renderizado
 * Código extraído 1:1 del original admin.js
 */

window._t = window._t || ((k, v, f) => (window.XiroI18n?.t(k, v, f) ?? f ?? k));

function dibujarPreguntas() {
    const contenedor = document.getElementById('listaPreguntasDOM');
    if (!contenedor) return;

    // SOLUCIÓN AL BUG: Guardar el elemento activo y la posición de scroll antes de re-renderizar
    const activeElement = document.activeElement;
    const activeElementId = activeElement ? activeElement.id : null;
    const parent = contenedor.parentElement;
    const scrollPosition = parent ? parent.scrollTop : 0;
    const windowScrollY = window.scrollY;

    contenedor.innerHTML = preguntasData.map((q, qIdx) => {
        // Inicializar campos multimedia si no existen
        if (!q.tipo_contenido) q.tipo_contenido = 'texto';
        if (!q.url_recurso) q.url_recurso = null;
        if (q.question_image_url === undefined) q.question_image_url = null;
        if (!q.time_limit) q.time_limit = 30;
        if (!q.type) q.type = 'quiz';
        if (q.type === 'numeric_approximation') {
            q.toleranceMode = q.toleranceMode || 'hybrid';
            q.toleranceValue = Number(q.toleranceValue) || 25;
            if (q.toleranceCap === undefined) q.toleranceCap = 1000;
        }

        if (q.type === 'order') {
            ensureOrderIndexes(q);
        }

        if (q.type === 'matching') {
            ensureOrderIndexes(q);
        }

        const isHybridToleranceMode = (q.toleranceMode || 'hybrid') === 'hybrid';

        // Cada tipo de pregunta lleva su propia chip de color, para que se distinga
        // de un vistazo en la lista sin tener que abrir el desplegable. Clases Tailwind
        // completas y literales (no interpoladas) para que el compilador las detecte.
        const typeChip = {
            quiz: 'bg-purple-100 text-purple-700',
            survey: 'bg-blue-100 text-blue-700',
            order: 'bg-green-100 text-green-700',
            matching: 'bg-orange-100 text-orange-700',
            numeric_approximation: 'bg-cyan-100 text-cyan-700',
            word_scramble: 'bg-pink-100 text-pink-700',
            multiple_choice: 'bg-indigo-100 text-indigo-700'
        }[q.type] || 'bg-slate-100 text-slate-600';

        return `
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative animate-fade-in">
                    <button data-admin-click="eliminarPregunta(${qIdx})" class="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition"><i class="fas fa-trash-alt"></i></button>
                    <span class="absolute top-4 right-14 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${typeChip}">${_t(`admin.q.type_${q.type}_short`, null, q.type.replace(/_/g, ' '))}</span>
                    
                    <label class="text-[10px] font-bold text-slate-400 uppercase">${_t('admin.q.label', null, 'Enunciado de la pregunta')} ${qIdx + 1}</label>
                    <input type="text" data-admin-input="preguntasData[${qIdx}].questionText = this.value" value="${escapeHtml(q.questionText || '')}" placeholder="¿Cómo se llama el proceso...?" class="w-full text-lg font-bold border-b-2 border-slate-50 mb-4 focus:border-purple-400 outline-none py-2 transition bg-transparent">

                    <!-- IMAGEN PEQUEÑA DE ENUNCIADO -->
                    <div class="mb-5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <label class="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
                            <i class="fas fa-image text-slate-400"></i>
                            ${_t('admin.q.q_image_label', null, 'Imagen del enunciado')}
                            <span class="font-normal normal-case text-slate-300">— máx. 200×200 px / 200 KB</span>
                        </label>
                        ${q.question_image_url ? `
                            <div class="flex items-center gap-3">
                                <img src="${escapeHtml(q.question_image_url)}" alt="Imagen enunciado"
                                    class="w-16 h-16 object-contain rounded-lg border border-slate-200 bg-white shadow-sm flex-shrink-0"
                                    style="max-width:100px;max-height:100px;">
                                <div class="flex-1 min-w-0">
                                    <p class="text-xs text-slate-500 font-mono truncate">${escapeHtml(q.question_image_url)}</p>
                                    <button type="button" id="q-img-btn-${qIdx}"
                                        data-admin-click="eliminarImagenPregunta(${qIdx})"
                                        class="mt-1 text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 transition">
                                        <i class="fas fa-trash-alt"></i> ${_t('admin.q.q_image_remove', null, 'Quitar imagen')}
                                    </button>
                                </div>
                            </div>
                        ` : `
                            <button type="button" id="q-img-btn-${qIdx}"
                                data-admin-click="abrirSelectorImagenPregunta(${qIdx})"
                                class="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-purple-600 border border-dashed border-slate-300 hover:border-purple-400 rounded-lg px-3 py-2 transition bg-white">
                                <i class="fas fa-plus-circle"></i>
                                ${_t('admin.q.q_image_add', null, 'Añadir imagen pequeña (opcional)')}
                            </button>
                        `}
                    </div>

                    <div class="mb-4">
                        <label class="text-[10px] font-bold text-slate-400 uppercase">${_t('admin.q.type_label', null, 'Tipo de pregunta')}</label>
                        <select data-admin-change="cambiarTipoPregunta(${qIdx}, this.value)" class="w-full p-2 border-2 border-slate-100 rounded-xl focus:border-purple-500 outline-none transition">
                            <option value="quiz" ${q.type === 'quiz' ? 'selected' : ''}>${_t('admin.q.type_quiz', null, 'Quiz (Correcta/Incorrecta)')}</option>
                            <option value="survey" ${q.type === 'survey' ? 'selected' : ''}>${_t('admin.q.type_survey', null, 'Encuesta (Votos)')}</option>
                            <option value="order" ${q.type === 'order' ? 'selected' : ''}>${_t('admin.q.type_order', null, 'Ordena (Arrastrar)')}</option>
                            <option value="matching" ${q.type === 'matching' ? 'selected' : ''}>${_t('admin.q.type_matching', null, 'Emparejar (Dos columnas)')}</option>
                            <option value="numeric_approximation" ${q.type === 'numeric_approximation' ? 'selected' : ''}>${_t('admin.q.type_numeric', null, 'Numérica (Aproximación)')}</option>
                            <option value="word_scramble" ${q.type === 'word_scramble' ? 'selected' : ''}>${_t('admin.q.type_word_scramble', null, 'Anagrama (Descifra la palabra)')}</option>
                            <option value="multiple_choice" ${q.type === 'multiple_choice' ? 'selected' : ''}>${_t('admin.q.type_multiple_choice', null, 'Selección Múltiple (1-6 respuestas)')}</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                            <i class="fas fa-clock"></i> ${_t('admin.q.time_label', null, 'Tiempo para responder (segundos)')}
                        </label>
                        <input
                            type="number"
                            min="5"
                            max="120"
                            value="${q.time_limit || 30}"
                            data-admin-input="preguntasData[${qIdx}].time_limit = Math.max(5, Math.min(120, parseInt(this.value) || 30))"
                            class="w-full p-2 border-2 border-slate-100 rounded-xl focus:border-purple-500 outline-none transition"
                            placeholder="30"
                        >
                        <p class="text-xs text-slate-400 mt-1"><i class="fas fa-info-circle mr-1"></i>${_t('admin.q.time_help', null, 'Por defecto: 30 segundos (min: 5, max: 120)')}</p>
                    </div>

                    <!-- MULTIMEDIA -->
                    <div class="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                        <label class="text-[10px] font-bold text-purple-600 uppercase flex items-center gap-2 mb-3">
                            <i class="fas fa-photo-video"></i> ${_t('admin.q.media_label', null, 'Contenido Multimedia')}
                        </label>

                        ${q.tipo_contenido === 'texto' ? `
                            <div id="drop-zone-${qIdx}" class="drop-zone text-center">
                                <p class="text-xs text-slate-500 mb-3">${_t('admin.q.media_drop', null, 'Arrastra un archivo aquí o haz clic para seleccionar')}</p>
                                <button type="button" id="upload-btn-${qIdx}" data-admin-click="abrirSelectorArchivo(${qIdx})" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition">
                                    <i class="fas fa-upload mr-2"></i>${_t('admin.q.media_upload', null, 'Subir Imagen o Audio')}
                                </button>
                                <p class="text-xs text-slate-400 mt-2">${_t('admin.q.media_limit', null, 'Max: 5MB (imagen) / 10MB (audio)')}</p>
                            </div>
                        ` : `
                            <div class="space-y-3">
                                <div class="flex items-center justify-between bg-white p-3 rounded-lg border border-purple-300">
                                    <div class="flex items-center gap-3">
                                        ${q.tipo_contenido === 'imagen'
        ? '<i class="fas fa-image text-purple-600 text-xl"></i>'
        : '<i class="fas fa-volume-up text-blue-600 text-xl"></i>'}
                                        <div>
                                            <p class="font-bold text-sm text-slate-800">${q.tipo_contenido === 'imagen' ? 'Imagen' : 'Audio'}</p>
                                            <p class="text-xs text-slate-500 font-mono break-all">${escapeHtml(q.url_recurso)}</p>
                                        </div>
                                    </div>
                                    <button type="button" data-admin-click="eliminarRecurso(${qIdx})" class="text-red-500 hover:text-red-700 px-3 py-1 rounded-lg hover:bg-red-50 transition">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                                ${q.tipo_contenido === 'imagen'
        ? `<div class="text-center"><img src="${escapeHtml(q.url_recurso)}" alt="Preview" class="max-w-full max-h-48 mx-auto rounded-lg shadow-md"></div>`
        : `<div id="audio-container-${qIdx}" class="audio-placeholder" data-audio-src="${escapeHtml(q.url_recurso)}"></div>`
}
                                <p class="text-xs text-slate-500 italic">
                                    <i class="fas fa-info-circle mr-1"></i>
                                    ${q.tipo_contenido === 'imagen'
        ? 'En presentador.html las opciones se ocultarán. En jugador.html se mostrarán normalmente.'
        : 'El audio se reproducirá automáticamente en presentador.html y estará muto en jugador.html.'}
                                </p>
                            </div>
                        `}
                    </div>
                    
                    ${q.type === 'numeric_approximation' ? `
                    <!-- PREGUNTAS NUMÉRICAS -->

                    <div class="bg-emerald-100 border-l-4 border-emerald-500 p-3 mb-4 rounded">
                        <p class="text-sm font-bold text-emerald-800 flex items-center gap-2">
                            <i class="fas fa-info-circle"></i>
                            Esta pregunta solo tiene UNA respuesta numérica. No hay opciones múltiples.
                        </p>
                    </div>
                    
                    <div class="space-y-4 bg-emerald-50 p-4 rounded-xl border-2 border-emerald-200">
                        <div>
                            <label class="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-2">
                                <i class="fas fa-check-circle"></i> Respuesta Correcta (Número Entero)
                            </label>
                            <input 
                                type="number" 
                                step="1"
                                value="${q.correctAnswer ?? ''}" 
                                data-admin-input="preguntasData[${qIdx}].correctAnswer = parseInt(this.value) || null" 
                                class="w-full mt-2 p-3 border-2 border-emerald-200 rounded-xl focus:border-emerald-500 outline-none transition"
                                placeholder="Ej: 123456"
                            >
                            <p class="text-xs text-emerald-600 mt-1"><i class="fas fa-info-circle mr-1"></i>El valor numérico exacto que se considera correcto</p>
                        </div>
                        
                        <div>
                            <label class="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-2">
                                <i class="fas fa-star"></i> Puntos Máximos
                            </label>
                            <input 
                                type="number" 
                                min="1"
                                step="1"
                                value="${q.maxPoints ?? ''}" 
                                data-admin-input="preguntasData[${qIdx}].maxPoints = Math.max(1, parseInt(this.value) || 0)" 
                                class="w-full mt-2 p-3 border-2 border-emerald-200 rounded-xl focus:border-emerald-500 outline-none transition"
                                placeholder="Ej: 100"
                            >
                            <p class="text-xs text-emerald-600 mt-1"><i class="fas fa-info-circle mr-1"></i>Puntos que obtiene si responde correctamente</p>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-2">
                                <i class="fas fa-sliders-h"></i> Modo de Tolerancia
                            </label>
                            <select
                                class="w-full mt-2 p-3 border-2 border-emerald-200 rounded-xl focus:border-emerald-500 outline-none transition"
                                data-admin-change="preguntasData[${qIdx}].toleranceMode = this.value; dibujarPreguntas();"
                            >
                                <option value="hybrid" ${(q.toleranceMode || 'hybrid') === 'hybrid' ? 'selected' : ''}>Híbrido (min(% , tope abs))</option>
                                <option value="percentage" ${q.toleranceMode === 'percentage' ? 'selected' : ''}>Porcentaje</option>
                                <option value="absolute" ${q.toleranceMode === 'absolute' ? 'selected' : ''}>Absoluto</option>
                            </select>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-2">
                                <i class="fas fa-hashtag"></i> Valor Principal
                            </label>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value="${q.toleranceValue ?? 25}"
                                data-admin-input="preguntasData[${qIdx}].toleranceValue = Number(this.value) || 25"
                                class="w-full mt-2 p-3 border-2 border-emerald-200 rounded-xl focus:border-emerald-500 outline-none transition"
                                placeholder="Ej: 25"
                            >
                            <p class="text-xs text-emerald-600 mt-1"><i class="fas fa-info-circle mr-1"></i>% para modo porcentaje/híbrido, o unidades para absoluto</p>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-2">
                                <i class="fas fa-ruler-horizontal"></i> Tope de Tolerancia (Opcional para el modo Híbrido)
                            </label>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value="${q.toleranceCap ?? ''}"
                                data-admin-input="preguntasData[${qIdx}].toleranceCap = this.value === '' ? null : (Number(this.value) || null)"
                                class="w-full mt-2 p-3 border-2 rounded-xl outline-none transition ${isHybridToleranceMode ? 'border-emerald-200 focus:border-emerald-500 bg-white' : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'}"
                                placeholder="Ej: 1000"
                                ${isHybridToleranceMode ? '' : 'disabled'}
                            >
                            <p class="text-xs mt-1 ${isHybridToleranceMode ? 'text-emerald-600' : 'text-slate-500'}"><i class="fas fa-info-circle mr-1"></i>Si queda vacío, se usa solo el porcentaje</p>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-2">
                                <i class="fas fa-lightbulb"></i> Pista (Opcional)
                            </label>
                            <textarea
                                rows="2"
                                data-admin-input="preguntasData[${qIdx}].hint = this.value"
                                class="w-full mt-2 p-3 border-2 border-emerald-200 rounded-xl focus:border-emerald-500 outline-none transition text-sm"
                                placeholder="Ej: Recuerda la fórmula de la circunferencia es π × diámetro"
                            >${escapeHtml(q.hint || '')}</textarea>
                            <p class="text-xs text-emerald-600 mt-1"><i class="fas fa-info-circle mr-1"></i>Se mostrará al presentador mientras espera respuestas</p>
                        </div>
                        
                        <div class="bg-white p-3 rounded-lg border border-emerald-300">
                            <p class="text-xs font-bold text-emerald-700 mb-2"><i class="fas fa-lightbulb mr-1"></i>Cómo funciona:</p>
                            <ul class="text-xs text-emerald-600 space-y-1 ml-4 list-disc">
                                <li>Los jugadores escriben un número</li>
                                <li>La tolerancia depende del modo seleccionado</li>
                                <li>Puntos = máximos × (1 - distancia/tolerancia)</li>
                                <li>Si es exacta: +20 puntos extra</li>
                                <li>Fuera del margen = 0 puntos</li>
                            </ul>
                        </div>
                    </div>
                    ` : q.type === 'word_scramble' ? `
                    <!-- ANAGRAMA: DESCIFRA LA PALABRA -->
                    <div class="bg-violet-100 border-l-4 border-violet-500 p-3 mb-4 rounded">
                        <p class="text-sm font-bold text-violet-800 flex items-center gap-2">
                            <i class="fas fa-puzzle-piece"></i>
                            El jugador ve 10 letras barajadas y debe descubrir la palabra oculta.
                        </p>
                    </div>
                    <div class="space-y-4 bg-violet-50 p-4 rounded-xl border-2 border-violet-200">
                        <div>
                            <label class="text-[10px] font-bold text-violet-600 uppercase flex items-center gap-2">
                                <i class="fas fa-key"></i> Palabra Correcta (7-10 letras, sin tildes)
                            </label>
                            <input
                                type="text"
                                maxlength="10"
                                value="${escapeHtml(q.correctWord || '')}"
                                data-admin-input="preguntasData[${qIdx}].correctWord = this.value.replace(/[^A-Za-z\u00c1\u00e1\u00c9\u00e9\u00cd\u00ed\u00d3\u00f3\u00da\u00fa\u00dc\u00fc\u00d1\u00f1]/g,'').toUpperCase()"
                                class="w-full mt-2 p-3 border-2 border-violet-200 rounded-xl focus:border-violet-500 outline-none transition font-mono text-lg tracking-widest uppercase"
                                placeholder="Ej: LIBERTAD"
                            >
                            <p class="text-xs text-violet-600 mt-1"><i class="fas fa-info-circle mr-1"></i>Entre 7 y 10 letras. Se generarán 10 letras barajadas automáticamente.</p>
                        </div>
                        <div class="bg-white p-3 rounded-lg border border-violet-300">
                            <p class="text-xs font-bold text-violet-700 mb-2"><i class="fas fa-lightbulb mr-1"></i>Cómo funciona:</p>
                            <ul class="text-xs text-violet-600 space-y-1 ml-4 list-disc">
                                <li>El enunciado es la definición de la palabra</li>
                                <li>Los jugadores ven 10 letras barajadas (incluye las de la palabra)</li>
                                <li>Pulsan las letras en orden para formar la palabra</li>
                                <li>Puntuación: 20 pts base + hasta 20 pts de bonus por tiempo</li>
                            </ul>
                        </div>
                    </div>
                    ` : q.type === 'matching' ? `
                    <!-- EMPAREJAR: DOS COLUMNAS -->
                    <div class="bg-amber-100 border-l-4 border-amber-500 p-3 mb-4 rounded">
                        <p class="text-sm font-bold text-amber-800 flex items-center gap-2">
                            <i class="fas fa-columns"></i>
                            El jugador ve la columna izquierda fija y reordena la derecha para emparejar los pares correctos.
                        </p>
                    </div>
                    <div class="bg-amber-50 p-4 rounded-xl border-2 border-amber-200">
                        ${renderMatchingEditor(qIdx, q.options)}
                        <div class="mt-3 bg-white p-3 rounded-lg border border-amber-300">
                            <p class="text-xs font-bold text-amber-700 mb-1"><i class="fas fa-lightbulb mr-1"></i>Cómo funciona:</p>
                            <ul class="text-xs text-amber-600 space-y-1 ml-4 list-disc">
                                <li>Columna izquierda: fija (no se puede arrastrar)</li>
                                <li>Columna derecha: el jugador la reordena arrastrando</li>
                                <li>Puntuación: 20 pts por cada par correcto</li>
                                <li>Racha: total = +1, ≥50% = mantiene, &lt;50% = resetea</li>
                            </ul>
                        </div>
                    </div>
                    ` : q.type === 'matching' ? `
                    <!-- EMPAREJAR: DOS COLUMNAS -->
                    <div class="bg-amber-100 border-l-4 border-amber-500 p-3 mb-4 rounded">
                        <p class="text-sm font-bold text-amber-800 flex items-center gap-2">
                            <i class="fas fa-columns"></i>
                            El jugador ve la columna izquierda fija y reordena la derecha para emparejar los pares correctos.
                        </p>
                    </div>
                    <div class="bg-amber-50 p-4 rounded-xl border-2 border-amber-200">
                        ${renderMatchingEditor(qIdx, q.options)}
                        <div class="mt-3 bg-white p-3 rounded-lg border border-amber-300">
                            <p class="text-xs font-bold text-amber-700 mb-1"><i class="fas fa-lightbulb mr-1"></i>Cómo funciona:</p>
                            <ul class="text-xs text-amber-600 space-y-1 ml-4 list-disc">
                                <li>Columna izquierda: fija (no se puede arrastrar)</li>
                                <li>Columna derecha: el jugador la reordena arrastrando</li>
                                <li>Puntuación: 20 pts por cada par correcto</li>
                                <li>Racha: total = +1, ≥50% = mantiene, &lt;50% = resetea</li>
                            </ul>
                        </div>
                    </div>
                    ` : q.type === 'multiple_choice' ? `
                    <!-- SELECCIÓN MÚLTIPLE: 1-6 RESPUESTAS CORRECTAS -->
                    <div class="bg-cyan-100 border-l-4 border-cyan-500 p-3 mb-4 rounded">
                        <p class="text-sm font-bold text-cyan-800 flex items-center gap-2">
                            <i class="fas fa-check-double"></i>
                            Los jugadores pueden marcar entre 1 y 6 respuestas. Configura la puntuación a continuación.
                        </p>
                    </div>
                    <div class="space-y-4 bg-cyan-50 p-4 rounded-xl border-2 border-cyan-200 mb-4">
                        <div>
                            <label class="text-[10px] font-bold text-cyan-600 uppercase flex items-center gap-2">
                                <i class="fas fa-plus"></i> Puntos por cada respuesta correcta marcada
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                step="1"
                                value="${q.mcPointsPerCorrect ?? 10}"
                                data-admin-input="preguntasData[${qIdx}].mcPointsPerCorrect = Math.max(1, Math.min(100, parseInt(this.value) || 10))"
                                class="w-full mt-2 p-3 border-2 border-cyan-200 rounded-xl focus:border-cyan-500 outline-none transition"
                                placeholder="10"
                            >
                            <p class="text-xs text-cyan-600 mt-1"><i class="fas fa-info-circle mr-1"></i>Puntos que se suman por cada opción correcta que el jugador marque (1-100)</p>
                        </div>
                        
                        <div>
                            <label class="text-[10px] font-bold text-cyan-600 uppercase flex items-center gap-2">
                                <i class="fas fa-minus"></i> Penalización por cada respuesta incorrecta marcada
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value="${q.mcPenaltyPerIncorrect ?? 10}"
                                data-admin-input="preguntasData[${qIdx}].mcPenaltyPerIncorrect = Math.max(0, Math.min(100, parseInt(this.value) || 10))"
                                class="w-full mt-2 p-3 border-2 border-cyan-200 rounded-xl focus:border-cyan-500 outline-none transition"
                                placeholder="10"
                            >
                            <p class="text-xs text-cyan-600 mt-1"><i class="fas fa-info-circle mr-1"></i>Puntos que se restan por cada opción incorrecta que marque (0-100)</p>
                        </div>
                        
                        <div>
                            <label class="text-[10px] font-bold text-cyan-600 uppercase flex items-center gap-2">
                                <i class="fas fa-star"></i> Bonus por selección perfecta
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value="${q.mcPerfectBonus ?? 20}"
                                data-admin-input="preguntasData[${qIdx}].mcPerfectBonus = Math.max(0, Math.min(100, parseInt(this.value) || 20))"
                                class="w-full mt-2 p-3 border-2 border-cyan-200 rounded-xl focus:border-cyan-500 outline-none transition"
                                placeholder="20"
                            >
                            <p class="text-xs text-cyan-600 mt-1"><i class="fas fa-info-circle mr-1"></i>Bonus extra si marca TODAS las correctas y NINGUNA incorrecta (0-100)</p>
                        </div>
                        
                        <div class="bg-white p-3 rounded-lg border border-cyan-300">
                            <p class="text-xs font-bold text-cyan-700 mb-2"><i class="fas fa-lightbulb mr-1"></i>Cómo funciona:</p>
                            <ul class="text-xs text-cyan-600 space-y-1 ml-4 list-disc">
                                <li>Los jugadores ven checkboxes y pueden marcar múltiples opciones</li>
                                <li>Puntuación = (correctas_marcadas × puntos) - (incorrectas_marcadas × penalización)</li>
                                <li>Si es perfecta (todas correctas + ninguna incorrecta): + bonus extra</li>
                                <li>La puntuación puede ser negativa</li>
                                <li>Solo las selecciones perfectas cuentan para la racha</li>
                            </ul>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        ${q.options.map((opt, oIdx) => {
        return `
                                <div class="flex flex-col gap-1">
                                    <div class="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border-2 ${opt.isCorrect ? 'border-green-400 bg-green-50' : 'border-transparent'}">
                                        <input type="checkbox" ${opt.isCorrect ? 'checked' : ''} data-admin-change="marcarCorrectaMultiple(${qIdx}, ${oIdx})" class="w-5 h-5 accent-green-600">
                                        <input type="text" value="${escapeHtml(opt.optionText || '')}" data-admin-input="preguntasData[${qIdx}].options[${oIdx}].optionText = this.value" placeholder="Respuesta..." class="bg-transparent flex-1 outline-none text-sm font-medium">
                                        ${opt.option_image_url
        ? `<div class="relative flex-shrink-0"><img src="${escapeHtml(opt.option_image_url)}" class="w-12 h-12 object-cover rounded-lg border border-slate-200" alt="Imagen opción"><button id="opt-img-btn-${qIdx}-${oIdx}" data-admin-click="eliminarImagenOpcion(${qIdx}, ${oIdx})" class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center leading-none" title="Quitar imagen">×</button></div>`
        : `<label class="cursor-pointer text-slate-400 hover:text-purple-600 transition flex-shrink-0" title="Añadir imagen (máx. 200 KB)"><i class="fas fa-image"></i><input type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden" data-admin-change="onImagenOpcionChange(this, ${qIdx}, ${oIdx})"></label>`
}
                                        ${q.options.length > 2 ? `<button data-admin-click="eliminarOpcion(${qIdx}, ${oIdx})" class="text-slate-300 hover:text-red-500">×</button>` : ''}
                                    </div>
                                </div>
                            `;
    }).join('')}
                        
                        ${q.options.length < 6 ? `
                        <button data-admin-click="añadirOpcion(${qIdx})" class="text-xs text-purple-600 font-bold border-2 border-dashed border-purple-200 rounded-xl py-3 hover:bg-purple-50 transition">
                            ${_t('admin.q.btn_add_option', null, '+ Añadir Opción')}
                        </button>` : ''}
                    </div>
                    ` : `
                    <div class="grid grid-cols-2 gap-4">
                        ${q.options.map((opt, oIdx) => {
        if (q.type === 'order') {
            return `
                                    <div class="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border-2 border-indigo-200">
                                        <div class="flex items-center gap-3">
                                            <div class="flex flex-col gap-1">
                                                <button data-admin-click="moverOpcion(${qIdx}, ${oIdx}, -1)" class="bg-indigo-500 hover:bg-indigo-600 text-white w-7 h-7 rounded-lg text-xs" ${oIdx === 0 ? 'disabled style="opacity:0.4;"' : ''}>▲</button>
                                                <button data-admin-click="moverOpcion(${qIdx}, ${oIdx}, 1)" class="bg-indigo-500 hover:bg-indigo-600 text-white w-7 h-7 rounded-lg text-xs" ${oIdx === q.options.length - 1 ? 'disabled style="opacity:0.4;"' : ''}>▼</button>
                                            </div>
                                            <span class="text-xs font-black bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">${oIdx + 1}</span>
                                            <input type="text" value="${escapeHtml(opt.optionText || '')}" data-admin-input="preguntasData[${qIdx}].options[${oIdx}].optionText = this.value" placeholder="Respuesta..." class="bg-transparent flex-1 outline-none text-sm font-medium">
                                            ${q.options.length > 2 ? `<button data-admin-click="eliminarOpcion(${qIdx}, ${oIdx})" class="text-slate-300 hover:text-red-500">×</button>` : ''}
                                        </div>
                                        <input type="text" value="${escapeHtml(opt.justification || '')}" data-admin-input="preguntasData[${qIdx}].options[${oIdx}].justification = this.value" placeholder="Ej: 250,000 km de vías" class="bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 transition">
                                    </div>
                                `;
        }

        return `
                                <div class="flex flex-col gap-1">
                                    <div class="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border-2 ${q.type === 'quiz' && opt.isCorrect ? 'border-green-400 bg-green-50' : 'border-transparent'}">
                                        ${q.type === 'quiz' ? `<input type="radio" name="correct_${qIdx}" ${opt.isCorrect ? 'checked' : ''} data-admin-change="marcarCorrecta(${qIdx}, ${oIdx})" class="w-5 h-5 accent-green-600">` : `<input type="checkbox" checked disabled class="w-5 h-5 accent-blue-600">`}
                                        <input type="text" value="${escapeHtml(opt.optionText || '')}" data-admin-input="preguntasData[${qIdx}].options[${oIdx}].optionText = this.value" placeholder="Respuesta..." class="bg-transparent flex-1 outline-none text-sm font-medium">
                                        ${opt.option_image_url
        ? `<div class="relative flex-shrink-0"><img src="${escapeHtml(opt.option_image_url)}" class="w-12 h-12 object-cover rounded-lg border border-slate-200" alt="Imagen opción"><button id="opt-img-btn-${qIdx}-${oIdx}" data-admin-click="eliminarImagenOpcion(${qIdx}, ${oIdx})" class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center leading-none" title="Quitar imagen">×</button></div>`
        : `<label class="cursor-pointer text-slate-400 hover:text-purple-600 transition flex-shrink-0" title="Añadir imagen (máx. 200 KB)"><i class="fas fa-image"></i><input type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden" data-admin-change="onImagenOpcionChange(this, ${qIdx}, ${oIdx})"></label>`
}
                                        ${q.options.length > 2 ? `<button data-admin-click="eliminarOpcion(${qIdx}, ${oIdx})" class="text-slate-300 hover:text-red-500">×</button>` : ''}
                                    </div>
                                </div>
                            `;
    }).join('')}
                        
                        ${q.options.length < 6 ? `
                        <button data-admin-click="añadirOpcion(${qIdx})" class="text-xs text-purple-600 font-bold border-2 border-dashed border-purple-200 rounded-xl py-3 hover:bg-purple-50 transition">
                            ${_t('admin.q.btn_add_option', null, '+ Añadir Opción')}
                        </button>` : ''}
                    </div>

                    ${q.type !== 'survey' && q.type !== 'order' ? `
                    <div class="mt-4">
                        <label class="text-[10px] font-bold text-slate-400 uppercase">${_t('admin.q.justification_label', null, 'Justificación de la respuesta correcta')}</label>
                        <textarea data-admin-input="preguntasData[${qIdx}].justification = this.value" class="w-full mt-2 p-3 border-2 border-slate-100 rounded-xl focus:border-purple-500 outline-none transition text-sm" rows="3" placeholder="Explica por qué esta es la respuesta correcta">${escapeHtml(q.justification || '')}</textarea>
                    </div>` : ''}
                    `}
                </div>`;
    }).join('');

    // SOLUCIÓN AL BUG: Restaurar el scroll y el foco después de re-renderizar
    requestAnimationFrame(() => {
        // Restaurar scroll del contenedor padre
        if (parent) {
            parent.scrollTop = scrollPosition;
        }

        // Restaurar scroll de la ventana
        window.scrollTo(0, windowScrollY);

        // Intentar restaurar el foco al elemento que estaba activo
        if (activeElementId) {
            const elementToFocus = document.getElementById(activeElementId);
            if (elementToFocus && elementToFocus !== document.body) {
                try {
                    elementToFocus.focus({ preventScroll: true });
                } catch (e) {
                    elementToFocus.focus();
                }
            }
        }

        // Cargar elementos de audio DESPUÉS de restaurar scroll y foco
        setTimeout(() => {
            const audioPlaceholders = contenedor.querySelectorAll('.audio-placeholder');
            audioPlaceholders.forEach(placeholder => {
                const audioSrc = placeholder.dataset.audioSrc;
                if (audioSrc) {
                    const audio = document.createElement('audio');
                    audio.controls = true;
                    audio.preload = 'none';
                    audio.src = audioSrc;
                    audio.className = 'w-full';
                    audio.style.outline = 'none';
                    placeholder.appendChild(audio);
                    placeholder.classList.remove('audio-placeholder');
                }
            });

            // Inicializar drag-and-drop en todas las cajas de upload
            inicializarDragAndDrop();
        }, 100);
    });
}

function ensureOrderIndexes(question) {
    if (!question || !Array.isArray(question.options)) return;
    question.options.forEach((opt, index) => {
        opt.order_index = index;
    });
}

function moverOpcion(qIdx, oIdx, delta) {
    const question = preguntasData[qIdx];
    if (!question || !Array.isArray(question.options)) return;

    const targetIndex = oIdx + delta;
    if (targetIndex < 0 || targetIndex >= question.options.length) return;

    const options = question.options;
    const [moved] = options.splice(oIdx, 1);
    options.splice(targetIndex, 0, moved);
    ensureOrderIndexes(question);
    dibujarPreguntas();
}

/**
 * Cambiar tipo de pregunta y limpiar opciones si es necesario
 */
function cambiarTipoPregunta(qIdx, newType) {
    const question = preguntasData[qIdx];
    if (!question) return;

    question.type = newType;

    // Para preguntas de aproximación numérica, limpiar opciones
    if (newType === 'numeric_approximation') {
        question.options = [];
        question.toleranceMode = question.toleranceMode || 'hybrid';
        question.toleranceValue = Number(question.toleranceValue) || 25;
        if (question.toleranceCap === undefined) question.toleranceCap = 1000;
    }
    // Para preguntas de anagrama, limpiar opciones y preparar correctWord
    else if (newType === 'word_scramble') {
        question.options = [];
        question.correctWord = question.correctWord || '';
    }
    // Para preguntas de emparejamiento, inicializar 2 pares vacíos
    else if (newType === 'matching') {
        question.options = [
            { optionText: '', match_value: '', isCorrect: false, order_index: 0 },
            { optionText: '', match_value: '', isCorrect: false, order_index: 1 }
        ];
    }
    // Para preguntas de selección múltiple, asegurar opciones y campos de puntuación
    else if (newType === 'multiple_choice') {
        if (!Array.isArray(question.options) || question.options.length === 0) {
            question.options = [
                { optionText: '', isCorrect: true, justification: null, order_index: 0 },
                { optionText: '', isCorrect: false, justification: null, order_index: 1 }
            ];
        }
        // Asegurar valores por defecto para campos de puntuación
        if (question.mcPointsPerCorrect === undefined) question.mcPointsPerCorrect = 10;
        if (question.mcPenaltyPerIncorrect === undefined) question.mcPenaltyPerIncorrect = 10;
        if (question.mcPerfectBonus === undefined) question.mcPerfectBonus = 20;
    }
    // Para otros tipos, asegurar que hay al menos 2 opciones
    else if (!Array.isArray(question.options) || question.options.length === 0) {
        question.options = [
            { optionText: '', isCorrect: true, justification: null, order_index: 0 },
            { optionText: '', isCorrect: false, justification: null, order_index: 1 }
        ];
    }

    dibujarPreguntas();
}

/**
 * 🆕 Mostrar modal de error centrado con botón de cerrar
 * @param {string} titulo - Título del error (ej: "❌ Error")
 * @param {string} mensaje - Mensaje detallado del error
 * @param {string} tipo - Tipo de modal: 'error' (rojo), 'success' (verde), 'warning' (naranja), 'info' (azul)
 */
function _ensureAdminModalStyles() {
    if (document.getElementById('xiro-admin-modal-styles')) return;
    const s = document.createElement('style');
    s.id = 'xiro-admin-modal-styles';
    s.textContent = `
        @keyframes xiro-fade-in { from { opacity:0 } to { opacity:1 } }
        @keyframes xiro-zoom-in { from { opacity:0; transform:scale(.88) } to { opacity:1; transform:scale(1) } }
        .xiro-admin-overlay { animation: xiro-fade-in .2s ease-out both }
        .xiro-admin-dialog  { animation: xiro-zoom-in .22s cubic-bezier(.34,1.56,.64,1) both }
    `;
    document.head.appendChild(s);
}

function mostrarModalError(titulo, mensaje, tipo = 'error') {
    // Remover modal anterior si existe
    const modalAnterior = document.getElementById('modalErrorGlobal');
    if (modalAnterior) modalAnterior.remove();
    _ensureAdminModalStyles();

    // Definir colores según tipo
    const colores = {
        error: { bg: 'bg-red-50', border: 'border-red-300', texto: 'text-red-900', boton: 'bg-red-600 hover:bg-red-700' },
        success: { bg: 'bg-green-50', border: 'border-green-300', texto: 'text-green-900', boton: 'bg-green-600 hover:bg-green-700' },
        warning: { bg: 'bg-yellow-50', border: 'border-yellow-300', texto: 'text-yellow-900', boton: 'bg-yellow-600 hover:bg-yellow-700' },
        info: { bg: 'bg-blue-50', border: 'border-blue-300', texto: 'text-blue-900', boton: 'bg-blue-600 hover:bg-blue-700' }
    };

    const estilos = colores[tipo] || colores.error;

    const modal = document.createElement('div');
    modal.id = 'modalErrorGlobal';
    modal.className = 'fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4 xiro-admin-overlay';
    modal.innerHTML = _tHtml(`
        <div class="bg-white rounded-2xl shadow-2xl ${estilos.bg} border-2 ${estilos.border} max-w-md w-full p-8 xiro-admin-dialog">
            <div class="flex flex-col items-center text-center">
                <h2 class="text-2xl font-black ${estilos.texto} mb-4">${titulo}</h2>
                <p class="${estilos.texto} text-sm leading-relaxed mb-8">${mensaje}</p>
                
                <button data-admin-click="document.getElementById('modalErrorGlobal').remove()"
                    class="w-full ${estilos.boton} text-white px-8 py-4 rounded-xl font-bold transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                    <i class="fas fa-times"></i>
                    ${_t('admin.common.close', null, 'Cerrar')}
                </button>
            </div>
        </div>
    `);

    document.body.appendChild(modal);

    // Cerrar al hacer clic fuera del modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Cerrar con tecla Escape
    const closeOnEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    };
    document.addEventListener('keydown', closeOnEscape);
}

/**
 * 🆕 Modal de confirmación (reemplaza confirm())
 * @param {string} titulo - Título del modal (ej: "⚠️ Confirmar")
 * @param {string} mensaje - Mensaje de confirmación
 * @param {Function} onConfirm - Callback al confirmar
 * @param {Function} onCancel - Callback al cancelar (opcional)
 * @param {string} textoConfirm - Texto del botón confirmar (defecto: "Confirmar")
 * @param {string} textoCancelar - Texto del botón cancelar (defecto: "Cancelar")
 */
function mostrarModalConfirmacion(titulo, mensaje, onConfirm, onCancel, textoConfirm, textoCancelar) {
    textoConfirm = textoConfirm ?? _t('admin.common.confirm', null, 'Confirmar');
    textoCancelar = textoCancelar ?? _t('admin.common.cancel', null, 'Cancelar');
    // Remover modal anterior si existe
    const modalAnterior = document.getElementById('modalConfirmacionGlobal');
    if (modalAnterior) modalAnterior.remove();
    _ensureAdminModalStyles();

    const modal = document.createElement('div');
    modal.id = 'modalConfirmacionGlobal';
    modal.className = 'fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4 xiro-admin-overlay';
    modal.innerHTML = _tHtml(`
        <div class="bg-white rounded-2xl shadow-2xl border-2 border-yellow-300 max-w-md w-full p-8 xiro-admin-dialog">
            <div class="flex flex-col items-center text-center">
                <h2 class="text-2xl font-black text-yellow-900 mb-4">${titulo}</h2>
                <p class="text-yellow-800 text-sm leading-relaxed mb-8">${mensaje}</p>
                
                <div class="flex gap-3 w-full">
                    <button data-admin-click="document.getElementById('modalConfirmacionGlobal').remove()" 
                        class="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-800 px-6 py-3 rounded-xl font-bold transition transform hover:scale-105 active:scale-95">
                        ${textoCancelar}
                    </button>
                    <button id="btnConfirmarModal"
                        class="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-xl font-bold transition transform hover:scale-105 active:scale-95">
                        ${textoConfirm}
                    </button>
                </div>
            </div>
        </div>
    `);

    document.body.appendChild(modal);

    // Configurar eventos
    const btnConfirmar = document.getElementById('btnConfirmarModal');

    btnConfirmar.addEventListener('click', () => {
        modal.remove();
        if (onConfirm) onConfirm();
    });

    const btnCancelar = modal.querySelector('button:first-child');
    btnCancelar.addEventListener('click', () => {
        modal.remove();
        if (onCancel) onCancel();
    });

    // Cerrar al hacer clic fuera del modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            if (onCancel) onCancel();
        }
    });

    // Cerrar con tecla Escape
    const closeOnEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            if (onCancel) onCancel();
            document.removeEventListener('keydown', closeOnEscape);
        }
    };
    document.addEventListener('keydown', closeOnEscape);

    // Focus en botón confirmar
    btnConfirmar.focus();
}

/**
 * Oculta/muestra al presentador TODOS los recursos de una página de listado
 * (bancos, mezclas de preguntas, personalizados o trivial), respetando la
 * propiedad del recurso (un editor sólo afecta a los suyos, el admin a todos).
 * @param {string} apiPath - endpoint bulk, ej: '/api/banks/visibility-all'
 * @param {boolean} visible
 * @param {Function} renderFn - vista a refrescar tras aplicar el cambio
 */
function toggleAllVisibleToPresenter(apiPath, visible, renderFn) {
    mostrarModalConfirmacion(
        _t('admin.common.confirmation_title', null, '⚠️ Confirmación'),
        visible
            ? _t('admin.common.confirm_show_all_msg', null, '¿Deseas mostrar todos estos juegos al presentador?')
            : _t('admin.common.confirm_hide_all_msg', null, '¿Deseas ocultar todos estos juegos al presentador?'),
        async () => {
            try {
                const res = await fetchWithAuth(apiPath, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ visible })
                });
                if (res.ok) {
                    await renderFn();
                } else {
                    const err = await res.json();
                    mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), err.message || err.error || _t('admin.common.error_generic', null, 'No se pudo completar la acción'), 'error');
                }
            } catch {
                mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.common.error_server', null, 'Error de conexión con el servidor'), 'error');
            }
        },
        null,
        _t('admin.common.confirm', null, 'Confirmar'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}