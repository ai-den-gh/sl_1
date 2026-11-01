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
        const fill = e.kind === 'root' ? '#6b4a2b' : e.kind === 'shadow' ? '#0c0a14' : '#9aa5b0';
        const edge = e.kind === 'root' ? '#2a1a0c' : e.kind === 'shadow' ? '#9b6bff' : '#3a4048';
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
function domainCutscene(f, sign, name) { World.cutscene = { f, def: f.def, sign, name, t: 150, max: 150 }; Sound.play('domain'); }

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
      desc: 'A punch whose cursed energy lands a split second later as a second, delayed impact.',
      move: {
        id: 'divergent', kind: 'special', startup: 6, active: 3, recovery: 18, lunge: 8, poses: ['jabW', 'jab'], sfx: 'whoosh',
        hitbox: { x: 4, y: -122, w: 66, h: 36 }, hit: { dmg: 38, kb: 2, stun: 34, fx: 'blue' },
        onHit(f, t) {
          World.later(14, () => {
            if (t.state === 'ko') return;
            FX.ring(t.x, t.midY, '#59a8ff', 80, 18, 5);
            Combat.hit(f, t, { dmg: 52, kb: 11, kby: -5, launch: true, hitstop: 7, shake: 6, fx: 'blue', sfx: 'heavy', sureHit: true, x: t.x, y: t.midY, dir: f.facing });
          });
        },
      },
    },
    {
      name: 'Black Flash', icon: '黒', color: '#ff1f3d', cost: 30, cd: 240, ai: { min: 0, max: 120 },
      desc: 'Press again the instant the fist flashes red to unleash a true Black Flash: 2.5× damage and bonus cursed energy.',
      move: {
        id: 'blackflash', kind: 'special', startup: 16, active: 4, recovery: 22, lunge: 9, poses: ['heavyW', 'heavy'], timing: [8, 13],
        hitbox: { x: 4, y: -126, w: 72, h: 42 },
        onStart(f) { f.mvars.bf = Math.random() < 0.12; },
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
      desc: 'ULTIMATE. Rush in and bury the opponent under a storm of blows, ending in a devastating Black Flash.',
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
              const bf = Math.random() < 0.3;
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
            tick(e, t) {
              const k = e.age;
              if (!e.grab) {
                e.len = k < 12 ? 0 : k < 26 ? (k - 12) / 14 * 380 : Math.max(0, 380 - (k - 26) * 30);
                const tipX = e.x + e.dir * (20 + e.len), tipY = e.y - 34;
                if (k >= 12 && k < 28 && t && t.state !== 'ko' && t.invuln <= 0 && U.circleRect(tipX, tipY, 16, t.hurtbox())) {
                  e.grab = k; Sound.play('grab');
                  Combat.hit(f, t, { dmg: 20, stunAdd: 70, freeze: true, unblockable: true, kb: 0, hitstop: 4, x: tipX, y: tipY, dir: e.dir });
                }
              } else if (t) {
                t.x = U.lerp(t.x, e.x + e.dir * 75, 0.15); t.clampWalls();
                e.len = Math.max(0, Math.abs(t.x - e.x) - 20);
                if (k - e.grab > 24) e.grab = 0, e.len = 0, e.life = Math.min(e.life, e.age + 10);
              }
            },
            onEnd(e) { FX.smoke(e.x, e.y - 20, '#1a1028', 8, 18, 16); },
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
  abilities: [{ name: 'Lunge Bite', icon: '噛', color: '#b06bff', cost: 15, cd: 200, ai: { min: 60, max: 220 }, desc: 'Leaps forward with gnashing teeth.', move: lungeMove({ dmg: 40 }) }, null, null, null],
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
    null, null,
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
    null,
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
    null,
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
  style: 'Reshapes his own body: long-reach blades, spikes, and a soul-warping touch.', bio: 'A curse born from humans\' hatred of one another. He can reshape souls with a touch.',
  passive: { name: 'Soul Reshaping', desc: 'Mahito constantly reshapes his own soul, regenerating health over time. Landing Soul Touch restores 60 more.' },
  passiveTick(f) { if (f.state !== 'ko' && World.active) f.hp = Math.min(f.maxHp, f.hp + 0.07); },
  hp: 1100, speed: 1.05, melee: { power: 1.05, reach: 10 },
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
        hitbox: { x: 0, y: -140, w: 175, h: 90 }, hit: { dmg: 60, kb: 8, kby: -4, stun: 24, fx: 'slash', color: '#8affd2' } },
    },
    {
      name: 'Soul Touch', icon: '魂', color: '#8affd2', cost: 30, cd: 360, ai: { min: 0, max: 110 }, desc: 'Lunges with an open palm. On contact, warps the soul for heavy unblockable damage.',
      move: { id: 'touch', kind: 'special', startup: 14, active: 6, recovery: 24, lunge: 12, poses: ['castW', 'point'],
        hitbox: { x: 0, y: -130, w: 64, h: 70 }, hit: { dmg: 105, unblockable: true, kb: 10, kby: -8, launch: true, fx: 'soul', hitstop: 12, shake: 8, sfx: 'heavy' },
        onHit(f, t) { FX.text(t.x, t.y - 180, 'IDLE TRANSFIGURATION', '#8affd2', 22, 60); f.hp = Math.min(f.maxHp, f.hp + 60); FX.spark(f.x, f.midY, '#8affd2', 10, 5); } },
    },
    {
      name: 'Body Repel', icon: '棘', color: '#9aa5b0', cost: 20, cd: 300, ai: { min: 0, max: 120 }, desc: 'Spikes erupt from his whole body, launching anyone too close.',
      move: { id: 'repel', kind: 'special', startup: 9, active: 1, recovery: 20, poses: ['block', 'sign'],
        onFrame(f, fr) { if (fr === 9) for (const d of [-1, 1]) eruption(f, f.x + d * 50, { y: f.y, delay: 0, dur: 18, w: 90, h: 130, kind: 'spike', sfx: 'slash', shake: 5, hits: { dmg: 55, kb: 10, kby: -10, launch: true, fx: 'slash' } }); } },
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
              Combat.hit(f, t, { dmg: 180, kb: 12, kby: -12, launch: true, unblockable: true, sureHit: true, noScale: true, hitstop: 14, shake: 14, fx: 'soul', type: 'domain', dir: dirTo(f, t) });
            },
          });
        },
      },
    },
  ],
};

/* ---------------------------------------------------------------- roster */

const CHARS = { gojo: GOJO, sukuna: SUKUNA, yuji: YUJI, yuta: YUTA, megumi: MEGUMI, g4: CURSE_G4, g3: CURSE_G3, finger: FINGER_BEARER, hanami: HANAMI, jogo: JOGO, mahito: MAHITO };
const ROSTER = ['yuji', 'gojo', 'sukuna', 'yuta', 'megumi', 'mahito', 'jogo'];
const CURSE_IDS = ['g4', 'g3', 'finger', 'hanami'];

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
];
