// Trees fall when felled (the owner's ask: work you can see). When a woodcutter takes the last of a tree's cell, the
// tree as the map drew it tips over (`fall`: slow, then faster, a bounce as it lands), throwing up a puff of leaves and
// dust, and lies a moment before fading; a stump (the Fields pack's) stands on the cell until the wood grows back
// (sim/regrow.ts). Rock broken up for stone shakes, cracks apart in chips and dust, and leaves its rubble (the Fields
// pack's stones) lying `RUBBLE_DAYS`. The falls and chips are off on a slow phone (`calm`); the stumps and rubble stay.

import { Container, Sprite, Texture } from 'pixi.js';
import { CELL, type LandMap } from '../../shared/sim/land';
import type { Building } from '../../shared/sim/state';
import { choresTex, type ChoresArt } from '../art/choresArt';
import { glowTexture } from '../town/layer';
import { hash } from './groundArt';
import { coveredCells, fallWay, rubbleBits, rubbleCells, stumpCells } from './workSeen';

/** Seconds a tree takes to fall, lies on the ground, and fades. */
const FALL_S = 1.1;
const LIE_S = 0.9;
const FADE_S = 1.2;
/** A rock's shake and its crumbling (s). */
const SHAKE_S = 0.25;
const CRUMBLE_S = 0.45;
const STUMP_SCALE = 0.8;
const MOST_FALLING = 8;
const MOTES_MOST = 140;
const LEAF_TINTS = [0x4f8a3a, 0x6aa848, 0x3c6e30, 0x8ab858];
const AUTUMN_TINTS = [0xd09030, 0xc06028, 0xe0b040, 0x9a5a28];

interface Falling {
  s: Sprite;
  kind: 'tree' | 'rock';
  /** In the iso view, the stage it and its leaves, chips and dust are on (see `Stage`). */
  box: Container | null;
  way: 1 | -1;
  age: number;
  x: number;
  y: number;
  landed: boolean;
}

interface Mote {
  s: Sprite;
  vx: number;
  vy: number;
  age: number;
  life: number;
  spin: number;
  floor: number;
  leaf: boolean;
}

/** In the iso view a fall has a stage of its own: a container loose in the sorted things at the foot of the tree, its
 *  pieces moving in screen px about it (the top-down map moves them in world px). */
interface Stage {
  box: Container;
  x: number;
  y: number;
}

export class MapFelling {
  private iso = false;
  private readonly stages = new Set<Container>();
  /** The stage the pieces being made now go on (none: in the top-down map). */
  private at: Stage | null = null;
  private readonly falling: Falling[] = [];
  private readonly motes: Mote[] = [];
  private readonly stumps = new Map<number, Sprite>();
  private readonly rubble = new Map<number, Sprite[]>();
  private key = '';
  /** The season (autumn's leaves fly gold), from MapView. */
  season = 'summer';

  constructor(private things: Container) {
    choresTex(() => (this.key = ''));
  }

  /** Draw in the iso view's `things` instead (each fall on its own stage). */
  useIso(things: Container): void {
    this.things = things;
    this.iso = true;
    this.key = '';
  }

  private stageOf(f: Falling): Stage | null {
    return f.box ? { box: f.box, x: f.x, y: f.y } : null;
  }

  /** A tree or a rock the map drew on a cell just cleared: it falls or breaks where it stood. */
  fall(tex: Texture, fx: number, fy: number, kind: 'tree' | 'rock', cell: number, calm: boolean): void {
    if (calm || this.falling.length >= MOST_FALLING) return;
    let box: Container | null = null;
    if (this.iso) {
      box = this.things.addChild(new Container());
      box.position.set(fx, fy);
      box.zIndex = fy + 0.5;
      this.stages.add(box);
    }
    this.at = box ? { box, x: fx, y: fy } : null;
    const s = (box ?? this.things).addChild(new Sprite(tex));
    s.anchor.set(0.5, 0.95);
    if (box) s.position.set(0, 0);
    else {
      s.position.set(fx, fy);
      s.zIndex = fy + 0.5;
    }
    this.falling.push({ s, kind, box, way: fallWay(cell), age: 0, x: fx, y: fy, landed: false });
    if (kind === 'rock') this.dust(fx, fy - 6, 6, 0xb8b0a0);
  }

  /** The stumps and the rubble on the land now (per snapshot; skipped while the land is as it was). */
  sync(land: LandMap, buildings: Building[]): void {
    const tex = choresTex();
    const key = `${land.version}|${buildings.length}|${!!tex.stump}`;
    if (key === this.key) return;
    this.key = key;
    if (!tex.stump) return;
    const covered = coveredCells(land, buildings);
    const want = new Set(stumpCells(land, covered));
    for (const [i, s] of this.stumps)
      if (!want.has(i)) {
        s.destroy();
        this.stumps.delete(i);
      }
    for (const i of want) {
      if (this.stumps.has(i)) continue;
      const x = i % land.w;
      const y = Math.floor(i / land.w);
      // (where the tree stood: its foot, as MapView placed it; now and then the axe left in it)
      const fx = (x + 0.3 + hash(1, x, y) * 0.4) * CELL;
      const fy = (y + 0.75 + hash(2, x, y) * 0.2) * CELL;
      const axe = hash(12, x, y) < 0.12 && tex.stumpAxe;
      const s = this.things.addChild(new Sprite(axe || tex.stump));
      s.anchor.set(0.5, 0.85);
      s.scale.set(axe ? 1 : STUMP_SCALE);
      s.position.set(Math.round(fx), Math.round(fy));
      s.zIndex = fy;
      this.stumps.set(i, s);
    }
    const stones = new Set(rubbleCells(land, covered));
    for (const [i, list] of this.rubble)
      if (!stones.has(i)) {
        for (const s of list) s.destroy();
        this.rubble.delete(i);
      }
    for (const i of stones) {
      if (this.rubble.has(i)) continue;
      const x = (i % land.w) * CELL;
      const y = Math.floor(i / land.w) * CELL;
      const list: Sprite[] = [];
      for (const b of rubbleBits(i)) {
        const t = tex[`rubble${b.k + 1}` as ChoresArt];
        if (!t) continue;
        const s = this.things.addChild(new Sprite(t));
        s.anchor.set(0.5, 0.8);
        s.position.set(x + b.x, y + b.y);
        s.zIndex = y + b.y;
        list.push(s);
      }
      this.rubble.set(i, list);
    }
  }

  render(dt: number, calm: boolean, wind: number): void {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      this.at = this.stageOf(f);
      f.age += dt;
      if (calm) f.age = 99;
      if (f.kind === 'tree') {
        // (tipping slowly, then faster, as a felled tree does; a little bounce as it lands)
        const k = Math.min(1, f.age / FALL_S);
        let a = k * k * (Math.PI / 2) * 0.96;
        if (f.age > FALL_S) a = (Math.PI / 2) * 0.96 - Math.max(0, Math.sin(((f.age - FALL_S) / 0.25) * Math.PI)) * 0.07 * Math.max(0, 1 - (f.age - FALL_S) / 0.5);
        f.s.rotation = a * f.way;
        if (!f.landed && f.age >= FALL_S) {
          f.landed = true;
          const h = f.s.texture.height * f.s.scale.y;
          this.leaves(f.x + f.way * h * 0.62, f.y - 4, 16);
          this.dust(f.x + f.way * h * 0.4, f.y, 7, 0xc8b898);
        }
        const fade = f.age - FALL_S - LIE_S;
        f.s.alpha = fade > 0 ? Math.max(0, 1 - fade / FADE_S) : 1;
        if (fade >= FADE_S) {
          f.s.destroy();
          this.falling.splice(i, 1);
        }
      } else {
        // (a shake, then it breaks: shrinking into the ground in a burst of chips)
        if (f.age < SHAKE_S) f.s.x = (f.box ? 0 : f.x) + Math.sin(f.age * 90) * 1.5;
        else {
          if (!f.landed) {
            f.landed = true;
            this.chips(f.x, f.y - 6, 10);
            this.dust(f.x, f.y - 4, 8, 0xa8a090);
          }
          const k = (f.age - SHAKE_S) / CRUMBLE_S;
          f.s.scale.set(1 + k * 0.15, Math.max(0, 1 - k));
          f.s.alpha = Math.max(0, 1 - k);
          if (k >= 1) {
            f.s.destroy();
            this.falling.splice(i, 1);
          }
        }
      }
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.age += dt;
      if (m.age >= m.life || calm) {
        m.s.destroy();
        this.motes.splice(i, 1);
        continue;
      }
      const k = m.age / m.life;
      if (m.leaf) {
        // (leaves flutter down on the wind)
        m.vy = Math.min(m.vy + 50 * dt, 14);
        m.vx = m.vx * (1 - dt * 1.5) + wind * 8 * dt + Math.sin(m.age * 6 + m.spin) * 10 * dt;
        m.s.rotation += m.spin * dt;
      } else if (m.floor) {
        // (chips fly up and fall back to the ground)
        m.vy += 160 * dt;
      } else {
        m.vx *= 1 - dt * 2;
        m.vy *= 1 - dt * 2;
        m.s.scale.set(1 + k * 1.6);
      }
      m.s.x += m.vx * dt;
      m.s.y += m.vy * dt;
      if (m.floor && m.s.y > m.floor) {
        m.s.y = m.floor;
        m.vx *= 0.3;
        m.vy = 0;
      }
      m.s.alpha = (m.leaf || m.floor ? 1 : 0.35) * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
    }
    // (a stage with nothing left on it is taken down)
    for (const box of this.stages)
      if (!box.children.length) {
        box.destroy();
        this.stages.delete(box);
      }
  }

  private mote(x: number, y: number, tex: Texture, o: Partial<Mote> & { tint: number; size: number }): void {
    if (this.motes.length >= MOTES_MOST) return;
    const at = this.at;
    const s = (at?.box ?? this.things).addChild(new Sprite(tex));
    s.anchor.set(0.5);
    s.width = s.height = o.size;
    s.tint = o.tint;
    s.position.set(x - (at?.x ?? 0), y - (at?.y ?? 0));
    s.zIndex = y + 40;
    this.motes.push({ s, vx: o.vx ?? 0, vy: o.vy ?? 0, age: 0, life: o.life ?? 1, spin: o.spin ?? 0, floor: o.floor ? o.floor - (at?.y ?? 0) : 0, leaf: o.leaf ?? false });
  }

  private leaves(x: number, y: number, n: number): void {
    const tints = this.season === 'autumn' ? AUTUMN_TINTS : LEAF_TINTS;
    const r = Math.random;
    for (let j = 0; j < n; j++)
      this.mote(x + (r() - 0.5) * 22, y - 10 - r() * 16, Texture.WHITE, { tint: tints[Math.floor(r() * tints.length)], size: r() < 0.5 ? 2 : 3, vx: (r() - 0.5) * 50, vy: -30 - r() * 30, life: 1.4 + r() * 1.2, spin: (r() - 0.5) * 12, leaf: true });
  }

  private chips(x: number, y: number, n: number): void {
    const r = Math.random;
    for (let j = 0; j < n; j++) this.mote(x + (r() - 0.5) * 8, y, Texture.WHITE, { tint: r() < 0.5 ? 0x8a8478 : 0xb8b0a0, size: r() < 0.4 ? 3 : 2, vx: (r() - 0.5) * 70, vy: -50 - r() * 50, life: 0.9 + r() * 0.5, floor: y + 6 + r() * 6 });
  }

  private dust(x: number, y: number, n: number, tint: number): void {
    const r = Math.random;
    for (let j = 0; j < n; j++) this.mote(x + (r() - 0.5) * 16, y - r() * 4, glowTexture(), { tint, size: 7 + r() * 5, vx: (r() - 0.5) * 30, vy: -6 - r() * 10, life: 0.8 + r() * 0.6 });
  }
}
