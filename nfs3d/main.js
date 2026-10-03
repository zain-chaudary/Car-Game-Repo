/* ================================================================
   PAYBACK RUSH — Step 1 (premium UI build)
   Home / hub / garage (buy·select·upgrade) / career / settings / exit
   + $ economy, saves, cinematic backgrounds, parallax.
   ================================================================ */
'use strict';

/* ------------------------- DATA ------------------------- */
const CARS = [
  {
    id: 'falcon', name: 'FALCON GT', klass: 'STREET', price: 0,
    art: 'assets/car_falcon.png',
    base: { speed: 262, accel: 6.8, handling: 58, nitro: 45, brakes: 55 },
    desc: 'The street coupe that started it all. Honest power, honest money. Tune it and it bites.',
  },
  {
    id: 'vortex', name: 'VORTEX R', klass: 'SUPER', price: 12000,
    art: 'assets/car_vortex.png',
    base: { speed: 318, accel: 5.2, handling: 76, nitro: 70, brakes: 70 },
    desc: 'Track-bred supercar with active aero. Locked — until you can pay.',
  },
];

const UPGRADES = [
  { id: 'engine', name: 'ENGINE', desc: '+12 km/h / stage', cost: [700, 1200, 1900, 2800, 4000],
    ico: '<path d="M8 3h8v4H8zM5 7h14v6H5zM10 13h4v4h-4zM8 17h8v4H8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' },
  { id: 'tires', name: 'TIRES', desc: '+5 handling / stage', cost: [500, 900, 1500, 2200, 3200],
    ico: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 3.5V9M12 15v5.5M3.5 12H9M15 12h5.5" stroke="currentColor" stroke-width="1.5"/>' },
  { id: 'nitro', name: 'NITRO KIT', desc: '+6 nitro / stage', cost: [600, 1000, 1600, 2400, 3500],
    ico: '<path d="M13 2 5 13h5l-2 9 8-11h-5l2-9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' },
  { id: 'brakes', name: 'BRAKES', desc: '+4 braking / stage', cost: [400, 800, 1300, 2000, 2900],
    ico: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 6.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" stroke-width="2"/>' },
];
const MAX_LEVEL = 5;

const RACES = [
  { id: 'sunset', name: 'SUNSET STRIP SPRINT', map: 'DOWNTOWN COAST', dist: '2.4 KM', difficulty: 2, reward: 1500 },
];

const BG_OF = {
  'screen-home': 'bg-home', 'screen-hub': 'bg-home', 'screen-settings': 'bg-home',
  'screen-exit': 'bg-home', 'screen-garage': 'bg-garage', 'screen-career': 'bg-career',
};

/* ------------------------- SAVE / SETTINGS ------------------------- */
const SAVE_KEY = 'payback_rush_save_v1';
const SETTINGS_KEY = 'payback_rush_settings_v1';

/* localStorage can throw inside sandboxed iframes — keep a memory fallback. */
const memStore = {};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return (k in memStore) ? memStore[k] : null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { memStore[k] = v; } },
  remove(k) { try { localStorage.removeItem(k); } catch (e) { delete memStore[k]; } },
};

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(store.get(key));
    return (v === null || v === undefined) ? fallback : v;
  } catch (e) { return fallback; }
}
function freshSave() {
  return { cash: 5000, owned: ['falcon'], selected: 'falcon', upgrades: { falcon: {} }, wins: 0 };
}
let save = loadJSON(SAVE_KEY, null);
let settings = loadJSON(SETTINGS_KEY, { quality: 'high', sound: true });

function persist() { if (save) store.set(SAVE_KEY, JSON.stringify(save)); }
function persistSettings() { store.set(SETTINGS_KEY, JSON.stringify(settings)); }

const carById = id => CARS.find(c => c.id === id);
const lvl = (carId, upId) =>
  (save && save.upgrades[carId] && save.upgrades[carId][upId]) || 0;

function effStats(car) {
  const b = car.base;
  const e = lvl(car.id, 'engine'), t = lvl(car.id, 'tires'),
        n = lvl(car.id, 'nitro'), k = lvl(car.id, 'brakes');
  return {
    speed: b.speed + e * 12,
    accel: Math.max(2.8, b.accel - e * 0.18),
    handling: Math.min(100, b.handling + t * 5),
    nitro: Math.min(100, b.nitro + n * 6),
    brakes: Math.min(100, b.brakes + k * 4),
  };
}

/* ------------------------- UI HELPERS ------------------------- */
const $ = s => document.querySelector(s);
const fmtCash = n => '$' + Math.round(n).toLocaleString('en-US');

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

function showModal(title, body, actions) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = body;
  const box = $('#modal-actions');
  box.innerHTML = '';
  actions.forEach(a => {
    const b = document.createElement('button');
    b.className = 'act' + (a.primary ? ' primary' : '');
    b.textContent = a.label;
    b.onclick = () => { $('#modal').classList.add('hidden'); if (a.cb) a.cb(); };
    box.appendChild(b);
  });
  $('#modal').classList.remove('hidden');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $('#' + id).classList.remove('hidden');
  $('#topbar').classList.toggle('hidden', id === 'screen-home' || id === 'screen-exit');
  const bgId = BG_OF[id] || 'bg-home';
  document.querySelectorAll('.bg').forEach(b =>
    b.classList.toggle('active', b.id === bgId));
  updateTopbar();
}
function updateTopbar() {
  $('#cash').textContent = save ? fmtCash(save.cash) : '$—';
}

/* ------------------------- GARAGE UI ------------------------- */
let previewCarId = null;

function openGarage() {
  previewCarId = save.selected;
  renderGarage();
  showScreen('screen-garage');
}

const LOCK_SVG = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6z" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

function renderGarage() {
  const car = carById(previewCarId);
  const owned = save.owned.includes(car.id);
  const st = effStats(car);

  /* hero art */
  const art = $('#car-art');
  if (art.dataset.car !== car.id) {
    art.dataset.car = car.id;
    art.src = car.art;
    art.style.animation = 'none';
    void art.offsetWidth;               /* restart entrance animation */
    art.style.animation = '';
  }
  $('#car-name').textContent = car.name;
  $('#car-class').textContent = car.klass + ' CLASS';
  $('#car-desc').textContent = car.desc;

  /* car select tabs */
  const list = $('#car-list');
  list.innerHTML = '';
  CARS.forEach(c => {
    const has = save.owned.includes(c.id);
    const card = document.createElement('button');
    card.className = 'car-card' + (c.id === previewCarId ? ' active' : '') + (has ? '' : ' lockedcard');
    card.innerHTML =
      '<img src="' + c.art + '" alt="' + c.name + '">' +
      (has ? '' : '<span class="lock-ico">' + LOCK_SVG + '</span>') +
      '<div class="cc-name">' + c.name + '</div>' +
      '<div class="cc-sub">' +
      (has
        ? '<span class="owned">OWNED' + (save.selected === c.id ? ' · SELECTED' : '') + '</span>'
        : '<span class="locked">LOCKED · ' + fmtCash(c.price) + '</span>') +
      '</div>';
    card.onclick = () => { previewCarId = c.id; renderGarage(); };
    list.appendChild(card);
  });

  /* spec bars */
  const specs = [
    ['TOP SPEED', st.speed + ' km/h', st.speed / 360 * 100],
    ['0-100 KM/H', st.accel.toFixed(1) + ' s', (8 - st.accel) / 5.2 * 100],
    ['HANDLING', st.handling + ' / 100', st.handling],
    ['NITRO', st.nitro + ' / 100', st.nitro],
    ['BRAKES', st.brakes + ' / 100', st.brakes],
  ];
  $('#spec-bars').innerHTML = specs.map(s =>
    '<div class="spec"><div class="row"><span>' + s[0] + '</span><b>' + s[1] + '</b></div>' +
    '<div class="bar"><div class="fill" style="width:' + Math.max(4, Math.min(100, s[2])) + '%"></div></div></div>'
  ).join('');

  /* upgrade modules */
  const up = $('#upgrade-list');
  up.innerHTML = '';
  UPGRADES.forEach(u => {
    const level = lvl(car.id, u.id);
    const maxed = level >= MAX_LEVEL;
    const cost = maxed ? 0 : u.cost[level];
    const row = document.createElement('div');
    row.className = 'up-row';
    let pips = '';
    for (let i = 0; i < MAX_LEVEL; i++) pips += '<div class="pip' + (i < level ? ' on' : '') + '"></div>';
    row.innerHTML =
      '<svg class="up-ico" viewBox="0 0 24 24">' + u.ico + '</svg>' +
      '<div class="up-info"><div class="n">' + u.name + '</div><div class="d">' + u.desc + '</div></div>' +
      '<div class="pips">' + pips + '</div>';
    const btn = document.createElement('button');
    btn.className = 'buy-up' + (maxed ? ' max' : '');
    btn.textContent = maxed ? 'MAX STAGE' : 'INSTALL · ' + fmtCash(cost);
    btn.disabled = maxed || !owned || save.cash < cost;
    btn.onclick = () => buyUpgrade(car, u);
    row.appendChild(btn);
    up.appendChild(row);
  });

  /* actions */
  const sel = $('#btn-select');
  const buy = $('#btn-buy');
  if (owned) {
    buy.classList.add('hidden');
    sel.classList.remove('hidden');
    sel.textContent = save.selected === car.id ? 'SELECTED ✓' : 'SELECT';
    sel.disabled = save.selected === car.id;
    sel.onclick = () => {
      save.selected = car.id; persist();
      toast(car.name + ' SELECTED');
      renderGarage();
    };
  } else {
    sel.classList.add('hidden');
    buy.classList.remove('hidden');
    buy.textContent = 'BUY · ' + fmtCash(car.price);
    buy.disabled = save.cash < car.price;
    buy.onclick = () => {
      save.cash -= car.price;
      save.owned.push(car.id);
      save.upgrades[car.id] = save.upgrades[car.id] || {};
      persist();
      toast(car.name + ' PURCHASED!');
      renderGarage();
    };
  }
  updateTopbar();
}

function buyUpgrade(car, u) {
  const level = lvl(car.id, u.id);
  if (level >= MAX_LEVEL) return;
  const cost = u.cost[level];
  if (save.cash < cost) { toast('NOT ENOUGH CASH'); return; }
  save.cash -= cost;
  save.upgrades[car.id] = save.upgrades[car.id] || {};
  save.upgrades[car.id][u.id] = level + 1;
  persist();
  toast(u.name + ' → STAGE ' + (level + 1));
  renderGarage();
}

/* ------------------------- CAREER UI ------------------------- */
function renderCareer() {
  const list = $('#race-list');
  list.innerHTML = '';
  RACES.forEach(r => {
    const stars = '◆'.repeat(r.difficulty) + '◇'.repeat(3 - r.difficulty);
    const card = document.createElement('div');
    card.className = 'race-card';
    card.innerHTML =
      '<div><div class="rc-name">' + r.name + '</div>' +
      '<div class="rc-meta">MAP: ' + r.map + ' · ' + r.dist + ' · <span class="reward">REWARD ' +
      fmtCash(r.reward) + '</span></div></div>' +
      '<div style="text-align:right"><div class="stars">' + stars + '</div>' +
      '<button class="act primary" style="margin-top:10px;flex:0 0 auto;padding:11px 26px">START RACE</button></div>';
    card.querySelector('button').onclick = () => showModal(
      r.name,
      'The race engine for <b>' + r.map + '</b> is being built in <b>Step 2</b>.<br>' +
      'Winning will pay <b>' + fmtCash(r.reward) + '</b> — every race earns cash.',
      [{ label: 'OK', primary: true }]
    );
    list.appendChild(card);
  });
}

/* ------------------------- SETTINGS UI ------------------------- */
function renderSettings() {
  document.querySelectorAll('#quality-seg button').forEach(b =>
    b.classList.toggle('on', b.dataset.q === settings.quality));
  document.querySelectorAll('#sound-seg button').forEach(b =>
    b.classList.toggle('on', (b.dataset.s === 'on') === settings.sound));
}

/* ------------------------- NAV WIRING ------------------------- */
function startNewGame() {
  save = freshSave();
  persist();
  updateTopbar();
  showScreen('screen-hub');
  toast('PROFILE CREATED · ' + fmtCash(save.cash));
}

let settingsReturn = 'screen-home';

function wireUI() {
  $('#btn-new').onclick = () => {
    if (save) {
      showModal('NEW GAME', 'This overwrites your current profile. Continue?', [
        { label: 'CANCEL' },
        { label: 'OVERWRITE', primary: true, cb: startNewGame },
      ]);
    } else startNewGame();
  };
  $('#btn-continue').onclick = () => { if (save) showScreen('screen-hub'); };
  $('#btn-exit').onclick = () => { showScreen('screen-exit'); window.close(); };

  $('#btn-garage').onclick = openGarage;
  $('#btn-career').onclick = () => { renderCareer(); showScreen('screen-career'); };
  $('#btn-hub-back').onclick = () => showScreen('screen-home');
  $('#btn-garage-back').onclick = () => showScreen('screen-hub');
  $('#btn-career-back').onclick = () => showScreen('screen-hub');

  $('#btn-settings').onclick = () => { settingsReturn = 'screen-home'; showScreen('screen-settings'); renderSettings(); };
  $('#btn-hub-settings').onclick = () => { settingsReturn = 'screen-hub'; showScreen('screen-settings'); renderSettings(); };
  $('#btn-settings-back').onclick = () => showScreen(settingsReturn);

  document.querySelectorAll('#quality-seg button').forEach(b => b.onclick = () => {
    settings.quality = b.dataset.q; persistSettings(); renderSettings();
    toast('QUALITY: ' + b.dataset.q.toUpperCase());
  });
  document.querySelectorAll('#sound-seg button').forEach(b => b.onclick = () => {
    settings.sound = b.dataset.s === 'on'; persistSettings(); renderSettings();
  });
  $('#btn-reset').onclick = () => showModal('RESET PROGRESS', 'Delete your profile and start over?', [
    { label: 'CANCEL' },
    {
      label: 'DELETE', primary: true, cb: () => {
        store.remove(SAVE_KEY);
        save = null;
        refreshHome(); updateTopbar();
        toast('PROFILE DELETED');
      },
    },
  ]);
}
function refreshHome() {
  $('#btn-continue').disabled = !save;
}

/* ------------------------- CINEMATICS ------------------------- */
function initFX() {
  /* mouse parallax on background layers */
  window.addEventListener('pointermove', e => {
    const x = e.clientX / innerWidth - 0.5;
    const y = e.clientY / innerHeight - 0.5;
    document.documentElement.style.setProperty('--px', x.toFixed(3));
    document.documentElement.style.setProperty('--py', y.toFixed(3));
  });
  /* hide loader once everything (incl. art) is loaded */
  window.addEventListener('load', () =>
    setTimeout(() => $('#loader').classList.add('done'), 450));
  setTimeout(() => $('#loader').classList.add('done'), 4000); /* fallback */
}

/* ------------------------- BOOT ------------------------- */
wireUI();
refreshHome();
updateTopbar();
initFX();
