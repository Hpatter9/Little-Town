// What the weather does to the ground (the owner's ask: wind across the land, puddles after rain, snow that settles
// and melts): gusts run over the grass and the fields as pale waves leaning with the wind; while it rains the ground
// grows wet (puddles stand on the roads and the grass, the roads darken with mud) and dries out slowly after; the first
// snow of winter settles in patches over the last day of autumn, and the last of it lingers in patches through the
// first day of spring, melting away. Renderer only, over the ground (MapView's `under`); none on a slow phone.

import { Container, Graphics, Sprite } from 'pixi.js';
import { CELL, groundAt, isRoad, type LandMap } from '../../shared/sim/land';
import { glowTexture } from '../town/layer';
import { visibility } from './groundArt';
import { snowCover, wetnessStep } from './groundRules';

const WAVES_MOST = 14;
const PUDDLES_MOST = 40;
const SNOW_MOST = 70;
const GRASSY = new Set(['grass', 'fertile', 'hill', 'meadow']);

interface Wave {
  s: Sprite;
  x: number;
  y: number;
  age: number;
  life: number;
}
interface Spot {
  s: Sprite | Graphics;
  x: number;
  y: number;
  /** Below this share of wetness (or snow) it doesn't show. */
  at: number;
}

const hash = (x: number, y: number, k: number) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.7) * 43758.5453;
  return v - Math.floor(v);
};

export class GroundWeather {
  private readonly layer = new Container();
  private readonly waves: Wave[] = [];
  private readonly puddles: Spot[] = [];
  private readonly snow: Spot[] = [];
  /** How wet the ground is (0 dry .. 1 soaked): rises in the rain, falls slowly after. */
  wet = 0;
  private lastTick = -1;
  private viewKey = '';

  constructor(under: Container) {
    under.addChild(this.layer);
  }

  /** Per snapshot: the game's clock and weather, to wet and dry the ground in game time. */
  weather(tick: number, kind: string): void {
    if (this.lastTick >= 0 && tick > this.lastTick) this.wet = wetnessStep(this.wet, kind, tick - this.lastTick);
    this.lastTick = tick;
  }

  /** The season, its day and the hour (main.ts, per snapshot): the snow between the seasons. */
  season = 'summer';
  seasonDay = 1;
  hour = 12;

  render(dt: number, view: { x: number; y: number; w: number; h: number }, land: LandMap | null, wind: number, calm: boolean): void {
    const windDir = 1;
    const { season, seasonDay, hour } = this;
    this.layer.visible = !calm && !!land;
    if (calm || !land) return;
    const cellOk = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < land.w && cy < land.h && visibility(land, cx, cy) === 2;
    // gusts: pale soft bands over the grass, sliding downwind and fading
    const want = season === 'winter' ? 0 : Math.round(WAVES_MOST * Math.min(1, wind / 1.2));
    while (this.waves.length > want) this.waves.pop()!.s.destroy();
    for (let tries = 0; this.waves.length < want && tries < 6; tries++) {
      const x = view.x + Math.random() * view.w;
      const y = view.y + Math.random() * view.h;
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      if (!cellOk(cx, cy) || !GRASSY.has(groundAt(land, cx, cy))) continue;
      const s = this.layer.addChild(new Sprite(glowTexture()));
      s.anchor.set(0.5);
      s.tint = 0xf4ffd8;
      s.width = 90 + Math.random() * 80;
      s.height = 14 + Math.random() * 8;
      s.rotation = windDir > 0 ? -0.25 : 0.25;
      this.waves.push({ s, x, y, age: 0, life: 2.5 + Math.random() * 2 });
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.age += dt;
      w.x += windDir * (30 + wind * 40) * dt;
      const k = w.age / w.life;
      w.s.alpha = 0.16 * Math.sin(Math.min(1, k) * Math.PI);
      w.s.position.set(w.x, w.y);
      if (k >= 1) {
        w.s.destroy();
        this.waves.splice(i, 1);
      }
    }
    // the puddles and the snow are laid on cells in view (redone when the view moves a good way)
    const key = `${Math.round(view.x / 160)},${Math.round(view.y / 160)},${Math.round(view.w / 160)}`;
    if (key !== this.viewKey) {
      this.viewKey = key;
      for (const p of [...this.puddles, ...this.snow]) p.s.destroy();
      this.puddles.length = 0;
      this.snow.length = 0;
      const x0 = Math.floor(view.x / CELL) - 1, x1 = Math.ceil((view.x + view.w) / CELL) + 1;
      const y0 = Math.floor(view.y / CELL) - 1, y1 = Math.ceil((view.y + view.h) / CELL) + 1;
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) {
          if (!cellOk(cx, cy)) continue;
          const g = groundAt(land, cx, cy);
          const road = isRoad(land, cx, cy);
          const h = hash(cx, cy, 3);
          // a puddle on a road or the grass, here and there
          if ((road && h < 0.3) || (GRASSY.has(g) && h < 0.07)) {
            if (this.puddles.length >= PUDDLES_MOST) continue;
            // (a puddle: muddy water at the rim, the sky's grey-blue in the middle, a glint)
            const px = (cx + 0.2 + hash(cx, cy, 4) * 0.6) * CELL, py = (cy + 0.3 + hash(cx, cy, 5) * 0.5) * CELL;
            const w = 10 + hash(cx, cy, 6) * 10;
            const s = this.layer.addChild(new Graphics());
            s.ellipse(0, 0, w, w * 0.42).fill({ color: road ? 0x4a3a2a : 0x3a4a3a, alpha: 0.7 });
            s.ellipse(0, -0.5, w - 2, w * 0.42 - 1.5).fill({ color: 0x7a90a8, alpha: 0.85 });
            s.ellipse(-w * 0.3, -w * 0.12, w * 0.35, 1).fill({ color: 0xe8f0ff, alpha: 0.8 });
            s.position.set(px, py);
            this.puddles.push({ s, x: px, y: py, at: 0.2 + hash(cx, cy, 7) * 0.6 });
          }
          // snow lying in patches, on anything but water
          if (g !== 'water' && g !== 'shallows' && hash(cx, cy, 8) < 0.55 && this.snow.length < SNOW_MOST) {
            const s = this.layer.addChild(new Sprite(glowTexture()));
            s.anchor.set(0.5);
            s.tint = 0xffffff;
            const px = (cx + 0.5) * CELL + (hash(cx, cy, 9) - 0.5) * CELL, py = (cy + 0.5) * CELL + (hash(cx, cy, 10) - 0.5) * CELL;
            s.position.set(px, py);
            s.width = 40 + hash(cx, cy, 11) * 40;
            s.height = s.width * 0.6;
            this.snow.push({ s, x: px, y: py, at: hash(cx, cy, 12) });
          }
        }
    }
    const wet = this.wet;
    for (const p of this.puddles) {
      p.s.visible = wet > p.at;
      p.s.alpha = Math.min(1, (wet - p.at) * 4);
    }
    const cover = snowCover(season, seasonDay, hour);
    for (const p of this.snow) {
      p.s.visible = cover > p.at;
      p.s.alpha = Math.min(0.85, (cover - p.at) * 4);
    }
  }
}
