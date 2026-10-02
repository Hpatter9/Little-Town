// The top-down town: the land's ground in chunks (groundArt.ts), the wild cells' trees, rocks and bushes from the
// Craftpix top-down packs (art/props.ts), the buildings standing on their footprints (the same pictures as before,
// front-on, sorted by how far down the map they stand), the cells marked for gathering, and the ghost of a building
// being placed. People and raiders are drawn into `things` by mapPeople.ts and mapRaiders.ts, sorted the same way.
// The whole world is tinted for the time of day.

import { AnimatedSprite, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { Rng } from '../../shared/rng';
import { campfireFrames } from '../art/sprites';
import { fieldArt, isPlot } from './fieldArt';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { CROPS } from '../../shared/data/crops';
import { eraOfResearch } from '../../shared/data/research';
import { depthOf, footprint, stillNeeded } from '../../shared/sim/buildings';
import { CELL, cellAt, groundAt, isMarked, type Ground, type LandMap } from '../../shared/sim/land';
import type { Building } from '../../shared/sim/state';
import { buildingArt, type CropLook } from '../art/buildings';
import { drawSite } from '../art/constructionSite';
import { mixHex, noTone, type PixelArt, type Tone } from '../art/pixelArt';
import { propTextures, type PropSet } from '../art/props';
import propKinds from '../art/propKinds.json';
import { loadTdTiles, tdTiles } from '../art/tdTiles';
import { glowTexture } from '../town/layer';
import { CHUNK, chunkKey, FOG_BAND, hash, paintChunk, visibility } from './groundArt';

/** Multiply colour for a daylight level: white by day, moonlit blue at night. */
const NIGHT_TINT = 0x8a96c8;
export function daylightTint(daylight: number): number {
  const d = Math.max(0, Math.min(1, daylight));
  const ch = (night: number) => Math.round(night + (255 - night) * d);
  return (ch(NIGHT_TINT >> 16) << 16) | (ch((NIGHT_TINT >> 8) & 255) << 8) | ch(NIGHT_TINT & 255);
}
/** The Deep Freeze's icy cast (multiplied into the daylight). */
const FROST_TINT = 0xc8dcf4;
const multiplyTint = (a: number, b: number) => {
  const ch = (sh: number) => Math.round((((a >> sh) & 255) * ((b >> sh) & 255)) / 255) << sh;
  return ch(16) | ch(8) | ch(0);
};
const BLUEPRINT_TINT = 0x9fc6ff;

type PropKind = 'tree' | 'bush' | 'rock' | 'plant' | 'other';
const KINDS = propKinds as Record<PropSet, PropKind[]>;

/** What stands on each kind of wild cell: the kinds of object, with their odds. */
const PROPS_ON: Partial<Record<Ground, [PropKind, number][]>> = {
  forest: [['tree', 0.78], ['bush', 0.14], ['plant', 0.08]],
  rock: [['rock', 0.9], ['plant', 0.1]],
  marsh: [['plant', 0.55], ['bush', 0.45]],
  hill: [['rock', 0.4], ['bush', 0.4], ['plant', 0.2]],
};

interface DrawnBuilding {
  sig: string;
  sprite: Sprite;
  shadow: Sprite;
  faint?: Sprite;
  mask?: Graphics;
  site?: Graphics;
  art: PixelArt;
  /** Where it stands (world px): its picture's box. */
  rect: { x: number; y: number; w: number; h: number };
  progress: number;
}

function cropLook(b: Building): CropLook | undefined {
  if (!CROPS[b.def] || b.status !== 'done') return undefined;
  const c = b.crop;
  if (!c || c.stage === 'fallow') return 'fallow';
  if (c.stage === 'ripe') return 'ripe';
  if (CROPS[b.def].establishHours) return c.bearing ? 'tall' : 'sprout';
  return c.growth < 0.4 ? 'sprout' : 'tall';
}
const sigOf = (b: Building) => `${b.def}|${b.tile}|${b.row}|${b.status}|${cropLook(b) ?? ''}|${b.room ? 'room' : ''}`;

export class MapView {
  /** Screen space (the camera moves `world`). */
  readonly root = new Container();
  readonly world = new Container();
  private readonly ground = new Container();
  private readonly marks = new Graphics();
  /** Everything that stands on the ground, sorted by its foot's y. */
  readonly things = new Container();
  private readonly ghost = new Sprite();
  private readonly chunks = new Map<string, { sprite: Sprite; key: string }>();
  private readonly props = new Map<number, { sprite: Sprite; key: string }>();
  private propTex = new Map<PropSet, Texture[]>();
  private propsWanted: PropSet[] = [];
  private propsKey = '';
  private readonly buildings = new Map<number, DrawnBuilding>();
  private readonly fire: PixelArt[] = campfireFrames(Rng.from(1, 0xf2), noTone);
  private style = 'town';
  private tone: Tone = noTone;
  private toneKey = 'plain';
  private daylight = 1;
  private frost = false;
  private highlight: number | null = null;
  private land: LandMap | null = null;
  private season = 'summer';
  private biome = 'forest';
  /** The land's size in px (the camera's bounds). */
  width = 0;
  height = 0;
  /** A slower phone: fewer props. */
  calm = false;

  constructor() {
    this.things.sortableChildren = true;
    this.ghost.visible = false;
    this.ghost.anchor.set(0.5, 1);
    this.ghost.zIndex = 1e9;
    this.world.addChild(this.ground, this.marks, this.things, this.ghost);
    this.root.addChild(this.world);
    loadTdTiles().then(() => this.repaint(), () => undefined);
  }

  /** The camera: world position of the screen's top-left. */
  setCamera(x: number, y: number): void {
    this.world.position.set(-Math.round(x), -Math.round(y));
  }

  /** Screen to world, and back. */
  worldOf(sx: number, sy: number): { x: number; y: number } {
    return { x: sx - this.world.x - this.root.x, y: sy - this.world.y - this.root.y };
  }
  screenOf(wx: number, wy: number): { x: number; y: number } {
    return { x: wx + this.world.x + this.root.x, y: wy + this.world.y + this.root.y };
  }

  setDaylight(daylight: number, frost = false): void {
    const d = Math.max(0, Math.min(1, daylight));
    if (d === this.daylight && frost === this.frost) return;
    this.daylight = d;
    this.frost = frost;
    const t = daylightTint(d);
    this.world.tint = frost ? multiplyTint(t, FROST_TINT) : t;
  }

  /** The buildings' style (an origin's look) and tint. */
  setBuildingStyle(tint: [string, number] | null, style = 'town'): void {
    this.style = style;
    if (tint) {
      const cache = new Map<string, string>();
      this.tone = (hex) => {
        let out = cache.get(hex);
        if (!out) cache.set(hex, (out = mixHex(hex, tint[0], tint[1])));
        return out;
      };
      this.toneKey = `${style}|${tint[0]}|${tint[1]}`;
    } else {
      this.tone = noTone;
      this.toneKey = `${style}|plain`;
    }
    for (const d of this.buildings.values()) d.sig = ''; // (drawn again)
  }

  /* ------------------------------------------------------------ the land */

  /** The land as it is now: ground chunks painted again where they changed, props on the wild cells. */
  syncLand(land: LandMap, season: string, biome: string): void {
    this.land = land;
    this.season = season;
    this.biome = biome;
    this.width = land.w * CELL;
    this.height = land.h * CELL;
    const td = tdTiles();
    const cols = Math.ceil(land.w / CHUNK);
    const rows = Math.ceil(land.h / CHUNK);
    const reach = land.open + FOG_BAND + CHUNK;
    for (let cy = 0; cy < rows; cy++)
      for (let cx = 0; cx < cols; cx++) {
        const id = `${cx},${cy}`;
        // (chunks wholly out of sight are one black square)
        const near = Math.hypot((cx + 0.5) * CHUNK - land.camp.x, (cy + 0.5) * CHUNK - land.camp.y) <= reach;
        const key = near ? chunkKey(land, cx, cy, season, !!td) : 'dark';
        let c = this.chunks.get(id);
        if (c && c.key === key) continue;
        if (!c) {
          c = { sprite: this.ground.addChild(new Sprite()), key: '' };
          c.sprite.position.set(cx * CHUNK * CELL, cy * CHUNK * CELL);
          this.chunks.set(id, c);
        }
        const old = c.sprite.texture;
        c.sprite.texture = near ? paintChunk(land, cx, cy, season, biome, td) : darkTexture();
        if (old !== Texture.EMPTY && old !== darkTexture()) old.destroy(true);
        c.key = key;
      }
    this.syncProps(land, season, biome);
    this.drawMarks();
  }

  /** Paint everything again (the cobble tiles arrived). */
  private repaint(): void {
    for (const c of this.chunks.values()) c.key = '';
    if (this.land) this.syncLand(this.land, this.season, this.biome);
  }

  /** The sets of objects for this land and season (the sea's under water is for later). */
  private propSets(season: string, biome: string): PropSet[] {
    const winter = season === 'winter' || biome === 'tundra';
    const base: PropSet = biome === 'desert' ? 'desert' : winter ? 'winter' : biome === 'coast' ? 'coast' : 'wild';
    const sets: PropSet[] = [base];
    if (this.style === 'fae' || this.style === 'druid') sets.push('grove');
    if (base !== 'wild') sets.push('wild');
    if (this.style === 'dwarves') sets.push('cave');
    return sets;
  }

  private syncProps(land: LandMap, season: string, biome: string): void {
    const sets = this.propSets(season, biome);
    const want = sets.join(',');
    if (want !== this.propsKey) {
      this.propsKey = want;
      Promise.all(sets.map((s) => propTextures(s).then((t) => this.propTex.set(s, t)))).then(
        () => this.propsKey === want && this.land && this.syncProps(this.land, this.season, this.biome),
        () => undefined,
      );
    }
    this.propsWanted = sets.filter((s) => this.propTex.has(s));
    const seen = new Set<number>();
    const reach = land.open + FOG_BAND;
    for (let y = Math.max(0, land.camp.y - reach); y <= Math.min(land.h - 1, land.camp.y + reach); y++)
      for (let x = Math.max(0, land.camp.x - reach); x <= Math.min(land.w - 1, land.camp.x + reach); x++) {
        const g = groundAt(land, x, y);
        const on = PROPS_ON[g];
        if (!on) continue;
        const vis = visibility(land, x, y);
        if (vis === 0) continue;
        const i = y * land.w + x;
        // (a slow phone: every other wild cell bare)
        if (this.calm && hash(5, x, y) < 0.5) continue;
        seen.add(i);
        const key = `${g}|${vis}|${this.propsWanted.join(',')}`;
        let p = this.props.get(i);
        if (p && p.key === key) continue;
        const tex = this.propFor(on, x, y);
        if (!tex) continue;
        if (!p) {
          p = { sprite: this.things.addChild(new Sprite()), key: '' };
          p.sprite.anchor.set(0.5, 0.95);
          this.props.set(i, p);
        }
        p.key = key;
        p.sprite.texture = tex;
        // (an object stands about the middle of its cell, a little off it, its foot a little up from the bottom)
        const fx = (x + 0.3 + hash(1, x, y) * 0.4) * CELL;
        const fy = (y + 0.75 + hash(2, x, y) * 0.2) * CELL;
        p.sprite.position.set(Math.round(fx), Math.round(fy));
        p.sprite.zIndex = fy;
        p.sprite.alpha = vis === 1 ? 0.45 : 1;
        p.sprite.tint = vis === 1 ? 0x6a7088 : 0xffffff;
      }
    for (const [i, p] of this.props)
      if (!seen.has(i)) {
        p.sprite.destroy();
        this.props.delete(i);
      }
  }

  /** The object for a wild cell: by its kind's odds, from the sets loaded, the same one every time. */
  private propFor(on: [PropKind, number][], x: number, y: number): Texture | null {
    let r = hash(3, x, y);
    let kind: PropKind = on[0][0];
    for (const [k, w] of on) {
      if (r < w) {
        kind = k;
        break;
      }
      r -= w;
    }
    const choices: Texture[] = [];
    for (const set of this.propsWanted) {
      const tex = this.propTex.get(set)!;
      KINDS[set]?.forEach((k, i) => k === kind && tex[i] && choices.push(tex[i]));
    }
    if (!choices.length) return null;
    return choices[Math.floor(hash(4, x, y) * choices.length)];
  }

  /** The cells marked for gathering (a pale line round each), and the highlighted one. */
  private drawMarks(): void {
    const m = this.land;
    const g = this.marks.clear();
    if (!m) return;
    for (const i of m.marked) {
      const c = cellAt(m, i);
      g.rect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2).stroke({ color: 0xffe080, width: 2, alpha: 0.8 });
    }
    if (this.highlight !== null && !isMarked(m, this.highlight)) {
      const c = cellAt(m, this.highlight);
      g.rect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2).stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
    }
  }

  setHighlight(cell: number | null): void {
    if (cell === this.highlight) return;
    this.highlight = cell;
    this.drawMarks();
  }

  /** The cell under a world point, if it's on the land and in sight. */
  cellAt(wx: number, wy: number): number | null {
    const m = this.land;
    if (!m) return null;
    const x = Math.floor(wx / CELL);
    const y = Math.floor(wy / CELL);
    if (x < 0 || y < 0 || x >= m.w || y >= m.h || visibility(m, x, y) === 0) return null;
    return y * m.w + x;
  }

  /* ------------------------------------------------------------ buildings */

  private art(b: Building): PixelArt {
    if (b.def === 'campfire') return this.fire[0];
    const f = footprint(b);
    if (isPlot(b.def)) return fieldArt(b.def, f.w, f.h, cropLook(b), this.tone, this.toneKey);
    return buildingArt(b.def, this.tone, this.toneKey, cropLook(b), this.style);
  }

  syncBuildings(list: Building[]): void {
    const seen = new Set<number>();
    for (const b of list) {
      seen.add(b.id);
      let d = this.buildings.get(b.id);
      const sig = sigOf(b);
      if (d && d.sig !== sig) {
        this.destroy(d);
        this.buildings.delete(b.id);
        d = undefined;
      }
      if (!d) {
        d = this.draw(b, sig);
        this.buildings.set(b.id, d);
      }
      if (b.status === 'blueprint' && d.progress !== b.progress) this.updateBlueprint(b, d);
      if (b.fire !== undefined) d.sprite.tint = 0xff9060;
    }
    for (const [id, d] of this.buildings)
      if (!seen.has(id)) {
        this.destroy(d);
        this.buildings.delete(id);
      }
  }

  private destroy(d: DrawnBuilding): void {
    d.sprite.destroy();
    d.shadow.destroy();
    d.faint?.destroy();
    d.mask?.destroy();
    d.site?.destroy();
  }

  private draw(b: Building, sig: string): DrawnBuilding {
    const art = this.art(b);
    const f = footprint(b);
    const cx = (f.x + f.w / 2) * CELL;
    const bottom = (f.y + f.h) * CELL - 2;
    const left = Math.round(cx - art.width / 2);
    const top = bottom - art.height;
    const rect = { x: left, y: top, w: art.width, h: art.height };
    const shadow = this.things.addChild(new Sprite(glowTexture()));
    shadow.anchor.set(0.5);
    shadow.tint = 0x000000;
    shadow.alpha = 0.45;
    shadow.width = art.width + 10;
    shadow.height = 10;
    shadow.position.set(cx + 2, bottom - 1);
    shadow.zIndex = bottom - 0.5;
    const flat = isPlot(b.def);
    if (flat) {
      // (a plot lies on the ground: no shadow, and everything standing on it is drawn over it)
      shadow.visible = false;
      shadow.zIndex = top;
    }
    const sprite = this.things.addChild(b.def === 'campfire' && b.status === 'done' ? animated(this.fire) : new Sprite(art.texture));
    sprite.position.set(left, top);
    sprite.zIndex = flat ? top - 1e6 : bottom;
    const d: DrawnBuilding = { sig, sprite, shadow, art, rect, progress: -1 };
    if (b.status === 'blueprint') {
      // a faint outline of the whole, the finished picture masked to the progress, and the construction site over it
      const faint = this.things.addChild(new Sprite(art.texture));
      faint.position.set(left, top);
      faint.alpha = 0.35;
      faint.tint = BLUEPRINT_TINT;
      faint.zIndex = bottom - 0.2;
      const mask = this.things.addChild(new Graphics());
      sprite.mask = mask;
      const site = this.things.addChild(new Graphics());
      site.zIndex = bottom + 0.1;
      d.faint = faint;
      d.mask = mask;
      d.site = site;
      this.updateBlueprint(b, d);
    }
    return d;
  }

  private updateBlueprint(b: Building, d: DrawnBuilding): void {
    d.progress = b.progress;
    const { x, y, w, h } = d.rect;
    const built = Math.round(h * b.progress);
    d.mask!.clear().rect(x, y + h - built, w, built).fill(0xffffff);
    const def = BUILDING_BY_ID[b.def];
    const left = stillNeeded(b);
    const delivered = Object.fromEntries(Object.entries(def.cost).map(([m, n]) => [m, Math.max(0, (n ?? 0) - ((left as Record<string, number>)[m] ?? 0))]));
    drawSite(d.site!.clear(), { x, y, w, h, progress: b.progress, delivered, cost: def.cost, era: eraOfResearch(def.research), seed: b.id, now: performance.now() }, this.tone);
  }

  /** The building whose picture is under a world point (the one standing furthest down first). */
  buildingAt(wx: number, wy: number): number | null {
    let best: { id: number; z: number } | null = null;
    for (const [id, d] of this.buildings) {
      const r = d.rect;
      if (wx < r.x || wx >= r.x + r.w || wy < r.y || wy >= r.y + r.h) continue;
      // (through the clear parts of the picture: its top edge per column)
      const col = Math.floor(wx - r.x);
      if (wy - r.y < d.art.tops[col]) continue;
      if (!best || d.sprite.zIndex > best.z) best = { id, z: d.sprite.zIndex };
    }
    return best?.id ?? null;
  }

  /** A building's picture on screen. */
  buildingScreenRect(id: number): { x: number; y: number; w: number; h: number } | null {
    const d = this.buildings.get(id);
    if (!d) return null;
    const p = this.screenOf(d.rect.x, d.rect.y);
    return { x: p.x, y: p.y, w: d.rect.w, h: d.rect.h };
  }

  /* ------------------------------------------------------------ placing */

  /** The top-left cell a building would take with the pointer over its middle. */
  placementCell(wx: number, wy: number, defId: string): { x: number; y: number } {
    const def = BUILDING_BY_ID[defId];
    const h = depthOf(def);
    return { x: Math.floor(wx / CELL) - Math.floor((def.width - 1) / 2), y: Math.floor(wy / CELL) - Math.floor((h - 1) / 2) };
  }

  showGhost(defId: string, x: number, y: number, valid: boolean): void {
    const def = BUILDING_BY_ID[defId];
    const art = buildingArt(defId, this.tone, this.toneKey, undefined, this.style);
    this.ghost.texture = art.texture;
    this.ghost.visible = true;
    this.ghost.alpha = 0.7;
    this.ghost.tint = valid ? 0x9fe0a0 : 0xff8080;
    this.ghost.position.set(Math.round((x + def.width / 2) * CELL), (y + depthOf(def)) * CELL - 2);
  }

  hideGhost(): void {
    this.ghost.visible = false;
  }
}

/** The campfire's flames, playing. */
function animated(frames: PixelArt[]): AnimatedSprite {
  const a = new AnimatedSprite(frames.map((f) => f.texture));
  a.animationSpeed = 7 / 60;
  a.play();
  return a;
}

let dark: Texture | null = null;
/** One black chunk for everything out of sight. */
function darkTexture(): Texture {
  if (dark) return dark;
  const c = document.createElement('canvas');
  c.width = c.height = CHUNK * CELL;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b0d14';
  g.fillRect(0, 0, c.width, c.height);
  return (dark = Texture.from(c));
}
