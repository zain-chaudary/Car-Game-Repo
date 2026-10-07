/* ================================================================
   RACE 1 — clean strip sprint (user-specified design).
   • You drive your active garage car (its GLB, factory finish).
   • Two rivals = the SAME car, different colours.
   • Clean map: road + lines + gantries + sparse poles + soft fog.
     No buildings, no clutter.
   • Good handling: smoothed steer, grip-scaled response, corner
     scrub, body roll, smoothed chase camera.
   ================================================================ */
'use strict';

const Race = {
  running: false,
  paused: false,
  renderer: null, scene: null, camera: null,
  track: null,
  states: null,
  meshes: null,
  raceDef: null, carDef: null, opts: null,
  input: { up: false, down: false, left: false, right: false, nitro: false },
  _raf: 0, _last: 0, _count: 0, _bannerT: 0, _done: false, _camS: null,

  /* ---------------- pure track math (no THREE needed) ---------------- */
  buildTrackData() {
    const ctrl = [
      [0, 0], [0, -260], [30, -520], [110, -780], [150, -1040],
      [110, -1300], [30, -1560], [0, -1820], [0, -2000],
    ];
    /* plain-JS Catmull-Rom resample */
    const samples = [];
    const P = i => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
    const SEG = 48;
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let sIdx = 0; sIdx < SEG; sIdx++) {
        const t = sIdx / SEG, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const z = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        samples.push({ x, z, tx: 0, tz: 0 });
      }
    }
    samples.push({ x: ctrl[ctrl.length - 1][0], z: ctrl[ctrl.length - 1][1], tx: 0, tz: 0 });
    for (let i = 0; i < samples.length; i++) {
      const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      samples[i].tx = (b.x - a.x) / l;
      samples[i].tz = (b.z - a.z) / l;
    }
    let len = 0;
    for (let i = 1; i < samples.length; i++) {
      len += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].z - samples[i - 1].z);
    }
    return { samples, len, roadHalf: 6 };
  },

  sampleAt(dist) {
    const t = this.track.samples;
    const f = Math.max(0, Math.min(1, dist / this.track.len)) * (t.length - 1);
    const i = Math.floor(f), j = Math.min(t.length - 1, i + 1), k = f - i;
    const a = t[i], b = t[j];
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, tx: a.tx + (b.tx - a.tx) * k, tz: a.tz + (b.tz - a.tz) * k };
  },

  trackPoint(dist, lat) {
    const s = this.sampleAt(dist);
    return { x: s.x + (-s.tz) * lat, z: s.z + (s.tx) * lat };
  },

  headingAt(dist) {
    const s = this.sampleAt(dist);
    return Math.atan2(s.tx, s.tz);
  },

  /* ---------------- pure physics — NFS-style heavy feel ---------------- */
  step(s, car, input, dt) {
    s.time += dt;
    if (s.finished) { s.speed = Math.max(0, s.speed - 4 * dt); s.dist += s.speed * dt; return s; }

    /* nitro: slow passive regen — DRIFTING is how you earn it */
    s.nitroOn = false;
    if (car.nitroUnlocked && input.nitro && s.nitro > 1 && s.speed > 5) {
      s.nitroOn = true;
      s.nitro = Math.max(0, s.nitro - 16 * dt);
    } else {
      s.nitro = Math.min(100, s.nitro + 6 * dt);
    }
    const top = s.nitroOn ? car.top * 1.32 : car.top;
    let acc = s.nitroOn ? car.accel * 2.6 : car.accel;
    if (s.launch > 0) { s.launch -= dt; acc *= 1.35; }

    /* longitudinal — eager throttle, strong brakes, feel the weight */
    const prevSpeed = s.speed;
    if (input.up) s.speed += acc * Math.max(0.3, 1 - s.speed / top) * 2.4 * dt;
    else s.speed = Math.max(0, s.speed - 1.8 * dt);
    if (input.down) s.speed = Math.max(0, s.speed - car.brake * 1.2 * dt);
    s.speed = Math.min(s.speed, top);
    const accelNow = (s.speed - prevSpeed) / Math.max(dt, 1e-4);
    s.pitch = (s.pitch || 0) + (Math.max(-1, Math.min(1, accelNow * 0.06)) - (s.pitch || 0)) * Math.min(1, dt * 5);

    /* steering — crisp at speed, planted by grip */
    const steerT = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    s.steer = (s.steer || 0) + (steerT - (s.steer || 0)) * Math.min(1, dt * 12);
    const grip = 0.8 + car.handling01 * 0.6;
    const authority = (2.6 + s.speed * 0.16) * grip / (1 + s.speed * 0.004);

    /* drift: handbrake (or committed high-speed steer) breaks traction —
       lateral velocity becomes momentum you carry through the corner */
    const kmh = s.speed * 3.6;
    const wantDrift = (input.drift && s.speed > 18) || (Math.abs(s.steer) > 0.9 && kmh > 150);
    s.drifting = !!wantDrift && Math.abs(s.steer) > 0.15;
    s.drift = s.drift || 0;
    if (s.drifting) {
      s.drift += (s.steer * authority * 1.25 - s.drift) * Math.min(1, dt * 2.4);
      s.speed -= s.speed * 0.10 * dt;                       /* light slide scrub */
      if (s.speed > 20) s.nitro = Math.min(100, s.nitro + Math.abs(s.drift) * 1.6 * dt);
    } else {
      s.drift += (s.steer * authority - s.drift) * Math.min(1, dt * 10);  /* grip snaps back */
      if (Math.abs(s.steer) > 0.4 && s.speed > 25) s.speed -= s.speed * 0.08 * dt;
    }
    s.lat += s.drift * dt;
    s.steerVis += ((s.steer || 0) - s.steerVis) * Math.min(1, dt * 10);
    s.driftVis = (s.driftVis || 0) + (Math.max(-0.5, Math.min(0.5, s.drift * 0.05)) - (s.driftVis || 0)) * Math.min(1, dt * 7);

    /* off-road kills the slide */
    const edge = this.track.roadHalf - 0.7;
    if (Math.abs(s.lat) > edge) { s.speed -= s.speed * 1.2 * dt; s.drift *= 0.9; }
    s.lat = Math.max(-(this.track.roadHalf + 3), Math.min(this.track.roadHalf + 3, s.lat));

    s.dist += s.speed * dt;
    if (s.dist >= this.track.len) { s.finished = true; s.finishTime = s.time; }
    return s;
  },

  aiStep(s, car, dt, player) {
    s.time += dt;
    if (s.finished) { s.speed = Math.max(0, s.speed - 4 * dt); s.dist += s.speed * dt; return s; }
    let ratio = s.ratio;
    /* gentle rubber band so racing stays close but fair */
    if (player.dist - s.dist > 150) ratio *= 1.06;
    else if (s.dist - player.dist > 150) ratio *= 0.94;
    const target = car.top * ratio;
    s.speed += (target - s.speed) * Math.min(1, dt * 0.9);
    s.lat += ((s.lane || 0) - s.lat) * Math.min(1, dt * 1.4);
    s.dist += s.speed * dt;
    if (s.dist >= this.track.len) { s.finished = true; s.finishTime = s.time; }
    return s;
  },

  place(a, b) {
    const av = a.finished ? this.track.len * 10 - a.finishTime : a.dist;
    const bv = b.finished ? this.track.len * 10 - b.finishTime : b.dist;
    return av === bv ? 0 : (av > bv ? 1 : -1);
  },

  /* ---------------- world ---------------- */
  _ribbon(offsetL, offsetR, y, color, basic) {
    const S = this.track.samples, n = S.length;
    const pos = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n; i++) {
      const p = this.trackPoint(i / (n - 1) * this.track.len, offsetL);
      const q = this.trackPoint(i / (n - 1) * this.track.len, offsetR);
      pos.set([p.x, y, p.z, q.x, y, q.z], i * 6);
    }
    const idx = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
    const mesh = new THREE.Mesh(g, m);
    this.scene.add(mesh);
    return mesh;
  },

  buildWorld() {
    const sc = this.scene;
    sc.background = new THREE.Color(0xd3dce2);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8f9788, 0.95);
    const sun = new THREE.DirectionalLight(0xfff2e0, 1.15);
    sun.position.set(120, 180, 60);
    sc.add(hemi, sun);

    /* clean dry-grass ground */
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3000, 3000),
      new THREE.MeshStandardMaterial({ color: 0xa9b096, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    sc.add(ground);

    /* asphalt + edge lines */
    this._ribbon(-this.track.roadHalf, this.track.roadHalf, 0.02, 0x3a3d42);
    this._ribbon(-(this.track.roadHalf - 0.35), -(this.track.roadHalf - 0.55), 0.035, 0xe8ebee, true);
    this._ribbon(this.track.roadHalf - 0.55, this.track.roadHalf - 0.35, 0.035, 0xe8ebee, true);

    /* centre dashes + roadside poles — merged plain geometry (max GL compat) */
    const pos = [], idx = [];
    let vi = 0;
    const quad = (d, lat, wdt, len, y) => {
      const p = this.trackPoint(d, lat);
      const t = this.sampleAt(d);
      const fx = t.tx, fz = t.tz, sx = -t.tz, sz = t.tx;
      const hw = wdt / 2, hl = len / 2;
      pos.push(
        p.x + fx * hl + sx * hw, y, p.z + fz * hl + sz * hw,
        p.x + fx * hl - sx * hw, y, p.z + fz * hl - sz * hw,
        p.x - fx * hl - sx * hw, y, p.z - fz * hl - sz * hw,
        p.x - fx * hl + sx * hw, y, p.z - fz * hl + sz * hw);
      idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    };
    for (let d = 4; d < this.track.len - 4; d += 14) quad(d, 0, 0.18, 4, 0.04);
    const dashGeo = new THREE.BufferGeometry();
    dashGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    dashGeo.setIndex(idx);
    dashGeo.computeVertexNormals();
    this.scene.add(new THREE.Mesh(dashGeo, new THREE.MeshBasicMaterial({ color: 0xdfe3e6 })));

    const ppos = [], pidx = [];
    let pvi = 0;
    const box = (x, z, wdt, hgt) => {
      const hw = wdt / 2;
      const c = [[x - hw, 0, z - hw], [x + hw, 0, z - hw], [x + hw, 0, z + hw], [x - hw, 0, z + hw],
                 [x - hw, hgt, z - hw], [x + hw, hgt, z - hw], [x + hw, hgt, z + hw], [x - hw, hgt, z + hw]];
      c.forEach(v => ppos.push(v[0], v[1], v[2]));
      const f = [[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];
      f.forEach(qq => pidx.push(pvi+qq[0], pvi+qq[1], pvi+qq[2], pvi+qq[0], pvi+qq[2], pvi+qq[3]));
      pvi += 8;
    };
    for (let d = 60; d < this.track.len; d += 220) {
      const p = this.trackPoint(d, this.track.roadHalf + 2.2);
      box(p.x, p.z, 0.22, 7);
    }
    const poleGeo = new THREE.BufferGeometry();
    poleGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ppos), 3));
    poleGeo.setIndex(pidx);
    poleGeo.computeVertexNormals();
    this.scene.add(new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x6b7076, metalness: 0.6, roughness: 0.5 })));

    /* start + finish gantries */
    this._gantry(18, 0xd9480f);
    this._gantry(this.track.len - 24, 0x1a1e24);
  },

  _gantry(dist, color) {
    const h = this.track.roadHalf + 1;
    const L = this.trackPoint(dist, -h), R = this.trackPoint(dist, h);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.5 });
    const post = new THREE.BoxGeometry(0.35, 6.4, 0.35);
    const pL = new THREE.Mesh(post, mat); pL.position.set(L.x, 3.2, L.z);
    const pR = new THREE.Mesh(post, mat); pR.position.set(R.x, 3.2, R.z);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(h * 2 + 0.4, 0.8, 0.4), mat);
    beam.position.set((L.x + R.x) / 2, 6.2, (L.z + R.z) / 2);
    beam.rotation.y = this.headingAt(dist);
    this.scene.add(pL, pR, beam);
  },

  /* rivals = YOUR car, different colours */
  _tintedClone(holder, hex) {
    const clone = holder.clone(true);
    clone.traverse(o => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        if (o.material.color) o.material.color.setHex(hex);
      }
    });
    return clone;
  },

  /* ---------------- lifecycle ---------------- */
  start(raceDef, car, opts) {
    if (this.running) this.stop(false);
    this.raceDef = raceDef; this.carDef = car; this.opts = opts || {};
    this.track = this.buildTrackData();

    const canvas = document.getElementById('race-canvas');
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      if (this.renderer.setPixelRatio) this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = false;
      if (THREE.sRGBEncoding !== undefined && this.renderer.outputEncoding !== undefined) {
        this.renderer.outputEncoding = THREE.sRGBEncoding;
      }
      if (THREE.ACESFilmicToneMapping !== undefined && this.renderer.toneMapping !== undefined) {
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      }
    }
    this.renderer.setSize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, false);
    this.scene = new THREE.Scene();
    if (typeof Viewer !== 'undefined' && Viewer._makeEnv) { const env = Viewer._makeEnv(); if (env) this.scene.environment = env; }
    this.camera = new THREE.PerspectiveCamera(62, (canvas.clientWidth || 16) / (canvas.clientHeight || 9), 0.1, 1400);
    this.buildWorld();

    /* cars: you + two same-model rivals in different colours */
    const holder = (typeof Viewer !== 'undefined' && Viewer._cache) ? Viewer._cache[car.id] : null;
    this.meshes = [];
    const mk = (obj, dist, lat) => {
      this.scene.add(obj);
      this.meshes.push({ obj, dist, lat });
      return obj;
    };
    if (holder) {
      mk(holder.clone(true), 0, 0);
      mk(this._tintedClone(holder, 0xc22f2f), 5, -3.2);
      mk(this._tintedClone(holder, 0x2f5fc2), 5, 3.2);
    }

    this.states = {
      player: { dist: 0, lat: 0, speed: 0, steer: 0, steerVis: 0, drift: 0, driftVis: 0, drifting: false, pitch: 0, nitro: 100, nitroOn: false, time: 0, finished: false },
      ais: [
        { dist: 5, lat: -3.2, lane: -3.2, ratio: raceDef.ai[0], speed: 0, time: 0, finished: false },
        { dist: 5, lat: 3.2, lane: 3.2, ratio: raceDef.ai[1], speed: 0, time: 0, finished: false },
      ],
    };
    this._count = 3.4; this._bannerT = 0; this._done = false; this._camS = null;
    this.paused = false;
    this.running = true;

    const cd = document.getElementById('countdown');
    if (cd) { cd.classList.remove('hidden'); cd.textContent = '3'; }
    const banner = document.getElementById('race-banner');
    if (banner) banner.classList.add('hidden');
    const intro = document.getElementById('race-intro');
    if (intro) {
      intro.innerHTML = (raceDef.name || 'RACE 1') + '<small>' + (raceDef.map || '') + ' · ' + (raceDef.dist || '') + '</small>';
      intro.classList.remove('hidden');
    }
    const msg = document.getElementById('race-msg');
    if (msg) msg.classList.add('hidden');
    this._msgT = 0; this._lastPos = 1; this._lastRev = 0;

    this._bindKeys();
    if (typeof AudioFX !== 'undefined' && AudioFX.engineStart) AudioFX.engineStart();

    this._last = 0;
    const loop = ts => {
      if (!this.running) return;
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this._last ? (ts - this._last) / 1000 : 0.016);
      this._last = ts;
      if (!this.paused) this._tick(dt);
    };
    this._raf = requestAnimationFrame(loop);
    if (typeof window !== 'undefined') window.showScreen('screen-race');
  },

  _bindKeys() {
    this._unbindKeys();
    const map = { ArrowUp: 'up', KeyW: 'up', w: 'up', W: 'up', ArrowDown: 'down', KeyS: 'down', s: 'down', S: 'down', ArrowLeft: 'left', KeyA: 'left', a: 'left', A: 'left', ArrowRight: 'right', KeyD: 'right', d: 'right', D: 'right', ShiftLeft: 'nitro', ShiftRight: 'nitro', Shift: 'nitro', Space: 'drift', ' ': 'drift' };
    this._kd = e => {
      if (e.key === 'Escape' || e.code === 'Escape') { e.preventDefault(); this._pauseToggle(); return; }
      const k = map[e.code] || map[e.key];
      if (k) { e.preventDefault(); this.input[k] = true; }
    };
    this._ku = e => { const k = map[e.code] || map[e.key]; if (k) this.input[k] = false; };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
  },

  _unbindKeys() {
    if (this._kd) { window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku); this._kd = null; }
  },

  _pauseToggle() {
    if (!this.running || this._done) return;
    this.paused = !this.paused;
    if (typeof window !== 'undefined' && window.showModal) {
      window.showModal('PAUSED', 'RACE 1 — ' + this.raceDef.name, [
        { label: 'RESUME', primary: true, cb: () => { this.paused = false; } },
        { label: 'EXIT RACE', cb: () => this.stop(false, true) },
      ]);
    }
  },

  _tick(dt) {
    const st = this.states, car = this.carDef;

    if (this._count > 0) {
      this._count -= dt;
      const cd = document.getElementById('countdown');
      const n = Math.ceil(this._count);
      if (cd) cd.textContent = n > 0 ? String(n) : 'GO';
      if (this._prevN !== n && typeof AudioFX !== 'undefined' && AudioFX.countBeep) { AudioFX.countBeep(n <= 0); this._prevN = n; }
      if (this.input.up && typeof AudioFX !== 'undefined' && AudioFX.rev && st.player.time >= 0) {
        this._lastRev += dt;
        if (this._lastRev > 0.45) { this._lastRev = 0; AudioFX.rev(0.5 + Math.random() * 0.4); }
      }
      if (this._count <= 0) {
        if (cd) cd.classList.add('hidden');
        const intro = document.getElementById('race-intro');
        if (intro) intro.classList.add('hidden');
        if (this.input.up) { st.player.launch = 0.9; this._say('PERFECT LAUNCH'); }
      }
      this._placeMeshes();
      this._render();
      return;
    }

    this.step(st.player, car, this.input, dt);
    st.ais.forEach(a => this.aiStep(a, car, dt, st.player));

    if (typeof AudioFX !== 'undefined' && AudioFX.raceSet) AudioFX.raceSet(Math.min(1, st.player.speed / car.top));
    if (typeof AudioFX !== 'undefined' && AudioFX.driftSet) AudioFX.driftSet(st.player.drifting && st.player.speed > 18);
    if (st.player.nitroOn && !this._nitroWas && typeof AudioFX !== 'undefined' && AudioFX.nitroHit) AudioFX.nitroHit();
    this._nitroWas = st.player.nitroOn;
    const dEl = document.getElementById('race-drift');
    if (dEl) dEl.classList.toggle('hidden', !(st.player.drifting && st.player.speed > 18));
    if (pos !== this._lastPos) {
      this._say('P' + pos + (pos < this._lastPos ? ' ▲' : ' ▼'));
      this._lastPos = pos;
    }
    if (this._msgT > 0) {
      this._msgT -= dt;
      if (this._msgT <= 0) { const m = document.getElementById('race-msg'); if (m) m.classList.add('hidden'); }
    }
    this._fx(dt);

    /* HUD */
    const all = [st.player].concat(st.ais);
    const pos = 1 + st.ais.filter(a => this.place(a, st.player) > 0).length;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('race-pos', String(pos));
    const mm = Math.floor(st.player.time / 60), ss = (st.player.time % 60).toFixed(1);
    set('race-time', mm + ':' + (ss < 10 ? '0' : '') + ss);
    set('race-speed', String(Math.round(st.player.speed * 3.6)));
    const nit = document.getElementById('race-nitro');
    if (nit) nit.style.width = st.player.nitro + '%';
    const prog = document.getElementById('race-progress');
    if (prog) prog.style.width = Math.min(100, st.player.dist / this.track.len * 100) + '%';

    if (st.player.finished && !this._done) {
      this._done = true;
      this._bannerT = 1.6;
      const banner = document.getElementById('race-banner');
      if (banner) {
        banner.textContent = pos === 1 ? 'P1 — RACE 1 WON' : 'FINISHED P' + pos;
        banner.classList.remove('hidden');
      }
      if (typeof AudioFX !== 'undefined') (pos === 1 ? AudioFX.win : AudioFX.lose).call(AudioFX);
    }
    if (this._done) {
      this._bannerT -= dt;
      if (this._bannerT <= 0) { this.stop(true); return; }
    }

    this._placeMeshes();
    this._render();
  },

  _placeMeshes() {
    const st = this.states;
    const put = (m, dist, lat, steerVis) => {
      if (!m || !m.obj) return;
      const p = this.trackPoint(dist, lat);
      if (m.obj.position && m.obj.position.set) m.obj.position.set(p.x, 0, p.z);
      if (m.obj.rotation) {
        m.obj.rotation.y = this.headingAt(dist) + (steerVis || 0) * 0.22 + (driftVis || 0);
        m.obj.rotation.z = -(steerVis || 0) * 0.05 - (driftVis || 0) * 0.22;
        if (pitch !== undefined) m.obj.rotation.x = pitch * 0.02;
      }
    };
    put(this.meshes[0], st.player.dist, st.player.lat, st.player.steerVis, st.player.driftVis, st.player.pitch || 0);
    put(this.meshes[1], st.ais[0].dist, st.ais[0].lat, 0);
    put(this.meshes[2], st.ais[1].dist, st.ais[1].lat, 0);

    const pp = this.trackPoint(st.player.dist, st.player.lat);
    const back = this.trackPoint(Math.max(0, st.player.dist - 9.5), st.player.lat * 0.55);
    const cam = this.camera;
    if (cam && cam.position && cam.position.set) {
      if (!this._camS) this._camS = { x: back.x, z: back.z };
      this._camS.x += (back.x - this._camS.x) * 0.12;
      this._camS.z += (back.z - this._camS.z) * 0.12;
      const ratio = Math.min(1, st.player.speed / this.carDef.top);
      let sx = 0, sy = 0;
      if (st.player.nitroOn || ratio > 0.82) {
        const k = st.player.nitroOn ? 0.09 : 0.04;
        sx = (Math.random() - 0.5) * k; sy = (Math.random() - 0.5) * k;
      }
      cam.position.set(this._camS.x + sx, 3.3 + sy, this._camS.z);
      if (cam.fov !== undefined) {
        cam.fov = 62 + ratio * 12 + (st.player.nitroOn ? 8 : 0);
        if (cam.updateProjectionMatrix) cam.updateProjectionMatrix();
      }
      if (cam.lookAt) cam.lookAt(pp.x, 1.0, pp.z);
    }
  },

  _say(text) {
    const m = document.getElementById('race-msg');
    if (m) { m.textContent = text; m.classList.remove('hidden'); }
    this._msgT = 1.1;
  },

  /* ---------- feel fx: drift smoke + nitro flames ---------- */
  _fxInit() {
    if (this._smoke) return;
    try {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const x = c.getContext('2d');
      if (!x) { this._smoke = null; return; }
      const g = x.createRadialGradient(32, 32, 4, 32, 32, 30);
      g.addColorStop(0, 'rgba(240,240,240,.85)');
      g.addColorStop(1, 'rgba(240,240,240,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);
      this._smokeTex = tex;
      this._smoke = [];
      for (let i = 0; i < 40; i++) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false })
        );
        m.visible = false;
        this.scene.add(m);
        this._smoke.push({ m, life: 0 });
      }
      const flameMat = new THREE.MeshBasicMaterial({ color: 0x6fc8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      this._flames = [-0.55, 0.55].map(() => {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.1, 8), flameMat.clone());
        f.visible = false;
        this.scene.add(f);
        return f;
      });
    } catch (e) { this._smoke = null; }
  },

  _fx(dt) {
    if (!this._smokeInit) { this._smokeInit = true; this._fxInit(); }
    if (!this._smoke) return;
    const st = this.states;
    /* spawn smoke at rear wheels while drifting */
    if (st.player.drifting && st.player.speed > 18) {
      for (const side of [-0.8, 0.8]) {
        const p = this._smoke.find(q => q.life <= 0);
        if (p) {
          const rp = this.trackPoint(Math.max(0, st.player.dist - 1.9), st.player.lat + side);
          p.life = 0.7;
          p.m.visible = true;
          p.m.position.set(rp.x, 0.25, rp.z);
          p.m.material.opacity = 0.5;
          p.m.scale.set(0.7, 0.7, 0.7);
        }
      }
    }
    this._smoke.forEach(q => {
      if (q.life > 0) {
        q.life -= dt;
        q.m.position.y += dt * 1.1;
        const sc = q.m.scale.x + dt * 2.4;
        q.m.scale.set(sc, sc, sc);
        q.m.material.opacity = Math.max(0, q.life) * 0.7;
        if (q.m.lookAt && this.camera) q.m.lookAt(this.camera.position);
        if (q.life <= 0) q.m.visible = false;
      }
    });
    /* nitro flames behind the car */
    if (this._flames) {
      this._flames.forEach((f, i) => {
        const on = st.player.nitroOn;
        f.visible = on;
        if (on) {
          const p = this.trackPoint(Math.max(0, st.player.dist - 2.3), st.player.lat + (i ? 0.55 : -0.55));
          f.position.set(p.x, 0.5, p.z);
          f.rotation.y = this.headingAt(st.player.dist) + Math.PI;
          f.rotation.z = Math.PI / 2;
          f.scale.set(1, 0.8 + Math.random() * 0.5, 1);
        }
      });
    }
  },

  _render() {
    if (!this.renderer) return;
    try { this.renderer.render(this.scene, this.camera); this._glBad = 0; return; } catch (e) {
      this._glBad = (this._glBad || 0) + 1;
      if (this._glBad === 1) this.scene.fog = null;
      else if (this._glBad === 2) { this._smoke = null; (this._flames || []).forEach(f => { f.visible = false; }); }
      else if (this._glBad === 3 && this.renderer.toneMapping !== undefined) this.renderer.toneMapping = 0;
      try { this.renderer.render(this.scene, this.camera); } catch (e2) {
        const b = document.getElementById('race-banner');
        if (b && this._glBad < 6) { b.textContent = 'GL: ' + String(e2 && e2.message ? e2.message : e2).slice(0, 60); b.classList.remove('hidden'); }
        if (typeof console !== 'undefined' && console.error) console.error('race render:', e2);
      }
    }
  },

  stop(finished, quit) {
    this.running = false;
    this.paused = false;
    if (this._raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._unbindKeys();
    if (typeof AudioFX !== 'undefined' && AudioFX.engineStop) AudioFX.engineStop();
    if (typeof AudioFX !== 'undefined' && AudioFX.driftSet) AudioFX.driftSet(false);
    const cd = document.getElementById('countdown');
    if (cd) cd.classList.add('hidden');
    if (typeof window !== 'undefined' && window.showScreen) window.showScreen(quit ? 'screen-career' : 'screen-career');
    if (finished && this.opts && this.opts.onFinished) {
      const st = this.states;
      const pos = 1 + st.ais.filter(a => this.place(a, st.player) > 0).length;
      this.opts.onFinished({ place: pos, time: st.player.finishTime || st.player.time });
    }
    if (quit && this.opts && this.opts.onQuit) this.opts.onQuit();
  },
};

if (typeof window !== 'undefined') window.Race = Race;
