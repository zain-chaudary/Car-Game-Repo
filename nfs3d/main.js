/* ================================================================
   PAYBACK RUSH — v0.4 REALISM BUILD
   • Roster: BRUISER V8 + HYPERION GT (your GLB cars — free starters,
     equal modest speed, nitrous locked, $5,000 unlock per car) and
     FALCON GT / VORTEX R as locked premium purchases.
   • Garage: switching limited to cars you OWN (◄ ► / arrows / tabs),
     specs-only default panel, CUSTOMIZATION tab, [1] or click for
     full 3D view (spin only there), realistic light theme.
   • Expensive long-game upgrade economy (up to $350k/stage).
   ================================================================ */
'use strict';

/* ------------------------- CAR ROSTER ------------------------- */
const NITRO_UNLOCK_COST = 5000;

const CARS = [
  {
    id: 'bruiser', name: 'BRUISER V8', klass: 'STREET', price: 0,
    model: 'assets/models/bruiser.glb', swatch: '#52708e',
   flavor: { engine: '5.9L CAST-IRON V8', power: 385, torque: 520, drive: 'RWD', weight: 1610, tyres: '245/45 R17 · SPORT', fuel: 'PETROL · 70 L' },
    factoryFinish: true, nitroLocked: true,
    base: { speed: 185, accel: 7.6, handling: 52, nitro: 40, brakes: 50, aero: 18 },
    desc: 'Steel-blue dockyard bruiser with a cast-iron V8. The league hands these to rookies — make it yours first, then make it fast.',
  },
  {
    id: 'hyperion', name: 'HYPERION GT', klass: 'GT', price: 0,
    model: 'assets/models/hyperion.glb', swatch: '#6d7c33',
   flavor: { engine: '3.8L TWIN-TURBO V6', power: 400, torque: 540, drive: 'RWD', weight: 1480, tyres: '255/35 R18 · SPORT', fuel: 'PETROL · 65 L' },
    factoryFinish: true, nitroLocked: true,
    base: { speed: 185, accel: 7.6, handling: 54, nitro: 40, brakes: 52, aero: 22 },
    desc: 'Olive-green grand tourer. Same rookie pace as the Bruiser — the difference is what you do with it.',
  },
];
const STARTER_IDS = CARS.filter(c => c.price === 0).map(c => c.id);

/* ------------------------- UPGRADE CATALOG (long-game pricing) ------- */
const UPGRADES = [
  { id: 'engine', name: 'ENGINE', tier: 1, desc: '+12 km/h · -0.18s', cost: [1800, 3000, 4800, 7000, 10000],
    gain: { speed: 12, accel: -0.18 }, ico: 'M8 3h8v4H8zM5 7h14v6H5zM10 13h4v4h-4zM8 17h8v4H8z' },
  { id: 'tires', name: 'TIRES', tier: 1, desc: '+5 grip · +2 brakes', cost: [1200, 2200, 3800, 5500, 8000],
    gain: { handling: 5, brakes: 2 }, ico: 'CIRCLE' },
  { id: 'brakes', name: 'BRAKES', tier: 1, desc: '+5 braking', cost: [1000, 2000, 3200, 5000, 7200],
    gain: { brakes: 5 }, ico: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zm0 6a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM12 6.5a5.5 5.5 0 0 1 5.5 5.5' },
  { id: 'nitro', name: 'NITRO KIT', tier: 1, desc: '+7 nitro · needs unlock', cost: [1500, 2500, 4000, 6000, 9000],
    gain: { nitro: 7 }, ico: 'M13 2 5 13h5l-2 9 8-11h-5l2-9z' },
  { id: 'suspension', name: 'SUSPENSION', tier: 2, desc: '+6 grip · +2 aero', cost: [2200, 4000, 6500, 10500, 17000],
    gain: { handling: 6, aero: 2 }, ico: 'M12 2v4M12 18v4M7 6l10 3M17 9 7 12M7 12l10 3M17 15 7 18' },
  { id: 'transmission', name: 'TRANSMISSION', tier: 2, desc: '-0.20s · +2 grip', cost: [2800, 4800, 7800, 12500, 20500],
    gain: { accel: -0.2, handling: 2 }, ico: 'M6 3v8M6 11h12v10M18 3v8M9 21h6' },
  { id: 'turbo', name: 'TURBO', tier: 2, desc: '+14 km/h · -0.14s', cost: [3800, 6500, 10500, 17500, 30000],
    gain: { speed: 14, accel: -0.14 }, ico: 'M12 4a8 8 0 1 1-8 8M12 8v4l3 2' },
  { id: 'weight', name: 'WEIGHT REDUCTION', tier: 3, desc: '-0.14s · +3 grip', cost: [5000, 8800, 15000, 24000, 38000],
    gain: { accel: -0.14, handling: 3 }, ico: 'M4 8h16l-2 12H6zM9 8V5h6v3' },
  { id: 'ecu', name: 'ECU TUNE', tier: 3, desc: '+7 km/h · +3 nitro', cost: [6200, 11200, 18800, 30000, 50000],
    gain: { speed: 7, accel: -0.07, nitro: 3 }, ico: 'M5 5h14v14H5zM9 9h6v6H9zM12 2v3M12 19v3M2 12h3M19 12h3' },
  { id: 'aero', name: 'AERO KIT', tier: 3, desc: '+8 downforce · +2 grip', cost: [7500, 13800, 22500, 35000, 55000],
    gain: { aero: 8, handling: 2 }, ico: 'M3 14c4-6 14-6 18 0M6 14v3M18 14v3M3 14v3' },
  { id: 'supercharger', name: 'SUPERCHARGER', tier: 4, desc: '+20 km/h · -0.10s', cost: [12500, 22500, 37500, 62500, 100000],
    gain: { speed: 20, accel: -0.1 }, ico: 'M12 3 4 12h5l-1 9 8-11h-5l1-7z' },
  { id: 'swap', name: 'ENGINE SWAP', tier: 4, desc: '+35 km/h · -0.40s · ENDGAME', cost: [60000, 95000, 150000, 240000, 350000],
    gain: { speed: 35, accel: -0.4 }, ico: 'M4 7h12l-3-3M20 17H8l3 3M4 7v10M20 17V7' },
];
const MAX_LEVEL = 5;

/* ------------------------- COSMETICS ------------------------- */
const COSMETICS = [
  {
    id: 'paint', name: 'PAINT',
    items: [
      { id: 'stock', name: 'STOCK', hex: null, price: 0 },
      { id: 'cherry', name: 'CHERRY RED', hex: '#b3121f', price: 1500 },
      { id: 'midnight', name: 'MIDNIGHT', hex: '#12204a', price: 2000 },
      { id: 'electric', name: 'STEEL BLUE', hex: '#3f6ea6', price: 2600 },
      { id: 'forest', name: 'FOREST', hex: '#2c5a33', price: 3200 },
      { id: 'pearl', name: 'PEARL WHITE', hex: '#e8ecef', price: 4500 },
      { id: 'matte', name: 'MATTE BLACK', hex: '#17191d', price: 4000 },
      { id: 'gold', name: 'SATIN GOLD', hex: '#c9a23a', price: 6000 },
    ],
  },
  {
    id: 'rims', name: 'RIMS',
    items: [
      { id: 'stock', name: 'STOCK', hex: null, price: 0 },
      { id: 'gunmetal', name: 'GUNMETAL', hex: '#4a5058', price: 1200 },
      { id: 'chrome', name: 'CHROME', hex: '#eef2f8', price: 2600 },
      { id: 'gold', name: 'GOLD SPLIT', hex: '#cfa13f', price: 3400 },
      { id: 'carbon', name: 'CARBON BLACK', hex: '#22242a', price: 4600 },
    ],
  },
  {
    id: 'glow', name: 'UNDERGLOW',
    items: [
      { id: 'off', name: 'OFF', hex: null, price: 0 },
      { id: 'amber', name: 'AMBER', hex: '#ff9f1c', price: 2200 },
      { id: 'cyan', name: 'ICE CYAN', hex: '#20d0ff', price: 2400 },
      { id: 'red', name: 'BLOOD RED', hex: '#ff2030', price: 2600 },
      { id: 'magenta', name: 'MAGENTA', hex: '#ff2fd0', price: 3000 },
      { id: 'ice', name: 'WHITE ICE', hex: '#dff3ff', price: 3800 },
    ],
  },
  {
    id: 'tint', name: 'WINDOW TINT',
    items: [
      { id: 'none', name: 'NONE', hex: null, price: 0, level: 0 },
      { id: 'light', name: 'LIGHT', hex: '#0a0d12', price: 600, level: 1 },
      { id: 'medium', name: 'MEDIUM', hex: '#06080c', price: 1200, level: 2 },
      { id: 'limo', name: 'LIMO', hex: '#000000', price: 2000, level: 3 },
    ],
  },
];
const DEFAULT_LOOK = { paint: 'stock', rims: 'stock', glow: 'off', tint: 'none' };


/* backdrops fetched only when their screen is first opened */
const BG_URLS = { 'bg-garage': 'assets/bg_garage.jpg' };

const BG_OF = {
  'screen-home': 'bg-home', 'screen-hub': 'bg-home', 'screen-settings': 'bg-home',
  'screen-exit': 'bg-home', 'screen-career': 'bg-home',
};

/* ------------------------- SAVE ------------------------- */
const SAVE_KEY = 'payback_rush_save_v3';
const SETTINGS_KEY = 'payback_rush_settings_v1';

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
  const upgrades = {}, equipped = {};
  CARS.forEach(c => { upgrades[c.id] = {}; equipped[c.id] = Object.assign({}, DEFAULT_LOOK); });
  return {
    cash: 5000,
    wins: 0,
    owned: STARTER_IDS.slice(),
    selected: STARTER_IDS[0],
    upgrades,
    equipped,
    cosOwned: ['paint:stock', 'rims:stock', 'glow:off', 'tint:none'],
    nitroUnlocked: {},
  };
}
/* migrate any older save: keep cash/wins/parts, guarantee the starters */
function migrate() {
  for (const key of ['payback_rush_save_v2', 'payback_rush_save_v1']) {
    const old = loadJSON(key, null);
    if (!old) continue;
    const s = freshSave();
    s.cash = typeof old.cash === 'number' ? old.cash : 5000;
    s.wins = old.wins || 0;
    CARS.forEach(c => {
      if (old.owned && old.owned.indexOf(c.id) >= 0 && s.owned.indexOf(c.id) < 0) s.owned.push(c.id);
      if (old.upgrades && old.upgrades[c.id]) s.upgrades[c.id] = old.upgrades[c.id];
      if (old.equipped && old.equipped[c.id]) s.equipped[c.id] = old.equipped[c.id];
      if (c.nitroLocked === false && s.owned.indexOf(c.id) >= 0) s.nitroUnlocked[c.id] = true;
    });
    if (old.cosOwned) s.cosOwned = old.cosOwned;
    return s;
  }
  return null;
}

let save = loadJSON(SAVE_KEY, null) || migrate();
let settings = loadJSON(SETTINGS_KEY, { quality: 'high', sound: true });

function persist() { if (save) store.set(SAVE_KEY, JSON.stringify(save)); }
function persistSettings() { store.set(SETTINGS_KEY, JSON.stringify(settings)); }

const carById = id => CARS.find(c => c.id === id);
const isOwned = id => !!(save && save.owned.indexOf(id) >= 0);
const ownedCars = () => CARS.filter(c => isOwned(c.id));
const lvl = (carId, upId) => (save && save.upgrades[carId] && save.upgrades[carId][upId]) || 0;
const nitroUnlocked = car => !car.nitroLocked || !!(save && save.nitroUnlocked && save.nitroUnlocked[car.id]);

function effStats(car) {
  const s = Object.assign({}, car.base);
  UPGRADES.forEach(u => {
    const n = lvl(car.id, u.id);
    if (!n) return;
    Object.keys(u.gain).forEach(k => { s[k] = (s[k] || 0) + u.gain[k] * n; });
  });
  s.accel = Math.max(2.4, s.accel);
  ['handling', 'nitro', 'brakes', 'aero'].forEach(k => { s[k] = Math.min(150, s[k]); });
  if (!nitroUnlocked(car)) s.nitro = 0;
  return s;
}
function perfRating(car) {
  const s = effStats(car);
  return Math.round((s.speed - 160) * 1.2 + (9 - s.accel) * 42 + s.handling * 0.8 +
    s.nitro * 0.5 + s.brakes * 0.4 + s.aero * 0.6);
}

/* ------------------------- AUDIO WRAPPER ------------------------- */
function fx(name, arg) {
  if (typeof AudioFX === 'undefined' || !AudioFX) return;
  try { if (typeof AudioFX[name] === 'function') AudioFX[name](arg); } catch (e) {}
}

/* ------------------------- UI HELPERS ------------------------- */
const $ = s => document.querySelector(s);
const fmtCash = n => '$' + Math.round(n).toLocaleString('en-US');

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  if (!el) return;
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

let viewMode = false;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $('#' + id).classList.remove('hidden');
  $('#topbar').classList.toggle('hidden', id === 'screen-home' || id === 'screen-exit');
  const bgId2 = BG_OF[id] || 'bg-home';
  const bgEl = document.getElementById(bgId2);
  if (bgEl && BG_URLS[bgId2] && !bgEl.dataset.loaded) {
    bgEl.style.backgroundImage = "url('" + BG_URLS[bgId2] + "')";
    bgEl.dataset.loaded = '1';
  }
  document.querySelectorAll('.bg').forEach(b => b.classList.toggle('active', b.id === bgId2));
  if (id !== 'screen-garage') { setViewMode(false); if (typeof Viewer !== 'undefined') Viewer.stop(); }
  updateTopbar();
}
function updateTopbar() { $('#cash').textContent = save ? fmtCash(save.cash) : '$—'; }

/* ------------------------- LOOK (cosmetics → 3D) ------------------------- */
function equippedLook(carId) {
  const eq = (save && save.equipped && save.equipped[carId]) || DEFAULT_LOOK;
  const find = gid => {
    const g = COSMETICS.find(x => x.id === gid);
    return g.items.find(i => i.id === (eq[gid] || g.items[0].id)) || g.items[0];
  };
  const paintItem = find('paint'), rimsItem = find('rims'), glowItem = find('glow'), tintItem = find('tint');
  const car = carById(carId);
  const hex = (item, dflt) => item.hex ? parseInt(item.hex.slice(1), 16) : dflt;
  return {
    paintHex: hex(paintItem, car.paint || 0xd8352f),
    rimHex: hex(rimsItem, 0xc9ced8),
    glowHex: glowItem.hex ? parseInt(glowItem.hex.slice(1), 16) : 0x000000,
    tint: tintItem.level || 0,
  };
}

/* ------------------------- GARAGE ------------------------- */
let previewCarId = null;
let viewerReady = false;

function openGarage() {
  previewCarId = save.selected && isOwned(save.selected) ? save.selected : ownedCars()[0].id;
  showScreen('screen-garage');
  ensureViewer();
  setTab('specs');
  renderGarage(true);
}

function ensureViewer() {
  if (typeof Viewer === 'undefined') return;
  if (viewerReady) { Viewer.start(); return; }
  const canvas = $('#car-canvas');
  if (!canvas) return;
  viewerReady = Viewer.init(canvas, settings.quality) === true;
  $('#car-fallback').classList.toggle('hidden', viewerReady);
  if (viewerReady) Viewer.resize();
}

function currentLook() { return equippedLook(previewCarId); }

function renderGarage(swapCar) {
  /* DOM WRITES FIRST — a 3D-side error can never blank the UI again */
  try {
    const car = carById(previewCarId);
    const owned = isOwned(car.id);
    const unlocked = nitroUnlocked(car);
    const st = effStats(car);

    $('#car-name').textContent = car.name;
    $('#car-class').textContent = car.klass + ' CLASS';
    $('#car-desc').textContent = car.desc;
    $('#car-rating').textContent = perfRating(car);

    /* garage lists ONLY cars you own — clean chips */
    const list = $('#car-list');
    list.innerHTML = '';
    ownedCars().forEach(c => {
      const chip = document.createElement('button');
      chip.className = 'car-chip' + (c.id === previewCarId ? ' active' : '');
      chip.innerHTML = '<i style="background:' + (c.swatch || '#888') + '"></i>' + c.name +
        (save.selected === c.id ? '<em>ACTIVE</em>' : '');
      chip.onclick = () => {
        if (c.id === previewCarId) return;
        previewCarId = c.id;
        fx('whoosh');
        renderGarage(true);
      };
      list.appendChild(chip);
    });

    /* detailed spec sheet (live values incl. upgrades) */
    const fl = car.flavor || {};
    const hp = (fl.power || 380) + (st.speed - car.base.speed) * 3 + Math.round((car.base.accel - st.accel) * 60);
    const tq = (fl.torque || 500) + (st.speed - car.base.speed) * 2;
    const wt = (fl.weight || 1500) - (((save.upgrades[car.id] || {}).weight) || 0) * 35;
    const sheetRows = [
      ['ENGINE', fl.engine || '—'],
      ['POWER', Math.round(hp) + ' hp'],
      ['TORQUE', Math.round(tq) + ' Nm'],
      ['DRIVETRAIN', fl.drive || 'RWD'],
      ['WEIGHT', wt.toLocaleString('en-US') + ' kg'],
      ['TYRES', fl.tyres || 'SPORT'],
      ['TOP SPEED', st.speed + ' km/h'],
      ['0–100 KM/H', st.accel.toFixed(2) + ' s'],
      ['HANDLING', st.handling + ' / 150'],
      ['BRAKES', st.brakes + ' / 150'],
      ['NITRO', unlocked ? st.nitro + ' / 150' : 'LOCKED'],
      ['DOWNFORCE', st.aero + ' / 150'],
      ['FUEL', fl.fuel || 'PETROL'],
    ];
    const sheetEl = $('#spec-sheet');
    if (sheetEl) sheetEl.innerHTML = sheetRows.map(r =>
      '<div class="ss-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');

    /* spec bars */
    const specs = [
      ['TOP SPEED', st.speed + ' km/h', (st.speed - 160) / 260 * 100],
      ['0–100 KM/H', st.accel.toFixed(1) + ' s', (9 - st.accel) / 6.5 * 100],
      ['GRIP', st.handling + ' / 150', st.handling / 1.5],
      ['NITRO', unlocked ? st.nitro + ' / 150' : 'LOCKED', unlocked ? st.nitro / 1.5 : 0],
      ['BRAKES', st.brakes + ' / 150', st.brakes / 1.5],
      ['DOWNFORCE', st.aero + ' / 150', st.aero / 1.5],
    ];
    $('#spec-bars').innerHTML = specs.map(sp =>
      '<div class="spec"><div class="row"><span>' + sp[0] + '</span><b>' + sp[1] + '</b></div>' +
      '<div class="bar"><div class="fill" style="width:' + Math.max(2, Math.min(100, sp[2])) + '%"></div></div></div>'
    ).join('');

    /* nitrous unlock */
    const unlockBtn = $('#btn-unlock-nitro');
    if (car.nitroLocked && !unlocked) {
      unlockBtn.classList.remove('hidden');
      unlockBtn.innerHTML = 'UNLOCK NITROUS · ' + fmtCash(NITRO_UNLOCK_COST);
      unlockBtn.disabled = !owned || save.cash < NITRO_UNLOCK_COST;
      unlockBtn.onclick = () => {
        if (save.cash < NITRO_UNLOCK_COST) { fx('error'); toast('NOT ENOUGH CASH'); return; }
        save.cash -= NITRO_UNLOCK_COST;
        save.nitroUnlocked = save.nitroUnlocked || {};
        save.nitroUnlocked[car.id] = true;
        persist(); fx('buy'); fx('rev', 1);
        toast('NITROUS UNLOCKED FOR ' + car.name);
        renderGarage(false);
      };
    } else {
      unlockBtn.classList.add('hidden');
    }

    renderUpgrades(car, owned, unlocked);
    renderCosmetics(car, owned);

    /* select / buy */
    const sel = $('#btn-select'), buy = $('#btn-buy');
    if (owned) {
      buy.classList.add('hidden');
      sel.classList.remove('hidden');
      sel.textContent = save.selected === car.id ? 'SELECTED ✓' : 'SET AS ACTIVE';
      sel.disabled = save.selected === car.id;
      sel.onclick = () => {
        save.selected = car.id; persist();
        fx('select'); toast(car.name + ' IS NOW YOUR ACTIVE CAR');
        renderGarage(false);
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
        save.equipped[car.id] = Object.assign({}, DEFAULT_LOOK);
        persist(); fx('buy'); toast(car.name + ' PURCHASED!');
        renderGarage(false);
      };
    }
    updateTopbar();
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) console.error('renderGarage:', err);
    toast('GARAGE ERROR — ' + (err && err.message ? err.message : err));
  }

  /* 3D LAST and isolated — a throw here can never blank the panels */
  try {
    const car = carById(previewCarId);
    if (typeof Viewer !== 'undefined' && Viewer.ok) {
      if (swapCar || Viewer.currentId !== car.id) Viewer.showCar(car, currentLook());
      else Viewer.applyLook(currentLook());
    } else {
      const fb = $('#car-fallback');
      if (fb && fb.dataset.car !== car.id) {
        fb.dataset.car = car.id;
        fb.innerHTML = carSilhouette(car.swatch || '#888', true);
      }
    }
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) console.error('viewer:', err);
  }
}

function carSilhouette(color, big) {
  return '<svg viewBox="0 0 120 44"' + (big ? ' style="width:min(560px,62%);height:auto"' : '') + '>' +
    '<path fill="' + color + '" d="M4 30c0-3 2-6 6-7l14-3 12-9c1-1 3-2 5-2h30c2 0 4 1 5 2l10 8 16 4c4 1 6 4 6 7v4h-10a9 9 0 0 0-18 0H40a9 9 0 0 0-18 0H4z"/>' +
    '<path fill="rgba(255,255,255,.4)" d="M41 11h26l9 8H36z"/>' +
    '<circle cx="31" cy="33" r="7" fill="#1a1e24"/><circle cx="31" cy="33" r="3" fill="#9aa1a8"/>' +
    '<circle cx="89" cy="33" r="7" fill="#1a1e24"/><circle cx="89" cy="33" r="3" fill="#9aa1a8"/></svg>';
}

const LOCK_SVG = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6z" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const TIER_NAME = { 1: 'STAGE I', 2: 'STAGE II', 3: 'STAGE III', 4: 'ELITE' };

function renderUpgrades(car, owned, unlocked) {
  const box = $('#upgrade-list');
  if (!box) return;
  box.innerHTML = '';
  UPGRADES.forEach(u => {
    const level = lvl(car.id, u.id);
    const maxed = level >= MAX_LEVEL;
    const cost = maxed ? 0 : u.cost[level];
    const nitroGated = u.id === 'nitro' && !unlocked;
    const row = document.createElement('div');
    row.className = 'up-row tier' + u.tier;
    let pips = '';
    for (let i = 0; i < MAX_LEVEL; i++) pips += '<div class="pip' + (i < level ? ' on' : '') + '"></div>';
    row.innerHTML =
      '<div class="up-head">' +
      '<svg class="up-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="' + u.ico.replace('CIRCLE', '') + '"/>' +
      (u.id === 'tires' ? '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>' : '') +
      '</svg>' +
      '<div class="up-info"><div class="n">' + u.name + '<em>' + TIER_NAME[u.tier] + '</em></div>' +
      '<div class="d">' + (nitroGated ? 'UNLOCK NITROUS FIRST' : u.desc) + '</div></div>' +
      '<div class="pips">' + pips + '</div></div>';
    const btn = document.createElement('button');
    btn.className = 'buy-up' + (maxed ? ' max' : '');
    btn.textContent = maxed ? 'MAX STAGE' : 'INSTALL · ' + fmtCash(cost);
    btn.disabled = maxed || !owned || nitroGated || save.cash < cost;
    btn.onclick = () => buyUpgrade(car, u);
    row.appendChild(btn);
    box.appendChild(row);
  });
}

function buyUpgrade(car, u) {
  const level = lvl(car.id, u.id);
  if (level >= MAX_LEVEL) return;
  const cost = u.cost[level];
  if (save.cash < cost) { fx('error'); toast('NOT ENOUGH CASH'); return; }
  save.cash -= cost;
  save.upgrades[car.id] = save.upgrades[car.id] || {};
  save.upgrades[car.id][u.id] = level + 1;
  persist();
  fx('buy'); fx('rev', 0.9);
  toast(u.name + ' → STAGE ' + (level + 1));
  renderGarage(false);
}

/* ------------------------- CUSTOMIZATION ------------------------- */
function cosKey(gid, iid) { return gid + ':' + iid; }
function hasCosmetic(gid, iid) {
  return !!(save && save.cosOwned && save.cosOwned.indexOf(cosKey(gid, iid)) >= 0);
}

function renderCosmetics(car, owned) {
  const box = $('#cosmetic-list');
  if (!box) return;
  box.innerHTML = '';
  const eq = (save.equipped && save.equipped[car.id]) || DEFAULT_LOOK;

  if (car.factoryFinish) {
    const note = document.createElement('div');
    note.className = 'factory-note';
    note.textContent = 'FACTORY FINISH — ' + car.name + ' keeps its original paint, rims and glass. Underglow below still works.';
    box.appendChild(note);
  }

  COSMETICS.forEach(group => {
    if (car.factoryFinish && group.id !== 'glow') return;   /* paint/rims/tint N/A on GLB finish */
    const wrap = document.createElement('div');
    wrap.className = 'cos-group';
    wrap.innerHTML = '<div class="cos-name">' + group.name + '</div>';
    const chips = document.createElement('div');
    chips.className = 'cos-chips';
    group.items.forEach(item => {
      const has = hasCosmetic(group.id, item.id);
      const active = (eq[group.id] || group.items[0].id) === item.id;
      const chip = document.createElement('button');
      chip.className = 'cos-chip' + (active ? ' on' : '') + (has ? '' : ' locked');
      chip.innerHTML =
        '<span class="sw" style="background:' + (item.hex || 'linear-gradient(135deg,#9aa1a8,#5d646c)') + '"></span>' +
        '<span class="cn">' + item.name + '</span>' +
        '<span class="cp">' + (has ? (active ? 'EQUIPPED' : 'EQUIP') : fmtCash(item.price)) + '</span>';
      chip.onclick = () => {
        if (!owned) { fx('error'); toast('OWN THE CAR FIRST'); return; }
        if (has) {
          save.equipped[car.id] = save.equipped[car.id] || Object.assign({}, DEFAULT_LOOK);
          save.equipped[car.id][group.id] = item.id;
          persist(); fx('click');
          if (typeof Viewer !== 'undefined' && Viewer.ok) Viewer.applyLook(currentLook());
          renderCosmetics(car, owned);
          toast(item.name + ' EQUIPPED');
        } else if (save.cash >= item.price) {
          save.cash -= item.price;
          save.cosOwned = save.cosOwned || [];
          save.cosOwned.push(cosKey(group.id, item.id));
          save.equipped[car.id] = save.equipped[car.id] || Object.assign({}, DEFAULT_LOOK);
          save.equipped[car.id][group.id] = item.id;
          persist(); fx('buy');
          if (typeof Viewer !== 'undefined' && Viewer.ok) Viewer.applyLook(currentLook());
          renderCosmetics(car, owned); updateTopbar();
          toast(item.name + ' INSTALLED');
        } else { fx('error'); toast('NOT ENOUGH CASH'); }
      };
      chips.appendChild(chip);
    });
    wrap.appendChild(chips);
    box.appendChild(wrap);
  });
}

/* ------------------------- PANEL TABS / VIEW MODE ------------------------- */
function setTab(which) {
  const specs = which === 'specs';
  $('#tab-specs').classList.toggle('on', specs);
  $('#tab-custom').classList.toggle('on', !specs);
  $('#panel-specs').classList.toggle('hidden', !specs);
  $('#panel-custom').classList.toggle('hidden', specs);
}

function setViewMode(on) {
  if (on === viewMode && !on) return;
  viewMode = !!on;
  const g = $('#screen-garage');
  if (g) g.classList.toggle('view-mode', viewMode);
  const btn = $('#btn-view3d');
  if (btn) btn.innerHTML = viewMode ? '<b>ESC</b> BACK TO SPECS' : '<b>1</b> VIEW &amp; ROTATE 3D';
  if (typeof Viewer !== 'undefined' && Viewer.ok) {
    Viewer.setViewMode(viewMode);
    setTimeout(() => { try { Viewer.resize(); } catch (e) {} }, 60);
  }
  if (viewMode) { fx('whoosh'); fx('engineStart'); }
  else fx('engineStop');
}

function switchCar(dir) {
  const list = ownedCars();
  if (list.length < 2) { fx('error'); toast('YOU ONLY OWN ONE CAR'); return; }
  let i = list.findIndex(c => c.id === previewCarId);
  i = (i + dir + list.length) % list.length;
  previewCarId = list[i].id;
  fx('whoosh'); fx('rev', 0.6);
  renderGarage(true);
}

/* ------------------------- CAREER ------------------------- */
function renderCareer() { /* race & map system: awaiting the user's design */ }

/* ------------------------- SETTINGS ------------------------- */
function renderSettings() {
  document.querySelectorAll('#quality-seg button').forEach(b =>
    b.classList.toggle('on', b.dataset.q === settings.quality));
  document.querySelectorAll('#sound-seg button').forEach(b =>
    b.classList.toggle('on', (b.dataset.s === 'on') === settings.sound));
}

function detectGLB() {
  const el = $('#glb-status');
  if (!el || typeof fetch !== 'function') return;
  const withModel = CARS.filter(c => c.model);
  Promise.all(withModel.map(c =>
    fetch(c.model, { method: 'HEAD' }).then(r => r.ok).catch(() => false)))
    .then(res => {
      const n = res.filter(Boolean).length;
      el.textContent = n ? n + ' GLB MODEL' + (n > 1 ? 'S' : '') + ' LOADED' : 'SAMPLE GEOMETRY';
      el.classList.toggle('live', n > 0);
    });
}

/* ------------------------- NAV ------------------------- */
function startNewGame() {
  save = freshSave();
  persist();
  updateTopbar();
  showScreen('screen-hub');
  fx('buy');
  toast('PROFILE CREATED · ' + fmtCash(save.cash) + ' · TWO STARTER CARS');
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
  $('#btn-continue').onclick = () => { if (save) { fx('click'); showScreen('screen-hub'); } };
  $('#btn-exit').onclick = () => { showScreen('screen-exit'); window.close(); };

  $('#btn-garage').onclick = openGarage;
  $('#btn-career').onclick = () => { renderCareer(); showScreen('screen-career'); };
  $('#btn-hub-back').onclick = () => showScreen('screen-home');
  $('#btn-garage-back').onclick = () => { fx('back'); showScreen('screen-hub'); };
  $('#btn-career-back').onclick = () => { fx('back'); showScreen('screen-hub'); };

  $('#btn-settings').onclick = () => { settingsReturn = 'screen-home'; showScreen('screen-settings'); renderSettings(); };
  $('#btn-hub-settings').onclick = () => { settingsReturn = 'screen-hub'; showScreen('screen-settings'); renderSettings(); };
  $('#btn-settings-back').onclick = () => showScreen(settingsReturn);

  document.querySelectorAll('#quality-seg button').forEach(b => b.onclick = () => {
    settings.quality = b.dataset.q; persistSettings(); renderSettings();
    if (typeof Viewer !== 'undefined') Viewer.setQuality(b.dataset.q);
    toast('QUALITY: ' + b.dataset.q.toUpperCase());
  });
  document.querySelectorAll('#sound-seg button').forEach(b => b.onclick = () => {
    settings.sound = b.dataset.s === 'on'; persistSettings(); renderSettings();
    fx('setEnabled', settings.sound);
    if (settings.sound) fx('click');
    toast('SOUND ' + (settings.sound ? 'ON' : 'OFF'));
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

  $('#tab-specs').onclick = () => setTab('specs');
  $('#tab-custom').onclick = () => { setTab('custom'); fx('click'); };
  $('#btn-car-prev').onclick = () => switchCar(-1);
  $('#btn-car-next').onclick = () => switchCar(1);
  $('#btn-view3d').onclick = () => setViewMode(!viewMode);

  const canvas = $('#car-canvas');
  if (canvas) {
    canvas.addEventListener('pointerdown', e => { canvas._sx = e.clientX; canvas._sy = e.clientY; });
    canvas.addEventListener('pointerup', e => {
      const moved = Math.abs(e.clientX - (canvas._sx || 0)) + Math.abs(e.clientY - (canvas._sy || 0));
      if (!viewMode && moved < 8) setViewMode(true);
    });
  }
}
function refreshHome() { $('#btn-continue').disabled = !save; }

/* ------------------------- KEYBOARD ------------------------- */
function wireKeys() {
  window.addEventListener('keydown', e => {
    const garageOpen = !$('#screen-garage').classList.contains('hidden');
    const modalOpen = !$('#modal').classList.contains('hidden');
    if (!garageOpen || modalOpen) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); switchCar(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); switchCar(1); }
    else if (e.key === '1') { e.preventDefault(); setViewMode(true); }
    else if (e.key === 'Escape') {
      e.preventDefault();
      if (viewMode) setViewMode(false);
      else { fx('back'); showScreen('screen-hub'); }
    }
  });
}

/* ------------------------- UI SOUND DELEGATION ------------------------- */
function wireSound() {
  if (typeof AudioFX === 'undefined') return;
  if (settings.sound === false) AudioFX.enabled = false;
  let last = null;
  document.addEventListener('pointerover', e => {
    const b = e.target.closest ? e.target.closest('button, .car-card, .cos-chip') : null;
    if (b && b !== last && !b.disabled) { last = b; fx('hover'); }
    if (!b) last = null;
  });
  document.addEventListener('click', e => {
    const b = e.target.closest ? e.target.closest('button') : null;
    if (b && !b.disabled) fx('click');
  });
}

/* ------------------------- BOOT PRELOAD + CINEMATICS ------------------------- */
let booted = false;
function finishBoot() {
  if (booted) return;
  booted = true;
  /* backdrops were preloaded — attach them (from cache, instant) */
  Object.keys(BG_URLS).forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.loaded) {
      el.style.backgroundImage = "url('" + BG_URLS[id] + "')";
      el.dataset.loaded = '1';
    }
  });
  setTimeout(() => $('#loader').classList.add('done'), 350);
}

function preloadAll() {
  const tag = $('#loader-tag');
  const jobs = [];
  ['assets/bg_home.jpg'].concat(Object.keys(BG_URLS).map(k => BG_URLS[k]))
    .forEach(u => jobs.push(cb => { const im = new Image(); im.onload = cb; im.onerror = cb; im.src = u; }));
  CARS.forEach(c => jobs.push(cb => {
    if (typeof Viewer !== 'undefined') Viewer.preload(c, cb); else cb();
  }));
  let done = 0;
  const step = () => {
    done++;
    if (tag) tag.textContent = 'LOADING ' + Math.round(done / jobs.length * 100) + '%';
    if (done >= jobs.length) finishBoot();
  };
  jobs.forEach(j => j(step));
  setTimeout(finishBoot, 9000);   /* failsafe: never trap the player on the loader */
}

function initFX() {
  window.addEventListener('pointermove', e => {
    const x = e.clientX / innerWidth - 0.5;
    const y = e.clientY / innerHeight - 0.5;
    document.documentElement.style.setProperty('--px', x.toFixed(3));
    document.documentElement.style.setProperty('--py', y.toFixed(3));
  });
  preloadAll();
}

/* ------------------------- BOOT ------------------------- */
wireUI();
wireKeys();
wireSound();
refreshHome();
updateTopbar();
initFX();
detectGLB();
