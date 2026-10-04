/* ================================================================
   Race — Step 2: playable sprint on DOWNTOWN COAST.
   • Rail-based arcade physics: the car runs along the track spline
     (dist) with a steerable lateral offset — stable, no explosions.
   • Two AI opponents with rubber-banding; finishing position pays.
   • Instanced coastal world: ocean, promenade, buildings, palms,
     light poles, guard rails, start/finish gantries. One draw call
     per instance group → light on the GPU.
   • Countdown, HUD (speed/pos/time/nitro/progress), pause (Esc),
     finish banner + payout callback.
   ================================================================ */
'use strict';

const Race = {
  SAMPLES: 480,
  roadHalf: 5.5,
  data: null,
  running: false,

  /* ---------------- track math (pure, testable) ---------------- */
  buildTrackData() {
    const P = (x, z) => new THREE.Vector3(x, 0, z);
    const ctrl = [
      P(0, 0), P(0, 180), P(14, 380), P(42, 560), P(60, 760), P(48, 960),
      P(16, 1160), P(-22, 1360), P(-52, 1560), P(-46, 1760), P(-14, 1960),
      P(8, 2160), P(6, 2400),
    ];
    const curve = new THREE.CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5);
    const pts = [], tan = [], nor = [];
    for (let i = 0; i <= this.SAMPLES; i++) {
      const t = i / this.SAMPLES;
      const p = curve.getPointAt(t);
      const g = curve.getTangentAt(t);
      pts.push(p); tan.push(g);
      const n = new THREE.Vector3(-g.z, 0, g.x);
      if (n.normalize) n.normalize();
      nor.push(n);
    }
    const len = curve.getLength ? curve.getLength() : 2400;
    this.data = { curve, pts, tan, nor, len: (typeof len === 'number' && len > 100) ? len : 2400 };
    return this.data;
  },

  /* track-space position → world position */
  trackPoint(dist, lat, out) {
    const d = this.data;
    const f = Math.max(0, Math.min(1, dist / d.len)) * this.SAMPLES;
    const i = Math.min(this.SAMPLES - 1, Math.floor(f));
    const k = f - i;
    const a = d.pts[i], b = d.pts[i + 1], na = d.nor[i], nb = d.nor[i + 1];
    const px = a.x + (b.x - a.x) * k + (na.x + (nb.x - na.x) * k) * lat;
    const pz = a.z + (b.z - a.z) * k + (na.z + (nb.z - na.z) * k) * lat;
    if (out && out.set) out.set(px, 0, pz);
    return { x: px, z: pz, tx: d.tan[i].x, tz: d.tan[i].z };
  },

  headingAt(dist) {
    const d = this.data;
    const i = Math.min(this.SAMPLES, Math.floor(Math.max(0, Math.min(1, dist / d.len)) * this.SAMPLES));
    const t = d.tan[i];
    return Math.atan2(t.x, t.z);
  },

  /* ---------------- player physics (pure, testable) ---------------- */
  newState() {
    return { dist: 0, lat: 0, speed: 0, steerVis: 0, nitro: 100, time: 0, finished: false, finishTime: 0 };
  },

  step(s, input, dt, car) {
    if (s.finished) { s.speed = Math.max(0, s.speed - 4 * dt); s.dist += s.speed * dt; return; }
    const nitroActive = !!car.nitroUnlocked && !!input.nitro && s.nitro > 1 && s.speed > 5;
    let top = car.top * (nitroActive ? 1.25 : 1);
    let acc = car.accel * (nitroActive ? 2.2 : 1);

    if (input.up) s.speed += acc * dt;
    else if (input.down) s.speed -= car.brake * dt;
    else s.speed -= 2.2 * dt;

    const off = Math.abs(s.lat) > this.roadHalf - 0.7;
    if (off) { top *= 0.45; s.speed -= 7 * dt; }

    s.speed = Math.max(0, Math.min(top, s.speed));

    const steerT = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    s.steer = (s.steer || 0) + (steerT - (s.steer || 0)) * Math.min(1, dt * 9);
    const grip = 0.75 + car.handling01 * 0.55;
    const latRate = (3.2 + s.speed * 0.13) * grip;
    s.lat += s.steer * latRate * dt;
    s.lat = Math.max(-(this.roadHalf + 4), Math.min(this.roadHalf + 4, s.lat));
    if (Math.abs(s.steer) > 0.4 && s.speed > 25) s.speed -= s.speed * 0.12 * dt;  /* cornering scrub */
    s.steerVis += ((s.steer || 0) - s.steerVis) * Math.min(1, dt * 8);

    if (car.nitroUnlocked) {
      if (nitroActive) s.nitro = Math.max(0, s.nitro - 10 * dt);
      else s.nitro = Math.min(100, s.nitro + 10 * dt);
    } else s.nitro = 0;

    s.dist += s.speed * dt;
    s.time += dt;
    if (s.dist >= this.data.len) { s.finished = true; s.finishTime = s.time; }
  },

  /* ---------------- AI ---------------- */
  aiState(lane, base) {
    return { dist: 0, lat: lane, speed: 0, base, wobble: Math.random() * 6.28, finished: false, finishTime: 0, time: 0 };
  },
  aiStep(a, dt, playerDist) {
    if (a.finished) { a.time += dt; return; }
    let target = a.base;
    const gap = playerDist - a.dist;
    if (gap > 60) target *= 1.06;         /* rubber band */
    else if (gap < -60) target *= 0.95;
    a.speed += Math.min(target - a.speed, 12 * dt);
    a.dist += a.speed * dt;
    a.time += dt;
    a.lat = a.lat + Math.sin(a.time * 0.7 + a.wobble) * 0.004;
    if (a.dist >= this.data.len) { a.finished = true; a.finishTime = a.time; }
  },

  place(player, ais) {
    const score = o => o.finished ? this.data.len * 10 - o.finishTime : o.dist;
    let p = 1;
    ais.forEach(a => { if (score(a) > score(player)) p++; });
    return p;
  },

  /* ================= runtime (DOM + WebGL) ================= */
  opts: null, car: null, states: null, meshes: null,
  renderer: null, scene: null, camera: null,
  phase: 'idle', countT: 0, raceT: 0, raf: 0, lastT: 0, overT: 0,
  keys: {},

  start(raceDef, car, opts) {
    if (this.running) this.stop(false);
    if (typeof THREE === 'undefined') { if (opts.onQuit) opts.onQuit(); return; }
    this.opts = opts; this.car = car;
    if (!this.data) this.buildTrackData();

    this.running = true;
    this.keys = {};
    this.states = {
      player: this.newState(),
      ais: [this.aiState(-2.6, raceDef.ai[0] / 3.6), this.aiState(2.6, raceDef.ai[1] / 3.6)],
    };
    this.phase = 'count'; this.countT = 3.4; this.raceT = 0; this.overT = 0;

    this._buildRenderer();
    this._buildWorld();
    this._buildCars();
    this._bindKeys();

    const ss = this._hook('showScreen'); if (ss) ss('screen-race');
    const cd = this._el('countdown');
    if (cd) { cd.classList.remove('hidden'); cd.textContent = '3'; }
    this._hud(true);

    this.lastT = 0;
    const loop = t => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.lastT ? (t - this.lastT) / 1000 : 0.016);
      this.lastT = t;
      this._tick(dt);
    };
    this.raf = requestAnimationFrame(loop);
  },

  stop(hideScreen) {
    if (!this.running) return;
    this.running = false;
    if (this.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.raf);
    this.raf = 0;
    this._unbindKeys();
    if (typeof AudioFX !== 'undefined' && AudioFX.engineStop) AudioFX.engineStop();
    if (this.renderer && this.renderer.dispose) { try { this.renderer.dispose(); } catch (e) {} }
    this.renderer = null; this.scene = null; this.meshes = null;
    const ss2 = this._hook('showScreen'); if (hideScreen !== false && ss2) ss2('screen-hub');
  },

  _el(id) { return typeof document !== 'undefined' ? document.getElementById(id) : null; },
  _hook(n) {
    if (typeof window !== 'undefined' && typeof window[n] === 'function') return window[n];
    return null;
  },

  _bindKeys() {
    this._kd = e => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') this.keys.up = true;
      if (k === 'ArrowDown' || k === 's' || k === 'S') this.keys.down = true;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.keys.left = true;
      if (k === 'ArrowRight' || k === 'd' || k === 'D') this.keys.right = true;
      if (k === 'Shift') this.keys.nitro = true;
      if (k === 'Escape') this._pause();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(k) >= 0) e.preventDefault();
    };
    this._ku = e => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') this.keys.up = false;
      if (k === 'ArrowDown' || k === 's' || k === 'S') this.keys.down = false;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.keys.left = false;
      if (k === 'ArrowRight' || k === 'd' || k === 'D') this.keys.right = false;
      if (k === 'Shift') this.keys.nitro = false;
    };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
  },
  _unbindKeys() {
    if (this._kd) window.removeEventListener('keydown', this._kd);
    if (this._ku) window.removeEventListener('keyup', this._ku);
    this._kd = this._ku = null;
  },

  _pause() {
    if (!this.running) return;
    if (this.phase === 'paused') return;
    this.phase = 'paused';
    const sm = this._hook('showModal'); if (sm) {
      sm('RACE PAUSED', 'Take a breath. The coast isn’t going anywhere.', [
        { label: 'RESUME', primary: true, cb: () => { this.phase = 'run'; } },
        { label: 'EXIT RACE', cb: () => { this.stop(true); if (this.opts && this.opts.onQuit) this.opts.onQuit(); } },
      ]);
    }
  },

  /* ---------------- renderer + world ---------------- */
  _buildRenderer() {
    const canvas = this._el('race-canvas');
    const gs = this._hook('getSettings');
    const q = gs ? gs().quality : 'high';
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: q !== 'low' });
    if (this.renderer.setPixelRatio) this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : 1.75));
    if (this.renderer.setSize) this.renderer.setSize(canvas.clientWidth || 1280, canvas.clientHeight || 720, false);
    if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = false;   /* perf */
    if (this.renderer.toneMapping !== undefined && THREE.ACESFilmicToneMapping !== undefined) {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;
    }
    this.scene = new THREE.Scene();
    if (typeof Viewer !== 'undefined' && Viewer._makeEnv) { const env = Viewer._makeEnv(); if (env) this.scene.environment = env; }
    const sky = 0xc9dbe7;
    if (this.scene.background !== undefined) this.scene.background = new THREE.Color(sky);
    if (THREE.Fog) this.scene.fog = new THREE.Fog(sky, 90, 750);
    this.camera = new THREE.PerspectiveCamera(62, (canvas.clientWidth || 1280) / (canvas.clientHeight || 720), 0.1, 1200);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb8a88f, 0.9);
    const sun = new THREE.DirectionalLight(0xffe9c4, 1.15);
    sun.position.set(60, 90, -40);
    this.scene.add(hemi, sun);

    window.addEventListener('resize', this._onResize = () => {
      if (!this.renderer || !this.camera) return;
      const w = canvas.clientWidth || 1280, h = canvas.clientHeight || 720;
      this.renderer.setSize(w, h, false);
      if (this.camera.aspect !== undefined) { this.camera.aspect = w / Math.max(1, h); if (this.camera.updateProjectionMatrix) this.camera.updateProjectionMatrix(); }
    });
  },

  _ribbon(widthFn, y, mat, segs) {
    const d = this.data;
    const N = segs || this.SAMPLES;
    const pos = new Float32Array((N + 1) * 2 * 3);
    const idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = d.curve.getPointAt(t);
      const g = d.curve.getTangentAt(t);
      const nx = -g.z, nz = g.x;
      const w = widthFn(t);
      pos.set([p.x - nx * w, y, p.z - nz * w], i * 6);
      pos.set([p.x + nx * w, y, p.z + nz * w], i * 6 + 3);
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    if (geo.setAttribute) {
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      if (geo.setIndex) geo.setIndex(idx);
      if (geo.computeVertexNormals) geo.computeVertexNormals();
    }
    return new THREE.Mesh(geo, mat);
  },

  _buildWorld() {
    const d = this.data;
    const M = (c, met, r) => new THREE.MeshStandardMaterial({ color: c, metalness: met === undefined ? 0 : met, roughness: r === undefined ? 0.9 : r });

    /* ocean */
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 4200), M(0x2e6f8e, 0.35, 0.35));
    water.rotation.x = -Math.PI / 2;
    water.position.set(-350, -0.55, 1200);
    this.scene.add(water);

    /* promenade (wide ground ribbon) */
    this.scene.add(this._ribbon(() => 46, -0.12, M(0xb7ab93)));
    /* road */
    this.scene.add(this._ribbon(() => this.roadHalf, 0.0, M(0x33373c, 0, 0.95)));
    /* sidewalks edges */
    this.scene.add(this._ribbon(() => this.roadHalf + 1.4, -0.05, M(0x9aa0a6)));

    const dummy = new THREE.Object3D ? new THREE.Object3D() : {};
    const place = (inst, i, x, y, z, ry, sx, sy, sz) => {
      if (!inst.setMatrixAt || !dummy.position) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, ry || 0, 0);
      dummy.scale.set(sx || 1, sy || 1, sz || 1);
      if (dummy.updateMatrix) dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    };

    /* centre dashes */
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.02, 3), M(0xd8dde2), 200);
    for (let i = 0; i < 200; i++) {
      const p = this.trackPoint(d.len * (i / 200) + 4, 0);
      place(dashes, i, p.x, 0.015, p.z, Math.atan2(p.tx, p.tz));
    }
    if (dashes.instanceMatrix && dashes.instanceMatrix.needsUpdate !== undefined) dashes.instanceMatrix.needsUpdate = true;
    this.scene.add(dashes);

    /* guard rails */
    const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.55, 5), M(0x8f959c, 0.7, 0.4), 600);
    for (let i = 0; i < 300; i++) {
      const a = this.trackPoint(d.len * (i / 300), this.roadHalf + 0.9);
      const b = this.trackPoint(d.len * (i / 300), -(this.roadHalf + 0.9));
      const h = Math.atan2(a.tx, a.tz);
      place(rails, i * 2, a.x, 0.35, a.z, h);
      place(rails, i * 2 + 1, b.x, 0.35, b.z, h);
    }
    this.scene.add(rails);

    /* light poles */
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 8), M(0x5d646c, 0.6, 0.5), 96);
    for (let i = 0; i < 48; i++) {
      const side = i % 2 ? 1 : -1;
      const p = this.trackPoint(d.len * (i / 48), side * (this.roadHalf + 2.4));
      place(poles, i, p.x, 3.5, p.z);
    }
    this.scene.add(poles);

    /* city buildings on the right */
    const blds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M(0xcfd6dd, 0, 0.8), 140);
    const cols = [0xcfd6dd, 0xb9c2ca, 0xd8d2c4, 0xaeb6bd];
    for (let i = 0; i < 140; i++) {
      const t = (i / 140);
      const side = 1;
      const off = 26 + ((i * 37) % 34);
      const p = this.trackPoint(d.len * t + ((i * 13) % 17), side * off);
      const h = 9 + ((i * 53) % 30);
      place(blds, i, p.x, h / 2 - 0.1, p.z, ((i * 29) % 6) * 0.1, 8 + ((i * 31) % 9), h, 8 + ((i * 17) % 8));
    }
    if (blds.material && blds.material.color) blds.material.color.setHex(cols[0]);
    this.scene.add(blds);

    /* palms on the left (beach side) */
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 5, 6), M(0x7a5b3a), 90);
    const fronds = new THREE.InstancedMesh(new THREE.ConeGeometry(1.7, 1.6, 8), M(0x2f6b33), 90);
    for (let i = 0; i < 90; i++) {
      const p = this.trackPoint(d.len * (i / 90) + 6, -(this.roadHalf + 6 + ((i * 23) % 9)));
      place(trunks, i, p.x, 2.5, p.z);
      place(fronds, i, p.x, 5.6, p.z);
    }
    this.scene.add(trunks, fronds);

    /* start + finish gantries */
    const gantry = (dist, tex) => {
      const p = this.trackPoint(dist, 0);
      const h = Math.atan2(p.tx, p.tz);
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6.4, 8), M(0x3a4148, 0.6, 0.4));
      const pl = post.clone ? post.clone() : post;
      post.position.set(-(this.roadHalf + 1), 3.2, 0);
      pl.position.set(this.roadHalf + 1, 3.2, 0);
      const bannerMat = tex
        ? new THREE.MeshBasicMaterial({ map: tex })
        : M(0xd9480f, 0, 0.6);
      const banner = new THREE.Mesh(new THREE.BoxGeometry((this.roadHalf + 1) * 2, 1.1, 0.12), bannerMat);
      banner.position.set(0, 5.9, 0);
      g.add(post, pl, banner);
      g.position.set(p.x, 0, p.z);
      g.rotation.y = h;
      this.scene.add(g);
    };
    gantry(6, null);
    gantry(d.len - 2, this._checkerTex());
  },

  _checkerTex() {
    try {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 16;
      const x = c.getContext('2d');
      for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) {
        x.fillStyle = (i + j) % 2 ? '#111' : '#fff';
        x.fillRect(i * 8, j * 8, 8, 8);
      }
      return new THREE.CanvasTexture(c);
    } catch (e) { return null; }
  },

  _carMesh(car, tint) {
    let obj = null;
    if (typeof Viewer !== 'undefined' && Viewer._cache && Viewer._cache[car.id]) {
      obj = Viewer._cache[car.id].clone(true);
    } else if (typeof Viewer !== 'undefined' && Viewer._buildSampleCar) {
      const params = car.silhouette === 'super'
        ? { color: tint || car.paint || 0x888888, rim: 0xd8dde6, w: 1.9, l: 4.4, cabH: 0.34, cabL: 1.5, cabZ: -0.2, noseTilt: -0.1, wheelR: 0.34, wing: true }
        : { color: tint || car.swatchInt || car.paint || 0x888888, rim: 0xb9c0cc, w: 1.84, l: 4.3, cabH: 0.4, cabL: 1.7, cabZ: -0.12, noseTilt: -0.05, wheelR: 0.33, wing: false };
      obj = Viewer._buildSampleCar(params);
    } else {
      obj = new THREE.Group();
    }
    if (tint && obj.userData && obj.userData.paintMat && obj.userData.paintMat.color) obj.userData.paintMat.color.setHex(tint);
    return obj;
  },

  _buildCars() {
    this.meshes = {};
    const playerCar = this.opts.carDef || this.car;
    this.meshes.player = this._carMesh(playerCar, null);
    this.scene.add(this.meshes.player);

    const aiDefs = [
      { id: '__ai1', silhouette: 'coupe', swatchInt: 0x8a8f96 },
      { id: '__ai2', silhouette: 'coupe', swatchInt: 0x6d3a2a },
    ];
    this.meshes.ais = aiDefs.map(a => {
      const m = this._carMesh(a, a.swatchInt);
      this.scene.add(m);
      return m;
    });
  },

  /* ---------------- frame ---------------- */
  _tick(dt) {
    if (this.phase === 'paused') return;

    if (this.phase === 'count') {
      this.countT -= dt;
      const cd = this._el('countdown');
      const n = Math.ceil(this.countT);
      if (cd) {
        if (this.countT <= 0) { cd.textContent = 'GO'; if (!this._go) { this._go = true; if (typeof AudioFX !== 'undefined' && AudioFX.countBeep) AudioFX.countBeep(true); if (AudioFX && AudioFX.engineStart) AudioFX.engineStart(); } setTimeout(() => cd.classList.add('hidden'), 700); }
        else if (cd.textContent !== String(n)) { cd.textContent = String(n); if (typeof AudioFX !== 'undefined' && AudioFX.countBeep) AudioFX.countBeep(false); }
      }
      if (this.countT <= 0) this.phase = 'run';
    } else if (this.phase === 'run') {
      this.raceT += dt;
      const st = this.states;
      this.step(st.player, this.keys, dt, this.car);
      st.ais.forEach(a => this.aiStep(a, dt, st.player.dist));
      /* light contact with AI */
      st.ais.forEach(a => {
        if (Math.abs(a.dist - st.player.dist) < 5 && Math.abs(a.lat - st.player.lat) < 2.2) {
          st.player.speed = Math.min(st.player.speed, Math.max(a.speed * 0.9, 8));
        }
      });
      if (typeof AudioFX !== 'undefined' && AudioFX.raceSet) {
        AudioFX.raceSet(Math.min(1, st.player.speed / (this.car.top * 1.25)));
      }
      if (st.player.finished && this.phase === 'run') {
        this.phase = 'over';
        this.overT = 1.6;
        const place = this.place(st.player, st.ais);
        this._result = { place, time: st.player.finishTime };
        const banner = this._el('race-banner');
        if (banner) {
          banner.textContent = place === 1 ? '🏁 P1 — RACE WON' : '🏁 FINISHED P' + place;
          banner.classList.remove('hidden');
        }
        if (typeof AudioFX !== 'undefined') (place === 1 ? AudioFX.win : AudioFX.lose).call(AudioFX);
      }
    } else if (this.phase === 'over') {
      this.overT -= dt;
      this.states.ais.forEach(a => this.aiStep(a, dt, 0));
      if (this.overT <= 0 && this.opts && this.opts.onFinished && !this._sent) {
        this._sent = true;
        const r = this._result;
        this.stop(true);
        this.opts.onFinished(r);
        return;
      }
    }

    this._placeMeshes();
    this._hud(false);
    if (this.renderer && this.renderer.render) { try { this.renderer.render(this.scene, this.camera); } catch (e) {} }
  },

  _placeMeshes() {
    if (!this.meshes || !this.data) return;
    const st = this.states;
    const pp = this.trackPoint(st.player.dist, st.player.lat);
    const pm = this.meshes.player;
    if (pm && pm.position && pm.position.set) {
      pm.position.set(pp.x, 0, pp.z);
      if (pm.rotation) {
        pm.rotation.y = this.headingAt(st.player.dist) + st.player.steerVis * 0.22;
        pm.rotation.z = -st.player.steerVis * 0.05;   /* body roll */
      }
    }
    st.ais.forEach((a, i) => {
      const m = this.meshes.ais && this.meshes.ais[i];
      if (!m || !m.position || !m.position.set) return;
      const p = this.trackPoint(a.dist, a.lat);
      m.position.set(p.x, 0, p.z);
      if (m.rotation) m.rotation.y = this.headingAt(a.dist);
    });

    /* chase camera */
    const cam = this.camera;
    if (cam && cam.position && cam.position.set) {
      const back = this.trackPoint(Math.max(0, st.player.dist - 9.5), st.player.lat * 0.55);
      if (!this._camS) this._camS = { x: back.x, z: back.z };
      const k = 0.12;
      this._camS.x += (back.x - this._camS.x) * k;
      this._camS.z += (back.z - this._camS.z) * k;
      cam.position.set(this._camS.x, 3.3, this._camS.z);
      if (cam.lookAt) cam.lookAt(pp.x, 1.0, pp.z);
    }
  },

  _hud(reset) {
    const st = this.states;
    if (!st) return;
    const setT = (id, v) => { const e = this._el(id); if (e && e.textContent !== v) e.textContent = v; };
    setT('race-speed', String(Math.round(st.player.speed * 3.6)));
    setT('race-pos', String(this.place(st.player, st.ais)));
    const t = st.player.finished ? st.player.finishTime : this.raceT;
    const m = Math.floor(t / 60), s = (t % 60);
    setT('race-time', m + ':' + (s < 10 ? '0' : '') + s.toFixed(1));
    const nit = this._el('race-nitro');
    if (nit && nit.style) nit.style.width = Math.round(st.player.nitro) + '%';
    const pr = this._el('race-progress');
    if (pr && pr.style) pr.style.width = Math.round(Math.min(100, st.player.dist / this.data.len * 100)) + '%';
  },
};

if (typeof window !== 'undefined') window.Race = Race;
