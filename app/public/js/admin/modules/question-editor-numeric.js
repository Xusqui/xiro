// Editor de preguntas del admin: secciones de las preguntas numéricas y de anagrama.

/** Numérica (aproximación): respuesta, puntos, tolerancia y pista. */
function numericEditorHtml(q, qIdx, isHybridToleranceMode) {
    return `
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
                    `;
}

/** Anagrama: palabra correcta. */
function wordScrambleEditorHtml(q, qIdx) {
    return `
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
                    `;
}
