// The town seen isometrically (being built: Settings' "Isometric view (in progress)" turns it on; the top-down
// map/mapView.ts is still the game's view). Only the drawing differs: the land's cells are laid as diamonds
// (iso/isoMath.ts), the ground drawn with the town's people's kit tiles and each building with the kit's piece for it
// (iso/isoKits.ts). The townsfolk are the top-down view's own (map/mapPeople.ts draws them into `things` in world px):
// `placeLoose` moves whatever it put there to its spot on the diamonds and sorts it among the buildings.
//
// Walls, streets as streets, props, lights, the weather and the other map layers are left for later: in this view
// the walls are fitted pieces of the kit, the roads its path tile, and the rest isn't drawn.

import { Container, Graphics, Matrix, Rectangle, Sprite, Texture } from 'pixi.js';
import { CELL, WEAR_FULL, WEAR_SHOW, cellAt, groundAt, inMap, wet as wetCell, type Ground, type LandMap } from '../../shared/sim/land';
import { valleyById, valleyCells, valleyLandmarks, type LandmarkKind } from '../../shared/sim/startValleys';
import { glowTexture } from '../town/layer';
import type { Biome } from '../../shared/data/biomes';
import { footprint } from '../../shared/sim/buildings';
import type { Building } from '../../shared/sim/state';
import lampUrl from '../art/packs/v_lamp.png';
import { LAMP_LOOK } from '../map/lampRules';
import type { Era } from '../../shared/data/eras';
import { loadImage } from '../art/loadImage';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { cellHash, gateFlip, penSides, propFor, sceneryFor, stockHeaps, wallMaskAt, wallPieceFor, wallShape } from './isoTown';
import { fitted, groundTile, kitOf, kitUrl, liesAlongY, pieceFor, roleOf, sharedPiece, ISO_ART, type Kit } from './isoKits';
import { IsoCastleView, type CastleIn } from './isoCastleView';
import { anyoneNear, doorSpot, gateSpan, hasWindows, lightBox, swing, windowSpots, worldMatrix } from './isoLight';
import { cellsInView, footBase, footDepth, footWidth, isoBounds, isoOrigin, isoToWorld, ISO_TH, ISO_TW, standingDepth, tileToIso, worldToIso, type Rect } from './isoMath';
import { flickerKind, isLit, lightAt, lightsIn, lightTint, placed, type LightKind } from './windowLights';
import { BoxGrid, behind, coverBox, fadeAlpha, fadeStep, isWalker, type Box } from './seeThrough';
import { flicker, flickerSize, phaseOf } from '../map/flicker';
import { EMBERS, emberAt, flameBox, hearthGlow, tongueAt } from './fireLook';
import { reducedMotion } from '../ui/motion';
import { LIGHT_KIND } from '../../shared/data/lighting';

/** A building's picture may stand this much wider than its footprint before it is shrunk to fit (a big piece on a
 *  small building: a cottage piece on a one-cell trap). */
const OVERHANG = 1.25;
/** The kit pieces a starting valley's landmarks are drawn with (sim/startValleys.ts), one picked by the cell, and how
 *  big beside the land's trees. */
const LANDMARK_PIECES: Readonly<Record<LandmarkKind, string[]>> = {
  ruin: ['wild/ruin_1', 'wild/ruin_2'],
  wall: ['settlers/stone_wall_run'],
  pillar: ['wild/pillar_1', 'wild/pillar_2', 'wild/pillar_3'],
  statue: ['wild/statue'],
  well: ['settlers/well'],
  boulder: ['dwarves/boulders'],
  bones: ['wild/bones_1', 'wild/bones_2', 'wild/bones_3'],
  skeleton: ['wild/skeleton'],
  stump: ['wild/stump_1', 'wild/stump_2', 'wild/stump_3'],
  reeds: ['wild/reeds_1', 'wild/reeds_2'],
  flowers: ['wild/flowers_1', 'wild/flowers_2', 'wild/flowers_3', 'wild/flowers_4'],
  cart: ['settlers/cart'],
  signpost: ['settlers/signpost'],
};
const LANDMARK_SCALE = 0.8;
/** Ground tiles are drawn this much over their cell so neighbours overlap and no edge shows. */
const OVERLAP = 1.06;
/** How fast a window's light comes on or goes out (a share a second). */
const LIGHT_RATE = 1.5;
/** The stockade's stakes stand as tall as a wall's: each run drawn as wide as a one-cell wall's (a cell's diamond),
 *  on its thin strip at the pen's edge (iso/isoTown.ts `penSides`). */
const PEN_CELL = footWidth({ x: 0, y: 0, w: 1, h: 1 });
/** Props that are lights of their own (a lamp post, a brazier beside a tavern): a flame at their head after dark. */
const LIGHT_PROP = /torch|brazier|lamp|lantern/;

/** A light in a building's picture after dark (iso/windowLights.ts): its glow (`halo`, added over the night) and, for a
 *  window, the lit pane itself (`core`). */
interface PicLight {
  core: Sprite | null;
  halo: Sprite;
  kind: LightKind;
  phase: number;
  /** The halo's size unflickered. */
  w: number;
  h: number;
  /** Lit now (by who is inside and the hour), how far it has come on (0..1), and whether something drawn in front of
   *  it hides it. */
  on: boolean;
  level: number;
  hidden: boolean;
  /** How strongly it shows at full (the old guess's soft glows are fainter). */
  strength: number;
}

/** A picture's box on the screen (iso px), from its texture, scale and anchor (or its bounds, for a container). */
function boxOf(c: Container): Box {
  if (c instanceof Sprite) {
    const w = Math.abs(c.scale.x) * c.texture.width;
    const h = Math.abs(c.scale.y) * c.texture.height;
    const ax = c.scale.x < 0 ? 1 - c.anchor.x : c.anchor.x;
    const x0 = c.x - ax * w;
    const y0 = c.y - c.anchor.y * h;
    return { x0, y0, x1: x0 + w, y1: y0 + h };
  }
  const b = c.getLocalBounds();
  return { x0: c.x + b.x * c.scale.x, y0: c.y + b.y * c.scale.y, x1: c.x + (b.x + b.width) * c.scale.x, y1: c.y + (b.y + b.height) * c.scale.y };
}

/** A colour taken part way to white. */
const mixWhite = (c: number, t: number): number => {
  const ch = (sh: number) => Math.round(((c >> sh) & 255) + (255 - ((c >> sh) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** A lit window's pane (white, its corners trimmed) and a round one (a rose window), made once. */
let panes: { square: Texture; round: Texture } | null = null;
function paneTexture(round: boolean): Texture {
  if (!panes) {
    const make = (draw: (g: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas');
      c.width = c.height = 16;
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff';
      draw(g);
      return Texture.from(c);
    };
    panes = {
      square: make((g) => {
        g.fillRect(1, 0, 14, 16);
        g.fillRect(0, 1, 16, 14);
      }),
      round: make((g) => {
        g.beginPath();
        g.arc(8, 8, 8, 0, Math.PI * 2);
        g.fill();
      }),
    };
  }
  return round ? panes.round : panes.square;
}

interface DrawnBuilding {
  sprite: Sprite;
  key: string;
  foot: Rect;
  /** The props beside it (a barrel, a crate: iso/isoTown.ts `propFor`). */
  props: Sprite[];
  /** Its door or gate, drawn open while someone walks through (0 shut to 1 open; `held` seconds until it closes). */
  door?: { g: Graphics; gate: boolean; open: number; held: number };
  /** The lights in its picture after dark: its windows, the braziers and lanterns on it, a forge's mouth. */
  lights: PicLight[];
  /** A tavern or a shop: its windows lit of an evening whoever is inside. */
  venue: boolean;
  /** Flames while it burns (`b.fire`), flickering in `animate`. */
  flames?: Sprite[];
  /** A hearth's own flame drawn again over its picture, alive (iso/fireLook.ts): the flame cut from the picture, a
   *  glow about it and the embers off it, with the picture's scale and the flame's foot on the screen. */
  hearth?: { tongue: Sprite; glow: Sprite; embers: Sprite[]; phase: number; k: number; flip: boolean; x: number; y: number };
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
  /** The top-down map's `over` (effects over everything: ash, flood spray, confetti, spells), on the diamonds too. */
  readonly overFlat = new Container();
  /** Effects that rise upright from a point on the land (smoke, sparks, steam, the gains floating up): drawn in iso px
   *  (not squashed with the ground), over the things. Callers put a point on the screen with `isoOf`. */
  readonly screenFx = new Container();
  /** Buildings whose kit piece is not drawn because something else shows them. */
  readonly artHidden = new Set<number>();
  readonly lightLayer = new Container();
  /** After dark: the windows' and lamps' glow (added), the marked cells for clearing, the doors and gates. */
  readonly glow = new Container();
  /** (over the light map, so the marks show plainly at night too) */
  private readonly marks = new Graphics();
  /** Fog and the like that drifts over the land in screen px (the sky's banks: map/mapSky.ts). */
  readonly air = new Container();
  private lamps: { x: number; y: number; lit: boolean }[] = [];
  private lampSprites: Container[] = [];
  /** The lit street lamps' glows, flickering in `animate` as their kind of light does. */
  private lampGlows: { s: Sprite; phase: number }[] = [];
  private lampKind = 'torch';
  /** The pictures that can hide someone behind them (buildings, props, the land's trees and rocks, the castle's
   *  pieces), their cover boxes and draw order, by grid square: worked out again when any of them changes. */
  private covers: { s: Sprite; box: Box; z: number; fades: boolean }[] = [];
  private readonly coverGrid = new BoxGrid();
  private coversDirty = true;
  /** The pictures fading or faded now, and how far (iso/seeThrough.ts), and each one's own alpha unfaded. */
  private readonly fades = new Map<Sprite, number>();
  private readonly baseAlpha = new WeakMap<Sprite, number>();
  private readonly hitNow = new Set<Sprite>();
  private readonly nearNow = new Set<number>();
  /** The building picked (its tap card open): it fades less, so it still reads plainly. */
  private picked: number | null = null;
  /** What the see-through pass cost lately (ms a frame, smoothed), for measuring on a phone. */
  seeCost = 0;
  private lampEra: Era | null = null;
  private lampHadTex = false;
  private markedKey = '';
  /** The planned streets last drawn (the land's string: a new one when any cell changes). */
  private plannedSeen: string | undefined = undefined;
  private highlight: number | null = null;
  /** A path being dragged (renderer/main.ts): the cells it will cover, each laid or blocked, and whether it lifts. */
  private preview: { cells: { i: number; ok: boolean }[]; lift: boolean } | null = null;
  private previewKey = '';
  private biome: Biome = 'forest';
  /** The cells walls, gates and grates stand on (y * land width + x), for joining them. */
  private wallCells = new Set<number>();
  private groundKey = '';
  private readonly fieldCells = new Set<number>();
  private readonly buildings = new Map<number, DrawnBuilding>();
  private builtFrom: Building[] = [];
  private builtGen = -1;
  /** A Blood Court castle or a dwarves' hold, from the castle pieces (iso/isoCastle.ts). */
  private readonly castle = new IsoCastleView(this.things, this.own, (url) => this.texUrl(url));
  private castleIn: CastleIn | null = null;
  /** The view the camera last showed (screen px on the diamonds). */
  view = { x: 0, y: 0, w: 0, h: 0 };

  constructor() {
    this.things.sortableChildren = true;
    this.glow.blendMode = 'add';
    this.glow.eventMode = 'none';
    this.lightLayer.eventMode = 'none';
    this.flat.eventMode = 'none';
    this.overFlat.eventMode = 'none';
    this.screenFx.eventMode = 'none';
    this.world.addChild(this.ground, this.overlay, this.flat, this.things, this.overFlat, this.screenFx, this.lightLayer, this.glow, this.marks);
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
  /** The town's starting valley drawn by hand (sim/startValleys.ts): its landmarks, by cell, as kit pieces. */
  private valleyId: string | undefined;
  private landmarks = new Map<number, { piece: string; ground: Ground; flip: boolean }>();
  setValley(id: string | undefined): void {
    if (id === this.valleyId && (!id || this.landmarks.size || !this.land)) return;
    this.valleyId = id;
    this.landmarks.clear();
    const m = valleyById(id);
    if (m && this.land) {
      const ground = new Map(valleyCells(m, this.land.w, this.land.h, this.land.camp));
      const marks = valleyLandmarks(m, this.land.w, this.land.camp);
      const walls = new Set(marks.filter(([, k]) => k === 'wall').map(([i]) => i));
      for (const [i, kind] of marks) {
        const pieces = LANDMARK_PIECES[kind];
        const piece = pieces[Math.floor(cellHash(i % this.land.w, Math.floor(i / this.land.w), 31) * pieces.length) % pieces.length];
        // (a stretch of old wall lies along its run: the piece mirrored where it was drawn lying the other way)
        const alongX = walls.has(i - 1) || walls.has(i + 1);
        const [kit, name] = piece.split('/');
        const flip = kind === 'wall' && alongX === liesAlongY(kit, name);
        this.landmarks.set(i, { piece, ground: ground.get(i) ?? 'grass', flip });
      }
    }
    this.groundKey = '';
  }

  /** Whether a building stands on a cell. */
  private builtOn(x: number, y: number): boolean {
    for (const d of this.buildings.values()) if (x >= d.foot.x && y >= d.foot.y && x < d.foot.x + d.foot.w && y < d.foot.y + d.foot.h) return true;
    return false;
  }

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
      for (const c of [this.flat, this.overFlat, this.lightLayer]) c.setFromMatrix(new Matrix(m.a, m.b, m.c, m.d, m.tx, m.ty));
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
  /** The path a drag will lay (or lift), drawn live under the finger: a gold diamond on each cell it covers, a red
   *  one crossed on each cell it can't take (a building, deep water, the wild); red outlines for cells to be lifted. */
  setPathPreview(cells: readonly { i: number; ok: boolean }[] | null, lift = false): void {
    const key = cells ? `${lift}|${cells.map((c) => `${c.i}${c.ok ? '' : 'x'}`).join(',')}` : '';
    if (key === this.previewKey) return;
    this.previewKey = key;
    this.preview = cells ? { cells: [...cells], lift } : null;
    this.markedKey = '';
    this.drawMarks();
  }
  private drawMarks(): void {
    const land = this.land;
    if (!land) return;
    const key = `${land.w}|${land.marked.join(',')}|${this.highlight}|${this.previewKey}`;
    if (key === this.markedKey && land.plannedRoads === this.plannedSeen) return;
    this.markedKey = key;
    this.plannedSeen = land.plannedRoads;
    const g = this.marks.clear();
    const diamond = (cx: number, cy: number, inset: number) => {
      const p = [tileToIso(cx + inset, cy + inset, this.ox), tileToIso(cx + 1 - inset, cy + inset, this.ox), tileToIso(cx + 1 - inset, cy + 1 - inset, this.ox), tileToIso(cx + inset, cy + 1 - inset, this.ox)];
      return p;
    };
    // (the streets and paths still to be paved: a faint bed and a dotted line along the way it runs, joining the
    // cells beside it that are planned or paved)
    const plan = land.plannedRoads;
    if (plan)
      for (let i = plan.indexOf('#'); i >= 0; i = plan.indexOf('#', i + 1)) {
        const c = cellAt(land, i);
        g.poly(diamond(c.x, c.y, 0.18).flatMap((q) => [q.x, q.y])).fill({ color: 0xf0e0b0, alpha: 0.16 });
        const mid = tileToIso(c.x + 0.5, c.y + 0.5, this.ox);
        g.circle(mid.x, mid.y, 2.6).fill({ color: 0xfff4d0, alpha: 0.85 });
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
          const x = c.x + dx, y = c.y + dy;
          if (x < 0 || y < 0 || x >= land.w || y >= land.h) continue;
          const j = y * land.w + x;
          if (plan[j] !== '#' && land.roads[j] !== '#') continue;
          // (two dots on the way to the neighbour; the far one is drawn by it, if it's planned too)
          for (const k of [0.25, 0.5]) {
            const p = tileToIso(c.x + 0.5 + dx * k, c.y + 0.5 + dy * k, this.ox);
            g.circle(p.x, p.y, 2.2).fill({ color: 0xfff4d0, alpha: 0.85 });
          }
        }
      }
    for (const i of land.marked) {
      const c = cellAt(land, i);
      const p = diamond(c.x, c.y, 0.04);
      g.poly(p.flatMap((q) => [q.x, q.y])).fill({ color: 0xffe080, alpha: 0.22 }).stroke({ color: 0xffe080, width: 3, alpha: 0.95 });
      const q = diamond(c.x, c.y, 0.25);
      g.moveTo(q[0].x, q[0].y).lineTo(q[2].x, q[2].y).moveTo(q[1].x, q[1].y).lineTo(q[3].x, q[3].y).stroke({ color: 0xfff0b0, width: 3, alpha: 0.8 });
    }
    if (this.preview) {
      const lift = this.preview.lift;
      for (const { i, ok } of this.preview.cells) {
        const c = cellAt(land, i);
        const p = diamond(c.x, c.y, 0.06).flatMap((q) => [q.x, q.y]);
        if (ok && !lift) {
          g.poly(p).fill({ color: 0xffd060, alpha: 0.42 }).stroke({ color: 0xfff0b0, width: 2.5, alpha: 0.95 });
          continue;
        }
        g.poly(p).fill({ color: 0xe04030, alpha: ok ? 0.3 : 0.22 }).stroke({ color: 0xff7060, width: 2.5, alpha: 0.95 });
        if (ok) continue;
        const q = diamond(c.x, c.y, 0.3);
        g.moveTo(q[0].x, q[0].y).lineTo(q[2].x, q[2].y).moveTo(q[1].x, q[1].y).lineTo(q[3].x, q[3].y).stroke({ color: 0xffb0a0, width: 2.5, alpha: 0.9 });
      }
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

  /** The town's street lights (cells), lit or not: each gets its post (a torch on a stake, or the lantern post from the
   *  Medieval age) standing among the things, and, when lit, a small flame glow over the light map's pool. A glow is
   *  never drawn without its post under it. */
  setLamps(lights: readonly { x: number; y: number; lit: boolean }[], era: Era = 'medieval'): void {
    const same = era === this.lampEra && lights.length === this.lamps.length && lights.every((l, i) => l.x === this.lamps[i].x && l.y === this.lamps[i].y && l.lit === this.lamps[i].lit);
    const post = LAMP_LOOK[era] ?? LAMP_LOOK.medieval;
    const tex = post.kind === 'post' ? this.texUrl(lampUrl) : null;
    const have = post.kind === 'post' ? tex !== null : true;
    if (same && have === this.lampHadTex) return;
    this.lampHadTex = have;
    this.lampEra = era;
    this.lamps = lights.map((l) => ({ x: l.x, y: l.y, lit: l.lit }));
    for (const s of this.lampSprites) {
      this.own.delete(s);
      s.destroy({ children: true });
    }
    this.lampSprites = [];
    this.lampGlows = [];
    this.lampKind = LIGHT_KIND[era]?.name ?? 'torch';
    for (const l of this.lamps) {
      const p = tileToIso(l.x + 0.5, l.y + 0.5, this.ox);
      const foot = { x: Math.round(p.x), y: Math.round(p.y) };
      let stand: Container;
      if (post.kind === 'torch' || !tex) {
        // (a torch on a stake, as the top-down view draws it)
        const g = new Graphics();
        g.rect(-1, -22, 2, 22).fill(0x5a3a20);
        g.rect(-2, -26, 4, 5).fill(0x3a2a18);
        g.circle(0, -28, 2.5).fill(l.lit ? 0xffa030 : 0x5a4a38);
        if (l.lit) g.circle(0, -29, 1.3).fill(0xfff0a0);
        stand = g;
      } else {
        const sp = new Sprite(tex);
        sp.anchor.set(0.5, 1);
        sp.scale.set(0.8);
        if (post.tint !== 0xffffff) sp.tint = post.tint;
        stand = sp;
      }
      stand.position.set(foot.x, foot.y);
      stand.zIndex = footDepth({ x: l.x, y: l.y, w: 1, h: 1 }) + 0.015;
      this.things.addChild(stand);
      this.own.add(stand); // (already on the diamonds: placeLoose must not move it again)
      this.lampSprites.push(stand);
      if (!l.lit) continue;
      const s = new Sprite(glowTexture());
      s.anchor.set(0.5);
      s.tint = 0xffb060;
      s.width = s.height = 22;
      s.position.set(foot.x, foot.y - 26);
      this.glow.addChild(s);
      this.lampSprites.push(s);
      this.lampGlows.push({ s, phase: phaseOf(l.x + 0.5, l.y + 0.5) });
    }
  }

  /** A square of world px covering the whole screen, for the layers worked out in world px (the light map). */
  lightView(): { x: number; y: number; w: number; h: number } {
    return lightBox(this.view, this.ox);
  }

  /** A kit piece's picture, asked for the first time it's wanted (null until it has loaded). */
  private texOf(piece: string): Texture | null {
    return this.texUrl(kitUrl(this.kit.name, piece));
  }
  private texUrl(url: string): Texture | null {
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

  /** A shared building piece with its bottom `soil` px cut off (the soil or water block under its ground). */
  private trimmed = new Map<string, { of: Texture; face: Texture }>();
  private trimmedOf(piece: string, soil: number): Texture | null {
    const tex = this.texOf(piece);
    if (!tex || soil <= 0) return tex;
    const had = this.trimmed.get(piece);
    if (had?.of === tex) return had.face;
    const face = new Texture({ source: tex.source, frame: new Rectangle(tex.frame.x, tex.frame.y, tex.width, Math.max(1, tex.height - soil)) });
    this.trimmed.set(piece, { of: tex, face });
    return face;
  }

  /** The town's castle or hold (every snapshot, before the buildings), or none. */
  setCastle(c: CastleIn | null): void {
    this.castleIn = c;
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
    this.castle.sync(this.castleIn, list, land?.w ?? 0, footprint, this.ox, this.kit.scale * ISO_ART, this.texGen);
    for (const b of list) {
      // (a castle's rooms are drawn by the castle: iso/isoCastleView.ts)
      if (b.room && b.status === 'done' && this.castle.people) continue;
      const foot = footprint(b);
      if ('field' in roleOf(b.def)) {
        if (land) for (let y = foot.y; y < foot.y + foot.h; y++) for (let x = foot.x; x < foot.x + foot.w; x++) fields.add(y * land.w + x);
        continue;
      }
      seen.add(b.id);
      let piece = pieceFor(this.kit, b.def);
      let flip = false;
      const role = roleOf(b.def);
      // (the stockade's picture is its gate; the rest of its sides are drawn with its props: `setProps`)
      const pen = 'role' in role && role.role === 'stockade' ? penSides(foot).find((p) => p.part === 'gate')! : null;
      const drawFoot = pen ? pen.foot : foot;
      if (pen) {
        piece = wallPieceFor([...this.kit.pieces.keys()], 'gate', b.def) ?? piece;
        flip = pen.alongY !== liesAlongY(this.kit.name, piece);
      }
      if ('role' in role && (role.role === 'wall_run' || role.role === 'gate') && land) {
        const ids = [...this.kit.pieces.keys()];
        if (role.role === 'gate') {
          piece = wallPieceFor(ids, 'gate', b.def) ?? piece;
          flip = gateFlip(foot) !== liesAlongY(this.kit.name, piece);
        } else {
          // (a one-cell wall joins the walls beside it: a run along x or y, or a corner; a run drawn lying along y is
          // mirrored to lie along x)
          const m = wallMaskAt(isWall, foot.x, foot.y);
          const shape = wallShape(m);
          piece = wallPieceFor(ids, shape.part, b.def) ?? piece;
          flip = shape.part === 'run' ? shape.flip !== liesAlongY(this.kit.name, piece) : shape.flip;
        }
      }
      // (a shared piece, art/iso/buildings/: its ground is drawn as the footprint, so it's fitted to it, its soil cut off,
      // and a long one turned to lie along the footprint's long side)
      const shared = sharedPiece(this.kit.name, piece);
      if (shared?.along_y) flip = foot.w > foot.h;
      const tex = shared ? this.trimmedOf(piece, shared.soil ?? 0) : this.texOf(piece);
      // (a stockpile's heaps beside it, as full as its store: drawn again when they change)
      const heaps = this.heapsOf(b, role, foot);
      const key = `${this.kit.name}:${piece}:${flip ? 'f' : ''}:${b.status}:${b.fire !== undefined ? 1 : 0}:${this.artHidden.has(b.id) ? 'h' : ''}:${foot.x},${foot.y},${foot.w},${foot.h}:${tex ? 1 : 0}:${this.texGen}:${heaps.map((h) => h.piece).join(',')}`;
      let d = this.buildings.get(b.id);
      if (!d) {
        const sprite = new Sprite();
        sprite.anchor.set(0.5, 1);
        this.things.addChild(sprite);
        this.own.add(sprite);
        d = { sprite, key: '', foot, props: [], lights: [], venue: false };
        this.buildings.set(b.id, d);
      }
      d.foot = foot;
      if (d.key === key) continue;
      d.key = key;
      const s = d.sprite;
      s.visible = !!tex && !this.artHidden.has(b.id);
      if (!tex) continue;
      s.texture = tex;
      const span = footWidth(drawFoot);
      const k = pen ? this.penScale(b.def, tex) : fitted(b.def) || shared ? span / tex.width : Math.min(this.kit.scale * ISO_ART, (span * OVERHANG) / tex.width);
      s.scale.set(flip ? -k : k, k);
      const at = footBase(drawFoot, this.ox);
      s.position.set(Math.round(at.x), Math.round(at.y));
      s.zIndex = footDepth(drawFoot);
      // (a blueprint or a building going up: a ghost of what it will be)
      s.alpha = b.status === 'done' ? 1 : 0.45;
      this.baseAlpha.set(s, s.alpha);
      s.tint = b.fire !== undefined ? 0xff9060 : 0xffffff;
      d.venue = 'role' in role && (role.role === 'tavern' || role.role === 'market');
      // (a shared piece is drawn whole: no cottage's barrels beside it, nor a cottage's door on it; its own lights only)
      if (shared) {
        this.clearProps(d);
        this.clearDoor(d);
      } else this.setDoor(d, b, role, foot);
      this.setLights(d, b, role, piece, !!shared, flip, k, tex);
      if (!shared) this.setProps(d, b, role, heaps);
    }
    this.coversDirty = true;
    this.setFlames(list);
    for (const [id, d] of this.buildings) {
      if (seen.has(id)) continue;
      d.sprite.destroy();
      this.own.delete(d.sprite);
      this.clearProps(d);
      this.clearDoor(d);
      this.clearLights(d);
      for (const f of d.flames ?? []) {
        f.destroy();
        this.own.delete(f);
      }
      this.buildings.delete(id);
    }
    if (fields.size !== this.fieldCells.size || [...fields].some((c) => !this.fieldCells.has(c))) {
      this.fieldCells.clear();
      for (const c of fields) this.fieldCells.add(c);
      this.groundKey = '';
    }
  }

  /** A burning building (`b.fire`, 0..1 burned) gets flames along its front: a few glows that flicker in `animate`, more
   *  as it burns. Added to `things` so a building in front hides them. */
  private setFlames(list: readonly Building[]): void {
    for (const b of list) {
      const d = this.buildings.get(b.id);
      if (!d) continue;
      const n = b.fire === undefined ? 0 : 2 + Math.round(b.fire * 4);
      if ((d.flames?.length ?? 0) === n) continue;
      for (const f of d.flames ?? []) {
        f.destroy();
        this.own.delete(f);
      }
      d.flames = [];
      for (let i = 0; i < n; i++) {
        const f = new Sprite(glowTexture());
        f.anchor.set(0.5, 0.8);
        f.tint = i % 2 ? 0xff7020 : 0xffc040;
        f.blendMode = 'add';
        const u = (i + 0.5) / n;
        const at = tileToIso(d.foot.x + u * d.foot.w, d.foot.y + d.foot.h * (0.3 + 0.5 * cellHash(b.id, i, 7)), this.ox);
        f.position.set(Math.round(at.x), Math.round(at.y - 8));
        f.zIndex = footDepth(d.foot) + 0.002;
        this.things.addChild(f);
        this.own.add(f);
        d.flames.push(f);
      }
    }
  }

  private flicker = 0;

  private clearDoor(d: DrawnBuilding): void {
    d.door?.g.destroy();
    d.door = undefined;
  }

  private clearLights(d: DrawnBuilding): void {
    for (const l of d.lights) {
      l.halo.destroy();
      l.core?.destroy();
    }
    d.lights = [];
    if (d.hearth) {
      for (const c of [d.hearth.tongue, d.hearth.glow, ...d.hearth.embers]) {
        c.destroy();
        this.own.delete(c);
      }
      d.hearth = undefined;
    }
  }

  /** A hearth's flame, alive: cut from its picture and laid back over it, to sway, flare and throw embers in
   *  `animate` (iso/fireLook.ts). */
  private setHearth(d: DrawnBuilding, piece: string, flip: boolean, k: number, tex: Texture): void {
    const [x0, y0, x1, y1] = flameBox(`${this.kit.name}/${piece}`, tex.width, tex.height);
    const s = d.sprite;
    const tongue = new Sprite(new Texture({ source: tex.source, frame: new Rectangle(tex.frame.x + x0, tex.frame.y + y0, x1 - x0, y1 - y0) }));
    tongue.anchor.set(0.5, 1);
    const x = s.x + ((x0 + x1) / 2 - tex.width / 2) * k * (flip ? -1 : 1);
    const y = s.y + (y1 - tex.height) * k;
    tongue.position.set(Math.round(x), Math.round(y));
    const z = s.zIndex + 0.003;
    tongue.zIndex = z;
    const glow = new Sprite(glowTexture());
    glow.anchor.set(0.5);
    glow.tint = 0xff9a3a;
    glow.blendMode = 'add';
    glow.position.set(Math.round(x), Math.round(y - (y1 - y0) * k * 0.35));
    glow.zIndex = z + 0.0005;
    const embers: Sprite[] = [];
    for (let i = 0; i < EMBERS; i++) {
      const e = new Sprite(glowTexture());
      e.anchor.set(0.5);
      e.tint = i % 2 ? 0xffd070 : 0xff8a30;
      e.blendMode = 'add';
      e.zIndex = z + 0.001;
      embers.push(e);
    }
    for (const c of [tongue, glow, ...embers]) {
      this.things.addChild(c);
      this.own.add(c);
    }
    d.hearth = { tongue, glow, embers, phase: phaseOf(x / ISO_TW, y / ISO_TW), k, flip, x, y: y - (y1 - y0) * k };
  }

  /** A light at a point on the screen (iso px) with its pane `w` by `h` px (none: a soft glow only), in the glow
   *  layer over the night's dark. */
  private addLight(d: DrawnBuilding, x: number, y: number, w: number, h: number, kind: LightKind, strength = 1): void {
    const tint = lightTint(this.kit.name, kind);
    const flame = kind === 'flame' || kind === 'forge';
    const halo = new Sprite(glowTexture());
    halo.anchor.set(0.5);
    halo.tint = tint;
    halo.visible = false;
    // (a window's light spills a little round its frame; a flame's glows wider)
    const hw = w > 0 ? Math.max(8, w * (flame ? 3.2 : 2.4)) : 20;
    const hh = h > 0 ? Math.max(7, h * (flame ? 2.6 : 1.9)) : 14;
    halo.position.set(Math.round(x), Math.round(y));
    this.glow.addChild(halo);
    let core: Sprite | null = null;
    if (w > 0 && h > 0) {
      core = new Sprite(flame ? glowTexture() : paneTexture(w === h && w >= 10));
      core.anchor.set(0.5);
      // (the pane a paler, hotter shade of the light)
      core.tint = flame ? 0xfff0b0 : mixWhite(tint, 0.35);
      core.width = flame ? w * 1.2 : w;
      core.height = flame ? h * 1.3 : h;
      core.position.set(Math.round(x), Math.round(y));
      core.visible = false;
      this.glow.addChild(core);
    }
    d.lights.push({ core, halo, kind, phase: phaseOf(x / ISO_TW, y / ISO_TW), w: hw, h: hh, on: false, level: 0, hidden: false, strength });
  }

  /** A finished building's lights after dark (iso/windowLights.ts): those placed by hand on its kit's piece; a
   *  fire's own flame on a hearth; else, on a windowed building of a kit not yet placed, the old guess along its front
   *  (`windowSpots`). Whether each is lit is `setInside`'s. */
  private setLights(d: DrawnBuilding, b: Building, role: ReturnType<typeof roleOf>, piece: string, shared: boolean, flip: boolean, k: number, tex: Texture): void {
    this.clearLights(d);
    if (b.status !== 'done' || this.artHidden.has(b.id)) return;
    const s = d.sprite;
    if (placed(this.kit.name, piece, shared)) {
      for (const l of lightsIn(this.kit.name, piece, shared)) {
        const at = lightAt(l, tex.width, tex.height, k, flip, s.x, s.y);
        this.addLight(d, at.x, at.y, at.w, at.h, l.kind);
      }
    } else if ('role' in role && role.role === 'hearth') {
      this.addLight(d, s.x, s.y - tex.height * k * 0.35, 12, 9, 'flame');
    } else if (!shared && 'role' in role && hasWindows(role.role)) {
      for (const at of windowSpots(d.foot)) {
        const p = tileToIso(at.x, at.y, this.ox);
        this.addLight(d, p.x, p.y - 15, 0, 0, 'window', 0.8);
      }
    }
    // (a hearth's painted flame comes alive: iso/fireLook.ts)
    if (!shared && 'role' in role && role.role === 'hearth') this.setHearth(d, piece, flip, k, tex);
    this.lightsKey = '';
  }

  /** Who is inside after dark (the snapshot's `litInside`) and the hour: which windows are lit. Each snapshot. */
  private inside = new Set<number>();
  private lightsKey = '';
  setInside(ids: readonly number[] | undefined, hour: number): void {
    const key = `${ids?.join(',') ?? ''}|${hour}`;
    if (key === this.lightsKey) return;
    this.lightsKey = key;
    this.inside = new Set(ids ?? []);
    for (const [id, d] of this.buildings) {
      const inside = this.inside.has(id);
      for (const l of d.lights) l.on = isLit(l.kind, inside, d.venue, hour);
    }
  }

  /** A finished building's door (a gate's opening). The door is a dark opening drawn over the picture while someone
   *  walks through (`animate`); no art is changed. */
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
  }

  /** Where townsfolk and raiders walk now (world px, every snapshot): a door or gate with any near is to open. */
  private near = new Set<number>();
  /** Called where a door (not a gate) begins to swing open (world px), for its sound (isoSounds.ts). */
  onDoor: ((x: number, y: number) => void) | null = null;
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
    this.flicker += dt;
    const t = this.flicker;
    const gentle = reducedMotion();
    const night = this.glow.visible;
    // (the street lamps' flames waver, each on its own beat; electric light holds steady)
    if (night)
      for (const g of this.lampGlows) {
        g.s.alpha = flicker(this.lampKind, t, g.phase, gentle);
        g.s.width = g.s.height = 22 * flickerSize(this.lampKind, t, g.phase, gentle);
      }
    for (const [id, d] of this.buildings) {
      if (d.flames?.length) {
        d.flames.forEach((f, i) => {
          const ph = id * 1.37 + i * 2.1;
          const k = flickerSize('campfire', t * 1.6, ph, gentle);
          f.width = 26 * k * k;
          f.height = 34 * flickerSize('campfire', t * 1.9, ph + 1.3, gentle) * k;
          f.alpha = 0.55 + 0.45 * flicker('campfire', t * 1.6, ph, gentle);
        });
      }
      // (its lights come on and go out slowly as people come and go, and flicker as a flame or a candle does; they
      // fade with the building when someone behind it shows through)
      const seen = this.fades.has(d.sprite) ? d.sprite.alpha / (this.baseAlpha.get(d.sprite) ?? 1) : 1;
      if (d.hearth) this.animateHearth(d.hearth, t, gentle, night, d.sprite.alpha);
      for (const l of d.lights) {
        l.level = l.on ? Math.min(1, l.level + LIGHT_RATE * dt) : Math.max(0, l.level - LIGHT_RATE * dt);
        const show = night && l.level > 0.01 && !l.hidden;
        l.halo.visible = show;
        if (l.core) l.core.visible = show;
        if (!show) continue;
        const kind = flickerKind(l.kind);
        const f = flicker(kind, t, l.phase, gentle);
        const k = flickerSize(kind, t, l.phase, gentle);
        l.halo.alpha = l.level * l.strength * seen * f * (l.core ? 0.55 : 0.8);
        l.halo.width = l.w * k;
        l.halo.height = l.h * k;
        if (l.core) l.core.alpha = l.level * l.strength * seen * (0.55 + 0.45 * f);
      }
      const door = d.door;
      if (!door) continue;
      const was = door.open;
      const n = swing(door.open, door.held, this.near.has(id), dt);
      if (was === 0 && n.open > 0 && !door.gate && this.onDoor) {
        const at = doorSpot(d.foot);
        this.onDoor(at.x * CELL, at.y * CELL);
      }
      door.open = n.open;
      door.held = n.held;
      if (Math.abs(door.open - was) < 0.01 && !(door.open === 0 && was !== 0)) continue;
      this.drawDoor(d, door);
    }
  }

  /** A hearth's flame each frame: swayed, stretched and brightened on the flicker's noise, its glow wavering, its
   *  embers rising (iso/fireLook.ts); faded with its picture when someone behind shows through. */
  private animateHearth(h: NonNullable<DrawnBuilding['hearth']>, t: number, gentle: boolean, night: boolean, alpha: number): void {
    const look = tongueAt(t, h.phase, gentle);
    h.tongue.scale.set(h.k * look.sx * (h.flip ? -1 : 1), h.k * look.sy);
    h.tongue.skew.x = look.skew;
    const c = Math.round(200 + 55 * look.bright);
    h.tongue.tint = (255 << 16) | (c << 8) | Math.round(150 + 105 * look.bright);
    h.tongue.alpha = alpha;
    const g = hearthGlow(t, h.phase, night, gentle);
    h.glow.alpha = 0.5 * g * alpha;
    h.glow.width = 70 * h.k * (0.9 + 0.2 * g);
    h.glow.height = 48 * h.k * (0.9 + 0.2 * g);
    h.embers.forEach((e, i) => {
      const at = emberAt(i, gentle ? t * 0.5 : t, h.phase);
      e.position.set(Math.round(h.x + at.dx * h.k), Math.round(h.y + at.dy * h.k));
      e.alpha = at.alpha * alpha * 0.9;
      e.width = e.height = Math.max(2, 4 * h.k);
    });
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

  /** The stockade's gate's scale: as tall as the runs beside it (each drawn as a wall's cell is, `PEN_CELL`), so it
   *  stands a little wider than its cell, posts and all. */
  private penScale(defId: string, gate: Texture): number {
    const run = wallPieceFor([...this.kit.pieces.keys()], 'run', defId);
    const r = run ? this.texOf(run) : null;
    return r ? ((PEN_CELL / r.width) * r.height) / gate.height : PEN_CELL / gate.width;
  }

  /** A finished store's heaps (iso/isoTown.ts `stockHeaps`): the kit's crates, barrels, logs and bales beside it, as
   *  many as it is full. None for anything else. */
  private heapsOf(b: Building, role: ReturnType<typeof roleOf>, foot: Rect): ReturnType<typeof stockHeaps> {
    const room = BUILDING_BY_ID[b.def]?.storage;
    if (!('role' in role) || role.role !== 'stockpile' || b.status !== 'done' || !room) return [];
    return stockHeaps([...this.kit.pieces.keys()], b.store ?? {}, room, foot);
  }

  /** A finished working building's prop, beside it: picked from its id, sorted in depth with everything else (a
   *  store's: its heaps, as full as it is). */
  private setProps(d: DrawnBuilding, b: Building, role: ReturnType<typeof roleOf>, heaps: ReturnType<typeof stockHeaps> = []): void {
    this.clearProps(d);
    if (!('role' in role)) return;
    if (role.role === 'stockade') {
      // (its sides, a run of the kit's wall on each cell, fitted to a thin strip as a wall is; a ghost while it goes
      // up, as the building is)
      const ids = [...this.kit.pieces.keys()];
      for (const side of penSides(d.foot)) {
        if (side.part === 'gate') continue;
        const piece = wallPieceFor(ids, side.part, b.def);
        const tex = piece ? this.texOf(piece) : null;
        if (!piece || !tex) continue;
        const s = new Sprite(tex);
        s.anchor.set(0.5, 1);
        const k = PEN_CELL / tex.width;
        s.scale.set(side.alongY !== liesAlongY(this.kit.name, piece) ? -k : k, k);
        const at = footBase(side.foot, this.ox);
        s.position.set(Math.round(at.x), Math.round(at.y));
        s.zIndex = footDepth(side.foot);
        s.alpha = d.sprite.alpha;
        this.baseAlpha.set(s, s.alpha);
        this.things.addChild(s);
        this.own.add(s);
        d.props.push(s);
      }
      return;
    }
    if (b.status !== 'done') return;
    if (role.role === 'stockpile' && BUILDING_BY_ID[b.def]?.storage) {
      heaps.forEach((h, i) => {
        const tex = this.texOf(h.piece);
        if (!tex) return;
        const s = new Sprite(tex);
        s.anchor.set(0.5, 1);
        // (a little smaller and turned now and then, so a row of the same heap doesn't look stamped)
        const k = this.kit.scale * ISO_ART * (0.5 + 0.06 * (i % 2));
        s.scale.set(cellHash(b.id, i, 23) < 0.4 ? -k : k, k);
        const at = tileToIso(h.x, h.y, this.ox);
        s.position.set(Math.round(at.x), Math.round(at.y));
        s.zIndex = h.x + h.y + 0.02;
        this.things.addChild(s);
        this.own.add(s);
        d.props.push(s);
      });
      return;
    }
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
    // (a lamp or a brazier beside it burns after dark)
    if (LIGHT_PROP.test(pr.piece)) this.addLight(d, s.x, s.y - s.height * 0.82, 4, 5, 'flame', 0.9);
    this.lightsKey = '';
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
      // (a landmark of the starting valley, while its cell lies as the valley left it and nothing is built there)
      const mark = this.landmarks.get(i);
      const marked = !!mark && g === mark.ground && !this.builtOn(x, y);
      const piece = marked ? mark.piece : sceneryFor(ids, g, this.biome, cellHash(x, y, 1), cellHash(x, y, 2));
      const tex = !piece ? null : marked ? this.texUrl(kitUrl(piece.split('/')[0], piece.split('/')[1])) : this.texOf(piece);
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
      t.scale.set(this.kit.scale * ISO_ART * (marked ? LANDMARK_SCALE : /bush/.test(piece) ? 0.7 : 0.85));
      if (marked && mark.flip) t.scale.x *= -1;
      const jx = marked ? x + 0.5 : x + 0.3 + cellHash(x, y, 3) * 0.4;
      const jy = marked ? y + 0.5 : y + 0.3 + cellHash(x, y, 4) * 0.4;
      const at = tileToIso(jx, jy, this.ox);
      t.position.set(Math.round(at.x), Math.round(at.y));
      t.zIndex = jx + jy;
      if (!t.parent) this.things.addChild(t);
    }
    // (the pool's spare sprites are hidden, not destroyed: the view moves on and needs them again)
    for (let k = trees; k < this.scenery.length; k++) this.scenery[k].visible = false;
    this.coversDirty = true;
  }

  /** The building picked (its tap card open), or none: it fades less when someone is behind it. */
  setPicked(id: number | null): void {
    this.picked = id;
  }

  /** The pictures that can hide someone, boxed and put in the grid; and the windows each hides (a window behind a
   *  building or a tree drawn in front of it doesn't shine through it). */
  private rebuildCovers(): void {
    this.coversDirty = false;
    const list: { s: Sprite; box: Box; z: number; fades: boolean }[] = [];
    const add = (s: Sprite, fades: boolean) => {
      if (!s.visible || s.destroyed || s.texture.width <= 1) return;
      list.push({ s, box: coverBox(boxOf(s)), z: s.zIndex, fades });
    };
    // (only the trees and rocks fade for someone behind them, the owner's ask; buildings, their props and the castle
    // stay solid, and still hide the lights behind them)
    for (const d of this.buildings.values()) {
      add(d.sprite, false);
      for (const p of d.props) add(p, false);
    }
    for (const t of this.scenery) add(t, true);
    for (const c of this.castle.pieces()) add(c, false);
    this.covers = list;
    const grid = this.coverGrid;
    grid.clear();
    list.forEach((c, i) => grid.add(i, c.box));
    for (const d of this.buildings.values()) {
      const z = d.sprite.zIndex;
      for (const l of d.lights) {
        const x = l.halo.x;
        const y = l.halo.y;
        l.hidden = false;
        for (const i of grid.near({ x0: x, y0: y, x1: x, y1: y }, this.nearNow)) {
          const c = list[i];
          if (c.z <= z || c.s === d.sprite || d.props.includes(c.s)) continue;
          if (x > c.box.x0 && x < c.box.x1 && y > c.box.y0 && y < c.box.y1) {
            l.hidden = true;
            break;
          }
        }
      }
    }
  }

  /** Each frame, after `placeLoose`: a tree or a rock with someone behind it (a townsperson, the founder, the creature, a
   *  raider, a beast: iso/seeThrough.ts `markWalker`) fades to see them, and comes back once they've gone. Only the
   *  pictures near someone are looked at (`BoxGrid`). */
  seeThrough(dt: number): void {
    const t0 = performance.now();
    if (this.coversDirty) this.rebuildCovers();
    const hit = this.hitNow;
    hit.clear();
    if (this.covers.length)
      for (const c of this.things.children) {
        if (!c.visible || c.alpha < 0.05 || !isWalker(c)) continue;
        const box = boxOf(c);
        for (const i of this.coverGrid.near(box, this.nearNow)) {
          const cv = this.covers[i];
          if (cv.fades && !hit.has(cv.s) && behind(box, c.zIndex, cv.box, cv.z)) hit.add(cv.s);
        }
      }
    for (const s of hit) if (!this.fades.has(s)) this.fades.set(s, 0);
    const picked = this.picked === null ? null : (this.buildings.get(this.picked)?.sprite ?? null);
    for (const [s, f] of this.fades) {
      if (s.destroyed) {
        this.fades.delete(s);
        continue;
      }
      const n = fadeStep(f, hit.has(s), dt);
      s.alpha = (this.baseAlpha.get(s) ?? 1) * fadeAlpha(n, s === picked);
      if (n <= 0) this.fades.delete(s);
      else this.fades.set(s, n);
    }
    this.seeCost = this.seeCost * 0.95 + (performance.now() - t0) * 0.05;
  }

  /** Everything others put in `things` in world px (the townsfolk: map/mapPeople.ts), moved to its spot on the
   *  diamonds and sorted among the buildings. Run after they have drawn, every frame. */
  private nearFeet: Rect[] = [];
  private nearFor: Building[] | null = null;
  private nearGen = -2;
  private nearN = -1;
  placeLoose(): void {
    // (the footprints are kept between frames: they change only when the buildings are synced)
    if (this.nearFor !== this.builtFrom || this.nearGen !== this.builtGen || this.nearN !== this.buildings.size) {
      this.nearFor = this.builtFrom;
      this.nearGen = this.builtGen;
      this.nearN = this.buildings.size;
      this.nearFeet = [...this.buildings.values()].map((d) => d.foot);
    }
    const near = this.nearFeet;
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

  /** The top of a building's picture (iso px, the middle of its width), for what flies over it: null if it isn't drawn. */
  topOf(id: number): { x: number; y: number } | null {
    const s = this.buildings.get(id)?.sprite;
    return s?.visible ? { x: s.x, y: s.y - s.height } : null;
  }

  /** The building whose picture is under a screen point, the front-most first (a roof hides what's behind it). */
  buildingAt(sx: number, sy: number): number | null {
    const x = sx - this.world.x - this.root.x;
    const y = sy - this.world.y - this.root.y;
    let best: { id: number; z: number } | null = null;
    const room = this.castle.roomAt(x, y);
    if (room !== null) best = { id: room, z: -1 };
    for (const [id, d] of this.buildings) {
      const s = d.sprite;
      if (!s.visible && !(this.artHidden.has(id) && s.texture.width > 1)) continue;
      const w = s.width;
      const h = s.height;
      if (x < s.x - w / 2 || x > s.x + w / 2 || y < s.y - h || y > s.y) continue;
      if (!best || s.zIndex > best.z) best = { id, z: s.zIndex };
    }
    return best?.id ?? null;
  }

  /** The screen's four corners as ground points (world px), for the minimap's frame: a slanted patch on the land. */
  viewQuad(): { x: number; y: number }[] {
    const v = this.view;
    return [isoToWorld(v.x, v.y, this.ox), isoToWorld(v.x + v.w, v.y, this.ox), isoToWorld(v.x + v.w, v.y + v.h, this.ox), isoToWorld(v.x, v.y + v.h, this.ox)];
  }

  /** The part of the land in view, as a box of world px round the ground under the view's middle (for the layers
   *  still drawn and culled in world px: the light map, the minimap's frame). */
  worldView(): { x: number; y: number; w: number; h: number } {
    const v = this.view;
    const mid = isoToWorld(v.x + v.w / 2, v.y + v.h / 2, this.ox);
    return { x: mid.x - v.w / 2, y: mid.y - v.h / 2, w: v.w, h: v.h };
  }
}
