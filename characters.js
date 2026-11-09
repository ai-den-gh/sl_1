'use strict';
/* ==========================================================================
   characters.js — fighter definitions: looks, passives and the four special
   techniques of every sorcerer, plus the cursed spirits of Story Mode.
   ========================================================================== */

/* ---------------------------------------------------------------- helpers */

const spawnProj = (f, o) => World.spawn(new Entity(Object.assign({ owner: f, proj: true, wallKill: true }, o)));
const spawnSummon = (f, o) => World.spawn(new Entity(Object.assign({ owner: f }, o)));
const dirTo = (a, b) => (b.x >= a.x ? 1 : -1);
const near = (t, x, y, rx, ry) => t && t.state !== 'ko' && Math.abs(t.x - x) < rx && Math.abs(t.midY - y) < ry;

// Point on a head: angle 0 = up, positive = toward the back of the head.
const HP = (hx, hy, a, R) => [hx - Math.sin(a * DEG) * R, hy - Math.cos(a * DEG) * R];

function drawSpikyHair(g, hx, hy, r, spikes, color) {
  const { ctx, col, OL } = g;
  const first = spikes[0], last = spikes[spikes.length - 1];
  ctx.beginPath();
  let p = HP(hx, hy, first[0] - first[2], r * 0.55); ctx.moveTo(p[0], p[1]);
  for (const [a, len, w] of spikes) {
    p = HP(hx, hy, a - w, r * 0.95); ctx.lineTo(p[0], p[1]);
    p = HP(hx, hy, a, r + len); ctx.lineTo(p[0], p[1]);
    p = HP(hx, hy, a + w, r * 0.95); ctx.lineTo(p[0], p[1]);
  }
  p = HP(hx, hy, last[0] + last[2], r * 0.55); ctx.lineTo(p[0], p[1]);
  ctx.lineTo(hx - 2, hy - 3);
  ctx.closePath();
  ctx.fillStyle = col(color); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = OL; ctx.stroke();
}

function headCircle(g, hx, hy, r, fill) {
  const { ctx, col, OL } = g;
  ctx.beginPath(); ctx.arc(hx, hy, r, 0, 6.283); ctx.fillStyle = col(fill); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = OL; ctx.stroke();
}

function eyeDots(g, list) {
  if (g.o.white || g.o.tint) return;
  const { ctx } = g;
  for (const [x, y, r, c, pupil] of list) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    if (pupil) { ctx.fillStyle = pupil; ctx.beginPath(); ctx.arc(x + r * 0.25, y, r * 0.45, 0, 6.283); ctx.fill(); }
  }
}

function lineTo2(ctx, a, b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }

/* ---------------------------------------------------------------- summon & effect renderers */

function drawDog(ctx, x, y, dir, color, t, alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.globalAlpha = alpha;
  const dark = color === '#1b1b24', OL = dark ? '#8a8aa8' : '#16161c';
  ctx.lineCap = 'round'; ctx.strokeStyle = OL; ctx.lineWidth = 4;
  const sw = Math.sin(t * 0.7) * 10;
  for (const [lx, ph] of [[-14, 1], [-8, -1], [12, -1], [18, 1]]) {
    ctx.beginPath(); ctx.moveTo(lx, -24); ctx.lineTo(lx + sw * ph, 0); ctx.stroke();
  }
  ctx.fillStyle = color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(2, -28, 26, 11, -0.08, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-24, -32); ctx.quadraticCurveTo(-38, -46, -34, -50); ctx.stroke();
  ctx.beginPath(); ctx.arc(28, -40, 10, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(34, -38); ctx.lineTo(44, -35); ctx.lineTo(34, -32); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, -47); ctx.lineTo(24, -60); ctx.lineTo(30, -48); ctx.fill(); ctx.stroke();
  ctx.fillStyle = dark ? '#ffdf5a' : '#3a7bff';
  ctx.beginPath(); ctx.arc(31, -42, 2.2, 0, 6.283); ctx.fill();
  ctx.restore();
}

function drawNue(ctx, x, y, dir, t, charge) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  const flap = Math.sin(t * 0.35) * 0.6;
  ctx.fillStyle = '#20202c'; ctx.strokeStyle = '#d9d9f0'; ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.save(); ctx.rotate(side * flap * 0.5);
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-62, -30 * side * 0.2 - 24 - flap * 30 * side); ctx.lineTo(-44, 4); ctx.lineTo(-20, 8); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, 0, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8e2d0';
  ctx.beginPath(); ctx.arc(18, -6, 10, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(21, -8, 2.5, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#c9a23a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(8, 12); ctx.lineTo(4, 26); ctx.moveTo(-6, 12); ctx.lineTo(-10, 26); ctx.stroke();
  ctx.restore();
  if (charge) {
    glowOrb(ctx, x, y, 16 + Math.random() * 10, '#fff', '#ffe86a', 0.8);
    if (Math.random() < 0.5) FX.bolt(x, y, x + U.rand(-40, 40), y + U.rand(-30, 30), '#ffe86a', 4, 2);
  }
}

function drawToad(ctx, x, y, dir, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.fillStyle = '#3f6b3a'; ctx.strokeStyle = '#0f170e'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, -26, 34, 26 + Math.sin(t * 0.2) * 2, 0, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6f9a4a';
  ctx.beginPath(); ctx.arc(14, -50, 9, 0, 6.283); ctx.arc(-8, -52, 9, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(16, -51, 4, 0, 6.283); ctx.arc(-6, -53, 4, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#0f170e'; ctx.beginPath(); ctx.moveTo(4, -22); ctx.quadraticCurveTo(26, -16, 34, -26); ctx.stroke();
  ctx.restore();
}

function drawRika(ctx, x, y, s, dir, t, mouth = 0.3) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  const OL = '#08060c';
  ctx.lineWidth = 3; ctx.strokeStyle = OL;
  // body mass
  ctx.fillStyle = '#2a2433';
  ctx.beginPath(); ctx.ellipse(-6, 40, 48, 44, 0, 0, 6.283); ctx.fill(); ctx.stroke();
  // arms
  ctx.lineCap = 'round';
  const sw = Math.sin(t * 0.08) * 6;
  for (const [sx, ex, ey] of [[-30, 44, 70 + sw], [18, 70, 54 - sw]]) {
    ctx.strokeStyle = OL; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(sx, 30); ctx.quadraticCurveTo(sx + 20, 80, ex, ey); ctx.stroke();
    ctx.strokeStyle = '#cfc8d8'; ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = '#efe9f6'; ctx.lineWidth = 3;
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + 14, ey + k * 7 + 6); ctx.stroke(); }
  }
  // head
  ctx.strokeStyle = OL; ctx.lineWidth = 3;
  ctx.fillStyle = '#ddd6e6';
  ctx.beginPath(); ctx.ellipse(10, -18, 36, 32, 0, 0, 6.283); ctx.fill(); ctx.stroke();
  // hair
  ctx.fillStyle = '#15121c';
  ctx.beginPath(); ctx.moveTo(-28, -16); ctx.quadraticCurveTo(-10, -62, 34, -46); ctx.quadraticCurveTo(10, -40, -4, -20); ctx.quadraticCurveTo(-18, 10, -34, 24); ctx.closePath(); ctx.fill();
  // eyes
  ctx.fillStyle = '#0b0910';
  ctx.beginPath(); ctx.ellipse(18, -26, 7, 9, 0, 0, 6.283); ctx.ellipse(36, -24, 5, 8, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#ff7ad9'; ctx.beginPath(); ctx.arc(19, -26, 2, 0, 6.283); ctx.arc(36, -24, 1.6, 0, 6.283); ctx.fill();
  // grin
  const m = 6 + mouth * 14;
  ctx.fillStyle = '#4a0f1e';
  ctx.beginPath(); ctx.moveTo(4, -6); ctx.quadraticCurveTo(26, -6 + m, 44, -10); ctx.quadraticCurveTo(26, -2, 4, -6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 6; i++) { const tx = 8 + i * 6; ctx.beginPath(); ctx.moveTo(tx, -6); ctx.lineTo(tx + 3, -1 + m * 0.3); ctx.lineTo(tx + 6, -7); ctx.fill(); }
  ctx.restore();
}

/* ---------------------------------------------------------------- shared technique builders */

// A column / spike that erupts from the ground after a telegraph.
function eruption(f, x, o) {
  const y = o.y ?? FLOOR;
  return spawnSummon(f, {
    x, y, life: o.delay + (o.dur || 24), delay: o.delay, w: o.w || 70, h: o.h || 160, kind: o.kind || 'fire', layer: o.layer || 'front',
    tick(e, t) {
      if (e.age !== e.delay) return;
      Sound.play(o.sfx || 'boom'); FX.shake(o.shake || 6);
      FX.debris(e.x, e.y, o.debris || '#5a4a3a', 8, 9);
      if (e.kind === 'fire') FX.explosion(e.x, e.y - 40, 40, ['#fff3b0', '#ff9a2a', '#ff3a1a']);
      if (t && U.overlap({ x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h }, t.hurtbox()))
        Combat.hit(f, t, Object.assign({ x: e.x, y: t.midY, dir: t.x >= f.x ? 1 : -1 }, o.hits));
    },
    render(ctx, e) {
      if (e.age < e.delay) {
        const k = e.age / e.delay;
        ctx.save(); ctx.globalAlpha = 0.35 + 0.4 * Math.sin(e.age * 0.6) ** 2;
        ctx.fillStyle = o.tele || '#ff5a2a';
        ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, e.w * 0.6 * (0.5 + k * 0.5), 7, 0, 0, 6.283); ctx.fill();
        ctx.restore();
        return;
      }
      const k = Math.min(1, (e.age - e.delay) / 5), fade = Math.min(1, (e.life - e.age) / 10);
      ctx.save(); ctx.globalAlpha = fade;
      const h = e.h * k;
      if (e.kind === 'fire') {
        const g = ctx.createLinearGradient(0, e.y - h, 0, e.y);
        g.addColorStop(0, 'rgba(255,240,180,0)'); g.addColorStop(0.3, '#ffb03a'); g.addColorStop(1, '#ff3a1a');
        ctx.fillStyle = g; ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.moveTo(e.x - e.w / 2, e.y); ctx.quadraticCurveTo(e.x - e.w * 0.3, e.y - h * 0.6, e.x, e.y - h);
        ctx.quadraticCurveTo(e.x + e.w * 0.3, e.y - h * 0.6, e.x + e.w / 2, e.y); ctx.fill();
        if (Math.random() < 0.6) FX.glow(e.x + U.rand(-20, 20), e.y - U.rand(0, h), '#ff7a2a', 14, 14, 0, -2);
      } else {
        const fill = e.kind === 'root' ? '#6b4a2b' : e.kind === 'shadow' ? '#0c0a14' : e.kind === 'bamboo' ? '#6fae4a' : '#9aa5b0';
        const edge = e.kind === 'root' ? '#2a1a0c' : e.kind === 'shadow' ? '#9b6bff' : e.kind === 'bamboo' ? '#2a4a1a' : '#3a4048';
        ctx.fillStyle = fill; ctx.strokeStyle = edge; ctx.lineWidth = 2.5;
        for (let i = -2; i <= 2; i++) {
          const sx = e.x + i * e.w * 0.18, sh = h * (1 - Math.abs(i) * 0.22);
          ctx.beginPath(); ctx.moveTo(sx - 10, e.y); ctx.lineTo(sx + i * 4, e.y - sh); ctx.lineTo(sx + 10, e.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        if (e.kind === 'root') { ctx.fillStyle = '#8fc45a'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(e.x + (i - 1.5) * 14, e.y - h * 0.6 + i * 9, 6, 3, i, 0, 6.283); ctx.fill(); } }
      }
      ctx.restore();
    },
  });
}

function makeDog(f, o) {
  return spawnSummon(f, {
    x: o.x, y: FLOOR, dir: o.dir, color: o.color, speed: o.speed, life: o.life, delay: o.delay || 0,
    name: 'DIVINE DOG', hp: 70, maxHp: 70, hurtbox: e => ({ x: e.x - 28, y: e.y - 52, w: 56, h: 52 }),
    bites: o.bites || 2, cool: 0, layer: 'front',
    tick(e, t) {
      if (e.age < e.delay) { e.vx = 0; return; }
      if (e.age === e.delay) { FX.smoke(e.x, e.y - 10, '#1a1028', 6, 14, 14); Sound.play('bark'); }
      if (!t || t.state === 'ko') { e.vx *= 0.9; return; }
      e.cool--;
      if (e.cool <= 0) { e.dir = t.x >= e.x ? 1 : -1; e.vx = U.lerp(e.vx, e.dir * e.speed, 0.25); }
      else e.vx *= 0.9;
      const box = { x: e.x - 28, y: e.y - 50, w: 56, h: 50 };
      if (e.cool <= 0 && e.bites > 0 && U.overlap(box, t.hurtbox())) {
        const r = Combat.hit(f, t, { dmg: o.dmg || 38, kb: 6, kby: -3, stun: 22, sfx: 'bite', x: e.x + e.dir * 22, y: e.y - 36, dir: e.dir });
        if (r !== 'miss') { e.bites--; e.cool = 32; e.vx = -e.dir * 6; if (e.bites <= 0) e.life = Math.min(e.life, e.age + 22); }
      }
    },
    onEnd(e) { FX.smoke(e.x, e.y - 20, '#1a1028', 6, 16, 14); },
    render(ctx, e) {
      if (e.age < e.delay) return;
      const fade = Math.min(1, (e.life - e.age) / 12, (e.age - e.delay) / 6);
      drawDog(ctx, e.x, e.y, e.dir, e.color, e.age, fade);
    },
  });
}

function nueStrike(f, x, delay, hits) {
  return spawnSummon(f, {
    x, y: FLOOR, life: delay + 12, layer: 'front',
    tick(e, t) {
      if (e.age < delay && t) e.x = U.lerp(e.x, t.x, 0.03);
      if (e.age !== delay) return;
      Sound.play('zap'); FX.flash('#fff6c0', 0.25);
      for (let i = 0; i < 3; i++) FX.bolt(e.x + U.rand(-8, 8), 0, e.x + U.rand(-10, 10), FLOOR, i ? '#ffe86a' : '#ffffff', 12, i ? 2 : 5);
      FX.spark(e.x, FLOOR - 10, '#ffe86a', 14, 7);
      if (t && t.state !== 'ko' && Math.abs(t.x - e.x) < 42 * t.scale)
        Combat.hit(f, t, Object.assign({ dmg: 55, kb: 2, stun: 36, fx: 'zap', sfx: 'zap', x: t.x, y: t.midY, dir: dirTo(f, t) }, hits));
    },
    render(ctx, e) {
      if (e.age >= delay) return;
      ctx.save(); ctx.globalAlpha = 0.25 + 0.3 * Math.sin(e.age * 0.7) ** 2;
      ctx.fillStyle = '#ffe86a';
      ctx.beginPath(); ctx.ellipse(e.x, FLOOR + 2, 36, 6, 0, 0, 6.283); ctx.fill();
      ctx.restore();
    },
  });
}

/* ---------------------------------------------------------------- domain backgrounds */

function drawVoidBg(ctx, d, a) {
  if (!d.stars) d.stars = Array.from({ length: 140 }, () => ({ a: Math.random() * 6.283, r: Math.random() * 900, v: U.rand(4, 16), l: U.rand(10, 60) }));
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = '#01020a'; ctx.fillRect(-30, -30, W + 60, H + 60);
  const cx = W / 2, cy = 330;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 520);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.08, 'rgba(180,230,255,0.6)'); g.addColorStop(0.4, 'rgba(60,90,200,0.15)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#cfefff'; ctx.lineWidth = 1.5;
  for (const s of d.stars) {
    s.r += s.v; if (s.r > 900) s.r = 0;
    const x = cx + Math.cos(s.a) * s.r, y = cy + Math.sin(s.a) * s.r * 0.7;
    ctx.globalAlpha = a * Math.min(1, s.r / 200);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(s.a) * s.l, y + Math.sin(s.a) * s.l * 0.7); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * 0.6;
  ctx.strokeStyle = '#9fe2ff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, FLOOR); ctx.lineTo(W, FLOOR); ctx.stroke();
  ctx.restore();
}

function drawShrineBg(ctx, d, a) {
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a0206'); g.addColorStop(0.6, '#4a0812'); g.addColorStop(1, '#14020a');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  ctx.fillStyle = '#ff3a3a'; ctx.globalAlpha = a * 0.8;
  ctx.beginPath(); ctx.arc(W / 2, 170, 70, 0, 6.283); ctx.fill();
  ctx.globalAlpha = a;
  // shrine silhouette
  const cx = W / 2;
  ctx.fillStyle = '#090003';
  ctx.fillRect(cx - 170, 420, 340, 200);
  for (let i = -3; i <= 3; i++) ctx.fillRect(cx + i * 50 - 6, 330, 12, 110);
  ctx.beginPath(); ctx.moveTo(cx - 260, 340); ctx.quadraticCurveTo(cx, 300, cx + 260, 340); ctx.lineTo(cx + 200, 300); ctx.quadraticCurveTo(cx, 250, cx - 200, 300); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 200, 290); ctx.quadraticCurveTo(cx, 200, cx + 200, 290); ctx.lineTo(cx + 120, 250); ctx.quadraticCurveTo(cx, 190, cx - 120, 250); ctx.closePath(); ctx.fill();
  // mouths & horns
  ctx.fillStyle = '#2a0006';
  for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc(cx - 230 + i * 27, 600 - (i % 3) * 8, 14, 0, 6.283); ctx.fill(); }
  ctx.strokeStyle = '#090003'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(cx - 150, 260); ctx.quadraticCurveTo(cx - 230, 200, cx - 200, 120); ctx.moveTo(cx + 150, 260); ctx.quadraticCurveTo(cx + 230, 200, cx + 200, 120); ctx.stroke();
  // blood water
  ctx.fillStyle = 'rgba(120,0,16,0.75)'; ctx.fillRect(-30, FLOOR, W + 60, H - FLOOR + 30);
  ctx.strokeStyle = 'rgba(255,80,80,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) { const y = FLOOR + 10 + i * 12; ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.02 + d.age * 0.08 + i) * 3); ctx.stroke(); }
  ctx.restore();
}

function drawShadowBg(ctx, d, a) {
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = '#05030b'; ctx.fillRect(-30, -30, W + 60, H + 60);
  const g = ctx.createRadialGradient(W / 2, FLOOR, 50, W / 2, FLOOR, 700);
  g.addColorStop(0, 'rgba(90,50,160,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // drifting eyes in the dark
  for (let i = 0; i < 10; i++) {
    const x = (i * 137 + d.age * 0.3) % W, y = 120 + (i * 71) % 380, blink = Math.sin(d.age * 0.05 + i) > -0.8;
    if (!blink) continue;
    ctx.fillStyle = 'rgba(200,170,255,0.5)';
    ctx.beginPath(); ctx.ellipse(x, y, 6, 2.5, 0, 0, 6.283); ctx.ellipse(x + 18, y, 6, 2.5, 0, 0, 6.283); ctx.fill();
  }
  // liquid shadow floor
  ctx.fillStyle = '#000'; ctx.fillRect(-30, FLOOR - 4, W + 60, H - FLOOR + 40);
  ctx.strokeStyle = 'rgba(155,107,255,0.55)'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = FLOOR + i * 16;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.03 + d.age * 0.1 + i * 2) * 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVolcanoBg(ctx, d, a) {
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a0400'); g.addColorStop(0.7, '#6a1800'); g.addColorStop(1, '#2a0800');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  // the crater walls closing in
  ctx.fillStyle = '#120402';
  ctx.beginPath(); ctx.moveTo(-30, -30); ctx.lineTo(260, -30); ctx.lineTo(120, FLOOR); ctx.lineTo(-30, FLOOR); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W + 30, -30); ctx.lineTo(W - 260, -30); ctx.lineTo(W - 120, FLOOR); ctx.lineTo(W + 30, FLOOR); ctx.fill();
  ctx.strokeStyle = 'rgba(255,120,40,0.6)'; ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const x = 40 + i * 190, w = Math.sin(d.age * 0.05 + i) * 6;
    ctx.beginPath(); ctx.moveTo(x, 80 + i * 20); ctx.lineTo(x + 20 + w, 220 + i * 30); ctx.lineTo(x - 10, 360 + i * 20); ctx.stroke();
  }
  // lava floor
  const lg = ctx.createLinearGradient(0, FLOOR, 0, H);
  lg.addColorStop(0, '#ffb03a'); lg.addColorStop(0.3, '#ff5a1a'); lg.addColorStop(1, '#5a0a00');
  ctx.fillStyle = lg; ctx.fillRect(-30, FLOOR, W + 60, H - FLOOR + 30);
  ctx.fillStyle = 'rgba(255,240,180,0.6)';
  for (let i = 0; i < 9; i++) { const x = (i * 151 + d.age * 1.3) % W; ctx.beginPath(); ctx.ellipse(x, FLOOR + 20 + (i % 3) * 18, 26, 4, 0, 0, 6.283); ctx.fill(); }
  ctx.restore();
}

function drawSwordFieldBg(ctx, d, a) {
  if (!d.blades) d.blades = Array.from({ length: 90 }, (_, i) => ({ x: (i * 157) % (W + 80) - 40, y: FLOOR - 10 + (i % 7) * 12, tilt: ((i * 37) % 30 - 15) * DEG, h: 50 + (i * 23) % 60 }));
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a1630'); g.addColorStop(0.6, '#b85a8a'); g.addColorStop(1, '#3a1a30');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  // a huge pale ring hanging in the sky
  ctx.strokeStyle = 'rgba(255,230,245,0.55)'; ctx.lineWidth = 14;
  ctx.beginPath(); ctx.ellipse(W / 2, 200, 170, 60, 0, 0, 6.283); ctx.stroke();
  ctx.fillStyle = '#2a1a28'; ctx.fillRect(-30, FLOOR, W + 60, H - FLOOR + 30);
  // the plain of blades
  for (const b of d.blades) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.tilt);
    ctx.strokeStyle = '#d8dce6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -b.h); ctx.stroke();
    ctx.strokeStyle = '#c9a23a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, -b.h + 10); ctx.lineTo(6, -b.h + 10); ctx.stroke();
    ctx.strokeStyle = '#2a1a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -b.h + 10); ctx.lineTo(0, -b.h - 4); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// Hanami's domain: a golden meadow of glowing grass that spreads outward from where it was cast.
function drawGrassSeaBg(ctx, d, a) {
  if (!d.blades) d.blades = Array.from({ length: 220 }, (_, i) => ({ x: (i * 37.3) % (W + 60) - 30, h: 30 + (i * 53) % 90, ph: i * 0.7, row: i % 4 }));
  if (!d.flowers) d.flowers = Array.from({ length: 40 }, (_, i) => ({ x: (i * 97.7) % W, y: FLOOR - 6 - (i * 29) % 70, c: ['#ffb3d9', '#ffffff', '#ffe08a', '#c8b0ff'][i % 4] }));
  const grow = Math.min(1, d.age / 70), R = 40 + grow * grow * 1600, fadeOut = Math.min(1, (d.life - d.age) / 25);
  ctx.save();
  ctx.beginPath(); ctx.arc(d.cx, d.cy, R, 0, 6.283); ctx.clip();
  ctx.globalAlpha = fadeOut;
  // luminous sky
  const sky = ctx.createLinearGradient(0, 0, 0, FLOOR);
  sky.addColorStop(0, '#6ac4d8'); sky.addColorStop(0.55, '#ffe9b8'); sky.addColorStop(1, '#fff6dc');
  ctx.fillStyle = sky; ctx.fillRect(-30, -30, W + 60, H + 60);
  // soft sun and its rays
  const sun = ctx.createRadialGradient(W / 2, 170, 10, W / 2, 170, 420);
  sun.addColorStop(0, 'rgba(255,255,235,0.95)'); sun.addColorStop(0.25, 'rgba(255,240,180,0.5)'); sun.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const an = -Math.PI / 2 + (i - 4) * 0.22 + Math.sin(d.age * 0.01 + i) * 0.03;
    ctx.fillStyle = 'rgba(255,245,200,0.07)';
    ctx.beginPath(); ctx.moveTo(W / 2, 170); ctx.lineTo(W / 2 + Math.cos(an - 0.05) * 1200, 170 - Math.sin(an - 0.05) * -1200); ctx.lineTo(W / 2 + Math.cos(an + 0.05) * 1200, 170 - Math.sin(an + 0.05) * -1200); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // rolling green hills of grass
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = ['#9ad86a', '#7cc458', '#5fae46'][k];
    ctx.beginPath(); ctx.moveTo(-30, FLOOR + 40);
    for (let x = -30; x <= W + 30; x += 40) ctx.lineTo(x, 430 + k * 55 + Math.sin(x * 0.006 + k * 2) * 26);
    ctx.lineTo(W + 30, FLOOR + 40); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#4f9a3a'; ctx.fillRect(-30, FLOOR, W + 60, H - FLOOR + 30);
  // shining grass blades swaying in the light
  ctx.lineCap = 'round';
  for (const b of d.blades) {
    const sway = Math.sin(d.age * 0.05 + b.ph) * 8, base = FLOOR + 6 - b.row * 6;
    ctx.strokeStyle = ['#bff58a', '#9ae070', '#d8ffa0', '#86d060'][b.row]; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x, base); ctx.quadraticCurveTo(b.x + sway * 0.4, base - b.h * 0.6, b.x + sway, base - b.h); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,255,200,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(b.x, base); ctx.quadraticCurveTo(b.x + sway * 0.4, base - b.h * 0.6, b.x + sway, base - b.h); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  // blossoms dotting the meadow
  for (const fl of d.flowers) {
    const bob = Math.sin(d.age * 0.06 + fl.x) * 2;
    ctx.fillStyle = fl.c;
    for (let i = 0; i < 5; i++) { const an = i / 5 * 6.283 + d.age * 0.01; ctx.beginPath(); ctx.arc(fl.x + Math.cos(an) * 4, fl.y + bob + Math.sin(an) * 4, 3, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(fl.x, fl.y + bob, 2.2, 0, 6.283); ctx.fill();
  }
  ctx.restore();
  // a bright glowing rim marks the edge as the domain sweeps outward
  if (grow < 1) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,240,180,0.85)'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.arc(d.cx, d.cy, R, 0, 6.283); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,255,160,0.5)'; ctx.lineWidth = 34; ctx.stroke();
    ctx.restore();
  }
}

function drawHandsBg(ctx, d, a) {
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b1a1c'); g.addColorStop(1, '#16302e');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  ctx.strokeStyle = 'rgba(160,230,210,0.35)'; ctx.fillStyle = 'rgba(160,230,210,0.12)'; ctx.lineWidth = 3;
  for (let i = 0; i < 22; i++) {
    const x = (i * 97) % W, y = 60 + ((i * 53) % 480), s = 1 + (i % 3) * 0.4, rot = Math.sin(d.age * 0.02 + i) * 0.3 + i;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 18, 0, 0, 6.283); ctx.fill(); ctx.stroke();
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 6, -14); ctx.lineTo(k * 7, -34 + Math.abs(k) * 4); ctx.stroke(); }
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(10,30,28,0.9)'; ctx.fillRect(-30, FLOOR, W + 60, H - FLOOR + 30);
  ctx.restore();
}

/* ---------------------------------------------------------------- Mahoraga (Megumi's summon) */

const MAHORAGA = {
  scale: 2.1, hipW: 12, shoulderW: 17,
  look: { skin: '#ece8dc', top: '#ece8dc', pants: '#2a2832', accent: '#ffffff', shoe: '#ece8dc' },
  drawHead(g) {
    const { ctx, sk, col, OL, o } = g, [hx, hy] = sk.head;
    // wings at the temples
    ctx.fillStyle = col('#f7f4ea'); ctx.strokeStyle = OL; ctx.lineWidth = 1.5;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + s * 4, hy - 6); ctx.lineTo(hx + s * 14 - 4, hy - 22); ctx.lineTo(hx + s * 10, hy - 4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    headCircle(g, hx, hy, 14, '#ece8dc');
    // the wheel of adaptation
    const wy = hy - 30, a0 = (o.wheel || 0) * DEG;
    ctx.strokeStyle = col('#c9a23a'); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(hx, wy, 12, 0, 6.283); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = a0 + i * Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(hx, wy); ctx.lineTo(hx + Math.cos(a) * 16, wy + Math.sin(a) * 16); ctx.stroke();
    }
    if (!o.white && !o.tint) { ctx.fillStyle = '#2a2a30'; ctx.fillRect(hx + 4, hy - 1, 9, 2); }
  },
  drawWeapon(g) {
    const { ctx, sk, col, OL } = g, e = sk.aF[1], h = sk.aF[2];
    let dx = h[0] - e[0], dy = h[1] - e[1];
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const tip = [h[0] + dx * 70, h[1] + dy * 70];
    ctx.strokeStyle = OL; ctx.lineWidth = 9; lineTo2(ctx, h, tip);
    ctx.strokeStyle = col('#d8e6f0'); ctx.lineWidth = 6; lineTo2(ctx, h, tip);
    ctx.strokeStyle = col('#ffffff'); ctx.lineWidth = 1.5; lineTo2(ctx, h, tip);
  },
};

// Freezes the fight for a close-up of the caster weaving their domain's hand sign.
function domainCutscene(f, sign, name, opts = {}) {
  World.cutscene = Object.assign({ f, def: f.def, sign, name, t: 150, max: 150, title: 'DOMAIN EXPANSION', kanji: '領域展開' }, opts);
  Sound.play('domain');
}

/* ---------------------------------------------------------------- Blood Manipulation (Choso, and Yuji) */

const BLOOD = '#c4122f';
// Yuji pays for blood techniques with his own blood; Choso's body regenerates it freely.
function bloodCost(f, n) {
  if (f.def.bloodFree) return;
  f.hp = Math.max(1, f.hp - n);
  FX.blood(f.x, f.midY, 6, -f.facing, 3);
}

function piercingBloodMove(o) {
  const fire = o.startup;
  return {
    id: o.id || 'piercing', kind: o.kind || 'special', startup: fire, active: 1, recovery: o.recovery || 20,
    getPose: (f, fr) => (fr < fire ? POSES.sign : POSES.cast),
    onStart(f) {
      bloodCost(f, o.hp || 0);
      if (o.onStart) o.onStart(f);
      FX.text(f.x, f.y - 190, o.say || 'Piercing Blood', '#ff6a7a', o.big ? 26 : 18, 50);
    },
    onFrame(f, fr, t) {
      if (o.big) f.invuln = Math.max(f.invuln, 2);
      const hp = handPos(f);
      if (fr < fire) {
        // blood compressed between the palms
        if (fr % 2 === 0) FX.glow(hp.x + U.rand(-40, 40) * (1 - fr / fire), hp.y + U.rand(-40, 40) * (1 - fr / fire), BLOOD, o.big ? 16 : 9, 8);
        return;
      }
      if (fr !== fire) return;
      Sound.play(o.big ? 'purple' : 'zap'); FX.shake(o.big ? 18 : 6);
      if (o.big) FX.flash(BLOOD, 0.35);
      const y = hp.y, w = o.width || 22;
      spawnSummon(f, { life: o.big ? 30 : 14, x0: hp.x, y, dir: f.facing, w, render(ctx, e) {
        const k = 1 - e.age / e.life, x1 = e.dir > 0 ? W + 40 : -40;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(196,18,47,${0.8 * k})`; ctx.fillRect(Math.min(e.x0, x1), e.y - e.w * k, Math.abs(x1 - e.x0), e.w * 2 * k);
        ctx.fillStyle = `rgba(255,220,220,${k})`; ctx.fillRect(Math.min(e.x0, x1), e.y - e.w * 0.3 * k, Math.abs(x1 - e.x0), e.w * 0.6 * k);
        ctx.restore();
      } });
      if (t && t.state !== 'ko' && (t.x - f.x) * f.facing > 0 && Math.abs(t.midY - y) < 70 + w)
        Combat.hit(f, t, Object.assign({ kb: 8, kby: -4, stun: 26, hitstop: 8, fx: 'red', sfx: 'heavy', chip: 0.2, blood: 14, x: t.x, y, dir: f.facing }, o.hit));
    },
  };
}

function supernovaMove(o) {
  return {
    id: 'supernova', kind: 'special', startup: 18, active: 1, recovery: 20, poses: ['sign', 'cast'],
    onStart(f) { bloodCost(f, o.hp || 0); FX.text(f.x, f.y - 190, 'Supernova', '#ff6a7a', 18, 50); },
    onFrame(f, fr) {
      if (fr !== 18) return;
      Sound.play('charge');
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.55;
        spawnProj(f, {
          x: f.x + Math.cos(a) * 60, y: f.midY + Math.sin(a) * 60 - 20, r: 12, life: 110, clash: 1, wallKill: false, i,
          hits: { dmg: o.dmg || 30, kb: 5, kby: -4, stun: 18, fx: 'red', blood: 5 },
          tick(e, t) {
            if (e.age < 16 + e.i * 3) { e.vx = 0; e.vy = 0; return; }
            if (!e.launched && t) { const ang = Math.atan2(t.midY - e.y, t.x - e.x); e.vx = Math.cos(ang) * 12; e.vy = Math.sin(ang) * 12; e.launched = true; Sound.play('whoosh'); }
            if (e.age % 2 === 0) FX.glow(e.x, e.y, BLOOD, 9, 8);
          },
          onEnd(e) { FX.explosion(e.x, e.y, 30, ['#ffd0d0', '#ff3a4a', BLOOD]); FX.blood(e.x, e.y, 6, 0, 4); },
          render(ctx, e) { glowOrb(ctx, e.x, e.y, e.r, '#ffd0d0', BLOOD); },
        });
      }
    },
  };
}

function redScaleMove(o) {
  return {
    id: 'redscale', kind: 'special', startup: 16, active: 1, recovery: 10, poses: ['block', 'win'],
    onFrame(f, fr) {
      if (fr !== 16) return;
      bloodCost(f, o.hp || 0);
      f.buffs.redscale = o.frames || 480;
      Sound.play('heal'); FX.ring(f.x, f.y - 80, BLOOD, 90, 20, 5); FX.spark(f.x, f.y - 80, '#ff6a7a', 14, 6);
      FX.text(f.x, f.y - 195, 'Flowing Red Scale', '#ff6a7a', 20, 60);
    },
  };
}

// The technique Yuta's Copy would use right now.
function copyTarget(f) {
  if (f.copied) return f.copied;
  const o = World.opp(f);
  return o ? o.abilities.find(a => a && !a.ult && !a.copy) || null : null;
}

/* ---------------------------------------------------------------- GOJO */

const GOJO = {
  id: 'gojo', name: 'Satoru Gojo', short: 'GOJO', title: 'The Strongest', kanji: '五条悟', color: '#6fd3ff',
  style: 'Long-range attacks, teleportation and overwhelming cursed techniques.',
  bio: 'The strongest jujutsu sorcerer alive. His Limitless technique bends space itself, and his dash is an instant teleport.',
  passive: { name: 'Infinity', desc: 'Automatically softens incoming hits by 45% and halves knockback, draining 2 cursed energy per hit. While Gojo blocks, every nearby opponent and projectile slows to a crawl.' },
  dash: 'teleport', ceRegen: 1.2, hp: 1150, speed: 1.1, infinityBlock: true,
  melee: { power: 1.2 },
  look: { skin: '#f3d6c0', top: '#1c2235', pants: '#161a29', accent: '#6fd3ff' },
  aiStyle: { pref: 260, ranged: true },
  onIncoming(f, dmg, h) {
    if (f.ce >= 2 && h.type !== 'domain' && !h.unblockable && f.state !== 'stun') {
      f.ce -= 2; FX.infinity(f);
      return { dmg: dmg * 0.55, kb: 0.5 };
    }
    return { dmg };
  },
  drawHair(g, hx, hy, r) {
    const { ctx, col, o } = g;
    drawSpikyHair(g, hx, hy, r, [[-55, 7, 14], [-30, 12, 12], [-5, 16, 12], [20, 15, 12], [45, 13, 12], [72, 10, 13], [100, 6, 13]], '#f4f6ff');
    if (o.white || o.tint) return;
    const f = o.fighter;
    if (f && f.eyesOpen > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#7fe3ff';
      ctx.beginPath(); ctx.arc(hx + 6.5, hy + 1.5, 2.6, 0, 6.283); ctx.arc(hx + 12, hy + 1.5, 2.2, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(hx + 9, hy + 1.5, 9, 0, 6.283); ctx.fill();
      ctx.restore();
    } else {
      ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, r + 0.5, 0, 6.283); ctx.clip();
      ctx.fillStyle = col('#0e0e14'); ctx.fillRect(hx - r - 2, hy - 4, r * 2 + 4, 8);
      ctx.restore();
      ctx.strokeStyle = '#0e0e14'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hx - r + 1, hy); ctx.lineTo(hx - r - 9, hy + 7); ctx.moveTo(hx - r + 1, hy + 2); ctx.lineTo(hx - r - 6, hy + 12); ctx.stroke();
    }
  },
  drawTorso(g) {
    const { ctx, sk, col } = g;
    ctx.strokeStyle = col('#0c0f1a'); ctx.lineWidth = 7;
    lineTo2(ctx, sk.sh, [sk.sh[0] + sk.td[0] * 5, sk.sh[1] + sk.td[1] * 5]);
  },
  abilities: [
    {
      name: 'Lapse Blue', icon: '蒼', color: '#3fa9ff', cost: 18, cd: 160, ai: { min: 120, max: 650 },
      desc: 'An attractive orb that drags the opponent into its center and grinds them.',
      move: {
        id: 'blue', kind: 'special', startup: 12, active: 1, recovery: 18, poses: ['castW', 'point'], sfx: 'charge',
        onFrame(f, fr) {
          if (fr !== 12) return;
          Sound.play('blue');
          spawnSummon(f, {
            x: U.clamp(f.x + f.facing * 210, World.left + 40, World.right - 40), y: f.y - 105, vx: f.facing * 1.4, r: 24, life: 90,
            tick(e, t) {
              if (t && t.state !== 'ko' && t.invuln <= 0) {
                const dx = e.x - t.x, dy = e.y - t.midY, d = Math.hypot(dx, dy);
                if (d < 430 && d > 18) {
                  const pull = 3 * (1 - d / 500);
                  t.x += Math.sign(dx) * Math.min(Math.abs(dx), pull * 1.7);
                  if (!t.onGround && !t.frozen) t.vy += Math.sign(dy) * 0.35;
                  t.clampWalls();
                }
                if (Math.abs(dx) < 52 && Math.abs(dy) < 95 && e.age % 8 === 0)
                  Combat.hit(f, t, { dmg: 11, kb: 0, stun: 14, hitstop: 0, sfx: 'tick', noScale: true, quiet: true, fx: 'blue', x: e.x, y: e.y, dir: dx >= 0 ? 1 : -1 });
              }
              if (e.age % 2 === 0) {
                const a = Math.random() * 6.283, rr = 60 + Math.random() * 50;
                FX.add({ type: 'spark', x: e.x + Math.cos(a) * rr, y: e.y + Math.sin(a) * rr, vx: -Math.cos(a) * 4.5, vy: -Math.sin(a) * 4.5, life: 14, size: 2, color: '#7cc8ff' });
              }
            },
            onEnd(e) {
              FX.ring(e.x, e.y, '#5fb8ff', 90); FX.spark(e.x, e.y, '#9fd8ff', 16, 7); Sound.play('boom');
              const t = e.target;
              if (near(t, e.x, e.y, 80, 110)) Combat.hit(f, t, { dmg: 30, kb: 6, kby: -6, launch: true, fx: 'blue', x: e.x, y: e.y, dir: dirTo(f, t) });
            },
            render(ctx, e) {
              const p = 1 + Math.sin(e.age * 0.4) * 0.08;
              glowOrb(ctx, e.x, e.y, e.r * p, '#ffffff', '#2d8bff');
              ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(130,200,255,0.6)'; ctx.lineWidth = 2;
              for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.3 + i * 0.4), e.age * 0.2 + i * 2, e.age * 0.2 + i * 2 + 2); ctx.stroke(); }
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Reversal Red', icon: '赫', color: '#ff4040', cost: 20, cd: 160, ai: { min: 0, max: 700 },
      desc: 'A violent repulsive blast that hurls the opponent across the arena.',
      move: {
        id: 'red', kind: 'special', startup: 16, active: 1, recovery: 16, poses: ['castW', 'point'],
        onFrame(f, fr) {
          const hp = handPos(f);
          if (fr < 16 && fr % 2 === 0) FX.glow(hp.x + U.rand(-30, 30), hp.y + U.rand(-30, 30), '#ff3030', 10, 8);
          if (fr !== 16) return;
          Sound.play('red'); FX.ring(hp.x, hp.y, '#ff4040', 50);
          f.vx = -f.facing * 4;
          spawnProj(f, {
            x: hp.x, y: hp.y, vx: f.facing * 16, r: 18, life: 75, clash: 2,
            hits: { dmg: 115, kb: 18, kby: -9, launch: true, hitstop: 9, shake: 10, fx: 'red', sfx: 'boom' },
            tick(e) { if (e.age % 2 === 0) FX.glow(e.x, e.y, '#ff2b2b', 14, 10); },
            onEnd(e, why) { if (why !== 'expire') FX.explosion(e.x, e.y, 40, ['#ffffff', '#ff4d4d', '#ffb3b3']); },
            render(ctx, e) { glowOrb(ctx, e.x, e.y, e.r, '#ffffff', '#ff2b2b'); },
          });
        },
      },
    },
    {
      name: 'Hollow Purple', icon: '茈', color: '#b65cff', cost: 45, cd: 400, ai: { min: 0, max: 1000 },
      desc: 'Collides Blue and Red into imaginary mass — a slow, unstoppable sphere of devastation.',
      move: {
        id: 'purple', kind: 'special', startup: 46, active: 1, recovery: 24,
        getPose: (f, fr) => (fr < 46 ? POSES.charge : POSES.cast),
        onStart(f) {
          f.eyesOpen = 90; Sound.play('charge');
          FX.text(f.x, f.y - 185, 'Imaginary Technique...', '#d9b3ff', 18, 60);
          spawnSummon(f, {
            life: 50,
            tick(e) { if (!f.move || f.move.id !== 'purple') e.kill(); },
            render(ctx) {
              if (!f.move) return;
              const t = Math.min(1, f.mf / 44), s = f.scale;
              const bx = f.x + f.facing * U.lerp(120, 60, t) * s, by = f.y - U.lerp(160, 115, t) * s;
              const rx = f.x + f.facing * U.lerp(-60, 60, t) * s, ry = f.y - U.lerp(80, 115, t) * s;
              glowOrb(ctx, bx, by, 14, '#fff', '#2d8bff');
              glowOrb(ctx, rx, ry, 14, '#fff', '#ff2b2b');
              if (t > 0.8) glowOrb(ctx, (bx + rx) / 2, (by + ry) / 2, 30 * (t - 0.6), '#fff', '#a040ff');
            },
          });
        },
        onFrame(f, fr) {
          if (fr !== 46) return;
          const cx = f.x + f.facing * 60, cy = f.y - 115;
          FX.slow(30, 0.35); FX.flash('#b65cff', 0.35); FX.shake(10); Sound.play('purple');
          f.vx = -f.facing * 6;
          spawnProj(f, {
            x: cx, y: cy, vx: f.facing * 8.5, r: 52, life: 170, pierce: true, clash: 99, big: true, wallKill: false,
            hits: { dmg: 290, kb: 19, kby: -13, launch: true, hitstop: 15, shake: 18, fx: 'purple', sfx: 'boom' },
            tick(e) {
              if (e.age % 2 === 0) FX.spark(e.x - e.vx * 3, e.y, U.pick(['#c070ff', '#ff70d0', '#7070ff']), 3, 4, 3, 22);
              if (e.age % 6 === 0) FX.debris(e.x, FLOOR, '#4a3a5a', 1, 5);
            },
            render(ctx, e) {
              glowOrb(ctx, e.x, e.y, e.r * (1 + Math.sin(e.age * 0.5) * 0.05), '#ffffff', '#9a3cff');
              ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,170,255,0.7)'; ctx.lineWidth = 3;
              ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.9, e.age * 0.3, e.age * 0.3 + 4); ctx.stroke();
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Infinite Void', icon: '無', color: '#e6f7ff', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'DOMAIN EXPANSION. The opponent drowns in infinite information and cannot move. Ends with a finishing blast.',
      move: {
        id: 'void', kind: 'ult', startup: 60, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) {
          f.invuln = 70; f.eyesOpen = 420; domainCutscene(f, 'void', 'INFINITE VOID');
          FX.banner('DOMAIN EXPANSION', 'INFINITE VOID', '#9fe2ff', 130); FX.slow(40, 0.35); Sound.play('charge');
        },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 40) return;
          Domains.start(f, {
            type: 'void', life: 250, bg: drawVoidBg,
            onStart(d, t) {
              if (!t || t.state === 'ko') return;
              t.applyStun(205, true, true);
              FX.text(t.x, t.y - 185, 'OVERLOADED', '#bfefff', 26, 80);
            },
            tick(d, t) {
              if (d.age % 3 === 0) FX.add({ type: 'spark', x: U.rand(0, W), y: U.rand(0, FLOOR), vx: 0, vy: 0, life: 20, size: 2, color: '#e0f6ff' });
              if (d.age !== 200 || !t || t.state === 'ko') return;
              t.stun = 0; t.frozen = false; t.setState('idle');
              FX.explosion(t.x, t.midY, 140, ['#ffffff', '#b8f0ff', '#6fd3ff']); FX.flash('#fff', 0.9); FX.shake(18);
              Combat.hit(f, t, { dmg: 240, kb: 15, kby: -15, launch: true, unblockable: true, sureHit: true, noScale: true, hitstop: 16, fx: 'purple', type: 'domain', x: t.x, y: t.midY, dir: dirTo(f, t) });
              Sound.play('boom');
            },
          });
        },
      },
    },
    {
      name: 'Blink Strike', icon: '瞬', color: '#9fe2ff', cost: 15, cd: 150, ai: { min: 120, max: 900 },
      desc: 'Teleports directly behind the opponent and unloads a three-hit combo before they can turn around.',
      move: {
        id: 'blink', kind: 'special', startup: 6, active: 0, recovery: 0, total: 44,
        getPose: (f, fr) => (fr < 8 ? POSES.dash : fr < 15 ? POSES.jab : fr < 23 ? POSES.cross : fr < 34 ? POSES.kick : POSES.idle),
        onFrame(f, fr, t) {
          if (!t) return;
          if (fr === 6) {
            FX.ring(f.x, f.y - 80, '#8fdcff', 50, 14, 3); FX.spark(f.x, f.y - 80, '#bfeaff', 10, 5);
            f.x = t.x - t.facing * 62; f.clampWalls();
            if (!t.onGround) { f.y = t.y; f.vy = 0; f.onGround = false; }
            f.facing = t.x >= f.x ? 1 : -1; f.vx = 0;
            FX.ring(f.x, f.y - 80, '#8fdcff', 50, 14, 3); Sound.play('teleport');
          }
          if (!f.onGround) f.vy = Math.min(f.vy, 0.5);
          const hit = (dmg, extra) => {
            if (Math.abs(t.x - f.x) < 115 && Math.abs(t.midY - f.midY) < 110)
              Combat.hit(f, t, Object.assign({ dmg, kb: 3, stun: 22, melee: true, dir: f.facing, x: t.x - f.facing * 12, y: t.midY - 20 }, extra));
          };
          if (fr === 10) hit(30);
          if (fr === 17) hit(32);
          if (fr === 26) hit(60, { kb: 13, kby: -9, launch: true, hitstop: 8, shake: 7, fx: 'blue' });
        },
      },
    },
    {
      name: 'Blue: Maximum Output', icon: '極', color: '#2d8bff', cost: 40, cd: 420, ai: { min: 0, max: 1100 },
      desc: 'A colossal Blue torn open right on top of the opponent. It drags them — and the arena\'s debris — into its core, then implodes.',
      move: {
        id: 'bluemax', kind: 'special', startup: 30, active: 1, recovery: 24,
        getPose: (f, fr) => (fr < 30 ? POSES.charge : POSES.point),
        onStart(f) { f.eyesOpen = 120; FX.text(f.x, f.y - 190, '"Maximum Output."', '#9fd8ff', 20, 55); Sound.play('charge'); },
        onFrame(f, fr, t) {
          if (fr !== 30 || !t) return;
          Sound.play('blue'); FX.flash('#2d8bff', 0.25); FX.shake(8);
          spawnSummon(f, {
            x: U.clamp(t.x, World.left + 60, World.right - 60), y: Math.min(t.midY, FLOOR - 90), r: 46, life: 100,
            tick(e, tt) {
              if (e.age % 2 === 0) {
                const a = Math.random() * 6.283, rr = 140 + Math.random() * 120;
                FX.add({ type: 'spark', x: e.x + Math.cos(a) * rr, y: e.y + Math.sin(a) * rr, vx: -Math.cos(a) * 9, vy: -Math.sin(a) * 9, life: 16, size: 3, color: U.pick(['#7cc8ff', '#2d8bff', '#ffffff']) });
              }
              if (e.age % 5 === 0) FX.debris(e.x + U.rand(-250, 250), FLOOR, '#4a4a5a', 1, 6);
              if (!tt || tt.state === 'ko' || tt.invuln > 0) return;
              const dx = e.x - tt.x, dy = e.y - tt.midY, d = Math.hypot(dx, dy);
              if (d < 650 && d > 14) {
                tt.x += Math.sign(dx) * Math.min(Math.abs(dx), 5.5 * (1 - d / 750) + 1);
                if (!tt.frozen) tt.vy += Math.sign(dy) * 0.6;
                tt.clampWalls();
              }
              if (d < 90 && e.age % 6 === 0)
                Combat.hit(f, tt, { dmg: 10, kb: 0, stun: 12, hitstop: 0, sfx: 'tick', noScale: true, quiet: true, fx: 'blue', x: e.x, y: e.y, dir: dx >= 0 ? 1 : -1 });
            },
            onEnd(e) {
              FX.explosion(e.x, e.y, 130, ['#ffffff', '#7cc8ff', '#2d8bff']); FX.shake(16); Sound.play('boom');
              const tt = e.target;
              if (near(tt, e.x, e.y, 140, 150)) Combat.hit(f, tt, { dmg: 95, kb: 12, kby: -14, launch: true, fx: 'blue', hitstop: 12, x: e.x, y: e.y, dir: dirTo(f, tt) });
            },
            render(ctx, e) {
              const p = 1 + Math.sin(e.age * 0.5) * 0.06, grow = Math.min(1, e.age / 12);
              glowOrb(ctx, e.x, e.y, e.r * p * grow, '#ffffff', '#1f6bff');
              ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(130,200,255,0.55)'; ctx.lineWidth = 3;
              for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r * grow * (1.5 + i * 0.6), -e.age * 0.25 + i * 1.6, -e.age * 0.25 + i * 1.6 + 2.2); ctx.stroke(); }
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Teleport', icon: '移', color: '#bfeaff', cost: 8, cd: 80, ai: { min: 380, max: 1280 },
      desc: 'Instant long-range teleport. Hold a direction to blink far that way, hold Up to appear in the air above the opponent, or hold nothing to reappear on the opponent\'s other side.',
      move: {
        id: 'teleport', kind: 'special', startup: 3, active: 0, recovery: 10, poses: ['sign', 'idle'],
        onFrame(f, fr, t) {
          if (fr !== 3) return;
          const h = World.active && f.input ? f.input.held : {};
          FX.ring(f.x, f.y - 80, '#8fdcff', 60, 16, 3); FX.spark(f.x, f.y - 80, '#bfeaff', 12, 6); FX.ghost(f, '#8fdcff');
          if (h.up && t) { f.x = t.x - f.facing * 20; f.y = Math.min(f.y, t.y - 190); f.vy = -2; f.onGround = false; }
          else if (h.left || h.right) f.x += (h.right ? 1 : -1) * 420;
          else if (t) f.x = t.x + (t.x >= f.x ? 1 : -1) * 75;
          f.clampWalls(); f.vx = 0; f.invuln = Math.max(f.invuln, 12);
          if (t) f.facing = t.x >= f.x ? 1 : -1;
          FX.ring(f.x, f.y - 80, '#8fdcff', 60, 16, 3); Sound.play('teleport');
        },
      },
    },
    {
      name: 'Reverse Cursed Technique', icon: '反', color: '#b6ffd8', cost: 45, cd: 900, ground: true, noCopy: true,
      ai: { min: 300, max: 1280, when: f => f.hp < f.maxHp * 0.5 },
      desc: 'Channels positive energy to regenerate his body — heals up to 200 health over a short channel. Getting hit interrupts it.',
      move: {
        id: 'rct', kind: 'special', startup: 50, active: 0, recovery: 8, poses: ['sign', 'idle'],
        onStart(f) { FX.text(f.x, f.y - 190, 'Reverse Cursed Technique', '#b6ffd8', 18, 50); Sound.play('heal'); },
        onFrame(f, fr) {
          if (fr >= 50) return;
          f.hp = Math.min(f.maxHp, f.hp + 4);
          if (fr % 2 === 0) FX.glow(f.x + U.rand(-26, 26), f.y - U.rand(10, 140), U.pick(['#b6ffd8', '#ffffff']), 12, 20, 0, -1.6);
          if (fr % 12 === 0) FX.ring(f.x, f.y - 80, '#b6ffd8', 70, 18, 2);
          if (fr === 49) { Sound.play('heal'); FX.text(f.x, f.y - 175, '+200', '#b6ffd8', 26, 45); }
        },
      },
    },
  ],
};

/* ---------------------------------------------------------------- SUKUNA */

const SUKUNA = {
  id: 'sukuna', name: 'Ryomen Sukuna', short: 'SUKUNA', title: 'King of Curses', kanji: '両面宿儺', color: '#ff3355',
  style: 'Aggressive close-range combat with devastating slashing attacks.',
  bio: 'The undisputed King of Curses. His Shrine technique carves through anything, and his claws turn every basic attack into a slash.',
  passive: { name: 'Calamity', desc: 'Sukuna always deals 20% more damage. Below 60% health it keeps rising — up to +80% as his life runs out.' },
  hp: 1300, speed: 1.12, ceRegen: 1.4,
  melee: { weapon: 'claw', power: 1.3, reach: 12 },
  look: { skin: '#f1cdb5', top: '#ece6da', pants: '#c9c0b0', accent: '#ff3355', eye: '#c4122f' },
  aiStyle: { pref: 70 },
  dmgMult(f) { const r = f.hp / f.maxHp; return r < 0.6 ? 1.4 + 0.4 * (1 - r / 0.6) : 1.2; },
  drawAura(ctx, f) {
    if (f.hp / f.maxHp >= 0.6 || f.state === 'ko') return;
    if (f.anim % 3 === 0) FX.glow(f.x + U.rand(-20, 20), f.y - U.rand(10, 140) * f.scale, '#ff1f3d', 12, 18, 0, -1.5);
  },
  drawHair(g, hx, hy, r) {
    const { ctx, col, o } = g;
    ctx.fillStyle = col('#3a2630');
    ctx.beginPath(); ctx.arc(hx, hy, r, 1.2, 2.9); ctx.lineTo(hx, hy); ctx.fill();
    drawSpikyHair(g, hx, hy, r, [[-45, 6, 14], [-15, 9, 12], [15, 11, 12], [45, 12, 12], [75, 9, 12]], '#f4a3b8');
    if (o.white || o.tint) return;
    ctx.strokeStyle = '#141018'; ctx.lineWidth = 1.6;
    lineTo2(ctx, [hx + 4, hy + 5], [hx + 13, hy + 5]);
    lineTo2(ctx, [hx + 2, hy + 8], [hx + 10, hy + 11]);
    lineTo2(ctx, [hx + 3, hy - 6], [hx + 10, hy - 7]);
    ctx.fillStyle = '#c4122f'; ctx.fillRect(hx + 6, hy + 2.5, 3, 1.5); ctx.fillRect(hx + 11, hy + 2.5, 2.5, 1.5);
  },
  drawTorso(g) {
    const { ctx, sk, col } = g;
    const k = 0.22, p = [sk.neck[0] * k, sk.neck[1] * k];
    ctx.strokeStyle = col('#1a1418'); ctx.lineWidth = 6;
    lineTo2(ctx, [p[0] - 10, p[1] + 1], [p[0] + 10, p[1] - 1]);
    ctx.strokeStyle = col('#5a1a24'); ctx.lineWidth = 6;
    lineTo2(ctx, [sk.sh[0] - 9, sk.sh[1] + 2], [sk.sh[0] + 4, sk.sh[1] + 10]);
  },
  abilities: [
    {
      name: 'Dismantle', icon: '解', color: '#ffffff', cost: 12, cd: 65, ai: { min: 80, max: 900 },
      desc: 'A nearly invisible flying slash that crosses the arena in an instant.',
      move: {
        id: 'dismantle', kind: 'special', startup: 9, active: 1, recovery: 12, poses: ['slashW', 'slash'],
        onFrame(f, fr) {
          if (fr !== 9) return;
          Sound.play('slash');
          spawnProj(f, {
            x: f.x + f.facing * 45, y: f.y - 100, vx: f.facing * 24, r: 26, life: 50, clash: 1,
            hits: { dmg: 85, kb: 5, stun: 24, fx: 'slash', sfx: 'slash', hitstop: 4 },
            render(ctx, e) {
              ctx.save(); ctx.globalCompositeOperation = 'lighter';
              ctx.globalAlpha = 0.3 + 0.3 * Math.abs(Math.sin(e.age * 0.9));
              ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
              ctx.beginPath(); ctx.arc(e.x - e.vx * 1.6, e.y, 34, -0.9, 0.9); ctx.stroke();
              ctx.globalAlpha *= 0.4; ctx.lineWidth = 7; ctx.stroke();
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Cleave', icon: '捌', color: '#ff3355', cost: 25, cd: 240, ai: { min: 0, max: 130 },
      desc: 'A close-range slash that adapts to its target — the more health they have left, the deeper it cuts.',
      move: {
        id: 'cleave', kind: 'special', startup: 12, active: 4, recovery: 22, lunge: 9,
        hitbox: { x: 0, y: -140, w: 108, h: 120 }, poses: ['slashW', 'slash'], swing: { color: '#ff3b5c', r: 98, w: 10 }, sfx: 'whoosh',
        hit: { dmgFn: (a, t) => 85 + t.hp * 0.25, kb: 9, kby: -7, launch: true, hitstop: 11, shake: 9, fx: 'cleave', sfx: 'slash', cleave: true, blood: 26 },
      },
    },
    {
      name: 'Flame Arrow', icon: '開', color: '#ff8a2a', cost: 40, cd: 400, ai: { min: 180, max: 1100 },
      desc: '"Open." Draws a bow of fire and looses an arrow that detonates in a massive explosion.',
      move: {
        id: 'fuga', kind: 'special', startup: 34, active: 1, recovery: 22, poses: ['bow', 'cast'],
        getPose: (f, fr) => (fr < 34 ? POSES.bow : POSES.cast),
        onStart(f) { FX.text(f.x, f.y - 185, '"Open."', '#ffb36a', 22, 50); Sound.play('fire'); },
        onFrame(f, fr) {
          const hp = handPos(f);
          if (fr < 34) { FX.glow(hp.x + U.rand(-26, 26), hp.y + U.rand(-26, 26), U.pick(['#ff9a2a', '#ff5a1a']), 10, 10); return; }
          if (fr !== 34) return;
          Sound.play('fire'); FX.shake(5); f.vx = -f.facing * 5;
          const explode = (e) => {
            FX.explosion(e.x, e.y, 120, ['#fff3b0', '#ff9a2a', '#ff3a1a']); FX.shake(14); FX.flash('#ff8a2a', 0.3);
            Sound.play('boom');
            const t = e.target;
            if (near(t, e.x, e.y, 150, 150)) Combat.hit(f, t, { dmg: 200, kb: 15, kby: -13, launch: true, fx: 'fire', hitstop: 10, x: t.x, y: t.midY, dir: dirTo({ x: e.x }, t) });
          };
          spawnProj(f, {
            x: hp.x, y: hp.y, vx: f.facing * 13, r: 20, life: 110, clash: 3, big: true,
            hits: { dmg: 60, kb: 6, kby: -6, launch: true, fx: 'fire' },
            tick(e) { FX.glow(e.x - e.vx, e.y + U.rand(-6, 6), U.pick(['#ff9a2a', '#ffcf5a', '#ff3a1a']), 16, 14); },
            onEnd(e, why) { if (why !== 'clash') explode(e); },
            render(ctx, e) {
              ctx.save(); ctx.translate(e.x, e.y); ctx.scale(Math.sign(e.vx), 1);
              ctx.globalCompositeOperation = 'lighter';
              const g = ctx.createLinearGradient(-80, 0, 30, 0);
              g.addColorStop(0, 'rgba(255,60,20,0)'); g.addColorStop(0.6, '#ff7a1a'); g.addColorStop(1, '#fff3b0');
              ctx.fillStyle = g;
              ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(-10, -14); ctx.lineTo(-80, -4); ctx.lineTo(-80, 4); ctx.lineTo(-10, 14); ctx.closePath(); ctx.fill();
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Malevolent Shrine', icon: '伏', color: '#ff1f3d', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 700 },
      desc: 'DOMAIN EXPANSION. A shrine of mouths rises and relentless slashes shred everything nearby.',
      move: {
        id: 'shrine', kind: 'ult', startup: 60, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) { f.invuln = 70; domainCutscene(f, 'shrine', 'MALEVOLENT SHRINE'); FX.banner('DOMAIN EXPANSION', 'MALEVOLENT SHRINE', '#ff4d6a', 130); FX.slow(40, 0.35); Sound.play('charge'); },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 40) return;
          Domains.start(f, {
            type: 'shrine', life: 280, bg: drawShrineBg,
            tick(d, t) {
              if (d.age % 4 === 0) FX.slash(U.rand(0, W), U.rand(120, FLOOR), U.rand(-1.4, 1.4), U.rand(60, 140), U.pick(['#ffffff', '#ff4d6a']), 3, 10);
              if (d.age < 20 || d.age % 9 !== 0 || !t || t.state === 'ko') return;
              if (Math.abs(t.x - f.x) > 760) return;
              Combat.hit(f, t, { dmg: 20, kb: 1.5, stun: 12, hitstop: 1, type: 'domain', chip: 0.6, noScale: true, guardDmg: 3, fx: 'slash', sfx: 'slash', x: t.x + U.rand(-15, 15), y: t.midY + U.rand(-40, 40), dir: dirTo(f, t) });
            },
          });
        },
      },
    },
    {
      name: 'World-Cutting Slash', icon: '界', color: '#ffffff', cost: 50, cd: 600, ai: { min: 0, max: 1280 },
      desc: 'A Dismantle that cuts the world itself: an unblockable slash across the entire arena. Dash to dodge it. A killing blow splits the body in half.',
      move: {
        id: 'worldslash', kind: 'special', startup: 26, active: 1, recovery: 26,
        getPose: (f, fr) => (fr < 26 ? POSES.slashW : POSES.slash),
        onStart(f) { FX.text(f.x, f.y - 195, '"Dismantle."', '#ffffff', 22, 50); Sound.play('charge'); },
        onFrame(f, fr, t) {
          const y = f.y - 95 * f.scale;
          if (fr < 26) { if (fr % 3 === 0) FX.slash(f.x + f.facing * U.rand(40, 900), y, 0, U.rand(30, 90), 'rgba(255,255,255,0.5)', 1, 6); return; }
          if (fr !== 26) return;
          Sound.play('slash'); Sound.play('boom'); FX.shake(18); FX.flash('#ffffff', 0.45);
          spawnSummon(f, { life: 22, y, dir: f.facing, x0: f.x, render(ctx, e) {
            const k = 1 - e.age / e.life, x1 = e.dir > 0 ? W + 40 : -40;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 2 + 10 * k;
            ctx.beginPath(); ctx.moveTo(e.x0, e.y); ctx.lineTo(x1, e.y); ctx.stroke();
            ctx.strokeStyle = `rgba(255,60,90,${k * 0.6})`; ctx.lineWidth = 26 * k;
            ctx.beginPath(); ctx.moveTo(e.x0, e.y); ctx.lineTo(x1, e.y); ctx.stroke();
            ctx.restore();
          } });
          if (t && t.state !== 'ko' && (t.x - f.x) * f.facing > 0 && Math.abs(t.midY - y) < 95)
            Combat.hit(f, t, { dmg: 160, kb: 10, kby: -8, launch: true, unblockable: true, hitstop: 16, shake: 16, fx: 'cleave', sfx: 'slash', cleave: true, blood: 34, x: t.x, y, dir: f.facing });
        },
      },
    },
    {
      name: 'Spiderweb', icon: '蜘', color: '#ff4d6a', cost: 30, cd: 360, ai: { min: 0, max: 220 },
      desc: 'Slams a palm into the ground: a spiderweb of slashes erupts all around Sukuna, launching anyone standing nearby.',
      move: {
        id: 'spiderweb', kind: 'special', startup: 14, active: 1, recovery: 22, poses: ['heavyW', 'slash'],
        onFrame(f, fr, t) {
          if (fr !== 14) return;
          Sound.play('slash'); FX.shake(12); FX.debris(f.x, f.y, '#5a4a3a', 16, 12); FX.dust(f.x, f.y, 14);
          for (let i = 0; i < 14; i++) {
            const a = Math.PI + (i / 13) * Math.PI;
            FX.slash(f.x + Math.cos(a) * 110, f.y + Math.sin(a) * 40 - 6, a, 220, i % 2 ? '#ffffff' : '#ff4d6a', 4, 18);
          }
          for (let r = 1; r <= 3; r++) FX.ring(f.x, f.y - 8, '#ff4d6a', 80 * r, 18 + r * 3, 3);
          if (t && t.state !== 'ko' && Math.abs(t.x - f.x) < 230 && Math.abs(t.y - f.y) < 130)
            Combat.hit(f, t, { dmg: 95, kb: 9, kby: -13, launch: true, hitstop: 10, shake: 10, fx: 'cleave', sfx: 'slash', blood: 14, x: t.x, y: t.midY, dir: dirTo(f, t) });
        },
      },
    },
    {
      name: 'Dismantle Barrage', icon: '乱', color: '#ffffff', cost: 30, cd: 300, ai: { min: 120, max: 900 },
      desc: 'Flicks out five Dismantles in rapid succession, fanning across high and low.',
      move: {
        id: 'dbarrage', kind: 'special', startup: 8, active: 0, recovery: 0, total: 40,
        getPose: (f, fr) => (fr < 8 ? POSES.slashW : Math.floor(fr / 5) % 2 ? POSES.slash2 : POSES.slash),
        onFrame(f, fr) {
          if (fr < 8 || (fr - 8) % 5 !== 0 || fr > 28) return;
          const i = (fr - 8) / 5;
          Sound.play('slash');
          spawnProj(f, {
            x: f.x + f.facing * 45, y: f.y - [100, 60, 135, 80, 115][i], vx: f.facing * 22, vy: [0, 0.6, -0.6, 0.3, -0.3][i], r: 22, life: 50, clash: 1,
            hits: { dmg: 30, kb: 3, stun: 16, fx: 'slash', sfx: 'slash', hitstop: 2, blood: 4 },
            render(ctx, e) {
              ctx.save(); ctx.globalCompositeOperation = 'lighter';
              ctx.globalAlpha = 0.3 + 0.3 * Math.abs(Math.sin(e.age * 0.9));
              ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.arc(e.x - e.vx * 1.4, e.y, 28, -0.9, 0.9); ctx.stroke();
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Reverse Cursed Technique', icon: '反', color: '#ffb3c0', cost: 40, cd: 900, ground: true, noCopy: true,
      ai: { min: 300, max: 1280, when: f => f.hp < f.maxHp * 0.5 },
      desc: 'Regenerates his body with positive energy — heals up to 180 health over a short channel. Getting hit interrupts it.',
      move: {
        id: 'srct', kind: 'special', startup: 45, active: 0, recovery: 8, poses: ['sign', 'idle'],
        onStart(f) { FX.text(f.x, f.y - 190, 'Reverse Cursed Technique', '#ffb3c0', 18, 50); Sound.play('heal'); },
        onFrame(f, fr) {
          if (fr >= 45) return;
          f.hp = Math.min(f.maxHp, f.hp + 4);
          if (fr % 2 === 0) FX.glow(f.x + U.rand(-26, 26), f.y - U.rand(10, 140), U.pick(['#ffb3c0', '#ffffff']), 12, 20, 0, -1.6);
          if (fr === 44) FX.text(f.x, f.y - 175, '+180', '#ffb3c0', 26, 45);
        },
      },
    },
  ],
};

/* ---------------------------------------------------------------- YUJI */

const YUJI = {
  id: 'yuji', name: 'Yuji Itadori', short: 'YUJI', title: 'Vessel of Sukuna', kanji: '虎杖悠仁', color: '#ff5d6c',
  style: 'Fast melee combat, punches, kicks and powerful combinations.',
  bio: 'A first-year with monstrous physical strength. Tap Black Flash again at the moment his fist flashes to land a true Black Flash.',
  passive: { name: 'Superhuman Body', desc: 'Melee attacks deal 15% more damage and Yuji moves 12% faster. Sukuna sleeps inside him...' },
  speed: 1.12,
  look: { skin: '#f1cdb5', top: '#1e2338', pants: '#1a1e30', accent: '#ff5d6c', eye: '#3a2a20' },
  aiStyle: { pref: 70 },
  dmgMult(f, h) { return h.melee ? 1.15 : 1; },
  drawHair(g, hx, hy, r) {
    const { ctx, col } = g;
    ctx.fillStyle = col('#3b2a24');
    ctx.beginPath(); ctx.arc(hx, hy, r, 1.4, 2.9); ctx.lineTo(hx, hy); ctx.fill();
    drawSpikyHair(g, hx, hy, r, [[-60, 7, 13], [-35, 10, 12], [-10, 11, 12], [15, 10, 12], [40, 8, 12]], '#f39aaa');
  },
  drawTorso(g) {
    const { ctx, sk, col, OL } = g;
    ctx.fillStyle = col('#c8323c'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sk.neck[0] - 9, sk.neck[1] + 4, 10, 8, 0.3, 0, 6.283); ctx.fill(); ctx.stroke();
  },
  abilities: [
    {
      name: 'Divergent Fist', icon: '拳', color: '#59a8ff', cost: 15, cd: 130, ai: { min: 0, max: 110 },
      desc: 'A rapid barrage of six punches. Each one is followed a split second later by a delayed burst of cursed energy, and the final burst sends the opponent flying.',
      move: {
        id: 'divergent', kind: 'special', startup: 5, active: 30, recovery: 16, lunge: 6, hitEvery: 5, sfx: 'whoosh',
        hitbox: { x: 4, y: -124, w: 72, h: 40 }, hit: { dmg: 11, kb: 1, stun: 24, fx: 'blue', hitstop: 2 },
        getPose: (f, fr) => (fr < 5 ? POSES.jabW : fr < 35 ? (Math.floor((fr - 5) / 3) % 2 ? POSES.cross : POSES.jab) : POSES.idle),
        onFrame(f, fr) {
          if (fr >= 5 && fr < 35) { f.vx = f.facing * 1.6; if ((fr - 5) % 5 === 0) Sound.play('whoosh'); }
        },
        onHit(f, t) {
          const n = (f.mvars.dfHits = (f.mvars.dfHits || 0) + 1), last = n >= 6;
          World.later(14, () => {
            if (t.state === 'ko') return;
            FX.ring(t.x, t.midY, '#59a8ff', last ? 90 : 50, 16, last ? 6 : 3);
            Combat.hit(f, t, last
              ? { dmg: 30, kb: 12, kby: -6, launch: true, hitstop: 8, shake: 7, fx: 'blue', sfx: 'heavy', sureHit: true, x: t.x, y: t.midY, dir: f.facing }
              : { dmg: 12, kb: 1, stun: 18, hitstop: 2, fx: 'blue', sfx: 'hit', sureHit: true, quiet: true, x: t.x + U.rand(-10, 10), y: t.midY + U.rand(-20, 20), dir: f.facing });
          });
        },
      },
    },
    {
      name: 'Black Flash', icon: '黒', color: '#ff1f3d', cost: 30, cd: 240, ai: { min: 0, max: 120 },
      desc: 'A 3 in 4 chance to spark a true Black Flash (2.5× damage and bonus cursed energy) — and pressing again the instant the fist flashes red guarantees it.',
      move: {
        id: 'blackflash', kind: 'special', startup: 16, active: 4, recovery: 22, lunge: 9, poses: ['heavyW', 'heavy'], timing: [8, 13],
        hitbox: { x: 4, y: -126, w: 72, h: 42 },
        onStart(f) { f.mvars.bf = Math.random() < 0.75; },
        onFrame(f, fr) {
          if (fr < 8 || fr > 13) return;
          const hp = handPos(f);
          FX.glow(hp.x, hp.y, fr % 2 ? '#ff1f3d' : '#ffffff', 14, 6);
          if (fr === 8) Sound.play('cue');
          if (f.input && World.active && f.input.pressed[`s${f.mvars.abil}`]) { f.mvars.bf = true; f.consume(); }
        },
        hitFn(f) {
          return f.mvars.bf
            ? { dmg: 180, kb: 16, kby: -11, launch: true, hitstop: 16, shake: 16, fx: 'bf', sfx: 'bf' }
            : { dmg: 72, kb: 10, kby: -6, launch: true, hitstop: 8, shake: 6 };
        },
        onHit(f, t) {
          if (!f.mvars.bf) return;
          UI.blackFlash(); FX.slow(24, 0.3);
          FX.text(t.x, t.y - 190, 'BLACK FLASH!', '#ff1f3d', 40, 70);
          f.gainCe(25);
        },
      },
    },
    {
      name: 'Manji Kick', icon: '蹴', color: '#ffd34d', cost: 20, cd: 170, ai: { min: 0, max: 120 },
      desc: 'A fast spinning kick that launches the opponent high into the air.',
      move: {
        id: 'manji', kind: 'special', startup: 8, active: 7, recovery: 18, sfx: 'whoosh', snapPose: true,
        hitbox: { x: -24, y: -155, w: 112, h: 115 }, hit: { dmg: 68, kb: 6, kby: -17, launch: true, hitstop: 7, shake: 5 },
        getPose(f, fr) {
          const p = poseCopy(fr < 8 ? POSES.kickW : POSES.spin);
          if (fr >= 8 && fr < 15) p.rot = -(fr - 8) / 7 * 360;
          if (fr >= 15) return poseLerpInto(poseCopy(POSES.spin), POSES.idle, Math.min(1, (fr - 15) / 10));
          return p;
        },
        onFrame(f, fr) { if (fr === 6 && f.onGround) { f.vy = -7; f.onGround = false; } if (fr === 9) FX.arc(f, { color: '#ffe9a0', r: 70, a0: -160, a1: 160 }); },
      },
    },
    {
      name: 'Black Flash Barrage', icon: '閃', color: '#ff1f3d', cost: 100, cd: 1400, ult: true, ai: { min: 0, max: 380 },
      desc: 'ULTIMATE. Rush in and bury the opponent under a storm of blows — each with a 3 in 4 chance to be a Black Flash — ending in a devastating Black Flash.',
      move: {
        id: 'barrage', kind: 'ult', total: 400, startup: 400, active: 0, recovery: 0,
        onStart(f) { FX.banner('ULTIMATE', 'BLACK FLASH BARRAGE', '#ff3355', 100); FX.slow(25, 0.4); f.mvars.phase = 'rush'; },
        getPose(f, fr) {
          const v = f.mvars;
          if (v.phase === 'rush') return fr < 12 ? POSES.heavyW : POSES.dash;
          if (v.phase === 'barrage') return POSES[['jab', 'cross', 'kick', 'heavy'][Math.floor((fr - v.t0) / 7) % 4]];
          return (fr - v.t0) < 86 ? POSES.heavyW : POSES.heavy;
        },
        onFrame(f, fr, t) {
          const v = f.mvars;
          f.invuln = Math.max(f.invuln, 3);
          if (v.phase === 'rush') {
            if (fr >= 12) {
              f.vx = f.facing * 15;
              if (fr % 2 === 0) FX.ghost(f, '#ff3355');
              if (t && t.state !== 'ko' && Math.abs(t.x - f.x) < 90 && Math.abs(t.y - f.y) < 130) {
                v.phase = 'barrage'; v.t0 = fr; t.applyStun(130, true, true); f.vx = 0;
              }
            }
            if (fr > 42 && v.phase === 'rush') { f.invuln = 0; f.endMove(); }
            return;
          }
          const k = fr - v.t0;
          f.vx = 0;
          if (t.state === 'ko') { f.endMove(); return; }
          if (v.phase === 'barrage') {
            t.x = f.x + f.facing * 52; t.clampWalls();
            if (k % 7 === 3 && k < 70) {
              // Every blow in the barrage can spark into a Black Flash without slowing the rush.
              const bf = Math.random() < 0.75;
              Combat.hit(f, t, bf
                ? { dmg: 48, kb: 0, stun: 10, unblockable: true, sureHit: true, noScale: true, hitstop: 2, shake: 9, fx: 'bf', sfx: 'bf', x: t.x - f.facing * 10, y: t.midY + U.rand(-25, 25), dir: f.facing }
                : { dmg: 20, kb: 0, stun: 10, unblockable: true, sureHit: true, noScale: true, hitstop: 2, shake: 3, x: t.x - f.facing * 10, y: t.midY + U.rand(-25, 25), dir: f.facing });
              if (bf) { UI.blackFlash(); f.gainCe(5); }
            }
            if (k >= 76) { v.phase = 'final'; FX.flash('#000', 0.4); Sound.play('charge'); }
            return;
          }
          if (k === 86) {
            t.stun = 0; t.frozen = false; t.setState('idle');
            Combat.hit(f, t, { dmg: 190, kb: 18, kby: -14, launch: true, unblockable: true, sureHit: true, noScale: true, hitstop: 18, shake: 18, fx: 'bf', sfx: 'bf', dir: f.facing });
            FX.slow(30, 0.25); UI.blackFlash();
            FX.text(t.x, t.y - 190, 'BLACK FLASH!', '#ff1f3d', 44, 80);
          }
          if (k >= 104) { f.invuln = 10; f.endMove(); }
        },
      },
    },

    {
      name: 'Sukuna Takeover', icon: '宿', color: '#ff1f3d', cost: 50, cd: 60, ground: true, noCopy: true,
      ai: { min: 0, max: 1280, when: f => f.hp < f.maxHp * 0.7 },
      desc: 'Once per round, Yuji lets the King of Curses take over for 30 seconds — Sukuna\'s moveset, techniques and Domain Expansion, with a full cursed energy bar. Unavailable when Sukuna is the opponent.',
      // Sukuna can't take over Yuji's body while Sukuna himself is the opponent.
      getMove: f => {
        const o = World.opp(f);
        if (f.usedTakeover || f.takeoverT > 0 || (o && o.baseDef.id === 'sukuna')) return null;
        return TAKEOVER_MOVE;
      },
    },
    {
      name: 'Piercing Blood', icon: '穿', color: BLOOD, cost: 25, cd: 300, ai: { min: 150, max: 1280 },
      desc: 'Compresses his own blood between his palms and fires it as a beam across the arena. Costs 20 health.',
      move: piercingBloodMove({ startup: 22, hp: 20, hit: { dmg: 90 } }),
    },
    {
      name: 'Supernova', icon: '星', color: '#ff6a7a', cost: 30, cd: 360, ai: { min: 100, max: 750 },
      desc: 'Five orbs of blood circle Yuji, then hurtle at the opponent and burst. Costs 25 health.',
      move: supernovaMove({ hp: 25, dmg: 30 }),
    },
    {
      name: 'Flowing Red Scale', icon: '赤', color: '#ff3a4a', cost: 25, cd: 900, ai: { min: 0, max: 500, when: f => !f.buffs.redscale },
      desc: 'Speeds up his blood flow: +15% speed and +15% damage for 8 seconds. Costs 15 health.',
      move: redScaleMove({ hp: 15 }),
    },
  ],
};

const TAKEOVER_MOVE = {
  id: 'takeover', kind: 'special', startup: 52, active: 0, recovery: 0,
  getPose: (f, fr) => (fr < 40 ? POSES.hurt : POSES.win),
  onStart(f) {
    f.invuln = 60; f.usedTakeover = true;
    FX.banner('THE KING OF CURSES', 'SUKUNA TAKES OVER', '#ff1f3d', 120); FX.slow(30, 0.4); Sound.play('roar');
  },
  onFrame(f, fr) {
    f.invuln = Math.max(f.invuln, 2);
    if (fr < 40 && fr % 2 === 0) FX.glow(f.x + U.rand(-30, 30), f.y - U.rand(20, 140), U.pick(['#ff1f3d', '#200008']), 16, 16, 0, -1);
    if (fr !== 40) return;
    f.transform(VESSEL_SUKUNA, 1800);
    f.ce = 100;
    FX.flash('#ff1f3d', 0.5); FX.shake(16); FX.ring(f.x, f.y - 80, '#ff1f3d', 140, 24, 6); FX.spark(f.x, f.y - 80, '#ff4d6a', 24, 9);
    FX.text(f.x, f.y - 200, '"Know your place, fool."', '#ff8a9a', 22, 80);
    Sound.play('boom');
  },
};

/* ---------------------------------------------------------------- YUTA */

const YUTA = {
  id: 'yuta', name: 'Yuta Okkotsu', short: 'YUTA', title: 'Special Grade', kanji: '乙骨憂太', color: '#d78cff',
  style: 'Balanced sword combat backed by the overwhelming cursed energy of Rika.',
  bio: 'A special grade sorcerer haunted by the Queen of Curses, Rika. His katana gives every basic attack extra reach.',
  passive: { name: 'Bottomless Reserves', desc: 'Cursed energy regenerates 50% faster. Rika remembers every technique used against Yuta, ready to Copy.' },
  ceRegen: 1.5, melee: { weapon: 'sword', reach: 38, power: 1.0 }, copy: true,
  look: { skin: '#f0d2bc', top: '#e9ecef', pants: '#d4d8dd', accent: '#d78cff', eye: '#141420' },
  aiStyle: { pref: 105 },
  drawHair(g, hx, hy, r) {
    const { ctx, col, o, OL } = g;
    drawSpikyHair(g, hx, hy, r, [[-75, 5, 12], [-50, 7, 12], [-20, 8, 12], [10, 8, 12], [40, 7, 12], [70, 6, 12], [100, 5, 12], [125, 4, 12]], '#16161e');
    ctx.fillStyle = col('#16161e'); ctx.strokeStyle = OL; ctx.lineWidth = 1.5;
    for (const [x, y] of [[7, -10], [12, -8]]) { ctx.beginPath(); ctx.moveTo(hx + x - 3, hy + y - 3); ctx.lineTo(hx + x + 1, hy + y + 6); ctx.lineTo(hx + x + 4, hy + y - 4); ctx.fill(); }
    if (o.white || o.tint) return;
    ctx.strokeStyle = 'rgba(80,70,110,0.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(hx + 7, hy + 4, 2.5, 0.2, 2.9); ctx.stroke();
  },
  drawWeapon(g) {
    const { ctx, sk, col, OL } = g;
    const e = sk.aF[1], h = sk.aF[2];
    let dx = h[0] - e[0], dy = h[1] - e[1];
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const b0 = [h[0] + dx * 5, h[1] + dy * 5], tip = [h[0] + dx * 82, h[1] + dy * 82];
    ctx.lineCap = 'round';
    ctx.strokeStyle = OL; ctx.lineWidth = 6; lineTo2(ctx, b0, tip);
    ctx.strokeStyle = col('#e6edf5'); ctx.lineWidth = 3; lineTo2(ctx, b0, tip);
    ctx.strokeStyle = col('#c9a23a'); ctx.lineWidth = 4; lineTo2(ctx, [b0[0] - dy * 7, b0[1] + dx * 7], [b0[0] + dy * 7, b0[1] - dx * 7]);
    ctx.strokeStyle = col('#2a1a3a'); ctx.lineWidth = 5; lineTo2(ctx, [h[0] - dx * 11, h[1] - dy * 11], [h[0] + dx * 3, h[1] + dy * 3]);
  },
  abilities: [
    {
      name: 'Katana Slash', icon: '刀', color: '#bfe3ff', cost: 10, cd: 60, ai: { min: 0, max: 175 },
      desc: 'A quick, far-reaching forward sword strike infused with cursed energy.',
      move: {
        id: 'katana', kind: 'special', startup: 7, active: 4, recovery: 14, lunge: 11, poses: ['slashW', 'slash'], sfx: 'swish',
        swing: { color: '#bfe3ff', r: 130, w: 9 },
        hitbox: { x: 0, y: -140, w: 155, h: 100 }, hit: { dmg: 62, kb: 8, kby: -4, stun: 26, fx: 'slash', color: '#bfe3ff', sfx: 'swish', hitstop: 6 },
      },
    },
    {
      name: 'Rika Grab', icon: '里', color: '#ff7ad9', cost: 35, cd: 360, ai: { min: 0, max: 430 },
      desc: 'Rika\'s enormous arm lunges out, seizes the opponent and slams them into the ground. Unblockable.',
      move: {
        id: 'rikagrab', kind: 'special', startup: 18, active: 1, recovery: 40, poses: ['castW', 'point'],
        onStart(f) {
          Sound.play('grab');
          spawnSummon(f, {
            life: 72, layer: 'back', len: 0,
            tick(e, t) {
              const k = e.age;
              e.bx = f.x - f.facing * 20; e.by = f.y - 150 * f.scale; e.dir = f.facing;
              if (!e.grab) {
                const ext = k < 10 ? 0 : k < 26 ? (k - 10) / 16 : Math.max(0, 1 - (k - 26) / 14);
                e.len = ext * 440; e.tx = e.bx + e.dir * e.len; e.ty = f.y - 100;
                if (k >= 10 && k < 30 && t && t.state !== 'ko' && t.invuln <= 0 && Math.abs(t.x - e.tx) < 48 && Math.abs(t.midY - e.ty) < 95) {
                  e.grab = k; e.gy = t.onGround ? t.y : World.groundAt(t.x, t.y);
                  t.applyStun(60, true, true); Sound.play('grab'); FX.spark(t.x, t.midY, '#ff7ad9', 10, 6);
                }
                if (k >= 44 && !e.grab) e.kill();
              } else {
                const gk = k - e.grab;
                if (t.state === 'ko') { e.kill(); return; }
                t.x = U.lerp(t.x, f.x + f.facing * 115, 0.2); t.clampWalls();
                if (gk < 16) t.y -= 6;
                e.tx = t.x; e.ty = t.midY;
                if (gk === 16) {
                  t.y = e.gy; t.stun = 0; t.frozen = false; t.setState('idle');
                  Combat.hit(f, t, { dmg: 125, kb: 5, kby: -5, launch: true, unblockable: true, sureHit: true, hitstop: 12, shake: 14, fx: 'wood', sfx: 'heavy', x: t.x, y: t.y - 20, dir: f.facing });
                  FX.dust(t.x, t.y, 16); FX.debris(t.x, t.y, '#5a4a3a', 12, 10);
                  e.life = e.age + 12;
                }
              }
            },
            render(ctx, e) {
              if (e.bx === undefined || (!e.grab && e.len < 4)) return;
              const fade = Math.min(1, (e.life - e.age) / 8);
              ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = 'round';
              const mx = (e.bx + e.tx) / 2, my = Math.min(e.by, e.ty) - 40;
              ctx.strokeStyle = '#08060c'; ctx.lineWidth = 22;
              ctx.beginPath(); ctx.moveTo(e.bx, e.by); ctx.quadraticCurveTo(mx, my, e.tx, e.ty); ctx.stroke();
              ctx.strokeStyle = '#cfc8d8'; ctx.lineWidth = 16; ctx.stroke();
              ctx.strokeStyle = '#f2ecf8'; ctx.lineWidth = 4;
              for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(e.tx, e.ty); ctx.lineTo(e.tx + e.dir * 18, e.ty + i * 12); ctx.stroke(); }
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Cursed Speech', icon: '呪', color: '#ffb3e6', cost: 30, cd: 480, ai: { min: 0, max: 560 },
      desc: '"DON\'T MOVE." A command carried on cursed energy that freezes the opponent in place. Unblockable.',
      move: {
        id: 'speech', kind: 'special', startup: 14, active: 1, recovery: 28, poses: ['sign', 'point'],
        onFrame(f, fr) {
          if (fr !== 14) return;
          Sound.play('voice'); FX.text(f.x + f.facing * 30, f.y - 195, '"DON\'T MOVE."', '#ffb3e6', 30, 60);
          spawnProj(f, {
            x: f.x + f.facing * 40, y: f.y - 105, vx: f.facing * 17, r: 42, life: 34,
            hits: { dmg: 20, stunAdd: 80, unblockable: true, kb: 0, fx: 'speech', sfx: 'zap', hitstop: 6 },
            render(ctx, e) {
              ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffb3e6';
              const d = Math.sign(e.vx) || 1, a0 = d > 0 ? 0 : Math.PI;
              for (let i = 0; i < 3; i++) {
                ctx.globalAlpha = (1 - e.age / e.life) * (1 - i * 0.25); ctx.lineWidth = 3 - i * 0.6;
                ctx.beginPath(); ctx.arc(e.x - d * (30 + i * 22), e.y, 30 + i * 8, a0 - 0.8, a0 + 0.8); ctx.stroke();
              }
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Rika Manifestation', icon: '香', color: '#ff7ad9', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 600 },
      desc: 'ULTIMATE. Rika fully manifests at Yuta\'s side: she shreds anything in front of him, boosts his damage by 20%, and ends with a beam of pure love.',
      move: {
        id: 'rika', kind: 'ult', startup: 50, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) { f.invuln = 55; FX.banner('FULL MANIFESTATION', 'RIKA, QUEEN OF CURSES', '#ff7ad9', 120); FX.slow(35, 0.4); Sound.play('charge'); },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 35) return;
          Sound.play('roar'); FX.shake(12); FX.flash('#ff7ad9', 0.3);
          f.buffs.rika = 480;
          spawnSummon(f, {
            x: f.x - f.facing * 70, y: f.y - 175, life: 480, layer: 'back', facing: f.facing, swipe: 0, beam: 0,
            tick(e, t) {
              if (f.state === 'ko') { e.life = Math.min(e.life, e.age + 15); return; }
              if (!e.swipe && !e.beam) {
                e.facing = f.facing;
                e.x = U.lerp(e.x, f.x - f.facing * 70, 0.12);
                e.y = U.lerp(e.y, f.y - 175 + Math.sin(e.age * 0.05) * 6, 0.12);
              }
              if (!t || t.state === 'ko') return;
              if (!e.swipe && !e.beam && e.age > 40 && e.age % 50 === 0 && Math.abs(t.x - f.x) < 380 && Math.sign(t.x - f.x) === f.facing) {
                e.swipe = 1; e.sx = t.x - f.facing * 60;
              }
              if (e.swipe) {
                e.swipe++;
                e.x = U.lerp(e.x, e.sx, 0.3); e.y = U.lerp(e.y, f.y - 130, 0.3);
                if (e.swipe === 9) {
                  Sound.play('slash');
                  for (let i = 0; i < 3; i++) FX.slash(e.x + e.facing * 60, e.y + 40 + i * 18, -0.5 * e.facing, 120, '#ff7ad9', 5, 12);
                  if (Math.abs(t.x - e.x) < 140 && Math.abs(t.midY - (e.y + 40)) < 150)
                    Combat.hit(f, t, { dmg: 55, kb: 11, kby: -7, launch: true, fx: 'slash', color: '#ff7ad9', hitstop: 8, shake: 8, x: t.x, y: t.midY, dir: f.facing });
                }
                if (e.swipe > 22) e.swipe = 0;
              }
              if (e.age === e.life - 70) { e.beam = 1; e.beamDir = e.facing; FX.text(e.x, e.y - 70, 'PURE LOVE', '#ffd6f5', 30, 60); Sound.play('charge'); }
              if (e.beam) {
                e.beam++;
                if (e.beam === 25) {
                  Sound.play('purple'); FX.shake(16); FX.flash('#ffd6f5', 0.5);
                  const by = e.y + 30;
                  if (Math.sign(t.x - e.x) === e.beamDir && Math.abs(t.midY - by) < 110)
                    Combat.hit(f, t, { dmg: 150, kb: 16, kby: -10, launch: true, fx: 'purple', hitstop: 14, shake: 14, x: t.x, y: by, dir: e.beamDir });
                }
              }
            },
            render(ctx, e) {
              const fade = Math.min(1, e.age / 15, (e.life - e.age) / 15);
              ctx.save(); ctx.globalAlpha = fade;
              drawRika(ctx, e.x, e.y, 1.25, e.facing, e.age, e.swipe || e.beam ? 1 : 0.3);
              ctx.restore();
              if (e.beam >= 20 && e.beam < 48) {
                const by = e.y + 30, x0 = e.x + e.beamDir * 40, x1 = e.beamDir > 0 ? W + 40 : -40;
                const k = e.beam < 25 ? (e.beam - 20) / 5 : 1 - (e.beam - 25) / 23;
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = `rgba(255,140,230,${0.5 * k})`; ctx.fillRect(Math.min(x0, x1), by - 60 * k, Math.abs(x1 - x0), 120 * k);
                ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`; ctx.fillRect(Math.min(x0, x1), by - 24 * k, Math.abs(x1 - x0), 48 * k);
                ctx.restore();
              }
            },
          });
        },
      },
    },

    {
      name: 'Copy', icon: '模', color: '#c9b3ff', cost: 30, cd: 360, copy: true,
      ai: { min: 0, max: 1280, when: (f, o) => { const c = copyTarget(f); const d = Math.abs(o.x - f.x); return !!c && d >= c.ai.min && d <= c.ai.max; } },
      desc: 'Rika copies the opponent\'s most recently used technique (or their first one) and Yuta unleashes it as his own. The small glyph on the icon shows what is copied.',
      getMove(f) { const c = copyTarget(f); return c ? c.move : null; },
      onUse(f) {
        const c = copyTarget(f);
        FX.text(f.x, f.y - 205, `COPY: ${c.name}`, '#e0ccff', 22, 60);
        FX.ring(f.x, f.y - 90, '#ff7ad9', 80, 18, 4); FX.spark(f.x, f.y - 90, '#e0ccff', 14, 6);
        Sound.play('teleport');
      },
    },
    {
      name: 'Authentic Mutual Love', icon: '愛', color: '#ff9ad5', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'DOMAIN EXPANSION. A plain of countless blades: inside it, Copy costs no cursed energy and has no cooldown, and swords erupt beneath the opponent again and again.',
      move: {
        id: 'mutuallove', kind: 'ult', startup: 60, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) { f.invuln = 70; domainCutscene(f, 'love', 'AUTHENTIC MUTUAL LOVE'); FX.banner('DOMAIN EXPANSION', 'AUTHENTIC MUTUAL LOVE', '#ff9ad5', 130); FX.slow(40, 0.35); Sound.play('charge'); },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 40) return;
          Domains.start(f, {
            type: 'love', life: 360, bg: drawSwordFieldBg,
            tick(d, t) {
              // Copy is free and instant for the whole domain
              const ci = f.abilities.findIndex(a => a && a.copy);
              if (ci >= 0) f.cd[ci] = 0;
              f.ce = Math.max(f.ce, 30);
              if (!t || t.state === 'ko' || d.age % 45 !== 20) return;
              eruption(f, t.x, { y: World.groundAt(t.x, t.y), delay: 22, w: 80, h: 170, kind: 'spike', tele: '#ff9ad5', sfx: 'slash', debris: '#8a8a9a',
                hits: { dmg: 45, kb: 4, kby: -12, launch: true, fx: 'slash', color: '#ff9ad5', type: 'domain', chip: 0.5 } });
            },
          });
        },
      },
    },
  ],
};

// Sukuna wearing Yuji's body: Yuji's clothes, Sukuna's face, moveset and techniques.
const VESSEL_SUKUNA = Object.assign({}, SUKUNA, {
  name: 'Sukuna (in Yuji)', look: Object.assign({}, YUJI.look, { eye: '#c4122f', accent: '#ff3355', _sh: undefined }),
  drawTorso: YUJI.drawTorso, hp: YUJI.hp, speed: SUKUNA.speed,
});

/* ---------------------------------------------------------------- MEGUMI */

const MEGUMI = {
  id: 'megumi', name: 'Megumi Fushiguro', short: 'MEGUMI', title: 'Ten Shadows', kanji: '伏黒恵', color: '#8f8cff',
  style: 'Summoning shikigami and controlling the battlefield from the shadows.',
  bio: 'Heir to the Ten Shadows technique. He fights alongside shikigami called from his own shadow, pressuring from several angles at once.',
  passive: { name: 'Shadow Reserve', desc: 'All shikigami stay on the field 30% longer.' },
  summonMult: 1.3,
  // While Mahoraga is summoned, Megumi adapts to each kind of attack that hits him.
  onIncoming(f, dmg, h) {
    if (!f.buffs.mahoraga) return { dmg };
    const k = h.type === 'domain' ? 'domain' : h.proj ? 'proj' : h.melee ? 'melee' : 'tech';
    const n = f.adapt[k] || 0, red = Math.min(0.7, n * 0.175);
    f.adapt[k] = n + 1; f.adaptSpin++;
    Sound.play('cue');
    if (n + 1 === 4) FX.text(f.x, f.y - 200, 'ADAPTED', '#f2efe6', 26, 60);
    return { dmg: dmg * (1 - red), kb: 1 - red * 0.5 };
  },
  look: { skin: '#efd1bd', top: '#1b1f30', pants: '#161a28', accent: '#8f8cff', eye: '#1a2a3a' },
  aiStyle: { pref: 200, ranged: true },
  drawHair(g, hx, hy, r) {
    drawSpikyHair(g, hx, hy, r, [[-60, 9, 12], [-35, 15, 11], [-10, 18, 11], [15, 18, 11], [40, 17, 11], [65, 15, 11], [90, 12, 12], [115, 9, 12]], '#14141c');
  },
  abilities: [
    {
      name: 'Divine Dogs', icon: '犬', color: '#e8e8ff', cost: 25, cd: 300, ai: { min: 0, max: 800 },
      desc: 'Two shadow wolves burst from the ground and hunt the opponent down, biting twice each.',
      move: {
        id: 'dogs', kind: 'special', startup: 14, active: 1, recovery: 16, poses: ['sign', 'sign'],
        onFrame(f, fr) {
          if (fr !== 14) return;
          const life = Math.round(170 * f.summonMult());
          makeDog(f, { x: f.x - f.facing * 10, dir: f.facing, color: '#f2f2f6', speed: 9.5, life });
          makeDog(f, { x: f.x - f.facing * 30, dir: f.facing, color: '#1b1b24', speed: 8, life, delay: 10 });
        },
      },
    },
    {
      name: 'Nue', icon: '鵺', color: '#ffe86a', cost: 25, cd: 320, ai: { min: 0, max: 1100 },
      desc: 'A winged shikigami circles above the opponent and calls down lightning strikes. Keep moving!',
      move: {
        id: 'nue', kind: 'special', startup: 12, active: 1, recovery: 14, poses: ['sign', 'point'],
        onFrame(f, fr) {
          if (fr !== 12) return;
          Sound.play('zap');
          spawnSummon(f, {
            x: f.x, y: f.y - 120, life: Math.round(210 * f.summonMult()), dir: f.facing, charge: 0,
            name: 'NUE', hp: 90, maxHp: 90, hurtbox: e => ({ x: e.x - 34, y: e.y - 24, w: 68, h: 46 }),
            tick(e, t) {
              const tx = t ? t.x : e.x;
              e.x = U.lerp(e.x, tx, 0.035); e.y = U.lerp(e.y, FLOOR - 330 + Math.sin(e.age * 0.07) * 14, 0.06);
              e.dir = tx >= e.x ? 1 : -1;
              const c = (e.age - 45) % 75;
              e.charge = e.age >= 45 && c < 18;
              if (e.age >= 45 && c === 18) {
                Sound.play('zap'); FX.flash('#fff6c0', 0.2);
                for (let i = 0; i < 3; i++) FX.bolt(e.x + U.rand(-6, 6), e.y + 10, e.x + U.rand(-12, 12), FLOOR, i ? '#ffe86a' : '#ffffff', 10, i ? 2 : 5);
                FX.spark(e.x, FLOOR - 8, '#ffe86a', 12, 7);
                if (t && t.state !== 'ko' && Math.abs(t.x - e.x) < 44 * t.scale)
                  Combat.hit(f, t, { dmg: 55, kb: 2, stun: 36, fx: 'zap', sfx: 'zap', x: t.x, y: t.midY, dir: dirTo(f, t) });
              }
            },
            onEnd(e) { FX.smoke(e.x, e.y, '#1a1028', 8, 18, 14); },
            render(ctx, e) {
              ctx.save(); ctx.globalAlpha = Math.min(1, e.age / 10, (e.life - e.age) / 12);
              drawNue(ctx, e.x, e.y, e.dir, e.age, e.charge);
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Toad', icon: '蝦', color: '#7fcf6a', cost: 20, cd: 360, ai: { min: 0, max: 400 },
      desc: 'A toad shikigami lashes out its tongue, snaring the opponent and reeling them in, immobilized. Unblockable.',
      move: {
        id: 'toad', kind: 'special', startup: 10, active: 1, recovery: 22, poses: ['sign', 'point'],
        onFrame(f, fr) {
          if (fr !== 10) return;
          Sound.play('croak');
          const tx = U.clamp(f.x + f.facing * 55, World.left + 30, World.right - 30);
          FX.smoke(tx, f.y - 10, '#1a1028', 6, 16, 14);
          spawnSummon(f, {
            x: tx, y: f.y, life: Math.round(75 * f.summonMult()), dir: f.facing, len: 0,
            name: 'TOAD', hp: 100, maxHp: 100, hurtbox: e => ({ x: e.x - 34, y: e.y - 58, w: 68, h: 58 }),
            tick(e, t) {
              const k = e.age;
              if (!e.grab) {
                e.len = k < 12 ? 0 : k < 26 ? (k - 12) / 14 * 380 : Math.max(0, 380 - (k - 26) * 30);
                const tipX = e.x + e.dir * (20 + e.len), tipY = e.y - 34;
                if (k >= 12 && k < 28 && t && t.state !== 'ko' && t.invuln <= 0 && U.circleRect(tipX, tipY, 16, t.hurtbox())) {
                  e.grab = k; e.held = t; Sound.play('grab');
                  Combat.hit(f, t, { dmg: 20, stunAdd: 70, freeze: true, unblockable: true, kb: 0, hitstop: 4, x: tipX, y: tipY, dir: e.dir });
                }
              } else if (t) {
                t.x = U.lerp(t.x, e.x + e.dir * 75, 0.15); t.clampWalls();
                e.len = Math.max(0, Math.abs(t.x - e.x) - 20);
                if (k - e.grab > 24) e.grab = 0, e.len = 0, e.life = Math.min(e.life, e.age + 10);
              }
            },
            onEnd(e) { FX.smoke(e.x, e.y - 20, '#1a1028', 8, 18, 16); if (e.slain && e.held && e.held.stun > 1) e.held.stun = 1; },
            render(ctx, e) {
              ctx.save(); ctx.globalAlpha = Math.min(1, e.age / 6, (e.life - e.age) / 10);
              if (e.len > 0) {
                ctx.strokeStyle = '#3a0f1a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
                lineTo2(ctx, [e.x + e.dir * 22, e.y - 34], [e.x + e.dir * (20 + e.len), e.y - 34]);
                ctx.strokeStyle = '#ff7a9a'; ctx.lineWidth = 6; lineTo2(ctx, [e.x + e.dir * 22, e.y - 34], [e.x + e.dir * (20 + e.len), e.y - 34]);
              }
              drawToad(ctx, e.x, e.y, e.dir, e.age);
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Chimera Shadow Garden', icon: '影', color: '#9b6bff', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'DOMAIN EXPANSION (incomplete). The arena floods with shadow: the opponent is slowed, Megumi\'s energy surges, and shikigami strike from every side.',
      move: {
        id: 'garden', kind: 'ult', startup: 55, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) { f.invuln = 60; domainCutscene(f, 'shadow', 'CHIMERA SHADOW GARDEN'); FX.banner('DOMAIN EXPANSION', 'CHIMERA SHADOW GARDEN', '#b59bff', 130); FX.slow(35, 0.4); Sound.play('charge'); },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 38) return;
          f.buffs.regen = 420;
          Domains.start(f, {
            type: 'shadow', life: 420, slowOpp: true, bg: drawShadowBg,
            tick(d, t) {
              if (!t || t.state === 'ko' || d.age % 55 !== 25) return;
              const k = (d.n = (d.n || 0) + 1) % 3;
              if (k === 1) {
                const fromRight = t.x < W / 2;
                makeDog(f, { x: fromRight ? World.right - 30 : World.left + 30, dir: fromRight ? -1 : 1, color: U.pick(['#f2f2f6', '#1b1b24']), speed: 11, life: 110, bites: 1, dmg: 45 });
              } else if (k === 2) nueStrike(f, t.x, 24, { dmg: 50 });
              else eruption(f, t.x, { delay: 24, w: 80, h: 170, kind: 'shadow', tele: '#9b6bff', sfx: 'slash', debris: '#1a1028', hits: { dmg: 50, kb: 3, kby: -13, launch: true, fx: 'slash', color: '#9b6bff' } });
            },
          });
        },
      },
    },

    {
      name: 'Mahoraga', icon: '魔', color: '#f2efe6', cost: 70, cd: 1800, ground: true,
      ai: { min: 0, max: 1280, when: f => f.hp < f.maxHp * 0.65 },
      desc: '"With this treasure, I summon..." The Divine General Mahoraga hunts the opponent with its Sword of Extermination. Each time Megumi is struck, its wheel turns and he adapts to that kind of attack (up to 70% less damage). Costs 10% of Megumi\'s current health.',
      move: {
        id: 'mahoraga', kind: 'special', startup: 50, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) {
          f.invuln = 55;
          domainCutscene(f, 'shadow', 'DIVINE GENERAL MAHORAGA', { title: 'WITH THIS TREASURE, I SUMMON...', kanji: '召喚' });
          FX.banner('EIGHT-HANDLED SWORD', 'DIVINE GENERAL MAHORAGA', '#f2efe6', 130); FX.slow(35, 0.4); Sound.play('charge');
        },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 40) return;
          f.hp = Math.max(1, Math.round(f.hp * 0.9));
          const life = Math.round(560 * f.summonMult());
          f.buffs.mahoraga = life; f.adapt = {}; f.adaptSpin = 0;
          Sound.play('roar'); FX.shake(16); FX.flash('#ffffff', 0.5);
          FX.smoke(f.x - f.facing * 70, FLOOR - 40, '#1a1028', 14, 40, 26);
          spawnSummon(f, {
            x: U.clamp(f.x - f.facing * 70, World.left + 40, World.right - 40), y: FLOOR, life, dir: f.facing,
            hp: 650, maxHp: 650, adapt: {}, flash: 0,
            hurtbox: e => ({ x: e.x - 40, y: FLOOR - 290, w: 80, h: 290 }),
            // Mahoraga can be destroyed, but it adapts to each kind of attack it takes.
            takeHit(e, att, dmg, h) {
              const kind = h.proj ? 'proj' : 'melee', n = e.adapt[kind] || 0;
              e.adapt[kind] = n + 1; f.adaptSpin++;
              dmg = Math.round(dmg * (1 - Math.min(0.6, n * 0.15)));
              e.hp -= dmg; e.flash = 4;
              const hx = e.x, hy = FLOOR - 150;
              FX.impact(hx, hy, h, dmg); Sound.play(dmg >= 60 ? 'heavy' : 'hit'); FX.hitstop(3);
              FX.text(hx + U.rand(-20, 20), FLOOR - 320, dmg, '#f2efe6', 18, 40);
              if (n + 1 === 4) FX.text(hx, FLOOR - 350, 'ADAPTED', '#f2efe6', 22, 50);
              if (e.hp <= 0) {
                e.slain = true; e.kill('slain'); delete f.buffs.mahoraga;
                FX.explosion(hx, hy, 140, ['#ffffff', '#f2efe6', '#c9a23a']); FX.shake(18); FX.flash('#ffffff', 0.5); Sound.play('boom');
                FX.text(hx, FLOOR - 340, 'MAHORAGA EXORCISED', '#ffd34d', 30, 90);
              }
            },
            mode: 'walk', st: 0, cool: 40, wheel: 0, pose: poseCopy(POSES.idle), anim: 0,
            tick(e, t) {
              e.anim++; if (e.flash > 0) e.flash--;
              e.wheel = U.lerp(e.wheel, f.adaptSpin * 45, 0.12);
              if (f.state === 'ko') { e.life = Math.min(e.life, e.age + 20); return; }
              let target = POSES.idle;
              if (t && t.state !== 'ko') {
                const dx = t.x - e.x;
                if (e.mode === 'walk') {
                  e.dir = dx >= 0 ? 1 : -1; e.cool--;
                  if (Math.abs(dx) > 115) { e.x += e.dir * 3.8; target = poseLerpInto(poseCopy(POSES.walkA), POSES.walkB, (Math.sin(e.anim * 0.18) + 1) / 2); }
                  if (Math.abs(dx) < 170 && e.cool <= 0) { e.mode = 'swing'; e.st = 0; Sound.play('whoosh'); }
                } else {
                  e.st++;
                  target = e.st < 22 ? POSES.slashW : e.st < 36 ? POSES.slash : POSES.idle;
                  if (e.st === 22) {
                    Sound.play('slash'); FX.shake(8);
                    for (let i = 0; i < 3; i++) FX.slash(e.x + e.dir * 110, FLOOR - 150 + i * 30, 0.7 * e.dir, 170, i === 1 ? '#ffffff' : '#f2efe6', 6, 14);
                    if (Math.abs(dx) < 200 && Math.abs(t.midY - (FLOOR - 130)) < 170)
                      Combat.hit(f, t, { dmg: 95, kb: 15, kby: -10, launch: true, chip: 0.3, guardDmg: 55, fx: 'cleave', hitstop: 12, shake: 14, sfx: 'heavy', x: t.x, y: t.midY, dir: e.dir });
                  }
                  if (e.st > 46) { e.mode = 'walk'; e.cool = 50; }
                }
              }
              e.x = U.clamp(e.x, World.left + 50, World.right - 50);
              poseLerpInto(e.pose, target, 0.3);
            },
            onEnd(e) { FX.smoke(e.x, FLOOR - 80, '#1a1028', 14, 40, 26); delete f.buffs.mahoraga; },
            render(ctx, e) {
              ctx.save(); ctx.globalAlpha = Math.min(1, e.age / 15, (e.life - e.age) / 15);
              ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(e.x, FLOOR + 3, 70, 12, 0, 0, 6.283); ctx.fill();
              drawStickman(ctx, MAHORAGA, e.pose, e.x, e.y, e.dir, { wheel: e.wheel, white: e.flash > 0 });
              const bw = 110, bx = e.x - bw / 2, by = FLOOR - 335;
              ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx - 2, by - 2, bw + 4, 11);
              ctx.fillStyle = '#f2efe6'; ctx.fillRect(bx, by, bw * Math.max(0, e.hp) / e.maxHp, 7);
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Rabbit Escape', icon: '兎', color: '#f2f2f6', cost: 20, cd: 300, ai: { min: 0, max: 700 },
      desc: 'Flings a rapid barrage of shadow rabbits straight ahead like a beam. Each rabbit that connects nibbles the opponent and swats away projectiles; the rest tumble to the ground and scatter, still soaking up attacks.',
      move: {
        id: 'rabbits', kind: 'special', startup: 4, active: 0, recovery: 0, total: 42, poses: ['castW', 'cast'],
        getPose: (f, fr) => (fr < 4 ? POSES.castW : fr < 36 ? POSES.cast : POSES.idle),
        onFrame(f, fr) {
          if (fr === 4) { Sound.play('dash'); FX.smoke(f.x + f.facing * 40, f.y - 100, '#1a1028', 8, 18, 14); }
          if (fr < 4 || fr >= 34 || fr % 2) return;
          if (fr % 6 === 0) Sound.play('whoosh');
          const hp = handPos(f);
          spawnSummon(f, {
            x: hp.x, y: hp.y + U.rand(-10, 10), vx: f.facing * U.rand(17, 22), vy: U.rand(-1.6, 1.2), r: 14, clash: 1, pierce: true,
            life: Math.round(U.rand(120, 160) * f.summonMult()), dir: f.facing, flying: true,
            hits: { dmg: 7, kb: 2, stun: 10, noScale: true, quiet: true, hitstop: 0, sfx: 'tick', color: '#f2f2f6' },
            onHit(e) { e.vx = -e.vx * 0.25; e.vy = -5; e.hits = null; },
            name: 'RABBIT', hp: 10, maxHp: 10, noBar: true, hurtbox: e => ({ x: e.x - 12, y: e.y - 22, w: 24, h: 22 }),
            tick(e) {
              if (e.flying) {
                // the beam flies nearly flat, then the rabbits drop and land
                e.vy += e.age < 14 ? 0.05 : 0.8;
                if (e.age % 2 === 0) FX.add({ type: 'smoke', x: e.x, y: e.y, life: 10, size: 4, color: '#d8d8e8', drag: 0.9 });
                if (e.x < World.left + 10 || e.x > World.right - 10) { e.vx = -e.vx * 0.3; e.x = U.clamp(e.x, World.left + 10, World.right - 10); }
                if (e.y >= FLOOR && e.vy > 0) { e.flying = false; e.y = FLOOR; e.vx = 0; e.vy = 0; e.hits = null; e.dir = U.pick([-1, 1]); FX.dust(e.x, FLOOR, 2); }
                return;
              }
              e.hop = (e.hop || U.randInt(0, 20)) + 1;
              if (e.hop % 22 === 0) e.dir = Math.random() < 0.3 ? -e.dir : e.dir;
              e.x = U.clamp(e.x + e.dir * 1.6, World.left + 10, World.right - 10);
              e.y = FLOOR - Math.abs(Math.sin(e.hop * 0.28)) * 14;
              e.vy = 0;
            },
            onEnd(e) { FX.smoke(e.x, e.y - 10, '#1a1028', 2, 6, 8); },
            render(ctx, e) {
              ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.dir, 1);
              if (e.flying) ctx.rotate(Math.atan2(e.vy, Math.abs(e.vx)) * 0.6);
              ctx.globalAlpha = Math.min(1, (e.life - e.age) / 10);
              ctx.fillStyle = '#f2f2f6'; ctx.strokeStyle = '#16161c'; ctx.lineWidth = 1.5;
              ctx.beginPath(); ctx.ellipse(0, -8, 10, 7, 0, 0, 6.283); ctx.fill(); ctx.stroke();
              ctx.beginPath(); ctx.arc(8, -14, 5, 0, 6.283); ctx.fill(); ctx.stroke();
              ctx.beginPath(); ctx.ellipse(7, -23, 1.8, 6, -0.2, 0, 6.283); ctx.ellipse(10, -22, 1.8, 6, 0.2, 0, 6.283); ctx.fill(); ctx.stroke();
              ctx.fillStyle = '#16161c'; ctx.fillRect(9, -15, 1.6, 1.6);
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Great Serpent', icon: '蛇', color: '#7fae6a', cost: 30, cd: 420, ai: { min: 0, max: 700 },
      desc: 'A colossal serpent bursts from the ground beneath the opponent, seizes them in its jaws, hoists them high and slams them down. Destroy it to break free.',
      move: {
        id: 'serpent', kind: 'special', startup: 12, active: 1, recovery: 18, poses: ['sign', 'point'],
        onFrame(f, fr, t) {
          if (fr !== 12 || !t) return;
          const gy = World.groundAt(t.x, t.y);
          spawnSummon(f, {
            x: t.x, y: gy, life: 130, delay: 26, rise: 0, name: 'GREAT SERPENT', hp: 240, maxHp: 240,
            hurtbox: e => ({ x: e.x - 42, y: e.y - 60 - e.rise * 280, w: 84, h: 60 + e.rise * 280 }),
            tick(e, tt) {
              if (e.age < e.delay) { if (tt) e.x = U.lerp(e.x, tt.x, 0.06); return; }
              e.rise = Math.min(1, (e.age - e.delay) / 8);
              if (e.age === e.delay) {
                Sound.play('roar'); FX.debris(e.x, e.y, '#3a4a2a', 22, 14); FX.dust(e.x, e.y, 16); FX.shake(16);
                if (tt && tt.state !== 'ko' && tt.invuln <= 0 && Math.abs(tt.x - e.x) < 95 && Math.abs(tt.y - e.y) < 160) {
                  e.held = tt;
                  Combat.hit(f, tt, { dmg: 30, stunAdd: 80, freeze: true, unblockable: true, kb: 0, hitstop: 6, x: e.x, y: tt.midY, dir: dirTo(f, tt) });
                }
              }
              const h = e.held;
              if (h && h.state === 'stun') {
                const k = e.age - e.delay;
                if (k < 40) { h.x = e.x; h.y = e.y - Math.min(220, k * 6); }
                if (k === 40) {
                  h.y = e.y; h.stun = 0; h.frozen = false; h.setState('idle');
                  Combat.hit(f, h, { dmg: 70, kb: 6, kby: -6, launch: true, unblockable: true, sureHit: true, hitstop: 12, shake: 14, sfx: 'heavy', x: h.x, y: h.y - 30, dir: dirTo(f, h) });
                  FX.dust(h.x, h.y, 14); e.held = null; e.life = Math.min(e.life, e.age + 16);
                }
              } else if (!h && e.age > e.delay + 30) e.life = Math.min(e.life, e.age + 14);
            },
            onEnd(e) { FX.smoke(e.x, e.y - 60, '#1a1028', 10, 26, 20); if (e.slain && e.held && e.held.stun > 1) { e.held.stun = 1; e.held.y = e.y; } },
            render(ctx, e) {
              if (e.age < e.delay) {
                ctx.save(); ctx.globalAlpha = 0.4 + 0.3 * Math.sin(e.age * 0.6) ** 2; ctx.fillStyle = '#4a6a3a';
                ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, 80, 12, 0, 0, 6.283); ctx.fill(); ctx.restore();
                return;
              }
              const top = e.y - 60 - e.rise * (e.held ? Math.min(220, (e.age - e.delay) * 6) + 60 : 280);
              ctx.save(); ctx.globalAlpha = Math.min(1, (e.life - e.age) / 12);
              ctx.lineCap = 'round'; ctx.strokeStyle = '#16200f'; ctx.lineWidth = 64;
              ctx.beginPath(); ctx.moveTo(e.x, e.y + 20); ctx.bezierCurveTo(e.x - 70, e.y - 100, e.x + 70, top + 100, e.x, top); ctx.stroke();
              ctx.strokeStyle = '#5f8a4a'; ctx.lineWidth = 56; ctx.stroke();
              ctx.strokeStyle = '#7fae6a'; ctx.lineWidth = 18; ctx.stroke();
              ctx.fillStyle = '#5f8a4a'; ctx.strokeStyle = '#16200f'; ctx.lineWidth = 4;
              ctx.beginPath(); ctx.ellipse(e.x + 10, top - 10, 52, 34, 0, 0, 6.283); ctx.fill(); ctx.stroke();
              ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(e.x + 30, top + 4); ctx.lineTo(e.x + 62, top - 2); ctx.lineTo(e.x + 30, top + 14); ctx.fill();
              ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(e.x + 30, top - 20, 7, 0, 6.283); ctx.fill();
              ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(e.x + 31, top - 20, 2, 5, 0, 0, 6.283); ctx.fill();
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Piercing Ox', icon: '牛', color: '#a0785a', cost: 35, cd: 400, ai: { min: 80, max: 1000 },
      desc: 'A shadow ox charges across the whole arena, gaining speed as it goes and goring everyone in its path. Can be destroyed mid-charge.',
      move: {
        id: 'ox', kind: 'special', startup: 14, active: 1, recovery: 16, poses: ['sign', 'cast'],
        onFrame(f, fr) {
          if (fr !== 14) return;
          Sound.play('roar'); FX.smoke(f.x - f.facing * 40, FLOOR - 30, '#1a1028', 10, 26, 20);
          spawnProj(f, {
            x: f.x - f.facing * 30, y: FLOOR - 50, vx: f.facing * 4, r: 44, life: 140, pierce: true, wallKill: true, dir: f.facing,
            name: 'PIERCING OX', hp: 200, maxHp: 200, hurtbox: e => ({ x: e.x - 50, y: FLOOR - 92, w: 100, h: 92 }),
            hits: { dmg: 85, kb: 16, kby: -11, launch: true, hitstop: 10, shake: 12, sfx: 'heavy' },
            tick(e) {
              e.vx = U.clamp(e.vx + e.dir * 0.55, -17, 17);
              if (e.age % 3 === 0) FX.dust(e.x - e.dir * 40, FLOOR, 2);
            },
            onEnd(e) { FX.smoke(e.x, FLOOR - 40, '#1a1028', 10, 30, 22); },
            render(ctx, e) {
              ctx.save(); ctx.translate(e.x, FLOOR); ctx.scale(e.dir, 1);
              const g = Math.sin(e.age * 0.6) * 9;
              ctx.strokeStyle = '#120c08'; ctx.lineWidth = 7; ctx.lineCap = 'round';
              for (const [lx, ph] of [[-30, 1], [-18, -1], [18, -1], [30, 1]]) { ctx.beginPath(); ctx.moveTo(lx, -40); ctx.lineTo(lx + g * ph, 0); ctx.stroke(); }
              ctx.fillStyle = '#3a2a22'; ctx.strokeStyle = '#120c08'; ctx.lineWidth = 3;
              ctx.beginPath(); ctx.ellipse(0, -52, 48, 26, 0, 0, 6.283); ctx.fill(); ctx.stroke();
              ctx.beginPath(); ctx.ellipse(46, -58, 18, 15, 0.3, 0, 6.283); ctx.fill(); ctx.stroke();
              ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 5;
              ctx.beginPath(); ctx.moveTo(48, -70); ctx.quadraticCurveTo(64, -86, 76, -78); ctx.moveTo(40, -70); ctx.quadraticCurveTo(46, -90, 60, -94); ctx.stroke();
              ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(54, -60, 3, 0, 6.283); ctx.fill();
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Max Elephant', icon: '象', color: '#6fb6ff', cost: 45, cd: 600, ai: { min: 0, max: 1100 },
      desc: 'A colossal elephant appears above the opponent and floods the area with a torrent of water, then crashes down. Destroy it to stop the flood.',
      move: {
        id: 'elephant', kind: 'special', startup: 16, active: 1, recovery: 18, poses: ['sign', 'upper'],
        onFrame(f, fr, t) {
          if (fr !== 16 || !t) return;
          Sound.play('roar');
          spawnSummon(f, {
            x: U.clamp(t.x, World.left + 80, World.right - 80), y: FLOOR - 340, life: 130, name: 'MAX ELEPHANT', hp: 220, maxHp: 220,
            hurtbox: e => ({ x: e.x - 70, y: e.y - 50, w: 140, h: 100 }),
            tick(e, tt) {
              if (e.age < 90) {
                if (tt) e.x = U.lerp(e.x, tt.x, 0.015);
                if (e.age % 2 === 0) for (let i = 0; i < 3; i++) FX.add({ type: 'spark', x: e.x + 40 + U.rand(-12, 12), y: e.y + 40, vx: U.rand(-1, 1), vy: U.rand(10, 16), life: 24, size: 4, color: U.pick(['#6fb6ff', '#bfe6ff', '#ffffff']) });
                for (const v of World.enemies(f)) {
                  if (v.state === 'ko' || Math.abs(v.x - (e.x + 40)) > 70 || e.age % 8) continue;
                  Combat.hit(f, v, { dmg: 9, kb: (v.x >= e.x + 40 ? 1 : -1) * 2, stun: 10, hitstop: 0, noScale: true, quiet: true, color: '#6fb6ff', sfx: 'tick', x: v.x, y: v.midY, dir: v.x >= e.x + 40 ? 1 : -1 });
                }
                return;
              }
              e.vy = Math.min((e.vy || 0) + 1.4, 24); e.y += e.vy;
              if (e.y >= FLOOR - 50) {
                FX.explosion(e.x, FLOOR - 30, 110, ['#ffffff', '#bfe6ff', '#6fb6ff']); FX.shake(18); FX.debris(e.x, FLOOR, '#4a4a5a', 14, 12); Sound.play('boom');
                for (const v of World.enemies(f)) if (v.state !== 'ko' && Math.abs(v.x - e.x) < 130 && v.y > FLOOR - 200)
                  Combat.hit(f, v, { dmg: 80, kb: 12, kby: -12, launch: true, hitstop: 10, x: v.x, y: v.midY, dir: v.x >= e.x ? 1 : -1 });
                e.kill('landed');
              }
            },
            onEnd(e, why) { if (why !== 'landed') FX.smoke(e.x, e.y, '#1a1028', 12, 40, 26); },
            render(ctx, e) {
              ctx.save(); ctx.globalAlpha = Math.min(1, e.age / 10);
              if (e.age < 90) {
                const g = ctx.createLinearGradient(0, e.y + 40, 0, FLOOR);
                g.addColorStop(0, 'rgba(160,210,255,0.9)'); g.addColorStop(1, 'rgba(80,150,255,0.5)');
                ctx.fillStyle = g; ctx.fillRect(e.x + 40 - 22 - Math.sin(e.age * 0.4) * 3, e.y + 40, 44, FLOOR - e.y - 40);
                ctx.fillStyle = 'rgba(150,200,255,0.5)'; ctx.beginPath(); ctx.ellipse(e.x + 40, FLOOR, 90, 10, 0, 0, 6.283); ctx.fill();
              }
              ctx.translate(e.x, e.y);
              ctx.fillStyle = '#7a7f8a'; ctx.strokeStyle = '#1a1c22'; ctx.lineWidth = 3;
              for (const lx of [-46, -18, 18, 46]) { ctx.fillRect(lx - 9, 20, 18, 32); ctx.strokeRect(lx - 9, 20, 18, 32); }
              ctx.beginPath(); ctx.ellipse(0, 0, 70, 42, 0, 0, 6.283); ctx.fill(); ctx.stroke();
              ctx.beginPath(); ctx.ellipse(48, -6, 30, 30, 0, 0, 6.283); ctx.fill(); ctx.stroke();
              ctx.fillStyle = '#8a8f9a'; ctx.beginPath(); ctx.ellipse(34, -6, 20, 26, 0, 0, 6.283); ctx.fill(); ctx.stroke();
              ctx.strokeStyle = '#1a1c22'; ctx.lineWidth = 12; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(70, 4); ctx.quadraticCurveTo(84, 30, 40, 42); ctx.stroke();
              ctx.strokeStyle = '#7a7f8a'; ctx.lineWidth = 8; ctx.stroke();
              ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(60, -14, 3, 0, 6.283); ctx.fill();
              ctx.restore();
            },
          });
        },
      },
    },
  ],
};

/* ---------------------------------------------------------------- Cursed spirits (Story Mode) */

const lungeMove = (o = {}) => ({
  id: 'lunge', kind: 'special', startup: o.startup || 11, active: 6, recovery: 22, lunge: o.lunge || 13, poses: ['heavyW', 'heavy'], sfx: 'roar',
  hitbox: { x: 0, y: -115, w: 74, h: 64 }, hit: { dmg: o.dmg || 45, kb: 8, kby: -4, stun: 26, fx: 'slash', color: '#b06bff' },
});

const spitMove = (o = {}) => ({
  id: 'spit', kind: 'special', startup: 14, active: 1, recovery: 16, poses: ['castW', 'cast'],
  onFrame(f, fr) {
    if (fr !== 14) return;
    Sound.play('bite');
    for (let i = 0; i < (o.count || 1); i++) {
      spawnProj(f, {
        x: f.x + f.facing * 30, y: f.y - 115 * f.scale, vx: f.facing * (8 + i * 2), vy: -4 - i, r: 13, life: 90, clash: 1,
        hits: { dmg: o.dmg || 38, kb: 4, stun: 20, color: '#9be05a' },
        tick(e) { e.vy += 0.25; if (e.y > FLOOR) e.kill('ground'); if (e.age % 3 === 0) FX.glow(e.x, e.y, '#7fd04a', 8, 10); },
        onEnd(e) { FX.spark(e.x, e.y, '#9be05a', 8, 4); },
        render(ctx, e) { glowOrb(ctx, e.x, e.y, e.r, '#eaffc0', '#5fb83a'); },
      });
    }
  },
});

const curseLook = (skin, top) => ({ skin, top, pants: top, accent: skin, shoe: '#0c0a10' });

const CURSE_G4 = {
  id: 'g4', name: 'Grade 4 Curse', short: 'CURSE', title: 'Lowly Cursed Spirit', kanji: '四級呪霊', color: '#a07ad0', curse: true,
  style: 'Clumsy brawler. Weak alone, dangerous in the dark.', bio: 'A low-grade curse born from fear of the night.',
  passive: { name: 'Feral', desc: 'No technique — only hunger.' },
  hp: 450, speed: 0.85, scale: 0.92, melee: { power: 0.65 },
  look: curseLook('#7b5ea7', '#3a2a50'), aiStyle: { pref: 70 },
  drawHead(g) {
    const { ctx, sk } = g, [hx, hy] = sk.head;
    headCircle(g, hx, hy, 18, '#7b5ea7');
    eyeDots(g, [[hx + 6, hy - 3, 7, '#f5f0e0', '#c4122f']]);
    if (!g.o.white && !g.o.tint) { ctx.strokeStyle = '#1a0f22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx - 2, hy + 9); for (let i = 0; i < 5; i++) ctx.lineTo(hx + i * 4, hy + (i % 2 ? 12 : 8)); ctx.stroke(); }
  },
  abilities: [
    { name: 'Lunge Bite', icon: '噛', color: '#b06bff', cost: 15, cd: 200, ai: { min: 60, max: 220 }, desc: 'Leaps forward with gnashing teeth.', move: lungeMove({ dmg: 40 }) },
    { name: 'Gnash Flurry', icon: '咬', color: '#b06bff', cost: 15, cd: 180, ai: { min: 0, max: 100 }, desc: 'A frenzy of rapid bites up close.',
      move: { id: 'gnash', kind: 'special', startup: 6, active: 24, recovery: 14, hitEvery: 6, poses: ['jabW', 'jab'], sfx: 'bite',
        hitbox: { x: 4, y: -110, w: 62, h: 50 }, hit: { dmg: 12, kb: 1, stun: 16, fx: 'slash', color: '#b06bff', noScale: true, hitstop: 1 } } },
    { name: 'Screech', icon: '叫', color: '#ff9ad0', cost: 20, cd: 300, ai: { min: 0, max: 180 }, desc: 'A piercing shriek that briefly stuns anyone nearby.',
      move: { id: 'screech', kind: 'special', startup: 12, active: 1, recovery: 20, poses: ['castW', 'cast'],
        onFrame(f, fr, t) {
          if (fr !== 12) return;
          Sound.play('roar'); for (let i = 0; i < 2; i++) FX.ring(f.x, f.y - 110, '#ff9ad0', 120 + i * 60, 18, 3);
          for (const v of World.enemies(f)) if (near(v, f.x, f.midY, 190, 180)) Combat.hit(f, v, { dmg: 15, stunAdd: 35, kb: 3, x: v.x, y: v.midY, dir: dirTo(f, v) });
        } } },
    null,
  ],
};

const CURSE_G3 = {
  id: 'g3', name: 'Grade 3 Curse', short: 'CURSE', title: 'Horned Cursed Spirit', kanji: '三級呪霊', color: '#7fd04a', curse: true,
  style: 'Spits acid from range and pounces when you close in.', bio: 'A many-eyed curse that festers in abandoned schools.',
  passive: { name: 'Many Eyes', desc: 'Sees everything. Understands nothing.' },
  hp: 600, speed: 0.9, melee: { power: 0.8 },
  look: curseLook('#5f8f5a', '#2a3a28'), aiStyle: { pref: 90 },
  drawHead(g) {
    const { ctx, sk, OL } = g, [hx, hy] = sk.head;
    ctx.fillStyle = g.col('#d9d0b0'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + s * 8 - 3, hy - 12); ctx.lineTo(hx + s * 14 - 2, hy - 30); ctx.lineTo(hx + s * 8 + 4, hy - 13); ctx.fill(); ctx.stroke(); }
    headCircle(g, hx, hy, 16, '#5f8f5a');
    eyeDots(g, [[hx + 5, hy - 4, 3, '#ffe36a'], [hx + 11, hy - 1, 3, '#ffe36a'], [hx + 6, hy + 4, 2.5, '#ffe36a'], [hx - 2, hy - 6, 2, '#ffe36a']]);
  },
  abilities: [
    { name: 'Acid Spit', icon: '酸', color: '#9be05a', cost: 15, cd: 150, ai: { min: 160, max: 650 }, desc: 'Lobs a glob of corrosive cursed fluid.', move: spitMove() },
    { name: 'Pounce', icon: '跳', color: '#b06bff', cost: 15, cd: 200, ai: { min: 60, max: 230 }, desc: 'A fast leaping strike.', move: lungeMove({ dmg: 48 }) },
    { name: 'Horn Charge', icon: '角', color: '#d9d0b0', cost: 20, cd: 240, ai: { min: 80, max: 360 }, desc: 'Lowers its horns and charges across the ground, goring whoever it hits.',
      move: { id: 'horn', kind: 'special', startup: 10, active: 16, recovery: 16, keepVel: true, poses: ['heavyW', 'dash'], sfx: 'roar',
        hitbox: { x: 0, y: -120, w: 70, h: 80 }, hit: { dmg: 55, kb: 12, kby: -8, launch: true, hitstop: 7, color: '#d9d0b0' },
        onFrame(f, fr) { if (fr >= 10 && fr < 26) { f.vx = f.facing * 14; if (fr % 3 === 0) FX.dust(f.x, f.y, 2); } if (fr === 26) f.vx *= 0.2; } } },
    { name: 'Eye Beam', icon: '眼', color: '#ffe36a', cost: 25, cd: 300, ai: { min: 150, max: 900 }, desc: 'All its eyes fire at once: a thin, fast beam across the arena.',
      move: { id: 'eyebeam', kind: 'special', startup: 16, active: 1, recovery: 18, poses: ['castW', 'cast'],
        onFrame(f, fr) {
          if (fr !== 16) return;
          Sound.play('zap');
          spawnProj(f, { x: f.x + f.facing * 20, y: f.y - 130, vx: f.facing * 30, r: 12, life: 45,
            hits: { dmg: 45, kb: 5, stun: 20, fx: 'zap', sfx: 'zap', hitstop: 4 },
            render(ctx, e) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffe36a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(e.x - e.vx * 3, e.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.restore(); } });
        } } },
  ],
};

const FINGER_BEARER = {
  id: 'finger', name: 'Finger Bearer', short: 'FINGER BEARER', title: 'Special Grade Curse', kanji: '特級呪霊', color: '#c96bff', curse: true,
  style: 'Slow, huge and crushing. Shockwaves cover the ground — jump them.', bio: 'A curse that devoured one of Sukuna\'s fingers and swelled into a special grade.',
  passive: { name: 'Bloated Power', desc: 'Massive body, massive damage, heavy footsteps.' },
  hp: 1000, speed: 0.72, scale: 1.3, melee: { power: 1.25, reach: 10 },
  look: curseLook('#4b3b5c', '#2a1f36'), aiStyle: { pref: 95 },
  drawHead(g) {
    const { ctx, sk } = g, [hx, hy] = sk.head;
    headCircle(g, hx, hy, 19, '#4b3b5c');
    if (g.o.white || g.o.tint) return;
    ctx.fillStyle = '#1a0510'; ctx.beginPath(); ctx.ellipse(hx + 4, hy + 6, 13, 7, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#f0e8d0';
    for (let i = 0; i < 6; i++) { const x = hx - 7 + i * 4.5; ctx.beginPath(); ctx.moveTo(x, hy + 1); ctx.lineTo(x + 2, hy + 6); ctx.lineTo(x + 4, hy + 1); ctx.fill(); }
    eyeDots(g, [[hx + 2, hy - 9, 2.5, '#ff3a3a'], [hx + 8, hy - 8, 2.5, '#ff3a3a'], [hx + 13, hy - 5, 2, '#ff3a3a'], [hx - 4, hy - 10, 2, '#ff3a3a'], [hx + 6, hy - 14, 2, '#ff3a3a']]);
  },
  abilities: [
    {
      name: 'Ground Slam', icon: '震', color: '#c9a07a', cost: 25, cd: 260, ai: { min: 0, max: 520 }, desc: 'Smashes the floor, sending shockwaves racing in both directions.',
      move: {
        id: 'slam', kind: 'special', startup: 22, active: 1, recovery: 26, poses: ['slashW', 'slash'],
        onFrame(f, fr) {
          if (fr !== 22) return;
          FX.shake(12); FX.dust(f.x, f.y, 14); FX.debris(f.x, f.y, '#5a4a3a', 10, 10); Sound.play('boom');
          for (const d of [-1, 1]) spawnProj(f, {
            x: f.x + d * 40, y: f.y - 22, vx: d * 9, r: 24, life: 60, hits: { dmg: 60, kb: 9, kby: -8, launch: true, color: '#c9a07a' },
            tick(e) { if (e.age % 2 === 0) FX.dust(e.x, FLOOR, 2); },
            render(ctx, e) { ctx.save(); ctx.fillStyle = 'rgba(200,170,130,0.8)'; ctx.beginPath(); ctx.moveTo(e.x - 26, FLOOR); ctx.lineTo(e.x, FLOOR - 34); ctx.lineTo(e.x + 26, FLOOR); ctx.fill(); ctx.restore(); },
          });
        },
      },
    },
    {
      name: 'Cursed Roar', icon: '咆', color: '#ff6a6a', cost: 30, cd: 420, ai: { min: 0, max: 200 }, desc: 'A deafening roar that staggers anyone close by.',
      move: {
        id: 'roar', kind: 'special', startup: 16, active: 1, recovery: 26, poses: ['castW', 'cast'],
        onFrame(f, fr, t) {
          if (fr !== 16) return;
          Sound.play('roar'); FX.shake(10);
          for (let i = 0; i < 3; i++) FX.ring(f.x, f.y - 120, '#ff9a9a', 140 + i * 60, 22 + i * 4, 4);
          if (near(t, f.x, f.midY, 240, 200)) Combat.hit(f, t, { dmg: 25, stunAdd: 45, kb: 4, x: t.x, y: t.midY, dir: dirTo(f, t) });
        },
      },
    },
    { name: 'Bile Spray', icon: '酸', color: '#9be05a', cost: 20, cd: 220, ai: { min: 150, max: 600 }, desc: 'Sprays three globs of corrosive fluid.', move: spitMove({ count: 3, dmg: 32 }) },
    { name: 'Gorge', icon: '喰', color: '#c96bff', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 }, desc: 'ULTIMATE. Devours its own cursed energy in a feeding frenzy: heals 200 and becomes faster and stronger for 10 seconds.',
      move: { id: 'gorge', kind: 'ult', startup: 30, active: 1, recovery: 14, poses: ['heavyW', 'win'],
        onStart(f) { f.invuln = 40; FX.banner('ULTIMATE', 'GORGE', '#c96bff', 100); Sound.play('roar'); },
        onFrame(f, fr) {
          if (fr !== 30) return;
          f.hp = Math.min(f.maxHp, f.hp + 200); f.buffs.redscale = 600;
          FX.shake(14); FX.ring(f.x, f.y - 100, '#c96bff', 160, 24, 6); FX.text(f.x, f.y - 230, '+200', '#9be05a', 28, 60);
        } } },
  ],
};

const HANAMI = {
  id: 'hanami', name: 'Hanami', short: 'HANAMI', title: 'Disaster Curse of the Forest', kanji: '花御', color: '#8fc45a', curse: true,
  style: 'Zone control with erupting roots and seed bombs. Heals itself in a field of flowers.', bio: 'A disaster curse born from humanity\'s fear of the forest.',
  passive: { name: 'Verdant Body', desc: 'Its wooden body slowly regrows, regenerating health over time.' },
  hp: 1000, speed: 0.9, scale: 1.1, melee: { power: 1.05, reach: 8 },
  passiveTick(f) { if (f.state !== 'ko' && World.active) f.hp = Math.min(f.maxHp, f.hp + 0.06); },
  look: curseLook('#e9e2d2', '#3e5a2c'), aiStyle: { pref: 230, ranged: true },
  drawHead(g) {
    const { ctx, sk, col, OL } = g, [hx, hy] = sk.head;
    headCircle(g, hx, hy, 16, '#e9e2d2');
    ctx.strokeStyle = col('#5a3a1e'); ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const [ox, oy, ex, ey] of [[6, -2, 26, -26], [11, 0, 34, -14]]) {
      ctx.beginPath(); ctx.moveTo(hx + ox, hy + oy); ctx.quadraticCurveTo(hx + ox + 14, hy + oy - 4, hx + ex, hy + ey); ctx.stroke();
    }
    if (g.o.white || g.o.tint) return;
    ctx.fillStyle = '#8fc45a'; ctx.strokeStyle = OL; ctx.lineWidth = 1;
    for (const [x, y] of [[26, -26], [34, -14], [18, -12]]) { ctx.beginPath(); ctx.ellipse(hx + x, hy + y, 5, 3, 0.6, 0, 6.283); ctx.fill(); }
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hx + 3, hy + 8); ctx.lineTo(hx + 12, hy + 8); ctx.stroke();
  },
  abilities: [
    {
      name: 'Wooden Roots', icon: '根', color: '#a07a4a', cost: 20, cd: 200, ai: { min: 120, max: 900 }, desc: 'Roots burst from the ground beneath the opponent.',
      move: {
        id: 'roots', kind: 'special', startup: 14, active: 1, recovery: 18, poses: ['castW', 'point'],
        onFrame(f, fr, t) {
          if (fr !== 14 || !t) return;
          const gy = World.groundAt(t.x, t.y);
          eruption(f, t.x, { y: gy, delay: 28, w: 80, h: 160, kind: 'root', tele: '#8fc45a', sfx: 'heavy', debris: '#5a3a1e', hits: { dmg: 70, kb: 4, kby: -14, launch: true, fx: 'wood' } });
          eruption(f, t.x + dirTo(f, t) * 110, { y: gy, delay: 40, w: 70, h: 130, kind: 'root', tele: '#8fc45a', sfx: 'heavy', debris: '#5a3a1e', hits: { dmg: 55, kb: 4, kby: -12, launch: true, fx: 'wood' } });
        },
      },
    },
    {
      name: 'Cursed Buds', icon: '芽', color: '#ff9ad0', cost: 20, cd: 220, ai: { min: 150, max: 700 }, desc: 'Fires a spread of seed bombs that drain cursed energy on hit.',
      move: {
        id: 'buds', kind: 'special', startup: 12, active: 1, recovery: 18, poses: ['castW', 'cast'],
        onFrame(f, fr) {
          if (fr !== 12) return;
          Sound.play('whoosh');
          for (let i = 0; i < 3; i++) spawnProj(f, {
            x: f.x + f.facing * 30, y: f.y - 120, vx: f.facing * (7 + i * 2.2), vy: -5 + i * 1.5, r: 12, life: 100, clash: 1,
            hits: { dmg: 30, kb: 3, stun: 18, color: '#ff9ad0' },
            onHit(e, t) { t.ce = Math.max(0, t.ce - 8); },
            tick(e) { e.vy += 0.22; if (e.y > FLOOR) e.kill('ground'); },
            onEnd(e) { FX.spark(e.x, e.y, '#ff9ad0', 8, 4); },
            render(ctx, e) { ctx.fillStyle = '#5a7a2a'; ctx.beginPath(); ctx.arc(e.x, e.y, 9, 0, 6.283); ctx.fill(); ctx.fillStyle = '#ff9ad0'; ctx.beginPath(); ctx.arc(e.x, e.y - 5, 5, 0, 6.283); ctx.fill(); },
          });
        },
      },
    },
    {
      name: 'Flower Field', icon: '花', color: '#ffc0e0', cost: 30, cd: 600, ai: { min: 250, max: 1280, when: f => f.hp < f.maxHp * 0.65 }, desc: 'Blooms a field of flowers, restoring health over time.',
      move: {
        id: 'flowers', kind: 'special', startup: 20, active: 1, recovery: 20, poses: ['sign', 'sign'],
        onFrame(f, fr) {
          if (fr !== 20) return;
          Sound.play('heal');
          spawnSummon(f, {
            life: 90,
            tick(e) { if (f.state !== 'ko') f.hp = Math.min(f.maxHp, f.hp + 1); if (e.age % 3 === 0) FX.glow(f.x + U.rand(-60, 60), FLOOR - U.rand(0, 30), U.pick(['#ff9ad0', '#ffe0f0', '#cde88a']), 8, 30, 0, -1); },
            render(ctx) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffb3d9'; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(f.x - 80 + i * 18, FLOOR - 4, 5, 0, 6.283); ctx.fill(); } ctx.restore(); },
          });
        },
      },
    },
    {
      name: 'Sea of Shining Grasses', icon: '輝', color: '#ffe9a8', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'DOMAIN EXPANSION. A sea of glowing grass and blossoms spreads outward from Hanami until it fills the world. Inside it nothing happens — every opponent simply stands frozen in the light — and when it fades, they explode in a storm of petals.',
      move: {
        id: 'grasssea', kind: 'ult', startup: 60, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) { f.invuln = 70; domainCutscene(f, 'hands', 'SEA OF SHINING GRASSES'); FX.banner('DOMAIN EXPANSION', 'SEA OF SHINING GRASSES', '#ffe9a8', 130); FX.slow(40, 0.35); Sound.play('charge'); },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 40) return;
          Domains.start(f, {
            type: 'grasssea', life: 300, bg: drawGrassSeaBg, cx: f.x, cy: f.y - 60,
            onStart(d, t) { t.applyStun(310, true, true); },
            tick(d) {
              // purely beautiful: drifting petals and rising motes of light
              if (d.age % 2 === 0) FX.add({ type: 'glow', x: U.rand(0, W), y: FLOOR - U.rand(0, 60), vx: U.rand(-0.3, 0.3), vy: U.rand(-1.6, -0.6), life: 70, size: U.rand(4, 8), color: U.pick(['#fff3c0', '#ffe08a', '#d8ffb0']), drag: 0.995 });
              if (d.age % 4 === 0) FX.add({ type: 'clover', x: U.rand(-40, W), y: U.rand(-20, 200), vx: U.rand(0.6, 1.6), vy: U.rand(0.5, 1.2), life: 140, size: U.rand(3, 5), color: U.pick(['#ffc8e0', '#ffffff', '#ffb3d9']), drag: 1, rot: Math.random() * 6, vr: U.rand(-0.06, 0.06) });
            },
            onEnd(d, interrupted) {
              if (interrupted) return;
              // the light fades... and everyone caught inside bursts
              FX.flash('#fff3c0', 0.8); FX.shake(24); Sound.play('boom');
              for (const v of World.enemies(f)) {
                if (v.state === 'ko') continue;
                v.stun = 0; v.frozen = false; v.setState('idle');
                FX.explosion(v.x, v.midY, 150, ['#ffffff', '#ffe08a', '#ff9ad0']);
                for (let i = 0; i < 30; i++) FX.add({ type: 'clover', x: v.x, y: v.midY, vx: U.rand(-9, 9), vy: U.rand(-11, 3), life: U.rand(50, 80), size: U.rand(4, 7), color: U.pick(['#ffb3d9', '#ffffff', '#cde88a']), grav: 0.2, drag: 0.97, rot: Math.random() * 6, vr: U.rand(-0.2, 0.2) });
                Combat.hit(f, v, { dmg: 230, kb: 14, kby: -15, launch: true, unblockable: true, sureHit: true, noScale: true, hitstop: 18, shake: 18, sfx: 'boom', color: '#ffe08a', type: 'domain', x: v.x, y: v.midY, dir: dirTo(f, v) });
              }
            },
          });
        },
      },
    },
    {
      name: 'Bud Barrage', icon: '芽', color: '#cde88a', cost: 25, cd: 260, ai: { min: 100, max: 650 },
      desc: 'Flings a rapid stream of hard seed pods straight ahead, each bursting into petals on impact.',
      move: {
        id: 'budbarrage', kind: 'special', startup: 6, active: 0, recovery: 0, total: 46, poses: ['castW', 'cast'],
        getPose: (f, fr) => (fr < 6 ? POSES.castW : fr < 40 ? (Math.floor(fr / 4) % 2 ? POSES.cast : POSES.point) : POSES.idle),
        onFrame(f, fr) {
          if (fr < 6 || fr >= 40 || fr % 3) return;
          if (fr % 6 === 0) Sound.play('whoosh');
          const hp = handPos(f);
          spawnProj(f, {
            x: hp.x, y: hp.y + U.rand(-14, 14), vx: f.facing * U.rand(15, 19), vy: U.rand(-1.2, 1.2), r: 10, life: 60, clash: 1,
            hits: { dmg: 11, kb: 2, stun: 12, noScale: true, hitstop: 1, color: '#cde88a', sfx: 'hit' },
            onEnd(e, why) { if (why === 'hit') FX.add({ type: 'clover', x: e.x, y: e.y, vx: U.rand(-2, 2), vy: -2, life: 30, size: 5, color: '#ffb3d9', drag: 0.95, rot: 0, vr: 0.1 }); FX.spark(e.x, e.y, '#ffb3d9', 4, 3); },
            render(ctx, e) {
              ctx.fillStyle = '#6a8a3a'; ctx.strokeStyle = '#2a3a14'; ctx.lineWidth = 1.5;
              ctx.beginPath(); ctx.ellipse(e.x, e.y, 9, 7, e.age * 0.3, 0, 6.283); ctx.fill(); ctx.stroke();
              ctx.fillStyle = '#ffb3d9'; ctx.beginPath(); ctx.arc(e.x - Math.sign(e.vx) * 4, e.y - 3, 3.5, 0, 6.283); ctx.fill();
            },
          });
        },
      },
    },
  ],
};

const JOGO = {
  id: 'jogo', name: 'Jogo', short: 'JOGO', title: 'Disaster Curse of Volcanoes', kanji: '漏瑚', color: '#ff8a2a', curse: true,
  style: 'Ranged fire attacks, homing insects, erupting volcanoes and a meteor big enough to end a fight.', bio: 'A hot-tempered disaster curse born from humanity\'s fear of the earth.',
  passive: { name: 'Burning Body', desc: 'Jogo\'s punches and kicks set the opponent ablaze, burning away health for 2 seconds (burns can\'t finish a fight).' },
  hp: 1000, speed: 0.98, melee: { power: 1.05 },
  onDealHit(f, t, h) { if (h.melee) t.buffs.burn = 120; },
  look: curseLook('#d9cbb0', '#5a2a18'), aiStyle: { pref: 300, ranged: true },
  passiveTick(f) { if (f.anim % 7 === 0 && f.state !== 'ko') { const h = headPos(f); FX.smoke(h.x, h.y - 26 * f.scale, '#6a6060', 1, 3, 8); } },
  drawHead(g) {
    const { ctx, sk, col, OL } = g, [hx, hy] = sk.head;
    ctx.fillStyle = col('#d9cbb0'); ctx.strokeStyle = OL; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx - 14, hy + 12); ctx.lineTo(hx + 16, hy + 12); ctx.lineTo(hx + 9, hy - 22); ctx.lineTo(hx - 7, hy - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (g.o.white || g.o.tint) return;
    ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.ellipse(hx + 1, hy - 22, 8, 3, 0, 0, 6.283); ctx.fill();
    eyeDots(g, [[hx + 6, hy - 4, 5, '#f8f0e0', '#1a1010']]);
    ctx.strokeStyle = '#3a2010'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hx, hy + 7); ctx.lineTo(hx + 13, hy + 6); ctx.stroke();
  },
  abilities: [
    {
      name: 'Ember Insects', icon: '蟲', color: '#ffb03a', cost: 20, cd: 200, ai: { min: 120, max: 900 }, desc: 'Releases three burning insects that home in on the target.',
      move: {
        id: 'embers', kind: 'special', startup: 12, active: 1, recovery: 16, poses: ['castW', 'cast'],
        onFrame(f, fr) {
          if (fr !== 12) return;
          Sound.play('fire');
          for (let i = 0; i < 3; i++) spawnProj(f, {
            x: f.x + f.facing * 30, y: f.y - 110 - i * 15, vx: f.facing * 5, vy: -3 + i * 2, r: 10, life: 130, clash: 1, wallKill: false,
            hits: { dmg: 26, kb: 3, stun: 16, fx: 'fire', hitstop: 2 },
            tick(e, t) {
              if (t && e.age > 10) { const a = Math.atan2(t.midY - e.y, t.x - e.x); e.vx = U.lerp(e.vx, Math.cos(a) * 6.5, 0.05); e.vy = U.lerp(e.vy, Math.sin(a) * 6.5, 0.05); }
              if (e.age % 3 === 0) FX.glow(e.x, e.y, '#ff7a1a', 8, 10);
            },
            onEnd(e) { FX.spark(e.x, e.y, '#ffb03a', 6, 4); },
            render(ctx, e) { glowOrb(ctx, e.x, e.y, 7, '#fff3b0', '#ff7a1a'); },
          });
        },
      },
    },
    {
      name: 'Volcano', icon: '火', color: '#ff5a1a', cost: 30, cd: 300, ai: { min: 0, max: 1100 }, desc: 'A volcano erupts beneath the opponent after a short warning.',
      move: {
        id: 'volcano', kind: 'special', startup: 16, active: 1, recovery: 18, poses: ['castW', 'point'],
        onFrame(f, fr, t) {
          if (fr !== 16 || !t) return;
          eruption(f, t.x, { y: World.groundAt(t.x, t.y), delay: 32, w: 90, h: 200, kind: 'fire', hits: { dmg: 85, kb: 4, kby: -15, launch: true, fx: 'fire' } });
        },
      },
    },
    {
      name: 'Fire Breath', icon: '焔', color: '#ff9a2a', cost: 20, cd: 200, ai: { min: 0, max: 190 },
      desc: 'Exhales a roaring cone of flame that hits repeatedly and leaves the opponent burning.',
      move: {
        id: 'breath', kind: 'special', startup: 10, active: 24, recovery: 16, poses: ['castW', 'cast'], hitEvery: 6,
        hitbox: { x: 10, y: -150, w: 175, h: 90 }, hit: { dmg: 15, kb: 2.5, stun: 14, fx: 'fire', sfx: 'fire', hitstop: 1, noScale: true },
        onFrame(f, fr) {
          if (fr === 10) Sound.play('fire');
          if (fr < 10 || fr >= 34) return;
          const h = headPos(f);
          for (let i = 0; i < 3; i++) FX.glow(h.x + f.facing * U.rand(10, 40), h.y + 8, U.pick(['#fff3b0', '#ff9a2a', '#ff3a1a']), U.rand(10, 20), 18, f.facing * U.rand(7, 12), U.rand(-1.5, 1.5));
        },
        onHit(f, t) { t.buffs.burn = 120; },
      },
    },
    {
      name: 'Maximum: Meteor', icon: '隕', color: '#ff3a1a', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 }, desc: 'ULTIMATE. Summons a colossal meteor that crashes down on the opponent.',
      move: {
        id: 'meteor', kind: 'ult', startup: 40, active: 0, recovery: 10, poses: ['sign', 'upper'],
        onStart(f) { f.invuln = 50; FX.banner('MAXIMUM', 'METEOR', '#ff8a2a', 110); FX.slow(30, 0.4); Sound.play('charge'); },
        onFrame(f, fr, t) {
          if (fr !== 30) return;
          Sound.play('fire');
          spawnSummon(f, {
            x: t ? t.x : W / 2, y: -140, life: 400, r: 90, falling: false,
            tick(e, t2) {
              if (!e.falling) { if (t2) e.x = U.lerp(e.x, t2.x, 0.08); if (e.age > 55) e.falling = true; return; }
              e.vy = Math.min(e.vy + 1.2, 22);
              FX.glow(e.x + U.rand(-50, 50), e.y - 60, '#ff7a1a', 26, 16, 0, -3);
              if (e.y + e.r * 0.6 >= FLOOR) {
                e.kill('land'); FX.explosion(e.x, FLOOR - 40, 200, ['#fff3b0', '#ff9a2a', '#ff3a1a']); FX.shake(24); FX.flash('#ffb36a', 0.6);
                FX.debris(e.x, FLOOR, '#4a2a1a', 20, 14); Sound.play('boom');
                if (t2 && t2.state !== 'ko' && Math.abs(t2.x - e.x) < 230) Combat.hit(f, t2, { dmg: 200, kb: 16, kby: -15, launch: true, fx: 'fire', hitstop: 14, x: t2.x, y: t2.midY, dir: t2.x >= e.x ? 1 : -1 });
              }
            },
            render(ctx, e) {
              const sh = Math.min(1, e.age / 50);
              ctx.save(); ctx.globalAlpha = 0.35 * sh; ctx.fillStyle = '#ff3a1a';
              ctx.beginPath(); ctx.ellipse(e.x, FLOOR + 2, 160 * sh, 12, 0, 0, 6.283); ctx.fill(); ctx.restore();
              ctx.save(); ctx.fillStyle = '#3a1a10'; ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 6;
              ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.restore();
              glowOrb(ctx, e.x, e.y + 20, e.r * 0.8, '#fff3b0', '#ff5a1a', 0.7);
            },
          });
        },
      },
    },
    {
      name: 'Coffin of the Iron Mountain', icon: '蓋', color: '#ff5a1a', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'DOMAIN EXPANSION. Seals the opponent inside a volcano: the heat burns them constantly and lava erupts beneath their feet.',
      move: {
        id: 'coffin', kind: 'ult', startup: 60, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) { f.invuln = 70; domainCutscene(f, 'iron', 'COFFIN OF THE IRON MOUNTAIN'); FX.banner('DOMAIN EXPANSION', 'COFFIN OF THE IRON MOUNTAIN', '#ff8a2a', 130); FX.slow(40, 0.35); Sound.play('charge'); },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 40) return;
          Domains.start(f, {
            type: 'volcano', life: 300, bg: drawVolcanoBg,
            tick(d, t) {
              if (d.age % 3 === 0) FX.glow(U.rand(0, W), FLOOR - U.rand(0, 40), U.pick(['#ff9a2a', '#ff5a1a']), 14, 30, 0, -3);
              if (!t || t.state === 'ko') return;
              t.buffs.burn = Math.max(t.buffs.burn || 0, 20);
              if (d.age > 20 && d.age % 10 === 0)
                Combat.hit(f, t, { dmg: 9, kb: 0.5, stun: 8, hitstop: 0, type: 'domain', chip: 0.5, noScale: true, quiet: true, fx: 'fire', sfx: 'fire', x: t.x, y: t.midY, dir: dirTo(f, t) });
              if (d.age % 60 === 30) eruption(f, t.x, { y: World.groundAt(t.x, t.y), delay: 24, w: 90, h: 210, kind: 'fire', hits: { dmg: 70, kb: 4, kby: -15, launch: true, fx: 'fire', type: 'domain' } });
            },
          });
        },
      },
    },
  ],
};

const MAHITO = {
  id: 'mahito', name: 'Mahito', short: 'MAHITO', title: 'Disaster Curse of Humanity', kanji: '真人', color: '#8affd2', curse: true,
  style: 'Reshapes his own body: long-reach blades, spines, diving attacks, warped servants and a soul-warping touch.', bio: 'A curse born from humans\' hatred of one another. He can reshape souls with a touch.',
  passive: { name: 'Soul Reshaping', desc: 'Mahito constantly reshapes his own soul: he regenerates about 7 HP per second, melee attacks hurt him 15% less, and landing Soul Touch restores 90 more.' },
  passiveTick(f) {
    if (f.state !== 'ko' && World.active) f.hp = Math.min(f.maxHp, f.hp + 0.12);
    if (f.buffs.mutate && f.anim % 3 === 0) FX.glow(f.x + U.rand(-24, 24), f.y - U.rand(10, 150) * f.scale, U.pick(['#8affd2', '#3a6a5a']), 12, 16, 0, -1.2);
  },
  dmgMult(f) { return f.buffs.mutate ? 1.3 : 1; },
  onIncoming(f, dmg, h) { let k = h.melee ? 0.85 : 1; if (f.buffs.mutate) k *= 0.75; return { dmg: dmg * k, kb: f.buffs.mutate ? 0.5 : 1 }; },
  hp: 1250, speed: 1.12, melee: { power: 1.2, reach: 14 },
  look: curseLook('#c9d3dc', '#2a3240'), aiStyle: { pref: 110 },
  drawHead(g) {
    const { ctx, sk, col, OL } = g, [hx, hy] = sk.head;
    ctx.fillStyle = col('#7f93a8'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx + 12, hy - 10); ctx.quadraticCurveTo(hx - 4, hy - 26, hx - 18, hy - 6); ctx.lineTo(hx - 20, hy + 26); ctx.lineTo(hx - 10, hy + 16); ctx.lineTo(hx - 12, hy + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    headCircle(g, hx, hy, 15, '#c9d3dc');
    drawSpikyHair(g, hx, hy, 15, [[-50, 4, 14], [-20, 6, 14], [10, 6, 14], [40, 5, 14]], '#7f93a8');
    if (g.o.white || g.o.tint) return;
    ctx.strokeStyle = '#4a3a4a'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(hx - 2, hy - 8); ctx.lineTo(hx + 8, hy + 10);
    for (let i = 0; i < 4; i++) { const x = hx - 1 + i * 2.6, y = hy - 6 + i * 4.4; ctx.moveTo(x - 2, y + 1.5); ctx.lineTo(x + 2, y - 1.5); }
    ctx.stroke();
    eyeDots(g, [[hx + 6, hy + 1, 1.8, '#3a8aff'], [hx + 12, hy + 1, 1.6, '#c0c040']]);
  },
  abilities: [
    {
      name: 'Arm Blade', icon: '刃', color: '#c9d3dc', cost: 15, cd: 120, ai: { min: 60, max: 200 }, desc: 'Reshapes his arm into a long blade and slashes.',
      move: { id: 'armblade', kind: 'special', startup: 12, active: 4, recovery: 18, lunge: 6, poses: ['slashW', 'slash'], sfx: 'swish', swing: { color: '#c9f0e0', r: 160, w: 8 },
        hitbox: { x: 0, y: -140, w: 175, h: 90 }, hit: { dmg: 78, kb: 9, kby: -5, stun: 26, fx: 'slash', color: '#8affd2', blood: 6 } },
    },
    {
      name: 'Soul Touch', icon: '魂', color: '#8affd2', cost: 30, cd: 360, ai: { min: 0, max: 110 }, desc: 'Lunges with an open palm. On contact, warps the soul for heavy unblockable damage.',
      move: { id: 'touch', kind: 'special', startup: 14, active: 6, recovery: 24, lunge: 12, poses: ['castW', 'point'],
        hitbox: { x: 0, y: -130, w: 64, h: 70 }, hit: { dmg: 135, unblockable: true, kb: 10, kby: -8, launch: true, fx: 'soul', hitstop: 12, shake: 8, sfx: 'heavy' },
        onHit(f, t) { FX.text(t.x, t.y - 180, 'IDLE TRANSFIGURATION', '#8affd2', 22, 60); f.hp = Math.min(f.maxHp, f.hp + 90); FX.spark(f.x, f.midY, '#8affd2', 10, 5); } },
    },
    {
      name: 'Body Repel', icon: '棘', color: '#9aa5b0', cost: 20, cd: 300, ai: { min: 0, max: 120 }, desc: 'Spikes erupt from his whole body, launching anyone too close.',
      move: { id: 'repel', kind: 'special', startup: 9, active: 1, recovery: 20, poses: ['block', 'sign'],
        onFrame(f, fr) { if (fr === 9) for (const d of [-1, 1]) eruption(f, f.x + d * 50, { y: f.y, delay: 0, dur: 18, w: 90, h: 130, kind: 'spike', sfx: 'slash', shake: 5, hits: { dmg: 72, kb: 11, kby: -11, launch: true, fx: 'slash', blood: 6 } }); } },
    },
    {
      name: 'Self-Embodiment of Perfection', icon: '真', color: '#8affd2', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'DOMAIN EXPANSION. Traps the opponent among countless hands, then reshapes their soul.',
      move: {
        id: 'perfection', kind: 'ult', startup: 60, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) { f.invuln = 70; domainCutscene(f, 'hands', 'SELF-EMBODIMENT OF PERFECTION'); FX.banner('DOMAIN EXPANSION', 'SELF-EMBODIMENT OF PERFECTION', '#8affd2', 130); FX.slow(40, 0.35); Sound.play('charge'); },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 40) return;
          Domains.start(f, {
            type: 'hands', life: 200, bg: drawHandsBg,
            onStart(d, t) { if (t && t.state !== 'ko') t.applyStun(160, true, true); },
            tick(d, t) {
              if (d.age !== 150 || !t || t.state === 'ko') return;
              t.stun = 0; t.frozen = false; t.setState('idle');
              FX.flash('#8affd2', 0.6);
              Combat.hit(f, t, { dmg: 240, kb: 13, kby: -13, launch: true, unblockable: true, sureHit: true, noScale: true, hitstop: 14, shake: 14, fx: 'soul', type: 'domain', dir: dirTo(f, t) });
            },
          });
        },
      },
    },
    {
      name: 'Reshaped Servants', icon: '従', color: '#9fd8b8', cost: 30, cd: 420, ai: { min: 0, max: 900 },
      desc: 'Pinches off three warped servants that lurch toward the opponent and burst on contact. They can be destroyed before they arrive.',
      move: {
        id: 'servants', kind: 'special', startup: 14, active: 1, recovery: 18, poses: ['sign', 'cast'],
        onFrame(f, fr) {
          if (fr !== 14) return;
          Sound.play('roar'); FX.smoke(f.x, f.y - 30, '#3a5a4a', 10, 30, 18);
          for (let i = 0; i < 3; i++) spawnSummon(f, {
            x: f.x + f.facing * (30 + i * 26), y: FLOOR, life: 260, delay: i * 10, speed: 3.2 + i * 0.6, dir: f.facing,
            name: 'SERVANT', hp: 40, maxHp: 40, hurtbox: e => ({ x: e.x - 18, y: e.y - 46, w: 36, h: 46 }),
            tick(e, t) {
              if (e.age < e.delay || !t || t.state === 'ko') return;
              e.dir = t.x >= e.x ? 1 : -1;
              e.x = U.clamp(e.x + e.dir * e.speed, World.left + 10, World.right - 10);
              if (Math.abs(t.x - e.x) < 34 && t.y > FLOOR - 140) {
                FX.explosion(e.x, e.y - 24, 40, ['#e0fff0', '#8affd2', '#3a6a5a']); Sound.play('boom');
                Combat.hit(f, t, { dmg: 32, kb: 7, kby: -7, launch: true, fx: 'soul', x: e.x, y: t.midY, dir: e.dir });
                e.kill('burst');
              }
            },
            onEnd(e, why) { if (why !== 'burst') FX.smoke(e.x, e.y - 20, '#3a5a4a', 6, 14, 12); },
            render(ctx, e) {
              if (e.age < e.delay) return;
              const wob = Math.sin(e.age * 0.3) * 3;
              ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.dir, 1);
              ctx.fillStyle = '#b7c9bf'; ctx.strokeStyle = '#1a2a22'; ctx.lineWidth = 2.5;
              ctx.beginPath(); ctx.ellipse(0, -22 + wob * 0.3, 17 + wob, 22 - wob * 0.5, 0.2, 0, 6.283); ctx.fill(); ctx.stroke();
              ctx.beginPath(); ctx.ellipse(9, -40, 9, 8, 0, 0, 6.283); ctx.fill(); ctx.stroke();
              ctx.strokeStyle = '#1a2a22'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-10 - wob, 0); ctx.moveTo(8, -4); ctx.lineTo(10 + wob, 0); ctx.stroke();
              ctx.fillStyle = '#1a2a22'; ctx.fillRect(10, -42, 3, 2); ctx.fillRect(4, -37, 8, 2);
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Spine Volley', icon: '槍', color: '#c9d3dc', cost: 20, cd: 200, ai: { min: 120, max: 700 },
      desc: 'Bristles his back and launches a fan of bone-hard spines at the opponent.',
      move: {
        id: 'spines', kind: 'special', startup: 12, active: 1, recovery: 16, poses: ['block', 'cast'],
        onFrame(f, fr) {
          if (fr !== 12) return;
          Sound.play('slash');
          for (let i = 0; i < 5; i++) {
            const a = (i - 2) * 0.12;
            spawnProj(f, {
              x: f.x + f.facing * 26, y: f.y - 105, vx: f.facing * Math.cos(a) * 17, vy: Math.sin(a) * 17, r: 10, life: 60, clash: 1,
              hits: { dmg: 26, kb: 3, stun: 14, fx: 'slash', color: '#c9d3dc', hitstop: 2, blood: 3 },
              render(ctx, e) {
                ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.atan2(e.vy, e.vx));
                ctx.fillStyle = '#e4ece6'; ctx.strokeStyle = '#2a3a32'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-12, -4); ctx.lineTo(-12, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.restore();
              },
            });
          }
        },
      },
    },
    {
      name: 'Gliding Dive', icon: '翼', color: '#8affd2', cost: 25, cd: 260, ai: { min: 150, max: 650 },
      desc: 'Reshapes his arms into wide membranes, vaults into the air, then dives onto the opponent with a crushing impact.',
      move: {
        id: 'dive', kind: 'special', startup: 8, active: 0, recovery: 0, total: 70, keepVel: true,
        getPose: (f, fr) => (fr < 30 ? POSES.charge : fr < 60 ? POSES.kick : POSES.idle),
        onFrame(f, fr, t) {
          if (fr === 8) { f.vy = -17; f.vx = f.facing * 4; f.onGround = false; Sound.play('whoosh'); }
          if (fr > 8 && fr < 30) {
            f.vy = Math.min(f.vy, 2);
            if (t) { f.vx = U.lerp(f.vx, (t.x - f.x) / 12, 0.2); f.facing = t.x >= f.x ? 1 : -1; }
            if (fr % 3 === 0) FX.ghost(f, '#8affd2');
          }
          if (fr === 30) { f.vy = 22; f.vx *= 0.5; Sound.play('dash'); }
          if (fr >= 30 && fr < 60 && (f.onGround || fr === 59) && !f.mvars.landed) {
            f.mvars.landed = true;
            FX.shake(14); FX.dust(f.x, f.y, 16); FX.debris(f.x, f.y, '#5a6a62', 12, 11); Sound.play('boom');
            for (const v of World.enemies(f)) if (v.state !== 'ko' && Math.abs(v.x - f.x) < 110 && Math.abs(v.y - f.y) < 140)
              Combat.hit(f, v, { dmg: 85, kb: 10, kby: -12, launch: true, hitstop: 10, fx: 'soul', x: v.x, y: v.midY, dir: v.x >= f.x ? 1 : -1 });
          }
          if (f.mvars.landed && fr > 60) f.endMove();
        },
      },
    },
    {
      name: 'Soul Mutation', icon: '変', color: '#5fe0b0', cost: 35, cd: 900, ai: { min: 0, max: 600, when: f => !f.buffs.mutate },
      desc: 'Rewrites his own soul into a battle form for 8 seconds: +30% damage, 25% less damage taken, and half knockback.',
      move: {
        id: 'mutate', kind: 'special', startup: 18, active: 1, recovery: 10, poses: ['block', 'win'],
        onFrame(f, fr) {
          if (fr !== 18) return;
          f.buffs.mutate = 480;
          Sound.play('roar'); FX.shake(10); FX.ring(f.x, f.y - 80, '#8affd2', 110, 22, 6); FX.spark(f.x, f.y - 80, '#5fe0b0', 18, 7);
          FX.text(f.x, f.y - 195, 'SOUL MUTATION', '#8affd2', 24, 60);
        },
      },
    },
  ],
};

/* ---------------------------------------------------------------- CHOSO */

const CHOSO = {
  id: 'choso', name: 'Choso', short: 'CHOSO', title: 'Death Painting Womb', kanji: '脹相', color: '#c4122f',
  style: 'Ranged Blood Manipulation: beams, homing orbs and spinning blood blades.',
  bio: 'The eldest of the Death Painting Wombs, half human and half cursed spirit. His body makes blood as fast as he can spend it.',
  passive: { name: 'Cursed Womb Body', desc: 'Blood techniques cost Choso no health, and his blood steadily regenerates his body (+3 HP per second).' },
  hp: 1050, speed: 1.0, bloodFree: true, melee: { power: 1.05 },
  look: { skin: '#e9cdb8', top: '#3a2636', pants: '#d8d0c0', accent: BLOOD, eye: '#2a1a1a' },
  aiStyle: { pref: 270, ranged: true },
  passiveTick(f) { if (f.state !== 'ko' && World.active) f.hp = Math.min(f.maxHp, f.hp + 0.05); },
  drawHair(g, hx, hy, r) {
    const { ctx, col, o, OL } = g;
    drawSpikyHair(g, hx, hy, r, [[-60, 5, 14], [-30, 7, 13], [0, 8, 13], [30, 7, 13], [60, 6, 13], [95, 5, 13]], '#151218');
    // the two short spiky tails sticking up from the back and top
    ctx.fillStyle = col('#151218'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    for (const [a, l] of [[20, 14], [70, 13]]) {
      const b = HP(hx, hy, a, r), t1 = HP(hx, hy, a - 8, r + l), t2 = HP(hx, hy, a + 8, r + l * 0.8);
      ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (o.white || o.tint) return;
    // the blood mark across the bridge of the nose
    ctx.strokeStyle = '#3a0a10'; ctx.lineWidth = 3.5;
    lineTo2(ctx, [hx + 2, hy + 4], [hx + r + 1, hy + 4]);
  },
  drawTorso(g) {
    const { ctx, sk, col } = g;
    ctx.strokeStyle = col('#d8d0c0'); ctx.lineWidth = 4;
    lineTo2(ctx, sk.sh, [sk.sh[0] + 6, sk.sh[1] + 18]);
  },
  abilities: [
    {
      name: 'Piercing Blood', icon: '穿', color: BLOOD, cost: 20, cd: 220, ai: { min: 150, max: 1280 },
      desc: 'Fires compressed blood as a lightning-fast beam that crosses the whole arena.',
      move: piercingBloodMove({ startup: 18, hit: { dmg: 95 } }),
    },
    {
      name: 'Supernova', icon: '星', color: '#ff6a7a', cost: 25, cd: 300, ai: { min: 100, max: 800 },
      desc: 'Five orbs of blood orbit Choso, then hurtle at the opponent and burst.',
      move: supernovaMove({ dmg: 34 }),
    },
    {
      name: 'Slicing Exorcism', icon: '斬', color: '#ff3a4a', cost: 20, cd: 240, ai: { min: 60, max: 420 },
      desc: 'Hurls two spinning discs of blood that carve through the opponent and boomerang back.',
      move: {
        id: 'slicing', kind: 'special', startup: 12, active: 1, recovery: 16, poses: ['castW', 'slash2'],
        onFrame(f, fr) {
          if (fr !== 12) return;
          Sound.play('swish');
          for (const [dy, delay] of [[-115, 0], [-70, 8]]) {
            spawnProj(f, {
              x: f.x + f.facing * 40, y: f.y + dy, vx: f.facing * 13, r: 22, life: 80, pierce: true, hitEvery: 10, wallKill: false, delay,
              hits: { dmg: 22, kb: 3, stun: 16, fx: 'slash', color: '#ff3a4a', hitstop: 2, noScale: true, blood: 4 },
              tick(e) {
                if (e.age < e.delay) { e.vx = 0; return; }
                if (e.age === e.delay) e.vx = f.facing * 13;
                // after flying out, curve back to Choso and vanish when caught
                if (e.age > e.delay + 26) e.vx = U.clamp(e.vx + (f.x > e.x ? 0.95 : -0.95), -14, 14);
                if (e.age > e.delay + 40 && Math.abs(e.x - f.x) < 30) e.kill('return');
              },
              render(ctx, e) {
                ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.age * 0.6);
                ctx.fillStyle = BLOOD; ctx.strokeStyle = '#ffd0d0'; ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); ctx.lineTo(Math.cos(a + 0.4) * 12, Math.sin(a + 0.4) * 12); }
                ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.restore();
              },
            });
          }
        },
      },
    },
    {
      name: 'Convergence: Maximum', icon: '血', color: '#ff1f3d', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'ULTIMATE. Converges every drop of blood into one colossal Piercing Blood that fills the arena\'s width.',
      move: piercingBloodMove({
        id: 'convergence', kind: 'ult', startup: 50, recovery: 24, big: true, width: 70, say: 'Convergence...',
        onStart(f) { f.invuln = 60; FX.banner('BLOOD MANIPULATION', 'CONVERGENCE: MAXIMUM', '#ff4d6a', 120); FX.slow(35, 0.4); Sound.play('charge'); },
        hit: { dmg: 260, kb: 18, kby: -12, launch: true, hitstop: 16, shake: 18, fx: 'red', sfx: 'boom', chip: 0.35, guardDmg: 90, blood: 30 },
      }),
    },
    {
      name: 'Flowing Red Scale', icon: '赤', color: '#ff3a4a', cost: 20, cd: 720, ai: { min: 0, max: 600, when: f => !f.buffs.redscale },
      desc: 'Speeds up his blood flow: +15% speed and +15% damage for 10 seconds.',
      move: redScaleMove({ frames: 600 }),
    },
  ],
};

/* ---------------------------------------------------------------- JIN AKAGAMI (original) */

// A rush-in combo used by Jin's ultimate: dash, lock the target, flurry, finisher.
function rushComboMove(o) {
  return {
    id: o.id, kind: 'ult', total: 400, startup: 400, active: 0, recovery: 0,
    onStart(f) { FX.banner(o.title, o.sub, o.color, 100); FX.slow(25, 0.4); f.mvars.phase = 'rush'; },
    getPose(f, fr) {
      const v = f.mvars;
      if (v.phase === 'rush') return fr < 10 ? POSES.slashW : POSES.dash;
      if (v.phase === 'flurry') return POSES[['slash', 'slash2', 'kick', 'slash'][Math.floor((fr - v.t0) / 6) % 4]];
      return (fr - v.t0) < 70 ? POSES.slashW : POSES.slash;
    },
    onFrame(f, fr, t) {
      const v = f.mvars;
      f.invuln = Math.max(f.invuln, 3);
      if (v.phase === 'rush') {
        if (fr >= 10) {
          f.vx = f.facing * 17;
          if (fr % 2 === 0) FX.ghost(f, o.color);
          if (t && t.state !== 'ko' && Math.abs(t.x - f.x) < 95 && Math.abs(t.y - f.y) < 130) { v.phase = 'flurry'; v.t0 = fr; t.applyStun(110, true, true); f.vx = 0; }
        }
        if (fr > 40 && v.phase === 'rush') { f.invuln = 0; f.endMove(); }
        return;
      }
      const k = fr - v.t0;
      f.vx = 0;
      if (!t || t.state === 'ko') { f.endMove(); return; }
      if (v.phase === 'flurry') {
        t.x = f.x + f.facing * 55; t.clampWalls();
        if (k % 6 === 2 && k < 60) {
          FX.slash(t.x + U.rand(-20, 20), t.midY + U.rand(-30, 30), U.rand(-1, 1), 90, o.color, 4, 10);
          Combat.hit(f, t, { dmg: o.hitDmg, kb: 0, stun: 10, unblockable: true, sureHit: true, noScale: true, hitstop: 2, shake: 3, sfx: 'slash', fx: 'slash', color: o.color, blood: 3, x: t.x, y: t.midY, dir: f.facing });
        }
        if (k >= 64) v.phase = 'final';
        return;
      }
      if (k === 74) {
        t.stun = 0; t.frozen = false; t.setState('idle');
        Combat.hit(f, t, { dmg: o.finalDmg, kb: 17, kby: -13, launch: true, unblockable: true, sureHit: true, noScale: true, hitstop: 16, shake: 16, fx: 'cleave', sfx: 'slash', blood: 16, dir: f.facing });
      }
      if (k >= 92) { f.invuln = 10; f.endMove(); }
    },
  };
}

const JIN = {
  id: 'jin', name: 'Jin Akagami', short: 'JIN', title: 'The Unbound', kanji: '赤髪迅', color: '#9be05a',
  style: 'A sorcerer with no cursed energy at all — pure strength, a massive greatsword, and zero hesitation.',
  bio: 'Born without a drop of cursed energy, Jin trained his body until curses could no longer keep up. He swings a greatsword nearly as tall as he is as if it weighed nothing.',
  passive: { name: 'Zero Cursed Energy', desc: 'Jin has no cursed energy: his techniques cost nothing and run on cooldowns only. He moves 20% faster, his melee hits 20% harder, and domain sure-hits deal him half damage.' },
  hp: 1050, speed: 1.12, noCE: true, initCd: { 4: 900 },
  melee: { weapon: 'sword', weaponName: 'Greatsword', reach: 42, power: 1.05 },
  look: { skin: '#e8c8b0', top: '#3e4a3a', pants: '#22262c', accent: '#9be05a', eye: '#2a2a2a' },
  aiStyle: { pref: 120 },
  dmgMult(f, h) { return h.melee ? 1.2 : 1; },
  onIncoming(f, dmg, h) { return { dmg: h.type === 'domain' ? dmg * 0.5 : dmg }; },
  drawHair(g, hx, hy, r) {
    const { ctx, col, OL } = g;
    drawSpikyHair(g, hx, hy, r, [[-50, 4, 14], [-20, 6, 13], [10, 7, 13], [40, 6, 13], [70, 5, 13], [100, 4, 13]], '#b8bcc4');
    // red headband with trailing ties
    ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, r + 0.5, 0, 6.283); ctx.clip();
    ctx.fillStyle = col('#c4122f'); ctx.fillRect(hx - r - 2, hy - 9, r * 2 + 4, 5);
    ctx.restore();
    ctx.strokeStyle = col('#c4122f'); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx - r + 1, hy - 7); ctx.lineTo(hx - r - 12, hy - 2); ctx.moveTo(hx - r + 1, hy - 6); ctx.lineTo(hx - r - 9, hy + 5); ctx.stroke();
  },
  // An oversized greatsword: broad blade with a fuller, crossguard, red-wrapped hilt.
  drawWeapon(g) {
    const { ctx, sk, col, OL } = g, e = sk.aF[1], h = sk.aF[2];
    let dx = h[0] - e[0], dy = h[1] - e[1];
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const px = -dy, py = dx, at = (k, w) => [h[0] + dx * k + px * w, h[1] + dy * k + py * w];
    ctx.lineJoin = 'round';
    // blade
    ctx.beginPath();
    const b = [at(9, 7), at(98, 6), at(112, 0), at(98, -6), at(9, -7)];
    ctx.moveTo(b[0][0], b[0][1]); for (const q of b.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath();
    ctx.fillStyle = col('#d7dde6'); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OL; ctx.stroke();
    ctx.strokeStyle = col('#8f99a8'); ctx.lineWidth = 2; lineTo2(ctx, at(14, 0), at(92, 0));
    // crossguard
    ctx.strokeStyle = OL; ctx.lineWidth = 7; lineTo2(ctx, at(8, 13), at(8, -13));
    ctx.strokeStyle = col('#4a4f58'); ctx.lineWidth = 4; lineTo2(ctx, at(8, 12), at(8, -12));
    // red-wrapped hilt and pommel
    ctx.strokeStyle = OL; ctx.lineWidth = 7; lineTo2(ctx, at(-16, 0), at(6, 0));
    ctx.strokeStyle = col('#c4122f'); ctx.lineWidth = 4; lineTo2(ctx, at(-16, 0), at(6, 0));
    const pm = at(-19, 0);
    ctx.beginPath(); ctx.arc(pm[0], pm[1], 3.5, 0, 6.283); ctx.fillStyle = col('#4a4f58'); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();
  },
  abilities: [
    {
      name: 'Sword Hurl', icon: '投', color: '#d7dde6', cost: 0, cd: 210, ai: { min: 120, max: 520 },
      desc: 'Hurls the greatsword end over end. It carves through everything in its path, then flies back to his hand.',
      move: {
        id: 'swordhurl', kind: 'special', startup: 12, active: 1, recovery: 22, poses: ['slashW', 'cast'],
        onFrame(f, fr) {
          if (fr !== 12) return;
          Sound.play('swish');
          spawnProj(f, {
            x: f.x + f.facing * 40, y: f.y - 105, vx: f.facing * 17, r: 46, life: 120, pierce: true, hitEvery: 9, wallKill: false, dir: f.facing,
            hits: { dmg: 30, kb: 5, stun: 18, fx: 'slash', color: '#d7dde6', hitstop: 3, noScale: true, blood: 4 },
            tick(e) {
              if (e.age > 22) e.vx = U.clamp(e.vx + (f.x > e.x ? 1.1 : -1.1), -18, 18);
              e.y = U.lerp(e.y, f.y - 105, 0.08);
              if (e.age % 3 === 0) Sound.play('whoosh');
              if (e.age > 30 && Math.abs(e.x - f.x) < 40) e.kill('caught');
            },
            render(ctx, e) {
              ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.age * 0.55 * e.dir);
              ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(215,221,230,0.25)'; ctx.lineWidth = 10;
              ctx.beginPath(); ctx.arc(0, 0, 44, 0, 6.283); ctx.stroke();
              ctx.globalCompositeOperation = 'source-over';
              ctx.fillStyle = '#d7dde6'; ctx.strokeStyle = '#07070c'; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(48, -6); ctx.lineTo(58, 0); ctx.lineTo(48, 6); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
              ctx.strokeStyle = '#c4122f'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-8, 0); ctx.stroke();
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Blade Rush', icon: '刃', color: '#9be05a', cost: 0, cd: 180, ai: { min: 60, max: 260 },
      desc: 'Blurs forward through the opponent, dragging the greatsword through them several times on the way past. Invulnerable while dashing.',
      move: {
        id: 'bladerush', kind: 'special', startup: 6, active: 12, recovery: 16, keepVel: true, poses: ['dash', 'slash'], sfx: 'swish',
        hitbox: { x: -20, y: -130, w: 90, h: 110 }, hitEvery: 4, hit: { dmg: 22, kb: 2, stun: 18, fx: 'slash', color: '#9be05a', noScale: true, blood: 3 },
        onFrame(f, fr) {
          if (fr >= 6 && fr < 18) { f.vx = f.facing * 19; f.invuln = Math.max(f.invuln, 2); if (fr % 2 === 0) FX.ghost(f, '#9be05a'); }
          if (fr === 18) f.vx *= 0.2;
        },
      },
    },
    {
      name: 'Smoke Vanish', icon: '煙', color: '#9aa0b0', cost: 0, cd: 300, ai: { min: 0, max: 600 },
      desc: 'Pops a smoke bomb, vanishes, and reappears behind the nearest enemy with a launching slash.',
      move: {
        id: 'smoke', kind: 'special', startup: 18, active: 4, recovery: 18, poses: ['block', 'slash'],
        hitbox: { x: 0, y: -140, w: 90, h: 110 }, hit: { dmg: 70, kb: 10, kby: -11, launch: true, hitstop: 8, fx: 'slash', color: '#9be05a', blood: 8 },
        onFrame(f, fr, t) {
          if (fr === 2) { Sound.play('whoosh'); FX.smoke(f.x, f.y - 70, '#8a8a90', 16, 34, 26); }
          if (fr < 16) f.invuln = Math.max(f.invuln, 2);
          if (fr === 14 && t) {
            f.x = t.x - t.facing * 60; f.clampWalls(); f.facing = t.x >= f.x ? 1 : -1;
            FX.smoke(f.x, f.y - 70, '#8a8a90', 10, 24, 20);
          }
        },
        getPose: (f, fr) => (fr < 14 ? POSES.block : fr < 18 ? POSES.slashW : POSES.slash),
      },
    },
    {
      name: 'Ground Splitter', icon: '裂', color: '#c9b08a', cost: 0, cd: 240, ai: { min: 0, max: 600 },
      desc: 'Slams the greatsword into the floor overhead. Anyone close gets crushed, and a fissure tears along the ground toward the opponent.',
      move: {
        id: 'splitter', kind: 'special', startup: 16, active: 4, recovery: 22, lunge: 5, poses: ['slashW', 'slash'], sfx: 'whoosh',
        swing: { color: '#d7dde6', r: 120, w: 11, a0: -110, a1: 60 },
        hitbox: { x: 0, y: -150, w: 140, h: 150 }, hit: { dmg: 70, kb: 8, kby: -12, launch: true, hitstop: 10, shake: 10, sfx: 'heavy', fx: 'slash', color: '#d7dde6', blood: 6 },
        onFrame(f, fr) {
          if (fr !== 16) return;
          FX.shake(12); FX.debris(f.x + f.facing * 110, f.y, '#6a5a4a', 14, 11); FX.dust(f.x + f.facing * 110, f.y, 12); Sound.play('boom');
          spawnProj(f, {
            x: f.x + f.facing * 130, y: FLOOR - 22, vx: f.facing * 12, r: 26, life: 55, dir: f.facing,
            hits: { dmg: 55, kb: 6, kby: -12, launch: true, hitstop: 6, color: '#c9b08a' },
            tick(e) { if (e.age % 2 === 0) FX.debris(e.x, FLOOR, '#6a5a4a', 2, 7); },
            render(ctx, e) {
              ctx.save(); ctx.fillStyle = '#2a2018'; ctx.strokeStyle = '#c9b08a'; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(e.x - e.dir * 60, FLOOR); ctx.lineTo(e.x - 6, FLOOR - 34); ctx.lineTo(e.x + 4, FLOOR - 14); ctx.lineTo(e.x + e.dir * 14, FLOOR - 40); ctx.lineTo(e.x + e.dir * 22, FLOOR); ctx.closePath(); ctx.fill(); ctx.stroke();
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Unbound Massacre', icon: '殺', color: '#9be05a', cost: 0, cd: 1500, ult: true, ai: { min: 0, max: 380 },
      desc: 'ULTIMATE (no cursed energy needed, long cooldown — ready 15s into each round). Closes the gap in a blink and buries the opponent under a storm of greatsword cuts.',
      move: rushComboMove({ id: 'massacre', title: 'ULTIMATE', sub: 'UNBOUND MASSACRE', color: '#d7dde6', hitDmg: 24, finalDmg: 165 }),
    },
  ],
};

/* ---------------------------------------------------------------- AYANE KUJO (original) */

// The colossal judge presiding over Ayane's domain (an original design: robed, tall-capped, faceless but for its eyes).
function drawGiantJudge(ctx, d) {
  const cx = W / 2, sway = Math.sin(d.age * 0.03) * 4;
  ctx.save();
  // robe
  const rg = ctx.createLinearGradient(0, 160, 0, FLOOR);
  rg.addColorStop(0, '#1c1814'); rg.addColorStop(1, '#0a0806');
  ctx.fillStyle = rg; ctx.strokeStyle = 'rgba(201,162,58,0.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 120, 230); ctx.lineTo(cx + 120, 230); ctx.lineTo(cx + 300, FLOOR); ctx.lineTo(cx - 300, FLOOR); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(201,162,58,0.35)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(cx, 240); ctx.lineTo(cx, FLOOR); ctx.stroke();
  // shoulders and folded sleeves
  ctx.fillStyle = '#16120e';
  ctx.beginPath(); ctx.ellipse(cx - 150, 260, 70, 40, -0.3, 0, 6.283); ctx.ellipse(cx + 150, 260, 70, 40, 0.3, 0, 6.283); ctx.fill();
  // head: a pale featureless mask under a tall square cap
  ctx.fillStyle = '#d8cbb0'; ctx.strokeStyle = '#0a0806'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx + sway, 170, 52, 62, 0, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#0e0c08'; ctx.fillRect(cx - 58 + sway, 50, 116, 80); ctx.strokeStyle = '#c9a23a'; ctx.strokeRect(cx - 58 + sway, 50, 116, 80);
  ctx.fillRect(cx - 74 + sway, 122, 148, 14);
  // glowing eyes
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath(); ctx.ellipse(cx - 20 + sway, 172, 9, 4, 0, 0, 6.283); ctx.ellipse(cx + 20 + sway, 172, 9, 4, 0, 0, 6.283); ctx.fill();
  ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(cx - 20 + sway, 172, 20, 0, 6.283); ctx.arc(cx + 20 + sway, 172, 20, 0, 6.283); ctx.fill();
  ctx.restore();
}

// The judge's fist descends on a convicted opponent; it lands 20 frames after being called.
function judgeFist(t) {
  const sx = t.x > W / 2 ? W / 2 + 170 : W / 2 - 170;
  return World.spawn(new Entity({
    x: sx, y: 220, tx: t.x, ty: t.y - 40, sx, life: 40, layer: 'front', owner: World.domain && World.domain.owner,
    tick(e) {
      const k = Math.min(1, e.age / 20) ** 2;
      e.x = U.lerp(e.sx, e.tx, Math.min(1, e.age / 14)); e.y = U.lerp(-120, e.ty, k);
      if (e.age === 20) { FX.shake(22); FX.dust(e.tx, FLOOR, 24); FX.debris(e.tx, FLOOR, '#6a5a4a', 20, 14); Sound.play('boom'); }
    },
    render(ctx, e) {
      const fade = Math.min(1, (e.life - e.age) / 10);
      ctx.save(); ctx.globalAlpha = fade;
      // sleeve reaching down from the judge's shoulder
      ctx.strokeStyle = '#0a0806'; ctx.lineWidth = 70; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(e.sx, 160); ctx.lineTo(e.x, e.y - 70); ctx.stroke();
      ctx.strokeStyle = '#1c1814'; ctx.lineWidth = 60; ctx.stroke();
      // fist
      ctx.fillStyle = '#d8cbb0'; ctx.strokeStyle = '#0a0806'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(e.x, e.y - 30, 58, 50, 0, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 3;
      for (let i = -1; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(e.x - 40 + (i + 1) * 22, e.y + 6); ctx.lineTo(e.x - 40 + (i + 1) * 22, e.y - 18); ctx.stroke(); }
      ctx.restore();
    },
  }));
}

function drawScalesBg(ctx, d, a) {
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0e0c08'); g.addColorStop(1, '#3a3020');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  // columns of a vast, dim hall
  ctx.fillStyle = 'rgba(200,180,120,0.12)';
  for (let i = 0; i < 8; i++) ctx.fillRect(40 + i * 170, 60, 40, FLOOR - 60);
  drawGiantJudge(ctx, d);
  // a giant balance scale hanging over the arena, tilting with the evidence
  const tilt = Math.sin(d.age * 0.03) * 0.08 + Math.min(0.3, (d.owner.evidence || 0) * 0.03);
  ctx.strokeStyle = '#c9a23a'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(W / 2, 40); ctx.lineTo(W / 2, 220); ctx.stroke();
  ctx.save(); ctx.translate(W / 2, 80); ctx.rotate(tilt);
  ctx.beginPath(); ctx.moveTo(-260, 0); ctx.lineTo(260, 0); ctx.stroke();
  ctx.lineWidth = 2;
  for (const sx of [-260, 260]) {
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx - 50, 110); ctx.moveTo(sx, 0); ctx.lineTo(sx + 50, 110); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(sx, 112, 56, 12, 0, 0, Math.PI); ctx.fillStyle = 'rgba(201,162,58,0.5)'; ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#1a160e'; ctx.fillRect(-30, FLOOR, W + 60, H - FLOOR + 30);
  ctx.strokeStyle = 'rgba(201,162,58,0.4)'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, FLOOR); ctx.lineTo(x - 30, H); ctx.stroke(); }
  ctx.restore();
}

const AYANE = {
  id: 'ayane', name: 'Ayane Kujo', short: 'AYANE', title: 'The Arbiter', kanji: '九条綾音', color: '#c9a23a',
  style: 'A methodical counter-fighter: punishes attacks, binds opponents, and turns every blow she takes into evidence.',
  bio: 'A former magistrate who awakened her technique mid-trial. She weighs every exchange, and her domain hands down a sentence proportional to the crimes committed against her.',
  passive: { name: 'Due Process', desc: 'Every hit Ayane takes is logged as Evidence (up to 10, shown above her head). Her domain\'s Verdict deals 25 extra damage per piece of evidence.' },
  hp: 1050, speed: 0.95, melee: { power: 1.15, reach: 14 },
  look: { skin: '#f0d6c4', top: '#e8e6e0', pants: '#2a2a32', accent: '#c9a23a', eye: '#1a1a2a' },
  aiStyle: { pref: 100 },
  onIncoming(f, dmg) { if (dmg > 0) f.evidence = Math.min(10, (f.evidence || 0) + 1); return { dmg }; },
  drawAura(ctx, f) {
    if (!f.evidence || f.state === 'ko') return;
    const h = headPos(f);
    ctx.save(); ctx.font = '900 14px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#c9a23a';
    ctx.fillText(`⚖ ${f.evidence}`, h.x, h.y - 78 * f.scale); ctx.restore();
  },
  drawHair(g, hx, hy, r) {
    const { ctx, col, OL } = g;
    // long low ponytail falling behind the shoulders
    ctx.fillStyle = col('#1c2340'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx - r + 2, hy + 2); ctx.quadraticCurveTo(hx - r - 14, hy + 26, hx - r - 4, hy + 44); ctx.lineTo(hx - r + 4, hy + 40); ctx.quadraticCurveTo(hx - r - 2, hy + 22, hx - r + 8, hy + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    drawSpikyHair(g, hx, hy, r, [[-70, 3, 18], [-35, 4, 18], [0, 4, 18], [35, 4, 18], [70, 3, 18], [105, 3, 18]], '#1c2340');
  },
  drawTorso(g) {
    const { ctx, sk, col } = g;
    ctx.strokeStyle = col('#c9a23a'); ctx.lineWidth = 3;
    lineTo2(ctx, sk.sh, [sk.sh[0] * 0.5, sk.sh[1] * 0.5]);
  },
  drawWeapon(g) {
    const { ctx, sk, col, OL } = g, e = sk.aF[1], h = sk.aF[2];
    let dx = h[0] - e[0], dy = h[1] - e[1];
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    // Grand Gavel swells the gavel to giant size
    const fi = g.o.fighter, k = fi && fi.move && fi.move.id === 'grandgavel' ? fi.mvars.g || 0 : 0, big = 1 + 3.2 * k;
    const end = [h[0] + dx * 30 * (1 + 2 * k), h[1] + dy * 30 * (1 + 2 * k)];
    ctx.strokeStyle = OL; ctx.lineWidth = 6 + 4 * k; lineTo2(ctx, h, end);
    ctx.strokeStyle = col('#6a4a2a'); ctx.lineWidth = 4 + 4 * k; lineTo2(ctx, h, end);
    // gavel head across the end of the handle
    ctx.save(); ctx.translate(end[0], end[1]); ctx.rotate(Math.atan2(dy, dx)); ctx.scale(big, big);
    ctx.fillStyle = col('#c9a23a'); ctx.strokeStyle = OL; ctx.lineWidth = 2 / big;
    ctx.fillRect(-6, -14, 12, 28); ctx.strokeRect(-6, -14, 12, 28);
    if (k > 0 && !g.o.white) { ctx.fillStyle = 'rgba(255,240,180,0.6)'; ctx.fillRect(-6, -14, 3, 28); }
    ctx.restore();
  },
  abilities: [
    {
      name: 'Gavel Strike', icon: '槌', color: '#c9a23a', cost: 15, cd: 150, ai: { min: 0, max: 130 },
      desc: 'Brings the gavel down overhead with a crack that sends a shockwave along the floor.',
      move: {
        id: 'gavel', kind: 'special', startup: 14, active: 4, recovery: 20, lunge: 6, poses: ['slashW', 'slash'], sfx: 'whoosh',
        hitbox: { x: 0, y: -150, w: 110, h: 150 }, hit: { dmg: 85, kb: 9, kby: -11, launch: true, hitstop: 10, shake: 10, sfx: 'heavy', color: '#c9a23a' },
        onFrame(f, fr) { if (fr === 14) { FX.dust(f.x + f.facing * 80, f.y, 12); FX.ring(f.x + f.facing * 80, f.y - 6, '#c9a23a', 80, 16, 3); FX.shake(6); } },
      },
    },
    {
      name: 'Objection!', icon: '異', color: '#ffd34d', cost: 20, cd: 300, ai: { min: 0, max: 200 },
      desc: 'A counter stance. If struck during it, Ayane ignores the hit and punishes: the attacker is stunned and smashed. Domains and unblockable attacks go through.',
      move: {
        id: 'objection', kind: 'special', startup: 30, active: 0, recovery: 14, counter: 28, poses: ['block', 'block'],
        onStart(f) { FX.text(f.x, f.y - 190, 'Objection...', '#ffd34d', 16, 30); },
        onCounter(f, att) {
          FX.text(f.x, f.y - 200, 'OBJECTION!', '#ffd34d', 34, 60); Sound.play('bf'); FX.flash('#ffd34d', 0.3); FX.shake(10);
          f.invuln = Math.max(f.invuln, 20); f.endMove();
          f.facing = att.x >= f.x ? 1 : -1;
          Combat.hit(f, att, { dmg: 60, stunAdd: 55, unblockable: true, sureHit: true, kb: 4, hitstop: 10, color: '#ffd34d', x: att.x, y: att.midY, dir: f.facing });
        },
      },
    },
    {
      name: 'Chains of Law', icon: '律', color: '#ffd34d', cost: 25, cd: 300, ai: { min: 100, max: 650 },
      desc: 'Fires a golden chain that binds whoever it hits in place.',
      move: {
        id: 'lawchain', kind: 'special', startup: 12, active: 1, recovery: 18, poses: ['castW', 'point'],
        onFrame(f, fr) {
          if (fr !== 12) return;
          Sound.play('grab');
          const x0 = f.x + f.facing * 30;
          spawnProj(f, {
            x: x0, y: f.y - 110, vx: f.facing * 15, r: 16, life: 45, x0, clash: 1,
            hits: { dmg: 25, stunAdd: 55, kb: 0, color: '#ffd34d', sfx: 'grab', hitstop: 4 },
            render(ctx, e) {
              ctx.save(); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.setLineDash([7, 4]);
              ctx.beginPath(); ctx.moveTo(e.x0, e.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.setLineDash([]);
              ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(e.x, e.y, 8, 0, 6.283); ctx.fill();
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Hall of the Scales', icon: '秤', color: '#c9a23a', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'DOMAIN EXPANSION. Seals the opponent in a vast courtroom watched over by a colossal judge. When the verdict is GUILTY, the judge\'s fist comes down: 60 damage plus 25 per piece of Evidence, and Ayane recovers 40% of it as restitution.',
      move: {
        id: 'scales', kind: 'ult', startup: 60, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) { f.invuln = 70; domainCutscene(f, 'scales', 'HALL OF THE SCALES'); FX.banner('DOMAIN EXPANSION', 'HALL OF THE SCALES', '#c9a23a', 130); FX.slow(40, 0.35); Sound.play('charge'); },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 40) return;
          Domains.start(f, {
            type: 'scales', life: 200, bg: drawScalesBg,
            onStart(d, t) { t.applyStun(150, true, true); FX.text(t.x, t.y - 185, 'ON TRIAL', '#ffd34d', 24, 70); },
            tick(d, t) {
              if (d.age === 110 && t && t.state !== 'ko') judgeFist(t);
              if (d.age !== 130 || !t || t.state === 'ko') return;
              const dmg = 60 + 25 * (f.evidence || 0);
              t.stun = 0; t.frozen = false; t.setState('idle');
              FX.text(t.x, t.y - 200, 'GUILTY', '#ff4d5a', 40, 80); FX.flash('#ffd34d', 0.5); FX.shake(16);
              Combat.hit(f, t, { dmg, kb: 13, kby: -12, launch: true, unblockable: true, sureHit: true, noScale: true, hitstop: 14, shake: 14, color: '#ffd34d', sfx: 'boom', type: 'domain', x: t.x, y: t.midY, dir: dirTo(f, t) });
              f.hp = Math.min(f.maxHp, f.hp + Math.round(dmg * 0.4));
              FX.text(f.x, f.y - 180, `+${Math.round(dmg * 0.4)}`, '#9be05a', 22, 50);
              f.evidence = 0;
            },
          });
        },
      },
    },
    {
      name: 'Grand Gavel', icon: '審', color: '#ffd34d', cost: 35, cd: 420, ai: { min: 0, max: 240 },
      desc: 'The gavel swells to colossal size and comes crashing down in front of her, crushing anyone beneath it and shaking the whole floor.',
      move: {
        id: 'grandgavel', kind: 'special', startup: 26, active: 4, recovery: 26, poses: ['slashW', 'slash'],
        hitbox: { x: 30, y: -270, w: 210, h: 270 }, hit: { dmg: 130, kb: 8, kby: -14, launch: true, hitstop: 14, shake: 18, sfx: 'boom', color: '#ffd34d', guardDmg: 70 },
        onStart(f) { Sound.play('charge'); FX.text(f.x, f.y - 190, 'ORDER!', '#ffd34d', 24, 40); },
        onFrame(f, fr) {
          f.mvars.g = fr <= 26 ? Math.min(1, fr / 22) : Math.max(0, 1 - (fr - 34) / 14);
          if (fr !== 26) return;
          const x = f.x + f.facing * 140;
          FX.shake(18); FX.flash('#ffd34d', 0.25); FX.dust(x, f.y, 22); FX.debris(x, f.y, '#6a5a4a', 18, 13);
          FX.ring(x, f.y - 8, '#ffd34d', 160, 22, 5); Sound.play('boom');
        },
      },
    },
  ],
};

/* ---------------------------------------------------------------- BAO (original) */

function drawBambooBg(ctx, d, a) {
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0e2a14'); g.addColorStop(0.7, '#2f6a2a'); g.addColorStop(1, '#14301a');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  // endless rows of bamboo stalks
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < 26; i++) {
      const x = (i * 53 + layer * 27) % (W + 40) - 20, w = layer ? 14 : 9, sway = Math.sin(d.age * 0.02 + i) * 4;
      ctx.fillStyle = layer ? '#4f8f3a' : '#3a6a2c';
      ctx.fillRect(x + sway, 0, w, FLOOR);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 40 + (i * 17) % 60; y < FLOOR; y += 90) ctx.fillRect(x + sway, y, w, 3);
    }
  }
  ctx.fillStyle = '#1e3a18'; ctx.fillRect(-30, FLOOR, W + 60, H - FLOOR + 30);
  ctx.restore();
}

const BAO = {
  id: 'bao', name: 'Bao', short: 'BAO', title: 'The Bamboo Monk', kanji: '包', color: '#7fc46a',
  style: 'A heavy, patient brawler: long-reach staff work, rolling tackles and bamboo that bursts from the ground.',
  bio: 'A giant panda raised in a mountain monastery, where the monks taught him to channel cursed energy through a bamboo staff. Calm until provoked — then very, very heavy.',
  passive: { name: 'Thick Fur', desc: 'Bao takes 15% less damage from melee attacks and gets knocked back half as far. He is a little slower on his feet.' },
  hp: 1150, speed: 0.95, scale: 1.12, shoulderW: 16, hipW: 12,
  melee: { weapon: 'sword', weaponName: 'Bamboo Staff', reach: 32, power: 1.1 },
  look: { skin: '#16161a', top: '#16161a', pants: '#16161a', accent: '#7fc46a', shoe: '#16161a' },
  aiStyle: { pref: 115 },
  onIncoming(f, dmg, h) { return { dmg: h.melee ? dmg * 0.85 : dmg, kb: 0.5 }; },
  drawTorso(g) {
    const { ctx, sk, col, OL } = g;
    // white belly and chest, red monk's scarf at the neck
    ctx.fillStyle = col('#f2f0ea'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sk.neck[0] * 0.45, sk.neck[1] * 0.45, 12, 20, sk.td[0] * 0.3, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = col('#c4122f'); ctx.lineWidth = 6;
    lineTo2(ctx, [sk.sh[0] - 10, sk.sh[1] + 2], [sk.sh[0] + 10, sk.sh[1] + 2]);
    lineTo2(ctx, [sk.sh[0] - 8, sk.sh[1] + 2], [sk.sh[0] - 14, sk.sh[1] + 18]);
  },
  drawHead(g) {
    const { ctx, sk, col, OL, o } = g, [hx, hy] = sk.head;
    ctx.fillStyle = col('#16161a'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    for (const ex of [-9, 9]) { ctx.beginPath(); ctx.arc(hx + ex, hy - 14, 7, 0, 6.283); ctx.fill(); ctx.stroke(); }
    headCircle(g, hx, hy, 17, '#f2f0ea');
    if (o.white || o.tint) return;
    ctx.fillStyle = '#16161a';
    ctx.beginPath(); ctx.ellipse(hx + 5, hy - 1, 4.5, 6, -0.4, 0, 6.283); ctx.ellipse(hx + 13, hy - 1, 3.5, 5.5, 0.4, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(hx + 6, hy - 2, 1.4, 0, 6.283); ctx.arc(hx + 13, hy - 2, 1.2, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#16161a'; ctx.beginPath(); ctx.ellipse(hx + 15, hy + 6, 3, 2, 0, 0, 6.283); ctx.fill();
  },
  drawWeapon(g) {
    const { ctx, sk, col, OL } = g, e = sk.aF[1], h = sk.aF[2];
    let dx = h[0] - e[0], dy = h[1] - e[1];
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const a = [h[0] - dx * 40, h[1] - dy * 40], b = [h[0] + dx * 70, h[1] + dy * 70];
    ctx.lineCap = 'round';
    ctx.strokeStyle = OL; ctx.lineWidth = 8; lineTo2(ctx, a, b);
    ctx.strokeStyle = col('#8fbf5a'); ctx.lineWidth = 5; lineTo2(ctx, a, b);
    ctx.strokeStyle = col('#4a6a2a'); ctx.lineWidth = 6;
    for (const k of [-25, 15, 50]) { const p = [h[0] + dx * k, h[1] + dy * k]; lineTo2(ctx, [p[0] - dy * 3, p[1] + dx * 3], [p[0] + dy * 3, p[1] - dx * 3]); }
  },
  abilities: [
    {
      name: 'Staff Whirl', icon: '旋', color: '#8fbf5a', cost: 15, cd: 150, ai: { min: 0, max: 150 },
      desc: 'Spins the bamboo staff in a wide circle, battering anyone on either side of him.',
      move: {
        id: 'whirl', kind: 'special', startup: 6, active: 20, recovery: 14, hitEvery: 5, sfx: 'whoosh', snapPose: true,
        hitbox: { x: -100, y: -140, w: 200, h: 110 }, hit: { dmg: 14, kb: 4, stun: 14, noScale: true, color: '#8fbf5a', hitstop: 1 },
        getPose(f, fr) { const p = poseCopy(fr < 6 ? POSES.slashW : POSES.slash2); if (fr >= 6 && fr < 26) p.aF[0] = 40 + ((fr - 6) * 40) % 360; return p; },
        onFrame(f, fr) { if (fr >= 6 && fr < 26 && fr % 5 === 0) FX.arc(f, { color: '#cde88a', r: 100, a0: -170, a1: 170 }); },
      },
    },
    {
      name: 'Rolling Tumble', icon: '転', color: '#f2f0ea', cost: 15, cd: 170, ai: { min: 80, max: 340 },
      desc: 'Curls into a ball and rolls straight through the opponent, launching them. Hard to stop once he gets going.',
      move: {
        id: 'roll', kind: 'special', startup: 6, active: 18, recovery: 12, keepVel: true, snapPose: true, sfx: 'dash',
        hitbox: { x: -20, y: -90, w: 80, h: 90 }, hit: { dmg: 62, kb: 11, kby: -11, launch: true, hitstop: 8, shake: 7, sfx: 'heavy' },
        getPose(f, fr) { const p = poseCopy(POSES.jump); p.rot = fr >= 6 && fr < 24 ? (fr - 6) * 40 * -1 : 0; return p; },
        onFrame(f, fr) {
          if (fr >= 6 && fr < 24) { f.vx = f.facing * 15; if (fr % 2 === 0) FX.dust(f.x, f.y, 2); }
          if (fr === 24) f.vx *= 0.2;
        },
      },
    },
    {
      name: 'Bamboo Grove', icon: '竹', color: '#6fae4a', cost: 25, cd: 260, ai: { min: 120, max: 800 },
      desc: 'Stamps the ground: three bursts of sharpened bamboo erupt in a line toward the opponent.',
      move: {
        id: 'grove', kind: 'special', startup: 14, active: 1, recovery: 18, poses: ['heavyW', 'block'],
        onFrame(f, fr, t) {
          if (fr !== 14) return;
          FX.shake(6); FX.dust(f.x, f.y, 10);
          const dir = t ? (t.x >= f.x ? 1 : -1) : f.facing;
          for (let i = 0; i < 3; i++) {
            eruption(f, f.x + dir * (120 + i * 110), { delay: 10 + i * 8, w: 70, h: 150 + i * 15, kind: 'bamboo', tele: '#8fbf5a', sfx: 'heavy', debris: '#4a6a2a',
              hits: { dmg: 45, kb: 4, kby: -12, launch: true, fx: 'wood', color: '#8fbf5a' } });
          }
        },
      },
    },
    {
      name: 'Snack Break', icon: '食', color: '#cde88a', cost: 30, cd: 720, ground: true, ai: { min: 300, max: 1280, when: f => f.hp < f.maxHp * 0.55 },
      desc: 'Sits down and munches a stalk of bamboo, regaining up to 160 health. Getting hit interrupts the snack.',
      move: {
        id: 'snack', kind: 'special', startup: 60, active: 0, recovery: 8, poses: ['sign', 'idle'],
        getPose: (f, fr) => { const p = poseCopy(POSES.sign); p.lF = [70, -110]; p.lB = [60, -100]; return fr < 60 ? p : POSES.idle; },
        onStart(f) { FX.text(f.x, f.y - 180, 'munch munch', '#cde88a', 18, 50); Sound.play('heal'); },
        onFrame(f, fr) {
          if (fr >= 60) return;
          f.hp = Math.min(f.maxHp, f.hp + 160 / 60);
          if (fr % 8 === 0) FX.debris(f.x + f.facing * 14, f.y - 90, '#8fbf5a', 2, 3);
          if (fr === 59) FX.text(f.x, f.y - 175, '+160', '#9be05a', 24, 45);
        },
      },
    },
    {
      name: 'Endless Bamboo Grove', icon: '森', color: '#7fc46a', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'DOMAIN EXPANSION. A boundless bamboo forest: the opponent is slowed in the thicket, bamboo spears erupt under them again and again, and Bao slowly heals.',
      move: {
        id: 'bamboodomain', kind: 'ult', startup: 60, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) { f.invuln = 70; domainCutscene(f, 'hands', 'ENDLESS BAMBOO GROVE'); FX.banner('DOMAIN EXPANSION', 'ENDLESS BAMBOO GROVE', '#7fc46a', 130); FX.slow(40, 0.35); Sound.play('charge'); },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 40) return;
          Domains.start(f, {
            type: 'bamboo', life: 360, slowOpp: true, bg: drawBambooBg,
            tick(d, t) {
              if (f.state !== 'ko') f.hp = Math.min(f.maxHp, f.hp + 0.15);
              if (!t || t.state === 'ko' || d.age % 40 !== 15) return;
              eruption(f, t.x, { y: World.groundAt(t.x, t.y), delay: 20, w: 80, h: 180, kind: 'bamboo', tele: '#8fbf5a', sfx: 'heavy', debris: '#4a6a2a',
                hits: { dmg: 40, kb: 4, kby: -13, launch: true, fx: 'wood', type: 'domain', chip: 0.5 } });
            },
          });
        },
      },
    },
  ],
};

/* ---------------------------------------------------------------- DAIGO KUJI (original) */

const REEL_SYMS = ['7', '♦', '★', '♠', '♣'];

// Every technique spins three reels. Three clovers = JACKPOT, two of a kind = a lucky boost.
// Misses build up "luck", making the next jackpot more likely.
function spinReels(f, bonus = 0) {
  const pJack = Math.min(0.6, 0.12 + (f.luck || 0) + bonus), pPair = 0.35;
  const r = Math.random();
  let res, syms;
  if (r < pJack) { res = 'jackpot'; syms = ['♣', '♣', '♣']; }
  else if (r < pJack + pPair) {
    res = 'pair';
    const a = U.pick(REEL_SYMS.slice(0, 4)), b = U.pick(REEL_SYMS.filter(x => x !== a && x !== '♣'));
    syms = U.pick([[a, a, b], [a, b, a], [b, a, a]]);
  } else {
    res = 'miss';
    const pool = REEL_SYMS.slice(); syms = [];
    for (let i = 0; i < 3; i++) syms.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  f.reels = { syms, t: 70, res };
  if (res === 'jackpot') { f.luck = 0; triggerJackpot(f); }
  else { f.luck = Math.min(0.4, (f.luck || 0) + (res === 'miss' ? 0.06 : 0.02)); Sound.play(res === 'pair' ? 'confirm' : 'tick'); }
  return res;
}

function triggerJackpot(f) {
  f.buffs.jackpot = 420;
  f.gainCe(30);
  FX.clovers(f.x, f.y - 90, 40, 10);
  FX.ring(f.x, f.y - 90, '#5fd65a', 150, 26, 6);
  FX.text(f.x, f.y - 220, 'JACKPOT!', '#ffd34d', 44, 90);
  FX.flash('#5fd65a', 0.3); FX.shake(10);
  Sound.play('bf'); Sound.play('heal');
}

function drawRouletteBg(ctx, d, a) {
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(W / 2, 300, 60, W / 2, 300, 800);
  g.addColorStop(0, '#2a5a2a'); g.addColorStop(1, '#0a1a0a');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  // a giant roulette wheel behind the fighters
  const cx = W / 2, cy = 300, R = 250, spin = d.age * 0.03 + (d.spinOff || 0);
  for (let i = 0; i < 18; i++) {
    const a0 = spin + i / 18 * 6.283, a1 = a0 + 6.283 / 18;
    ctx.fillStyle = i === 0 ? '#2f9a3a' : i % 2 ? '#a01828' : '#141414';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = '#c9a23a'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();
  ctx.fillStyle = '#c9a23a'; ctx.beginPath(); ctx.arc(cx, cy, 40, 0, 6.283); ctx.fill();
  // bouncing ball
  const ba = -d.age * 0.11;
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx + Math.cos(ba) * (R - 22), cy + Math.sin(ba) * (R - 22), 10, 0, 6.283); ctx.fill();
  // felt floor
  ctx.fillStyle = '#123a16'; ctx.fillRect(-30, FLOOR, W + 60, H - FLOOR + 30);
  ctx.strokeStyle = 'rgba(201,162,58,0.4)'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 100) { ctx.beginPath(); ctx.moveTo(x, FLOOR); ctx.lineTo(x - 40, H); ctx.stroke(); }
  ctx.restore();
}

const DAIGO = {
  id: 'daigo', name: 'Daigo Kuji', short: 'DAIGO', title: 'The High Roller', kanji: '久慈大吾', color: '#ffd34d',
  style: 'A luck-driven brawler: every technique spins the reels, and a jackpot turns him into a clover-soaked powerhouse.',
  bio: 'A back-alley gambler whose technique literally runs on luck. He has never once folded a hand, and he swears the clovers are real.',
  passive: { name: 'Lady Luck', desc: 'Every technique spins three reels. Two of a kind powers it up; three clovers is a JACKPOT — a 7-second Lucky Streak with +35% damage, +20% speed, triple cursed-energy regen and clovers bursting from every hit. Each miss makes the next jackpot more likely.' },
  hp: 1050, speed: 1.02, shoulderW: 17, hipW: 12,
  melee: { power: 1.1, reach: 6 },
  look: { skin: '#f0d0b4', top: '#5a4632', pants: '#2a2a34', accent: '#ffd34d', eye: '#2a1a10' },
  aiStyle: { pref: 140 },
  onDealHit(f, t) { if (f.buffs.jackpot) FX.clovers(t.x, t.midY, 6, 6); },
  passiveTick(f) {
    if (f.reels && f.reels.t > 0) f.reels.t--;
    if (f.buffs.jackpot && f.anim % 4 === 0) {
      const a = f.anim * 0.15;
      FX.add({ type: 'clover', x: f.x + Math.cos(a) * 34, y: f.y - 70 * f.scale + Math.sin(a) * 50, vx: 0, vy: -1.2, life: 30, size: 5, color: U.pick(['#3fbf4a', '#5fd65a', '#8be07a']), drag: 0.97, rot: a, vr: 0.1 });
    }
  },
  // slot reels above his head after each spin
  drawAura(ctx, f) {
    const R = f.reels;
    if (!R || R.t <= 0 || f.state === 'ko') return;
    const h = headPos(f), y = h.y - 72 * f.scale, spinning = R.t > 52;
    ctx.save(); ctx.globalAlpha = Math.min(1, R.t / 10);
    ctx.fillStyle = 'rgba(10,8,4,0.85)'; ctx.strokeStyle = R.res === 'jackpot' && !spinning ? '#5fd65a' : '#c9a23a'; ctx.lineWidth = 2;
    ctx.fillRect(h.x - 42, y - 16, 84, 30); ctx.strokeRect(h.x - 42, y - 16, 84, 30);
    ctx.font = '900 18px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) {
      const stopped = R.t <= 52 + (2 - i) * 6;
      const sym = stopped ? R.syms[i] : REEL_SYMS[(f.anim + i * 2) % REEL_SYMS.length];
      ctx.fillStyle = sym === '♣' ? '#5fd65a' : sym === '7' ? '#ffd34d' : sym === '♦' ? '#ff4d5a' : '#ffffff';
      ctx.fillText(sym, h.x - 26 + i * 26, y);
    }
    ctx.restore();
  },
  drawHair(g, hx, hy, r) {
    const { ctx, o } = g;
    // messy yellow hair swept up and back
    drawSpikyHair(g, hx, hy, r, [[-65, 6, 13], [-38, 11, 12], [-12, 13, 12], [14, 12, 12], [40, 10, 12], [68, 8, 12], [98, 5, 12]], '#f2c832');
    if (o.white || o.tint) return;
    // a slight mustache
    ctx.strokeStyle = '#a07a20'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx + 6, hy + 7); ctx.quadraticCurveTo(hx + 10, hy + 9, hx + 14, hy + 7); ctx.stroke();
  },
  drawTorso(g) {
    const { ctx, sk, col, OL } = g;
    // thick fur collar on the heavy jacket, and a zip down the front
    ctx.fillStyle = col('#d8c8a8'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sk.sh[0], sk.sh[1] + 3, 15, 7, sk.td[0] * 0.4, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = col('#2a2016'); ctx.lineWidth = 2;
    lineTo2(ctx, [sk.sh[0] * 0.9 + 3, sk.sh[1] * 0.9 + 6], [3, -2]);
  },
  abilities: [
    {
      name: 'Card Toss', icon: '札', color: '#f8f4ea', cost: 12, cd: 110, ai: { min: 140, max: 750 },
      desc: 'Flicks razor-edged playing cards. Normally three; two of a kind throws five; a jackpot throws seven.',
      move: {
        id: 'cards', kind: 'special', startup: 10, active: 1, recovery: 14, poses: ['castW', 'cast'],
        onFrame(f, fr) {
          if (fr !== 10) return;
          const res = spinReels(f), n = res === 'jackpot' ? 7 : res === 'pair' ? 5 : 3;
          Sound.play('swish');
          for (let i = 0; i < n; i++) {
            const a = (i - (n - 1) / 2) * 0.07;
            spawnProj(f, {
              x: f.x + f.facing * 30, y: f.y - 110, vx: f.facing * Math.cos(a) * 18, vy: Math.sin(a) * 18, r: 10, life: 60, clash: 1, suit: U.pick(['♦', '♣', '♥', '♠']),
              hits: { dmg: 18, kb: 2, stun: 12, fx: 'slash', color: '#f8f4ea', hitstop: 1 },
              render(ctx, e) {
                ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.age * 0.5);
                ctx.fillStyle = '#f8f4ea'; ctx.strokeStyle = '#16161c'; ctx.lineWidth = 1.5;
                ctx.fillRect(-7, -10, 14, 20); ctx.strokeRect(-7, -10, 14, 20);
                ctx.fillStyle = e.suit === '♦' || e.suit === '♥' ? '#c4122f' : '#16161c'; ctx.font = '900 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.suit, 0, 1);
                ctx.restore();
              },
            });
          }
        },
      },
    },
    {
      name: 'Loaded Dice', icon: '賽', color: '#ffffff', cost: 20, cd: 200, ai: { min: 100, max: 600 },
      desc: 'Rolls two giant dice that bounce toward the opponent and explode for 6 damage per pip. Two of a kind loads them toward high numbers; a jackpot rolls double sixes.',
      move: {
        id: 'dice', kind: 'special', startup: 12, active: 1, recovery: 16, poses: ['castW', 'cast'],
        onFrame(f, fr) {
          if (fr !== 12) return;
          const res = spinReels(f);
          Sound.play('whoosh');
          for (let i = 0; i < 2; i++) {
            const pip = res === 'jackpot' ? 6 : res === 'pair' ? U.randInt(4, 6) : U.randInt(1, 6);
            spawnProj(f, {
              x: f.x + f.facing * 30, y: f.y - 120, vx: f.facing * (8 + i * 2.5), vy: -7 - i, r: 18, life: 120, clash: 2, pip, spin: 0,
              hits: { dmg: pip * 6, kb: 6, kby: -6, launch: pip >= 5, fx: pip === 6 ? 'red' : null, color: '#ffd34d', hitstop: 4 + pip },
              tick(e) {
                e.vy += 0.5; e.spin += e.vx * 0.04;
                if (e.y > FLOOR - 18) { e.y = FLOOR - 18; e.vy = -Math.abs(e.vy) * 0.55; e.vx *= 0.85; if (Math.abs(e.vy) < 2) e.kill('stop'); else Sound.play('tick'); }
              },
              onEnd(e) {
                FX.explosion(e.x, e.y, 20 + e.pip * 8, ['#ffffff', '#ffd34d', '#ff9a2a']);
                FX.text(e.x, e.y - 40, String(e.pip), '#ffd34d', 26, 40);
                if (e.pip === 6) FX.clovers(e.x, e.y, 6, 5);
              },
              render(ctx, e) {
                ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.spin);
                ctx.fillStyle = '#f8f4ea'; ctx.strokeStyle = '#16161c'; ctx.lineWidth = 2.5;
                ctx.fillRect(-16, -16, 32, 32); ctx.strokeRect(-16, -16, 32, 32);
                ctx.fillStyle = e.pip === 1 ? '#c4122f' : '#16161c';
                const P = { 1: [[0, 0]], 2: [[-7, -7], [7, 7]], 3: [[-8, -8], [0, 0], [8, 8]], 4: [[-7, -7], [7, -7], [-7, 7], [7, 7]], 5: [[-8, -8], [8, -8], [0, 0], [-8, 8], [8, 8]], 6: [[-7, -9], [7, -9], [-7, 0], [7, 0], [-7, 9], [7, 9]] }[e.pip];
                for (const [x, y] of P) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.283); ctx.fill(); }
                ctx.restore();
              },
            });
          }
        },
      },
    },
    {
      name: 'Double or Nothing', icon: '倍', color: '#ff9a2a', cost: 22, cd: 220, ai: { min: 0, max: 120 },
      desc: 'An all-in haymaker. On a miss it\'s a coin flip between a crushing double-damage blow and a harmless whiff; two of a kind or a jackpot always pays out double.',
      move: {
        id: 'double', kind: 'special', startup: 14, active: 4, recovery: 22, lunge: 9, poses: ['heavyW', 'heavy'],
        hitbox: { x: 4, y: -128, w: 78, h: 46 },
        onStart(f) { const res = spinReels(f); f.mvars.win = res !== 'miss' || Math.random() < 0.5; },
        hitFn(f) {
          return f.mvars.win
            ? { dmg: 150, kb: 16, kby: -12, launch: true, hitstop: 14, shake: 14, sfx: 'boom', color: '#ffd34d' }
            : { dmg: 0, kb: 1, stun: 4, quiet: true, sfx: 'tick' };
        },
        onHit(f, t) {
          if (f.mvars.win) { FX.text(t.x, t.y - 190, 'DOUBLE!', '#ffd34d', 34, 60); FX.clovers(t.x, t.midY, 12, 7); }
          else FX.text(t.x, t.y - 190, '...nothing', '#9aa0b0', 22, 50);
        },
      },
    },
    {
      name: 'Roulette Royale', icon: '賭', color: '#2f9a3a', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'DOMAIN EXPANSION. A colossal roulette wheel spins behind the fight. Every couple of seconds the ball lands — RED: the opponent is struck by fire; BLACK: the opponent is frozen; GREEN: JACKPOT for Daigo, plus 120 health.',
      move: {
        id: 'roulette', kind: 'ult', startup: 60, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) { f.invuln = 70; domainCutscene(f, 'cards', 'ROULETTE ROYALE'); FX.banner('DOMAIN EXPANSION', 'ROULETTE ROYALE', '#5fd65a', 130); FX.slow(40, 0.35); Sound.play('charge'); },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 40) return;
          Domains.start(f, {
            type: 'roulette', life: 380, bg: drawRouletteBg,
            tick(d, t) {
              if (d.age % 80 !== 40 || d.lastSpin === d.age) return;
              d.lastSpin = d.age;
              const r = Math.random(), slot = r < 0.2 ? 'green' : r < 0.6 ? 'red' : 'black';
              FX.text(W / 2, 140, slot.toUpperCase(), slot === 'green' ? '#5fd65a' : slot === 'red' ? '#ff4d5a' : '#ffffff', 40, 60);
              Sound.play('tick');
              if (slot === 'green') { triggerJackpot(f); f.hp = Math.min(f.maxHp, f.hp + 120); return; }
              for (const v of World.enemies(f)) {
                if (v.state === 'ko') continue;
                if (slot === 'red') { FX.explosion(v.x, v.midY, 70, ['#fff3b0', '#ff5a3a', '#a01828']); Combat.hit(f, v, { dmg: 65, kb: 8, kby: -9, launch: true, fx: 'fire', type: 'domain', sureHit: true, x: v.x, y: v.midY, dir: dirTo(f, v) }); }
                else { v.applyStun(60, true, true); FX.text(v.x, v.y - 180, 'FROZEN', '#bfe6ff', 22, 50); }
              }
            },
          });
        },
      },
    },
    {
      name: 'Spin the Reels', icon: '運', color: '#5fd65a', cost: 15, cd: 240, ai: { min: 300, max: 1280, when: f => !f.buffs.jackpot },
      desc: 'Pure gambling: spins the reels with much better odds. Jackpot starts a Lucky Streak; two of a kind refunds 20 cursed energy; a miss still builds luck.',
      move: {
        id: 'spin', kind: 'special', startup: 16, active: 1, recovery: 10, poses: ['sign', 'win'],
        onFrame(f, fr) {
          if (fr !== 16) return;
          const res = spinReels(f, 0.2);
          if (res === 'pair') { f.gainCe(20); FX.text(f.x, f.y - 200, '+20 CE', '#9fd0ff', 20, 40); }
          if (res === 'miss') FX.text(f.x, f.y - 200, 'so close...', '#9aa0b0', 18, 40);
        },
      },
    },
  ],
};

/* ---------------------------------------------------------------- new cursed spirits (original) */

// Swamp ghost: hooded, robe trailing into mud, two pale eyes.
function drawSwampBg(ctx, d, a) {
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0e1a12'); g.addColorStop(1, '#2a3a20');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  ctx.fillStyle = 'rgba(150,180,120,0.12)';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse((i * 250 + d.age * 0.5) % (W + 200) - 100, 200 + (i % 3) * 90, 220, 40, 0, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = '#2a2a18'; ctx.fillRect(-30, FLOOR - 6, W + 60, H - FLOOR + 40);
  ctx.fillStyle = 'rgba(90,110,60,0.6)';
  for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.ellipse((i * 113) % W, FLOOR + 4 + (i % 4) * 14, 30 + Math.sin(d.age * 0.05 + i) * 6, 5, 0, 0, 6.283); ctx.fill(); }
  ctx.restore();
}

const WRAITH = {
  id: 'wraith', name: 'Mire Wraith', short: 'WRAITH', title: 'Cursed Spirit of the Bog', kanji: '沼霊', color: '#8aa86a', curse: true,
  style: 'A slippery controller: slows opponents with mud, drags them under with grasping hands and sinks through the floor.',
  bio: 'Born from the fear of drowning in dark water. It never quite walks — it seeps from place to place.',
  passive: { name: 'Seeping Body', desc: 'Its mud slows anyone it hits by 40% for a few seconds, and it slowly regenerates while standing still.' },
  hp: 1000, speed: 0.95, melee: { power: 1.0, reach: 8 },
  look: curseLook('#b8c8a8', '#3a4a2a'), aiStyle: { pref: 220, ranged: true },
  passiveTick(f) { if (f.state === 'idle' && World.active) f.hp = Math.min(f.maxHp, f.hp + 0.15); if (f.anim % 9 === 0 && f.state !== 'ko') FX.add({ type: 'smoke', x: f.x + U.rand(-10, 10), y: f.y - 4, vy: 0.3, life: 30, size: 6, color: '#3a4a2a', drag: 0.98 }); },
  drawTorso(g) {
    const { ctx, sk, col, OL } = g;
    // tattered robe hanging over the legs
    ctx.fillStyle = col('#3a4a2a'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sk.sh[0] - 14, sk.sh[1]); ctx.lineTo(sk.sh[0] + 14, sk.sh[1]);
    for (let i = 0; i <= 6; i++) ctx.lineTo(18 - i * 6, 40 + (i % 2) * 10);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  },
  drawHead(g) {
    const { ctx, sk, col, OL, o } = g, [hx, hy] = sk.head;
    ctx.fillStyle = col('#2a3420'); ctx.strokeStyle = OL; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(hx - 18, hy + 14); ctx.quadraticCurveTo(hx - 20, hy - 26, hx + 6, hy - 22); ctx.quadraticCurveTo(hx + 22, hy - 10, hx + 18, hy + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col('#0e140a'); ctx.beginPath(); ctx.ellipse(hx + 4, hy, 11, 13, 0, 0, 6.283); ctx.fill();
    if (o.white || o.tint) return;
    ctx.fillStyle = '#e8f0d0'; ctx.beginPath(); ctx.ellipse(hx + 2, hy - 1, 2.5, 3.5, 0, 0, 6.283); ctx.ellipse(hx + 10, hy - 1, 2, 3, 0, 0, 6.283); ctx.fill();
  },
  abilities: [
    {
      name: 'Mud Glob', icon: '泥', color: '#8a7a4a', cost: 15, cd: 140, ai: { min: 140, max: 700 },
      desc: 'Lobs a heavy glob of mud that slows whoever it hits.',
      move: { id: 'mudglob', kind: 'special', startup: 12, active: 1, recovery: 14, poses: ['castW', 'cast'],
        onFrame(f, fr) {
          if (fr !== 12) return;
          Sound.play('bite');
          spawnProj(f, { x: f.x + f.facing * 30, y: f.y - 120, vx: f.facing * 11, vy: -6, r: 16, life: 100, clash: 1,
            hits: { dmg: 35, kb: 4, stun: 18, color: '#8a7a4a' }, onHit(e, t) { t.buffs.mud = 180; },
            tick(e) { e.vy += 0.3; if (e.y > FLOOR) e.kill('ground'); },
            onEnd(e) { FX.spark(e.x, e.y, '#6a5a3a', 10, 4); },
            render(ctx, e) { ctx.fillStyle = '#5a4a2a'; ctx.strokeStyle = '#1a140a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x, e.y, 16, 13, e.age * 0.2, 0, 6.283); ctx.fill(); ctx.stroke(); } });
        } },
    },
    {
      name: 'Sink', icon: '沈', color: '#3a4a2a', cost: 20, cd: 260, ai: { min: 150, max: 900 },
      desc: 'Melts into the floor and rises up beneath the opponent with an uppercut.',
      move: { id: 'sink', kind: 'special', startup: 22, active: 4, recovery: 18, poses: ['block', 'upper'],
        hitbox: { x: -10, y: -150, w: 80, h: 150 }, hit: { dmg: 65, kb: 6, kby: -15, launch: true, hitstop: 8, color: '#8aa86a' },
        getPose: (f, fr) => (fr < 20 ? POSES.down : POSES.upper),
        onFrame(f, fr, t) {
          if (fr < 20) f.invuln = Math.max(f.invuln, 2);
          if (fr === 2) { Sound.play('whoosh'); FX.smoke(f.x, f.y - 10, '#3a4a2a', 12, 30, 16); }
          if (fr === 18 && t) { f.x = t.x - t.facing * 30; f.clampWalls(); f.facing = t.x >= f.x ? 1 : -1; FX.smoke(f.x, f.y - 10, '#3a4a2a', 12, 30, 16); }
        } },
    },
    {
      name: 'Grasping Hands', icon: '掴', color: '#6a8a5a', cost: 25, cd: 300, ai: { min: 100, max: 900 },
      desc: 'Muddy hands burst up beneath the opponent and hold them in place.',
      move: { id: 'hands', kind: 'special', startup: 14, active: 1, recovery: 18, poses: ['castW', 'point'],
        onFrame(f, fr, t) {
          if (fr !== 14 || !t) return;
          eruption(f, t.x, { y: World.groundAt(t.x, t.y), delay: 24, w: 80, h: 120, kind: 'shadow', tele: '#6a8a5a', sfx: 'grab', debris: '#3a4a2a',
            hits: { dmg: 30, stunAdd: 55, kb: 0, unblockable: true, color: '#6a8a5a' } });
        } },
    },
    {
      name: 'Bog Pool', icon: '沼', color: '#5a6a3a', cost: 25, cd: 360, ai: { min: 0, max: 400 },
      desc: 'Spreads a pool of sucking mud in front of it for five seconds. Anyone standing in it is slowed and slowly hurt.',
      move: { id: 'bog', kind: 'special', startup: 12, active: 1, recovery: 14, poses: ['heavyW', 'block'],
        onFrame(f, fr) {
          if (fr !== 12) return;
          FX.dust(f.x + f.facing * 150, FLOOR, 12); Sound.play('land');
          spawnSummon(f, { x: f.x + f.facing * 150, y: FLOOR, life: 300, layer: 'back',
            tick(e) {
              for (const v of World.enemies(f)) {
                if (v.state === 'ko' || Math.abs(v.x - e.x) > 120 || v.y < FLOOR - 10) continue;
                v.buffs.mud = Math.max(v.buffs.mud || 0, 20);
                if (e.age % 20 === 0) Combat.hit(f, v, { dmg: 6, kb: 0, stun: 4, hitstop: 0, noScale: true, quiet: true, sfx: 'tick', x: v.x, y: v.y - 20, dir: 1 });
              }
            },
            render(ctx, e) {
              ctx.save(); ctx.globalAlpha = Math.min(1, e.age / 10, (e.life - e.age) / 20);
              ctx.fillStyle = '#3a301a'; ctx.beginPath(); ctx.ellipse(e.x, FLOOR + 2, 125, 12, 0, 0, 6.283); ctx.fill();
              ctx.fillStyle = 'rgba(120,110,60,0.6)';
              for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(e.x - 90 + i * 60, FLOOR - 1, 3 + Math.sin(e.age * 0.2 + i) * 2, 0, 6.283); ctx.fill(); }
              ctx.restore();
            } });
        } },
    },
    {
      name: 'Drowning Mire', icon: '溺', color: '#8aa86a', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'DOMAIN EXPANSION. Floods the arena with black bog water: opponents are slowed, and muddy hands keep dragging them down.',
      move: { id: 'mire', kind: 'ult', startup: 60, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) { f.invuln = 70; domainCutscene(f, 'hands', 'DROWNING MIRE'); FX.banner('DOMAIN EXPANSION', 'DROWNING MIRE', '#8aa86a', 130); FX.slow(40, 0.35); Sound.play('charge'); },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 40) return;
          Domains.start(f, { type: 'mire', life: 360, slowOpp: true, bg: drawSwampBg,
            tick(d, t) {
              if (!t || t.state === 'ko' || d.age % 45 !== 20) return;
              eruption(f, t.x, { y: World.groundAt(t.x, t.y), delay: 18, w: 80, h: 130, kind: 'shadow', tele: '#6a8a5a', sfx: 'grab', debris: '#3a4a2a',
                hits: { dmg: 35, stunAdd: 30, kb: 0, unblockable: true, type: 'domain', color: '#6a8a5a' } });
            } });
        } },
    },
  ],
};

// Paper-lantern spirit: a floating lantern head with one big eye and a long tongue (a folklore yokai, drawn originally).
const LANTERN = {
  id: 'lantern', name: 'Lantern Spirit', short: 'LANTERN', title: 'Cursed Spirit of the Night Festival', kanji: '提灯', color: '#ff9a3a', curse: true,
  style: 'A tricky zoner: homing fire wisps, a blinding flash, and a tongue that lashes out from range.',
  bio: 'An old festival lantern that soaked up a century of whispered ghost stories until it opened its eye.',
  passive: { name: 'Paper Body', desc: 'Light and floaty: Lantern Spirit falls slowly and can double-jump higher, but fire attacks hurt it 25% more.' },
  hp: 950, speed: 1.05, melee: { power: 0.95 },
  look: curseLook('#f0e0c0', '#6a2a1a'), aiStyle: { pref: 260, ranged: true },
  onIncoming(f, dmg, h) { return { dmg: h.fx === 'fire' ? dmg * 1.25 : dmg }; },
  passiveTick(f) { if (!f.onGround && f.vy > 3) f.vy = 3; },
  drawHead(g) {
    const { ctx, sk, col, OL, o } = g, [hx, hy] = sk.head;
    // ribbed paper lantern
    ctx.fillStyle = col('#f4e0b0'); ctx.strokeStyle = OL; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(hx, hy - 4, 17, 22, 0, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col('#2a1a10'); ctx.fillRect(hx - 9, hy - 30, 18, 6); ctx.fillRect(hx - 9, hy + 16, 18, 5);
    if (o.white || o.tint) return;
    ctx.strokeStyle = 'rgba(160,90,40,0.6)'; ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(hx, hy - 4 + i * 8, 17 * Math.sqrt(1 - (i * 8 / 22) ** 2), 2, 0, 0, 6.283); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(hx + 5, hy - 8, 7, 8, 0, 0, 6.283); ctx.fill(); ctx.strokeStyle = OL; ctx.stroke();
    ctx.fillStyle = '#1a0a04'; ctx.beginPath(); ctx.arc(hx + 7, hy - 8, 3.5, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#c4122f'; ctx.beginPath(); ctx.moveTo(hx + 2, hy + 6); ctx.quadraticCurveTo(hx + 16, hy + 8, hx + 14, hy + 20); ctx.quadraticCurveTo(hx + 8, hy + 12, hx + 2, hy + 10); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.1 * Math.sin((o.fighter ? o.fighter.anim : 0) * 0.2);
    ctx.fillStyle = '#ff9a3a'; ctx.beginPath(); ctx.arc(hx, hy - 4, 30, 0, 6.283); ctx.fill(); ctx.restore();
  },
  abilities: [
    {
      name: 'Will-o\'-Wisp', icon: '火', color: '#ff9a3a', cost: 18, cd: 180, ai: { min: 120, max: 900 },
      desc: 'Releases three ghostly flames that drift after the opponent.',
      move: { id: 'wisps', kind: 'special', startup: 12, active: 1, recovery: 16, poses: ['castW', 'cast'],
        onFrame(f, fr) {
          if (fr !== 12) return;
          Sound.play('fire');
          for (let i = 0; i < 3; i++) spawnProj(f, { x: f.x + f.facing * 20, y: f.y - 130 + i * 20, vx: f.facing * 3, vy: -2 + i * 2, r: 11, life: 150, clash: 1, wallKill: false,
            hits: { dmg: 24, kb: 3, stun: 14, fx: 'fire', hitstop: 2 },
            tick(e, t) { if (t && e.age > 12) { const a = Math.atan2(t.midY - e.y, t.x - e.x); e.vx = U.lerp(e.vx, Math.cos(a) * 5.5, 0.04); e.vy = U.lerp(e.vy, Math.sin(a) * 5.5, 0.04); } if (e.age % 3 === 0) FX.glow(e.x, e.y, '#7ac8ff', 8, 10); },
            render(ctx, e) { glowOrb(ctx, e.x, e.y, 8, '#e0f6ff', '#3a8aff'); } });
        } },
    },
    {
      name: 'Festival Flash', icon: '閃', color: '#ffe36a', cost: 22, cd: 300, ai: { min: 0, max: 220 },
      desc: 'Its light flares blindingly, stunning everyone close by.',
      move: { id: 'flash', kind: 'special', startup: 14, active: 1, recovery: 18, poses: ['block', 'win'],
        onFrame(f, fr) {
          if (fr !== 14) return;
          FX.flash('#fff3c0', 0.5); FX.ring(f.x, f.y - 110, '#ffe36a', 220, 18, 5); Sound.play('zap');
          for (const v of World.enemies(f)) if (near(v, f.x, f.midY, 220, 200)) Combat.hit(f, v, { dmg: 20, stunAdd: 45, kb: 2, x: v.x, y: v.midY, dir: dirTo(f, v) });
        } },
    },
    {
      name: 'Tongue Lash', icon: '舌', color: '#c4122f', cost: 15, cd: 150, ai: { min: 80, max: 240 },
      desc: 'Its long tongue whips out across the floor and drags the opponent in.',
      move: { id: 'tongue', kind: 'special', startup: 10, active: 6, recovery: 18, poses: ['castW', 'point'],
        hitbox: { x: 10, y: -150, w: 230, h: 40 }, hit: { dmg: 35, kb: 0, stun: 30, color: '#c4122f' },
        onFrame(f, fr) { if (fr >= 10 && fr < 16) { const h = headPos(f); FX.slash(h.x + f.facing * 115, h.y + 14, 0, 230, '#c4122f', 5, 3); } },
        onHit(f, t) { t.x = f.x + f.facing * 70; t.clampWalls(); Sound.play('grab'); } },
    },
    {
      name: 'Paper Ward', icon: '紙', color: '#f4e0b0', cost: 20, cd: 480, ai: { min: 0, max: 500, when: f => !f.buffs.ward },
      desc: 'Wraps itself in layers of charmed paper for 5 seconds, halving all damage it takes.',
      move: { id: 'ward', kind: 'special', startup: 10, active: 1, recovery: 10, poses: ['block', 'block'],
        onFrame(f, fr) { if (fr === 10) { f.buffs.ward = 300; Sound.play('heal'); FX.ring(f.x, f.y - 80, '#f4e0b0', 90, 18, 4); } } },
    },
    {
      name: 'Hundred Lanterns', icon: '百', color: '#ff9a3a', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'ULTIMATE. A night parade of burning lanterns rains down across the whole arena.',
      move: { id: 'hundred', kind: 'ult', startup: 30, active: 0, recovery: 0, total: 120, poses: ['sign', 'upper'],
        onStart(f) { f.invuln = 40; FX.banner('ULTIMATE', 'HUNDRED LANTERNS', '#ff9a3a', 110); FX.slow(30, 0.4); Sound.play('charge'); },
        onFrame(f, fr, t) {
          if (fr < 30 || fr > 110 || fr % 5) return;
          const tx = t && Math.random() < 0.5 ? t.x + U.rand(-60, 60) : U.rand(World.left + 40, World.right - 40);
          spawnProj(f, { x: tx, y: -40, vx: 0, vy: 11, r: 18, life: 100, wallKill: false,
            hits: { dmg: 22, kb: 4, kby: -5, launch: true, fx: 'fire', hitstop: 2 },
            tick(e) { if (e.y > FLOOR - 10) e.kill('ground'); },
            onEnd(e) { FX.explosion(e.x, Math.min(e.y, FLOOR - 10), 34, ['#fff3b0', '#ff9a2a', '#ff3a1a']); },
            render(ctx, e) { ctx.fillStyle = '#f4e0b0'; ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x, e.y, 12, 16, 0, 0, 6.283); ctx.fill(); ctx.stroke(); glowOrb(ctx, e.x, e.y, 8, '#fff3b0', '#ff9a3a', 0.7); } });
        } },
    },
  ],
};
LANTERN.onIncoming = (f, dmg, h) => ({ dmg: dmg * (h.fx === 'fire' ? 1.25 : 1) * (f.buffs.ward ? 0.5 : 1) });

// Crow spirit: a gaunt figure in a feather cloak with a long beaked mask.
function crowRender(ctx, e) {
  ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.vx >= 0 ? 1 : -1, 1);
  const flap = Math.sin(e.age * 0.6) * 0.8;
  ctx.fillStyle = '#16161e'; ctx.strokeStyle = '#3a3a52'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(-14, -12 - flap * 10); ctx.lineTo(4, -3); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(18, 0); ctx.lineTo(10, 2); ctx.fillStyle = '#c9a23a'; ctx.fill();
  ctx.fillStyle = '#ff3a3a'; ctx.fillRect(6, -3, 2, 2);
  ctx.restore();
}

const CROW = {
  id: 'crow', name: 'Crow Spirit', short: 'CROW', title: 'Cursed Spirit of Ill Omens', kanji: '鴉霊', color: '#7a7aa8', curse: true,
  style: 'Fast and evasive: flocks of crows, swooping dashes and a cloak that vanishes into the night.',
  bio: 'A curse born from every superstition about black birds on rooftops. Where it lands, bad luck follows.',
  passive: { name: 'Ill Omen', desc: 'Moves 15% faster and its dash covers more ground. Every hit it lands has a chance to drain a little cursed energy from the opponent.' },
  hp: 950, speed: 1.15, melee: { power: 1.0, reach: 6, weapon: 'claw' },
  look: curseLook('#c8c8d8', '#1a1a26'), aiStyle: { pref: 180, ranged: true },
  onDealHit(f, t) { if (Math.random() < 0.3) t.ce = Math.max(0, t.ce - 6); },
  drawTorso(g) {
    const { ctx, sk, col, OL } = g;
    // feather cloak draped from the shoulders
    ctx.fillStyle = col('#16161e'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sk.sh[0] - 4, sk.sh[1]);
    for (let i = 0; i < 6; i++) ctx.lineTo(sk.sh[0] - 22 - i * 3, sk.sh[1] + 10 + i * 9 + (i % 2) * 5);
    ctx.lineTo(sk.sh[0] - 6, sk.sh[1] + 50); ctx.closePath(); ctx.fill(); ctx.stroke();
  },
  drawHead(g) {
    const { ctx, sk, col, OL, o } = g, [hx, hy] = sk.head;
    headCircle(g, hx, hy, 14, '#1e1e2a');
    // long curved beak mask
    ctx.fillStyle = col('#d8d0b8'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx + 8, hy - 6); ctx.quadraticCurveTo(hx + 30, hy, hx + 34, hy + 12); ctx.quadraticCurveTo(hx + 20, hy + 6, hx + 8, hy + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col('#16161e');
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx - 6 - i * 3, hy - 10 + i * 4); ctx.lineTo(hx - 22 - i * 2, hy - 18 + i * 8); ctx.lineTo(hx - 8 - i * 3, hy - 4 + i * 4); ctx.fill(); }
    if (o.white || o.tint) return;
    ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(hx + 5, hy - 2, 2.4, 0, 6.283); ctx.fill();
  },
  abilities: [
    {
      name: 'Crow Volley', icon: '羽', color: '#7a7aa8', cost: 15, cd: 150, ai: { min: 140, max: 800 },
      desc: 'Sends five crows flying at the opponent in a weaving wave.',
      move: { id: 'crows', kind: 'special', startup: 10, active: 1, recovery: 14, poses: ['castW', 'cast'],
        onFrame(f, fr) {
          if (fr !== 10) return;
          Sound.play('whoosh');
          for (let i = 0; i < 5; i++) spawnProj(f, { x: f.x + f.facing * 20, y: f.y - 150 + i * 18, vx: f.facing * (11 + i), vy: 0, r: 12, life: 80, clash: 1, ph: i,
            hits: { dmg: 16, kb: 2, stun: 12, fx: 'slash', color: '#7a7aa8', hitstop: 1 },
            tick(e) { e.vy = Math.sin(e.age * 0.25 + e.ph) * 3; }, render: crowRender });
        } },
    },
    {
      name: 'Swooping Dash', icon: '翔', color: '#9a9ac8', cost: 15, cd: 170, ai: { min: 60, max: 300 },
      desc: 'Swoops low across the ground in a blur of feathers, raking the opponent on the way past.',
      move: { id: 'swoop', kind: 'special', startup: 5, active: 14, recovery: 14, keepVel: true, hitEvery: 5, poses: ['dash', 'dash'], sfx: 'dash',
        hitbox: { x: -20, y: -120, w: 90, h: 100 }, hit: { dmg: 18, kb: 2, stun: 16, fx: 'slash', color: '#7a7aa8', noScale: true },
        onFrame(f, fr) { if (fr >= 5 && fr < 19) { f.vx = f.facing * 18; f.invuln = Math.max(f.invuln, 2); if (fr % 2 === 0) FX.ghost(f, '#7a7aa8'); } if (fr === 19) f.vx *= 0.2; } },
    },
    {
      name: 'Pecking Swarm', icon: '群', color: '#5a5a7a', cost: 25, cd: 360, ai: { min: 0, max: 700 },
      desc: 'A swarm of crows settles on the opponent, pecking them repeatedly. The swarm can be swatted away.',
      move: { id: 'swarm', kind: 'special', startup: 12, active: 1, recovery: 16, poses: ['sign', 'point'],
        onFrame(f, fr, t) {
          if (fr !== 12 || !t) return;
          Sound.play('whoosh');
          spawnSummon(f, { x: f.x, y: f.y - 150, life: 220, name: 'CROW SWARM', hp: 60, maxHp: 60, hurtbox: e => ({ x: e.x - 36, y: e.y - 30, w: 72, h: 60 }),
            tick(e, tt) {
              if (!tt || tt.state === 'ko') return;
              e.x = U.lerp(e.x, tt.x, 0.08); e.y = U.lerp(e.y, tt.midY - 20, 0.08);
              if (e.age % 12 === 0 && Math.abs(tt.x - e.x) < 60) Combat.hit(f, tt, { dmg: 7, kb: 1, stun: 10, hitstop: 0, noScale: true, quiet: true, fx: 'slash', color: '#7a7aa8', sfx: 'tick', x: tt.x, y: tt.midY, dir: dirTo(f, tt) });
            },
            onEnd(e) { FX.spark(e.x, e.y, '#3a3a52', 10, 5); },
            render(ctx, e) { for (let i = 0; i < 6; i++) { const a = e.age * 0.2 + i; crowRender(ctx, { x: e.x + Math.cos(a) * 30, y: e.y + Math.sin(a * 1.3) * 20, vx: Math.cos(a + 1.6), age: e.age + i * 3 }); } } });
        } },
    },
    {
      name: 'Night Veil', icon: '夜', color: '#3a3a52', cost: 18, cd: 300, ai: { min: 0, max: 200 },
      desc: 'Bursts into a cloud of black feathers, untouchable for a moment, and reforms some distance behind the opponent.',
      move: { id: 'veil', kind: 'special', startup: 30, active: 0, recovery: 8, poses: ['block', 'idle'],
        onFrame(f, fr, t) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr === 1) { Sound.play('whoosh'); FX.smoke(f.x, f.y - 70, '#16161e', 16, 30, 20); }
          if (fr === 26 && t) { f.x = t.x - t.facing * 160; f.clampWalls(); f.facing = t.x >= f.x ? 1 : -1; FX.smoke(f.x, f.y - 70, '#16161e', 12, 26, 18); }
        } },
    },
    {
      name: 'Murder of Crows', icon: '殺', color: '#7a7aa8', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'ULTIMATE. A vast flock of crows sweeps back and forth across the entire arena three times.',
      move: { id: 'murder', kind: 'ult', startup: 30, active: 0, recovery: 0, total: 140, poses: ['sign', 'upper'],
        onStart(f) { f.invuln = 40; FX.banner('ULTIMATE', 'MURDER OF CROWS', '#9a9ac8', 110); FX.slow(30, 0.4); Sound.play('charge'); },
        onFrame(f, fr) {
          if (fr < 30 || fr > 130 || fr % 4) return;
          const pass = Math.floor((fr - 30) / 34), dir = pass % 2 ? -1 : 1;
          spawnProj(f, { x: dir > 0 ? -40 : W + 40, y: FLOOR - U.rand(30, 200), vx: dir * U.rand(14, 18), vy: 0, r: 14, life: 120, wallKill: false, pierce: true,
            hits: { dmg: 9, kb: 2, stun: 10, fx: 'slash', color: '#7a7aa8', noScale: true, hitstop: 0, quiet: true }, render: crowRender });
        } },
    },
  ],
};

/* ---------------------------------------------------------------- COMMUNISM (original) */

const GOLD = '#ffd34d';

// Crossed hammer and sickle, centred on (x, y); s = 1 spans roughly 22px.
function drawHammerSickle(ctx, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round';
  // sickle: a crescent blade sweeping over the top, handle down to the lower left
  ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(1, -1, 7.5, 3.5, 1.75); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-1, 6); ctx.lineTo(-7, 11); ctx.stroke();
  // hammer: handle from the upper left to the lower right, head across the top
  ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-4, -3); ctx.lineTo(8, 10); ctx.stroke();
  ctx.save(); ctx.translate(-4.5, -3.5); ctx.rotate(-Math.PI / 4 - Math.PI / 2); ctx.fillRect(-5.5, -2.2, 11, 4.4); ctx.restore();
  ctx.restore();
}

function drawStar(ctx, x, y, r, color, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

// Unit vector along the forearm, for drawing held weapons.
function armDir(arm) {
  const e = arm[1], h = arm[2], dx = h[0] - e[0], dy = h[1] - e[1], L = Math.hypot(dx, dy) || 1;
  return Math.atan2(dy / L, dx / L);
}

function drawSickle(g, h, ang) {
  const { ctx, col, OL } = g;
  ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(ang);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OL; ctx.lineWidth = 7; lineTo2(ctx, [-6, 0], [14, 0]);
  ctx.strokeStyle = col('#d9a520'); ctx.lineWidth = 4; lineTo2(ctx, [-6, 0], [14, 0]);
  ctx.beginPath(); ctx.moveTo(12, 2);
  ctx.bezierCurveTo(48, 6, 50, -36, 14, -40);
  ctx.bezierCurveTo(38, -30, 36, -4, 12, -4); ctx.closePath();
  ctx.fillStyle = col(GOLD); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OL; ctx.stroke();
  ctx.restore();
}

function drawHammer(g, h, ang) {
  const { ctx, col, OL } = g;
  ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(ang);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OL; ctx.lineWidth = 7; lineTo2(ctx, [-8, 0], [30, 0]);
  ctx.strokeStyle = col('#d9a520'); ctx.lineWidth = 4; lineTo2(ctx, [-8, 0], [30, 0]);
  ctx.fillStyle = col(GOLD); ctx.strokeStyle = OL; ctx.lineWidth = 2;
  ctx.fillRect(26, -14, 13, 28); ctx.strokeRect(26, -14, 13, 28);
  ctx.restore();
}

// A little marching worker for Workers Unite!
const WORKER = {
  scale: 0.72, hipW: 8, shoulderW: 11,
  look: { skin: '#d4142a', top: '#b0102a', pants: '#8a0c20', accent: GOLD, shoe: '#4a0610' },
  drawHair(g, hx, hy, r) {
    const { ctx, col, OL } = g;
    ctx.fillStyle = col('#6a5a4a'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx, hy - 2, r + 1, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (!g.o.white) drawStar(ctx, hx + 6, hy - 9, 4, '#e0102a');
  },
  drawWeapon(g) { drawHammer(g, g.sk.aF[2], armDir(g.sk.aF) - 0.6); },
};

// Domain backdrop: a red-lit plaza of onion-domed towers under a disco ball and spinning emblem.
function drawRedSquareBg(ctx, d, a) {
  ctx.save(); ctx.globalAlpha = a;
  const beat = (d.age % 28) / 28, pulse = 1 - beat;
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR);
  g.addColorStop(0, '#1a0206'); g.addColorStop(0.6, '#6a0614'); g.addColorStop(1, '#b0102a');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  // sweeping spotlights
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const an = Math.PI / 2 + Math.sin(d.age * 0.03 + i * 1.3) * 0.6, x0 = 120 + i * 260;
    ctx.fillStyle = i % 2 ? 'rgba(255,211,77,0.08)' : 'rgba(255,80,90,0.08)';
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + Math.cos(an - 0.12) * 900, Math.sin(an - 0.12) * 900); ctx.lineTo(x0 + Math.cos(an + 0.12) * 900, Math.sin(an + 0.12) * 900); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // giant hammer and sickle turning slowly in the sky, throbbing on the beat
  ctx.globalAlpha = a * (0.5 + pulse * 0.25);
  ctx.save(); ctx.translate(W / 2, 200); ctx.rotate(Math.sin(d.age * 0.02) * 0.15);
  drawHammerSickle(ctx, 0, 0, 9 + pulse * 0.6, GOLD); ctx.restore();
  ctx.globalAlpha = a;
  // disco ball
  const bx = W / 2, by = 40;
  ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, -10); ctx.lineTo(bx, by - 26); ctx.stroke();
  ctx.fillStyle = '#c8c8d0'; ctx.beginPath(); ctx.arc(bx, by, 26, 0, 6.283); ctx.fill();
  for (let i = 0; i < 14; i++) { const sx = bx + ((i * 13 + d.age) % 46) - 23, sy = by - 18 + (i * 7) % 36; ctx.fillStyle = (i + Math.floor(d.age / 6)) % 3 ? '#ffffff' : '#ff9aa8'; ctx.fillRect(sx, sy, 5, 5); }
  // skyline of generic onion domes and spires
  ctx.fillStyle = '#2a0408';
  for (let i = 0; i < 9; i++) {
    const x = 40 + i * 150, w = 50 + (i * 23) % 30, h = 120 + (i * 47) % 110, top = FLOOR - h;
    ctx.fillRect(x - w / 2, top, w, h);
    if (i % 2) { ctx.beginPath(); ctx.moveTo(x - w * 0.55, top); ctx.quadraticCurveTo(x - w * 0.7, top - 40, x, top - 70); ctx.quadraticCurveTo(x + w * 0.7, top - 40, x + w * 0.55, top); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(x - w * 0.4, top); ctx.lineTo(x, top - 90); ctx.lineTo(x + w * 0.4, top); ctx.fill(); drawStar(ctx, x, top - 98, 10, pulse > 0.6 ? '#ff2a3a' : '#c4122f'); ctx.fillStyle = '#2a0408'; }
  }
  // flashing dance floor
  for (let x = -30, k = 0; x < W + 30; x += 80, k++) {
    const lit = (k + Math.floor(d.age / 14)) % 3 === 0;
    ctx.fillStyle = lit ? '#ff3a4a' : k % 2 ? '#5a0610' : '#7a0a18';
    ctx.fillRect(x, FLOOR, 80, H - FLOOR + 30);
  }
  ctx.restore();
}

// One comrade in the domain's swarm, sprinting in from the left (side -1) or right (side 1) edge.
function comradeCharge(f, side) {
  const k = U.rand(0.85, 1.25), sp = U.rand(9, 13);
  spawnSummon(f, {
    x: side < 0 ? -40 : W + 40, y: FLOOR - 60 * k, vx: -side * sp, r: 22 * k, life: Math.ceil((W + 120) / sp), k, facing: -side, wallKill: false,
    lane: U.randInt(-8, 8), ph: Math.random() * 10, pierce: true,
    hits: { dmg: 2, kb: 1, kby: -1, stun: 12, unblockable: true, sureHit: true, type: 'domain', noScale: true, hitstop: 0, color: '#ff4d5a', sfx: 'hit' },
    tick(e) { if ((e.age + (e.ph | 0)) % 9 === 0) FX.dust(e.x, FLOOR, 1); },
    render(ctx, e) {
      drawStickman(ctx, WORKER, Math.floor(e.age / 4 + e.ph) % 2 ? POSES.walkA : POSES.walkB, e.x, FLOOR + e.lane, e.facing, { k: e.k });
    },
  });
}

const COMMUNISM = {
  id: 'communism', name: 'Communism', short: 'COMMUNISM', title: 'The Red Comrade', kanji: '同志', color: '#e0102a',
  style: 'A hard-hitting worker: sickle sweeps, hammer shockwaves, a marching column of comrades and an Iron Curtain that stops projectiles cold.',
  bio: 'Red from head to toe, with the hammer and sickle stamped across his face. He believes everything should be shared — especially your cursed energy.',
  passive: { name: 'Seize the Means', desc: 'Every hit Communism lands takes 3 cursed energy from the opponent and redistributes it to him.' },
  hp: 1050, speed: 0.98, shoulderW: 15, hipW: 11,
  melee: { weapon: 'sword', weaponName: 'Sickle & Hammer', reach: 18, power: 1.08 },
  look: { skin: '#d4142a', top: '#c4122f', pants: '#a80e24', accent: GOLD, shoe: '#6a0818' },
  aiStyle: { pref: 140 },
  onDealHit(f, t) {
    if (!t.ce || t.def.noCE) return;
    const n = Math.min(3, t.ce); t.ce -= n; f.gainCe(n);
  },
  drawHead(g) {
    const { ctx, sk, col, OL, o } = g, [hx, hy] = sk.head, r = LIMB.headR;
    // ear flap hanging behind the head
    ctx.fillStyle = col('#6a5a4a'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(hx - 9, hy + 4, 6, 11, 0.2, 0, 6.283); ctx.fill(); ctx.stroke();
    headCircle(g, hx, hy, r, '#d4142a');
    if (!o.white && !o.tint) {
      drawHammerSickle(ctx, hx + 5, hy + 4, 0.62, GOLD);
      ctx.fillStyle = '#1a0004'; ctx.fillRect(hx + 7, hy - 4, 2.5, 3); ctx.fillRect(hx + 12, hy - 4, 2.2, 3);
    }
    // wool hat: fur dome with the front flap folded up
    ctx.fillStyle = col('#7a6a58'); ctx.strokeStyle = OL; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(hx, hy - 6, r + 2, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col('#5a4a3a');
    ctx.beginPath(); ctx.roundRect(hx - r - 3, hy - 10, r * 2 + 6, 8, 3); ctx.fill(); ctx.stroke();
    if (!o.white && !o.tint) {
      drawStar(ctx, hx + 6, hy - 15, 5.5, '#e0102a');
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
      for (let i = -12; i <= 12; i += 4) { ctx.beginPath(); ctx.moveTo(hx + i, hy - 20); ctx.lineTo(hx + i + 2, hy - 26 + Math.abs(i) * 0.4); ctx.stroke(); }
    }
  },
  drawTorso(g) {
    const { ctx, sk, col } = g;
    ctx.strokeStyle = col(GOLD); ctx.lineWidth = 2;
    lineTo2(ctx, [sk.sh[0] - 6, sk.sh[1] + 4], [sk.sh[0] * 0.3 - 6, sk.sh[1] * 0.3]);
  },
  // hammer in the left hand (drawn behind the body), sickle in the right
  drawBack(g) { drawHammer(g, g.sk.aB[2], armDir(g.sk.aB) - 0.4); },
  drawWeapon(g) { drawSickle(g, g.sk.aF[2], armDir(g.sk.aF) - 0.3); },
  abilities: [
    {
      name: 'Sickle Reap', icon: '鎌', color: GOLD, cost: 12, cd: 120, ai: { min: 0, max: 160 },
      desc: 'A wide harvesting sweep of the sickle that cuts down anyone in front of him and drags them in close.',
      move: {
        id: 'reap', kind: 'special', startup: 8, active: 5, recovery: 14, lunge: 6, poses: ['slashW', 'slash'], sfx: 'swish',
        hitbox: { x: -10, y: -130, w: 130, h: 120 }, hit: { dmg: 55, kb: -5, stun: 30, fx: 'slash', color: GOLD, hitstop: 6 },
        onFrame(f, fr) { if (fr === 8) FX.arc(f, { color: GOLD, r: 120, a0: 150, a1: -40, w: 10 }); },
      },
    },
    {
      name: 'Hammer Drop', icon: '槌', color: GOLD, cost: 18, cd: 180, ai: { min: 0, max: 700 },
      desc: 'Slams the hammer into the floor, sending a golden shockwave rolling along the ground.',
      move: {
        id: 'hammerdrop', kind: 'special', startup: 16, active: 4, recovery: 18, poses: ['heavyW', 'heavy'],
        hitbox: { x: 10, y: -120, w: 80, h: 120 }, hit: { dmg: 50, kb: 7, kby: -10, launch: true, hitstop: 8, shake: 8, sfx: 'heavy', color: GOLD },
        onFrame(f, fr) {
          if (fr !== 16) return;
          const x = f.x + f.facing * 70;
          FX.shake(8); FX.dust(x, f.y, 12); FX.ring(x, f.y - 6, GOLD, 70, 14, 4); Sound.play('heavy');
          spawnProj(f, {
            x, y: FLOOR - 22, vx: f.facing * 11, r: 24, life: 70, clash: 2,
            hits: { dmg: 40, kb: 4, kby: -11, launch: true, color: GOLD, hitstop: 5, sfx: 'heavy' },
            tick(e) { if (e.age % 3 === 0) FX.debris(e.x, FLOOR, '#a0802a', 2, 6); },
            render(ctx, e) {
              ctx.save(); ctx.globalCompositeOperation = 'lighter';
              ctx.strokeStyle = 'rgba(255,211,77,0.85)'; ctx.lineWidth = 6;
              ctx.beginPath(); ctx.arc(e.x, FLOOR, 30, Math.PI, 0); ctx.stroke();
              ctx.strokeStyle = 'rgba(255,120,60,0.5)'; ctx.lineWidth = 12; ctx.stroke();
              ctx.restore();
            },
          });
        },
      },
    },
    {
      name: 'Workers Unite!', icon: '団', color: '#ff4d5a', cost: 28, cd: 360, ai: { min: 150, max: 1000 },
      desc: 'Calls three comrades who march toward the opponent in a column and smash into them with their hammers.',
      move: {
        id: 'workers', kind: 'special', startup: 18, active: 1, recovery: 16, poses: ['point', 'win'],
        onStart(f) { FX.text(f.x, f.y - 190, 'COMRADES!', '#ff4d5a', 26, 50); },
        onFrame(f, fr) {
          if (fr !== 18) return;
          Sound.play('voice');
          for (let i = 0; i < 3; i++) {
            const x = f.x - f.facing * (20 + i * 50);
            FX.smoke(x, f.y - 30, '#5a0610', 5, 14, 12);
            spawnSummon(f, {
              x, y: FLOOR - 60, vx: f.facing * 5.5, r: 26, life: 150, facing: f.facing, delay: i * 8, clash: 1,
              hits: { dmg: 32, kb: 7, kby: -7, stun: 18, color: '#ff4d5a', hitstop: 4, sfx: 'heavy' },
              tick(e) { if (e.delay > 0) { e.delay--; e.x -= e.vx; } },
              onEnd(e) { FX.smoke(e.x, e.y, '#5a0610', 6, 16, 14); FX.spark(e.x, e.y, GOLD, 6, 4); },
              render(ctx, e) {
                drawStickman(ctx, WORKER, Math.floor(e.age / 6) % 2 ? POSES.walkA : POSES.walkB, e.x, FLOOR, e.facing);
              },
            });
          }
        },
      },
    },
    {
      name: 'Red Square Disco', icon: '赤', color: '#e0102a', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'DOMAIN EXPANSION. The arena becomes a red-lit dance hall under a spinning hammer and sickle, and the music kicks in. A massive swarm of comrades charges in from both sides and tramples the opponent again and again, their cursed energy is steadily redistributed to Communism, and the final "HEY!" knocks them flying.',
      move: {
        id: 'redsquare', kind: 'ult', startup: 60, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) { f.invuln = 70; domainCutscene(f, 'hands', 'RED SQUARE DISCO'); FX.banner('DOMAIN EXPANSION', 'RED SQUARE DISCO', '#e0102a', 130); FX.slow(40, 0.35); Sound.play('charge'); },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 40) return;
          Domains.start(f, {
            type: 'redsquare', life: 420, slowOpp: true, bg: drawRedSquareBg, music: 'moskau',
            tick(d, t) {
              if (d.age % 28 === 0) for (let i = 0; i < 6; i++) FX.add({ type: 'glow', x: U.rand(0, W), y: U.rand(-20, 120), vx: U.rand(-1, 1), vy: U.rand(1, 3), life: 60, size: U.rand(5, 9), color: U.pick(['#ff4d5a', GOLD, '#ffffff']), drag: 0.99 });
              if (!t) return;
              if (t.ce > 0 && !t.def.noCE) { const n = Math.min(0.12, t.ce); t.ce -= n; f.gainCe(n); }
              // a massive swarm of comrades charges in from both edges of the arena
              if (d.age >= 20 && d.age < 360 && d.age % 6 === 0) for (const side of [-1, 1]) comradeCharge(f, side);
            },
            onEnd(d, interrupted) {
              if (interrupted) return;
              FX.flash('#ff4d5a', 0.6); FX.shake(20); Sound.play('boom');
              for (const v of World.enemies(f)) {
                if (v.state === 'ko') continue;
                FX.text(v.x, v.y - 200, 'HEY!', GOLD, 48, 70);
                FX.explosion(v.x, v.midY, 120, ['#ffffff', GOLD, '#e0102a']);
                Combat.hit(f, v, { dmg: 80, kb: 15, kby: -14, launch: true, unblockable: true, sureHit: true, noScale: true, hitstop: 14, shake: 14, sfx: 'boom', color: GOLD, type: 'domain', x: v.x, y: v.midY, dir: dirTo(f, v) });
              }
            },
          });
        },
      },
    },
    {
      name: 'Iron Curtain', icon: '幕', color: '#9aa0b0', cost: 22, cd: 420, ai: { min: 200, max: 900 },
      desc: 'Drops a slab of riveted steel in front of him for 3 seconds. It stops projectiles and shoves back anyone who walks into it.',
      move: {
        id: 'curtain', kind: 'special', startup: 12, active: 1, recovery: 12, poses: ['castW', 'block'],
        onFrame(f, fr) {
          if (fr !== 12) return;
          const x = f.x + f.facing * 70;
          FX.shake(10); FX.dust(x, FLOOR, 14); Sound.play('heavy');
          spawnSummon(f, {
            x, y: FLOOR - 90, r: 80, life: 180, clash: 6, pierce: true, hitEvery: 20, drop: 0, facing: f.facing,
            hits: { dmg: 10, kb: 9, kby: -3, stun: 10, color: '#9aa0b0', hitstop: 2, sfx: 'block' },
            tick(e) { e.drop = Math.min(1, e.drop + 0.12); },
            onEnd(e) { FX.debris(e.x, FLOOR - 60, '#6a707a', 12, 8); FX.smoke(e.x, FLOOR - 40, '#5a5a62', 6, 20, 16); },
            render(ctx, e) {
              const top = FLOOR - 180 * e.drop, a = Math.min(1, (e.life - e.age) / 15);
              ctx.save(); ctx.globalAlpha = a;
              ctx.fillStyle = '#4a5058'; ctx.strokeStyle = '#07070c'; ctx.lineWidth = 3;
              ctx.fillRect(e.x - 16, top, 32, FLOOR - top); ctx.strokeRect(e.x - 16, top, 32, FLOOR - top);
              ctx.fillStyle = '#8a909a';
              for (let y = top + 12; y < FLOOR - 6; y += 22) { ctx.beginPath(); ctx.arc(e.x - 9, y, 2.5, 0, 6.283); ctx.arc(e.x + 9, y, 2.5, 0, 6.283); ctx.fill(); }
              ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(e.x - 14, top + 2, 5, FLOOR - top - 4);
              ctx.restore();
            },
          });
        },
      },
    },
  ],
};

/* ---------------------------------------------------------------- CAPITALISM (original) */

// An AK-47: wooden stock and grip, dark receiver, curved magazine, long barrel with a front sight.
function drawAK47(g, h, ang, firing) {
  const { ctx, col, OL } = g;
  ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(ang);
  ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  // stock
  ctx.fillStyle = col('#8a4a22');
  ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-30, -4); ctx.lineTo(-32, 6); ctx.lineTo(-24, 6); ctx.lineTo(-6, 1); ctx.closePath(); ctx.fill(); ctx.stroke();
  // receiver
  ctx.fillStyle = col('#2a2a30');
  ctx.beginPath(); ctx.rect(-7, -8, 30, 9); ctx.fill(); ctx.stroke();
  // pistol grip
  ctx.fillStyle = col('#8a4a22');
  ctx.beginPath(); ctx.moveTo(-2, 1); ctx.lineTo(4, 1); ctx.lineTo(1, 11); ctx.lineTo(-5, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  // curved banana magazine
  ctx.fillStyle = col('#3a3a42');
  ctx.beginPath(); ctx.moveTo(8, 1); ctx.lineTo(15, 1); ctx.quadraticCurveTo(19, 9, 22, 16); ctx.lineTo(16, 18); ctx.quadraticCurveTo(12, 9, 8, 1); ctx.closePath(); ctx.fill(); ctx.stroke();
  // wooden handguard, gas tube and barrel
  ctx.fillStyle = col('#8a4a22'); ctx.beginPath(); ctx.rect(23, -7, 14, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col('#2a2a30'); ctx.beginPath(); ctx.rect(23, -10, 22, 3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(37, -6, 18, 3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(44, -12, 2, 5); ctx.fill();
  if (firing && !g.o.white && !g.o.tint) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,220,120,0.9)';
    ctx.beginPath(); ctx.moveTo(55, -9); ctx.lineTo(70, -4.5); ctx.lineTo(55, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,140,40,0.6)'; ctx.beginPath(); ctx.arc(58, -4.5, 6, 0, 6.283); ctx.fill();
  }
  ctx.restore();
}

// A whiskey bottle held by the neck; once smashed only the jagged neck is left.
function drawBottle(g, h, ang, broken) {
  const { ctx, col, OL } = g;
  ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(ang);
  ctx.strokeStyle = OL; ctx.lineWidth = 1.5;
  ctx.fillStyle = col('#7a4a1a');
  ctx.beginPath(); ctx.rect(-3, -3, 12, 6); ctx.fill(); ctx.stroke();                 // neck
  if (broken) {
    ctx.beginPath(); ctx.moveTo(9, -5); ctx.lineTo(14, -7); ctx.lineTo(12, -2); ctx.lineTo(17, 0); ctx.lineTo(12, 3); ctx.lineTo(14, 7); ctx.lineTo(9, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(9, -3); ctx.quadraticCurveTo(13, -9, 18, -9); ctx.lineTo(38, -9); ctx.lineTo(38, 9); ctx.lineTo(18, 9); ctx.quadraticCurveTo(13, 9, 9, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (!g.o.white && !g.o.tint) {
      ctx.fillStyle = '#f2e6c8'; ctx.fillRect(21, -6, 11, 12);
      ctx.fillStyle = '#c4122f'; ctx.font = '900 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('XXX', 26.5, 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(19, -8, 18, 2);
    }
  }
  ctx.restore();
}

// One AK-47 round from the muzzle, straight ahead.
function fireBullet(f, dmg, o = {}) {
  const sk = skeleton(f.pose), ang = armDir(sk.aF), h = sk.aF[2], drop = poseDrop(f.pose, sk), s = f.scale;
  const mx = h[0] + Math.cos(ang) * 57 - Math.sin(ang) * -4.5, my = h[1] + Math.sin(ang) * 57 + Math.cos(ang) * -4.5;
  const x = f.x + mx * f.facing * s, y = f.y + (my - drop) * s;
  f.muzzleT = 3;
  Sound.play('gunshot');
  FX.glow(x, y, '#ffd88a', 16, 5);
  FX.add({ type: 'debris', x: f.x + h[0] * f.facing * s, y: y - 4, vx: -f.facing * U.rand(2, 4), vy: U.rand(-5, -3), life: 30, size: 3, color: GOLD, grav: 0.4, rot: 0, vr: 0.4 });
  spawnProj(f, {
    x, y, vx: f.facing * 34, vy: U.rand(-0.5, 0.5), r: 7, life: 40, clash: 1,
    hits: Object.assign({ dmg, kb: 1.2, stun: 10, noScale: true, hitstop: 1, color: '#ffd88a', sfx: 'hit' }, o),
    onEnd(e, why) { if (why === 'hit') FX.spark(e.x, e.y, '#ffd88a', 4, 4); },
    render(ctx, e) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,200,90,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(e.x - Math.sign(e.vx) * 26, e.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 5, 2, 0, 0, 6.283); ctx.fill();
      ctx.restore();
    },
  });
}

// A basic attack that shoots instead of punching: fires `shots` rounds `gap` frames apart.
const gunBasic = (startup, shots, gap, dmg, recovery, last = {}) => ({
  startup, active: 1, recovery: recovery + (shots - 1) * gap, hitbox: null, hit: null, swing: null, lunge: 0, sfx: null, poses: ['point', 'point'],
  getPose: () => POSES.point,
  onFrame(f, fr) {
    const k = (fr - startup) / (gap || 1);
    if (fr >= startup && k === Math.floor(k) && k < shots) fireBullet(f, dmg, k === shots - 1 ? last : {});
  },
});

function drawBill(ctx, x, y, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#8fc47a'; ctx.strokeStyle = '#2a5a2a'; ctx.lineWidth = 1.5;
  ctx.fillRect(-12, -6, 24, 12); ctx.strokeRect(-12, -6, 24, 12);
  ctx.fillStyle = '#2a5a2a'; ctx.font = '900 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 1);
  ctx.restore();
}

// Domain backdrop: a trading floor with a scrolling ticker and a stock chart that only goes up.
function drawBullMarketBg(ctx, d, a) {
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR);
  g.addColorStop(0, '#04140a'); g.addColorStop(1, '#0e2a18');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  // grid
  ctx.strokeStyle = 'rgba(95,214,90,0.12)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, FLOOR); ctx.stroke(); }
  for (let y = 60; y < FLOOR; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // candlesticks climbing to the top right
  const n = Math.min(26, Math.floor(d.age / 8));
  for (let i = 0; i < n; i++) {
    const x = 40 + i * 48, base = FLOOR - 40 - i * 15 + Math.sin(i * 2.1) * 30, h = 20 + (i * 37) % 40, up = i % 5 !== 3;
    ctx.fillStyle = up ? '#3fbf4a' : '#d43a3a';
    ctx.fillRect(x - 1, base - h - 14, 2, h + 28); ctx.fillRect(x - 10, base - h, 20, h);
  }
  // the trend line
  ctx.strokeStyle = '#5fd65a'; ctx.lineWidth = 4; ctx.beginPath();
  for (let i = 0; i < n; i++) ctx.lineTo(40 + i * 48, FLOOR - 60 - i * 15 + Math.sin(i * 2.1) * 30 - 20);
  ctx.stroke();
  // trading floor with a ticker tape running along it
  ctx.fillStyle = '#1e2a22'; ctx.fillRect(-30, FLOOR, W + 60, H - FLOOR + 30);
  ctx.fillStyle = '#000'; ctx.fillRect(-30, FLOOR + 14, W + 60, 40);
  ctx.font = '900 22px "Consolas", monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const tape = 'GOLD ▲ 12.4%   CASH ▲ 9.1%   BRIEF ▲ 33.0%   COIN ▲ 7.7%   OIL ▲ 4.2%   STAR ▼ 18.9%   ', tw = ctx.measureText(tape).width;
  for (let x = -((d.age * 3) % tw); x < W; x += tw) {
    ctx.fillStyle = '#5fd65a'; ctx.fillText(tape, x, FLOOR + 35);
  }
  ctx.fillStyle = 'rgba(255,211,77,0.25)'; ctx.fillRect(-30, FLOOR, W + 60, 3);
  ctx.restore();
}

function dropGoldBar(f, t) {
  spawnProj(f, {
    x: t.x + U.rand(-30, 30), y: -40, vy: 18, r: 26, life: 60, wallKill: false, rot: U.rand(-0.4, 0.4),
    hits: { dmg: 28, kb: 3, kby: -5, stun: 16, unblockable: true, sureHit: true, type: 'domain', hitstop: 4, shake: 4, color: GOLD, sfx: 'cash' },
    tick(e) { if (e.y > FLOOR - 16) e.kill('ground'); },
    onEnd(e) { FX.spark(e.x, e.y, GOLD, 10, 5); FX.dust(e.x, FLOOR, 5); },
    render(ctx, e) {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rot);
      ctx.fillStyle = '#d9a520'; ctx.strokeStyle = '#6a4a08'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-26, 12); ctx.lineTo(26, 12); ctx.lineTo(18, -10); ctx.lineTo(-18, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff3b0'; ctx.fillRect(-14, -7, 20, 3);
      ctx.restore();
    },
  });
}

const CAPITALISM = {
  id: 'capitalism', name: 'Capitalism', short: 'CAPITALISM', title: 'The Tycoon', kanji: '資本', color: '#e8b830',
  style: 'A trigger-happy zoner: every basic attack fires his AK-47, he can hold it on full auto, and he has a whiskey bottle for anyone who gets too close.',
  bio: 'A suited tycoon with the stars and stripes for a face and an old-fashioned top hat on top. Every fight is a negotiation, and he always closes.',
  passive: { name: 'Compound Interest', desc: 'The richer he gets, the richer he gets: Capitalism\'s cursed energy regenerates up to 50% faster the more of it he is holding.' },
  hp: 1000, speed: 1.0, shoulderW: 16, hipW: 11,
  melee: { weapon: 'rifle', weaponName: 'AK-47', reach: 16, power: 1.05 },
  // basic attacks shoot: a single shot, a double tap, then a three-round burst that knocks back
  moveOverrides: {
    basic1: gunBasic(4, 1, 0, 15, 10),
    basic2: gunBasic(4, 2, 4, 10, 10),
    basic3: gunBasic(5, 3, 4, 10, 16, { kb: 7, kby: -4, stun: 20 }),
    air: Object.assign(gunBasic(4, 2, 4, 10, 10), { keepVel: true }),
  },
  look: { skin: '#f0d0b4', top: '#1c2030', pants: '#1c2030', accent: GOLD, shoe: '#0a0a0e' },
  aiStyle: { pref: 260, ranged: true },
  passiveTick(f) {
    if (f.muzzleT > 0) f.muzzleT--;
    if (f.state !== 'ko' && World.active) f.gainCe(0.045 * f.ce / 100);
  },
  drawHead(g) {
    const { ctx, sk, col, OL, o } = g, [hx, hy] = sk.head, r = LIMB.headR;
    if (o.white || o.tint) headCircle(g, hx, hy, r, '#ffffff');
    else {
      // the American flag fills his face
      ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, r, 0, 6.283); ctx.clip();
      for (let i = 0; i < 13; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#c4122f'; ctx.fillRect(hx - r, hy - r + i * (2 * r / 13), 2 * r, 2 * r / 13 + 0.5); }
      ctx.fillStyle = '#1e3a8a'; ctx.fillRect(hx - r, hy - r, r * 1.05, r * 1.08);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(hx - r + 3 + j * 3.6 + (i % 2) * 1.6, hy - r + 3 + i * 3.6, 0.9, 0, 6.283); ctx.fill(); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(hx, hy, r, 0, 6.283); ctx.lineWidth = 3; ctx.strokeStyle = OL; ctx.stroke();
    }
    // tall striped top hat with a starry band
    const by = hy - r + 3;
    ctx.fillStyle = col('#1e3a8a'); ctx.strokeStyle = OL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(hx, by, r + 7, 4, 0, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx - 11, by - 1); ctx.lineTo(hx - 13, by - 34); ctx.lineTo(hx + 13, by - 34); ctx.lineTo(hx + 11, by - 1); ctx.closePath();
    ctx.fillStyle = col('#ffffff'); ctx.fill();
    if (!o.white && !o.tint) {
      ctx.save(); ctx.clip(); ctx.fillStyle = '#c4122f';
      for (let x = -13; x < 13; x += 6.5) ctx.fillRect(hx + x, by - 34, 3.2, 34);
      ctx.fillStyle = '#1e3a8a'; ctx.fillRect(hx - 14, by - 10, 28, 8);
      for (const sx of [-7, 0, 7]) drawStar(ctx, hx + sx, by - 6, 2.6, '#ffffff');
      ctx.restore();
    }
    ctx.lineWidth = 2; ctx.strokeStyle = OL; ctx.stroke();
    ctx.fillStyle = col('#ffffff'); ctx.beginPath(); ctx.ellipse(hx, by - 34, 13, 3, 0, 0, 6.283); ctx.fill(); ctx.stroke();
  },
  drawTorso(g) {
    const { ctx, sk, col, OL } = g, [sx, sy] = sk.sh;
    // white shirt, red tie and lapels on the black suit
    ctx.fillStyle = col('#f4f4f0');
    ctx.beginPath(); ctx.moveTo(sx - 6, sy); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx * 0.6, sy * 0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col('#c4122f'); ctx.strokeStyle = OL; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx - 2, sy + 1); ctx.lineTo(sx + 2, sy + 1); ctx.lineTo(sx * 0.62 + 2, sy * 0.62); ctx.lineTo(sx * 0.58, sy * 0.55); ctx.lineTo(sx * 0.62 - 2, sy * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = col('#3a4058'); ctx.lineWidth = 2;
    lineTo2(ctx, [sx - 7, sy + 1], [sx * 0.6 - 2, sy * 0.6]); lineTo2(ctx, [sx + 7, sy + 1], [sx * 0.6 + 2, sy * 0.6]);
    if (!g.o.white && !g.o.tint) { ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(sx * 0.4 + 2, sy * 0.4, 1.6, 0, 6.283); ctx.arc(sx * 0.25 + 2, sy * 0.25, 1.6, 0, 6.283); ctx.fill(); }
  },
  // always carries the AK-47; for Alcohol Smash it swaps to the off hand while the bottle swings
  drawWeapon(g) {
    const fi = g.o.fighter, bottle = fi && fi.state === 'move' && fi.move && fi.move.id === 'bottle';
    if (bottle) { drawAK47(g, g.sk.aB[2], armDir(g.sk.aB) - 0.8, false); drawBottle(g, g.sk.aF[2], armDir(g.sk.aF), fi.mvars.smashed); }
    else drawAK47(g, g.sk.aF[2], armDir(g.sk.aF), fi && fi.muzzleT > 0);
  },
  abilities: [
    {
      name: 'Full Auto', icon: '銃', color: '#e0b060', cost: 18, cd: 160, ai: { min: 120, max: 1100 },
      desc: 'Flicks the AK-47 to full auto and opens fire. Hold the key to keep shooting (up to about 1.5 seconds); every bullet lands a quick, light hit.',
      move: {
        id: 'ak47', kind: 'special', startup: 8, active: 0, recovery: 0, total: 112, poses: ['point', 'point'],
        // full auto: keeps firing while the ability key is held, with a minimum burst for a quick tap
        getPose: (f, fr) => { const p = poseCopy(POSES.point); if (fr >= 8 && fr < 100) p.aF[1] -= fr % 4 < 2 ? 6 : 0; return p; },
        onFrame(f, fr) {
          const held = f.input && f.input.held && f.input.held['s' + f.mvars.abil];
          if (fr >= 100 || (fr >= 32 && !held)) { if (!f.mvars.done) { f.mvars.done = fr; } if (fr - f.mvars.done >= 10) f.endMove(); return; }
          if (fr >= 8 && fr % 4 === 0) fireBullet(f, 6);
        },
      },
    },
    {
      name: 'Alcohol Smash', icon: '酒', color: '#c08a3a', cost: 15, cd: 170, ai: { min: 0, max: 130 },
      desc: 'Lunges in and smashes a bottle of whiskey over the opponent\'s head, leaving them dizzy for a moment.',
      move: {
        id: 'bottle', kind: 'special', startup: 14, active: 4, recovery: 20, lunge: 8, poses: ['slashW', 'slash'], sfx: 'whoosh',
        hitbox: { x: 0, y: -150, w: 95, h: 80 }, hit: { dmg: 70, kb: 4, kby: -3, stunAdd: 40, hitstop: 12, shake: 9, sfx: 'glass', color: '#c08a3a' },
        onHit(f, t) {
          f.mvars.smashed = true;
          const y = t.y - 135 * t.scale;
          FX.text(t.x, y - 50, 'SMASH!', '#ffd88a', 30, 50);
          FX.debris(t.x, y, '#b0e0c0', 10, 9); FX.debris(t.x, y, '#7a4a1a', 6, 7);
          for (let i = 0; i < 8; i++) FX.add({ type: 'glow', x: t.x + U.rand(-10, 10), y, vx: U.rand(-3, 3), vy: U.rand(-1, 3), life: 30, size: U.rand(4, 7), color: '#e0a040', grav: 0.15, drag: 0.97 });
        },
      },
    },
    {
      name: 'Make It Rain', icon: '札', color: '#8fc47a', cost: 24, cd: 260, ai: { min: 150, max: 1000 },
      desc: 'Tosses a fortune into the air: razor-crisp bills flutter down over the opponent, each one cutting as it lands.',
      move: {
        id: 'makeitrain', kind: 'special', startup: 14, active: 1, recovery: 16, poses: ['castW', 'win'],
        onFrame(f, fr, t) {
          if (fr !== 14) return;
          Sound.play('cash'); FX.text(f.x, f.y - 190, 'MAKE IT RAIN', '#8fc47a', 22, 45);
          const cx = t ? t.x : f.x + f.facing * 300;
          for (let i = 0; i < 9; i++) {
            spawnProj(f, {
              x: cx + U.rand(-110, 110), y: U.rand(-80, -10), vy: U.rand(4, 6), r: 12, life: 140, wallKill: false, ph: Math.random() * 6, rot: 0,
              hits: { dmg: 12, kb: 1, stun: 12, noScale: true, hitstop: 1, fx: 'slash', color: '#8fc47a', sfx: 'slash' },
              tick(e) { e.vx = Math.sin(e.age * 0.12 + e.ph) * 2.5; e.rot = Math.sin(e.age * 0.12 + e.ph) * 0.6; if (e.y > FLOOR - 6) e.kill('ground'); },
              render(ctx, e) { drawBill(ctx, e.x, e.y, e.rot); },
            });
          }
        },
      },
    },
    {
      name: 'Infinite Bull Market', icon: '富', color: '#5fd65a', cost: 100, cd: 1500, ult: true, ai: { min: 0, max: 1280 },
      desc: 'DOMAIN EXPANSION. A trading floor where the chart only goes up. Gold bars rain on the opponent and every one pays Capitalism a 20 HP dividend — then the closing bell rings and the market CRASHES on them.',
      move: {
        id: 'bullmarket', kind: 'ult', startup: 60, active: 0, recovery: 0, poses: ['sign', 'sign'],
        onStart(f) { f.invuln = 70; domainCutscene(f, 'hands', 'INFINITE BULL MARKET'); FX.banner('DOMAIN EXPANSION', 'INFINITE BULL MARKET', '#5fd65a', 130); FX.slow(40, 0.35); Sound.play('charge'); },
        onFrame(f, fr) {
          f.invuln = Math.max(f.invuln, 2);
          if (fr !== 40) return;
          Domains.start(f, {
            type: 'bullmarket', life: 360, slowOpp: true, bg: drawBullMarketBg,
            tick(d, t) {
              if (!t || d.age % 45 !== 20 || d.age > 320) return;
              dropGoldBar(f, t);
              if (f.state !== 'ko') { f.hp = Math.min(f.maxHp, f.hp + 20); FX.text(f.x, f.y - 180, '+20 DIVIDEND', '#5fd65a', 18, 45); }
            },
            onEnd(d, interrupted) {
              if (interrupted) return;
              FX.flash('#d43a3a', 0.6); FX.shake(22); Sound.play('boom');
              FX.banner('CLOSING BELL', 'MARKET CRASH', '#d43a3a', 80);
              for (const v of World.enemies(f)) {
                if (v.state === 'ko') continue;
                FX.explosion(v.x, v.midY, 130, ['#ffffff', '#ff8a8a', '#d43a3a']);
                for (let i = 0; i < 16; i++) FX.add({ type: 'clover', x: v.x, y: v.midY, vx: U.rand(-8, 8), vy: U.rand(-10, 0), life: 70, size: 6, color: '#8fc47a', grav: 0.18, drag: 0.97, rot: Math.random() * 6, vr: U.rand(-0.2, 0.2) });
                Combat.hit(f, v, { dmg: 110, kb: 14, kby: -14, launch: true, unblockable: true, sureHit: true, noScale: true, hitstop: 16, shake: 16, sfx: 'boom', color: '#d43a3a', type: 'domain', x: v.x, y: v.midY, dir: dirTo(f, v) });
              }
            },
          });
        },
      },
    },
    {
      name: 'Hostile Takeover', icon: '買', color: GOLD, cost: 20, cd: 300, ai: { min: 0, max: 160 },
      desc: 'Lunges in waving a fat wad of cash and buys the opponent out: steals 30 of their cursed energy and leaves them stunned.',
      move: {
        id: 'takeover', kind: 'special', startup: 10, active: 6, recovery: 20, lunge: 12, poses: ['castW', 'cast'], sfx: 'dash',
        hitbox: { x: 0, y: -130, w: 80, h: 100 }, hit: { dmg: 35, kb: 2, stunAdd: 45, hitstop: 8, color: GOLD, sfx: 'cash' },
        onHit(f, t) {
          const n = t.def.noCE ? 0 : Math.min(30, t.ce);
          t.ce -= n; f.gainCe(n);
          FX.text(t.x, t.y - 195, 'ACQUIRED', GOLD, 30, 60); FX.spark(t.x, t.midY, GOLD, 12, 6);
        },
      },
    },
  ],
};

/* ---------------------------------------------------------------- roster */

const CHARS = { gojo: GOJO, sukuna: SUKUNA, yuji: YUJI, yuta: YUTA, megumi: MEGUMI, g4: CURSE_G4, g3: CURSE_G3, finger: FINGER_BEARER, hanami: HANAMI, jogo: JOGO, mahito: MAHITO, choso: CHOSO, jin: JIN, ayane: AYANE, bao: BAO, daigo: DAIGO, wraith: WRAITH, lantern: LANTERN, crow: CROW, communism: COMMUNISM, capitalism: CAPITALISM };
const ROSTER = ['yuji', 'gojo', 'sukuna', 'yuta', 'megumi', 'mahito', 'jogo', 'choso', 'jin', 'ayane', 'bao', 'daigo', 'communism', 'capitalism', 'hanami', 'finger', 'g3', 'g4', 'wraith', 'lantern', 'crow'];
const CURSE_IDS = [];

/* ---------------------------------------------------------------- Story Mode */

const STORY = [
  {
    id: 'yuji', title: "Yuji's Awakening", hero: 'yuji', kanji: '覚醒',
    blurb: 'A boy with a monstrous body swallows a cursed finger — and wakes the King of Curses.',
    fights: [
      { enemy: 'g4', diff: 0.12, arena: 'school', text: 'Night at the old school building. Something crawls out of the dark, drawn by the cursed finger in your pocket. You have no technique — just your fists.' },
      { enemy: 'g3', diff: 0.28, arena: 'school', text: 'The finger\'s presence draws stronger curses. A many-eyed spirit blocks the stairwell. Keep your guard up and close the distance.' },
      { enemy: 'finger', diff: 0.42, arena: 'womb', text: 'The Detention Center. A curse that devoured one of Sukuna\'s fingers has grown into a special grade. Its shockwaves cover the floor — jump them.' },
      { enemy: 'sukuna', diff: 0.58, arena: 'womb', boss: true, text: 'Your heart stops. Within your own soul, the King of Curses sits on his throne of bones. Beat him, and the body stays yours.' },
    ],
  },
  {
    id: 'gojo', title: 'The Strongest Sorcerer', hero: 'gojo', kanji: '最強',
    blurb: 'Disaster curses plot to seal the strongest. He has other plans.',
    fights: [
      { enemy: 'hanami', diff: 0.42, arena: 'school', text: 'A disaster curse of the forest has slipped into the school grounds. Roots will burst from beneath you — keep moving and let Infinity handle the rest.' },
      { enemy: 'jogo', diff: 0.52, arena: 'shinjuku', text: 'A volcano-headed curse challenges you to settle who is stronger. Teleport through his fire and remind him.' },
      { enemy: 'mahito', diff: 0.64, arena: 'shibuya', text: 'Shibuya, October 31st. A patchwork curse grins at you from the station concourse. Keep him at a distance — his touch reshapes souls.' },
      { enemy: 'sukuna', diff: 0.82, arena: 'shinjuku', boss: true, text: 'The ruins of Shinjuku. The strongest of today against the strongest in history. Do not hold back.' },
    ],
  },
  {
    id: 'sukuna', title: 'King of Curses', hero: 'sukuna', kanji: '呪いの王',
    blurb: 'Freed at last, the King of Curses goes looking for entertainment.',
    fights: [
      { enemy: 'megumi', diff: 0.4, arena: 'school', text: 'The Ten Shadows boy interests you. Test him — and his shikigami.' },
      { enemy: 'yuji', diff: 0.5, arena: 'shibuya', text: 'Your own vessel rebels against you. Show the brat where he stands.' },
      { enemy: 'yuta', diff: 0.66, arena: 'shinjuku', text: 'A special grade with a Queen of Curses at his back. Rika\'s reach is long — strike before she does.' },
      { enemy: 'gojo', diff: 0.85, arena: 'shinjuku', boss: true, text: 'The one called the strongest. Cut through Infinity and claim the title.' },
    ],
  },
  {
    id: 'yuta', title: 'The Special Grade', hero: 'yuta', kanji: '特級',
    blurb: 'Yuta returns to Japan with Rika — and the curses come running.',
    fights: [
      { enemy: 'g3', diff: 0.35, arena: 'school', text: 'Your first mission back. A nest of curses at the old campus. Use your katana\'s reach.' },
      { enemy: 'finger', diff: 0.45, arena: 'womb', text: 'A finger bearer has taken the detention center. Rika is restless.' },
      { enemy: 'mahito', diff: 0.6, arena: 'shibuya', text: 'The patchwork curse wants to see what your soul looks like. Freeze him with Cursed Speech.' },
      { enemy: 'sukuna', diff: 0.8, arena: 'shinjuku', boss: true, text: 'The King of Curses. Every last drop of Rika\'s love goes into this fight.' },
    ],
  },
  {
    id: 'megumi', title: 'Ten Shadows', hero: 'megumi', kanji: '十種影法術',
    blurb: 'Megumi learns what his shadows can really do — one curse at a time.',
    fights: [
      { enemy: 'g4', diff: 0.3, arena: 'school', text: 'A routine exorcism. Let the Divine Dogs do the hunting.' },
      { enemy: 'g3', diff: 0.4, arena: 'womb', text: 'This one spits from range. Nue strikes from above — use it.' },
      { enemy: 'hanami', diff: 0.55, arena: 'school', text: 'The forest itself attacks. Snare it with the Toad and press in.' },
      { enemy: 'mahito', diff: 0.72, arena: 'shibuya', boss: true, text: 'Shibuya Station. Mahito blocks the way. Flood the arena with shadow and stop him here.' },
    ],
  },
  {
    id: 'choso', title: 'Death Painting', hero: 'choso', kanji: '九相図',
    blurb: 'The eldest of nine cursed brothers walks Shibuya with blood on his hands — and a debt to collect.',
    fights: [
      { enemy: 'g3', diff: 0.35, arena: 'womb', text: 'You and your brothers have woken in a world that sealed you away. A curse gets in your way. Show it what Blood Manipulation can do.' },
      { enemy: 'megumi', diff: 0.48, arena: 'shibuya', text: 'A Ten Shadows sorcerer is hunting your kind through the station. Keep your distance from his shikigami and pierce through them.' },
      { enemy: 'yuji', diff: 0.62, arena: 'shibuya', text: 'The vessel who killed your brothers. Your blood boils — but something about him feels... familiar.' },
      { enemy: 'mahito', diff: 0.8, arena: 'shinjuku', boss: true, text: 'You remember now. You are the older brother, and older brothers protect the younger. Mahito has been toying with your family. End it.' },
    ],
  },
  {
    id: 'jogo', title: 'Disaster of the Earth', hero: 'jogo', kanji: '大地の災い',
    blurb: 'Jogo sets out to prove that cursed spirits are the true humans — and to burn the strongest sorcerer to ash.',
    fights: [
      { enemy: 'megumi', diff: 0.42, arena: 'school', text: 'Jujutsu High. Test your flames on the Ten Shadows boy. Burn his shikigami before they surround you.' },
      { enemy: 'yuji', diff: 0.52, arena: 'shibuya', text: 'Sukuna\'s vessel stands in your way. Keep him at range — he hits far too hard up close.' },
      { enemy: 'yuta', diff: 0.66, arena: 'shinjuku', text: 'A special grade with a curse of his own. Rika\'s reach is long — let the volcano do the work from below.' },
      { enemy: 'gojo', diff: 0.86, arena: 'shinjuku', boss: true, text: 'Satoru Gojo. The one who humiliated you. Open your domain and seal him inside the Coffin of the Iron Mountain.' },
    ],
  },
  {
    id: 'mahito', title: 'Idle Transfiguration', hero: 'mahito', kanji: '無為転変',
    blurb: 'Mahito toys with souls across Japan, chasing the one boy whose soul he can never touch.',
    fights: [
      { enemy: 'g3', diff: 0.32, arena: 'womb', text: 'A lesser curse. Practice reshaping your body — let your arm blade do the talking.' },
      { enemy: 'megumi', diff: 0.46, arena: 'school', text: 'A sorcerer with a shadow full of beasts. Get close enough to touch his soul.' },
      { enemy: 'yuta', diff: 0.62, arena: 'shibuya', text: 'Rika guards this one jealously. Repel her arm and land a Soul Touch on Yuta.' },
      { enemy: 'yuji', diff: 0.82, arena: 'shibuya', boss: true, text: 'Yuji Itadori. The only one who sees your soul. Prove that you are what he will become.' },
    ],
  },
  {
    id: 'jin', title: 'The Unbound', hero: 'jin', kanji: '無縛',
    blurb: 'A man with no cursed energy takes contracts no sorcerer will touch — armed with nothing but a greatsword.',
    fights: [
      { enemy: 'g3', diff: 0.35, arena: 'womb', text: 'Your first contract: clear a nest of curses from the old detention center. They can\'t sense you coming — you have no cursed energy to give you away.' },
      { enemy: 'finger', diff: 0.48, arena: 'womb', text: 'The client lied. Something far bigger lives at the bottom of the building. Keep moving and jump its shockwaves.' },
      { enemy: 'mahito', diff: 0.62, arena: 'shibuya', text: 'A curse that reshapes souls is curious about a man without one worth touching. Keep him at the end of your blade.' },
      { enemy: 'jogo', diff: 0.82, arena: 'shinjuku', boss: true, text: 'The bounty that started it all: a disaster curse of volcanoes. Get through the fire and finish the job.' },
    ],
  },
  {
    id: 'ayane', title: 'The Arbiter', hero: 'ayane', kanji: '裁定',
    blurb: 'A magistrate turned sorcerer opens her own docket: every curse and killer will answer for what they have done.',
    fights: [
      { enemy: 'hanami', diff: 0.4, arena: 'school', text: 'Case one: a forest curse has been feeding on students. Gather your evidence — every blow you take makes the Verdict heavier.' },
      { enemy: 'choso', diff: 0.52, arena: 'shibuya', text: 'Case two: the eldest Death Painting brother left blood all over Shibuya. Close in before his beams pin you down.' },
      { enemy: 'yuta', diff: 0.64, arena: 'court', text: 'Case three: a special grade carrying a Queen of Curses. Answer Rika\'s reach with an Objection.' },
      { enemy: 'sukuna', diff: 0.85, arena: 'court', boss: true, text: 'The final case: the King of Curses himself. Open the Hall of the Scales and hand down the sentence.' },
    ],
  },
  {
    id: 'bao', title: 'The Bamboo Monk', hero: 'bao', kanji: '竹林',
    blurb: 'A gentle panda leaves his mountain monastery when the curses come down from the hills.',
    fights: [
      { enemy: 'g4', diff: 0.3, arena: 'bamboo', text: 'A small curse has been stealing from the monastery kitchen. Unacceptable. Show it the staff.' },
      { enemy: 'hanami', diff: 0.45, arena: 'bamboo', text: 'A forest curse thinks the bamboo groves belong to it. They do not.' },
      { enemy: 'megumi', diff: 0.58, arena: 'bamboo', text: 'A young sorcerer mistakes you for a curse and sends his shikigami. Smash through them — gently.' },
      { enemy: 'jin', diff: 0.8, arena: 'bamboo', boss: true, text: 'A greatsword-wielding mercenary has taken a contract on the "cursed panda." Stand your ground.' },
    ],
  },  {
    id: 'daigo', title: 'The High Roller', hero: 'daigo', kanji: '大博打',
    blurb: 'A gambler who never folds bets everything on one last run of luck through the underground fight circuit.',
    fights: [
      { enemy: 'g3', diff: 0.32, arena: 'casino', text: 'Warm-up round in a back-alley ring. Spin the reels, watch the odds climb, and land that first jackpot.' },
      { enemy: 'bao', diff: 0.46, arena: 'casino', text: 'The house champion is a panda. Of course it is. Keep your distance from the staff and let the cards fly.' },
      { enemy: 'choso', diff: 0.6, arena: 'casino', text: 'A blood sorcerer who doesn\'t believe in luck. Bait out his beams, then go double or nothing.' },
      { enemy: 'ayane', diff: 0.8, arena: 'casino', boss: true, text: 'The Arbiter has ruled your gambling illegal. Beat the verdict — the house always wins, until it doesn\'t.' },
    ],
  },
  {
    id: 'parade', title: 'Night Parade', hero: 'lantern', kanji: '百鬼夜行',
    blurb: 'On the last night of the festival, an old lantern opens its eye and leads the curses through the streets.',
    fights: [
      { enemy: 'g4', diff: 0.32, arena: 'festival', text: 'The festival grounds are quiet. A lesser curse wants to lead the parade instead. Show it who carries the light.' },
      { enemy: 'crow', diff: 0.46, arena: 'festival', text: 'A crow spirit circles the rooftops, stealing the festival\'s luck. Keep your wisps between you and its flock.' },
      { enemy: 'wraith', diff: 0.6, arena: 'womb', text: 'The parade route floods with black bog water. Don\'t get dragged under — stay airborne.' },
      { enemy: 'finger', diff: 0.8, arena: 'shinjuku', boss: true, text: 'Something huge has joined the parade uninvited. Burn it down before it reaches the city.' },
    ],
  },  {
    id: 'communism', title: 'Workers of the World', hero: 'communism', kanji: '革命',
    blurb: 'A red comrade marches on the city to seize the means of cursed energy — and share it with everyone.',
    fights: [
      { enemy: 'g4', diff: 0.3, arena: 'festival', text: 'A lesser curse is hoarding the festival\'s lanterns all to itself. Redistribute them. With the hammer.' },
      { enemy: 'daigo', diff: 0.46, arena: 'casino', text: 'A gambler is running an underground casino on the backs of the workers. Every hit you land takes his cursed energy for the people.' },
      { enemy: 'jin', diff: 0.62, arena: 'bamboo', text: 'A mercenary who sells his sword to the highest bidder. Raise the Iron Curtain against his reach and let the comrades march.' },
      { enemy: 'capitalism', diff: 0.82, arena: 'shinjuku', boss: true, text: 'The Tycoon himself, guarding his fortune at the top of the city. Open Red Square Disco and let the music play.' },
    ],
  },
  {
    id: 'capitalism', title: 'Hostile Takeover', hero: 'capitalism', kanji: '買収',
    blurb: 'A tycoon in a striped top hat sets out to buy the whole jujutsu world, one acquisition at a time.',
    fights: [
      { enemy: 'g3', diff: 0.3, arena: 'shibuya', text: 'A curse is squatting in prime Shibuya real estate. Evict it — hold down the AK-47 and keep your distance.' },
      { enemy: 'bao', diff: 0.46, arena: 'bamboo', text: 'A monastery sits on land you intend to develop. The panda refuses to sell. Make him an offer he can\'t refuse.' },
      { enemy: 'ayane', diff: 0.62, arena: 'court', text: 'The Arbiter has opened an antitrust case against you. Make It Rain on the courtroom, but watch for her Objection.' },
      { enemy: 'communism', diff: 0.82, arena: 'shinjuku', boss: true, text: 'The Red Comrade has come to collectivise everything you own. Ring the bell on the Infinite Bull Market and close the deal.' },
    ],
  },
];
