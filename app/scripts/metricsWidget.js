/* global config, args, Script, Safari, ListWidget, Color, Font, Alert, Keychain, Data, FileManager, SFSymbol, Device, Size */

// Variables used by Scriptable.
// icon-color: purple; icon-glyph: heartbeat
// Script: Xiro! — estado del servidor

// /api/health exige sesión de admin: el widget inicia sesión con una cuenta admin guardada
// en el Keychain de iOS y envía el JWT como Bearer. La primera vez, ejecútalo desde la app para
// dar la cuenta; para cambiarla, abre scriptable:///run/<nombre del script>?account=change.
// Tocar el widget abre este script con ?view=detail: detalle en Scriptable y acceso al panel web.
// Las cifras salen de `cluster` (suma de todos los workers PM2), no del worker que responde.
const BASE_URL = 'https://xiro.pro';
const KEY_USER = 'xiro_widget_user';
const KEY_PASS = 'xiro_widget_pass';
const KEY_TOKEN = 'xiro_widget_token';
const CACHE_FILE = 'xiro-widget-health.json';
const REFRESH_MINUTES = 5;

// Una fila por texto, columnas en el orden de LANGS
const LANGS = ['es', 'en', 'ca', 'de', 'eu', 'fr', 'gl', 'ja', 'pt', 'zh'];
const TEXTS = {
    allGood: ['Todo en orden', 'All systems normal', 'Tot en ordre', 'Alles in Ordnung', 'Dena ondo', 'Tout fonctionne', 'Todo en orde', 'すべて正常', 'Tudo em ordem', '一切正常'],
    degraded: ['Servicio degradado', 'Service degraded', 'Servei degradat', 'Dienst eingeschränkt', 'Zerbitzua degradatuta', 'Service dégradé', 'Servizo degradado', 'サービス低下中', 'Serviço degradado', '服务降级'],
    down: ['Servicio con fallos', 'Service failing', 'Servei amb errors', 'Dienst gestört', 'Zerbitzuak hutsegiteak ditu', 'Service en panne', 'Servizo con fallos', 'サービス障害', 'Serviço com falhas', '服务故障'],
    starting: ['Arrancando', 'Starting up', 'Arrencant', 'Startet', 'Abiarazten', 'Démarrage', 'Arrancando', '起動中', 'A iniciar', '正在启动'],
    incomplete: ['Datos incompletos', 'Incomplete data', 'Dades incompletes', 'Daten unvollständig', 'Datu osatugabeak', 'Données incomplètes', 'Datos incompletos', 'データ不完全', 'Dados incompletos', '数据不完整'],
    depSlow: ['{name} responde lento', '{name} is slow', '{name} respon lent', '{name} reagiert langsam', '{name}: motel dabil', '{name} est lent', '{name} responde lento', '{name} の応答が遅い', '{name} está lento', '{name} 响应缓慢'],
    depDown: ['{name} no responde', '{name} not responding', '{name} no respon', '{name} antwortet nicht', '{name}: ez du erantzuten', '{name} ne répond pas', '{name} non responde', '{name} が応答なし', '{name} não responde', '{name} 无响应'],
    stale: ['Sin datos nuevos', 'No fresh data', 'Sense dades noves', 'Keine neuen Daten', 'Datu berririk ez', 'Pas de nouvelles données', 'Sen datos novos', '新しいデータなし', 'Sem dados novos', '无新数据'],
    ago: ['hace {n} min', '{n} min ago', 'fa {n} min', 'vor {n} Min.', 'duela {n} min', 'il y a {n} min', 'hai {n} min', '{n} 分前', 'há {n} min', '{n} 分钟前'],
    lastRead: ['Última lectura {time} ({ago})', 'Last read {time} ({ago})', 'Darrera lectura {time} ({ago})', 'Zuletzt gelesen {time} ({ago})', 'Azken irakurketa {time} ({ago})', 'Dernière lecture {time} ({ago})', 'Última lectura {time} ({ago})', '最終取得 {time}（{ago}）', 'Última leitura {time} ({ago})', '最后读取 {time}（{ago}）'],
    uptime: ['activo {up}', 'up {up}', 'actiu {up}', 'läuft seit {up}', 'martxan {up}', 'actif depuis {up}', 'activo {up}', '稼働 {up}', 'ativo há {up}', '运行 {up}'],
    partialWorkers: ['{a} de {b} workers informan', '{a} of {b} workers reporting', '{a} de {b} workers informen', '{a} von {b} Workern melden', '{a}/{b} worker-ek informatzen dute', '{a} workers sur {b} répondent', '{a} de {b} workers informan', '{b} 中 {a} ワーカーが報告', '{a} de {b} workers reportam', '{b} 个 worker 中 {a} 个已上报'],
    players: ['jugadores', 'players', 'jugadors', 'Spieler', 'jokalari', 'joueurs', 'xogadores', 'プレイヤー', 'jogadores', '玩家'],
    games: ['partidas', 'games', 'partides', 'Spiele', 'partida', 'parties', 'partidas', 'ゲーム', 'partidas', '游戏'],
    db: ['BD', 'DB', 'BD', 'DB', 'DB', 'BD', 'BD', 'DB', 'BD', '数据库'],
    workers: ['workers', 'workers', 'workers', 'Worker', 'worker', 'workers', 'workers', 'ワーカー', 'workers', 'worker'],
    lobbies: ['en espera', 'in lobby', 'en espera', 'in Lobby', 'zain', 'en attente', 'en espera', '待機中', 'em espera', '等待中'],
    ram: ['RAM (suma)', 'RAM (sum)', 'RAM (suma)', 'RAM (Summe)', 'RAM (batura)', 'RAM (somme)', 'RAM (suma)', 'RAM（合計）', 'RAM (soma)', '内存（合计）'],
    reqMin: ['pet./min', 'req/min', 'pet./min', 'Anfr./Min', 'eskaera/min', 'req/min', 'pet./min', 'リクエスト/分', 'ped./min', '请求/分'],
    dbName: ['Base de datos', 'Database', 'Base de dades', 'Datenbank', 'Datu-basea', 'Base de données', 'Base de datos', 'データベース', 'Base de dados', '数据库'],
    slow: ['con retraso', 'slow', 'amb retard', 'langsam', 'motel', 'lent', 'con atraso', '遅延', 'lento', '缓慢'],
    noResponse: ['sin respuesta', 'not responding', 'sense resposta', 'keine Antwort', 'erantzunik ez', 'pas de réponse', 'sen resposta', '応答なし', 'sem resposta', '无响应'],
    reasonNetwork: ['Sin red', 'No network', 'Sense xarxa', 'Kein Netz', 'Sarerik ez', 'Pas de réseau', 'Sen rede', 'ネットワークなし', 'Sem rede', '无网络'],
    reasonSession: ['Error de sesión', 'Session error', 'Error de sessió', 'Sitzungsfehler', 'Saio-errorea', 'Erreur de session', 'Erro de sesión', 'セッションエラー', 'Erro de sessão', '会话错误'],
    reasonServer: ['Error del servidor', 'Server error', 'Error del servidor', 'Serverfehler', 'Zerbitzari-errorea', 'Erreur serveur', 'Erro do servidor', 'サーバーエラー', 'Erro do servidor', '服务器错误'],
    needAccount: ['Falta la cuenta', 'Account missing', 'Falta el compte', 'Konto fehlt', 'Kontua falta da', 'Compte manquant', 'Falta a conta', 'アカウント未設定', 'Falta a conta', '缺少账户'],
    openApp: ['Abre el script en Scriptable para configurarla', 'Open the script in Scriptable to set it up', "Obre l'script a Scriptable per configurar-lo", 'Öffne das Skript in Scriptable, um es einzurichten', 'Ireki scripta Scriptable-n konfiguratzeko', 'Ouvrez le script dans Scriptable pour le configurer', 'Abre o script en Scriptable para configurala', 'Scriptable でスクリプトを開いて設定してください', 'Abra o script no Scriptable para a configurar', '在 Scriptable 中打开脚本进行设置'],
    noConnection: ['No se pudo conectar', 'Could not connect', "No s'ha pogut connectar", 'Keine Verbindung möglich', 'Ezin izan da konektatu', 'Connexion impossible', 'Non se puido conectar', '接続できませんでした', 'Não foi possível ligar', '无法连接'],
    askTitle: ['Xiro!: cuenta de administrador', 'Xiro!: admin account', "Xiro!: compte d'administrador", 'Xiro!: Admin-Konto', 'Xiro!: administratzaile-kontua', 'Xiro! : compte administrateur', 'Xiro!: conta de administrador', 'Xiro!：管理者アカウント', 'Xiro!: conta de administrador', 'Xiro!：管理员账户'],
    user: ['Usuario', 'Username', 'Usuari', 'Benutzername', 'Erabiltzailea', "Nom d'utilisateur", 'Usuario', 'ユーザー名', 'Utilizador', '用户名'],
    password: ['Contraseña', 'Password', 'Contrasenya', 'Passwort', 'Pasahitza', 'Mot de passe', 'Contrasinal', 'パスワード', 'Palavra-passe', '密码'],
    save: ['Guardar', 'Save', 'Desa', 'Speichern', 'Gorde', 'Enregistrer', 'Gardar', '保存', 'Guardar', '保存'],
    termsTitle: ['Términos pendientes', 'Terms not accepted', 'Termes pendents', 'Bedingungen ausstehend', 'Baldintzak onartu gabe', 'Conditions non acceptées', 'Termos pendentes', '規約が未同意', 'Termos pendentes', '条款未接受'],
    termsRequired: ['Acepta los términos en el panel', 'Accept the terms in the admin panel', 'Accepta els termes al tauler', 'Akzeptiere die Bedingungen im Admin-Panel', 'Onartu baldintzak panelean', 'Acceptez les conditions dans le panneau', 'Acepta os termos no panel', '管理パネルで規約に同意してください', 'Aceite os termos no painel', '请在管理面板中接受条款'],
    rerunForAccount: ['Vuelve a ejecutarlo para dar la cuenta', 'Run it again to enter the account', 'Torna a executar-lo per indicar el compte', 'Führe es erneut aus, um das Konto einzugeben', 'Exekutatu berriro kontua emateko', 'Relancez-le pour saisir le compte', 'Volve executalo para dar a conta', 'もう一度実行してアカウントを入力してください', 'Execute-o novamente para indicar a conta', '再次运行以输入账户'],
    updateServer: ['Actualiza el servidor para ver las cifras', 'Update the server to see the figures', 'Actualitza el servidor per veure les xifres', 'Aktualisiere den Server, um die Zahlen zu sehen', 'Eguneratu zerbitzaria zifrak ikusteko', 'Mettez à jour le serveur pour voir les chiffres', 'Actualiza o servidor para ver as cifras', '数値を見るにはサーバーを更新してください', 'Atualize o servidor para ver os números', '更新服务器以查看数据'],
    openPanel: ['Abrir panel', 'Open panel', 'Obre el tauler', 'Panel öffnen', 'Ireki panela', 'Ouvrir le panneau', 'Abrir panel', 'パネルを開く', 'Abrir painel', '打开面板'],
    close: ['Cerrar', 'Close', 'Tanca', 'Schließen', 'Itxi', 'Fermer', 'Pechar', '閉じる', 'Fechar', '关闭'],
    cancel: ['Cancelar', 'Cancel', 'Cancel·la', 'Abbrechen', 'Utzi', 'Annuler', 'Cancelar', 'キャンセル', 'Cancelar', '取消'],
};
const DEVICE_LANG = Device.language().toLowerCase().slice(0, 2);
const LANG = LANGS.includes(DEVICE_LANG) ? DEVICE_LANG : 'en';
const T = Object.fromEntries(Object.entries(TEXTS).map(([key, row]) => [key, row[LANGS.indexOf(LANG)]]));

/** Sustituye {clave} en un texto de TEXTS. */
function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, (_m, key) => String(values[key]));
}

// Paleta de DESIGN.md: tinta y fondo de consola en oscuro, plum-wash en claro; el color solo marca estado
const dyn = (light, dark) => Color.dynamic(new Color(light), new Color(dark));
const PALETTE = {
    background: dyn('#fdf4fb', '#0f172a'),
    ink: dyn('#0f172a', '#f8fafc'),
    muted: dyn('#64748b', '#94a3b8'),
    brand: dyn('#94438e', '#8ab817'),
    ok: dyn('#047857', '#10b981'),
    warn: dyn('#b45309', '#f9b518'),
    error: dyn('#b42d2c', '#e65453')
};
PALETTE.offline = PALETTE.muted;

// Camaleón según el estado; PNG generados desde public/images/chamaleon/*.svg (iOS no dibuja SVG)
const MASCOTS = { ok: 'thumbs_up', warn: 'detective', error: 'dizzy', offline: 'sleep', account: 'pointing' };
const MASCOT_VERSION = 'v1';

// Entry
(async () => {
    if (wantsAccountChange()) forgetAccount();
    const view = await loadView();
    view.mascot = await loadMascot(MASCOTS[view.mascotKey]);
    if (config.runsInWidget) Script.setWidget(createWidget(view, config.widgetFamily || 'medium'));
    else if (args.queryParameters?.view === 'detail') await presentDetail(view);
    // Ejecutado a mano desde la app no hay widgetFamily: se previsualiza el tamaño mediano
    else await createWidget(view, 'medium').presentMedium();
    Script.complete();
})();

/** Vista a la que lleva tocar el widget: el tamaño grande y, al cerrarla, el panel web si se quiere. */
async function presentDetail(view) {
    await createWidget(view, 'large').presentLarge();
    const alert = new Alert();
    alert.title = 'Xiro!';
    alert.addAction(T.openPanel);
    alert.addCancelAction(T.close);
    if ((await alert.presentSheet()) === 0) Safari.open(`${BASE_URL}/health.html`);
}

/** URL que abre este mismo script en Scriptable con la vista de detalle (sin login en Safari). */
function detailUrl() {
    return `scriptable:///run/${encodeURIComponent(Script.name())}?view=detail`;
}

// ===== Cuenta y sesión =====

/**
 * Cambio de cuenta a propósito: scriptable:///run/<nombre del script>?account=change
 * (se puede guardar como atajo). Con credenciales incorrectas no hace falta: el login
 * las borra y la app las vuelve a pedir.
 */
function wantsAccountChange() {
    return !config.runsInWidget && args.queryParameters?.account === 'change';
}

function forgetAccount() {
    [KEY_USER, KEY_PASS, KEY_TOKEN].forEach(key => Keychain.contains(key) && Keychain.remove(key));
}

function codedError(code, message, status, serverCode) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    err.serverCode = serverCode;
    return err;
}

/** Lanza un error con el mensaje del servidor si la respuesta no es 2xx. */
function assertOk(req, body) {
    const status = req.response?.statusCode || 0;
    if (status >= 200 && status < 300) return;
    throw codedError('HTTP', body?.error || `HTTP ${status}`, status, body?.code);
}

/** Pide usuario y contraseña (solo desde la app) y los guarda en el Keychain. */
async function askCredentials() {
    const alert = new Alert();
    alert.title = T.askTitle;
    alert.addTextField(T.user);
    alert.addSecureTextField(T.password);
    alert.addAction(T.save);
    alert.addCancelAction(T.cancel);
    if ((await alert.present()) === -1) throw codedError('NEED_ACCOUNT', T.needAccount);
    Keychain.set(KEY_USER, alert.textFieldValue(0).trim());
    Keychain.set(KEY_PASS, alert.textFieldValue(1));
}

/** Devuelve las credenciales guardadas; el widget no puede mostrar diálogos. */
async function getCredentials() {
    if (!Keychain.contains(KEY_USER) || !Keychain.contains(KEY_PASS)) {
        if (config.runsInWidget) throw codedError('NEED_ACCOUNT', T.needAccount);
        await askCredentials();
    }
    return { username: Keychain.get(KEY_USER), password: Keychain.get(KEY_PASS) };
}

/** Inicia sesión y guarda el JWT. Si las credenciales son incorrectas, las borra para volver a pedirlas. */
async function login() {
    const req = new Request(`${BASE_URL}/api/admin-login`);
    req.method = 'POST';
    req.timeoutInterval = 10;
    req.headers = { 'Content-Type': 'application/json' };
    req.body = JSON.stringify(await getCredentials());
    const body = await req.loadJSON();
    if (req.response?.statusCode === 401) forgetAccount();
    assertOk(req, body);
    Keychain.set(KEY_TOKEN, body.token);
    return body.token;
}

/** Token guardado si le quedan más de 5 min de vida; así no se provoca un 401 (y su warning) al caducar. */
function cachedToken() {
    if (!Keychain.contains(KEY_TOKEN)) return null;
    const token = Keychain.get(KEY_TOKEN);
    try {
        const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const { exp } = JSON.parse(Data.fromBase64String(padded).toRawString());
        return exp * 1000 - Date.now() > 5 * 60 * 1000 ? token : null;
    } catch (_err) {
        // Token ilegible en el Keychain: se descarta y se inicia sesión de nuevo
        return null;
    }
}

async function getHealth(token) {
    const req = new Request(`${BASE_URL}/api/health`);
    req.timeoutInterval = 10;
    req.headers = { Authorization: `Bearer ${token}` };
    const body = await req.loadJSON();
    assertOk(req, body);
    return body;
}

/** Lee /api/health con sesión admin; si el token ya no vale (p. ej. usuario desactivado), reintenta una vez. */
async function fetchHealth() {
    try {
        return await getHealth(cachedToken() || (await login()));
    } catch (err) {
        if (err.status !== 401) throw err;
        return getHealth(await login());
    }
}

// ===== Almacenamiento local (última respuesta buena y mascotas) =====

function localPath(name) {
    const fm = FileManager.local();
    return fm.joinPath(fm.documentsDirectory(), name);
}

function saveCache(health) {
    FileManager.local().writeString(localPath(CACHE_FILE), JSON.stringify({ savedAt: Date.now(), health }));
}

function readCache() {
    const fm = FileManager.local();
    if (!fm.fileExists(localPath(CACHE_FILE))) return null;
    try {
        return JSON.parse(fm.readString(localPath(CACHE_FILE)));
    } catch (_err) {
        // Caché corrupta: se trata como si no hubiera datos previos
        return null;
    }
}

/** Imagen de la mascota, descargada una vez y guardada; null si no hay red ni copia (se usa un SF Symbol). */
async function loadMascot(name) {
    const fm = FileManager.local();
    const path = localPath(`xiro-mascot-${MASCOT_VERSION}-${name}.png`);
    if (fm.fileExists(path)) return fm.readImage(path);
    try {
        const req = new Request(`${BASE_URL}/images/chamaleon/widget/${name}.png`);
        req.timeoutInterval = 10;
        const image = await req.loadImage();
        fm.writeImage(path, image);
        return image;
    } catch (_err) {
        // Sin mascota el widget sigue siendo legible: el icono SF y el titular llevan el estado
        return null;
    }
}

/** Con red, descarga las mascotas que falten para tenerlas también cuando no haya conexión. */
async function prefetchMascots() {
    await Promise.all(Object.values(MASCOTS).map(loadMascot));
}

/** Datos frescos si se puede; si no, los últimos guardados marcados como antiguos; si no, un error. */
async function loadView() {
    try {
        const health = await fetchHealth();
        saveCache(health);
        await prefetchMascots();
        return buildView(health);
    } catch (err) {
        const cached = readCache();
        if (cached && err.code !== 'NEED_ACCOUNT') return buildStaleView(cached, err);
        return buildErrorView(err);
    }
}

// ===== Modelo de la vista (sin API de Scriptable salvo T y config) =====

const DEP_NAMES = { database: [T.dbName, T.db], redis: ['Redis', 'Redis'], socketio: ['Socket.IO', 'Socket.IO'] };

function dependencyList(health) {
    return Object.entries(health.dependencies || {}).map(([key, info]) => ({
        name: DEP_NAMES[key]?.[0] || key,
        shortName: DEP_NAMES[key]?.[1] || key,
        status: info?.status || 'unknown',
        latencyMs: info?.latencyMs
    }));
}

function toneFor(status) {
    if (status === 'healthy') return 'ok';
    if (status === 'unhealthy' || status === 'shutting_down') return 'error';
    return 'warn';
}

const isPartial = cluster => Boolean(cluster) && cluster.reportingWorkers < cluster.totalWorkers;

/** Titular: el primer problema concreto, o el estado general. */
function headlineFor(health, deps, cluster) {
    const failing = deps.find(dep => dep.status === 'unhealthy');
    if (failing) return fill(T.depDown, { name: failing.shortName });
    const slow = deps.find(dep => dep.status === 'degraded');
    if (slow) return fill(T.depSlow, { name: slow.shortName });
    if (health.status === 'initializing') return T.starting;
    if (health.status !== 'healthy') return toneFor(health.status) === 'error' ? T.down : T.degraded;
    return isIncomplete(cluster) ? T.incomplete : T.allGood;
}

/** Sin `cluster` (servidor sin actualizar) o con workers sin informar, las cifras no son fiables. */
const isIncomplete = cluster => !cluster || isPartial(cluster);

/** Con datos incompletos las cifras se quedan cortas, así que nunca se presenta como «todo bien». */
function overallTone(health, cluster) {
    const tone = toneFor(health.status);
    return tone === 'ok' && isIncomplete(cluster) ? 'warn' : tone;
}

function formatUptime(seconds) {
    if (!seconds) return '0m';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

const clock = date => date.toLocaleTimeString(LANG, { hour: '2-digit', minute: '2-digit' });
const num = value => (Number.isFinite(value) ? value.toLocaleString(LANG) : '—');
const ms = value => (Number.isFinite(value) ? `${Math.round(value)} ms` : '—');

function detailSecondPart(health, cluster) {
    if (!cluster) return T.updateServer;
    if (isPartial(cluster)) return fill(T.partialWorkers, { a: cluster.reportingWorkers, b: cluster.totalWorkers });
    return fill(T.uptime, { up: formatUptime(health.uptime) });
}

function detailFor(health, cluster) {
    const second = detailSecondPart(health, cluster);
    return `${clock(new Date(health.timestamp || Date.now()))} · ${second}`;
}

/** Cifras principales; sin `cluster` (servidor antiguo) se muestra «—» antes que un dato de un solo worker. */
function figuresFor(health, cluster) {
    return [
        { value: num(cluster?.players), label: T.players },
        { value: num(cluster?.games), label: T.games },
        { value: ms(health.database?.latencyMs), label: T.db },
        { value: num(health.workers?.active), label: T.workers }
    ];
}

function extrasFor(cluster) {
    return [
        { value: num(cluster?.lobbies), label: T.lobbies },
        { value: Number.isFinite(cluster?.rssMB) ? `${cluster.rssMB} MB` : '—', label: T.ram },
        { value: num(cluster?.requestsPerMinute), label: T.reqMin }
    ];
}

function buildView(health) {
    const deps = dependencyList(health);
    const cluster = health.cluster || null;
    const tone = overallTone(health, cluster);
    return {
        tone,
        mascotKey: tone,
        headline: headlineFor(health, deps, cluster),
        detail: detailFor(health, cluster),
        shortDetail: clock(new Date(health.timestamp || Date.now())),
        figures: figuresFor(health, cluster),
        extras: extrasFor(cluster),
        deps,
        dimmed: false
    };
}

/** Motivo corto y traducido en lugar del texto técnico de iOS o del servidor. */
function failureReason(err) {
    // El login responde 403 con este código si la cuenta no ha aceptado los términos vigentes
    if (err.serverCode === 'TERMS_ACCEPTANCE_REQUIRED') return T.termsRequired;
    if (err.status === 401 || err.status === 403) return T.reasonSession;
    return err.status ? T.reasonServer : T.reasonNetwork;
}

function buildStaleView(cached, err) {
    const minutes = Math.max(1, Math.round((Date.now() - cached.savedAt) / 60000));
    const ago = fill(T.ago, { n: minutes });
    const time = clock(new Date(cached.health.timestamp || cached.savedAt));
    return {
        ...buildView(cached.health),
        tone: 'offline',
        mascotKey: 'offline',
        headline: T.stale,
        detail: `${fill(T.lastRead, { time, ago })} · ${failureReason(err)}`,
        shortDetail: ago,
        dimmed: true
    };
}

/** Titular y detalle de un fallo sin datos guardados: qué pasa arriba, qué hacer debajo. */
function errorTexts(err) {
    if (err.serverCode === 'TERMS_ACCEPTANCE_REQUIRED') return [T.termsTitle, T.termsRequired];
    if (err.status) return [failureReason(err), `HTTP ${err.status}`];
    return [T.noConnection, T.reasonNetwork];
}

function buildErrorView(err) {
    const needAccount = err.code === 'NEED_ACCOUNT';
    // Dentro de la app ya estás en Scriptable: solo falta volver a ejecutarlo y dar la cuenta
    const accountHint = config.runsInWidget ? T.openApp : T.rerunForAccount;
    const [headline, detail] = needAccount ? [T.needAccount, accountHint] : errorTexts(err);
    return {
        tone: 'error',
        // La cuenta falta o tiene términos pendientes: hay algo que hacer, el camaleón señala
        mascotKey: needAccount || err.serverCode === 'TERMS_ACCEPTANCE_REQUIRED' ? 'account' : 'error',
        headline,
        detail,
        shortDetail: detail,
        figures: [],
        extras: [],
        deps: [],
        dimmed: false
    };
}

// ===== Dibujo =====

const STATUS_SYMBOLS = {
    ok: 'checkmark.circle.fill',
    warn: 'exclamationmark.circle.fill',
    error: 'xmark.circle.fill',
    offline: 'clock.arrow.circlepath'
};

function addText(stack, text, { font, color = PALETTE.ink, lines = 1, opacity = 1 }) {
    const node = stack.addText(text);
    node.font = font;
    node.textColor = color;
    node.lineLimit = lines;
    node.minimumScaleFactor = 0.7;
    node.textOpacity = opacity;
    return node;
}

function addStatusSymbol(stack, tone, size, color = PALETTE[tone]) {
    // Forma además de color: el estado se distingue sin ver el tono
    const image = stack.addImage(SFSymbol.named(STATUS_SYMBOLS[tone] || STATUS_SYMBOLS.warn).image);
    image.imageSize = new Size(size, size);
    image.tintColor = color;
}

/** Mascota del estado o, si no se pudo descargar, el símbolo SF equivalente. */
function addStatusMark(stack, view, size) {
    if (!view.mascot) return addStatusSymbol(stack, view.tone, size * 0.6);
    const image = stack.addImage(view.mascot);
    image.imageSize = new Size(size, size);
    // Las mascotas no son cuadradas (p. ej. dizzy es 233×192): encajar sin deformar
    image.applyFittingContentMode();
    return image;
}

function headlineColor(view) {
    return view.tone === 'ok' ? PALETTE.ink : PALETTE[view.tone];
}

function addHeader(widget, view, { headlineSize, markSize, showBrand }) {
    const row = widget.addStack();
    row.centerAlignContent();
    addStatusMark(row, view, markSize);
    row.addSpacer(8);
    addText(row, view.headline, { font: Font.boldRoundedSystemFont(headlineSize), color: headlineColor(view) });
    row.addSpacer();
    if (showBrand) addText(row, 'Xiro!', { font: Font.boldRoundedSystemFont(13), color: PALETTE.brand });
}

function addLine(widget, text, lines = 1) {
    addText(widget.addStack(), text, { font: Font.regularSystemFont(13), color: PALETTE.muted, lines });
}

function addFigureRow(widget, figures, { valueSize, opacity }) {
    const row = widget.addStack();
    figures.forEach((figure, index) => {
        if (index > 0) row.addSpacer();
        const cell = row.addStack();
        cell.layoutVertically();
        addText(cell, figure.value, { font: Font.boldRoundedSystemFont(valueSize), opacity });
        addText(cell, figure.label, { font: Font.regularSystemFont(12), color: PALETTE.muted, opacity });
    });
}

function depStatusText(dep) {
    if (dep.status === 'healthy') return ms(dep.latencyMs);
    return dep.status === 'unhealthy' ? T.noResponse : T.slow;
}

function addDependencyList(widget, view) {
    view.deps.forEach(dep => {
        widget.addSpacer(6);
        const row = widget.addStack();
        row.centerAlignContent();
        const tone = view.dimmed ? 'offline' : toneFor(dep.status);
        addStatusSymbol(row, tone, 13);
        row.addSpacer(6);
        addText(row, dep.name, { font: Font.regularSystemFont(14) });
        row.addSpacer();
        addText(row, depStatusText(dep), { font: Font.mediumSystemFont(14), color: PALETTE.muted });
    });
}

function baseWidget() {
    const widget = new ListWidget();
    widget.backgroundColor = PALETTE.background;
    widget.setPadding(14, 14, 14, 14);
    widget.url = detailUrl();
    widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000);
    return widget;
}

const opacityOf = view => (view.dimmed ? 0.5 : 1);

/** Pequeño: camaleón arriba y titular debajo; en una misma fila el titular se encogía a ~10 pt. */
function createSmallWidget(view) {
    const widget = baseWidget();
    addStatusMark(widget.addStack(), view, 32);
    widget.addSpacer(6);
    addText(widget, view.headline, { font: Font.boldRoundedSystemFont(15), color: headlineColor(view), lines: 2 });
    widget.addSpacer();
    if (view.figures.length) addFigureRow(widget, view.figures.slice(0, 2), { valueSize: 22, opacity: opacityOf(view) });
    // Sin pie cuando todo es reciente: con titular de 2 líneas no cabría en ~158 pt de alto
    if (view.figures.length && !view.dimmed) return widget;
    widget.addSpacer(4);
    if (view.figures.length) addLine(widget, view.shortDetail);
    else addLine(widget, view.detail, 3);
    return widget;
}

/** Cabecera y detalle comunes a mediano y grande. */
function addSummary(widget, view) {
    addHeader(widget, view, { headlineSize: 17, markSize: 34, showBrand: true });
    widget.addSpacer(4);
    addLine(widget, view.detail);
}

function createMediumWidget(view) {
    if (!view.figures.length) return createMediumErrorWidget(view);
    const widget = baseWidget();
    addSummary(widget, view);
    widget.addSpacer();
    addFigureRow(widget, view.figures, { valueSize: 26, opacity: opacityOf(view) });
    return widget;
}

/** Error en mediano: camaleón grande a la izquierda y titular con la solución al lado, sin media tarjeta vacía. */
function createMediumErrorWidget(view) {
    const widget = baseWidget();
    widget.addSpacer();
    const row = widget.addStack();
    row.centerAlignContent();
    addStatusMark(row, view, 56);
    row.addSpacer(12);
    const text = row.addStack();
    text.layoutVertically();
    addText(text, view.headline, { font: Font.boldRoundedSystemFont(17), color: headlineColor(view) });
    text.addSpacer(2);
    addText(text, view.detail, { font: Font.regularSystemFont(13), color: PALETTE.muted, lines: 2 });
    row.addSpacer();
    widget.addSpacer();
    const brand = widget.addStack();
    brand.addSpacer();
    addText(brand, 'Xiro!', { font: Font.boldRoundedSystemFont(13), color: PALETTE.brand });
    return widget;
}

/** Centra un elemento en horizontal dentro del widget. */
function centeredRow(widget) {
    const row = widget.addStack();
    row.addSpacer();
    const inner = row.addStack();
    row.addSpacer();
    return inner;
}

/** Error en tamaño grande: mascota, titular y cómo resolverlo, centrados en lugar de un widget vacío. */
function createLargeErrorWidget(view) {
    const widget = baseWidget();
    widget.addSpacer();
    addStatusMark(centeredRow(widget), view, 96);
    widget.addSpacer(12);
    addText(centeredRow(widget), view.headline, { font: Font.boldRoundedSystemFont(20), color: headlineColor(view) });
    widget.addSpacer(4);
    const detail = addText(centeredRow(widget), view.detail, { font: Font.regularSystemFont(15), color: PALETTE.muted, lines: 2 });
    detail.centerAlignText();
    widget.addSpacer();
    addText(centeredRow(widget), 'Xiro!', { font: Font.boldRoundedSystemFont(13), color: PALETTE.brand });
    return widget;
}

/** Grande: resumen y cifras arriba con espacios fijos; dependencias y extras anclados abajo. */
function createLargeWidget(view) {
    if (!view.figures.length) return createLargeErrorWidget(view);
    const widget = baseWidget();
    addSummary(widget, view);
    widget.addSpacer(16);
    addFigureRow(widget, view.figures, { valueSize: 26, opacity: opacityOf(view) });
    widget.addSpacer();
    addDependencyList(widget, view);
    widget.addSpacer(16);
    addFigureRow(widget, view.extras, { valueSize: 20, opacity: opacityOf(view) });
    return widget;
}

// Pantalla de bloqueo: iOS pinta el fondo y tiñe el contenido, así que solo texto e iconos en blanco
function accessoryPlayers(view) {
    return view.figures[0]?.value || '—';
}

function createAccessoryWidget(view, family) {
    const widget = new ListWidget();
    widget.url = detailUrl();
    const white = Color.white();
    if (family === 'accessoryInline') {
        addText(widget, `${view.headline} · ${accessoryPlayers(view)}`, { font: Font.regularSystemFont(13), color: white });
    } else if (family === 'accessoryCircular') {
        addStatusSymbol(centeredRow(widget), view.tone, 18, white);
        addText(centeredRow(widget), accessoryPlayers(view), { font: Font.boldRoundedSystemFont(16), color: white });
    } else {
        addText(widget, view.headline, { font: Font.boldRoundedSystemFont(14), color: white });
        addText(widget, `${accessoryPlayers(view)} ${T.players}`, { font: Font.regularSystemFont(13), color: white });
    }
    return widget;
}

function createWidget(view, family) {
    if (family.startsWith('accessory')) return createAccessoryWidget(view, family);
    if (family === 'small') return createSmallWidget(view);
    if (family === 'large' || family === 'extraLarge') return createLargeWidget(view);
    return createMediumWidget(view);
}

// End of file
