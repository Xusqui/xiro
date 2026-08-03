/**
 * @fileoverview Pantalla de selección de juego para modo Standalone
 * Permite al usuario elegir entre bancos y juegos personalizados disponibles
 */

'use strict';

globalThis.StandaloneLobby = (() => {
    const state = {
        games: [],
        filteredGames: [],
        currentFilter: 'all'
    };

    /**
     * /api/ui-settings/standalone-games devuelve `type` como etiqueta legible
     * en español ("Juego", "Juego Personalizado", "Banco", "Quiz", "Trivial"),
     * no como valor normalizado (ver dbService.getPinsForPresenter). La
     * normalizamos aquí para poder filtrar/colorear sin tocar el backend.
     */
    function _normalizeType(rawType) {
        const value = String(rawType || '').toLowerCase();
        if (value.includes('trivial')) return 'trivial';
        if (value.includes('personalizado') || value.includes('custom')) return 'custom';
        return 'bank';
    }

    // Misma paleta por tipo que el selector de PINs del presentador
    // (ver renderizarPINs en js/presenter/presenter-lobby.js).
    const CARD_COLORS = {
        custom: { bg: 'linear-gradient(135deg,#0d9488,#044f49)', border: '#033b36', text: '#ccfbf1' },
        bank: { bg: 'linear-gradient(135deg,#d97706,#b45309)', border: '#92400e', text: '#fde68a' }
    };

    function _renderGameCard(game) {
        const c = CARD_COLORS[game.type] || CARD_COLORS.bank;
        const typeLabel = game.type === 'custom'
            ? (window.XiroI18n?.t('standalone.lobby.filter.custom') || 'Personalizados')
            : (window.XiroI18n?.t('standalone.lobby.filter.banks') || 'Bancos de preguntas');
        const safePin = _escapeHtml(String(game.pin || ''));

        return `
            <div data-standalone-action="select-game" data-pin="${safePin}"
                 class="p-6 rounded-3xl cursor-pointer transition-all hover:scale-105 shadow-2xl flex flex-col justify-between min-h-[180px]"
                 style="background: ${c.bg}; border-bottom: 4px solid ${c.border};">
                <div class="mb-4">
                    <div class="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full inline-block mb-3">
                        <span class="text-white font-bold text-xs uppercase">${_escapeHtml(typeLabel)}</span>
                    </div>
                    <h3 class="text-2xl font-black italic text-white mb-2 line-clamp-2">${_escapeHtml(game.name)}</h3>
                    <p class="text-sm" style="color: ${c.text};">${game.questionCount || 0} ${window.XiroI18n?.t('standalone.lobby.questions') || 'preguntas'}</p>
                </div>
                <div class="flex items-center text-xs" style="color: ${c.text};">
                    <span><i class="fas fa-play-circle mr-1"></i> ${window.XiroI18n?.t('standalone.lobby.btn_select') || 'Seleccionar'}</span>
                </div>
            </div>
        `;
    }

    function _escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text || '').replace(/[&<>"']/g, m => map[m]);
    }

    function _applyFilter(filter) {
        state.currentFilter = filter;
        if (filter === 'all') {
            state.filteredGames = [...state.games];
        } else {
            state.filteredGames = state.games.filter(g => g.type === filter);
        }
        _renderGames();
    }

    function _renderGames() {
        const container = document.getElementById('games-container');
        if (!container) return;

        if (state.filteredGames.length === 0) {
            const emptyMsg = window.XiroI18n?.t('standalone.lobby.empty') || 'No hay juegos disponibles.';
            container.innerHTML = `<div class="empty-state"><p>${_escapeHtml(emptyMsg)}</p></div>`;
            return;
        }

        container.innerHTML = state.filteredGames.map(_renderGameCard).join('');
    }

    function _loadGames() {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/ui-settings/standalone-games', true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        const normalized = (data.games || []).map(g => ({ ...g, type: _normalizeType(g.type) }));
                        // El modo Trivial (tablero) no encaja en el flujo lineal de Standalone.
                        state.games = normalized.filter(g => g.type !== 'trivial');
                        _applyFilter(state.currentFilter);
                    } catch (e) {
                        console.error('Error parsing games:', e);
                    }
                } else {
                    console.error('Error loading games:', xhr.status);
                }
            }
        };
        xhr.send();
    }

    function _nicknameInput() {
        return document.getElementById('standalone-nickname');
    }

    function _setupNicknameField() {
        const input = _nicknameInput();
        if (!input) return;

        const saved = StandaloneState.getNickname();
        if (saved) input.value = saved;

        input.addEventListener('input', () => {
            input.classList.remove('is-invalid');
            StandaloneState.setNickname(input.value.trim());
        });
    }

    function _validateNickname() {
        const input = _nicknameInput();
        const value = (input?.value || '').trim();
        if (!value) {
            input?.classList.add('is-invalid');
            input?.focus();
            return null;
        }
        return value;
    }

    function _setupGameActions() {
        const container = document.getElementById('games-container');
        if (!container) return;

        container.addEventListener('click', function (event) {
            const button = event.target.closest('[data-standalone-action="select-game"]');
            if (!button) return;

            const pin = button.getAttribute('data-pin');
            if (pin) {
                StandaloneLobby.selectGame(pin);
            }
        });
    }

    function _setupFilterButtons() {
        const filters = document.querySelectorAll('[data-standalone-filter]');
        filters.forEach(btn => {
            btn.addEventListener('click', function () {
                filters.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                _applyFilter(this.dataset.standaloneFilter);
            });
        });
    }

    return {
        init: function () {
            _setupNicknameField();
            _loadGames();
            _setupFilterButtons();
            _setupGameActions();
        },
        selectGame: function (pin) {
            const nickname = _validateNickname();
            if (!nickname) return;

            StandaloneState.setNickname(nickname);
            if (typeof StandaloneGame !== 'undefined') {
                StandaloneGame.startGame(pin);
            }
        },
        // Expuesto para tests unitarios (ver __tests__/standalone-lobby.test.js).
        normalizeType: _normalizeType
    };
})();
