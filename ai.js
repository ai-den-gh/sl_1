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
      // domain clash mash-off: about 4 presses a second on easy up to 11 on the hardest setting
      if ((c.a === f || c.b === f) && Math.random() < 0.06 + 0.12 * this.level) this.press('clash');
      return;
    }
    if (!o || !World.active || f.state === 'ko' || o.state === 'ko') return;
    const L = this.level, h = this.held;
    const dx = o.x - f.x, dist = Math.abs(dx);
    const toward = dx >= 0 ? 'right' : 'left', away = dx >= 0 ? 'left' : 'right';
    const style = f.def.aiStyle || {};
    // fighters whose basic attack shoots (no melee hitbox) treat it as long range
    const hb = f.moves.basic1.hitbox, reach = hb ? (hb.x + hb.w) * f.scale + 16 : 600;
    const pref = style.ranged ? style.pref : Math.min(style.pref || 80, reach - 8);

    if (f.state === 'move') { this.comboLogic(f, o, L, dist); return; }
    if (!f.isFree()) {
      // being comboed: remember it, so we try to break out the moment we can act again
      if (f.state === 'hit' || f.state === 'stun' || f.state === 'launch') { this.wasHit = true; this.threatT = 0; this.blockT = 0; this.escapeT = Math.round(U.rand(0, 4) * (1.3 - L)); }
      return;
    }

    // ---- combo escape: right after hitstun, block, dodge out or swing back instead of eating the next hit
    if (this.wasHit) {
      if (this.escapeT-- > 0) return;
      this.wasHit = false;
      if (dist < 280 && Math.random() < 0.5 + 0.45 * L) {
        const r = Math.random();
        if (r < 0.4) { this.blockT = U.randInt(18, 30); h.down = true; return; }
        if (r < 0.75) {
          h[away] = true;
          if (f.dashCd <= 0) this.press('dash'); else this.press('up');
          this.retreatT = U.randInt(10, 24);
          return;
        }
        if (r < 0.88 && f.onGround) { h[away] = true; this.press('up'); return; }
        this.press(Math.random() < 0.7 ? 'basic' : 'heavy'); return;
      }
    }

    // ---- hide and seek: a hidden opponent can't be seen, only bumped into
    // (on big maps the CPU only notices you within sight range)
    const big = World.arena && World.arena.width, visible = !o.hidden && (!big || dist < 1000);
    if (visible) { this.seen = { x: o.x, y: o.y }; this.searchT = 0; }
    else if (dist > 60) { this.search(f, o); return; }

    // ---- multi-floor maps: climb up to, or drop down to, the opponent's floor
    if (World.arena && World.arena.width && Math.abs(o.y - f.y) > 100 && dist < 420 && this.changeFloor(f, o.y, o.x)) return;

    // ---- defence: react to incoming attacks after a human-like delay
    const threat = this.detectThreat(f, o, dist);
    this.threatT = threat ? this.threatT + 1 : 0;
    // react once the human-like delay has passed; a sustained threat (a long string of attacks)
    // is reacted to again after a short cooldown instead of being ignored
    if (threat && this.threatT >= Math.round(16 - 12 * L)) {
      this.threatT = -Math.round(U.rand(6, 14) * (1.2 - L));
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

    // ---- enemy shikigami / summons nearby: break them before going back to the opponent
    const sum = this.summonTarget(f, dist, L);
    f.faceTarget = sum;
    if (sum) {
      const b = sum.hurtbox(sum), sx = b.x + b.w / 2, sdx = sx - f.x, sd = Math.abs(sdx) - b.w / 2;
      if (sd > reach - 14) h[sdx >= 0 ? 'right' : 'left'] = true;
      else if (--this.think <= 0) {
        this.think = Math.round(U.rand(5, 14) * (1.45 - L));
        if (b.y + b.h < f.y - 110 && f.onGround) this.press('up');
        else this.press(Math.random() < 0.7 ? 'basic' : 'heavy');
      }
      return;
    }

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

  // Walks to where the opponent was last seen, then pokes around nearby rooms.
  search(f, o) {
    const h = this.held;
    f.faceTarget = null;
    if (!this.seen) this.seen = { x: U.rand(World.left + 100, World.right - 100), y: FLOOR };
    const dx = this.seen.x - f.x;
    if (Math.abs(this.seen.y - f.y) > 100 && Math.abs(dx) < 420 && this.changeFloor(f, this.seen.y, this.seen.x)) return;
    if (Math.abs(dx) > 30) { h[dx > 0 ? 'right' : 'left'] = true; return; }
    // reached the spot: look around for a moment, then try somewhere else close by
    if (++this.searchT < 50) { if (this.searchT % 25 === 0) f.facing = -f.facing; return; }
    this.searchT = 0;
    const floors = [FLOOR, ...World.platforms.filter(p => p.w > 300).map(p => p.y)];
    // an opponent out in the open makes noise: usually head roughly their way. A hidden one gives nothing away.
    if (!o.hidden && Math.random() < 0.6) this.seen = { x: U.clamp(o.x + U.rand(-300, 300), World.left + 60, World.right - 60), y: o.y };
    else this.seen = { x: U.clamp(f.x + U.rand(-700, 700), World.left + 60, World.right - 60), y: U.pick(floors) };
  }

  // Jumps toward a higher floor or drops through the current one. Returns true while busy.
  changeFloor(f, ty, tx) {
    const h = this.held;
    if (ty < f.y - 100) {
      // find the closest platform above us we can jump up onto, near the target
      const above = World.platforms.filter(p => p.y < f.y - 20 && p.y >= ty - 10 && f.y - p.y < 300);
      if (!above.length) return false;
      above.sort((a, b) => Math.abs(a.x + a.w / 2 - tx) - Math.abs(b.x + b.w / 2 - tx));
      const p = above[0], inside = f.x > p.x + 20 && f.x < p.x + p.w - 20;
      if (!inside) {
        const edge = f.x < p.x ? p.x + 40 : p.x + p.w - 40;
        h[edge > f.x ? 'right' : 'left'] = true;
        if (Math.abs(edge - f.x) < 120 && f.onGround) this.press('up');
        return true;
      }
      if (f.onGround) this.press('up');
      else if (f.jumps < 2 && f.vy > -3) this.press('up');
      return true;
    }
    if (ty > f.y + 100 && f.onGround && f.y < FLOOR - 1) {
      h.down = true; this.press('up');
      return true;
    }
    return false;
  }

  // Picks an enemy summon worth attacking (close, reachable, with health), or null.
  // The choice is kept for a short while so the CPU commits instead of flip-flopping.
  summonTarget(f, oppDist, L) {
    const cur = this.sumT;
    if (cur && !cur.dead && cur.hp > 0 && this.sumHold-- > 0) return cur;
    this.sumT = null;
    if (this.sumCheck-- > 0) return null;
    this.sumCheck = 20;
    let best = null, bd = Infinity;
    for (const e of World.entities) {
      if (e.dead || !(e.hp > 0) || !e.hurtbox || !e.owner || e.owner.team === f.team) continue;
      const b = e.hurtbox(e), d = Math.abs(b.x + b.w / 2 - f.x);
      if (b.y + b.h < f.y - 230) continue;                 // out of reach in the air (e.g. Nue)
      const bigThreat = e.maxHp >= 200;                    // Mahoraga, Ox, Serpent, Elephant
      if (d > (bigThreat ? 420 : 260) || (!bigThreat && d > oppDist)) continue;
      if (d < bd) { bd = d; best = e; }
    }
    if (best && Math.random() < 0.35 + 0.55 * L) { this.sumT = best; this.sumHold = 90; return best; }
    return null;
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
