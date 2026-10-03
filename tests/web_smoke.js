/* Headless UI smoke test for the nfs3d web app.
 * Runs the real index.html + main.js in jsdom with a stubbed THREE and
 * clicks through: New Game -> Garage -> upgrade -> select-preview -> Career -> modal.
 * Run: NODE_PATH=/tmp/node_modules node tests/web_smoke.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'nfs3d', 'index.html'), 'utf8');
const mainJs = fs.readFileSync(path.join(ROOT, 'nfs3d', 'main.js'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost:8080/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const w = dom.window;

/* --- stub 2D canvas context (jsdom has no canvas impl) --- */
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

/* run the app */
w.eval(mainJs);

const doc = w.document;
const $ = s => doc.querySelector(s);
const click = el => el.dispatchEvent(new w.Event('click', { bubbles: true }));

assert(!$('#screen-home').classList.contains('hidden'), 'home screen visible at boot');
assert($('#btn-continue').disabled === true, 'CONTINUE disabled with no save');

click($('#btn-new'));                       // start new game
assert(save => true, 'clicked NEW GAME');
assert(!$('#screen-hub').classList.contains('hidden'), 'hub shown after NEW GAME');
assert($('#cash').textContent === '$5,000', 'starting cash is $5,000');

click($('#btn-garage'));
assert(!$('#screen-garage').classList.contains('hidden'), 'garage shown');
assert($('#car-name').textContent === 'FALCON GT', 'falcon previewed by default');
const cards = doc.querySelectorAll('.car-card');
assert(cards.length === 2, 'two cars in garage');
assert(cards[1].textContent.includes('LOCKED'), 'vortex shows locked');

click(cards[1]);                            // preview locked car
assert($('#car-name').textContent === 'VORTEX R', 'vortex previewed');
assert(!$('#btn-buy').classList.contains('hidden'), 'buy button visible for locked car');
assert($('#btn-buy').disabled === true, 'cannot afford $12,000 vortex with $5,000');

click(cards[0]);                            // back to falcon
const upBtn = doc.querySelector('.buy-up:not([disabled])');
click(upBtn);                               // buy ENGINE stage 1 ($700)
assert($('#cash').textContent === '$4,300', 'cash deducted to $4,300 after upgrade');

click($('#btn-select'));                    // already selected; disabled path
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

/* settings round-trip */
click($('#btn-career-back'));
click($('#btn-hub-settings'));
assert(!$('#screen-settings').classList.contains('hidden'), 'settings shown');
click(doc.querySelector('#quality-seg button[data-q="low"]'));
click(doc.querySelector('#quality-seg button[data-q="high"]'));
click($('#btn-settings-back'));

/* persistence */
const saved = JSON.parse(w.localStorage.getItem('payback_rush_save_v1'));
assert(saved.cash === 4300, 'save persisted cash 4300');
assert(saved.upgrades.falcon.engine === 1, 'save persisted engine stage 1');
assert(saved.owned.length === 1 && saved.owned[0] === 'falcon', 'one unlocked car owned');

console.log('\nWEB SMOKE TEST PASSED');
process.exit(0);
