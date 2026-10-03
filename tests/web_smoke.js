/* Headless UI smoke test for the nfs3d web app.
 * Runs the real index.html + audio.js + viewer.js + main.js in jsdom with a
 * stubbed THREE, then clicks through: New Game -> Garage (owned-car switching,
 * 3D view mode, customization purchases) -> Career -> modal -> Settings.
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

/* --- stub 2D/webgl canvas context (jsdom has no canvas impl) --- */
w.HTMLCanvasElement.prototype.getContext = function () {
  const noop = () => {};
  return new Proxy({}, {
    get: (t, p) => (p === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop),
    set: () => true,
  });
};

/* --- universal THREE stub (coerces to 0 in math, truthy in conditionals) --- */
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

/* run the real modules in order */
w.eval(read('audio.js'));
w.eval(read('viewer.js'));
w.eval(read('main.js'));

const doc = w.document;
const $ = s => doc.querySelector(s);
const click = el => el.dispatchEvent(new w.Event('click', { bubbles: true }));
const key = k => w.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));

/* ---------- home ---------- */
assert(!$('#screen-home').classList.contains('hidden'), 'home screen visible at boot');
assert($('#btn-continue').disabled === true, 'CONTINUE disabled with no save');

click($('#btn-new'));                       // start new game
assert(!$('#screen-hub').classList.contains('hidden'), 'hub shown after NEW GAME');
assert($('#cash').textContent === '$5,000', 'starting cash is $5,000');

/* ---------- garage ---------- */
click($('#btn-garage'));
assert(!$('#screen-garage').classList.contains('hidden'), 'garage shown');
assert($('#car-name').textContent === 'FALCON GT', 'falcon shown by default');
assert($('#tab-specs').classList.contains('on') === true, 'SPECS tab is the default garage panel');
assert($('#panel-custom').classList.contains('hidden') === true, 'customization hidden until opened');
assert($('#spec-bars').querySelectorAll('.spec').length === 6, 'six spec bars rendered');
assert(Number($('#car-rating').textContent) > 0, 'perf rating computed');

const cards = doc.querySelectorAll('.car-card');
assert(cards.length === 2, 'two cars listed in garage');
const cardTxt = [cards[0].textContent, cards[1].textContent].join(' ');
assert(!cardTxt.includes('LOCKED'), 'both sample cars unlocked (no LOCKED tab)');
assert(cardTxt.includes('ACTIVE') && cardTxt.includes('OWNED'), 'active + owned badges shown');

/* owned-only switching: arrow keys */
key('ArrowRight');
assert($('#car-name').textContent === 'VORTEX R', 'RIGHT arrow switches to VORTEX R');
key('ArrowLeft');
assert($('#car-name').textContent === 'FALCON GT', 'LEFT arrow switches back to FALCON GT');
click($('#btn-car-next'));
assert($('#car-name').textContent === 'VORTEX R', 'next-arrow button switches car');
click(cards[0]);                            // tab click back to falcon
assert($('#car-name').textContent === 'FALCON GT', 'car tab click switches car');

/* 3D view mode: press 1, then ESC */
key('1');
assert($('#screen-garage').classList.contains('view-mode') === true, 'press 1 enters 3D view mode');
assert($('#btn-view3d').textContent.includes('BACK TO SPECS'), 'view button becomes BACK TO SPECS');
key('Escape');
assert($('#screen-garage').classList.contains('view-mode') === false, 'ESC leaves 3D view mode');
click($('#btn-view3d'));
assert($('#screen-garage').classList.contains('view-mode') === true, 'VIEW 3D button toggles view mode');
key('Escape');

/* ---------- customization ---------- */
click($('#tab-custom'));
assert(!$('#panel-custom').classList.contains('hidden'), 'CUSTOMIZATION button opens parts panel');
const upRows = doc.querySelectorAll('#upgrade-list .up-row');
assert(upRows.length === 12, '12 upgrade categories available');
assert(doc.querySelectorAll('#upgrade-list .up-row.tier4').length === 2, 'two ELITE (endgame) parts listed');

const upBtn = doc.querySelector('.buy-up:not([disabled])');
assert(!!upBtn, 'an affordable upgrade exists');
click(upBtn);                               // ENGINE stage 1 = $700
assert($('#cash').textContent === '$4,300', 'cash deducted to $4,300 after upgrade');

const cosChips = doc.querySelectorAll('.cos-chip');
assert(cosChips.length >= 20, 'customization swatches rendered');
const paintLocked = Array.from(cosChips).find(c => c.textContent.includes('CHERRY RED'));
assert(!!paintLocked && paintLocked.classList.contains('locked'), 'cherry paint starts unpurchased');
click(paintLocked);                         // $500 paint
assert($('#cash').textContent === '$3,800', 'paint purchase deducted $500');
const paintChipNow = Array.from(doc.querySelectorAll('.cos-chip')).find(c => c.textContent.includes('CHERRY RED'));
assert(paintChipNow.classList.contains('on') === true, 'bought paint auto-equipped');
assert(paintChipNow.textContent.includes('EQUIPPED'), 'chip label reads EQUIPPED');

/* ---------- back / career ---------- */
click($('#btn-select'));                    // already selected -> disabled path
click($('#btn-garage-back'));
assert(!$('#screen-hub').classList.contains('hidden'), 'back at hub');

click($('#btn-career'));
assert(!$('#screen-career').classList.contains('hidden'), 'career shown');
const raceBtn = doc.querySelector('.race-card button');
assert(raceBtn.textContent === 'START RACE', 'race card has START RACE');
assert(doc.querySelector('.race-card').textContent.includes('$1,500'), 'race reward $1,500 shown');
click(raceBtn);
assert(!$('#modal').classList.contains('hidden'), 'modal opens for race');
click($('#modal-actions .act.primary'));
assert($('#modal').classList.contains('hidden'), 'modal closes');

/* ---------- settings ---------- */
click($('#btn-career-back'));
click($('#btn-hub-settings'));
assert(!$('#screen-settings').classList.contains('hidden'), 'settings shown');
click(doc.querySelector('#quality-seg button[data-q="low"]'));
click(doc.querySelector('#quality-seg button[data-q="high"]'));
click(doc.querySelector('#sound-seg button[data-s="off"]'));
click(doc.querySelector('#sound-seg button[data-s="on"]'));
assert($('#glb-status').textContent.length > 0, 'GLB model status row present');
click($('#btn-settings-back'));

/* ---------- persistence ---------- */
const saved = JSON.parse(w.localStorage.getItem('payback_rush_save_v2'));
assert(saved.cash === 3800, 'save persisted cash 3800');
assert(saved.upgrades.falcon.engine === 1, 'save persisted engine stage 1');
assert(saved.owned.length === 2, 'both cars owned in save');
assert(saved.cosOwned.indexOf('paint:cherry') >= 0, 'paint ownership persisted');
assert(saved.equipped.falcon.paint === 'cherry', 'equipped paint persisted');

/* ---------- 3D viewer state ---------- */
assert(w.Viewer.ok === true, 'Viewer initialized (WebGL stub)');
assert(w.Viewer.viewMode === false, 'Viewer left garage view mode cleanly');

console.log('\nWEB SMOKE TEST PASSED');
process.exit(0);
