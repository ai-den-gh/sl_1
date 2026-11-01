'use strict';
/* ==========================================================================
   ui.js — DOM screens (menu, character select, arena select, story, gallery,
   settings, controls, pause, results) and the in-battle canvas HUD.
   ========================================================================== */

const $ = s => document.querySelector(s);
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

const KEYSETS = {
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  ok: ['Enter', 'NumpadEnter', 'Space', 'KeyJ', 'Numpad1'], back: ['Escape', 'Backspace', 'KeyK', 'Numpad2'],
};
const keyIs = (e, k) => KEYSETS[k].includes(e.code);

const DIFFS = [{ name: 'Easy', v: 0.22 }, { name: 'Normal', v: 0.5 }, { name: 'Hard', v: 0.75 }, { name: 'Cursed', v: 0.95 }];
const KEY_LABELS = { p1: ['U', 'I', 'O', 'L', 'H', 'G', 'Y', 'T'], p2: ['4', '5', '6', '7', '8', '9', '3', '.'], cpu: ['', '', '', '', '', '', '', ''] };

const Store = {
  get(k, d) { try { const v = localStorage.getItem('jjkcc.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('jjkcc.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};

/* ---------------------------------------------------------------- canvas previews */

function prepCanvas(c, lw, lh) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(lw * dpr); c.height = Math.round(lh * dpr);
  c._lw = lw; c._lh = lh;
  return c.getContext('2d');
}

function drawPortrait(ctx, def, cx, cy, r, facing = 1) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283);
  const g = ctx.createRadialGradient(cx, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, U.shade(def.color, -0.15)); g.addColorStop(1, U.shade(def.color, -0.75));
  ctx.fillStyle = g; ctx.fill(); ctx.clip();
  const pose = POSES.idle, sk = skeleton(pose), drop = poseDrop(pose, sk), s = def.scale || 1;
  const k = r / 26 / s;
  drawStickman(ctx, def, pose, cx - sk.head[0] * k * s * facing, cy + r * 0.12 - (sk.head[1] - drop) * k * s, facing, { k });
  ctx.restore();
  ctx.save(); ctx.strokeStyle = def.color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.stroke(); ctx.restore();
}

const DEMO_SEQ = [['idle', 60], ['jabW', 5], ['jab', 10], ['jabW', 4], ['cross', 10], ['kickW', 6], ['kick', 14], ['idle', 30],
  ['castW', 14], ['cast', 24], ['idle', 30], ['heavyW', 12], ['heavy', 16], ['idle', 30], ['slashW', 10], ['slash', 16], ['idle', 30], ['sign', 50], ['win', 50]];

class Preview {
  constructor(canvas, def, o = {}) {
    this.c = canvas; this.def = def; this.o = o;
    this.pose = poseCopy(POSES.idle); this.t = Math.random() * 100; this.si = 0; this.st = 0;
  }
  draw() {
    const c = this.c, ctx = c.getContext('2d'), k = c.width / c._lw;
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, c._lw, c._lh);
    this.t++;
    let target = POSES[this.o.pose || 'idle'];
    if (this.o.demo) {
      if (++this.st > DEMO_SEQ[this.si][1]) { this.st = 0; this.si = (this.si + 1) % DEMO_SEQ.length; }
      target = POSES[DEMO_SEQ[this.si][0]];
    }
    const tp = poseCopy(target);
    if (target === POSES.idle) { const b = Math.sin(this.t * 0.08); tp.lean += b * 2; tp.aF[1] += b * 6; tp.aB[1] += b * 5; }
    poseLerpInto(this.pose, tp, this.o.demo ? 0.4 : 0.2);
    const ds = this.def.scale || 1, s = (this.o.scale || 2) * Math.min(1, 1.1 / ds);
    const x = c._lw / 2, y = c._lh - 16;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(x, y + 2, 32 * s * ds, 6 * s, 0, 0, 6.283); ctx.fill();
    if (this.o.glow) {
      const g = ctx.createRadialGradient(x, y - 70 * s, 10, x, y - 70 * s, 130 * s);
      g.addColorStop(0, U.shade(this.def.color, -0.3).replace('rgb', 'rgba').replace(')', ',0.55)')); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, c._lw, c._lh);
    }
    drawStickman(ctx, this.def, this.pose, x, y, this.o.facing || 1, { k: s });
  }
}

/* ---------------------------------------------------------------- UI core */

const UI = {
  screen: null, nav: [], navIdx: 0, previews: [], back: null, ann: null,

  init() {
    this.buildMenu(); this.buildControls(); this.buildPause();
    document.addEventListener('mousedown', () => Sound.init());
    window.addEventListener('blur', () => { if (!this.screen && Game.canPause()) Game.pause(); });
  },

  show(id, opts = {}) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + id));
    this.screen = id || null;
    this.back = opts.back || null;
    const scr = id && $('#scr-' + id);
    this.nav = scr ? Array.from(scr.querySelectorAll('.nav')) : [];
    this.nav.forEach((b, i) => { b.onmouseenter = () => this.focus(i, true); });
    this.focus(opts.focus || 0, true);
    this.previews = this.previews.filter(p => p.c.isConnected);
  },

  focus(i, silent) {
    if (!this.nav.length) return;
    this.navIdx = (i + this.nav.length) % this.nav.length;
    this.nav.forEach((b, j) => b.classList.toggle('focus', j === this.navIdx));
    const b = this.nav[this.navIdx];
    if (!silent) Sound.play('select');
    if (b.onfocusnav) b.onfocusnav();
  },

  onKey(e) {
    if (!this.screen) {
      if ((e.code === 'Escape' || e.code === 'KeyP') && Game.canPause()) Game.pause();
      return;
    }
    if (this.screen === 'select') { Select.key(e); return; }
    const cur = this.nav[this.navIdx];
    const adjust = cur && cur.onadjust;
    if (keyIs(e, 'up') || (!adjust && keyIs(e, 'left'))) { e.preventDefault(); this.focus(this.navIdx - 1); }
    else if (keyIs(e, 'down') || (!adjust && keyIs(e, 'right'))) { e.preventDefault(); this.focus(this.navIdx + 1); }
    else if (adjust && keyIs(e, 'left')) { cur.onadjust(-1); Sound.play('select'); }
    else if (adjust && keyIs(e, 'right')) { cur.onadjust(1); Sound.play('select'); }
    else if (keyIs(e, 'ok')) { e.preventDefault(); if (cur) cur.click(); }
    else if (keyIs(e, 'back') && this.back) { e.preventDefault(); Sound.play('back'); this.back(); }
  },

  addPreview(canvas, def, o) { const p = new Preview(canvas, def, o); this.previews.push(p); return p; },
  renderPreviews() {
    for (const p of this.previews) if (p.c.isConnected && p.c.closest('.screen.active')) p.draw();
  },

  /* ---------------- main menu */
  buildMenu() {
    const s = $('#scr-menu');
    s.innerHTML = `
      <div class="menu-wrap">
        <div class="logo">
          <div class="logo-kanji">呪術廻戦</div>
          <div class="logo-main">JUJUTSU KAISEN</div>
          <div class="logo-sub"><span>CURSED</span> CLASH</div>
        </div>
        <nav class="menu-list">
          <button class="nav" data-act="story"><b>Story Mode</b><small>Five chapters against AI curses &amp; sorcerers</small></button>
          <button class="nav" data-act="versus"><b>Two Player Versus</b><small>Local battle on one keyboard</small></button>
          <button class="nav" data-act="cpu"><b>Versus CPU</b><small>Quick match against the AI</small></button>
          <button class="nav" data-act="gallery"><b>Character Gallery</b><small>Techniques, passives &amp; cursed spirits</small></button>
          <button class="nav" data-act="controls"><b>Controls</b><small>Key bindings for both players</small></button>
          <button class="nav" data-act="settings"><b>Settings</b><small>Audio, effects &amp; round rules</small></button>
        </nav>
        <div class="menu-foot">W/S or ↑/↓ to move · Enter or J to select · Esc to go back</div>
      </div>`;
    s.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => this.menuAct(b.dataset.act); });
  },
  menuAct(a) {
    Sound.init(); Sound.play('confirm');
    if (a === 'story') this.openStory();
    else if (a === 'versus') Select.open('versus');
    else if (a === 'cpu') Select.open('cpu');
    else if (a === 'gallery') this.openGallery();
    else if (a === 'controls') this.show('controls', { back: () => this.openMenu(5 - 1) });
    else if (a === 'settings') this.openSettings();
  },
  openMenu(focus = 0) { this.show('menu', { focus }); },

  /* ---------------- arena select */
  openArena(onPick, onBack) {
    const s = $('#scr-arena');
    s.innerHTML = `<div class="panel-wrap"><h2 class="scr-title">SELECT ARENA</h2><div class="arena-grid"></div>
      <div class="menu-foot">←/→ to choose · Enter or J to fight · Esc to go back</div></div>`;
    const grid = s.querySelector('.arena-grid');
    const opts = ARENAS.map(a => a).concat([{ id: 'random', name: 'Random', sub: 'Let fate decide' }]);
    opts.forEach(a => {
      const b = el('button', 'nav arena-card');
      const c = el('canvas');
      const ctx = prepCanvas(c, 320, 180);
      if (a.id === 'random') {
        ctx.setTransform(c.width / 320, 0, 0, c.width / 320, 0, 0);
        ctx.fillStyle = '#120c20'; ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = '#b59bff'; ctx.font = '900 80px Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 160, 92);
      } else {
        ctx.drawImage(arenaBackground(a), 0, 0, c.width, c.height);
      }
      b.appendChild(c);
      b.appendChild(el('div', 'arena-name', `<b>${a.name}</b><small>${a.sub}</small>`));
      b.onclick = () => { Sound.play('confirm'); onPick(a.id === 'random' ? U.pick(ARENAS).id : a.id); };
      grid.appendChild(b);
    });
    this.show('arena', { back: onBack });
  },

  /* ---------------- story */
  openStory(focus = 0) {
    const s = $('#scr-story');
    const prog = Story.progress();
    s.innerHTML = `<div class="panel-wrap"><h2 class="scr-title">STORY MODE</h2><div class="story-grid"></div>
      <div class="menu-foot">Choose a chapter · Enter or J to begin · Esc to go back</div></div>`;
    const grid = s.querySelector('.story-grid');
    STORY.forEach((ch, i) => {
      const hero = CHARS[ch.hero], done = prog[ch.id] || 0, total = ch.fights.length;
      const b = el('button', 'nav story-card' + (done >= total ? ' cleared' : ''));
      b.style.setProperty('--c', hero.color);
      const c = el('canvas', 'story-prev'); prepCanvas(c, 160, 190);
      b.appendChild(c);
      b.appendChild(el('div', 'story-info', `
        <div class="story-num">CHAPTER ${i + 1} <span>${ch.kanji}</span></div>
        <b>${ch.title}</b>
        <p>${ch.blurb}</p>
        <div class="pips">${ch.fights.map((f, j) => `<i class="${j < done ? 'on' : ''} ${f.boss ? 'boss' : ''}"></i>`).join('')}</div>
        <small>Play as ${hero.name}${done >= total ? ' · <em>CLEARED</em>' : ''}</small>`));
      this.addPreview(c, hero, { scale: 1.15, glow: true });
      b.onclick = () => { Sound.play('confirm'); Story.begin(i); };
      grid.appendChild(b);
    });
    this.show('story', { focus, back: () => this.openMenu(0) });
  },

  showBrief(chIdx, idx) {
    const ch = STORY[chIdx], ft = ch.fights[idx], hero = CHARS[ch.hero], foe = CHARS[ft.enemy];
    const s = $('#scr-brief');
    s.innerHTML = `<div class="brief-wrap">
        <div class="brief-head"><span>CHAPTER ${chIdx + 1} · ${ch.title}</span><span>FIGHT ${idx + 1} / ${ch.fights.length}</span></div>
        <div class="brief-main">
          <div class="brief-side"><canvas class="bp1"></canvas><b style="color:${hero.color}">${hero.name}</b></div>
          <div class="brief-mid">
            <div class="vs">VS</div>
            ${ft.boss ? '<div class="boss-tag">BOSS BATTLE · BEST OF 3</div>' : ''}
            <h3>${foe.name}</h3><div class="brief-title">${foe.title}</div>
            <p>${ft.text}</p>
            <div class="brief-btns">
              <button class="nav btn-primary" data-a="fight">Fight!</button>
              <button class="nav" data-a="back">Back to chapters</button>
            </div>
          </div>
          <div class="brief-side"><canvas class="bp2"></canvas><b style="color:${foe.color}">${foe.name}</b></div>
        </div></div>`;
    const c1 = s.querySelector('.bp1'), c2 = s.querySelector('.bp2');
    prepCanvas(c1, 240, 320); prepCanvas(c2, 240, 320);
    this.addPreview(c1, hero, { scale: 1.9, glow: true });
    this.addPreview(c2, foe, { scale: 1.9, glow: true, facing: -1 });
    s.querySelector('[data-a=fight]').onclick = () => { Sound.play('fight'); Story.fight(); };
    s.querySelector('[data-a=back]').onclick = () => { Sound.play('back'); this.openStory(chIdx); };
    this.show('brief', { back: () => this.openStory(chIdx) });
  },

  /* ---------------- gallery */
  openGallery() {
    const s = $('#scr-gallery');
    s.innerHTML = `<div class="gal-wrap"><div class="gal-list"><h2 class="scr-title">GALLERY</h2></div>
      <div class="gal-view"><canvas class="gal-prev"></canvas><div class="gal-info"></div></div></div>`;
    const list = s.querySelector('.gal-list'), info = s.querySelector('.gal-info');
    const c = s.querySelector('.gal-prev'); prepCanvas(c, 300, 380);
    const prev = this.addPreview(c, CHARS[ROSTER[0]], { scale: 2.1, demo: true, glow: true });
    const add = (id) => {
      const d = CHARS[id];
      const b = el('button', 'nav gal-item', `<i style="background:${d.color}"></i>${d.name}`);
      b.onfocusnav = () => { prev.def = d; prev.si = 0; prev.st = 0; info.innerHTML = charInfoHTML(d, null, true); };
      b.onclick = b.onfocusnav;
      list.appendChild(b);
    };
    list.appendChild(el('div', 'gal-sep', 'PLAYABLE'));
    ROSTER.forEach(add);
    list.appendChild(el('div', 'gal-sep', 'CURSED SPIRITS · STORY MODE'));
    CURSE_IDS.forEach(add);
    const back = el('button', 'nav gal-item back', '← Back');
    back.onclick = () => { Sound.play('back'); this.openMenu(3); };
    list.appendChild(back);
    this.show('gallery', { back: () => this.openMenu(3) });
  },

  /* ---------------- settings */
  openSettings() {
    const st = World.settings;
    const rows = [
      { label: 'Volume', get: () => `${Math.round(st.volume * 100)}%`, adj: d => { st.volume = U.clamp(Math.round((st.volume + d * 0.1) * 10) / 10, 0, 1); Sound.setVolume(st.volume); } },
      { label: 'Screen Shake', get: () => (st.shake ? 'On' : 'Off'), adj: () => { st.shake = !st.shake; } },
      { label: 'Particles', get: () => (st.particles >= 1 ? 'High' : 'Low'), adj: () => { st.particles = st.particles >= 1 ? 0.45 : 1; } },
      { label: 'Round Time', get: () => (st.roundTime ? `${st.roundTime} sec` : 'Infinite'), adj: d => { const o = [60, 99, 0]; st.roundTime = o[(o.indexOf(st.roundTime) + (d < 0 ? 2 : 1)) % 3]; } },
      { label: 'Blood', get: () => (st.blood ? 'On' : 'Off'), adj: () => { st.blood = !st.blood; } },
      { label: 'Show Hitboxes', get: () => (st.hitboxes ? 'On' : 'Off'), adj: () => { st.hitboxes = !st.hitboxes; } },
    ];
    const s = $('#scr-settings');
    s.innerHTML = `<div class="panel-wrap narrow"><h2 class="scr-title">SETTINGS</h2><div class="set-list"></div>
      <div class="menu-foot">↑/↓ to move · ←/→ or Enter to change · Esc to go back</div></div>`;
    const list = s.querySelector('.set-list');
    rows.forEach(r => {
      const b = el('button', 'nav set-row', `<span>${r.label}</span><b>‹ ${r.get()} ›</b>`);
      const upd = () => { b.querySelector('b').textContent = `‹ ${r.get()} ›`; Store.set('settings', st); };
      b.onadjust = d => { r.adj(d); upd(); };
      b.onclick = () => { r.adj(1); upd(); Sound.play('select'); };
      list.appendChild(b);
    });
    const reset = el('button', 'nav set-row', '<span>Reset Story Progress</span><b>Reset</b>');
    reset.onclick = () => { Store.set('story', {}); reset.querySelector('b').textContent = 'Done ✓'; Sound.play('confirm'); };
    list.appendChild(reset);
    const back = el('button', 'nav set-row back', '<span>← Back</span>');
    back.onclick = () => { Sound.play('back'); this.openMenu(5); };
    list.appendChild(back);
    this.show('settings', { back: () => this.openMenu(5) });
  },

  /* ---------------- controls */
  buildControls() {
    const row = (a, p1, p2) => `<tr><td>${a}</td><td>${p1}</td><td>${p2}</td></tr>`;
    const k = s => s.split(' ').map(x => `<kbd>${x}</kbd>`).join(' ');
    $('#scr-controls').innerHTML = `<div class="panel-wrap"><h2 class="scr-title">CONTROLS</h2>
      <table class="ctl">
        <tr><th></th><th>Player 1</th><th>Player 2 <small>(numpad · or alternate)</small></th></tr>
        ${row('Move', k('A D'), k('← →'))}
        ${row('Jump (double jump)', k('W'), k('↑'))}
        ${row('Block', `${k('S')} or hold Right Click`, k('↓'))}
        ${row('Drop through platform', `${k('S')} + ${k('W')}`, `${k('↓')} + ${k('↑')}`)}
        ${row('Basic attack / M1 (3-hit chain)', `${k('J')} or Left Click`, `${k('Num1')} or ${k('.')}`)}
        ${row('Heavy attack', k('K'), `${k('Num2')} or ${k('/')}`)}
        ${row('Special techniques 1-4', k('U I O L'), `${k('Num4 Num5 Num6 Num7')} or ${k('P [ ] \\')}`)}
        ${row('5th technique (Yuji: Takeover · Yuta: Copy · Megumi: Mahoraga · Gojo: Blink Strike)', k('H'), `${k('Num8')} or ${k("'")}`)}
        ${row('6th technique (Gojo: Blue Maximum Output)', k('G'), `${k('Num9')} or ${k(';')}`)}
        ${row('7th technique (Gojo: Teleport)', k('Y'), `${k('Num3')} or ${k('-')}`)}
        ${row('8th technique (Gojo: Reverse Cursed Technique)', k('T'), `${k('Num.')} or ${k('=')}`)}
        ${row('Dash / dodge', k('Shift'), `${k('Num0')} or ${k('RShift')}`)}
        ${row('Pause', k('Esc'), k('P'))}
      </table>
      <ul class="tips">
        <li>Chain <kbd>J</kbd> <kbd>J</kbd> <kbd>J</kbd>, then cancel a landed hit into Heavy or any special technique for big combos.</li>
        <li>Dashing grants brief invulnerability — dash <i>through</i> projectiles. Gojo's dash is a teleport.</li>
        <li>Technique 4 is the Ultimate / Domain Expansion and needs a full 100 cursed energy. Two domains at once will clash and shatter.</li>
        <li>Yuji: press Black Flash again the instant his fist flashes red for a true Black Flash.</li>
        <li>In Story Mode and Versus CPU you can use either key set.</li>
      </ul>
      <div class="brief-btns"><button class="nav" id="ctl-back">← Back</button></div></div>`;
    $('#ctl-back').onclick = () => { Sound.play('back'); if (this.back) this.back(); };
  },

  /* ---------------- pause */
  buildPause() {
    $('#scr-pause').innerHTML = `<div class="panel-wrap narrow center"><h2 class="scr-title">PAUSED</h2>
      <div class="set-list">
        <button class="nav set-row" data-a="resume"><span>Resume</span></button>
        <button class="nav set-row" data-a="restart"><span>Restart Match</span></button>
        <button class="nav set-row" data-a="controls"><span>Controls</span></button>
        <button class="nav set-row" data-a="quit"><span>Quit to Main Menu</span></button>
      </div></div>`;
    const act = a => {
      Sound.play(a === 'resume' ? 'confirm' : 'select');
      if (a === 'resume') Game.resume();
      else if (a === 'restart') Game.restart();
      else if (a === 'controls') this.show('controls', { back: () => this.show('pause', { back: () => Game.resume() }) });
      else if (a === 'quit') Game.toMenu();
    };
    $('#scr-pause').querySelectorAll('[data-a]').forEach(b => { b.onclick = () => act(b.dataset.a); });
  },

  /* ---------------- results */
  showResult(o) {
    const s = $('#scr-result');
    s.innerHTML = `<div class="result-wrap">
      <div class="res-title" style="color:${o.color || '#fff'}">${o.title}</div>
      ${o.sub ? `<div class="res-sub">${o.sub}</div>` : ''}
      ${o.stats ? `<div class="res-stats">${o.stats}</div>` : ''}
      <div class="brief-btns"></div></div>`;
    const box = s.querySelector('.brief-btns');
    o.buttons.forEach((b, i) => {
      const e = el('button', 'nav' + (i === 0 ? ' btn-primary' : ''), b.label);
      e.onclick = () => { Sound.play('confirm'); b.fn(); };
      box.appendChild(e);
    });
    this.show('result', { back: o.back });
  },

  /* ---------------- canvas HUD */
  announce(text, color = '#fff', life = 70, sub = '') { this.ann = { text, color, life, max: life, sub }; },

  drawHUD(ctx) {
    const fs = World.fighters;
    if (fs.length < 2 || !Game.match) return;
    fs.forEach((f, i) => this.drawSide(ctx, f, i));
    const t = Game.timeLeft();
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,18,0.85)'; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(600, 14); ctx.lineTo(680, 14); ctx.lineTo(694, 46); ctx.lineTo(680, 78); ctx.lineTo(600, 78); ctx.lineTo(586, 46); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.font = '900 40px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = t !== null && t <= 10 ? '#ff4d5a' : '#ffffff';
    ctx.fillText(t === null ? '∞' : String(t), 640, 48);
    const need = Game.match.winsNeeded;
    for (let i = 0; i < need; i++) {
      for (const [side, f] of [[-1, fs[0]], [1, fs[1]]]) {
        ctx.beginPath(); ctx.arc(640 + side * (22 + i * 16), 94, 5.5, 0, 6.283);
        ctx.fillStyle = f.wins > i ? '#ffd34d' : 'rgba(0,0,0,0.6)'; ctx.fill();
        ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
    ctx.font = '700 12px "Segoe UI", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`ROUND ${Game.match.round}`, 640, 112);
    ctx.restore();
  },

  drawSide(ctx, f, side) {
    const R = side === 1, def = f.def;
    const X = x => (R ? W - x : x);
    ctx.save();
    drawPortrait(ctx, def, X(58), 60, 40, R ? -1 : 1);
    // name + tag
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = R ? 'right' : 'left';
    ctx.font = '900 21px Impact, "Arial Black", sans-serif';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(def.short, X(110), 29); ctx.fillStyle = '#fff'; ctx.fillText(def.short, X(110), 29);
    const nw = ctx.measureText(def.short).width;
    ctx.font = '800 11px "Segoe UI", sans-serif';
    const tagCol = f.tag === 'CPU' ? '#9aa0b0' : side === 0 ? '#4da3ff' : '#ff4d5a';
    const tx = R ? W - 110 - nw - 34 : 110 + nw + 8;
    ctx.fillStyle = tagCol; ctx.fillRect(tx, 15, 28, 15);
    ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.fillText(f.tag, tx + 14, 26.5);
    // HP
    const bw = 440, bh = 20, by = 35, x0 = R ? W - 110 - bw : 110;
    const anchor = (w) => (R ? x0 + bw - w : x0);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x0 - 2, by - 2, bw + 4, bh + 4);
    const tw = bw * f.hpTrail / f.maxHp, hw = bw * f.hp / f.maxHp, ratio = f.hp / f.maxHp;
    ctx.fillStyle = '#e8e8f0'; ctx.fillRect(anchor(tw), by, tw, bh);
    const g = ctx.createLinearGradient(0, by, 0, by + bh);
    if (ratio > 0.3) { g.addColorStop(0, '#ffe066'); g.addColorStop(1, '#ff9a1f'); } else { g.addColorStop(0, '#ff6a6a'); g.addColorStop(1, '#c4122f'); }
    ctx.fillStyle = g; ctx.fillRect(anchor(hw), by, hw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(anchor(hw), by, hw, 5);
    ctx.font = '800 12px "Segoe UI", sans-serif'; ctx.textAlign = R ? 'left' : 'right'; ctx.fillStyle = '#111';
    ctx.fillText(Math.ceil(f.hp), R ? x0 + 6 : x0 + bw - 6, by + 15);
    // guard
    const gw = bw * 0.5 * f.guard / 100;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(R ? x0 + bw * 0.5 : x0, by + bh + 3, bw * 0.5, 4);
    ctx.fillStyle = f.guard < 30 ? '#ff6a6a' : '#bfe6ff'; ctx.fillRect(R ? x0 + bw - gw : x0, by + bh + 3, gw, 4);
    // CE
    const cw = 300, cy = 66, ch = 11, cx0 = R ? W - 110 - cw : 110, cew = cw * f.ce / 100;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(cx0 - 2, cy - 2, cw + 4, ch + 4);
    const cg = ctx.createLinearGradient(cx0, 0, cx0 + cw, 0);
    cg.addColorStop(R ? 1 : 0, '#3b7bff'); cg.addColorStop(R ? 0 : 1, '#c04dff');
    ctx.fillStyle = f.noCeT > 0 && f.noCeT % 6 < 3 ? '#ff4d5a' : cg;
    ctx.fillRect(R ? cx0 + cw - cew : cx0, cy, cew, ch);
    if (f.ce >= 100) { ctx.globalAlpha = 0.4 + 0.3 * Math.sin(World.frame * 0.2); ctx.fillStyle = '#fff'; ctx.fillRect(cx0, cy, cw, ch); ctx.globalAlpha = 1; }
    ctx.font = '800 11px "Segoe UI", sans-serif'; ctx.textAlign = R ? 'right' : 'left'; ctx.fillStyle = '#cfd8ff';
    ctx.fillText(`CE ${Math.floor(f.ce)}`, R ? cx0 - 8 : cx0 + cw + 8, cy + 10);
    // techniques
    const labels = f.keyLabels || KEY_LABELS.cpu;
    const nAb = Math.max(4, f.abilities.length);
    for (let i = 0; i < nAb; i++) {
      const a = f.abilities[i], size = 42, ix = R ? W - 110 - (nAb - i) * 50 + 8 : 110 + i * 50, iy = 86;
      ctx.fillStyle = 'rgba(8,8,18,0.85)'; ctx.fillRect(ix, iy, size, size);
      if (!a) { ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.strokeRect(ix + 0.5, iy + 0.5, size - 1, size - 1); continue; }
      const ready = f.cd[i] <= 0 && f.ce >= a.cost;
      ctx.fillStyle = a.color; ctx.globalAlpha = ready ? 0.3 : 0.12; ctx.fillRect(ix, iy, size, size); ctx.globalAlpha = 1;
      ctx.font = '900 22px "Noto Sans JP", "Yu Gothic", "Hiragino Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = ready ? '#fff' : 'rgba(255,255,255,0.4)'; ctx.fillText(a.icon, ix + size / 2, iy + size / 2 + 1);
      if (f.cd[i] > 0) {
        const k = f.cd[i] / a.cd;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath(); ctx.moveTo(ix + size / 2, iy + size / 2); ctx.arc(ix + size / 2, iy + size / 2, size * 0.75, -Math.PI / 2, -Math.PI / 2 + k * 6.283); ctx.closePath();
        ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, size, size); ctx.clip(); ctx.beginPath(); ctx.moveTo(ix + size / 2, iy + size / 2); ctx.arc(ix + size / 2, iy + size / 2, size * 0.75, -Math.PI / 2, -Math.PI / 2 + k * 6.283); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.font = '800 13px "Segoe UI", sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(Math.ceil(f.cd[i] / 60), ix + size / 2, iy + size / 2);
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = a.ult && ready ? `rgba(255,211,77,${0.6 + 0.4 * Math.sin(World.frame * 0.25)})` : ready ? a.color : 'rgba(255,255,255,0.18)';
      ctx.strokeRect(ix + 1, iy + 1, size - 2, size - 2);
      ctx.font = '800 9px "Segoe UI", sans-serif'; ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left'; ctx.fillStyle = f.ce >= a.cost ? '#9fd0ff' : '#ff6a6a'; ctx.fillText(a.cost, ix + 3, iy + 11);
      if (a.copy) { const c = copyTarget(f); if (c) { ctx.font = '900 12px "Noto Sans JP", sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = c.color; ctx.fillText(c.icon, ix + size - 3, iy + 13); ctx.font = '800 9px "Segoe UI", sans-serif'; } }
      if (labels[i]) { ctx.textAlign = 'right'; ctx.fillStyle = '#ffd34d'; ctx.fillText(labels[i], ix + size - 3, iy + size - 4); }
    }
    if (f.takeoverT > 0) {
      const k = f.takeoverT / 1800, tw2 = 240, tx2 = R ? W - 110 - tw2 : 110;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(tx2, 136, tw2, 16);
      ctx.fillStyle = '#c4122f'; ctx.fillRect(R ? tx2 + tw2 * (1 - k) : tx2, 136, tw2 * k, 16);
      ctx.font = '900 12px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.fillText(`SUKUNA IN CONTROL · ${Math.ceil(f.takeoverT / 60)}s`, tx2 + tw2 / 2, 144);
    }
    // combo counter
    if (f.comboShowT > 0 && f.comboShow >= 2) {
      const a = Math.min(1, f.comboShowT / 20), pop = 1 + Math.max(0, (f.comboShowT - 80) / 10) * 0.3;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(X(120), 190); ctx.scale(pop, pop);
      ctx.textAlign = R ? 'right' : 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = 'italic 900 46px Impact, "Arial Black", sans-serif';
      ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(f.comboShow, 0, 0);
      ctx.fillStyle = f.comboShow >= 8 ? '#ff4d5a' : '#ffd34d'; ctx.fillText(f.comboShow, 0, 0);
      const w = ctx.measureText(String(f.comboShow)).width;
      ctx.font = 'italic 900 20px Impact, "Arial Black", sans-serif';
      ctx.strokeText('HITS', R ? -w - 6 : w + 6, 0); ctx.fillStyle = '#fff'; ctx.fillText('HITS', R ? -w - 6 : w + 6, 0);
      ctx.restore();
    }
    ctx.restore();
  },

  drawOverlays(ctx) {
    if (World.cutscene) { this.drawCutscene(ctx, World.cutscene); return; }
    if (this.bf) this.drawBlackFlash(ctx);
    const b = World.banner;
    if (b) {
      const t = b.max - b.life, a = Math.min(1, t / 8, b.life / 15), slide = Math.max(0, 1 - t / 12);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 222, W, 92);
      ctx.fillStyle = b.color; ctx.fillRect(0, 222, W, 2); ctx.fillRect(0, 312, W, 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 16px "Segoe UI", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(b.title.split('').join(' '), W / 2 - slide * 200, 242);
      ctx.font = '900 46px Impact, "Arial Black", sans-serif';
      ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(b.sub, W / 2 + slide * 300, 283);
      ctx.fillStyle = b.color; ctx.fillText(b.sub, W / 2 + slide * 300, 283);
      ctx.restore();
    }
    const n = this.ann;
    if (n) {
      const t = n.max - n.life, a = Math.min(1, n.life / 12), pop = 1 + Math.max(0, 1 - t / 8) * 0.6;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 330); ctx.scale(pop, pop);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'italic 900 96px Impact, "Arial Black", sans-serif';
      ctx.lineWidth = 10; ctx.strokeStyle = '#000'; ctx.strokeText(n.text, 0, 0);
      ctx.fillStyle = n.color; ctx.fillText(n.text, 0, 0);
      if (n.sub) { ctx.font = '800 22px "Segoe UI", sans-serif'; ctx.lineWidth = 5; ctx.strokeText(n.sub, 0, 70); ctx.fillStyle = '#fff'; ctx.fillText(n.sub, 0, 70); }
      ctx.restore();
    }
  },
  tick() { if (this.ann && --this.ann.life <= 0) this.ann = null; },
  // Real-time (not simulation-time) effects: they keep their length through slow motion.
  tickReal() { if (this.bf && --this.bf.t <= 0) this.bf = null; },

  // The "BLACK FLASH" screen: a brief black-and-red frame; the fight keeps running underneath.
  blackFlash() {
    const bolts = Array.from({ length: 12 }, () => {
      const a = Math.random() * 6.283, pts = [[W / 2, H / 2]];
      for (let i = 1; i <= 6; i++) pts.push([W / 2 + Math.cos(a) * i * 120 + U.rand(-40, 40), H / 2 + Math.sin(a) * i * 80 + U.rand(-40, 40)]);
      return pts;
    });
    this.bf = { t: 22, max: 22, bolts };
    Sound.play('bf'); FX.shake(14);
  },
  drawBlackFlash(ctx) {
    const b = this.bf, k = b.t / b.max;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 2) * 0.72; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = Math.min(1, k * 2);
    ctx.lineJoin = 'round';
    for (const [i, pts] of b.bolts.entries()) {
      ctx.strokeStyle = i % 3 ? '#ff1f3d' : '#ffffff'; ctx.lineWidth = i % 3 ? 4 : 2;
      ctx.beginPath(); pts.forEach((q, j) => (j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke();
    }
    const pop = 1 + (1 - k) * 0.15;
    ctx.translate(W / 2, H / 2); ctx.scale(pop, pop);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 54px "Noto Sans JP", "Yu Gothic", sans-serif'; ctx.fillStyle = '#ff1f3d'; ctx.fillText('黒閃', 0, -80);
    ctx.font = 'italic 900 120px Impact, "Arial Black", sans-serif';
    ctx.lineWidth = 10; ctx.strokeStyle = '#ff1f3d'; ctx.strokeText('BLACK FLASH', 0, 10);
    ctx.fillStyle = '#000'; ctx.fillText('BLACK FLASH', 0, 10);
    ctx.restore();
  },

  // Second half of the cutscene: the caster's face fills the whole screen.
  drawFaceTakeover(ctx, c, t) {
    const def = c.def, a = Math.min(1, t / 6, c.t / 12);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = U.shade(def.color, -0.8); ctx.fillRect(0, 0, W, H);
    const pose = POSES.idle, sk = skeleton(pose), drop = poseDrop(pose, sk);
    const K = 14 + Math.min(1, t / 30) * 10 + t * 0.03;          // slow push-in on the face
    const jx = U.rand(-2, 2), jy = U.rand(-2, 2);
    drawStickman(ctx, def, pose, W / 2 - sk.head[0] * K - 10 * K + jx, H / 2 + 30 - (sk.head[1] - drop) * K + jy, 1, { k: K / (def.scale || 1), fighter: c.f });
    const v = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 760);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, H - 210, W, 170);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const pop = 1 + Math.max(0, 1 - t / 8) * 0.5;
    ctx.save(); ctx.translate(W / 2, H - 150); ctx.scale(pop, pop);
    ctx.font = 'italic 900 100px Impact, "Arial Black", sans-serif';
    ctx.lineWidth = 12; ctx.strokeStyle = '#000'; ctx.strokeText('DOMAIN EXPANSION', 0, 0);
    ctx.fillStyle = '#ffffff'; ctx.fillText('DOMAIN EXPANSION', 0, 0);
    ctx.restore();
    if (c.name) {
      ctx.globalAlpha = a * Math.min(1, Math.max(0, (t - 10) / 10));
      ctx.font = '900 40px Impact, "Arial Black", sans-serif';
      ctx.lineWidth = 7; ctx.strokeStyle = '#000'; ctx.strokeText(c.name, W / 2, H - 78);
      ctx.fillStyle = def.color; ctx.fillText(c.name, W / 2, H - 78);
    }
    ctx.globalAlpha = a; ctx.font = '900 54px "Noto Sans JP", "Yu Gothic", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('領域展開', W / 2, 70);
    ctx.restore();
  },

  drawCutscene(ctx, c) {
    const t0 = c.max - c.t;
    if (t0 >= 70) { this.drawFaceTakeover(ctx, c, t0 - 70); return; }
    c = Object.assign({}, c, { max: 70, t: 70 - t0 });
    const t = c.max - c.t, a = Math.min(1, t / 8, c.t / 10), slide = Math.max(0, 1 - t / 12);
    const def = c.def, top = 110, bh = 500;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, bh); ctx.clip();
    const g = ctx.createRadialGradient(W * 0.42, 340, 40, W * 0.42, 340, 760);
    g.addColorStop(0, U.shade(def.color, -0.35)); g.addColorStop(1, '#030208');
    ctx.fillStyle = g; ctx.fillRect(0, top, W, bh);
    // speed lines converging on the caster
    ctx.strokeStyle = def.color; ctx.lineWidth = 2;
    for (let i = 0; i < 46; i++) {
      const an = i * 2.4 + t * 0.013, r0 = 260 + ((i * 53 + t * 9) % 260);
      ctx.globalAlpha = a * 0.35;
      ctx.beginPath(); ctx.moveTo(W * 0.42 + Math.cos(an) * r0, 340 + Math.sin(an) * r0); ctx.lineTo(W * 0.42 + Math.cos(an) * (r0 + 220), 340 + Math.sin(an) * (r0 + 220)); ctx.stroke();
    }
    ctx.globalAlpha = a;
    // giant close-up of the caster
    const pose = POSES.sign, sk = skeleton(pose), drop = poseDrop(pose, sk), K = 7;
    const hx = W * 0.4 - slide * 260, hy = 300 + Math.sin(t * 0.05) * 4;
    drawStickman(ctx, def, pose, hx - sk.head[0] * K, hy - (sk.head[1] - drop) * K, 1, { k: K / (def.scale || 1), fighter: c.f });
    // the hand sign, raised in front of the face
    drawHandSign(ctx, c.sign, hx + 70, 560 + slide * 140 - Math.min(1, t / 20) * 30, 2.7, def.look.skin);
    ctx.restore();
    ctx.fillStyle = def.color; ctx.fillRect(0, top - 3, W, 3); ctx.fillRect(0, top + bh, W, 3);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 66px "Noto Sans JP", "Yu Gothic", "Hiragino Sans", sans-serif';
    ['領', '域', '展', '開'].forEach((ch, i) => {
      ctx.globalAlpha = a * Math.min(1, Math.max(0, (t - 6 - i * 5) / 8));
      ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(ch, W - 130, top + 90 + i * 100);
      ctx.fillStyle = '#ffffff'; ctx.fillText(ch, W - 130, top + 90 + i * 100);
    });
    ctx.globalAlpha = a;
    ctx.font = '800 18px "Segoe UI", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('D O M A I N   E X P A N S I O N', W / 2, top + bh + 50);
    ctx.restore();
  },
};

/* ---------------------------------------------------------------- domain hand signs */

function drawHandSign(ctx, sign, cx, cy, k, skin) {
  const OL = '#07070c';
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const fing = (x1, y1, x2, y2, w = 10) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = OL; ctx.lineWidth = w + 4; ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = w; ctx.stroke();
  };
  const palm = (x, y, rx, ry, rot = 0) => {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 6.283);
    ctx.fillStyle = skin; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OL; ctx.stroke();
  };
  const sleeve = (x, rot) => { ctx.save(); ctx.translate(x, 60); ctx.rotate(rot); ctx.fillStyle = '#15151d'; ctx.fillRect(-24, 0, 48, 90); ctx.restore(); };
  switch (sign) {
    case 'void': // Gojo: index and middle finger crossed
      sleeve(0, 0);
      fing(14, 2, 18, 22, 11); fing(22, 10, 24, 28, 10);
      palm(0, 26, 26, 32);
      fing(-24, 30, -10, 8, 11);
      fing(-5, 2, 9, -68, 11);
      fing(8, 2, -6, -64, 11);
      break;
    case 'shrine': // Sukuna: Enma-ten, two hands pressed with interlocked fingers
      sleeve(-30, 0.15); sleeve(30, -0.15);
      palm(-22, 24, 22, 32, -0.2); palm(22, 24, 22, 32, 0.2);
      for (let i = 0; i < 4; i++) fing(-18 + i * 12, -2, -18 + i * 12 + (i % 2 ? 7 : -7), -30, 9);
      fing(-6, -4, -4, -72, 11); fing(6, -4, 4, -72, 11);
      fing(-28, 34, 4, 16, 11); fing(28, 34, -4, 16, 11);
      break;
    case 'shadow': // Megumi: hands interlaced, thumbs raised
      sleeve(-34, 0.25); sleeve(34, -0.25);
      palm(-24, 16, 24, 28); palm(24, 16, 24, 28);
      for (let i = 0; i < 4; i++) fing(-36, -10 + i * 11, 36, -6 + i * 11, 9);
      fing(-8, -14, -12, -58, 11); fing(8, -14, 12, -58, 11);
      break;
    default: // Mahito: palms pressed together
      sleeve(-14, 0.1); sleeve(14, -0.1);
      palm(-12, 10, 15, 42, 0.08); palm(12, 10, 15, 42, -0.08);
      for (let i = 0; i < 3; i++) { fing(-8 + i, -26, -6 + i, -64 + i * 6, 9); fing(8 - i, -26, 6 - i, -64 + i * 6, 9); }
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- character info block */

function charInfoHTML(d, keys, long) {
  const tech = d.abilities.map((a, i) => a ? `
    <li style="--c:${a.color}"><span class="ic">${a.icon}</span>
      <div><b>${a.name}</b>${a.ult ? ' <em>ULT</em>' : ''} <small>${a.cost} CE${keys && keys[i] ? ` · [${keys[i]}]` : ''}</small>
      ${long || true ? `<p>${a.desc}</p>` : ''}</div></li>` : '').join('');
  return `<div class="ci">
    <div class="ci-head"><b style="color:${d.color}">${d.name}</b><span>${d.kanji || ''}</span></div>
    <div class="ci-title">${d.title}</div>
    ${long && d.bio ? `<p class="ci-bio">${d.bio}</p>` : ''}
    <p class="ci-style"><i>Style</i> ${d.style}</p>
    <p class="ci-pass"><i>Passive · ${d.passive.name}</i> ${d.passive.desc}</p>
    ${long ? `<p class="ci-stats">HP ${d.hp || 1000} · Speed ${Math.round((d.speed || 1) * 100)}%${d.dash === 'teleport' ? ' · Teleport dash' : ''}${d.melee && d.melee.weapon ? ` · ${d.melee.weapon === 'sword' ? 'Katana' : 'Claws'}` : ''}</p>` : ''}
    <ul class="ci-tech">${tech}</ul></div>`;
}

/* ---------------------------------------------------------------- character select */

const Select = {
  mode: 'versus', cur: [0, 1], locked: [false, false], diff: 1, built: false, panels: [],

  open(mode) {
    this.mode = mode; this.locked = [false, false];
    this.diff = Store.get('diff', 1);
    const s = $('#scr-select');
    const cpu = mode === 'cpu';
    s.innerHTML = `<div class="sel-wrap">
      <header class="sel-head"><h2 class="scr-title">CHOOSE YOUR SORCERER</h2>
        <div class="sel-mode">${cpu ? 'VERSUS CPU' : 'TWO PLAYER VERSUS'}</div>
        ${cpu ? `<div class="diff">CPU: ${DIFFS.map((d, i) => `<button data-d="${i}">${d.name}</button>`).join('')}<small>Q / E</small></div>` : ''}
      </header>
      <div class="sel-grid"></div>
      <div class="sel-panels">
        <div class="sel-panel p1"><canvas></canvas><div class="sel-info"></div><div class="sel-tag">P1</div></div>
        <div class="sel-panel p2"><canvas></canvas><div class="sel-info"></div><div class="sel-tag">${cpu ? 'CPU' : 'P2'}</div></div>
      </div>
      <footer class="menu-foot">${cpu
        ? 'A/D or ←/→ to choose · J or Enter to lock (you, then the CPU) · K to undo · Esc for menu'
        : 'P1: A/D + J to lock, K to undo &nbsp;·&nbsp; P2: ←/→ + Num1 (or .) to lock, Num2 (or /) to undo &nbsp;·&nbsp; Esc for menu'}</footer></div>`;
    const grid = s.querySelector('.sel-grid');
    this.cards = ROSTER.map((id, i) => {
      const d = CHARS[id];
      const b = el('button', 'sel-card');
      b.style.setProperty('--c', d.color);
      const c = el('canvas'); const ctx = prepCanvas(c, 110, 110);
      ctx.setTransform(c.width / 110, 0, 0, c.width / 110, 0, 0);
      drawPortrait(ctx, d, 55, 55, 50, 1);
      b.appendChild(c);
      b.appendChild(el('div', 'sel-name', `<b>${d.short}</b><small>${d.title}</small>`));
      b.appendChild(el('i', 'cur1', 'P1')); b.appendChild(el('i', 'cur2', cpu ? 'CPU' : 'P2'));
      b.onclick = () => this.clickCard(i);
      b.onmouseenter = () => { const p = this.picker(); if (p >= 0 && this.cur[p] !== i) { this.cur[p] = i; Sound.play('select'); this.refresh(); } };
      grid.appendChild(b);
      return b;
    });
    this.panels = [0, 1].map(p => {
      const panel = s.querySelector(`.sel-panel.p${p + 1}`);
      const c = panel.querySelector('canvas'); prepCanvas(c, 220, 300);
      const pv = this.addPrev(c, p);
      return { panel, info: panel.querySelector('.sel-info'), pv, shown: -1 };
    });
    s.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => { this.diff = +b.dataset.d; Store.set('diff', this.diff); this.refresh(); Sound.play('select'); }; });
    UI.show('select', { back: () => UI.openMenu(this.mode === 'cpu' ? 2 : 1) });
    this.refresh();
  },
  addPrev(c, p) { return UI.addPreview(c, CHARS[ROSTER[this.cur[p]]], { scale: 1.75, glow: true, facing: p ? -1 : 1 }); },
  picker() { return !this.locked[0] ? 0 : !this.locked[1] ? 1 : -1; },

  refresh() {
    this.cards.forEach((b, i) => {
      b.classList.toggle('c1', this.cur[0] === i); b.classList.toggle('c2', this.cur[1] === i);
      b.classList.toggle('l1', this.locked[0] && this.cur[0] === i); b.classList.toggle('l2', this.locked[1] && this.cur[1] === i);
    });
    this.panels.forEach((pn, p) => {
      const d = CHARS[ROSTER[this.cur[p]]];
      pn.pv.def = d; pn.pv.o.pose = this.locked[p] ? (d.winPose || 'win') : 'idle';
      pn.panel.classList.toggle('locked', this.locked[p]);
      pn.panel.style.setProperty('--c', d.color);
      if (pn.shown !== this.cur[p]) {
        const keys = this.mode === 'cpu' && p === 1 ? null : p === 0 ? KEY_LABELS.p1 : KEY_LABELS.p2;
        pn.info.innerHTML = charInfoHTML(d, keys, false); pn.shown = this.cur[p];
      }
    });
    document.querySelectorAll('#scr-select [data-d]').forEach(b => b.classList.toggle('on', +b.dataset.d === this.diff));
  },

  move(p, d) { if (p < 0 || this.locked[p]) return; this.cur[p] = (this.cur[p] + d + ROSTER.length) % ROSTER.length; Sound.play('select'); this.refresh(); },
  confirm(p) {
    if (p < 0 || this.locked[p]) return;
    this.locked[p] = true; Sound.play('confirm'); this.refresh();
    if (this.locked[0] && this.locked[1]) setTimeout(() => { if (UI.screen === 'select') this.done(); }, 450);
  },
  cancel(p) {
    if (this.locked[p]) { this.locked[p] = false; Sound.play('back'); this.refresh(); return; }
    if (this.mode === 'cpu' && p === 1 && this.locked[0]) { this.locked[0] = false; Sound.play('back'); this.refresh(); }
  },
  clickCard(i) {
    const p = this.picker();
    if (p < 0) return;
    this.cur[p] = i; this.confirm(p);
  },
  done() {
    const p1 = ROSTER[this.cur[0]], p2 = ROSTER[this.cur[1]], cpu = this.mode === 'cpu';
    UI.openArena(arena => Game.startMatch({ mode: this.mode, p1, p2, arena, p2ai: cpu ? DIFFS[this.diff].v : null, solo: cpu, wins: 2 }),
      () => this.open(this.mode));
  },

  key(e) {
    const c = e.code;
    if (c === 'Escape') { Sound.play('back'); UI.openMenu(this.mode === 'cpu' ? 2 : 1); return; }
    if (this.mode === 'cpu') {
      const p = this.picker();
      if (keyIs(e, 'left')) this.move(p, -1);
      else if (keyIs(e, 'right')) this.move(p, 1);
      else if (keyIs(e, 'ok')) this.confirm(p);
      else if (c === 'KeyK' || c === 'Backspace' || c === 'Numpad2') this.cancel(p < 0 ? 1 : p);
      else if (c === 'KeyQ' || c === 'KeyE') { this.diff = (this.diff + (c === 'KeyE' ? 1 : DIFFS.length - 1)) % DIFFS.length; Store.set('diff', this.diff); Sound.play('select'); this.refresh(); }
      return;
    }
    if (c === 'KeyA') this.move(0, -1);
    else if (c === 'KeyD') this.move(0, 1);
    else if (c === 'KeyJ') this.confirm(0);
    else if (c === 'KeyK') this.cancel(0);
    else if (c === 'ArrowLeft') this.move(1, -1);
    else if (c === 'ArrowRight') this.move(1, 1);
    else if (c === 'Numpad1' || c === 'Period' || c === 'Enter' || c === 'NumpadEnter') this.confirm(1);
    else if (c === 'Numpad2' || c === 'Slash') this.cancel(1);
  },
};
