'use strict';
/* ==========================================================================
   ai.js — CPU opponent. Produces the same held/pressed interface as a
   keyboard controller, so fighters cannot tell a human from the AI.
   level 0..1 scales reaction time, blocking, dodging, combos and aggression.
   ========================================================================== */

const AI_KEYS = ['left', 'right', 'up', 'down', 'basic', 'heavy', 's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 'clash', 'dash'];

class AIController {
  constructor(level = 0.5) {
    this.level = U.clamp(level, 0, 1);
    this.held = {}; this.pressed = {};
    this.f = null;
    this.think = 0; this.blockT = 0; this.retreatT = 0; this.threatT = 0; this.lastMove = null;
  }
  bind(f) { this.f = f; }
  press(k) { this.pressed[k] = true; }

  update() {
    for (const k of AI_KEYS) { this.pressed[k] = false; this.held[k] = false; }
    const f = this.f, o = f && World.opp(f);
    if (!f) return;
    const c = World.clash;
    if (c) {
      // domain clash wheel: tap when the arrow sits in our zone
      const i = c.a === f ? 0 : c.b === f ? 1 : -1;
      if (i >= 0 && !c.lock[i] && Clash.inArc(c.ang + c.spd, c.arcs[i]) && Math.random() < 0.08 + 0.4 * this.level) this.press('clash');
      return;
    }
    if (!o || !World.active || f.state === 'ko' || o.state === 'ko') return;
    const L = this.level, h = this.held;
    const dx = o.x - f.x, dist = Math.abs(dx);
    const toward = dx >= 0 ? 'right' : 'left', away = dx >= 0 ? 'left' : 'right';
    const style = f.def.aiStyle || {};
    const reach = (f.moves.basic1.hitbox.x + f.moves.basic1.hitbox.w) * f.scale + 16;
    const pref = style.ranged ? style.pref : Math.min(style.pref || 80, reach - 8);

    if (f.state === 'move') { this.comboLogic(f, o, L, dist); return; }
    if (!f.isFree()) return;

    // ---- defence: react to incoming attacks after a human-like delay
    const threat = this.detectThreat(f, o, dist);
    this.threatT = threat ? this.threatT + 1 : 0;
    if (threat && this.threatT === Math.round(16 - 12 * L)) {
      const r = Math.random();
      if (threat.big && r < 0.25 + 0.6 * L) {
        h[Math.random() < 0.5 ? toward : away] = true;
        if (f.dashCd <= 0) this.press('dash'); else this.press('up');
        return;
      }
      if (threat.ult && f.ce >= 100 && Math.random() < L) { const u = this.ultIndex(f); if (u >= 0 && f.canUse(u)) { this.press('s' + u); return; } }
      if (r < 0.15 + 0.55 * L) this.blockT = threat.dur || 22;
      else if (threat.proj && r < 0.25 + 0.6 * L && f.onGround) this.press('up');
    }
    if (this.blockT > 0) { this.blockT--; h.down = true; return; }

    // ---- ultimate
    const u = this.ultIndex(f);
    if (u >= 0 && f.canUse(u) && !World.domain && o.invuln <= 0) {
      const a = f.abilities[u];
      if (dist <= a.ai.max && Math.random() < 0.03 + 0.06 * L) { this.press('s' + u); return; }
    }

    if (this.retreatT > 0) {
      this.retreatT--; h[away] = true;
      if (Math.random() < 0.02) this.press('up');
      return;
    }

    if (--this.think <= 0) {
      this.think = Math.round(U.rand(6, 18) * (1.45 - L));
      const choices = [];
      f.abilities.forEach((a, i) => {
        if (!a || a.ult || !f.canUse(i) || (this.saving(f) && a.cost < 60)) return;
        if (dist >= a.ai.min && dist <= a.ai.max && (!a.ai.when || a.ai.when(f, o))) choices.push(i);
      });
      if (choices.length && Math.random() < 0.16 + 0.28 * L) { this.press('s' + U.pick(choices)); return; }
      if (dist < reach && Math.abs(o.y - f.y) < 100) {
        if (o.state === 'block' && Math.random() < 0.3 * L) { this.retreatT = U.randInt(8, 18); return; }
        if (Math.random() < 0.3 + 0.55 * L) { this.press(Math.random() < 0.72 ? 'basic' : 'heavy'); return; }
        if (Math.random() < 0.15) { this.retreatT = U.randInt(10, 30); return; }
      }
      if (style.ranged && dist < 150 && Math.random() < 0.1 + 0.4 * L) {
        h[away] = true;
        if (f.dashCd <= 0) this.press('dash');
        this.retreatT = 20;
        return;
      }
      if (Math.random() < 0.03) this.press('up');
    }

    // ---- movement toward the preferred range
    if (dist > pref) h[toward] = true;
    else if (style.ranged && dist < pref * 0.5) h[away] = true;
    if (o.y < f.y - 80 && dist < 240 && f.onGround && Math.random() < 0.08) this.press('up');
    if (dist > 480 && f.dashCd <= 0 && !style.ranged && Math.random() < 0.025 * L) { h[toward] = true; this.press('dash'); }
  }

  ultIndex(f) {
    const us = [];
    f.abilities.forEach((a, i) => { if (a && a.ult) us.push(i); });
    if (!us.length) return -1;
    const ok = us.filter(i => f.canUse(i));
    return ok.length ? U.pick(ok) : us[0];
  }
  // Once close to a full bar, hold cursed energy back for the ultimate.
  saving(f) { const u = this.ultIndex(f); return u >= 0 && f.cd[u] <= 0 && f.ce >= 65; }

  comboLogic(f, o, L, dist) {
    const m = f.move;
    // Yuji's Black Flash timing window
    if (m.timing && f.mf === m.timing[0] + 1 && Math.random() < 0.1 + 0.55 * L) this.press('s' + f.mvars.abil);
    if (f.mf !== m.startup + m.active - 1) return;
    if (m.chain && (f.moveHit ? Math.random() < 0.35 + 0.6 * L : Math.random() < 0.25)) { this.press('basic'); return; }
    if (!f.moveHit || (m.kind !== 'basic' && m.kind !== 'heavy')) return;
    // hit-confirm into a special technique
    if (!this.saving(f) && Math.random() < 0.15 + 0.5 * L) {
      const opts = [];
      f.abilities.forEach((a, i) => { if (a && !a.ult && f.canUse(i) && dist <= a.ai.max) opts.push(i); });
      if (opts.length) { this.press('s' + U.pick(opts)); return; }
    }
    if (m.kind === 'basic' && !m.chain && Math.random() < 0.3 + 0.4 * L) this.press('heavy');
  }

  detectThreat(f, o, dist) {
    if (o.state === 'move' && o.move) {
      const m = o.move;
      if (m.kind === 'ult') return { big: true, ult: true, dur: 30 };
      const facingMe = (f.x - o.x) * o.facing > 0;
      if (m.hitbox && facingMe && o.mf < m.startup + m.active) {
        const r = (m.hitbox.x + m.hitbox.w + 30) * o.scale + (m.lunge || 0) * 4;
        if (dist < r) return { melee: true, dur: m.startup + m.active - o.mf + 4 };
      }
    }
    for (const e of World.entities) {
      if (e.owner !== o || !e.hits || e.dead) continue;
      const ddx = f.x - e.x;
      if ((e.vx === 0 || Math.sign(ddx) === Math.sign(e.vx)) && Math.abs(ddx) < 320 && Math.abs(f.midY - e.y) < 140)
        return { proj: true, big: !!e.big, dur: 20 };
    }
    return null;
  }
}
