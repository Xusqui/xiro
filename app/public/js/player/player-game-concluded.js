const CONCLUDED_KEY = 'xiro_game_concluded';

function clearPlayerStorage() {
    localStorage.removeItem('xiro_lastPin');
    localStorage.removeItem('xiro_lastNickname');
    localStorage.removeItem('xiro_lastSessionId');
    localStorage.removeItem('xiro_lastTeamIndex');
    localStorage.removeItem('xiro_lastTeamName');
}

export function markGameConcluded() {
    localStorage.setItem(CONCLUDED_KEY, String(Date.now()));
}

export function clearGameConcluded() {
    localStorage.removeItem(CONCLUDED_KEY);
}

export function redirectIfConcluded() {
    const isConcluded = localStorage.getItem(CONCLUDED_KEY);
    if (isConcluded) {
        window.location.href = '/juego-concluido.html';
        return true;
    }
    return false;
}

export function initConcludedPage() {
    clearPlayerStorage();
    clearGameConcluded();
}
