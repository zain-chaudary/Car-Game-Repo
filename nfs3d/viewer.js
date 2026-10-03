/* ================================================================
   GarageViewer — 3D showcase for the garage.
   • Renders two SAMPLE cars built from three.js primitives.
   • GLB DROP-IN: if `assets/models/<id>.glb` exists it is loaded
     instead of the sample geometry (auto-scaled, auto-centered,
     paint applied to meshes named paint/body/shell).
   • Drag to orbit, wheel to zoom, [1] to toggle full view.
   • Degrades gracefully: if WebGL is unavailable `Viewer.ok` stays
     false and the UI keeps using the 2D car art.
   ================================================================ */
'use strict';

const Viewer = {
  ok: false,
  canvas: null,
  renderer: null,
  scene: null,
  camera: null,
  pivot: null,          /* rotating turntable */
  carGroup: null,
  lights: null,
  raf: 0,
  currentId: null,
  viewMode: false,

  /* orbit state */
  dist: 8.2, targetDist: 8.2,
  yaw: 0.7, pitch: 0.28, targetPitch: 0.28,
  spin: 0.0016, drag: null, vel: 0,

  quality: 'high',

  /* ---------------- boot ---------------- */
  init(canvas, quality) {
    this.canvas = canvas;
    this.quality = quality || 'high';
    if (typeof THREE === 'undefined') return false;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: this.quality !== 'low', alpha: true,
      });
      this.renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);
      if (this.renderer.setPixelRatio) {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 2));
      }
      if (this.renderer.shadowMap) {
        this.renderer.shadowMap.enabled = this.quality !== 'low';
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      if (THREE.sRGBEncoding !== undefined && this.renderer.outputEncoding !== undefined) {
        this.renderer.outputEncoding = THREE.sRGBEncoding;
      }
    } catch (e) { this.ok = false; return false; }

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x05070c, 14, 30);

    this.camera = new THREE.PerspectiveCamera(38, (canvas.clientWidth || 800) / (canvas.clientHeight || 600), 0.1, 100);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this._buildLights();
    this._buildFloor();
    this._bindInput();
    this.ok = true;
    this.start();
    return true;
  },

  /* render loop */
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

  setQuality(q) {
    this.quality = q;
    if (!this.ok) return;
    try {
      if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = q !== 'low';
      if (this.renderer.setPixelRatio) {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : 2));
      }
    } catch (e) {}
  },

  /* ---------------- environment ---------------- */
  _buildLights() {
    const hemi = new THREE.HemisphereLight(0x8fb4ff, 0x120a06, 0.55);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff0dd, 1.15);
    key.position.set(5, 7, 4);
    if (key.castShadow !== undefined) {
      key.castShadow = true;
      if (key.shadow && key.shadow.mapSize) { key.shadow.mapSize.width = 1024; key.shadow.mapSize.height = 1024; }
    }
    this.scene.add(key);

    const rimAmber = new THREE.PointLight(0xff8a2a, 1.6, 18);
    rimAmber.position.set(-6, 2.2, -4);
    const rimTeal = new THREE.PointLight(0x20d0ff, 1.3, 18);
    rimTeal.position.set(6, 2.0, -3.5);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
    fill.position.set(-4, 3, 6);
    this.scene.add(rimAmber, rimTeal, fill);

    /* moving strip lights (studio feel) */
    const stripGeo = new THREE.BoxGeometry(0.14, 0.14, 7);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffb45a });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(stripGeo, stripMat);
      s.position.set(-3 + i * 3, 4.4, -1 + i * 0.4);
      this.scene.add(s);
    }
    this.lights = { key, rimAmber, rimTeal };
  },

  _buildFloor() {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(9, 64),
      new THREE.MeshStandardMaterial({ color: 0x0a0d14, metalness: 0.85, roughness: 0.32 })
    );
    floor.rotation.x = -Math.PI / 2;
    if (floor.receiveShadow !== undefined) floor.receiveShadow = true;
    this.pivot.add(floor);

    /* glow ring */
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(5.4, 5.62, 96),
      new THREE.MeshBasicMaterial({ color: 0xff9f1c, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    this.pivot.add(ring);

    const grid = new THREE.GridHelper(24, 48, 0x1d2a3d, 0x111a26);
    grid.position.y = 0.002;
    this.pivot.add(grid);
  },

  /* ---------------- car factories (sample geometry) ---------------- */
  _paintMat(hex, metalness, roughness) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex), metalness: metalness === undefined ? 0.85 : metalness,
      roughness: roughness === undefined ? 0.28 : roughness,
    });
  },

  _wheel(r, w, rimHex) {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, w, 26),
      new THREE.MeshStandardMaterial({ color: 0x0b0b0d, metalness: 0.1, roughness: 0.92 })
    );
    tire.rotation.z = Math.PI / 2;
    if (tire.castShadow !== undefined) tire.castShadow = true;
    g.add(tire);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.62, r * 0.62, w * 1.02, 20),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(rimHex), metalness: 0.95, roughness: 0.22 })
    );
    rim.rotation.z = Math.PI / 2;
    g.add(rim);

    /* spokes */
    const spokeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(rimHex), metalness: 0.9, roughness: 0.3 });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, r * 1.05, 0.06), spokeMat);
      s.rotation.x = (i / 5) * Math.PI * 2;
      g.add(s);
    }
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.16, r * 0.16, w * 1.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xff9f1c, metalness: 0.9, roughness: 0.3 })
    );
    hub.rotation.z = Math.PI / 2;
    g.add(hub);
    return g;
  },

  /* generic supercar builder — `p` tunes the silhouette per model */
  _buildSampleCar(p) {
    const g = new THREE.Group();
    const paint = this._paintMat(p.color);
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c0e12, metalness: 0.6, roughness: 0.55 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x0a1620, metalness: 0.95, roughness: 0.08, transparent: true, opacity: 0.72,
    });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd6e4, metalness: 1, roughness: 0.18 });

    const box = (w, h, d, mat, x, y, z, rx) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      if (m.castShadow !== undefined) m.castShadow = true;
      g.add(m);
      return m;
    };

    /* lower chassis */
    box(p.w, 0.34, p.l, paint, 0, 0.42, 0);
    /* main body */
    box(p.w * 0.97, 0.3, p.l * 0.86, paint, 0, 0.66, -0.05);
    /* nose wedge */
    box(p.w * 0.9, 0.2, p.l * 0.24, paint, 0, 0.56, p.l * 0.42, p.noseTilt);
    /* tail deck */
    box(p.w * 0.92, 0.24, p.l * 0.22, paint, 0, 0.72, -p.l * 0.42);
    /* side skirts */
    box(p.w * 1.02, 0.1, p.l * 0.55, dark, 0, 0.3, 0);
    /* hood bulge */
    box(p.w * 0.5, 0.07, p.l * 0.3, paint, 0, 0.83, p.l * 0.22);

    /* cabin */
    const cab = box(p.w * 0.78, p.cabH, p.cabL, glass, 0, 0.98, p.cabZ, 0);
    cab.material = glass;
    /* roof */
    box(p.w * 0.66, 0.08, p.cabL * 0.9, paint, 0, 0.98 + p.cabH / 2, p.cabZ);
    /* windshield rake */
    box(p.w * 0.76, 0.06, p.cabL * 0.55, glass, 0, 0.95, p.cabZ + p.cabL * 0.62, -0.5);

    /* rear wing */
    if (p.wing) {
      box(p.w * 0.94, 0.05, 0.34, dark, 0, 1.16, -p.l * 0.5);
      box(0.08, 0.26, 0.2, dark, -p.w * 0.4, 1.02, -p.l * 0.5);
      box(0.08, 0.26, 0.2, dark, p.w * 0.4, 1.02, -p.l * 0.5);
    }
    /* diffuser */
    box(p.w * 0.8, 0.12, 0.3, dark, 0, 0.3, -p.l * 0.53);
    /* exhausts */
    [-0.3, 0.3].forEach(x => {
      const e = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 14), chrome);
      e.rotation.x = Math.PI / 2;
      e.position.set(x, 0.34, -p.l * 0.55);
      g.add(e);
    });

    /* lights */
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdff3ff, emissiveIntensity: 2.2 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff2030, emissiveIntensity: 2.6 });
    [-1, 1].forEach(s => {
      box(p.w * 0.2, 0.09, 0.06, headMat, s * p.w * 0.31, 0.72, p.l * 0.52);
      box(p.w * 0.24, 0.08, 0.05, tailMat, s * p.w * 0.3, 0.82, -p.l * 0.53);
      /* mirrors */
      box(0.1, 0.07, 0.16, paint, s * (p.w / 2 + 0.07), 1.02, p.cabZ + 0.15);
    });
    /* light bar (taillight strip) */
    box(p.w * 0.7, 0.04, 0.04, tailMat, 0, 0.82, -p.l * 0.53);

    /* wheels */
    const wr = p.wheelR, ww = 0.26;
    const positions = [
      [-p.w / 2 - 0.02, wr, p.l * 0.32], [p.w / 2 + 0.02, wr, p.l * 0.32],
      [-p.w / 2 - 0.02, wr, -p.l * 0.34], [p.w / 2 + 0.02, wr, -p.l * 0.34],
    ];
    const wheels = [];
    positions.forEach(pos => {
      const wh = this._wheel(wr, ww, p.rim);
      wh.position.set(pos[0], pos[1], pos[2]);
      g.add(wh);
      wheels.push(wh);
    });

    /* underglow (hidden until equipped) */
    const glow = new THREE.PointLight(0x000000, 0, 4.5);
    glow.position.set(0, 0.12, 0);
    g.add(glow);

    /* headlight spill */
    const spill = new THREE.SpotLight(0xfff4e0, 1.1, 12, 0.5, 0.5);
    spill.position.set(0, 0.8, p.l * 0.5);
    spill.target.position.set(0, 0, p.l * 0.5 + 6);
    g.add(spill); g.add(spill.target);

    g.userData = { paintMeshes: g.children.filter(c => c.material === paint), wheels, glow, rims: p.rim };
    /* collect paint meshes properly (box() adds meshes with `paint` material) */
    const paintList = [];
    g.traverse(o => { if (o.material === paint) paintList.push(o); });
    g.userData.paintMeshes = paintList;
    g.userData.paintMat = paint;
    g.userData.glassMat = glass;
    return g;
  },

  /* ---------------- GLB drop-in ---------------- */
  /* Drop your model at nfs3d/assets/models/<id>.glb and it is used
     automatically — no code change needed. */
  _tryGLB(id, onLoaded, onMissing) {
    const url = 'assets/models/' + id + '.glb';
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

  _fitAndPlace(model, rimHex) {
    /* normalize to ~4.4 units long, sitting on the floor, centered */
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3(); box.getSize(size);
    const scale = 4.4 / Math.max(size.x, size.z, 0.001);
    model.scale.setScalar(scale);
    const box2 = new THREE.Box3().setFromObject(model);
    const size2 = new THREE.Vector3(); box2.getSize(size2);
    const center = new THREE.Vector3(); box2.getCenter(center);
    model.position.set(-center.x, -box2.min.y, -center.z);

    const holder = new THREE.Group();
    holder.add(model);

    /* apply saved paint/rims where the model exposes them */
    const paintMats = [], rimMats = [];
    holder.traverse(o => {
      if (!o.isMesh && !o.material) return;
      const n = (o.name || '').toLowerCase();
      const mn = (o.material && o.material.name ? o.material.name : '').toLowerCase();
      const tag = n + ' ' + mn;
      if (/paint|body|shell|chassis/.test(tag)) paintMats.push(o.material);
      if (/rim|wheel/.test(tag) && !/tire|tyre/.test(tag)) rimMats.push(o.material);
      if (o.castShadow !== undefined) o.castShadow = true;
    });
    holder.userData = { paintMats, rimMats, isGLB: true, model };
    return holder;
  },

  /* ---------------- show a car ---------------- */
  showCar(car, look) {
    if (!this.ok) return;
    this.currentId = car.id;

    /* clear previous */
    if (this.carGroup) {
      this.pivot.remove(this.carGroup);
      this.carGroup = null;
    }

    const placeIt = obj => {
      this.carGroup = obj;
      this.pivot.add(obj);
      this.applyLook(look);
      /* entrance: drop-in */
      this._entry = 1;
    };

    const fallback = () => {
      const params = car.silhouette === 'super'
        ? { color: car.paint, rim: 0xd8dde6, w: 1.98, l: 4.5, cabH: 0.34, cabL: 1.5, cabZ: -0.25,
            noseTilt: -0.12, wheelR: 0.44, wing: true }
        : { color: car.paint, rim: 0xb9c0cc, w: 1.86, l: 4.35, cabH: 0.42, cabL: 1.75, cabZ: -0.15,
            noseTilt: -0.06, wheelR: 0.42, wing: false };
      placeIt(this._buildSampleCar(params));
    };

    this._tryGLB(car.id, glb => placeIt(this._fitAndPlace(glb)), fallback);
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
      return;
    }
    if (ud.paintMat && ud.paintMat.color) ud.paintMat.color.setHex(paintHex);
    (ud.paintMeshes || []).forEach(() => {});
    /* rims: rebuild wheel material color */
    (ud.wheels || []).forEach(w => {
      w.children.forEach(c => {
        if (c.material && c.material.color && c.material.metalness > 0.85) c.material.color.setHex(rimHex);
      });
    });
    if (ud.glow) {
      const on = glowHex !== 0x000000 && glowHex !== null;
      ud.glow.color.setHex(on ? glowHex : 0x000000);
      ud.glow.intensity = on ? 2.2 : 0;
      ud.glow.distance = on ? 5 : 0.01;
    }
    if (ud.glassMat) ud.glassMat.opacity = Math.max(0.25, 0.75 - tint * 0.16);
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
      this.targetPitch = Math.max(0.02, Math.min(1.05, this.targetPitch + dy * 0.004));
      this.vel = -dx * 0.0006;
    });
    const up = () => { this.drag = null; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', up);
    c.addEventListener('wheel', e => {
      e.preventDefault();
      this.targetDist = Math.max(4.4, Math.min(14, this.targetDist + e.deltaY * 0.004));
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
  },

  setViewMode(on) {
    this.viewMode = !!on;
    this.targetDist = on ? 6.2 : 8.2;
    this.targetPitch = on ? 0.22 : 0.28;
    this.spin = on ? 0.0 : 0.0016;
  },

  nudge(dir) { this.yaw += dir * 0.55; },

  _tick() {
    if (!this.ok) return;
    /* idle turntable + drag inertia */
    if (!this.drag) this.yaw += this.spin + this.vel;
    this.vel *= 0.93;
    this.pitch += (this.targetPitch - this.pitch) * 0.1;
    this.dist += (this.targetDist - this.dist) * 0.08;

    if (this.pivot && this.pivot.rotation) this.pivot.rotation.y = this.yaw;

    const cam = this.camera;
    if (cam && cam.position && cam.position.set) {
      cam.position.set(
        Math.sin(0) * this.dist,
        1.1 + this.dist * this.pitch * 0.55,
        this.dist
      );
      if (cam.lookAt) cam.lookAt(0, 0.8, 0);
    }

    /* entrance drop */
    if (this._entry > 0 && this.carGroup) {
      this._entry = Math.max(0, this._entry - 0.045);
      const t = 1 - this._entry;
      if (this.carGroup.position) {
        this.carGroup.position.y = (1 - t) * (1 - t) * 2.2;
      }
    }

    try { this.renderer.render(this.scene, this.camera); } catch (e) { this.ok = false; }
  },
};

if (typeof window !== 'undefined') window.Viewer = Viewer;
