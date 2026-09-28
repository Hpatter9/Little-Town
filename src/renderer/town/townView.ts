// Builds the three scrolling layers of the town and maps the camera onto them.
//   back  : farms, fields, hills; 60% scale, parallax (static for now)
//   mid   : main buildings, wild terrain at the edges (rebuilt per tile as land is cleared)
//   fore  : the walkway where townsfolk move (dirt path on cleared land, rough trail elsewhere)

import { Container, Graphics, Sprite } from 'pixi.js';
import { BACK_GROUND_Y, BACK_PAD_TILES, BACK_SCALE, FORE_TOP_Y, MID_GROUND_Y, STRIP_HEIGHT, TILE, WORLD_WIDTH } from '../../shared/constants';
import { Rng } from '../../shared/rng';
import type { BuildLayer } from '../../shared/data/buildings';
import type { Building, TileState } from '../../shared/sim/state';
import type { MidTerrain, World } from '../../shared/world';
import { applySeasonPalette, PAL } from '../art/palette';
import { haze, hexToNum, noTone, type PixelArt, type Tone } from '../art/pixelArt';
import { makeSpriteSet, markerFlag, type SpriteSet } from '../art/sprites';
import { BuildingsView } from './buildingsView';
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

    this.buildBack(far, haze(0.32));
    for (let i = 0; i < world.tiles; i++) {
      this.buildMidTile(i);
      this.buildForeTile(i);
    }
    this.buildings = new BuildingsView({ back: this.back, mid: this.mid, fore: this.fore }, world.seedHash);
    this.syncBuildings(buildings);
    for (const l of [this.back, this.mid, this.fore]) l.sortObjects();
    this.setMarkers(tiles);
  }

  /* ------------------------------------------------------------ buildings */

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
  setSeason(biome: string, season: string): void {
    if (season === this.season) return;
    this.season = season;
    applySeasonPalette(biome, season);
    this.near = makeSpriteSet(this.world.seedHash ^ 0x51, noTone);
    this.back.removeGroup('static');
    this.buildBack(makeSpriteSet(this.world.seedHash ^ 0x52, haze(0.32)), haze(0.32));
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
      for (const i of changed) {
        this.fore.removeGroup(i);
        this.buildForeTile(i);
      }
      for (const l of [this.mid, this.fore]) {
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

  private buildBack(s: SpriteSet, tone: Tone): void {
    const L = this.back.group('static');
    const w = this.world;
    const col = (c: string) => hexToNum(tone(c));
    const farTone = haze(0.55);

    // A distant ridge behind everything, so the skyline never drops flat.
    const ridge = new Rng(w.seedHash ^ 0x77);
    const a = ridge.range(0, 10);
    const b = ridge.range(0, 10);
    for (let x = L.x0; x < L.x0 + L.width; x += 4) {
      const h = Math.round(22 + 12 * Math.sin(x / 260 + a) + 8 * Math.sin(x / 97 + b));
      L.gfx(x, 'far').rect(x, -h, 4, h).fill(hexToNum(farTone(PAL.grass)));
      L.gfx(x, 'far').rect(x, -h, 4, 2).fill(hexToNum(farTone(PAL.grassLight)));
      L.markSpan(x, 4, -h);
    }

    for (const run of runs(w.back)) {
      const x0 = (run.start - BACK_PAD_TILES) * TILE;
      const width = run.length * TILE;
      if (run.kind === 'hills') {
        const rng = Rng.from(w.seedHash, 0xb1, run.start);
        const peak = Math.min(95, 38 + run.length * 6) * rng.range(0.8, 1);
        for (let x = 0; x < width; x += 2) {
          const t = (x + 1) / width;
          const h = Math.round(peak * Math.sin(Math.PI * t) ** 0.7 + 4 * Math.sin(x / 11));
          if (h <= 0) continue;
          const g = L.gfx(x0 + x, 'hills');
          g.rect(x0 + x, -h, 2, h).fill(col(t < 0.5 ? PAL.grassLight : PAL.grass));
          g.rect(x0 + x, -h, 2, 2).fill(col(PAL.grassTip));
          L.markSpan(x0 + x, 2, -h);
          if (rng.chance(0.035)) L.place(rng.pick(rng.chance(0.6) ? s.pine : s.broadleaf), x0 + x, -h + 6, rng.chance(0.5));
          else if (rng.chance(0.03)) L.place(rng.pick(s.boulder), x0 + x, -h + 3);
        }
      }
    }

    for (let i = 0; i < w.back.length; i++) {
      const kind = w.back[i];
      const x = (i - BACK_PAD_TILES) * TILE;
      const rng = Rng.from(w.seedHash, 0xb2, i);
      const g = L.gfx(x, 'ground');
      const band = (c: string) => g.rect(x, 0, TILE, BACK_BAND_DEPTH).fill(col(c));

      switch (kind) {
        case 'meadow':
        case 'hills':
          band(PAL.grass);
          for (let k = 0; k < 6; k++) g.rect(x + rng.int(0, TILE - 3), rng.int(2, BACK_BAND_DEPTH - 2), 3, 1).fill(col(PAL.grassLight));
          if (rng.chance(0.15)) L.place(rng.pick(s.broadleaf), x + rng.int(4, TILE - 4), rng.int(4, 12), rng.chance(0.5));
          else if (rng.chance(0.3)) L.place(rng.pick(s.bush), x + rng.int(4, TILE - 4), rng.int(3, 14));
          if (rng.chance(0.35)) L.place(rng.pick(s.flowers), x + rng.int(4, TILE - 4), rng.int(4, 20));
          break;
        case 'forest':
          band(PAL.grassDark);
          for (let k = 0; k < 3; k++) L.place(rng.pick(rng.chance(0.5) ? s.pine : s.broadleaf), x + rng.int(0, TILE), rng.int(2, 16), rng.chance(0.5));
          if (rng.chance(0.4)) L.place(rng.pick(s.bush), x + rng.int(0, TILE), rng.int(10, 22));
          break;
        case 'marsh':
          band(PAL.marsh);
          g.rect(x + rng.int(0, 8), rng.int(4, 14), rng.int(12, 22), 4).fill(col(PAL.waterDark));
          for (let k = 0; k < 2; k++) L.place(rng.pick(s.reeds), x + rng.int(2, TILE - 2), rng.int(3, 18));
          break;
        case 'fertile':
          band(PAL.soil);
          for (let y = 3; y < BACK_BAND_DEPTH; y += 5) g.rect(x, y, TILE, 2).fill(col(PAL.soilLight));
          g.rect(x, 0, TILE, 2).fill(col(PAL.grass));
          if (rng.chance(0.25)) L.place(rng.pick(s.bush), x + rng.int(4, TILE - 4), rng.int(3, 8));
          break;
        case 'river': {
          band(PAL.water);
          g.rect(x, 0, TILE, 2).fill(col(PAL.waterDark));
          for (let k = 0; k < 5; k++) g.rect(x + rng.int(0, TILE - 6), rng.int(3, BACK_BAND_DEPTH - 2), rng.int(3, 7), 1).fill(col(PAL.waterLight));
          if (w.back[i - 1] !== 'river') L.place(rng.pick(s.reeds), x + 4, rng.int(4, 12));
          if (w.back[i + 1] !== 'river') L.place(rng.pick(s.reeds), x + TILE - 4, rng.int(4, 12));
          break;
        }
      }
    }
  }

  /* ------------------------------------------------------------ midground */

  private buildMidTile(c: number): void {
    const L = this.mid.group(c);
    const s = this.near;
    const kind = this.terrain[c];
    const x = c * TILE;
    const rng = Rng.from(this.world.seedHash, 0xc2, c);
    const g = L.gfx(x, 'ground');
    const band = (top: string, body: string) => {
      g.rect(x, MID_BAND_TOP, TILE, -MID_BAND_TOP + 2).fill(hexToNum(body));
      g.rect(x, MID_BAND_TOP, TILE, 2).fill(hexToNum(top));
    };
    const base = () => rng.int(MID_BAND_TOP + 2, 0);

    switch (kind) {
      case 'clear':
        band(PAL.grassLight, PAL.grass);
        if (rng.chance(0.5)) L.place(rng.pick(s.tuft), x + rng.int(2, TILE - 2), base());
        if (rng.chance(0.25)) L.place(rng.pick(s.flowers), x + rng.int(2, TILE - 2), base());
        break;
      case 'hill':
        band(PAL.grassLight, PAL.grass);
        this.buildHillSlice(c);
        break;
      case 'forest':
        band(PAL.grass, PAL.grassDark);
        for (let k = rng.int(1, 2); k > 0; k--) L.place(rng.pick(rng.chance(0.6) ? s.broadleaf : s.pine), x + rng.int(0, TILE), base(), rng.chance(0.5));
        if (rng.chance(0.5)) L.place(rng.pick(s.bush), x + rng.int(0, TILE), base(), rng.chance(0.5));
        break;
      case 'rock':
        band(PAL.rockLight, PAL.rock);
        for (let k = 0; k < 4; k++) g.rect(x + rng.int(0, TILE - 3), rng.int(MID_BAND_TOP + 2, 0), 3, 1).fill(hexToNum(PAL.rockDark));
        if (rng.chance(0.3)) L.place(rng.pick(s.outcrop), x + rng.int(8, TILE - 8), base(), rng.chance(0.5));
        else for (let k = rng.int(1, 2); k > 0; k--) L.place(rng.pick(s.boulder), x + rng.int(4, TILE - 4), base(), rng.chance(0.5));
        if (rng.chance(0.4)) L.place(rng.pick(s.tuft), x + rng.int(2, TILE - 2), base());
        break;
      case 'marsh':
        band(PAL.marsh, PAL.mud);
        g.rect(x + rng.int(0, 10), MID_BAND_TOP + rng.int(3, 6), rng.int(10, 20), 2).fill(hexToNum(PAL.waterDark));
        for (let k = rng.int(1, 3); k > 0; k--) L.place(rng.pick(s.reeds), x + rng.int(2, TILE - 2), base());
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
      g.rect(x0 + x, top, 2, h + 2).fill(hexToNum(t < 0.5 ? PAL.grassLight : PAL.grass));
      g.rect(x0 + x, top, 2, 2).fill(hexToNum(PAL.grassTip));
      if (rng.chance(0.12)) g.rect(x0 + x, top + rng.int(4, Math.max(5, h - 2)), 2, 1).fill(hexToNum(PAL.grassDark));
      L.markSpan(x0 + x, 2, top);
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
    const g = L.gfx(x, 'ground');
    const cleared = this.terrain[c] === 'clear';

    if (cleared) {
      // packed-dirt walkway with a grassy lip
      g.rect(x, 0, TILE, FORE_DEPTH).fill(hexToNum(PAL.dirt));
      g.rect(x, FORE_DEPTH - 3, TILE, 3).fill(hexToNum(PAL.dirtDark));
      for (let k = 0; k < 7; k++) g.rect(x + rng.int(0, TILE - 2), rng.int(5, FORE_DEPTH - 4), rng.int(1, 3), 1).fill(hexToNum(rng.chance(0.5) ? PAL.dirtLight : PAL.dirtDark));
      for (let k = 0; k < 2; k++) g.rect(x + rng.int(0, TILE - 2), rng.int(6, FORE_DEPTH - 5), 2, 1).fill(hexToNum(PAL.pebble));
    } else {
      // rough grass with a faint trail
      g.rect(x, 0, TILE, FORE_DEPTH).fill(hexToNum(PAL.grass));
      g.rect(x, 12, TILE, 7).fill(hexToNum(PAL.dirt));
      g.rect(x + rng.int(0, 6), 12, rng.int(4, 10), 1).fill(hexToNum(PAL.grass));
      g.rect(x + rng.int(14, 22), 18, rng.int(4, 10), 1).fill(hexToNum(PAL.grass));
      g.rect(x, FORE_DEPTH - 3, TILE, 3).fill(hexToNum(PAL.grassDark));
      for (let k = 0; k < 5; k++) g.rect(x + rng.int(0, TILE - 3), rng.pick([rng.int(3, 10), rng.int(20, FORE_DEPTH - 4)]), 3, 1).fill(hexToNum(PAL.grassLight));
    }
    // ragged grass lip along the top edge
    g.rect(x, 0, TILE, 3).fill(hexToNum(PAL.grass));
    for (let px = 0; px < TILE; px += 2) {
      const bh = rng.int(0, 3);
      if (bh > 0) {
        g.rect(x + px, -bh, 1, bh).fill(hexToNum(rng.chance(0.5) ? PAL.grassLight : PAL.grass));
        L.markSpan(x + px, 1, -bh);
      }
    }
    if (rng.chance(0.35)) L.place(rng.pick(s.tuft), x + rng.int(2, TILE - 2), rng.int(1, 3));
    if (!cleared && rng.chance(0.3)) L.place(rng.pick(s.flowers), x + rng.int(2, TILE - 2), rng.int(2, 6));
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
