// The town seen isometrically (being built: Settings' "Isometric view (in progress)" turns it on; the top-down
// map/mapView.ts is still the game's view). Only the drawing differs: the land's cells are laid as diamonds
// (iso/isoMath.ts), the ground drawn with the town's people's kit tiles and each building with the kit's piece for it
// (iso/isoKits.ts). The townsfolk are the top-down view's own (map/mapPeople.ts draws them into `things` in world px):
// `placeLoose` moves whatever it put there to its spot on the diamonds and sorts it among the buildings.
//
// Walls, streets as streets, props, lights, the weather and the other map layers are left for later: in this view
// the walls are fitted pieces of the kit, the roads its path tile, and the rest isn't drawn.

import { Container, Graphics, Matrix, Rectangle, Sprite, Texture } from 'pixi.js';
import { CELL, WEAR_FULL, WEAR_SHOW, cellAt, groundAt, inMap, wet as wetCell, type LandMap } from '../../shared/sim/land';
import { glowTexture } from '../town/layer';
import type { Biome } from '../../shared/data/biomes';
import { footprint } from '../../shared/sim/buildings';
import type { Building } from '../../shared/sim/state';
import { loadImage } from '../art/loadImage';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { cellHash, gateFlip, propFor, sceneryFor, wallMaskAt, wallPieceFor, wallShape } from './isoTown';
import { fitted, groundTile, kitOf, kitUrl, pieceFor, roleOf, ISO_ART, type Kit } from './isoKits';
import { anyoneNear, doorSpot, gateSpan, hasWindows, lightBox, swing, windowSpots, worldMatrix } from './isoLight';
import { cellsInView, footBase, footDepth, footWidth, isoBounds, isoOrigin, isoToWorld, ISO_TH, ISO_TW, standingDepth, tileToIso, worldToIso, type Rect } from './isoMath';

/** A building's picture may stand this much wider than its footprint before it is shrunk to fit (a big piece on a
 *  small building: a cottage piece on a one-cell trap). */
const OVERHANG = 1.25;
/** Ground tiles are drawn this much over their cell so neighbours overlap and no edge shows. */
const OVERLAP = 1.06;

interface DrawnBuilding {
  sprite: Sprite;
  key: string;
  foot: Rect;
  /** The props beside it (a barrel, a crate: iso/isoTown.ts `propFor`). */
  props: Sprite[];
  /** Its door or gate, drawn open while someone walks through (0 shut to 1 open; `held` seconds until it closes). */
  door?: { g: Graphics; gate: boolean; open: number; held: number };
  /** Its windows' glow after dark. */
  windows: Sprite[];
}

export class IsoView {
  /** Screen space (the camera moves `world`). */
  readonly root = new Container();
  readonly world = new Container();
  private readonly ground = new Container();
  /** The buildings and everything standing on the land, sorted by depth (`placeLoose`). */
  readonly things = new Container();
  /** The pictures this view put in `things` itself (all else there is someone else's, in world px). */
  private readonly own = new Set<Container>();
  /** Where `placeLoose` last put each of the others, and the zIndex it gave (moved since: placed again). */
  private readonly placed = new WeakMap<Container, { x: number; y: number; z: number; off: number }>();
  private land: LandMap | null = null;
  private ox = 0;
  /** The land's size on the screen (px): the camera's bounds. */
  width = 0;
  height = 0;
  private kit: Kit = kitOf('settlers');
  private readonly tex = new Map<string, Texture | null>();
  /** Bumped when a picture arrives: the ground and the buildings drawn again with it. */
  private texGen = 0;
  private readonly tiles: Sprite[] = [];
  /** The per-cell ground over the blocks (streets, footpaths, fields), and the land's trees, bushes and rocks. */
  private readonly cellTiles: Sprite[] = [];
  private readonly scenery: Sprite[] = [];
  private readonly overlay = new Container();
  /** Layers laid in world px through the affine map of the diamonds (`worldMatrix`): `flat` on the ground, under the
   *  things (blood, puddles: the top-down map's `under`), `lightLayer` over them all (the light map). */
  readonly flat = new Container();
  readonly lightLayer = new Container();
  /** After dark: the windows' and lamps' glow (added), the marked cells for clearing, the doors and gates. */
  private readonly glow = new Container();
  /** (over the light map, so the marks show plainly at night too) */
  private readonly marks = new Graphics();
  /** Fog and the like that drifts over the land in screen px (the sky's banks: map/mapSky.ts). */
  readonly air = new Container();
  private lamps: { x: number; y: number }[] = [];
  private lampSprites: Sprite[] = [];
  private markedKey = '';
  private highlight: number | null = null;
  private biome: Biome = 'forest';
  /** The cells walls, gates and grates stand on (y * land width + x), for joining them. */
  private wallCells = new Set<number>();
  private groundKey = '';
  private readonly fieldCells = new Set<number>();
  private readonly buildings = new Map<number, DrawnBuilding>();
  private builtFrom: Building[] = [];
  private builtGen = -1;
  /** The view the camera last showed (screen px on the diamonds). */
  view = { x: 0, y: 0, w: 0, h: 0 };

  constructor() {
    this.things.sortableChildren = true;
    this.glow.blendMode = 'add';
    this.glow.eventMode = 'none';
    this.lightLayer.eventMode = 'none';
    this.flat.eventMode = 'none';
    this.world.addChild(this.ground, this.overlay, this.flat, this.things, this.lightLayer, this.glow, this.marks);
    this.root.addChild(this.world, this.air);
  }

  /** The kit the town is drawn with (iso/isoKits.ts `kitNameFor`). */
  setKit(name: string): void {
    if (name === this.kit.name) return;
    this.kit = kitOf(name);
    this.groundKey = '';
    for (const d of this.buildings.values()) d.key = '';
  }

  /** The land's biome: its ground tinted to match (data/biomes.ts). */
  setBiome(b: Biome | undefined): void {
    if ((b ?? 'forest') === this.biome) return;
    this.biome = b ?? 'forest';
    this.groundKey = '';
  }

  /** The land (every snapshot): its size, and the ground drawn again when it changed. */
  syncLand(land: LandMap): void {
    if (!this.land || this.land.w !== land.w || this.land.h !== land.h) {
      this.ox = isoOrigin(land.h);
      const m = worldMatrix(this.ox);
      for (const c of [this.flat, this.lightLayer]) c.setFromMatrix(new Matrix(m.a, m.b, m.c, m.d, m.tx, m.ty));
      const b = isoBounds(land.w, land.h);
      this.width = b.w;
      this.height = b.h;
    }
    if (this.land?.version !== land.version) this.groundKey = '';
    this.land = land;
    this.drawMarks();
  }

  /** The cells marked for clearing (a pale outline and a faint X on each diamond), and the one under the finger. */
  setHighlight(cell: number | null): void {
    if (cell === this.highlight) return;
    this.highlight = cell;
    this.markedKey = '';
    this.drawMarks();
  }
  private drawMarks(): void {
    const land = this.land;
    if (!land) return;
    const key = `${land.w}|${land.marked.join(',')}|${this.highlight}`;
    if (key === this.markedKey) return;
    this.markedKey = key;
    const g = this.marks.clear();
    const diamond = (cx: number, cy: number, inset: number) => {
      const p = [tileToIso(cx + inset, cy + inset, this.ox), tileToIso(cx + 1 - inset, cy + inset, this.ox), tileToIso(cx + 1 - inset, cy + 1 - inset, this.ox), tileToIso(cx + inset, cy + 1 - inset, this.ox)];
      return p;
    };
    for (const i of land.marked) {
      const c = cellAt(land, i);
      const p = diamond(c.x, c.y, 0.04);
      g.poly(p.flatMap((q) => [q.x, q.y])).fill({ color: 0xffe080, alpha: 0.22 }).stroke({ color: 0xffe080, width: 3, alpha: 0.95 });
      const q = diamond(c.x, c.y, 0.25);
      g.moveTo(q[0].x, q[0].y).lineTo(q[2].x, q[2].y).moveTo(q[1].x, q[1].y).lineTo(q[3].x, q[3].y).stroke({ color: 0xfff0b0, width: 3, alpha: 0.8 });
    }
    if (this.highlight !== null && !land.marked.includes(this.highlight)) {
      const c = cellAt(land, this.highlight);
      g.poly(diamond(c.x, c.y, 0.04).flatMap((q) => [q.x, q.y])).fill({ color: 0xffffff, alpha: 0.16 }).stroke({ color: 0xffffff, width: 3, alpha: 0.95 });
    }
  }

  /** How dark it is, 0 (day) to 1: the windows' and lamps' glow shows by it (the same the top-down lights layer uses). */
  setNight(alpha: number): void {
    this.glow.alpha = alpha;
    this.glow.visible = alpha > 0.02;
  }

  /** The street lamps and torches lit now (cells): a small flame glow on each, over the light map's pool. */
  setLamps(lit: readonly { x: number; y: number }[]): void {
    const same = lit.length === this.lamps.length && lit.every((l, i) => l.x === this.lamps[i].x && l.y === this.lamps[i].y);
    if (same) return;
    this.lamps = lit.map((l) => ({ x: l.x, y: l.y }));
    for (const s of this.lampSprites) s.destroy();
    this.lampSprites = this.lamps.map((l) => {
      const s = new Sprite(glowTexture());
      s.anchor.set(0.5);
      s.tint = 0xffb060;
      s.width = s.height = 22;
      const p = tileToIso(l.x + 0.5, l.y + 0.5, this.ox);
      s.position.set(Math.round(p.x), Math.round(p.y - 12));
      this.glow.addChild(s);
      return s;
    });
  }

  /** A square of world px covering the whole screen, for the layers worked out in world px (the light map). */
  lightView(): { x: number; y: number; w: number; h: number } {
    return lightBox(this.view, this.ox);
  }

  /** A kit piece's picture, asked for the first time it's wanted (null until it has loaded). */
  private texOf(piece: string): Texture | null {
    const url = kitUrl(this.kit.name, piece);
    const had = this.tex.get(url);
    if (had !== undefined) return had;
    this.tex.set(url, null);
    loadImage(url)
      .then((im) => {
        this.tex.set(url, Texture.from(im));
        this.texGen++;
      })
      .catch(() => undefined);
    return null;
  }

  /** A ground tile's top face alone (the slab under it cut off, so no edge shows as a line between neighbours). */
  private surfaces = new Map<string, { of: Texture; face: Texture }>();
  private surfaceOf(piece: string): Texture | null {
    const tex = this.texOf(piece);
    if (!tex) return null;
    const key = `${this.kit.name}:${piece}`;
    const had = this.surfaces.get(key);
    if (had?.of === tex) return had.face;
    const face = new Texture({ source: tex.source, frame: new Rectangle(tex.frame.x, tex.frame.y, tex.width, Math.min(tex.height, Math.round(tex.width / 2))) });
    this.surfaces.set(key, { of: tex, face });
    return face;
  }

  /** The buildings (every snapshot): each on its footprint, a crop's field as field tiles in the ground. */
  syncBuildings(list: Building[]): void {
    if (list === this.builtFrom && this.builtGen === this.texGen) return;
    this.builtFrom = list;
    this.builtGen = this.texGen;
    const land = this.land;
    const seen = new Set<number>();
    const fields = new Set<number>();
    const walls = new Set<number>();
    if (land)
      for (const b of list) {
        const d = roleOf(b.def);
        if (!('role' in d) || (d.role !== 'wall_run' && d.role !== 'gate') || !BUILDING_BY_ID[b.def]?.hp) continue;
        const f = footprint(b);
        for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) walls.add(y * land.w + x);
      }
    this.wallCells = walls;
    const isWall = (x: number, y: number) => !!land && inMap(land, x, y) && walls.has(y * land.w + x);
    for (const b of list) {
      const foot = footprint(b);
      if ('field' in roleOf(b.def)) {
        if (land) for (let y = foot.y; y < foot.y + foot.h; y++) for (let x = foot.x; x < foot.x + foot.w; x++) fields.add(y * land.w + x);
        continue;
      }
      seen.add(b.id);
      let piece = pieceFor(this.kit, b.def);
      let flip = false;
      const role = roleOf(b.def);
      if ('role' in role && (role.role === 'wall_run' || role.role === 'gate') && land) {
        const ids = [...this.kit.pieces.keys()];
        if (role.role === 'gate') {
          flip = gateFlip(foot);
          piece = wallPieceFor(ids, 'gate', b.def) ?? piece;
        } else {
          // (a one-cell wall joins the walls beside it: a run along x or y, or a corner)
          const m = wallMaskAt(isWall, foot.x, foot.y);
          const shape = wallShape(m);
          flip = shape.flip;
          piece = wallPieceFor(ids, shape.part, b.def) ?? piece;
        }
      }
      const tex = this.texOf(piece);
      const key = `${this.kit.name}:${piece}:${flip ? 'f' : ''}:${b.status}:${foot.x},${foot.y},${foot.w},${foot.h}:${tex ? 1 : 0}:${this.texGen}`;
      let d = this.buildings.get(b.id);
      if (!d) {
        const sprite = new Sprite();
        sprite.anchor.set(0.5, 1);
        this.things.addChild(sprite);
        this.own.add(sprite);
        d = { sprite, key: '', foot, props: [], windows: [] };
        this.buildings.set(b.id, d);
      }
      d.foot = foot;
      if (d.key === key) continue;
      d.key = key;
      const s = d.sprite;
      s.visible = !!tex;
      if (!tex) continue;
      s.texture = tex;
      const span = footWidth(foot);
      const k = fitted(b.def) ? span / tex.width : Math.min(this.kit.scale * ISO_ART, (span * OVERHANG) / tex.width);
      s.scale.set(flip ? -k : k, k);
      const at = footBase(foot, this.ox);
      s.position.set(Math.round(at.x), Math.round(at.y));
      s.zIndex = footDepth(foot);
      // (a blueprint or a building going up: a ghost of what it will be)
      s.alpha = b.status === 'done' ? 1 : 0.45;
      this.setProps(d, b, role);
      this.setDoor(d, b, role, foot);
    }
    for (const [id, d] of this.buildings) {
      if (seen.has(id)) continue;
      d.sprite.destroy();
      this.own.delete(d.sprite);
      this.clearProps(d);
      this.clearDoor(d);
      this.buildings.delete(id);
    }
    if (fields.size !== this.fieldCells.size || [...fields].some((c) => !this.fieldCells.has(c))) {
      this.fieldCells.clear();
      for (const c of fields) this.fieldCells.add(c);
      this.groundKey = '';
    }
  }

  private clearDoor(d: DrawnBuilding): void {
    d.door?.g.destroy();
    d.door = undefined;
    for (const w of d.windows) w.destroy();
    d.windows = [];
  }

  /** A finished building's door (a gate's opening) and its windows' glow after dark. The door is a dark opening drawn
   *  over the picture while someone walks through (`animate`); no art is changed. */
  private setDoor(d: DrawnBuilding, b: Building, role: ReturnType<typeof roleOf>, foot: Rect): void {
    this.clearDoor(d);
    if (!('role' in role) || b.status !== 'done') return;
    const gate = role.role === 'gate';
    if (!gate && !hasWindows(role.role)) return;
    const g = new Graphics();
    g.zIndex = footDepth(foot) + 0.001;
    g.visible = false;
    this.things.addChild(g);
    this.own.add(g);
    d.door = { g, gate, open: 0, held: 0 };
    if (gate) return;
    for (const at of windowSpots(foot)) {
      const w = new Sprite(glowTexture());
      w.anchor.set(0.5);
      w.tint = 0xffc870;
      w.width = 20;
      w.height = 14;
      w.alpha = 0.8;
      const p = tileToIso(at.x, at.y, this.ox);
      w.position.set(Math.round(p.x), Math.round(p.y - 15));
      this.glow.addChild(w);
      d.windows.push(w);
    }
  }

  /** Where townsfolk and raiders walk now (world px, every snapshot): a door or gate with any near is to open. */
  private near = new Set<number>();
  setWalkers(who: readonly { x: number; y: number }[]): void {
    this.near.clear();
    for (const [id, d] of this.buildings) {
      if (!d.door) continue;
      const at = d.door.gate ? gateSpan(d.foot).mid : doorSpot(d.foot);
      if (anyoneNear(who, at, d.door.gate ? 1.8 : 1.1)) this.near.add(id);
    }
  }

  /** Each frame: doors and gates swing open as someone comes, and close behind them. */
  animate(dt: number): void {
    for (const [id, d] of this.buildings) {
      const door = d.door;
      if (!door) continue;
      const was = door.open;
      const n = swing(door.open, door.held, this.near.has(id), dt);
      door.open = n.open;
      door.held = n.held;
      if (Math.abs(door.open - was) < 0.01 && !(door.open === 0 && was !== 0)) continue;
      this.drawDoor(d, door);
    }
  }

  private drawDoor(d: DrawnBuilding, door: NonNullable<DrawnBuilding['door']>): void {
    const g = door.g.clear();
    g.visible = door.open > 0.01;
    if (!g.visible) return;
    const f = d.foot;
    const o = this.ox;
    if (door.gate) {
      // (the gate's leaves swung: a dark opening across the middle of the run, on its front plane)
      const { alongX, mid } = gateSpan(f);
      const half = (alongX ? f.w : f.h) * 0.2 * door.open + 0.05;
      const a = alongX ? tileToIso(mid.x - half, f.y + f.h * 0.75, o) : tileToIso(f.x + f.w * 0.75, mid.y - half, o);
      const b = alongX ? tileToIso(mid.x + half, f.y + f.h * 0.75, o) : tileToIso(f.x + f.w * 0.75, mid.y + half, o);
      const h = 26 * Math.min(1, door.open + 0.2);
      g.poly([a.x, a.y, b.x, b.y, b.x, b.y - h, a.x, a.y - h]).fill({ color: 0x140d08, alpha: 0.88 * door.open });
      return;
    }
    const at = doorSpot(f);
    const a = tileToIso(at.x - 0.28, at.y, o);
    const b = tileToIso(at.x + 0.28, at.y, o);
    const h = 17 * door.open;
    g.poly([a.x, a.y, b.x, b.y, b.x, b.y - h, a.x, a.y - h]).fill({ color: 0x1c120a, alpha: 0.92 });
    g.poly([a.x + 1, a.y - 1, b.x - 1, b.y - 1, b.x - 1, b.y - h * 0.6, a.x + 1, a.y - h * 0.6]).fill({ color: 0xffc070, alpha: 0.35 * door.open });
  }

  private clearProps(d: DrawnBuilding): void {
    for (const p of d.props) {
      p.destroy();
      this.own.delete(p);
    }
    d.props = [];
  }

  /** A finished working building's prop, beside it: picked from its id, sorted in depth with everything else. */
  private setProps(d: DrawnBuilding, b: Building, role: ReturnType<typeof roleOf>): void {
    this.clearProps(d);
    if (!('role' in role) || b.status !== 'done') return;
    const pr = propFor([...this.kit.pieces.keys()], role.role, b.id, d.foot);
    const tex = pr && this.texOf(pr.piece);
    if (!pr || !tex) return;
    const s = new Sprite(tex);
    s.anchor.set(0.5, 1);
    s.scale.set(this.kit.scale * ISO_ART * 0.6);
    const at = tileToIso(pr.x, pr.y, this.ox);
    s.position.set(Math.round(at.x), Math.round(at.y));
    s.zIndex = pr.x + pr.y + 0.02;
    this.things.addChild(s);
    this.own.add(s);
    d.props.push(s);
  }

  /** The camera: the screen position (on the diamonds) of the view's top-left, and the view's size. Only the ground
   *  in view is drawn, a kit tile to every block of `tileCells` cells. */
  setCamera(x: number, y: number, w: number, h: number): void {
    this.world.position.set(-Math.round(x), -Math.round(y));
    this.view = { x, y, w, h };
    const land = this.land;
    if (!land) return;
    const n = this.kit.tileCells;
    const r = cellsInView(this.view, this.ox, land.w, land.h, n + 1);
    const bx0 = Math.floor(r.x0 / n) * n;
    const by0 = Math.floor(r.y0 / n) * n;
    const key = `${bx0},${by0},${r.x1},${r.y1},${this.kit.name},${this.texGen}`;
    if (key === this.groundKey) return;
    this.groundKey = key;
    this.paintGround(bx0, by0, r.x1, r.y1, n);
  }

  private paintGround(bx0: number, by0: number, x1: number, y1: number, n: number): void {
    const land = this.land!;
    const texs = this.kit.tiles.map((t) => this.surfaceOf(t));
    const blocks: [number, number][] = [];
    for (let by = by0; by <= y1; by += n) for (let bx = bx0; bx <= x1; bx += n) blocks.push([bx, by]);
    // (back to front: each tile's slab edge is covered by the tiles in front of it)
    blocks.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    this.ground.removeChildren();
    let used = 0;
    for (const [bx, by] of blocks) {
      const g = groundTile(groundAt(land, bx, by), false, false, this.biome);
      const tex = texs[g.tile];
      if (!tex) continue;
      let s = this.tiles[used];
      if (!s) {
        s = new Sprite();
        s.anchor.set(0.5, 0);
        this.tiles.push(s);
      }
      used++;
      s.texture = tex;
      // (a little over size so neighbours overlap, and turned about by the block's hash so the same ground doesn't repeat)
      const k = (n * ISO_TW * OVERLAP) / tex.width;
      s.scale.set(cellHash(bx, by, 21) < 0.5 ? k : -k, k);
      const at = tileToIso(bx, by, this.ox);
      s.position.set(Math.round(at.x), Math.round(at.y - (n * ISO_TH * (OVERLAP - 1)) / 2));
      s.tint = g.tint;
      this.ground.addChild(s);
    }
    this.paintCells(Math.max(0, bx0), Math.max(0, by0), x1, y1, texs);
  }

  /** Over the blocks, a tile to each cell of a street, a worn footpath or a field (back to front), and the land's trees,
   *  bushes and rocks on its wild cells (sprites in `things`, sorted with everything else). */
  private paintCells(x0: number, y0: number, x1: number, y1: number, texs: (Texture | null)[]): void {
    const land = this.land!;
    this.overlay.removeChildren();
    let used = 0;
    let trees = 0;
    const ids = [...this.kit.pieces.keys()];
    const cells: number[] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells.push(y * land.w + x);
    cells.sort((a, b) => (a % land.w) + Math.floor(a / land.w) - ((b % land.w) + Math.floor(b / land.w)));
    for (const i of cells) {
      const x = i % land.w;
      const y = Math.floor(i / land.w);
      let tile = -1;
      let alpha = 1;
      if (this.fieldCells.has(i)) tile = 3;
      else if (land.roads[i] === '#') tile = 2;
      else {
        const w = land.wear ? land.wear.charCodeAt(i) - 48 : 0;
        if (w >= WEAR_SHOW) {
          tile = 1;
          alpha = Math.min(1, w / WEAR_FULL) * 0.8;
        }
      }
      if (tile >= 0 && texs[tile] && !wetCell(groundAt(land, x, y))) {
        const tex = texs[tile]!;
        let s = this.cellTiles[used];
        if (!s) {
          s = new Sprite();
          s.anchor.set(0.5, 0);
          this.cellTiles.push(s);
        }
        used++;
        s.texture = tex;
        const k = (ISO_TW * OVERLAP) / tex.width;
        s.scale.set(cellHash(x, y, 22) < 0.5 ? k : -k, k);
        s.alpha = alpha;
        const at = tileToIso(x, y, this.ox);
        s.position.set(Math.round(at.x), Math.round(at.y - (ISO_TH * (OVERLAP - 1)) / 2));
        this.overlay.addChild(s);
        continue;
      }
      if (this.wallCells.has(i)) continue;
      const g = groundAt(land, x, y);
      if (land.regrow?.[i] || land.rubble?.[i] !== undefined) continue;
      const piece = sceneryFor(ids, g, this.biome, cellHash(x, y, 1), cellHash(x, y, 2));
      const tex = piece ? this.texOf(piece) : null;
      if (!piece || !tex) continue;
      let t = this.scenery[trees];
      if (!t) {
        t = new Sprite();
        t.anchor.set(0.5, 0.9);
        this.scenery.push(t);
        this.own.add(t);
      }
      trees++;
      t.texture = tex;
      t.visible = true;
      t.scale.set(this.kit.scale * ISO_ART * (/bush/.test(piece) ? 0.7 : 0.85));
      const jx = x + 0.3 + cellHash(x, y, 3) * 0.4;
      const jy = y + 0.3 + cellHash(x, y, 4) * 0.4;
      const at = tileToIso(jx, jy, this.ox);
      t.position.set(Math.round(at.x), Math.round(at.y));
      t.zIndex = jx + jy;
      if (!t.parent) this.things.addChild(t);
    }
    // (the pool's spare sprites are hidden, not destroyed: the view moves on and needs them again)
    for (let k = trees; k < this.scenery.length; k++) this.scenery[k].visible = false;
  }

  /** Everything others put in `things` in world px (the townsfolk: map/mapPeople.ts), moved to its spot on the
   *  diamonds and sorted among the buildings. Run after they have drawn, every frame. */
  placeLoose(): void {
    const near = [...this.buildings.values()].map((d) => d.foot);
    for (const c of this.things.children) {
      if (this.own.has(c)) continue;
      const last = this.placed.get(c);
      if (last && c.x === last.x && c.y === last.y && c.zIndex === last.z) continue;
      const wx = c.x;
      const wy = c.y;
      // (its order among its own fellows kept: a horse under its rider, a bubble over everyone)
      const off = last && c.zIndex === last.z ? last.off : c.zIndex - wy;
      const at = worldToIso(wx, wy, this.ox);
      const z = standingDepth(wx / CELL, wy / CELL, near) + (Math.abs(off) > 1000 ? off : off * 0.001);
      c.position.set(Math.round(at.x), Math.round(at.y));
      c.zIndex = z;
      this.placed.set(c, { x: c.x, y: c.y, z, off });
    }
  }

  /** Screen to world px (the ground point under it), and back. */
  worldOf(sx: number, sy: number): { x: number; y: number } {
    return isoToWorld(sx - this.world.x - this.root.x, sy - this.world.y - this.root.y, this.ox);
  }
  screenOf(wx: number, wy: number): { x: number; y: number } {
    const p = worldToIso(wx, wy, this.ox);
    return { x: p.x + this.world.x + this.root.x, y: p.y + this.world.y + this.root.y };
  }
  /** World px to the view's own px (where the camera centres). */
  isoOf(wx: number, wy: number): { x: number; y: number } {
    return worldToIso(wx, wy, this.ox);
  }

  /** The building whose picture is under a screen point, the front-most first (a roof hides what's behind it). */
  buildingAt(sx: number, sy: number): number | null {
    const x = sx - this.world.x - this.root.x;
    const y = sy - this.world.y - this.root.y;
    let best: { id: number; z: number } | null = null;
    for (const [id, d] of this.buildings) {
      const s = d.sprite;
      if (!s.visible) continue;
      const w = s.width;
      const h = s.height;
      if (x < s.x - w / 2 || x > s.x + w / 2 || y < s.y - h || y > s.y) continue;
      if (!best || s.zIndex > best.z) best = { id, z: s.zIndex };
    }
    return best?.id ?? null;
  }

  /** The part of the land in view, as a box of world px round the ground under the view's middle (for the layers
   *  still drawn and culled in world px: the light map, the minimap's frame). */
  worldView(): { x: number; y: number; w: number; h: number } {
    const v = this.view;
    const mid = isoToWorld(v.x + v.w / 2, v.y + v.h / 2, this.ox);
    return { x: mid.x - v.w / 2, y: mid.y - v.h / 2, w: v.w, h: v.h };
  }
}
