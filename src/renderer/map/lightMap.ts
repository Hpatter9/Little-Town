// Real light on the map (the owner's ask: torches that light so far and cast shadows, and the dark without them). A
// light map is laid over the world in multiply: the night's dark everywhere (a deep moonlit blue, nothing by day),
// and on it the light of every burning torch, lantern or lamp (sim/lighting.ts: `snapshot.lights`), the camp's fire
// and the open fires, each a warm pool out to its reach with the shadows of the buildings near it thrown away from
// it; a castle's or hold's room whose sconce burns is lit wall to wall, and one whose sconce is out stays dark; under
// the mountain the halls are dark by day too. The lights are drawn into one texture of the whole land at an eighth of
// its size, only when they change (`sync`); each frame the part in view is put together (`render`): the dark, those
// lights, and the lanterns people carry about after dark. On a slow phone (`calm`) there are no shadows or lanterns.

import { Container, Graphics, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { CAMPFIRE_RADIUS, FIRE_RADIUS } from '../../shared/data/lighting';
import { footprint } from '../../shared/sim/buildings';
import type { Snapshot } from '../../shared/sim/snapshot';

/** World px a texel of the light map covers. */
const SCALE = 8;
const CELL = 32;
/** The night's dark (multiplied in at no daylight), and a cave's by day. */
const NIGHT = [0x2c, 0x34, 0x58];
const CAVE = [0x38, 0x33, 0x40];
/** A flame's light, an electric light's, a sconce's room, and a lantern's. */
const FLAME = 0xffc888;
const ELECTRIC = 0xf0f4ff;
const ROOM = 0xb88a5a;
const LANTERN = 0xc89a60;
const LANTERN_RADIUS = 1.6;
const FIRES = new Set(['bloomery', 'kiln', 'storytellers_circle']);

let falloff: Texture | null = null;
/** A light's pool: full in the middle, easing to nothing at the edge. */
function falloffTexture(): Texture {
  if (falloff) return falloff;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const v = Math.pow(1 - t, 1.6);
    grad.addColorStop(t, `rgba(255,255,255,${v.toFixed(3)})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return (falloff = Texture.from(c));
}

const mix = (a: number[], d: number) => {
  const ch = (v: number) => Math.round(v + (255 - v) * d);
  return (ch(a[0]) << 16) | (ch(a[1]) << 8) | ch(a[2]);
};

interface Source {
  x: number;
  y: number;
  r: number;
  color: number;
  power: number;
}

export class LightMap {
  /** In the world, over everything standing (multiply). */
  readonly sprite: Sprite;
  private lights: RenderTexture | null = null;
  private out: RenderTexture | null = null;
  private tmp: RenderTexture | null = null;
  private key = '';
  private caveCells: number[] = [];
  private landW = 0;
  private lanterns: { x: number; y: number }[] = [];
  private shown = false;
  calm = false;

  constructor(private readonly renderer: Renderer) {
    this.sprite = new Sprite(Texture.EMPTY);
    this.sprite.blendMode = 'multiply';
    this.sprite.scale.set(SCALE);
    this.sprite.visible = false;
    this.sprite.eventMode = 'none';
  }

  /** Per snapshot: the lights, the buildings that throw shadows, the castle's cells. */
  sync(snap: Snapshot): void {
    const L = snap.lights;
    this.shown = !!L;
    if (!L) {
      this.sprite.visible = false;
      return;
    }
    const w = snap.land.w;
    const h = snap.land.h;
    const done = snap.buildings.filter((b) => b.status === 'done');
    const key = [
      w,
      h,
      L.radius,
      L.lights.map((l) => `${l.id}${l.lit ? '+' : '-'}`).join(','),
      done.map((b) => `${b.id}:${b.tile},${b.row},${b.def}`).join(';'),
      this.calm,
      snap.castle?.cells.length ?? 0,
    ].join('|');
    // (the lanterns: everyone out of doors carries one after dark)
    this.lanterns = this.calm ? [] : snap.people.filter((p) => p.away === null && !p.indoors && p.activity !== 'sleep').map((p) => ({ x: p.x, y: p.y }));
    if (key === this.key) return;
    this.key = key;
    this.landW = w;
    this.caveCells = L.cave && snap.castle ? snap.castle.cells : [];
    const tw = Math.ceil((w * CELL) / SCALE);
    const th = Math.ceil((h * CELL) / SCALE);
    if (!this.lights || this.lights.width !== tw || this.lights.height !== th) {
      this.lights?.destroy(true);
      this.lights = RenderTexture.create({ width: tw, height: th, resolution: 1 });
    }
    this.renderer.render({ container: new Container(), target: this.lights, clear: true, clearColor: [0, 0, 0, 1] });
    // the sources
    const castle = new Set(snap.castle?.cells ?? []);
    const sources: Source[] = [];
    const flame = L.fuelled;
    const rooms = new Map<number, number[]>();
    if (snap.castle) {
      // (each sconce lights its own room: the cells of its region, found by flood from the sconce through the castle)
      for (const l of L.lights) if (l.room !== null && l.lit) rooms.set(l.id, this.roomCells(l.x, l.y, castle, snap));
    }
    for (const l of L.lights) {
      if (!l.lit || l.room !== null) continue;
      sources.push({ x: (l.x + 0.5) * CELL, y: (l.y + 0.5) * CELL, r: L.radius * CELL, color: flame ? FLAME : ELECTRIC, power: 1 });
    }
    sources.push({ x: snap.camp.x, y: snap.camp.y, r: CAMPFIRE_RADIUS * CELL, color: 0xffb070, power: 1 });
    for (const b of done) {
      if (!FIRES.has(b.def)) continue;
      const def = BUILDING_BY_ID[b.def];
      sources.push({ x: (b.tile + (def?.width ?? 1) / 2) * CELL, y: (b.row + 0.5) * CELL, r: FIRE_RADIUS * CELL, color: 0xffa060, power: 0.9 });
    }
    const blockers = done.filter((b) => !b.room && !castle.has(b.row * w + b.tile)).map((b) => footprint(b));
    for (const src of sources) this.drawSource(src, this.calm ? [] : blockers);
    // the rooms lit by their sconces
    if (rooms.size) {
      const g = new Graphics();
      for (const cells of rooms.values()) for (const i of cells) g.rect(((i % w) * CELL) / SCALE, (Math.floor(i / w) * CELL) / SCALE, CELL / SCALE, CELL / SCALE).fill(ROOM);
      g.blendMode = 'add';
      this.renderer.render({ container: g, target: this.lights, clear: false });
      g.destroy();
      for (const l of L.lights) if (l.room !== null && l.lit) this.drawSource({ x: (l.x + 0.5) * CELL, y: (l.y + 0.8) * CELL, r: 2.2 * CELL, color: FLAME, power: 0.6 }, []);
    }
  }

  /** A room's cells: those of the castle reached from the sconce's cell without crossing into another room... the
   *  sim keeps the regions; here, near enough, the cells of the castle within the room's walls are those the flood
   *  reaches through cells the snapshot's rooms (buildings marked `room`) cover. */
  private roomCells(x: number, y: number, castle: Set<number>, snap: Snapshot): number[] {
    const w = snap.land.w;
    // the room building whose footprint holds the sconce, else the hall (castle cells under no room)
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

  /** One light into the land's light texture, with the shadows of the buildings in its reach. */
  private drawSource(src: Source, blockers: { x: number; y: number; w: number; h: number }[]): void {
    const size = Math.ceil((src.r * 2) / SCALE) + 2;
    if (!this.tmp || this.tmp.width < size) {
      this.tmp?.destroy(true);
      this.tmp = RenderTexture.create({ width: Math.max(size, 64), height: Math.max(size, 64), resolution: 1 });
    }
    const c = new Container();
    const glow = c.addChild(new Sprite(falloffTexture()));
    glow.anchor.set(0.5);
    glow.width = glow.height = (src.r * 2) / SCALE;
    glow.position.set(size / 2, size / 2);
    glow.tint = src.color;
    glow.alpha = src.power;
    // the shadows: each building's edges turned away from the light, thrown out past its reach
    const ox = src.x - (size / 2) * SCALE;
    const oy = src.y - (size / 2) * SCALE;
    const g = c.addChild(new Graphics());
    for (const b of blockers) {
      const bx = b.x * CELL;
      const by = b.y * CELL;
      const bw = b.w * CELL;
      const bh = b.h * CELL;
      if (bx > src.x + src.r || bx + bw < src.x - src.r || by > src.y + src.r || by + bh < src.y - src.r) continue;
      if (src.x > bx && src.x < bx + bw && src.y > by && src.y < by + bh) continue;
      const corners = [
        [bx, by],
        [bx + bw, by],
        [bx + bw, by + bh],
        [bx, by + bh],
      ];
      const normals = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ];
      for (let e = 0; e < 4; e++) {
        const a = corners[e];
        const b2 = corners[(e + 1) % 4];
        const mx = (a[0] + b2[0]) / 2 - src.x;
        const my = (a[1] + b2[1]) / 2 - src.y;
        if (mx * normals[e][0] + my * normals[e][1] <= 0) continue; // (facing the light: lit)
        const far = (p: number[]) => {
          const dx = p[0] - src.x;
          const dy = p[1] - src.y;
          const k = (src.r * 1.5) / Math.max(1, Math.hypot(dx, dy));
          return [p[0] + dx * k, p[1] + dy * k];
        };
        const fa = far(a);
        const fb = far(b2);
        const pt = (p: number[]) => [(p[0] - ox) / SCALE, (p[1] - oy) / SCALE];
        g.poly([...pt(a), ...pt(b2), ...pt(fb), ...pt(fa)]).fill(0x000000);
      }
    }
    this.renderer.render({ container: c, target: this.tmp, clear: true, clearColor: [0, 0, 0, 0] });
    c.destroy({ children: true });
    const sp = new Sprite(this.tmp);
    sp.blendMode = 'add';
    sp.position.set(ox / SCALE, oy / SCALE);
    this.renderer.render({ container: sp, target: this.lights!, clear: false });
    sp.destroy();
  }

  /** Each frame: the view's light put together for the hour (daylight 0..1), in the world at the view. */
  render(view: { x: number; y: number; w: number; h: number }, daylight: number): void {
    if (!this.shown || !this.lights) {
      this.sprite.visible = false;
      return;
    }
    const cave = this.caveCells.length > 0;
    if (daylight >= 0.999 && !cave) {
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
      this.out = RenderTexture.create({ width: tw, height: th, resolution: 1 });
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
    // the lanterns people carry
    if (lit.alpha > 0.2)
      for (const p of this.lanterns) {
        const s = c.addChild(new Sprite(falloffTexture()));
        s.anchor.set(0.5);
        s.blendMode = 'add';
        s.tint = LANTERN;
        s.alpha = lit.alpha * 0.8;
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
