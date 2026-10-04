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

  /* ---------------- pure physics (good handling) ---------------- */
  step(s, car, input, dt) {
    s.time += dt;
    if (s.finished) { s.speed = Math.max(0, s.speed - 4 * dt); s.dist += s.speed * dt; return s; }

    /* nitro */
    s.nitroOn = false;
    if (car.nitroUnlocked && input.nitro && s.nitro > 1 && s.speed > 5) {
      s.nitroOn = true;
      s.nitro = Math.max(0, s.nitro - 10 * dt);
    } else {
      s.nitro = Math.min(100, s.nitro + 10 * dt);
    }
    const top = s.nitroOn ? car.top * 1.25 : car.top;
    const acc = s.nitroOn ? car.accel * 2.2 : car.accel;

    /* longitudinal */
    if (input.up) s.speed += acc * Math.max(0.25, 1 - s.speed / top) * 2.0 * dt;
    else s.speed = Math.max(0, s.speed - 1.6 * dt);
    if (input.down) s.speed = Math.max(0, s.speed - car.brake * dt);
    s.speed = Math.min(s.speed, top);

    /* smoothed, grip-scaled steering + corner scrub */
    const steerT = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    s.steer = (s.steer || 0) + (steerT - (s.steer || 0)) * Math.min(1, dt * 9);
    const grip = 0.75 + car.handling01 * 0.55;
    const latRate = (3.2 + s.speed * 0.13) * grip;
    s.lat += s.steer * latRate * dt;
    if (Math.abs(s.steer) > 0.4 && s.speed > 25) s.speed -= s.speed * 0.12 * dt;
    s.steerVis += ((s.steer || 0) - s.steerVis) * Math.min(1, dt * 8);

    /* off-road scrub, hard clamp */
    const edge = this.track.roadHalf - 0.7;
    if (Math.abs(s.lat) > edge) s.speed -= s.speed * 1.2 * dt;
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
    if (THREE.Fog) sc.fog = new THREE.Fog(0xd3dce2, 80, 1000);

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

    /* centre dashes (instanced) */
    const dashCount = Math.floor(this.track.len / 14);
    const dash = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.18, 4),
      new THREE.MeshBasicMaterial({ color: 0xdfe3e6 }),
      dashCount
    );
    const M = (THREE.Matrix4 && typeof THREE.Matrix4 === 'function') ? new THREE.Matrix4() : null;
    const Q = (THREE.Quaternion && typeof THREE.Quaternion === 'function') ? new THREE.Quaternion() : null;
    for (let i = 0; i < dashCount; i++) {
      const d = i * 14 + 4;
      const p = this.trackPoint(d, 0);
      const h = this.headingAt(d);
      if (M && Q) {
        Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h);
        const eq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        Q.multiply(eq);
        M.compose(new THREE.Vector3(p.x, 0.04, p.z), Q, new THREE.Vector3(1, 1, 1));
        dash.setMatrixAt(i, M);
      }
    }
    sc.add(dash);

    /* sparse light poles — clean roadside */
    const poleCount = Math.floor(this.track.len / 220);
    const pole = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.09, 0.12, 7, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b7076, metalness: 0.6, roughness: 0.5 }),
      poleCount
    );
    for (let i = 0; i < poleCount; i++) {
      const p = this.trackPoint(i * 220 + 60, this.track.roadHalf + 2.2);
      if (M) {
        M.compose(new THREE.Vector3(p.x, 3.5, p.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
        pole.setMatrixAt(i, M);
      }
    }
    sc.add(pole);

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
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      if (this.renderer.setPixelRatio) this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = false;
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
      player: { dist: 0, lat: 0, speed: 0, steer: 0, steerVis: 0, nitro: 100, nitroOn: false, time: 0, finished: false },
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
    const map = { ArrowUp: 'up', KeyW: 'up', w: 'up', W: 'up', ArrowDown: 'down', KeyS: 'down', s: 'down', S: 'down', ArrowLeft: 'left', KeyA: 'left', a: 'left', A: 'left', ArrowRight: 'right', KeyD: 'right', d: 'right', D: 'right', ShiftLeft: 'nitro', ShiftRight: 'nitro', Shift: 'nitro' };
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
      if (this._count <= 0 && cd) cd.classList.add('hidden');
      this._placeMeshes();
      this._render();
      return;
    }

    this.step(st.player, car, this.input, dt);
    st.ais.forEach(a => this.aiStep(a, car, dt, st.player));

    if (typeof AudioFX !== 'undefined' && AudioFX.raceSet) AudioFX.raceSet(Math.min(1, st.player.speed / car.top));

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
        m.obj.rotation.y = this.headingAt(dist) + (steerVis || 0) * 0.22;
        m.obj.rotation.z = -(steerVis || 0) * 0.05;
      }
    };
    put(this.meshes[0], st.player.dist, st.player.lat, st.player.steerVis);
    put(this.meshes[1], st.ais[0].dist, st.ais[0].lat, 0);
    put(this.meshes[2], st.ais[1].dist, st.ais[1].lat, 0);

    const pp = this.trackPoint(st.player.dist, st.player.lat);
    const back = this.trackPoint(Math.max(0, st.player.dist - 9.5), st.player.lat * 0.55);
    const cam = this.camera;
    if (cam && cam.position && cam.position.set) {
      if (!this._camS) this._camS = { x: back.x, z: back.z };
      this._camS.x += (back.x - this._camS.x) * 0.12;
      this._camS.z += (back.z - this._camS.z) * 0.12;
      cam.position.set(this._camS.x, 3.3, this._camS.z);
      if (cam.lookAt) cam.lookAt(pp.x, 1.0, pp.z);
    }
  },

  _render() {
    try { this.renderer.render(this.scene, this.camera); } catch (e) {}
  },

  stop(finished, quit) {
    this.running = false;
    this.paused = false;
    if (this._raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._unbindKeys();
    if (typeof AudioFX !== 'undefined' && AudioFX.engineStop) AudioFX.engineStop();
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
