/* ================================================================
   GarageViewer v2 — realistic 3D showcase.
   • Cars STAND STILL in the garage (clean 3/4 hero angle).
   • The turntable spins ONLY in full view mode; outside it the
     renderer only redraws when something actually changed
     (on-demand rendering → GPU stays idle, game stays light).
   • GLB DROP-IN with a load token: rapid car switching can never
     leave a duplicate/floating car behind.
   • Realistic studio: soft daylight rig + concrete floor (no neon).
   • Textured GLB materials are never re-tinted (factory finishes).
   ================================================================ */
'use strict';

const Viewer = {
  ok: false,
  canvas: null,
  renderer: null,
  scene: null,
  camera: null,
  pivot: null,
  carGroup: null,
  raf: 0,
  dirty: true,
  currentId: null,
  viewMode: false,
  _loadToken: 0,
  _cache: {},

  /* orbit state — static hero angle by default */
  dist: 7.8, targetDist: 7.8,
  yaw: 0.62, pitch: 0.14, targetPitch: 0.14,
  drag: null, vel: 0,

  quality: 'high',

  /* ---------------- boot ---------------- */
  init(canvas, quality) {
    this.canvas = canvas;
    this.quality = quality || 'high';
    if (typeof THREE === 'undefined') return false;
    if (THREE.Cache) THREE.Cache.enabled = true;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: this.quality !== 'low', alpha: true,
      });
      this.renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);
      if (this.renderer.setPixelRatio) {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 1.5));
      }
      if (this.renderer.shadowMap) {
        this.renderer.shadowMap.enabled = this.quality !== 'low';
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      if (THREE.sRGBEncoding !== undefined && this.renderer.outputEncoding !== undefined) {
        this.renderer.outputEncoding = THREE.sRGBEncoding;
      }
      if (this.renderer.toneMapping !== undefined && THREE.ACESFilmicToneMapping !== undefined) {
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;
      }
    } catch (e) { this.ok = false; return false; }

    this.scene = new THREE.Scene();
    this.scene.environment = this._makeEnv();
    this.camera = new THREE.PerspectiveCamera(36, (canvas.clientWidth || 800) / (canvas.clientHeight || 600), 0.1, 120);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this._buildLights();
    this._buildFloor();
    this._bindInput();
    this.ok = true;
    this.dirty = true;
    this.start();
    return true;
  },

  start() {
    if (!this.ok || this.raf) return;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this._tick();
    };
    this.raf = requestAnimationFrame(loop);
  },

  stop() {
    if (this.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.raf);
    this.raf = 0;
  },

  /* preload a car model at boot so the garage opens instantly */
  preload(car, cb) {
    const done = () => { if (cb) cb(); };
    if (!car.model || this._cache[car.id]) { done(); return; }
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader !== 'function') { done(); return; }
    try {
      const loader = new THREE.GLTFLoader();
      loader.load(car.model, g => {
        this._cache[car.id] = this._fitAndPlace(g.scene || g.scenes[0]);
        done();
      }, undefined, () => done());
    } catch (e) { done(); }
  },

  setQuality(q) {
    this.quality = q;
    if (!this.ok) return;
    try {
      if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = q !== 'low';
      if (this.renderer.setPixelRatio) {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : 1.5));
      }
      this.dirty = true;
    } catch (e) {}
  },

  /* cheap studio environment map → real reflections on paint/glass */
  _makeEnv() {
    try {
      const mk = (top, bottom) => {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        const x = c.getContext('2d');
        const g = x.createLinearGradient(0, 0, 0, 16);
        g.addColorStop(0, top); g.addColorStop(1, bottom);
        x.fillStyle = g; x.fillRect(0, 0, 16, 16);
        return c;
      };
      const faces = [
        mk('#e8eef4', '#aebac6'), mk('#e8eef4', '#aebac6'),
        mk('#f7fafc', '#e2e9ef'), mk('#565d66', '#31363d'),
        mk('#efe6d8', '#c0cad4'), mk('#dfe7ee', '#b0bcc8'),
      ];
      const tex = new THREE.CubeTexture(faces);
      tex.needsUpdate = true;
      return tex;
    } catch (e) { return null; }
  },

  /* ---------------- realistic studio environment ---------------- */
  _buildLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x9aa0a6, 0.85);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff6ea, 1.25);
    key.position.set(5, 8, 4);
    if (key.castShadow !== undefined) {
      key.castShadow = true;
      if (key.shadow) {
        if (key.shadow.mapSize) { key.shadow.mapSize.width = this.quality === 'low' ? 512 : 1024; key.shadow.mapSize.height = this.quality === 'low' ? 512 : 1024; }
        if (key.shadow.camera) { key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 10; key.shadow.camera.bottom = -10; key.shadow.camera.near = 1; key.shadow.camera.far = 30; }
        if (key.shadow.bias !== undefined) key.shadow.bias = -0.0004;
      }
    }
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xe8eef5, 0.45);
    fill.position.set(-6, 4, -3);
    const rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(0, 3, -8);
    this.scene.add(fill, rim);
  },

  _buildFloor() {
    /* polished concrete with a sheen */
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(11, 48),
      new THREE.MeshStandardMaterial({ color: 0x878d94, metalness: 0.3, roughness: 0.42 })
    );
    floor.rotation.x = -Math.PI / 2;
    if (floor.receiveShadow !== undefined) floor.receiveShadow = true;
    this.pivot.add(floor);

    /* subtle painted service circle */
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(5.1, 5.24, 96),
      new THREE.MeshBasicMaterial({ color: 0x878d94, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    this.pivot.add(ring);
  },

  /* ---------------- sample (procedural) cars ---------------- */
  _paintMat(hex) {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), metalness: 0.75, roughness: 0.32 });
  },

  _wheel(r, w, rimHex) {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, w, 24),
      new THREE.MeshStandardMaterial({ color: 0x141518, metalness: 0.05, roughness: 0.95 })
    );
    tire.rotation.z = Math.PI / 2;
    if (tire.castShadow !== undefined) tire.castShadow = true;
    g.add(tire);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.58, r * 0.58, w * 1.02, 18),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(rimHex), metalness: 0.9, roughness: 0.25 })
    );
    rim.rotation.z = Math.PI / 2;
    g.add(rim);

    const spokeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(rimHex), metalness: 0.85, roughness: 0.35 });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, r * 0.95, 0.05), spokeMat);
      s.rotation.x = (i / 5) * Math.PI * 2;
      g.add(s);
    }
    return g;
  },

  /* tuned so every box visually connects — no floating parts */
  _buildSampleCar(p) {
    const g = new THREE.Group();
    const paint = this._paintMat(p.color);
    const dark = new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.4, roughness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x101c26, metalness: 0.9, roughness: 0.12, transparent: true, opacity: 0.75,
    });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.95, roughness: 0.2 });

    const box = (w, h, d, mat, x, y, z, rx) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      if (m.castShadow !== undefined) m.castShadow = true;
      g.add(m);
      return m;
    };

    const bodyTop = 0.75;
    box(p.w, 0.26, p.l, paint, 0, 0.36, 0);              /* chassis */
    box(p.w * 0.96, 0.30, p.l * 0.92, paint, 0, 0.60, 0); /* main body (top = .75) */
    box(p.w * 0.88, 0.14, p.l * 0.24, paint, 0, 0.68, p.l * 0.40, p.noseTilt); /* nose */
    box(p.w * 0.90, 0.18, p.l * 0.20, paint, 0, 0.70, -p.l * 0.42);            /* tail */
    box(p.w * 1.0, 0.08, p.l * 0.6, dark, 0, 0.26, 0);   /* skirt */
    /* cabin sits exactly on body top */
    box(p.w * 0.74, p.cabH, p.cabL, glass, 0, bodyTop + p.cabH / 2 - 0.02, p.cabZ);
    box(p.w * 0.62, 0.06, p.cabL * 0.92, paint, 0, bodyTop + p.cabH + 0.0, p.cabZ);
    box(p.w * 0.70, 0.05, p.cabL * 0.5, glass, 0, bodyTop + p.cabH * 0.55, p.cabZ + p.cabL * 0.62, -0.55);

    if (p.wing) {
      box(p.w * 0.9, 0.045, 0.3, dark, 0, 1.12, -p.l * 0.5);
      box(0.07, 0.22, 0.18, dark, -p.w * 0.38, 1.0, -p.l * 0.48);
      box(0.07, 0.22, 0.18, dark, p.w * 0.38, 1.0, -p.l * 0.48);
    }
    box(p.w * 0.78, 0.1, 0.26, dark, 0, 0.26, -p.l * 0.52);
    [-0.28, 0.28].forEach(x => {
      const e = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 12), chrome);
      e.rotation.x = Math.PI / 2;
      e.position.set(x, 0.3, -p.l * 0.54);
      g.add(e);
    });

    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f7fa, emissiveIntensity: 0.9 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xb3121f, emissive: 0xb3121f, emissiveIntensity: 0.8 });
    [-1, 1].forEach(s => {
      box(p.w * 0.2, 0.07, 0.05, headMat, s * p.w * 0.3, 0.68, p.l * 0.5);
      box(p.w * 0.24, 0.06, 0.04, tailMat, s * p.w * 0.3, 0.74, -p.l * 0.52);
      box(0.09, 0.06, 0.14, paint, s * (p.w / 2 + 0.06), bodyTop + p.cabH * 0.7, p.cabZ + 0.2);
    });
    box(p.w * 0.66, 0.035, 0.04, tailMat, 0, 0.74, -p.l * 0.52);

    /* wheels */
    const wheels = [];
    [[-1, 1], [-1, -1], [1, 1], [1, -1]].forEach(q => {
      const wh = this._wheel(p.wheelR, 0.24, p.rim);
      wh.position.set(q[0] * (p.w / 2), p.wheelR, q[1] * p.l * 0.32);
      g.add(wh);
      wheels.push(wh);
    });

    const glow = new THREE.PointLight(0x000000, 0, 0.01);
    glow.position.set(0, 0.12, 0);
    g.add(glow);

    const paintList = [];
    g.traverse(o => { if (o.material === paint) paintList.push(o); });
    g.userData = { wheels, glow, paintMat: paint, glassMat: glass };
    g.userData.paintMeshes = paintList;
    return g;
  },

  /* ---------------- GLB loading ---------------- */
  _tryGLB(url, onLoaded, onMissing) {
    if (typeof fetch !== 'function' || typeof THREE === 'undefined' ||
        typeof THREE.GLTFLoader !== 'function') { onMissing(); return; }
    fetch(url, { method: 'HEAD' })
      .then(r => { if (!r.ok) throw new Error('no glb'); return url; })
      .then(u => {
        const loader = new THREE.GLTFLoader();
        loader.load(u,
          gltf => onLoaded(gltf.scene || gltf.scenes[0]),
          undefined,
          () => onMissing());
      })
      .catch(() => onMissing());
  },

  _fitAndPlace(model) {
    const bb = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3(); bb.getSize(size);
    const scale = 4.4 / Math.max(size.x, size.z, 0.001);
    model.scale.setScalar(scale);
    const bb2 = new THREE.Box3().setFromObject(model);
    const size2 = new THREE.Vector3(); bb2.getSize(size2);
    const center = new THREE.Vector3(); bb2.getCenter(center);
    model.position.set(-center.x, -bb2.min.y, -center.z);

    const holder = new THREE.Group();
    holder.add(model);

    /* re-tint only UNTEXTURED materials — atlas-painted GLBs keep factory finish */
    const paintMats = [], rimMats = [];
    holder.traverse(o => {
      if (!o.material) return;
      const n = (o.name || '').toLowerCase();
      const mn = (o.material.name || '').toLowerCase();
      const tag = n + ' ' + mn;
      const textured = !!o.material.map;
      if (!textured && /paint|body|shell|chassis/.test(tag)) paintMats.push(o.material);
      if (!textured && /rim/.test(tag) && !/tire|tyre/.test(tag)) rimMats.push(o.material);
      if (o.castShadow !== undefined) o.castShadow = true;
    });
    const glow = new THREE.PointLight(0x000000, 0, 0.01);
    glow.position.set(0, 0.15, 0);
    holder.add(glow);
    holder.userData = { paintMats, rimMats, isGLB: true, model, glow };
    return holder;
  },

  /* ---------------- show a car (race-safe) ---------------- */
  showCar(car, look) {
    if (!this.ok) return;
    this.currentId = car.id;
    this._loadToken++;
    const token = this._loadToken;

    /* remove EVERY previous car — no duplicates can survive */
    for (let i = this.pivot.children.length - 1; i >= 0; i--) {
      const c = this.pivot.children[i];
      if (c.userData && c.userData.isCar) this.pivot.remove(c);
    }
    this.carGroup = null;

    const placeIt = obj => {
      if (token !== this._loadToken) return;   /* stale load — discard */
      obj.userData.isCar = true;
      this.pivot.add(obj);
      this.carGroup = obj;
      this.applyLook(look);
      this.dirty = true;
    };

    const params = car.silhouette === 'super'
      ? { color: car.paint, rim: 0xd8dde6, w: 1.9, l: 4.4, cabH: 0.34, cabL: 1.5, cabZ: -0.2,
          noseTilt: -0.1, wheelR: 0.34, wing: true }
      : { color: car.paint, rim: 0xb9c0cc, w: 1.84, l: 4.3, cabH: 0.4, cabL: 1.7, cabZ: -0.12,
          noseTilt: -0.05, wheelR: 0.33, wing: false };

    const cached = this._cache[car.id];
    if (cached) {
      placeIt(cached.clone(true));
    } else {
      this._tryGLB(car.model || ('assets/models/' + car.id + '.glb'),
        glb => { const h = this._fitAndPlace(glb); this._cache[car.id] = h; placeIt(h.clone(true)); },
        () => placeIt(this._buildSampleCar(params)));
    }
  },

  /* ---------------- cosmetics ---------------- */
  applyLook(look) {
    if (!this.ok || !this.carGroup) return;
    const ud = this.carGroup.userData || {};
    const paintHex = look && look.paintHex !== undefined ? look.paintHex : 0xd8352f;
    const rimHex = look && look.rimHex !== undefined ? look.rimHex : 0xc9ced8;
    const glowHex = look && look.glowHex !== undefined ? look.glowHex : 0x000000;
    const tint = look && look.tint !== undefined ? look.tint : 0;

    if (ud.isGLB) {
      (ud.paintMats || []).forEach(m => { if (m && m.color) m.color.setHex(paintHex); });
      (ud.rimMats || []).forEach(m => { if (m && m.color) m.color.setHex(rimHex); });
    } else {
      if (ud.paintMat && ud.paintMat.color) ud.paintMat.color.setHex(paintHex);
      (ud.wheels || []).forEach(w => {
        w.children.forEach(c => {
          if (c.material && c.material.color && c.material.metalness > 0.8) c.material.color.setHex(rimHex);
        });
      });
      if (ud.glassMat) ud.glassMat.opacity = Math.max(0.3, 0.78 - tint * 0.16);
    }
    if (ud.glow) {
      const on = !!glowHex;
      ud.glow.color.setHex(on ? glowHex : 0x000000);
      ud.glow.intensity = on ? 1.6 : 0;
      ud.glow.distance = on ? 4.5 : 0.01;
    }
    this.dirty = true;
  },

  /* ---------------- interaction ---------------- */
  _bindInput() {
    const c = this.canvas;
    if (!c || !c.addEventListener) return;

    c.addEventListener('pointerdown', e => {
      this.drag = { x: e.clientX, y: e.clientY };
      this.vel = 0;
      if (c.setPointerCapture) { try { c.setPointerCapture(e.pointerId); } catch (err) {} }
    });
    c.addEventListener('pointermove', e => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      this.drag = { x: e.clientX, y: e.clientY };
      this.yaw -= dx * 0.008;
      this.targetPitch = Math.max(0.02, Math.min(0.9, this.targetPitch + dy * 0.004));
      this.vel = -dx * 0.0005;
      this.dirty = true;
    });
    const up = () => { this.drag = null; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', up);
    c.addEventListener('wheel', e => {
      e.preventDefault();
      this.targetDist = Math.max(4.6, Math.min(13, this.targetDist + e.deltaY * 0.004));
      this.dirty = true;
    }, { passive: false });

    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    if (!this.ok || !this.canvas) return;
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    if (this.camera.aspect !== undefined) {
      this.camera.aspect = w / Math.max(1, h);
      if (this.camera.updateProjectionMatrix) this.camera.updateProjectionMatrix();
    }
    this.dirty = true;
  },

  setViewMode(on) {
    this.viewMode = !!on;
    this.targetDist = on ? 6.0 : 7.8;
    this.targetPitch = on ? 0.2 : 0.14;
    this.dirty = true;
  },

  nudge(dir) { this.yaw += dir * 0.55; this.dirty = true; },

  /* on-demand rendering: skip the GPU entirely when nothing changed */
  _tick() {
    if (!this.ok) return;

    let needs = this.dirty;
    if (this.viewMode && !this.drag) { this.yaw += 0.0032; needs = true; }   /* spin only in view */
    if (!this.drag && Math.abs(this.vel) > 0.00002) { this.yaw += this.vel; this.vel *= 0.92; needs = true; }
    if (Math.abs(this.targetDist - this.dist) > 0.002 || Math.abs(this.targetPitch - this.pitch) > 0.002) needs = true;

    if (!needs) return;

    this.pitch += (this.targetPitch - this.pitch) * 0.12;
    this.dist += (this.targetDist - this.dist) * 0.12;
    if (this.pivot && this.pivot.rotation) this.pivot.rotation.y = this.yaw;

    const cam = this.camera;
    if (cam && cam.position && cam.position.set) {
      cam.position.set(0, 1.0 + this.dist * this.pitch * 0.6, this.dist);
      if (cam.lookAt) cam.lookAt(0, 0.75, 0);
    }

    try { this.renderer.render(this.scene, this.camera); } catch (e) { this.ok = false; return; }
    this.dirty = false;
  },
};

if (typeof window !== 'undefined') window.Viewer = Viewer;
