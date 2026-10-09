// The town's small creatures (the owner's ask: bees, dragonflies, bats, moths, crows and rats): a hive by every herb
// garden and orchard (a straw skep, a box hive from the Industrial age) with its bees working round it, and a few more
// over the flowers in spring and summer; dragonflies darting and hovering over the water on summer days; bats pouring
// out at dusk and flitting over the roofs; moths round the street lamps and the fire at night; crows down on the
// ripening fields, pecking, put up by anyone passing, and a scarecrow on most crop fields that keeps all but one off
// and flaps the bold one away now and then; rats about the stores as they fill (more with a full granary, a swarm in
// the rats' plague), who bolt from feet and from the town's cats, which chase them (map/mapPets.ts). The creatures are
// DawnLike's (art/critters.png, by tools/compose-critters.cjs; the crows are the birds' atlas's), the box hive the
// Fields pack's crate, the scarecrow put together from the Himeko layers (art/scarecrow.png). When they come out is in
// critterRules.ts. Renderer only: nothing of this is in the sim. The hives and scarecrows stand on a slow phone; the
// creatures don't.

import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { biomeById } from '../../shared/data/biomes';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { CROPS } from '../../shared/data/crops';
import { footprint } from '../../shared/sim/buildings';
import { CELL, groundAt, type Ground, type LandMap } from '../../shared/sim/land';
import type { Snapshot } from '../../shared/sim/snapshot';
import birdsUrl from '../art/birds.png';
import crittersUrl from '../art/critters.png';
import { HK_FIGURE } from '../art/hkFolk';
import { loadImage } from '../art/loadImage';
import scarecrowUrl from '../art/scarecrow.png';
import { glowTexture } from '../town/layer';
import {
  batsOut,
  BATS_MOST,
  beesOut,
  BEES_PER_HIVE,
  BEES_WILD,
  BEE_PLOTS,
  crowsFor,
  dragonfliesOut,
  DRAGONFLIES_MOST,
  hasScarecrow,
  hiveKind,
  mothsOut,
  MOTHS_MOST,
  MOTHS_PER_LIGHT,
  ratCount,
  ratPlague,
  SCARE_EVERY,
  tempting,
} from './critterRules';
import { visibility } from './groundArt';
import type { MapView } from './mapView';

/** The atlas's columns (tools/compose-critters.cjs), each two 16px frames down. */
const CRITTER = { bee: 0, dragonfly: 1, moth: 2, bat: 3, rat: 4, rat2: 5, box: 6, skep: 7 } as const;
const SIZE = 16;
/** The crow's column in the birds' atlas (map/mapBirds.ts). */
const CROW_COL = 4;
/** The scarecrow stands as tall as a townsperson (mapPeople's HK_K). */
const SCARECROW_K = 48 / HK_FIGURE;
/** How near someone comes (px) before a crow is off, and before a rat bolts; how near a cat (px) before a rat runs. */
const CROW_SHY = 46;
const RAT_SHY = 30;
const CAT_FEAR = 90;
/** The scarecrow's reach (px): a crow that comes down within it may be flapped away. */
const SCARE_REACH = 70;
const FLOWERY = new Set<Ground>(['grass', 'fertile', 'hill']);
const WATERY = new Set<Ground>(['water', 'shallows']);
const WIND: Record<string, number> = { clear: 0.3, cloudy: 0.6, rain: 0.9, storm: 1.6, snow: 0.7, fog: 0.1 };

type Frames = Texture[][];
let frames: Frames | null = null;
let crow: Texture[] | null = null;
let scarecrow: Texture | null = null;
let loading = false;
function loadArt(): void {
  if (loading) return;
  loading = true;
  const cut = (im: CanvasImageSource, cols: number[]) => {
    const source = Texture.from(im).source;
    source.scaleMode = 'nearest';
    return cols.map((c) => [0, 1].map((f) => new Texture({ source, frame: new Rectangle(c * SIZE, f * SIZE, SIZE, SIZE) })));
  };
  loadImage(crittersUrl).then((im) => (frames = cut(im, [0, 1, 2, 3, 4, 5, 6, 7])), () => {});
  loadImage(birdsUrl).then((im) => (crow = cut(im, [CROW_COL])[0]), () => {});
  loadImage(scarecrowUrl).then(
    (im) => {
      scarecrow = Texture.from(im);
      scarecrow.source.scaleMode = 'nearest';
    },
    () => {},
  );
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Flier {
  s: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  phase: number;
  /** Till it turns (a bat, a dragonfly's hover), and how long it has left. */
  turn: number;
  life: number;
  /** A bee's or moth's home point (its hive, its lamp); a dragonfly's dart target. */
  home: { x: number; y: number };
  key: string;
}
interface Crow {
  s: Sprite;
  sh: Sprite;
  field: number;
  x: number;
  y: number;
  h: number;
  state: 'landing' | 'ground' | 'flying';
  vx: number;
  vy: number;
  hop: number;
  wing: number;
}
interface Rat {
  id: number;
  s: Sprite;
  sh: Sprite;
  kind: number;
  store: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number;
  fleeing: boolean;
  step: number;
  alpha: number;
}
interface Field {
  id: number;
  r: Rect;
  want: number;
  scare: { x: number; y: number } | null;
}

export class MapCritters {
  private readonly hives = new Map<number, Sprite>();
  private readonly scarecrows = new Map<number, { s: Sprite; x: number; y: number; flap: number; next: number }>();
  private readonly bees = new Map<string, Flier>();
  private readonly flies: Flier[] = [];
  private readonly bats: Flier[] = [];
  private readonly moths = new Map<string, Flier>();
  private readonly crows: Crow[] = [];
  private readonly rats: Rat[] = [];
  private fields: Field[] = [];
  private stores: Rect[] = [];
  private lamps: { x: number; y: number }[] = [];
  private land: LandMap | null = null;
  private sky = { season: 'summer', weather: 'clear', daylight: 1, hour: 12, dayOfSeason: 1, cold: false };
  private ratsWanted = 0;
  private nextRat = 1;
  private nextFlyAt = 0;
  private nextCrow = 0;
  private wild = 0;
  /** Everyone about (world px), and the town's cats (map/mapPets.ts). */
  folk: { x: number; y: number }[] = [];
  cats: { x: number; y: number }[] = [];

  constructor(
    private readonly things: Container,
    private readonly over: Container,
    private readonly map: MapView,
  ) {
    loadArt();
  }

  /** The rats about now, for the cats to chase (map/mapPets.ts's `prey`). */
  prey(): { id: number; x: number; y: number }[] {
    return this.rats.filter((r) => !r.fleeing || r.alpha > 0.5).map((r) => ({ id: r.id, x: r.x, y: r.y }));
  }

  /** A cat has caught a rat. */
  caught(id: number): void {
    const i = this.rats.findIndex((r) => r.id === id);
    if (i < 0) return;
    this.rats[i].s.destroy();
    this.rats[i].sh.destroy();
    this.rats.splice(i, 1);
  }

  /** Each snapshot: the season and the hour, the hives and scarecrows by the plots standing, the fields the crows want,
   *  the stores and the rats they draw, and the lamps lit (map/streetLamps.ts) with the camp's fire. */
  sync(next: Snapshot, lamps: { x: number; y: number }[]): void {
    const c = next.calendar;
    const cold = !!biomeById(next.biome).cold;
    this.land = next.land;
    this.sky = { season: c.season, weather: next.weather.kind, daylight: c.daylight, hour: c.hour, dayOfSeason: c.dayOfSeason, cold };
    this.lamps = [{ x: (next.land.camp.x + 0.5) * CELL, y: (next.land.camp.y + 0.3) * CELL }, ...lamps];
    const seen = new Set<number>();
    const seenScare = new Set<number>();
    const fields: Field[] = [];
    const stores: Rect[] = [];
    let granary = false;
    const hive = hiveKind(next.era);
    for (const b of next.buildings) {
      if (b.status !== 'done' || b.room) continue;
      const f = footprint(b);
      const r = { x: f.x * CELL, y: f.y * CELL, w: f.w * CELL, h: f.h * CELL };
      if (BEE_PLOTS.has(b.def) && frames) {
        seen.add(b.id);
        let s = this.hives.get(b.id);
        if (!s) {
          s = this.things.addChild(new Sprite());
          s.anchor.set(0.5, 1);
          s.scale.set(1.2);
          this.hives.set(b.id, s);
        }
        s.texture = frames[hive === 'skep' ? CRITTER.skep : CRITTER.box][0];
        // (by the plot's bottom-right corner, just outside it)
        s.position.set(Math.round(r.x + r.w + 6), Math.round(r.y + r.h - 2));
        s.zIndex = s.y;
      }
      if (CROPS[b.def]) {
        let scare: { x: number; y: number } | null = null;
        if (hasScarecrow(b.id, b.def) && scarecrow) {
          seenScare.add(b.id);
          // (on a cell in the plot, a little off the middle by the field's id)
          scare = { x: Math.round(r.x + r.w * (0.3 + ((b.id * 37) % 40) / 100)), y: Math.round(r.y + r.h * 0.62) };
          let sc = this.scarecrows.get(b.id);
          if (!sc) {
            const s = this.things.addChild(new Sprite(scarecrow));
            s.anchor.set(0.5, 1);
            s.scale.set(SCARECROW_K);
            sc = { s, x: scare.x, y: scare.y, flap: 0, next: SCARE_EVERY * (0.5 + ((b.id * 13) % 10) / 10) };
            this.scarecrows.set(b.id, sc);
          }
          sc.x = scare.x;
          sc.y = scare.y;
          sc.s.position.set(scare.x, scare.y);
          sc.s.zIndex = scare.y;
        }
        fields.push({ id: b.id, r, want: crowsFor(tempting(b.crop), !!scare), scare });
      }
      const def = BUILDING_BY_ID[b.def];
      if (def?.storage && b.def !== 'campfire') {
        stores.push(r);
        if (b.def === 'granary') granary = true;
      }
    }
    for (const [id, s] of this.hives)
      if (!seen.has(id)) {
        s.destroy();
        this.hives.delete(id);
      }
    for (const [id, sc] of this.scarecrows)
      if (!seenScare.has(id)) {
        sc.s.destroy();
        this.scarecrows.delete(id);
      }
    this.fields = fields;
    this.stores = stores;
    const plague = ratPlague(next.prompts.map((p) => p.title), next.eventOutcome?.title);
    this.ratsWanted = stores.length ? ratCount(next.storageUsed, next.storageCapacity, granary, plague) : 0;
  }

  render(dt: number, now: number): void {
    const calm = this.map.calm || !frames || !this.land;
    const v = this.map.view;
    const inView = (x: number, y: number, pad: number) => x > v.x - pad && x < v.x + v.w + pad && y > v.y - pad && y < v.y + v.h + pad;
    const wind = WIND[this.sky.weather] ?? 0.4;
    // the scarecrows lean with the wind, and flap when one puts a crow up
    for (const sc of this.scarecrows.values()) {
      sc.flap = Math.max(0, sc.flap - dt * 2);
      sc.s.visible = inView(sc.x, sc.y, 60);
      sc.s.skew.x = this.map.calm ? 0 : Math.sin(now / 900 + sc.x * 0.01) * 0.04 * wind + Math.sin(sc.flap * 18) * 0.12 * sc.flap;
    }
    for (const s of this.hives.values()) s.visible = inView(s.x, s.y, 40);
    this.renderBees(dt, now, calm, inView);
    this.renderFlies(dt, now, calm);
    this.renderBats(dt, now, calm);
    this.renderMoths(dt, now, calm, inView);
    this.renderCrows(dt, calm, inView);
    this.renderRats(dt, calm, inView);
  }

  private renderBees(dt: number, now: number, calm: boolean, inView: (x: number, y: number, pad: number) => boolean): void {
    const out = !calm && beesOut(this.sky);
    const want = new Set<string>();
    if (out) {
      for (const [id, s] of this.hives) if (inView(s.x, s.y, 80)) for (let i = 0; i < BEES_PER_HIVE; i++) want.add(`h${id}:${i}`);
      for (let i = 0; i < BEES_WILD; i++) want.add(`w${i}`);
    }
    for (const [key, b] of this.bees)
      if (!want.has(key) || b.life <= 0) {
        b.s.destroy();
        this.bees.delete(key);
      }
    const v = this.map.view;
    for (const key of want) {
      let b = this.bees.get(key);
      if (!b) {
        let home: { x: number; y: number } | null = null;
        if (key[0] === 'h') {
          const s = this.hives.get(Number(key.slice(1, key.indexOf(':'))));
          if (s) home = { x: s.x, y: s.y - 10 };
        } else {
          // (a bee over the flowers: somewhere on the grass in view, now and then)
          this.wild -= dt;
          if (this.wild > 0) continue;
          this.wild = 0.6;
          const x = v.x + Math.random() * v.w;
          const y = v.y + Math.random() * v.h;
          if (this.groundIs(x, y, FLOWERY) && !this.map.standingAt(x, y)) home = { x, y };
        }
        if (!home) continue;
        const s = this.things.addChild(new Sprite(frames![CRITTER.bee][0]));
        s.anchor.set(0.5);
        b = { s, x: home.x, y: home.y, vx: 0, vy: 0, t: Math.random() * 10, phase: Math.random() * 6.3, turn: 0, life: key[0] === 'h' ? 1e9 : 10 + Math.random() * 12, home, key };
        this.bees.set(key, b);
      }
      b.t += dt;
      b.life -= dt;
      // (a hive's bee loops out over its plot and back to the hive; a wild one zigzags about its flower, drifting on)
      const hive = key[0] === 'h';
      const reach = hive ? 26 + 10 * Math.sin(b.t * 0.3 + b.phase) : 10;
      if (!hive) b.home.x += Math.sin(b.t * 0.4 + b.phase) * 6 * dt;
      b.x = b.home.x + Math.sin(b.t * (hive ? 1.3 : 2.1) + b.phase) * reach * (hive ? -1 : 1) + Math.sin(b.t * 9) * 2;
      b.y = b.home.y + Math.sin(b.t * (hive ? 2.6 : 3.3) + b.phase) * reach * 0.45 + Math.cos(b.t * 11) * 1.5;
      b.s.texture = frames![CRITTER.bee][Math.floor(now / 50) % 2];
      b.s.scale.set(Math.cos(b.t * (hive ? 1.3 : 2.1) + b.phase) > 0 ? -0.4 : 0.4, 0.4);
      b.s.alpha = Math.min(1, b.t * 2, b.life);
      b.s.position.set(Math.round(b.x), Math.round(b.y - 8));
      b.s.zIndex = b.y + 6;
    }
  }

  private renderFlies(dt: number, now: number, calm: boolean): void {
    const v = this.map.view;
    const want = !calm && dragonfliesOut(this.sky) ? DRAGONFLIES_MOST : 0;
    this.nextFlyAt -= dt;
    if (this.flies.length < want && this.nextFlyAt <= 0) {
      this.nextFlyAt = 1.2;
      for (let tries = 0; tries < 12; tries++) {
        const x = v.x + Math.random() * v.w;
        const y = v.y + Math.random() * v.h;
        if (!this.groundIs(x, y, WATERY)) continue;
        const s = this.things.addChild(new Sprite(frames![CRITTER.dragonfly][0]));
        s.anchor.set(0.5);
        s.alpha = 0;
        this.flies.push({ s, x, y, vx: 0, vy: 0, t: 0, phase: Math.random() * 6.3, turn: 0.5 + Math.random(), life: 18 + Math.random() * 20, home: { x, y }, key: '' });
        break;
      }
    }
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i];
      f.t += dt;
      f.life -= dt;
      f.turn -= dt;
      // (it hovers, then darts to another spot over the water, quick and straight)
      if (f.turn <= 0) {
        f.turn = 0.6 + Math.random() * 1.8;
        for (let tries = 0; tries < 6; tries++) {
          const tx = f.x + (Math.random() - 0.5) * 140;
          const ty = f.y + (Math.random() - 0.5) * 90;
          if (this.groundIs(tx, ty, WATERY)) {
            f.home = { x: tx, y: ty };
            break;
          }
        }
      }
      const dx = f.home.x - f.x;
      const dy = f.home.y - f.y;
      f.x += dx * Math.min(1, dt * 7);
      f.y += dy * Math.min(1, dt * 7);
      if (Math.abs(dx) > 2) f.vx = dx;
      if (f.life <= 0 || !want) {
        f.s.alpha -= dt * 2;
        if (f.s.alpha <= 0) {
          f.s.destroy();
          this.flies.splice(i, 1);
          continue;
        }
      } else f.s.alpha = Math.min(1, f.t);
      f.s.texture = frames![CRITTER.dragonfly][Math.floor(now / 40) % 2];
      f.s.scale.set(f.vx > 0 ? -0.6 : 0.6, 0.6);
      f.s.position.set(Math.round(f.x + Math.sin(f.t * 13 + f.phase) * 0.8), Math.round(f.y - 14 + Math.sin(f.t * 5 + f.phase) * 1.5));
      f.s.zIndex = f.y + 20;
    }
  }

  private renderBats(dt: number, now: number, calm: boolean): void {
    const v = this.map.view;
    const want = calm ? 0 : Math.round(BATS_MOST * batsOut(this.sky));
    if (this.bats.length < want && Math.random() < dt * 4) {
      // (they come in from an edge of the view, or up out of the roofs)
      const s = this.over.addChild(new Sprite(frames![CRITTER.bat][0]));
      s.anchor.set(0.5);
      s.alpha = 0;
      const x = v.x + Math.random() * v.w;
      const y = v.y + Math.random() * v.h;
      const a = Math.random() * Math.PI * 2;
      this.bats.push({ s, x, y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 55, t: 0, phase: Math.random() * 6.3, turn: 0.3, life: 14 + Math.random() * 18, home: { x, y }, key: '' });
    }
    for (let i = this.bats.length - 1; i >= 0; i--) {
      const b = this.bats[i];
      b.t += dt;
      b.life -= dt;
      b.turn -= dt;
      // (a bat flits: a sudden new heading every fraction of a second, swooping after the insects)
      if (b.turn <= 0) {
        b.turn = 0.15 + Math.random() * 0.45;
        // (and keeps over the town: near the view's edge it swings back in)
        const cx = v.x + v.w / 2 - b.x;
        const cy = v.y + v.h / 2 - b.y;
        const edge = Math.abs(cx) > v.w * 0.4 || Math.abs(cy) > v.h * 0.4;
        const a = (edge ? Math.atan2(cy, cx) : Math.atan2(b.vy, b.vx)) + (Math.random() - 0.5) * 2.2;
        const sp = 60 + Math.random() * 70;
        b.vx = Math.cos(a) * sp;
        b.vy = Math.sin(a) * sp * 0.7;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const outside = b.x < v.x - 60 || b.x > v.x + v.w + 60 || b.y < v.y - 60 || b.y > v.y + v.h + 60;
      if (b.life <= 0 || outside || want === 0) {
        b.s.alpha -= dt * 2;
        if (b.s.alpha <= 0 || outside) {
          b.s.destroy();
          this.bats.splice(i, 1);
          continue;
        }
      } else b.s.alpha = Math.min(0.95, b.t * 2);
      b.s.texture = frames![CRITTER.bat][Math.floor(now / 70 + b.phase) % 2];
      b.s.scale.set(b.vx > 0 ? -0.7 : 0.7, 0.7);
      b.s.position.set(Math.round(b.x), Math.round(b.y - 40));
    }
  }

  private renderMoths(dt: number, now: number, calm: boolean, inView: (x: number, y: number, pad: number) => boolean): void {
    const want = new Set<string>();
    if (!calm && mothsOut(this.sky)) {
      let n = 0;
      for (const l of this.lamps) {
        if (n >= MOTHS_MOST) break;
        if (!inView(l.x, l.y, 40)) continue;
        for (let i = 0; i < MOTHS_PER_LIGHT && n < MOTHS_MOST; i++, n++) want.add(`${Math.round(l.x)},${Math.round(l.y)}:${i}`);
      }
    }
    for (const [key, m] of this.moths)
      if (!want.has(key)) {
        m.s.destroy();
        this.moths.delete(key);
      }
    for (const key of want) {
      let m = this.moths.get(key);
      if (!m) {
        const [x, y] = key.split(':')[0].split(',').map(Number);
        const s = this.over.addChild(new Sprite(frames![CRITTER.moth][0]));
        s.anchor.set(0.5);
        s.tint = 0xf0e4c8;
        m = { s, x, y, vx: 0, vy: 0, t: Math.random() * 10, phase: Math.random() * 6.3, turn: 0, life: 0, home: { x, y: y - 26 }, key };
        this.moths.set(key, m);
      }
      m.t += dt;
      // (round and round the flame, never quite steady, now and then bumping in close)
      const r = 7 + 6 * Math.sin(m.t * 0.7 + m.phase) + 3 * Math.sin(m.t * 5.3);
      const a = m.t * (2.2 + (m.phase % 1)) + m.phase;
      const x = m.home.x + Math.cos(a) * r;
      const y = m.home.y + Math.sin(a * 1.3) * r * 0.6;
      m.s.texture = frames![CRITTER.moth][Math.floor(now / 60 + m.phase) % 2];
      m.s.scale.set(Math.sin(a) > 0 ? -0.36 : 0.36, 0.36);
      m.s.alpha = Math.min(0.9, m.t);
      m.s.position.set(Math.round(x), Math.round(y));
    }
  }

  private renderCrows(dt: number, calm: boolean, inView: (x: number, y: number, pad: number) => boolean): void {
    const day = this.sky.daylight > 0.35 && this.sky.weather !== 'storm';
    // (how many each field wants now, and has)
    const has = new Map<number, number>();
    for (const c of this.crows) if (c.state !== 'flying') has.set(c.field, (has.get(c.field) ?? 0) + 1);
    this.nextCrow -= dt;
    if (!calm && day && crow && this.nextCrow <= 0) {
      this.nextCrow = 1.5 + Math.random() * 2.5;
      const f = this.fields.find((f) => f.want > (has.get(f.id) ?? 0) && inView(f.r.x + f.r.w / 2, f.r.y + f.r.h / 2, 0));
      if (f) {
        const x = f.r.x + 6 + Math.random() * (f.r.w - 12);
        const y = f.r.y + 8 + Math.random() * (f.r.h - 10);
        const s = this.things.addChild(new Sprite(crow[1]));
        s.anchor.set(0.5, 1);
        const sh = this.things.addChild(new Sprite(glowTexture()));
        sh.anchor.set(0.5);
        sh.tint = 0x000000;
        this.crows.push({ s, sh, field: f.id, x, y, h: 110, state: 'landing', vx: (Math.random() - 0.5) * 30, vy: 0, hop: 0.5, wing: 0 });
      }
    }
    for (let i = this.crows.length - 1; i >= 0; i--) {
      const c = this.crows[i];
      const f = this.fields.find((q) => q.id === c.field);
      if (c.state === 'landing') {
        c.h = Math.max(0, c.h - dt * 120);
        if (c.h === 0) c.state = 'ground';
      } else if (c.state === 'ground') {
        // put up by feet, by a field no longer worth it, by night, or by the scarecrow's flap
        const scared = this.folk.some((p) => Math.abs(p.x - c.x) < CROW_SHY && Math.abs(p.y - c.y) < CROW_SHY);
        const over = !f || f.want === 0 || !day || calm || (has.get(c.field) ?? 0) > f.want;
        let flapped = false;
        if (f?.scare) {
          const sc = this.scarecrows.get(f.id);
          if (sc && Math.hypot(sc.x - c.x, sc.y - c.y) < SCARE_REACH) {
            sc.next -= dt;
            if (sc.next <= 0) {
              sc.next = SCARE_EVERY * (0.7 + Math.random() * 0.6);
              sc.flap = 1;
              flapped = true;
            }
          }
        }
        if (scared || over || flapped) {
          c.state = 'flying';
          const away = Math.atan2(c.y - (f?.scare?.y ?? c.y + 1), c.x - (f?.scare?.x ?? c.x)) + (Math.random() - 0.5);
          c.vx = Math.cos(away) * 110;
          c.vy = Math.sin(away) * 60;
          if (f) has.set(f.id, (has.get(f.id) ?? 1) - 1);
        } else {
          // (a hop and a peck at the crop)
          c.hop -= dt;
          if (c.hop <= 0 && f) {
            c.hop = 0.4 + Math.random() * 1.6;
            c.x = Math.max(f.r.x + 4, Math.min(f.r.x + f.r.w - 4, c.x + (Math.random() - 0.5) * 16));
            c.y = Math.max(f.r.y + 6, Math.min(f.r.y + f.r.h - 2, c.y + (Math.random() - 0.5) * 8));
            c.vx = (Math.random() - 0.5) * 2;
          }
        }
      } else {
        c.h += dt * 70;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.h > 160) {
          c.s.destroy();
          c.sh.destroy();
          this.crows.splice(i, 1);
          continue;
        }
      }
      c.wing += dt;
      const shown = inView(c.x, c.y, 40);
      c.s.visible = c.sh.visible = shown;
      if (!shown) continue;
      const k = c.state === 'flying' ? Math.max(0.5, 1 - c.h / 320) : 1;
      c.s.texture = crow![c.state === 'ground' ? (c.hop < 0.15 ? 1 : 0) : Math.floor(c.wing * 9) % 2];
      if (Math.abs(c.vx) > 0.5) c.s.scale.set((c.vx > 0 ? -1 : 1) * k, k);
      c.s.position.set(Math.round(c.x), Math.round(c.y - c.h));
      c.s.zIndex = c.state === 'ground' ? c.y : c.y + 1000;
      c.sh.width = 9 * (1 - Math.min(0.7, c.h / 200));
      c.sh.height = 3;
      c.sh.alpha = 0.3 * (1 - Math.min(1, c.h / 160));
      c.sh.position.set(Math.round(c.x), Math.round(c.y));
      c.sh.zIndex = c.y - 0.5;
    }
  }

  private renderRats(dt: number, calm: boolean, inView: (x: number, y: number, pad: number) => boolean): void {
    const want = calm ? 0 : this.ratsWanted;
    if (this.rats.length < want && this.stores.length && Math.random() < dt * 0.8) {
      const store = Math.floor(Math.random() * this.stores.length);
      const p = this.byStore(this.stores[store]);
      if (inView(p.x, p.y, 60)) {
        const kind = Math.random() < 0.6 ? CRITTER.rat : CRITTER.rat2;
        const s = this.things.addChild(new Sprite(frames![kind][0]));
        s.anchor.set(0.5, 0.9);
        const sh = this.things.addChild(new Sprite(glowTexture()));
        sh.anchor.set(0.5);
        sh.tint = 0x000000;
        this.rats.push({ id: this.nextRat++, s, sh, kind, store, x: p.x, y: p.y, tx: p.x, ty: p.y, wait: 0.5 + Math.random() * 2, fleeing: false, step: 0, alpha: 0 });
      }
    }
    for (let i = this.rats.length - 1; i >= 0; i--) {
      const r = this.rats[i];
      const home = this.stores[r.store];
      // feet and cats send it off at a run, away from them, till it's gone
      if (!r.fleeing) {
        const near = this.folk.find((p) => Math.abs(p.x - r.x) < RAT_SHY && Math.abs(p.y - r.y) < RAT_SHY) ?? this.cats.find((p) => Math.hypot(p.x - r.x, p.y - r.y) < CAT_FEAR);
        if (near || !home || i >= want) {
          r.fleeing = true;
          const a = near ? Math.atan2(r.y - near.y, r.x - near.x) + (Math.random() - 0.5) * 0.6 : Math.random() * 6.3;
          r.tx = r.x + Math.cos(a) * 160;
          r.ty = r.y + Math.sin(a) * 110;
        }
      }
      const dx = r.tx - r.x;
      const dy = r.ty - r.y;
      const d = Math.hypot(dx, dy);
      const speed = r.fleeing ? 95 : 55;
      if (d > 1.5) {
        const st = Math.min(d, speed * dt);
        r.x += (dx / d) * st;
        r.y += (dy / d) * st;
        r.step += dt * 14;
        if (Math.abs(dx) > 1) r.s.scale.x = dx > 0 ? -0.9 : 0.9;
      } else if (r.fleeing) {
        r.alpha = 0;
      } else {
        // (it stops to sniff, then scurries on along the store's foot)
        r.wait -= dt;
        r.step += dt * 2;
        if (r.wait <= 0 && home) {
          const p = this.byStore(home);
          r.tx = p.x;
          r.ty = p.y;
          r.wait = 0.8 + Math.random() * 3;
        }
      }
      r.alpha = r.fleeing ? Math.max(0, r.alpha - (d < 2 ? 1 : dt * 0.5)) : Math.min(1, r.alpha + dt * 2);
      if (r.alpha <= 0 && r.fleeing) {
        r.s.destroy();
        r.sh.destroy();
        this.rats.splice(i, 1);
        continue;
      }
      const shown = inView(r.x, r.y, 30);
      r.s.visible = r.sh.visible = shown;
      if (!shown) continue;
      r.s.texture = frames![r.kind][Math.floor(r.step) % 2];
      r.s.scale.y = 0.9;
      r.s.alpha = r.alpha;
      r.s.position.set(Math.round(r.x), Math.round(r.y));
      r.s.zIndex = r.y;
      r.sh.width = 10;
      r.sh.height = 3;
      r.sh.alpha = 0.25 * r.alpha;
      r.sh.position.set(Math.round(r.x), Math.round(r.y));
      r.sh.zIndex = r.y - 0.5;
    }
  }

  /** A spot at a store's foot (along its front, or down a side), where a rat goes nosing. */
  private byStore(r: Rect): { x: number; y: number } {
    const side = Math.random();
    if (side < 0.6) return { x: r.x + 4 + Math.random() * (r.w - 8), y: r.y + r.h + 3 + Math.random() * 6 };
    const left = side < 0.8;
    return { x: left ? r.x - 4 : r.x + r.w + 4, y: r.y + r.h * 0.5 + Math.random() * r.h * 0.5 };
  }

  private groundIs(x: number, y: number, kinds: Set<Ground>): boolean {
    const land = this.land;
    if (!land) return false;
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= land.w || cy >= land.h || visibility(land, cx, cy) !== 2) return false;
    return kinds.has(groundAt(land, cx, cy));
  }
}
