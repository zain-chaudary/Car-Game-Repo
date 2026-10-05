/* Headless UI smoke test for the nfs3d web app (v0.4 realism build).
 * Runs the real index.html + audio.js + viewer.js + main.js in jsdom with a
 * stubbed THREE, then clicks through: New Game -> Garage (starter GLB cars,
 * owned-only switching, locked nitrous, expensive parts) -> Career -> Settings.
 * Run: NODE_PATH=/tmp/node_modules node tests/web_smoke.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, 'nfs3d', f), 'utf8');
const html = read('index.html');

const dom = new JSDOM(html, {
  url: 'http://localhost:8080/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const w = dom.window;

/* --- stub canvas context (jsdom has no canvas impl) --- */
w.HTMLCanvasElement.prototype.getContext = function () {
  const noop = () => {};
  return new Proxy({}, {
    get: (t, p) => (p === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop),
    set: () => true,
  });
};

/* --- universal THREE stub --- */
const toZero = () => 0;
const any = new Proxy(function () {}, {
  get: (t, p) => {
    if (p === Symbol.toPrimitive || p === 'valueOf') return toZero;
    if (p === 'toString') return () => '0';
    return (p in t) ? t[p] : any;
  },
  set: () => true,
  apply: () => any,
  construct: () => new Proxy({}, {
    get: (t, p) => (p in t) ? t[p] : any,
    set: (t, p, v) => { t[p] = v; return true; },
  }),
});
w.THREE = any;

const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('ok  :', msg);
};

w.eval(read('audio.js'));
w.eval(read('viewer.js'));
w.eval(read('race.js'));
w.eval(read('main.js'));

const doc = w.document;
const $ = s => doc.querySelector(s);
const click = el => el.dispatchEvent(new w.Event('click', { bubbles: true }));
const key = k => w.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));

/* ---------- home ---------- */
assert(!$('#screen-home').classList.contains('hidden'), 'home screen visible at boot');
assert($('#btn-continue').disabled === true, 'CONTINUE disabled with no save');
assert($('#loader-tag') !== null, 'loader has a progress tag');
assert($('#stage-hints') === null, 'broken hints cluster removed from garage');
assert(doc.querySelector('script[src^="main.js?v="]') !== null, 'scripts carry cache-busting versions');

click($('#btn-new'));
assert(!$('#screen-hub').classList.contains('hidden'), 'hub shown after NEW GAME');
assert($('#cash').textContent === '$5,000', 'starting cash is $5,000');

/* ---------- garage: starters ---------- */
click($('#btn-garage'));
assert(!$('#screen-garage').classList.contains('hidden'), 'garage shown');
assert($('#car-name').textContent === 'BRUISER V8', 'starter BRUISER V8 shown by default');
assert($('#tab-specs').classList.contains('on') === true, 'SPECS tab is the default garage panel');
assert($('#panel-custom').classList.contains('hidden') === true, 'customization hidden until opened');
assert($('#spec-bars').querySelectorAll('.spec').length === 6, 'six spec bars rendered');
assert($('#spec-bars').textContent.includes('LOCKED'), 'nitrous shows LOCKED on starter car');
assert(!$('#btn-unlock-nitro').classList.contains('hidden'), 'nitrous unlock button visible');
assert($('#btn-unlock-nitro').disabled === false, 'unlock affordable at $5,000');
assert($('#btn-unlock-nitro').textContent.includes('$5,000'), 'unlock price is $5,000');
assert(Number($('#car-rating').textContent) > 0, 'perf rating computed');

const chips = doc.querySelectorAll('.car-chip');
assert(chips.length === 4, 'roster shows all four cars as chips');
assert(doc.querySelectorAll('.car-chip.locked').length === 2, 'falcon & vortex shown locked with prices');
assert(doc.querySelector('.car-chip.locked').textContent.includes('$12,000'), 'locked chip shows its price');
assert(doc.querySelector('.car-card') === null, 'old card layout gone — chips only');
assert($('#spec-sheet').querySelectorAll('.ss-row').length === 13, 'detailed spec sheet renders 13 rows');
assert($('#spec-sheet').textContent.includes('5.9L CAST-IRON V8'), 'bruiser engine detail in spec sheet');
assert($('#spec-sheet').textContent.includes('TORQUE'), 'torque detail in spec sheet');
assert($('#screen-race') !== null, 'race screen present for RACE 1');
assert(doc.querySelector('script[src^="race.js?v="]') !== null, 'race.js loaded with cache-busting version');

/* owned-only switching */
key('ArrowRight');
assert($('#car-name').textContent === 'HYPERION GT', 'RIGHT arrow switches to HYPERION GT');
key('ArrowLeft');
assert($('#car-name').textContent === 'BRUISER V8', 'LEFT arrow switches back to BRUISER V8');
click(chips[1]);
assert($('#car-name').textContent === 'HYPERION GT', 'chip click switches between owned cars');
click(chips[2]);
assert($('#car-name').textContent === 'FALCON GT', 'locked chip previews the car');
assert(!$('#btn-buy').classList.contains('hidden'), 'BUY shown for locked car');
click(chips[0]);
assert($('#car-name').textContent === 'BRUISER V8', 'owned chip click switches back');

/* 3D view mode */
key('1');
assert($('#screen-garage').classList.contains('view-mode') === true, 'press 1 enters 3D view mode');
key('Escape');
assert($('#screen-garage').classList.contains('view-mode') === false, 'ESC leaves 3D view mode');

/* ---------- customization: expensive parts ---------- */
click($('#tab-custom'));
assert(!$('#panel-custom').classList.contains('hidden'), 'CUSTOMIZATION button opens parts panel');
assert(doc.querySelectorAll('#upgrade-list .up-row').length === 12, '12 upgrade categories');
assert(doc.querySelectorAll('#upgrade-list .up-row.tier4').length === 2, 'two ELITE endgame parts');
assert(doc.querySelector('#upgrade-list').textContent.includes('ENGINE SWAP'), 'ELITE ENGINE SWAP listed');
assert(doc.querySelector('#upgrade-list').textContent.includes('$60,000'), 'engine swap stage 1 costs $60,000');

const upBtn = doc.querySelector('.buy-up:not([disabled])');
assert(!!upBtn && upBtn.textContent.includes('$1,800'), 'cheapest part is ENGINE at $1,800');
click(upBtn);
assert($('#cash').textContent === '$3,200', 'cash deducted to $3,200 after engine install');
assert($('#btn-unlock-nitro').disabled === true, 'nitrous unlock disabled below $5,000');

/* GLB starters keep factory finish — only underglow offered */
assert(doc.querySelector('.factory-note') !== null, 'factory finish note shown for GLB car');
const glowChips = doc.querySelectorAll('.cos-chip');
assert(glowChips.length === 6, 'six underglow options (paint/rims/tint hidden on GLB finish)');
const amber = Array.from(glowChips).find(c => c.textContent.includes('AMBER'));
click(amber);                               /* $2,200 */
assert($('#cash').textContent === '$1,000', 'underglow purchase deducted $2,200');
const amberNow = Array.from(doc.querySelectorAll('.cos-chip')).find(c => c.textContent.includes('AMBER'));
assert(amberNow.textContent.includes('EQUIPPED'), 'underglow equipped');

/* ---------- career / settings ---------- */
click($('#btn-select'));                    /* already active -> disabled path */
click($('#btn-garage-back'));
assert(!$('#screen-hub').classList.contains('hidden'), 'back at hub');

click($('#btn-career'));
assert(!$('#screen-career').classList.contains('hidden'), 'career shown');
const raceCard = doc.querySelector('.race-card');
assert(raceCard !== null && raceCard.textContent.includes('RACE 1'), 'RACE 1 card listed');
assert(raceCard.textContent.includes('YOUR CAR, THEIR COLOURS'), 'rivals are your car in different colours');
const raceBtn = raceCard.querySelector('button');
assert(raceBtn.textContent === 'START RACE', 'race card has START RACE');
click(raceBtn);
assert(!$('#screen-race').classList.contains('hidden'), 'START RACE launches the race screen');
assert(w.Race.running === true, 'race loop running');
assert(w.Race.states && w.Race.states.ais.length === 2, 'two same-car rivals on the grid');
assert(w.Race.track.len > 1900 && w.Race.track.len < 2150, 'clean strip track ~2 km');
assert(!$('#countdown').classList.contains('hidden'), 'countdown shown');
key('Escape');
assert(!$('#modal').classList.contains('hidden'), 'Esc pauses the race');
click(doc.querySelectorAll('#modal-actions .act')[1]);   /* EXIT RACE */
assert(w.Race.running === false, 'race stopped on exit');
assert(!$('#screen-career').classList.contains('hidden'), 'exit returns to career');
click($('#btn-career-back'));

click($('#btn-career-back'));
click($('#btn-hub-settings'));
assert(!$('#screen-settings').classList.contains('hidden'), 'settings shown');
click(doc.querySelector('#quality-seg button[data-q="low"]'));
click(doc.querySelector('#quality-seg button[data-q="high"]'));
click(doc.querySelector('#sound-seg button[data-s="off"]'));
click(doc.querySelector('#sound-seg button[data-s="on"]'));
click($('#btn-settings-back'));

/* ---------- persistence ---------- */
const saved = JSON.parse(w.localStorage.getItem('payback_rush_save_v3'));
assert(saved.cash === 1000, 'save persisted cash 1000');
assert(saved.owned.length === 2 && saved.owned[0] === 'bruiser' && saved.owned[1] === 'hyperion', 'starters owned in save');
assert(saved.upgrades.bruiser.engine === 1, 'engine stage persisted');
assert(saved.equipped.bruiser.glow === 'amber', 'underglow persisted');
assert(!saved.nitroUnlocked.bruiser, 'nitrous still locked in save');

/* ---------- viewer ---------- */
assert(w.Viewer.ok === true, 'Viewer initialized (WebGL stub)');
assert(w.Viewer.viewMode === false, 'Viewer left view mode cleanly');

console.log('\nWEB SMOKE TEST PASSED');
process.exit(0);
