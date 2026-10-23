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
import { guildBadge, guildsOf } from '../art/guildMarks';
import type { GuildRole } from '../../shared/data/guilds';
import { MapRaiders } from '../map/mapRaiders';
import type { MapView } from '../map/mapView';
import { pxFrames, sheetOf } from '../town/spellsView';
import { actIdOf, actSprite } from '../fight/actLooks';
import { loadDelveProps, propFrame } from '../art/delveProps';
import type { SpriteFx } from '../town/spellLooks';
import { areaTiles } from '../../shared/sim/tacticsArea';
import { PROP_GROW } from '../art/props';
import { BattleJuice } from '../battle/juice';
import { ShotPainter, shotTicks } from '../battle/projectiles';
import { BoardLife, logTexture } from './boardLife';
import { actArrow, actElement, FAMILY_SCALE, familyOf, MELEE_FX, SOLID, STATUS_CUE } from '../../shared/data/actFx';
import type { Status } from '../../shared/data/effects';
import { FIRST_BLOOD, ghostStep, LAG_MAX_MS, ROUTED } from '../battle/juiceRules';
import { uiPlate } from '../ui/pixiFrame';
import type { TileLook } from '../../shared/sim/raidBoards';
import { IsoBoardArt } from './isoBoard';
import { ALONG_Y, liesAlongY } from '../iso/isoKits';
import { DECOR_ART, DECOR_TALL, cellRoll, floraOf, generatedDecor, isRunPiece, joinOf, pickOf, runParts, type RunPart } from './boardDress';
import type { DecorKind } from '../../shared/sim/raidBoards';

/** A tile's diamond (px), and a step of height. */
/** How long the board's camera takes to glide most of the way to the unit whose turn it is (ms). */
const CAM_GLIDE_MS = 260;
const TW = 64;
/** The widest an effect is drawn on the board (world px): a spell or skill about a tile and a half, an ultimate more. */
const FX_MOST = 96;
const ULT_MOST = 150;
const ICON_SCALE = 0.45;
const TH = 32;
const HH = 12;
/** How far the columns reach below the ground's level. */
const FOOT = 10;
/** How wide a hand-made board's prop is drawn (tiles; the rest 0.85): a hut, a mill, a ruined arch, a wagon stand bigger. */
const PROP_WIDE: Record<string, number> = { cottage: 1.25, 'wild/mill': 1.5, 'wild/ruin_1': 1.05, 'nomads/covered_wagon': 1.1, 'dwarves/boulders': 0.95, well: 0.8 };
/** A sim tick (ms). */
const TICK = 100;

/** A hand-made board's tile looks (sim/raidBoards.ts) washed over the land's painted ground in the flat view. */
const LOOK_WASH: Partial<Record<TileLook, string>> = {
  dirt: 'rgba(150,110,70,0.55)',
  field: 'rgba(130,140,50,0.35)',
  flag: 'rgba(200,190,170,0.5)',
  snow: 'rgba(240,244,250,0.8)',
  ice: 'rgba(170,205,235,0.75)',
  mud: 'rgba(90,70,45,0.6)',
  plank: 'rgba(176,122,68,0.85)',
};
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
/** The guild badges as textures, one a role, made once (the boxes are redrawn often); the glyph is painted when its sheet loads. */
const badgeTextures = new Map<string, Texture>();
function badgeTexture(role: GuildRole): Texture {
  let tex = badgeTextures.get(role);
  if (!tex) {
    const canvas = guildBadge(role, 16, undefined, () => tex?.source.update());
    tex = Texture.from(canvas);
    badgeTextures.set(role, tex);
  }
  return tex;
}
/** A unit box's height: a caster's mana bar takes a row more. */
const boxHeight = (u: TacUnitView) => (!u.tower && u.mp !== null && u.mpMax ? 78 : 72);
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
  /** Arrows, bolts and spells in the air (battle/projectiles.ts), and the board's own life (birds, wind, water, torches). */
  private readonly shots = new ShotPainter();
  private readonly life = new BoardLife();
  private readonly people: MapPeople;
  private readonly raiders: MapRaiders;
  private readonly hud = new Container();
  private readonly shade = new Graphics();
  private view: TacticsView | null = null;
  /** With the isometric switch on: the kit's art for the tops, the wall and the towers (null: the classic board). */
  private readonly iso = new IsoBoardArt();
  private defs = new Map<number, string>();

  private key = '';
  private tiles: { c: Container; mark: Graphics; top: number }[] = [];
  private pictures: Sprite[] = [];
  private hits = new Map<string, { born: number }>();
  /** The statuses each unit was last seen with: a new one pops its cue over them. */
  private seenSt = new Map<string, Set<string>>();
  private tookFirst = false;
  private marks: Text[] = [];
  private chestSprites: Sprite[] = [];
  /** The camera: where it looks (x, y), its scale, the finger's pan, the last unit it followed (fx, fy: kept between
   *  one unit's turn and the next, so it never swings back to the middle of the board), and the last frame's time. */
  private cam = { x: 0, y: 0, k: 1, set: false, panX: 0, panY: 0, fx: NaN, fy: NaN, t: 0 };
  private w = 400;
  private h = 400;
  private buttons: Button[] = [];
  private mode: Mode = 'menu';
  private modeFor = '';
  private aimSkill: string | null = null;
  /** Where the aimed skill would fall (its area shown; a second tap there casts it). */
  private aimAt: [number, number] | null = null;
  private selected: string | null = null;
  private skillPage = 0;
  private hudKey = '';
  /** The flash of it all: impacts, numbers, shake, callouts, banners, the victory (battle/juice.ts). */
  private juice = new BattleJuice();
  private seenBanner = '';
  private lastKilled = 0;
  private ults = new Set<string>();
  /** The unit boxes' health bars, drawn each frame with their ghosts (the health just lost, draining after). */
  private barsG = new Graphics();
  private boxes: { key: string; x: number; y: number; w: number }[] = [];
  private ghosts = new Map<string, { g: number; held: number; flash: number; was: number }>();
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
    // (the townsfolk in their isometric looks, as on the map: the board is drawn in the iso kits)
    this.people.isoFolk = true;
    this.people.board = true;
    this.people.rings = 'board';
    this.raiders.rings = 'board';
    this.fx.addChild(this.lines, this.fxSprites, this.shots.container, this.life.container);
    this.world.addChild(this.board, this.fx, this.juice.world);
    this.root.addChild(this.back, this.world, this.shade, this.juice.screen, this.hud, this.barsG);
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
    this.guilds = next.guilds;
    if (this.iso) {
      this.iso.setKit(next.origin.id, next.theme);
      this.defs = new Map(next.buildings.map((b) => [b.id, b.def]));
    }
    const t = next.tactics;

    this.view = t;
    this.root.visible = !!t;
    this.lastUpdate = performance.now() - this.lag;
    if (!t) {
      this.juice.reset();
      this.seenSt.clear();
      this.seenBanner = '';
      this.lastKilled = 0;
      this.tookFirst = false;
      this.ults.clear();
      this.ghosts.clear();
      if (this.key) {
        for (const c of this.tiles) c.c.destroy({ children: true });
        for (const p of this.pictures) p.destroy();
        this.tiles = [];
        this.pictures = [];
        this.key = '';
        this.people.update([], null, performance.now() - this.lag);
        this.raiders.update([], performance.now() - this.lag);
        this.cam.set = false;
        this.cam.fx = this.cam.fy = NaN;
        this.selected = null;
      }
      return;
    }
    // (pictures that have come since the board was built: towers, the wall's and gate's, the boulders and thickets)
    const pics =
      t.tiles.filter((x) => x.bld !== undefined && this.map.buildingPicture(x.bld)).length +
      t.tiles.filter((x) => (x.block === 'rock' || x.bush) && this.map.propKind(x.block === 'rock' ? 'rock' : 'bush', x.lx, x.ly)).length;
    const key = `${t.w}x${t.h}:${t.tiles[0].lx},${t.tiles[0].ly}:${t.side}:${t.tiles.map((x) => x.h).join('')}:${t.tiles.map((x) => (x.hill ? x.hill[1] : x.log ? 'l' : x.art ? 'w' : x.tree ? 't' : x.g[0]) + (x.look?.[0] ?? '') + (x.prop?.[0] ?? '')).join('')}:${pics}${this.iso ? `:${this.iso.kit.name}${this.iso.arrived}:${t.biome}:${t.season}:${t.board ?? ''}:${t.tiles.map((x) => x.decor?.[0] ?? '').join('')}` : ''}`;
    if (key !== this.key || this.tiles.length === 0) this.build(t, key);
    this.life.track(t);
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
        // (a merrow standing in the water on the board shows their tail, as on the map; on land, legs)
        const g = t.tiles[u.v * t.w + u.u]?.g;
        if (p) people.push({ ...p, x, y, dir, indoors: false, defending: true, swimming: p.mer && (g === 'water' || g === 'shallows') });
      } else {
        const r = next.raid?.raiders.find((q) => q.id === u.ref);
        if (r) raiders.push({ ...r, x, y, dir, swimming: false, floor: null });
      }
    }
    // (the unit whose turn it is gets the brighter ring)
    const turn = t.act?.key ?? t.orders?.key ?? '';
    this.people.activeId = turn[0] === 'p' ? Number(turn.slice(1)) : null;
    this.raiders.activeId = turn[0] === 'r' ? Number(turn.slice(1)) : null;
    const now = performance.now() - this.lag;
    this.people.update(people, null, now);
    this.raiders.update(raiders, now);
    // (a new turn waiting on the player opens on the menu)
    if (t.orders && t.orders.key !== this.modeFor) {
      this.modeFor = t.orders.key;
      this.mode = 'menu';
      this.aimSkill = null;
      this.aimAt = null;
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
    this.life.reset();
    let missing = false;
    const flora = floraOf(t.biome, t.season);
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
        if (tile.tree && this.iso) {
          // (in the iso look, the land's own trees from the kits, several kinds, as the iso town has them)
          const tt = this.iso.art(pickOf(flora.tree, tile.lx, tile.ly, 1));
          if (tt) {
            const s = new Sprite(tt);
            s.anchor.set(0.5, 0.95);
            const [x, y] = this.at(u, v, h);
            s.position.set(x + (cellRoll(tile.lx, tile.ly, 2) - 0.5) * 8, y + 2);
            const k = Math.min((TW * (0.72 + cellRoll(tile.lx, tile.ly, 3) * 0.2)) / tt.width, (TH * 2.8) / tt.height);
            s.scale.set(cellRoll(tile.lx, tile.ly, 4) < 0.5 ? -k : k, k);
            c.addChild(s);
            this.life.sway(s);
          } else missing = true;
        } else if (tile.tree) {
          const tt = this.map.propOf(tile.lx, tile.ly) ?? this.map.propKind('tree', tile.lx, tile.ly);
          if (tt) {
            const s = new Sprite(tt);
            s.anchor.set(0.5, 0.95);
            const [x, y] = this.at(u, v, h);
            s.position.set(x + 6, y - 2);
            s.scale.set(0.95 / PROP_GROW.tree);
            c.addChild(s);
            this.life.sway(s);
          }
        }
        // a hand-made board's prop in the iso look: the kit's cart, barrels, fence, fallen wall...
        const prop = tile.prop && this.iso ? this.iso.prop(tile.prop) : null;
        if (tile.prop && this.iso && !prop) missing = true;
        if (prop && isRunPiece(tile.prop!)) {
          // (a fence or a fallen wall lies along its run: joined to the same piece either side, a half toward each at a
          // corner; a stretch of wall on its own lies down the board like the town's, a fence across it)
          const [x, y] = this.at(u, v, h);
          const kp = tile.prop!.includes('/') ? tile.prop! : `settlers/${tile.prop}`;
          const parts = runParts(joinOf(t.w, t.h, u, v, (a, b) => t.tiles[b * t.w + a].prop === tile.prop), /_run$/.test(kp) ? 'v' : 'u', ALONG_Y.has(kp) ? 'v' : 'u');
          for (const part of parts) c.addChild(this.runSprite(prop, part, x, y + TH / 2, TW));
        } else if (prop) {
          const s = new Sprite(prop);
          s.anchor.set(0.5, 0.85);
          const [x, y] = this.at(u, v, h);
          s.position.set(x, y + 2);
          s.scale.set(Math.min((TW * (PROP_WIDE[tile.prop!] ?? 0.85)) / prop.width, (TH * 2.6 * Math.max(1, PROP_WIDE[tile.prop!] ?? 1)) / prop.height));
          c.addChild(s);
        }
        // a fallen log (the wild set's own)
        else if (tile.log && this.iso) {
          // (in the iso look, the packs' fallen trunk, lying either way)
          const lt = this.iso.art('wild/branch');
          if (lt) {
            const s = new Sprite(lt);
            s.anchor.set(0.5, 0.75);
            const [x, y] = this.at(u, v, h);
            s.position.set(x, y + 2);
            const k = (TW * 0.85) / lt.width;
            s.scale.set(cellRoll(tile.lx, tile.ly, 7) < 0.5 ? -k : k, k);
            c.addChild(s);
          } else missing = true;
        } else if (tile.log) {
          const lt = logTexture(tile.lx, tile.ly);
          if (lt) {
            const s = new Sprite(lt);
            s.anchor.set(0.5, 0.8);
            const [x, y] = this.at(u, v, h);
            s.position.set(x, y + 2);
            s.scale.set(Math.min(1.1, (TW * 0.8) / lt.width));
            c.addChild(s);
          } else missing = true;
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
        // the dressing: a hand-made board's own (drawn in LDtk), a little strewn over a generated one's open ground
        const decor = this.iso ? (tile.decor ?? (t.board ? undefined : this.strewn(t, u, v))) : undefined;
        if (decor && !this.dress(c, decor, tile, u, v, h)) missing = true;
        const [, y] = this.at(u, v, h);
        c.zIndex = y - 1;
        this.board.addChild(c);
        this.tiles.push({ c, mark, top: y });
      }
    // the town's wall along its row, the gate in it, and the towers on the wall (the town itself is left off the board)
    for (let v = 0; v < t.h; v++)
      for (let u = 0; u < t.w; u++) {
        const tile = t.tiles[v * t.w + u];
        if (!tile.wall) continue;
        const [x, y] = this.at(u, v, tile.h);
        if (tile.gate) {
          // (the gate once, over its two tiles)
          const above = t.tiles[(v - 1) * t.w + u];
          if (v > 0 && above?.gate) continue;
          // (the gate lies along the wall, down the board's column: mirrored where the kit drew it along x)
          const [x2, y2] = this.at(u, v + 1, tile.h);
          const gate = this.iso.piece(tile.wall);
          const sp = this.isoPiece(gate, (x + x2) / 2, (y + y2) / 2 + TH / 2, TW * 1.3, (y + y2) / 2 + TH / 2);
          if (sp && !liesAlongY(this.iso.kit.name, gate)) sp.scale.x = -sp.scale.x;
          continue;
        }
        // (the wall runs down the board's column: each piece lies along it, joined to the wall and gate either side)
        const run = this.iso.piece(tile.wall);
        const tex = this.iso.texture(run);
        const parts = runParts(joinOf(t.w, t.h, u, v, (a, b) => !!t.tiles[b * t.w + a].wall), 'v', liesAlongY(this.iso.kit.name, run) ? 'v' : 'u');
        if (tex)
          for (const part of parts) {
            const sp = this.runSprite(tex, part, x, y + TH / 2, TW);
            sp.zIndex = y + 2;
            this.board.addChild(sp);
            this.pictures.push(sp);
          }
        const def = tile.bld !== undefined ? this.defs.get(tile.bld) : undefined;
        if (def) this.isoPiece(this.iso.piece(def), x, y + TH / 2, TW * 0.9, y + 3);
      }
    // boulders and thickets on the field
    for (let v = 0; v < t.h; v++)
      for (let u = 0; u < t.w; u++) {
        const tile = t.tiles[v * t.w + u];
        const kind = tile.block === 'rock' && !(tile.prop && this.iso) ? 'rock' : tile.bush ? 'bush' : null;
        if (!kind) continue;
        if (this.iso) {
          // (in the iso look, the land's own rocks and bushes from the kits)
          const kt = this.iso.art(pickOf(kind === 'rock' ? flora.rock : flora.bush, tile.lx, tile.ly, 5));
          if (!kt) {
            missing = true;
            continue;
          }
          const [x, y] = this.at(u, v, tile.h);
          const sp = new Sprite(kt);
          sp.anchor.set(0.5, 0.85);
          const k = Math.min((TW * (kind === 'rock' ? 0.85 : 0.7)) / kt.width, (TH * 2.2) / kt.height);
          sp.scale.set(cellRoll(tile.lx, tile.ly, 6) < 0.5 ? -k : k, k);
          sp.position.set(x, y + 2);
          this.tiles[v * t.w + u].c.addChild(sp);
          if (kind === 'bush') this.life.sway(sp, 0.04);
          continue;
        }
        const tex = this.map.propKind(kind, tile.lx, tile.ly);
        if (!tex) continue;
        const [x, y] = this.at(u, v, tile.h);
        const sp = new Sprite(tex);
        sp.anchor.set(0.5, 0.9);
        sp.scale.set(kind === 'rock' ? 1.15 / PROP_GROW.rock : 0.9 / PROP_GROW.bush);
        sp.position.set(x, y + 2);
        this.tiles[v * t.w + u].c.addChild(sp);
        if (kind === 'bush') this.life.sway(sp, 0.04);
      }
    this.life.setBoard(t, (u, v) => this.at(u, v, this.tileH(u, v)), this.board);
    if (missing) this.key = ''; // (the ground isn't painted yet: try again on the next snapshot)
  }

  /** A kit piece stood on the board (the iso look): its foot at (x, y), `wide` px across, sorted by `z`. */
  private isoPiece(piece: string, x: number, y: number, wide: number, z: number): Sprite | null {
    const tex = this.iso?.texture(piece);
    return tex ? this.picture({ tex, w: tex.width, h: tex.height }, x, y, wide, z) : null;
  }

  /** A wall or fence piece (or half of one) of a run, its foot at the tile's front corner (x, y), the whole piece `wide`
   *  px across (boardDress.ts `runParts`). */
  private runSprite(tex: Texture, part: RunPart, x: number, y: number, wide: number): Sprite {
    const k = wide / Math.max(1, tex.width);
    const sp = new Sprite(part.half ? this.iso!.half(tex, part.half) : tex);
    sp.anchor.set(part.half === 'a' ? 1 : part.half === 'b' ? 0 : 0.5, 1);
    sp.scale.set(part.flip ? -k : k, k);
    sp.position.set(x, y);
    return sp;
  }

  /** A generated board's dressing on a tile (boardDress.ts `generatedDecor`), by the water and the trees beside it. */
  private strewn(t: TacticsView, u: number, v: number): DecorKind | undefined {
    let wet = false;
    let trees = false;
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = u + du >= 0 && v + dv >= 0 && u + du < t.w && v + dv < t.h ? t.tiles[(v + dv) * t.w + u + du] : null;
      if (!n) continue;
      if (n.g === 'water' || n.g === 'shallows') wet = true;
      if (n.tree) trees = true;
    }
    return generatedDecor(t.tiles[v * t.w + u], t.biome, wet, trees, t.season);
  }

  /** The dressing drawn on its tile (false: its picture hasn't loaded yet). Low, and the tall bits kept short, so it
   *  never hides a fighter; a drift is painted (no pack has one). */
  private dress(c: Container, kind: DecorKind, tile: TacTile, u: number, v: number, h: number): boolean {
    const [x, y] = this.at(u, v, h);
    const art = DECOR_ART[kind];
    if (kind === 'drift') {
      // (a heap of snow banked by the wind: a blue shadow on its lee, two or three lumps, the light on their tops)
      const g = new Graphics();
      const w = TW * art.wide * (0.75 + cellRoll(tile.lx, tile.ly, 8) * 0.4);
      const cx = x + (cellRoll(tile.lx, tile.ly, 9) - 0.5) * TW * 0.2;
      const lumps = 2 + Math.floor(cellRoll(tile.lx, tile.ly, 11) * 2);
      g.ellipse(cx + 3, y + 3, w / 2, w / 5).fill({ color: 0x6f8cb0, alpha: 0.45 });
      for (let i = 0; i < lumps; i++) {
        const f = lumps === 1 ? 0 : i / (lumps - 1) - 0.5;
        const r = (w / 2) * (0.55 + cellRoll(tile.lx, tile.ly, 12 + i) * 0.3);
        const lx = cx + f * w * 0.5;
        const ly = y - Math.abs(f) * 2;
        g.ellipse(lx, ly, r, r * 0.42).fill({ color: 0xc6d6ea });
        g.ellipse(lx - r * 0.12, ly - r * 0.1, r * 0.82, r * 0.32).fill({ color: 0xeef3fa });
        g.ellipse(lx - r * 0.3, ly - r * 0.2, r * 0.35, r * 0.12).fill({ color: 0xffffff });
      }
      c.addChild(g);
      return true;
    }
    const n = art.count ?? 1;
    for (let i = 0; i < n; i++) {
      const tex = this.iso!.art(pickOf(art.pieces, tile.lx, tile.ly, 10 + i));
      if (!tex) return false;
      const sp = new Sprite(tex);
      sp.anchor.set(0.5, 0.9);
      // (strewn within the diamond: one near the middle, several spread over it)
      const spread = n > 1 ? 0.55 : 0.18;
      const a = cellRoll(tile.lx, tile.ly, 20 + i) - 0.5;
      const b = cellRoll(tile.lx, tile.ly, 30 + i) - 0.5;
      sp.position.set(x + (a - b) * TW * spread * 0.5, y + (a + b) * TH * spread * 0.5);
      let k = (TW * art.wide * (0.85 + cellRoll(tile.lx, tile.ly, 40 + i) * 0.3)) / tex.width;
      if (DECOR_TALL.has(kind)) k = Math.min(k, (TH * 0.95) / tex.height);
      sp.scale.set(cellRoll(tile.lx, tile.ly, 50 + i) < 0.5 ? -k : k, k);
      c.addChild(sp);
      if (kind === 'reeds' || kind === 'tallgrass') this.life.sway(sp, 0.05);
    }
    return true;
  }

  /** A picture stood on the board: its foot at (x, y), `wide` px across, sorted by `z`. */
  private picture(pic: { tex: Texture; w: number; h: number }, x: number, y: number, wide: number, z: number): Sprite {
    const sp = new Sprite(pic.tex);
    sp.scale.set(wide / Math.max(1, pic.w));
    sp.anchor.set(0.5, 1);
    sp.position.set(x, y);
    sp.zIndex = z;
    this.board.addChild(sp);
    this.pictures.push(sp);
    return sp;
  }

  /** One tile's column: its top, the map's painted ground laid on the diamond, and its two sides down to the foot. */
  private column(tile: TacTile, side: -1 | 1, h: number, underBuilding: boolean): Texture | null {
    const depth = h * HH + FOOT;
    const c = document.createElement('canvas');
    c.width = TW;
    c.height = TH + depth;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    const blockTop = tile.block && tile.block !== 'rock' && !tile.wall && !underBuilding;
    // (a hill's top is cliff all round but its ramp: grey rock under a lip of turf; the ramp is bare earth)
    const sides: [string, string, string] = blockTop && tile.block === 'building' ? ['#b89a6a', '#97784c', '#7a3f2e'] : blockTop ? ['#8a857c', '#6e6a62', '#a39e94'] : tile.hill === 'top' ? ['#8c867a', '#6f6a60', '#7e9a48'] : tile.hill === 'ramp' ? ['#9a7a52', '#7d6040', '#a88a5a'] : (SIDES[tile.g] ?? SIDES.grass!);
    const kitTop = this.iso && !blockTop ? this.iso.top(tile.g, !!tile.road && !tile.art, tile.look) : null;
    if (this.iso && !blockTop && !kitTop) return null; // (the kit's ground hasn't loaded yet: try again on the next snapshot)
    const [l, r, lip] = kitTop ? this.iso!.sidesOf(kitTop.piece, kitTop.im) : sides;
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
    } else if (kitTop) {
      // (the kit's ground tile fitted to the diamond: its picture is the diamond with a slab edge under it)
      g.drawImage(kitTop.im, 0, 0, TW, (kitTop.im.naturalHeight * TW) / kitTop.im.naturalWidth);
      if (kitTop.tint !== 0xffffff) {
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = `#${kitTop.tint.toString(16).padStart(6, '0')}`;
        g.fillRect(0, 0, TW, TH);
        g.globalCompositeOperation = 'source-over';
      }
    } else {
      // (a pond laid on the field borrows the painted ground of a cell of the land's own water)
      const ground = tile.art ? this.map.clearGroundOf(tile.art[0], tile.art[1]) : this.map.clearGroundOf(tile.lx, tile.ly);
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
    // (a hand-made board's look: in the flat view a wash of its colour over the land's ground; a boardwalk's planks)
    const wash = !kitTop && tile.look ? LOOK_WASH[tile.look] : undefined;
    if (wash) {
      g.fillStyle = wash;
      g.fillRect(0, 0, TW, TH);
    }
    if (tile.look === 'plank') {
      g.strokeStyle = 'rgba(60,34,16,0.6)';
      for (let k = -TW; k < TW; k += 7) {
        g.beginPath();
        g.moveTo(k, 0);
        g.lineTo(k + TW, TH);
        g.stroke();
      }
    }
    // (the ramp: a worn way)
    if (tile.hill === 'ramp') {
      g.fillStyle = 'rgba(176,138,84,0.45)';
      g.fillRect(0, 0, TW, TH);
    }
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
      // (the weapon's range, faint, with the foes in it bright)
      if (this.mode === 'attack') for (const [u, v] of o.attack) diamond(u, v, 0xff6040, 0.12, true, 1);
      const skill = this.mode === 'aim' && this.aimSkill ? o.skills.find((s) => s.id === this.aimSkill) : undefined;
      const col = skill ? (skill.aim === 'foe' ? 0xff4030 : skill.aim === 'friend' ? 0x50e070 : 0xffd050) : 0xff4030;
      if (skill) {
        // (where it may be aimed, faint; where it would fall, bright)
        for (const [u, v] of skill.tiles) diamond(u, v, col, 0.13, true, 1);
        const me = unitAt(o.key);
        const at = this.aimAt ?? (skill.tiles.length === 1 ? skill.tiles[0] : null);
        if (me && at) for (const [u, v] of areaTiles(skill.area, [me.u, me.v], at, t.w, t.h)) diamond(u, v, col, 0.42, true, 2);
      }
      const targets = skill ? skill.targets : this.mode === 'attack' || this.mode === 'menu' || this.mode === 'act' ? o.strike : [];
      if (!skill)
        for (const k of targets) {
          const u = unitAt(k);
          if (u) diamond(u.u, u.v, col, this.mode === 'menu' ? 0.14 : 0.4);
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

  /** The board's own clock runs behind the real one while a blow holds the screen (hit-stop) or the final blow slows it:
   *  `lag` is how far behind (ms), eased back in afterwards. Everything on the board is drawn by this clock. */
  private lag = 0;
  private lagAt = 0;
  private clock(now: number): number {
    const dt = this.lagAt ? Math.min(100, Math.max(0, now - this.lagAt)) : 0;
    this.lagAt = now;
    const rate = this.juice.timeRate();
    this.lag = rate >= 1 ? Math.max(0, this.lag - dt * 0.15) : Math.min(LAG_MAX_MS, this.lag + dt * (1 - rate));
    return now - this.lag;
  }

  render(real: number): void {
    const t = this.view;
    if (!t) return;
    const now = this.clock(real);
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
    // (between one unit's action and the next nobody acts: the camera stays where it was rather than heading back to
    // the middle of the board and whipping out again; the middle only before the first turn)
    if (me) [this.cam.fx, this.cam.fy] = this.at(me.u, me.v, this.tileH(me.u, me.v));
    else if (!Number.isFinite(this.cam.fx)) [this.cam.fx, this.cam.fy] = this.at((t.w - 1) / 2, (t.h - 1) / 2, 1);
    const [mx, my] = [this.cam.fx, this.cam.fy];
    const roomW = (w - 16) / k;
    const roomH = (h - top - bottom) / k;
    const axis = (want: number, lo: number, hi: number, room: number) => (hi - lo <= room ? (lo + hi) / 2 : Math.max(lo + room / 2, Math.min(hi - room / 2, want)));
    const fx = axis(mx + this.cam.panX, minX, maxX, roomW);
    const fy = axis(my + this.cam.panY, minY, maxY, roomH);
    // (the pan is let go of as the turn passes, so the next one is seen)
    // (the glide is paced by the clock, not the frame: the same smooth swing to the next unit whether the phone draws
    // 60 frames a second or 20; CAM_GLIDE_MS is the time it takes to close most of the distance)
    const dt = this.cam.set ? Math.min(100, Math.max(0, now - this.cam.t)) : 0;
    this.cam.t = now;
    const slide = 1 - Math.exp(-dt / CAM_GLIDE_MS);
    this.cam.panX *= Math.pow(0.985, dt / 16);
    this.cam.panY *= Math.pow(0.985, dt / 16);
    const ease = this.cam.set ? slide : 1;
    this.cam.x += (fx - this.cam.x) * ease;
    this.cam.y += (fy - this.cam.y) * ease;
    this.cam.k = k;
    this.cam.set = true;
    // (an ultimate shakes the board)
    const ult = t.fx.some((f) => f.ult && f.age < 8);
    for (const f of t.fx)
      if (f.ult && f.age < 4 && !this.ults.has(`${f.name}|${f.from}`)) {
        this.ults.add(`${f.name}|${f.from}`);
        this.juice.jolt(0.8);
        if (f.name) this.juice.callout(f.name.toUpperCase(), 0xffc040);
      }
    // (the juice's shake: heavy blows, kills and ultimates)
    const [sx, sy] = this.juice.shake();
    // (a short zoom on a kill or a crit, leaning in on the blow)
    const z = this.juice.punch;
    const px = w / 2 - this.cam.x * k;
    const py = top + (h - top - bottom) / 2 - this.cam.y * k;
    this.world.scale.set(k * (1 + z));
    this.world.position.set(Math.round(px - k * z * this.juice.focus.x + sx), Math.round(py - k * z * this.juice.focus.y + sy));
    this.people.render(now);
    this.raiders.render(now);
    this.renderFx(t, now);
    this.renderNumbers(t, now);
    this.renderCues(t);
    // (night: a blue dark over the field, the HUD clear of it)
    this.shade.clear();
    if (t.night) this.shade.rect(0, 0, w, h).fill({ color: 0x0a1030, alpha: 0.28 });
    if (ult) this.shade.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: Math.max(0, 0.25 - (t.fx.find((f) => f.ult)?.age ?? 9) * 0.03) });
    this.renderHud(t, now);
    this.juiceUp(t);
    this.juice.top = 48;
    this.juice.render(real, w, h);
    this.drawBars(now);
  }

  /** What the juice hears from the board: kills, banners and the end. */
  private juiceUp(t: TacticsView): void {
    if (t.killed > this.lastKilled) {
      this.juice.killed(t.killed - this.lastKilled);
      // (the first raider felled in the battle, and the last one: the board slows for the final blow)
      if (this.lastKilled === 0 && t.killed === 1 && !this.tookFirst) {
        this.tookFirst = true;
        this.juice.callout(FIRST_BLOOD, 0xff4030);
      }
      if (!t.units.some((u) => u.foe && !u.ally) && !t.waiting && t.phase !== 'done') this.juice.slowmo();
    }
    this.lastKilled = t.killed;
    const b = t.banner;
    const id = b ? `${b.kind}|${b.text}` : '';
    if (b && id !== this.seenBanner) {
      this.seenBanner = id;
      if (b.kind === 'win' || b.kind === 'lose') this.juice.win(b.kind === 'win', `${t.turns} turns · ${t.killed} down${t.lost ? ` · ${t.lost} lost` : ''}`);
      else if (b.kind === 'start') this.juice.showBanner(b.text, 'The battle begins', 0xffe070, 3.2);
      else if (b.kind === 'wave') this.juice.showBanner(b.text, `${t.waiting} more to come`, 0xff9a40);
      else if (b.kind === 'leader') {
        this.juice.showBanner(b.text, 'Their leader is down!', 0xffd040);
        this.juice.callout(ROUTED, 0xff9a40);
      }
      else this.juice.showBanner(b.text, null, 0xff6050);
    }
  }

  /** The unit boxes' health bars: the fill, the ghost of what was just lost draining after it, a flash as it's struck. */
  private drawBars(now: number): void {
    const t = this.view;
    this.barsG.clear();
    if (!t) return;
    const dt = Math.min(0.1, (now - (this.barsAt || now)) / 1000);
    this.barsAt = now;
    for (const box of this.boxes) {
      const u = t.units.find((x) => x.key === box.key);
      if (!u || u.tower) continue;
      const share = Math.max(0, Math.min(1, u.hp / Math.max(1, u.max)));
      let gh = this.ghosts.get(u.key);
      if (!gh) this.ghosts.set(u.key, (gh = { g: share, held: 0, flash: 0, was: share }));
      if (share < gh.was) {
        gh.held = 0;
        gh.flash = 1;
      }
      gh.was = share;
      gh.held += dt;
      gh.g = ghostStep(gh.g, share, gh.held, dt);
      gh.flash = Math.max(0, gh.flash - dt * 4);
      const bw = box.w - 16, x = box.x + 8, y = box.y + 37;
      const col = share > 0.6 ? 0x5ad04a : share > 0.3 ? 0xe0b030 : 0xe04838;
      this.barsG.roundRect(x - 1, y - 1, bw + 2, 10, 3).fill({ color: 0x0c0806 });
      this.barsG.rect(x, y, bw, 8).fill({ color: 0x2a1a14 });
      if (gh.g > share) this.barsG.rect(x + bw * share, y, bw * (gh.g - share), 8).fill({ color: 0xfff0c0 });
      if (share > 0) {
        this.barsG.rect(x, y, bw * share, 8).fill({ color: col });
        this.barsG.rect(x, y, bw * share, 3).fill({ color: 0xffffff, alpha: 0.3 });
        this.barsG.rect(x, y + 6, bw * share, 2).fill({ color: 0x000000, alpha: 0.25 });
      }
      // (low: the bar pulses red)
      if (share > 0 && share <= 0.3) this.barsG.rect(x, y, bw * share, 8).fill({ color: 0xff2010, alpha: 0.3 + 0.3 * Math.sin(now / 120) });
      if (gh.flash > 0) this.barsG.rect(x - 1, y - 1, bw + 2, 10).fill({ color: 0xffffff, alpha: gh.flash * 0.7 });
      // (a caster's mana, a thin blue bar under the health: sim/mana.ts)
      if (u.mp !== null && u.mpMax) {
        this.barsG.rect(x - 1, y + 9, bw + 2, 5).fill({ color: 0x0c0806 });
        this.barsG.rect(x, y + 10, bw, 3).fill({ color: 0x141c3a });
        if (u.mp > 0) this.barsG.rect(x, y + 10, bw * Math.min(1, u.mp / u.mpMax), 3).fill({ color: 0x5a8cff });
      }
    }
  }
  private barsAt = 0;
  /** The town's guilds (the snapshot's), for the badges in the unit boxes. */
  private guilds: Snapshot['guilds'] = [];

  /** Where a shot or a spell leaves from and lands (world px): the shooter's chest, the mark's middle. */
  private shotEnds(f: TacticsView['fx'][number], to: [number, number]): [[number, number], [number, number]] {
    const lift = (u: number, v: number, up: number): [number, number] => {
      const [x, y] = this.at(u, v, this.tileH(u, v));
      return [x, y - up];
    };
    return [lift(f.from[0], f.from[1], f.kind === 'tower' ? 60 : 30), lift(to[0], to[1], 26)];
  }

  /** What flies for a spell or skill: an orb of its element from the caster to its first mark, when it is aimed at the
   *  other side (a mending, a ward or a weapon art's slash goes nowhere); else nothing. */
  private actShot(t: TacticsView, f: TacticsView['fx'][number]): { code: string; to: [number, number] } | null {
    if (f.kind !== 'act' || !f.name || !f.to.length) return null;
    const id = actIdOf(f.name);
    const fx = actSprite(id);
    // (a bow's art flies its arrow; a spell its orb, in the element its effect is drawn in; a blade's art, nothing)
    const arrow = actArrow(id);
    if (!arrow && (!fx.startsWith('px:') || actElement(id) === 'white')) return null;
    const caster = t.units.find((q) => q.u === f.from[0] && q.v === f.from[1]);
    const mark = t.units.find((q) => q.u === f.to[0][0] && q.v === f.to[0][1]);
    if (!caster || !mark || caster.foe === mark.foe || (f.to[0][0] === f.from[0] && f.to[0][1] === f.from[1])) return null;
    return { code: arrow ? 'arrow' : `orb:${actElement(id)}`, to: f.to[0] };
  }

  /** Ticks before a fx lands: the time its shot or spell is in the air (nothing flies for a blow). Its blows' numbers and
   *  its sheets wait this long. */
  private flightOf(t: TacticsView, f: TacticsView['fx'][number]): number {
    if (f.kind === 'shot' || f.kind === 'tower') {
      if (!f.to.length) return 0;
      const [a, b] = this.shotEnds(f, f.to[0]);
      return shotTicks(f.shot, a, b);
    }
    // (an area's tiles fall when its spell's orb arrives)
    const act = f.kind === 'area' ? t.fx.find((x) => x.kind === 'act' && x.age === f.age && x.from[0] === f.from[0] && x.from[1] === f.from[1]) : f;
    const flying = act && this.actShot(t, act);
    if (!act || !flying) return 0;
    const [a, b] = this.shotEnds(act, flying.to);
    return shotTicks(flying.code, a, b);
  }

  /** The look of a shot's landing. */
  private landing(code: string | undefined): SpriteFx {
    const [ammo, el] = (code ?? 'arrow').split(':');
    const px = (id: string): SpriteFx => (pxFrames(`px:${id}`) ? (`px:${id}` as SpriteFx) : 'mg_pop');
    if (ammo === 'orb') return px(`${el ?? 'star'}-burst`);
    if (ammo === 'ball') return px('fire-explosion');
    if (ammo === 'beam') return px(`${el ?? 'lightning'}-hit`);
    if (ammo === 'bullet') return 'mg_sparks';
    // (an arrow, a bolt, a spear, a stone: a small thud where it lands, not a sword's slash)
    return ammo === 'stone' ? px('white-burst') : px('white-hit');
  }

  /** The arrows and spells in flight, the slashes and the spells' sheets where they land. */
  private renderFx(t: TacticsView, now: number): void {
    this.lines.clear();
    this.shots.begin();
    for (const c of this.fxSprites.removeChildren()) c.destroy();
    const since = (now - this.lastUpdate) / TICK;
    const lift = (u: number, v: number, up = 26): [number, number] => {
      const [x, y] = this.at(u, v, this.tileH(u, v));
      return [x, y - up];
    };
    for (const f of t.fx) {
      const age = f.age + since;
      // (the ground a spell or skill fell on lights up and fades, once its spell has come)
      if (f.kind === 'area') {
        const at = age - this.flightOf(t, f);
        if (at < 0 || at > 12) continue;
        const a = 1 - at / 12;
        for (const [u, v] of f.to) {
          const [x, y] = this.at(u, v, this.tileH(u, v));
          const pts = [x, y - TH / 2 + 3, x + TW / 2 - 4, y, x, y + TH / 2 - 3, x - TW / 2 + 4, y];
          this.lines.poly(pts).fill({ color: f.foe ? 0xff6a30 : 0x60f090, alpha: 0.28 * a }).stroke({ color: f.foe ? 0xffc080 : 0xb0ffc0, width: 2, alpha: 0.8 * a });
        }
        continue;
      }
      // (a shot: the arrow, bolt, bullet or orb flies from the shooter to the mark and lands there)
      if (f.kind === 'shot' || f.kind === 'tower') {
        for (const [u, v] of f.to) {
          const [from, to] = this.shotEnds(f, [u, v]);
          const dur = shotTicks(f.shot, from, to);
          const landed = this.shots.put(f.shot, from, to, age, dur);
          if (landed && age < dur + 6) this.sheet(this.landing(f.shot), to[0], to[1] + 6, age - dur, 0.55);
        }
        continue;
      }
      const flying = this.actShot(t, f);
      const delay = flying ? this.flightOf(t, f) : 0;
      if (flying) {
        const [from, to] = this.shotEnds(f, flying.to);
        this.shots.put(flying.code, from, to, age, delay, 1.2);
      }
      // (a blow by the arms it was struck with: a blade's slash, a club's thud, claws; a stun's stars, a chest's glitter)
      const look: SpriteFx | null = f.kind === 'blow' ? (MELEE_FX[f.melee ?? 'blade'] as SpriteFx) : f.kind === 'act' && f.name ? actSprite(actIdOf(f.name)) : f.kind === 'tend' ? 'heal' : f.kind === 'chest' ? 'px:gold-sparkle' : f.kind === 'lost' ? 'holy' : f.kind === 'trap' ? 'mg_spikes' : f.kind === 'stun' ? 'px:white-star' : null;
      if (!look) continue;
      const at = f.to.length ? f.to : [f.from];
      at.forEach(([u, v], i) => {
        const [x, y] = lift(u, v, 20);
        this.sheet(look, x, y, age - delay - i * 0.8, f.kind === 'blow' ? 0.85 : f.ult ? 1.5 : 1.1, f.ult ? ULT_MOST : FX_MOST);
      });
      // (a spell or skill: a ring of light under its caster as it goes off)
      if (f.kind === 'act' && age < 8) {
        const [x, y] = this.at(f.from[0], f.from[1], this.tileH(f.from[0], f.from[1]));
        this.lines.ellipse(x, y, 26, 13).stroke({ color: f.ult ? 0xffc040 : 0x9ad0ff, width: 2, alpha: 1 - age / 8 });
      }
    }
    this.shots.end();
  }

  /** One frame of an effect sheet at an age in ticks: each shape at its own size (an impact small, an area wide), never
   *  wider than `most` world px, and the solid ones a little see-through so the unit under them still shows. */
  private sheet(look: SpriteFx, x: number, y: number, age: number, scale: number, most = FX_MOST): void {
    const sh = sheetOf(look);
    if (!sh || age < 0) return;
    const frame = sh.frame((age / 10) * sh.fps);
    if (!frame) return;
    const s = new Sprite(frame);
    s.anchor.set(0.5);
    const fam = familyOf(look);
    // (an icon strip, a stun's stars: small, over the head, not the size of a spell)
    const k = Math.min(scale * (fam ? (FAMILY_SCALE[fam] ?? ICON_SCALE) : 1), most / (sh.size * (sh.scale ?? 1)));
    const size = sh.size * (sh.scale ?? 1) * k;
    s.width = s.height = size;
    s.position.set(x, y - size / 2 + sh.foot * (sh.scale ?? 1) * k);
    if (fam && SOLID.has(fam)) s.alpha = 0.8;
    if (sh.glow) s.blendMode = 'add';
    this.fxSprites.addChild(s);
  }

  /** The blows' numbers, rising and fading. */
  private renderNumbers(t: TacticsView, now: number): void {
    const seen = new Set<string>();
    for (const x of t.hits) {
      const id = `${x.u},${x.v},${x.text},${Math.round((this.lastUpdate - x.age * TICK) / 400)}`;
      seen.add(id);
      if (this.hits.has(id)) continue;
      // (a blow's number waits for its shot or spell to land)
      const wait = t.fx.reduce((m, f) => (f.age === x.age && f.to.some(([fu, fv]) => fu === x.u && fv === x.v) ? Math.max(m, this.flightOf(t, f)) : m), 0);
      if (x.age < wait) continue;
      this.hits.set(id, { born: now - x.age * TICK });
      if (x.age > 8 + wait) continue; // (from before the board was seen)
      // (the juice: an impact, a big popping number, the shake, the combo: battle/juice.ts)
      const [hx, hy] = this.at(x.u, x.v, this.tileH(x.u, x.v));
      const u = t.units.find((q) => q.u === x.u && q.v === x.v);
      const n = parseInt(x.text, 10);
      this.juice.hit(hx, hy - 20, { label: x.text, share: u && n > 0 ? n / Math.max(1, u.max) : 0.1, onFoe: x.foe, heal: x.heal, why: x.why });
    }
    for (const id of [...this.hits.keys()]) if (!seen.has(id)) this.hits.delete(id);
  }

  /** A status just come on a unit (Stunned, Haste, Poisoned): its small icon and word over them, once. */
  private renderCues(t: TacticsView): void {
    const live = new Set<string>();
    for (const u of t.units) {
      live.add(u.key);
      const was = this.seenSt.get(u.key);
      const now = new Set(u.st);
      this.seenSt.set(u.key, now);
      // (the first sight of a unit shows nothing: it came on before the board was seen)
      if (!was) continue;
      const [x, y] = this.at(u.u, u.v, this.tileH(u.u, u.v));
      for (const st of now) if (!was.has(st) && STATUS_CUE[st as Status]) this.juice.cue(x, y - 20, STATUS_CUE[st as Status]);
    }
    for (const k of [...this.seenSt.keys()]) if (!live.has(k)) this.seenSt.delete(k);
  }

  /* ------------------------------------------------------------ the HUD */

  private renderHud(t: TacticsView, now: number): void {
    // (redrawn when what it shows changes, and while the banners fade)
    const key = `${this.w}x${this.h}|${t.turns}|${t.act?.key}|${t.act?.stage}|${this.mode}|${this.aimSkill}|${this.aimAt}|${this.selected}|${this.skillPage}|${t.orders?.left}|${t.orders?.moved}|${t.orders?.acted}|${t.auto}|${t.banner?.age}|${t.fx.map((f) => f.age).join(',')}|${t.units.map((u) => `${u.hp}:${u.mp ?? ''}`).join(',')}|${t.speed}`;
    if (key === this.hudKey) return;
    this.hudKey = key;
    for (const c of this.hud.removeChildren()) c.destroy({ children: true });
    this.boxes = [];
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
      // (the menus' frame set where it's tinted: ui/pixiFrame.ts)
      const box = uiPlate('btn-on', bw, 28, act.ult ? 0xffc080 : 0xffffff) ?? new Graphics().roundRect(0, 0, bw, 28, 6).fill({ color: act.ult ? 0x5a2008 : 0x1a2a5a, alpha: 0.92 }).stroke({ color: act.ult ? 0xffb040 : 0x9ab8f0, width: 2 });
      box.position.set((w - bw) / 2, up ? 96 : 48);
      label.position.set((w - bw) / 2 + 14, (up ? 96 : 48) + 5);
      this.hud.addChild(box, label);
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
      else this.unitBox(other, 8, boxY - boxHeight(other) - 6, boxW);
    }
    // the player's orders, along the bottom
    if (t.orders) this.ordersBar(t, h - 50);
    // the corner buttons: the town plays itself, and the battle's speed
    if (over) return;
    const auto = this.button(t.auto ? 'Auto ▶' : 'Auto ❚❚', w - 74, h - (t.orders ? 140 : 84) - 32, 66, 26, () => this.command({ type: 'tactics', order: { op: 'auto', on: !t.auto } }), t.auto);
    void auto;
    const speed = t.speed;
    this.button(`${speed}×`, w - 112, h - (t.orders ? 140 : 84) - 32, 34, 26, () => this.command({ type: 'battleSpeed', speed: (speed % 3) + 1 }));
    this.button('Skip ⏭', w - 182, h - (t.orders ? 140 : 84) - 32, 64, 26, () => this.command({ type: 'raidSkip' }));
    void now;
  }

  private unitBox(u: TacUnitView, x: number, y: number, w: number): void {
    const col = u.foe ? 0x5a1a14 : u.tower ? 0x3a3a3a : 0x14284a;
    const tall = boxHeight(u) - 72; // (a caster's mana bar takes a row of its own under the health: drawBars)
    // (the menus' frame set where it's tinted, a foe's reddened, a tower's greyed: ui/pixiFrame.ts)
    const g = uiPlate(u.tower ? 'btn-off' : 'btn', w, 72 + tall, u.foe ? 0xff9080 : 0xffffff) ?? new Graphics().roundRect(0, 0, w, 72 + tall, 6).fill({ color: col, alpha: 0.92 }).stroke({ color: u.foe ? 0xe07060 : 0x8ab4f0, width: 2 });
    g.position.set(x, y);
    this.hud.addChild(g);
    const name = new Text({ text: `${u.leader ? '★ ' : ''}${u.name}`, style: style(13, 0xffffff, true, 3) });
    name.position.set(x + 8, y + 5);
    const sub = new Text({ text: u.tower ? 'Tower' : `${u.title}${u.level ? ` · Lv ${u.level}` : ''}`, style: { fontFamily: FONT, fontSize: 10, fill: 0xd8d0c0 } });
    sub.position.set(x + 8, y + 22);
    this.hud.addChild(name, sub);
    // (a guild's badge in the box's corner, for a townsperson in one)
    if (u.key.startsWith('p')) {
      const gs = guildsOf({ guilds: this.guilds }, u.ref);
      if (gs.length) {
        const badge = new Sprite(badgeTexture(gs[0].role));
        badge.scale.set(16 / badge.texture.width);
        badge.position.set(x + w - 22, y + 4);
        this.hud.addChild(badge);
      }
    }
    if (!u.tower) {
      // (its health bar is drawn each frame, with its ghost: drawBars)
      this.boxes.push({ key: u.key, x, y, w });
      const hp = new Text({ text: u.count !== null ? `DOWN · ${u.count} turn${u.count === 1 ? '' : 's'} left` : `HP ${u.hp}/${u.max}${u.mp !== null ? ` · MP ${u.mp}/${u.mpMax}` : ''}`, style: { fontFamily: FONT, fontSize: 10, fill: u.count !== null ? 0xff8070 : 0xffffff } });
      hp.position.set(x + 8, y + 48 + tall);
      const mv = new Text({ text: `Mv ${u.move} Jp ${u.jump} Rg ${u.reach}${u.st.length ? ` · ${u.st.slice(0, 2).join(', ')}` : ''}`, style: { fontFamily: FONT, fontSize: 10, fill: 0xc8c0e0 } });
      mv.position.set(x + 8, y + 59 + tall);
      this.hud.addChild(hp, mv);
    }
  }

  private button(label: string, x: number, y: number, w: number, h: number, fn: () => void, on = false, enabled = true): Container {
    // (the menus' buttons where they're tinted: ui/pixiFrame.ts)
    const g = uiPlate(!enabled ? 'btn-off' : on ? 'btn-on' : 'btn', w, h) ?? new Graphics().roundRect(0, 0, w, h, 6).fill({ color: !enabled ? 0x2a2a2a : on ? 0x2a5a2a : 0x2a2440, alpha: 0.95 }).stroke({ color: enabled ? 0xd8c890 : 0x666666, width: 2 });
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
      const skills = o.skills.filter((s) => s.area.shape === 'self' || s.targets.length);
      const page = skills.slice(this.skillPage * per, this.skillPage * per + per);
      for (const s of page)
        items.push({
          label: `${s.name}${s.cost ? ` ${s.cost}${s.pool === 'mp' ? 'MP' : s.pool === 'sp' ? 'SP' : ''}` : ''}`,
          on: this.aimSkill === s.id,
          enabled: s.ready,
          fn: () => {
            // (every skill shows where it would fall first; one that falls only round its user is aimed already)
            this.mode = 'aim';
            this.aimSkill = s.id;
            this.aimAt = s.tiles.length === 1 ? s.tiles[0] : null;
          },
        });
      if (skills.length > per) items.push({ label: '›', fn: () => (this.skillPage = (this.skillPage + 1) % Math.ceil(skills.length / per)) });
      items.push({ label: 'Back', fn: () => ((this.mode = 'menu'), (this.aimSkill = null), (this.aimAt = null)) });
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
    const aimed = this.mode === 'aim' ? o.skills.find((s) => s.id === this.aimSkill) : undefined;
    const hint =
      this.mode === 'move'
        ? 'Tap a blue tile to move'
        : this.mode === 'attack'
          ? 'Tap a red target'
          : aimed
            ? `${aimed.name}: ${aimed.label} · ${this.aimAt ? 'tap again to use it' : 'tap where it should fall'}`
            : `${o.left}s, then the town acts`;
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
      // (aiming: the first tap shows where it would fall, a second on the same tile uses it)
      const skill = this.mode === 'aim' && this.aimSkill ? o.skills.find((s) => s.id === this.aimSkill) : undefined;
      const spot = target ? ([target.u, target.v] as [number, number]) : tile;
      if (skill && spot && skill.tiles.some(([u, v]) => u === spot[0] && v === spot[1])) {
        if (this.aimAt && this.aimAt[0] === spot[0] && this.aimAt[1] === spot[1]) {
          this.command({ type: 'tactics', order: { op: 'skill', skill: skill.id, at: spot } });
          this.mode = 'menu';
          this.aimSkill = null;
          this.aimAt = null;
        } else this.aimAt = spot;
        this.hudKey = '';
        this.drawMarks(t);
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
