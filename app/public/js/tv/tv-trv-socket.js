window.TVApp = window.TVApp || {};
window.TVApp.TrvSocket = (function () {
    'use strict';

    var getEl = window.TVApp.Utils.getEl;
    var State = window.TVApp.TrvState;
    var Layout = window.TVApp.TrvLayout;
    var Board = window.TVApp.TrvBoard;
    var Tokens = window.TVApp.TrvTokens;
    var Highlights = window.TVApp.TrvHighlights;

    function callUpdateBoardTokens(state) {
        if (!state || !state.players) return;
        var pKeys = Object.keys(state.players);
        var isTeamMode = state.teamMode || false;
        
        for (var i = 0; i < pKeys.length; i++) {
            if (state.players[pKeys[i]].teamName) isTeamMode = true;
        }

        if (isTeamMode) {
            var teamCfg = state.teamConfig;
            if (!teamCfg || !teamCfg.teams || teamCfg.teams.length === 0) {
                var teamMap = {};
                for (var j = 0; j < pKeys.length; j++) {
                    var p = state.players[pKeys[j]];
                    if (!p.teamName) continue;
                    if (!teamMap[p.teamName]) teamMap[p.teamName] = { name: p.teamName, color: '#888', players: [] };
                    teamMap[p.teamName].players.push(pKeys[j]);
                }
                var tArr = [];
                for (var key in teamMap) tArr.push(teamMap[key]);
                teamCfg = { teams: tArr };
            }
            Tokens.updateBoardTokensTeam(
                state.players, teamCfg, state.outerCasillas,
                state.currentTurn, state.turnOrder
            );
        } else {
            Tokens.updateBoardTokens(
                state.players, state.categories, state.outerCasillas,
                state.currentTurn, state.turnOrder
            );
        }
    }

    function initTrivialSocket() {
        var socket = window.TVApp.socket;
        if (!socket) return;

        socket.on('trivial-game-started', function (data) {
            window.isTrivialGame = true;
            State.setTrivialGameState(data);
            Layout.buildTrivialLayout();

            var boardEl = getEl('trivial-board-svg');
            if (boardEl) {
                Board.renderBoardBackground(boardEl, data);
                callUpdateBoardTokens(State.getTrivialGameState());
                Highlights.showTurnOrderOverlay(boardEl, data.turnOrder);
            }
            var stAfter = State.getTrivialGameState();
            Layout.refreshPlayerScores(stAfter);
            Layout.buildCategoryLegend(stAfter);
            Layout.setStatus(data.currentTurn, 'Tirando el dado en pantalla principal...');
        });

        socket.on('trivial-dice-rolled', function (data) {
            var nickname = data.nickname;
            var diceValue = data.diceValue;
            var avail = data.availablePositions || [];
            var posLabels = data.positionLabels || [];

            Layout.setStatus(nickname, 'Sacó ' + diceValue + ' — ¿Dónde caerá?');
            
            // TV es espectador, solo muestra parpadeos de highlight pero sin interactividad de onClick callback (que recibe null)
            Highlights.updateBoardHighlights(avail, posLabels);
        });

        socket.on('trivial-player-moved', function (data) {
            var state = State.getTrivialGameState();
            if (!state) return;
            
            var moved = data.movedPlayers;
            if (moved && moved.length > 0) {
                for (var i = 0; i < moved.length; i++) {
                    var nick = moved[i];
                    if (state.players && state.players[nick]) {
                        state.players[nick].position = data.position;
                    }
                }
            } else if (state.players && state.players[data.nickname]) {
                state.players[data.nickname].position = data.position;
            }

            callUpdateBoardTokens(state);
            Layout.setStatus(state.currentTurn, data.nickname + ' movió -> ' + data.position + '. Preparando pregunta...');
        });

        socket.on('trivial-choose-category', function (data) {
            Layout.setStatus(data.actorNick, '🎯 Casilla central — Eligiendo banco de preguntas...');
        });

        socket.on('trivial-winner', function (data) {
            window.isTrivialGame = false;
            State.clearTrivialGameState();
            Highlights.updateBoardHighlights([], null);
            Highlights.showTrivialWinnerOverlay(data.ranking);
        });

        socket.on('trivial-token-update', function (data) {
            if (data.players) State.updateTrivialPlayers(data.players);
            if (data.teamTokens || data.players) State.updateTrivialTokens(data.teamTokens, data.players);
            
            var st = State.getTrivialGameState();
            callUpdateBoardTokens(st);
            Layout.refreshPlayerScores(st);
        });

        socket.on('trivial-turn-changed', function (data) {
            if (Highlights.isWinnerOverlayActive()) return;

            // Limpiamos los resultados de TV (igual que el presentador limpia revealElements)
            // Llama a las funciones compartidas que limpian placeholders y esconden botones en la TV.
            var mainC = getEl('main-container');
            var trvC = getEl('trivial-board-svg');

            if (data.players) State.updateTrivialPlayers(data.players);
            State.updateTrivialTurn(data.currentTurn, data.phase);
            
            // Si por error se había renderizado una slide global encima (ej. pregunta), volvemos a poner el layout TRV
            if (!trvC) {
                Layout.buildTrivialLayout();
                var boardEl = getEl('trivial-board-svg');
                var stateB = State.getTrivialGameState();
                if (boardEl && stateB && stateB.outerCasillas) {
                    Board.renderBoardBackground(boardEl, stateB);
                }
            }
            
            var st = State.getTrivialGameState();
            callUpdateBoardTokens(st);
            Layout.refreshPlayerScores(st);
            Layout.buildCategoryLegend(st);
            Highlights.updateBoardHighlights([], null);

            if (data.rollAgain) {
                Layout.setStatus(data.currentTurn, '¡Acierto extra! Vuelve a tirar el dado...');
            } else {
                Layout.setStatus(data.currentTurn, 'Esperando tirada en pantalla principal...');
            }
        });

        socket.on('trivial-game-ended', function () {
            window.isTrivialGame = false;
            State.clearTrivialGameState();
            Highlights.updateBoardHighlights([], null);
        });

        socket.on('trivial-error', function (data) {
            Layout.setStatus('', '⚠ ' + data.message);
        });
    }

    return {
        initTrivialSocket: initTrivialSocket
    };
})();
