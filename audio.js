'use strict';
/* ==========================================================================
   audio.js — a tiny WebAudio synthesizer for all sound effects.
   No audio files are needed; every sound is generated on the fly.
   ========================================================================== */

const Sound = {
  ac: null, master: null, noiseBuf: null,
  volume: 0.6, muted: false, last: {},

  // Browsers only allow audio after a user gesture, so this is called on the first key/click.
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ac.destination);
      const len = this.ac.sampleRate;
      this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ac = null; }
  },

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; },

  osc(type, f0, f1, dur, vol, delay = 0) {
    const ac = this.ac, t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  },

  noise(dur, vol, freq, ftype = 'lowpass', f1 = null, delay = 0, q = 0.8) {
    const ac = this.ac, t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ac.createBiquadFilter(); f.type = ftype; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  },

  play(name) {
    if (!this.ac || this.muted || this.volume <= 0) return;
    const now = performance.now();
    if (now - (this.last[name] || 0) < 35) return;
    this.last[name] = now;
    const S = this;
    switch (name) {
      case 'hit': S.noise(0.08, 0.5, 1800, 'bandpass', 600); S.osc('square', 180, 60, 0.08, 0.12); break;
      case 'heavy': S.noise(0.2, 0.7, 1200, 'lowpass', 200); S.osc('sine', 130, 40, 0.22, 0.5); break;
      case 'block': S.osc('triangle', 900, 600, 0.06, 0.2); S.noise(0.05, 0.25, 4000, 'highpass'); break;
      case 'whoosh': S.noise(0.12, 0.16, 800, 'bandpass', 2400, 0, 1.5); break;
      case 'swish': S.noise(0.14, 0.3, 3000, 'bandpass', 7000, 0, 2); S.osc('sine', 1400, 2400, 0.1, 0.05); break;
      case 'slash': S.noise(0.1, 0.35, 5000, 'highpass', 9000); S.osc('sawtooth', 2200, 900, 0.07, 0.05); break;
      case 'jump': S.osc('sine', 300, 520, 0.08, 0.05); break;
      case 'dash': S.noise(0.15, 0.25, 500, 'bandpass', 1800, 0, 1); break;
      case 'teleport': S.osc('sine', 1800, 400, 0.15, 0.1); S.osc('triangle', 600, 2000, 0.12, 0.07); break;
      case 'charge': S.osc('sawtooth', 120, 600, 0.6, 0.07); S.osc('sine', 240, 1200, 0.6, 0.07); break;
      case 'blue': S.osc('sine', 500, 160, 0.5, 0.25); S.noise(0.5, 0.15, 400, 'lowpass', 100); break;
      case 'red': S.osc('sawtooth', 900, 200, 0.25, 0.14); S.noise(0.25, 0.4, 2000, 'lowpass', 300); break;
      case 'purple': S.osc('sawtooth', 80, 30, 1.2, 0.3); S.noise(1.2, 0.5, 900, 'lowpass', 80); S.osc('sine', 400, 60, 1.0, 0.3); break;
      case 'boom': S.noise(0.6, 0.8, 900, 'lowpass', 60); S.osc('sine', 90, 30, 0.6, 0.55); break;
      case 'fire': S.noise(0.5, 0.4, 1500, 'bandpass', 400, 0, 0.6); break;
      case 'zap': S.osc('sawtooth', 1200, 200, 0.15, 0.14); S.noise(0.2, 0.4, 6000, 'highpass'); break;
      case 'bite': S.noise(0.06, 0.4, 2500, 'bandpass'); S.osc('square', 300, 120, 0.06, 0.1); break;
      case 'bark': S.osc('square', 420, 220, 0.08, 0.1); S.osc('square', 400, 200, 0.08, 0.1, 0.12); break;
      case 'croak': S.osc('sawtooth', 160, 90, 0.2, 0.2); break;
      case 'grab': S.osc('square', 200, 90, 0.15, 0.18); S.noise(0.1, 0.3, 800); break;
      case 'voice': S.osc('sawtooth', 150, 110, 0.5, 0.22); S.osc('sawtooth', 153, 108, 0.5, 0.18); S.noise(0.5, 0.2, 700, 'bandpass'); break;
      case 'domain':
        [196, 233, 294, 392].forEach((f, i) => S.osc('sine', f, f * 0.98, 2.2, 0.1, i * 0.08));
        S.osc('sawtooth', 55, 50, 2.5, 0.1); break;
      case 'bf': S.noise(0.4, 0.9, 3000, 'lowpass', 100); S.osc('square', 60, 30, 0.4, 0.45); S.osc('sawtooth', 2000, 100, 0.2, 0.14); break;
      case 'ko': S.osc('sine', 200, 40, 1.0, 0.45); S.noise(0.8, 0.5, 600, 'lowpass', 60); break;
      case 'round': S.osc('triangle', 440, 440, 0.25, 0.18); S.osc('triangle', 660, 660, 0.4, 0.18, 0.2); break;
      case 'fight':
        S.osc('sawtooth', 330, 330, 0.12, 0.12); S.osc('sawtooth', 494, 494, 0.12, 0.12, 0.1);
        S.osc('sawtooth', 660, 660, 0.4, 0.15, 0.2); break;
      case 'select': S.osc('triangle', 700, 900, 0.05, 0.1); break;
      case 'confirm': S.osc('triangle', 600, 600, 0.08, 0.14); S.osc('triangle', 900, 900, 0.15, 0.14, 0.07); break;
      case 'back': S.osc('triangle', 500, 300, 0.1, 0.1); break;
      case 'tick': S.osc('sine', 1400, 1000, 0.03, 0.05); break;
      case 'cue': S.osc('sine', 1800, 2400, 0.06, 0.12); break;
      case 'guardbreak': S.osc('square', 300, 80, 0.4, 0.22); S.noise(0.3, 0.5, 2000, 'lowpass', 200); break;
      case 'land': S.noise(0.15, 0.35, 400, 'lowpass', 80); break;
      case 'heal': [523, 659, 784].forEach((f, i) => S.osc('sine', f, f, 0.3, 0.09, i * 0.07)); break;
      case 'roar': S.osc('sawtooth', 110, 60, 0.7, 0.28); S.noise(0.7, 0.4, 500, 'lowpass', 150); break;
      case 'clash': S.noise(1.0, 0.8, 4000, 'lowpass', 100); S.osc('sine', 800, 50, 1.0, 0.4); break;
      case 'gunshot': S.noise(0.12, 0.8, 3000, 'lowpass', 300); S.osc('square', 220, 60, 0.08, 0.2); break;
      case 'glass': S.noise(0.3, 0.6, 5000, 'highpass'); [2600, 3400, 4100].forEach((f, i) => S.osc('triangle', f, f * 0.9, 0.2, 0.06, i * 0.03)); S.osc('sine', 160, 60, 0.15, 0.3); break;
      case 'shotgun': S.noise(0.45, 1.0, 2400, 'lowpass', 180); S.osc('sine', 130, 38, 0.3, 0.55); S.osc('square', 90, 40, 0.1, 0.18); break;
      case 'click': S.noise(0.03, 0.5, 4000, 'highpass'); S.osc('square', 1800, 1200, 0.025, 0.06); break;
      case 'reload': S.noise(0.06, 0.6, 2500, 'bandpass', null, 0, 4); S.noise(0.07, 0.7, 1600, 'bandpass', null, 0.12, 4); S.osc('square', 300, 200, 0.04, 0.08, 0.12); break;
      case 'glug': S.osc('sine', 220, 140, 0.09, 0.2); S.osc('sine', 180, 110, 0.09, 0.16, 0.1); break;
      case 'cash': [1320, 1760, 2640].forEach((f, i) => S.osc('triangle', f, f, 0.12, 0.08, i * 0.05)); S.noise(0.08, 0.2, 6000, 'highpass'); break;
    }
  },

  /* ------------------------------------------------------------ domain music
     A domain spec's `music` names a track; game.js calls syncMusic every frame so the track
     starts with the domain and stops the moment it ends, however it ends. If an audio file
     for the track is present (e.g. music/moskau.mp3) it plays that instead of the synth.   */

  track: null, buffers: {},

  syncMusic(name) {
    if (this.muted || this.volume <= 0) name = null;
    if ((this.track ? this.track.name : null) === (name || null)) return;
    this.stopMusic();
    if (name && this.ac && MUSIC[name]) this.startMusic(name);
  },

  startMusic(name) {
    const S = this, ac = S.ac, spec = MUSIC[name];
    const out = ac.createGain(); out.gain.value = 0.9; out.connect(S.master);
    const tr = { name, out, step: 0, bpm: spec.bpm, next: ac.currentTime + 0.06, timer: null, src: null };
    S.track = tr;
    // step sequencer with a short lookahead
    tr.timer = setInterval(() => {
      while (tr.next < ac.currentTime + 0.2) {
        spec.step(S, tr, tr.step, tr.next);
        tr.next += 60 / tr.bpm / 4; tr.step++;
      }
    }, 40);
    if (spec.file) S.loadBuffer(spec.file).then(buf => {
      if (!buf || S.track !== tr) return;
      clearInterval(tr.timer); tr.timer = null;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(out); src.start();
      tr.src = src;
    });
  },

  stopMusic() {
    const tr = this.track;
    if (!tr) return;
    this.track = null;
    if (tr.timer) clearInterval(tr.timer);
    const t = this.ac.currentTime;
    tr.out.gain.setValueAtTime(tr.out.gain.value, t);
    tr.out.gain.linearRampToValueAtTime(0, t + 0.25);
    setTimeout(() => { try { if (tr.src) tr.src.stop(); tr.out.disconnect(); } catch (e) { /* already gone */ } }, 400);
  },

  loadBuffer(file) {
    if (file in this.buffers) return Promise.resolve(this.buffers[file]);
    return fetch(file)
      .then(r => (r.ok ? r.arrayBuffer() : null))
      .then(b => (b ? this.ac.decodeAudioData(b) : null))
      .catch(() => null)
      .then(buf => (this.buffers[file] = buf));
  },

  // one scheduled synth note into a track's output
  note(tr, type, freq, t, dur, vol, f1) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(tr.out); o.start(t); o.stop(t + dur + 0.03);
  },
  hiss(tr, t, dur, vol, freq, ftype) {
    const ac = this.ac, s = ac.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ac.createBiquadFilter(); f.type = ftype; f.frequency.value = freq;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(tr.out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  },
};

const hz = semi => 440 * Math.pow(2, semi / 12);   // semitones from A4

const MUSIC = {
  // An original mariachi-flavoured desert stomp in D minor: oom-pah bass, strummed guitar,
  // a bright trumpet-ish lead and castanet clicks.
  desert: {
    bpm: 112,
    chords: [-7, -7, 0, 0, -2, -7, 0, -7],
    minor: [true, true, false, false, true, true, false, true],
    lead: [
      [5, null, 5, 4, 5, null, 0, null], [1, 0, -2, 0, 1, null, null, null],
      [4, null, 4, 1, 4, null, 0, null], [-2, 0, 1, 4, 7, null, null, null],
      [1, null, 1, 0, -2, null, -4, null], [-2, -4, -5, -7, -4, null, null, null],
      [-5, -2, 0, 4, 7, null, 4, null], [5, null, 0, null, -7, null, null, null],
    ],
    step(S, tr, i, t) {
      const s = i % 16, bar = Math.floor(i / 16) % 8, root = this.chords[bar];
      // oom-pah: root on the beat, fifth on the 3
      if (s === 0 || s === 8) S.note(tr, 'triangle', hz(root - 24), t, 0.22, 0.35);
      if (s === 4 || s === 12) S.note(tr, 'triangle', hz(root - 17), t, 0.2, 0.28);
      // strummed chord on the off-beats
      if (s % 4 === 2) for (const [k, n] of [0, this.minor[bar] ? 3 : 4, 7].entries()) S.note(tr, 'triangle', hz(root + n), t + k * 0.012, 0.12, 0.04);
      // castanets
      if (s % 4 === 3 || s === 14) S.hiss(tr, t, 0.03, 0.16, 5000, 'bandpass');
      if (s % 2 === 0) {
        const n = this.lead[bar][s / 2];
        if (n !== null) { S.note(tr, 'sawtooth', hz(n + 12), t, 0.18, 0.05); S.note(tr, 'square', hz(n + 12), t, 0.14, 0.035); }
      }
    },
  },
  // An original Russian-disco stomp in A minor: four-on-the-floor kick, octave-bouncing bass,
  // a balalaika-ish square lead and a shouted "HEY!" — it speeds up every time it loops.
  // Drop your own copy of the song at music/moskau.mp3 and that will play instead.
  moskau: {
    file: 'music/moskau.mp3', bpm: 128,
    chords: [-12, -12, -7, -5, -4, -2, -5, -12],
    lead: [
      [12, 12, 15, 12, 11, null, 12, null], [7, null, 8, 7, 5, 3, 2, null],
      [5, 5, 8, 5, 3, null, 5, null], [2, null, 3, 2, -1, null, null, null],
      [8, 8, 12, 8, 7, null, 8, null], [10, null, 12, 10, 7, 5, 3, null],
      [7, 11, 14, 11, 7, null, 11, null], [12, null, 7, null, 0, null, null, null],
    ],
    step(S, tr, i, t) {
      const s = i % 16, bar = Math.floor(i / 16) % 8, root = this.chords[bar] - 12;
      if (i > 0 && i % 128 === 0) tr.bpm = Math.min(168, tr.bpm + 6);   // faster every loop
      if (s % 4 === 0) { S.note(tr, 'sine', 150, t, 0.16, 0.55, 45); S.hiss(tr, t, 0.02, 0.18, 2500, 'lowpass'); }
      if (s === 4 || s === 12) S.hiss(tr, t, 0.14, 0.32, 1800, 'bandpass');
      if (s % 4 === 2) S.hiss(tr, t, 0.04, 0.12, 8000, 'highpass');
      if (s % 2 === 0) S.note(tr, 'sawtooth', hz(root + (s % 4 === 2 ? 12 : 0)), t, 0.12, 0.13);
      if (s % 2 === 0) {
        const n = this.lead[bar][s / 2];
        if (n !== null) { S.note(tr, 'square', hz(n), t, 0.16, 0.07); S.note(tr, 'triangle', hz(n + 12), t, 0.09, 0.05); }
      }
      // tremolo strum of the chord on the off-beats
      if (s % 4 === 3) for (const k of [0, 3, 7]) S.note(tr, 'triangle', hz(this.chords[bar] + 12 + (bar === 3 || bar === 6 ? (k === 3 ? 4 : k) : k)), t, 0.07, 0.025);
      if (bar === 7 && s === 12) { S.hiss(tr, t, 0.25, 0.45, 900, 'bandpass'); S.note(tr, 'sawtooth', 260, t, 0.22, 0.14, 180); }
    },
  },
};
