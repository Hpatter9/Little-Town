// A raid fought as a tactics battle (sim/tactics.ts), drawn as in Final Fantasy Tactics: the board of the town's own
// land seen from an angle, a diamond a tile, each tile a column as tall as its height. The tops are the map's own
// painted ground (MapView's chunks: the pack's patches, roads and paths), laid onto the diamond; the columns' sides
// are drawn (no pack has them): earth under a lip of turf, grey rock, sand, a building's block, a wall's stones. The
// map's trees stand on the forest tiles; the townsfolk and the raiders are the map's own (MapPeople, MapRaiders: the
// Himeko townsfolk four ways round, the raiders' sheets), stood on their tiles and sorted among the columns. Over it:
// the path the one whose turn it is walks, a ring under them and under whom they strike, the numbers of the blows,
// and the turn order down the side.

import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Snapshot, PersonView, RaiderView } from '../../shared/sim/snapshot';
import type { TacticsView, TacTile } from '../../shared/sim/tactics';
import { MapPeople } from '../map/mapPeople';
import { MapRaiders } from '../map/mapRaiders';
import type { MapView } from '../map/mapView';

/** A tile's diamond (px), and a step of height. */
const TW = 64;
const TH = 32;
const HH = 12;
/** How far the columns reach below the ground's level. */
const FOOT = 10;

const SIDES: Partial<Record<TacTile['g'], [string, string, string]>> = {
  grass: ['#7a5636', '#5f412a', '#5e8a36'],
  fertile: ['#6e4a2c', '#553822', '#5a8232'],
  forest: ['#6a4a2e', '#513822', '#3f6a2a'],
  marsh: ['#5a4a32', '#463824', '#4f6a3a'],
  hill: ['#7d6a4e', '#62523c', '#6f8a40'],
  sand: ['#c9a86a', '#a88a52', '#d8c088'],
  rock: ['#77736c', '#5d5a55', '#8e8a82'],
  mountain: ['#6a6660', '#524f4a', '#86827a'],
  hall: ['#5a5650', '#45423e', '#6e6a64'],
  water: ['#2e5a86', '#244a70', '#3e74a8'],
  shallows: ['#3a6e94', '#2e5a7c', '#5a90b8'],
};

export class TacticsScene {
  readonly root = new Container();
  private readonly back = new Graphics();
  private readonly world = new Container();
  private readonly board = new Container();
  private readonly marks = new Graphics();
  private readonly fx = new Container();
  private readonly people: MapPeople;
  private readonly raiders: MapRaiders;
  private readonly hud = new Container();
  private readonly title = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 15, fill: 0xfff4d8, stroke: { color: 0x1a120c, width: 4 }, fontWeight: 'bold' } });
  private readonly line = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 12, fill: 0xe8dcc0, stroke: { color: 0x1a120c, width: 3 } } });
  private readonly order = new Container();
  private view: TacticsView | null = null;
  private key = '';
  private tiles: Container[] = [];
  private hits = new Map<string, Text>();
  private cam = { x: 0, y: 0, k: 1 };
  private w = 400;
  private h = 400;
  private snap: Snapshot | null = null;

  constructor(private readonly map: MapView) {
    this.root.visible = false;
    this.board.sortableChildren = true;
    this.people = new MapPeople(this.board);
    this.raiders = new MapRaiders(this.board);
    this.people.raid = true;
    this.world.addChild(this.board, this.fx);
    this.board.addChild(this.marks);
    this.marks.zIndex = -1e9;
    this.hud.addChild(this.title, this.line, this.order);
    this.root.addChild(this.back, this.world, this.hud);
  }

  get shown(): boolean {
    return this.root.visible;
  }

  /** Where a tile's top centre is (world px, before the scene's scale). */
  private at(u: number, v: number, h: number): [number, number] {
    return [(u - v) * (TW / 2), (u + v) * (TH / 2) - h * HH];
  }

  update(next: Snapshot): void {
    const t = next.tactics;
    this.snap = next;
    this.view = t;
    this.root.visible = !!t;
    if (!t) {
      if (this.key) {
        for (const c of this.tiles) c.destroy({ children: true });
        this.tiles = [];
        this.key = '';
        this.people.update([], null, performance.now());
        this.raiders.update([], performance.now());
      }
      return;
    }
    const key = `${t.w}x${t.h}:${t.tiles.map((x) => `${x.lx},${x.ly},${x.h}`).join(';').length}:${t.tiles[0].lx},${t.tiles[0].ly}:${t.side}`;
    if (key !== this.key || this.tiles.some((c) => !c.children.length)) this.build(t, key);
    // the townsfolk and the raiders, each on their tile
    const tileH = (u: number, v: number) => t.tiles[v * t.w + u]?.h ?? 0;
    const people: PersonView[] = [];
    const raiders: RaiderView[] = [];
    for (const u of t.units) {
      const [x, y] = this.at(u.u, u.v, tileH(u.u, u.v));
      // (facing: down the board to the right, down to the left, or away)
      const dir: 1 | -1 = u.facing === 0 || u.facing === 3 ? 1 : -1;
      if (u.key[0] === 'p') {
        const p = next.people.find((q) => q.id === u.ref);
        if (p) people.push({ ...p, x, y, dir, indoors: false, defending: true, swimming: false });
      } else {
        const r = next.raid?.raiders.find((q) => q.id === u.ref);
        if (r) raiders.push({ ...r, x, y, dir, swimming: false, floor: null });
      }
    }
    const now = performance.now();
    this.people.update(people, null, now);
    this.raiders.update(raiders, now);
    this.drawMarks(t);
    this.drawHud(t);
  }

  /** The board's columns, painted once (again when the tops' ground has been painted). */
  private build(t: TacticsView, key: string): void {
    for (const c of this.tiles) c.destroy({ children: true });
    this.tiles = [];
    this.key = key;
    let missing = false;
    for (let v = 0; v < t.h; v++)
      for (let u = 0; u < t.w; u++) {
        const tile = t.tiles[v * t.w + u];
        const c = new Container();
        const tex = this.column(tile, t.side);
        if (!tex) missing = true;
        else {
          const s = new Sprite(tex);
          const [x, y] = this.at(u, v, tile.h);
          s.position.set(x - TW / 2, y - TH / 2);
          c.addChild(s);
        }
        // a tree on the woods (the map's own)
        if (tile.tree) {
          const tt = this.map.propOf(tile.lx, tile.ly);
          if (tt) {
            const s = new Sprite(tt);
            s.anchor.set(0.5, 0.95);
            const [x, y] = this.at(u, v, tile.h);
            s.position.set(x + 6, y - 2);
            s.scale.set(0.95);
            c.addChild(s);
          }
        }
        const [, y] = this.at(u, v, tile.h);
        c.zIndex = y - 1;
        this.board.addChild(c);
        this.tiles.push(c);
      }
    if (missing) this.key = ''; // (the ground isn't painted yet: try again on the next snapshot)
  }

  /** One tile's column: its top, the map's painted ground laid on the diamond, and its two sides down to the foot. */
  private column(tile: TacTile, side: -1 | 1): Texture | null {
    const depth = tile.h * HH + FOOT;
    const c = document.createElement('canvas');
    c.width = TW;
    c.height = TH + depth;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    const [l, r, lip] = tile.block === 'building' ? ['#b89a6a', '#97784c', '#7a3f2e'] : tile.block === 'wall' ? ['#8a857c', '#6e6a62', '#a39e94'] : (SIDES[tile.g] ?? SIDES.grass!);
    // the two sides (left: the +v face, right: the +u face), with strata every step
    const face = (pts: [number, number][], col: string) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
      g.closePath();
      g.fill();
    };
    face([[0, TH / 2], [TW / 2, TH], [TW / 2, TH + depth], [0, TH / 2 + depth]], l);
    face([[TW / 2, TH], [TW, TH / 2], [TW, TH / 2 + depth], [TW / 2, TH + depth]], r);
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 1;
    for (let k = HH; k < depth; k += HH) {
      g.beginPath();
      g.moveTo(0, TH / 2 + k);
      g.lineTo(TW / 2, TH + k);
      g.lineTo(TW, TH / 2 + k);
      g.stroke();
    }
    // (a little speckle of stones in the earth)
    for (let i = 0; i < depth / 3; i++) {
      const sx = ((tile.lx * 31 + tile.ly * 17 + i * 13) % (TW - 4)) + 2;
      const k = ((tile.lx * 7 + i * 29) % Math.max(1, depth - 4)) + 2;
      const y = (sx < TW / 2 ? TH / 2 + sx / 2 : TH - (sx - TW / 2) / 2) + k;
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.16)';
      g.fillRect(sx, y, 2, 1);
    }
    // a lip of the top's stuff over the sides
    face([[0, TH / 2], [TW / 2, TH], [TW, TH / 2], [TW, TH / 2 + 3], [TW / 2, TH + 3], [0, TH / 2 + 3]], lip);
    // the top: the map's ground laid onto the diamond (a building's or a wall's block is its own roof or walk)
    g.save();
    g.beginPath();
    g.moveTo(TW / 2, 0);
    g.lineTo(TW, TH / 2);
    g.lineTo(TW / 2, TH);
    g.lineTo(0, TH / 2);
    g.closePath();
    g.clip();
    if (tile.block) {
      g.fillStyle = tile.block === 'building' ? '#8a4632' : '#9a958a';
      g.fillRect(0, 0, TW, TH);
      g.fillStyle = tile.block === 'building' ? '#6e3424' : '#7e7a70';
      for (let k = 4; k < TW; k += 8) g.fillRect(k, 0, 2, TH);
    } else {
      const ground = this.map.groundOf(tile.lx, tile.ly);
      if (!ground) {
        g.restore();
        return null;
      }
      // (the cell's square onto the diamond: across the cell runs down to the right, down it down to the left; a raid
      // from the east has the board turned, so its cells are mirrored)
      const a = TW / 64;
      const b = TH / 64;
      if (side < 0) g.setTransform(a, b, -a, b, TW / 2, 0);
      else g.setTransform(-a, -b, -a, b, TW / 2 + 32 * a, 32 * b);
      g.drawImage(ground.src, ground.sx, ground.sy, 32, 32, 0, 0, 32, 32);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    // (the top lit a little, its edges drawn)
    g.fillStyle = 'rgba(255,248,220,0.06)';
    g.fillRect(0, 0, TW, TH);
    g.restore();
    g.strokeStyle = 'rgba(20,14,8,0.35)';
    g.beginPath();
    g.moveTo(TW / 2, 0.5);
    g.lineTo(TW - 0.5, TH / 2);
    g.lineTo(TW / 2, TH - 0.5);
    g.lineTo(0.5, TH / 2);
    g.closePath();
    g.stroke();
    return Texture.from(c);
  }

  /** The path walked this turn, a ring under the one whose turn it is and under whom they strike. */
  private drawMarks(t: TacticsView): void {
    const g = this.marks;
    g.clear();
    const diamond = (u: number, v: number, color: number, alpha: number, fill = true) => {
      const h = t.tiles[v * t.w + u]?.h ?? 0;
      const [x, y] = this.at(u, v, h);
      const pts = [x, y - TH / 2 + 2, x + TW / 2 - 3, y, x, y + TH / 2 - 2, x - TW / 2 + 3, y];
      if (fill) g.poly(pts).fill({ color, alpha });
      g.poly(pts).stroke({ color, width: 2, alpha: Math.min(1, alpha * 2.5) });
    };
    const a = t.act;
    if (!a) return;
    for (const [u, v] of a.path ?? []) diamond(u, v, 0x58a8ff, 0.28);
    const me = t.units.find((x) => x.key === a.key);
    if (me) diamond(me.u, me.v, me.foe ? 0xff5040 : 0xffe070, 0.3);
    const target = a.target ? t.units.find((x) => x.key === a.target) : undefined;
    if (target) diamond(target.u, target.v, 0xff3020, 0.35);
    // (the marks sit on the tops: above their columns, under whoever stands on them)
    g.zIndex = -1e9;
  }

  private drawHud(t: TacticsView): void {
    const a = t.act;
    const me = a ? t.units.find((x) => x.key === a.key) : undefined;
    const target = a?.target ? t.units.find((x) => x.key === a.target) : undefined;
    const doing = !a ? '' : a.kind === 'strike' ? `strikes ${target?.name ?? ''}` : a.kind === 'shoot' ? `shoots at ${target?.name ?? ''}` : a.kind === 'cast' ? `casts at ${target?.name ?? ''}` : a.kind === 'flee' ? 'runs for it' : 'moves';
    this.title.text = me ? `${me.name} ${doing}` : 'The battle is joined';
    const foes = t.units.filter((u) => u.foe && !u.ally).length;
    this.line.text = `Turn ${t.turns} · ${foes + t.waiting} raiders left${t.waiting ? ` (${t.waiting} coming)` : ''} · ${t.killed} down${t.through ? ` · ${t.through} through` : ''}`;
    // the turns to come
    for (const c of this.order.removeChildren()) c.destroy();
    let y = 0;
    const head = new Text({ text: 'Next', style: { fontFamily: 'monospace', fontSize: 11, fill: 0xd8c8a0, stroke: { color: 0x1a120c, width: 3 } } });
    this.order.addChild(head);
    y += 15;
    for (const o of t.order.slice(0, 7)) {
      const chip = new Container();
      const bg = new Graphics().roundRect(0, 0, 104, 17, 4).fill({ color: o.foe ? 0x5a1a14 : 0x1a3456, alpha: 0.88 }).stroke({ color: o.foe ? 0xe06048 : 0x70a8e8, width: 1 });
      const name = new Text({ text: o.name.length > 13 ? `${o.name.slice(0, 12)}…` : o.name, style: { fontFamily: 'monospace', fontSize: 11, fill: 0xffffff } });
      name.position.set(5, 2);
      chip.addChild(bg, name);
      chip.position.set(0, y);
      this.order.addChild(chip);
      y += 20;
    }
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  render(now: number): void {
    const t = this.view;
    if (!t) return;
    const { w, h } = this;
    // the sky behind the board
    this.back.clear();
    this.back.rect(0, 0, w, h).fill({ color: 0x1c2638 });
    this.back.rect(0, h * 0.55, w, h * 0.45).fill({ color: 0x141a26 });
    // the scale: the board fits the screen, never smaller than a size the townsfolk can be seen at (a narrow phone then
    // follows the one whose turn it is)
    const span = (t.w + t.h) * (TW / 2);
    const tall = (t.w + t.h) * (TH / 2) + 6 * HH;
    const fit = Math.min((w - 20) / span, (h - 70) / tall);
    const k = Math.max(0.8, Math.min(1.6, fit));
    // (the board's middle, or the one acting where it doesn't all fit: kept so the board's edge never leaves a gap)
    const minX = -(t.h - 1) * (TW / 2) - TW / 2;
    const maxX = (t.w - 1) * (TW / 2) + TW / 2;
    const minY = -6 * HH - TH;
    const maxY = (t.w + t.h - 2) * (TH / 2) + TH / 2 + FOOT + HH;
    const me = t.act ? t.units.find((x) => x.key === t.act!.key) : undefined;
    const [mx, my] = me ? this.at(me.u, me.v, t.tiles[me.v * t.w + me.u]?.h ?? 0) : this.at((t.w - 1) / 2, (t.h - 1) / 2, 1);
    const axis = (want: number, lo: number, hi: number, room: number) => (hi - lo <= room ? (lo + hi) / 2 : Math.max(lo + room / 2, Math.min(hi - room / 2, want)));
    const focus: [number, number] = [axis(mx, minX, maxX, (w - 16) / k), axis(my, minY, maxY, (h - 110) / k)];
    const ease = this.cam.k === 1 && this.cam.x === 0 ? 1 : 0.08;
    this.cam.x += (focus[0] - this.cam.x) * ease;
    this.cam.y += (focus[1] - this.cam.y) * ease;
    this.cam.k = k;
    this.world.scale.set(k);
    this.world.position.set(Math.round(w / 2 - this.cam.x * k), Math.round(55 + (h - 110) / 2 - this.cam.y * k));
    this.people.render(now);
    this.raiders.render(now);
    // the blows' numbers, rising and fading
    const seen = new Set<string>();
    for (const x of t.hits) {
      const id = `${x.u},${x.v},${x.text},${x.age - (x.age % 1000)}`;
      seen.add(id);
      let tx = this.hits.get(id);
      if (!tx) {
        const miss = !/^\d/.test(x.text);
        tx = new Text({ text: x.text, style: { fontFamily: 'monospace', fontSize: miss ? 13 : 17, fontWeight: 'bold', fill: miss ? 0xd0d0d0 : x.foe ? 0xffffff : 0xff6a5a, stroke: { color: 0x120a06, width: 4 } } });
        tx.anchor.set(0.5, 1);
        (tx as Text & { born?: number }).born = now - x.age * 100;
        this.fx.addChild(tx);
        this.hits.set(id, tx);
      }
      const born = (tx as Text & { born?: number }).born ?? now;
      const life = (now - born) / 1000;
      const [hx, hy] = this.at(x.u, x.v, t.tiles[x.v * t.w + x.u]?.h ?? 0);
      tx.position.set(hx, hy - 52 - Math.min(1, life) * 18);
      tx.alpha = Math.max(0, 1 - Math.max(0, life - 1.1) * 1.5);
    }
    for (const [id, tx] of this.hits)
      if (!seen.has(id)) {
        tx.destroy();
        this.hits.delete(id);
      }
    // the HUD: what's happening along the top, the turns to come down the right
    this.title.position.set(12, h - 46);
    this.line.position.set(12, h - 24);
    this.order.position.set(w - 116, 56);
    void this.snap;
  }
}
