'use strict';
/* ==========================================================================
   combat.js — the shared simulation layer:
   world state, particle effects, pose/stickman renderer, Fighter,
   Entity (projectiles & summons), Domain Expansions and hit resolution.
   ========================================================================== */

const W = 1280, H = 720, FLOOR = 620, GRAVITY = 0.85, DEG = Math.PI / 180;
const NULL_INPUT = { held: {}, pressed: {} };

const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  sign: v => (v < 0 ? -1 : 1),
  overlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
  circleRect(cx, cy, r, b) {
    const nx = U.clamp(cx, b.x, b.x + b.w), ny = U.clamp(cy, b.y, b.y + b.h);
    return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
  },
  // amt in -1..1: negative darkens, positive lightens
  shade(hex, amt) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16);
    const f = v => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  },
};

/* ---------------------------------------------------------------- World */

const World = {
  fighters: [], entities: [], particles: [], timers: [],
  shake: 0, flash: 0, flashColor: '#fff',
  timeScale: 1, slowTimer: 0, hitstop: 0,
  domain: null, banner: null, frame: 0,
  arena: null, platforms: [], left: 30, right: W - 30,
  active: false,          // true while fighters accept input
  onKO: null,             // set by game.js
  settings: { shake: true, hitboxes: false, volume: 0.6, roundTime: 99, particles: 1, blood: true },
  cutscene: null,         // domain expansion hand-sign cutscene (freezes the fight)

  clear() {
    this.entities = []; this.particles = []; this.timers = [];
    this.domain = null; this.banner = null; this.cutscene = null;
    this.shake = 0; this.flash = 0; this.timeScale = 1; this.slowTimer = 0; this.hitstop = 0;
  },
  opp(f) { return this.fighters[0] === f ? this.fighters[1] : this.fighters[0]; },
  later(t, fn) { this.timers.push({ t, fn }); },
  spawn(e) { this.entities.push(e); return e; },
  // highest walkable surface at or below y
  groundAt(x, y) {
    let g = FLOOR;
    for (const p of this.platforms) if (x > p.x && x < p.x + p.w && p.y >= y - 1 && p.y < g) g = p.y;
    return g;
  },

  // One fixed 60Hz simulation tick. Returns false while frozen by hitstop.
  step() {
    if (this.cutscene) return false;
    if (this.hitstop > 0) { this.hitstop--; updateParticles(); return false; }
    this.frame++;
    for (const f of this.fighters) if (f.input && f.input.update) f.input.update();
    for (const f of this.fighters) f.update();
    for (let i = 0; i < this.entities.length; i++) { const e = this.entities[i]; if (!e.dead) e.update(); }
    resolveClashes();
    this.entities = this.entities.filter(e => !e.dead);
    Domains.update();
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      if (--t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
    }
    if (this.fighters.length === 2) separate(this.fighters[0], this.fighters[1]);
    for (const f of this.fighters) {
      const o = this.opp(f);
      if (o && !o.inHitState()) f.combo = 0;
      if (f.comboShowT > 0) f.comboShowT--;
    }
    updateParticles();
    if (this.banner && --this.banner.life <= 0) this.banner = null;
    if (this.shake > 0) { this.shake *= 0.86; if (this.shake < 0.3) this.shake = 0; }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.05);
    return true;
  },
};

function separate(a, b) {
  const skip = s => s === 'ko' || s === 'down';
  if (skip(a.state) || skip(b.state)) return;
  const minD = 34 * (a.scale + b.scale) / 2;
  const dx = b.x - a.x;
  if (Math.abs(dx) >= minD || Math.abs(a.y - b.y) > 90 * Math.max(a.scale, b.scale)) return;
  const s = dx === 0 ? (a.side === 0 ? 1 : -1) : Math.sign(dx);
  const push = (minD - Math.abs(dx)) / 2;
  a.x -= s * push; b.x += s * push;
  a.clampWalls(); b.clampWalls();
}

/* ---------------------------------------------------------------- Effects */

const FX = {
  add(p) {
    const cap = 650 * World.settings.particles + 120;
    if (World.particles.length >= cap) return p;
    p.vx ??= 0; p.vy ??= 0; p.drag ??= 1; p.grav ??= 0; p.max ??= p.life;
    World.particles.push(p);
    return p;
  },
  n(count) { return Math.max(1, Math.round(count * World.settings.particles)); },
  spark(x, y, color, n = 10, speed = 6, size = 3, life = 26) {
    n = this.n(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.9), l = life * (0.6 + Math.random() * 0.6);
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, size, color, drag: 0.9, grav: 0.12 });
    }
  },
  glow(x, y, color, size = 30, life = 16, vx = 0, vy = 0) {
    return this.add({ type: 'glow', x, y, vx, vy, life, size, color, drag: 0.94 });
  },
  ring(x, y, color, r = 60, life = 18, width = 4) {
    return this.add({ type: 'ring', x, y, life, r, color, width });
  },
  smoke(x, y, color = '#9a9090', n = 6, spread = 20, size = 16) {
    n = this.n(n);
    for (let i = 0; i < n; i++) {
      const l = U.rand(30, 55);
      this.add({ type: 'smoke', x: x + U.rand(-spread, spread), y: y + U.rand(-spread, spread) * 0.5, vx: U.rand(-1, 1), vy: U.rand(-1.6, -0.3), life: l, size: size * U.rand(0.7, 1.3), color, drag: 0.97 });
    }
  },
  dust(x, y, n = 6) {
    n = this.n(n);
    for (let i = 0; i < n; i++) {
      const l = U.rand(18, 32);
      this.add({ type: 'smoke', x: x + U.rand(-10, 10), y: y - 4, vx: U.rand(-3, 3), vy: U.rand(-1.2, -0.2), life: l, size: U.rand(6, 11), color: '#c9b9a0', drag: 0.92 });
    }
  },
  debris(x, y, color = '#7a6a5a', n = 8, power = 9) {
    n = this.n(n);
    for (let i = 0; i < n; i++) {
      const l = U.rand(30, 50);
      this.add({ type: 'debris', x, y, vx: U.rand(-power, power) * 0.6, vy: U.rand(-power, -power * 0.3), life: l, size: U.rand(3, 8), color, grav: 0.5, drag: 0.99, rot: Math.random() * 6, vr: U.rand(-0.3, 0.3) });
    }
  },
  text(x, y, str, color = '#fff', size = 28, life = 50) {
    return this.add({ type: 'text', x, y, vy: -0.7, life, str: String(str), color, size, drag: 0.98 });
  },
  slash(x, y, ang, len, color = '#fff', width = 5, life = 12) {
    return this.add({ type: 'slash', x, y, ang, len, color, width, life });
  },
  arc(f, sw) {
    const s = f.scale;
    return this.add({ type: 'arc', x: f.x - f.facing * 6 * s, y: f.y - 100 * s, r: sw.r * s, facing: f.facing, color: sw.color, width: sw.w || 7, life: 10, a0: sw.a0 ?? -75, a1: sw.a1 ?? 55 });
  },
  bolt(x1, y1, x2, y2, color = '#ffe86a', life = 10, width = 3) {
    const pts = [[x1, y1]], segs = 7;
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      pts.push([U.lerp(x1, x2, t) + U.rand(-14, 14), U.lerp(y1, y2, t) + U.rand(-14, 14)]);
    }
    pts.push([x2, y2]);
    return this.add({ type: 'bolt', x: x1, y: y1, pts, color, life, width });
  },
  ghost(f, color) {
    return this.add({ type: 'ghost', x: f.x, y: f.y, facing: f.facing, pose: poseCopy(f.pose), def: f.def, life: 14, color: color || f.def.look.accent });
  },
  explosion(x, y, size = 60, colors = ['#fff', '#ffcf5a', '#ff6a2a']) {
    this.glow(x, y, colors[0], size * 1.1, 14);
    this.ring(x, y, colors[1], size * 1.6, 22, 6);
    this.spark(x, y, colors[1], Math.round(size / 3), size / 7, 4, 30);
    this.spark(x, y, colors[2], Math.round(size / 4), size / 9, 3, 40);
    this.smoke(x, y, '#5a5050', Math.round(size / 12), size * 0.4, size * 0.4);
  },
  impact(x, y, h, dmg) {
    const big = dmg >= 70;
    switch (h.fx) {
      case 'blue': this.spark(x, y, '#7cc8ff', 10, 6); this.glow(x, y, '#2f8cff', 30, 12); break;
      case 'red': this.explosion(x, y, 45, ['#fff', '#ff5050', '#ff9a9a']); break;
      case 'purple': this.explosion(x, y, 90, ['#fff', '#c070ff', '#6a2cff']); break;
      case 'fire': this.explosion(x, y, 60, ['#fff3b0', '#ff9a2a', '#ff3a1a']); break;
      case 'slash':
        for (let i = 0; i < 2; i++) this.slash(x + U.rand(-10, 10), y + U.rand(-20, 20), U.rand(-0.9, -0.3) + (i ? 1.2 : 0), 70, '#fff', 4, 10);
        this.spark(x, y, h.color || '#ff4d6a', 6, 5, 2); break;
      case 'cleave':
        for (let i = 0; i < 7; i++) this.slash(x + U.rand(-25, 25), y + U.rand(-50, 40), (i % 2 ? 0.6 : -0.6) + U.rand(-0.25, 0.25), 95, i % 2 ? '#fff' : '#ff3355', 4, 15);
        this.spark(x, y, '#ff2a4a', 16, 8, 3); break;
      case 'bf':
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * 6.28, l = U.rand(60, 150);
          this.bolt(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, i % 2 ? '#ff1f3d' : '#0a0a0a', 16, i % 2 ? 3 : 6);
        }
        this.ring(x, y, '#ff1f3d', 130, 22, 7); this.glow(x, y, '#ff1f3d', 60, 14); this.spark(x, y, '#111', 14, 9, 4); break;
      case 'zap': this.spark(x, y, '#ffe86a', 12, 7, 2); this.glow(x, y, '#ffe86a', 36, 10); break;
      case 'speech': this.ring(x, y, '#ffb3e6', 60, 16, 3); this.ring(x, y, '#ffb3e6', 90, 22, 2); break;
      case 'soul': this.ring(x, y, '#8affd2', 70, 20, 4); this.spark(x, y, '#8affd2', 16, 6); break;
      case 'wood': this.debris(x, y, '#7a5a3a', 8, 8); this.spark(x, y, '#cde88a', 6, 5); break;
      default:
        this.spark(x, y, h.color || '#fff3c4', big ? 16 : 9, big ? 9 : 6, big ? 4 : 3);
        this.ring(x, y, h.color || '#fff', big ? 60 : 34, 12, big ? 5 : 3);
        if (big) this.glow(x, y, '#fff', 40, 10);
    }
  },
  infinity(f) {
    const x = f.x + f.facing * 28 * f.scale, y = f.y - 85 * f.scale;
    this.add({ type: 'hex', x, y, life: 16, r: 46, color: '#9fe2ff', facing: f.facing });
    this.spark(x, y, '#cff2ff', 5, 4, 2);
  },
  shake(n) { if (World.settings.shake) World.shake = Math.max(World.shake, n); },
  flash(color, a) { World.flashColor = color; World.flash = Math.max(World.flash, a); },
  slow(frames, scale) { World.slowTimer = Math.max(World.slowTimer, frames); World.timeScale = Math.min(World.timeScale, scale); },
  hitstop(n) { World.hitstop = Math.max(World.hitstop, n); },
  blood(x, y, n = 12, dir = 0, power = 6) {
    if (!World.settings.blood) return;
    n = this.n(n);
    for (let i = 0; i < n; i++) {
      const l = U.rand(40, 70);
      this.add({ type: 'blood', x, y, vx: dir * U.rand(1, power) + U.rand(-2.5, 2.5), vy: U.rand(-power, power * 0.2), life: l, size: U.rand(1.8, 4), grav: 0.42, drag: 0.98 });
    }
  },
  banner(title, sub, color = '#fff', life = 110) { World.banner = { title, sub, color, life, max: life }; },
};

function updateParticles() {
  const ps = World.particles;
  let j = 0;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (--p.life <= 0) continue;
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.grav;
    p.x += p.vx; p.y += p.vy;
    if (p.vr) p.rot += p.vr;
    if (p.type === 'debris' && p.y > FLOOR) { p.y = FLOOR; p.vy *= -0.3; p.vx *= 0.7; }
    if (p.type === 'blood' && !p.stuck && p.y >= FLOOR) { p.y = FLOOR + U.rand(0, 6); p.stuck = true; p.vx = p.vy = p.grav = 0; p.life = p.max = 360; }
    ps[j++] = p;
  }
  ps.length = j;
}

function drawParticles(ctx) {
  for (const p of World.particles) {
    const a = Math.max(0, p.life / p.max);
    switch (p.type) {
      case 'spark':
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2); ctx.stroke();
        break;
      case 'glow':
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.35; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.3 - a * 0.3), 0, 6.283); ctx.fill();
        ctx.globalAlpha = a * 0.6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.45, 0, 6.283); ctx.fill();
        break;
      case 'ring':
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.width * a + 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - a * 0.85), 0, 6.283); ctx.stroke();
        break;
      case 'hex': {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = p.color; ctx.lineWidth = 2;
        const r = p.r * (1.1 - a * 0.3);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const an = i / 6 * 6.283 + Math.PI / 6;
          ctx.lineTo(p.x + Math.cos(an) * r * 0.5, p.y + Math.sin(an) * r);
        }
        ctx.closePath(); ctx.stroke();
        break;
      }
      case 'smoke':
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * 0.4;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.8 - a), 0, 6.283); ctx.fill();
        break;
      case 'debris':
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, a * 2);
        ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
        break;
      case 'text':
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, a * 2);
        ctx.font = `900 ${p.size}px Impact, "Arial Black", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(p.str, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.str, p.x, p.y);
        break;
      case 'slash': {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
        const dx = Math.cos(p.ang) * p.len / 2, dy = Math.sin(p.ang) * p.len / 2;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.width * a + 0.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x - dx, p.y - dy); ctx.lineTo(p.x + dx, p.y + dy); ctx.stroke();
        break;
      }
      case 'arc': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.facing, 1);
        const prog = 1 - a;
        const end = U.lerp(p.a0, p.a1, Math.min(1, prog * 2.2));
        ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineCap = 'round';
        ctx.lineWidth = p.width * a + 1;
        ctx.beginPath(); ctx.arc(0, 0, p.r, p.a0 * DEG, end * DEG); ctx.stroke();
        ctx.globalAlpha = a * 0.4; ctx.lineWidth = p.width * 2.5 * a;
        ctx.beginPath(); ctx.arc(0, 0, p.r * 0.92, p.a0 * DEG, end * DEG); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'bolt':
        ctx.globalCompositeOperation = p.color === '#0a0a0a' ? 'source-over' : 'lighter';
        ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = p.width; ctx.lineJoin = 'round';
        ctx.beginPath(); p.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke();
        break;
      case 'blood':
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, a * 3);
        ctx.fillStyle = p.stuck ? '#6a0010' : '#b0001c';
        ctx.beginPath();
        if (p.stuck) ctx.ellipse(p.x, p.y, p.size * 1.8, p.size * 0.5, 0, 0, 6.283);
        else ctx.arc(p.x, p.y, p.size, 0, 6.283);
        ctx.fill();
        break;
      case 'ghost':
        ctx.globalCompositeOperation = 'source-over';
        drawStickman(ctx, p.def, p.pose, p.x, p.y, p.facing, { alpha: a * 0.35, tint: p.color });
        break;
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

/* ---------------------------------------------------------------- Poses & stickman renderer
   Limb angles are degrees measured from "straight down", positive = toward the facing direction.
   Each limb is [upper angle, lower angle relative to upper].                                  */

const POSES = {
  idle:    { lean: 6,   aF: [30, 115],  aB: [12, 125],  lF: [16, -18],  lB: [-14, -6] },
  walkA:   { lean: 10,  aF: [45, 95],   aB: [-15, 110], lF: [32, -12],  lB: [-26, -22] },
  walkB:   { lean: 10,  aF: [10, 115],  aB: [30, 100],  lF: [-22, -26], lB: [30, -8] },
  jump:    { lean: 2,   aF: [135, 25],  aB: [115, 30],  lF: [75, -105], lB: [25, -75] },
  fall:    { lean: 4,   aF: [100, 30],  aB: [70, 30],   lF: [30, -35],  lB: [-10, -20] },
  block:   { lean: -4,  aF: [60, 120],  aB: [48, 132],  lF: [26, -32],  lB: [-20, -14] },
  jabW:    { lean: 2,   aF: [25, 140],  aB: [20, 125],  lF: [18, -20],  lB: [-16, -6] },
  jab:     { lean: 14,  aF: [88, 4],    aB: [22, 120],  lF: [26, -10],  lB: [-26, -6] },
  cross:   { lean: 22,  aF: [25, 120],  aB: [86, 4],    lF: [30, -14],  lB: [-30, -4] },
  kickW:   { lean: -4,  aF: [35, 110],  aB: [5, 110],   lF: [70, -100], lB: [-10, -8] },
  kick:    { lean: -18, aF: [45, 100],  aB: [-40, 60],  lF: [96, -4],   lB: [-8, -4] },
  heavyW:  { lean: -12, aF: [-50, 100], aB: [35, 110],  lF: [22, -22],  lB: [-22, -6] },
  heavy:   { lean: 28,  aF: [95, 0],    aB: [-35, 40],  lF: [42, -10],  lB: [-32, 0] },
  upper:   { lean: -8,  aF: [165, 8],   aB: [-20, 60],  lF: [12, -10],  lB: [-22, -6] },
  castW:   { lean: -6,  aF: [40, 130],  aB: [30, 140],  lF: [18, -20],  lB: [-18, -6] },
  cast:    { lean: 12,  aF: [92, 0],    aB: [86, 6],    lF: [28, -10],  lB: [-28, -4] },
  point:   { lean: 6,   aF: [96, 0],    aB: [8, 25],    lF: [14, -8],   lB: [-14, -4] },
  sign:    { lean: 0,   aF: [48, 128],  aB: [42, 136],  lF: [10, -4],   lB: [-10, -4] },
  charge:  { lean: -4,  aF: [110, 15],  aB: [-105, -15], lF: [24, -20], lB: [-24, -6] },
  bow:     { lean: 4,   aF: [92, 0],    aB: [95, 165],  lF: [30, -10],  lB: [-30, -4] },
  slashW:  { lean: -8,  aF: [168, 12],  aB: [150, 25],  lF: [18, -16],  lB: [-18, -6] },
  slash:   { lean: 26,  aF: [65, 10],   aB: [55, 25],   lF: [42, -10],  lB: [-32, -2] },
  slash2W: { lean: 10,  aF: [20, 20],   aB: [10, 30],   lF: [20, -16],  lB: [-20, -6] },
  slash2:  { lean: 20,  aF: [120, 5],   aB: [100, 20],  lF: [38, -10],  lB: [-30, -2] },
  spin:    { lean: -28, aF: [100, 0],   aB: [-100, 0],  lF: [140, 0],   lB: [0, -12] },
  hurt:    { lean: -22, aF: [-30, 45],  aB: [-55, 30],  lF: [12, -22],  lB: [-22, -10] },
  launch:  { lean: -30, aF: [-120, 30], aB: [-150, 20], lF: [35, -45],  lB: [-10, -30], rot: -25 },
  stun:    { lean: -6,  aF: [8, 10],    aB: [-6, 10],   lF: [8, -4],    lB: [-8, -4] },
  dash:    { lean: 32,  aF: [-45, 30],  aB: [-65, 20],  lF: [52, -62],  lB: [-42, -22] },
  down:    { lean: 0,   aF: [150, 10],  aB: [175, 10],  lF: [6, 0],     lB: [-6, 6], rot: -90, lying: true },
  win:     { lean: 0,   aF: [170, 0],   aB: [20, 120],  lF: [12, -6],   lB: [-12, -4] },
};

function poseCopy(p) {
  return { lean: p.lean, rot: p.rot || 0, lying: !!p.lying, aF: [p.aF[0], p.aF[1]], aB: [p.aB[0], p.aB[1]], lF: [p.lF[0], p.lF[1]], lB: [p.lB[0], p.lB[1]] };
}
function poseLerpInto(cur, t, k) {
  cur.lean = U.lerp(cur.lean, t.lean, k);
  cur.rot = U.lerp(cur.rot, t.rot || 0, k);
  cur.lying = !!t.lying;
  for (const key of ['aF', 'aB', 'lF', 'lB']) {
    cur[key][0] = U.lerp(cur[key][0], t[key][0], k);
    cur[key][1] = U.lerp(cur[key][1], t[key][1], k);
  }
  return cur;
}

const LIMB = { thigh: 30, shin: 31, upper: 23, fore: 23, torso: 44, headR: 15 };

function skeleton(p) {
  const dir = a => [Math.sin(a * DEG), Math.cos(a * DEG)];
  const lt = p.lean * DEG, td = [Math.sin(lt), -Math.cos(lt)];
  const hip = [0, 0];
  const neck = [td[0] * LIMB.torso, td[1] * LIMB.torso];
  const head = [neck[0] + td[0] * (LIMB.headR + 3), neck[1] + td[1] * (LIMB.headR + 3)];
  const sh = [neck[0] - td[0] * 3, neck[1] - td[1] * 3];
  const limb = (o, a, L1, L2) => {
    const u = dir(a[0]), j = [o[0] + u[0] * L1, o[1] + u[1] * L1];
    const l = dir(a[0] + a[1]);
    return [o, j, [j[0] + l[0] * L2, j[1] + l[1] * L2]];
  };
  return {
    hip, neck, head, sh, td,
    aF: limb(sh, p.aF, LIMB.upper, LIMB.fore), aB: limb(sh, p.aB, LIMB.upper, LIMB.fore),
    lF: limb(hip, p.lF, LIMB.thigh, LIMB.shin), lB: limb(hip, p.lB, LIMB.thigh, LIMB.shin),
  };
}
function poseDrop(p, sk) { return p.lying ? 10 : Math.max(sk.lF[2][1], sk.lB[2][1], 30); }

// Converts a local skeleton point into world space for a given fighter.
function jointWorld(f, pt) {
  const sk = skeleton(f.pose), drop = poseDrop(f.pose, sk), s = f.scale;
  return { x: f.x + pt(sk)[0] * f.facing * s, y: f.y + (pt(sk)[1] - drop) * s };
}
const handPos = f => jointWorld(f, sk => sk.aF[2]);
const headPos = f => jointWorld(f, sk => sk.head);

// Draws a stickman. o: { white, alpha, tint, fighter, k (extra scale), outline }
function drawStickman(ctx, def, pose, x, y, facing, o = {}) {
  const s = (def.scale || 1) * (o.k || 1), lk = def.look, sk = skeleton(pose);
  if (!lk._sh) lk._sh = { top: U.shade(lk.top, -0.32), pants: U.shade(lk.pants, -0.32), skin: U.shade(lk.skin, -0.2) };
  const tinted = o.white || o.tint;
  const col = c => (o.white ? '#ffffff' : o.tint ? o.tint : c);
  const OL = tinted ? (o.white ? '#ffffff' : o.tint) : (o.outline || '#07070c');
  const drop = poseDrop(pose, sk);
  ctx.save();
  ctx.translate(x, y); ctx.scale(facing * s, s); ctx.translate(0, -drop);
  if (pose.rot) ctx.rotate(pose.rot * DEG);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const limb = (pts, color, w) => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[2][0], pts[2][1]);
    if (!tinted) { ctx.strokeStyle = OL; ctx.lineWidth = w + 4; ctx.stroke(); }
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  };
  const dot = (p, r, color) => {
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.283); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = OL; ctx.stroke();
  };
  const g = { ctx, sk, o, col, OL, dot, limb, def };
  if (def.drawBack) def.drawBack(g);
  limb(sk.aB, col(lk._sh.top), 7); dot(sk.aB[2], 4.5, col(lk._sh.skin));
  limb(sk.lB, col(lk._sh.pants), 8); dot(sk.lB[2], 5, col(lk.shoe || '#15151b'));
  // torso
  const len = Math.hypot(sk.neck[0], sk.neck[1]) || 1, px = -sk.neck[1] / len, py = sk.neck[0] / len;
  const hw = def.hipW || 9, sw = def.shoulderW || 13;
  ctx.beginPath();
  ctx.moveTo(px * hw, py * hw); ctx.lineTo(-px * hw, -py * hw);
  ctx.lineTo(sk.sh[0] - px * sw, sk.sh[1] - py * sw); ctx.lineTo(sk.sh[0] + px * sw, sk.sh[1] + py * sw);
  ctx.closePath(); ctx.fillStyle = col(lk.top); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OL; ctx.stroke();
  if (def.drawTorso) def.drawTorso(g);
  limb(sk.lF, col(lk.pants), 8); dot(sk.lF[2], 5, col(lk.shoe || '#15151b'));
  // head
  if (def.drawHead) def.drawHead(g);
  else {
    const [hx, hy] = sk.head;
    ctx.beginPath(); ctx.arc(hx, hy, LIMB.headR, 0, 6.283); ctx.fillStyle = col(lk.skin); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = OL; ctx.stroke();
    if (!tinted) {
      ctx.fillStyle = lk.eye || '#1a1a22';
      ctx.fillRect(hx + 5, hy, 3, 4); ctx.fillRect(hx + 11, hy, 2.5, 4);
    }
    if (def.drawHair) def.drawHair(g, hx, hy, LIMB.headR);
  }
  limb(sk.aF, col(lk.top), 7); dot(sk.aF[2], 4.5, col(lk.skin));
  if (def.drawWeapon) def.drawWeapon(g);
  ctx.restore();
}

/* ---------------------------------------------------------------- Moves */

// Builds a fighter's basic/heavy/air moves from its melee profile.
function buildMoves(def) {
  const m = def.melee || {}, p = m.power || 1, r = m.reach || 0;
  const sword = m.weapon === 'sword', claw = m.weapon === 'claw';
  const swing = sword ? { color: '#cfe8ff', r: 78 + r } : claw ? { color: '#ff5a6a', r: 64 + r } : null;
  const sfx = sword ? 'swish' : 'whoosh';
  const moves = {
    basic1: { id: 'basic1', kind: 'basic', startup: 4, active: 3, recovery: 10, hitbox: { x: 4, y: -120, w: 58 + r, h: 34 },
      hit: { dmg: 26 * p, kb: 2.5, stun: 18, fx: claw || sword ? 'slash' : null }, poses: sword || claw ? ['slashW', 'slash'] : ['jabW', 'jab'],
      chain: 'basic2', sfx, swing },
    basic2: { id: 'basic2', kind: 'basic', startup: 5, active: 3, recovery: 11, lunge: 3, hitbox: { x: 4, y: -120, w: 60 + r, h: 34 },
      hit: { dmg: 30 * p, kb: 3, stun: 20, fx: claw || sword ? 'slash' : null }, poses: sword || claw ? ['slash2W', 'slash2'] : ['jabW', 'cross'],
      chain: 'basic3', sfx, swing: swing && { ...swing, a0: 60, a1: -70 } },
    basic3: { id: 'basic3', kind: 'basic', startup: 7, active: 4, recovery: 18, lunge: 5, hitbox: { x: 0, y: -100, w: 72 + r * 0.5, h: 46 },
      hit: { dmg: 44 * p, kb: 9, kby: -6, stun: 26, hitstop: 5 }, poses: ['kickW', 'kick'], sfx: 'whoosh' },
    heavy: { id: 'heavy', kind: 'heavy', startup: 13, active: 4, recovery: 22, lunge: 7, hitbox: { x: 0, y: -138, w: 74 + r, h: 64 },
      hit: { dmg: 80 * p, kb: 12, kby: -9, launch: true, hitstop: 8, shake: 6, sfx: 'heavy', fx: claw || sword ? 'slash' : null },
      poses: sword || claw ? ['slashW', 'slash'] : ['heavyW', 'heavy'], sfx, swing: swing && { ...swing, r: swing.r + 12, w: 10 } },
    air: { id: 'air', kind: 'air', startup: 5, active: 7, recovery: 12, keepVel: true, hitbox: { x: 0, y: -85, w: 64 + r * 0.5, h: 52 },
      hit: { dmg: 34 * p, kb: 5, kby: -3, stun: 18 }, poses: ['kickW', 'kick'], sfx: 'whoosh' },
  };
  if (def.moveOverrides) for (const k in def.moveOverrides) moves[k] = Object.assign({}, moves[k], def.moveOverrides[k]);
  return moves;
}

/* ---------------------------------------------------------------- Fighter */

class Fighter {
  constructor(def, side, input) {
    this.def = def; this.side = side; this.input = input;
    if (input && input.bind) input.bind(this);
    this.baseDef = def;
    this.maxHp = def.hp || 1000;
    this.setDef(def);
    this.wins = 0;
    this.tag = side === 0 ? 'P1' : 'P2';
    this.resetRound();
  }

  setDef(def) {
    this.def = def; this.scale = def.scale || 1;
    this.speed = 5.4 * (def.speed || 1);
    this.moves = buildMoves(def);
    this.abilities = def.abilities || [];
  }
  // Temporarily become another fighter (Yuji letting Sukuna take over).
  transform(def, frames) { this.savedCd = this.cd; this.cd = [0, 0, 0, 0, 0, 0, 0, 0]; this.setDef(def); this.takeoverT = frames; }
  revert() { this.setDef(this.baseDef); this.cd = this.savedCd || [0, 0, 0, 0, 0, 0, 0, 0]; this.takeoverT = 0; }

  resetRound() {
    if (this.def !== this.baseDef) this.setDef(this.baseDef);
    this.takeoverT = 0; this.usedTakeover = false; this.split = null;
    this.x = this.side === 0 ? 420 : W - 420; this.y = FLOOR; this.prevY = FLOOR;
    this.vx = 0; this.vy = 0; this.facing = this.side === 0 ? 1 : -1; this.onGround = true;
    this.hp = this.maxHp; this.hpTrail = this.maxHp; this.ce = 50; this.guard = 100;
    this.state = 'idle'; this.stateT = 0; this.move = null; this.mf = 0; this.mvars = {};
    this.hitList = new Set(); this.moveHit = false;
    this.hitstun = 0; this.stun = 0; this.frozen = false; this.stunImmune = 0; this.invuln = 0; this.juggles = 0;
    this.combo = 0; this.comboShow = 0; this.comboShowT = 0;
    this.cd = [0, 0, 0, 0, 0, 0, 0, 0]; this.dashCd = 0; this.dashT = 0; this.airDash = true; this.jumps = 0; this.dropT = 0;
    this.buf = null; this.bufT = 0; this.flashT = 0; this.noCeT = 0; this.anim = Math.random() * 100;
    this.pose = poseCopy(POSES.idle); this.buffs = {}; this.victory = false; this.eyesOpen = 0;
    this.copied = null; this.adapt = {}; this.adaptSpin = 0; this.slowT = 0;
  }

  get midY() { return this.y - 80 * this.scale; }
  hurtbox() {
    const s = this.scale;
    if (this.state === 'down' || this.state === 'ko') return { x: this.x - 55 * s, y: this.y - 28 * s, w: 110 * s, h: 28 * s };
    return { x: this.x - 21 * s, y: this.y - 142 * s, w: 42 * s, h: 142 * s };
  }
  attackRect(b) {
    const s = this.scale;
    return { x: this.facing === 1 ? this.x + b.x * s : this.x - (b.x + b.w) * s, y: this.y + b.y * s, w: b.w * s, h: b.h * s };
  }
  inHitState() { return this.state === 'hit' || this.state === 'launch' || this.state === 'stun'; }
  isFree() { return this.state === 'idle' || this.state === 'walk' || this.state === 'air' || this.state === 'block'; }
  setState(s) { this.state = s; this.stateT = 0; }
  summonMult() { return this.def.summonMult || 1; }
  slowFactor() { const d = World.domain; return d && d.slowOpp && d.owner !== this ? 0.55 : 1; }
  damageMult(h) {
    let m = 1;
    if (this.def.dmgMult) m *= this.def.dmgMult(this, h);
    if (this.buffs.rika) m *= 1.2;
    return m;
  }
  ceRegenRate() {
    let r = 5.5 * (this.def.ceRegen || 1);
    if (this.buffs.regen) r *= 2;
    return r / 60;
  }
  gainCe(n) { this.ce = Math.min(100, this.ce + n); }
  consume() { this.buf = null; this.bufT = 0; }

  update() {
    this.anim++;
    if (this.invuln > 0) this.invuln--;
    if (this.flashT > 0) this.flashT--;
    if (this.noCeT > 0) this.noCeT--;
    if (this.dashCd > 0) this.dashCd--;
    if (this.stunImmune > 0) this.stunImmune--;
    if (this.dropT > 0) this.dropT--;
    if (this.eyesOpen > 0) this.eyesOpen--;
    for (let i = 0; i < this.cd.length; i++) if (this.cd[i] > 0) this.cd[i]--;
    for (const k in this.buffs) if (--this.buffs[k] <= 0) delete this.buffs[k];
    if (this.takeoverT > 0 && --this.takeoverT <= 0 && this.state !== 'ko') {
      this.revert();
      FX.smoke(this.x, this.y - 80, '#3a0010', 10, 30, 20); FX.text(this.x, this.y - 190, 'YUJI REGAINS CONTROL', '#ff9aa8', 22, 60);
    }
    if (this.state !== 'ko' && World.active) this.gainCe(this.ceRegenRate());
    if (this.state !== 'block') this.guard = Math.min(100, this.guard + 0.3);
    if (this.hpTrail > this.hp) this.hpTrail = Math.max(this.hp, this.hpTrail - 3.5);
    if (this.bufT > 0 && --this.bufT === 0) this.buf = null;
    if (this.input && World.active && this.state !== 'ko') {
      const p = this.input.pressed;
      for (const k of ['basic', 'heavy', 's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 'dash']) if (p[k]) { this.buf = k; this.bufT = 10; }
    }
    if (this.def.passiveTick) this.def.passiveTick(this);
    // Gojo's Infinity: while he blocks, everything near him runs at half speed.
    const opp = World.opp(this);
    if (opp && opp.def.infinityBlock && opp.state === 'block' && this.state !== 'ko' && Math.abs(opp.x - this.x) < 320) {
      if (++this.slowT % 2) {
        if (this.slowT % 12 === 1) FX.infinity(opp);
        this.updatePose();
        return;
      }
    }
    this.stateT++;
    switch (this.state) {
      case 'ko':
        this.friction(0.9);
        if (this.split && ++this.split.t < 80 && this.split.t % 2 === 0) {
          const cy = this.y - 72 * this.scale;
          FX.blood(this.x, cy, 3, -this.split.dir, 4);
          FX.blood(this.x + this.split.dir * Math.min(this.split.t, 50) * 1.4, cy + Math.min(70, this.split.t ** 2 * 0.04), 3, this.split.dir, 4);
        }
        break;
      case 'stun':
        this.stun--; this.friction(0.8);
        if (this.stun <= 0) { this.frozen = false; this.stunImmune = 50; this.setState(this.onGround ? 'idle' : 'air'); }
        break;
      case 'hit':
        this.hitstun--; this.friction(0.86);
        if (this.hitstun <= 0) this.setState(this.onGround ? 'idle' : 'air');
        break;
      case 'launch':
        if (this.onGround && this.stateT > 3) {
          this.setState('down'); this.invuln = 52; this.juggles = 0; this.vx *= 0.4;
          FX.dust(this.x, this.y, 10); Sound.play('land');
        }
        break;
      case 'down':
        this.friction(0.8);
        if (this.stateT > 36) { this.setState('idle'); this.invuln = 14; }
        break;
      case 'dash': this.updateDash(); break;
      case 'move': this.updateMove(); break;
      default: this.control();
    }
    this.physics();
    this.updatePose();
  }

  control() {
    const inp = World.active && this.input ? this.input : NULL_INPUT;
    const h = inp.held, p = inp.pressed, opp = World.opp(this);
    if (this.onGround && opp && opp.state !== 'ko') this.facing = opp.x >= this.x ? 1 : -1;
    if (this.buf && this.useBuffer()) return;
    const slow = this.slowFactor();
    if (h.down && this.onGround) {
      if (p.up && this.y < FLOOR - 1) { this.dropT = 14; this.onGround = false; this.state = 'air'; return; }
      this.state = 'block'; this.vx *= 0.6; return;
    }
    const dir = (h.right ? 1 : 0) - (h.left ? 1 : 0), sp = this.speed * slow;
    if (this.onGround) this.vx = U.lerp(this.vx, dir * sp, 0.3);
    else this.vx = U.clamp(this.vx + dir * 0.6, -sp * 1.15, sp * 1.15);
    if (p.up && this.jumps < 2) {
      this.vy = -(this.jumps ? 14.5 : 17) * (slow < 1 ? 0.85 : 1);
      if (this.onGround) FX.dust(this.x, this.y, 4);
      else FX.ring(this.x, this.y, 'rgba(255,255,255,0.7)', 30, 12, 2);
      this.jumps++; this.onGround = false; Sound.play('jump');
    }
    this.state = this.onGround ? (dir ? 'walk' : 'idle') : 'air';
  }

  useBuffer() {
    const b = this.buf;
    if (b === 'dash') return this.tryDash();
    if (b === 'basic') { this.consume(); this.startMove(this.onGround ? this.moves.basic1 : this.moves.air); return true; }
    if (b === 'heavy') { this.consume(); this.startMove(this.moves.heavy); return true; }
    if (b[0] === 's') { const ok = this.tryAbility(+b[1]); if (!ok) this.consume(); return ok; }
    return false;
  }

  canUse(i) {
    const a = this.abilities[i];
    if (!a || this.cd[i] > 0 || this.ce < a.cost) return false;
    if ((a.ult || a.ground) && !this.onGround) return false;
    if (a.getMove && !a.getMove(this)) return false;
    return true;
  }

  tryAbility(i) {
    const a = this.abilities[i];
    if (!a) return false;
    if (this.cd[i] > 0) return false;
    if (this.ce < a.cost) { this.noCeT = 24; return false; }
    if ((a.ult || a.ground) && !this.onGround) return false;
    const mv = a.getMove ? a.getMove(this) : a.move;
    if (!mv) return false;
    this.consume();
    this.ce -= a.cost; this.cd[i] = a.cd;
    if (a.onUse) a.onUse(this);
    this.startMove(mv);
    this.mvars.abil = i;
    // Yuta's Copy remembers the last technique used against him.
    const o = World.opp(this);
    if (o && o.def.copy && !a.ult && !a.copy && !a.noCopy) o.copied = a;
    return true;
  }

  tryDash() {
    if (this.dashCd > 0 || (!this.onGround && !this.airDash)) return false;
    this.consume();
    const h = World.active && this.input ? this.input.held : {};
    const dir = h.right ? 1 : h.left ? -1 : this.facing;
    this.interruptMove();
    this.dashT = 12; this.dashCd = 34; this.invuln = Math.max(this.invuln, 10);
    if (!this.onGround) this.airDash = false;
    if (this.def.dash === 'teleport') {
      FX.ring(this.x, this.y - 80, '#8fdcff', 50, 14, 3); FX.spark(this.x, this.y - 80, '#bfeaff', 10, 5);
      this.x += dir * 200; this.clampWalls();
      this.vx = dir * 2; this.vy = Math.min(this.vy, 0) * 0.3; this.dashT = 8;
      FX.ring(this.x, this.y - 80, '#8fdcff', 50, 14, 3); Sound.play('teleport');
    } else {
      this.vx = dir * 15.5; if (!this.onGround) this.vy = -2;
      Sound.play('dash'); FX.dust(this.x, this.y, 5);
    }
    this.setState('dash');
    return true;
  }
  updateDash() {
    this.dashT--;
    if (this.def.dash !== 'teleport') {
      if (this.dashT % 2 === 0) FX.ghost(this);
      if (!this.onGround) this.vy = Math.min(this.vy, 1.5);
      if (this.dashT < 4) this.vx *= 0.7;
    }
    if (this.dashT <= 0) this.setState(this.onGround ? 'idle' : 'air');
  }

  startMove(m) {
    this.move = m; this.mf = 0; this.mvars = {};
    this.setState('move');
    this.hitList.clear(); this.moveHit = false;
    if (this.onGround) this.vx *= 0.3;
    if (m.sfx) Sound.play(m.sfx);
    if (m.onStart) m.onStart(this, World.opp(this));
  }
  interruptMove() {
    if (!this.move) return;
    const m = this.move;
    this.move = null;
    if (m.onCancel) m.onCancel(this);
  }
  endMove() {
    const m = this.move;
    this.move = null;
    if (m && m.onEnd) m.onEnd(this);
    if (this.state === 'move') this.setState(this.onGround ? 'idle' : 'air');
  }

  updateMove() {
    const m = this.move, fr = this.mf, opp = World.opp(this);
    if (m.lunge && fr === Math.max(0, m.startup - 3)) this.vx = this.facing * m.lunge * (this.onGround ? 1 : 0.6);
    if (m.swing && fr === m.startup) FX.arc(this, m.swing);
    if (m.onFrame) m.onFrame(this, fr, opp);
    if (this.move !== m) return;
    if (m.hitbox && fr >= m.startup && fr < m.startup + m.active) this.checkMelee(m, opp);
    if (this.onGround && !m.keepVel) this.friction(0.85);
    this.mf++;
    const total = m.total || m.startup + m.active + m.recovery;
    const cancelAt = m.cancelAt ?? m.startup + m.active;
    if (this.buf && this.mf >= cancelAt && World.active && m.kind !== 'ult' && m.kind !== 'special') {
      const b = this.buf;
      if (b === 'basic' && m.chain) { this.consume(); this.startMove(this.moves[m.chain]); return; }
      if (this.moveHit) {
        if (b === 'heavy' && m.kind === 'basic') { this.consume(); this.startMove(this.moves.heavy); return; }
        if (b[0] === 's' && this.tryAbility(+b[1])) return;
        if (b === 'dash' && this.tryDash()) return;
      }
    }
    if (this.mf >= total) this.endMove();
  }

  checkMelee(m, opp) {
    if (!opp) return;
    if (m.hitEvery && (this.mf - m.startup) % m.hitEvery === 0) this.hitList.clear();
    if (this.hitList.has(opp)) return;
    const hb = this.attackRect(m.hitbox), hu = opp.hurtbox();
    if (!U.overlap(hb, hu)) return;
    this.hitList.add(opp);
    const spec = m.hitFn ? m.hitFn(this, opp) : m.hit;
    const x = U.clamp(this.x + this.facing * (m.hitbox.x + m.hitbox.w * 0.7) * this.scale, hu.x, hu.x + hu.w);
    const y = U.clamp(hb.y + hb.h / 2, hu.y + 10, hu.y + hu.h - 10);
    const res = Combat.hit(this, opp, Object.assign({ melee: true, dir: this.facing, x, y }, spec));
    if (res !== 'miss') { this.moveHit = true; if (res === 'hit' && m.onHit) m.onHit(this, opp); }
  }

  applyStun(frames, freeze = false, force = false) {
    if (this.state === 'ko') return;
    if (this.stunImmune > 0 && !force) frames = Math.floor(frames * 0.4);
    this.interruptMove();
    this.stun = Math.max(this.stun, frames);
    this.frozen = freeze;
    if (this.state !== 'stun') this.setState('stun');
  }

  knockOut(dir, h = {}) {
    this.interruptMove();
    this.stun = 0; this.frozen = false;
    this.setState('ko');
    if (h.cleave) {
      // Cleave finishes by cutting the body clean in half.
      this.split = { t: 0, dir };
      this.vx = dir * 1.5;
      FX.blood(this.x, this.y - 72 * this.scale, 40, dir, 9);
    } else { this.vx = dir * 9; this.vy = -11; this.onGround = false; }
    FX.slow(80, 0.25); FX.flash('#fff', 0.6); FX.shake(14);
    Sound.play('ko');
    if (World.onKO) World.onKO(this);
  }

  drawSplit(ctx) {
    const sp = this.split, cut = this.y - 72 * this.scale, t = sp.t, o = { fighter: this };
    ctx.save(); ctx.beginPath(); ctx.rect(this.x - 300, cut, 600, 400); ctx.clip();
    drawStickman(ctx, this.def, this.pose, this.x, this.y, this.facing, o);
    ctx.restore();
    const ox = sp.dir * Math.min(t, 50) * 1.4, oy = Math.min(70 * this.scale, t * t * 0.04), rot = sp.dir * Math.min(1.5, t * 0.035);
    ctx.save(); ctx.translate(this.x + ox, cut + oy); ctx.rotate(rot); ctx.translate(-this.x, -cut);
    ctx.beginPath(); ctx.rect(this.x - 300, cut - 400, 600, 400); ctx.clip();
    drawStickman(ctx, this.def, this.pose, this.x, this.y, this.facing, o);
    ctx.restore();
    if (World.settings.blood) {
      ctx.fillStyle = '#9a0018';
      ctx.beginPath(); ctx.ellipse(this.x, cut, 14 * this.scale, 4, 0, 0, 6.283); ctx.fill();
    }
  }

  friction(k) { if (this.onGround) this.vx *= k; else this.vx *= 0.99; }

  clampWalls() {
    const m = 22 * this.scale;
    if (this.x < World.left + m) {
      this.x = World.left + m;
      if (this.state === 'launch' && this.vx < -6) { this.vx = -this.vx * 0.4; FX.dust(this.x, this.y - 60, 6); FX.shake(5); } else if (this.vx < 0) this.vx = 0;
    } else if (this.x > World.right - m) {
      this.x = World.right - m;
      if (this.state === 'launch' && this.vx > 6) { this.vx = -this.vx * 0.4; FX.dust(this.x, this.y - 60, 6); FX.shake(5); } else if (this.vx > 0) this.vx = 0;
    }
  }

  physics() {
    this.prevY = this.y;
    if (this.frozen) { this.vx *= 0.5; this.vy = 0; }
    else if (!this.onGround) this.vy = Math.min(this.vy + GRAVITY, 22);
    this.x += this.vx; this.y += this.vy;
    let landed = false;
    if (this.y >= FLOOR) { this.y = FLOOR; landed = true; }
    else if (this.vy >= 0 && this.dropT <= 0 && !this.frozen) {
      for (const p of World.platforms) {
        if (this.x > p.x && this.x < p.x + p.w && this.prevY <= p.y + 0.5 && this.y >= p.y) { this.y = p.y; landed = true; break; }
      }
    }
    if (landed) {
      if (!this.onGround && this.vy > 8 && this.state !== 'launch') FX.dust(this.x, this.y, 4);
      this.onGround = true; this.vy = 0; this.jumps = 0; this.airDash = true;
    } else if (this.onGround) {
      const sup = this.y >= FLOOR - 0.5 || World.platforms.some(p => this.x > p.x && this.x < p.x + p.w && Math.abs(this.y - p.y) < 1);
      if (!sup || this.vy < 0) this.onGround = false;
    }
    this.clampWalls();
  }

  updatePose() {
    let t = POSES.idle, k = 0.3;
    switch (this.state) {
      case 'idle': {
        t = poseCopy(this.def.idlePose ? POSES[this.def.idlePose] : POSES.idle);
        const b = Math.sin(this.anim * 0.08);
        t.lean += b * 2; t.aF[1] += b * 6; t.aB[1] += b * 5;
        break;
      }
      case 'walk': {
        const c = (Math.sin(this.anim * 0.26) + 1) / 2;
        t = poseLerpInto(poseCopy(POSES.walkA), POSES.walkB, c);
        k = 0.5; break;
      }
      case 'air': t = this.vy < 0 ? POSES.jump : POSES.fall; break;
      case 'block': t = POSES.block; k = 0.5; break;
      case 'move': {
        const m = this.move, fr = this.mf;
        if (m.getPose) { t = m.getPose(this, fr); k = m.snapPose ? 1 : 0.5; }
        else {
          const [wp, sp] = m.poses || ['castW', 'cast'];
          const end = m.startup + m.active + (m.recovery || 0) * 0.5;
          t = fr < m.startup ? POSES[wp] : fr < end ? POSES[sp] : POSES.idle;
          k = fr >= m.startup && fr < m.startup + m.active ? 0.7 : 0.45;
        }
        break;
      }
      case 'hit': t = POSES.hurt; k = 0.6; break;
      case 'launch': t = POSES.launch; break;
      case 'down': t = POSES.down; k = 0.4; break;
      case 'ko': t = this.split ? POSES.stun : this.onGround ? POSES.down : POSES.launch; break;
      case 'stun': {
        t = poseCopy(POSES.stun);
        if (!this.frozen) t.lean += Math.sin(this.anim * 0.2) * 5;
        break;
      }
      case 'dash': t = POSES.dash; k = 0.5; break;
    }
    if (this.victory) { t = POSES[this.def.winPose || 'win']; k = 0.15; }
    poseLerpInto(this.pose, t, k);
  }

  draw(ctx) {
    const s = this.scale, gy = World.groundAt(this.x, this.y), hgt = Math.max(0, gy - this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(this.x, gy + 2, 30 * s * Math.max(0.4, 1 - hgt / 400), 7 * s, 0, 0, 6.283); ctx.fill();
    if (this.def.drawAura) this.def.drawAura(ctx, this);
    if (this.state === 'block') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = this.guard < 30 ? 'rgba(255,90,90,0.6)' : 'rgba(140,200,255,0.45)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(this.x, this.y - 80 * s, 62 * s, this.facing === 1 ? -1.1 : Math.PI - 1.1 + 0.0, this.facing === 1 ? 1.1 : Math.PI + 1.1); ctx.stroke();
      ctx.restore();
    }
    if (this.split) { this.drawSplit(ctx); return; }
    drawStickman(ctx, this.def, this.pose, this.x, this.y, this.facing, { white: this.flashT > 0, fighter: this });
    if (this.state === 'stun') {
      const hp = headPos(this);
      if (this.frozen) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(200,240,255,0.5)'; ctx.lineWidth = 2;
        ctx.strokeRect(this.x - 30 * s, this.y - 150 * s, 60 * s, 150 * s); ctx.restore();
      }
      for (let i = 0; i < 3; i++) {
        const a = this.anim * 0.12 + i * 2.094;
        ctx.fillStyle = '#ffe36a';
        ctx.beginPath(); ctx.arc(hp.x + Math.cos(a) * 20, hp.y - 22 + Math.sin(a) * 6, 3.5, 0, 6.283); ctx.fill();
      }
    }
  }
}

/* ---------------------------------------------------------------- Entities (projectiles, summons) */

class Entity {
  constructor(o) {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.r = 12; this.life = 60; this.age = 0;
    this.dead = false; this.layer = 'front'; this.hits = null; this.pierce = false;
    this.hitSet = new Set(); this.hitEvery = 0; this.clash = 0; this.wallKill = false; this.slowT = 0;
    Object.assign(this, o);
  }
  get target() { return World.opp(this.owner); }
  update() {
    const g = this.target;
    if (g && g.def.infinityBlock && g.state === 'block' && Math.abs(g.x - this.x) < 260 && ++this.slowT % 3) return;
    this.age++;
    if (this.tick) this.tick(this, this.target);
    if (this.dead) return;
    this.x += this.vx; this.y += this.vy;
    if (this.hits) this.collide();
    if (this.dead) return;
    if (this.wallKill && (this.x < World.left - 10 || this.x > World.right + 10)) this.kill('wall');
    else if (this.x < -200 || this.x > W + 200) this.kill('wall');
    if (this.age >= this.life) this.kill('expire');
  }
  collide() {
    const t = this.target;
    if (!t) return;
    if (this.hitEvery && this.age % this.hitEvery === 0) this.hitSet.clear();
    if (this.hitSet.has(t)) return;
    if (!U.circleRect(this.x, this.y, this.r, t.hurtbox())) return;
    const res = Combat.hit(this.owner, t, Object.assign({ dir: this.vx ? Math.sign(this.vx) : this.owner.facing, x: this.x, y: this.y, proj: true }, this.hits));
    if (res === 'miss') return;
    this.hitSet.add(t);
    if (this.onHit) this.onHit(this, t, res);
    if (!this.pierce) this.kill('hit');
  }
  kill(why) {
    if (this.dead) return;
    this.dead = true;
    if (this.onEnd) this.onEnd(this, why);
  }
  draw(ctx) { if (this.render) this.render(ctx, this); }
}

// Opposing projectiles cancel each other; the stronger one survives.
function resolveClashes() {
  const es = World.entities;
  for (let i = 0; i < es.length; i++) {
    const a = es[i];
    if (a.dead || !a.clash) continue;
    for (let j = i + 1; j < es.length; j++) {
      const b = es[j];
      if (b.dead || !b.clash || b.owner === a.owner) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r) continue;
      FX.explosion((a.x + b.x) / 2, (a.y + b.y) / 2, 40, ['#fff', '#fff3c4', '#aab']);
      Sound.play('boom');
      if (a.clash >= b.clash) b.kill('clash');
      if (b.clash >= a.clash) a.kill('clash');
      if (a.dead) break;
    }
  }
}

/* ---------------------------------------------------------------- Domain Expansions */

const Domains = {
  start(owner, spec) {
    const cur = World.domain;
    if (cur && cur.owner !== owner) {
      // Two domains collide: both shatter.
      FX.flash('#fff', 1); FX.shake(22);
      FX.banner('DOMAIN CLASH!', 'Both barriers shatter', '#ffffff', 100);
      Sound.play('clash');
      if (cur.onEnd) cur.onEnd(cur, true);
      World.domain = null;
      for (const f of World.fighters) if (f.state === 'stun') { f.stun = 1; }
      return null;
    }
    const d = Object.assign({ owner, age: 0, life: 300 }, spec);
    World.domain = d;
    if (d.onStart) d.onStart(d, World.opp(owner));
    Sound.play('domain');
    FX.flash('#fff', 0.8);
    return d;
  },
  update() {
    const d = World.domain;
    if (!d) return;
    d.age++;
    if (d.owner.state === 'ko' && d.age < d.life - 25) d.age = d.life - 25;
    if (d.tick && d.age < d.life) d.tick(d, World.opp(d.owner));
    if (d.age >= d.life) { if (d.onEnd) d.onEnd(d, false); if (World.domain === d) World.domain = null; }
  },
  alpha(d) { return Math.min(1, d.age / 25, (d.life - d.age) / 25); },
};

/* ---------------------------------------------------------------- Hit resolution */

const Combat = {
  // h: { dmg|dmgFn, kb, kby, stun, launch, stunAdd, freeze, unblockable, chip, sureHit, noScale,
  //      hitstop, shake, fx, color, sfx, type, dir, x, y, melee, proj, quiet, guardDmg }
  hit(att, tgt, h) {
    if (!tgt || tgt.state === 'ko') return 'miss';
    if (tgt.invuln > 0 && !h.sureHit) return 'miss';
    const dir = h.dir || (tgt.x >= att.x ? 1 : -1);
    const hx = h.x ?? tgt.x - dir * 15, hy = h.y ?? tgt.midY;
    let dmg = typeof h.dmgFn === 'function' ? h.dmgFn(att, tgt) : h.dmg || 0;
    dmg *= att.damageMult(h);

    // Blocking: must be facing the incoming attack.
    if (tgt.state === 'block' && !h.unblockable && tgt.facing === -dir) {
      dmg *= h.chip ?? 0.12;
      tgt.hp = Math.max(1, tgt.hp - dmg);
      tgt.guard -= h.guardDmg ?? (h.dmg || 25) * 0.42;
      tgt.vx = dir * Math.min(10, (h.kb || 3) * 0.6 + 2);
      FX.spark(hx, hy, '#9fd4ff', 7, 5, 2); FX.ring(hx, hy, '#9fd4ff', 34, 10, 3);
      Sound.play('block'); FX.hitstop(2);
      att.gainCe(0.5);
      if (tgt.guard <= 0) {
        tgt.guard = 55; tgt.applyStun(70, false, true);
        FX.text(tgt.x, tgt.y - 175 * tgt.scale, 'GUARD BREAK', '#ffd34d', 30);
        Sound.play('guardbreak'); FX.shake(8);
      }
      return 'block';
    }

    if (!tgt.inHitState()) att.combo = 0;
    att.combo++;
    att.comboShow = att.combo; att.comboShowT = 90;
    if (!h.noScale && att.combo > 2) dmg *= Math.max(0.4, 1 - (att.combo - 2) * 0.07);
    let kbMul = 1;
    if (tgt.def.onIncoming) { const r = tgt.def.onIncoming(tgt, dmg, h, att); dmg = r.dmg; kbMul = r.kb ?? 1; }
    dmg = Math.max(0, Math.round(dmg));
    tgt.hp = Math.max(0, tgt.hp - dmg);
    tgt.flashT = 4;
    att.gainCe(1.5 + dmg * 0.02); tgt.gainCe(1 + dmg * 0.02);

    FX.impact(hx, hy, h, dmg);
    Sound.play(h.sfx || (dmg >= 70 ? 'heavy' : 'hit'));
    FX.hitstop(h.hitstop ?? (dmg >= 70 ? 7 : 3));
    if (h.shake) FX.shake(h.shake); else if (dmg >= 60) FX.shake(dmg / 14);
    if (dmg > 0 && !h.quiet) FX.text(tgt.x + U.rand(-20, 20), tgt.y - 165 * tgt.scale, dmg, dmg >= 100 ? '#ffd34d' : '#ffffff', dmg >= 100 ? 26 : 18, 40);

    if (h.blood) FX.blood(hx, hy, h.blood, dir);
    if (tgt.hp <= 0) { tgt.knockOut(dir, h); return 'hit'; }

    if (h.stunAdd) { tgt.applyStun(h.stunAdd, !!h.freeze); tgt.vx = dir * (h.kb || 0) * kbMul; return 'hit'; }
    if (tgt.state === 'stun') { tgt.vx = dir * (h.kb || 0) * 0.25 * kbMul; return 'hit'; }

    tgt.interruptMove();
    tgt.vx = dir * (h.kb ?? 3) * kbMul;
    const airborne = !tgt.onGround;
    if (h.launch || airborne) {
      let vy = Math.min(h.kby ?? -5, -3);
      if (airborne) { tgt.juggles++; vy *= Math.max(0.35, 1 - tgt.juggles * 0.12); }
      tgt.vy = vy * (kbMul < 1 ? 0.7 : 1);
      tgt.onGround = false;
      tgt.setState('launch');
    } else {
      const scale = att.combo > 4 ? Math.max(0.55, 1 - (att.combo - 4) * 0.06) : 1;
      tgt.hitstun = Math.round((h.stun ?? 16) * scale);
      tgt.setState('hit');
    }
    return 'hit';
  },
};

/* ---------------------------------------------------------------- Shared drawing helpers */

function glowOrb(ctx, x, y, r, core, color, alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
  g.addColorStop(0, core); g.addColorStop(0.28, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 6.283); ctx.fill();
  ctx.restore();
}
