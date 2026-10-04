/* Real-three.js logic test for the Step-2 race module.
 * Exercises track construction, player physics, nitro gating, off-road
 * drag, AI progress and finishing order with the REAL bundled three.js.
 * Run: node tests/race_logic.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const THREE = require(path.join(ROOT, 'nfs3d', 'three.min.js'));

const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('ok  :', msg);
};

const sandbox = { THREE, console, window: {}, requestAnimationFrame: () => 0, setTimeout: () => 0, document: undefined };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'nfs3d', 'viewer.js'), 'utf8'), sandbox, { filename: 'viewer.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'nfs3d', 'race.js'), 'utf8'), sandbox, { filename: 'race.js' });
const R = sandbox.window.Race;
assert(!!R, 'race.js exposes window.Race');

/* ---- track ---- */
const d = R.buildTrackData();
assert(d.len > 2200 && d.len < 2700, 'track length ~2.4 km (got ' + Math.round(d.len) + ' m)');
assert(d.pts.length === R.SAMPLES + 1, 'track sampled at ' + d.pts.length + ' points');
const p0 = R.trackPoint(0, 0);
assert(Math.abs(p0.x) < 1 && Math.abs(p0.z) < 1, 'track starts at origin');
const pEnd = R.trackPoint(d.len, 0);
assert(Math.abs(pEnd.z - 2400) < 30, 'track ends near z=2400 (got ' + pEnd.z.toFixed(1) + ')');
const pL = R.trackPoint(d.len / 2, -5), pR = R.trackPoint(d.len / 2, 5);
const latDist = Math.hypot(pL.x - pR.x, pL.z - pR.z);
assert(Math.abs(latDist - 10) < 0.2, 'lateral offset maps to real metres (' + latDist.toFixed(2) + ' for ±5)');

/* ---- player physics ---- */
const car = { top: 185 / 3.6, accel: 27.78 / 7.6, brake: 9, handling01: 0.35, nitroUnlocked: false };
const s = R.newState();
for (let i = 0; i < 300; i++) R.step(s, { up: true }, 1 / 60, car);
assert(s.speed > 15 && s.speed < 25, 'throttle accelerates realistically (speed ' + (s.speed * 3.6).toFixed(0) + ' km/h after 5s)');
assert(s.dist > 40, 'distance accumulates (' + s.dist.toFixed(0) + ' m)');
for (let i = 0; i < 900; i++) R.step(s, { up: true }, 1 / 60, car);
assert(Math.abs(s.speed - car.top) < 0.5, 'speed capped at top speed (' + (s.speed * 3.6).toFixed(1) + ' km/h)');
for (let i = 0; i < 4000; i++) R.step(s, { up: true }, 1 / 60, car);
assert(s.finished === true, 'full-throttle run crosses the finish line');
assert(s.nitro === 0 && !car.nitroUnlocked, 'nitro meter stays 0 while locked');

/* steering moves lateral, clamped to road+shoulder */
const s2 = R.newState(); s2.speed = 30;
for (let i = 0; i < 240; i++) R.step(s2, { right: true }, 1 / 60, car);
assert(s2.lat > 3, 'steering moves the car across the road (lat ' + s2.lat.toFixed(1) + ')');
for (let i = 0; i < 2400; i++) R.step(s2, { right: true }, 1 / 60, car);
assert(s2.lat <= R.roadHalf + 4.01, 'lateral clamped off-road (lat ' + s2.lat.toFixed(1) + ')');

/* off-road drag */
const s3 = R.newState(); s3.speed = 40; s3.lat = 8;
R.step(s3, { up: true }, 1 / 60, car);
assert(s3.speed < 40, 'off-road surface slows the car');

/* nitro unlock boosts */
const carN = Object.assign({}, car, { nitroUnlocked: true });
const s4 = R.newState();
let maxSp = 0;
for (let i = 0; i < 1200; i++) { R.step(s4, { up: true, nitro: true }, 1 / 60, carN); maxSp = Math.max(maxSp, s4.speed); }
assert(maxSp > car.top * 1.1, 'unlocked nitro pushes past top speed (' + (maxSp * 3.6).toFixed(0) + ' km/h peak)');
assert(s4.nitro < 100, 'nitro meter drains while boosting (meter ' + s4.nitro.toFixed(0) + ')');

/* finish triggers */
const s5 = R.newState(); s5.dist = d.len - 2; s5.speed = 40;
for (let i = 0; i < 5 && !s5.finished; i++) R.step(s5, { up: true }, 1 / 60, car);
assert(s5.finished === true && s5.finishTime > 0, 'crossing the line sets finished + time');

/* ---- AI + places ---- */
const ai1 = R.aiState(-2.6, 46); const ai2 = R.aiState(2.6, 43);
for (let i = 0; i < 600; i++) { R.aiStep(ai1, 1 / 60, 0); R.aiStep(ai2, 1 / 60, 0); }
assert(ai1.dist > ai2.dist, 'faster AI pulls ahead (' + ai1.dist.toFixed(0) + ' vs ' + ai2.dist.toFixed(0) + ' m)');
const me = R.newState(); me.dist = 99999; me.finished = true; me.finishTime = 40;
assert(R.place(me, [ai1, ai2]) === 1, 'finished player ahead of running AI is P1');
const meSlow = R.newState(); meSlow.dist = 10;
assert(R.place(meSlow, [ai1, ai2]) === 3, 'player behind both AI is P3');

console.log('\nRACE LOGIC TEST PASSED');
process.exit(0);
