// Real light on the map (the owner's ask: every light casts its light all round it, as far as its kind reaches, and
// is stopped by buildings and walls, trees and rocks). A light map is laid over the world in multiply: the night's dark
// everywhere (a deep moonlit blue, nothing by day), and on it the light of every burning torch, lantern or lamp
// (sim/lighting.ts: `snapshot.lights`), the camp's fire and the fires and furnaces, each reaching as far as its kind
// does (sim/lightField.ts `lightSources`) and only where it can see (`clearLine`, the same rule the sim works by: a
// building, a wall, a tree or a rock lit on its face and its shadow thrown behind it); a castle's or hold's room whose
// sconce burns is lit wall to wall, and one whose sconce is out stays dark; under the mountain the halls are dark by day
// too. The light is worked out on a grid of the whole land at an eighth of its size (four points a cell), only when the
// lights or what stands in their way change, and only while it shows (`build`, at most every `REBUILD_MS`); each
// light's pool is kept (`pool`, by `poolKey`), so a tree felled or a hut built redoes only the lights it stands near. Each frame
// the part in view is put together (`render`): the dark, those lights, and the lanterns people carry about after dark.
// On a slow phone (`calm`) there are no lanterns.

import { Container, Graphics, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import { footprint } from '../../shared/sim/buildings';
import { clearLine, falloff, lightSources, occluders, type LightSource } from '../../shared/sim/lightField';
import type { Snapshot } from '../../shared/sim/snapshot';
import { flicker, flickers, phaseOf } from './flicker';

/** World px a texel of the light map covers, and texels a cell. */
const SCALE = 8;
const CELL = 32;
const PER_CELL = CELL / SCALE;
/** The night's dark (multiplied in at no daylight), and a cave's by day. */
const NIGHT = [0x2c, 0x34, 0x58];
const CAVE = [0x38, 0x33, 0x40];
/** A sconce's room, its flame, and a lantern's light. */
const ROOM = 0xb88a5a;
const SCONCE = 0xffc888;
const LANTERN = 0xc89a60;
const LANTERN_RADIUS = 1.6;
/** Where the rays of a light start, round its middle (cells): a light the size of a flame. */
const SPREAD_X = [0.22, -0.22, 0.22, -0.22];
const SPREAD_Y = [0.22, 0.22, -0.22, -0.22];
/** The falloff by the share of the reach, looked up (it's asked for some hundred thousand times a build). */
const FALL = Array.from({ length: 257 }, (_, i) => falloff(i / 256, 1));
const fall = (d2: number, r: number) => {
  const q = Math.sqrt(d2) / r;
  return q >= 1 ? 0 : FALL[(q * 256) | 0];
};
/** The light is worked out again no oftener than this (ms): a tree felled at night needn't redo it each snapshot. */
const REBUILD_MS = 1500;

let falloffTex: Texture | null = null;
/** A lantern's pool: full in the middle, easing to nothing at the edge. */
function falloffTexture(): Texture {
  if (falloffTex) return falloffTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    grad.addColorStop(t, `rgba(255,255,255,${Math.pow(1 - t, 1.6).toFixed(3)})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  falloffTex = Texture.from(c);
  falloffTex.source.scaleMode = 'linear';
  return falloffTex;
}

const mix = (a: number[], d: number) => {
  const ch = (v: number) => Math.round(v + (255 - v) * d);
  return (ch(a[0]) << 16) | (ch(a[1]) << 8) | ch(a[2]);
};

/** What the light is worked out from (kept from the snapshot until it's built). */
interface Plan {
  w: number;
  h: number;
  occ: Uint8Array;
  castle: Set<number>;
  sources: LightSource[];
  /** Each lit sconce: where it hangs (cells) and its room's cells. */
  rooms: { x: number; y: number; cells: number[] }[];
}

/** Does nothing stand within a light's reach that would stop it (its own building aside)? */
function nothingStops(plan: Plan, src: LightSource): boolean {
  for (let y = Math.floor(src.y - src.r); y <= Math.ceil(src.y + src.r); y++)
    for (let x = Math.floor(src.x - src.r); x <= Math.ceil(src.x + src.r); x++) {
      if (x < 0 || y < 0 || x >= plan.w || y >= plan.h || !plan.occ[y * plan.w + x]) continue;
      if (src.own && x >= src.own.x && x < src.own.x + src.own.w && y >= src.own.y && y < src.own.y + src.own.h) continue;
      return false;
    }
  return true;
}

/** Is a point on a shadow's edge: does any neighbour within the reach see the light differently? */
function edge(seen: Int8Array, bw: number, bh: number, x: number, y: number): boolean {
  const v = seen[y * bw + x];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= bw || yy >= bh || seen[yy * bw + xx] < 0) continue;
      if (seen[yy * bw + xx] !== v) return true;
    }
  return false;
}

/** A quick fingerprint of a grid, to tell when what stands in the light's way has changed. */
function hashOf(a: Uint8Array): number {
  let h = 2166136261;
  for (let i = 0; i < a.length; i++) if (a[i]) h = Math.imul(h ^ (i * 3 + a[i]), 16777619);
  return h >>> 0;
}

/** A light's pool: the light it casts on each point of the box round it (0 to its strength). */
interface Pool {
  key: string;
  x0: number;
  y0: number;
  bw: number;
  bh: number;
  vals: Float32Array;
  /** A flame's pool as its own texture, drawn each frame at its flicker's strength (`flameTexture`). */
  tex?: Texture;
}

/** A flame's pool painted onto a texture of its own box. */
function flameTexture(p: Pool, color: number): Texture {
  const c = document.createElement('canvas');
  c.width = p.bw;
  c.height = p.bh;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(p.bw, p.bh);
  const d = img.data;
  const cr = (color >> 16) & 255;
  const cg = (color >> 8) & 255;
  const cb = color & 255;
  for (let i = 0, j = 0; i < p.vals.length; i++, j += 4) {
    const k = p.vals[i];
    d[j] = Math.min(255, cr * k);
    d[j + 1] = Math.min(255, cg * k);
    d[j + 2] = Math.min(255, cb * k);
    d[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = Texture.from(c);
  tex.source.scaleMode = 'linear';
  return tex;
}

/** A flame burning on the land: its pool, what it is, and its own beat. */
interface Flame {
  pool: Pool;
  kind: string;
  phase: number;
}

/** What a light's pool depends on: its reach, its strength and what stands in it (and the castle's cells there). */
function poolKey(plan: Plan, src: LightSource): string {
  let h = 2166136261;
  for (let y = Math.floor(src.y - src.r); y <= Math.ceil(src.y + src.r); y++)
    for (let x = Math.floor(src.x - src.r); x <= Math.ceil(src.x + src.r); x++) {
      if (x < 0 || y < 0 || x >= plan.w || y >= plan.h) continue;
      const i = y * plan.w + x;
      const o = plan.occ[i] + (plan.castle.has(i) ? 4 : 0);
      if (o) h = Math.imul(h ^ (i * 8 + o), 16777619);
    }
  return `${src.r}|${src.power}|${src.own ? `${src.own.x},${src.own.y},${src.own.w},${src.own.h}` : ''}|${h >>> 0}`;
}

/** A light's pool worked out: every point within its reach that it can see. First one ray to each point from the
 *  light's middle; then, where a point and its neighbours disagree (a shadow's edge), rays from round the flame
 *  (`SPREAD_X`, `SPREAD_Y`) too, for a soft edge and no lone dark points where a ray grazes a corner. */
function pool(plan: Plan, src: LightSource, key: string): Pool {
  const tw = plan.w * PER_CELL;
  const th = plan.h * PER_CELL;
  const x0 = Math.max(0, Math.floor((src.x - src.r) * PER_CELL));
  const x1 = Math.min(tw - 1, Math.ceil((src.x + src.r) * PER_CELL));
  const y0 = Math.max(0, Math.floor((src.y - src.r) * PER_CELL));
  const y1 = Math.min(th - 1, Math.ceil((src.y + src.r) * PER_CELL));
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const vals = new Float32Array(bw * bh);
  // (nothing in its reach that stops light: no rays to look along)
  const open = nothingStops(plan, src);
  const seen = new Int8Array(bw * bh).fill(-1);
  const r2 = src.r * src.r;
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) {
      const px = (tx + 0.5) / PER_CELL;
      const py = (ty + 0.5) / PER_CELL;
      if ((px - src.x) * (px - src.x) + (py - src.y) * (py - src.y) >= r2) continue;
      // (outdoor light doesn't reach into the castle's rooms)
      if (plan.castle.has(Math.floor(py) * plan.w + Math.floor(px))) continue;
      seen[(ty - y0) * bw + (tx - x0)] = open || clearLine(plan.occ, plan.w, plan.h, src.x, src.y, px, py, src.own) ? 1 : 0;
    }
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) {
      const j = (ty - y0) * bw + (tx - x0);
      let v = seen[j];
      if (v < 0) continue;
      const px = (tx + 0.5) / PER_CELL;
      const py = (ty + 0.5) / PER_CELL;
      const k = fall((px - src.x) * (px - src.x) + (py - src.y) * (py - src.y), src.r) * src.power;
      if (k <= 0.004) continue;
      if (!open && edge(seen, bw, bh, tx - x0, ty - y0)) {
        let n = 0;
        for (let s = 0; s < SPREAD_X.length; s++) if (clearLine(plan.occ, plan.w, plan.h, src.x + SPREAD_X[s], src.y + SPREAD_Y[s], px, py, src.own)) n++;
        v = (v + n) / (SPREAD_X.length + 1);
      }
      vals[j] = k * v;
    }
  return { key, x0, y0, bw, bh, vals };
}

export class LightMap {
  /** In the world, over everything standing (multiply). */
  readonly sprite: Sprite;
  private canvas: HTMLCanvasElement | null = null;
  private lights: Texture | null = null;
  private out: RenderTexture | null = null;
  private key = '';
  private plan: Plan | null = null;
  /** Each light's pool, kept until something in its reach changes. */
  private pools = new Map<string, Pool>();
  /** The flames out of doors, drawn each frame with their flicker (electric light is in the land's texture). */
  private flames: Flame[] = [];
  private built = 0;
  private landKey = '';
  private occ: Uint8Array | null = null;
  private occHash = 0;
  private caveCells: number[] = [];
  private landW = 0;
  private lanterns: { x: number; y: number; id: number }[] = [];
  private shown = false;
  calm = false;

  constructor(private readonly renderer: Renderer) {
    this.sprite = new Sprite(Texture.EMPTY);
    this.sprite.blendMode = 'multiply';
    this.sprite.scale.set(SCALE);
    this.sprite.visible = false;
    this.sprite.eventMode = 'none';
  }

  /** Per snapshot: the lights, and what stands in their way. The light itself is worked out when it next shows. */
  sync(snap: Snapshot): void {
    const L = snap.lights;
    this.shown = !!L;
    if (!L) {
      this.sprite.visible = false;
      return;
    }
    // (the lanterns: everyone out of doors carries one after dark)
    this.lanterns = this.calm ? [] : snap.people.filter((p) => p.away === null && !p.indoors && p.activity !== 'sleep').map((p) => ({ x: p.x, y: p.y, id: p.id }));
    const w = snap.land.w;
    const h = snap.land.h;
    const done = snap.buildings.filter((b) => b.status === 'done');
    const castle = new Set(snap.castle?.cells ?? []);
    // what stands in the way: read again only when the land or the buildings change, kept by its fingerprint
    const landKey = `${snap.land.version}|${done.map((b) => `${b.id}:${b.tile},${b.row},${b.def},${b.turned ? 1 : 0},${b.wide ?? 0}`).join(';')}|${castle.size}`;
    if (landKey !== this.landKey || !this.occ) {
      this.landKey = landKey;
      this.occ = occluders(snap.land, done, castle);
      this.occHash = hashOf(this.occ);
    }
    const key = [w, h, snap.era, L.lights.map((l) => `${l.id}${l.lit ? '+' : '-'}`).join(','), this.occHash].join('|');
    this.landW = w;
    this.caveCells = L.cave && snap.castle ? snap.castle.cells : [];
    if (key === this.key) return;
    this.key = key;
    const streets = L.lights.filter((l) => l.lit && l.room === null);
    const rooms: Plan['rooms'] = [];
    if (snap.castle) for (const l of L.lights) if (l.room !== null && l.lit) rooms.push({ x: l.x, y: l.y, cells: this.roomCells(l.x, l.y, castle, snap) });
    const camp = { x: Math.floor(snap.camp.x / CELL), y: Math.floor(snap.camp.y / CELL) };
    this.plan = { w, h, occ: this.occ, castle, sources: lightSources(snap.era, streets, done, camp), rooms };
  }

  /** A room's cells: the castle cells under the same room building as the sconce (else the hall's), joined to it. */
  private roomCells(x: number, y: number, castle: Set<number>, snap: Snapshot): number[] {
    const w = snap.land.w;
    const roomOf = new Map<number, number>();
    for (const b of snap.buildings) {
      if (!b.room) continue;
      const f = footprint(b);
      for (let yy = f.y; yy < f.y + f.h; yy++) for (let xx = f.x; xx < f.x + f.w; xx++) roomOf.set(yy * w + xx, b.id);
    }
    const start = y * w + x;
    const want = roomOf.get(start) ?? -1;
    const out: number[] = [];
    const seen = new Set<number>([start]);
    const q = [start];
    while (q.length) {
      const i = q.pop()!;
      if (!castle.has(i) || (roomOf.get(i) ?? -1) !== want) continue;
      out.push(i);
      for (const n of [i - 1, i + 1, i - w, i + w])
        if (!seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
    }
    return out;
  }

  /** The light worked out over the whole land, into the light texture. */
  private build(plan: Plan): void {
    const tw = plan.w * PER_CELL;
    const th = plan.h * PER_CELL;
    const r = new Float32Array(tw * th);
    const g = new Float32Array(tw * th);
    const b = new Float32Array(tw * th);
    const add = (i: number, color: number, k: number) => {
      r[i] += ((color >> 16) & 255) * k;
      g[i] += ((color >> 8) & 255) * k;
      b[i] += (color & 255) * k;
    };
    // each light out of doors: its pool, worked out afresh only when something in its reach has changed (`pool`)
    const keep = new Map<string, Pool>();
    const flames: Flame[] = [];
    for (const src of plan.sources) {
      const id = `${src.kind}@${src.x},${src.y}`;
      const key = poolKey(plan, src);
      let p = this.pools.get(id);
      if (!p || p.key !== key) p = pool(plan, src, key);
      keep.set(id, p);
      // (a flame flickers: its pool is drawn each frame on its own, not baked into the land's light)
      if (flickers(src.kind)) {
        p.tex ??= flameTexture(p, src.color);
        flames.push({ pool: p, kind: src.kind, phase: phaseOf(src.x, src.y) });
        continue;
      }
      for (let y = 0; y < p.bh; y++)
        for (let x = 0; x < p.bw; x++) {
          const k = p.vals[y * p.bw + x];
          if (k > 0) add((p.y0 + y) * tw + p.x0 + x, src.color, k);
        }
    }
    for (const [id, p] of this.pools) if (keep.get(id) !== p) p.tex?.destroy(true);
    this.pools = keep;
    this.flames = flames;
    // the rooms lit by their sconces: wall to wall, and brighter by the sconce
    for (const room of plan.rooms) {
      for (const c of room.cells) {
        const cx = (c % plan.w) * PER_CELL;
        const cy = Math.floor(c / plan.w) * PER_CELL;
        for (let dy = 0; dy < PER_CELL; dy++)
          for (let dx = 0; dx < PER_CELL; dx++) {
            const tx = cx + dx;
            const ty = cy + dy;
            const d = Math.hypot((tx + 0.5) / PER_CELL - (room.x + 0.5), (ty + 0.5) / PER_CELL - (room.y + 0.8));
            add(ty * tw + tx, ROOM, 1);
            add(ty * tw + tx, SCONCE, falloff(d, 2.2) * 0.6);
          }
      }
    }
    if (!this.canvas || this.canvas.width !== tw || this.canvas.height !== th) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = tw;
      this.canvas.height = th;
      this.lights?.destroy(true);
      this.lights = Texture.from(this.canvas);
      // (smooth: a point of light covers 8 px, and stepped it would show as squares)
      this.lights.source.scaleMode = 'linear';
    }
    const ctx = this.canvas.getContext('2d')!;
    const img = ctx.createImageData(tw, th);
    const d = img.data;
    for (let i = 0, j = 0; i < r.length; i++, j += 4) {
      d[j] = Math.min(255, r[i]);
      d[j + 1] = Math.min(255, g[i]);
      d[j + 2] = Math.min(255, b[i]);
      d[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.lights!.source.update();
  }

  /** Each frame: the view's light put together for the hour (daylight 0..1), in the world at the view. */
  render(view: { x: number; y: number; w: number; h: number }, daylight: number): void {
    if (!this.shown || (!this.lights && !this.plan)) {
      this.sprite.visible = false;
      return;
    }
    const cave = this.caveCells.length > 0;
    if (daylight >= 0.999 && !cave) {
      this.sprite.visible = false;
      return;
    }
    // (the light worked out again when it has changed, while it shows)
    const now = performance.now();
    if (this.plan && (!this.built || now - this.built >= REBUILD_MS)) {
      this.build(this.plan);
      this.plan = null;
      this.built = now;
    }
    if (!this.lights) {
      this.sprite.visible = false;
      return;
    }
    const x0 = Math.max(0, Math.floor(view.x / SCALE) - 1);
    const y0 = Math.max(0, Math.floor(view.y / SCALE) - 1);
    const tw = Math.min(this.lights.width - x0, Math.ceil(view.w / SCALE) + 3);
    const th = Math.min(this.lights.height - y0, Math.ceil(view.h / SCALE) + 3);
    if (tw <= 0 || th <= 0) {
      this.sprite.visible = false;
      return;
    }
    if (!this.out || this.out.width !== tw || this.out.height !== th) {
      this.out?.destroy(true);
      this.out = RenderTexture.create({ width: tw, height: th, resolution: 1, scaleMode: 'linear' });
      this.sprite.texture = this.out;
    }
    const c = new Container();
    // the dark (none by day), and the cave's halls dark at any hour
    const ambient = mix(NIGHT, daylight);
    const g = c.addChild(new Graphics());
    g.rect(0, 0, tw, th).fill(ambient);
    if (cave && daylight > 0) {
      const w = this.landW;
      for (const i of this.caveCells) {
        const cx = ((i % w) * CELL) / SCALE - x0;
        const cy = (Math.floor(i / w) * CELL) / SCALE - y0;
        if (cx < -4 || cy < -4 || cx > tw || cy > th) continue;
        g.rect(cx, cy, CELL / SCALE, CELL / SCALE).fill(mix(CAVE, 0));
      }
    }
    // the lights, of the land's texture, added
    const lit = c.addChild(new Sprite(this.lights));
    lit.blendMode = 'add';
    lit.position.set(-x0, -y0);
    // (how strongly the lights show: fully at night, faintly by day but for the cave)
    lit.alpha = cave ? 1 : Math.max(0, Math.min(1, (0.75 - daylight) / 0.5));
    // the flames, each wavering on its own beat (steady on a slow phone)
    const t = now / 1000;
    for (const f of this.flames) {
      const p = f.pool;
      if (!p.tex || p.x0 > x0 + tw || p.y0 > y0 + th || p.x0 + p.bw < x0 || p.y0 + p.bh < y0) continue;
      const s = c.addChild(new Sprite(p.tex));
      s.blendMode = 'add';
      s.position.set(p.x0 - x0, p.y0 - y0);
      s.alpha = lit.alpha * (this.calm ? 0.92 : flicker(f.kind, t, f.phase));
    }
    // the lanterns people carry
    if (lit.alpha > 0.2)
      for (const p of this.lanterns) {
        const s = c.addChild(new Sprite(falloffTexture()));
        s.anchor.set(0.5);
        s.blendMode = 'add';
        s.tint = LANTERN;
        s.alpha = lit.alpha * 0.8 * (this.calm ? 1 : flicker('carried', t, (p.id * 2.39) % 6.283));
        s.width = s.height = (LANTERN_RADIUS * CELL * 2) / SCALE;
        s.position.set(p.x / SCALE - x0, (p.y - 8) / SCALE - y0);
      }
    this.renderer.render({ container: c, target: this.out, clear: true });
    c.destroy({ children: true });
    this.sprite.position.set(x0 * SCALE, y0 * SCALE);
    this.sprite.visible = true;
  }

  /** Whether the map's own night tint should stand down (the light map darkens the night instead). */
  get active(): boolean {
    return this.shown;
  }
}
