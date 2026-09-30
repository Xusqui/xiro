/**
 * @fileoverview Pantalla de selección de juego para modo Standalone
 * Permite al usuario elegir entre bancos y juegos personalizados disponibles
 */

'use strict';

globalThis.StandaloneLobby = (() => {
    const state = {
        games: [],
        filteredGames: [],
        currentFilter: 'all',
        searchTerm: '',
        searchResults: null, // null = sin búsqueda activa
        searching: false
    };

    // Búsqueda AJAX por PIN o título
    const MIN_SEARCH_LENGTH = 3;
    const SEARCH_DELAY_MS = 300;
    let searchTimer = null;
    let searchRequest = null;

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
        custom: { bg: 'linear-gradient(135deg,#0d9488,#044f49)', from: '#0d9488', to: '#044f49', border: '#033b36', text: '#ccfbf1' },
        bank: { bg: 'linear-gradient(135deg,#d97706,#b45309)', from: '#d97706', to: '#b45309', border: '#92400e', text: '#fde68a' }
    };

    // Tiñe el color de rol sobre la imagen de portada de una tarjeta, para que el texto siga siendo legible
    function _hexToRgba(hex, alpha) {
        const clean = hex.replace('#', '');
        const r = parseInt(clean.substring(0, 2), 16);
        const g = parseInt(clean.substring(2, 4), 16);
        const b = parseInt(clean.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function _renderGameCard(game) {
        const c = CARD_COLORS[game.type] || CARD_COLORS.bank;
        const typeLabel = game.type === 'custom'
            ? (window.XiroI18n?.t('standalone.lobby.filter.custom') || 'Personalizados')
            : (window.XiroI18n?.t('standalone.lobby.filter.banks') || 'Bancos de preguntas');
        const safePin = _escapeHtml(String(game.pin || ''));

        const flagCode = game.language ? _escapeHtml(game.language) : '';
        const safeImageUrl = game.imageUrl ? _escapeHtml(game.imageUrl) : '';
        const cardBackground = safeImageUrl
            ? `linear-gradient(135deg, ${_hexToRgba(c.from, 0.8)}, ${_hexToRgba(c.to, 0.8)}), url('${safeImageUrl}') center/cover no-repeat`
            : c.bg;

        return `
            <div data-standalone-action="select-game" data-pin="${safePin}"
                 class="p-6 rounded-3xl cursor-pointer transition-all hover:scale-105 shadow-2xl flex flex-col justify-between min-h-[180px]"
                 style="background: ${cardBackground}; border-bottom: 4px solid ${c.border}; position: relative;">
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
                ${flagCode ? `<img src="/images/flags/${flagCode}.svg" alt="" style="position:absolute;bottom:12px;right:12px;width:34px;height:24px;object-fit:cover;border-radius:4px;border:2px solid rgba(255,255,255,.85);box-shadow:0 3px 8px rgba(0,0,0,.35);transform:rotate(-9deg);pointer-events:none;">` : ''}
            </div>
        `;
    }

    function _escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            '\'': '&#039;'
        };
        return String(text || '').replace(/[&<>"']/g, m => map[m]);
    }

    function _applyFilter(filter) {
        state.currentFilter = filter;
        const source = state.searchResults ?? state.games;
        if (filter === 'all') {
            state.filteredGames = [...source];
        } else {
            state.filteredGames = source.filter(g => g.type === filter);
        }
        _renderGames();
    }

    function _renderMessage(container, text, withSpinner) {
        const spinner = withSpinner ? '<i class="fas fa-spinner fa-spin"></i>' : '';
        container.innerHTML = `<div class="${withSpinner ? 'loading-state' : 'empty-state'}">${spinner}<p>${_escapeHtml(text)}</p></div>`;
    }

    function _renderGames() {
        const container = document.getElementById('games-container');
        if (!container) return;

        if (state.searching) {
            _renderMessage(container, window.XiroI18n?.t('standalone.lobby.search.loading') || 'Buscando...', true);
            return;
        }

        if (state.filteredGames.length === 0) {
            const term = state.searchTerm.trim();
            const emptyMsg = state.searchResults
                ? (window.XiroI18n?.t('standalone.lobby.search.no_results', { term }) || 'No se han encontrado juegos para "{term}".').replace('{term}', term)
                : window.XiroI18n?.t('standalone.lobby.empty') || 'No hay juegos disponibles.';
            _renderMessage(container, emptyMsg, false);
            return;
        }

        container.innerHTML = state.filteredGames.map(_renderGameCard).join('');
    }

    function _requestGames(query, onSuccess, onError) {
        const xhr = new XMLHttpRequest();
        const url = '/api/ui-settings/standalone-games' + (query ? `?q=${encodeURIComponent(query)}` : '');
        xhr.open('GET', url, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            if (xhr.status !== 200) {
                onError(new Error(`HTTP ${xhr.status}`));
                return;
            }
            try {
                const data = JSON.parse(xhr.responseText);
                const normalized = (data.games || []).map(g => ({ ...g, type: _normalizeType(g.type) }));
                // El modo Trivial (tablero) no encaja en el flujo lineal de Standalone.
                onSuccess(normalized.filter(g => g.type !== 'trivial'));
            } catch (e) {
                onError(e);
            }
        };
        xhr.send();
        return xhr;
    }

    function _loadGames() {
        _requestGames('', games => {
            state.games = games;
            _applyFilter(state.currentFilter);
        }, err => console.error('Error loading games:', err));
    }

    function _cancelSearch() {
        clearTimeout(searchTimer);
        searchTimer = null;
        if (searchRequest) {
            const request = searchRequest;
            searchRequest = null;
            request.abort();
        }
        state.searching = false;
    }

    /**
     * Búsqueda por PIN o título contra el servidor, a partir de MIN_SEARCH_LENGTH
     * caracteres. Por debajo de ese mínimo se vuelve a mostrar la lista completa.
     */
    function _search(value) {
        state.searchTerm = String(value || '');
        const term = state.searchTerm.trim();
        _cancelSearch();

        if (term.length < MIN_SEARCH_LENGTH) {
            state.searchResults = null;
            _applyFilter(state.currentFilter);
            return;
        }

        state.searching = true;
        _renderGames();
        searchTimer = setTimeout(() => {
            searchTimer = null;
            const request = _requestGames(term, games => {
                if (searchRequest !== request) return;
                searchRequest = null;
                state.searching = false;
                state.searchResults = games;
                _applyFilter(state.currentFilter);
            }, err => {
                if (searchRequest !== request) return; // abortada por una búsqueda posterior
                searchRequest = null;
                console.error('Error searching games:', err);
                state.searching = false;
                state.searchResults = [];
                _applyFilter(state.currentFilter);
            });
            searchRequest = request;
        }, SEARCH_DELAY_MS);
    }

    function _setupSearchField() {
        const input = document.getElementById('standalone-search');
        if (!input) return;
        input.addEventListener('input', () => _search(input.value));
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

    function _startGame(pin) {
        if (typeof StandaloneGame !== 'undefined') {
            StandaloneGame.startGame(pin);
        }
    }

    function _promptForNickname(pin) {
        const input = _nicknameInput();
        input?.classList.add('is-invalid');

        if (typeof window.mostrarModalInput !== 'function') {
            input?.focus();
            return;
        }

        window.mostrarModalInput(
            window.XiroI18n?.t('standalone.lobby.nickname_required_title') || 'Nombre requerido',
            window.XiroI18n?.t('standalone.lobby.nickname_required_message') || 'Por favor, introduce tu nombre para continuar.',
            {
                tipo: 'warning',
                placeholder: window.XiroI18n?.t('standalone.lobby.nickname_placeholder') || 'Tu nombre',
                textoConfirm: window.XiroI18n?.t('standalone.lobby.nickname_required_confirm') || 'Entendido',
                onConfirm: (nickname) => {
                    if (input) {
                        input.value = nickname;
                        input.classList.remove('is-invalid');
                    }
                    StandaloneState.setNickname(nickname);
                    _startGame(pin);
                }
            }
        );
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
            _setupSearchField();
            _setupFilterButtons();
            _setupGameActions();
            // El diccionario de i18n se carga de forma async y puede resolverse
            // después del primer render de las tarjetas (ver XiroI18n.init en
            // i18n-core.js), dejando claves sin traducir. Re-renderizamos cuando
            // el idioma queda listo para refrescar los textos.
            window.addEventListener('xiro:language-changed', _renderGames);
        },
        selectGame: function (pin) {
            const nickname = (_nicknameInput()?.value || '').trim();
            if (!nickname) {
                _promptForNickname(pin);
                return;
            }

            StandaloneState.setNickname(nickname);
            _startGame(pin);
        },
        // Expuesto para tests unitarios (ver __tests__/standalone-lobby.test.js).
        normalizeType: _normalizeType
    };
})();
