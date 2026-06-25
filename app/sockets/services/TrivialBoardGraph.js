/**
 * @fileoverview Trivial board graph and reachable-position calculator
 * @module sockets/services/TrivialBoardGraph
 * 
 * Position encoding:
 *   'center'        – the center starting circle
 *   'outer:I'       – outer ring casilla at index I (0..M-1)
 *   'spoke:K:S'     – spoke K (category), step S (1=innermost, 5=outermost)
 */

/**
 * Build adjacency map for the trivial board.
 * @param {number} N - Number of categories / spokes
 * @param {number} M - Number of outer ring casillas
 * @returns {Map<string, string[]>}
 */
function buildBoardGraph(N, M) {
    const graph = new Map();

    // CG positions on outer ring: evenly spaced
    const cgPositions = Array.from({ length: N }, (_, k) => Math.floor(k * M / N));

    // Center connects to spoke_k_1 for each k
    graph.set('center', Array.from({ length: N }, (_, k) => `spoke:${k}:1`));

    // Spokes: 5 steps each
    for (let k = 0; k < N; k++) {
        graph.set(`spoke:${k}:1`, ['center', `spoke:${k}:2`]);
        for (let s = 2; s <= 4; s++) {
            graph.set(`spoke:${k}:${s}`, [`spoke:${k}:${s - 1}`, `spoke:${k}:${s + 1}`]);
        }
        // spoke_k_5 connects to spoke_k_4 AND the CG on outer ring
        graph.set(`spoke:${k}:5`, [`spoke:${k}:4`, `outer:${cgPositions[k]}`]);
    }

    // Outer ring: circular, each casilla connects to prev/next
    for (let i = 0; i < M; i++) {
        const prev = (i - 1 + M) % M;
        const next = (i + 1) % M;
        const neighbors = [`outer:${prev}`, `outer:${next}`];

        // CG positions connect to their spoke
        const cgIndex = cgPositions.indexOf(i);
        if (cgIndex !== -1) {
            neighbors.push(`spoke:${cgIndex}:5`);
        }
        graph.set(`outer:${i}`, neighbors);
    }

    return graph;
}

/**
 * Get positions reachable in exactly `steps` moves via BFS (no backtracking).
 * Uses shortest-path distances only.
 * @param {string} fromPos - Current position
 * @param {number} steps - Dice value
 * @param {Map<string, string[]>} graph
 * @returns {string[]} Array of reachable destination positions
 */
function getReachablePositions(fromPos, steps, graph) {
    // BFS to find all nodes at distance exactly `steps`
    const dist = new Map();
    const queue = [fromPos];
    dist.set(fromPos, 0);

    while (queue.length > 0) {
        const current = queue.shift();
        const d = dist.get(current);
        if (d >= steps) continue;

        const neighbors = graph.get(current) || [];
        for (const neighbor of neighbors) {
            if (!dist.has(neighbor)) {
                dist.set(neighbor, d + 1);
                queue.push(neighbor);
            }
        }
    }

    // Collect positions at exactly `steps` distance (excluding start)
    const result = [];
    for (const [pos, d] of dist) {
        if (d === steps && pos !== fromPos) {
            result.push(pos);
        }
    }
    return result;
}

/**
 * Get the category index for a given board position.
 * @param {string} pos - Position string
 * @param {number} N - Number of categories
 * @param {number} M - Number of outer casillas
 * @param {number[]} cgPositions - CG positions on outer ring
 * @returns {number|null} Category index (0..N-1) or null for center
 */
function getCategoryForPosition(pos, N, M, cgPositions) {
    if (pos === 'center') return null;

    if (pos.startsWith('spoke:')) {
        const parts = pos.split(':');
        const k = parseInt(parts[1]);
        const s = parseInt(parts[2]);
        // Must match the visual colour formula used in presenter-trivial-board.js:
        //   altIdx = (masterColorIdx + (6 - s)) % N
        const masterColorIdx = Math.floor(k * M / N) % N;
        return (masterColorIdx + (6 - s)) % N;
    }

    if (pos.startsWith('outer:')) {
        const i = parseInt(pos.split(':')[1]);
        // If this is an HQ position, its category is the spoke it belongs to (cgIndex),
        // NOT i%N — those diverge when N is small (e.g. N=2, outer:6 → 6%2=0 but category=1).
        const cg = cgPositions || Array.from({ length: N }, (_, k) => Math.floor(k * M / N));
        const cgIndex = cg.indexOf(i);
        if (cgIndex !== -1) return cgIndex;
        return i % N;
    }
    return null;
}

/**
 * Check if position is a cuartel general (HQ).
 * @param {string} pos
 * @param {number} N
 * @param {number} M
 * @returns {{ isHQ: boolean, categoryIndex: number|null }}
 */
function isHQPosition(pos, N, M) {
    if (!pos.startsWith('outer:')) return { isHQ: false, categoryIndex: null };
    const i = parseInt(pos.split(':')[1]);
    const cgPositions = Array.from({ length: N }, (_, k) => Math.floor(k * M / N));
    const cgIndex = cgPositions.indexOf(i);
    if (cgIndex === -1) return { isHQ: false, categoryIndex: null };
    // categoryIndex is the spoke index (k) that owns this HQ — not i%N,
    // which can disagree when N is small.
    return { isHQ: true, categoryIndex: cgIndex };
}

module.exports = {
    buildBoardGraph,
    getReachablePositions,
    getCategoryForPosition,
    isHQPosition
};
