// Editor de preguntas del admin (dibujarPreguntas, en helpers.js): valores por defecto
// de cada pregunta y tarjeta común (enunciado, imagen, tipo, tiempo y multimedia).
// La sección propia de cada tipo está en question-editor-numeric.js y question-editor-options.js.

/** Completa en la propia pregunta los campos que el editor necesita. */
function normalizeQuestionDefaults(q) {
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
}

// Cada tipo de pregunta lleva su propia chip de color, para que se distinga
// de un vistazo en la lista sin tener que abrir el desplegable. Clases Tailwind
// completas y literales (no interpoladas) para que el compilador las detecte.
const QUESTION_TYPE_CHIPS = {
    quiz: 'bg-purple-100 text-purple-700',
    survey: 'bg-blue-100 text-blue-700',
    order: 'bg-green-100 text-green-700',
    matching: 'bg-orange-100 text-orange-700',
    numeric_approximation: 'bg-cyan-100 text-cyan-700',
    word_scramble: 'bg-pink-100 text-pink-700',
    multiple_choice: 'bg-indigo-100 text-indigo-700'
};

function questionTypeChip(type) {
    return Object.hasOwn(QUESTION_TYPE_CHIPS, type) ? QUESTION_TYPE_CHIPS[type] : 'bg-slate-100 text-slate-600';
}

/** HTML de la tarjeta de una pregunta en el editor. */
function questionCardHtml(q, qIdx) {
    const typeChip = questionTypeChip(q.type);
    const isHybridToleranceMode = (q.toleranceMode || 'hybrid') === 'hybrid';
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
                    
                    ${questionTypeSectionHtml(q, qIdx, isHybridToleranceMode)}
                </div>`;
}
