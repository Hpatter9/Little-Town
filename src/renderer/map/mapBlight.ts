// The blight on the map (sim/blight.ts, sim/nests.ts, sim/calamity.ts): round every monster nest and round the
// Calamity's heart the land goes grey and dead. Drawn as a soft dark-violet stain over the ground (in MapView's
// `under`), withered things from the Undead pack's props scattered in it (dead trees, thorns, bones), and at the heart
// the cave pack's dark totem with a pile of skulls and a slow violet pulse. The nests themselves are places (MapView's
// `syncPlaces`, with `nestTexture`). Redrawn only when the sources change.

import { Container, Sprite, Texture } from 'pixi.js';
import { CELL, groundAt, wet, type LandMap } from '../../shared/sim/land';
import type { NestKind } from '../../shared/data/nests';
import { loadImage } from '../art/loadImage';
import { PROP_FINE, propTextures } from '../art/props';
import propKinds from '../art/propKinds.json';
import { glowTexture } from '../town/layer';
import { hash, visibility } from './groundArt';
import warrenUrl from '../art/nests/warren.png';
import denUrl from '../art/nests/den.png';
import barrowUrl from '../art/nests/barrow.png';
import heartUrl from '../art/nests/heart.png';
import skullsUrl from '../art/nests/skulls.png';

const NEST_URLS: Record<NestKind, string> = { warren: warrenUrl, den: denUrl, barrow: barrowUrl };
const nestTex: Partial<Record<NestKind, Texture>> = {};
let heartTex: Texture | null = null;
let skullsTex: Texture | null = null;
let asked = false;
const waiting: (() => void)[] = [];

function texOf(im: HTMLImageElement): Texture {
  const t = Texture.from(im);
  t.source.scaleMode = 'nearest';
  return t;
}

/** Load the nests' and the heart's pictures once (each caller is told when they come). */
export function loadNestArt(then: () => void): void {
  waiting.push(then);
  if (asked) return;
  asked = true;
  const jobs = (Object.keys(NEST_URLS) as NestKind[]).map((k) => loadImage(NEST_URLS[k]).then((im) => void (nestTex[k] = texOf(im))));
  jobs.push(loadImage(heartUrl).then((im) => void (heartTex = texOf(im))));
  jobs.push(loadImage(skullsUrl).then((im) => void (skullsTex = texOf(im))));
  void Promise.allSettled(jobs).then(() => waiting.splice(0).forEach((f) => f()));
}
export const nestTexture = (k: NestKind): Texture | null => nestTex[k] ?? null;

const KINDS = propKinds as Record<string, string[]>;
/** The stain's colour and how dark at its middle; how many withered things a cell of its radius. */
const STAIN = 0x2a0c34;
const STAIN_ALPHA = 0.8;
const WITHERED_PER_CELL = 1.6;

export interface BlightSource {
  x: number;
  y: number;
  r: number;
}

export class MapBlight {
  private readonly stains = new Container();
  private readonly drawn: Sprite[] = [];
  private heart: { totem: Sprite; skulls: Sprite; glow: Sprite } | null = null;
  private key = '';
  private dead: Texture[] = [];
  private t = 0;

  constructor(
    under: Container,
    private readonly things: Container,
  ) {
    under.addChildAt(this.stains, 0);
    propTextures('undead').then(
      (tex) => {
        this.dead = tex.filter((_, i) => ['tree', 'bush', 'rock'].includes(KINDS.undead?.[i] ?? ''));
        this.key = '';
      },
      () => undefined,
    );
    loadNestArt(() => (this.key = ''));
  }

  /** Per snapshot: the sources (cells) and the heart (a cell, or null before the spreading). */
  sync(land: LandMap | null, sources: BlightSource[], heart: { x: number; y: number } | null): void {
    const key = `${sources.map((b) => `${b.x},${b.y},${b.r.toFixed(1)}`).join(';')}|${heart ? `${heart.x},${heart.y}` : ''}|${this.dead.length}|${!!heartTex}|${land?.open ?? 0}`;
    if (key === this.key || !land) return;
    this.key = key;
    for (const s of this.drawn) s.destroy();
    this.drawn.length = 0;
    this.stains.removeChildren();
    for (const b of sources) {
      // (the stain: a few soft blots, the middle darkest)
      for (let i = 0; i < 3; i++) {
        const s = this.stains.addChild(new Sprite(glowTexture()));
        s.anchor.set(0.5);
        s.tint = STAIN;
        const k = 1 - i * 0.22;
        s.width = b.r * 2.6 * CELL * k;
        s.height = b.r * 2.2 * CELL * k;
        s.alpha = STAIN_ALPHA * (0.6 + i * 0.25);
        s.position.set(b.x * CELL + (hash(i, b.x, b.y) - 0.5) * CELL, b.y * CELL + (hash(i + 3, b.x, b.y) - 0.5) * CELL);
      }
      // (withered things on the dry cells in it)
      if (!this.dead.length) continue;
      const n = Math.round(b.r * WITHERED_PER_CELL);
      for (let i = 0; i < n; i++) {
        const a = hash(i, b.x * 7, b.y) * Math.PI * 2;
        const d = Math.sqrt(hash(i + 11, b.x, b.y * 5)) * b.r;
        const cx = Math.floor(b.x + Math.cos(a) * d);
        const cy = Math.floor(b.y + Math.sin(a) * d);
        if (cx < 0 || cy < 0 || cx >= land.w || cy >= land.h || wet(groundAt(land, cx, cy)) || visibility(land, cx, cy) === 0) continue;
        const s = this.things.addChild(new Sprite(this.dead[Math.floor(hash(i + 21, cx, cy) * this.dead.length)]));
        s.anchor.set(0.5, 0.95);
        s.scale.set(1 / PROP_FINE);
        s.position.set((cx + 0.5) * CELL, (cy + 0.85) * CELL);
        s.zIndex = s.y;
        s.tint = 0xb8a8b8;
        this.drawn.push(s);
      }
    }
    if (this.heart) {
      this.heart.totem.destroy();
      this.heart.skulls.destroy();
      this.heart.glow.destroy();
      this.heart = null;
    }
    if (heart && heartTex && visibility(land, heart.x, heart.y) !== 0) {
      const x = (heart.x + 0.5) * CELL;
      const y = (heart.y + 0.8) * CELL;
      const glow = this.stains.addChild(new Sprite(glowTexture()));
      glow.anchor.set(0.5);
      glow.tint = 0x9040ff;
      glow.position.set(x, y - 14);
      const totem = this.things.addChild(new Sprite(heartTex));
      totem.anchor.set(0.5, 0.95);
      totem.position.set(x, y);
      totem.zIndex = y;
      const skulls = this.things.addChild(new Sprite(skullsTex ?? Texture.EMPTY));
      skulls.anchor.set(0.5, 0.9);
      skulls.position.set(x + 26, y + 6);
      skulls.zIndex = y + 6;
      this.heart = { totem, skulls, glow };
    }
  }

  /** Each frame: the heart's glow pulses. */
  render(dt: number): void {
    this.t += dt;
    if (!this.heart) return;
    const k = 0.5 + 0.5 * Math.sin(this.t * 1.6);
    this.heart.glow.width = this.heart.glow.height = 90 + 30 * k;
    this.heart.glow.alpha = 0.35 + 0.3 * k;
  }
}
