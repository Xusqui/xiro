// Editor de preguntas del admin: secciones con opciones (emparejar, selección
// múltiple, y quiz / encuesta / ordenar) y el reparto por tipo.

/** Sección propia del tipo de pregunta, bajo la cabecera común de la tarjeta. */
function questionTypeSectionHtml(q, qIdx, isHybridToleranceMode) {
    if (q.type === 'numeric_approximation') return numericEditorHtml(q, qIdx, isHybridToleranceMode);
    if (q.type === 'word_scramble') return wordScrambleEditorHtml(q, qIdx);
    if (q.type === 'matching') return matchingEditorSectionHtml(q, qIdx);
    if (q.type === 'multiple_choice') return multipleChoiceEditorHtml(q, qIdx);
    return standardOptionsEditorHtml(q, qIdx);
}

/** Emparejar: editor de dos columnas (renderMatchingEditor, en matching-editor.js). */
function matchingEditorSectionHtml(q, qIdx) {
    return `
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
                    `;
}

/** Selección múltiple: puntuación y opciones con varias correctas. */
function multipleChoiceEditorHtml(q, qIdx) {
    return `
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
                    `;
}

/** Quiz, encuesta y ordenar: opciones y, salvo encuesta y ordenar, justificación. */
function standardOptionsEditorHtml(q, qIdx) {
    return `
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
                    `;
}
