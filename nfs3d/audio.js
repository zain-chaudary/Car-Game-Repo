/* ================================================================
   AudioFX — synthesized game sound (no assets needed).
   UI ticks, buys, errors, whooshes + a looping engine for the 3D
   garage viewer. Respects settings.sound. Autoplay-safe: the
   context is created on the first user gesture.
   ================================================================ */
'use strict';

const AudioFX = {
  ctx: null,
  master: null,
  enabled: true,
  _engine: null,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(this.ctx.destination);
  },

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.9 : 0;
  },

  _now() { return this.ctx.currentTime; },

  _tone(freq, dur, type, vol, glideTo) {
    if (!this.ctx) return;
    const t = this._now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },

  _noise(dur, vol, filterFreq, q) {
    if (!this.ctx) return;
    const t = this._now();
    const len = Math.max(1, (dur * this.ctx.sampleRate) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = filterFreq; f.Q.value = q || 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  },

  /* -------- UI -------- */
  hover()  { this._tone(2400, 0.05, 'sine', 0.05); },
  click()  { this._noise(0.07, 0.16, 2600, 1.4); this._tone(340, 0.08, 'square', 0.06, 180); },
  back()   { this._tone(500, 0.1, 'sine', 0.08, 260); },
  whoosh() { this._noise(0.4, 0.12, 900, 0.6); },
  buy() {
    this._tone(660, 0.09, 'sine', 0.12);
    setTimeout(() => this._tone(880, 0.09, 'sine', 0.12), 80);
    setTimeout(() => this._tone(1320, 0.16, 'sine', 0.12), 160);
    this._noise(0.25, 0.06, 5200, 1);
  },
  error() { this._tone(160, 0.22, 'sawtooth', 0.1, 90); },
  select() { this._tone(440, 0.08, 'triangle', 0.12, 660); },

  /* -------- engine loop (garage 3D viewer) -------- */
  engineStart() {
    if (!this.ctx || this._engine) return;
    const t = this._now();
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.6);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 2;

    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 62;
    const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 62.7;
    const o3 = this.ctx.createOscillator(); o3.type = 'square';  o3.frequency.value = 31;

    const len = this.ctx.sampleRate * 2;
    const nbuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = nbuf; noise.loop = true;
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 240; nf.Q.value = 0.7;
    const ng = this.ctx.createGain(); ng.gain.value = 0.35;

    /* idle wobble */
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 11;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 2.2;
    lfo.connect(lfoG); lfoG.connect(o1.frequency); lfoG.connect(o2.frequency);

    o1.connect(lp); o2.connect(lp); o3.connect(lp);
    noise.connect(nf); nf.connect(ng); ng.connect(lp);
    lp.connect(g); g.connect(this.master);
    [o1, o2, o3, noise, lfo].forEach(n => n.start(t));

    this._engine = { g, o1, o2, o3, lp, stopAt: null };

    /* random idle revs */
    this._engine.timer = setInterval(() => this.rev(0.5 + Math.random() * 0.7), 2600 + Math.random() * 2400);
  },

  rev(amount) {
    if (!this._engine || !this.ctx) return;
    const e = this._engine, t = this._now();
    const up = 62 + 90 * (amount || 0.8);
    [e.o1, e.o2].forEach((o, i) => {
      o.frequency.cancelScheduledValues(t);
      o.frequency.setValueAtTime(o.frequency.value, t);
      o.frequency.linearRampToValueAtTime(up + i * 0.7, t + 0.25);
      o.frequency.exponentialRampToValueAtTime(62 + i * 0.7, t + 1.4);
    });
    e.lp.frequency.cancelScheduledValues(t);
    e.lp.frequency.setValueAtTime(e.lp.frequency.value, t);
    e.lp.frequency.linearRampToValueAtTime(900, t + 0.25);
    e.lp.frequency.exponentialRampToValueAtTime(420, t + 1.4);
  },

  countBeep(final) { this._tone(final ? 880 : 440, final ? 0.5 : 0.14, 'sine', 0.22); },
  win() {
    [660, 880, 990, 1320].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 'triangle', 0.16), i * 130));
    this._noise(0.5, 0.06, 6000, 1);
  },
  lose() { this._tone(330, 0.25, 'triangle', 0.14, 220); setTimeout(() => this._tone(247, 0.4, 'triangle', 0.14, 165), 220); },

  /* tie the garage engine loop to road speed */
  raceSet(ratio) {
    if (!this._engine || !this.ctx) return;
    const e = this._engine;
    const f = 58 + ratio * 150;
    const t = this._now();
    [e.o1, e.o2].forEach((o, i) => {
      o.frequency.cancelScheduledValues(t);
      o.frequency.setTargetAtTime ? o.frequency.setTargetAtTime(f + i * 0.8, t, 0.08) : (o.frequency.value = f + i * 0.8);
    });
    e.lp.frequency.setTargetAtTime ? e.lp.frequency.setTargetAtTime(380 + ratio * 1400, t, 0.1) : (e.lp.frequency.value = 380 + ratio * 1400);
  },

  engineStop() {
    if (!this._engine || !this.ctx) return;
    const e = this._engine, t = this._now();
    clearInterval(e.timer);
    e.g.gain.cancelScheduledValues(t);
    e.g.gain.setValueAtTime(e.g.gain.value, t);
    e.g.gain.linearRampToValueAtTime(0, t + 0.4);
    [e.o1, e.o2, e.o3].forEach(o => { try { o.stop(t + 0.5); } catch (err) {} });
    this._engine = null;
  },
};

/* unlock audio on first gesture (autoplay policies) */
['pointerdown', 'keydown'].forEach(ev =>
  window.addEventListener(ev, () => {
    AudioFX.init();
    if (AudioFX.ctx && AudioFX.ctx.state === 'suspended') AudioFX.ctx.resume();
  }, { once: false, passive: true }));

if (typeof window !== 'undefined') window.AudioFX = AudioFX;

