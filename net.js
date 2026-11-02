'use strict';
/* ==========================================================================
   net.js — online battles.
   Two browsers meet in a room on the dev server's WebSocket relay (serve.py).
   The fight runs in deterministic lockstep: both games use the same random
   seed, each side sends only its own inputs (scheduled a few frames ahead),
   and a frame is simulated only once both players' inputs for it are known.
   ========================================================================== */

const NET_KEYS = ['left', 'right', 'up', 'down', 'basic', 'heavy', 's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 'clash', 'dash'];

// Small, fast, seedable PRNG so both games roll identical "random" numbers.
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function encodeInput(c) {
  let h = 0, p = 0;
  NET_KEYS.forEach((k, i) => { if (c.held[k]) h |= 1 << i; if (c.pressed[k]) p |= 1 << i; });
  return [h, p];
}

// Feeds a fighter the input recorded for the frame currently being simulated.
class NetController {
  constructor(map) { this.map = map; this.held = {}; this.pressed = {}; }
  update() {
    const [h, p] = this.map.get(Net.lock.tick) || [0, 0];
    NET_KEYS.forEach((k, i) => { this.held[k] = !!(h & (1 << i)); this.pressed[k] = !!(p & (1 << i)); });
  }
}

const Net = {
  ws: null, role: null, code: null, inMatch: false, savedSettings: null,
  lock: { tick: 0, delay: 4, local: new Map(), remote: new Map(), rng: null, stall: 0, kb: null, hashes: new Map(), desync: false },

  url() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'; },

  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === 1) { resolve(); return; }
      let ws;
      try { ws = new WebSocket(this.url()); } catch (e) { reject(e); return; }
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('Could not reach the game server.'));
      ws.onmessage = e => { try { this.onMessage(JSON.parse(e.data)); } catch (err) { /* ignore malformed */ } };
      ws.onclose = () => { if (this.ws === ws) this.onDisconnect(); };
      this.ws = ws;
    });
  },
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
  close() {
    this.endMatch();
    const ws = this.ws; this.ws = null; this.role = null; this.code = null;
    if (ws) try { ws.close(); } catch (e) { /* already closed */ }
  },

  async create() {
    await this.connect();
    this.send({ t: 'create' });
  },
  async join(code) {
    await this.connect();
    this.send({ t: 'join', code });
  },

  onMessage(m) {
    switch (m.t) {
      case 'room': this.code = m.code; UI.onlineStatus(`Room code <b class="code">${m.code}</b><br>Share it with your opponent. Waiting for them to join…`); break;
      case 'error': UI.onlineStatus(m.msg, true); break;
      case 'start': this.role = m.role; this.code = m.code; Sound.play('confirm'); Select.open('online'); break;
      case 'sel': Select.remoteSel(m.cur, m.locked); break;
      case 'go': if (this.role === 'guest') this.begin(m); break;
      case 'i': this.lock.remote.set(m.k, m.c); break;
      case 'h': this.checkHash(m.k, m.v, false); break;
      case 'reselect': if (!this.inMatch) Select.open('online'); break;
      case 'left': this.onPeerLeft(); break;
    }
  },

  // Host decides the arena and random seed once both fighters are locked in.
  hostGo(p1, p2) {
    const cfg = { t: 'go', p1, p2, arena: U.pick(ARENAS).id, seed: (Math.random() * 2 ** 31) | 0, roundTime: World.settings.roundTime };
    this.send(cfg);
    this.begin(cfg);
  },

  begin(cfg) {
    const L = this.lock;
    L.tick = 0; L.stall = 0; L.local = new Map(); L.remote = new Map(); L.hashes = new Map(); L.desync = false;
    for (let i = 0; i < L.delay; i++) { L.local.set(i, [0, 0]); L.remote.set(i, [0, 0]); }
    L.rng = mulberry32(cfg.seed);
    L.kb = new KeyController(BINDS.solo);
    // settings that change how many random numbers are drawn must match on both sides
    this.savedSettings = Object.assign({}, World.settings);
    Object.assign(World.settings, { particles: 1, blood: true, roundTime: cfg.roundTime });
    this.inMatch = true; World.lockstep = true;
    const host = this.role === 'host';
    const roster = [
      { id: cfg.p1, team: 0, tag: host ? 'YOU' : 'P1', input: new NetController(host ? L.local : L.remote) },
      { id: cfg.p2, team: 1, tag: host ? 'P2' : 'YOU', input: new NetController(host ? L.remote : L.local) },
    ];
    this.seeded(() => Game.startMatch({ mode: 'online', roster, arena: cfg.arena, wins: 2 }));
  },

  endMatch() {
    if (!this.inMatch) return;
    this.inMatch = false; World.lockstep = false;
    if (this.savedSettings) Object.assign(World.settings, this.savedSettings);
    this.savedSettings = null;
  },

  // Runs fn with Math.random replaced by the shared seeded generator.
  seeded(fn) {
    const native = Math.random;
    Math.random = this.lock.rng;
    try { return fn(); } finally { Math.random = native; }
  },

  // Advance one lockstep frame if both inputs are ready. Returns false while waiting on the opponent.
  tryStep() {
    const L = this.lock, T = L.tick;
    if (!L.local.has(T + L.delay)) {
      L.kb.update();
      const c = encodeInput(L.kb);
      L.local.set(T + L.delay, c);
      this.send({ t: 'i', k: T + L.delay, c });
    }
    if (!L.remote.has(T)) { L.stall++; return false; }
    L.stall = 0;
    this.seeded(() => { if (World.step()) Game.update(); });
    L.local.delete(T - 30); L.remote.delete(T - 30);
    L.tick++;
    if (L.tick % 120 === 0) {
      const v = this.stateHash();
      this.send({ t: 'h', k: L.tick, v });
      this.checkHash(L.tick, v, true);
    }
    return true;
  },

  stateHash() {
    let h = 0;
    for (const f of World.fighters) h = (h * 31 + Math.round(f.x) * 7 + Math.round(f.y) * 13 + Math.round(f.hp) * 17 + Math.round(f.ce)) | 0;
    return h;
  },
  checkHash(k, v, mine) {
    const L = this.lock, e = L.hashes.get(k);
    if (!e) { L.hashes.set(k, { [mine ? 'a' : 'b']: v }); return; }
    e[mine ? 'a' : 'b'] = v;
    if (e.a !== undefined && e.b !== undefined) { if (e.a !== e.b) L.desync = true; L.hashes.delete(k); }
  },

  onPeerLeft() {
    const wasFighting = this.inMatch;
    this.endMatch();
    if (wasFighting || UI.screen === 'select') {
      Game.startDemo();
      UI.showResult({ title: 'OPPONENT LEFT', color: '#ff6a6a', sub: 'The other player disconnected.',
        buttons: [{ label: 'Online Lobby', fn: () => { this.close(); UI.openOnline(); } }, { label: 'Main Menu', fn: () => { this.close(); UI.openMenu(0); } }] });
    } else UI.onlineStatus('Your opponent left the room.', true);
  },
  onDisconnect() {
    const wasFighting = this.inMatch || this.role;
    this.ws = null; this.role = null;
    this.endMatch();
    if (wasFighting && UI.screen !== 'menu') {
      Game.startDemo();
      UI.showResult({ title: 'DISCONNECTED', color: '#ff6a6a', sub: 'Lost connection to the game server.',
        buttons: [{ label: 'Main Menu', fn: () => UI.openMenu(0) }] });
    }
  },
};
