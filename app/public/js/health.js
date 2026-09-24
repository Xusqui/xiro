// ─── State ───────────────────────────────────────────────
let refreshInterval = 10000;
let intervalId = null;
let paused = false;
let consecutiveErrors = 0;

const history = {
    memory: [],
    players: [],
    dbLatency: [],
    http: [],
    cpu: [],
    eventLoop: [],
};
const MAX_HISTORY = 60;

// ─── Helpers ─────────────────────────────────────────────
function formatUptime(seconds) {
    if (!seconds && seconds !== 0) return '--';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

function statusClass(status) {
    if (!status) return 'unknown';
    const s = status.toLowerCase();
    if (['healthy', 'ready', 'alive', 'ok'].includes(s)) return 'healthy';
    if (['degraded', 'slow'].includes(s)) return 'degraded';
    if (['unhealthy', 'error', 'not_ready'].includes(s)) return 'unhealthy';
    return 'unknown';
}

function statusIcon(status) {
    const c = statusClass(status);
    if (c === 'healthy') return '✅';
    if (c === 'degraded') return '⚠️';
    if (c === 'unhealthy') return '❌';
    return '❔';
}

function statusText(status) {
    const map = {
        healthy: 'Saludable', degraded: 'Degradado', unhealthy: 'No saludable',
        ready: 'Listo', not_ready: 'No listo', alive: 'Activo',
        shutting_down: 'Apagando', initializing: 'Iniciando',
        ok: 'OK', error: 'Error', slow: 'Lento'
    };
    return map[(status || '').toLowerCase()] || status || '--';
}

function progressColor(percent) {
    if (percent < 60) return 'green';
    if (percent < 85) return 'yellow';
    return 'red';
}

async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

// ─── Sparkline drawing ───────────────────────────────────
function drawSparkline(canvasId, data, color, fillColor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    if (data.length < 2) {
        ctx.fillStyle = 'rgba(148,163,184,0.3)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Recopilando datos...', w / 2, h / 2 + 4);
        return;
    }

    const max = Math.max(...data) * 1.15 || 1;
    const min = Math.min(0, Math.min(...data));
    const range = max - min || 1;
    const stepX = w / (data.length - 1);

    // Fill
    ctx.beginPath();
    ctx.moveTo(0, h);
    data.forEach((v, i) => {
        const x = i * stepX;
        const y = h - ((v - min) / range) * (h - 8) - 4;
        if (i === 0) ctx.lineTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    data.forEach((v, i) => {
        const x = i * stepX;
        const y = h - ((v - min) / range) * (h - 8) - 4;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Last point
    const lastX = (data.length - 1) * stepX;
    const lastY = h - ((data[data.length - 1] - min) / range) * (h - 8) - 4;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Last value text
    ctx.fillStyle = color;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(data[data.length - 1].toFixed(1), lastX - 8, lastY - 6);
}

// ─── Render functions ────────────────────────────────────
function renderProbes(liveData, readyData, healthData, metricsData) {
    // Liveness
    const aliveEl = document.getElementById('probeAlive');
    const uptimeEl = document.getElementById('probeUptime');
    if (liveData) {
        aliveEl.textContent = _t(statusIcon(liveData.status) + ' ' + statusText(liveData.status));
        uptimeEl.textContent = _t(liveData.uptime ? `Uptime: ${formatUptime(liveData.uptime)}` : '');
        document.getElementById('probeLive').style.borderColor =
            statusClass(liveData.status) === 'healthy' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';
    }

    // Readiness
    const readyVal = document.getElementById('probeReadyVal');
    const readySub = document.getElementById('probeReadySub');
    if (readyData) {
        readyVal.textContent = _t(statusIcon(readyData.status) + ' ' + statusText(readyData.status));
        readySub.textContent = readyData.issues
            ? Object.entries(readyData.issues).map(([k, v]) => `${k}: ${v}`).join(', ')
            : 'Todas las dependencias OK';
        document.getElementById('probeReady').style.borderColor =
            statusClass(readyData.status) === 'healthy' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';
    }

    // Uptime
    if (healthData) {
        document.getElementById('probeUptimeFmt').textContent = _t(healthData.uptimeFormatted || formatUptime(healthData.uptime));
        document.getElementById('probeTimestamp').textContent = healthData.timestamp
            ? new Date(healthData.timestamp).toLocaleTimeString('es-ES')
            : '--';
    }

    // Players
    if (healthData && healthData.players) {
        document.getElementById('probePlayers').textContent = _t(healthData.players.connected || '0');
        document.getElementById('probePlayersSub').textContent =
            _t(`de ${healthData.players.maxPlayers || healthData.players.maxTotalPlayers || '?'} máx (${healthData.players.utilizationPercent || '0'}%)`);
    }

    // Games
    if (healthData && healthData.games) {
        document.getElementById('probeGames').textContent = _t(healthData.games.active || '0');
        document.getElementById('probeGamesSub').textContent =
            _t(`Lobbies: ${healthData.games.lobbies || '0'} | Completadas: ${healthData.games.totalGamesCompleted || '0'}`);
    }
}

function renderDependencies(deps) {
    const body = document.getElementById('dependenciesBody');
    if (!deps) {
        body.innerHTML = _tHtml('<div class="empty-state">Sin datos</div>');
        return;
    }

    body.innerHTML = Object.entries(deps).map(([name, dep]) => {
        let icon;
        if (name === 'database') {
            icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="4.8638 2.7443 118.8024 122.5117" width="20" height="20" style="vertical-align:middle;"><path d="M93.809 92.112c.785-6.533.55-7.492 5.416-6.433l1.235.108c3.742.17 8.637-.602 11.513-1.938 6.191-2.873 9.861-7.668 3.758-6.409-13.924 2.873-14.881-1.842-14.881-1.842 14.703-21.815 20.849-49.508 15.543-56.287-14.47-18.489-39.517-9.746-39.936-9.52l-.134.025c-2.751-.571-5.83-.912-9.289-.968-6.301-.104-11.082 1.652-14.709 4.402 0 0-44.683-18.409-42.604 23.151.442 8.841 12.672 66.898 27.26 49.362 5.332-6.412 10.484-11.834 10.484-11.834 2.558 1.699 5.622 2.567 8.834 2.255l.249-.212c-.078.796-.044 1.575.099 2.497-3.757 4.199-2.653 4.936-10.166 6.482-7.602 1.566-3.136 4.355-.221 5.084 3.535.884 11.712 2.136 17.238-5.598l-.22.882c1.474 1.18 1.375 8.477 1.583 13.69.209 5.214.558 10.079 1.621 12.948 1.063 2.868 2.317 10.256 12.191 8.14 8.252-1.764 14.561-4.309 15.136-27.985"/><path d="M75.458 125.256c-4.367 0-7.211-1.689-8.938-3.32-2.607-2.46-3.641-5.629-4.259-7.522l-.267-.79c-1.244-3.358-1.666-8.193-1.916-14.419-.038-.935-.064-1.898-.093-2.919-.021-.747-.047-1.684-.085-2.664a18.8 18.8 0 01-4.962 1.568c-3.079.526-6.389.356-9.84-.507-2.435-.609-4.965-1.871-6.407-3.82-4.203 3.681-8.212 3.182-10.396 2.453-3.853-1.285-7.301-4.896-10.542-11.037-2.309-4.375-4.542-10.075-6.638-16.943-3.65-11.96-5.969-24.557-6.175-28.693C4.292 23.698 7.777 14.44 15.296 9.129 27.157.751 45.128 5.678 51.68 7.915c4.402-2.653 9.581-3.944 15.433-3.851 3.143.051 6.136.327 8.916.823 2.9-.912 8.628-2.221 15.185-2.139 12.081.144 22.092 4.852 28.949 13.615 4.894 6.252 2.474 19.381.597 26.651-2.642 10.226-7.271 21.102-12.957 30.57 1.544.011 3.781-.174 6.961-.831 6.274-1.295 8.109 2.069 8.607 3.575 1.995 6.042-6.677 10.608-9.382 11.864-3.466 1.609-9.117 2.589-13.745 2.377l-.202-.013-1.216-.107-.12 1.014-.116.991c-.311 11.999-2.025 19.598-5.552 24.619-3.697 5.264-8.835 6.739-13.361 7.709-1.544.33-2.947.474-4.219.474zm-9.19-43.671c2.819 2.256 3.066 6.501 3.287 14.434.028.99.054 1.927.089 2.802.106 2.65.355 8.855 1.327 11.477.137.371.26.747.39 1.146 1.083 3.316 1.626 4.979 6.309 3.978 3.931-.843 5.952-1.599 7.534-3.851 2.299-3.274 3.585-9.86 3.821-19.575l4.783.116-4.75-.57.14-1.186c.455-3.91.783-6.734 3.396-8.602 2.097-1.498 4.486-1.353 6.389-1.01-2.091-1.58-2.669-3.433-2.823-4.193l-.399-1.965 1.121-1.663c6.457-9.58 11.781-21.354 14.609-32.304 2.906-11.251 2.02-17.226 1.134-18.356-11.729-14.987-32.068-8.799-34.192-8.097l-.359.194-1.8.335-.922-.191c-2.542-.528-5.366-.82-8.393-.869-4.756-.08-8.593 1.044-11.739 3.431l-2.183 1.655-2.533-1.043c-5.412-2.213-21.308-6.662-29.696-.721-4.656 3.298-6.777 9.76-6.305 19.207.156 3.119 2.275 14.926 5.771 26.377 4.831 15.825 9.221 21.082 11.054 21.693.32.108 1.15-.537 1.976-1.529a270.708 270.708 0 0110.694-12.07l2.77-2.915 3.349 2.225c1.35.897 2.839 1.406 4.368 1.502l7.987-6.812-1.157 11.808c-.026.265-.039.626.065 1.296l.348 2.238-1.51 1.688-.174.196 4.388 2.025 1.836-2.301z"/><path fill="#336791" d="M115.731 77.44c-13.925 2.873-14.882-1.842-14.882-1.842 14.703-21.816 20.849-49.51 15.545-56.287C101.924.823 76.875 9.566 76.457 9.793l-.135.024c-2.751-.571-5.83-.911-9.291-.967-6.301-.103-11.08 1.652-14.707 4.402 0 0-44.684-18.408-42.606 23.151.442 8.842 12.672 66.899 27.26 49.363 5.332-6.412 10.483-11.834 10.483-11.834 2.559 1.699 5.622 2.567 8.833 2.255l.25-.212c-.078.796-.042 1.575.1 2.497-3.758 4.199-2.654 4.936-10.167 6.482-7.602 1.566-3.136 4.355-.22 5.084 3.534.884 11.712 2.136 17.237-5.598l-.221.882c1.473 1.18 2.507 7.672 2.334 13.557-.174 5.885-.29 9.926.871 13.082 1.16 3.156 2.316 10.256 12.192 8.14 8.252-1.768 12.528-6.351 13.124-13.995.422-5.435 1.377-4.631 1.438-9.49l.767-2.3c.884-7.367.14-9.743 5.225-8.638l1.235.108c3.742.17 8.639-.602 11.514-1.938 6.19-2.871 9.861-7.667 3.758-6.408z"/><path fill="#fff" d="M75.957 122.307c-8.232 0-10.84-6.519-11.907-9.185-1.562-3.907-1.899-19.069-1.551-31.503a1.59 1.59 0 011.64-1.55 1.594 1.594 0 011.55 1.639c-.401 14.341.168 27.337 1.324 30.229 1.804 4.509 4.54 8.453 12.275 6.796 7.343-1.575 10.093-4.359 11.318-11.46.94-5.449 2.799-20.951 3.028-24.01a1.593 1.593 0 011.71-1.472 1.597 1.597 0 011.472 1.71c-.239 3.185-2.089 18.657-3.065 24.315-1.446 8.387-5.185 12.191-13.794 14.037-1.463.313-2.792.453-4 .454zM31.321 90.466a6.71 6.71 0 01-2.116-.35c-5.347-1.784-10.44-10.492-15.138-25.885-3.576-11.717-5.842-23.947-6.041-27.922-.589-11.784 2.445-20.121 9.02-24.778 13.007-9.216 34.888-.44 35.813-.062a1.596 1.596 0 01-1.207 2.955c-.211-.086-21.193-8.492-32.768-.285-5.622 3.986-8.203 11.392-7.672 22.011.167 3.349 2.284 15.285 5.906 27.149 4.194 13.742 8.967 22.413 13.096 23.79.648.216 2.62.873 5.439-2.517A245.272 245.272 0 0145.88 73.046a1.596 1.596 0 012.304 2.208c-.048.05-4.847 5.067-10.077 11.359-2.477 2.979-4.851 3.853-6.786 3.853zm69.429-13.445a1.596 1.596 0 01-1.322-2.487c14.863-22.055 20.08-48.704 15.612-54.414-5.624-7.186-13.565-10.939-23.604-11.156-7.433-.16-13.341 1.738-14.307 2.069l-.243.099c-.971.305-1.716-.227-1.997-.849a1.6 1.6 0 01.631-2.025c.046-.027.192-.089.429-.176l-.021.006.021-.007c1.641-.601 7.639-2.4 15.068-2.315 11.108.118 20.284 4.401 26.534 12.388 2.957 3.779 2.964 12.485.019 23.887-3.002 11.625-8.651 24.118-15.497 34.277-.306.457-.81.703-1.323.703zm.76 10.21c-2.538 0-4.813-.358-6.175-1.174-1.4-.839-1.667-1.979-1.702-2.584-.382-6.71 3.32-7.878 5.208-8.411-.263-.398-.637-.866-1.024-1.349-1.101-1.376-2.609-3.26-3.771-6.078-.182-.44-.752-1.463-1.412-2.648-3.579-6.418-11.026-19.773-6.242-26.612 2.214-3.165 6.623-4.411 13.119-3.716C97.6 28.837 88.5 10.625 66.907 10.271c-6.494-.108-11.82 1.889-15.822 5.93-8.96 9.049-8.636 25.422-8.631 25.586a1.595 1.595 0 11-3.19.084c-.02-.727-.354-17.909 9.554-27.916C53.455 9.272 59.559 6.96 66.96 7.081c13.814.227 22.706 7.25 27.732 13.101 5.479 6.377 8.165 13.411 8.386 15.759.165 1.746-1.088 2.095-1.341 2.147l-.576.013c-6.375-1.021-10.465-.312-12.156 2.104-3.639 5.201 3.406 17.834 6.414 23.229.768 1.376 1.322 2.371 1.576 2.985.988 2.396 2.277 4.006 3.312 5.3.911 1.138 1.7 2.125 1.982 3.283.131.23 1.99 2.98 13.021.703 2.765-.57 4.423-.083 4.93 1.45.997 3.015-4.597 6.532-7.694 7.97-2.775 1.29-7.204 2.106-11.036 2.106zm-4.696-4.021c.35.353 2.101.962 5.727.806 3.224-.138 6.624-.839 8.664-1.786 2.609-1.212 4.351-2.567 5.253-3.492l-.5.092c-7.053 1.456-12.042 1.262-14.828-.577a6.162 6.162 0 01-.54-.401c-.302.119-.581.197-.78.253-1.58.443-3.214.902-2.996 5.105zm-45.562 8.915c-1.752 0-3.596-.239-5.479-.71-1.951-.488-5.24-1.957-5.19-4.37.057-2.707 3.994-3.519 5.476-3.824 5.354-1.103 5.703-1.545 7.376-3.67.488-.619 1.095-1.39 1.923-2.314 1.229-1.376 2.572-2.073 3.992-2.073.989 0 1.8.335 2.336.558 1.708.708 3.133 2.42 3.719 4.467.529 1.847.276 3.625-.71 5.006-3.237 4.533-7.886 6.93-13.443 6.93zm-7.222-4.943c.481.372 1.445.869 2.518 1.137 1.631.408 3.213.615 4.705.615 4.546 0 8.196-1.882 10.847-5.594.553-.774.387-1.757.239-2.274-.31-1.083-1.08-2.068-1.873-2.397-.43-.178-.787-.314-1.115-.314-.176 0-.712 0-1.614 1.009a41.146 41.146 0 00-1.794 2.162c-2.084 2.646-3.039 3.544-9.239 4.821-1.513.31-2.289.626-2.674.835zm12.269-7.36a1.596 1.596 0 01-1.575-1.354 8.218 8.218 0 01-.08-.799c-4.064-.076-7.985-1.82-10.962-4.926-3.764-3.927-5.477-9.368-4.699-14.927.845-6.037.529-11.366.359-14.229-.047-.796-.081-1.371-.079-1.769.003-.505.013-1.844 4.489-4.113 1.592-.807 4.784-2.215 8.271-2.576 5.777-.597 9.585 1.976 10.725 7.246 3.077 14.228.244 20.521-1.825 25.117-.385.856-.749 1.664-1.04 2.447l-.257.69c-1.093 2.931-2.038 5.463-1.748 7.354a1.595 1.595 0 01-1.335 1.819l-.244.02zM42.464 42.26l.062 1.139c.176 2.974.504 8.508-.384 14.86-.641 4.585.759 9.06 3.843 12.276 2.437 2.542 5.644 3.945 8.94 3.945h.068c.369-1.555.982-3.197 1.642-4.966l.255-.686c.329-.884.714-1.74 1.122-2.646 1.991-4.424 4.47-9.931 1.615-23.132-.565-2.615-1.936-4.128-4.189-4.627-4.628-1.022-11.525 2.459-12.974 3.837zm9.63-.677c-.08.564 1.033 2.07 2.485 2.271 1.449.203 2.689-.975 2.768-1.539.079-.564-1.033-1.186-2.485-1.388-1.451-.202-2.691.092-2.768.656zm2.818 2.826l-.407-.028c-.9-.125-1.81-.692-2.433-1.518-.219-.29-.576-.852-.505-1.354.101-.736.999-1.177 2.4-1.177.313 0 .639.023.967.069.766.106 1.477.327 2.002.62.91.508.977 1.075.936 1.368-.112.813-1.405 2.02-2.96 2.02zm-2.289-2.732c.045.348.907 1.496 2.029 1.651l.261.018c1.036 0 1.81-.815 1.901-1.082-.096-.182-.762-.634-2.025-.81a5.823 5.823 0 00-.821-.059c-.812 0-1.243.183-1.345.282zm43.605-1.245c.079.564-1.033 2.07-2.484 2.272-1.45.202-2.691-.975-2.771-1.539-.076-.564 1.036-1.187 2.486-1.388 1.45-.203 2.689.092 2.769.655zm-2.819 2.56c-1.396 0-2.601-1.086-2.7-1.791-.115-.846 1.278-1.489 2.712-1.688.316-.044.629-.066.93-.066 1.238 0 2.058.363 2.14.949.053.379-.238.964-.739 1.492-.331.347-1.026.948-1.973 1.079l-.37.025zm.943-3.013c-.276 0-.564.021-.856.061-1.441.201-2.301.779-2.259 1.089.048.341.968 1.332 2.173 1.332l.297-.021c.787-.109 1.378-.623 1.66-.919.443-.465.619-.903.598-1.052-.028-.198-.56-.49-1.613-.49zm3.965 32.843a1.594 1.594 0 01-1.324-2.483c3.398-5.075 2.776-10.25 2.175-15.255-.257-2.132-.521-4.337-.453-6.453.07-2.177.347-3.973.614-5.71.317-2.058.617-4.002.493-6.31a1.595 1.595 0 113.186-.172c.142 2.638-.197 4.838-.525 6.967-.253 1.643-.515 3.342-.578 5.327-.061 1.874.178 3.864.431 5.97.64 5.322 1.365 11.354-2.691 17.411a1.596 1.596 0 01-1.328.708z"/></svg>';
        } else if (name === 'redis') {
            icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="1.1989 10.2935 125.5273 107.4304" width="20" height="20" style="vertical-align:middle;"><path fill="#A41E11" d="M121.8 93.1c-6.7 3.5-41.4 17.7-48.8 21.6-7.4 3.9-11.5 3.8-17.3 1S13 98.1 6.3 94.9c-3.3-1.6-5-2.9-5-4.2V78s48-10.5 55.8-13.2c7.8-2.8 10.4-2.9 17-.5s46.1 9.5 52.6 11.9v12.5c0 1.3-1.5 2.7-4.9 4.4z"/><path fill="#D82C20" d="M121.8 80.5C115.1 84 80.4 98.2 73 102.1c-7.4 3.9-11.5 3.8-17.3 1-5.8-2.8-42.7-17.7-49.4-20.9C-.3 79-.5 76.8 6 74.3c6.5-2.6 43.2-17 51-19.7 7.8-2.8 10.4-2.9 17-.5s41.1 16.1 47.6 18.5c6.7 2.4 6.9 4.4.2 7.9z"/><path fill="#A41E11" d="M121.8 72.5C115.1 76 80.4 90.2 73 94.1c-7.4 3.8-11.5 3.8-17.3 1C49.9 92.3 13 77.4 6.3 74.2c-3.3-1.6-5-2.9-5-4.2V57.3s48-10.5 55.8-13.2c7.8-2.8 10.4-2.9 17-.5s46.1 9.5 52.6 11.9V68c0 1.3-1.5 2.7-4.9 4.5z"/><path fill="#D82C20" d="M121.8 59.8c-6.7 3.5-41.4 17.7-48.8 21.6-7.4 3.8-11.5 3.8-17.3 1C49.9 79.6 13 64.7 6.3 61.5s-6.8-5.4-.3-7.9c6.5-2.6 43.2-17 51-19.7 7.8-2.8 10.4-2.9 17-.5s41.1 16.1 47.6 18.5c6.7 2.4 6.9 4.4.2 7.9z"/><path fill="#A41E11" d="M121.8 51c-6.7 3.5-41.4 17.7-48.8 21.6-7.4 3.8-11.5 3.8-17.3 1C49.9 70.9 13 56 6.3 52.8c-3.3-1.6-5.1-2.9-5.1-4.2V35.9s48-10.5 55.8-13.2c7.8-2.8 10.4-2.9 17-.5s46.1 9.5 52.6 11.9v12.5c.1 1.3-1.4 2.6-4.8 4.4z"/><path fill="#D82C20" d="M121.8 38.3C115.1 41.8 80.4 56 73 59.9c-7.4 3.8-11.5 3.8-17.3 1S13 43.3 6.3 40.1s-6.8-5.4-.3-7.9c6.5-2.6 43.2-17 51-19.7 7.8-2.8 10.4-2.9 17-.5s41.1 16.1 47.6 18.5c6.7 2.4 6.9 4.4.2 7.8z"/><path fill="#fff" d="M80.4 26.1l-10.8 1.2-2.5 5.8-3.9-6.5-12.5-1.1 9.3-3.4-2.8-5.2 8.8 3.4 8.2-2.7L72 23zM66.5 54.5l-20.3-8.4 29.1-4.4z"/><ellipse fill="#fff" cx="38.4" cy="35.4" rx="15.5" ry="6"/><path fill="#7A0C00" d="M93.3 27.7l17.2 6.8-17.2 6.8z"/><path fill="#AD2115" d="M74.3 35.3l19-7.6v13.6l-1.9.8z"/></svg>';
        } else if (name === 'socketio') {
            icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0.001 0.001 127.9 127.9" width="20" height="20" style="vertical-align:middle;"><g fill="#aaaaaa" fill-rule="evenodd"><path d="M63.951.001C28.696.001.001 28.696.001 63.951s28.695 63.95 63.95 63.95 63.95-28.695 63.95-63.95S99.206.001 63.95.001zm0 10.679c29.484 0 53.272 23.787 53.272 53.271 0 29.485-23.788 53.272-53.272 53.272-29.484 0-53.272-23.787-53.272-53.272 0-29.484 23.788-53.271 53.272-53.271z" font-weight="400" font-family="sans-serif" overflow="visible" fill-rule="nonzero"/><path d="M48.39 60.716c14.004-11.44 27.702-23.278 42.011-34.384-7.505 11.533-15.224 22.913-22.729 34.445-6.437.03-12.875.03-19.282-.061zM60.228 67.092c6.468 0 12.905 0 19.342.092-14.095 11.38-27.732 23.309-42.071 34.384 7.505-11.533 15.224-22.943 22.729-34.476z"/></g></svg>';
        } else {
            icon = '📡';
        }
        const details = dep.details
            ? `<span class="dep-latency">${Object.entries(dep.details).map(([k, v]) => `${k}: ${v}`).join(' | ')}</span>`
            : '';
        return `
  <div class="dep-row">
    <div class="dep-name">
      <span>${icon}</span>
      <span>${name}</span>
      <span class="status-badge ${statusClass(dep.status)}">${statusText(dep.status)}</span>
    </div>
    <div>
      <span class="dep-latency">${dep.latencyMs !== undefined ? dep.latencyMs + 'ms' : '--'}</span>
      ${details}
    </div>
  </div>
`;
    }).join('');
}

function renderMemory(mem, perf) {
    const body = document.getElementById('memoryBody');
    if (!mem) {
        body.innerHTML = _tHtml('<div class="empty-state">Sin datos</div>');
        return;
    }

    const heap = mem.heap || {};
    const heapPercent = parseFloat(heap.percentUsed) || 0;

    let html = `
<div class="progress-bar-container">
  <div class="progress-label">
    <span>Heap</span>
    <span>${heap.usedMB || 0} MB / ${heap.totalMB || 0} MB (${heapPercent.toFixed(1)}%)</span>
  </div>
  <div class="progress-bar">
    <div class="progress-fill ${progressColor(heapPercent)}" style="width: ${Math.min(heapPercent, 100)}%"></div>
  </div>
</div>
      `;

    const rss = mem.rss || {};
    html += `
<div class="metric-grid" style="margin-top: 1rem;">
  <div class="metric-item">
    <div class="metric-label">RSS</div>
    <div class="metric-value">${rss.usedMB || 0} <span class="metric-sub">MB</span></div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Externo</div>
    <div class="metric-value">${(mem.external || {}).usedMB || 0} <span class="metric-sub">MB</span></div>
  </div>
</div>
      `;

    if (perf && perf.memory) {
        const p = perf.memory;
        html += `
  <div class="metric-grid" style="margin-top: 0.75rem;">
    <div class="metric-item">
      <div class="metric-label">Jugadores en memoria</div>
      <div class="metric-value" style="font-size: 1rem;">${p.players || '--'}</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">Lobbies activos</div>
      <div class="metric-value" style="font-size: 1rem;">${p.activeLobbies || '--'}</div>
    </div>
  </div>
`;
    }

    body.innerHTML = _tHtml(html);
}

function renderDatabase(db, healthData) {
    const body = document.getElementById('databaseBody');
    const badge = document.getElementById('dbBadge');

    if (!db && !(healthData && healthData.performance)) {
        body.innerHTML = _tHtml('<div class="empty-state">Sin datos</div>');
        return;
    }

    const dbInfo = db || {};
    const perf = (healthData && healthData.performance) || {};

    badge.className = `status-badge ${statusClass(dbInfo.status)}`;
    badge.textContent = _t(statusText(dbInfo.status));

    const pool = dbInfo.pool || {};
    const totalPool = pool.total || 10;
    const usedPool = totalPool - (pool.idle || 0);
    const poolPercent = (usedPool / totalPool) * 100;

    let html = `
<div class="metric-grid">
  <div class="metric-item">
    <div class="metric-label">Latencia</div>
    <div class="metric-value">${dbInfo.latencyMs !== undefined ? dbInfo.latencyMs : '--'} <span class="metric-sub">ms</span></div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Consultas totales</div>
    <div class="metric-value">${perf.totalDbQueries ? perf.totalDbQueries.toLocaleString() : '--'}</div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Promedio consulta</div>
    <div class="metric-value">${perf.avgDbQueryMs !== undefined ? perf.avgDbQueryMs : '--'} <span class="metric-sub">ms</span></div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Errores DB</div>
    <div class="metric-value" style="color: ${(perf.dbErrors || 0) > 0 ? 'var(--red)' : 'var(--green)'}">${perf.dbErrors || 0}</div>
  </div>
</div>
<div class="progress-bar-container" style="margin-top: 1rem;">
  <div class="progress-label">
    <span>Pool de conexiones</span>
    <span>${usedPool} / ${totalPool} (${pool.waiting || 0} en espera)</span>
  </div>
  <div class="progress-bar">
    <div class="progress-fill ${progressColor(poolPercent)}" style="width: ${Math.min(poolPercent, 100)}%"></div>
  </div>
</div>
      `;

    if (dbInfo.error) {
        html += `<div class="error-item" style="margin-top: 0.75rem;">${dbInfo.error}</div>`;
    }

    body.innerHTML = _tHtml(html);
}

function renderPerformance(metricsData, perfData) {
    const body = document.getElementById('performanceBody');
    if (!metricsData && !perfData) {
        body.innerHTML = _tHtml('<div class="empty-state">Sin datos</div>');
        return;
    }

    const sys = (metricsData && metricsData.system) || {};
    const http = (metricsData && metricsData.http) || {};
    const db = (metricsData && metricsData.database) || {};
    const perfSys = (perfData && perfData.system) || {};
    const el = (perfData && perfData.eventLoop) || {};

    const cpuPct = perfSys.cpuPercent !== undefined
        ? perfSys.cpuPercent
        : (sys.cpu_percent !== undefined ? parseFloat(sys.cpu_percent) : null);
    const cpuColor = cpuPct === null ? '' : cpuPct < 50 ? 'var(--green)' : cpuPct < 80 ? 'var(--yellow)' : 'var(--red)';

    const [load1, load5, load15] = perfSys.loadavg || [];
    const cpuCount = perfSys.cpuCount || '';

    const elP50 = el.p50Ms;
    const elP95 = el.p95Ms;
    const elP99 = el.p99Ms;
    const elColor = elP99 === undefined ? '' : elP99 < 10 ? 'var(--green)' : elP99 < 50 ? 'var(--yellow)' : 'var(--red)';

    let html = `
<div class="metric-grid">
  <div class="metric-item">
    <div class="metric-label">CPU proceso</div>
    <div class="metric-value" style="color:${cpuColor}">${cpuPct !== null ? cpuPct + '' : '--'}<span class="metric-sub">%</span></div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Load avg${cpuCount ? ' (' + cpuCount + ' cores)' : ''}</div>
    <div class="metric-value" style="font-size:1rem">${load1 !== undefined ? load1 : '--'} <span class="metric-sub">${load5 !== undefined ? load5 + ' &nbsp; ' + load15 : ''}</span></div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Event Loop p99</div>
    <div class="metric-value" style="color:${elColor}">${elP99 !== undefined ? elP99 : '--'}<span class="metric-sub"> ms</span></div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Event Loop p50 / p95</div>
    <div class="metric-value" style="font-size:1rem">${elP50 !== undefined ? elP50 : '--'}<span class="metric-sub"> / ${elP95 !== undefined ? elP95 : '--'} ms</span></div>
  </div>
  <div class="metric-item">
    <div class="metric-label">HTTP Total</div>
    <div class="metric-value">${http.total_requests ? http.total_requests.toLocaleString() : '--'}</div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Peticiones/min</div>
    <div class="metric-value">${http.requests_per_minute || '--'}</div>
  </div>
</div>
      `;

    if (db.recent_query_times && db.recent_query_times.length > 0) {
        const max = Math.max(...db.recent_query_times);
        html += `
  <div style="margin-top: 1rem;">
    <div class="metric-label">Últimas consultas DB (ms)</div>
    <div style="display: flex; align-items: flex-end; gap: 3px; height: 50px; margin-top: 0.5rem;">
      ${db.recent_query_times.map(t => {
        const h = Math.max(4, (t / (max || 1)) * 46);
        const color = t < 50 ? 'var(--green)' : t < 200 ? 'var(--yellow)' : 'var(--red)';
        return `<div class="tooltip-container" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%;">
          <div style="width: 100%; height: ${h}px; background: ${color}; border-radius: 3px 3px 0 0; min-width: 4px;"></div>
          <div class="tooltip-text">${t}ms</div>
        </div>`;
    }).join('')}
    </div>
  </div>
`;
    }

    body.innerHTML = _tHtml(html);
}

function renderGames(healthData, metricsData) {
    const body = document.getElementById('gamesBody');
    const games = (healthData && healthData.games) || {};
    const players = (healthData && healthData.players) || {};
    const mPlayers = (metricsData && metricsData.players) || {};
    const mGames = (metricsData && metricsData.games) || {};

    const maxPlayers = players.maxPlayers || players.maxTotalPlayers || 500;
    const connected = players.connected || 0;
    const playerPercent = (connected / maxPlayers) * 100;

    const maxLobbies = games.maxLobbies || 50;
    const lobbies = games.lobbies || 0;
    const lobbyPercent = (lobbies / maxLobbies) * 100;

    const html = `
<div class="progress-bar-container">
  <div class="progress-label">
    <span>Jugadores conectados</span>
    <span>${connected} / ${maxPlayers}</span>
  </div>
  <div class="progress-bar">
    <div class="progress-fill ${progressColor(playerPercent)}" style="width: ${Math.min(playerPercent, 100)}%"></div>
  </div>
</div>
<div class="progress-bar-container">
  <div class="progress-label">
    <span>Lobbies</span>
    <span>${lobbies} / ${maxLobbies}</span>
  </div>
  <div class="progress-bar">
    <div class="progress-fill blue" style="width: ${Math.min(lobbyPercent, 100)}%"></div>
  </div>
</div>
<div class="metric-grid" style="margin-top: 1rem;">
  <div class="metric-item">
    <div class="metric-label">Creadas (total)</div>
    <div class="metric-value">${mGames.total_created || games.totalGamesCreated || '--'}</div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Completadas</div>
    <div class="metric-value">${mGames.total_completed || games.totalGamesCompleted || '--'}</div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Conexiones (total)</div>
    <div class="metric-value">${mPlayers.total_connections_ever || players.totalConnections || '--'}</div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Desconexiones</div>
    <div class="metric-value">${mPlayers.total_disconnections || '--'}</div>
  </div>
</div>
      `;

    body.innerHTML = _tHtml(html);
}

function renderCache(cache, perfData) {
    const body = document.getElementById('cacheBody');
    const perfCache = (perfData && perfData.cache) || {};

    if (!cache && !perfCache.hitRate) {
        body.innerHTML = _tHtml('<div class="empty-state">Sin datos de caché</div>');
        return;
    }

    let html = '';

    if (cache) {
        Object.entries(cache).forEach(([name, c]) => {
            const hitRate = c.hitRate || '0%';
            const hitNum = parseFloat(hitRate);
            html += `
    <div class="cache-bar-group">
      <div class="progress-label" style="font-weight: 600;">
        <span>📁 ${name}</span>
        <span>${c.entries || 0} / ${c.maxSize || '?'} entradas</span>
      </div>
      <div class="progress-bar-container" style="margin-top: 0;">
        <div class="progress-label">
          <span>Tasa de acierto</span>
          <span>${hitRate}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill green" style="width: ${Math.min(hitNum, 100)}%"></div>
        </div>
      </div>
      <div class="metric-grid" style="margin-top: 0.5rem;">
        <div class="metric-item">
          <div class="metric-label">Hits</div>
          <div class="metric-value" style="font-size:1.1rem; color: var(--green);">${(c.hits || 0).toLocaleString()}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Misses</div>
          <div class="metric-value" style="font-size:1.1rem; color: var(--orange);">${(c.misses || 0).toLocaleString()}</div>
        </div>
      </div>
    </div>
  `;
        });
    }

    if (perfCache.hitRate && !cache) {
        html += `
  <div class="metric-grid">
    <div class="metric-item">
      <div class="metric-label">Tasa de acierto</div>
      <div class="metric-value" style="color: var(--green);">${perfCache.hitRate}</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">Tamaño</div>
      <div class="metric-value">${perfCache.size || 0} / ${perfCache.maxSize || '?'}</div>
    </div>
  </div>
`;
    }

    body.innerHTML = _tHtml(html || '<div class="empty-state">Sin datos de caché</div>');
}

function renderSockets(perfData) {
    const body = document.getElementById('socketsBody');

    if (!perfData || !perfData.sockets) {
        body.innerHTML = _tHtml('<div class="empty-state">Sin datos</div>');
        return;
    }

    const s = perfData.sockets;
    const analysis = s.analysis || {};
    const seg = s.segregation || {};

    let html = `
<div class="metric-grid">
  <div class="metric-item">
    <div class="metric-label">Total conectados</div>
    <div class="metric-value">${s.total || 0}</div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Salas totales</div>
    <div class="metric-value">${analysis.totalRooms || 0}</div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Jugadores en salas</div>
    <div class="metric-value">${analysis.totalPlayersInRooms || 0}</div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Prom. jugadores/partida</div>
    <div class="metric-value">${analysis.averagePlayersPerGame || '0'}</div>
  </div>
</div>
      `;

    if (seg.enabled !== undefined) {
        html += `
  <div style="margin-top: 0.75rem; padding: 0.6rem; background: ${seg.enabled ? 'var(--green-bg)' : 'var(--yellow-bg)'}; border-radius: 0.5rem; font-size: 0.8rem;">
    ${seg.enabled ? '✅' : '⚠️'} Segregación de salas: <strong>${seg.enabled ? 'Activada' : 'Desactivada'}</strong>
  </div>
`;
    }

    if (s.byRoom && Object.keys(s.byRoom).length > 0) {
        const rooms = Object.entries(s.byRoom).slice(0, 10);
        html += `
  <div style="margin-top: 0.75rem;">
    <div class="metric-label" style="margin-bottom: 0.5rem;">Salas activas</div>
    <table class="data-table">
      <thead><tr><th>Sala</th><th>Conexiones</th></tr></thead>
      <tbody>
        ${rooms.map(([name, count]) => `<tr><td style="font-family: monospace; font-size: 0.8rem;">${name}</td><td>${count}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
`;
    }

    body.innerHTML = _tHtml(html);
}

function renderTimersWorkers(healthData, perfData) {
    const body = document.getElementById('timersBody');
    const timers = (healthData && healthData.timers) || {};
    const workers = (healthData && healthData.workers) || {};
    const perfTimers = (perfData && perfData.timers) || {};

    let html = `
<div class="metric-grid">
  <div class="metric-item">
    <div class="metric-label">Timers activos</div>
    <div class="metric-value">${timers.active || perfTimers.total || 0}</div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Workers activos</div>
    <div class="metric-value">${workers.active || 0}</div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Intervals</div>
    <div class="metric-value">${timers.intervals || 0}</div>
  </div>
  <div class="metric-item">
    <div class="metric-label">Timeouts</div>
    <div class="metric-value">${timers.timeouts || 0}</div>
  </div>
</div>
      `;

    if (perfTimers.orphans > 0) {
        html += `
  <div class="error-item" style="margin-top: 0.75rem;">
    ⚠️ ${perfTimers.orphans} timer(s) huérfano(s) detectado(s)
  </div>
`;
    }

    if (workers.list && workers.list.length > 0) {
        html += `
  <div style="margin-top: 0.75rem;">
    <div class="metric-label" style="margin-bottom: 0.5rem;">Workers</div>
    <table class="data-table">
      <thead><tr><th>Instancia</th><th>PID</th><th>Estado</th></tr></thead>
      <tbody>
        ${workers.list.map(w => `<tr>
          <td>${w.instance || '--'}</td>
          <td>${w.pid || '--'}</td>
          <td><span class="status-badge healthy">Activo</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
`;
    }

    body.innerHTML = _tHtml(html);
}

function renderErrors(metricsData) {
    const errors = (metricsData && metricsData.errors) || {};
    const count = errors.total || 0;
    const recent = errors.recent || [];

    document.getElementById('errorCount').textContent = _t(`${count} error${count !== 1 ? 'es' : ''} total${count !== 1 ? 'es' : ''}`);

    const list = document.getElementById('errorList');
    if (recent.length === 0) {
        list.innerHTML = _tHtml('<div class="empty-state">Sin errores recientes ✅</div>');
        return;
    }

    list.innerHTML = recent.map(err => {
        const time = err.timestamp ? new Date(err.timestamp).toLocaleString('es-ES') : '';
        return `
  <div class="error-item">
    <div class="error-time">${time}</div>
    <div>${err.message || err.error || JSON.stringify(err)}</div>
  </div>
`;
    }).join('');
}

// ─── Logs Functions ──────────────────────────────────────
let currentLogsData = null;

function renderLogs(logsData) {
    if (!logsData || !logsData.logs) {
        document.getElementById('logsContainer').innerHTML = _tHtml('<div class="empty-state">Sin logs disponibles</div>');
        return;
    }

    currentLogsData = logsData;

    const apiStats = logsData.stats;
    const stats = (apiStats && apiStats.total > 0)
        ? apiStats
        : (() => {
            const byLevel = { error: 0, warn: 0, info: 0, http: 0, debug: 0 };
            for (const log of logsData.logs) {
                const lvl = (log.level || '').toLowerCase();
                if (lvl in byLevel) byLevel[lvl]++;
            }
            return { total: logsData.logs.length, byLevel };
        })();

    const statsHtml = `
        <div class="stat-item">
            <span class="stat-label">Total:</span>
            <span class="stat-value">${stats.total}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Error:</span>
            <span class="stat-value" style="color: var(--red)">${stats.byLevel.error}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Warn:</span>
            <span class="stat-value" style="color: var(--yellow)">${stats.byLevel.warn}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Info:</span>
            <span class="stat-value" style="color: var(--green)">${stats.byLevel.info}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">HTTP:</span>
            <span class="stat-value" style="color: var(--purple)">${stats.byLevel.http}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Debug:</span>
            <span class="stat-value" style="color: var(--cyan)">${stats.byLevel.debug}</span>
        </div>
    `;
    document.getElementById('logsStats').innerHTML = _tHtml(statsHtml);

    renderLogsEntries(logsData.logs);
}

function renderLogsEntries(logs) {
    const container = document.getElementById('logsContainer');

    if (!logs || logs.length === 0) {
        container.innerHTML = _tHtml('<div class="empty-state">No hay logs que coincidan con los filtros</div>');
        return;
    }

    container.innerHTML = logs.map(log => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString('es-ES', { hour12: false });
        const date = new Date(log.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

        const metadata = { ...log.metadata };
        delete metadata.timestamp;
        delete metadata.level;
        delete metadata.message;

        const hasMetadata = Object.keys(metadata).length > 0;
        const metadataHtml = hasMetadata
            ? `<div class="log-metadata">${JSON.stringify(metadata, null, 2)}</div>`
            : '';

        return `
            <div class="log-entry">
                <div class="log-timestamp">${date} ${timestamp}</div>
                <div class="log-level ${log.level}">${log.level}</div>
                <div>
                    <div class="log-message">${escapeHtml(log.message)}</div>
                    ${metadataHtml}
                </div>
            </div>
        `;
    }).join('');
}

async function filterLogs() {
    const level = document.getElementById('logLevelFilter').value;
    const search = document.getElementById('logSearchInput').value;

    try {
        const url = `/api/health/logs?limit=1000${level !== 'all' ? '&level=' + level : ''}${search ? '&search=' + encodeURIComponent(search) : ''}`;
        const logsData = await fetchJSON(url);
        renderLogs(logsData);
    } catch (err) {
        console.error('Error al filtrar logs:', err);
    }
}

function clearLogsView() {
    document.getElementById('logLevelFilter').value = 'all';
    document.getElementById('logSearchInput').value = '';
    filterLogs();
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderOverallStatus(healthData) {
    const badge = document.getElementById('overallBadge');
    const text = document.getElementById('overallText');
    const status = healthData ? healthData.status : 'unknown';
    const cls = statusClass(status);

    badge.className = `overall-badge ${cls}`;
    text.textContent = _t(statusText(status));
}

function updateHistory(healthData, metricsData, perfData) {
    const heap = healthData && healthData.memory && healthData.memory.heap;
    const players = healthData && healthData.players;
    const db = healthData && healthData.database;
    const http = metricsData && metricsData.http;
    const perfSys = perfData && perfData.system;
    const el = perfData && perfData.eventLoop;

    if (heap) history.memory.push(heap.usedMB || 0);
    if (players) history.players.push(players.connected || 0);
    if (db) history.dbLatency.push(db.latencyMs || 0);
    if (http) history.http.push(http.requests_per_minute || 0);
    if (perfSys) history.cpu.push(perfSys.cpuPercent || 0);
    if (el) history.eventLoop.push(el.p99Ms || 0);

    Object.values(history).forEach(arr => {
        while (arr.length > MAX_HISTORY) arr.shift();
    });

    drawSparkline('chartMemory', history.memory, '#3b82f6', 'rgba(59,130,246,0.15)');
    drawSparkline('chartPlayers', history.players, '#22c55e', 'rgba(34,197,94,0.15)');
    drawSparkline('chartDbLatency', history.dbLatency, '#eab308', 'rgba(234,179,8,0.15)');
    drawSparkline('chartHttp', history.http, '#a855f7', 'rgba(168,85,247,0.15)');
    drawSparkline('chartCpu', history.cpu, '#f97316', 'rgba(249,115,22,0.15)');
    drawSparkline('chartEventLoop', history.eventLoop, '#06b6d4', 'rgba(6,182,212,0.15)');
}

// ─── Auth gate ───────────────────────────────────────────
function showAuthGate(message) {
    if (intervalId) clearInterval(intervalId);
    document.getElementById('loadingOverlay').classList.add('hidden');
    document.getElementById('authGate').classList.add('visible');
    document.getElementById('authError').textContent = message || '';
}

function hideAuthGate() {
    document.getElementById('authGate').classList.remove('visible');
    document.getElementById('authError').textContent = '';
}

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const errorEl = document.getElementById('authError');
    errorEl.textContent = '';

    try {
        const res = await fetch('/api/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            errorEl.textContent = data.error || 'Usuario o contraseña incorrectos';
            return;
        }
        if (data.role !== 'admin') {
            errorEl.textContent = 'Se requiere una cuenta de administrador';
            return;
        }
        hideAuthGate();
        document.getElementById('loadingOverlay').classList.remove('hidden');
        refreshAll();
        intervalId = setInterval(refreshAll, refreshInterval);
    } catch {
        errorEl.textContent = 'Error de conexión';
    }
}

async function checkAuthAndStart() {
    try {
        const res = await fetch('/api/health', { cache: 'no-cache' });
        if (res.status === 401 || res.status === 403) {
            showAuthGate();
            return;
        }
    } catch {
        // fallo de red: se deja que refreshAll gestione el reintento
    }
    refreshAll();
    intervalId = setInterval(refreshAll, refreshInterval);
}

// ─── Main fetch & render ─────────────────────────────────
async function refreshAll() {
    try {
        const [liveData, readyData, healthData, metricsData, perfData, logsData] = await Promise.allSettled([
            fetchJSON('/live'),
            fetchJSON('/ready'),
            fetchJSON('/api/health'),
            fetchJSON('/api/metrics'),
            fetchJSON('/api/health/performance'),
            fetchJSON('/api/health/logs?limit=1000'),
        ]);

        if (healthData.status === 'rejected' && healthData.reason?.status === 401) {
            showAuthGate('Tu sesión ha expirado. Inicia sesión de nuevo.');
            return;
        }

        const live = liveData.status === 'fulfilled' ? liveData.value : null;
        const ready = readyData.status === 'fulfilled' ? readyData.value : null;
        const health = healthData.status === 'fulfilled' ? healthData.value : null;
        const metrics = metricsData.status === 'fulfilled' ? metricsData.value : null;
        const perf = perfData.status === 'fulfilled' ? perfData.value : null;
        const logs = logsData.status === 'fulfilled' ? logsData.value : null;

        renderOverallStatus(health);
        renderProbes(live, ready, health, metrics);
        renderDependencies(health ? health.dependencies : null);
        renderMemory(health ? health.memory : null, perf);
        renderDatabase(health ? health.database : null, health);
        renderPerformance(metrics, perf);
        renderGames(health, metrics);
        renderCache(health ? health.cache : null, perf);
        renderSockets(perf);
        renderTimersWorkers(health, perf);
        renderErrors(metrics);
        renderLogs(logs);
        updateHistory(health, metrics, perf);

        document.getElementById('refreshInfo').textContent =
            _t(`Actualizado: ${new Date().toLocaleTimeString('es-ES')}`);

        consecutiveErrors = 0;
        document.getElementById('connectionError').classList.remove('visible');

    } catch (err) {
        console.error('Error al obtener datos:', err);
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
            document.getElementById('connectionError').classList.add('visible');
        }
    } finally {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }
}

// ─── Controls ────────────────────────────────────────────
function changeInterval(ms) {
    refreshInterval = parseInt(ms, 10);
    if (!paused) {
        clearInterval(intervalId);
        intervalId = setInterval(refreshAll, refreshInterval);
    }
}

function togglePause() {
    paused = !paused;
    const btn = document.getElementById('btnPause');
    if (paused) {
        clearInterval(intervalId);
        btn.textContent = _t('▶ Reanudar');
        btn.classList.add('active');
    } else {
        intervalId = setInterval(refreshAll, refreshInterval);
        btn.textContent = _t('⏸ Pausar');
        btn.classList.remove('active');
        refreshAll();
    }
}

function setupControlListeners() {
    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) btnRefresh.addEventListener('click', refreshAll);

    const intervalSelect = document.getElementById('intervalSelect');
    if (intervalSelect) {
        intervalSelect.addEventListener('change', function (event) {
            changeInterval(event.target.value);
        });
    }

    const btnPause = document.getElementById('btnPause');
    if (btnPause) btnPause.addEventListener('click', togglePause);

    const logLevelFilter = document.getElementById('logLevelFilter');
    if (logLevelFilter) logLevelFilter.addEventListener('change', filterLogs);

    const logSearchInput = document.getElementById('logSearchInput');
    if (logSearchInput) logSearchInput.addEventListener('input', filterLogs);

    const btnClearLogs = document.getElementById('btnClearLogs');
    if (btnClearLogs) btnClearLogs.addEventListener('click', clearLogsView);
}

// ─── Resize handler for charts ──────────────────────────
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        drawSparkline('chartMemory', history.memory, '#3b82f6', 'rgba(59,130,246,0.15)');
        drawSparkline('chartPlayers', history.players, '#22c55e', 'rgba(34,197,94,0.15)');
        drawSparkline('chartDbLatency', history.dbLatency, '#eab308', 'rgba(234,179,8,0.15)');
        drawSparkline('chartHttp', history.http, '#a855f7', 'rgba(168,85,247,0.15)');
        drawSparkline('chartCpu', history.cpu, '#f97316', 'rgba(249,115,22,0.15)');
        drawSparkline('chartEventLoop', history.eventLoop, '#06b6d4', 'rgba(6,182,212,0.15)');
    }, 200);
});

// ─── Init ────────────────────────────────────────────────
setupControlListeners();
document.getElementById('authForm').addEventListener('submit', handleLogin);
checkAuthAndStart();
