// Builds the three scrolling layers of the town and maps the camera onto them.
//   back  : farms, fields, hills; 60% scale, parallax (static for now)
//   mid   : main buildings, wild terrain at the edges (rebuilt per tile as land is cleared)
//   fore  : the walkway where townsfolk move (dirt path on cleared land, rough trail elsewhere)

import { Container, Graphics, Sprite } from 'pixi.js';
import { BACK_GROUND_Y, BACK_PAD_TILES, BACK_SCALE, FORE_TOP_Y, MID_GROUND_Y, STRIP_HEIGHT, TILE, WORLD_WIDTH } from '../../shared/constants';
import { Rng } from '../../shared/rng';
import type { BuildLayer } from '../../shared/data/buildings';
import { backNow } from '../../shared/sim/buildings';
import type { Building, TileState } from '../../shared/sim/state';
import type { BackTerrain, MidTerrain, World } from '../../shared/world';
import { drawFarWall } from '../art/farWall';
import { applySeasonPalette, PAL } from '../art/palette';
import { haze, hexToNum, noTone, type PixelArt, type Tone } from '../art/pixelArt';
import { makeSpriteSet, markerFlag, type SpriteSet } from '../art/sprites';
import { foreTileArt, hash, MID_ART_BASE, midTileArt, shade } from '../art/terrain';
import { BuildingsView } from './buildingsView';
import { HerdsView } from './herdsView';
import { Layer } from './layer';

const MID_BAND_TOP = -8; // mid ground strip, local y
const FORE_DEPTH = STRIP_HEIGHT - FORE_TOP_Y;
const BACK_BAND_DEPTH = Math.ceil((FORE_TOP_Y - BACK_GROUND_Y) / BACK_SCALE) + 4;
/** Colour the whole town is multiplied by at full night. */
const NIGHT_TINT = 0x4a5688;
/** y (fore-local) where people's feet touch the walkway. */
export const WALK_Y = 20;

/** Multiply colour for a daylight level: white by day, moonlit blue at night. */
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

export class TownView {
  readonly root = new Container();
  /** People are drawn here: on the walkway, in front of the foreground scenery. */
  readonly people = new Container();
  private readonly back: Layer;
  private readonly mid: Layer;
  private readonly fore: Layer;
  private near: SpriteSet;
  private readonly markers = new Container();
  private readonly highlight = new Graphics();
  private readonly flag: PixelArt;
  private readonly buildings: BuildingsView;
  private terrain: MidTerrain[];
  private backX = 0;
  private camX = 0;
  private daylight = 1;

  constructor(
    private readonly world: World,
    tiles: TileState[],
    buildings: Building[],
  ) {
    this.near = makeSpriteSet(world.seedHash ^ 0x51, noTone);
    const far = makeSpriteSet(world.seedHash ^ 0x52, haze(0.32));
    this.flag = markerFlag(noTone);
    this.terrain = tiles.map((t) => t.terrain);

    this.back = new Layer(-BACK_PAD_TILES * TILE, (world.tiles + BACK_PAD_TILES * 2) * TILE, 0);
    this.mid = new Layer(0, WORLD_WIDTH, MID_BAND_TOP);
    this.fore = new Layer(0, WORLD_WIDTH, 0);
    this.back.root.scale.set(BACK_SCALE);
    this.back.root.y = BACK_GROUND_Y;
    this.mid.root.y = MID_GROUND_Y;
    this.fore.root.y = FORE_TOP_Y;
    this.mid.root.addChild(this.highlight, this.markers);
    this.fore.root.addChild(this.people);
    this.root.addChild(this.back.root, this.mid.root, this.fore.root);

    this.far = far;
    this.buildBack();
    for (let i = 0; i < world.tiles; i++) {
      this.buildMidTile(i);
      this.buildForeTile(i);
    }
    this.buildings = new BuildingsView({ back: this.back, mid: this.mid, fore: this.fore }, world.seedHash);
    this.syncBuildings(buildings);
    // (the animals in the pens walk about above the background's buildings)
    this.back.root.addChild(this.herds.root);
    this.herds.update(buildings);
    for (const l of [this.back, this.mid, this.fore]) l.sortObjects();
    this.setMarkers(tiles);
  }

  /** The animals in the pens. */
  readonly herds = new HerdsView();
  /** The midground terrain in the shape backNow() reads. */
  private get terrainRows(): { terrain: MidTerrain }[] {
    if (this.rowsFor !== this.terrain) {
      this.rowsFor = this.terrain;
      this.rows = this.terrain.map((terrain) => ({ terrain }));
    }
    return this.rows;
  }
  private rowsFor: MidTerrain[] | null = null;
  private rows: { terrain: MidTerrain }[] = [];
  private far: SpriteSet;

  /** The background as it is now: its wild land cleared where the land in front of it has been. */
  private backAt(i: number): BackTerrain | 'cleared' {
    const t = i - BACK_PAD_TILES;
    return t >= 0 && t < this.terrain.length ? backNow(this.world.back, this.terrainRows, t) : this.world.back[i];
  }

  /* ------------------------------------------------------------ the town's far wall */

  private wallKey = '';

  /** A town walled at both ends gets a wall round it, far off behind the fields (behind all the background). */
  syncEnclosure(e: { lo: number; hi: number; wall: string } | null): void {
    const key = e ? `${e.lo}|${e.hi}|${e.wall}` : '';
    if (key === this.wallKey) return;
    this.wallKey = key;
    this.back.removeGroup('wall');
    if (e) {
      this.back.group('wall');
      drawFarWall(this.back, e.lo * TILE, e.hi * TILE, e.wall, haze(0.4), this.world.seedHash);
    }
    this.back.rebuildSkyline();
  }

  /* ------------------------------------------------------------ buildings */

  /** A castle town's keep (drawn round its rooms). */
  syncCastle(castle: { lo: number; hi: number; floors: number } | null): void {
    if (!this.buildings.syncCastle(castle)) return;
    this.mid.rebuildSkyline();
  }

  syncBuildings(buildings: Building[]): void {
    for (const layer of this.buildings.sync(buildings)) {
      const l = { back: this.back, mid: this.mid, fore: this.fore }[layer];
      l.rebuildSkyline();
      l.sortObjects();
    }
  }

  /** Local layer coordinates to screen. */
  private layerToScreen(layer: BuildLayer, x: number, y: number): { x: number; y: number } {
    if (layer === 'back') return { x: this.backX + x * BACK_SCALE, y: this.root.y + BACK_GROUND_Y + y * BACK_SCALE };
    return { x: x - this.camX, y: this.root.y + (layer === 'mid' ? MID_GROUND_Y : FORE_TOP_Y) + y };
  }

  /** Screen rect of a drawn building. */
  buildingScreenRect(id: number): { x: number; y: number; w: number; h: number } | null {
    const r = this.buildings.rects().find(([bid]) => bid === id)?.[1];
    if (!r) return null;
    const k = r.layer === 'back' ? BACK_SCALE : 1;
    const p = this.layerToScreen(r.layer, r.x, r.y);
    return { x: p.x, y: p.y, w: r.w * k, h: r.h * k };
  }

  /** The building under a screen point (foreground first), if any. */
  buildingAt(screenX: number, screenY: number): number | null {
    const order: BuildLayer[] = ['fore', 'mid', 'back'];
    const rects = this.buildings.rects();
    for (const layer of order) {
      for (const [id, r] of rects) {
        if (r.layer !== layer) continue;
        const s = this.buildingScreenRect(id)!;
        if (screenX >= s.x && screenX < s.x + s.w && screenY >= s.y && screenY < s.y + s.h) return id;
      }
    }
    return null;
  }

  /** Left tile for placing a building of `width` centred under screen x, on a layer's grid. */
  placementTile(layer: BuildLayer, screenX: number, width: number): number {
    const worldX = layer === 'back' ? (screenX - this.backX) / BACK_SCALE : screenX + this.camX;
    return Math.floor(worldX / TILE) - Math.floor((width - 1) / 2);
  }

  showGhost(defId: string, layer: BuildLayer, tile: number, width: number, valid: boolean): void {
    this.buildings.showGhost(defId, layer, tile, width, valid);
  }

  hideGhost(): void {
    this.buildings.hideGhost();
  }

  /** World-pixel x of the camp centre, for the initial camera. */
  get campX(): number {
    return (this.world.camp + 0.5) * TILE;
  }

  /**
   * Position the layers for a camera whose left edge is at world x `camX`.
   * The town is laid out for a STRIP_HEIGHT-tall strip and anchored to the bottom of the screen.
   */
  setCamera(camX: number, screenW: number, screenH: number): void {
    this.root.y = Math.round(screenH - STRIP_HEIGHT);
    this.camX = Math.round(camX);
    this.mid.root.x = this.fore.root.x = -this.camX;
    // Parallax is anchored at the screen centre: the background column behind the centre of the screen
    // is the same tile column as the town at the centre.
    const centre = this.camX + screenW / 2;
    this.backX = Math.round(screenW / 2 - centre * BACK_SCALE);
    this.back.root.x = this.backX;

    this.mid.cull(this.camX, this.camX + screenW);
    this.fore.cull(this.camX, this.camX + screenW);
    this.back.cull(-this.backX / BACK_SCALE, (screenW - this.backX) / BACK_SCALE);
  }

  /** Redraw the land's scenery for a new season (its colours come from the palette: see applySeasonPalette).
   *  The shapes are drawn from the same seeds, so the land looks the same, only the colours turn. */
  /** The origin's building style: a tint (or none), redrawn at the next sync. */
  setBuildingStyle(tint: [string, number] | null, style = 'town'): void {
    this.buildings.setStyle(tint, style);
  }

  setSeason(biome: string, season: string): void {
    if (season === this.season) return;
    this.season = season;
    applySeasonPalette(biome, season);
    this.near = makeSpriteSet(this.world.seedHash ^ 0x51, noTone);
    this.far = makeSpriteSet(this.world.seedHash ^ 0x52, haze(0.32));
    this.clearBack();
    this.buildBack();
    const wall = this.wallKey;
    this.wallKey = '';
    if (wall) {
      const [lo, hi, id] = wall.split('|');
      this.syncEnclosure({ lo: +lo, hi: +hi, wall: id });
    }
    for (let i = 0; i < this.world.tiles; i++) {
      this.mid.removeGroup(i);
      this.buildMidTile(i);
      this.fore.removeGroup(i);
      this.buildForeTile(i);
    }
    for (const l of [this.back, this.mid, this.fore]) {
      l.rebuildSkyline();
      l.sortObjects();
    }
  }
  /** (The palette the scenery was drawn in: main.ts applies the starting season before the town is built.) */
  season: string | null = null;

  /** Light the town for the time of day: 1 = full daylight, 0 = moonlit night. In a Deep Freeze everything
   *  takes an icy blue cast. */
  setDaylight(daylight: number, frost = false): void {
    const d = Math.max(0, Math.min(1, daylight));
    if (d === this.daylight && frost === this.frost) return;
    this.daylight = d;
    this.frost = frost;
    const t = daylightTint(d);
    this.root.tint = frost ? multiplyTint(t, FROST_TINT) : t;
  }
  private frost = false;

  /** Screen y of the topmost opaque pixel at screen x (Infinity if nothing is drawn there). */
  skylineAt(screenX: number): number {
    const fore = FORE_TOP_Y + this.fore.skyline.at(screenX + this.camX);
    const mid = MID_GROUND_Y + this.mid.skyline.at(screenX + this.camX);
    const back = BACK_GROUND_Y + BACK_SCALE * this.back.skyline.at((screenX - this.backX) / BACK_SCALE);
    return this.root.y + Math.min(fore, mid, back);
  }

  /** Like skylineAt, but only the midground and foreground (what a click can act on). */
  nearSkylineAt(screenX: number): number {
    const fore = FORE_TOP_Y + this.fore.skyline.at(screenX + this.camX);
    const mid = MID_GROUND_Y + this.mid.skyline.at(screenX + this.camX);
    return this.root.y + Math.min(fore, mid);
  }

  /** Midground tile column under screen x (null outside the world). */
  tileAt(screenX: number): number | null {
    const t = Math.floor((screenX + this.camX) / TILE);
    return t >= 0 && t < this.world.tiles ? t : null;
  }

  /** Screen x of a world x (for placing tooltips). */
  toScreenX(worldX: number): number {
    return worldX - this.camX;
  }

  /** Screen point to foreground-layer local coordinates (where people live). */
  toForeLocal(screenX: number, screenY: number): { x: number; y: number } {
    return { x: screenX + this.camX, y: screenY - this.root.y - FORE_TOP_Y };
  }

  /** Screen y of the fore-layer walkway line plus an offset in fore-local px. */
  foreScreenY(localY: number): number {
    return this.root.y + FORE_TOP_Y + localY;
  }

  /* ------------------------------------------------------------ tile updates */

  /** Rebuild tiles whose terrain changed, and redraw gathering markers. */
  updateTiles(tiles: TileState[]): void {
    const changed: number[] = [];
    tiles.forEach((t, i) => {
      if (t.terrain !== this.terrain[i]) changed.push(i);
    });
    if (changed.length) {
      const rebuildMid = new Set<number>();
      for (const i of changed) {
        rebuildMid.add(i);
        // Neighbouring hill tiles belong to a mound whose shape depended on this tile.
        for (let j = i - 1; j >= 0 && (this.terrain[j] === 'hill' || tiles[j].terrain === 'hill'); j--) rebuildMid.add(j);
        for (let j = i + 1; j < tiles.length && (this.terrain[j] === 'hill' || tiles[j].terrain === 'hill'); j++) rebuildMid.add(j);
      }
      this.terrain = tiles.map((t) => t.terrain);
      for (const i of rebuildMid) {
        this.mid.removeGroup(i);
        this.buildMidTile(i);
      }
      // (a walkway tile's edges depend on its neighbours: the road meets the grass)
      const rebuildFore = new Set(changed.flatMap((i) => [i - 1, i, i + 1]).filter((i) => i >= 0 && i < tiles.length));
      for (const i of rebuildFore) {
        this.fore.removeGroup(i);
        this.buildForeTile(i);
      }
      // the background behind cleared land is cleared too
      let hills = false;
      for (const i of changed) {
        const b = i + BACK_PAD_TILES;
        if (this.world.back[b] === 'meadow' || this.world.back[b] === 'fertile' || this.world.back[b] === 'river') continue;
        this.back.removeGroup(`b${b}`);
        this.buildBackColumn(b);
        hills ||= this.world.back[b] === 'hills';
      }
      if (hills) {
        this.back.removeGroup('bhills');
        this.buildBackHills();
      }
      for (const l of [this.back, this.mid, this.fore]) {
        l.rebuildSkyline();
        l.sortObjects();
      }
    }
    this.setMarkers(tiles);
  }

  private setMarkers(tiles: TileState[]): void {
    this.markers.removeChildren().forEach((c) => c.destroy());
    tiles.forEach((t, i) => {
      if (!t.designated) return;
      const x = i * TILE;
      // a yellow line along the tile's ground and a flag stuck in front of it
      this.markers.addChild(new Graphics().rect(x + 1, MID_BAND_TOP, TILE - 2, 2).fill({ color: 0xffd84a, alpha: 0.9 }));
      const flag = this.markers.addChild(new Sprite(this.flag.texture));
      flag.position.set(x + TILE / 2 - 3, 2 - this.flag.height);
    });
  }

  /** Highlight the tile under the mouse (null clears it). */
  setHighlight(tile: number | null): void {
    this.highlight.clear();
    if (tile === null) return;
    const x = tile * TILE;
    const top = Math.min(this.mid.skyline.minOver(x, TILE), MID_BAND_TOP - 12);
    this.highlight.rect(x, top - 2, TILE, -top + 4).fill({ color: 0xffffff, alpha: 0.12 });
    this.highlight.rect(x, top - 2, TILE, 1).fill({ color: 0xffffff, alpha: 0.5 });
  }

  /** Screen y of the top of a tile's art (for tooltips). */
  tileTopScreenY(tile: number): number {
    return this.root.y + MID_GROUND_Y + Math.min(this.mid.skyline.minOver(tile * TILE, TILE), MID_BAND_TOP);
  }

  /* ------------------------------------------------------------ background */

  /** Tear down the whole background (for a new season's colours). */
  private clearBack(): void {
    this.back.removeGroup('static');
    this.back.removeGroup('ridge');
    this.back.removeGroup('bhills');
    for (let i = 0; i < this.world.back.length; i++) this.back.removeGroup(`b${i}`);
  }

  private buildBack(): void {
    this.buildRidge();
    this.buildBackHills();
    for (let i = 0; i < this.world.back.length; i++) this.buildBackColumn(i);
  }

  /** The far distance: a range of blue mountains (snow on their peaks), and nearer, a wooded ridge. The skyline
   *  never drops flat. */
  private buildRidge(): void {
    const L = this.back.group('ridge');
    const w = this.world;
    const rng = new Rng(w.seedHash ^ 0x77);
    const [a, b, c, d] = [rng.range(0, 10), rng.range(0, 10), rng.range(0, 10), rng.range(0, 10)];
    const mount = haze(0.7);
    const wood = haze(0.55);
    const col = (tone: Tone, cl: string) => hexToNum(tone(cl));
    const snowLine = 58;
    for (let x = L.x0; x < L.x0 + L.width; x += 2) {
      // the mountains: sharp peaks from two sine waves folded
      const m = Math.round(44 + 22 * Math.abs(Math.sin(x / 190 + c)) + 14 * Math.abs(Math.sin(x / 71 + d)) - 10 * Math.sin(x / 400 + a));
      const g = L.gfx(x, 'far');
      g.rect(x, -m, 2, m).fill(col(mount, PAL.rockDark));
      // the lit side of each peak (the slope rising to the right is in the sun)
      const rising = Math.sin(x / 71 + d) * Math.cos(x / 71 + d) > 0;
      if (rising) g.rect(x, -m, 1, Math.min(m, 30)).fill(col(mount, PAL.rock));
      if (m > snowLine) g.rect(x, -m, 2, Math.min(m - snowLine + 2, 6)).fill(col(mount, '#f0f4f8'));
      // texture: rock strata slanting down the slopes, crags in shadow, flecks of light and of snow in the gullies
      for (let y = -m + 3 + (x % 4 ? 2 : 0); y < -2; y += 4) {
        const n = hash(w.seedHash, x, y);
        const strata = (((y + Math.round(x * 0.45)) % 11) + 11) % 11 === 0;
        if (strata || n < 0.22) g.rect(x, y, 2, 1).fill(col(mount, strata ? PAL.rockDark : '#3e4450'));
        else if (n > 0.86) g.rect(x + (n > 0.93 ? 1 : 0), y, 1, 1).fill(col(mount, rising ? PAL.rockLight : PAL.rock));
        else if (m > snowLine - 8 && y < -m + 14 && n > 0.7) g.rect(x, y, 1, 1).fill(col(mount, '#dfe6ee'));
      }
      L.markSpan(x, 2, -m);
      // the wooded ridge in front of them
      const h = Math.round(22 + 12 * Math.sin(x / 260 + a) + 8 * Math.sin(x / 97 + b));
      g.rect(x, -h, 2, h).fill(col(wood, PAL.grassDark));
      g.rect(x, -h, 2, 1).fill(col(wood, PAL.grass));
      // texture: the canopy mottled light and dark, a darker understory toward the foot
      for (let y = -h + 2 + (x % 4 ? 1 : 0); y < -1; y += 3) {
        const n = hash(w.seedHash, x, y + 500);
        if (n < 0.25) g.rect(x, y, 2, 1).fill(col(wood, PAL.pineDark));
        else if (n > 0.8 && y < -h + 8) g.rect(x + (n > 0.9 ? 1 : 0), y, 1, 1).fill(col(wood, PAL.grassLight));
      }
      // little conifers along its crest
      if (hash(w.seedHash, x, 3) < 0.28) {
        const th = 3 + Math.floor(hash(w.seedHash, x, 4) * 5);
        for (let k = 0; k < th; k++) g.rect(x - Math.floor((th - k) / 3), -h - th + k, 1 + 2 * Math.floor((th - k) / 3) || 1, 1).fill(col(wood, PAL.pineDark));
        L.markSpan(x, 1, -h - th);
      }
      L.markSpan(x, 2, -h);
    }
  }

  /** The background hills, over their runs of hill columns (a cleared column is flattened: fields go there). */
  private buildBackHills(): void {
    const L = this.back.group('bhills');
    const s = this.far;
    const tone = haze(0.32);
    const col = (c: string) => hexToNum(tone(c));
    const kinds = this.world.back.map((_, i) => this.backAt(i));
    for (const run of runs(kinds)) {
      if (run.kind !== 'hills') continue;
      const x0 = (run.start - BACK_PAD_TILES) * TILE;
      const width = run.length * TILE;
      const rng = Rng.from(this.world.seedHash, 0xb1, run.start);
      const peak = Math.min(95, 38 + run.length * 6) * rng.range(0.8, 1);
      for (let x = 0; x < width; x += 2) {
        const t = (x + 1) / width;
        const h = Math.round(peak * Math.sin(Math.PI * t) ** 0.7 + 4 * Math.sin(x / 11));
        if (h <= 0) continue;
        const g = L.gfx(x0 + x, 'hills');
        const X = x0 + x;
        // the sunny side and the shaded side, a lit crest, and bands of darker grass down the slope
        g.rect(X, -h, 2, h).fill(col(t < 0.5 ? PAL.grassLight : PAL.grass));
        g.rect(X, -h, 2, 2).fill(col(PAL.grassTip));
        for (let y = -h + 6; y < 0; y += 7 + Math.floor(hash(run.start, x, y) * 5)) if (hash(X, y, 5) < 0.6) g.rect(X, y, 2, 1).fill(col(t < 0.5 ? PAL.grass : PAL.grassDark));
        if (t > 0.5) g.rect(X, -h + 2, 2, Math.min(h - 2, 4)).fill(col(PAL.grass));
        // texture: tufts of grass catching the light, and shadows in the turf
        for (let y = -h + 4 + (x % 4 ? 2 : 0); y < -1; y += 4) {
          const n = hash(X, y, run.start + 7);
          if (n < 0.2) g.rect(X, y, 2, 1).fill(col(t < 0.5 ? PAL.grass : PAL.grassDark));
          else if (n > 0.84) g.rect(X + (n > 0.92 ? 1 : 0), y - 1, 1, 2).fill(col(PAL.grassTip));
        }
        // rocky outcrops showing through
        if (hash(X, 9, run.start) < 0.04 && h > 12) g.rect(X, -h + 6, 4, 3).fill(col(PAL.rock)).rect(X, -h + 6, 4, 1).fill(col(PAL.rockLight));
        L.markSpan(X, 2, -h);
        if (rng.chance(0.045)) L.place(rng.pick(rng.chance(0.6) ? s.pine : s.broadleaf), X, -h + 6, rng.chance(0.5));
        else if (rng.chance(0.03)) L.place(rng.pick(s.boulder), X, -h + 3);
        else if (rng.chance(0.04)) L.place(rng.pick(s.bush), X, -h + 3);
      }
    }
  }

  /** One column of the background's fields and wild land, and what grows on it. */
  private buildBackColumn(i: number): void {
    const L = this.back.group(`b${i}`);
    const s = this.far;
    const w = this.world;
    const tone = haze(0.32);
    const col = (c: string) => hexToNum(tone(c));
    const kind = this.backAt(i);
    const x = (i - BACK_PAD_TILES) * TILE;
    const rng = Rng.from(w.seedHash, 0xb2, i);
    const g = L.gfx(x, 'ground');
    const D = BACK_BAND_DEPTH;
    const band = (c: string) => g.rect(x, 0, TILE, D).fill(col(c));
    /** Rows of grass texture that get closer together toward the horizon (depth). */
    const rowsOf = (c: string, every: number) => {
      for (let y = 2, k = 0; y < D; y += every + Math.floor(y / 10), k++) g.rect(x, y, TILE, 1).fill(col(k % 2 ? c : shade(c, -0.06)));
    };
    const flecks = (n: number, c: string, y0 = 2) => {
      for (let k = 0; k < n; k++) g.rect(x + rng.int(0, TILE - 3), rng.int(y0, D - 2), rng.int(1, 3), 1).fill(col(c));
    };

    switch (kind) {
      case 'meadow':
      case 'hills':
        band(PAL.grass);
        rowsOf(PAL.grass, 3);
        flecks(8, PAL.grassLight);
        flecks(4, PAL.grassDark);
        for (let k = 0; k < 3; k++) if (rng.chance(0.5)) g.rect(x + rng.int(0, TILE - 1), rng.int(4, D - 3), 1, 1).fill(col(rng.pick(PAL.flowers)));
        // a hedgerow along a field's edge, now and then
        if (hash(w.seedHash, i, 11) < 0.12) for (let k = 0; k < TILE; k += 4) L.place(rng.pick(s.bush), x + k, 3 + (k % 8 ? 0 : 1));
        else if (rng.chance(0.15)) L.place(rng.pick(s.broadleaf), x + rng.int(4, TILE - 4), rng.int(4, 12), rng.chance(0.5));
        else if (rng.chance(0.3)) L.place(rng.pick(s.bush), x + rng.int(4, TILE - 4), rng.int(3, 14));
        if (rng.chance(0.35)) L.place(rng.pick(s.flowers), x + rng.int(4, TILE - 4), rng.int(4, 20));
        break;
      case 'cleared': {
        // land the town has cleared: rough grass, stumps where the trees stood, a drained marsh's damp patches
        const was = w.back[i];
        band(was === 'marsh' ? shade(PAL.grass, -0.1) : PAL.grass);
        rowsOf(PAL.grass, 4);
        flecks(6, PAL.grassLight);
        flecks(6, PAL.dirt, 4);
        if (was === 'forest') for (let k = 0; k < 3; k++) L.place(rng.pick(s.stump), x + rng.int(3, TILE - 3), rng.int(3, 20), rng.chance(0.5));
        if (was === 'marsh') g.rect(x + rng.int(0, 10), rng.int(6, 16), rng.int(8, 14), 2).fill(col(PAL.mud));
        if (was === 'hills') for (let k = 0; k < 2; k++) L.place(rng.pick(s.boulder), x + rng.int(4, TILE - 4), rng.int(4, 16));
        if (rng.chance(0.4)) L.place(rng.pick(s.tuft), x + rng.int(3, TILE - 3), rng.int(3, 20));
        break;
      }
      case 'forest':
        band(PAL.grassDark);
        flecks(6, PAL.leafDark);
        flecks(4, PAL.trunk);
        // the wood's edge: a row of trees along the back, more in front, undergrowth between
        for (let k = 0; k < 4; k++) L.place(rng.pick(rng.chance(0.5) ? s.pine : s.broadleaf), x + rng.int(0, TILE), rng.int(2, 18), rng.chance(0.5));
        if (rng.chance(0.5)) L.place(rng.pick(s.bush), x + rng.int(0, TILE), rng.int(10, 24));
        if (rng.chance(0.4)) L.place(rng.pick(s.fern), x + rng.int(0, TILE), rng.int(12, 26));
        break;
      case 'marsh':
        band(PAL.marsh);
        flecks(8, PAL.mud);
        for (let k = 0; k < 2; k++) {
          const px = x + rng.int(0, 12);
          const py = rng.int(4, 18);
          const pw = rng.int(10, 20);
          g.rect(px, py, pw, 3).fill(col(PAL.waterDark));
          g.rect(px + 1, py, pw - 2, 1).fill(col(PAL.water));
          g.rect(px + 3, py, 3, 1).fill(col(PAL.waterLight));
        }
        for (let k = 0; k < 3; k++) L.place(rng.pick(s.reeds), x + rng.int(2, TILE - 2), rng.int(3, 20));
        break;
      case 'fertile': {
        band(PAL.soil);
        // furrows, closer together toward the horizon, each with a lit ridge
        for (let y = 3, k = 0; y < D; y += 3 + Math.floor(y / 8), k++) {
          g.rect(x, y, TILE, 2).fill(col(PAL.soilLight));
          g.rect(x, y + 2, TILE, 1).fill(col(shade(PAL.soil, -0.2)));
          if (k % 2 === 0) for (let sx = rng.int(0, 5); sx < TILE; sx += rng.int(4, 8)) g.rect(x + sx, y - 1, 1, 1).fill(col(PAL.grassLight));
        }
        g.rect(x, 0, TILE, 2).fill(col(PAL.grass));
        if (rng.chance(0.25)) L.place(rng.pick(s.bush), x + rng.int(4, TILE - 4), rng.int(3, 8));
        break;
      }
      case 'river': {
        band(PAL.water);
        // banks, the current's streaks, and glints of light
        g.rect(x, 0, TILE, 2).fill(col(PAL.waterDark));
        for (let y = 4; y < D; y += 5) g.rect(x, y, TILE, 1).fill(col(shade(PAL.water, -0.08)));
        for (let k = 0; k < 7; k++) g.rect(x + rng.int(0, TILE - 6), rng.int(3, D - 2), rng.int(3, 7), 1).fill(col(PAL.waterLight));
        for (let k = 0; k < 3; k++) g.rect(x + rng.int(0, TILE - 2), rng.int(3, D - 2), 1, 1).fill(col('#ffffff'));
        if (w.back[i - 1] !== 'river') {
          g.rect(x, 0, 3, D).fill(col(PAL.dirt));
          g.rect(x + 3, 0, 1, D).fill(col(PAL.dirtLight));
          L.place(rng.pick(s.reeds), x + 4, rng.int(4, 12));
        }
        if (w.back[i + 1] !== 'river') {
          g.rect(x + TILE - 3, 0, 3, D).fill(col(PAL.dirt));
          g.rect(x + TILE - 4, 0, 1, D).fill(col(PAL.dirtLight));
          L.place(rng.pick(s.reeds), x + TILE - 4, rng.int(4, 12));
        }
        break;
      }
    }
    // a second layer of small things, far off (their own random stream: nothing above moves)
    const r = Rng.from(w.seedHash, 0xb3, i);
    const bit = (set: PixelArt[], chance: number) => {
      if (r.chance(chance)) L.place(r.pick(set), x + r.int(3, TILE - 3), r.int(3, 22), r.chance(0.5));
    };
    if (kind === 'meadow' || kind === 'cleared') {
      bit(s.tuft, 0.6);
      bit(s.tallGrass, 0.35);
      bit(s.flowers, 0.35);
      bit(s.pebbles, 0.2);
    } else if (kind === 'forest') {
      bit(s.bramble, 0.35);
      bit(s.fern, 0.35);
      bit(s.tallGrass, 0.25);
    } else if (kind === 'marsh') {
      bit(s.tallGrass, 0.5);
    }
  }

  /* ------------------------------------------------------------ midground */

  private buildMidTile(c: number): void {
    const L = this.mid.group(c);
    const s = this.near;
    const kind = this.terrain[c];
    const x = c * TILE;
    const rng = Rng.from(this.world.seedHash, 0xc2, c);
    L.place(midTileArt(this.world.seedHash, c, kind), x + TILE / 2, MID_ART_BASE, false, 'ground');
    const base = () => rng.int(MID_BAND_TOP + 2, 0);

    switch (kind) {
      case 'clear':
        // land that was cleared keeps a trace of what stood there: stumps, a boulder too big to shift
        if (this.world.mid[c] === 'forest') for (let k = rng.int(1, 2); k > 0; k--) L.place(rng.pick(s.stump), x + rng.int(4, TILE - 4), base(), rng.chance(0.5));
        else if (this.world.mid[c] === 'rock' && rng.chance(0.5)) L.place(rng.pick(s.boulder), x + rng.int(6, TILE - 6), base(), rng.chance(0.5));
        if (rng.chance(0.6)) L.place(rng.pick(s.tuft), x + rng.int(2, TILE - 2), base());
        if (rng.chance(0.3)) L.place(rng.pick(s.flowers), x + rng.int(2, TILE - 2), base());
        break;
      case 'hill':
        this.buildHillSlice(c);
        break;
      case 'forest':
        for (let k = rng.int(1, 2); k > 0; k--) L.place(rng.pick(rng.chance(0.6) ? s.broadleaf : s.pine), x + rng.int(0, TILE), base(), rng.chance(0.5));
        if (rng.chance(0.5)) L.place(rng.pick(s.bush), x + rng.int(0, TILE), base(), rng.chance(0.5));
        if (rng.chance(0.45)) L.place(rng.pick(s.fern), x + rng.int(2, TILE - 2), base(), rng.chance(0.5));
        if (rng.chance(0.25)) L.place(rng.pick(s.mushroom), x + rng.int(2, TILE - 2), base());
        if (rng.chance(0.18)) L.place(rng.pick(s.log), x + rng.int(6, TILE - 6), base(), rng.chance(0.5));
        break;
      case 'rock':
        if (rng.chance(0.3)) L.place(rng.pick(s.outcrop), x + rng.int(8, TILE - 8), base(), rng.chance(0.5));
        else for (let k = rng.int(1, 2); k > 0; k--) L.place(rng.pick(s.boulder), x + rng.int(4, TILE - 4), base(), rng.chance(0.5));
        if (rng.chance(0.4)) L.place(rng.pick(s.tuft), x + rng.int(2, TILE - 2), base());
        break;
      case 'marsh':
        for (let k = rng.int(1, 3); k > 0; k--) L.place(rng.pick(s.reeds), x + rng.int(2, TILE - 2), base());
        if (rng.chance(0.3)) L.place(rng.pick(s.tuft), x + rng.int(2, TILE - 2), base());
        break;
    }
    // the small things underfoot, twice as thick as they were (their own random stream, so nothing above moves)
    const r = Rng.from(this.world.seedHash, 0xc3, c);
    const at = () => x + r.int(2, TILE - 2);
    const bit = (set: PixelArt[], chance: number, flip = true) => {
      if (r.chance(chance)) L.place(r.pick(set), at(), base(), flip && r.chance(0.5));
    };
    switch (kind) {
      case 'clear':
        bit(s.tuft, 0.6);
        bit(s.tuft, 0.4);
        bit(s.pebbles, 0.35);
        bit(s.flowers, 0.3);
        bit(s.tallGrass, 0.2);
        bit(s.twig, 0.12);
        break;
      case 'forest':
        bit(s.bramble, 0.3);
        bit(s.fern, 0.4);
        bit(s.twig, 0.35);
        bit(s.mushroom, 0.2);
        bit(s.tallGrass, 0.3);
        bit(s.tuft, 0.4);
        break;
      case 'rock':
        bit(s.pebbles, 0.7);
        bit(s.pebbles, 0.4);
        bit(s.tallGrass, 0.25);
        bit(s.flowers, 0.15);
        break;
      case 'marsh':
        bit(s.tallGrass, 0.5);
        bit(s.reeds, 0.4);
        bit(s.flowers, 0.15);
        break;
    }
  }

  /** The part of a hill mound that stands on tile c. The mound's shape spans its whole run of hill tiles. */
  private buildHillSlice(c: number): void {
    const L = this.mid;
    const s = this.near;
    let start = c;
    while (start > 0 && this.terrain[start - 1] === 'hill') start--;
    let end = c;
    while (end < this.terrain.length - 1 && this.terrain[end + 1] === 'hill') end++;
    const len = end - start + 1;
    const x0 = start * TILE;
    const width = len * TILE;
    const peak = Math.min(44, 14 + len * 4);
    const rng = Rng.from(this.world.seedHash, 0xc1, c);
    for (let x = (c - start) * TILE; x < (c - start + 1) * TILE; x += 2) {
      const t = (x + 1) / width;
      const h = Math.round(peak * Math.sin(Math.PI * t) ** 0.8);
      if (h <= 0) continue;
      const g = L.gfx(x0 + x, 'hills');
      const top = MID_BAND_TOP - h;
      const X = x0 + x;
      // the sunny slope and the shaded one, a lit crest, and the texture of turf over stone
      g.rect(X, top, 2, h + 2).fill(hexToNum(t < 0.5 ? PAL.grassLight : PAL.grass));
      if (t >= 0.5) g.rect(X, top + 3, 2, h - 1).fill(hexToNum(shade(PAL.grass, -0.06)));
      g.rect(X, top, 2, 2).fill(hexToNum(PAL.grassTip));
      g.rect(X + (hash(X, 1) < 0.5 ? 0 : 1), top - 1, 1, 1).fill(hexToNum(PAL.grassLight));
      for (let y = top + 4; y < MID_BAND_TOP; y += 2) {
        const r = hash(this.world.seedHash, X, y);
        if (r < 0.1) g.rect(X, y, 1, 1).fill(hexToNum(PAL.grassDark));
        else if (r < 0.17) g.rect(X + 1, y, 1, 1).fill(hexToNum(t < 0.5 ? PAL.grassTip : PAL.grassLight));
        else if (r < 0.19 && y > top + 8) g.rect(X, y, 2, 1).fill(hexToNum(PAL.rock)).rect(X, y - 1, 1, 1).fill(hexToNum(PAL.rockLight));
      }
      if (rng.chance(0.12)) g.rect(X, top + rng.int(4, Math.max(5, h - 2)), 2, 1).fill(hexToNum(PAL.grassDark));
      L.markSpan(X, 2, top);
      if (rng.chance(0.05)) L.place(rng.pick(s.bush), x0 + x, top + 3, rng.chance(0.5));
      else if (rng.chance(0.03)) L.place(rng.pick(s.boulder), x0 + x, top + 3);
      else if (h > peak * 0.7 && rng.chance(0.02)) L.place(rng.pick(s.broadleaf), x0 + x, top + 4);
    }
  }

  /* ------------------------------------------------------------ foreground walkway */

  private buildForeTile(c: number): void {
    const L = this.fore.group(c);
    const s = this.near;
    const x = c * TILE;
    const rng = Rng.from(this.world.seedHash, 0xf1, c);
    const cleared = this.terrain[c] === 'clear';
    const open = (i: number) => i < 0 || i >= this.terrain.length || this.terrain[i] === 'clear';
    L.place(foreTileArt(this.world.seedHash, c, cleared, open(c - 1), open(c + 1)), x + TILE / 2, FORE_DEPTH, false, 'ground');
    if (rng.chance(0.35)) L.place(rng.pick(s.tuft), x + rng.int(2, TILE - 2), rng.int(1, 3));
    if (!cleared && rng.chance(0.3)) L.place(rng.pick(s.flowers), x + rng.int(2, TILE - 2), rng.int(2, 6));
    // the verge below the road: a flower or a stone now and then
    if (rng.chance(0.2)) L.place(rng.pick(s.flowers), x + rng.int(2, TILE - 2), FORE_DEPTH - 1);
  }
}

/** Collapse an array into runs of equal values. */
function runs<T>(items: readonly T[]): { kind: T; start: number; length: number }[] {
  const out: { kind: T; start: number; length: number }[] = [];
  for (let i = 0; i < items.length; ) {
    let j = i;
    while (j < items.length && items[j] === items[i]) j++;
    out.push({ kind: items[i], start: i, length: j - i });
    i = j;
  }
  return out;
}
