/**
 * @module question-editor
 * @description Formulario para configurar una diapositiva de pregunta.
 *   Permite asignar el índice (0-based) de la pregunta a mostrar.
 * @depends [taskpane-edit/notes-writer]
 */

const XiroQuestionEditor = (() => {

    let _container = null;

    /**
     * Monta el editor en el contenedor.
     * @param {HTMLElement} container
     * @param {{ role:'question', index?:number }|null} existingMeta
     */
    function mount(container, _existingMeta) {
        _container = container;

        _container.innerHTML = `
            <div class="editor-field">
                <p class="editor-hint">El servidor avanza automáticamente a la siguiente pregunta.</p>
            </div>
            <button id="qe-save" class="save-btn">Guardar en diapositiva</button>
        `;

        document.getElementById('qe-save').addEventListener('click', _onSave);
    }

    async function _onSave() {
        const btn = document.getElementById('qe-save');

        btn.disabled = true; btn.textContent = 'Guardando…';
        try {
            await XiroNotesWriter.writeXiroMeta({ role: 'question' }); // eslint-disable-line no-undef
            btn.textContent = '✓ Guardado';
            if (typeof XiroEditPanel !== 'undefined') XiroEditPanel.refresh(); // eslint-disable-line no-undef
            setTimeout(() => {
                if (btn.isConnected) btn.textContent = 'Guardar en diapositiva';
            }, 2000);
        } catch (err) {
            alert('Error al guardar: ' + err.message);
            btn.textContent = 'Guardar en diapositiva';
        } finally {
            btn.disabled = false;
        }
    }

    function unmount() { if (_container) _container.innerHTML = ''; }

    return { mount, unmount };
})();
