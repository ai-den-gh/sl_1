'use strict';
/* ==========================================================================
   game.js — keyboard input, arenas, match & round flow, story progression,
   rendering and the fixed-timestep main loop.
   ========================================================================== */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const STEP = 1 / 60;
let RS = 1; // render scale: canvas pixels per game unit

/* ---------------------------------------------------------------- input */

const BINDS = {
  p1: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS', 'Mouse2'], basic: ['KeyJ', 'Mouse0'], heavy: ['KeyK'],
    s0: ['KeyU'], s1: ['KeyI'], s2: ['KeyO'], s3: ['KeyL'], s4: ['KeyH'], s5: ['KeyG'], s6: ['KeyY'], s7: ['KeyT'], s8: ['KeyR'], clash: ['Space'], dash: ['ShiftLeft'] },
  p2: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], basic: ['Numpad1', 'Period'], heavy: ['Numpad2', 'Slash'],
    s0: ['Numpad4', 'KeyP'], s1: ['Numpad5', 'BracketLeft'], s2: ['Numpad6', 'BracketRight'], s3: ['Numpad7', 'Backslash'], s4: ['Numpad8', 'Quote'], s5: ['Numpad9', 'Semicolon'], s6: ['Numpad3', 'Minus'], s7: ['NumpadDecimal', 'Equal'], s8: ['NumpadAdd', 'Digit0'], clash: ['Enter', 'NumpadEnter'], dash: ['Numpad0', 'ShiftRight'] },
};
BINDS.solo = {};
for (const k in BINDS.p1) BINDS.solo[k] = BINDS.p1[k].concat(BINDS.p2[k]);
const ALL_BOUND = new Set(Object.values(BINDS.solo).flat());

const Input = {
  down: new Set(),
  queue: new Map(), // code -> age in frames; consumed by controllers
  init() {
    addEventListener('keydown', e => {
      Sound.init();
      if (ALL_BOUND.has(e.code) || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.queue.set(e.code, 0);
      this.down.add(e.code);
      UI.onKey(e);
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    // Player 1 mouse: left click = M1 (basic attack), hold right click = block.
    canvas.addEventListener('mousedown', e => {
      if ((e.button !== 0 && e.button !== 2) || UI.screen) return;
      e.preventDefault();
      const code = 'Mouse' + e.button;
      this.queue.set(code, 0); this.down.add(code);
    });
    addEventListener('mouseup', e => this.down.delete('Mouse' + e.button));
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('blur', () => { this.down.clear(); this.queue.clear(); });
  },
  age() { for (const [k, v] of this.queue) { if (v > 20) this.queue.delete(k); else this.queue.set(k, v + 1); } },
};

class KeyController {
  constructor(map) { this.map = map; this.held = {}; this.pressed = {}; }
  update() {
    for (const k in this.map) {
      const codes = this.map[k];
      this.held[k] = codes.some(c => Input.down.has(c));
      this.pressed[k] = false;
      for (const c of codes) if (Input.queue.has(c)) { this.pressed[k] = true; Input.queue.delete(c); }
    }
  }
}

/* ---------------------------------------------------------------- arenas */

function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

function drawGround(c, top, bottom, line) {
  const g = c.createLinearGradient(0, FLOOR, 0, H);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  c.fillStyle = g; c.fillRect(0, FLOOR, W, H - FLOOR);
  c.fillStyle = line; c.fillRect(0, FLOOR, W, 3);
}

function drawPlatforms(c, plats, top, side) {
  for (const p of plats) {
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(p.x + 8, p.y + 14, p.w - 16, 8);
    c.fillStyle = side;
    c.fillRect(p.x + 14, p.y, 10, FLOOR - p.y); c.fillRect(p.x + p.w - 24, p.y, 10, FLOOR - p.y);
    c.fillStyle = top; c.fillRect(p.x, p.y, p.w, 12);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(p.x, p.y, p.w, 2);
  }
}

// Hiding spots on big maps, drawn in front of the fighters. A spot is see-through (and labelled)
// only while it hides a player, so you can still see yourself; it fully covers a hidden CPU.
function drawHides(c, hides, t) {
  for (const h of hides) {
    const who = World.fighters.filter(f => f.hidden && f.hideSpot === h), mine = who.some(f => f.tag !== 'CPU');
    c.save(); c.globalAlpha = mine ? 0.72 : 1;
    const { x, y, w } = h, top = y - h.h, cx = x + w / 2;
    c.lineWidth = 3; c.strokeStyle = '#101018';
    switch (h.kind) {
      case 'bush':
        c.fillStyle = '#1a3a1a';
        for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(x + 15 + i * (w - 30) / 6, y - 50 - Math.sin(i * 2.3) * 30, 48, 0, 6.283); c.fill(); }
        c.fillStyle = '#244a22'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(x + 25 + i * (w - 50) / 4, y - 90 - (i % 2) * 20, 30, 0, 6.283); c.fill(); }
        c.fillRect(x, y - 50, w, 50);
        break;
      case 'clock':
        c.fillStyle = '#3a2214'; c.fillRect(x, top, w, h.h); c.fillStyle = '#5a3420'; c.fillRect(x + 8, top + 8, w - 16, h.h - 16);
        c.fillStyle = '#e8e0c8'; c.beginPath(); c.arc(cx, top + 45, 28, 0, 6.283); c.fill();
        c.strokeStyle = '#1a1010'; c.beginPath(); c.moveTo(cx, top + 45); c.lineTo(cx + Math.cos(t * 0.01) * 20, top + 45 + Math.sin(t * 0.01) * 20); c.moveTo(cx, top + 45); c.lineTo(cx, top + 28); c.stroke();
        c.fillStyle = '#c8a050'; c.beginPath(); c.arc(cx + Math.sin(t * 0.08) * 18, top + 150, 12, 0, 6.283); c.fill();
        break;
      case 'bookcase': case 'pantry': case 'wardrobe': {
        c.fillStyle = h.kind === 'wardrobe' ? '#4a2a3a' : h.kind === 'pantry' ? '#6a5030' : '#3a2414'; c.fillRect(x, top, w, h.h);
        if (h.kind === 'bookcase') {
          for (let r = 0; r < 5; r++) for (let b = 0; b < 9; b++) { c.fillStyle = ['#7a2a2a', '#2a4a7a', '#3a6a3a', '#8a6a2a', '#5a3a6a'][(r * 9 + b) % 5]; c.fillRect(x + 8 + b * 13, top + 10 + r * 44, 11, 34 - ((b * 7 + r) % 3) * 5); }
        } else if (h.kind === 'pantry') {
          for (let r = 0; r < 4; r++) { c.fillStyle = '#4a3820'; c.fillRect(x + 4, top + 50 + r * 50, w - 8, 5); for (let b = 0; b < 4; b++) { c.fillStyle = ['#c84a2a', '#e8d8a0', '#4a8a3a', '#8a5a2a'][(r + b) % 4]; c.fillRect(x + 12 + b * 26, top + 26 + r * 50, 18, 24); } }
        } else {
          c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(cx - 1, top + 10, 2, h.h - 20);
          c.fillStyle = '#c8a050'; c.fillRect(cx - 10, top + h.h / 2, 5, 14); c.fillRect(cx + 5, top + h.h / 2, 5, 14);
        }
        c.strokeRect(x, top, w, h.h);
        break;
      }
      case 'crates':
        for (const [bx, by, s] of [[x, y - 80, 80], [x + 70, y - 80, 80], [x + 30, y - 160, 80]]) {
          c.fillStyle = '#7a5a30'; c.fillRect(bx, by, s, s); c.strokeStyle = '#4a3418'; c.lineWidth = 4; c.strokeRect(bx + 2, by + 2, s - 4, s - 4);
          c.beginPath(); c.moveTo(bx + 4, by + 4); c.lineTo(bx + s - 4, by + s - 4); c.stroke();
        }
        break;
      case 'curtain': case 'fitting': {
        const [c1, c2] = h.kind === 'curtain' ? ['#8a1a2a', '#a4223a'] : ['#2a5a7a', '#3a6a8a'];
        if (h.kind === 'fitting') { c.fillStyle = '#d8d0c0'; c.fillRect(x - 8, top - 30, w + 16, h.h + 30); c.fillStyle = '#2a2a30'; c.font = '800 13px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.fillText('FITTING', cx, top - 10); }
        for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? c1 : c2; const sw = Math.sin(t * 0.02 + i) * 3; c.beginPath(); c.moveTo(x + i * w / 6, top); c.lineTo(x + (i + 1) * w / 6, top); c.lineTo(x + (i + 1) * w / 6 + sw, y); c.lineTo(x + i * w / 6 + sw, y); c.fill(); }
        c.fillStyle = '#d8b860'; c.fillRect(x - 6, top - 6, w + 12, 10);
        break;
      }
      case 'locker':
        c.fillStyle = '#4a5a6a'; c.fillRect(x, top, w, h.h); c.strokeRect(x, top, w, h.h);
        for (let i = 0; i < 2; i++) {
          const lx = x + i * w / 2; c.strokeRect(lx + 4, top + 4, w / 2 - 8, h.h - 8);
          c.fillStyle = '#2a3440'; for (let v = 0; v < 4; v++) c.fillRect(lx + 12, top + 16 + v * 8, w / 2 - 24, 3);
          c.fillStyle = '#c8c8d0'; c.fillRect(lx + w / 2 - 14, top + h.h / 2, 4, 18);
        }
        break;
      case 'vending': {
        c.fillStyle = '#c4222f'; c.fillRect(x, top, w, h.h); c.strokeRect(x, top, w, h.h);
        c.fillStyle = '#10141c'; c.fillRect(x + 8, top + 14, w - 32, h.h - 70);
        for (let r = 0; r < 4; r++) for (let b = 0; b < 3; b++) { c.fillStyle = ['#4ad0ff', '#ffd34d', '#7fd04a', '#ff8a2a'][(r + b) % 4]; c.fillRect(x + 14 + b * 20, top + 24 + r * 34, 12, 24); }
        c.fillStyle = `rgba(200,240,255,${0.12 + 0.05 * Math.sin(t * 0.2)})`; c.fillRect(x + 8, top + 14, w - 32, h.h - 70);
        c.fillStyle = '#e8e8f0'; c.fillRect(x + w - 20, top + 30, 12, 50); c.fillStyle = '#10141c'; c.fillRect(x + 10, y - 44, w - 34, 22);
        break;
      }
      case 'booth':
        c.fillStyle = '#2a4a8a'; c.fillRect(x, top, w, h.h); c.strokeRect(x, top, w, h.h);
        c.fillStyle = '#e8d890'; c.fillRect(x + 12, top + 40, w - 24, 60); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 12, top + 85, w - 24, 15);
        c.fillStyle = '#ffffff'; c.font = '800 14px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.fillText('TICKETS', cx, top + 26);
        c.fillStyle = '#1a2a4a'; c.fillRect(x + 6, top + 112, w - 12, 8);
        break;
      case 'pillar':
        c.fillStyle = '#8a8a90'; c.fillRect(x, top, w, h.h); c.strokeRect(x, top, w, h.h);
        c.fillStyle = '#ff7ad9'; c.fillRect(x + 10, top + 40, w - 20, 110); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(cx, top + 80, 18, 0, 6.283); c.fill();
        c.fillStyle = '#2a2a30'; c.font = '900 12px Impact, sans-serif'; c.textAlign = 'center'; c.fillText('SALE', cx, top + 135);
        break;
      case 'container':
        c.fillStyle = '#2a6a8a'; c.fillRect(x, top, w, h.h); c.strokeRect(x, top, w, h.h);
        c.fillStyle = 'rgba(0,0,0,0.22)'; for (let r = x + 8; r < x + w; r += 14) c.fillRect(r, top + 6, 6, h.h - 12);
        c.fillStyle = '#d8d8d0'; c.font = '900 16px Impact, sans-serif'; c.textAlign = 'center'; c.fillText('KAISEN LINE', cx, top + 30);
        break;
      case 'barrels':
        for (const [bx, by] of [[x + 4, y], [x + w / 2, y], [x + w / 4, y - 85]]) {
          c.fillStyle = '#3a5a3a'; c.fillRect(bx, by - 85, w / 2 - 6, 85); c.strokeRect(bx, by - 85, w / 2 - 6, 85);
          c.fillStyle = '#2a4a2a'; c.fillRect(bx, by - 62, w / 2 - 6, 5); c.fillRect(bx, by - 28, w / 2 - 6, 5);
          c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(bx + w / 4 - 3, by - 44, 7, 0, 6.283); c.fill();
        }
        break;
      case 'tarp':
        c.fillStyle = '#2a5aa8';
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 6, top + 60, x + 20, top + 20); c.quadraticCurveTo(cx, top - 14, x + w - 20, top + 30); c.quadraticCurveTo(x + w + 8, top + 80, x + w, y); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(0,0,0,0.25)'; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + i * w / 4, top + 20); c.lineTo(x + i * w / 4 + 6, y); c.stroke(); }
        c.strokeStyle = '#d8c890'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 60); c.lineTo(x + w, y - 70); c.stroke();
        break;
      case 'nets':
        c.fillStyle = '#5a4a30'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 10, top, cx, top + 10); c.quadraticCurveTo(x + w - 10, top, x + w, y); c.closePath(); c.fill();
        c.strokeStyle = '#8a7a50'; c.lineWidth = 1.5;
        for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(x + i * w / 8, y); c.lineTo(cx + (i - 4) * 6, top + 20); c.stroke(); }
        for (let j = 1; j < 6; j++) { c.beginPath(); c.moveTo(x + j * 4, y - j * h.h / 6); c.lineTo(x + w - j * 4, y - j * h.h / 6); c.stroke(); }
        for (const [bx, by] of [[x + 20, y - 40], [x + w - 30, y - 90], [cx, y - 140]]) { c.fillStyle = '#ff6a2a'; c.beginPath(); c.arc(bx, by, 10, 0, 6.283); c.fill(); }
        break;
      case 'shelf':
        c.fillStyle = '#5a6068'; c.fillRect(x, top, 6, h.h); c.fillRect(x + w - 6, top, 6, h.h);
        for (let r = 0; r < 4; r++) {
          const sy = top + 10 + r * (h.h - 10) / 4;
          for (let b = 0; b < 3; b++) { c.fillStyle = ['#a8804a', '#8a6a3a', '#c09a5a'][(r + b) % 3]; c.fillRect(x + 8 + b * (w - 16) / 3, sy, (w - 16) / 3 - 2, (h.h - 10) / 4 - 6); }
          c.fillStyle = '#3a4048'; c.fillRect(x, sy + (h.h - 10) / 4 - 6, w, 5);
        }
        break;
      case 'rack':
        c.strokeStyle = '#c8c8d0'; c.beginPath(); c.moveTo(x, top); c.lineTo(x + w, top); c.moveTo(x + 6, top); c.lineTo(x + 6, y); c.moveTo(x + w - 6, top); c.lineTo(x + w - 6, y); c.stroke();
        for (let i = 0; i < 8; i++) {
          const kx = x + 4 + i * (w - 8) / 8, sw = Math.sin(t * 0.03 + i) * 2;
          c.fillStyle = ['#c4222f', '#2a4a8a', '#e8d8a0', '#3a6a3a', '#5a3a6a', '#ff9a2a', '#202028', '#e8e8f0'][i];
          c.beginPath(); c.moveTo(kx + 6, top + 4); c.lineTo(kx + (w - 8) / 8 + 6, top + 4); c.lineTo(kx + (w - 8) / 8 + 8 + sw, y - 20); c.lineTo(kx - 2 + sw, y - 20); c.closePath(); c.fill();
        }
        break;
      case 'photobooth':
        c.fillStyle = '#d4a020'; c.fillRect(x, top, w, h.h); c.strokeRect(x, top, w, h.h);
        c.fillStyle = '#c4222f'; c.fillRect(x + 10, top + 40, w - 20, h.h - 50);
        c.fillStyle = 'rgba(0,0,0,0.2)'; for (let i = 1; i < 5; i++) c.fillRect(x + 10 + i * (w - 20) / 5, top + 40, 3, h.h - 50);
        c.fillStyle = '#ffffff'; c.font = '900 15px Impact, sans-serif'; c.textAlign = 'center'; c.fillText('PHOTO', cx, top + 26);
        if (t % 240 < 6) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(x + 10, top + 40, w - 20, h.h - 50); }
        break;
      case 'plant':
        c.fillStyle = '#8a5a3a'; c.beginPath(); c.moveTo(x + 10, y - 70); c.lineTo(x + w - 10, y - 70); c.lineTo(x + w - 22, y); c.lineTo(x + 22, y); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#2a6a2a';
        for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.33 + Math.sin(t * 0.02 + i) * 0.04; c.save(); c.translate(cx, y - 70); c.rotate(a); c.beginPath(); c.ellipse(70, 0, 72, 20, 0, 0, 6.283); c.fill(); c.restore(); }
        c.fillStyle = '#3a8a3a'; c.beginPath(); c.ellipse(cx, y - 110, w / 2, 60, 0, 0, 6.283); c.fill();
        break;
      case 'ballpit':
        c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(x, top, w, h.h);
        for (let i = 0; i < 70; i++) { c.fillStyle = ['#ff4d5a', '#4da3ff', '#ffd34d', '#7fd04a', '#c070ff'][i % 5]; c.beginPath(); c.arc(x + 10 + (i * 37) % (w - 20), y - 10 - Math.floor(i / 7) * ((h.h - 20) / 10), 11, 0, 6.283); c.fill(); }
        c.strokeStyle = '#ff9a2a'; c.lineWidth = 6; c.strokeRect(x, top, w, h.h);
        c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,0.35)'; for (let gx = x; gx < x + w; gx += 14) { c.beginPath(); c.moveTo(gx, top); c.lineTo(gx, y); c.stroke(); }
        break;
    }
    c.restore();
    if (mine) { c.font = '800 12px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.fillStyle = '#e8f0ff'; c.fillText('HIDDEN', cx, top - 12); }
  }
}

// A lit interior room on a big map: wallpaper, trim, wainscot and a name plate.
function bigRoom(c, x, y, w, h, wall, trim, label) {
  c.fillStyle = wall; c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(0,0,0,0.16)'; for (let sx = x + 20; sx < x + w; sx += 40) c.fillRect(sx, y, 12, h);
  c.fillStyle = trim; c.fillRect(x, y, w, 8); c.fillRect(x, y + h - 60, w, 4);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + h - 56, w, 56);
  if (label) { c.font = '700 16px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,240,210,0.55)'; c.fillText(label, x + w / 2, y + 32); }
}
// A thick floor slab under a platform that spans rooms.
function slab(c, p, top, side) {
  c.fillStyle = side; c.fillRect(p.x, p.y, p.w, 22);
  c.fillStyle = top; c.fillRect(p.x, p.y, p.w, 6);
  c.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = p.x + 20; x < p.x + p.w; x += 46) c.fillRect(x, p.y + 6, 2, 16);
}
function nightSky(c, WW, top, bottom, seed) {
  const R = seeded(seed), sky = c.createLinearGradient(0, -460, 0, FLOOR);
  sky.addColorStop(0, top); sky.addColorStop(1, bottom);
  c.fillStyle = sky; c.fillRect(-40, -460, WW + 80, FLOOR + 460);
  c.fillStyle = '#ffffff';
  for (let i = 0; i < 160; i++) { c.globalAlpha = 0.3 + R() * 0.6; c.fillRect(R() * WW, -460 + R() * 560, 1.5, 1.5); }
  c.globalAlpha = 1;
}

function roof(c, cx, y, w, h, color) {
  c.fillStyle = color;
  c.beginPath(); c.moveTo(cx - w / 2 - 20, y + h); c.quadraticCurveTo(cx, y + h * 0.5, cx + w / 2 + 20, y + h);
  c.lineTo(cx + w / 2 - 10, y + h * 0.3); c.quadraticCurveTo(cx, y - h * 0.2, cx - w / 2 + 10, y + h * 0.3); c.closePath(); c.fill();
}

const ARENAS = [
  {
    id: 'school', name: 'Jujutsu High', sub: 'Tokyo Campus · Dusk', platforms: [{ x: 160, y: 455, w: 260 }, { x: 860, y: 455, w: 260 }],
    draw(c) {
      const sky = c.createLinearGradient(0, 0, 0, FLOOR);
      sky.addColorStop(0, '#2b2050'); sky.addColorStop(0.55, '#c8667a'); sky.addColorStop(1, '#f6b47a');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,230,180,0.9)'; c.beginPath(); c.arc(930, 330, 56, 0, 6.283); c.fill();
      const r = seeded(7);
      for (const [col, base, amp] of [['#6a4a78', 420, 80], ['#4a3358', 470, 60]]) {
        c.fillStyle = col; c.beginPath(); c.moveTo(0, FLOOR);
        for (let x = 0; x <= W; x += 40) c.lineTo(x, base - Math.abs(Math.sin(x * 0.006 + base)) * amp - r() * 20);
        c.lineTo(W, FLOOR); c.fill();
      }
      // temple halls
      for (const [cx, w] of [[240, 300], [1060, 260]]) {
        c.fillStyle = '#2a1c2c'; c.fillRect(cx - w / 2, 460, w, 160);
        roof(c, cx, 400, w, 70, '#1c1220');
        c.fillStyle = 'rgba(255,190,120,0.55)';
        for (let i = 0; i < 4; i++) c.fillRect(cx - w / 2 + 24 + i * (w - 48) / 4, 500, (w - 48) / 4 - 14, 40);
      }
      // torii gate
      c.fillStyle = '#b8302c';
      c.fillRect(560, 400, 18, 220); c.fillRect(702, 400, 18, 220);
      c.fillRect(530, 380, 220, 18); c.fillRect(548, 420, 184, 12);
      c.fillStyle = '#1a0c0c'; c.fillRect(522, 372, 236, 10);
      // sakura trees
      for (const [x, y] of [[420, 470], [860, 480], [60, 500], [1220, 490]]) {
        c.fillStyle = '#3a2420'; c.fillRect(x - 6, y, 12, FLOOR - y);
        c.fillStyle = 'rgba(255,170,200,0.85)';
        for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(x + (r() - 0.5) * 90, y - 10 - r() * 50, 26 + r() * 16, 0, 6.283); c.fill(); }
      }
      drawGround(c, '#7a6460', '#3a2c30', '#9a8480');
      c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 2;
      for (let x = 0; x < W; x += 80) { c.beginPath(); c.moveTo(x, FLOOR); c.lineTo(x - 40, H); c.stroke(); }
      drawPlatforms(c, this.platforms, '#7a4a2e', '#4a2a1a');
    },
    fx(c, t) {
      if (!this.petals) this.petals = Array.from({ length: 24 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: U.rand(0.5, 1.4) }));
      c.fillStyle = 'rgba(255,190,215,0.85)';
      for (const p of this.petals) {
        p.y += 0.6 * p.s; p.x += Math.sin(t * 0.02 + p.y * 0.01) * 0.8 - 0.3;
        if (p.y > FLOOR) { p.y = -10; p.x = Math.random() * W; }
        c.beginPath(); c.ellipse(p.x, p.y, 4 * p.s, 2 * p.s, t * 0.05 + p.x, 0, 6.283); c.fill();
      }
    },
  },
  {
    id: 'shibuya', name: 'Shibuya Station', sub: 'October 31st · Night', platforms: [],
    draw(c) {
      const sky = c.createLinearGradient(0, 0, 0, FLOOR);
      sky.addColorStop(0, '#05060f'); sky.addColorStop(1, '#2a1a4a');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      // the veil
      c.fillStyle = 'rgba(10,0,20,0.55)'; c.beginPath(); c.ellipse(W / 2, FLOOR, 900, 700, 0, Math.PI, 0); c.fill();
      c.strokeStyle = 'rgba(160,80,255,0.35)'; c.lineWidth = 3; c.beginPath(); c.ellipse(W / 2, FLOOR, 900, 700, 0, Math.PI, 0); c.stroke();
      const r = seeded(31);
      for (let layer = 0; layer < 2; layer++) {
        let x = -20;
        while (x < W) {
          const w = 60 + r() * 90, h = (layer ? 160 : 260) + r() * (layer ? 120 : 200);
          c.fillStyle = layer ? '#141026' : '#0c0a1a'; c.fillRect(x, FLOOR - h, w, h);
          for (let wy = FLOOR - h + 12; wy < FLOOR - 20; wy += 16) for (let wx = x + 8; wx < x + w - 8; wx += 14)
            if (r() < 0.35) { c.fillStyle = r() < 0.15 ? 'rgba(255,120,200,0.8)' : 'rgba(255,220,150,0.7)'; c.fillRect(wx, wy, 7, 9); }
          x += w + 6;
        }
      }
      // big screens & station sign
      c.fillStyle = '#1a3a6a'; c.fillRect(140, 300, 200, 110); c.fillStyle = '#ff4d8a'; c.fillRect(150, 310, 180, 90);
      c.fillStyle = '#0a0a14'; c.fillRect(420, 470, 440, 60);
      c.fillStyle = '#2f9a4a'; c.fillRect(430, 480, 420, 40);
      c.fillStyle = '#fff'; c.font = '900 30px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('渋谷  SHIBUYA', 640, 501);
      drawGround(c, '#26242e', '#0e0d14', '#4a4858');
      c.fillStyle = 'rgba(255,255,255,0.55)';
      for (let x = 30; x < W; x += 70) c.fillRect(x, FLOOR + 30, 40, 70);
    },
    fx(c, t) {
      const on = Math.sin(t * 0.13) > -0.7;
      c.fillStyle = on ? 'rgba(255,77,138,0.25)' : 'rgba(0,0,0,0)';
      c.fillRect(140, 300, 200, 110);
    },
  },
  {
    id: 'womb', name: 'Detention Center', sub: 'Cursed Womb · Special Grade', platforms: [],
    draw(c) {
      const sky = c.createLinearGradient(0, 0, 0, FLOOR);
      sky.addColorStop(0, '#120408'); sky.addColorStop(1, '#5a1420');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      c.fillStyle = '#c02a30'; c.beginPath(); c.arc(300, 170, 64, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(200,40,50,0.25)'; c.beginPath(); c.arc(300, 170, 110, 0, 6.283); c.fill();
      const r = seeded(99);
      for (const [x, w, h] of [[0, 380, 300], [420, 440, 360], [900, 380, 280]]) {
        c.fillStyle = '#1e1216'; c.fillRect(x, FLOOR - h, w, h);
        c.fillStyle = '#0a0608';
        for (let wy = FLOOR - h + 30; wy < FLOOR - 40; wy += 60) for (let wx = x + 20; wx < x + w - 30; wx += 50) {
          c.fillRect(wx, wy, 26, 34);
          if (r() < 0.2) { c.fillStyle = 'rgba(255,60,60,0.5)'; c.fillRect(wx + 4, wy + 4, 18, 26); c.fillStyle = '#0a0608'; }
        }
        c.fillStyle = '#2a1a1e';
        for (let bx = x; bx < x + w; bx += 26) c.fillRect(bx, FLOOR - h - 12 + (r() * 8 | 0), 14, 12);
      }
      c.strokeStyle = '#2a1a1e'; c.lineWidth = 3;
      for (let x = 0; x < W; x += 24) { c.beginPath(); c.moveTo(x, FLOOR - 70); c.lineTo(x, FLOOR); c.stroke(); }
      c.beginPath(); c.moveTo(0, FLOOR - 66); c.lineTo(W, FLOOR - 66); c.stroke();
      drawGround(c, '#3a2a2c', '#140a0c', '#5a3a3e');
      c.fillStyle = 'rgba(120,10,20,0.5)';
      for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(100 + i * 210 + r() * 60, FLOOR + 30 + r() * 50, 50 + r() * 40, 8, 0, 0, 6.283); c.fill(); }
    },
    fx(c, t) {
      c.fillStyle = 'rgba(255,40,60,0.04)';
      c.fillRect(0, 0, W, FLOOR * (0.5 + 0.5 * Math.sin(t * 0.02)));
    },
  },
  {
    id: 'shinjuku', name: 'Shinjuku Ruins', sub: 'The Showdown', platforms: [{ x: 520, y: 470, w: 240 }],
    draw(c) {
      const sky = c.createLinearGradient(0, 0, 0, FLOOR);
      sky.addColorStop(0, '#5a6a70'); sky.addColorStop(1, '#b8b0a0');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      const r = seeded(5);
      for (let layer = 0; layer < 2; layer++) {
        let x = -10;
        while (x < W) {
          const w = 70 + r() * 110, h = (layer ? 180 : 300) + r() * 200;
          c.fillStyle = layer ? '#4a4c50' : '#6a6c6e';
          c.beginPath(); c.moveTo(x, FLOOR); c.lineTo(x, FLOOR - h);
          for (let k = 0; k < 4; k++) c.lineTo(x + (k + 1) * w / 4, FLOOR - h + (r() - 0.3) * 60);
          c.lineTo(x + w, FLOOR); c.fill();
          c.fillStyle = 'rgba(20,20,24,0.5)';
          for (let wy = FLOOR - h + 40; wy < FLOOR - 20; wy += 22) for (let wx = x + 8; wx < x + w - 10; wx += 16) if (r() < 0.5) c.fillRect(wx, wy, 8, 10);
          x += w + 20 + r() * 40;
        }
      }
      for (let i = 0; i < 5; i++) {
        const x = 100 + i * 260 + r() * 80;
        c.fillStyle = 'rgba(60,56,56,0.35)';
        for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(x + k * 12, 300 - k * 40, 30 + k * 10, 0, 6.283); c.fill(); }
      }
      drawGround(c, '#6a6058', '#2a2420', '#8a8078');
      c.fillStyle = '#4a423c';
      for (let i = 0; i < 24; i++) { const x = r() * W; c.beginPath(); c.moveTo(x, FLOOR + 2); c.lineTo(x + 10 + r() * 20, FLOOR - 6 - r() * 14); c.lineTo(x + 30 + r() * 20, FLOOR + 2); c.fill(); }
      drawPlatforms(c, this.platforms, '#8a8078', '#4a423c');
    },
    fx(c, t) {
      c.fillStyle = 'rgba(255,240,220,0.5)';
      for (let i = 0; i < 14; i++) {
        const x = (i * 97 + t * 0.4) % W, y = (i * 53 + t * 0.6) % FLOOR;
        c.fillRect(x, y, 2, 2);
      }
    },
  },
  {
    id: 'bamboo', name: 'Bamboo Monastery', sub: 'Misty Mountain Temple', platforms: [{ x: 140, y: 460, w: 230 }, { x: 910, y: 460, w: 230 }],
    draw(c) {
      const sky = c.createLinearGradient(0, 0, 0, FLOOR);
      sky.addColorStop(0, '#9fc4b0'); sky.addColorStop(0.6, '#d8e8d0'); sky.addColorStop(1, '#eef4e4');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      const r = seeded(21);
      // layered misty mountains
      for (const [col, base, amp] of [['#8aa898', 300, 110], ['#6f907e', 380, 80]]) {
        c.fillStyle = col; c.beginPath(); c.moveTo(0, FLOOR);
        for (let x = 0; x <= W; x += 30) c.lineTo(x, base - Math.abs(Math.sin(x * 0.005 + base)) * amp - r() * 18);
        c.lineTo(W, FLOOR); c.fill();
      }
      // temple on the slope
      c.fillStyle = '#5a3a2a'; c.fillRect(540, 360, 200, 120);
      roof(c, 640, 300, 200, 70, '#2a1a14'); roof(c, 640, 250, 140, 50, '#2a1a14');
      c.fillStyle = 'rgba(255,220,150,0.6)'; c.fillRect(600, 400, 80, 50);
      // bamboo stalks in front
      for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 22; i++) {
        const x = (i * 61 + layer * 31 + r() * 20) % (W + 30) - 15, w = layer ? 13 : 8;
        if (x > 500 && x < 780 && !layer) continue;
        c.fillStyle = layer ? '#4f8f3a' : '#7fae5a'; c.fillRect(x, layer ? 80 : 160, w, FLOOR);
        c.fillStyle = 'rgba(0,0,0,0.2)'; for (let y = 200 + (i * 13) % 70; y < FLOOR; y += 85) c.fillRect(x, y, w, 3);
        c.fillStyle = layer ? '#3f7a2a' : '#6f9e4a';
        for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(x + w / 2 + 14, (layer ? 90 : 170) + k * 24, 16, 4, -0.5, 0, 6.283); c.fill(); }
      }
      drawGround(c, '#8a7a5a', '#4a3a28', '#a89a78');
      c.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 20; x < W; x += 120) c.fillRect(x, FLOOR + 30, 70, 6);
      drawPlatforms(c, this.platforms, '#7a5a3a', '#4a3020');
    },
    fx(c, t) {
      c.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse((i * 380 + t * 0.4) % (W + 400) - 200, 420 + i * 30, 260, 26, 0, 0, 6.283); c.fill(); }
      c.fillStyle = 'rgba(120,170,80,0.8)';
      for (let i = 0; i < 10; i++) { const x = (i * 131 + t * 0.7) % W, y = (i * 71 + t * 0.9) % FLOOR; c.beginPath(); c.ellipse(x, y, 5, 2, t * 0.03 + i, 0, 6.283); c.fill(); }
    },
  },
  {
    id: 'casino', name: 'High Roller Casino', sub: 'Underground Gambling Den', platforms: [{ x: 500, y: 470, w: 280 }],
    draw(c) {
      c.fillStyle = '#0c0812'; c.fillRect(0, 0, W, H);
      const r = seeded(77);
      // ceiling lights
      for (let i = 0; i < 10; i++) { const g = c.createRadialGradient(64 + i * 128, 40, 4, 64 + i * 128, 40, 120); g.addColorStop(0, 'rgba(255,210,120,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(i * 128 - 60, 0, 250, 200); }
      // big roulette sign
      c.strokeStyle = '#c9a23a'; c.lineWidth = 8; c.beginPath(); c.arc(640, 210, 110, 0, 6.283); c.stroke();
      for (let i = 0; i < 16; i++) { c.fillStyle = i === 0 ? '#2f9a3a' : i % 2 ? '#a01828' : '#141414'; c.beginPath(); c.moveTo(640, 210); c.arc(640, 210, 100, i / 16 * 6.283, (i + 1) / 16 * 6.283); c.closePath(); c.fill(); }
      c.fillStyle = '#c9a23a'; c.beginPath(); c.arc(640, 210, 22, 0, 6.283); c.fill();
      c.font = '900 34px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffd34d'; c.fillText('★ JACKPOT ★', 640, 362);
      // rows of slot machines
      for (const side of [0, 1]) for (let i = 0; i < 4; i++) {
        const x = side ? W - 110 - i * 120 : 30 + i * 120, y = 410;
        c.fillStyle = '#3a2a4a'; c.fillRect(x, y, 90, 210); c.strokeStyle = '#c9a23a'; c.lineWidth = 3; c.strokeRect(x, y, 90, 210);
        c.fillStyle = '#f8f4ea'; c.fillRect(x + 10, y + 40, 70, 34);
        c.font = '900 20px sans-serif'; c.textAlign = 'center';
        ['7', '♣', '♦'].forEach((sym, k) => { c.fillStyle = sym === '♣' ? '#2f9a3a' : '#c4122f'; c.fillText(r() < 0.5 ? sym : '7', x + 22 + k * 23, y + 65); });
        c.fillStyle = r() < 0.5 ? '#ff4d8a' : '#4dc8ff'; c.fillRect(x + 10, y + 10, 70, 18);
      }
      drawGround(c, '#5a1420', '#24060c', '#c9a23a');
      c.fillStyle = 'rgba(201,162,58,0.25)'; for (let x = 0; x < W; x += 60) { c.beginPath(); c.moveTo(x, FLOOR + 10); c.lineTo(x + 30, FLOOR + 50); c.lineTo(x, FLOOR + 90); c.lineTo(x - 30, FLOOR + 50); c.closePath(); c.fill(); }
      drawPlatforms(c, this.platforms, '#2f6a2a', '#1a3a18');
    },
    fx(c, t) {
      for (let i = 0; i < 8; i++) {
        const side = i < 4, x = side ? 40 + i * 120 : W - 100 - (i - 4) * 120;
        c.fillStyle = Math.sin(t * 0.15 + i * 1.7) > 0 ? 'rgba(255,77,138,0.35)' : 'rgba(77,200,255,0.35)';
        c.fillRect(x, 420, 70, 18);
      }
    },
  },
  {
    id: 'court', name: 'Hall of Judgment', sub: 'Supreme Courthouse', platforms: [{ x: 150, y: 455, w: 220 }, { x: 910, y: 455, w: 220 }],
    draw(c) {
      const g = c.createLinearGradient(0, 0, 0, FLOOR);
      g.addColorStop(0, '#3a3428'); g.addColorStop(1, '#8a7e62');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // marble columns
      for (let i = 0; i < 7; i++) {
        const x = 70 + i * 190;
        c.fillStyle = '#d8d0bc'; c.fillRect(x, 90, 54, FLOOR - 90);
        c.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k < 4; k++) c.fillRect(x + 8 + k * 12, 100, 3, FLOOR - 110);
        c.fillStyle = '#c8bfa8'; c.fillRect(x - 10, 80, 74, 16); c.fillRect(x - 10, FLOOR - 20, 74, 20);
      }
      c.fillStyle = '#5a4e38'; c.fillRect(0, 50, W, 34);
      // judge's bench and the balance emblem above it
      c.fillStyle = '#4a2e1a'; c.fillRect(470, 420, 340, 200); c.fillStyle = '#5a3a22'; c.fillRect(460, 410, 360, 22);
      c.strokeStyle = '#c9a23a'; c.lineWidth = 6;
      c.beginPath(); c.moveTo(640, 150); c.lineTo(640, 330); c.moveTo(540, 190); c.lineTo(740, 190); c.stroke();
      c.lineWidth = 2;
      for (const sx of [540, 740]) { c.beginPath(); c.moveTo(sx, 190); c.lineTo(sx - 30, 260); c.moveTo(sx, 190); c.lineTo(sx + 30, 260); c.stroke(); c.beginPath(); c.ellipse(sx, 262, 34, 8, 0, 0, Math.PI); c.fillStyle = 'rgba(201,162,58,0.6)'; c.fill(); c.stroke(); }
      // checkered marble floor
      c.fillStyle = '#e8e0cc'; c.fillRect(0, FLOOR, W, H - FLOOR);
      c.fillStyle = '#3a342a'; for (let y = FLOOR; y < H; y += 25) for (let x = ((y - FLOOR) / 25) % 2 ? 0 : 50; x < W; x += 100) c.fillRect(x, y, 50, 25);
      c.fillStyle = '#c9a23a'; c.fillRect(0, FLOOR, W, 3);
      drawPlatforms(c, this.platforms, '#6a4a2e', '#3a2414');
    },
    fx(c, t) {
      c.fillStyle = 'rgba(255,240,200,0.06)';
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(200 + i * 400, 0); c.lineTo(300 + i * 400 + Math.sin(t * 0.01) * 20, FLOOR); c.lineTo(180 + i * 400, FLOOR); c.closePath(); c.fill(); }
    },
  },
  {
    id: 'festival', name: 'Night Festival', sub: 'Summer Lantern Street', platforms: [],
    draw(c) {
      const sky = c.createLinearGradient(0, 0, 0, FLOOR);
      sky.addColorStop(0, '#0a0a24'); sky.addColorStop(1, '#3a1a4a');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      const r = seeded(5);
      c.fillStyle = '#fff'; for (let i = 0; i < 60; i++) c.fillRect(r() * W, r() * 300, 1.5, 1.5);
      // festival stalls
      const stalls = ['#c4122f', '#2a6aaa', '#c4122f', '#2a8a4a', '#c4122f', '#aa6a2a'];
      stalls.forEach((col, i) => {
        const x = 20 + i * 215;
        c.fillStyle = '#2a1a14'; c.fillRect(x, 430, 190, 190);
        c.fillStyle = col; c.fillRect(x - 6, 400, 202, 38);
        c.fillStyle = '#f8f4ea'; for (let k = 0; k < 6; k++) c.fillRect(x - 6 + k * 34 + 8, 400, 16, 38);
        c.fillStyle = 'rgba(255,200,120,0.55)'; c.fillRect(x + 12, 470, 166, 60);
      });
      // strings of lanterns
      c.strokeStyle = '#2a1a14'; c.lineWidth = 2;
      for (const y0 of [150, 260]) {
        c.beginPath(); c.moveTo(0, y0); for (let x = 0; x <= W; x += 40) c.lineTo(x, y0 + Math.sin(x / W * Math.PI * 3) * 26); c.stroke();
        for (let x = 30; x < W; x += 70) {
          const y = y0 + Math.sin(x / W * Math.PI * 3) * 26 + 14;
          const lg = c.createRadialGradient(x, y, 2, x, y, 30); lg.addColorStop(0, 'rgba(255,200,120,0.6)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = lg; c.fillRect(x - 30, y - 30, 60, 60);
          c.fillStyle = (x / 70) % 2 < 1 ? '#ff6a3a' : '#ffb03a'; c.beginPath(); c.ellipse(x, y, 10, 13, 0, 0, 6.283); c.fill();
          c.fillStyle = '#2a1a14'; c.fillRect(x - 5, y - 15, 10, 3); c.fillRect(x - 5, y + 12, 10, 3);
        }
      }
      drawGround(c, '#4a3a3a', '#1a1214', '#6a5a5a');
      c.fillStyle = 'rgba(255,200,120,0.08)'; for (let x = 0; x < W; x += 140) c.fillRect(x, FLOOR + 6, 90, 4);
    },
    fx(c, t) {
      // occasional fireworks over the street
      const ph = t % 180;
      if (ph < 50) {
        const fx = 200 + ((Math.floor(t / 180) * 397) % 880), fy = 110, rr = ph * 2.2;
        c.strokeStyle = `rgba(${Math.floor(t / 180) % 2 ? '255,120,200' : '120,220,255'},${1 - ph / 50})`; c.lineWidth = 2;
        for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; c.beginPath(); c.moveTo(fx + Math.cos(a) * rr * 0.6, fy + Math.sin(a) * rr * 0.6); c.lineTo(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr); c.stroke(); }
      }
    },
  },
  {
    id: 'whitehouse', name: 'The Big White House', sub: 'South Lawn · Fourth of July', platforms: [{ x: 170, y: 440, w: 220 }, { x: 890, y: 440, w: 220 }],
    draw(c) {
      const sky = c.createLinearGradient(0, 0, 0, FLOOR);
      sky.addColorStop(0, '#0a1030'); sky.addColorStop(0.6, '#3a3a7a'); sky.addColorStop(1, '#c86a6a');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      const r = seeded(23);
      c.fillStyle = '#fff'; for (let i = 0; i < 50; i++) c.fillRect(r() * W, r() * 220, 1.4, 1.4);
      // the mansion: two long wings around a domed, columned portico
      const wall = '#f4f2ea', shade = '#d8d4c8';
      c.fillStyle = wall; c.fillRect(90, 300, 1100, 280);
      c.fillStyle = shade; c.fillRect(90, 300, 1100, 12); c.fillRect(90, 420, 1100, 8);
      // rooftop balustrade
      c.fillStyle = wall; c.fillRect(80, 284, 1120, 16);
      c.fillStyle = shade; for (let x = 92; x < 1190; x += 16) c.fillRect(x, 270, 8, 16);
      c.fillStyle = wall; c.fillRect(80, 264, 1120, 8);
      // rows of tall windows, warmly lit
      for (const y of [330, 450]) for (let x = 120; x < 1170; x += 70) {
        if (x > 440 && x < 830) continue;
        c.fillStyle = '#5a4a3a'; c.fillRect(x - 2, y - 2, 34, 58);
        c.fillStyle = r() < 0.75 ? '#ffd890' : '#4a5a7a'; c.fillRect(x, y, 30, 54);
        c.strokeStyle = '#5a4a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 15, y); c.lineTo(x + 15, y + 54); c.moveTo(x, y + 27); c.lineTo(x + 30, y + 27); c.stroke();
        c.fillStyle = shade; c.beginPath(); c.moveTo(x - 6, y - 4); c.lineTo(x + 15, y - 16); c.lineTo(x + 36, y - 4); c.closePath(); c.fill();
      }
      // the bowed portico: a curved roof, six great columns and a curved balcony between them
      c.fillStyle = '#e8e4d8'; c.beginPath(); c.ellipse(640, 300, 200, 40, 0, Math.PI, 0); c.fill();
      c.fillStyle = wall; c.fillRect(440, 290, 400, 20);
      c.fillStyle = '#c8c4b8'; c.fillRect(440, 310, 400, 270);
      for (let i = 0; i < 4; i++) { c.fillStyle = '#ffd890'; c.fillRect(480 + i * 90, 340, 40, 70); c.fillRect(480 + i * 90, 460, 40, 90); }
      for (let i = 0; i < 6; i++) {
        const x = 452 + i * 72;
        c.fillStyle = '#ffffff'; c.fillRect(x, 300, 30, 280);
        c.fillStyle = 'rgba(0,0,0,0.08)'; for (let k = 0; k < 3; k++) c.fillRect(x + 6 + k * 8, 310, 2, 260);
        c.fillStyle = wall; c.fillRect(x - 5, 296, 40, 10); c.fillRect(x - 5, 570, 40, 10);
      }
      c.fillStyle = wall; c.fillRect(440, 418, 400, 12);
      c.fillStyle = shade; for (let x = 446; x < 836; x += 14) c.fillRect(x, 400, 6, 18);
      c.fillStyle = wall; c.fillRect(440, 396, 400, 6);
      // the flagpole (the flag itself waves in fx)
      c.fillStyle = '#c8c8d0'; c.fillRect(638, 150, 4, 115); c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(640, 148, 5, 0, 6.283); c.fill();
      // hedges, flowerbeds and the lawn
      c.fillStyle = '#1e4a24';
      for (let x = 60; x < W; x += 50) { if (x > 420 && x < 860) continue; c.beginPath(); c.arc(x, 585, 30, Math.PI, 0); c.fill(); }
      c.fillStyle = '#c4122f'; for (let x = 70; x < W; x += 24) { if (x > 420 && x < 860) continue; c.beginPath(); c.arc(x, 592, 4, 0, 6.283); c.fill(); }
      drawGround(c, '#3a8a3a', '#1a4a1a', '#5aaa4a');
      c.fillStyle = 'rgba(255,255,255,0.06)'; for (let x = 0; x < W; x += 80) c.fillRect(x, FLOOR, 40, H - FLOOR);
      // the fountain basin (the spray is in fx)
      c.fillStyle = '#e8e4d8'; c.beginPath(); c.ellipse(640, 600, 120, 18, 0, 0, 6.283); c.fill();
      c.fillStyle = '#5a9ad8'; c.beginPath(); c.ellipse(640, 598, 108, 12, 0, 0, 6.283); c.fill();
      // the platforms are balconies with white balustrades
      for (const p of this.platforms) {
        c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(p.x + 6, p.y + 12, p.w - 12, 10);
        c.fillStyle = wall; c.fillRect(p.x, p.y, p.w, 12);
        c.fillStyle = shade; for (let x = p.x + 6; x < p.x + p.w - 4; x += 14) c.fillRect(x, p.y + 12, 6, 22);
        c.fillStyle = wall; c.fillRect(p.x, p.y + 34, p.w, 8);
        c.fillStyle = '#ffffff'; c.fillRect(p.x + 20, p.y + 42, 16, FLOOR - p.y - 42); c.fillRect(p.x + p.w - 36, p.y + 42, 16, FLOOR - p.y - 42);
        c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(p.x, p.y, p.w, 2);
      }
    },
    fx(c, t) {
      // the flag on the roof, rippling
      const fx0 = 642, fy0 = 152, fw = 84, fh = 48;
      for (let i = 0; i < 13; i++) {
        c.fillStyle = i % 2 ? '#ffffff' : '#c4122f';
        c.beginPath();
        for (let x = 0; x <= fw; x += 6) c.lineTo(fx0 + x, fy0 + i * fh / 13 + Math.sin(t * 0.12 - x * 0.08) * x * 0.06);
        for (let x = fw; x >= 0; x -= 6) c.lineTo(fx0 + x, fy0 + (i + 1) * fh / 13 + Math.sin(t * 0.12 - x * 0.08) * x * 0.06 + 0.5);
        c.fill();
      }
      c.fillStyle = '#1e3a8a'; c.beginPath();
      for (let x = 0; x <= 36; x += 6) c.lineTo(fx0 + x, fy0 + Math.sin(t * 0.12 - x * 0.08) * x * 0.06);
      for (let x = 36; x >= 0; x -= 6) c.lineTo(fx0 + x, fy0 + 26 + Math.sin(t * 0.12 - x * 0.08) * x * 0.06);
      c.fill();
      // fountain spray
      c.fillStyle = 'rgba(200,230,255,0.75)';
      for (let i = 0; i < 24; i++) {
        const k = ((t * 0.02 + i / 24) % 1), dir = i % 2 ? 1 : -1, sp = 0.5 + (i % 5) * 0.25;
        c.beginPath(); c.arc(640 + dir * k * 70 * sp, 596 - Math.sin(k * Math.PI) * 70, 2.2, 0, 6.283); c.fill();
      }
      // red, white and blue fireworks
      for (const [period, off, x0] of [[150, 0, 260], [190, 70, 1000], [230, 140, 620]]) {
        const ph = (t + off) % period;
        if (ph >= 55) continue;
        const n = Math.floor((t + off) / period), fx = x0 + ((n * 173) % 200) - 100, fy = 90 + ((n * 59) % 70), rr = ph * 1.9;
        const col = ['255,80,90', '255,255,255', '90,140,255'][n % 3];
        c.fillStyle = `rgba(${col},${1 - ph / 55})`;
        for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; c.beginPath(); c.arc(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr + ph * ph * 0.01, 2.4, 0, 6.283); c.fill(); }
      }
    },
  },
  {
    id: 'cosmodrome', name: 'Red Star Cosmodrome', sub: 'Launch Pad 1 · Steppe Night', platforms: [{ x: 120, y: 440, w: 230 }, { x: 930, y: 440, w: 230 }],
    draw(c) {
      const sky = c.createLinearGradient(0, 0, 0, FLOOR);
      sky.addColorStop(0, '#020410'); sky.addColorStop(0.7, '#14203a'); sky.addColorStop(1, '#3a3050');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      const r = seeded(61);
      for (let i = 0; i < 140; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; c.fillRect(r() * W, r() * 420, 1.5, 1.5); }
      // aurora ribbons
      for (const [y, col] of [[120, 'rgba(90,255,170,0.12)'], [160, 'rgba(120,200,255,0.1)']]) {
        c.fillStyle = col; c.beginPath(); c.moveTo(0, y);
        for (let x = 0; x <= W; x += 40) c.lineTo(x, y + Math.sin(x * 0.008 + y) * 40);
        for (let x = W; x >= 0; x -= 40) c.lineTo(x, y + 60 + Math.sin(x * 0.01 + y) * 30);
        c.fill();
      }
      c.fillStyle = '#e8e4d8'; c.beginPath(); c.arc(200, 110, 30, 0, 6.283); c.fill();
      c.fillStyle = '#020410'; c.beginPath(); c.arc(214, 102, 28, 0, 6.283); c.fill();
      // snowy steppe on the horizon, with far-off hangars
      c.fillStyle = '#c8ccd8'; c.beginPath(); c.moveTo(0, 520); for (let x = 0; x <= W; x += 60) c.lineTo(x, 510 + Math.sin(x * 0.01) * 8); c.lineTo(W, FLOOR); c.lineTo(0, FLOOR); c.fill();
      c.fillStyle = '#4a4a5a'; for (const [x, w] of [[380, 120], [880, 90]]) { c.beginPath(); c.moveTo(x, 520); c.arc(x + w / 2, 520, w / 2, Math.PI, 0); c.fill(); }
      // the launch gantry beside the rocket
      c.strokeStyle = '#c4122f'; c.lineWidth = 4;
      c.strokeRect(745, 120, 60, 440);
      c.lineWidth = 2;
      for (let y = 120; y < 560; y += 40) { c.beginPath(); c.moveTo(745, y); c.lineTo(805, y + 40); c.moveTo(805, y); c.lineTo(745, y + 40); c.moveTo(745, y); c.lineTo(805, y); c.stroke(); }
      for (const y of [200, 320, 440]) { c.fillStyle = '#8a8a9a'; c.fillRect(690, y, 60, 6); }
      c.fillStyle = '#ff3a3a'; c.beginPath(); c.arc(775, 114, 5, 0, 6.283); c.fill();
      // the concrete pad, the flame trench and hazard stripes
      c.fillStyle = '#5a5a66'; c.fillRect(520, 560, 240, 60);
      c.fillStyle = '#1a1a22'; c.fillRect(580, 575, 120, 45);
      // a propaganda billboard of a rocket and a red star
      c.fillStyle = '#c4122f'; c.fillRect(960, 230, 200, 140); c.strokeStyle = '#ffd34d'; c.lineWidth = 4; c.strokeRect(960, 230, 200, 140);
      drawStar(c, 1010, 300, 34, '#ffd34d');
      c.fillStyle = '#f4f0e6'; c.beginPath(); c.moveTo(1100, 250); c.lineTo(1115, 290); c.lineTo(1115, 345); c.lineTo(1085, 345); c.lineTo(1085, 290); c.closePath(); c.fill();
      c.fillStyle = '#ffd34d'; c.beginPath(); c.moveTo(1088, 345); c.lineTo(1100, 365); c.lineTo(1112, 345); c.closePath(); c.fill();
      c.fillStyle = '#4a4a5a'; c.fillRect(985, 370, 10, 140); c.fillRect(1125, 370, 10, 140);
      drawGround(c, '#6a6a76', '#2a2a34', '#e8ecf4');
      c.fillStyle = '#ffd34d'; for (let x = 0; x < W; x += 60) { c.beginPath(); c.moveTo(x, FLOOR + 3); c.lineTo(x + 24, FLOOR + 3); c.lineTo(x + 12, FLOOR + 14); c.lineTo(x - 12, FLOOR + 14); c.closePath(); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 30; i++) { c.beginPath(); c.ellipse(r() * W, FLOOR + 24 + r() * 80, 24 + r() * 30, 3, 0, 0, 6.283); c.fill(); }
      // service walkways of red steel lattice
      for (const p of this.platforms) {
        c.strokeStyle = '#8a1a1a'; c.lineWidth = 3;
        for (const lx of [p.x + 16, p.x + p.w - 16]) { c.beginPath(); c.moveTo(lx, p.y); c.lineTo(lx, FLOOR); c.stroke(); }
        for (let y = p.y + 12; y < FLOOR; y += 34) { c.beginPath(); c.moveTo(p.x + 16, y); c.lineTo(p.x + p.w - 16, y + 34); c.moveTo(p.x + p.w - 16, y); c.lineTo(p.x + 16, y + 34); c.stroke(); }
        c.fillStyle = '#c4122f'; c.fillRect(p.x, p.y, p.w, 12);
        c.fillStyle = '#ffd34d'; for (let x = p.x; x < p.x + p.w; x += 24) c.fillRect(x, p.y + 4, 12, 4);
        c.strokeStyle = '#b8b8c4'; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x, p.y - 22); c.lineTo(p.x + p.w, p.y - 22); c.stroke();
        for (let x = p.x + 4; x <= p.x + p.w; x += 30) { c.beginPath(); c.moveTo(x, p.y); c.lineTo(x, p.y - 22); c.stroke(); }
      }
    },
    fx(c, t) {
      // the rocket stands venting steam, then launches; a fresh one rolls out a little later
      const ph = t % 1500, x = 640;
      let lift = 0;
      if (ph >= 1050) lift = (ph - 1050) ** 2 * 0.012;
      const visible = ph < 1450 && lift < 900;
      const base = 560 - lift;
      if (ph >= 1050 && ph < 1450) {
        // smoke billowing from the pad
        const k = Math.min(1, (ph - 1050) / 40) * Math.max(0, 1 - (ph - 1250) / 200);
        for (let i = 0; i < 14; i++) {
          const a = (i * 2.4 + ph * 0.01) % 6.283, d = 60 + ((i * 37 + ph) % 140);
          c.fillStyle = `rgba(220,220,230,${0.35 * k})`; c.beginPath(); c.arc(x + Math.cos(a) * d * 1.8, 590 - Math.abs(Math.sin(a)) * d * 0.5, 40 + (i % 4) * 12, 0, 6.283); c.fill();
        }
      }
      if (!visible) return;
      if (ph >= 1000) {
        // ignition flame
        const fl = ph >= 1050 ? 1 : (ph - 1000) / 50;
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const [w, h, col] of [[30, 160, 'rgba(255,120,40,0.7)'], [18, 110, 'rgba(255,220,120,0.9)'], [8, 60, 'rgba(255,255,255,0.95)']]) {
          c.fillStyle = col; c.beginPath(); c.moveTo(x - w, base); c.quadraticCurveTo(x, base + h * fl * (1 + Math.sin(t * 0.8) * 0.1), x + w, base); c.closePath(); c.fill();
        }
        c.restore();
      }
      // side boosters
      for (const s of [-1, 1]) {
        c.fillStyle = '#d8d4c8'; c.beginPath(); c.moveTo(x + s * 22, base - 60); c.lineTo(x + s * 40, base - 200); c.lineTo(x + s * 50, base - 60); c.lineTo(x + s * 48, base); c.lineTo(x + s * 24, base); c.closePath(); c.fill();
        c.fillStyle = '#c4122f'; c.fillRect(Math.min(x + s * 24, x + s * 48), base - 14, 24, 14);
      }
      // the core stage and nose cone
      c.fillStyle = '#f4f0e6'; c.fillRect(x - 26, base - 400, 52, 400);
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x + 8, base - 400, 18, 400);
      c.fillStyle = '#c4122f'; c.fillRect(x - 26, base - 300, 52, 14); c.fillRect(x - 26, base - 120, 52, 14);
      drawStar(c, x, base - 220, 16, '#c4122f');
      c.fillStyle = '#f4f0e6'; c.beginPath(); c.moveTo(x - 26, base - 400); c.quadraticCurveTo(x - 24, base - 470, x, base - 500); c.quadraticCurveTo(x + 24, base - 470, x + 26, base - 400); c.closePath(); c.fill();
      c.fillStyle = '#c4122f'; c.beginPath(); c.moveTo(x - 12, base - 478); c.quadraticCurveTo(x, base - 492, x, base - 500); c.quadraticCurveTo(x, base - 492, x + 12, base - 478); c.closePath(); c.fill();
      if (ph < 400) {
        // fresh rocket: fade in as it is rolled out
        c.fillStyle = `rgba(20,32,58,${Math.max(0, 1 - ph / 60)})`; c.fillRect(x - 60, base - 510, 120, 520);
      } else if (ph < 1050) {
        // venting steam
        c.fillStyle = 'rgba(240,240,250,0.35)';
        for (let i = 0; i < 4; i++) { const k = ((t * 0.01 + i / 4) % 1); c.beginPath(); c.arc(x + 30 + k * 60, base - 260 - k * 30, 6 + k * 18, 0, 6.283); c.fill(); }
      }
    },
  },
  {
    id: 'train', name: 'Desert Express', sub: 'Train Robbery · High Noon', platforms: [{ x: 170, y: 460, w: 210 }, { x: 900, y: 460, w: 210 }],
    draw(c) {
      const sky = c.createLinearGradient(0, 0, 0, FLOOR);
      sky.addColorStop(0, '#2a7ac8'); sky.addColorStop(0.6, '#8ac0e0'); sky.addColorStop(1, '#f4d8a0');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      const sg = c.createRadialGradient(1040, 90, 20, 1040, 90, 200);
      sg.addColorStop(0, 'rgba(255,255,230,1)'); sg.addColorStop(0.25, 'rgba(255,250,200,0.8)'); sg.addColorStop(1, 'rgba(255,240,180,0)');
      c.fillStyle = sg; c.fillRect(800, 0, 480, 320);
      // far mesas (too far away to seem to move)
      c.fillStyle = '#c87a50';
      c.beginPath(); c.moveTo(0, 520); c.lineTo(80, 430); c.lineTo(300, 422); c.lineTo(350, 520);
      c.lineTo(620, 520); c.lineTo(680, 400); c.lineTo(820, 396); c.lineTo(880, 520); c.lineTo(1100, 520); c.lineTo(1160, 450); c.lineTo(1280, 446); c.lineTo(1280, 560); c.lineTo(0, 560); c.fill();
      c.fillStyle = 'rgba(120,50,30,0.25)'; c.fillRect(0, 470, W, 6);
      c.fillStyle = '#e0b878'; c.fillRect(0, 520, W, FLOOR - 520);
      // the boxcar roof we fight on, and the car's side below it
      c.fillStyle = '#8a2a1a'; c.fillRect(0, FLOOR, W, 76);
      c.fillStyle = '#6a1e12'; for (let x = 0; x < W; x += 40) c.fillRect(x, FLOOR + 6, 3, 70);
      c.fillStyle = '#5a1a10'; c.fillRect(0, FLOOR, W, 8);
      c.fillStyle = '#3a2a20'; c.fillRect(0, FLOOR - 4, W, 6);
      c.font = '900 30px "Georgia", serif'; c.textAlign = 'center'; c.fillStyle = '#ffd34d';
      c.fillText('DESERT EXPRESS', 320, FLOOR + 48); c.fillText('★ GOLD & MAIL ★', 960, FLOOR + 48);
      // the coupling gap between two cars
      c.fillStyle = '#1a120c'; c.fillRect(632, FLOOR, 16, 80);
      c.fillStyle = '#3a3a40'; c.fillRect(620, FLOOR + 50, 40, 10);
      c.fillStyle = '#101014'; c.fillRect(0, FLOOR + 76, W, H - FLOOR - 76);
      // lookout perches on the roof
      for (const p of this.platforms) {
        c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(p.x + 8, p.y + 12, p.w - 16, 8);
        c.fillStyle = '#5a3418';
        for (const lx of [p.x + 18, p.x + p.w - 30]) c.fillRect(lx, p.y, 12, FLOOR - p.y);
        c.strokeStyle = '#5a3418'; c.lineWidth = 4; c.beginPath(); c.moveTo(p.x + 24, p.y + 20); c.lineTo(p.x + p.w - 24, FLOOR - 10); c.moveTo(p.x + p.w - 24, p.y + 20); c.lineTo(p.x + 24, FLOOR - 10); c.stroke();
        c.fillStyle = '#8a5a2a'; c.fillRect(p.x, p.y, p.w, 12);
        c.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = p.x + 20; x < p.x + p.w; x += 30) c.fillRect(x, p.y, 2, 12);
        // a strongbox on the left perch, mail sacks on the right
        if (p.x < 640) { c.fillStyle = '#3a3a40'; c.fillRect(p.x + 70, p.y - 30, 50, 30); c.fillStyle = '#ffd34d'; c.fillRect(p.x + 70, p.y - 20, 50, 5); c.fillRect(p.x + 91, p.y - 16, 8, 8); }
        else { c.fillStyle = '#c8b088'; for (const sx of [p.x + 60, p.x + 100]) { c.beginPath(); c.ellipse(sx, p.y - 16, 20, 16, 0, 0, 6.283); c.fill(); } }
      }
    },
    fx(c, t) {
      // scenery whips past (the train runs to the right, so the world slides left)
      const scroll = (sp, gap, off) => ((t * sp + off) % gap);
      // cacti
      for (let i = 0; i < 4; i++) {
        const x = W + 100 - ((t * 7 + i * 420) % (W + 300)), h = 70 + (i * 37) % 60;
        drawSaguaro(c, x, 600, h, '#4a6a2a');
      }
      // telegraph poles and the sagging wire between them
      c.strokeStyle = '#4a3020'; c.lineWidth = 6;
      const px0 = W - scroll(12, 360, 0);
      c.lineWidth = 1.5; c.strokeStyle = '#2a1a10'; c.beginPath();
      for (let x = px0 - 1080; x < W + 360; x += 360) { c.moveTo(x, 360); c.quadraticCurveTo(x + 180, 400, x + 360, 360); }
      c.stroke();
      for (let x = px0 - 1080; x < W + 360; x += 360) {
        c.fillStyle = '#4a3020'; c.fillRect(x - 4, 350, 8, 260); c.fillRect(x - 24, 360, 48, 6);
      }
      // speed streaks of dust low on the ground
      c.fillStyle = 'rgba(255,240,210,0.35)';
      for (let i = 0; i < 10; i++) { const x = W - ((t * 22 + i * 157) % (W + 200)), y = 560 + (i * 13) % 50; c.fillRect(x, y, 70, 2); }
      // engine smoke drifting back over the car
      for (let i = 0; i < 10; i++) {
        const k = ((t * 0.006 + i / 10) % 1), px = W + 60 - k * (W + 260), py = 60 + k * 110 + Math.sin(i * 3 + t * 0.02) * 12, pr = 26 + k * 46;
        c.fillStyle = `rgba(235,230,222,${0.32 * (1 - k)})`;
        for (const [ox, oy, s] of [[0, 0, 1], [-pr * 0.6, pr * 0.2, 0.7], [pr * 0.55, pr * 0.25, 0.65]]) { c.beginPath(); c.arc(px + ox, py + oy, pr * s, 0, 6.283); c.fill(); }
      }
      // spinning wheels under the car
      for (const wx of [90, 250, 1030, 1190]) {
        c.save(); c.translate(wx, FLOOR + 92); c.rotate(t * 0.4);
        c.fillStyle = '#2a2a30'; c.beginPath(); c.arc(0, 0, 26, 0, 6.283); c.fill();
        c.strokeStyle = '#8a8a96'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(-Math.cos(a) * 22, -Math.sin(a) * 22); c.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); c.stroke(); }
        c.restore();
      }
    },
  },
  {
    id: 'manor', name: 'Midnight Manor', sub: 'Grand Estate · Hide and Seek', width: 3200, thumbX: 480,
    spawns: [860, 2340],
    // the upper floor runs over the library/bedroom and kitchen/attic wings; stairs climb out of the foyer
    platforms: [
      { x: 1000, y: 540, w: 110 }, { x: 1090, y: 460, w: 110 }, { x: 1180, y: 380, w: 1580 },
      { x: 770, y: 300, w: 150 }, { x: 2880, y: 290, w: 150 }, { x: 2960, y: 520, w: 210 },
    ],
    // hiding spots: stand still inside one and you vanish behind it (attacking gives you away)
    hides: [
      { x: 190, y: FLOOR, w: 170, h: 150, kind: 'bush' },
      { x: 570, y: FLOOR, w: 100, h: 230, kind: 'clock' },
      { x: 1560, y: FLOOR, w: 130, h: 230, kind: 'bookcase' },
      { x: 1830, y: 380, w: 110, h: 215, kind: 'wardrobe' },
      { x: 2390, y: FLOOR, w: 120, h: 230, kind: 'pantry' },
      { x: 2190, y: 380, w: 150, h: 160, kind: 'crates' },
      { x: 3060, y: 520, w: 110, h: 300, kind: 'curtain' },
    ],
    draw(c) {
      const WW = this.width, R = seeded(77);
      // night sky over the whole estate
      const sky = c.createLinearGradient(0, -460, 0, FLOOR);
      sky.addColorStop(0, '#04040e'); sky.addColorStop(0.6, '#141a36'); sky.addColorStop(1, '#2a2a4a');
      c.fillStyle = sky; c.fillRect(-40, -460, WW + 80, FLOOR + 460);
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 160; i++) { c.globalAlpha = 0.3 + R() * 0.6; c.fillRect(R() * WW, -460 + R() * 560, 1.5, 1.5); }
      c.globalAlpha = 1;
      const mg = c.createRadialGradient(260, -120, 10, 260, -120, 160);
      mg.addColorStop(0, 'rgba(255,250,220,1)'); mg.addColorStop(0.3, 'rgba(240,240,210,0.5)'); mg.addColorStop(1, 'rgba(200,200,255,0)');
      c.fillStyle = mg; c.fillRect(100, -280, 320, 320);
      c.fillStyle = '#f4f0dc'; c.beginPath(); c.arc(260, -120, 46, 0, 6.283); c.fill();
      // garden: lawn, iron fence, a dead tree
      c.fillStyle = '#10180f'; c.fillRect(-40, 470, 600, 160);
      c.strokeStyle = '#0a0a10'; c.lineWidth = 4;
      for (let x = -20; x < 520; x += 26) { c.beginPath(); c.moveTo(x, FLOOR); c.lineTo(x, 520); c.stroke(); c.beginPath(); c.moveTo(x - 5, 524); c.lineTo(x, 512); c.lineTo(x + 5, 524); c.fill(); }
      c.fillRect(-20, 540, 540, 4); c.fillRect(-20, 600, 540, 4);
      c.fillStyle = '#0c0c14';
      c.fillRect(420, 380, 18, 240);
      c.lineWidth = 6; c.beginPath(); c.moveTo(429, 420); c.lineTo(380, 340); c.moveTo(429, 400); c.lineTo(480, 320); c.moveTo(400, 370); c.lineTo(360, 360); c.moveTo(462, 345); c.lineTo(500, 350); c.stroke();
      // the house: one long silhouette with a steep roof and chimneys
      const X0 = 520;
      c.fillStyle = '#12101a';
      c.beginPath(); c.moveTo(X0 - 30, 120); c.lineTo(X0 + 300, -240); c.lineTo(WW - 300, -240); c.lineTo(WW + 30, 120); c.closePath(); c.fill();
      for (const cx of [1100, 2000, 2700]) { c.fillRect(cx, -330, 60, 120); c.fillStyle = '#1e1a26'; c.fillRect(cx - 6, -340, 72, 14); c.fillStyle = '#12101a'; }
      c.fillStyle = '#1a1622';
      for (let i = 0; i < 5; i++) { const wx = 900 + i * 460; c.fillRect(wx, -140, 70, 90); c.fillStyle = '#e8b85a'; c.globalAlpha = 0.35 + 0.4 * (i % 2); c.fillRect(wx + 8, -132, 54, 74); c.globalAlpha = 1; c.fillStyle = '#1a1622'; }
      // the interior rooms
      const room = (x, y, w, h, wall, trim, floor) => {
        c.fillStyle = wall; c.fillRect(x, y, w, h);
        c.fillStyle = 'rgba(0,0,0,0.18)'; for (let sx = x + 20; sx < x + w; sx += 40) c.fillRect(sx, y, 12, h);   // wallpaper stripes
        c.fillStyle = trim; c.fillRect(x, y + h - 60, w, 4); c.fillRect(x, y, w, 8);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + h - 56, w, 56);   // wainscot
        if (floor) { c.fillStyle = floor; c.fillRect(x, y + h, w, 10); }
      };
      room(X0, 120, 800, 500, '#4a1820', '#c8a050');            // grand foyer (double height)
      room(1320, 400, 720, 220, '#1c3324', '#b09050');          // library
      room(2040, 400, 720, 220, '#5a5040', '#c8c0a8');          // kitchen
      room(1320, 130, 720, 250, '#2e2240', '#c0a0d0');          // master bedroom
      room(2040, 130, 720, 250, '#3a2a1a', '#7a5a3a');          // attic storage
      room(2760, 120, 440, 500, '#18223e', '#d8b860');          // ballroom (double height)
      // outer walls and the room dividers, each with a doorway
      c.fillStyle = '#2a2230';
      c.fillRect(X0 - 14, 110, 28, 290); c.fillRect(WW - 30, 110, 30, 520);
      for (const wx of [1320, 2040, 2760]) {
        c.fillRect(wx - 12, 120, 24, 30);       // top of the upper-floor doorway
        c.fillRect(wx - 12, 400, 24, 20);       // top of the ground-floor doorway
      }
      c.strokeStyle = '#c8a050'; c.lineWidth = 3;
      for (const wx of [X0, 1320, 2040, 2760]) { c.beginPath(); c.moveTo(wx - 12, FLOOR); c.lineTo(wx - 12, 420); c.lineTo(wx + 12, 420); c.lineTo(wx + 12, FLOOR); c.stroke(); }
      for (const wx of [1320, 2040, 2760]) { c.beginPath(); c.moveTo(wx - 12, 380); c.lineTo(wx - 12, 150); c.lineTo(wx + 12, 150); c.lineTo(wx + 12, 380); c.stroke(); }
      // room signs
      c.font = '700 16px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,230,180,0.55)';
      for (const [t, x, y] of [['GRAND FOYER', 920, 150], ['LIBRARY', 1680, 430], ['KITCHEN', 2400, 430], ['MASTER BEDROOM', 1680, 160], ['ATTIC', 2400, 160], ['BALLROOM', 2980, 150], ['GARDEN', 260, 500]]) c.fillText(t, x, y);
      // foyer: portraits, a rug and a staircase up to the landing
      for (const px of [700, 860]) { c.fillStyle = '#c8a050'; c.fillRect(px, 200, 90, 120); c.fillStyle = '#2a1a14'; c.fillRect(px + 8, 208, 74, 104); c.fillStyle = '#d8b090'; c.beginPath(); c.arc(px + 45, 250, 18, 0, 6.283); c.fill(); c.fillStyle = '#1a1010'; c.fillRect(px + 25, 270, 40, 42); }
      c.fillStyle = '#7a1a22'; c.fillRect(640, FLOOR - 4, 360, 6);
      c.fillStyle = '#3a2418';
      c.beginPath(); c.moveTo(980, FLOOR); c.lineTo(1000, 540); c.lineTo(1090, 540); c.lineTo(1090, 460); c.lineTo(1180, 460); c.lineTo(1180, 380); c.lineTo(1320, 380); c.lineTo(1320, FLOOR); c.closePath(); c.fill();
      c.strokeStyle = '#c8a050'; c.lineWidth = 3; c.beginPath(); c.moveTo(990, 480); c.lineTo(1090, 400); c.lineTo(1180, 320); c.stroke();
      for (let i = 0; i < 6; i++) { const bx = 1000 + i * 34; c.beginPath(); c.moveTo(bx, 540 - i * 30); c.lineTo(bx, 480 - i * 30 - 10); c.stroke(); }
      // library: tall bookshelves
      for (const bx of [1360, 1440, 1760, 1860, 1950]) {
        c.fillStyle = '#3a2414'; c.fillRect(bx, 440, 70, 180);
        for (let r = 0; r < 4; r++) for (let b = 0; b < 7; b++) { c.fillStyle = ['#7a2a2a', '#2a4a7a', '#3a6a3a', '#8a6a2a', '#5a3a6a'][Math.floor(R() * 5)]; c.fillRect(bx + 5 + b * 9, 448 + r * 44, 7, 36 - R() * 8); }
      }
      // bedroom: a four-poster bed and a mirror
      c.fillStyle = '#4a2a1a'; c.fillRect(1420, 290, 12, 90); c.fillRect(1640, 290, 12, 90); c.fillRect(1420, 285, 232, 10);
      c.fillStyle = '#8a2a4a'; c.fillRect(1430, 340, 220, 30); c.fillStyle = '#e8e0f0'; c.fillRect(1440, 330, 50, 14);
      c.fillStyle = '#c0a0d0'; c.fillRect(1990, 230, 30, 60); c.fillStyle = '#6a7a9a'; c.fillRect(1994, 234, 22, 52);
      // kitchen: stove, hanging pots, a big table
      c.fillStyle = '#2a2a30'; c.fillRect(2100, 520, 120, 100); c.fillStyle = '#ff6a2a'; c.globalAlpha = 0.5; c.fillRect(2112, 560, 96, 20); c.globalAlpha = 1;
      c.fillStyle = '#5a3a20'; c.fillRect(2560, 560, 170, 12); c.fillRect(2570, 572, 10, 48); c.fillRect(2710, 572, 10, 48);
      c.strokeStyle = '#8a8a96'; c.lineWidth = 2; for (const kx of [2260, 2300, 2340]) { c.beginPath(); c.moveTo(kx, 420); c.lineTo(kx, 450); c.stroke(); c.fillStyle = '#6a6a76'; c.beginPath(); c.arc(kx, 460, 12, 0, 3.14); c.fill(); }
      // attic: rafters, a dusty trunk
      c.strokeStyle = '#2a1c10'; c.lineWidth = 8; for (let x = 2080; x < 2760; x += 110) { c.beginPath(); c.moveTo(x, 130); c.lineTo(x + 50, 200); c.stroke(); }
      c.fillStyle = '#5a3a1a'; c.fillRect(2560, 340, 90, 40); c.fillStyle = '#c8a050'; c.fillRect(2560, 352, 90, 4);
      // ballroom: tall windows and a stage
      for (const wx of [2800, 2900]) { c.fillStyle = '#d8b860'; c.fillRect(wx, 170, 60, 220); c.fillStyle = '#26365a'; c.fillRect(wx + 5, 175, 50, 210); c.fillStyle = 'rgba(200,220,255,0.15)'; c.fillRect(wx + 5, 175, 22, 210); }
      // floors: the upper floor slab, the stage, chandeliers
      c.fillStyle = '#3a2418'; c.fillRect(1180, 380, 1580, 22);
      c.fillStyle = '#6a4428'; c.fillRect(1180, 380, 1580, 6);
      c.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = 1200; x < 2760; x += 46) c.fillRect(x, 386, 2, 16);
      c.fillStyle = '#5a2a30'; c.fillRect(2960, 520, 210, 100); c.fillStyle = '#d8b860'; c.fillRect(2960, 520, 210, 6);
      for (const p of this.platforms.filter(p => p.y < 320)) {
        const cx = p.x + p.w / 2;
        c.strokeStyle = '#c8a050'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, 120); c.lineTo(cx, p.y); c.moveTo(p.x + 10, p.y); c.lineTo(cx, p.y - 60); c.lineTo(p.x + p.w - 10, p.y); c.stroke();
        c.fillStyle = '#c8a050'; c.fillRect(p.x, p.y, p.w, 8); c.fillStyle = '#8a6a2a'; c.fillRect(p.x, p.y + 8, p.w, 4);
        for (let i = 0; i < 5; i++) { const x = p.x + 12 + i * (p.w - 24) / 4; c.fillStyle = '#f4ead0'; c.fillRect(x - 2, p.y - 14, 4, 14); }
      }
      // ground: checkered marble indoors, grass outside
      c.fillStyle = '#16200f'; c.fillRect(-40, FLOOR, X0 + 40, H - FLOOR);
      for (let x = X0; x < WW; x += 40) { c.fillStyle = (x / 40) % 2 ? '#2a2630' : '#4a4452'; c.fillRect(x, FLOOR, 40, 20); c.fillStyle = (x / 40) % 2 ? '#3a3440' : '#221e28'; c.fillRect(x, FLOOR + 20, 40, 20); }
      c.fillStyle = '#100c14'; c.fillRect(X0, FLOOR + 40, WW - X0 + 40, H - FLOOR);
      c.fillStyle = '#c8a050'; c.fillRect(X0, FLOOR, WW - X0, 2);
    },
    fx(c, t) {
      // flickering candle glow on each chandelier and in the stove
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const [x, y, r] of [[845, 290, 120], [2955, 280, 110], [2160, 570, 70]]) {
        const fl = 0.75 + 0.25 * Math.sin(t * 0.3 + x) * Math.sin(t * 0.13 + y);
        const g = c.createRadialGradient(x, y, 4, x, y, r);
        g.addColorStop(0, `rgba(255,200,120,${0.35 * fl})`); g.addColorStop(1, 'rgba(255,160,80,0)');
        c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
      }
      c.restore();
      // slow clouds drifting over the moon
      c.fillStyle = 'rgba(120,120,160,0.18)';
      for (let i = 0; i < 4; i++) { const x = ((t * 0.2 + i * 900) % 3600) - 200; c.beginPath(); c.ellipse(x, -100 + i * 40, 160, 22, 0, 0, 6.283); c.fill(); }
    },
    front(c, t) { drawHides(c, this.hides, t); },
  },
  {
    id: 'subway', name: 'Shinjuku Underground', sub: 'Metro Labyrinth · Last Train', width: 3400, thumbX: 1000,
    spawns: [700, 2700],
    // two levels: the station platform below, a concourse of ticket hall, shops and control room above
    platforms: [
      { x: 260, y: 380, w: 940 }, { x: 1480, y: 380, w: 760 }, { x: 2520, y: 380, w: 850 },
      { x: 130, y: 500, w: 110 }, { x: 1250, y: 500, w: 110 }, { x: 2330, y: 500, w: 110 },
      { x: 1180, y: 230, w: 360 }, { x: 2200, y: 230, w: 360 },
    ],
    hides: [
      { x: 420, y: 380, w: 110, h: 210, kind: 'locker' },
      { x: 860, y: FLOOR, w: 100, h: 220, kind: 'vending' },
      { x: 1820, y: 380, w: 130, h: 210, kind: 'booth' },
      { x: 1600, y: FLOOR, w: 90, h: 240, kind: 'pillar' },
      { x: 3000, y: FLOOR, w: 150, h: 160, kind: 'crates' },
      { x: 3180, y: 380, w: 110, h: 210, kind: 'locker' },
      { x: 2080, y: 380, w: 100, h: 220, kind: 'vending' },
    ],
    draw(c) {
      const WW = this.width, R = seeded(31);
      // solid rock all around: we're deep underground
      c.fillStyle = '#14120f'; c.fillRect(-40, -460, WW + 80, H + 460);
      c.fillStyle = '#1c1915'; for (let i = 0; i < 120; i++) { c.beginPath(); c.arc(R() * WW, -460 + R() * 560, 10 + R() * 40, 0, 6.283); c.fill(); }
      // street level far above: a sliver of the city through ventilation grates
      for (const gx of [600, 1700, 2900]) {
        c.fillStyle = '#2a3048'; c.fillRect(gx, -80, 160, 30); c.fillStyle = '#ffd890'; c.globalAlpha = 0.25; c.fillRect(gx, -50, 160, 180); c.globalAlpha = 1;
        c.strokeStyle = '#0a0a0a'; c.lineWidth = 4; for (let x = gx; x <= gx + 160; x += 20) { c.beginPath(); c.moveTo(x, -80); c.lineTo(x, -50); c.stroke(); }
      }
      // concourse rooms (upper) and the platform hall (lower)
      bigRoom(c, 260, 120, 940, 260, '#3a4252', '#c8c8d0', 'TICKET HALL');
      bigRoom(c, 1480, 120, 760, 260, '#4a3a2a', '#e8b060', 'SHOPPING ARCADE');
      bigRoom(c, 2520, 120, 850, 260, '#2a3a3a', '#7ad0c0', 'CONTROL ROOM');
      bigRoom(c, 0, 400, 2240, 220, '#c8d0c4', '#2a8a4a', '');
      bigRoom(c, 2240, 400, 1160, 220, '#3a3630', '#a87a2a', 'MAINTENANCE TUNNEL');
      // the open shafts between concourse rooms
      c.fillStyle = '#d8dcd4'; c.fillRect(0, 120, 260, 280); c.fillRect(1200, 120, 280, 280); c.fillRect(2240, 120, 280, 280);
      c.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 120; y < 620; y += 20) c.fillRect(0, y, 2520, 1);
      // tiled platform hall with station signs and a parked train behind the yellow line
      c.fillStyle = 'rgba(0,0,0,0.06)'; for (let x = 0; x < 2240; x += 20) c.fillRect(x, 400, 1, 220);
      c.fillStyle = '#d8dce0'; c.fillRect(160, 440, 1880, 150);
      for (let x = 160; x < 2040; x += 180) {
        c.fillStyle = '#2a8a4a'; c.fillRect(x + 6, 452, 168, 20);
        c.fillStyle = '#9aa8b8'; c.fillRect(x + 20, 486, 50, 60); c.fillRect(x + 100, 486, 50, 60);
        c.fillStyle = '#ffe8a0'; c.globalAlpha = 0.6; c.fillRect(x + 24, 490, 42, 52); c.fillRect(x + 104, 490, 42, 52); c.globalAlpha = 1;
        c.fillStyle = '#7a8a9a'; c.fillRect(x + 176, 450, 4, 140);
      }
      c.fillStyle = '#ffffff'; c.font = '900 22px "Segoe UI", sans-serif'; c.textAlign = 'center';
      c.fillText('新宿  SHINJUKU', 1100, 430);
      c.fillStyle = '#ffd34d'; c.fillRect(0, FLOOR - 8, 2240, 6);
      // concourse decor: turnstiles, shop fronts, monitors
      for (let x = 620; x < 820; x += 50) { c.fillStyle = '#8a9098'; c.fillRect(x, 320, 30, 60); c.fillStyle = '#4ad04a'; c.fillRect(x + 8, 328, 14, 6); }
      for (const [sx, col, n] of [[1500, '#ff7ad9', 'CREPES'], [1640, '#4da3ff', 'MANGA'], [1980, '#ffd34d', 'RAMEN']]) {
        c.fillStyle = col; c.fillRect(sx, 170, 120, 24); c.fillStyle = '#1a1a20'; c.font = '900 14px "Segoe UI", sans-serif'; c.fillText(n, sx + 60, 188);
        c.fillStyle = 'rgba(255,240,200,0.18)'; c.fillRect(sx, 200, 120, 170);
      }
      for (let x = 2560; x < 3300; x += 110) { c.fillStyle = '#10181a'; c.fillRect(x, 170, 90, 60); c.fillStyle = '#4ad0a0'; c.globalAlpha = 0.5; for (let l = 0; l < 4; l++) c.fillRect(x + 8, 180 + l * 12, 30 + R() * 44, 3); c.globalAlpha = 1; }
      c.fillStyle = '#3a4a4a'; c.fillRect(2700, 310, 400, 70); c.fillStyle = '#ff4d5a'; for (let i = 0; i < 12; i++) c.fillRect(2720 + i * 32, 330, 8, 8);
      // tunnel: rails, pipes and caged work lights
      c.strokeStyle = '#5a5248'; c.lineWidth = 10; for (const py of [430, 460]) { c.beginPath(); c.moveTo(2240, py); c.lineTo(3400, py); c.stroke(); }
      for (let x = 2320; x < 3400; x += 220) { c.fillStyle = '#ffcc60'; c.beginPath(); c.arc(x, 500, 7, 0, 6.283); c.fill(); }
      // stairs and footbridges
      c.strokeStyle = '#8a9098'; c.lineWidth = 3;
      for (const [x0, x1] of [[130, 260], [1250, 1480], [2330, 2520]]) { c.beginPath(); c.moveTo(x0 - 30, FLOOR); c.lineTo(x1, 380); c.stroke(); }
      for (const p of this.platforms) {
        if (p.w > 500) { slab(c, p, '#9aa0a8', '#4a4e56'); continue; }
        c.fillStyle = '#6a7078'; c.fillRect(p.x, p.y, p.w, 10); c.fillStyle = '#ffd34d'; c.fillRect(p.x, p.y, p.w, 3);
        if (p.y < 300) { c.strokeStyle = '#6a7078'; c.lineWidth = 3; for (let x = p.x + 10; x < p.x + p.w; x += 30) { c.beginPath(); c.moveTo(x, p.y); c.lineTo(x, p.y - 30); c.stroke(); } c.beginPath(); c.moveTo(p.x, p.y - 30); c.lineTo(p.x + p.w, p.y - 30); c.stroke(); }
        else { c.fillStyle = '#4a4e56'; c.fillRect(p.x + 10, p.y + 10, 10, FLOOR - p.y - 10); c.fillRect(p.x + p.w - 20, p.y + 10, 10, FLOOR - p.y - 10); }
      }
      // floor
      c.fillStyle = '#8a8e92'; c.fillRect(-40, FLOOR, WW + 80, 30);
      c.fillStyle = 'rgba(0,0,0,0.15)'; for (let x = 0; x < WW; x += 60) c.fillRect(x, FLOOR, 2, 30);
      c.fillStyle = '#1a1816'; c.fillRect(-40, FLOOR + 30, WW + 80, H - FLOOR);
    },
    fx(c, t) {
      // humming fluorescent strips (one flickers) and a train rushing through the far tunnel now and then
      for (const [x, y] of [[400, 130], [700, 130], [1000, 130], [1600, 130], [2000, 130], [2700, 130], [3100, 130], [400, 405], [1000, 405], [1600, 405], [2600, 405], [3100, 405]]) {
        const on = x === 2600 ? Math.sin(t * 0.7) * Math.sin(t * 0.13) > -0.2 : true;
        c.fillStyle = on ? '#f4fff8' : '#5a6060'; c.fillRect(x - 50, y, 100, 5);
        if (on) { c.fillStyle = 'rgba(230,255,240,0.07)'; c.beginPath(); c.moveTo(x - 50, y + 5); c.lineTo(x + 50, y + 5); c.lineTo(x + 110, y + 180); c.lineTo(x - 110, y + 180); c.fill(); }
      }
      const ph = t % 900;
      if (ph < 160) {
        const tx = 3500 - ph * 26;
        c.fillStyle = '#c8ccd0'; c.fillRect(tx, 412, 1100, 60); c.fillStyle = '#2a8a4a'; c.fillRect(tx, 440, 1100, 8);
        c.fillStyle = '#ffe8a0'; for (let i = 0; i < 14; i++) c.fillRect(tx + 20 + i * 76, 418, 40, 18);
        c.fillStyle = 'rgba(255,255,220,0.6)'; c.beginPath(); c.arc(tx, 450, 10, 0, 6.283); c.fill();
      }
    },
    front(c, t) { drawHides(c, this.hides, t); },
  },
  {
    id: 'docks', name: 'Midnight Harbor', sub: 'Container Yard · Fog Warning', width: 3600, thumbX: 900,
    spawns: [800, 2900],
    // a moored trawler, stacks of containers, a gantry crane and a two-level warehouse
    platforms: [
      { x: 60, y: 470, w: 340 }, { x: 150, y: 330, w: 150 },
      { x: 620, y: 490, w: 250 }, { x: 980, y: 360, w: 250 }, { x: 1340, y: 490, w: 250 },
      { x: 1560, y: 220, w: 420 }, { x: 1900, y: 360, w: 250 }, { x: 2240, y: 490, w: 220 },
      { x: 2480, y: 500, w: 100 }, { x: 2600, y: 380, w: 970 },
    ],
    hides: [
      { x: 250, y: 470, w: 120, h: 200, kind: 'tarp' },
      { x: 450, y: FLOOR, w: 130, h: 180, kind: 'barrels' },
      { x: 1660, y: FLOOR, w: 160, h: 230, kind: 'container' },
      { x: 1990, y: 360, w: 130, h: 190, kind: 'nets' },
      { x: 2900, y: FLOOR, w: 150, h: 160, kind: 'crates' },
      { x: 3250, y: 380, w: 130, h: 210, kind: 'shelf' },
      { x: 1050, y: 360, w: 120, h: 190, kind: 'barrels' },
    ],
    draw(c) {
      const WW = this.width, R = seeded(53);
      nightSky(c, WW, '#03060c', '#1a2a3a', 53);
      c.fillStyle = '#f0f0e0'; c.beginPath(); c.arc(2300, -200, 40, 0, 6.283); c.fill();
      // the sea and a far city skyline across the bay
      c.fillStyle = '#0c1824'; for (let x = 0; x < WW; x += 70) { const h = 60 + R() * 160; c.fillRect(x, 420 - h, 60, h); }
      c.fillStyle = '#ffd890'; for (let i = 0; i < 160; i++) { c.globalAlpha = 0.5; c.fillRect(R() * WW, 280 + R() * 130, 3, 3); } c.globalAlpha = 1;
      const sea = c.createLinearGradient(0, 420, 0, FLOOR); sea.addColorStop(0, '#0e2236'); sea.addColorStop(1, '#06121e');
      c.fillStyle = sea; c.fillRect(-40, 420, WW + 80, 200);
      // lighthouse far off
      c.fillStyle = '#d8d0c0'; c.fillRect(3420, 280, 26, 140); c.fillStyle = '#c4222f'; c.fillRect(3420, 320, 26, 14); c.fillRect(3420, 360, 26, 14);
      // the trawler
      c.fillStyle = '#7a2a22'; c.beginPath(); c.moveTo(20, 470); c.lineTo(440, 470); c.lineTo(400, 600); c.lineTo(60, 600); c.closePath(); c.fill();
      c.fillStyle = '#e8e0d0'; c.fillRect(20, 470, 420, 10);
      c.fillStyle = '#d8d0c0'; c.fillRect(150, 330, 150, 140); c.fillStyle = '#ffe8a0'; c.fillRect(170, 360, 40, 30); c.fillRect(240, 360, 40, 30);
      c.fillStyle = '#5a4a3a'; c.fillRect(150, 330, 150, 10); c.fillRect(340, 220, 6, 250);
      c.strokeStyle = '#3a3a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(343, 230); c.lineTo(60, 470); c.moveTo(343, 230); c.lineTo(440, 470); c.stroke();
      // container stacks: each platform is the roof of a stack
      const cols = ['#c4422f', '#2a6a8a', '#d89a2a', '#3a7a4a', '#7a4a8a', '#c8c0b0'];
      this.platforms.filter(p => p.x >= 600 && p.x < 2480 && p.y > 300).forEach((p, i) => {
        for (let y = p.y, k = 0; y < FLOOR; y += 130, k++) {
          const hgt = Math.min(130, FLOOR - y);
          c.fillStyle = cols[(i * 2 + k) % cols.length]; c.fillRect(p.x, y, p.w, hgt);
          c.fillStyle = 'rgba(0,0,0,0.22)'; for (let x = p.x + 8; x < p.x + p.w; x += 14) c.fillRect(x, y + 6, 6, hgt - 12);
          c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(p.x, y + hgt - 4, p.w, 4);
        }
        c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(p.x, p.y, p.w, 3);
      });
      // the gantry crane over the yard
      c.fillStyle = '#d8a020';
      c.fillRect(1560, 220, 420, 18); c.fillRect(1570, 238, 18, FLOOR - 238); c.fillRect(1952, 238, 18, FLOOR - 238);
      c.strokeStyle = '#b07a10'; c.lineWidth = 4; for (let y = 260; y < FLOOR; y += 60) { c.beginPath(); c.moveTo(1570, y); c.lineTo(1588, y + 60); c.moveTo(1952, y); c.lineTo(1970, y + 60); c.stroke(); }
      c.fillStyle = '#3a3a40'; c.fillRect(1740, 238, 60, 30); c.strokeStyle = '#2a2a30'; c.lineWidth = 2; c.beginPath(); c.moveTo(1770, 268); c.lineTo(1770, 340); c.stroke();
      // the warehouse: corrugated walls, a catwalk, roller door
      c.fillStyle = '#2a2e34'; c.beginPath(); c.moveTo(2560, 120); c.lineTo(3070, 20); c.lineTo(3580, 120); c.lineTo(3580, FLOOR); c.lineTo(2560, FLOOR); c.closePath(); c.fill();
      bigRoom(c, 2600, 130, 960, 250, '#3a4048', '#8a9098', 'STORAGE LOFT');
      bigRoom(c, 2600, 400, 960, 220, '#343a40', '#c8a050', 'WAREHOUSE');
      c.fillStyle = 'rgba(0,0,0,0.2)'; for (let x = 2600; x < 3560; x += 16) c.fillRect(x, 130, 6, 490);
      c.fillStyle = '#ffd34d'; c.font = '900 26px Impact, sans-serif'; c.textAlign = 'center'; c.fillText('PIER 13', 3070, 100);
      slab(c, this.platforms[this.platforms.length - 1], '#8a9098', '#3a4048');
      c.fillStyle = '#5a6068'; c.fillRect(2480, 500, 100, 8); c.fillRect(2490, 508, 8, FLOOR - 508); c.fillRect(2562, 508, 8, FLOOR - 508);
      // boat deck & cabin roof edges
      c.fillStyle = '#5a4a3a'; c.fillRect(60, 470, 340, 6);
      // the pier
      c.fillStyle = '#5a5650'; c.fillRect(-40, FLOOR, WW + 80, 26);
      c.fillStyle = '#ffd34d'; for (let x = 0; x < WW; x += 80) c.fillRect(x, FLOOR, 40, 4);
      c.fillStyle = '#0a1018'; c.fillRect(-40, FLOOR + 26, WW + 80, H - FLOOR);
      c.fillStyle = '#2a2420'; for (let x = 20; x < WW; x += 120) c.fillRect(x, FLOOR + 26, 14, 74);
    },
    fx(c, t) {
      // the lighthouse beam sweeps, fog rolls through, water glints
      const a = t * 0.01;
      c.save(); c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,250,200,0.08)'; c.beginPath(); c.moveTo(3433, 290); c.lineTo(3433 + Math.cos(a) * 1600, 290 + Math.sin(a) * 120 - 60); c.lineTo(3433 + Math.cos(a) * 1600, 290 + Math.sin(a) * 120 + 60); c.closePath(); c.fill();
      c.fillStyle = 'rgba(200,220,255,0.25)'; for (let i = 0; i < 30; i++) { const x = (i * 131 + t * 0.4) % 3600, y = 440 + (i * 37) % 160; c.fillRect(x, y, 14 + (i % 4) * 6, 2); }
      c.restore();
      for (let i = 0; i < 7; i++) {
        const x = ((t * (0.3 + i * 0.05) + i * 600) % 4200) - 300, y = 380 + (i % 3) * 70;
        const g = c.createRadialGradient(x, y, 10, x, y, 260); g.addColorStop(0, 'rgba(180,190,200,0.16)'); g.addColorStop(1, 'rgba(180,190,200,0)');
        c.fillStyle = g; c.fillRect(x - 260, y - 260, 520, 520);
      }
      // lamp posts
      for (const x of [560, 1260, 2200]) { c.fillStyle = '#2a2a30'; c.fillRect(x - 3, 300, 6, FLOOR - 300); c.fillStyle = '#ffd890'; c.fillRect(x - 12, 296, 24, 8); }
    },
    front(c, t) { drawHides(c, this.hides, t); },
  },
  {
    id: 'mall', name: 'Dead Mall', sub: 'After Closing · Two Floors', width: 3200, thumbX: 1000,
    spawns: [700, 2500],
    // two shopping floors around an open atrium with a fountain, escalator steps and a skylight bridge
    platforms: [
      { x: 160, y: 380, w: 1240 }, { x: 1800, y: 380, w: 1240 },
      { x: 1440, y: 520, w: 110 }, { x: 1600, y: 450, w: 110 }, { x: 1380, y: 240, w: 440 },
    ],
    hides: [
      { x: 300, y: FLOOR, w: 150, h: 190, kind: 'rack' },
      { x: 640, y: FLOOR, w: 110, h: 230, kind: 'fitting' },
      { x: 1100, y: FLOOR, w: 110, h: 230, kind: 'photobooth' },
      { x: 1720, y: FLOOR, w: 90, h: 200, kind: 'plant' },
      { x: 2050, y: FLOOR, w: 100, h: 220, kind: 'vending' },
      { x: 450, y: 380, w: 180, h: 190, kind: 'ballpit' },
      { x: 2300, y: 380, w: 110, h: 215, kind: 'curtain' },
      { x: 2850, y: FLOOR, w: 150, h: 190, kind: 'rack' },
    ],
    draw(c) {
      const WW = this.width, R = seeded(9);
      nightSky(c, WW, '#0a0614', '#2a1a3a', 9);
      // parking lot outside both ends
      c.fillStyle = '#1a1a22'; c.fillRect(-40, 520, 200, 100); c.fillRect(3040, 520, 200, 100);
      c.fillStyle = '#e8e8f0'; for (const x of [20, 3080]) c.fillRect(x, 610, 60, 3);
      // the building shell with a big neon sign
      c.fillStyle = '#2a2234'; c.fillRect(140, 60, 2920, 560);
      c.font = '900 64px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#3a1a3a'; c.fillText('GALLERIA', 1600, 40);
      // stores, ground and upper
      const store = (x, y, w, h, wall, sign, name) => {
        bigRoom(c, x, y, w, h, wall, sign, '');
        c.fillStyle = sign; c.fillRect(x + w / 2 - 110, y + 14, 220, 30);
        c.fillStyle = '#10101a'; c.font = '900 18px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.fillText(name, x + w / 2, y + 36);
        c.strokeStyle = 'rgba(200,220,255,0.18)'; c.lineWidth = 2; for (let gx = x + 30; gx < x + w; gx += 120) { c.beginPath(); c.moveTo(gx, y + 60); c.lineTo(gx + 40, y + h - 10); c.stroke(); }
      };
      store(160, 400, 640, 220, '#4a2a3a', '#ff7ad9', 'FASHION');
      store(800, 400, 600, 220, '#1a1a3a', '#4ad0ff', 'ARCADE');
      store(1800, 400, 700, 220, '#4a3a20', '#ffd34d', 'FOOD COURT');
      store(2500, 400, 540, 220, '#2a3a4a', '#e8e8f0', 'DEPARTMENT');
      store(160, 130, 640, 250, '#3a2a1a', '#ff9a2a', 'TOY WORLD');
      store(800, 130, 600, 250, '#1a2a2a', '#7fd04a', 'ELECTRONICS');
      store(1800, 130, 700, 250, '#2a1018', '#ff4d5a', 'CINEMA');
      store(2500, 130, 540, 250, '#2a2a1a', '#c8b090', 'BOOKS');
      // atrium: tall glass, a fountain and the dead escalator
      c.fillStyle = '#1a2440'; c.fillRect(1400, 60, 400, 560);
      c.strokeStyle = 'rgba(160,190,255,0.25)'; c.lineWidth = 3; for (let x = 1400; x <= 1800; x += 50) { c.beginPath(); c.moveTo(x, 60); c.lineTo(x, 620); c.stroke(); } for (let y = 60; y < 620; y += 70) { c.beginPath(); c.moveTo(1400, y); c.lineTo(1800, y); c.stroke(); }
      c.fillStyle = '#8a8a96'; c.beginPath(); c.moveTo(1420, FLOOR); c.lineTo(1800, 380); c.lineTo(1800, 410); c.lineTo(1470, FLOOR); c.closePath(); c.fill();
      c.fillStyle = '#c8c8d0'; c.fillRect(1520, FLOOR - 30, 160, 30); c.fillStyle = '#4a7aaa'; c.fillRect(1528, FLOOR - 24, 144, 12);
      // store details: shelves of toys and tvs, cinema posters, tables
      for (let i = 0; i < 6; i++) { c.fillStyle = ['#ff4d5a', '#4da3ff', '#ffd34d'][i % 3]; c.fillRect(200 + i * 100, 300, 40, 40); }
      for (let i = 0; i < 5; i++) { c.fillStyle = '#10141c'; c.fillRect(830 + i * 110, 220, 90, 60); c.fillStyle = 'rgba(80,140,255,0.35)'; c.fillRect(836 + i * 110, 226, 78, 48); }
      for (let i = 0; i < 4; i++) { c.fillStyle = ['#c4222f', '#2a4a8a', '#3a6a3a', '#5a3a6a'][i]; c.fillRect(1850 + i * 110, 200, 70, 100); }
      for (let i = 0; i < 4; i++) { c.fillStyle = '#5a3a20'; c.fillRect(2200 + i * 70, 560, 50, 8); c.fillRect(2222 + i * 70, 568, 6, 52); }
      for (let i = 0; i < 4; i++) for (let r = 0; r < 3; r++) { c.fillStyle = ['#7a2a2a', '#2a4a7a', '#8a6a2a'][(i + r) % 3]; c.fillRect(2560 + i * 110, 190 + r * 60, 80, 40); }
      c.fillStyle = '#4ad0ff'; for (let i = 0; i < 4; i++) { c.fillRect(840 + i * 140, 500, 70, 120); c.fillStyle = i % 2 ? '#4ad0ff' : '#ff7ad9'; }
      // floors
      for (const p of this.platforms) {
        if (p.w > 500) { slab(c, p, '#c8c0b0', '#5a5260'); c.strokeStyle = '#c8c8d0'; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x, p.y - 30); c.lineTo(p.x + p.w, p.y - 30); c.stroke(); for (let x = p.x; x <= p.x + p.w; x += 40) { c.beginPath(); c.moveTo(x, p.y); c.lineTo(x, p.y - 30); c.stroke(); } continue; }
        c.fillStyle = '#a8a8b4'; c.fillRect(p.x, p.y, p.w, 10); c.fillStyle = '#ffffff'; c.fillRect(p.x, p.y, p.w, 2);
        if (p.y < 300) { c.strokeStyle = 'rgba(200,220,255,0.6)'; c.lineWidth = 2; c.strokeRect(p.x, p.y - 26, p.w, 26); }
      }
      c.fillStyle = '#d8d0c4'; c.fillRect(140, FLOOR, 2920, 30);
      c.fillStyle = 'rgba(0,0,0,0.1)'; for (let x = 140; x < 3060; x += 60) c.fillRect(x, FLOOR, 2, 30);
      c.fillStyle = '#2a2a30'; c.fillRect(-40, FLOOR, 180, 30); c.fillRect(3060, FLOOR, 180, 30);
      c.fillStyle = '#14101a'; c.fillRect(-40, FLOOR + 30, WW + 80, H - FLOOR);
    },
    fx(c, t) {
      // the fountain still runs; emergency lights strobe; the neon sign buzzes
      c.fillStyle = 'rgba(160,200,255,0.6)';
      for (let i = 0; i < 12; i++) { const k = ((t * 0.02 + i / 12) % 1), dx = (i % 2 ? 1 : -1) * k * 60; c.beginPath(); c.arc(1600 + dx, FLOOR - 30 - Math.sin(k * Math.PI) * 70, 3, 0, 6.283); c.fill(); }
      const neon = Math.sin(t * 0.9) * Math.sin(t * 0.17) > -0.5;
      c.font = '900 64px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = neon ? '#ff4dc8' : '#3a1a3a'; c.fillText('GALLERIA', 1600, 40);
      if (Math.floor(t / 40) % 2) for (const x of [500, 1100, 2150, 2770]) { c.fillStyle = 'rgba(255,40,40,0.12)'; c.beginPath(); c.arc(x, 145, 90, 0, 6.283); c.fill(); c.fillStyle = '#ff3a3a'; c.fillRect(x - 8, 136, 16, 8); }
    },
    front(c, t) { drawHides(c, this.hides, t); },
  },
];

const bgCache = new Map();
// A screen-sized picture of the arena (big arenas show a slice starting at thumbX: used for thumbnails).
function arenaBackground(a) {
  const key = a.id + '@' + RS.toFixed(2);
  if (!bgCache.has(key)) {
    const c = document.createElement('canvas');
    c.width = Math.round(W * RS); c.height = Math.round(H * RS);
    const g = c.getContext('2d'); g.scale(RS, RS);
    if (a.thumbX) g.translate(-a.thumbX, 0);
    a.draw(g);
    bgCache.set(key, c);
  }
  return bgCache.get(key);
}

// Big arenas: the whole world as one picture, with room above y=0 for when the camera zooms out.
const WORLD_TOP = 460, WORLD_PAD = 40;
function arenaWorld(a) {
  const rs = Math.min(RS, 1), key = a.id + '#world@' + rs.toFixed(2);
  if (!bgCache.has(key)) {
    const c = document.createElement('canvas');
    c.width = Math.round((a.width + WORLD_PAD * 2) * rs); c.height = Math.round((H + WORLD_TOP) * rs);
    const g = c.getContext('2d'); g.scale(rs, rs); g.translate(WORLD_PAD, WORLD_TOP);
    a.draw(g);
    bgCache.set(key, c);
  }
  return bgCache.get(key);
}

/* ---------------------------------------------------------------- camera */

const isPlayer = f => f.tag === 'P1' || f.tag === 'P2' || f.tag === 'YOU';
function updateCamera(snap) {
  const a = World.arena;
  if (!a || !a.width) { Cam.x = 0; Cam.z = 1; Cam.w = W; return; }
  const alive = World.fighters.filter(f => f.state !== 'ko');
  let focus, zMin = 0.62;
  const you = alive.find(f => f.tag === 'YOU');
  const players = you ? [you] : alive.filter(isPlayer);
  if (World.clash) { focus = [{ x: World.clash.mid - 200 }, { x: World.clash.mid + 200 }]; zMin = 1; }
  else if (players.length === 1) {
    // follow the player, and widen the shot to include visible enemies nearby
    const p = players[0];
    focus = [p, ...alive.filter(o => o.team !== p.team && !o.hidden && Math.abs(o.x - p.x) < 900)];
    zMin = 0.75;
  } else focus = players.length ? players : alive;
  if (!focus.length) return;
  let lo = Infinity, hi = -Infinity;
  for (const f of focus) { lo = Math.min(lo, f.x); hi = Math.max(hi, f.x); }
  const tz = U.clamp(W / (hi - lo + 420), zMin, 1), z = snap ? tz : U.lerp(Cam.z, tz, 0.06);
  const vw = W / z, tx = U.clamp((lo + hi) / 2 - vw / 2, 0, a.width - vw);
  Cam.z = z; Cam.w = vw; Cam.x = snap ? tx : U.lerp(Cam.x, tx, 0.12);
  Cam.x = U.clamp(Cam.x, 0, a.width - vw);
}
function worldTransform(c) { c.translate(0, H * (1 - Cam.z)); c.scale(Cam.z, Cam.z); c.translate(-Cam.x, 0); }

// Arrows on the screen edge pointing at fighters who are off camera (unless they're hiding).
function drawOffscreen(c) {
  if (!World.arena || !World.arena.width || Game.mode === 'demo') return;
  for (const f of World.fighters) {
    if (f.state === 'ko' || (f.hidden && !isPlayer(f))) continue;
    const sx = (f.x - Cam.x) * Cam.z;
    if (sx > -10 && sx < W + 10) continue;
    const right = sx > W, ax = right ? W - 26 : 26, ay = H * (1 - Cam.z) + (f.y - 90) * Cam.z;
    const col = TEAM_COLORS[f.team % TEAM_COLORS.length], d = Math.round(Math.abs(f.x - (Cam.x + Cam.w / 2)) / 10);
    c.save(); c.translate(ax, U.clamp(ay, 140, H - 40));
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.beginPath(); c.arc(0, 0, 20, 0, 6.283); c.fill();
    c.fillStyle = col; c.beginPath();
    if (right) { c.moveTo(16, 0); c.lineTo(2, -11); c.lineTo(2, 11); } else { c.moveTo(-16, 0); c.lineTo(-2, -11); c.lineTo(-2, 11); }
    c.fill();
    c.font = '800 11px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.fillText(f.tag, right ? -6 : 6, -24); c.fillText(d + 'm', right ? -6 : 6, 34);
    c.restore();
  }
}

/* ---------------------------------------------------------------- game flow */

const TEAM_COLORS = ['#4da3ff', '#ff4d5a', '#ffd34d', '#7fd04a', '#c070ff', '#ff9a2a', '#5fe0e0', '#ff7ad9'];

const Game = {
  running: false, paused: false, mode: null, match: null,
  phase: 'none', phaseT: 0, timer: 0,

  // cfg.roster: [{ id, team, ai (level or null), keys: 'p1'|'p2'|'solo', tag }].
  // Older configs (p1/p2/p1ai/p2ai) are converted into a two-fighter roster.
  startMatch(cfg) {
    const arena = ARENAS.find(a => a.id === cfg.arena) || U.pick(ARENAS);
    World.arena = arena; World.platforms = arena.platforms; World.hides = arena.hides || [];
    World.left = 30; World.right = (arena.width || W) - 30;
    const roster = cfg.roster || [
      { id: cfg.p1, team: 0, ai: cfg.p1ai ?? null, keys: cfg.solo ? 'solo' : 'p1', tag: cfg.p1ai != null ? 'CPU' : 'P1' },
      { id: cfg.p2, team: 1, ai: cfg.p2ai ?? null, keys: 'p2', tag: cfg.p2ai != null ? 'CPU' : 'P2', boss: cfg.boss },
    ];
    World.fighters = roster.map((r, i) => {
      const input = r.input || (r.ai != null ? new AIController(r.ai) : new KeyController(BINDS[r.keys || 'p1']));
      const f = new Fighter(CHARS[r.id], i === 0 ? 0 : 1, input);
      f.team = r.team; f.tag = r.tag || (r.ai != null ? 'CPU' : 'P' + (i + 1));
      f.keyLabels = r.ai != null || (r.input && r.tag !== 'YOU') ? KEY_LABELS.cpu : r.keys === 'p2' ? KEY_LABELS.p2 : KEY_LABELS.p1;
      if (r.boss) f.maxHp = Math.round(f.maxHp * 1.1);
      return f;
    });
    this.placeFighters();
    this.match = { cfg, winsNeeded: cfg.wins || 2, round: 0 };
    this.mode = cfg.mode; this.running = true; this.paused = false;
    Sound.muted = cfg.mode === 'demo';
    if (cfg.mode !== 'demo') UI.show(null);
    this.startRound();
  },

  // Spread fighters across the arena, grouped by team.
  placeFighters() {
    const fs = World.fighters, a = World.arena, AW = a.width || W;
    if (fs.length === 2) { [fs[0].spawnX, fs[1].spawnX] = a.spawns || [420, W - 420]; return; }
    const order = fs.slice().sort((a, b) => a.team - b.team), m = a.width ? 400 : 170;
    order.forEach((f, i) => { f.spawnX = Math.round(U.lerp(m, AW - m, order.length > 1 ? i / (order.length - 1) : 0.5)); });
  },

  teamsAlive() { return new Set(World.fighters.filter(f => f.hp > 0).map(f => f.team)); },
  teamName(team) {
    const fs = World.fighters.filter(f => f.team === team), lead = fs[0];
    if (fs.length === 1) return lead.tag === 'CPU' ? `${lead.def.short} (CPU)` : lead.tag === 'P1' ? 'PLAYER 1' : lead.tag === 'P2' ? 'PLAYER 2' : lead.def.short;
    const human = fs.find(f => f.tag === 'P1' || f.tag === 'P2');
    return human ? `${human.tag === 'P1' ? 'PLAYER 1' : 'PLAYER 2'}'S TEAM` : 'CPU TEAM';
  },

  startRound() {
    World.clear();
    this.match.round++;
    for (const f of World.fighters) f.resetRound();
    updateCamera(true);
    this.phase = 'intro'; this.phaseT = 0;
    this.timer = World.settings.roundTime * 60;
    World.active = false;
    Input.queue.clear();
  },

  update() {
    UI.tick();
    this.phaseT++;
    const fs = World.fighters, m = this.match;
    if (this.phase === 'intro') {
      if (this.phaseT === 1) {
        const final = m.winsNeeded > 1 && new Set(fs.map(f => f.team)).size === 2 && fs.every(f => f.wins === m.winsNeeded - 1);
        const sub = fs.length === 2 ? `${fs[0].def.name}  vs  ${fs[1].def.name}` : `${fs.length} fighters · ${m.cfg.ffa ? 'FREE FOR ALL' : 'TEAM BATTLE'}`;
        UI.announce(final ? 'FINAL ROUND' : `ROUND ${m.round}`, '#ffffff', 65, sub);
        Sound.play('round');
      }
      if (this.phaseT === 75) { UI.announce('FIGHT!', '#ffd34d', 45); Sound.play('fight'); World.active = true; this.phase = 'fight'; this.phaseT = 0; }
    } else if (this.phase === 'fight') {
      if (this.timer > 0 && !World.domain) {
        this.timer--;
        if (this.timer === 0) this.endFight('time');
      }
    } else if (this.phase === 'ko') {
      if (this.phaseT === 150) this.endRound();
    } else if (this.phase === 'over') {
      if (this.phaseT === 140) this.finishMatch();
    }
  },

  // A round only ends once a single team (or nobody) is left standing.
  onKO() {
    if (this.phase !== 'fight') return;
    if (this.teamsAlive().size <= 1) this.endFight('ko');
  },

  endFight(why) {
    this.phase = 'ko'; this.phaseT = 0;
    World.active = false;
    if (why === 'time') { UI.announce('TIME!', '#ffffff', 80); FX.slow(40, 0.4); }
    else setTimeout(() => UI.announce('K.O.', '#ff3355', 90), 250);
  },

  endRound() {
    const fs = World.fighters, m = this.match;
    let team = null;
    const alive = this.teamsAlive();
    if (alive.size === 1) team = [...alive][0];
    else {
      // time out: the team with the most remaining health (as a share of its total) wins
      const score = {};
      for (const f of fs) if (alive.has(f.team)) score[f.team] = (score[f.team] || 0) + f.hp / f.maxHp / fs.filter(o => o.team === f.team).length;
      const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
      if (ranked.length && (ranked.length === 1 || ranked[0][1] !== ranked[1][1])) team = +ranked[0][0];
      if (team === null && m.round >= 5) team = fs[0].team;
    }
    if (team !== null) for (const f of fs) if (f.team === team) f.wins++;
    if (team === null) UI.announce('DRAW', '#ffffff', 70);
    const lead = team !== null && fs.find(f => f.team === team);
    if (lead && lead.wins >= m.winsNeeded) {
      this.phase = 'over'; this.phaseT = 0; this.winner = lead; this.winTeam = team;
      for (const f of fs) if (f.team === team && f.state !== 'ko') { f.victory = true; f.interruptMove(); f.state = 'idle'; }
      const p1Won = team === fs[0].team;
      const label = this.mode === 'story' ? (p1Won ? 'VICTORY' : 'DEFEAT') : fs.length === 2 ? `${lead.def.short} WINS` : `${this.teamName(team)} WINS`;
      UI.announce(label, p1Won || this.mode !== 'story' ? '#ffd34d' : '#ff3355', 130);
      Sound.play('confirm');
    } else this.startRound();
  },

  finishMatch() {
    const w = this.winner, fs = World.fighters, cfg = this.match.cfg;
    if (this.mode === 'demo') { this.startDemo(); return; }
    if (this.mode === 'story') { Story.onResult(this.winTeam === fs[0].team); return; }
    if (this.mode === 'online') {
      const youWon = fs.find(f => f.team === this.winTeam).tag === 'YOU';
      Net.endMatch();
      UI.showResult({
        title: youWon ? 'YOU WIN' : 'YOU LOSE', color: youWon ? '#ffd34d' : '#ff3355', sub: `${w.def.name} — ${w.def.title}`,
        stats: `${fs[0].def.short} ${fs[0].wins} &nbsp;–&nbsp; ${fs[1].wins} ${fs[1].def.short}`,
        buttons: [
          { label: 'Rematch', fn: () => { Game.startDemo(); Net.send({ t: 'reselect' }); Select.open('online'); } },
          { label: 'Leave Room', fn: () => { Net.close(); this.toMenu(); } },
        ],
      });
      return;
    }
    const teams = [...new Set(fs.map(f => f.team))];
    const stats = fs.length === 2
      ? `${fs[0].def.short} ${fs[0].wins} &nbsp;–&nbsp; ${fs[1].wins} ${fs[1].def.short}`
      : teams.map(t => `${this.teamName(t)} ${fs.find(f => f.team === t).wins}`).join(' &nbsp;·&nbsp; ');
    UI.showResult({
      title: `${this.teamName(this.winTeam)} WINS`, sub: `${w.def.name} — ${w.def.title}`, color: w.def.color, stats,
      buttons: [
        { label: 'Rematch', fn: () => this.startMatch(cfg) },
        { label: 'Character Select', fn: () => { this.startDemo(); Select.open(cfg.mode === 'story' ? 'versus' : cfg.mode); } },
        { label: 'Main Menu', fn: () => this.toMenu() },
      ],
    });
  },

  timeLeft() { return World.settings.roundTime ? Math.ceil(this.timer / 60) : null; },
  canPause() { return this.running && !this.paused && this.mode !== 'demo' && this.mode !== 'online' && this.phase !== 'over'; },
  pause() { this.paused = true; Sound.play('select'); UI.show('pause', { back: () => this.resume() }); },
  resume() { this.paused = false; UI.show(null); },
  restart() { this.paused = false; this.startMatch(this.match.cfg); },
  toMenu() { this.paused = false; if (Net.connected) Net.close(); this.startDemo(); UI.openMenu(0); },

  startDemo() {
    const p1 = U.pick(ROSTER); let p2 = U.pick(ROSTER);
    if (p2 === p1) p2 = ROSTER[(ROSTER.indexOf(p1) + 1) % ROSTER.length];
    this.startMatch({ mode: 'demo', p1, p2, p1ai: 0.7, p2ai: 0.7, arena: U.pick(ARENAS).id, wins: 1 });
  },
};
World.onKO = f => Game.onKO(f);

/* ---------------------------------------------------------------- story */

const Story = {
  ch: 0, idx: 0,
  progress() { return Store.get('story', {}); },
  begin(ch) { this.ch = ch; this.idx = 0; UI.showBrief(ch, 0); },
  fight() {
    const c = STORY[this.ch], ft = c.fights[this.idx];
    Game.startMatch({ mode: 'story', p1: c.hero, p2: ft.enemy, p2ai: ft.diff, solo: true, arena: ft.arena, wins: ft.boss ? 2 : 1, boss: ft.boss });
  },
  onResult(won) {
    const c = STORY[this.ch], ft = c.fights[this.idx];
    Game.startDemo();
    if (!won) {
      UI.showResult({
        title: 'DEFEAT', color: '#ff3355', sub: `${CHARS[ft.enemy].name} stands over you.`,
        buttons: [{ label: 'Retry', fn: () => this.fight() }, { label: 'Chapter Select', fn: () => UI.openStory(this.ch) }, { label: 'Main Menu', fn: () => UI.openMenu(0) }],
      });
      return;
    }
    this.idx++;
    const prog = this.progress();
    prog[c.id] = Math.max(prog[c.id] || 0, this.idx);
    Store.set('story', prog);
    if (this.idx >= c.fights.length) {
      UI.showResult({
        title: 'CHAPTER CLEAR', color: '#ffd34d', sub: `${c.title} — complete.`,
        buttons: [
          ...(this.ch + 1 < STORY.length ? [{ label: `Next: ${STORY[this.ch + 1].title}`, fn: () => this.begin(this.ch + 1) }] : []),
          { label: 'Chapter Select', fn: () => UI.openStory(this.ch) }, { label: 'Main Menu', fn: () => UI.openMenu(0) },
        ],
      });
      return;
    }
    const next = c.fights[this.idx];
    UI.showResult({
      title: 'VICTORY', color: '#ffd34d', sub: `Next opponent: ${CHARS[next.enemy].name}${next.boss ? ' (BOSS)' : ''}`,
      buttons: [{ label: 'Continue', fn: () => UI.showBrief(this.ch, this.idx) }, { label: 'Chapter Select', fn: () => UI.openStory(this.ch) }],
    });
  },
};

/* ---------------------------------------------------------------- rendering */

function drawTags(c) {
  if (Game.mode === 'demo') return;
  for (const f of World.fighters) {
    if (f.state === 'ko' || (f.hidden && !isPlayer(f))) continue;
    const h = headPos(f), y = h.y - 40 * f.scale;
    const col = TEAM_COLORS[f.team % TEAM_COLORS.length];
    c.fillStyle = col;
    c.beginPath(); c.moveTo(h.x - 7, y - 8); c.lineTo(h.x + 7, y - 8); c.lineTo(h.x, y); c.closePath(); c.fill();
    c.font = '800 11px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillText(f.tag, h.x, y - 12);
  }
}

function drawDebug(c) {
  c.save(); c.lineWidth = 1.5;
  for (const f of World.fighters) {
    const h = f.hurtbox(); c.strokeStyle = 'rgba(80,255,120,0.9)'; c.strokeRect(h.x, h.y, h.w, h.h);
    const m = f.move;
    if (m && m.hitbox && f.mf >= m.startup && f.mf < m.startup + m.active) { const r = f.attackRect(m.hitbox); c.strokeStyle = 'rgba(255,60,60,0.95)'; c.strokeRect(r.x, r.y, r.w, r.h); }
  }
  for (const e of World.entities) if (e.hits) { c.strokeStyle = 'rgba(255,200,60,0.9)'; c.beginPath(); c.arc(e.x, e.y, e.r, 0, 6.283); c.stroke(); }
  c.restore();
}

// During a domain clash the screen splits: each caster's domain fills the half they stand on.
function drawClashDomains(c2d, c) {
  const aLeft = c.aLeft, seam = W / 2 + Math.sin(c.t * 0.07) * 18;
  c.views.forEach((v, i) => {
    if (!v.bg) return;
    const left = (i === 0) === aLeft;
    c2d.save(); c2d.beginPath();
    if (left) c2d.rect(-40, -40, seam + 40, H + 80); else c2d.rect(seam, -40, W - seam + 40, H + 80);
    c2d.clip(); v.bg(c2d, v, 1); c2d.restore();
  });
  // a crackling seam where the two barriers grind against each other
  c2d.save(); c2d.globalCompositeOperation = 'lighter';
  c2d.strokeStyle = 'rgba(255,255,255,0.9)'; c2d.lineWidth = 4;
  c2d.beginPath(); for (let y = -20; y <= H + 20; y += 24) c2d.lineTo(seam + U.rand(-7, 7), y); c2d.stroke();
  c2d.strokeStyle = 'rgba(255,240,200,0.25)'; c2d.lineWidth = 26; c2d.beginPath(); c2d.moveTo(seam, 0); c2d.lineTo(seam, H); c2d.stroke();
  c2d.restore();
}

function render() {
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  if (!World.arena) { ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H); return; }
  ctx.save();
  const sh = World.shake;
  if (sh) ctx.translate(U.rand(-sh, sh), U.rand(-sh, sh));
  const A = World.arena;
  updateCamera(false);
  if (A.width) {
    ctx.save(); worldTransform(ctx);
    ctx.drawImage(arenaWorld(A), -WORLD_PAD, -WORLD_TOP, A.width + WORLD_PAD * 2, H + WORLD_TOP);
    if (A.fx) A.fx(ctx, World.frame);
    ctx.restore();
  } else {
    ctx.drawImage(arenaBackground(A), -20, -20 * H / W, W + 40, H + 40 * H / W);
    if (A.fx) A.fx(ctx, World.frame);
  }
  const d = World.domain;
  if (World.clash) drawClashDomains(ctx, World.clash);
  else if (d && d.bg) d.bg(ctx, d, Domains.alpha(d));
  ctx.save(); worldTransform(ctx);
  for (const e of World.entities) if (e.layer === 'back') e.draw(ctx);
  const fs = World.fighters.slice().sort((p, q) => (p.state === 'move') - (q.state === 'move'));
  for (const f of fs) f.draw(ctx);
  if (A.front && !(d && d.bg) && !World.clash) A.front(ctx, World.frame);
  for (const e of World.entities) if (e.layer !== 'back') e.draw(ctx);
  drawParticles(ctx);
  drawTags(ctx);
  if (World.settings.hitboxes) drawDebug(ctx);
  ctx.restore();
  drawOffscreen(ctx);
  ctx.restore();
  if (World.flash > 0) { ctx.globalAlpha = Math.min(1, World.flash); ctx.fillStyle = World.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (World.timeScale < 1) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 760);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (Game.running && Game.mode !== 'demo') UI.drawHUD(ctx);
  UI.drawOverlays(ctx);
  if (Net.inMatch && Net.lock.stall > 45) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 220, H / 2 - 30, 440, 60);
    ctx.font = '800 22px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
    ctx.fillText('Waiting for opponent…', W / 2, H / 2);
  }
}

/* ---------------------------------------------------------------- layout & loop */

function resize() {
  const stage = document.getElementById('stage');
  const cw = Math.min(innerWidth, innerHeight * 16 / 9), ch = cw * 9 / 16;
  stage.style.width = cw + 'px'; stage.style.height = ch + 'px';
  stage.style.fontSize = (cw / 100) + 'px';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const nrs = Math.min(2, (cw * dpr) / W);
  if (Math.abs(nrs - RS) > 0.01 || canvas.width !== Math.round(W * nrs)) {
    RS = nrs; bgCache.clear();
    canvas.width = Math.round(W * RS); canvas.height = Math.round(H * RS);
  }
}

let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (Game.running && !Game.paused) {
    if (World.cutscene && !World.lockstep && --World.cutscene.t <= 0) World.cutscene = null;
    UI.tickReal();
    if (World.slowTimer > 0 && --World.slowTimer <= 0) World.timeScale = 1;
    acc += dt * World.timeScale;
    let n = 0;
    if (Net.inMatch) {
      // online: each frame waits until both players' inputs are in
      while (acc >= STEP && n < 6) { if (!Net.tryStep()) { acc = Math.min(acc, STEP * 2); break; } acc -= STEP; n++; }
    } else {
      while (acc >= STEP && n < 4) { acc -= STEP; n++; if (World.step()) Game.update(); }
      if (n === 4) acc = 0;
    }
    Input.age();
  }
  const dom = World.domain;
  Sound.syncMusic(Game.running && !Game.paused && Game.mode !== 'demo' && dom ? dom.music : null);
  render();
  UI.renderPreviews();
  requestAnimationFrame(frame);
}

function boot() {
  const saved = Store.get('settings', null);
  if (saved) Object.assign(World.settings, saved);
  Sound.setVolume(World.settings.volume);
  resize();
  addEventListener('resize', resize);
  Input.init();
  UI.init();
  Game.startDemo();
  UI.openMenu(0);
  requestAnimationFrame(frame);
}
boot();
