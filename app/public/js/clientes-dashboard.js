const RAW = [
  { u: 'costello1291', n: 'Brian Costello', e: 'briancostello1998@hotmail.com', b: true, f: 628, fw: 7331, c: '', w: '' },
  { u: 'accionemprendedoratucuman', n: 'Emprender en Tucumán', e: 'accionemprendedora.tucuman@gmail.com', b: false, f: 11326, fw: 934, c: '', w: '' },
  { u: 'thedyslexicpower_', n: 'Aitana Garcia Campo', e: 'aitagga02@gmail.com', b: false, f: 239, fw: 97, c: '', w: 'thedyslexicpower.com' },
  { u: 'e.music31', n: 'e.music31', e: 'alma2222@hotmail.com', b: false, f: 274, fw: 571, c: '', w: '' },
  { u: 'r.ayesa.formacion', n: 'Rocio Ayesa', e: 'ayesarodriguez@gmail.com', b: true, f: 535, fw: 1267, c: 'Spain', w: 'rocioayesa.com' },
  { u: 'domagamer2763', n: 'DomaGamer2763', e: 'cherifiadem820@gmail.com', b: false, f: 357, fw: 4427, c: '', w: '' },
  { u: 'prepa_mentale__coach_pro', n: 'Francine RIDOYNAUTH', e: 'contact@culture-flow-coaching.com', b: true, f: 268, fw: 1369, c: 'Bordeaux, France', w: '' },
  { u: 'figurewtf', n: 'figurewtf', e: 'contact@figure.wtf', b: true, f: 13, fw: 20, c: '', w: '' },
  { u: 'e_maluk', n: 'Юлия Малюк', e: 'e-nkova@mail.ru', b: true, f: 654, fw: 369, c: '', w: '' },
  { u: 'eduverse_leaders', n: 'EduVerse Leaders', e: 'eduverse31@gmail.com', b: true, f: 6, fw: 68, c: '', w: '' },
  { u: 'electro_sanrafael', n: 'Electro San Rafael', e: 'gastonordu96@gmail.com', b: true, f: 889, fw: 1888, c: 'San Rafael, Mendoza', w: '' },
  { u: 'zimnova', n: 'очень даже', e: 'i1239874560@gmail.com', b: true, f: 671, fw: 349, c: '', w: '' },
  { u: 'imperfectprimary', n: 'Melanie Ms. Hwang', e: 'imperfectprimary@gmail.com', b: false, f: 8149, fw: 1956, c: 'Ontario, Canada', w: '' },
  { u: 'adventurousclub_', n: 'Adventurous Club', e: 'info@adventurousclub.com', b: true, f: 2938, fw: 29, c: '', w: 'adventurousclub.com' },
  { u: 'ysolina.nomadikos', n: 'Ysolina Nomadikos', e: 'info@nomadikosviajes.com', b: false, f: 5447, fw: 3178, c: '', w: '' },
  { u: 'tnonlinepublicschool', n: 'Tennessee Online Public School', e: 'info@tops.education', b: true, f: 25, fw: 54, c: '', w: '' },
  { u: 'jkmachtalles', n: 'Jasmin Koch', e: 'jassikocher@gmail.com', b: true, f: 587, fw: 1018, c: 'Einbeck, Germany', w: '' },
  { u: 'cecedupraz', n: 'Cece DuPraz', e: 'jennifer@cecedupraz.com', b: true, f: 13675, fw: 5166, c: '', w: 'cecedupraz.com' },
  { u: 'karissavorbach', n: 'Karissa V', e: 'karissajvb@gmail.com', b: false, f: 452, fw: 1724, c: '', w: '' },
  { u: 'tiakezia.alfaeducar', n: 'Professora Kezia', e: 'keziatata76@gmail.com', b: false, f: 5920, fw: 909, c: '', w: '' },
  { u: 'miss.k.khan', n: 'Miss Khan', e: 'kiranranikhan@gmail.com', b: true, f: 861, fw: 403, c: '', w: '' },
  { u: 'lilivogelsang', n: 'Lili', e: 'lilicurious@friendswithbusiness.de', b: false, f: 27178, fw: 978, c: '', w: '' },
  { u: 'maddyandersonmusic', n: 'Maddy Anderson', e: 'mad_life6@yahoo.com', b: false, f: 34839, fw: 5367, c: '', w: '' },
  { u: 'mary_costa', n: 'Marilia Costa', e: 'mariliacosta3@gmail.com', b: false, f: 5941, fw: 966, c: '', w: '' },
  { u: 'neo_rodriguess', n: 'Neo Silva', e: 'nortecoach@gmail.com', b: false, f: 2033, fw: 1265, c: '', w: '' },
  { u: 'pearllearningmaterials', n: 'Pearl SEN', e: 'pearl.englishteacher1981@gmail.com', b: false, f: 9166, fw: 400, c: '', w: '' },
  { u: 'neuropsi.riviany', n: 'Riviany Almeida', e: 'rivianyalmeida@gmail.com', b: false, f: 3802, fw: 2141, c: '', w: '' },
  { u: 'reyesvargasrosa', n: 'Rosalina Reyes', e: 'rosalinareyes2010@hotmail.com', b: true, f: 1207, fw: 2725, c: 'Loma de Cabrera', w: '' },
  { u: 'ruchita_rk2', n: 'Ruchita Jagzap', e: 'ruchita@rk2.in', b: true, f: 727, fw: 1006, c: '', w: '' },
  { u: 'thenurcam', n: 'Nur Çam', e: 's45nur@gmail.com', b: false, f: 1839, fw: 5430, c: '', w: '' },
  { u: 'sponselomedia', n: 'Sponselo Media', e: 'sponselomedia@gmail.com', b: true, f: 11, fw: 111, c: '', w: '' },
  { u: 'stickiepickie', n: 'StickiePickie', e: 'stickiepickie2025@gmail.com', b: true, f: 1424, fw: 12, c: 'Delhi, India', w: '' },
  { u: 'haciendatepepan', n: 'Hacienda Tepepan', e: 'tepepanhacienda@gmail.com', b: false, f: 539, fw: 90, c: '', w: '' },
  { u: 'thediscountteacher', n: 'Kate Teacher Deals', e: 'thediscountteacher@gmail.com', b: false, f: 56241, fw: 871, c: '', w: '' },
  { u: 'brittanyjeltema', n: 'The Superhero Teacher', e: 'thesuperheroteacher@hotmail.com', b: true, f: 173301, fw: 3457, c: '', w: 'skool.com/thesuperheroteacher' },
  { u: 'veroramirez_weddingsandevents', n: 'VR Weddings', e: 'vr.weddingsandevents@gmail.com', b: true, f: 750, fw: 1744, c: '', w: '' },
  { u: 'wafflestowine', n: 'Waffles to Wine', e: 'wafflestowine@gmail.com', b: false, f: 18323, fw: 4426, c: '', w: '' },
  { u: 'pelulan_macrame', n: 'pelulan macrame', e: 'zamzamhanig69@gmail.com', b: true, f: 50, fw: 310, c: '', w: '' },
];

const DATA = Object.values(RAW.reduce((acc, r) => { acc[r.u] = r; return acc; }, {}));

const PALETTES = [
  ['#7c5cfc', '#5b3dd1'], ['#c084fc', '#9333ea'], ['#38bdf8', '#0284c7'],
  ['#fb7185', '#e11d48'], ['#34d399', '#059669'], ['#fbbf24', '#d97706'],
  ['#f472b6', '#db2777'], ['#a78bfa', '#7c3aed'], ['#22d3ee', '#0891b2'],
  ['#4ade80', '#16a34a'], ['#f97316', '#ea580c'], ['#e879f9', '#a21caf'],
];

function palette(username) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) & 0xffffffff;
  return PALETTES[Math.abs(h) % PALETTES.length];
}

function initials(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmt(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function buildStats() {
  const total = DATA.length;
  const totalFollowers = DATA.reduce((s, r) => s + r.f, 0);
  const business = DATA.filter(r => r.b).length;
  const avg = Math.round(totalFollowers / total);

  document.getElementById('statsRow').innerHTML =
    '<div class="stat"><span class="stat-val">' + total + '</span><span class="stat-lbl">Contactos</span></div>' +
    '<div class="stat"><span class="stat-val">' + fmt(totalFollowers) + '</span><span class="stat-lbl">Seguidores totales</span></div>' +
    '<div class="stat"><span class="stat-val">' + Math.round(business / total * 100) + '%</span><span class="stat-lbl">Business</span></div>' +
    '<div class="stat"><span class="stat-val">' + fmt(avg) + '</span><span class="stat-lbl">Media seguidores</span></div>';
}

function buildChart() {
  const top10 = [...DATA].sort((a, b) => b.f - a.f).slice(0, 10);
  const max = top10[0].f;
  document.getElementById('chart').innerHTML = top10.map(function (r) {
    const c1 = palette(r.u)[0];
    const pct = (r.f / max * 100).toFixed(1);
    return '<div class="chart-item">' +
      '<div class="chart-label">' +
      '<span class="chart-name">' + r.n + '</span>' +
      '<span class="chart-val">' + fmt(r.f) + '</span>' +
      '</div>' +
      '<div class="chart-bar-bg">' +
      '<div class="chart-bar-fill" style="width:' + pct + '%;background:linear-gradient(90deg,' + c1 + ',var(--accent2))"></div>' +
      '</div>' +
      '</div>';
  }).join('');
}

function buildDonut() {
  const business = DATA.filter(r => r.b).length;
  const personal = DATA.length - business;
  const canvas = document.getElementById('donut');
  const ctx = canvas.getContext('2d');
  const total = business + personal;
  const bAngle = (business / total) * Math.PI * 2;
  const cx = 40, cy = 40, r = 32, inner = 20;

  ctx.clearRect(0, 0, 80, 80);

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#38bdf820';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + bAngle);
  ctx.fillStyle = '#7c5cfc';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, -Math.PI / 2 + bAngle, -Math.PI / 2 + Math.PI * 2);
  ctx.fillStyle = '#38bdf8';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1729';
  ctx.fill();

  document.getElementById('donutLegend').innerHTML =
    '<div class="legend-item"><div class="legend-dot" style="background:#7c5cfc"></div><span class="legend-val">' + business + '</span><span class="legend-lbl">Business</span></div>' +
    '<div class="legend-item"><div class="legend-dot" style="background:#38bdf8"></div><span class="legend-val">' + personal + '</span><span class="legend-lbl">Personal</span></div>';
}

function cardHTML(r, idx) {
  const pal = palette(r.u);
  const c1 = pal[0], c2 = pal[1];
  const ini = initials(r.n);
  let links = '';
  if (r.e) links +=
    '<a class="card-link" href="mailto:' + r.e + '">' +
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>' +
    r.e + '</a>';
  if (r.c) links +=
    '<span class="card-link">' +
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>' +
    r.c + '</span>';
  if (r.w) links +=
    '<a class="card-link" href="https://' + r.w + '" target="_blank" rel="noopener">' +
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
    r.w + '</a>';

  const ratioColor = r.f > r.fw ? '#34d399' : '#fb7185';
  const ratio = r.fw > 0 ? (r.f / r.fw).toFixed(2) : '∞';

  return '<div class="card" style="--accent-card:' + c1 + ';animation-delay:' + (idx * 30) + 'ms">' +
    '<div class="card-header">' +
    '<div class="avatar" style="background:linear-gradient(135deg,' + c1 + ',' + c2 + ')">' + ini + '</div>' +
    '<div class="card-names">' +
    '<div class="card-name">' + r.n + '</div>' +
    '<div class="card-username">@' + r.u + '</div>' +
    '</div>' +
    '<div class="badge ' + (r.b ? 'badge-business' : 'badge-personal') + '">' + (r.b ? 'Business' : 'Personal') + '</div>' +
    '</div>' +
    '<div class="card-metrics">' +
    '<div class="metric"><span class="metric-val">' + fmt(r.f) + '</span><span class="metric-lbl">Seguidores</span></div>' +
    '<div class="metric"><span class="metric-val">' + fmt(r.fw) + '</span><span class="metric-lbl">Siguiendo</span></div>' +
    '<div class="metric"><span class="metric-val" style="color:' + ratioColor + '">' + ratio + '</span><span class="metric-lbl">Ratio</span></div>' +
    '</div>' +
    (links ? '<div class="card-links">' + links + '</div>' : '') +
    '</div>';
}

let currentFilter = 'all';
let currentSort = 'followers-desc';
let currentSearch = '';

function render() {
  let data = [...DATA];

  if (currentFilter === 'business') data = data.filter(r => r.b);
  if (currentFilter === 'personal') data = data.filter(r => !r.b);

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    data = data.filter(r =>
      r.n.toLowerCase().includes(q) ||
      r.u.toLowerCase().includes(q) ||
      r.e.toLowerCase().includes(q)
    );
  }

  if (currentSort === 'followers-desc') data.sort((a, b) => b.f - a.f);
  else if (currentSort === 'followers-asc') data.sort((a, b) => a.f - b.f);
  else if (currentSort === 'name-asc') data.sort((a, b) => a.n.localeCompare(b.n));
  else if (currentSort === 'name-desc') data.sort((a, b) => b.n.localeCompare(a.n));

  document.getElementById('resultCount').innerHTML =
    _tHtml('Mostrando <span>' + data.length + '</span> de <span>' + DATA.length + '</span> contactos');

  const grid = document.getElementById('grid');
  if (data.length === 0) {
    grid.innerHTML =
      '<div class="empty">' +
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
      '<div>Sin resultados para "<strong>' + currentSearch + '</strong>"</div>' +
      '</div>';
    return;
  }

  grid.innerHTML = _tHtml(data.map(function (r, i) { return cardHTML(r, i); }).join(''));
}

document.getElementById('search').addEventListener('input', function (e) {
  currentSearch = e.target.value.trim();
  render();
});

document.querySelectorAll('.filter-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

document.getElementById('sort').addEventListener('change', function (e) {
  currentSort = e.target.value;
  render();
});

buildStats();
buildChart();
buildDonut();
render();
