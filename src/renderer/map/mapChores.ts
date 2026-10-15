// The everyday chores you can see (the owner's ask): the harvest left in the field (haystacks from the Medieval Field
// Work set standing on a reaped field for `HAY_DAYS`, bales from the Medieval age on, taken in as it's sown again), the
// seed a sower scatters by hand (`sowThrow`: a handful flung out with each swing of the arm), the well's bucket wound
// up while someone draws water there (the Village pack's bucket, swinging on its rope), and washing lines by a few
// homes, the clothes flapping in the wind on fair days (`hasLaundry`, `laundryOut`; no pack has washing, so the clothes
// are plain cloths). In the map's `things`, sorted by their feet; the seed and the flapping are still on a slow phone
// (`calm`) but the seed is thinned out.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { sectionsDone, sectionsOf } from '../../shared/data/crops';
import type { Era } from '../../shared/data/eras';
import { footprint } from '../../shared/sim/buildings';
import { CELL } from '../../shared/sim/land';
import type { PersonView } from '../../shared/sim/snapshot';
import type { Building } from '../../shared/sim/state';
import { choresTex } from '../art/choresArt';
import { coveredCells, hasLaundry, hayStacks, laundryOut, laundryPieces, sowThrow } from './workSeen';

const SEEDS_MOST = 90;
/** How near (px) to a well someone drawing water must stand for its bucket to rise. */
const WELL_NEAR = 1.6 * CELL;

interface Seed {
  s: Sprite;
  vx: number;
  vy: number;
  floor: number;
  age: number;
}

interface Line {
  box: Container;
  pieces: Sprite[];
  id: number;
}

export class MapChores {
  private readonly hay = new Map<number, { key: string; sprites: Sprite[] }>();
  private readonly seeds: Seed[] = [];
  private readonly throwing = new Map<number, boolean>();
  private sowers: PersonView[] = [];
  private readonly buckets = new Map<number, { s: Sprite; rope: Graphics; x: number; top: number }>();
  private drawers: { well: number; x: number; top: number }[] = [];
  private readonly lines = new Map<number, Line>();

  constructor(private readonly things: Container) {
    choresTex(() => {
      for (const h of this.hay.values()) h.key = '';
    });
  }

  /** The fields, the wells, the homes and who's at what (per snapshot). */
  sync(o: { buildings: Building[]; people: PersonView[]; tick: number; era: Era; weather: string; season: string; daylight: number; landW: number }): void {
    const tex = choresTex();
    // the harvest left in the field
    const seen = new Set<number>();
    for (const b of o.buildings) {
      if (!b.crop || b.status !== 'done' || !tex.hayHeap) continue;
      const f = footprint(b);
      const sown = b.crop.work > 0 ? sectionsDone(b.crop.work, f.w) / sectionsOf(f.w) : 0;
      const stacks = hayStacks(b, o.tick, sown);
      if (!stacks.length) continue;
      seen.add(b.id);
      const bale = o.era !== 'neolithic';
      const key = `${stacks.length}|${bale}|${f.x},${f.y}`;
      let h = this.hay.get(b.id);
      if (h && h.key === key) continue;
      if (h) for (const s of h.sprites) s.destroy();
      h = { key, sprites: [] };
      this.hay.set(b.id, h);
      for (const st of stacks) {
        const s = this.things.addChild(new Sprite(bale ? tex.hayBale : tex.hayHeap));
        s.anchor.set(0.5, 0.9);
        s.scale.set((st.x + b.id) % 2 ? -1 : 1, 1);
        s.position.set(f.x * CELL + st.x, f.y * CELL + st.y);
        s.zIndex = f.y * CELL + st.y;
        h.sprites.push(s);
      }
    }
    for (const [id, h] of this.hay)
      if (!seen.has(id)) {
        for (const s of h.sprites) s.destroy();
        this.hay.delete(id);
      }
    // sowers, by hand
    this.sowers = o.people.filter((p) => p.activity === 'till' && !p.indoors && p.away === null);
    // the wells being drawn from
    const wells = o.buildings.filter((b) => b.def === 'well' && b.status === 'done');
    this.drawers = [];
    for (const p of o.people) {
      if (p.activity !== 'draw' || p.indoors) continue;
      const w = wells.find((b) => {
        const f = footprint(b);
        return Math.abs((f.x + f.w / 2) * CELL - p.x) < WELL_NEAR && Math.abs((f.y + f.h) * CELL - p.y) < WELL_NEAR;
      });
      if (w && !this.drawers.some((d) => d.well === w.id)) {
        const f = footprint(w);
        this.drawers.push({ well: w.id, x: (f.x + f.w / 2) * CELL, top: (f.y + f.h) * CELL - 24 });
      }
    }
    for (const [id, b] of this.buckets)
      if (!this.drawers.some((d) => d.well === id)) {
        b.s.destroy();
        b.rope.destroy();
        this.buckets.delete(id);
      }
    if (tex.bucket)
      for (const d of this.drawers) {
        if (this.buckets.has(d.well)) continue;
        const rope = this.things.addChild(new Graphics());
        const s = this.things.addChild(new Sprite(tex.bucket));
        s.anchor.set(0.5, 0);
        s.scale.set(0.7);
        this.buckets.set(d.well, { s, rope, x: d.x, top: d.top });
      }
    // the washing out by the homes
    const out = laundryOut(o.weather, o.season, o.daylight);
    const covered = out ? coveredCells({ w: o.landW }, o.buildings) : null;
    const want = new Set<number>();
    if (covered)
      for (const b of o.buildings) {
        if (!hasLaundry(b)) continue;
        const f = footprint(b);
        // (strung beside the home, the side with nothing built on it)
        const row = f.y + f.h - 1;
        const right = !covered.has(row * o.landW + f.x + f.w);
        const left = !covered.has(row * o.landW + f.x - 1);
        if (!right && !left) continue;
        want.add(b.id);
        if (this.lines.has(b.id)) continue;
        this.lines.set(b.id, this.line(b.id, right ? (f.x + f.w) * CELL + 6 : f.x * CELL - 30, (f.y + f.h) * CELL - 16));
      }
    for (const [id, l] of this.lines)
      if (!want.has(id)) {
        l.box.destroy({ children: true });
        this.lines.delete(id);
      }
  }

  private line(id: number, x: number, y: number): Line {
    const box = this.things.addChild(new Container());
    box.position.set(Math.round(x), Math.round(y));
    box.zIndex = y;
    const g = box.addChild(new Graphics());
    // two posts and the line sagging between them
    g.rect(0, -16, 2, 16).fill(0x6a4a2e).rect(22, -16, 2, 16).fill(0x6a4a2e);
    g.moveTo(1, -15).quadraticCurveTo(12, -12, 23, -15).stroke({ color: 0xe8e0d0, width: 1 });
    const pieces: Sprite[] = [];
    let at = 3;
    for (const p of laundryPieces(id)) {
      if (at + p.w > 22) break;
      const s = box.addChild(new Sprite(Texture.WHITE));
      s.tint = p.colour;
      s.width = p.w;
      s.height = p.h;
      s.anchor.set(0.5, 0);
      const sag = Math.sin(((at + p.w / 2) / 22) * Math.PI) * 3;
      s.position.set(at + p.w / 2, -15 + sag);
      pieces.push(s);
      at += p.w + 1;
    }
    return { box, pieces, id };
  }

  render(dt: number, now: number, calm: boolean, wind: number): void {
    // a handful of seed flung out with each swing of the arm
    for (const p of this.sowers) {
      const on = sowThrow(now, p.id);
      if (on && !this.throwing.get(p.id)) {
        const r = Math.random;
        const n = calm ? 2 : 6;
        for (let j = 0; j < n && this.seeds.length < SEEDS_MOST; j++) {
          const s = this.things.addChild(new Sprite(Texture.WHITE));
          s.tint = r() < 0.5 ? 0xe8d8a0 : 0xc8b070;
          s.width = s.height = 1;
          s.anchor.set(0.5);
          s.position.set(p.x + p.dir * 6, p.y - 20);
          s.zIndex = p.y + 1;
          this.seeds.push({ s, vx: p.dir * (20 + r() * 30) + (r() - 0.5) * 16, vy: -20 - r() * 20, floor: p.y + 2 + (r() - 0.5) * 10, age: 0 });
        }
      }
      this.throwing.set(p.id, on);
    }
    for (let i = this.seeds.length - 1; i >= 0; i--) {
      const sd = this.seeds[i];
      sd.age += dt;
      if (sd.s.y < sd.floor) {
        sd.vy += 140 * dt;
        sd.s.x += sd.vx * dt;
        sd.s.y += sd.vy * dt;
      } else sd.s.alpha = Math.max(0, 1 - (sd.age - 0.4) / 0.4);
      if (sd.age > 0.8 && sd.s.alpha <= 0) {
        sd.s.destroy();
        this.seeds.splice(i, 1);
      }
    }
    // the bucket wound up the well and lowered again, swinging on its rope
    for (const [id, b] of this.buckets) {
      const k = (Math.sin(now / 900 + id) + 1) / 2;
      const y = b.top + k * 10;
      const sway = calm ? 0 : Math.sin(now / 260 + id) * 1.2;
      b.s.position.set(Math.round(b.x + sway), Math.round(y));
      b.s.zIndex = b.top + 31;
      b.rope.clear().moveTo(b.x, b.top - 6).lineTo(b.x + sway, y + 1).stroke({ color: 0x8a6a48, width: 1 });
      b.rope.zIndex = b.top + 30.9;
    }
    // the washing flapping in the wind
    const gust = 0.25 + Math.abs(wind) * 0.6;
    for (const l of this.lines.values())
      l.pieces.forEach((s, j) => {
        const flap = calm ? 0.1 : Math.sin(now / (180 + j * 37) + l.id + j) * gust * 0.5 + gust * 0.3;
        s.skew.x = flap * (wind < 0 ? -1 : 1);
      });
  }
}
