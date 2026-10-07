/* RACE 1 pure physics/logic checks — runs against the real shipped race.js */
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'nfs3d', 'race.js'), 'utf8');
const Race = new Function(src + '\nreturn Race;')();

const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('ok  :', msg);
};

Race.track = Race.buildTrackData();
assert(Race.track.len > 1900 && Race.track.len < 2150, 'clean strip length ~2 km (' + Math.round(Race.track.len) + ' m)');
assert(Race.track.roadHalf === 6, 'wide clean road (half=6)');

const car = { top: 185 / 3.6, accel: 27.78 / 7.6, brake: 9, handling01: 52 / 150, nitroUnlocked: false };
const mk = () => ({ dist: 0, lat: 0, speed: 0, steer: 0, steerVis: 0, nitro: 100, nitroOn: false, time: 0, finished: false });

/* acceleration */
let s = mk();
for (let i = 0; i < 300; i++) Race.step(s, car, { up: true }, 1 / 60);
assert(s.speed * 3.6 > 60, '0-60+ km/h in 5 s (' + Math.round(s.speed * 3.6) + ')');

/* top cap */
s = mk();
for (let i = 0; i < 60 * 60; i++) Race.step(s, car, { up: true }, 1 / 60);
assert(s.speed <= car.top + 0.01, 'top speed capped at ' + Math.round(car.top * 3.6) + ' km/h');

/* nitro locked = no boost */
s = mk(); s.speed = 30;
for (let i = 0; i < 120; i++) Race.step(s, car, { up: true, nitro: true }, 1 / 60);
assert(s.nitroOn === false && s.nitro === 100, 'locked nitro never engages');

/* steering */
s = mk(); s.speed = 30;
for (let i = 0; i < 180; i++) Race.step(s, car, { up: true, right: true }, 1 / 60);
assert(s.lat > 3, 'steering moves the car laterally (' + s.lat.toFixed(1) + ' m)');

/* drift: momentum slide + nitro earn */
s = mk(); s.speed = 40; s.nitro = 20;
for (let i = 0; i < 60; i++) Race.step(s, car, { up: true, right: true, drift: true }, 1 / 60);
assert(s.drifting === true, 'handbrake at speed breaks traction');
assert(s.drift > 2, 'drift carries lateral momentum (' + s.drift.toFixed(1) + ' m/s)');
assert(s.nitro > 20, 'drifting earns nitro (' + Math.round(s.nitro) + '%)');
for (let i = 0; i < 120; i++) Race.step(s, car, { up: true }, 1 / 60);
assert(s.drifting === false && Math.abs(s.drift) < 1.5, 'grip snaps back after the drift');

/* off-road scrub */
s = mk(); s.speed = 40; s.lat = 8.5;
const before = s.speed;
for (let i = 0; i < 60; i++) Race.step(s, car, { up: true }, 1 / 60);
assert(s.speed < before * 0.6, 'off-road scrubs speed hard');

/* finish */
s = mk(); s.dist = Race.track.len - 30; s.speed = 40;
for (let i = 0; i < 600 && !s.finished; i++) Race.step(s, car, { up: true }, 1 / 60);
assert(s.finished === true && s.finishTime > 0, 'finish line triggers');

/* placement */
const a = { dist: 500, finished: false }, b = { dist: 900, finished: false };
assert(Race.place(b, a) > 0, 'further car ranks ahead');
const f = { dist: 2000, finished: true, finishTime: 50 }, g = { dist: 9000, finished: false };
assert(Race.place(f, g) > 0, 'finished car beats unfinished');

/* AI */
const ai = { dist: 5, lat: -3.2, lane: -3.2, ratio: 0.93, speed: 0, time: 0, finished: false };
for (let i = 0; i < 600; i++) Race.aiStep(ai, car, 1 / 60, { dist: 0 });
assert(Math.abs(ai.speed - car.top * 0.93) < car.top * 0.1, 'AI settles near its target pace');
assert(Math.abs(ai.lat - (-3.2)) < 0.2, 'AI holds its lane');

console.log('\nRACE LOGIC TEST PASSED');
