/**
 * @fileoverview Ranking Delta Calculator - Calcula diferencias entre rankings
 * @module domain/services/RankingDeltaCalculator
 * 
 * Responsabilidades:
 * - Comparar rankings (anterior vs actual)
 * - Generar delta con solo cambios de posición
 * - Decidir cuándo enviar delta vs ranking completo
 * 
 * Optimización:
 * - Si <30% de jugadores cambiaron: enviar delta (60-70% menos datos)
 * - Si >=30% cambiaron: enviar ranking completo (más eficiente)
 */

class RankingDeltaCalculator {
    /**
     * Umbral de cambios para decidir delta vs completo
     * Si más del 60% cambiaron posición, enviar completo
     * (ajustado para casos con pocos jugadores)
     */
    static get DELTA_THRESHOLD() {
        return 0.6;
    }

    /**
     * Calcular delta entre dos rankings
     * 
     * @param {Array<Object>} oldRanking - Ranking anterior [{id, nickname, score, position}]
     * @param {Array<Object>} newRanking - Ranking nuevo [{id, nickname, score, position}]
     * @returns {Object} {type: 'delta'|'full', data: Array|Object}
     */
    static calculate(oldRanking, newRanking) {
        // Si no hay ranking anterior, enviar completo
        if (!oldRanking || oldRanking.length === 0) {
            return {
                type: 'full',
                data: newRanking
            };
        }

        // Si cambiaron la cantidad de jugadores, enviar completo
        if (oldRanking.length !== newRanking.length) {
            return {
                type: 'full',
                data: newRanking
            };
        }

        // Crear mapa de posiciones antiguas
        const oldPositions = new Map();
        oldRanking.forEach((player, index) => {
            oldPositions.set(player.id, {
                position: index,
                score: player.score
            });
        });

        // Detectar cambios
        const changes = [];
        newRanking.forEach((player, newPosition) => {
            const oldData = oldPositions.get(player.id);

            // Jugador nuevo (no existía antes)
            if (!oldData) {
                changes.push({
                    id: player.id,
                    nickname: player.nickname,
                    type: 'new',
                    position: newPosition,
                    score: player.score
                });
                return;
            }

            // Cambió posición o puntaje
            if (oldData.position !== newPosition || oldData.score !== player.score) {
                changes.push({
                    id: player.id,
                    type: 'update',
                    oldPosition: oldData.position,
                    newPosition: newPosition,
                    oldScore: oldData.score,
                    newScore: player.score,
                    // Solo incluir nickname si es necesario para el cliente
                    ...(newPosition < 10 ? { nickname: player.nickname } : {})
                });
            }
        });

        // Detectar jugadores eliminados
        const newIds = new Set(newRanking.map(p => p.id));
        oldRanking.forEach(player => {
            if (!newIds.has(player.id)) {
                changes.push({
                    id: player.id,
                    type: 'removed'
                });
            }
        });

        // Decidir si enviar delta o completo
        const changePercent = changes.length / newRanking.length;

        if (changePercent >= this.DELTA_THRESHOLD) {
            // Demasiados cambios, más eficiente enviar completo
            return {
                type: 'full',
                data: newRanking,
                reason: `${(changePercent * 100).toFixed(1)}% changed (threshold: ${this.DELTA_THRESHOLD * 100}%)`
            };
        }

        // Pocos cambios, enviar delta
        return {
            type: 'delta',
            data: {
                changes,
                totalPlayers: newRanking.length,
                timestamp: Date.now()
            },
            stats: {
                totalChanges: changes.length,
                changePercent: (changePercent * 100).toFixed(1) + '%'
            }
        };
    }

    /**
     * Estimar tamaño del payload (para comparar delta vs full)
     * 
     * @param {Object} result - Resultado de calculate()
     * @returns {number} Tamaño aproximado en bytes
     */
    static estimateSize(result) {
        const jsonStr = JSON.stringify(result.data);
        return Buffer.byteLength(jsonStr, 'utf8');
    }

    /**
     * Calcular estadísticas de reducción de datos
     * 
     * @param {Array} newRanking - Ranking completo
     * @param {Object} deltaResult - Resultado de calculate()
     * @returns {Object} Estadísticas {fullSize, deltaSize, reduction}
     */
    static getReductionStats(newRanking, deltaResult) {
        const fullSize = Buffer.byteLength(JSON.stringify(newRanking), 'utf8');
        const deltaSize = this.estimateSize(deltaResult);
        const reduction = ((1 - deltaSize / fullSize) * 100).toFixed(1);

        return {
            fullSize,
            deltaSize,
            reduction: parseFloat(reduction),
            saved: fullSize - deltaSize
        };
    }

    /**
     * Validar que el ranking tenga el formato esperado
     * 
     * @param {Array} ranking - Ranking a validar
     * @returns {boolean} true si es válido
     */
    static validateRanking(ranking) {
        if (!Array.isArray(ranking)) {
            return false;
        }

        return ranking.every(player =>
            player &&
            typeof player.id === 'string' &&
            typeof player.score === 'number' &&
            player.nickname
        );
    }

    /**
     * Aplicar delta a un ranking existente (para reconstrucción en cliente)
     * Esta función es de referencia para el cliente, no se usa en backend
     * 
     * @param {Array} currentRanking - Ranking actual en cliente
     * @param {Object} delta - Delta recibido del servidor
     * @returns {Array} Ranking actualizado
     */
    static applyDelta(currentRanking, delta) {
        const updated = [...currentRanking];

        delta.changes.forEach(change => {
            switch (change.type) {
                case 'new':
                    // Insertar nuevo jugador en su posición
                    updated.splice(change.position, 0, {
                        id: change.id,
                        nickname: change.nickname,
                        score: change.score
                    });
                    break;

                case 'update': {
                    // Actualizar posición y puntaje
                    const player = updated.find(p => p.id === change.id);
                    if (player) {
                        player.score = change.newScore;
                        // Mover a nueva posición
                        const currentIndex = updated.indexOf(player);
                        updated.splice(currentIndex, 1);
                        updated.splice(change.newPosition, 0, player);
                    }
                    break;
                }

                case 'removed': {
                    // Eliminar jugador
                    const removeIndex = updated.findIndex(p => p.id === change.id);
                    if (removeIndex !== -1) {
                        updated.splice(removeIndex, 1);
                    }
                    break;
                }
            }
        });

        return updated;
    }
}

module.exports = RankingDeltaCalculator;
