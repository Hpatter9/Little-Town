// A raid's battle drawn over the town's own map (sim/battle.ts lays it out on the land): the trail the raiders come in
// by, the spots the fighters can hold (rings on the ground, lit while placing), shots in flight, spells where they
// land, the fighters' skills on the raiders they struck, and the ring where a spell is being aimed. The people and the
// raiders themselves are drawn where they stand by MapPeople and MapRaiders: the sim walks them there.
//
// Everything the sim gives is in the land's cells; the map's world is in px (CELL each).

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { AIM_RADIUS, type BattleSpot, type BattleView } from '../../shared/sim/battle';
import { CELL } from '../../shared/sim/land';
import type { RaiderView, Snapshot } from '../../shared/sim/snapshot';
import { blastFrame, castFrame, AREA_SIZE, BLAST_SIZE, SPLAT_SIZE, splatFrame } from '../art/effects';
import { actIdOf, actSprite } from '../fight/actLooks';
import { LOOKS } from '../town/spellLooks';
import { SHEETS } from '../town/spellsView';
import type { MapView } from './mapView';

/** Each kind of spot's colour on the ground. */
const SPOT_COLOUR: Record<BattleSpot['kind'], number> = { block: 0xd8603a, wall: 0xc8c0b0, ground: 0x78c060, tower: 0x70a0e0, trap: 0xe0a030 };
/** The trail's band on the ground, and the torchlight along it. */
const TRAIL = 0x3a2414;
const LIGHT = 0xffe0a0;
/** How wide a mage's burst is drawn (cells). */
const MAGE_BURST_DRAWN = 1.3;

export class MapBattle {
  /** Under the people and buildings: the trail and the spots. Over them: shots, casts and bursts. */
  private readonly under = new Graphics();
  private readonly over = new Graphics();
  private readonly fxSprites = new Container();
  private snap: BattleView | null = null;
  private raiders = new Map<number, RaiderView>();
  /** The fighter picked up to place, the spell picked to aim, and where it's being aimed (cells). */
  selectedPerson: number | null = null;
  aiming: string | null = null;
  lastAim: [number, number] | null = null;

  constructor(private readonly map: MapView) {
    map.under.addChild(this.under);
    map.over.addChild(this.over, this.fxSprites);
  }

  get shown(): boolean {
    return this.snap !== null;
  }

  get phase(): BattleView['phase'] | null {
    return this.snap?.phase ?? null;
  }

  update(snap: Snapshot): void {
    this.snap = snap.battle;
    this.raiders = new Map((snap.raid?.raiders ?? []).map((r) => [r.id, r]));
    if (!this.snap) {
      this.under.clear();
      this.over.clear();
      for (const c of this.fxSprites.removeChildren()) c.destroy();
      this.selectedPerson = null;
      this.aiming = null;
      this.lastAim = null;
    }
  }

  /** A screen point to the land's cells (null off the land). */
  toMap(sx: number, sy: number): [number, number] | null {
    const w = this.map.worldOf(sx, sy);
    const x = w.x / CELL;
    const y = w.y / CELL;
    return x >= 0 && y >= 0 && x * CELL <= this.map.width && y * CELL <= this.map.height ? [x, y] : null;
  }

  /** The spot nearest a screen point (within a cell or so), one a fighter can stand on. */
  spotAt(sx: number, sy: number): number | null {
    const at = this.toMap(sx, sy);
    if (!at || !this.snap) return null;
    let best: number | null = null;
    let bestD = 1.1;
    for (const q of this.snap.map.spots) {
      const d = Math.hypot(q.x - at[0], q.y - at[1]);
      if (d < bestD && q.kind !== 'tower' && q.kind !== 'trap') {
        bestD = d;
        best = q.id;
      }
    }
    return best;
  }

  /** Where a spot is on the screen (px), or null (for previews and tests: window.__battle). */
  screenOf(spot: number): [number, number] | null {
    const q = this.snap?.map.spots.find((x) => x.id === spot);
    if (!q) return null;
    const p = this.map.screenOf(q.x * CELL, q.y * CELL);
    return [p.x, p.y];
  }

  /** Where the raider furthest along the trail is (world px), or null: the camera follows it. */
  lead(): { x: number; y: number } | null {
    const b = this.snap;
    if (!b || !b.foes.length) return null;
    const f = b.foes.reduce((a, c) => (c.x > a.x === (this.gateSide() > 0) ? c : a));
    return { x: f.x * CELL, y: f.y * CELL };
  }

  /** Where the raider furthest along is on the screen (px), or null (for previews). */
  leadScreen(): [number, number] | null {
    const l = this.lead();
    if (!l) return null;
    const p = this.map.screenOf(l.x, l.y);
    return [p.x, p.y];
  }

  /** The gate (world px): where the camera looks as a battle begins. */
  gate(): { x: number; y: number } | null {
    const g = this.snap?.map.gate;
    return g ? { x: g[0] * CELL, y: g[1] * CELL } : null;
  }

  /** Which way along x the trail runs toward the gate (+1 eastward). */
  private gateSide(): number {
    const p = this.snap?.map.paths[0];
    return p && p.length > 1 ? Math.sign(p[p.length - 1][0] - p[0][0]) || 1 : 1;
  }

  render(now: number): void {
    const b = this.snap;
    const g = this.under;
    g.clear();
    this.over.clear();
    for (const c of this.fxSprites.removeChildren()) c.destroy();
    if (!b) return;
    const placing = b.phase === 'placing' || b.phase === 'breather';
    const pulse = 0.5 + 0.5 * Math.sin(now / 250);
    // the trails: lit the whole way (the raiders come out of the dark beyond the open land), a worn band along
    // each, a pale line down its middle
    for (const path of b.map.paths) {
      if (path.length < 2) continue;
      for (const [width, alpha] of [[CELL * 2.6, 0.1], [CELL * 1.8, 0.12], [CELL * 1.1, 0.14]] as const) {
        g.moveTo(path[0][0] * CELL, path[0][1] * CELL);
        for (let i = 1; i < path.length; i++) g.lineTo(path[i][0] * CELL, path[i][1] * CELL);
        g.stroke({ width, color: LIGHT, alpha, cap: 'round', join: 'round' });
      }
      g.moveTo(path[0][0] * CELL, path[0][1] * CELL);
      for (let i = 1; i < path.length; i++) g.lineTo(path[i][0] * CELL, path[i][1] * CELL);
      g.stroke({ width: CELL * 0.8, color: TRAIL, alpha: 0.22, cap: 'round', join: 'round' });
      g.moveTo(path[0][0] * CELL, path[0][1] * CELL);
      for (let i = 1; i < path.length; i++) g.lineTo(path[i][0] * CELL, path[i][1] * CELL);
      g.stroke({ width: 2, color: 0xe8d8b0, alpha: 0.35, cap: 'round', join: 'round' });
    }
    // the gate: a ring where the trail ends
    const [gx, gy] = b.map.gate;
    g.circle(gx * CELL, gy * CELL, CELL * 0.55).stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
    // the spots: a ring each, filled where someone holds it, lit while there's someone to place
    const picked = this.selectedPerson !== null ? b.roster.find((r) => r.id === this.selectedPerson) : undefined;
    for (const q of b.map.spots) {
      const x = q.x * CELL;
      const y = q.y * CELL;
      const colour = SPOT_COLOUR[q.kind];
      const unit = b.units.find((u) => u.spot === q.id);
      const suits = picked ? q.kind === 'block' || q.kind === 'wall' || (q.kind === 'ground' && picked.ranged) : false;
      if (q.kind === 'tower') {
        g.poly([x, y - 9, x + 9, y, x, y + 9, x - 9, y]).stroke({ width: 2, color: colour, alpha: 0.8 });
        continue;
      }
      if (q.kind === 'trap') {
        g.moveTo(x - 6, y - 6).lineTo(x + 6, y + 6).moveTo(x + 6, y - 6).lineTo(x - 6, y + 6).stroke({ width: 2, color: colour, alpha: 0.8 });
        continue;
      }
      const r = q.kind === 'wall' ? 10 : 11;
      const lit = placing && (suits || !picked);
      if (q.kind === 'wall') g.rect(x - r, y - r, r * 2, r * 2).fill({ color: colour, alpha: unit ? 0.35 : lit ? 0.1 + 0.1 * pulse : 0.08 });
      else g.circle(x, y, r).fill({ color: colour, alpha: unit ? 0.35 : lit ? 0.1 + 0.12 * pulse : 0.08 });
      if (q.kind === 'wall') g.rect(x - r, y - r, r * 2, r * 2).stroke({ width: unit ? 2.5 : 1.5, color: colour, alpha: lit ? 0.6 + 0.4 * pulse : 0.7 });
      else g.circle(x, y, r).stroke({ width: unit ? 2.5 : 1.5, color: colour, alpha: lit ? 0.6 + 0.4 * pulse : 0.7 });
      // (the picked fighter's own spot, and a raider's blow landing on a spot)
      if (picked && unit?.person === picked.id) g.circle(x, y, r + 4).stroke({ width: 2, color: 0xffffff, alpha: 0.6 + 0.4 * pulse });
    }
    // the aim: a ring where the spell would land
    if (this.aiming && this.lastAim) {
      const [ax, ay] = this.lastAim;
      g.circle(ax * CELL, ay * CELL, AIM_RADIUS * CELL).stroke({ width: 2, color: LOOKS[this.aiming]?.color ?? 0xe0b0ff, alpha: 0.8 });
      g.circle(ax * CELL, ay * CELL, AIM_RADIUS * CELL).fill({ color: LOOKS[this.aiming]?.color ?? 0xe0b0ff, alpha: 0.1 });
    }

    // over everything: shots in flight, and spells where they were cast
    const o = this.over;
    for (const s of b.shots) {
      const t = Math.min(1, (s.age + (now % 100) / 1000) * 4);
      if (t >= 1) continue;
      const ax = s.from[0] * CELL;
      const ay = (s.from[1] - 0.6) * CELL;
      const bx = s.to[0] * CELL;
      const by = (s.to[1] - 0.4) * CELL;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t - Math.sin(t * Math.PI) * (s.kind === 'arrow' ? 10 : 3);
      if (s.kind === 'fire') {
        // a mage's fire: a ball with a tail of sparks, then a burst where it lands
        o.circle(x, y, 3).fill({ color: 0xffb040 }).circle(x, y, 1.5).fill({ color: 0xfff0a0 });
        for (let k = 1; k <= 3; k++) o.circle(ax + (bx - ax) * (t - k * 0.06), ay + (by - ay) * (t - k * 0.06), 2.2 - k * 0.5).fill({ color: 0xff7020, alpha: 0.6 - k * 0.15 });
        continue;
      }
      const ang = Math.atan2(by - ay, bx - ax);
      const len = s.kind === 'arrow' ? 7 : 9;
      o.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len)
        .lineTo(x, y)
        .stroke({ width: s.kind === 'bolt' ? 2 : 1.5, color: s.kind === 'bolt' ? 0x9ae8ff : s.kind === 'tower' ? 0xf0d080 : 0xe8dcc0 });
    }
    for (const s of b.shots) {
      if (s.kind !== 'fire' || s.age < 0.25 || s.age > 0.7) continue;
      const bx = s.to[0] * CELL;
      const by = (s.to[1] - 0.4) * CELL;
      const k = (s.age - 0.25) / 0.45;
      o.circle(bx, by, CELL * MAGE_BURST_DRAWN * (0.3 + 0.7 * k)).fill({ color: 0xff8030, alpha: 0.45 * (1 - k) });
      const tex = blastFrame(k * 12);
      if (tex) this.effect(tex, bx, by, BLAST_SIZE * 0.6);
    }
    for (const c of b.casts) {
      // (each spell in its own colours and effect, as in the town: town/spellLooks.ts)
      const look = LOOKS[c.power];
      const colour = look?.color ?? 0xc080ff;
      const cx = c.x * CELL;
      const cy = c.y * CELL;
      const k = Math.min(1, c.age / 0.6);
      const r = AIM_RADIUS * CELL;
      o.circle(cx, cy, r * (0.4 + 0.6 * k)).fill({ color: colour, alpha: 0.22 * (1 - c.age / 3) });
      o.circle(cx, cy, r * (0.4 + 0.6 * k)).stroke({ width: 2, color: colour, alpha: 0.7 * (1 - c.age / 3) });
      const sheet = look?.sprite ? SHEETS[look.sprite] : null;
      if (sheet) {
        // (played over the ground it struck: in the middle, and either side)
        const at: [number, number][] = [[0, 0], [-0.45, -0.3], [0.45, 0.3]];
        at.forEach(([dx, dy], i) => {
          const f = sheet.frame((c.age - i * 0.12) * sheet.fps);
          if (!f || c.age < i * 0.12) return;
          const size = sheet.size * (sheet.scale ?? 1) * 0.8;
          this.effect(f, cx + dx * r, cy + dy * r - size * 0.3, size, !!sheet.glow);
        });
      } else {
        const tex = castFrame((c.age + (now % 1000) / 1000) * 8);
        if (tex) this.effect(tex, cx, cy, AREA_SIZE, true);
      }
    }
    // the fighters' spells and skills, on the raiders they touched (fight/actLooks.ts: a slash or a spell's effect)
    for (const a of b.acts) {
      const sheet = SHEETS[actSprite(actIdOf(a.name))];
      a.at.forEach((id, i) => {
        const rd = this.raiders.get(id);
        const t = a.age + (now % 100) / 1000 - i * 0.08;
        const f = rd && t >= 0 ? sheet.frame(t * sheet.fps) : null;
        if (!rd || !f) return;
        const size = sheet.size * (sheet.scale ?? 1) * 0.7;
        this.effect(f, rd.x, rd.y - size / 2 + sheet.foot * (sheet.scale ?? 1) * 0.7, size, !!sheet.glow);
      });
    }
    // a hit landing on a fighter (a burst where a raider's blow fell)
    for (const f of b.foes) {
      if (f.hit === null || f.sinceAction > 4) continue;
      const q = b.map.spots.find((s) => s.id === f.hit);
      if (!q) continue;
      const tex = splatFrame(f.sinceAction + 2);
      if (tex) this.effect(tex, q.x * CELL, (q.y - 0.4) * CELL, SPLAT_SIZE * 0.6, false);
    }
  }

  private effect(tex: Texture, cx: number, cy: number, size: number, glow = true): void {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.width = s.height = size;
    s.position.set(cx, cy);
    s.blendMode = glow ? 'add' : 'normal';
    this.fxSprites.addChild(s);
  }
}
