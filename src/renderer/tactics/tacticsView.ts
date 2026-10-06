// A raid fought as a tactics battle (sim/tactics.ts), drawn as in Final Fantasy Tactics: the board of the town's own
// land seen from an angle, a diamond a tile, each tile a column as tall as its height. The tops are the map's own
// painted ground (MapView's chunks: the pack's patches, roads and paths) laid onto the diamond; the columns' sides are
// drawn (no pack has them): earth under a lip of turf, grey rock, sand. The town's buildings stand on the board as the
// map draws them (their pack pictures), its walls as ramparts, its traps as their pictures; the map's trees stand on
// the woods. The townsfolk and the raiders are the map's own (MapPeople, MapRaiders: the Himeko townsfolk four ways
// round, the raiders' sheets), stood on their tiles and sorted among the columns.
//
// Over it, as in FFT: the tiles the one whose turn it is may walk to (blue) and strike (red), the path they walk, a
// ring under them; the blows' numbers; the spells' and skills' effects (the packs' sheets, fight/actLooks.ts) and the
// arrows in flight; the ability's name in a box; a count over anyone struck down, a mark over the raid's leader, the
// chests the fallen left; the turn order down the side; the unit's status box (name, calling, level, health, how far
// they move and jump) and the target's beside it; the words across the screen as the battle turns. When the player
// gives the orders (Auto off) the box has the menu: Move, Act (Attack, the kit's spells and skills, Tend), Wait.

import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Snapshot, PersonView, RaiderView } from '../../shared/sim/snapshot';
import type { TacticsView, TacTile, TacUnitView } from '../../shared/sim/tactics';
import type { Command } from '../../shared/sim/commands';
import { MapPeople } from '../map/mapPeople';
import { MapRaiders } from '../map/mapRaiders';
import type { MapView } from '../map/mapView';
import { SHEETS } from '../town/spellsView';
import { actIdOf, actSprite } from '../fight/actLooks';
import { loadDelveProps, propFrame } from '../art/delveProps';
import type { SpriteFx } from '../town/spellLooks';

/** A tile's diamond (px), and a step of height. */
const TW = 64;
const TH = 32;
const HH = 12;
/** How far the columns reach below the ground's level. */
const FOOT = 10;
/** A sim tick (ms). */
const TICK = 100;

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

const FONT = 'monospace';
const style = (size: number, fill: number, bold = false, stroke = 4) => ({ fontFamily: FONT, fontSize: size, fill, fontWeight: bold ? ('bold' as const) : ('normal' as const), stroke: { color: 0x120a06, width: stroke } });

/** A button on the HUD: where it is on the screen and what a tap does. */
interface Button {
  x: number;
  y: number;
  w: number;
  h: number;
  fn: () => void;
}

type Mode = 'menu' | 'move' | 'act' | 'attack' | 'aim';

export class TacticsScene {
  readonly root = new Container();
  private readonly back = new Graphics();
  private readonly world = new Container();
  private readonly board = new Container();
  private readonly fx = new Container();
  private readonly fxSprites = new Container();
  private readonly lines = new Graphics();
  private readonly people: MapPeople;
  private readonly raiders: MapRaiders;
  private readonly hud = new Container();
  private readonly shade = new Graphics();
  private view: TacticsView | null = null;

  private key = '';
  private tiles: { c: Container; mark: Graphics; top: number }[] = [];
  private pictures: Sprite[] = [];
  private hits = new Map<string, { t: Text; born: number }>();
  private marks: Text[] = [];
  private chestSprites: Sprite[] = [];
  private cam = { x: 0, y: 0, k: 1, set: false, panX: 0, panY: 0 };
  private w = 400;
  private h = 400;
  private buttons: Button[] = [];
  private mode: Mode = 'menu';
  private modeFor = '';
  private aimSkill: string | null = null;
  private selected: string | null = null;
  private skillPage = 0;
  private hudKey = '';
  private lastUpdate = 0;

  constructor(
    private readonly map: MapView,
    private readonly command: (c: Command) => void,
  ) {
    this.root.visible = false;
    this.board.sortableChildren = true;
    this.people = new MapPeople(this.board);
    this.raiders = new MapRaiders(this.board);
    this.people.raid = true;
    this.fx.addChild(this.lines, this.fxSprites);
    this.world.addChild(this.board, this.fx);
    this.root.addChild(this.back, this.world, this.shade, this.hud);
    loadDelveProps();
  }

  get shown(): boolean {
    return this.root.visible;
  }

  /** Where a tile's top centre is (world px, before the scene's scale). */
  private at(u: number, v: number, h: number): [number, number] {
    return [(u - v) * (TW / 2), (u + v) * (TH / 2) - h * HH];
  }
  private tileH(u: number, v: number): number {
    const t = this.view;
    const tile = t?.tiles[v * t.w + u];
    if (!tile) return 0;
    return tile.block === 'building' && this.pictureOf(tile) ? tile.h - 3 : tile.h;
  }
  private pictureOf(tile: TacTile) {
    return tile.bld !== undefined ? this.map.buildingPicture(tile.bld) : null;
  }

  update(next: Snapshot): void {
    const t = next.tactics;

    this.view = t;
    this.root.visible = !!t;
    this.lastUpdate = performance.now();
    if (!t) {
      if (this.key) {
        for (const c of this.tiles) c.c.destroy({ children: true });
        for (const p of this.pictures) p.destroy();
        this.tiles = [];
        this.pictures = [];
        this.key = '';
        this.people.update([], null, performance.now());
        this.raiders.update([], performance.now());
        this.cam.set = false;
        this.selected = null;
      }
      return;
    }
    const pics = t.tiles.filter((x) => x.bld !== undefined && this.map.buildingPicture(x.bld)).length;
    const key = `${t.w}x${t.h}:${t.tiles[0].lx},${t.tiles[0].ly}:${t.side}:${t.tiles.map((x) => x.h).join('')}:${pics}`;
    if (key !== this.key || this.tiles.length === 0) this.build(t, key);
    // the townsfolk and the raiders, each on their tile
    const people: PersonView[] = [];
    const raiders: RaiderView[] = [];
    for (const u of t.units) {
      if (u.tower) continue;
      const [x, y] = this.at(u.u, u.v, this.tileH(u.u, u.v));
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
    // (a new turn waiting on the player opens on the menu)
    if (t.orders && t.orders.key !== this.modeFor) {
      this.modeFor = t.orders.key;
      this.mode = 'menu';
      this.aimSkill = null;
      this.skillPage = 0;
    }
    if (!t.orders) this.modeFor = '';
    this.drawMarks(t);
    this.drawChests(t);
    this.hudKey = '';
  }

  /** The board's columns, painted once (again when the tops' ground has been painted). */
  private build(t: TacticsView, key: string): void {
    for (const c of this.tiles) c.c.destroy({ children: true });
    for (const p of this.pictures) p.destroy();
    this.tiles = [];
    this.pictures = [];
    this.key = key;
    let missing = false;
    for (let v = 0; v < t.h; v++)
      for (let u = 0; u < t.w; u++) {
        const tile = t.tiles[v * t.w + u];
        const c = new Container();
        const pic = tile.block === 'building' ? this.pictureOf(tile) : null;
        const h = pic ? tile.h - 3 : tile.h;
        const tex = this.column(tile, t.side, h, !!pic);
        if (!tex) missing = true;
        else {
          const s = new Sprite(tex);
          const [x, y] = this.at(u, v, h);
          s.position.set(x - TW / 2, y - TH / 2);
          c.addChild(s);
        }
        const mark = new Graphics();
        c.addChild(mark);
        // a tree on the woods (the map's own)
        if (tile.tree) {
          const tt = this.map.propOf(tile.lx, tile.ly);
          if (tt) {
            const s = new Sprite(tt);
            s.anchor.set(0.5, 0.95);
            const [x, y] = this.at(u, v, h);
            s.position.set(x + 6, y - 2);
            s.scale.set(0.95);
            c.addChild(s);
          }
        }
        // a trap, as its picture, small on the tile
        if (tile.trap !== undefined) {
          const tp = this.map.buildingPicture(tile.trap);
          if (tp) {
            const s = new Sprite(tp.tex);
            s.anchor.set(0.5, 0.75);
            const k = Math.min(1, (TW * 0.7) / Math.max(1, tp.w));
            s.scale.set(k);
            const [x, y] = this.at(u, v, h);
            s.position.set(x, y);
            c.addChild(s);
          }
        }
        const [, y] = this.at(u, v, h);
        c.zIndex = y - 1;
        this.board.addChild(c);
        this.tiles.push({ c, mark, top: y });
      }
    // the town's buildings, standing on their tiles as the map draws them
    const seen = new Set<number>();
    for (const tile of t.tiles) {
      if (tile.bld === undefined || seen.has(tile.bld) || tile.block === 'wall') continue;
      seen.add(tile.bld);
      const pic = this.map.buildingPicture(tile.bld);
      if (!pic) continue;
      const cells = t.tiles.map((x, i) => [x, i] as const).filter(([x]) => x.bld === tile.bld);
      const us = cells.map(([, i]) => i % t.w);
      const vs = cells.map(([, i]) => Math.floor(i / t.w));
      const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
      const ground = tile.h - 3;
      // (its foot at the footprint's front corner, its width the footprint's across the screen)
      const [fx, fy] = this.at(u1 + 0.5, v1 + 0.5, ground);
      const [lx] = this.at(u0 - 0.5, v1 + 0.5, ground);
      const [rx] = this.at(u1 + 0.5, v0 - 0.5, ground);
      const wide = Math.max(TW, rx - lx);
      const s = new Sprite(pic.tex);
      const k = (wide * 0.92) / Math.max(1, pic.w);
      s.scale.set(k);
      s.anchor.set(0.5, 1);
      s.position.set((lx + rx) / 2, fy - 2);
      s.zIndex = fy - TH / 2;
      void fx;
      this.board.addChild(s);
      this.pictures.push(s);
    }
    if (missing) this.key = ''; // (the ground isn't painted yet: try again on the next snapshot)
  }

  /** One tile's column: its top, the map's painted ground laid on the diamond, and its two sides down to the foot. */
  private column(tile: TacTile, side: -1 | 1, h: number, underBuilding: boolean): Texture | null {
    const depth = h * HH + FOOT;
    const c = document.createElement('canvas');
    c.width = TW;
    c.height = TH + depth;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    const blockTop = tile.block && !underBuilding;
    const [l, r, lip] = blockTop && tile.block === 'building' ? ['#b89a6a', '#97784c', '#7a3f2e'] : blockTop ? ['#8a857c', '#6e6a62', '#a39e94'] : (SIDES[tile.g] ?? SIDES.grass!);
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
    // (a wall's stones; else a little speckle of stones in the earth)
    if (blockTop && tile.block === 'wall') {
      g.strokeStyle = 'rgba(40,36,30,0.45)';
      for (let k = 5; k < depth; k += 6)
        for (let x = (k / 6) % 2 ? 4 : 10; x < TW; x += 12) {
          const y = (x < TW / 2 ? TH / 2 + x / 2 : TH - (x - TW / 2) / 2) + k;
          g.strokeRect(x - 4, y - 2, 8, 5);
        }
    } else
      for (let i = 0; i < depth / 3; i++) {
        const sx = ((tile.lx * 31 + tile.ly * 17 + i * 13) % (TW - 4)) + 2;
        const k = ((tile.lx * 7 + i * 29) % Math.max(1, depth - 4)) + 2;
        const y = (sx < TW / 2 ? TH / 2 + sx / 2 : TH - (sx - TW / 2) / 2) + k;
        g.fillStyle = i % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.16)';
        g.fillRect(sx, y, 2, 1);
      }
    // a lip of the top's stuff over the sides
    face([[0, TH / 2], [TW / 2, TH], [TW, TH / 2], [TW, TH / 2 + 3], [TW / 2, TH + 3], [0, TH / 2 + 3]], lip);
    // the top: the map's ground laid onto the diamond (a block's own roof or rampart walk)
    g.save();
    g.beginPath();
    g.moveTo(TW / 2, 0);
    g.lineTo(TW, TH / 2);
    g.lineTo(TW / 2, TH);
    g.lineTo(0, TH / 2);
    g.closePath();
    g.clip();
    if (blockTop) {
      g.fillStyle = tile.block === 'building' ? '#8a4632' : '#a7a296';
      g.fillRect(0, 0, TW, TH);
      g.fillStyle = tile.block === 'building' ? '#6e3424' : '#8b867a';
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

  /** The tiles lit on the board: where the one whose turn it is may walk and strike, the path, rings. */
  private drawMarks(t: TacticsView): void {
    for (const x of this.tiles) x.mark.clear();
    const diamond = (u: number, v: number, color: number, alpha: number, fill = true, width = 2) => {
      const tile = this.tiles[v * t.w + u];
      if (!tile) return;
      const [x, y] = this.at(u, v, this.tileH(u, v));
      const pts = [x, y - TH / 2 + 2, x + TW / 2 - 3, y, x, y + TH / 2 - 2, x - TW / 2 + 3, y];
      if (fill) tile.mark.poly(pts).fill({ color, alpha });
      tile.mark.poly(pts).stroke({ color, width, alpha: Math.min(1, alpha * 2.6) });
    };
    const o = t.orders;
    if (o) {
      const unitAt = (k: string) => t.units.find((u) => u.key === k);
      if (this.mode === 'menu' || this.mode === 'move') for (const [u, v] of o.reach) diamond(u, v, 0x4a9cff, this.mode === 'move' ? 0.38 : 0.16);
      const targets = this.mode === 'aim' && this.aimSkill ? (o.skills.find((s) => s.id === this.aimSkill)?.targets ?? []) : this.mode === 'attack' || this.mode === 'menu' || this.mode === 'act' ? o.strike : [];
      const friendly = this.mode === 'aim' && o.skills.find((s) => s.id === this.aimSkill)?.aim !== 'foe';
      for (const k of targets) {
        const u = unitAt(k);
        if (u) diamond(u.u, u.v, friendly ? 0x50e070 : 0xff4030, this.mode === 'menu' ? 0.14 : 0.4);
      }
      for (const k of o.tend) {
        const u = unitAt(k);
        if (u) diamond(u.u, u.v, 0x50e070, 0.35);
      }
    }
    const a = t.act;
    if (a) for (const [u, v] of a.path) diamond(u, v, 0x58a8ff, 0.3);
    const active = a?.key ?? o?.key;
    const me = active ? t.units.find((x) => x.key === active) : undefined;
    if (me) diamond(me.u, me.v, me.foe ? 0xff5040 : 0xffe070, 0.32, true, 3);
    const target = a?.target ? t.units.find((x) => x.key === a.target) : undefined;
    if (target) diamond(target.u, target.v, 0xff3020, 0.4, true, 3);
    const sel = this.selected ? t.units.find((x) => x.key === this.selected) : undefined;
    if (sel && sel !== me) diamond(sel.u, sel.v, 0xffffff, 0.18, true, 2);
  }

  /** The chests the fallen left, and the marks over people: a count over the struck-down, a star over the leader. */
  private drawChests(t: TacticsView): void {
    for (const s of this.chestSprites) s.destroy();
    this.chestSprites = [];
    for (const c of t.chests) {
      const tex = propFrame('chest', 0);
      if (!tex) continue;
      const s = new Sprite(tex);
      s.anchor.set(0.5, 0.85);
      s.scale.set(0.7);
      const [x, y] = this.at(c.u, c.v, this.tileH(c.u, c.v));
      s.position.set(x, y);
      s.zIndex = y - 0.5;
      this.board.addChild(s);
      this.chestSprites.push(s);
    }
    for (const m of this.marks) m.destroy();
    this.marks = [];
    for (const u of t.units) {
      if (u.count === null && !u.leader) continue;
      const [x, y] = this.at(u.u, u.v, this.tileH(u.u, u.v));
      const m = new Text({ text: u.count !== null ? `${u.count}` : '★', style: style(u.count !== null ? 18 : 15, u.count !== null ? (u.count <= 1 ? 0xff5040 : 0xffe070) : 0xffd040, true) });
      m.anchor.set(0.5, 1);
      m.position.set(x, y - (u.count !== null ? 26 : 70));
      this.fx.addChild(m);
      this.marks.push(m);
    }
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  /** A finger dragged across the board: look about it. */
  pan(dx: number, dy: number): void {
    this.cam.panX -= dx / this.cam.k;
    this.cam.panY -= dy / this.cam.k;
  }

  render(now: number): void {
    const t = this.view;
    if (!t) return;
    const { w, h } = this;
    // the sky behind the board, darker by night
    this.back.clear();
    this.back.rect(0, 0, w, h).fill({ color: t.night ? 0x0e1424 : 0x1c2638 });
    this.back.rect(0, h * 0.55, w, h * 0.45).fill({ color: t.night ? 0x0a0e18 : 0x141a26 });
    // the scale: the board fits the screen, never smaller than the townsfolk can be seen at (a narrow phone then
    // follows the one whose turn it is); a drag looks about
    const span = (t.w + t.h) * (TW / 2);
    const tall = (t.w + t.h) * (TH / 2) + 6 * HH;
    const top = 52;
    const bottom = t.orders ? 150 : 96;
    const fit = Math.min((w - 16) / span, (h - top - bottom) / tall);
    // (upright the board is narrow on the screen: drawn a little bigger, the camera following the action)
    const k = Math.max(h > w ? 1.05 : 0.8, Math.min(1.5, fit));
    const minX = -(t.h - 1) * (TW / 2) - TW / 2;
    const maxX = (t.w - 1) * (TW / 2) + TW / 2;
    const minY = -6 * HH - TH;
    const maxY = (t.w + t.h - 2) * (TH / 2) + TH / 2 + FOOT + HH;
    const activeKey = t.act?.key ?? t.orders?.key;
    const me = activeKey ? t.units.find((x) => x.key === activeKey) : undefined;
    const [mx, my] = me ? this.at(me.u, me.v, this.tileH(me.u, me.v)) : this.at((t.w - 1) / 2, (t.h - 1) / 2, 1);
    const roomW = (w - 16) / k;
    const roomH = (h - top - bottom) / k;
    const axis = (want: number, lo: number, hi: number, room: number) => (hi - lo <= room ? (lo + hi) / 2 : Math.max(lo + room / 2, Math.min(hi - room / 2, want)));
    const fx = axis(mx + this.cam.panX, minX, maxX, roomW);
    const fy = axis(my + this.cam.panY, minY, maxY, roomH);
    // (the pan is let go of as the turn passes, so the next one is seen)
    this.cam.panX *= 0.985;
    this.cam.panY *= 0.985;
    const ease = this.cam.set ? 0.1 : 1;
    this.cam.x += (fx - this.cam.x) * ease;
    this.cam.y += (fy - this.cam.y) * ease;
    this.cam.k = k;
    this.cam.set = true;
    // (an ultimate shakes the board)
    const ult = t.fx.some((f) => f.ult && f.age < 8);
    const shake = ult ? (Math.random() - 0.5) * 8 : 0;
    this.world.scale.set(k);
    this.world.position.set(Math.round(w / 2 - this.cam.x * k + shake), Math.round(top + (h - top - bottom) / 2 - this.cam.y * k + shake * 0.6));
    this.people.render(now);
    this.raiders.render(now);
    this.renderFx(t, now);
    this.renderNumbers(t, now);
    // (night: a blue dark over the field, the HUD clear of it)
    this.shade.clear();
    if (t.night) this.shade.rect(0, 0, w, h).fill({ color: 0x0a1030, alpha: 0.28 });
    if (ult) this.shade.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: Math.max(0, 0.25 - (t.fx.find((f) => f.ult)?.age ?? 9) * 0.03) });
    this.renderHud(t, now);
  }

  /** The arrows in flight, the slashes and the spells' sheets where they land. */
  private renderFx(t: TacticsView, now: number): void {
    this.lines.clear();
    for (const c of this.fxSprites.removeChildren()) c.destroy();
    const since = (now - this.lastUpdate) / TICK;
    const lift = (u: number, v: number, up = 26): [number, number] => {
      const [x, y] = this.at(u, v, this.tileH(u, v));
      return [x, y - up];
    };
    for (const f of t.fx) {
      const age = f.age + since;
      if (f.kind === 'shot' || f.kind === 'tower') {
        const from = lift(f.from[0], f.from[1], f.kind === 'tower' ? 60 : 30);
        for (const [u, v] of f.to) {
          const to = lift(u, v);
          const p = Math.min(1, age / 3);
          if (p >= 1 && age > 4) continue;
          const x = from[0] + (to[0] - from[0]) * p;
          const arc = Math.sin(p * Math.PI) * (f.kind === 'tower' ? 10 : 22);
          const y = from[1] + (to[1] - from[1]) * p - arc;
          const back = Math.max(0, p - 0.12);
          const bx = from[0] + (to[0] - from[0]) * back;
          const by = from[1] + (to[1] - from[1]) * back - Math.sin(back * Math.PI) * (f.kind === 'tower' ? 10 : 22);
          this.lines.moveTo(bx, by).lineTo(x, y).stroke({ color: f.kind === 'tower' ? 0xffe080 : 0xf0e6d0, width: f.kind === 'tower' ? 3 : 2 });
          if (p >= 1) this.sheet('slash_gold', to[0], to[1] + 6, age - 3, 0.55);
        }
        continue;
      }
      const look: SpriteFx | null = f.kind === 'blow' ? 'slash_gold' : f.kind === 'act' && f.name ? actSprite(actIdOf(f.name)) : f.kind === 'tend' ? 'heal' : f.kind === 'chest' ? 'mg_sparks' : f.kind === 'lost' ? 'holy' : f.kind === 'trap' ? 'mg_spikes' : f.kind === 'stun' ? 'mg_sparks' : null;
      if (!look) continue;
      const at = f.to.length ? f.to : [f.from];
      at.forEach(([u, v], i) => {
        const [x, y] = lift(u, v, 20);
        this.sheet(look, x, y, age - i * 0.8, f.kind === 'blow' ? 0.6 : 0.85);
      });
      // (a spell or skill: a ring of light under its caster as it goes off)
      if (f.kind === 'act' && age < 8) {
        const [x, y] = this.at(f.from[0], f.from[1], this.tileH(f.from[0], f.from[1]));
        this.lines.ellipse(x, y, 26, 13).stroke({ color: f.ult ? 0xffc040 : 0x9ad0ff, width: 2, alpha: 1 - age / 8 });
      }
    }
  }

  /** One frame of an effect sheet at an age in ticks. */
  private sheet(look: SpriteFx, x: number, y: number, age: number, scale: number): void {
    const sh = SHEETS[look];
    if (!sh || age < 0) return;
    const frame = sh.frame((age / 10) * sh.fps);
    if (!frame) return;
    const s = new Sprite(frame);
    s.anchor.set(0.5);
    const size = sh.size * (sh.scale ?? 1) * scale;
    s.width = s.height = size;
    s.position.set(x, y - size / 2 + sh.foot * (sh.scale ?? 1) * scale);
    if (sh.glow) s.blendMode = 'add';
    this.fxSprites.addChild(s);
  }

  /** The blows' numbers, rising and fading. */
  private renderNumbers(t: TacticsView, now: number): void {
    const seen = new Set<string>();
    for (const x of t.hits) {
      const id = `${x.u},${x.v},${x.text},${Math.round((this.lastUpdate - x.age * TICK) / 400)}`;
      seen.add(id);
      let n = this.hits.get(id);
      if (!n) {
        const word = !/^[\d+]/.test(x.text);
        const t2 = new Text({ text: x.text, style: style(word ? 13 : 19, x.heal ? 0x7cff8a : word ? 0xd8d8d8 : x.foe ? 0xffffff : 0xff6a5a, true) });
        t2.anchor.set(0.5, 1);
        this.fx.addChild(t2);
        n = { t: t2, born: now - x.age * TICK };
        this.hits.set(id, n);
      }
      const life = (now - n.born) / 1000;
      const [hx, hy] = this.at(x.u, x.v, this.tileH(x.u, x.v));
      // (a number bounces up and settles, as FFT's do)
      const bounce = life < 0.35 ? Math.sin((life / 0.35) * Math.PI) * 10 : 0;
      n.t.position.set(hx, hy - 50 - Math.min(1, life) * 10 - bounce);
      n.t.alpha = Math.max(0, 1 - Math.max(0, life - 1.2) * 1.6);
    }
    for (const [id, n] of this.hits)
      if (!seen.has(id)) {
        n.t.destroy();
        this.hits.delete(id);
      }
  }

  /* ------------------------------------------------------------ the HUD */

  private renderHud(t: TacticsView, now: number): void {
    // (redrawn when what it shows changes, and while the banners fade)
    const key = `${this.w}x${this.h}|${t.turns}|${t.act?.key}|${t.act?.stage}|${this.mode}|${this.aimSkill}|${this.selected}|${this.skillPage}|${t.orders?.left}|${t.orders?.moved}|${t.orders?.acted}|${t.auto}|${t.banner?.age}|${t.fx.map((f) => f.age).join(',')}|${t.units.map((u) => u.hp).join(',')}|${t.speed}`;
    if (key === this.hudKey) return;
    this.hudKey = key;
    for (const c of this.hud.removeChildren()) c.destroy({ children: true });
    this.buttons = [];
    const { w, h } = this;
    const up = w < 600;
    // the objective and the field's conditions, top left
    const head = new Text({ text: t.objective, style: style(14, 0xffe8a0, true) });
    head.position.set(10, 46);
    this.hud.addChild(head);
    const over = t.phase === 'done';
    const line = new Text({ text: over ? `${t.turns} turns · ${t.killed} down${t.lost ? ` · ${t.lost} lost` : ''}` : `Turn ${t.turns} · ${t.units.filter((u) => u.foe && !u.ally).length + t.waiting} raiders left${t.waiting ? ` (${t.waiting} to come)` : ''} · ${t.killed} down${t.lost ? ` · ${t.lost} lost` : ''}${t.conditions ? `\n${t.conditions}` : ''}`, style: style(11, 0xe0d4b8, false, 3) });
    line.position.set(10, 64);
    this.hud.addChild(line);
    // the turns to come, down the right
    const chips = over ? 0 : up ? 5 : 8;
    let y = 48;
    const next = new Text({ text: 'Next', style: style(11, 0xd8c8a0, true, 3) });
    next.position.set(w - 98, y);
    if (!over) this.hud.addChild(next);
    y += 15;
    for (const o of t.order.slice(0, chips)) {
      const g = new Graphics().roundRect(0, 0, 92, 16, 4).fill({ color: o.foe ? 0x5a1a14 : 0x1a3456, alpha: 0.9 }).stroke({ color: o.foe ? 0xe06048 : 0x70a8e8, width: 1 });
      g.position.set(w - 98, y);
      const n = new Text({ text: o.name.length > 12 ? `${o.name.slice(0, 11)}…` : o.name, style: { fontFamily: FONT, fontSize: 10, fill: 0xffffff } });
      n.position.set(w - 94, y + 2);
      this.hud.addChild(g, n);
      y += 19;
    }
    // the ability being used, in a box at the top (FFT's)
    const act = [...t.fx].reverse().find((f) => f.kind === 'act' && f.name && f.age < 14);
    if (act) {
      const label = new Text({ text: act.name!, style: style(15, act.ult ? 0xffd060 : 0xffffff, true, 3) });
      const bw = label.width + 28;
      const box = new Graphics().roundRect(0, 0, bw, 28, 6).fill({ color: act.ult ? 0x5a2008 : 0x1a2a5a, alpha: 0.92 }).stroke({ color: act.ult ? 0xffb040 : 0x9ab8f0, width: 2 });
      box.position.set((w - bw) / 2, up ? 96 : 48);
      label.position.set((w - bw) / 2 + 14, (up ? 96 : 48) + 5);
      this.hud.addChild(box, label);
    }
    // the words across the screen
    if (t.banner && (t.banner.age < 30 || over)) {
      const big = t.banner.kind === 'win' || t.banner.kind === 'lose' || t.banner.kind === 'start';
      const col = t.banner.kind === 'win' ? 0xffe070 : t.banner.kind === 'lose' || t.banner.kind === 'lost' ? 0xff6050 : 0xffffff;
      const b = new Text({ text: t.banner.text, style: style(big ? 30 : 22, col, true, 6) });
      b.anchor.set(0.5);
      // (the last word stays up as long as the board does)
      b.alpha = Math.max(0, Math.min(1, t.banner.age < 3 ? t.banner.age / 3 : over ? 1 : 1 - (t.banner.age - 22) / 8));
      b.position.set(w / 2, h * 0.38);
      const s = Math.min(1, (w - 30) / Math.max(1, b.width));
      b.scale.set(s);
      this.hud.addChild(b);
    }
    // the unit boxes: whose turn it is, and the target (or the one tapped)
    const activeKey = t.act?.key ?? t.orders?.key;
    const me = activeKey ? t.units.find((x) => x.key === activeKey) : undefined;
    const other = (this.selected && t.units.find((x) => x.key === this.selected)) || (t.act?.target ? t.units.find((x) => x.key === t.act!.target) : undefined);
    const boxW = Math.min(200, (w - 24) / 2);
    const boxY = h - (t.orders ? 140 : 84);
    if (me) this.unitBox(me, 8, boxY, boxW);
    // (the target beside it upright; sideways above it, clear of the notices in the corner)
    if (other && other !== me) {
      if (up) this.unitBox(other, w - boxW - 8, boxY, boxW);
      else this.unitBox(other, 8, boxY - 78, boxW);
    }
    // the player's orders, along the bottom
    if (t.orders) this.ordersBar(t, h - 50);
    // the corner buttons: the town plays itself, and the battle's speed
    if (over) return;
    const auto = this.button(t.auto ? 'Auto ▶' : 'Auto ❚❚', w - 74, h - (t.orders ? 140 : 84) - 32, 66, 26, () => this.command({ type: 'tactics', order: { op: 'auto', on: !t.auto } }), t.auto);
    void auto;
    const speed = t.speed;
    this.button(`${speed}×`, w - 112, h - (t.orders ? 140 : 84) - 32, 34, 26, () => this.command({ type: 'battleSpeed', speed: (speed % 3) + 1 }));
    void now;
  }

  private unitBox(u: TacUnitView, x: number, y: number, w: number): void {
    const col = u.foe ? 0x5a1a14 : u.tower ? 0x3a3a3a : 0x14284a;
    const g = new Graphics().roundRect(0, 0, w, 72, 6).fill({ color: col, alpha: 0.92 }).stroke({ color: u.foe ? 0xe07060 : 0x8ab4f0, width: 2 });
    g.position.set(x, y);
    this.hud.addChild(g);
    const name = new Text({ text: `${u.leader ? '★ ' : ''}${u.name}`, style: style(13, 0xffffff, true, 3) });
    name.position.set(x + 8, y + 5);
    const sub = new Text({ text: u.tower ? 'Tower' : `${u.title}${u.level ? ` · Lv ${u.level}` : ''}`, style: { fontFamily: FONT, fontSize: 10, fill: 0xd8d0c0 } });
    sub.position.set(x + 8, y + 22);
    this.hud.addChild(name, sub);
    if (!u.tower) {
      const share = Math.max(0, Math.min(1, u.hp / Math.max(1, u.max)));
      const bar = new Graphics();
      bar.rect(0, 0, w - 16, 6).fill({ color: 0x2a1a14 });
      bar.rect(0, 0, (w - 16) * share, 6).fill({ color: share > 0.6 ? 0x5ad04a : share > 0.3 ? 0xe0b030 : 0xe04838 });
      bar.position.set(x + 8, y + 38);
      const hp = new Text({ text: u.count !== null ? `DOWN · ${u.count} turn${u.count === 1 ? '' : 's'} left` : `HP ${u.hp}/${u.max}`, style: { fontFamily: FONT, fontSize: 10, fill: u.count !== null ? 0xff8070 : 0xffffff } });
      hp.position.set(x + 8, y + 46);
      const mv = new Text({ text: `Mv ${u.move} Jp ${u.jump} Rg ${u.reach}${u.st.length ? ` · ${u.st.slice(0, 2).join(', ')}` : ''}`, style: { fontFamily: FONT, fontSize: 10, fill: 0xc8c0e0 } });
      mv.position.set(x + 8, y + 58);
      this.hud.addChild(bar, hp, mv);
    }
  }

  private button(label: string, x: number, y: number, w: number, h: number, fn: () => void, on = false, enabled = true): Graphics {
    const g = new Graphics().roundRect(0, 0, w, h, 6).fill({ color: !enabled ? 0x2a2a2a : on ? 0x2a5a2a : 0x2a2440, alpha: 0.95 }).stroke({ color: enabled ? 0xd8c890 : 0x666666, width: 2 });
    g.position.set(x, y);
    const t = new Text({ text: label, style: { fontFamily: FONT, fontSize: 12, fill: enabled ? 0xffffff : 0x888888, fontWeight: 'bold' } });
    t.anchor.set(0.5);
    t.position.set(x + w / 2, y + h / 2);
    if (t.width > w - 6) t.scale.set((w - 6) / t.width);
    this.hud.addChild(g, t);
    if (enabled) this.buttons.push({ x, y, w, h, fn });
    return g;
  }

  /** The menu: Move, Act, Wait (and Undo); Act opens Attack, the spells and skills, Tend. */
  private ordersBar(t: TacticsView, y: number): void {
    const o = t.orders!;
    const { w } = this;
    const back = new Graphics().roundRect(0, 0, w - 8, 44, 8).fill({ color: 0x100c18, alpha: 0.85 });
    back.position.set(4, y - 4);
    this.hud.addChild(back);
    const wait = () => this.command({ type: 'tactics', order: { op: 'wait', facing: this.faceToward(t) } });
    if (this.mode === 'act' || this.mode === 'aim' || this.mode === 'attack') {
      // the act menu: Attack, Tend, the kit (a page at a time), Back
      const items: { label: string; fn: () => void; on?: boolean; enabled?: boolean }[] = [];
      items.push({ label: 'Attack', fn: () => (this.mode = 'attack'), on: this.mode === 'attack', enabled: o.strike.length > 0 });
      if (o.tend.length) items.push({ label: 'Tend', fn: () => this.command({ type: 'tactics', order: { op: 'tend', target: o.tend[0] } }) });
      const per = Math.max(1, Math.floor((w - 8) / 92) - items.length - 1);
      const skills = o.skills.filter((s) => s.aim === 'self' || s.targets.length);
      const page = skills.slice(this.skillPage * per, this.skillPage * per + per);
      for (const s of page)
        items.push({
          label: `${s.name}${s.cost ? ` ${s.cost}${s.pool === 'mp' ? 'MP' : s.pool === 'sp' ? 'SP' : ''}` : ''}`,
          on: this.aimSkill === s.id,
          enabled: s.ready,
          fn: () => {
            if (s.aim === 'self') this.command({ type: 'tactics', order: { op: 'skill', skill: s.id } });
            else {
              this.mode = 'aim';
              this.aimSkill = s.id;
            }
          },
        });
      if (skills.length > per) items.push({ label: '›', fn: () => (this.skillPage = (this.skillPage + 1) % Math.ceil(skills.length / per)) });
      items.push({ label: 'Back', fn: () => ((this.mode = 'menu'), (this.aimSkill = null)) });
      const bw = Math.min(110, (w - 16) / items.length - 4);
      items.forEach((it, i) => this.button(it.label, 8 + i * (bw + 4), y, bw, 36, it.fn, it.on, it.enabled ?? true));
    } else {
      const items: { label: string; fn: () => void; on?: boolean; enabled?: boolean }[] = [
        { label: 'Move', fn: () => (this.mode = this.mode === 'move' ? 'menu' : 'move'), on: this.mode === 'move', enabled: !o.moved && o.reach.length > 1 },
        { label: 'Act', fn: () => (this.mode = 'act'), enabled: !o.acted },
        ...(o.moved && !o.acted ? [{ label: 'Undo', fn: () => this.command({ type: 'tactics', order: { op: 'undo' } }) }] : []),
        { label: 'Wait', fn: wait },
      ];
      const bw = Math.min(110, (w - 16) / items.length - 4);
      items.forEach((it, i) => this.button(it.label, 8 + i * (bw + 4), y, bw, 36, it.fn, it.on, it.enabled ?? true));
    }
    const hint = this.mode === 'move' ? 'Tap a blue tile to move' : this.mode === 'attack' ? 'Tap a red target' : this.mode === 'aim' ? 'Tap a target' : `${o.left}s, then the town acts`;
    const tx = new Text({ text: hint, style: style(10, 0xd8d0b0, false, 3) });
    tx.position.set(10, y - 18);
    this.hud.addChild(tx);
  }

  /** The way to face on waiting: toward the nearest foe. */
  private faceToward(t: TacticsView): number {
    const me = t.units.find((u) => u.key === t.orders?.key);
    if (!me) return 0;
    const foe = t.units.filter((u) => u.foe !== me.foe && !u.tower).sort((a, b) => Math.abs(a.u - me.u) + Math.abs(a.v - me.v) - (Math.abs(b.u - me.u) + Math.abs(b.v - me.v)))[0];
    if (!foe) return me.facing;
    const du = foe.u - me.u;
    const dv = foe.v - me.v;
    return Math.abs(du) >= Math.abs(dv) ? (du > 0 ? 0 : 2) : dv > 0 ? 1 : 3;
  }

  /* ------------------------------------------------------------ taps */

  /** Where a unit stands on the screen (strip px), for previews. */
  screenOf(key: string): [number, number] | null {
    const u = this.view?.units.find((x) => x.key === key);
    if (!u) return null;
    const [x, y] = this.at(u.u, u.v, this.tileH(u.u, u.v));
    return [this.world.position.x + x * this.cam.k, this.world.position.y + (y - 20) * this.cam.k];
  }
  /** And a tile. */
  screenOfTile(u: number, v: number): [number, number] {
    const [x, y] = this.at(u, v, this.tileH(u, v));
    return [this.world.position.x + x * this.cam.k, this.world.position.y + y * this.cam.k];
  }

  /** A tap on the screen (strip px): a button, a target, a tile to move to, or a unit to look at. True if it was ours. */
  tap(sx: number, sy: number): boolean {
    const t = this.view;
    if (!t) return false;
    for (const b of this.buttons)
      if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
        b.fn();
        this.hudKey = '';
        if (this.view) this.drawMarks(this.view);
        return true;
      }
    // the board: which tile (front to back), and who's on it
    const wx = (sx - this.world.position.x) / this.cam.k;
    const wy = (sy - this.world.position.y) / this.cam.k;
    const unitHit = [...t.units]
      .filter((u) => !u.tower)
      .sort((a, b) => b.u + b.v - (a.u + a.v))
      .find((u) => {
        const [x, y] = this.at(u.u, u.v, this.tileH(u.u, u.v));
        return Math.abs(wx - x) < 16 && wy < y + 6 && wy > y - 54;
      });
    let tile: [number, number] | null = null;
    for (let d = t.w + t.h - 2; d >= 0 && !tile; d--)
      for (let u = Math.max(0, d - t.h + 1); u <= Math.min(t.w - 1, d); u++) {
        const v = d - u;
        const [x, y] = this.at(u, v, this.tileH(u, v));
        if (Math.abs(wx - x) / (TW / 2) + Math.abs(wy - y) / (TH / 2) <= 1) {
          tile = [u, v];
          break;
        }
      }
    const o = t.orders;
    const target = unitHit ?? (tile ? t.units.find((u) => u.u === tile![0] && u.v === tile![1]) : undefined);
    if (o) {
      if (this.mode === 'move' && tile && o.reach.some(([u, v]) => u === tile![0] && v === tile![1])) {
        this.command({ type: 'tactics', order: { op: 'move', u: tile[0], v: tile[1] } });
        this.mode = 'menu';
        return true;
      }
      if ((this.mode === 'attack' || this.mode === 'menu' || this.mode === 'act') && target && o.strike.includes(target.key)) {
        this.command({ type: 'tactics', order: { op: 'attack', target: target.key } });
        this.mode = 'menu';
        return true;
      }
      if (this.mode === 'aim' && this.aimSkill && target && o.skills.find((s) => s.id === this.aimSkill)?.targets.includes(target.key)) {
        this.command({ type: 'tactics', order: { op: 'skill', skill: this.aimSkill, target: target.key } });
        this.mode = 'menu';
        this.aimSkill = null;
        return true;
      }
      if (this.mode === 'menu' && tile && o.reach.some(([u, v]) => u === tile![0] && v === tile![1]) && !target) {
        this.command({ type: 'tactics', order: { op: 'move', u: tile[0], v: tile[1] } });
        return true;
      }
    }
    this.selected = target ? (this.selected === target.key ? null : target.key) : null;
    this.hudKey = '';
    this.drawMarks(t);
    return true;
  }
}
