/**
 * @fileoverview Editor de «Completa la frase» (fill_blanks). El enunciado se escribe
 * con las palabras a adivinar entre corchetes: "La infección por [Helicobacter]
 * [pylori] causa úlceras [duodenales]". Debajo se ve en vivo cómo quedará (una
 * casilla por letra) y los errores de las reglas: 1-3 huecos, 4-14 letras, solo letras.
 * Las tildes y minúsculas se aceptan y se normalizan solas ([Época] → EPOCA; Ñ y Ç se
 * conservan). Al guardar, bank-question-mapping.js convierte la frase a marcadores +
 * palabras con las mismas reglas que el servidor (FillBlanksQuestionValidator).
 * Exporta (globales): fillBlanksEditorSectionHtml, actualizarFraseHuecos, fillBlanksErrorText
 */

function _fillBlanksCore() {
    return window.XiroFillBlanks;
}

// Código de error del núcleo → clave i18n y texto por defecto
const _FILL_BLANKS_ERRORS = {
    no_blanks: ['admin.q.fillblanks_err_no_blanks', 'Escribe al menos una palabra entre corchetes: [palabra]'],
    too_many_blanks: ['admin.q.fillblanks_err_too_many', 'Como máximo 3 palabras entre corchetes'],
    unbalanced: ['admin.q.fillblanks_err_unbalanced', 'Hay un corchete sin cerrar o suelto'],
    marker_literal: [
        'admin.q.fillblanks_err_marker',
        'No escribas {{n}} en la frase: las palabras a adivinar van entre corchetes'
    ],
    word_chars: ['admin.q.fillblanks_err_chars', '«{word}»: solo letras, sin espacios, números, guiones ni signos'],
    word_short: ['admin.q.fillblanks_err_short', '«{word}»: al menos 4 letras'],
    word_long: ['admin.q.fillblanks_err_long', '«{word}»: como mucho 14 letras']
};

/** Texto legible de un error de parseEditorText. */
function fillBlanksErrorText(error) {
    const entry = _FILL_BLANKS_ERRORS[error.code] || ['admin.q.fillblanks_err_generic', 'La frase no es válida'];
    const word = error.word || '';
    return _t(entry[0], { word }, entry[1]).replace('{word}', word);
}

/** Vista previa en vivo: casillas por letra y palabras, o la lista de errores. */
function sanitizeFillBlanksPreview(text) {
    const core = _fillBlanksCore();
    if (!core) return '';
    const parsed = core.parseEditorText(text || '');
    if (parsed.errors.length > 0) {
        return `<ul class="text-xs text-red-600 space-y-1 ml-4 list-disc">
                ${parsed.errors.map(error => `<li>${escapeHtml(fillBlanksErrorText(error))}</li>`).join('')}
            </ul>`;
    }
    const lengths = parsed.words.map(word => word.length);
    const words = parsed.words
        .map(word => `<span class="font-mono font-bold tracking-widest">${escapeHtml(word)}</span>`)
        .join(' · ');
    return `<div class="fb-editor-preview">${core.sanitizeSentenceHtml(parsed.text, lengths, { sizeClass: 'fb-sentence--editor' })}</div>
            <p class="xq-preview__words"><i class="fas fa-key" aria-hidden="true"></i> ${words}</p>`;
}

/** Sección del editor para «Completa la frase» (questionTypeSectionHtml). */
function fillBlanksEditorSectionHtml(q, qIdx) {
    const help = questionHelpHtml(q, [
        _t('admin.q.fillblanks_help_play', null, 'El jugador escribe cada palabra con el teclado del móvil; la longitud de cada hueco se ve en las casillas'),
        _t('admin.q.fillblanks_help_points', null, 'Puntuación: 20 pts por palabra acertada (o la puntuación aleatoria) + un bonus de tiempo por pregunta'),
        _t('admin.q.fillblanks_help_hints', null, 'Pistas: hasta 3 letras por hueco; la palabra pasa a valer el 70 %, el 40 % y el 25 %'),
        _t('admin.q.fillblanks_help_streak', null, 'Cuenta como acierto (y para la racha) con la mitad de los huecos o más'),
        _t('admin.q.fillblanks_help_team', null, 'En equipos cada hueco se comprueba al completarlo y lo acertado aparece a todo el equipo')
    ]);
    const body = `
                        <div>
                            <label for="fb-text-${qIdx}" class="xq-label">${_t('admin.q.fillblanks_text_label', null, 'Frase con las palabras a adivinar entre corchetes (1-3 palabras, de 4 a 14 letras)')}</label>
                            <textarea id="fb-text-${qIdx}" rows="3" class="xq-field xq-field--sentence" aria-describedby="fb-note-${qIdx}"
                                data-admin-input="actualizarFraseHuecos(${qIdx}, this.value)"
                                placeholder="${escapeHtml(_t('admin.q.fillblanks_placeholder', null, 'La infección por [Helicobacter] [pylori] causa más del 90% de las úlceras [duodenales]'))}"
                            >${escapeHtml(q.questionText || '')}</textarea>
                            <p class="xq-hint" id="fb-note-${qIdx}">${_t('admin.q.fillblanks_normalize_note', null, 'Las tildes y minúsculas se normalizan solas ([Época] → EPOCA). La Ñ y la Ç se conservan.')}</p>
                        </div>
                        <div>
                            <p class="xq-label">${_t('admin.q.fillblanks_preview', null, 'Así lo verán los jugadores')}</p>
                            <div id="fb-preview-${qIdx}" class="xq-preview" aria-live="polite">${sanitizeFillBlanksPreview(q.questionText)}</div>
                        </div>${help}`;
    return questionSectionHtml(
        _t('admin.q.fillblanks_title', null, 'Frase con huecos'),
        _t('admin.q.fillblanks_intro', null, 'El jugador ve la frase con huecos (una casilla por letra) y escribe la palabra de cada uno. Las palabras a adivinar van entre corchetes.'),
        body
    );
}

/** Guarda la frase y refresca solo la vista previa (sin redibujar: el cursor se queda donde está). */
function actualizarFraseHuecos(qIdx, value) {
    const q = preguntasData[qIdx];
    if (!q) return;
    q.questionText = value;
    const preview = document.getElementById(`fb-preview-${qIdx}`);
    if (!preview) return;
    const html = sanitizeFillBlanksPreview(value);
    preview.innerHTML = typeof _tHtml === 'function' ? _tHtml(html) : html;
}
