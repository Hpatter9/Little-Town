// The top-down town: the land's ground in chunks (groundArt.ts), the wild cells' trees, rocks and bushes from the
// Craftpix top-down packs (art/props.ts), the buildings standing on their footprints (the same pictures as before,
// front-on, sorted by how far down the map they stand), the cells marked for gathering, and the ghost of a building
// being placed. People and raiders are drawn into `things` by mapPeople.ts and mapRaiders.ts, sorted the same way.
// The whole world is tinted for the time of day.

import wreckUrl from '../art/packs/sb_wreck.png';
import { loadImage } from '../art/loadImage';
import { AnimatedSprite, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { Rng } from '../../shared/rng';
import { campfireFrames } from '../art/sprites';
import { fieldArt, isPlot } from './fieldArt';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { CROPS } from '../../shared/data/crops';
import { eraOfResearch } from '../../shared/data/research';
import { depthOf, footprint, stillNeeded } from '../../shared/sim/buildings';
import { inRect } from '../../shared/sim/land';
import { inSea } from '../../shared/sim/sea';
import { CELL, cellAt, groundAt, isMarked, type Ground, type LandMap } from '../../shared/sim/land';
import type { Building } from '../../shared/sim/state';
import type { PlaceView } from '../../shared/sim/snapshot';
import type { CropLook } from '../art/buildings';
import { topDownArt } from '../art/topDown';
import { drawSite } from '../art/constructionSite';
import { snowCapped } from '../art/snowCap';
import { mixHex, noTone, type PixelArt, type Tone } from '../art/pixelArt';
import { PROP_FINE, propTextures, type PropSet } from '../art/props';
import propKinds from '../art/propKinds.json';
import { loadTdTiles, tdTiles } from '../art/tdTiles';
import { glowTexture } from '../town/layer';
import { ChimneySmoke } from '../town/ambientView';
import { CHUNK, chunkKey, FOG_BAND, hash, paintChunk, visibility } from './groundArt';
import { onPackArt, packArt, packDressing, type Join } from './packBuildings';
import { loadRoadTiles } from '../art/roadTiles';
import { loadGroundDetail } from '../art/groundDetail';
import { campfirePack, loadFieldTiles, onFieldTiles } from '../art/fieldTiles';
import type { Era } from '../../shared/data/eras';
import { buildCastle, castleArtReady, onCastleArt, roomFurniture, type CastleView } from './castleArt';
import { MapFestival } from './mapFestival';
import { castleClutter, clutterLoaded, flickerCastle, onClutterArt, type Flame } from './castleClutter';
import { seatArt } from '../art/seatArt';
import { SEAT_STAGE } from '../../shared/data/seats';

/** Things this far outside the view are still drawn (so nothing pops at the edge). */
/** Where the seabed things stand round a building in the sea (share of its width along, px below its foot), and their
 *  size against the atlas's (which is drawn for the raid map, larger). */
const SEA_DRESS: [number, number][] = [[0.04, 2], [0.96, 4], [0.55, 7]];
const SEA_DRESS_K = 0.7;
const CULL_MARGIN = 64;

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

type PropKind = 'tree' | 'bush' | 'rock' | 'plant' | 'other' | 'cave' | 'bones' | 'circle' | 'skull' | 'crystal' | 'cart' | 'camp' | 'ruin';
const KINDS = propKinds as Record<PropSet, PropKind[]>;

/** What stands on each kind of wild cell: the kinds of object, with their odds. */
const PROPS_ON: Partial<Record<Ground, [PropKind, number][]>> = {
  forest: [['tree', 0.78], ['bush', 0.14], ['plant', 0.08]],
  rock: [['rock', 0.9], ['plant', 0.1]],
  marsh: [['plant', 0.55], ['bush', 0.45]],
  hill: [['rock', 0.4], ['bush', 0.4], ['plant', 0.2]],
  mountain: [['rock', 0.7], ['crystal', 0.3]],
};
/** How many of a kind's cells carry an object (every one unless said): the mountain's mass is mostly bare rock. */
const PROPS_SHARE: Partial<Record<Ground, number>> = { mountain: 0.2 };

/** A firefly: a tiny blinking glow in the lights layer, drifting over the grass on a warm, fair night. */
interface Firefly {
  s: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  rate: number;
  life: number;
}
const FLIES_MAX = 36;
const FLY_GROUND = new Set<Ground>(['grass', 'forest', 'marsh', 'fertile', 'hill']);

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
  /** Street furniture from the pack beside it (map/packBuildings.ts). */
  extras?: Sprite[];
  /** Its windows' and fires' glows after dark (in MapView's `lights`). */
  glows?: Sprite[];
  /** Where its chimneys are (world px), for the smoke. */
  chimneys?: { x: number; y: number }[];
  /** A castle's room: the furnishings on the floor, tapped anywhere on the room. */
  room?: boolean;
}

/** Buildings whose fire glows at night though their picture (a pack's) has no lamp colours in it. */
const FIRES = new Set(['campfire', 'bloomery', 'kiln', 'storytellers_circle']);
const FIRE_GLOW = { r: 20, color: 0xffb347 };

function cropLook(b: Building): CropLook | undefined {
  if (!CROPS[b.def] || b.status !== 'done') return undefined;
  const c = b.crop;
  if (!c || c.stage === 'fallow') return 'fallow';
  if (c.stage === 'ripe') return 'ripe';
  if (CROPS[b.def].establishHours) return c.bearing ? (c.growth < 0.5 ? 'tall' : 'heading') : c.growth < 0.5 ? 'sprout' : 'young';
  // (five stages the plot is redrawn at as the crop grows: the owner wanted to see it grow)
  return c.growth < 0.2 ? 'sprout' : c.growth < 0.45 ? 'young' : c.growth < 0.7 ? 'tall' : 'heading';
}
const sigOf = (b: Building) => `${b.def}|${b.tile}|${b.row}|${b.status}|${cropLook(b) ?? ''}|${b.room ? 'room' : ''}|${b.wide ?? 0}`;

/** The wreck a sea beast lairs on (a reef place), once loaded. */
let wreckTex: Texture | null = null;
let wreckAsked = false;

export class MapView {
  /** Screen space (the camera moves `world`). */
  readonly root = new Container();
  readonly world = new Container();
  readonly ground = new Container();
  private readonly marks = new Graphics();
  /** Everything that stands on the ground, sorted by its foot's y. */
  readonly things = new Container();
  /** The windows' and fires' glows: beside `world` (so the night's tint doesn't dim them), faded in after dusk. */
  readonly lights = new Container();
  /** Smoke from the chimneys and stacks (town/ambientView.ts), over everything standing. */
  private readonly smoke = new ChimneySmoke();
  /** The town's gathering dressed: bunting, lanterns, the feast table, confetti and fireworks; candles at a funeral. */
  readonly festival: MapFestival;
  /** How much the hearths are burning now (0 to 1: ambientView's `airFor`). */
  smokeAmount = 0.5;
  /** Marks on the ground under everything standing (a battle's trail and spots), and effects over it all. */
  readonly under = new Container();
  readonly over = new Container();
  private readonly ghost = new Sprite();
  private readonly chunks = new Map<string, { sprite: Sprite; key: string }>();
  private readonly props = new Map<number, { sprite: Sprite; key: string }>();
  private propTex = new Map<PropSet, Texture[]>();
  private propsWanted: PropSet[] = [];
  private propsKey = '';
  private readonly buildings = new Map<number, DrawnBuilding>();
  private readonly placesDrawn = new Map<number, { sprite: Sprite; ring: Graphics; key: string; view: PlaceView }>();
  private placeTex: Texture[] | null = null;
  private placesSeen: PlaceView[] = [];
  private readonly fire: PixelArt[] = campfireFrames(Rng.from(1, 0xf2), noTone);
  private style = 'town';
  private tone: Tone = noTone;
  private toneKey = 'plain';
  private daylight = 1;
  private frost = false;
  private highlight: number | null = null;
  private land: LandMap | null = null;
  private season = 'summer';
  private era: Era = 'neolithic';
  private biome = 'forest';
  /** The land's size in px (the camera's bounds). */
  width = 0;
  height = 0;
  /** A slower phone: fewer props. */
  calm = false;
  /** The weather (main.ts, per snapshot): the fireflies come out only in fair weather. */
  weather = 'clear';
  /** The view the camera last showed (world px): where the fireflies live, and the birds (mapBirds.ts). */
  view = { x: 0, y: 0, w: 0, h: 0 };
  private readonly flies: Firefly[] = [];
  /** A castle town's keep (map/keepArt.ts): its floor and side walks under everything, its walls and towers among the
   *  things; `wide` sprites span the view and are never culled. */
  private castle: { key: string; under: Container; things: Container[]; flames: Flame[] } | null = null;
  /** Seconds the lights have flickered (castleClutter's `flickerCastle`). */
  private flick = 0;
  private readonly wide = new Set<Container>();
  /** Bumped when a pack picture loads: every building is drawn again with it. */
  private artGen = 0;

  constructor() {
    this.things.sortableChildren = true;
    this.ghost.visible = false;
    this.ghost.anchor.set(0.5, 1);
    this.ghost.zIndex = 1e9;
    this.world.addChild(this.ground, this.marks, this.under, this.things, this.over, this.ghost);
    this.over.addChild(this.smoke.root);
    this.festival = new MapFestival(this.things, this.over, this.lights);
    this.smoke.size = 1.6;
    this.lights.blendMode = 'add';
    this.lights.alpha = 0;
    this.root.addChild(this.world, this.lights);
    loadTdTiles().then(() => this.repaint(), () => undefined);
    loadRoadTiles().then(() => this.repaint(), () => undefined);
    loadGroundDetail().then(() => this.repaint(), () => undefined);
    loadFieldTiles().then(() => undefined, () => undefined);
    onFieldTiles(() => this.artGen++);
    onPackArt(() => this.artGen++);
    onCastleArt(() => {
      if (this.castle) this.castle.key = '';
    });
    onClutterArt(() => {
      if (this.castle) this.castle.key = '';
    });
  }

  /** The camera: world position of the screen's top-left, and the screen's size. Only what's in view is drawn:
   *  the ground's chunks and everything standing on it outside the view are skipped (Pixi draws all else). */
  setCamera(x: number, y: number, w: number, h: number): void {
    this.world.position.set(-Math.round(x), -Math.round(y));
    this.lights.position.copyFrom(this.world.position);
    this.view = { x, y, w, h };
    const x0 = x - CULL_MARGIN;
    const y0 = y - CULL_MARGIN;
    const x1 = x + w + CULL_MARGIN;
    const y1 = y + h + CULL_MARGIN;
    const side = CHUNK * CELL;
    for (const c of this.chunks.values()) {
      const s = c.sprite;
      s.renderable = s.x + side > x0 && s.x < x1 && s.y + side > y0 && s.y < y1;
    }
    for (const t of this.things.children) {
      // (anything standing on the map is at most a few cells wide and some taller than wide, but for the keep's walls)
      t.renderable = this.wide.has(t) || (t.x > x0 - 96 && t.x < x1 + 96 && t.y > y0 - 32 && t.y < y1 + 160);
    }
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
    // (the windows light up as the day goes: fully by deep dusk)
    this.lights.alpha = Math.max(0, Math.min(1, (0.6 - d) / 0.35));
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
  syncLand(land: LandMap, season: string, biome: string, era: Era = 'neolithic'): void {
    this.era = era;
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
        const key = near ? chunkKey(land, cx, cy, season, !!td, era, this.blighted()) : 'dark';
        let c = this.chunks.get(id);
        if (c && c.key === key) continue;
        if (!c) {
          c = { sprite: this.ground.addChild(new Sprite()), key: '' };
          c.sprite.position.set(cx * CHUNK * CELL, cy * CHUNK * CELL);
          this.chunks.set(id, c);
        }
        const old = c.sprite.texture;
        c.sprite.texture = near ? paintChunk(land, cx, cy, season, biome, td, era, this.blighted()) : darkTexture();
        if (old !== Texture.EMPTY && old !== darkTexture()) old.destroy(true);
        c.key = key;
      }
    this.syncProps(land, season, biome);
    this.drawMarks();
  }

  /** Paint everything again (the cobble tiles arrived). */
  private repaint(): void {
    for (const c of this.chunks.values()) c.key = '';
    if (this.land) this.syncLand(this.land, this.season, this.biome, this.era);
  }

  /** The sets of objects for this land and season (the sea's under water is for later). */
  /** Whether the land is the undead's (the liches' and vampires'): blighted ground and dead trees. */
  private blighted(): boolean {
    return this.style === 'lich' || this.style === 'vampire';
  }

  private propSets(season: string, biome: string): PropSet[] {
    const winter = season === 'winter' || biome === 'tundra';
    const base: PropSet = biome === 'desert' ? 'desert' : winter ? 'winter' : biome === 'coast' ? 'coast' : 'wild';
    // (the liches' and vampires' land is blighted: dead trees, thorns and bones, and snow when it snows)
    if (this.blighted()) return winter ? ['undead', 'winter'] : ['undead'];
    const sets: PropSet[] = [base];
    if (this.style === 'fae' || this.style === 'druid') sets.push('grove');
    if (base !== 'wild') sets.push('wild');
    if (this.style === 'dwarves') sets.push('cave');
    return sets;
  }

  private seaAsked = false;

  private syncProps(land: LandMap, season: string, biome: string): void {
    // (a shore town's buildings in the sea are dressed with the Seabed set's coral and shells: drawn again once it comes)
    if (this.style === 'merfolk' && !this.propTex.has('sea') && !this.seaAsked) {
      this.seaAsked = true;
      propTextures('sea').then((t) => {
        this.propTex.set('sea', t);
        this.artGen++;
      }, () => undefined);
    }
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
        if (PROPS_SHARE[g] !== undefined && hash(6, x, y) > PROPS_SHARE[g]!) continue;
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

  /* ------------------------------------------------------------ places */

  /** The places found on the land (sim/places.ts): a cave mouth, great bones, a cart, a lair, a shrine, crystals,
   *  each from the packs; a fight waiting there has a ring pulsing round it. */
  syncPlaces(list: PlaceView[]): void {
    this.placesSeen = list;
    if (!wreckTex && !wreckAsked) {
      wreckAsked = true;
      void loadImage(wreckUrl).then((img) => {
        wreckTex = Texture.from(img);
        this.placesDrawn.forEach((d) => (d.key = ''));
        this.syncPlaces(this.placesSeen);
      }, () => undefined);
    }
    if (!this.placeTex) {
      this.placeTex = [];
      propTextures('places').then((t) => {
        this.placeTex = t;
        this.syncPlaces(this.placesSeen);
      }, () => undefined);
      return;
    }
    const seen = new Set<number>();
    for (const p of list) {
      if (!p.found) continue;
      seen.add(p.id);
      const key = `${p.kind}|${p.state}|${this.placeTex.length}`;
      let d = this.placesDrawn.get(p.id);
      if (d && d.key === key) {
        d.view = p;
        continue;
      }
      if (!d) {
        const sprite = this.things.addChild(new Sprite());
        sprite.anchor.set(0.5, 0.9);
        const ring = this.things.addChild(new Graphics());
        d = { sprite, ring, key: '', view: p };
        this.placesDrawn.set(p.id, d);
      }
      d.key = key;
      d.view = p;
      const kind: PropKind = p.kind === 'vein' ? 'crystal' : p.kind === 'cave' ? 'cave' : p.kind === 'cart' ? 'cart' : p.kind === 'ruin' ? 'ruin' : p.kind === 'bones' ? 'bones' : p.state === 'waiting' ? 'skull' : 'bones';
      const choices = this.placeTex.filter((_, i) => KINDS.places?.[i] === kind);
      // (a sea beast's reef: the Seabed pack's broken wreck it lairs on, at half its size)
      const tex = p.kind === 'reef' ? (wreckTex ?? undefined) : choices[p.id % Math.max(1, choices.length)];
      d.sprite.scale.set(p.kind === 'reef' ? 0.5 : 1);
      d.sprite.visible = !!tex && !(p.kind === 'vein' && p.state !== 'waiting');
      if (tex) d.sprite.texture = tex;
      // (the wreck's picture has room round it: set her down on her ring)
      d.sprite.position.set(Math.round(p.x), Math.round(p.y + 12 + (p.kind === 'reef' ? 22 : 0)));
      d.sprite.zIndex = p.y + 12;
      d.sprite.alpha = p.state === 'done' && p.kind !== 'cave' ? 0.8 : 1;
      d.sprite.tint = p.state === 'waiting' ? 0xffffff : 0xb8b8c8;
      d.ring.position.set(Math.round(p.x), Math.round(p.y + 12));
      d.ring.zIndex = p.y - 1e5; // (on the ground)
      d.ring.visible = p.state === 'waiting' && !!p.dest;
    }
    for (const [id, d] of this.placesDrawn)
      if (!seen.has(id)) {
        d.sprite.destroy();
        d.ring.destroy();
        this.placesDrawn.delete(id);
      }
  }

  /** Each frame: the rings pulse. */
  renderPlaces(now: number): void {
    for (const d of this.placesDrawn.values()) {
      if (!d.ring.visible) continue;
      const k = 0.5 + 0.5 * Math.sin(now / 350);
      d.ring.clear().ellipse(0, 0, 22 + k * 4, 11 + k * 2).stroke({ color: 0xff6050, width: 2, alpha: 0.5 + 0.4 * k });
    }
  }

  /** The place under a world point, if any (found ones only). */
  placeAt(wx: number, wy: number): PlaceView | null {
    for (const d of this.placesDrawn.values()) if (Math.abs(wx - d.view.x) <= 28 && wy <= d.view.y + 16 && wy >= d.view.y - 40) return d.view;
    return null;
  }

  /* ------------------------------------------------------------ buildings */

  private art(b: Building): PixelArt {
    if (b.def === 'campfire') return (campfirePack() ?? this.fire)[0];
    const f = footprint(b);
    if (isPlot(b.def)) return fieldArt(b.def, f.w, f.h, cropLook(b), this.tone, this.toneKey);
    // (a castle's room: its furnishings, on the castle's floor: map/castleArt.ts)
    if (b.room) return roomFurniture(BUILDING_BY_ID[b.def], f.w, b.id, this.tone, this.toneKey, this.style) ?? topDownArt(b.def, f.w, f.h, this.tone, this.toneKey, this.style);
    // (the seat of the town: its own picture, by origin and stage: art/seatArt.ts)
    const seat = SEAT_STAGE[b.def];
    if (seat) return seatArt(seat.origin, seat.stage, f.w, f.h, this.tone, this.toneKey);
    // (a pack picture where one suits the look: map/packBuildings.ts)
    // (else the top-down painter's: art/topDown.ts)
    return packArt(b.def, f.w, this.style, b.id, this.wallJoin(b)) ?? topDownArt(b.def, f.w, f.h, this.tone, this.toneKey, this.style);
  }

  /** How a one-cell wall piece joins the walls and gates about it: along a row, down a column, at a corner, or alone
   *  (undefined for anything but a wall, so other pictures are untouched). */
  private wallJoin(b: Building): Join | undefined {
    const def = BUILDING_BY_ID[b.def];
    if (b.turned && def?.hp) return 'v'; // (a gate standing down a column)
    if (!def?.hp || def.width !== 1 || def.defense) return undefined;
    const wallAt = (x: number, y: number) => this.simBuildings.some((o) => o !== b && !!BUILDING_BY_ID[o.def]?.hp && !BUILDING_BY_ID[o.def]?.defense && inRect(footprint(o), x, y));
    const l = wallAt(b.tile - 1, b.row), r = wallAt(b.tile + 1, b.row), u = wallAt(b.tile, b.row - 1), d = wallAt(b.tile, b.row + 1);
    // (a run down a column is the west wall's or the east wall's: its post stands at the left or the right of the cell to
    // meet the corners' posts; told by which way the run turns at its ends)
    const side = (): Join => {
      for (const step of [-1, 1]) {
        let y = b.row;
        for (let i = 0; i < 200 && wallAt(b.tile, y + step); i++) y += step;
        if (y === b.row) continue;
        const east = wallAt(b.tile - 1, y), west = wallAt(b.tile + 1, y);
        if (west !== east) return west ? 'v' : 've';
      }
      return 'v';
    };
    if ((l || r) && !(u || d)) return 'h';
    if ((u || d) && !(l || r)) return side();
    // (where a wall runs through, it's a straight piece: a run along a row with a spur, or down a column with one)
    if (l && r) return 'h';
    if (u && d) return side();
    if (r && d) return 'nw';
    if (l && d) return 'ne';
    if (r && u) return 'sw';
    if (l && u) return 'se';
    return l || r ? 'h' : u || d ? 'v' : 'end';
  }

  /** A castle town's keep on its ground (cells), or none: the floor, the carpet, the curtain wall and its towers. */
  /** A castle town's castle (map/castleArt.ts): its floors and carpet under everything, its walls, gate and towers among
   *  the things. Drawn again when a room is finished, the pack's floor and gate load, the look or the season change. */
  syncCastle(castle: CastleView | null, list: Building[]): void {
    const rooms = castle ? list.filter((b) => b.room && b.status === 'done') : [];
    const key = castle && this.land ? `${castle.core.x},${castle.core.y}|${rooms.map((b) => `${b.id}:${b.tile},${b.row},${b.def}`).join(';')}|${this.toneKey}|${this.season === 'winter' ? 'snow' : ''}|${castleArtReady() ? 'p' : ''}|${castle.doors.join(' ')}|${castle.galleries.length}|${clutterLoaded()}` : '';
    if (this.castle?.key === key) return;
    if (this.castle) {
      this.castle.under.destroy({ children: true });
      for (const f of this.castle.flames) f.glow?.destroy();
      for (const t of this.castle.things) {
        this.wide.delete(t);
        t.destroy({ children: true });
      }
      this.castle = null;
    }
    if (!castle || !this.land) return;
    const drawing = buildCastle(castle, rooms, footprint, this.land.w, this.tone, this.toneKey, this.season === 'winter');
    this.under.addChild(drawing.under);
    for (const t of drawing.things) this.things.addChild(t);
    // the rooms' clutter and lights (map/castleClutter.ts), clear of each room's own piece as drawn
    // (only what each piece paints, run by run of painted columns: its canvas is often wider than the furniture on it,
    // and a throne room's pieces stand apart)
    const occupied = rooms.flatMap((b) => {
      const d = this.buildings.get(b.id);
      if (!d) return [];
      const { tops, height } = d.art;
      const out: { x: number; y: number; w: number; h: number }[] = [];
      let start = -1;
      let top = height;
      let gap = 0;
      const close = (end: number) => {
        if (start >= 0) out.push({ x: d.sprite.x + start, y: d.sprite.y + top, w: end - start + 1, h: height - top });
        start = -1;
        top = height;
      };
      for (let i = 0; i <= tops.length; i++) {
        if (i < tops.length && tops[i] < height) {
          if (start < 0) start = i;
          top = Math.min(top, tops[i]);
          gap = 0;
        } else if (start >= 0 && ++gap >= 6) close(i - gap);
      }
      if (start >= 0) close(tops.length - gap);
      return out;
    });
    const inside = new Set([...castle.cells, ...castle.galleries]);
    const w = this.land.w;
    const gx = (castle.gate.x + 0.5) * CELL;
    const carpetTop = (castle.core.y + castle.core.h / 2) * CELL;
    const carpet = { x: gx - 15, y: carpetTop, w: 30, h: castle.gate.y * CELL - carpetTop + 8 };
    const clutter = castleClutter(castle.core, rooms, footprint, castle.galleries, w, castle.doors, carpet, occupied, castle.hold === 'mountain', (x, y) => !inside.has((y - 1) * w + x));
    drawing.under.addChild(clutter.pools);
    for (const t of clutter.things) this.things.addChild(t);
    // (and after dark each flame glows in the lights layer, like the windows)
    for (const f of clutter.flames) {
      const g = this.lights.addChild(new Sprite(glowTexture()));
      g.anchor.set(0.5);
      g.position.set(Math.round(f.at.x), Math.round(f.at.y));
      g.width = g.height = f.size * 0.7;
      g.tint = 0xffb060;
      f.glow = g;
    }
    this.castle = { key, under: drawing.under, things: [...drawing.things, ...clutter.things], flames: clutter.flames };
  }

  /** The town's buildings as last synced (a wall piece's picture depends on its neighbours: `wallJoin`). */
  private simBuildings: Building[] = [];

  syncBuildings(list: Building[]): void {
    this.simBuildings = list;
    const seen = new Set<number>();
    for (const b of list) {
      seen.add(b.id);
      let d = this.buildings.get(b.id);
      const sig = `${sigOf(b)}|${this.artGen}|${this.season === 'winter' ? 'snow' : ''}|${this.wallJoin(b) ?? ''}`;
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
    for (const e of d.extras ?? []) e.destroy();
    for (const g of d.glows ?? []) g.destroy();
  }

  /** A frame of the air: smoke from the finished buildings' chimneys and stacks, and the fireflies. */
  renderAir(dt: number): void {
    this.fireflies(dt);
    if (this.castle?.flames.length) flickerCastle(this.castle.flames, (this.flick += dt));
    this.festival.render(dt, this.lights.alpha > 0.3, this.calm);
    if (this.calm) return;
    this.smoke.amount = this.smokeAmount;
    const chimneys: { x: number; y: number }[] = [];
    for (const d of this.buildings.values()) if (d.chimneys && d.sprite.renderable) chimneys.push(...d.chimneys);
    this.smoke.update(dt, chimneys);
  }

  /** Fireflies over the grass in view on warm, fair nights (the lights layer is dark by day): each drifts, blinks a
   *  few times and winks out, and another comes. */
  private fireflies(dt: number): void {
    const warm = (this.season === 'spring' || this.season === 'summer') && this.biome !== 'tundra' && this.biome !== 'desert';
    const fair = this.weather === 'clear' || this.weather === 'cloudy';
    const want = !this.calm && warm && fair && this.lights.alpha > 0.2 && this.land ? FLIES_MAX : 0;
    const { x, y, w, h } = this.view;
    while (this.flies.length > want) this.flies.pop()!.s.destroy();
    for (let tries = 0; this.flies.length < want && tries < 12; tries++) {
      const fx = x + Math.random() * w;
      const fy = y + Math.random() * h;
      const cx = Math.floor(fx / CELL);
      const cy = Math.floor(fy / CELL);
      if (!FLY_GROUND.has(groundAt(this.land!, cx, cy)) || visibility(this.land!, cx, cy) === 0) continue;
      const sp = this.lights.addChild(new Sprite(glowTexture()));
      sp.anchor.set(0.5);
      sp.width = sp.height = 7;
      sp.tint = 0xd8ff78;
      sp.alpha = 0;
      this.flies.push({ s: sp, x: fx, y: fy, vx: 0, vy: 0, phase: Math.random() * Math.PI * 2, rate: 1.5 + Math.random() * 2, life: 4 + Math.random() * 8 });
    }
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i];
      f.life -= dt;
      f.phase += dt * f.rate;
      f.vx = (f.vx + (Math.random() - 0.5) * 40 * dt) * 0.98;
      f.vy = (f.vy + (Math.random() - 0.5) * 40 * dt) * 0.98;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const out = f.x < x - 20 || f.x > x + w + 20 || f.y < y - 20 || f.y > y + h + 20;
      if (f.life <= 0 || out) {
        f.s.destroy();
        this.flies.splice(i, 1);
        continue;
      }
      const blink = Math.max(0, Math.sin(f.phase));
      f.s.alpha = blink * blink * Math.min(1, f.life);
      f.s.position.set(f.x, f.y);
    }
  }

  private draw(b: Building, sig: string): DrawnBuilding {
    // (in winter the finished buildings wear a cap of snow along their tops: art/snowCap.ts)
    const bare = this.art(b);
    const art = this.season === 'winter' && b.status === 'done' && !isPlot(b.def) && b.def !== 'campfire' ? snowCapped(bare) : bare;
    const f = footprint(b);
    const cx = (f.x + f.w / 2) * CELL;
    // (a castle's room: its furnishings stand in the middle of the floor, clear of the south wall)
    const bottom = b.room ? Math.round((f.y + f.h / 2) * CELL + Math.min(art.height / 2, (f.h * CELL) / 2 - 10)) : (f.y + f.h) * CELL - 2;
    const left = Math.round(cx - art.width / 2);
    const top = bottom - art.height;
    const rect = b.room ? { x: f.x * CELL, y: f.y * CELL, w: f.w * CELL, h: f.h * CELL } : { x: left, y: top, w: art.width, h: art.height };
    const shadow = this.things.addChild(new Sprite(glowTexture()));
    shadow.anchor.set(0.5);
    shadow.tint = 0x000000;
    shadow.alpha = 0.45;
    shadow.width = art.width + 10;
    shadow.height = 10;
    shadow.position.set(cx + 2, bottom - 1);
    shadow.zIndex = bottom - 0.5;
    const flat = isPlot(b.def);
    if (b.room) shadow.visible = false;
    // (a building standing in the sea: a ring of foam about its foot instead of a shadow)
    if (this.land && inSea(this.land, f)) {
      shadow.tint = 0xffffff;
      shadow.alpha = 0.5;
      shadow.width = art.width + 18;
      shadow.height = 16;
      shadow.position.set(cx, bottom - 4);
    }
    if (flat) {
      // (a plot lies on the ground: no shadow, and everything standing on it is drawn over it)
      shadow.visible = false;
      shadow.zIndex = top;
    }
    const sprite = this.things.addChild(b.def === 'campfire' && b.status === 'done' ? animated(campfirePack() ?? this.fire) : new Sprite(art.texture));
    sprite.position.set(left, top);
    sprite.zIndex = flat ? top - 1e6 : bottom;
    const d: DrawnBuilding = { sig, sprite, shadow, art, rect, progress: -1, ...(b.room ? { room: true } : {}) };
    if (b.status === 'done') {
      // its windows and fires glow after dark (the picture's lamp colours, or a fire's own glow; a candle in a room)
      const lamps = art.lights?.length
        ? art.lights.map((l) => ({ x: left + l.x, y: top + l.y, r: l.r, color: l.color }))
        : FIRES.has(b.def)
          ? [{ x: cx, y: bottom - (f.h * CELL) / 2, ...FIRE_GLOW }]
          : b.room
            ? [{ x: cx, y: (f.y + f.h / 2) * CELL, r: 9, color: parseInt(this.tone('#f0d890').slice(1), 16) }]
            : [];
      for (const l of lamps) {
        const g = this.lights.addChild(new Sprite(glowTexture()));
        g.anchor.set(0.5);
        g.position.set(Math.round(l.x), Math.round(l.y));
        g.width = g.height = l.r * 2.4;
        g.tint = l.color;
        g.alpha = 0.85;
        (d.glows ??= []).push(g);
      }
      if (art.smoke) d.chimneys = art.smoke.map((c) => ({ x: left + c.x, y: top + c.y }));
      else if (FIRES.has(b.def)) d.chimneys = [{ x: cx, y: bottom - (f.h * CELL) / 2 - 6 }]; // (an open fire smokes too)
      // (a lantern post, a barrel, a cart by a pack-drawn house's corners)
      const x0 = f.x * CELL;
      const y0 = (f.y + f.h) * CELL;
      // (standing in the sea: coral, shells and weed of the Seabed pack grown up round its foot; the set's first two,
      // the drowned statues, are left out)
      // (its front standing in the water is enough: a home on the shoreline has its back on the strand)
      const sea = this.land && inSea(this.land, { x: f.x, y: f.y + f.h - 1, w: f.w, h: 1 }) ? this.propTex.get('sea') : undefined;
      if (sea && sea.length > 2)
        SEA_DRESS.forEach(([fx, fy], k) => {
          const tex = sea[2 + ((b.id * 7 + k * 13) % (sea.length - 2))];
          const sp = this.things.addChild(new Sprite(tex));
          sp.scale.set(SEA_DRESS_K / PROP_FINE);
          sp.anchor.set(0.5, 1);
          sp.position.set(Math.round(x0 + fx * f.w * CELL), Math.round(y0 + fy));
          sp.zIndex = y0 + fy + 0.1;
          (d.extras ??= []).push(sp);
        });
      for (const e of packDressing(b.def, b.id, f.w, this.style)) {
        const sp = this.things.addChild(new Sprite(e.texture));
        sp.position.set(Math.round(x0 + e.dx), Math.round(y0 + e.dy - e.h));
        if (e.tint !== undefined) sp.tint = e.tint;
        sp.zIndex = y0 + e.dy + 0.2;
        (d.extras ??= []).push(sp);
      }
    }
    if (b.status === 'blueprint') {
      // a faint outline of the whole, the finished picture masked to the progress, and the construction site over it
      const faint = this.things.addChild(new Sprite(art.texture));
      faint.position.set(left, top);
      faint.alpha = 0.35;
      faint.tint = BLUEPRINT_TINT;
      faint.zIndex = bottom - 0.2;
      // (both stand at the picture's corner and draw from there: the culling goes by where a thing stands)
      const mask = this.things.addChild(new Graphics());
      mask.position.set(left, top);
      sprite.mask = mask;
      const site = this.things.addChild(new Graphics());
      site.position.set(left, top);
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
    const { w, h } = d.rect;
    const built = Math.round(h * b.progress);
    d.mask!.clear().rect(0, h - built, w, built).fill(0xffffff);
    const def = BUILDING_BY_ID[b.def];
    const left = stillNeeded(b);
    const delivered = Object.fromEntries(Object.entries(def.cost).map(([m, n]) => [m, Math.max(0, (n ?? 0) - ((left as Record<string, number>)[m] ?? 0))]));
    drawSite(d.site!.clear(), { x: 0, y: 0, w, h, progress: b.progress, delivered, cost: def.cost, era: eraOfResearch(def.research), seed: b.id, now: performance.now() }, this.tone);
  }

  /** Whether something standing (not a plot) is drawn under a world point: where a bird can't come down. */
  standingAt(wx: number, wy: number): boolean {
    for (const d of this.buildings.values()) {
      const r = d.rect;
      if (wx >= r.x && wx < r.x + r.w && wy >= r.y && wy < r.y + r.h && !isPlot(d.sig.slice(0, d.sig.indexOf('|')))) return true;
    }
    return false;
  }

  /** The building whose picture is under a world point (the one standing furthest down first). */
  buildingAt(wx: number, wy: number): number | null {
    let best: { id: number; z: number } | null = null;
    for (const [id, d] of this.buildings) {
      const r = d.rect;
      if (wx < r.x || wx >= r.x + r.w || wy < r.y || wy >= r.y + r.h) continue;
      // (through the clear parts of the picture: its top edge per column; a room anywhere on its floor)
      const col = Math.floor(wx - r.x);
      if (!d.room && wy - r.y < d.art.tops[col]) continue;
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
    const gdef = BUILDING_BY_ID[defId];
    const art = packArt(defId, gdef.width, this.style) ?? topDownArt(defId, gdef.width, depthOf(gdef), this.tone, this.toneKey, this.style);
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

