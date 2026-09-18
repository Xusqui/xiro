/**
 * @fileoverview Player - Trivial badges (quesitos/cuñas) bottom HUD
 */

import { getNickname } from './player-state.js?v=20260918124354';

const CONTAINER_ID = 'trivial-badges-container';
const CATEGORIES_KEY = 'xiro_trivial_categories';
const BADGES_KEY = 'xiro_trivial_badges';

let _categories = readArray(CATEGORIES_KEY);
let _badges = readArray(BADGES_KEY);
let _visible = false;

function readArray(key) {
    try {
        const raw = sessionStorage.getItem(key);
        const value = raw ? JSON.parse(raw) : [];
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function writeArray(key, value) {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore quota/storage errors
    }
}

function normalizeCategories(categories) {
    const source = Array.isArray(categories) ? categories : [];
    return source.map((cat, idx) => ({
        index: Number.isInteger(cat?.index) ? cat.index : idx,
        name: cat?.category_name || cat?.name || `Categoría ${idx + 1}`,
        color: cat?.color || '#6b7280'
    }));
}

function normalizeBadges(badges, categories) {
    const expectedLen = Array.isArray(categories) ? categories.length : 0;
    const fallback = new Array(expectedLen).fill(false);

    if (!Array.isArray(badges)) return fallback;
    if (badges.length === 0) return fallback;

    if (typeof badges[0] === 'boolean') {
        return categories.map((_, idx) => !!badges[idx]);
    }

    if (typeof badges[0] === 'string') {
        const byName = new Set(badges.map(v => String(v).toLowerCase()));
        return categories.map(cat => byName.has(String(cat.name || '').toLowerCase()));
    }

    return categories.map((cat, idx) => {
        const byIndex = badges.find(b => Number.isInteger(b?.index) && b.index === idx);
        const byName = badges.find(
            b => String(b?.category_name || b?.name || '').toLowerCase() === String(cat.name || '').toLowerCase()
        );
        const item = byIndex || byName;
        return !!(item && (item.earned === true || item.filled === true || item.value === true));
    });
}

function ensureContainer() {
    let container = document.getElementById(CONTAINER_ID);
    if (!container) {
        container = document.createElement('div');
        container.id = CONTAINER_ID;
        container.className = 'hidden fixed bottom-0 left-0 w-full flex justify-center gap-1 p-2 bg-black/20 backdrop-blur-sm z-40 pointer-events-none';
        container.style.paddingBottom = 'max(0.5rem, env(safe-area-inset-bottom))';
        document.body.appendChild(container);
    }
    return container;
}

function render() {
    const container = ensureContainer();
    const hasCategories = Array.isArray(_categories) && _categories.length > 0;

    if (!_visible || !hasCategories) {
        container.classList.add('hidden');
        container.innerHTML = _tHtml('');
        return;
    }

    const badges = normalizeBadges(_badges, _categories);
    container.classList.remove('hidden');
    container.innerHTML = _categories.map((cat, idx) => {
        const active = !!badges[idx];
        const bg = active ? cat.color : 'rgba(255,255,255,0.12)';
        const border = active ? 'transparent' : 'rgba(209,213,219,0.9)';
        return `<span title="${cat.name}"
            style="display:inline-block;width:1.05rem;height:1.05rem;border-radius:9999px;background:${bg};border:1px solid ${border};box-shadow:${active ? `0 0 8px ${cat.color}99` : 'none'}"></span>`;
    }).join('');
}

export function setTrivialBadgesVisible(visible) {
    _visible = !!visible;
    render();
}

export function setTrivialBadgeCategories(categories) {
    _categories = normalizeCategories(categories);
    writeArray(CATEGORIES_KEY, _categories);
    render();
}

export function renderPlayerBadges(badges) {
    _badges = Array.isArray(badges) ? badges : [];
    writeArray(BADGES_KEY, _badges);
    render();
}

export function clearTrivialBadges() {
    _categories = [];
    _badges = [];
    writeArray(CATEGORIES_KEY, _categories);
    writeArray(BADGES_KEY, _badges);
    _visible = false;
    render();
}

function resolveBadgesFromPayload(payload) {
    const me = getNickname();
    if (!me || !payload) return null;

    const myPlayer = payload.players?.[me];
    if (Array.isArray(myPlayer?.token)) return myPlayer.token;
    if (Array.isArray(myPlayer?.badges)) return myPlayer.badges;

    const myTeam = myPlayer?.teamName;
    if (myTeam && payload.teamTokens && Array.isArray(payload.teamTokens[myTeam])) {
        return payload.teamTokens[myTeam];
    }

    return null;
}

export function syncTrivialBadgesFromPayload(payload) {
    if (!payload) return;

    if (Array.isArray(payload.categories) && payload.categories.length > 0) {
        setTrivialBadgeCategories(payload.categories);
    }

    const badges = resolveBadgesFromPayload(payload);
    if (badges) {
        renderPlayerBadges(badges);
    }

    setTrivialBadgesVisible(true);
}

export function syncTrivialBadgesFromSnapshot(snapshot) {
    const gameType = (snapshot?.game_type || snapshot?.gameType || snapshot?.playerData?.game_type || '').toLowerCase();
    const isTrivial = gameType === 'trivial' || !!snapshot?.gameState?.isTrivial || !!snapshot?.gameState?.isTrivialBoardPhase;

    if (!isTrivial) {
        setTrivialBadgesVisible(false);
        return;
    }

    setTrivialBadgesVisible(true);

    const categories =
        snapshot?.playerData?.categories ||
        snapshot?.gameState?.categories ||
        snapshot?.categories ||
        null;

    if (Array.isArray(categories) && categories.length > 0) {
        setTrivialBadgeCategories(categories);
    }

    const directBadges =
        snapshot?.playerData?.badges ||
        snapshot?.playerData?.token ||
        snapshot?.gameState?.badges ||
        snapshot?.badges ||
        null;

    if (Array.isArray(directBadges)) {
        renderPlayerBadges(directBadges);
        return;
    }

    const payloadLike = {
        players: snapshot?.players || snapshot?.gameState?.players || snapshot?.playerData?.players,
        teamTokens: snapshot?.teamTokens || snapshot?.gameState?.teamTokens || snapshot?.playerData?.teamTokens
    };
    const resolved = resolveBadgesFromPayload(payloadLike);
    if (resolved) {
        renderPlayerBadges(resolved);
    } else {
        render();
    }
}
