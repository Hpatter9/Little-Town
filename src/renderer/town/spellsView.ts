// Spells, drawn: the town's powers and rival lords' spells (sim/powers.ts, sim/rivals.ts) each have a look of their
// own, drawn in code over the town: lightning out of the sky, life drawn off in streams, roots bursting from the
// ground, rain, fog, shockwaves, vortices, wards, arrows, thrown flasks, falling rocks, bats, coins, auras, a wave.
// Every cast also rings a magic circle on the ground under the caster and floats the spell's name up. It sits above
// the town's day-and-night tint, so spells glow in the dark.

import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { AREA_SIZE, areaFrame, spellSheetFrame, spellSheetSize, BLAST_SIZE, BLOOD_SIZE, bloodFrame, castFrame, conjureFrame, HOLY_SIZE, holyFrame, portalFrame, shockFrame, SPELL_SIZE, spellFrame } from '../art/effects';
import type { Snapshot, SpellView } from '../../shared/sim/snapshot';
import type { SpellTarget } from '../../shared/sim/state';
import { TICK_MS } from '../../shared/sim/time';
import { WALK_Y } from './townView';
import { BONE, GREEN_DEAD, LOOKS, type Kind, type SpriteFx } from './spellLooks';

/** The top of the sky a spell reaches (fore-local y). */
const SKY = WALK_Y - 125;
/** The magic circle and the name show for this long (seconds). */
const CIRCLE_SECS = 1.3;
const NAME_SECS = 1.9;

/** A repeatable random in [0, 1) for a spell's particle. */
const rand = (n: number, i: number) => {
  const v = Math.sin(n * 12.9898 + i * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

interface Live {
  view: SpellView;
  /** performance.now() when it was cast. */
  start: number;
  /** Where each target (and the caster) is now: followed while the sim still has them. */
  xs: number[];
  byX: number;
  dir: 1 | -1;
  name: Text;
  /** Its sprites from the effect sheets (one per target, or one on the caster). */
  sprites: Sprite[];
}

/** Each effect sheet: a frame at a time (null once it's over), its size, frames a second, and where its foot sits
 *  in the frame (from the bottom). */
const SHEETS: Record<SpriteFx, { frame: (i: number) => Texture | null; size: number; fps: number; foot: number; scale?: number; glow?: boolean }> = {
  blood: { frame: bloodFrame, size: BLOOD_SIZE, fps: 14, foot: 20 },
  vampire: { frame: (i) => spellFrame('vampire', i), size: SPELL_SIZE, fps: 10, foot: 14 },
  undead: { frame: (i) => spellFrame('undead', i), size: SPELL_SIZE, fps: 10, foot: 14 },
  werewolf: { frame: (i) => spellFrame('werewolf', i), size: SPELL_SIZE, fps: 10, foot: 14 },
  heal: { frame: (i) => spellFrame('heal', i), size: SPELL_SIZE, fps: 10, foot: 14 },
  frost: { frame: (i) => spellFrame('frost', i), size: SPELL_SIZE, fps: 6, foot: 14, scale: 1.4 },
  portal: { frame: portalFrame, size: AREA_SIZE, fps: 10, foot: 16 },
  cast: { frame: castFrame, size: SPELL_SIZE, fps: 12, foot: 2 },
  holy: { frame: holyFrame, size: HOLY_SIZE, fps: 12, foot: 4, scale: 1.5 },
  shock: { frame: shockFrame, size: SPELL_SIZE, fps: 12, foot: 20 },
  conjure: { frame: conjureFrame, size: BLAST_SIZE, fps: 16, foot: 6, scale: 1.3 },
  acid: { frame: (i) => areaFrame('acid', i), size: AREA_SIZE, fps: 14, foot: 32 },
  roots: { frame: (i) => spellSheetFrame('roots', i), size: spellSheetSize('roots'), fps: 20, foot: 23 },
  rain: { frame: (i) => spellSheetFrame('rain', i), size: spellSheetSize('rain'), fps: 16, foot: 24 },
  leaves: { frame: (i) => spellSheetFrame('leaves', i), size: spellSheetSize('leaves'), fps: 20, foot: 34 },
  bloom: { frame: (i) => spellSheetFrame('bloom', i), size: spellSheetSize('bloom'), fps: 20, foot: 32 },
  venom_ward: { frame: (i) => spellSheetFrame('venom_ward', i), size: spellSheetSize('venom_ward'), fps: 20, foot: 28 },
  parry: { frame: (i) => spellSheetFrame('parry', i), size: spellSheetSize('parry'), fps: 20, foot: 24 },
  counterfall: { frame: (i) => spellSheetFrame('counterfall', i), size: spellSheetSize('counterfall'), fps: 20, foot: 24 },
  prism: { frame: (i) => spellSheetFrame('prism', i), size: spellSheetSize('prism'), fps: 24, foot: 28, glow: true },
  void: { frame: (i) => spellSheetFrame('void', i), size: spellSheetSize('void'), fps: 18, foot: 28, glow: true },
  moths: { frame: (i) => spellSheetFrame('moths', i), size: spellSheetSize('moths'), fps: 20, foot: 28 },
  suture: { frame: (i) => spellSheetFrame('suture', i), size: spellSheetSize('suture'), fps: 20, foot: 28, glow: true },
  charge: { frame: (i) => spellSheetFrame('charge', i), size: spellSheetSize('charge'), fps: 18, foot: 28, glow: true },
  splash: { frame: (i) => spellSheetFrame('splash', i), size: spellSheetSize('splash'), fps: 18, foot: 26 },
  foam: { frame: (i) => spellSheetFrame('foam', i), size: spellSheetSize('foam'), fps: 16, foot: 24 },
  hourglass: { frame: (i) => spellSheetFrame('hourglass', i), size: spellSheetSize('hourglass'), fps: 18, foot: 28 },
  mercury: { frame: (i) => spellSheetFrame('mercury', i), size: spellSheetSize('mercury'), fps: 18, foot: 28 },
  spines: { frame: (i) => spellSheetFrame('spines', i), size: spellSheetSize('spines'), fps: 20, foot: 21 },
  orchid: { frame: (i) => spellSheetFrame('orchid', i), size: spellSheetSize('orchid'), fps: 20, foot: 18 },
  missile: { frame: (i) => spellSheetFrame('missile', i), size: spellSheetSize('missile'), fps: 18, foot: 28, glow: true },
  // (the Alenia sheets glow, centred on the body)
  blood_bubble: { frame: (i) => spellSheetFrame('blood_bubble', i), size: spellSheetSize('blood_bubble'), fps: 12, foot: 44, glow: true },
  blood_storm: { frame: (i) => spellSheetFrame('blood_storm', i), size: spellSheetSize('blood_storm'), fps: 10, foot: 36, glow: true },
  dark_flames: { frame: (i) => spellSheetFrame('dark_flames', i), size: spellSheetSize('dark_flames'), fps: 12, foot: 44, glow: true },
  gold_vortex: { frame: (i) => spellSheetFrame('gold_vortex', i), size: spellSheetSize('gold_vortex'), fps: 10, foot: 36, glow: true },
  life_fountain: { frame: (i) => spellSheetFrame('life_fountain', i), size: spellSheetSize('life_fountain'), fps: 12, foot: 54, glow: true },
  chaos_storm: { frame: (i) => spellSheetFrame('chaos_storm', i), size: spellSheetSize('chaos_storm'), fps: 10, foot: 36, glow: true },
};

export class SpellsView {
  readonly root = new Container();
  private readonly under = new Graphics();
  private readonly glow = new Graphics();
  private readonly solid = new Graphics();
  private readonly live = new Map<number, Live>();
  private people = new Map<number, number>();
  private raiders = new Map<number, number>();

  constructor() {
    this.glow.blendMode = 'add';
    this.root.addChild(this.under, this.solid, this.glow);
  }

  update(s: Snapshot, now: number): void {
    this.people = new Map(s.people.map((p) => [p.id, p.x]));
    this.raiders = new Map((s.raid?.raiders ?? []).map((r) => [r.id, r.x]));
    for (const sp of s.spells) {
      if (this.live.has(sp.n) || !LOOKS[sp.spell]) continue;
      const colour = LOOKS[sp.spell].color;
      const name = new Text({
        text: sp.name,
        style: { fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 'bold', fill: lighten(colour), stroke: { color: 0x10080c, width: 4 } },
        resolution: 3,
      });
      name.anchor.set(0.5, 1);
      this.root.addChild(name);
      const first = sp.targets[0]?.x ?? sp.x + 60;
      const look = LOOKS[sp.spell];
      const sprites = look.sprite ? Array.from({ length: look.onCaster ? 1 : Math.min(4, Math.max(1, sp.targets.length)) }, () => this.root.addChild(new Sprite())) : [];
      this.live.set(sp.n, { view: sp, start: now - sp.since * TICK_MS, xs: sp.targets.map((t) => t.x), byX: sp.x, dir: first >= sp.x ? 1 : -1, name, sprites });
    }
    // follow the caster and whoever it touched
    for (const l of this.live.values()) {
      l.xs = l.view.targets.map((t, i) => this.whereIs(t) ?? l.xs[i]);
      if (l.view.by) l.byX = this.whereIs(l.view.by) ?? l.byX;
    }
  }

  private whereIs(t: SpellTarget): number | undefined {
    if (t.id === undefined) return t.x;
    return (t.raider ? this.raiders : this.people).get(t.id);
  }

  render(now: number): void {
    for (const g of [this.under, this.glow, this.solid]) g.clear();
    for (const [n, l] of this.live) {
      const t = (now - l.start) / 1000;
      const secs = Math.max(l.view.secs, CIRCLE_SECS, NAME_SECS);
      if (t > secs + 0.3) {
        l.name.destroy();
        for (const s of l.sprites) s.destroy();
        this.live.delete(n);
        continue;
      }
      const look = LOOKS[l.view.spell];
      this.circle(l, t, look.color);
      this.label(l, t);
      this.effect(look.kind, look.color, l, t);
      if (look.sprite) this.sheet(look.sprite, l, t, !!look.onCaster);
      if (look.also) this.effect(look.also, look.alt ?? look.color, l, t);
    }
  }

  /** A sprite from the effect sheets over each target (staggered a little), or over the caster. */
  private sheet(fx: SpriteFx, l: Live, t: number, onCaster: boolean): void {
    const sh = SHEETS[fx];
    const k = sh.scale ?? 1;
    l.sprites.forEach((sp, i) => {
      const x = onCaster ? l.byX : (l.xs[i] ?? l.byX);
      const f = sh.frame((t - i * 0.12) * sh.fps);
      sp.visible = !!f && t - i * 0.12 >= 0;
      if (!f || !sp.visible) return;
      sp.texture = f;
      sp.blendMode = sh.glow ? 'add' : 'normal';
      sp.scale.set(k);
      sp.position.set(Math.round(x - (sh.size * k) / 2), Math.round(WALK_Y + sh.foot * k - sh.size * k));
    });
  }

  /** The magic circle under the caster: two rings and six runes turning. */
  private circle(l: Live, t: number, color: number): void {
    if (t > CIRCLE_SECS) return;
    const a = envelope(t, CIRCLE_SECS, 0.12, 0.4);
    const r = 12 + 6 * clamp01(t * 5);
    const cx = l.byX;
    const cy = WALK_Y + 1;
    this.under.ellipse(cx, cy, r, r * 0.3).stroke({ width: 1.5, color, alpha: a * 0.9 });
    this.under.ellipse(cx, cy, r * 0.65, r * 0.2).stroke({ width: 1, color, alpha: a * 0.7 });
    for (let k = 0; k < 6; k++) {
      const ang = t * 3 + (k * Math.PI) / 3;
      this.glow.rect(cx + Math.cos(ang) * r * 0.83 - 1, cy + Math.sin(ang) * r * 0.25 - 1, 2, 2).fill({ color, alpha: a });
    }
    // and a faint column of light on the caster
    this.glow.rect(cx - 5, cy - 40, 10, 40).fill({ color, alpha: a * 0.12 });
    this.glow.rect(cx - 2, cy - 48, 4, 48).fill({ color, alpha: a * 0.18 });
  }

  private label(l: Live, t: number): void {
    const a = envelope(t, NAME_SECS, 0.15, 0.6);
    l.name.visible = a > 0.01;
    l.name.alpha = a;
    l.name.position.set(Math.round(l.byX), Math.round(WALK_Y - 66 - t * 8));
  }

  private effect(kind: Kind, color: number, l: Live, t: number): void {
    const d = Math.max(0.6, l.view.secs);
    if (t > d) return;
    const a = envelope(t, d, 0.12, Math.min(0.5, d / 3));
    const n = l.view.n;
    const xs = l.xs.length ? l.xs : [l.byX + l.dir * 50];
    const g = this.glow;
    const s = this.solid;
    switch (kind) {
      case 'bolt':
        xs.forEach((x, i) => {
          const tt = t - i * 0.12;
          if (tt < 0 || tt > 0.9) return;
          // a jagged fork out of the sky, flickering, then a scorch of light on the ground
          if (tt < 0.45 && Math.floor(tt * 30) % 3 !== 2) {
            let px = x + (rand(n, i) - 0.5) * 30;
            let py = SKY;
            const pts: [number, number][] = [[px, py]];
            for (let k = 1; k <= 8; k++) {
              px = x + (rand(n + k, i * 9 + Math.floor(tt * 12)) - 0.5) * (18 - k * 2);
              py = SKY + ((WALK_Y - 6 - SKY) * k) / 8;
              pts.push([px, py]);
            }
            for (const [w, al] of [[5, 0.35], [2, 1]] as const) {
              g.moveTo(pts[0][0], pts[0][1]);
              for (const [qx, qy] of pts.slice(1)) g.lineTo(qx, qy);
              g.stroke({ width: w, color: w > 3 ? color : 0xffffff, alpha: al * a });
            }
          }
          g.ellipse(x, WALK_Y, 16 * (1 - tt), 5 * (1 - tt)).fill({ color, alpha: 0.6 * (1 - tt / 0.9) });
        });
        break;
      case 'stream':
        // life drawn out of each target and into the caster, in beads of light along a bowed path
        xs.forEach((x, i) => {
          const x0 = x;
          const y0 = WALK_Y - 18;
          const x1 = l.byX;
          const y1 = WALK_Y - 24;
          const cxm = (x0 + x1) / 2;
          const cym = Math.min(y0, y1) - 28 - rand(n, i) * 20;
          for (let k = 0; k < 12; k++) {
            const u = (t * 1.1 + k / 12 + rand(n, i)) % 1;
            const bx = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cxm + u * u * x1;
            const by = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cym + u * u * y1 + Math.sin(u * 12 + t * 8) * 2;
            g.circle(bx, by, 1.6 + (k % 3 === 0 ? 0.8 : 0)).fill({ color, alpha: a * (0.4 + 0.6 * u) });
          }
          g.circle(x0, y0, 5 + Math.sin(t * 10) * 1.5).fill({ color, alpha: a * 0.35 });
        });
        break;
      case 'roots':
        xs.forEach((x, i) => {
          const grow = clamp01(t * 3);
          for (let k = 0; k < 5; k++) {
            const side = k % 2 ? 1 : -1;
            const base = x + side * (2 + k * 2);
            const len = (16 + rand(n, i * 5 + k) * 14) * grow;
            s.moveTo(base, WALK_Y + 1);
            for (let j = 1; j <= 5; j++) s.lineTo(base + Math.sin(j * 1.3 + k + t * 1.5) * 4 * side, WALK_Y + 1 - (len * j) / 5);
            s.stroke({ width: 2, color: 0x3a2a14, alpha: a });
            s.circle(base + Math.sin(3 + k) * 3 * side, WALK_Y - len * 0.6, 1.5).fill({ color, alpha: a });
            s.circle(base + Math.sin(5 + k + t) * 4 * side, WALK_Y - len, 1.5).fill({ color, alpha: a });
          }
          g.ellipse(x, WALK_Y, 12, 3).fill({ color, alpha: a * 0.25 });
        });
        break;
      case 'rain': {
        const lo = Math.min(l.byX, ...xs) - 60;
        const hi = Math.max(l.byX, ...xs) + 60;
        for (let k = 0; k < 6; k++) {
          const cx = lo + ((hi - lo) * (k + 0.5)) / 6;
          s.ellipse(cx, SKY + 18 + (k % 2) * 5, 28, 9).fill({ color: 0x6a7482, alpha: a * 0.75 });
          s.ellipse(cx + 8, SKY + 13, 18, 7).fill({ color: 0x8a94a2, alpha: a * 0.7 });
        }
        const drops = Math.min(90, Math.round((hi - lo) / 5));
        for (let k = 0; k < drops; k++) {
          const dx = lo + rand(n, k) * (hi - lo);
          const fall = (t * 170 + rand(n + 1, k) * 120) % (WALK_Y - SKY - 20);
          const dy = SKY + 24 + fall;
          g.moveTo(dx, dy).lineTo(dx - 1.5, dy + 6).stroke({ width: 1, color, alpha: a * 0.8 });
        }
        break;
      }
      case 'fog':
        for (let k = 0; k < 9; k++) {
          const fx = l.byX + (rand(n, k) - 0.5) * 520 + Math.sin(t * 0.6 + k) * 24;
          const fy = WALK_Y - 6 - rand(n, k + 20) * 34;
          s.ellipse(fx, fy, 60 + rand(n, k + 40) * 40, 14 + rand(n, k + 60) * 8).fill({ color, alpha: a * 0.3 });
        }
        break;
      case 'ring':
        for (let j = 0; j < 3; j++) {
          const tt = t - j * 0.22;
          if (tt < 0 || tt > 0.9) continue;
          const u = tt / 0.9;
          const r = 12 + u * 170;
          g.ellipse(l.byX, WALK_Y - 10, r, r * 0.32).stroke({ width: 1 + 3 * (1 - u), color, alpha: (1 - u) * a });
        }
        break;
      case 'rise':
        xs.forEach((x, i) => {
          // a pillar of light, and motes (and for the dead, skulls) drifting up out of the ground
          g.rect(x - 7, WALK_Y - 56, 14, 56).fill({ color, alpha: a * 0.14 });
          g.rect(x - 3, WALK_Y - 70, 6, 70).fill({ color, alpha: a * 0.2 });
          for (let k = 0; k < 10; k++) {
            const up = (t * 34 + rand(n, i * 10 + k) * 60) % 60;
            const mx = x + Math.sin(t * 3 + k * 2) * (4 + k % 4);
            g.circle(mx, WALK_Y - up, 1.4).fill({ color, alpha: a * (1 - up / 60) });
          }
          if (color === GREEN_DEAD && t < 1.6) {
            const up = t * 26;
            skull(s, x - 3, WALK_Y - 18 - up, a * (1 - t / 1.6));
          }
          g.ellipse(x, WALK_Y, 14, 4).fill({ color, alpha: a * 0.4 });
        });
        break;
      case 'arrows':
        xs.forEach((x, i) => {
          for (let k = 0; k < 5; k++) {
            const tt = t - i * 0.08 - k * 0.1;
            const fly = 0.7;
            const x0 = l.byX;
            const x1 = x + (rand(n, i * 3 + k) - 0.5) * 16;
            if (tt < 0) continue;
            const u = clamp01(tt / fly);
            const ax = x0 + (x1 - x0) * u;
            const ay = WALK_Y - 20 - Math.sin(u * Math.PI) * 70 + (u > 0.5 ? (u - 0.5) * 24 : 0);
            // along its flight, or stuck in the ground
            const vx = x1 - x0;
            const vy = -Math.cos(u * Math.PI) * 70 * Math.PI + 12;
            const len = Math.hypot(vx, vy) || 1;
            const [ux, uy] = u < 1 ? [vx / len, vy / len] : [Math.sign(vx) * 0.4, 0.9];
            const hx = u < 1 ? ax : x1;
            const hy = u < 1 ? ay : WALK_Y - 1;
            s.moveTo(hx - ux * 12, hy - uy * 12).lineTo(hx, hy).stroke({ width: 2, color: 0x8a6a3a, alpha: a });
            s.moveTo(hx - ux * 12, hy - uy * 12).lineTo(hx - ux * 9, hy - uy * 9).stroke({ width: 3, color, alpha: a }); // fletching
            s.rect(hx - 1.5, hy - 1.5, 3, 3).fill({ color: 0xd0d8e0, alpha: a });
          }
        });
        break;
      case 'lob':
        xs.slice(0, 3).forEach((x, i) => {
          const tt = t - i * 0.15;
          if (tt < 0) return;
          const fly = 0.55;
          if (tt < fly) {
            const u = tt / fly;
            const fx = l.byX + (x - l.byX) * u;
            const fy = WALK_Y - 24 - Math.sin(u * Math.PI) * 60;
            s.rect(fx - 2, fy - 2, 4, 4).fill({ color, alpha: 1 });
            s.rect(fx - 1, fy - 5, 2, 3).fill({ color: 0xc8e0e8, alpha: 1 });
            return;
          }
          // it bursts: a flash, and droplets flung out and falling
          const u = (tt - fly) / 0.9;
          if (u > 1) return;
          g.circle(x, WALK_Y - 10, 6 + u * 22).fill({ color, alpha: (1 - u) * 0.45 });
          for (let k = 0; k < 12; k++) {
            const ang = rand(n, i * 12 + k) * Math.PI;
            const sp = 40 + rand(n + 3, k) * 50;
            const px = x + Math.cos(ang) * sp * u * (k % 2 ? 1 : -1);
            const py = WALK_Y - 10 - Math.sin(ang) * sp * u + 90 * u * u;
            g.rect(px - 1, py - 1, 2, 2).fill({ color, alpha: 1 - u });
          }
        });
        break;
      case 'rocks':
        xs.forEach((x, i) => {
          for (let k = 0; k < 6; k++) {
            const tt = t - k * 0.12 - i * 0.1;
            if (tt < 0) continue;
            const fall = 0.5;
            const rx = x + (rand(n, i * 6 + k) - 0.5) * 30;
            if (tt < fall) {
              const ry = SKY + ((WALK_Y - 4 - SKY) * (tt / fall) ** 2);
              const size = 3 + rand(n + 2, k) * 3;
              s.rect(rx - size / 2, ry - size / 2, size, size * 0.8).fill({ color, alpha: 1 });
              s.rect(rx - size / 2, ry - size / 2, size, 1).fill({ color: 0xffffff, alpha: 0.35 });
            } else {
              const u = clamp01((tt - fall) / 0.7);
              s.ellipse(rx, WALK_Y - 3 - u * 6, 5 + u * 10, 3 + u * 4).fill({ color: 0xc8b898, alpha: (1 - u) * 0.6 });
              s.rect(rx - 2, WALK_Y - 3, 4, 3).fill({ color, alpha: a });
            }
          }
        });
        break;
      case 'vortex':
        xs.forEach((x, i) => {
          for (let k = 0; k < 16; k++) {
            const ang = t * 7 + k * 0.55 + i;
            const r = 3 + k * 1.1;
            const px = x + Math.cos(ang) * r;
            const py = WALK_Y - 14 - k * 1.8 + Math.sin(ang) * r * 0.35;
            g.circle(px, py, k % 4 === 0 ? 1.8 : 1.1).fill({ color, alpha: a * (0.5 + k / 32) });
          }
          g.ellipse(x, WALK_Y - 1, 14, 4).stroke({ width: 1, color, alpha: a * 0.6 });
        });
        break;
      case 'dome':
        xs.forEach((x) => {
          const pulse = 1 + Math.sin(t * 6) * 0.05;
          const grow = clamp01(t * 4);
          g.ellipse(x, WALK_Y - 12, 14 * pulse * grow, 24 * pulse * grow).fill({ color, alpha: a * 0.13 });
          g.ellipse(x, WALK_Y - 12, 14 * pulse * grow, 24 * pulse * grow).stroke({ width: 1.2, color, alpha: a * 0.7 });
          // a glint running round it
          const ang = t * 4 + x;
          g.circle(x + Math.cos(ang) * 14 * pulse, WALK_Y - 12 + Math.sin(ang) * 24 * pulse, 1.5).fill({ color: 0xffffff, alpha: a * 0.8 });
        });
        break;
      case 'sparkle':
        xs.forEach((x, i) => {
          for (let k = 0; k < 7; k++) {
            const up = (t * 22 + rand(n, i * 7 + k) * 40) % 44;
            const sx = x + (rand(n + 5, i * 7 + k) - 0.5) * 22;
            const sy = WALK_Y - 6 - up;
            const tw = 1 + Math.round(Math.abs(Math.sin(t * 9 + k)) * 2);
            const al = a * (1 - up / 44);
            g.rect(sx - tw, sy, tw * 2 + 1, 1).fill({ color, alpha: al });
            g.rect(sx, sy - tw, 1, tw * 2 + 1).fill({ color, alpha: al });
          }
          g.ellipse(x, WALK_Y - 16, 10, 18).fill({ color, alpha: a * 0.1 });
        });
        break;
      case 'bats':
        for (let k = 0; k < 9; k++) {
          const target = xs[k % xs.length];
          const u = clamp01(t / (l.view.secs * 0.8) + rand(n, k) * 0.2 - 0.1);
          const bx = l.byX + (target - l.byX) * u + Math.sin(t * 5 + k) * 14;
          const by = WALK_Y - 40 - Math.sin(u * Math.PI) * 30 + Math.cos(t * 7 + k * 2) * 8;
          const flap = Math.sin(t * 22 + k) > 0 ? 5 : -2;
          s.poly([bx - 8, by - flap, bx - 2, by, bx, by + 3, bx + 2, by, bx + 8, by - flap, bx, by - 2]).fill({ color, alpha: a });
          s.rect(bx - 0.5, by - 0.5, 1, 1).fill({ color: 0xff3040, alpha: a });
        }
        break;
      case 'coins': {
        // flung up from the caster (or the target), glinting as they turn, and falling
        const ox = xs.length && l.view.spell === 'rival:plunder' ? xs[0] : l.byX;
        for (let k = 0; k < 16; k++) {
          const tt = t - k * 0.05;
          if (tt < 0) continue;
          const vx = (rand(n, k) - 0.5) * 70;
          const vy = -(70 + rand(n + 1, k) * 50);
          const px = ox + vx * tt;
          const py = WALK_Y - 18 + vy * tt + 150 * tt * tt;
          if (py > WALK_Y + 2) continue;
          const w = 1 + Math.abs(Math.sin(t * 12 + k)) * 2;
          s.ellipse(px, py, w, 2).fill({ color, alpha: a });
          if (k % 3 === 0) g.rect(px - 0.5, py - 2, 1, 1).fill({ color: 0xffffff, alpha: a });
        }
        break;
      }
      case 'aura':
        xs.forEach((x, i) => {
          for (let k = 0; k < 4; k++) {
            const lick = (t * 2 + k / 4 + rand(n, i + k)) % 1;
            g.ellipse(x + (k - 1.5) * 4, WALK_Y - 8 - lick * 30, 3.5 * (1 - lick), 8 * (1 - lick)).fill({ color, alpha: a * 0.75 * (1 - lick) });
          }
          g.ellipse(x, WALK_Y - 16, 11, 20).stroke({ width: 1.5, color, alpha: a * 0.6 });
          g.ellipse(x, WALK_Y - 16, 11, 20).fill({ color, alpha: a * 0.12 });
        });
        break;
      case 'wave': {
        // a crest rolling across the town, foam on top
        const span = 460;
        const wx = l.byX - (span / 2) * l.dir + l.dir * span * (t / d);
        const pts: number[] = [];
        for (let k = 0; k <= 16; k++) {
          const px = wx - 60 + k * 7.5;
          const h = Math.sin((k / 16) * Math.PI) * 38 * (0.8 + Math.sin(t * 5 + k) * 0.2);
          pts.push(px, WALK_Y + 2 - h);
        }
        s.poly([...pts, wx + 60, WALK_Y + 3, wx - 60, WALK_Y + 3]).fill({ color, alpha: a * 0.8 });
        for (let k = 0; k < pts.length; k += 2) s.rect(pts[k] - 1, pts[k + 1] - 1, 3, 2).fill({ color: 0xe8f8ff, alpha: a });
        break;
      }
    }
  }
}

/** Fade in over `rise`, hold, and fade out over the last `fall` seconds of `total`. */
function envelope(t: number, total: number, rise: number, fall: number): number {
  return clamp01(Math.min(t / rise, (total - t) / fall));
}

function lighten(c: number): number {
  const ch = (sh: number) => Math.min(255, Math.round(((c >> sh) & 255) * 0.6 + 255 * 0.4)) << sh;
  return ch(16) | ch(8) | ch(0);
}

function skull(g: Graphics, x: number, y: number, alpha: number): void {
  g.rect(x, y, 6, 5).fill({ color: BONE, alpha });
  g.rect(x + 1, y + 5, 4, 1).fill({ color: BONE, alpha });
  g.rect(x + 1, y + 2, 1, 1).fill({ color: 0x10301a, alpha });
  g.rect(x + 4, y + 2, 1, 1).fill({ color: 0x10301a, alpha });
}
