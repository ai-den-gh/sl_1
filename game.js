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
];

const bgCache = new Map();
function arenaBackground(a) {
  const key = a.id + '@' + RS.toFixed(2);
  if (!bgCache.has(key)) {
    const c = document.createElement('canvas');
    c.width = Math.round(W * RS); c.height = Math.round(H * RS);
    const g = c.getContext('2d'); g.scale(RS, RS);
    a.draw(g);
    bgCache.set(key, c);
  }
  return bgCache.get(key);
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
    World.arena = arena; World.platforms = arena.platforms;
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
    const fs = World.fighters;
    if (fs.length === 2) { fs[0].spawnX = 420; fs[1].spawnX = W - 420; return; }
    const order = fs.slice().sort((a, b) => a.team - b.team);
    order.forEach((f, i) => { f.spawnX = Math.round(U.lerp(170, W - 170, order.length > 1 ? i / (order.length - 1) : 0.5)); });
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
    if (f.state === 'ko') continue;
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

function render() {
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  if (!World.arena) { ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H); return; }
  ctx.save();
  const sh = World.shake;
  if (sh) ctx.translate(U.rand(-sh, sh), U.rand(-sh, sh));
  ctx.drawImage(arenaBackground(World.arena), -20, -20 * H / W, W + 40, H + 40 * H / W);
  if (World.arena.fx) World.arena.fx(ctx, World.frame);
  const d = World.domain;
  if (d && d.bg) d.bg(ctx, d, Domains.alpha(d));
  for (const e of World.entities) if (e.layer === 'back') e.draw(ctx);
  const fs = World.fighters.slice().sort((p, q) => (p.state === 'move') - (q.state === 'move'));
  for (const f of fs) f.draw(ctx);
  for (const e of World.entities) if (e.layer !== 'back') e.draw(ctx);
  drawParticles(ctx);
  drawTags(ctx);
  if (World.settings.hitboxes) drawDebug(ctx);
  ctx.restore();
  if (World.flash > 0) { ctx.globalAlpha = Math.min(1, World.flash); ctx.fillStyle = World.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (World.timeScale < 1) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 760);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (Game.running && Game.mode !== 'demo') UI.drawHUD(ctx);
  UI.drawOverlays(ctx);
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
