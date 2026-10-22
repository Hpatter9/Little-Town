// The map of the floor a watched delve goes down (sim/delveFloors.ts), in the corner of the fight screen
// (fight/fightView.ts): the floor drawn from DawnLike's tiles (floorArt.ts) round the party, seen from above, the
// camera following them. Where they've been is lit dimly, what lies ahead is black until they come to it (a room shows
// whole as they enter it), and their own torches light the cells round them, less as the torches run low. Between rooms
// they're seen walking the way to the next (after stopping at the room's thing, as the side view has them), and a
// secret door shows as wall until they've gone through it. A delve whose rooms were rolled goes down a floor laid out
// from them (`generatedFloor`), so every delve has its map.
import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { hashSeed } from '../../shared/rng';
import { floorById, floorCell, floorPath, floorRooms, generatedFloor, FLOOR_ROCK, type FloorLook, type FloorRoom } from '../../shared/sim/delveFloors';
import type { HandMap } from '../../shared/sim/handMaps';
import type { ExpeditionView } from '../../shared/sim/snapshot';
import { loadImage } from '../art/loadImage';
import { glowTexture } from '../town/layer';
import { animated, groundTiles, propTiles, tileIndex, TILE_COLS, type Laid } from './floorArt';
import sheetUrl from '../art/floors/tiles.png';

type DelveView = NonNullable<ExpeditionView['delve']>;

let sheet: Texture | null = null;
let asked = false;
const frames = new Map<number, Texture>();
function tileTex(name: string): Texture | null {
  if (!sheet) {
    if (!asked) {
      asked = true;
      loadImage(sheetUrl).then(
        (im) => {
          sheet = Texture.from(im);
          sheet.source.scaleMode = 'nearest';
        },
        () => undefined,
      );
    }
    return null;
  }
  const i = tileIndex(name);
  if (i < 0) return null;
  let t = frames.get(i);
  if (!t) frames.set(i, (t = new Texture({ source: sheet.source, frame: new Rectangle((i % TILE_COLS) * 16, Math.floor(i / TILE_COLS) * 16, 16, 16) })));
  return t;
}

/** The share of a room's time the party stands at its thing before walking on (as fightView.ts's `STOP`). */
const STOP = 0.3;
/** How far the party's torches light (cells), by torches left; and how far round the way they've walked stays seen. */
const lightOf = (torches: number) => (torches <= 0 ? 1.6 : torches <= 2 ? 2.6 : 3.6);
const SEEN_R = 2;
/** A room shows this far from its middle (steps through open ground) once they reach it. */
const ROOM_R = 6;
/** The inset's cell size on screen (px). */
const CELL = 15;

export class FloorMap {
  readonly root = new Container();
  private readonly frame = new Graphics();
  private readonly clip = new Graphics();
  private readonly world = new Container();
  private readonly tiles = new Container();
  private readonly props = new Container();
  private readonly fog = new Graphics();
  private readonly light = new Sprite(glowTexture());
  private readonly party = new Graphics();
  private key = '';
  private map: HandMap | null = null;
  private rooms: FloorRoom[] = [];
  /** The way from each room to the next. */
  private ways: [number, number][][] = [];
  private secrets = new Set<number>();
  private foundKey = '';
  private fogKey = '';
  private anim: { s: Sprite; a: Texture | null; b: Texture | null }[] = [];
  private built = false;
  private view: { d: DelveView; id: number } | null = null;
  private iw = 0;
  private ih = 0;
  /** The party's place on the map (cells, fractional), eased toward where the delve says they are. */
  private at: [number, number] | null = null;

  constructor() {
    this.root.visible = false;
    this.light.anchor.set(0.5);
    this.light.tint = 0xffc070;
    this.light.blendMode = 'add';
    this.light.alpha = 0.35;
    this.world.addChild(this.tiles, this.props, this.light, this.party, this.fog);
    this.world.mask = this.clip;
    this.root.addChild(this.frame, this.clip, this.world);
  }

  /** The watched delve (null: none, or not inside). */
  update(d: DelveView | null, expedition: number): void {
    this.view = d ? { d, id: expedition } : null;
    this.root.visible = !!d;
    if (!d) return;
    const key = `${expedition}|${d.floor ?? d.plan.join(',')}|${d.look}`;
    if (key === this.key) return;
    this.key = key;
    this.map = floorById(d.floor) ?? generatedFloor(d.plan, hashSeed(`delveFloor:${expedition}`), d.look as FloorLook);
    this.rooms = floorRooms(this.map);
    this.ways = this.rooms.slice(1).map((r, i) => floorPath(this.map!, this.rooms[i], r) ?? [[this.rooms[i].u, this.rooms[i].v], [r.u, r.v]]);
    this.secrets = new Set();
    for (let v = 0; v < this.map.h; v++) for (let u = 0; u < this.map.w; u++) if (floorCell(this.map, u, v) === 'S') this.secrets.add(v * this.map.w + u);
    this.foundKey = '-';
    this.fogKey = '';
    this.built = false;
    this.at = null;
  }

  /** Where it sits on the screen: the top right of the scene's room (px), sized to the screen. */
  layout(w: number, top: number, room: number): void {
    const upright = w < 600;
    this.iw = Math.round(Math.min(w * (upright ? 0.5 : 0.28), 260));
    this.ih = Math.round(Math.max(60, Math.min(this.iw * (upright ? 0.72 : 0.62), room - 18)));
    this.root.position.set(Math.round(w - this.iw - 8), Math.round(top + 8));
    this.frame.clear().roundRect(-3, -3, this.iw + 6, this.ih + 6, 5).fill({ color: 0x080610, alpha: 0.9 }).stroke({ color: 0x8a7a5a, width: 2 });
    this.clip.clear().rect(0, 0, this.iw, this.ih).fill(0xffffff);
  }

  render(now: number, dt: number): void {
    const v = this.view;
    const m = this.map;
    if (!v || !m) return;
    const { d } = v;
    // where they are: at a room's thing, then walking the way to the next
    const room = Math.max(0, Math.min(this.rooms.length - 1, d.room));
    const way = this.ways[room];
    const walking = !d.cleared && d.room > 0 && !!way && d.progress > STOP && d.kind !== 'boss';
    const t = walking ? Math.min(1, (d.progress - STOP) / (1 - STOP)) : 0;
    const step = walking ? Math.min(way.length - 1, Math.floor(t * (way.length - 1))) : 0;
    const want: [number, number] = walking ? way[step] : [this.rooms[room].u, this.rooms[room].v];
    if (!this.at) this.at = [want[0], want[1]];
    const ease = Math.min(1, dt * 6);
    this.at[0] += (want[0] - this.at[0]) * ease;
    this.at[1] += (want[1] - this.at[1]) * ease;
    // the walked way: every way before this room's, and this one as far as they've gone
    const walked: [number, number][] = [];
    for (let i = 0; i < room; i++) walked.push(...this.ways[i]);
    if (walking) walked.push(...way.slice(0, step + 1));
    const found = [...this.secrets].filter((c) => walked.some(([u, v]) => v * m.w + u === c));
    const foundKey = found.join(',');
    if (foundKey !== this.foundKey || !this.built) {
      this.foundKey = foundKey;
      this.build(new Set(found));
    }
    const fogKey = `${room}|${step}|${walking}|${d.torches}`;
    if (fogKey !== this.fogKey) {
      this.fogKey = fogKey;
      this.drawFog(walked, room, want, d.torches);
    }
    // (the water ripples and the fires flicker: DawnLike's two frames)
    const flip = Math.floor(now / 420) % 2 === 1;
    for (const a of this.anim) {
      const tex = flip ? a.b : a.a;
      if (tex) a.s.texture = tex;
    }
    // the camera on the party
    const k = CELL / 16;
    this.world.scale.set(k);
    const px = (this.at[0] + 0.5) * 16;
    const py = (this.at[1] + 0.5) * 16;
    const cx = Math.max(Math.min(px, m.w * 16 - this.iw / k / 2), this.iw / k / 2);
    const cy = Math.max(Math.min(py, m.h * 16 - this.ih / k / 2), this.ih / k / 2);
    this.world.position.set(Math.round(this.iw / 2 - cx * k), Math.round(this.ih / 2 - cy * k));
    // the party: a knot of them round their torch, red-ringed while they fight
    const fighting = d.kind === 'fight' || d.kind === 'boss' || d.kind === 'rival' ? d.progress < 0.5 : false;
    this.party.clear();
    const bob = Math.sin(now / 160) * (walking ? 0.8 : 0);
    if (fighting) this.party.circle(px, py, 9 + Math.sin(now / 120) * 1.5).stroke({ color: 0xff4040, width: 1.5, alpha: 0.9 });
    const dots: [number, number, number][] = [[-3, 2, 0x5a8ae0], [3, 2, 0xe0c060], [0, -2.5, 0xe8e0d0]];
    for (const [ox, oy, c] of dots) this.party.circle(px + ox, py + oy + bob, 3.4).fill(0xf8f0e0).circle(px + ox, py + oy + bob, 2.6).fill(0x101018).circle(px + ox, py + oy + bob, 1.9).fill(c);
    this.party.circle(px + 6, py - 5, 1.8).fill(0xffd070);
    const r = lightOf(d.torches) * 16 * 2.2;
    this.light.position.set(px, py);
    this.light.width = this.light.height = r * (1 + Math.sin(now / 90) * 0.03);
  }

  private build(found: Set<number>): void {
    const m = this.map!;
    for (const c of [...this.tiles.removeChildren(), ...this.props.removeChildren()]) c.destroy();
    this.anim = [];
    let ok = true;
    const lay = (into: Container, l: Laid) => {
      const tex = tileTex(l.name);
      if (!tex) {
        ok = false;
        return;
      }
      const s = new Sprite(tex);
      s.position.set(l.u * 16, l.v * 16);
      into.addChild(s);
      if (animated(l.name)) this.anim.push({ s, a: tex, b: tileTex(`${l.name}@1`) });
    };
    for (const l of groundTiles(m, found)) lay(this.tiles, l);
    for (const l of propTiles(m)) lay(this.props, l);
    // (the sheet is still loading: try again next frame)
    this.built = ok;
  }

  /** Black where they haven't been, dim where they have, clear in their torchlight. */
  private drawFog(walked: [number, number][], room: number, at: [number, number], torches: number): void {
    const m = this.map!;
    const seen = new Uint8Array(m.w * m.h);
    const mark = (u: number, v: number, r: number) => {
      for (let y = Math.max(0, v - r); y <= Math.min(m.h - 1, v + r); y++) for (let x = Math.max(0, u - r); x <= Math.min(m.w - 1, u + r); x++) seen[y * m.w + x] = 1;
    };
    for (const [u, v] of walked) mark(u, v, SEEN_R);
    mark(at[0], at[1], SEEN_R);
    // (each room reached shows whole: open ground within a few steps of its middle, and the walls round it)
    for (let i = 0; i <= room; i++) {
      const r = this.rooms[i];
      const dist = new Map<number, number>([[r.v * m.w + r.u, 0]]);
      const queue = [r.v * m.w + r.u];
      for (let q = 0; q < queue.length; q++) {
        const c = queue[q];
        const u = c % m.w;
        const v = (c - u) / m.w;
        mark(u, v, 1);
        const n = dist.get(c)!;
        if (n >= ROOM_R) continue;
        for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nu = u + du;
          const nv = v + dv;
          const ch = floorCell(m, nu, nv);
          // (not out through a door or down a corridor: the room only)
          if (ch === FLOOR_ROCK || ch === '#' || ch === 'S' || ch === '+' || ch === ',' || dist.has(nv * m.w + nu)) continue;
          dist.set(nv * m.w + nu, n + 1);
          queue.push(nv * m.w + nu);
        }
      }
    }
    const light = lightOf(torches);
    this.fog.clear();
    for (let v = 0; v < m.h; v++) {
      for (let u = 0; u < m.w; u++) {
        const lit = Math.hypot(u - at[0], v - at[1]) <= light;
        if (lit) continue;
        this.fog.rect(u * 16, v * 16, 16, 16).fill({ color: 0x05040a, alpha: seen[v * m.w + u] ? 0.5 : 1 });
      }
    }
  }
}
