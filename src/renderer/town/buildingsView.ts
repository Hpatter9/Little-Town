// Draws buildings into their layers: finished art, blueprints (a faint outline that fills in from the
// ground up as work progresses, with scaffolding and a progress bar), and the placement ghost.

import { Container, Graphics, Sprite, Ticker } from 'pixi.js';
import { dustFrame, FLAME_SIZE, flameFrame, smokeFrame } from '../art/effects';
import { TILE } from '../../shared/constants';
import type { BuildLayer } from '../../shared/data/buildings';
import { defOf, stillNeeded } from '../../shared/sim/buildings';
import { poolSize, type Building } from '../../shared/sim/state';
import { CROPS } from '../../shared/data/crops';
import { buildingArt, type CropLook } from '../art/buildings';
import { haze, noTone, type PixelArt, type Tone } from '../art/pixelArt';
import { campfireFrames } from '../art/sprites';
import { Rng } from '../../shared/rng';
import type { Layer } from './layer';

/** What a field looks like now: bare, sprouting, tall, or ripe. */
function cropLook(b: Building): CropLook | undefined {
  if (!CROPS[b.def] || b.status !== 'done') return undefined;
  const c = b.crop;
  if (!c || c.stage === 'fallow') return 'fallow';
  if (c.stage === 'ripe') return 'ripe';
  return c.growth < 0.4 ? 'sprout' : 'tall';
}

/** Where building bottoms sit in each layer's local coordinates. */
const BASE_Y: Record<BuildLayer, number> = { fore: 14, mid: 0, back: 6 };
const BLUEPRINT_TINT = 0x9fc6ff;

export interface LocalRect {
  layer: BuildLayer;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Drawn {
  sig: string;
  rect: LocalRect;
  /** Blueprint only: the part revealed by progress, and its mask. */
  reveal?: { mask: Graphics; art: PixelArt; left: number; top: number };
  overlay?: Graphics;
  flames?: Container;
  smoke?: Sprite[];
}

/** Smoke frames are 96px; the dust cloud is pinned at its base (from the pack's manifest). */
const SMOKE_SIZE = 96;
const SMOKE_PUFF_FRAMES = 6;
const DUST_PIVOT: [number, number] = [48, 70];

export class BuildingsView {
  private readonly drawn = new Map<number, Drawn>();
  private readonly overlays: Record<BuildLayer, Container>;
  private readonly tones: Record<BuildLayer, [Tone, string]> = { fore: [noTone, 'near'], mid: [noTone, 'near'], back: [haze(0.32), 'far'] };
  private readonly fireFrames: PixelArt[];
  private ghost: { sprite: Sprite; foot: Graphics; layer: BuildLayer } | null = null;

  constructor(
    private readonly layers: Record<BuildLayer, Layer>,
    seedHash: number,
  ) {
    this.overlays = {
      fore: layers.fore.root.addChild(new Container()),
      mid: layers.mid.root.addChild(new Container()),
      back: layers.back.root.addChild(new Container()),
    };
    this.fireFrames = campfireFrames(Rng.from(seedHash, 0xf2), noTone);
  }

  private art(defId: string, layer: BuildLayer, stage?: CropLook): PixelArt {
    if (defId === 'campfire') return this.fireFrames[0];
    const [tone, key] = this.tones[layer];
    return buildingArt(defId, tone, key, stage);
  }

  /** Bring the drawing up to date. Returns the layers whose shapes changed (their skylines need rebuilding). */
  sync(buildings: Building[]): Set<BuildLayer> {
    const changed = new Set<BuildLayer>();
    const seen = new Set<number>();
    for (const b of buildings) {
      seen.add(b.id);
      const def = defOf(b);
      const sig = `${b.def}|${b.tile}|${b.status}|${cropLook(b) ?? ''}`;
      let d = this.drawn.get(b.id);
      if (!d || d.sig !== sig) {
        this.remove(b.id);
        d = this.draw(b);
        this.drawn.set(b.id, d);
        changed.add(def.layer);
      }
      if (b.status === 'blueprint') this.updateBlueprint(b, d);
      else if (def.hp) this.updateWallBar(b, d, def.hp, def.layer);
      this.updateFire(b, d, def.layer);
    }
    for (const id of [...this.drawn.keys()]) {
      if (!seen.has(id)) {
        const gone = this.drawn.get(id)!;
        changed.add(gone.rect.layer);
        if (!gone.reveal && !gone.sig.startsWith('campfire')) this.dust(gone.rect); // (not a cancelled blueprint)
        this.remove(id);
      }
    }
    return changed;
  }

  private remove(id: number): void {
    const d = this.drawn.get(id);
    if (!d) return;
    this.layers[d.rect.layer].removeGroup(`b${id}`);
    d.overlay?.destroy();
    d.flames?.destroy({ children: true });
    d.smoke?.forEach((sp) => sp.destroy());
    this.drawn.delete(id);
  }

  /** A cloud of dust where a building came down (burned, broken through or pulled down). */
  private dust(rect: LocalRect): void {
    const sp = this.overlays[rect.layer].addChild(new Sprite());
    const scale = Math.max(1, Math.min(2, rect.w / 60));
    sp.scale.set(scale);
    sp.position.set(Math.round(rect.x + rect.w / 2 - DUST_PIVOT[0] * scale), Math.round(rect.y + rect.h - DUST_PIVOT[1] * scale));
    const start = performance.now();
    const step = () => {
      const f = dustFrame((performance.now() - start) / 80);
      if (!f || sp.destroyed) {
        Ticker.shared.remove(step);
        if (!sp.destroyed) sp.destroy();
        return;
      }
      sp.texture = f;
    };
    Ticker.shared.add(step);
    step();
  }

  private draw(b: Building): Drawn {
    const def = defOf(b);
    const L = this.layers[def.layer].group(`b${b.id}`);
    const art = this.art(b.def, def.layer, b.status === 'done' ? cropLook(b) : undefined);
    const cx = (b.tile + def.width / 2) * TILE;
    const bottom = BASE_Y[def.layer];
    const left = Math.round(cx - art.width / 2);
    const top = bottom - art.height;
    const rect: LocalRect = { layer: def.layer, x: left, y: top, w: art.width, h: art.height };

    if (b.status === 'done') {
      if (b.def === 'campfire') L.placeAnimated(this.fireFrames, cx, bottom, 7);
      else L.place(art, cx, bottom);
      return { sig: `${b.def}|${b.tile}|${b.status}|${cropLook(b) ?? ''}`, rect };
    }
    // blueprint: a faint full outline, plus the finished art masked to the progress so far
    const faint = L.place(art, cx, bottom);
    faint.alpha = 0.35;
    faint.tint = BLUEPRINT_TINT;
    const solid = L.add(new Sprite(art.texture), cx);
    solid.position.set(left, top);
    const mask = L.add(new Graphics(), cx);
    solid.mask = mask;
    const overlay = this.overlays[def.layer].addChild(new Graphics());
    return { sig: `${b.def}|${b.tile}|${b.status}|${cropLook(b) ?? ''}`, rect, reveal: { mask, art, left, top }, overlay };
  }

  private updateBlueprint(b: Building, d: Drawn): void {
    const { mask, art, left, top } = d.reveal!;
    const built = Math.round(art.height * b.progress);
    mask.clear().rect(left, top + art.height - built, art.width, built).fill(0xffffff);

    const g = d.overlay!.clear();
    const { x, y, w, h } = d.rect;
    if (b.progress > 0) {
      // scaffolding: poles at each end and a couple of cross bars
      for (const px of [x + 1, x + w - 3]) g.rect(px, y - 2, 2, h + 2).fill(0x8a6a44);
      for (let py = y + 6; py < y + h; py += 14) g.rect(x, py, w, 1).fill(0x6a5034);
    }
    // bar: brown while materials arrive, yellow while building
    const bw = Math.max(20, w - 8);
    const bx = x + (w - bw) / 2;
    const by = y - 8;
    const cost = poolSize(defOf(b).cost);
    const delivered = cost - poolSize(stillNeeded(b));
    g.rect(bx - 1, by - 1, bw + 2, 5).fill({ color: 0x1a120c, alpha: 0.85 });
    if (b.progress > 0) g.rect(bx, by, Math.round(bw * b.progress), 3).fill(0xffd84a);
    else g.rect(bx, by, Math.round((bw * delivered) / Math.max(1, cost)), 3).fill(0xb07a3a);
  }

  /** A health bar over a damaged wall or gate. */
  private updateWallBar(b: Building, d: Drawn, max: number, layer: BuildLayer): void {
    d.overlay ??= this.overlays[layer].addChild(new Graphics());
    const g = d.overlay.clear();
    const hp = b.hp ?? max;
    if (hp >= max) return;
    const { x, y, w } = d.rect;
    const bw = Math.max(20, w - 6);
    const bx = x + (w - bw) / 2;
    g.rect(bx - 1, y - 7, bw + 2, 5)
      .fill({ color: 0x1a120c, alpha: 0.85 })
      .rect(bx, y - 6, Math.max(1, Math.round((bw * hp) / max)), 3)
      .fill(hp < max * 0.3 ? 0xe06040 : 0xe0b040);
  }

  /** Flames licking up a burning building (they grow as it burns), and the building charring. */
  private updateFire(b: Building, d: Drawn, layer: BuildLayer): void {
    if (b.fire === undefined) {
      if (d.flames) {
        d.flames.destroy({ children: true });
        d.flames = undefined;
        d.smoke?.forEach((sp) => sp.destroy());
        d.smoke = undefined;
        this.layers[layer].tintGroup(`b${b.id}`, 0xffffff);
      }
      return;
    }
    const { x, y, w, h } = d.rect;
    // tongues of flame spread along the building, each flickering out of step, growing as it burns
    if (!d.flames) {
      d.flames = this.overlays[layer].addChild(new Container());
      const n = Math.max(1, Math.round((w - 4) / 16));
      for (let i = 0; i < n; i++) d.flames.addChild(new Sprite());
    }
    const now = performance.now();
    d.flames.children.forEach((c, i, all) => {
      const sp = c as Sprite;
      const k = (0.55 + b.fire! * 0.9) * (0.75 + 0.25 * Math.abs(Math.sin(i * 1.7)));
      sp.texture = flameFrame(now / 110 + i * 3)!;
      sp.scale.set(k);
      const fx = x + ((i + 0.5) * w) / all.length;
      const base = y + h * (0.45 + 0.25 * Math.abs(Math.sin(i * 2.3)));
      sp.position.set(Math.round(fx - (FLAME_SIZE * k) / 2), Math.round(base - FLAME_SIZE * k));
    });
    // two puffs of smoke roll up off the roof, out of step
    d.smoke ??= [0, 1].map(() => this.overlays[layer].addChild(new Sprite()));
    d.smoke.forEach((sp, i) => {
      // each puff swells, rises and thins out, then starts again (only the puff frames: the rest of the art
      // settles into a ring on the ground)
      const phase = ((performance.now() / 1400 + i / 2) % 1 + 1) % 1;
      sp.texture = smokeFrame(1 + phase * SMOKE_PUFF_FRAMES)!;
      sp.alpha = (0.5 + b.fire! * 0.4) * (1 - phase * 0.8);
      sp.position.set(Math.round(x + w / 2 - SMOKE_SIZE / 2 + (i ? 8 : -8) + phase * 6), Math.round(y - SMOKE_SIZE / 2 + 10 - phase * 26));
    });
    const char = Math.round(255 - b.fire * 150);
    this.layers[layer].tintGroup(`b${b.id}`, (char << 16) | (char << 8) | char);
  }

  /** Local rects of every drawn building (for hit-testing). */
  rects(): [number, LocalRect][] {
    return [...this.drawn].map(([id, d]) => [id, d.rect]);
  }

  /* ------------------------------------------------------------ placement ghost */

  showGhost(defId: string, layer: BuildLayer, tile: number, width: number, valid: boolean): void {
    const art = this.art(defId, layer);
    if (!this.ghost || this.ghost.layer !== layer || this.ghost.sprite.texture !== art.texture) {
      this.hideGhost();
      const foot = this.overlays[layer].addChild(new Graphics());
      const sprite = this.overlays[layer].addChild(new Sprite(art.texture));
      sprite.alpha = 0.7;
      this.ghost = { sprite, foot, layer };
    }
    const cx = (tile + width / 2) * TILE;
    const bottom = BASE_Y[layer];
    this.ghost.sprite.position.set(Math.round(cx - art.width / 2), bottom - art.height);
    this.ghost.sprite.tint = valid ? 0xa8ffa8 : 0xff9090;
    this.ghost.foot
      .clear()
      .rect(tile * TILE, bottom - 2, width * TILE, 3)
      .fill({ color: valid ? 0x60e060 : 0xe05050, alpha: 0.9 });
  }

  hideGhost(): void {
    if (!this.ghost) return;
    this.ghost.sprite.destroy();
    this.ghost.foot.destroy();
    this.ghost = null;
  }
}
