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
    }
  },
};
