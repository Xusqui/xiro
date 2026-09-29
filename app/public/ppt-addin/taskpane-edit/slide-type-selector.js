/**
 * @module slide-type-selector
 * @description Tarjetas de rol XIRO para la diapositiva activa.
 * @depends [taskpane-edit/notes-writer, taskpane-edit/lobby-editor,
 *           taskpane-edit/question-editor]
 */

const XiroSlideTypeSelector = (() => {

    let _container = null;
    let _editorArea = null;
    let _currentRole = null;

    const ROLES = [
        { value: 'lobby', label: 'Lobby', icon: '⬡', desc: 'QR + unirse' },
        { value: 'question', label: 'Pregunta', icon: '◈', desc: 'Turno de juego' },
        { value: 'podium', label: 'Podio', icon: '◉', desc: 'Resultados' },
    ];

    function mount(selectorContainer, editorContainer, currentRole, currentMeta) {
        _container = selectorContainer;
        _editorArea = editorContainer;
        _currentRole = currentRole || '';

        const cards = ROLES.map(r => `
            <button class="role-card${r.value === _currentRole ? ' active' : ''}" data-role="${r.value}">
                <span class="role-card__icon">${r.icon}</span>
                <span class="role-card__label">${r.label}</span>
                <span class="role-card__desc">${r.desc}</span>
            </button>
        `).join('');

        _container.innerHTML = `
            <p class="tp-section-title">Tipo de diapositiva</p>
            <div class="role-cards">${cards}</div>
        `;

        _container.querySelectorAll('.role-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const role = btn.dataset.role;
                if (role === _currentRole) return;
                _activateRoleCard(btn);
                _onRoleChange(role);
            });
        });

        _mountEditor(_currentRole, currentMeta);
    }

    function _activateRoleCard(btn) {
        _container.querySelectorAll('.role-card').forEach(b => b.classList.toggle('active', b === btn));
    }

    async function _onRoleChange(newRole) {
        _currentRole = newRole;
        if (!newRole) {
            try { await XiroNotesWriter.clearXiroMeta(); } catch (_) { } // eslint-disable-line no-undef
        }
        _mountEditor(newRole, null);
    }

    function _mountEditor(role, meta) {
        if (typeof XiroLobbyEditor !== 'undefined') XiroLobbyEditor.unmount();       // eslint-disable-line no-undef
        if (typeof XiroQuestionEditor !== 'undefined') XiroQuestionEditor.unmount(); // eslint-disable-line no-undef
        if (_editorArea) _editorArea.innerHTML = '';

        switch (role) {
            case 'lobby': XiroLobbyEditor.mount(_editorArea, meta); break;       // eslint-disable-line no-undef
            case 'question': XiroQuestionEditor.mount(_editorArea, meta); break;    // eslint-disable-line no-undef
            case 'podium':
                _editorArea.innerHTML = `
                    <p class="editor-hint">Mostrará el podio final al llegar a esta diapositiva. Sin configuración extra.</p>
                    <button id="sts-save-podium" class="save-btn">Guardar en diapositiva</button>
                `;
                document.getElementById('sts-save-podium').addEventListener('click', async () => {
                    const btn = document.getElementById('sts-save-podium');
                    btn.disabled = true; btn.textContent = 'Guardando…';
                    try {
                        await XiroNotesWriter.writeXiroMeta({ role: 'podium' }); // eslint-disable-line no-undef
                        btn.textContent = '✓ Guardado';
                        if (typeof XiroEditPanel !== 'undefined') XiroEditPanel.refresh(); // eslint-disable-line no-undef
                        setTimeout(() => { if (btn.isConnected) btn.textContent = 'Guardar en diapositiva'; }, 2000);
                    } catch (err) {
                        alert('Error: ' + err.message);
                        btn.textContent = 'Guardar en diapositiva';
                    } finally { btn.disabled = false; }
                });
                break;
            default:
                if (_editorArea) _editorArea.innerHTML = '<p class="editor-hint">Selecciona un tipo para configurar esta diapositiva.</p>';
        }
    }

    function unmount() {
        if (_container) _container.innerHTML = '';
        if (_editorArea) _editorArea.innerHTML = '';
    }

    return { mount, unmount };
})();
