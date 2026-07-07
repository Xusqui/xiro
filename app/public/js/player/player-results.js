/**
 * @fileoverview Gestión de resultados y ranking del jugador
 * Actualización de ranking y posición final
 */

import { socket } from './player-socket-config.js?v=20260707171802';
import { getNickname, setPin, setSessionId, setNickname, setHaRespondido, resetSessionState } from './player-state.js?v=20260707171802';

// ===== EVENTOS DE RESULTADOS =====

/**
 * Registrar eventos de ranking y finalización
 */
export function registerResultsEvents() {
    // ===== RANKING UPDATE =====
    socket.on('ranking-update', (data) => {
        console.log('📊 ranking-update recibido');
        const rankingContainer = document.getElementById('ranking-container');

        if (rankingContainer && data.ranking && data.ranking.length > 0) {
            // Agregar position si no existe
            const rankingWithPosition = data.ranking.map((player, index) => ({
                ...player,
                position: player.position || (index + 1)
            }));

            // Renderizar ranking con mismo HTML que la pantalla de resultado
            const rankingHTML = rankingWithPosition.slice(0, 5).map(player => {
                const podioImgs = {
                    1: '/images/chamaleon/podium/primero.svg',
                    2: '/images/chamaleon/podium/segundo.svg',
                    3: '/images/chamaleon/podium/tercero.svg'
                };
                const mascotHtml = podioImgs[player.position]
                    ? `<img src="${podioImgs[player.position]}" alt="" class="w-7 h-7 inline-block mr-1 align-middle">`
                    : '';
                return `
                <div class="flex justify-center items-center bg-white/10 rounded-lg px-3 py-2">
                    <span class="font-bold">${player.position}. ${mascotHtml}${player.nickname}</span>
                    <span class="mx-3"><i class="fas fa-arrow-right"></i></span>
                    <span class="font-black">${player.score} pts</span>
                </div>
            `;
            }).join('');

            rankingContainer.innerHTML = _tHtml(rankingHTML);
        }
    });

    // ===== GAME ENDED =====
    socket.on('game-ended', (ranking, ack) => {
        console.log('🏁 Juego terminado, limpiando datos de sesión');

        // Limpiar localStorage completamente
        localStorage.removeItem('xiro_lastPin');
        localStorage.removeItem('xiro_lastSessionId');
        localStorage.removeItem('xiro_lastNickname');
        localStorage.removeItem('xiro_lastTeamIndex');
        localStorage.removeItem('xiro_lastTeamName');

        // Resetear estado
        resetSessionState();

        // Confirmar recepción
        if (typeof ack === 'function') ack();
    });

    // ===== PLAYER FINAL POSITION =====
    socket.on('player-final-position', (data) => {
        console.log('🏆 Posición final recibida:', data);

        // Determinar medalla y color según posición
        let medal = '';
        let bgColor = '';
        let medalIcon = '';

        if (data.position === 1) {
            medal = `<img src="/images/chamaleon/podium/primero.svg" alt="${_t('player.results.medal_1', null, '1er puesto')}" class="w-40 h-40 drop-shadow-lg">`;
            bgColor = 'bg-gradient-to-br from-yellow-400 to-yellow-600';
            medalIcon = '<i class="fas fa-trophy text-yellow-300"></i>';
        } else if (data.position === 2) {
            medal = `<img src="/images/chamaleon/podium/segundo.svg" alt="${_t('player.results.medal_2', null, '2º puesto')}" class="w-40 h-40 drop-shadow-lg">`;
            bgColor = 'bg-gradient-to-br from-gray-300 to-gray-500';
            medalIcon = '<i class="fas fa-medal text-gray-300"></i>';
        } else if (data.position === 3) {
            medal = `<img src="/images/chamaleon/podium/tercero.svg" alt="${_t('player.results.medal_3', null, '3er puesto')}" class="w-40 h-40 drop-shadow-lg">`;
            bgColor = 'bg-gradient-to-br from-amber-600 to-amber-800';
            medalIcon = '<i class="fas fa-award text-amber-600"></i>';
        } else {
            bgColor = 'bg-gradient-to-br from-purple-600 to-purple-800';
            medalIcon = '<i class="fas fa-star text-purple-300"></i>';
        }

        const positionText = _t('player.results.position_ordinal', { position: data.position }, `${data.position}ª`);

        // Mostrar pantalla de posición final
        document.body.innerHTML = _tHtml(`
            <div class="h-dvh w-screen flex flex-col items-center justify-center ${bgColor} text-white text-center p-4 overflow-hidden">
                <div class="animate-fade-in flex flex-col items-center justify-center max-h-full">
                    ${data.position <= 3 ? `<div class="mb-3 animate-bounce">${medal}</div>` : `<div class="text-5xl mb-3">${medalIcon}</div>`}
                    <h2 class="text-3xl font-black italic uppercase mb-3">${_t('player.results.game_over', null, '¡Juego Terminado!')}</h2>
                    <div class="bg-black/30 rounded-2xl p-5 max-w-sm w-full mx-auto">
                        <p class="text-lg font-bold mb-1">${_t('player.results.you_placed', null, 'Has quedado en')}</p>
                        <p class="text-6xl font-black my-2">${positionText}</p>
                        <p class="text-base font-bold mb-3">${_t('player.results.position_label', null, 'posición')}</p>
                        <div class="border-t-2 border-white/30 pt-3 mt-2">
                            <p class="text-sm mb-1">${_t('player.results.final_score', null, 'Puntuación final')}</p>
                            <p class="text-4xl font-black">${data.score} pts</p>
                        </div>
                        <div class="mt-2 text-xs opacity-75">
                            <p>${_t('player.results.of_players', { totalPlayers: data.totalPlayers }, 'de {totalPlayers} jugadores')}</p>
                        </div>
                    </div>
                    ${data.position === 1 ? `<p class="text-xl font-black animate-pulse mt-3">${_t('player.results.champion', null, '¡CAMPEÓN!')}</p>` : ''}
                    ${data.position === 2 ? `<p class="text-lg font-bold mt-3">${_t('player.results.excellent', null, '¡Excelente resultado!')}</p>` : ''}
                    ${data.position === 3 ? `<p class="text-lg font-bold mt-3">${_t('player.results.great_job', null, '¡Gran trabajo!')}</p>` : ''}
                </div>
            </div>
        `);
    });
}
