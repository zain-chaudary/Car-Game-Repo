/* Real-three.js geometry check for the garage 3D viewer.
 * Loads the SAME three.min.js that ships in nfs3d/ and runs viewer.js in a VM,
 * so the sample-car builders, the GLB normalizer and the cosmetics layer are
 * exercised with real THREE math (no WebGL context needed).
 * Run: node tests/viewer_geometry.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const THREE = require(path.join(ROOT, 'nfs3d', 'three.min.js'));
if (!THREE || !THREE.Mesh) { console.error('FAIL: three.min.js did not export THREE'); process.exit(1); }

const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('ok  :', msg);
};

const sandbox = { THREE, console, window: {}, requestAnimationFrame: () => 0 };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'nfs3d', 'viewer.js'), 'utf8'), sandbox, { filename: 'viewer.js' });

const V = sandbox.window.Viewer;
assert(!!V, 'viewer.js exposes window.Viewer');
assert(V.ok === false, 'Viewer.ok false before WebGL init (no crash without a canvas)');

const COUPE = { color: 0xd8352f, rim: 0xb9c0cc, w: 1.86, l: 4.35, cabH: 0.42, cabL: 1.75, cabZ: -0.15, noseTilt: -0.06, wheelR: 0.42, wing: false };
const SUPER = { color: 0x1a6bff, rim: 0xd8dde6, w: 1.98, l: 4.5, cabH: 0.34, cabL: 1.5, cabZ: -0.25, noseTilt: -0.12, wheelR: 0.44, wing: true };

const coupe = V._buildSampleCar(COUPE);
const super_ = V._buildSampleCar(SUPER);

assert(coupe.isGroup === true, 'sample coupe builds as a THREE.Group');
assert(coupe.children.length >= 20, 'coupe has ' + coupe.children.length + ' parts (body, cabin, lights, wheels)');
assert(coupe.userData.wheels.length === 4, 'coupe has 4 wheels');
assert(coupe.userData.paintMeshes.length >= 6, coupe.userData.paintMeshes.length + ' paintable meshes found');
assert(super_.children.length > coupe.children.length, 'supercar has extra aero parts (rear wing)');

function stats(g) {
  let meshes = 0, tris = 0;
  g.traverse(o => {
    if (o.isMesh && o.geometry) {
      meshes++;
      const idx = o.geometry.index;
      const pos = o.geometry.attributes && o.geometry.attributes.position;
      tris += idx ? idx.count / 3 : (pos ? pos.count / 3 : 0);
    }
  });
  return { meshes, tris: Math.round(tris) };
}
const cs = stats(coupe);
console.log('     coupe: ' + cs.meshes + ' meshes, ~' + cs.tris + ' triangles');
assert(cs.tris > 800, 'coupe geometry is detailed (>800 triangles)');

/* GLB normalizer: any imported model must land at ~4.4 units long on the floor */
const raw = new THREE.Group();
const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(200, 60, 440), new THREE.MeshStandardMaterial());
bodyMesh.name = 'body_paint';
raw.add(bodyMesh);
const fitted = V._fitAndPlace(raw, 0xffffff);
const box = new THREE.Box3().setFromObject(fitted);
const size = new THREE.Vector3(); box.getSize(size);
assert(Math.abs(Math.max(size.x, size.z) - 4.4) < 0.01, 'GLB auto-scaled to 4.4 units (got ' + Math.max(size.x, size.z).toFixed(3) + ')');
assert(Math.abs(box.min.y) < 0.001, 'GLB sits exactly on the garage floor (min.y = ' + box.min.y.toFixed(4) + ')');
assert(fitted.userData.paintMats.length === 1, 'GLB paint mesh detected by name');

/* cosmetics layer */
V.ok = true;
V.carGroup = coupe;
V.applyLook({ paintHex: 0x00ff66, rimHex: 0x112233, glowHex: 0xff9f1c, tint: 3 });
assert(coupe.userData.paintMat.color.getHex() === 0x00ff66, 'paint colour applied to car body');
assert(coupe.userData.glow.intensity > 0, 'underglow switched on');
assert(coupe.userData.glassMat.opacity < 0.75, 'window tint darkened glass (' + coupe.userData.glassMat.opacity.toFixed(2) + ')');

V.applyLook({ paintHex: 0x123456, rimHex: 0xffffff, glowHex: 0x000000, tint: 0 });
assert(coupe.userData.glow.intensity === 0, 'underglow switched off again');
assert(coupe.userData.paintMat.color.getHex() === 0x123456, 'repaint applied twice cleanly');

/* showCar must fall back to sample geometry when no GLB is reachable */
let built = null;
const origBuild = V._buildSampleCar.bind(V);
V._buildSampleCar = p => { built = p; return origBuild(p); };
V.pivot = new THREE.Group();
V.showCar({ id: 'no_such_car', silhouette: 'super', paint: 0x1a6bff }, { paintHex: 0x1a6bff, rimHex: 0xffffff, glowHex: 0, tint: 0 });
assert(!!built, 'showCar() falls back to sample geometry when no .glb exists');
assert(V.carGroup && V.carGroup.parent === V.pivot, 'car added to the turntable pivot');

console.log('\nVIEWER GEOMETRY TEST PASSED');
process.exit(0);
