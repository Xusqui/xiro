/**
 * @fileoverview Gestión completa de juegos personalizados
 * Código extraído 1:1 del original admin.js
 */

// ===== VISTA PRINCIPAL: LISTADO DE JUEGOS PERSONALIZADOS =====

function ocultarTodosPersonalizados() {
    toggleAllVisibleToPresenter('/api/custom-games/visibility-all', false, renderVistaPersonalizados);
}

function mostrarTodosPersonalizados() {
    toggleAllVisibleToPresenter('/api/custom-games/visibility-all', true, renderVistaPersonalizados);
}

async function renderVistaPersonalizados() {
    clearUnsavedChangesGuard();

    const res = await fetchWithAuth('/api/custom-games');
    const personalizados = await res.json();

    const area = document.getElementById('editorArea');
    area.innerHTML = _tHtml(`
        <div class="max-w-7xl mx-auto p-10">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-4xl font-black text-slate-900 mb-2 flex items-center gap-3">
                        <div class="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                            <i class="fas fa-star text-white text-xl"></i>
                        </div>
                        ${_t('admin.custom.title', null, 'Juegos Personalizados')}
                    </h1>
                    <p class="text-slate-500">${_t('admin.custom.subtitle', null, 'Crea juegos únicos con preguntas específicas')}</p>
                </div>
                <div class="flex gap-3">
                    <button data-admin-click="ocultarTodosPersonalizados()" title="${_t('admin.common.btn_hide_all_presenter', null, 'Ocultar todos estos juegos al presentador')}" aria-label="${_t('admin.common.btn_hide_all_presenter', null, 'Ocultar todos estos juegos al presentador')}"
                        class="w-14 h-14 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl transition flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-eye-slash text-lg"></i>
                    </button>
                    <button data-admin-click="mostrarTodosPersonalizados()" title="${_t('admin.common.btn_show_all_presenter', null, 'Mostrar todos estos juegos al presentador')}" aria-label="${_t('admin.common.btn_show_all_presenter', null, 'Mostrar todos estos juegos al presentador')}"
                        class="w-14 h-14 bg-teal-100 hover:bg-teal-200 text-teal-700 rounded-xl transition flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-eye text-lg"></i>
                    </button>
                    <button data-admin-click="prepararNuevoJuegoPersonalizado()"
                        class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition transform hover:-translate-y-1 flex items-center gap-3">
                        <i class="fas fa-plus-circle text-xl"></i>
                        ${_t('admin.custom.btn_add', null, 'Añadir Nuevo Personalizado')}
                    </button>
                </div>
            </div>
            
            ${personalizados.length === 0 ? `
                <div class="text-center py-20">
                    <i class="fas fa-inbox text-slate-300 text-6xl mb-4"></i>
                    <p class="text-slate-400 text-xl">${_t('admin.custom.empty_title', null, 'No hay juegos personalizados todavía')}</p>
                    <p class="text-slate-400 mt-2">${_t('admin.custom.empty_msg', null, 'Crea un juego personalizado para mayor flexibilidad')}</p>
                </div>
            ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${personalizados.map(juego => {
        const ownerInfo = {
            created_by_role: juego.created_by_role,
            created_by_user_id: juego.created_by_user_id,
            created_by_username: juego.created_by_username
        };
        const canModify = canModifyOwnedResource(ownerInfo);
        const editClasses = canModify
            ? 'flex-1 btn-edit px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2'
            : `flex-1 px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 ${getLockedButtonClasses()}`;

        return `
                        <div class="bg-white rounded-2xl shadow-sm border-2 border-slate-200 hover:border-blue-500 transition-all hover:shadow-xl group overflow-hidden">
                            <div class="p-6">
                                <div class="flex justify-between items-start mb-4">
                                    <div class="flex-1">
                                        <h3 class="text-lg font-bold text-slate-900 mb-2 line-clamp-2">${escapeHtml(juego.name)}</h3>
                                        ${getOwnerBadgeHtml(ownerInfo)}
                                        <div class="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-mono font-bold mb-2">
                                            <i class="fas fa-key"></i>
                                            PIN: ${juego.pin}
                                        </div>
                                        <div class="text-xs text-slate-500 mt-2">
                                            <i class="fas fa-question-circle mr-1"></i>
                                            ${_t('admin.custom.questions_count', null, '{n} pregunta(s)').replace('{n}', juego.question_count || 0)}
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="flex gap-2 mt-4">
                                    <button data-admin-action="${canModify ? 'edit-custom-game' : 'ownership-denied'}" data-game-id="${juego.id}" data-resource-label="este juego personalizado" 
                                        class="${editClasses}" ${canModify ? '' : 'title="Bloqueado: creado por otro usuario"'}>
                                        <i class="fas fa-edit"></i>
                                        ${_t('admin.common.edit', null, 'Editar')}
                                    </button>
                                    <button data-admin-click="exportarJuegoAPDF(${juego.id}, '${escapeHtml(jsStringContent(juego.name))}')" 
                                        class="bg-plum-600 hover:bg-plum-700 text-white px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
                                        title="Exportar a PDF">
                                        <i class="fas fa-file-pdf"></i>
                                    </button>
                                    <button data-admin-action="${canModify ? 'delete-custom-game' : 'ownership-denied'}" data-game-id="${juego.id}" data-owner-user-id="${juego.created_by_user_id ?? ''}" data-resource-label="este juego personalizado" 
                                        class="${canModify ? 'bg-red-50 hover:bg-red-100 text-red-600 w-12 h-12 rounded-xl font-bold transition flex items-center justify-center' : `w-12 h-12 rounded-xl font-bold transition flex items-center justify-center ${getLockedButtonClasses()}`}" ${canModify ? '' : 'title="Bloqueado: creado por otro usuario"'}>
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
    }).join('')}
                </div>
            `}
        </div>
    `);
}

// ===== PREPARAR NUEVO JUEGO PERSONALIZADO =====

function prepararNuevoJuegoPersonalizado() {
    currentCustomGameQuestions = [];
    activeView = null; // Salir de la vista de grid
    renderEditorJuegoPersonalizado({ name: '', pin: '', id: null }, []);
}

// ===== CARGAR EDITOR JUEGO PERSONALIZADO =====

async function cargarEditorJuegoPersonalizado(id) {
    try {
        activeView = null; // Salir de la vista de grid
        const res = await fetchWithAuth(`/api/custom-games/${id}`);

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(errorData.error || `Error ${res.status}`);
        }

        const data = await res.json();

        if (!canModifyOwnedResource(data?.game)) {
            showOwnershipDeniedModal('este juego personalizado');
            await renderVistaPersonalizados();
            return;
        }

        if (!data.game || !data.questions) {
            throw new Error('Datos incompletos del servidor');
        }

        currentCustomGameQuestions = data.questions.map(q => ({
            slide_type: q.slide_type || 'question',
            question_id: q.question_id,
            question_text: q.question_text,
            question_type: q.question_type,
            correct_answer: q.correct_answer,
            bank_name: q.bank_name,
            options: q.options,
            comment_text: q.comment_text,
            slide_title: q.slide_title,
            slide_body: q.slide_body,
            slide_image: q.slide_image,
            slide_image_position: q.slide_image_position,
            position: q.position,
            tipo_contenido: q.tipo_contenido,
            url_recurso: q.url_recurso
        }));
        renderEditorJuegoPersonalizado(data.game, data.questions);
    } catch (err) {
        console.error('Error cargando juego personalizado:', err);
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), 'Error al cargar el juego: ' + err.message, 'error');
    }
}

// ===== RENDERIZAR EDITOR PERSONALIZADO =====

async function renderEditorJuegoPersonalizado(game) {
    const resBanks = await fetchWithAuth('/api/banks');
    const allBanks = await resBanks.json();

    const area = document.getElementById('editorArea');
    area.innerHTML = _tHtml(`
        <div class="max-w-5xl mx-auto px-10 pt-6">
            <!-- Botón volver -->
            <button data-admin-click="mostrarVista('personalizados')"
                class="mb-4 text-slate-600 hover:text-blue-600 font-bold flex items-center gap-2 transition">
                <i class="fas fa-arrow-left"></i>
                ${_t('admin.custom.btn_back', null, 'Volver a Juegos Personalizados')}
            </button>
        </div>

        <div class="xiro-editor-sticky-header">
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <input type="hidden" id="customGameEditId" value="${game.id || ''}">
                <input type="hidden" id="customGameOwnerUserId" value="${game.created_by_user_id ?? ''}">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-lg font-black text-slate-900 italic uppercase">
                        <i class="fas fa-star text-blue-500 mr-2"></i>${_t('admin.custom.form_title', null, 'Juego Personalizado')}
                    </h2>
                    ${game.id ? `<span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">ID: ${game.id}</span>` : ''}
                </div>

                <div class="xiro-editor-header-grid">
                    <!-- Columna 1: Identidad -->
                    <div>
                        <div class="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.custom.label_name', null, 'Nombre del Juego')}</label>
                                <input type="text" id="customGameName" value="${escapeHtml(game.name)}" class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-blue-500 outline-none transition text-sm" placeholder="${_t('admin.custom.ph_name', null, 'Ej: Examen Final Anatomía')}">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.games.label_pin', null, 'PIN Personalizado')}</label>
                                <input type="text" id="customGamePin" value="${game.pin}" class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-blue-500 outline-none transition font-mono text-sm" placeholder="${_t('admin.custom.ph_pin', null, 'Ej: 123456 (vacío = aleatorio)')}">
                            </div>
                        </div>

                        <div class="mb-3 flex items-center justify-center gap-3" title="${_t('admin.games.help_visible', null, 'Si está marcado, el presentador podrá ver y usar este juego')}">
                            <span class="text-base font-bold text-slate-700"><i class="fas fa-eye mr-1"></i>${_t('admin.banks.label_visible', null, 'Mostrar al presentador')}</span>
                            <span style="transform: scale(1); transform-origin: left center;">${renderCheckbox({ id: 'customGameVisibleToPresenter', checked: game.visible_to_presenter !== false, action: null })}</span>
                        </div>
                        <div class="mb-3 text-center">
                            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('common.label_language', null, 'Idioma de las preguntas')}</label>
                            <div class="flex justify-center">${renderLanguageSelect({ id: 'customGameLanguage', value: game.language })}</div>
                        </div>
                        <div class="flex flex-col items-center text-center">${renderGameCoverField('customGame', game.image_url)}</div>
                    </div>

                    <!-- Columna 2: Reglas de puntuación -->
                    <div>
                        <!-- Rachas -->
                        <div class="flex items-center gap-3 mb-2" title="${_t('admin.games.help_streaks', null, 'Aplica bonus de puntos a jugadores con respuestas correctas consecutivas')}">
                            <span class="text-sm font-bold text-slate-700"><i class="fas fa-fire text-orange-400 mr-1"></i>${_t('admin.games.label_streaks', null, 'Usar Rachas')}</span>
                            ${renderCheckbox({ id: 'customGameUseStreaks', checked: game.use_streaks, action: null, attrs: 'data-admin-change="toggleCustomStreakConfig()"' })}
                        </div>

                        <div id="customStreakConfigPanel" class="${game.use_streaks ? '' : 'hidden'} ml-6 grid grid-cols-2 gap-3 mb-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.games.streak_threshold_label', null, 'Preguntas para activar Racha')}</label>
                                <input type="number" id="customGameStreakThreshold" min="1" max="20" value="${game.streak_threshold ?? 3}"
                                    class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-orange-400 outline-none text-sm">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.games.streak_bonus_label', null, 'Multiplicador de bonus racha')}</label>
                                <input type="number" id="customGameStreakBonusPercentage" min="0" max="2" step="0.05" value="${game.streak_bonus_percentage ?? 0.5}"
                                    class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-orange-400 outline-none text-sm">
                            </div>
                        </div>

                        <!-- Dobles Rachas -->
                        <div class="flex items-center gap-3 mb-2" title="${_t('admin.games.help_dbl_streaks', null, 'Bonus adicional para jugadores que superan un umbral mayor de aciertos consecutivos')}">
                            <span class="text-sm font-bold text-slate-700"><i class="fas fa-fire text-red-500 mr-1"></i>${_t('admin.games.label_dbl_streaks', null, 'Usar Dobles Rachas')}</span>
                            ${renderCheckbox({ id: 'customGameUseDoubleStreaks', checked: game.use_double_streaks, action: null, attrs: 'data-admin-change="toggleCustomDoubleStreakConfig()"' })}
                        </div>

                        <div id="customDoubleStreakConfigPanel" class="${game.use_double_streaks ? '' : 'hidden'} ml-6 grid grid-cols-2 gap-3 mb-3 p-3 bg-red-50 rounded-lg border border-red-100">
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.games.dbl_threshold_label', null, 'Preguntas para Doble Racha')}</label>
                                <input type="number" id="customGameDoubleStreakThreshold" min="1" max="20" value="${game.double_streak_threshold ?? 5}"
                                    class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-red-400 outline-none text-sm">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.games.dbl_bonus_label', null, 'Multiplicador bonus doble racha')}</label>
                                <input type="number" id="customGameDoubleStreakBonusPercentage" min="0" max="2" step="0.05" value="${game.double_streak_bonus_percentage ?? 1.0}"
                                    class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-red-400 outline-none text-sm">
                            </div>
                        </div>

                        <!-- Puntuación Aleatoria -->
                        ${renderRandomPointsHtml('customGame', game)}
                    </div>
                </div>
            </div>
        </div>

        <div class="xiro-editor-wide-row xiro-editor-twocard-grid">
            ${(typeof getHTMLBusquedaPreguntas === 'function') ? getHTMLBusquedaPreguntas() : ''}

            <div class="bg-white rounded-2xl shadow-sm p-8 border border-slate-200">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-black text-slate-700 uppercase">${_t('admin.custom.section_selector', null, 'Selector de Preguntas')}</h3>
                </div>

                <div class="mb-4">
                    <label class="block text-xs font-bold text-slate-400 uppercase mb-2">${_t('admin.custom.label_bank', null, 'Selecciona un Banco')}</label>
                    <select id="selectorBanco" data-admin-change="cargarPreguntasBanco()" class="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none">
                        <option value="">${_t('admin.custom.ph_bank', null, '-- Selecciona un banco --')}</option>
                        ${allBanks.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
                    </select>
                </div>

                <div id="preguntasDisponibles" class="space-y-2 max-h-96 overflow-y-auto">
                    <p class="text-slate-400 text-sm italic text-center py-8">${_t('admin.custom.bank_placeholder', null, 'Selecciona un banco para ver las preguntas disponibles')}</p>
                </div>
            </div>
        </div>

        <div class="max-w-5xl mx-auto px-10 pb-10">
            ${_customToolbarHtml()}

            <div class="bg-white rounded-2xl shadow-sm p-8 mb-8 border border-slate-200">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-black text-slate-700 uppercase">${_t('admin.custom.section_selected', null, 'Preguntas Seleccionadas ({n})').replace('{n}', currentCustomGameQuestions.length)}</h3>
                </div>
                <div id="listaCustomQuestions" class="space-y-3"></div>
                ${currentCustomGameQuestions.length === 0 ? `<p class="text-slate-400 text-sm italic text-center py-8">${_t('admin.custom.no_questions', null, 'Aún no has seleccionado ninguna pregunta')}</p>` : ''}
                <div class="flex justify-between items-center mt-8 mb-6">
                    <h3 class="text-xl font-black text-slate-700 uppercase">${_t('admin.custom.section_selected', null, 'Preguntas Seleccionadas ({n})').replace('{n}', currentCustomGameQuestions.length)}</h3>
                </div>
            </div>

            <div class="bg-white rounded-2xl shadow-sm p-8 mb-8 border border-slate-200">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-black text-slate-700 uppercase">${_t('admin.custom.section_selector', null, 'Selector de Preguntas')}</h3>
                </div>
                <div class="mb-4">
                    <label class="block text-xs font-bold text-slate-400 uppercase mb-2">${_t('admin.custom.label_bank', null, 'Selecciona un Banco')}</label>
                    <select id="selectorBanco2" data-admin-change="cargarPreguntasBanco('selectorBanco2', 'preguntasDisponibles2')" class="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none">
                        <option value="">${_t('admin.custom.ph_bank', null, '-- Selecciona un banco --')}</option>
                        ${allBanks.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
                    </select>
                </div>
                <div id="preguntasDisponibles2" class="space-y-2 max-h-96 overflow-y-auto">
                    <p class="text-slate-400 text-sm italic text-center py-8">${_t('admin.custom.bank_placeholder', null, 'Selecciona un banco para ver las preguntas disponibles')}</p>
                </div>
            </div>

            ${_customSaveButtonsHtml(game)}
        </div>`);

    setUnsavedChangesGuard('personalizados', _customGameEditorSnapshot);

    dibujarPreguntasPersonalizadas();
    _syncPersonalizadosToolbarOffset();
}

/** Barra "Añadir contenido": actividad, info, texto, imagen, texto+imagen. */
function _customToolbarHtml() {
    return `
            <div class="xiro-toolbar-bar xiro-toolbar-bar--below-header bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm px-4 py-2 mb-6 flex items-center justify-center gap-2" role="toolbar" aria-label="${_t('admin.custom.toolbar_label', null, 'Añadir contenido')}">
                <button type="button" data-admin-click="mostrarModalComentario()"
                    class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg"
                    aria-label="${_t('admin.custom.btn_activity', null, 'AÑADIR ACTIVIDAD LIBRE (PUNTOS MANUALES)')}">
                    <i class="fas fa-comment-dots" aria-hidden="true"></i> ${_t('admin.custom.btn_short_activity', null, 'Actividad')}
                </button>
                <button type="button" data-admin-click="mostrarModalInfo()"
                    class="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg"
                    aria-label="${_t('admin.custom.btn_info_slide', null, 'AÑADIR SLIDE INFORMATIVO')}">
                    <i class="fas fa-info-circle" aria-hidden="true"></i> ${_t('admin.custom.btn_short_info', null, 'Info')}
                </button>
                <button type="button" data-admin-click="mostrarModalTexto()"
                    class="bg-gradient-to-r from-aubergine-600 to-plum-600 hover:from-aubergine-700 hover:to-plum-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg"
                    aria-label="${_t('admin.custom.btn_text_slide', null, 'AÑADIR DIAPOSITIVA DE TEXTO (TÍTULO + TEXTO)')}">
                    <i class="fas fa-align-left" aria-hidden="true"></i> ${_t('admin.custom.btn_short_text', null, 'Texto')}
                </button>
                <button type="button" data-admin-click="mostrarModalImagen()"
                    class="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg"
                    aria-label="${_t('admin.custom.btn_img_slide', null, 'AÑADIR DIAPOSITIVA DE IMAGEN')}">
                    <i class="fas fa-image" aria-hidden="true"></i> ${_t('admin.custom.btn_short_image', null, 'Imagen')}
                </button>
                <button type="button" data-admin-click="mostrarModalTextoImagen()"
                    class="bg-plum-600 hover:bg-plum-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg"
                    aria-label="${_t('admin.custom.btn_text_img_slide', null, 'AÑADIR DIAPOSITIVA TEXTO + IMAGEN')}">
                    <i class="fas fa-columns" aria-hidden="true"></i> ${_t('admin.custom.btn_short_text_img', null, 'Texto+Img')}
                </button>
            </div>`;
}

/** Botones de guardar (y exportar a PDF si el juego ya existe). */
function _customSaveButtonsHtml(game) {
    return `
            <div class="mt-8">
                <div class="grid grid-cols-2 gap-4">
                    <button data-admin-click="guardarJuegoPersonalizado(false)" class="bg-white text-camaleon-700 border-2 border-camaleon-600 px-6 py-5 rounded-2xl font-black text-lg hover:bg-camaleon-50 transition shadow-sm flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95">
                        <i class="fas fa-save text-xl"></i> ${_t('admin.custom.btn_save', null, 'GUARDAR JUEGO')}
                    </button>
                    <button data-admin-click="guardarJuegoPersonalizado(true)" class="bg-camaleon-600 text-white border-2 border-camaleon-600 px-6 py-5 rounded-2xl font-black text-lg hover:bg-camaleon-700 hover:border-camaleon-700 transition shadow-xl shadow-camaleon-200 flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95">
                        <i class="fas fa-cloud-upload-alt text-xl"></i> ${_t('admin.custom.btn_save_exit', null, 'GUARDAR Y SALIR')}
                    </button>
                </div>
                ${game.id ? `
                <div class="mt-4">
                    <button data-admin-click="exportarJuegoAPDF(${game.id}, '${escapeHtml(jsStringContent(game.name))}')" class="w-full bg-plum-600 text-white px-6 py-4 rounded-2xl font-bold text-lg hover:bg-plum-700 transition shadow-xl shadow-plum-200 flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95">
                        <i class="fas fa-file-pdf text-xl"></i> ${_t('admin.custom.btn_export_pdf', null, 'EXPORTAR A PDF')}
                    </button>
                </div>
                ` : ''}
                <p class="text-center text-slate-400 text-xs mt-3">
                    <i class="fas fa-info-circle mr-1"></i>${_t('admin.games.help_save', null, '"Guardar" mantiene el editor abierto, "Guardar y salir" vuelve a la lista de juegos')}
                </p>
            </div>`;
}

/** Estado del editor para detectar cambios sin guardar. */
function _customGameEditorSnapshot() {
    return {
        id: document.getElementById('customGameEditId')?.value || '',
        name: document.getElementById('customGameName')?.value || '',
        pin: document.getElementById('customGamePin')?.value || '',
        language: document.getElementById('customGameLanguage')?.value || 'es',
        visible_to_presenter: document.getElementById('customGameVisibleToPresenter')?.checked ?? true,
        use_streaks: document.getElementById('customGameUseStreaks')?.checked ?? false,
        streak_threshold: parseFloat(document.getElementById('customGameStreakThreshold')?.value ?? 3),
        streak_bonus_percentage: parseFloat(document.getElementById('customGameStreakBonusPercentage')?.value ?? 0.5),
        use_double_streaks: document.getElementById('customGameUseDoubleStreaks')?.checked ?? false,
        double_streak_threshold: parseFloat(document.getElementById('customGameDoubleStreakThreshold')?.value ?? 5),
        double_streak_bonus_percentage: parseFloat(document.getElementById('customGameDoubleStreakBonusPercentage')?.value ?? 1.0),
        image_url: document.getElementById('customGameImageUrl')?.value || '',
        ...snapshotRandomPoints('customGame'),
        questions: currentCustomGameQuestions
    };
}

/** Mantiene la toolbar "Añadir contenido" pegada justo debajo de la
 * cabecera sticky de Nombre+Configuración, cuya altura varía al
 * desplegar los paneles de Rachas/Dobles Rachas. */
function _syncPersonalizadosToolbarOffset() {
    const header = document.querySelector('.xiro-editor-sticky-header');
    const toolbar = document.querySelector('.xiro-toolbar-bar--below-header');
    if (!header || !toolbar) return;
    toolbar.style.top = `${header.offsetHeight}px`;
}

// ===== CARGAR PREGUNTAS DE UN BANCO =====

async function cargarPreguntasBanco(selectorId = 'selectorBanco', contenedorId = 'preguntasDisponibles') {
    const selectorEl = document.getElementById(selectorId);
    if (!selectorEl) return;
    const bankId = selectorEl.value;
    if (!bankId) {
        document.getElementById(contenedorId).innerHTML = _tHtml(`<p class="text-slate-400 text-sm italic text-center py-8">${_t('admin.custom.bank_placeholder', null, 'Selecciona un banco para ver las preguntas disponibles')}</p>`);
        return;
    }

    const res = await fetchWithAuth(`/api/banks/${bankId}`);
    const data = await res.json();
    currentBankData = data; // Guardar para uso posterior

    const contenedor = document.getElementById(contenedorId);
    contenedor.innerHTML = data.questions.map((q) => {
        const correctAnswer = extractCorrectAnswerFrontend(q);
        const correctDisplay = formatCorrectAnswerDisplayFrontend(correctAnswer);
        const alreadyAdded = currentCustomGameQuestions.some(cq => cq.question_id != null && Number(cq.question_id) === Number(q.id));

        return `
                <div class="bg-slate-50 p-4 rounded-xl border-2 ${alreadyAdded ? 'border-green-300 bg-green-50' : 'border-slate-200'}">
                    <div class="flex items-start gap-4">
                        <button 
                            data-admin-click="agregarPreguntaPersonalizada(${q.id})" 
                            class="mt-1 ${alreadyAdded ? 'bg-green-500' : 'bg-blue-600'} hover:bg-blue-700 text-white w-8 h-8 rounded-full flex items-center justify-center transition text-sm flex-shrink-0"
                            ${alreadyAdded ? 'disabled' : ''}
                        >
                            <i class="fas ${alreadyAdded ? 'fa-check' : 'fa-plus'}"></i>
                        </button>
                        <div class="flex-1">
                            <p class="font-medium text-sm text-slate-800">${escapeHtml(q.question_text)}</p>
            <p class="text-xs text-green-600 mt-1"><i class="fas fa-check-circle mr-1"></i>${q.question_type === 'survey' ? _t('admin.custom.survey_answer', null, 'Encuesta (votos)') : escapeHtml(correctDisplay)}</p>
                        </div>
                    </div>
                </div>
            `;
    }).join('');
}

// ===== REFRESCAR TODOS LOS SELECTORES DE BANCO =====

function refreshAllBancosSelectors() {
    cargarPreguntasBanco('selectorBanco', 'preguntasDisponibles');
    if (document.getElementById('selectorBanco2')) {
        cargarPreguntasBanco('selectorBanco2', 'preguntasDisponibles2');
    }
}

// ===== AGREGAR PREGUNTA PERSONALIZADA =====

const _CUSTOM_EMPTY_TYPE_FIELDS = {
    correct_answer: null, correct_word: null, word_length: null, scrambled_letters: null,
    max_points: null, tolerance_mode: null, tolerance_value: null, tolerance_cap: null, hint_text: null,
    mc_points_per_correct: null, mc_penalty_per_incorrect: null, mc_perfect_bonus: null
};

// Campos propios de cada tipo; el resto queda a null (_CUSTOM_EMPTY_TYPE_FIELDS)
const _CUSTOM_TYPE_FIELDS = {
    numeric_approximation: q => ({
        correct_answer: q.correct_answer,
        max_points: q.max_points,
        tolerance_mode: q.tolerance_mode || 'hybrid',
        tolerance_value: q.tolerance_value ?? 25,
        tolerance_cap: q.tolerance_cap ?? 1000,
        hint_text: q.hint_text || null
    }),
    word_scramble: q => ({
        correct_word: q.correct_word || null,
        word_length: q.word_length || null,
        scrambled_letters: q.scrambled_letters || null
    }),
    multiple_choice: q => ({
        mc_points_per_correct: q.mc_points_per_correct ?? 10,
        mc_penalty_per_incorrect: q.mc_penalty_per_incorrect ?? 10,
        mc_perfect_bonus: q.mc_perfect_bonus ?? 20
    })
};

/** Pregunta del banco (API) → entrada de currentCustomGameQuestions. */
function _customQuestionFromBank(question, questionId, bankName) {
    const type = question.question_type;
    const withoutOptions = type === 'numeric_approximation' || type === 'word_scramble';
    const safeOptions = Array.isArray(question.options) ? question.options : [];
    const typeFields = Object.hasOwn(_CUSTOM_TYPE_FIELDS, type) ? _CUSTOM_TYPE_FIELDS[type](question) : {};
    return {
        slide_type: 'question',
        question_id: questionId,
        question_type: type,
        question_text: question.question_text,
        bank_name: bankName,
        options: withoutOptions ? [] : safeOptions.map(o => ({
            optionText: o.option_text,
            isCorrect: !!o.is_correct,
            justification: o.justification
        })),
        ..._CUSTOM_EMPTY_TYPE_FIELDS,
        ...typeFields,
        position: currentCustomGameQuestions.length
    };
}

function agregarPreguntaPersonalizada(questionId) {
    // Verificar si ya está añadida
    if (currentCustomGameQuestions.some(q => q.question_id != null && Number(q.question_id) === Number(questionId))) {
        return;
    }

    // Usar los datos del banco actual
    if (!currentBankData) {
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), 'Error: No hay banco seleccionado', 'error');
        return;
    }

    const question = currentBankData.questions.find(q => q.id === questionId);
    if (!question) {
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), 'Error: Pregunta no encontrada', 'error');
        return;
    }

    currentCustomGameQuestions.push(_customQuestionFromBank(question, questionId, currentBankData.bank.name));

    dibujarPreguntasPersonalizadas();
    refreshAllBancosSelectors(); // Refrescar todos los selectores para marcar como añadida
    if (typeof refrescarResultadosBusqueda === 'function') refrescarResultadosBusqueda();
}

// ===== DIBUJAR PREGUNTAS PERSONALIZADAS =====

function dibujarPreguntasPersonalizadas() {
    const contenedor = document.getElementById('listaCustomQuestions');
    if (!contenedor) return;

    const label = _t('admin.custom.section_selected', null, 'Preguntas Seleccionadas ({n})').replace('{n}', currentCustomGameQuestions.length);
    contenedor.parentElement.querySelectorAll('h3').forEach(h3 => {
        h3.textContent = label;
    });

    if (currentCustomGameQuestions.length === 0) {
        contenedor.innerHTML = _tHtml(`<p class="text-slate-400 text-sm italic text-center py-8">${_t('admin.custom.no_questions', null, 'Aún no has seleccionado ninguna pregunta')}</p>`);
        return;
    }

    contenedor.innerHTML = currentCustomGameQuestions
        .map((q, idx) => renderCustomQuestionCard(q, idx, currentCustomGameQuestions.length))
        .join('');
}

// ===== MOVER PREGUNTAS =====

function moverPreguntaArriba(idx) {
    if (idx === 0) return;
    const temp = currentCustomGameQuestions[idx];
    currentCustomGameQuestions[idx] = currentCustomGameQuestions[idx - 1];
    currentCustomGameQuestions[idx - 1] = temp;
    dibujarPreguntasPersonalizadas();
}

function moverPreguntaAbajo(idx) {
    if (idx === currentCustomGameQuestions.length - 1) return;
    const temp = currentCustomGameQuestions[idx];
    currentCustomGameQuestions[idx] = currentCustomGameQuestions[idx + 1];
    currentCustomGameQuestions[idx + 1] = temp;
    dibujarPreguntasPersonalizadas();
}

function moverPreguntaAPosicion(fromIdx, toIdx) {
    const total = currentCustomGameQuestions.length;
    toIdx = Math.max(0, Math.min(total - 1, Math.round(toIdx)));
    if (toIdx === fromIdx) return;
    const [item] = currentCustomGameQuestions.splice(fromIdx, 1);
    currentCustomGameQuestions.splice(toIdx, 0, item);
    dibujarPreguntasPersonalizadas();
}

function eliminarPreguntaPersonalizada(idx) {
    currentCustomGameQuestions.splice(idx, 1);
    dibujarPreguntasPersonalizadas();
    refreshAllBancosSelectors(); // Refrescar ambos selectores para quitar la marca de añadida
    if (typeof refrescarResultadosBusqueda === 'function') refrescarResultadosBusqueda();
}

function toggleCustomStreakConfig() {
    const enabled = document.getElementById('customGameUseStreaks')?.checked;
    const panel = document.getElementById('customStreakConfigPanel');
    if (panel) panel.classList.toggle('hidden', !enabled);
    _syncPersonalizadosToolbarOffset();
}

function toggleCustomDoubleStreakConfig() {
    const enabled = document.getElementById('customGameUseDoubleStreaks')?.checked;
    const panel = document.getElementById('customDoubleStreakConfigPanel');
    if (panel) panel.classList.toggle('hidden', !enabled);
    _syncPersonalizadosToolbarOffset();
}

// ===== GUARDAR JUEGO PERSONALIZADO =====

function _readCustomGameForm() {
    return {
        id: document.getElementById('customGameEditId').value,
        ownerUserId: document.getElementById('customGameOwnerUserId')?.value || null,
        name: document.getElementById('customGameName').value,
        pin: document.getElementById('customGamePin').value,
        language: document.getElementById('customGameLanguage')?.value || 'es',
        visibleToPresenter: document.getElementById('customGameVisibleToPresenter').checked,
        imageUrl: document.getElementById('customGameImageUrl')?.value || null
    };
}

function _readCustomGameStreaks() {
    return {
        use_streaks: document.getElementById('customGameUseStreaks').checked,
        streak_threshold: parseFloat(document.getElementById('customGameStreakThreshold').value) || 3,
        streak_bonus_percentage: parseFloat(document.getElementById('customGameStreakBonusPercentage').value) ?? 0.5,
        use_double_streaks: document.getElementById('customGameUseDoubleStreaks').checked,
        double_streak_threshold: parseFloat(document.getElementById('customGameDoubleStreakThreshold').value) || 5,
        double_streak_bonus_percentage: parseFloat(document.getElementById('customGameDoubleStreakBonusPercentage').value) ?? 1.0
    };
}

/** Mensaje de validación del juego personalizado, o null si se puede guardar. */
function _customGameValidationError(form, randomPoints) {
    const randomPointsCheck = validateRandomPointsConfig(randomPoints);
    if (!randomPointsCheck.valid) return randomPointsCheck.message;
    if (!form.name) return _t('admin.custom.error_name', null, 'Por favor, ponle un nombre al juego');
    if (currentCustomGameQuestions.length === 0) return _t('admin.custom.error_questions', null, 'Añade al menos una pregunta');
    return null;
}

function _customSlideForSave(q) {
    return {
        slide_type: q.slide_type || 'question',
        question_id: q.question_id || null,
        comment_text: q.comment_text || null,
        slide_title: q.slide_title || null,
        slide_body: q.slide_body || null,
        slide_image: q.slide_image || null,
        slide_image_position: q.slide_image_position || null
    };
}

async function _afterCustomGameSaved(salir, id, data) {
    markUnsavedChangesAsSaved();
    mostrarModalError(_t('admin.common.success_title', null, '✅ Éxito'), _t('admin.custom.success_saved', null, '¡Juego personalizado guardado correctamente!'), 'success');

    if (salir) {
        // Volver a la vista de personalizados
        mostrarVista('personalizados');
    } else if (!id && data.id) {
        // Creación (POST): fijar el ID para futuras actualizaciones y recargar el juego completo
        document.getElementById('customGameEditId').value = data.id;
        await cargarEditorJuegoPersonalizado(data.id);
    }
    // Si ya existía, solo mantener el editor abierto
}

async function guardarJuegoPersonalizado(salir = true) {
    const form = _readCustomGameForm();
    const randomPoints = readRandomPointsConfig('customGame');

    const validationError = _customGameValidationError(form, randomPoints);
    if (validationError) {
        return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), validationError, 'warning');
    }
    if (form.id && !canModifyOwnedResource(form.ownerUserId)) {
        showOwnershipDeniedModal('este juego personalizado');
        return;
    }

    const payload = {
        name: form.name,
        pin: form.pin || Math.floor(100000 + Math.random() * 900000).toString(),
        language: form.language,
        visible_to_presenter: form.visibleToPresenter,
        ..._readCustomGameStreaks(),
        image_url: form.imageUrl,
        ...randomPoints,
        questions: currentCustomGameQuestions.map(_customSlideForSave)
    };

    try {
        const url = form.id ? `/api/custom-games/${form.id}` : '/api/custom-games';
        const method = form.id ? 'PUT' : 'POST';

        const res = await fetchWithAuth(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            await _afterCustomGameSaved(salir, form.id, await res.json());
        } else {
            const err = await res.json();
            const mensaje = err.message || err.error || 'Error desconocido';
            mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), mensaje, 'error');
        }
    } catch (error) {
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), 'Error de conexión con el servidor', 'error');
    }
}

// ===== ELIMINAR JUEGO PERSONALIZADO =====

function borrarJuegoPersonalizado(id, ownerUserId = null) {
    if (!canModifyOwnedResource(ownerUserId)) {
        showOwnershipDeniedModal('este juego personalizado');
        return;
    }
    mostrarModalConfirmacion(
        _t('admin.common.confirmation_title', null, '⚠️ Confirmación'),
        _t('admin.custom.confirm_delete', null, '¿Deseas eliminar este juego personalizado para siempre?'),
        async () => {
            try {
                const res = await fetchWithAuth(`/api/custom-games/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    // Refrescar la vista de personalizados
                    renderVistaPersonalizados();
                } else {
                    const err = await res.json();
                    mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), err.error || err.message || _t('admin.custom.error_delete', null, 'No se pudo eliminar el juego personalizado'), 'error');
                }
            } catch {
                mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.custom.error_delete', null, 'Error al eliminar el juego personalizado'), 'error');
            }
        },
        null,
        _t('admin.common.delete', null, 'Eliminar'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}
