// The town seen isometrically (being built: Settings' "Isometric view (in progress)" turns it on; the top-down
// map/mapView.ts is still the game's view). Only the drawing differs: the land's cells are laid as diamonds
// (iso/isoMath.ts), the ground drawn with the town's people's kit tiles and each building with the kit's piece for it
// (iso/isoKits.ts). The townsfolk are the top-down view's own (map/mapPeople.ts draws them into `things` in world px):
// `placeLoose` moves whatever it put there to its spot on the diamonds and sorts it among the buildings.
//
// Walls, streets as streets, props, lights, the weather and the other map layers are left for later: in this view
// the walls are fitted pieces of the kit, the roads its path tile, and the rest isn't drawn.

import { Container, Sprite, Texture } from 'pixi.js';
import { CELL, groundAt, type LandMap } from '../../shared/sim/land';
import { footprint } from '../../shared/sim/buildings';
import type { Building } from '../../shared/sim/state';
import { loadImage } from '../art/loadImage';
import { fitted, groundTile, kitOf, kitUrl, pieceFor, roleOf, ISO_ART, type Kit } from './isoKits';
import { cellsInView, footBase, footDepth, footWidth, isoBounds, isoOrigin, isoToWorld, ISO_TW, standingDepth, tileToIso, worldToIso, type Rect } from './isoMath';

/** A building's picture may stand this much wider than its footprint before it is shrunk to fit (a big piece on a
 *  small building: a cottage piece on a one-cell trap). */
const OVERHANG = 1.25;

interface DrawnBuilding {
  sprite: Sprite;
  key: string;
  foot: Rect;
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
  private groundKey = '';
  private readonly fieldCells = new Set<number>();
  private readonly buildings = new Map<number, DrawnBuilding>();
  private builtFrom: Building[] = [];
  private builtGen = -1;
  /** The view the camera last showed (screen px on the diamonds). */
  view = { x: 0, y: 0, w: 0, h: 0 };

  constructor() {
    this.things.sortableChildren = true;
    this.world.addChild(this.ground, this.things);
    this.root.addChild(this.world);
  }

  /** The kit the town is drawn with (iso/isoKits.ts `kitNameFor`). */
  setKit(name: string): void {
    if (name === this.kit.name) return;
    this.kit = kitOf(name);
    this.groundKey = '';
    for (const d of this.buildings.values()) d.key = '';
  }

  /** The land (every snapshot): its size, and the ground drawn again when it changed. */
  syncLand(land: LandMap): void {
    if (!this.land || this.land.w !== land.w || this.land.h !== land.h) {
      this.ox = isoOrigin(land.h);
      const b = isoBounds(land.w, land.h);
      this.width = b.w;
      this.height = b.h;
    }
    if (this.land?.version !== land.version) this.groundKey = '';
    this.land = land;
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

  /** The buildings (every snapshot): each on its footprint, a crop's field as field tiles in the ground. */
  syncBuildings(list: Building[]): void {
    if (list === this.builtFrom && this.builtGen === this.texGen) return;
    this.builtFrom = list;
    this.builtGen = this.texGen;
    const land = this.land;
    const seen = new Set<number>();
    const fields = new Set<number>();
    for (const b of list) {
      const foot = footprint(b);
      if ('field' in roleOf(b.def)) {
        if (land) for (let y = foot.y; y < foot.y + foot.h; y++) for (let x = foot.x; x < foot.x + foot.w; x++) fields.add(y * land.w + x);
        continue;
      }
      seen.add(b.id);
      const piece = pieceFor(this.kit, b.def);
      const tex = this.texOf(piece);
      const key = `${this.kit.name}:${piece}:${b.status}:${foot.x},${foot.y},${foot.w},${foot.h}:${tex ? 1 : 0}`;
      let d = this.buildings.get(b.id);
      if (!d) {
        const sprite = new Sprite();
        sprite.anchor.set(0.5, 1);
        this.things.addChild(sprite);
        this.own.add(sprite);
        d = { sprite, key: '', foot };
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
      s.scale.set(k);
      const at = footBase(foot, this.ox);
      s.position.set(Math.round(at.x), Math.round(at.y));
      s.zIndex = footDepth(foot);
      // (a blueprint or a building going up: a ghost of what it will be)
      s.alpha = b.status === 'done' ? 1 : 0.45;
    }
    for (const [id, d] of this.buildings) {
      if (seen.has(id)) continue;
      d.sprite.destroy();
      this.own.delete(d.sprite);
      this.buildings.delete(id);
    }
    if (fields.size !== this.fieldCells.size || [...fields].some((c) => !this.fieldCells.has(c))) {
      this.fieldCells.clear();
      for (const c of fields) this.fieldCells.add(c);
      this.groundKey = '';
    }
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
    const texs = this.kit.tiles.map((t) => this.texOf(t));
    const blocks: [number, number][] = [];
    for (let by = by0; by <= y1; by += n) for (let bx = bx0; bx <= x1; bx += n) blocks.push([bx, by]);
    // (back to front: each tile's slab edge is covered by the tiles in front of it)
    blocks.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    this.ground.removeChildren();
    let used = 0;
    for (const [bx, by] of blocks) {
      // (a block shows a field if any of its cells is one, else a path if any is, else its first cell's ground)
      let road = false;
      let field = false;
      for (let y = by; y < Math.min(by + n, land.h); y++)
        for (let x = bx; x < Math.min(bx + n, land.w); x++) {
          const i = y * land.w + x;
          if (this.fieldCells.has(i)) field = true;
          else if (land.roads[i] === '#') road = true;
        }
      const g = groundTile(groundAt(land, bx, by), road, field);
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
      s.scale.set((n * ISO_TW) / tex.width);
      const at = tileToIso(bx, by, this.ox);
      s.position.set(Math.round(at.x), Math.round(at.y));
      s.tint = g.tint;
      this.ground.addChild(s);
    }
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
