/* ================================================================
   PAYBACK RUSH — Step 1
   Home layout, hub, garage (buy/select/upgrade), career (1 map),
   settings, exit, and the $ economy. 3D scene via three.js.
   ================================================================ */
'use strict';

/* ------------------------- DATA ------------------------- */
const CARS = [
  {
    id: 'falcon', name: 'FALCON GT', klass: 'STREET', price: 0,
    color: 0xc8322b, glow: 0xff6a2a, spoiler: false,
    base: { speed: 262, accel: 6.8, handling: 58, nitro: 45, brakes: 55 },
    desc: 'The street coupe that started it all. Honest power, honest money.',
  },
  {
    id: 'vortex', name: 'VORTEX R', klass: 'SUPER', price: 12000,
    color: 0x1f8fd4, glow: 0x19c8ff, spoiler: true,
    base: { speed: 318, accel: 5.2, handling: 76, nitro: 70, brakes: 70 },
    desc: 'Track-bred supercar. Locked — until you can pay.',
  },
];

const UPGRADES = [
  { id: 'engine', name: 'ENGINE', desc: '+12 km/h & sharper 0-100 per stage', cost: [700, 1200, 1900, 2800, 4000] },
  { id: 'tires', name: 'TIRES', desc: '+5 handling per stage', cost: [500, 900, 1500, 2200, 3200] },
  { id: 'nitro', name: 'NITRO KIT', desc: '+6 nitro power per stage', cost: [600, 1000, 1600, 2400, 3500] },
  { id: 'brakes', name: 'BRAKES', desc: '+4 braking per stage', cost: [400, 800, 1300, 2000, 2900] },
];
const MAX_LEVEL = 5;

const RACES = [
  { id: 'sunset', name: 'SUNSET STRIP SPRINT', map: 'DOWNTOWN COAST', dist: '2.4 KM', difficulty: 2, reward: 1500 },
];

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

const SCREEN_MODE = {
  'screen-home': 'home', 'screen-hub': 'home', 'screen-garage': 'garage',
  'screen-career': 'career', 'screen-settings': 'home', 'screen-exit': 'home',
};
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $('#' + id).classList.remove('hidden');
  $('#topbar').classList.toggle('hidden', id === 'screen-home' || id === 'screen-exit');
  setMode(SCREEN_MODE[id] || 'home');
  updateTopbar();
}
function updateTopbar() {
  $('#cash').textContent = save ? fmtCash(save.cash) : '$—';
}

/* ------------------------- GARAGE UI ------------------------- */
let previewCarId = null;

function openGarage() {
  previewCarId = save.selected;
  setCarModel(carById(previewCarId));
  renderGarage();
  showScreen('screen-garage');
}

function renderGarage() {
  const list = $('#car-list');
  list.innerHTML = '';
  CARS.forEach(car => {
    const owned = save.owned.includes(car.id);
    const card = document.createElement('div');
    card.className = 'car-card' + (car.id === previewCarId ? ' active' : '');
    card.innerHTML = '<div><div class="cc-name">' + car.name + '</div>' +
      '<div class="cc-sub">' + car.klass + ' CLASS · ' +
      (owned
        ? '<span class="owned">OWNED' + (save.selected === car.id ? ' · SELECTED' : '') + '</span>'
        : '<span class="locked">LOCKED · ' + fmtCash(car.price) + '</span>') +
      '</div></div>';
    card.onclick = () => {
      previewCarId = car.id;
      setCarModel(car);
      renderGarage();
    };
    list.appendChild(card);
  });

  const car = carById(previewCarId);
  const owned = save.owned.includes(car.id);
  const st = effStats(car);

  $('#car-name').textContent = car.name;
  $('#car-class').textContent = car.klass + ' CLASS';
  $('#car-desc').textContent = car.desc;

  const specs = [
    ['TOP SPEED', st.speed + ' km/h', st.speed / 360 * 100],
    ['0-100', st.accel.toFixed(1) + ' s', (8 - st.accel) / 5.2 * 100],
    ['HANDLING', st.handling + ' / 100', st.handling],
    ['NITRO', st.nitro + ' / 100', st.nitro],
    ['BRAKES', st.brakes + ' / 100', st.brakes],
  ];
  $('#spec-bars').innerHTML = specs.map(s =>
    '<div class="spec"><div class="row"><span>' + s[0] + '</span><b>' + s[1] + '</b></div>' +
    '<div class="bar"><div class="fill" style="width:' + Math.max(4, Math.min(100, s[2])) + '%"></div></div></div>'
  ).join('');

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
      '<div class="up-info"><div class="n">' + u.name + '</div><div class="d">' + u.desc + '</div>' +
      '<div class="pips">' + pips + '</div></div>';
    const btn = document.createElement('button');
    btn.className = 'buy-up' + (maxed ? ' max' : '');
    btn.textContent = maxed ? 'MAX' : fmtCash(cost);
    btn.disabled = maxed || !owned || save.cash < cost;
    btn.onclick = () => buyUpgrade(car, u);
    row.appendChild(btn);
    up.appendChild(row);
  });

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
    const stars = '★'.repeat(r.difficulty) + '☆'.repeat(3 - r.difficulty);
    const card = document.createElement('div');
    card.className = 'race-card';
    card.innerHTML =
      '<div><div class="rc-name">' + r.name + '</div>' +
      '<div class="rc-meta">MAP: ' + r.map + ' · ' + r.dist + ' · <span class="reward">REWARD ' +
      fmtCash(r.reward) + '</span></div></div>' +
      '<div style="text-align:right"><div class="stars">' + stars + '</div>' +
      '<button class="act primary" style="margin-top:8px">START RACE</button></div>';
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

  let settingsReturn = 'screen-home';
  $('#btn-settings').onclick = () => { settingsReturn = 'screen-home'; showScreen('screen-settings'); renderSettings(); };
  $('#btn-hub-settings').onclick = () => { settingsReturn = 'screen-hub'; showScreen('screen-settings'); renderSettings(); };
  $('#btn-settings-back').onclick = () => showScreen(settingsReturn);

  document.querySelectorAll('#quality-seg button').forEach(b => b.onclick = () => {
    settings.quality = b.dataset.q; persistSettings(); applyQuality(); renderSettings();
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

/* ================================================================
   3D SCENE
   ================================================================ */
let renderer, scene, camera, clock;
let heroCar = null, platformGroup, particles, sunLight;
let mode = 'home', tGlobal = 0;

function canvasTexture(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

function makeSky() {
  return canvasTexture((g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#04060f');
    grad.addColorStop(0.45, '#1b1038');
    grad.addColorStop(0.62, '#5b1e54');
    grad.addColorStop(0.72, '#ff6b35');
    grad.addColorStop(0.78, '#2a1440');
    grad.addColorStop(1, '#0a0a12');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  }, 16, 512);
}

function makeWindowTex() {
  const t = canvasTexture((g, w, h) => {
    g.fillStyle = '#0b0d15'; g.fillRect(0, 0, w, h);
    const cols = ['#ffd27a', '#9ad8ff', '#ff9d5c', '#e8f4ff'];
    for (let y = 6; y < h - 6; y += 10) {
      for (let x = 5; x < w - 5; x += 9) {
        g.fillStyle = Math.random() < 0.34
          ? cols[(Math.random() * cols.length) | 0]
          : '#141a28';
        g.fillRect(x, y, 5, 6);
      }
    }
  }, 64, 128);
  return t;
}

function makeRoadTex() {
  const t = canvasTexture((g, w, h) => {
    g.fillStyle = '#16171d'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#23242c';
    for (let i = 0; i < 90; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    g.fillStyle = '#c8b45a'; g.fillRect(w / 2 - 3, 8, 6, h / 2 - 16);   // center dash
    g.fillStyle = '#d8d8d8'; g.fillRect(4, 0, 4, h); g.fillRect(w - 8, 0, 4, h); // edges
  }, 128, 256);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 26);
  return t;
}

function buildCar(def) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: def.color, metalness: 0.75, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a0a0d, metalness: 0.4, roughness: 0.65 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0d1b26, metalness: 0.9, roughness: 0.15 });

  const add = (geo, mat, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = true;
    g.add(m);
    return m;
  };

  add(new THREE.BoxGeometry(1.9, 0.5, 4.4), paint, 0, 0.62, 0);          // chassis
  add(new THREE.BoxGeometry(2.0, 0.2, 4.55), dark, 0, 0.3, 0);           // skirt
  add(new THREE.BoxGeometry(1.78, 0.16, 0.95), paint, 0, 0.83, -1.95, -0.16); // nose slope
  add(new THREE.BoxGeometry(1.5, 0.46, 2.15), glass, 0, 1.08, 0.15);     // cabin
  add(new THREE.BoxGeometry(1.42, 0.07, 1.95), paint, 0, 1.33, 0.15);    // roof

  // wheels + hubs
  [[-0.95, -1.45], [0.95, -1.45], [-0.95, 1.45], [0.95, 1.45]].forEach(p => {
    add(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 20), dark, p[0], 0.42, p[1], 0, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.36, 12),
      new THREE.MeshStandardMaterial({ color: 0xbfc6cf, metalness: 0.9, roughness: 0.3 }),
      p[0], 0.42, p[1], 0, 0, Math.PI / 2);
  });

  // lights
  const head = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
  const tail = new THREE.MeshBasicMaterial({ color: 0xff2430 });
  add(new THREE.BoxGeometry(0.4, 0.12, 0.08), head, -0.6, 0.72, -2.21);
  add(new THREE.BoxGeometry(0.4, 0.12, 0.08), head, 0.6, 0.72, -2.21);
  add(new THREE.BoxGeometry(1.6, 0.1, 0.08), tail, 0, 0.78, 2.21);

  if (def.spoiler) {
    add(new THREE.BoxGeometry(0.08, 0.3, 0.08), dark, -0.6, 1.02, 2.05);
    add(new THREE.BoxGeometry(0.08, 0.3, 0.08), dark, 0.6, 1.02, 2.05);
    add(new THREE.BoxGeometry(1.75, 0.07, 0.45), paint, 0, 1.18, 2.1);
  }

  // neon underglow
  const glowMat = new THREE.MeshBasicMaterial({
    color: def.glow, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.0), glowMat);
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06;
  g.add(glow);
  const gl = new THREE.PointLight(def.glow, 0.9, 5);
  gl.position.y = 0.35; g.add(gl);
  return g;
}

function setCarModel(def) {
  if (heroCar) scene.remove(heroCar);
  heroCar = buildCar(def);
  scene.add(heroCar);
}

function buildCity() {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: 0x0b0d13, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 320),
    new THREE.MeshStandardMaterial({ map: makeRoadTex(), roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, -130);
  road.receiveShadow = true;
  g.add(road);

  const winTex = makeWindowTex();
  for (let side = -1; side <= 1; side += 2) {
    let z = -14;
    while (z > -260) {
      const w = 8 + Math.random() * 7;
      const h = 12 + Math.random() * 34;
      const d = 9 + Math.random() * 6;
      const tex = winTex.clone(); tex.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x101321, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.75, map: tex,
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(side * (15 + Math.random() * 12), h / 2, z);
      g.add(b);
      z -= d + 4 + Math.random() * 10;
    }
    // street lamps
    for (let lz = -20; lz > -250; lz -= 34) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a2d36 }));
      pole.position.set(side * 8.4, 3, lz);
      g.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      bulb.position.set(side * 8.1, 6, lz);
      g.add(bulb);
    }
  }

  // low sun disc on the horizon
  const sun = new THREE.Mesh(new THREE.CircleGeometry(26, 40),
    new THREE.MeshBasicMaterial({ color: 0xffb36b, fog: false }));
  sun.position.set(0, 14, -290);
  g.add(sun);
  return g;
}

function buildPlatform() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.5, 0.16, 48),
    new THREE.MeshStandardMaterial({ color: 0x10131a, metalness: 0.7, roughness: 0.4 }));
  disc.position.y = 0.08; disc.receiveShadow = true;
  g.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.05, 10, 64),
    new THREE.MeshBasicMaterial({ color: 0xff9f1c }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.16;
  g.add(ring);
  g.visible = false;
  return g;
}

function buildParticles() {
  const n = 260;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = Math.random() * 9;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 90 - 10;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffa060, size: 0.12, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
}

function initThree() {
  renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = makeSky();
  scene.fog = new THREE.Fog(0x2a1440, 60, 270);

  camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);

  scene.add(new THREE.HemisphereLight(0x35406b, 0x0c0a12, 0.55));
  sunLight = new THREE.DirectionalLight(0xffa15e, 1.15);
  sunLight.position.set(-40, 26, -70);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -25; sunLight.shadow.camera.right = 25;
  sunLight.shadow.camera.top = 25; sunLight.shadow.camera.bottom = -25;
  scene.add(sunLight);
  const rim = new THREE.PointLight(0x20d0ff, 0.7, 70);
  rim.position.set(14, 9, 14); scene.add(rim);
  const fill = new THREE.PointLight(0xff7a3c, 0.5, 60);
  fill.position.set(-12, 6, 8); scene.add(fill);

  scene.add(buildCity());
  platformGroup = buildPlatform(); scene.add(platformGroup);
  particles = buildParticles(); scene.add(particles);

  setCarModel(CARS[0]);
  applyQuality();

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  clock = new THREE.Clock();
  animate();
}

function setMode(m) {
  mode = m;
  if (platformGroup) platformGroup.visible = (m === 'garage');
  if (heroCar) {
    heroCar.position.set(0, m === 'garage' ? 0.16 : 0, 0);
    heroCar.rotation.y = 0;
  }
}

function applyQuality() {
  if (!renderer) return;
  const q = settings.quality;
  renderer.setPixelRatio(q === 'high' ? Math.min(devicePixelRatio, 2) : q === 'medium' ? 1.25 : 1);
  renderer.setSize(innerWidth, innerHeight);
  const shadows = q !== 'low';
  renderer.shadowMap.enabled = shadows;
  sunLight.castShadow = shadows;
  if (particles) particles.visible = shadows;
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  tGlobal += dt;

  if (heroCar) {
    if (mode === 'home') heroCar.rotation.y += dt * 0.3;
    else if (mode === 'garage') heroCar.rotation.y += dt * 0.6;
  }
  if (particles) particles.rotation.y += dt * 0.02;

  if (mode === 'home') {
    const a = tGlobal * 0.12;
    camera.position.set(Math.sin(a) * 8, 2.4 + Math.sin(tGlobal * 0.5) * 0.15, Math.cos(a) * 8);
    camera.lookAt(0, 1, 0);
  } else if (mode === 'garage') {
    camera.position.set(Math.sin(tGlobal * 0.25) * 1.5, 1.9, 5.7);
    camera.lookAt(0, 0.9, 0);
  } else { // career: behind the car, looking down the strip
    camera.position.set(Math.sin(tGlobal * 0.1) * 0.4, 2.2, 7.6);
    camera.lookAt(0, 1.4, -80);
  }
  renderer.render(scene, camera);
}

/* ------------------------- BOOT ------------------------- */
wireUI();
refreshHome();
updateTopbar();
initThree();
