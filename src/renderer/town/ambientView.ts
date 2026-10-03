// The air over the town: smoke curling up from the homes' hearths (more on cold mornings and evenings), mist lying
// low over the land at dawn and in the wet, and haze over the far land so it sits back in the distance. All of it is
// inside the town's day-and-night tint (TownView), so it darkens with the night like everything else.

import { Container, Sprite } from 'pixi.js';
import { glowTexture } from './layer';

interface Puff {
  s: Sprite;
  age: number;
  life: number;
  vx: number;
  vy: number;
  grow: number;
}

/** Smoke from the homes' chimneys, drawn in one layer's coordinates (that layer's own container holds it). */
export class ChimneySmoke {
  readonly root = new Container();
  private puffs: Puff[] = [];
  private spare: Sprite[] = [];
  private since = new Map<string, number>();
  /** 0 (none) to 1 (thick): how much the hearths are burning (cold, morning, evening). */
  amount = 0.5;
  /** Drift across the land, in px a second (the wind). */
  wind = 3;
  /** How big the puffs grow (1: the strip's; the map, seen from further off, uses more). */
  size = 1;

  update(dt: number, chimneys: { x: number; y: number }[]): void {
    // each chimney puffs every so often
    for (const c of chimneys) {
      const key = `${c.x}|${c.y}`;
      const t = (this.since.get(key) ?? Math.random()) + dt;
      const every = 1.6 - this.amount * 1.1;
      if (t >= every && this.puffs.length < 160 && this.amount > 0.05) {
        this.since.set(key, 0);
        this.emit(c.x, c.y);
      } else this.since.set(key, t);
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      if (p.age >= p.life) {
        p.s.visible = false;
        this.spare.push(p.s);
        this.puffs.splice(i, 1);
        continue;
      }
      const k = p.age / p.life;
      p.s.x += (p.vx + this.wind * k) * dt;
      p.s.y += p.vy * dt;
      const size = (4 + p.grow * k) * this.size;
      p.s.width = p.s.height = size;
      // (thin at the chimney, thickest a little way up, gone at the top)
      p.s.alpha = 0.8 * Math.min(1, k * 4) * (1 - k * k);
    }
  }

  private emit(x: number, y: number): void {
    const s = this.spare.pop() ?? this.root.addChild(new Sprite(glowTexture()));
    s.anchor.set(0.5);
    s.visible = true;
    s.tint = Math.random() < 0.5 ? 0xe8e4dc : 0xc8c4bc;
    s.position.set(x + (Math.random() - 0.5) * 2, y - 1);
    this.puffs.push({ s, age: 0, life: 4 + Math.random() * 3, vx: (Math.random() - 0.5) * 1.5, vy: -(5 + Math.random() * 3), grow: 14 + Math.random() * 10 });
  }
}

/** A long, soft band (a stretched glow), for mist and haze. */
function band(color: number): Sprite {
  const s = new Sprite(glowTexture());
  s.anchor.set(0.5);
  s.tint = color;
  return s;
}

/** Mist over the land at dawn and in rain or fog, and haze over the far land: soft bands across the screen, in the
 *  strip's own coordinates (the town root's), drifting slowly. */
export class Mist {
  readonly root = new Container();
  private readonly bands: { s: Sprite; y: number; h: number; speed: number; phase: number }[] = [];
  /** 0..1: how thick. */
  thickness = 0;
  private t = 0;

  constructor(ys: { y: number; h: number }[]) {
    for (const [i, b] of ys.entries()) {
      const s = this.root.addChild(band(0xe8eef4));
      this.bands.push({ s, y: b.y, h: b.h, speed: 2 + i * 1.3, phase: i * 1.7 });
    }
  }

  render(dt: number, width: number): void {
    this.t += dt;
    this.root.visible = this.thickness > 0.01;
    if (!this.root.visible) return;
    for (const b of this.bands) {
      // (each band twice the screen wide, sliding and breathing)
      b.s.width = width * 2.2;
      b.s.height = b.h;
      b.s.x = width / 2 + Math.sin((this.t * b.speed) / 60 + b.phase) * width * 0.25;
      b.s.y = b.y + Math.sin(this.t / 7 + b.phase) * 1.5;
      b.s.alpha = this.thickness * (0.55 + 0.2 * Math.sin(this.t / 5 + b.phase));
    }
  }
}

/** How much the hearths smoke and how thick the mist is, for the hour, the season and the weather. */
export function airFor(hour: number, season: string, weather: string): { smoke: number; mist: number } {
  const cold = season === 'winter' ? 1 : season === 'autumn' ? 0.6 : season === 'spring' ? 0.4 : 0.2;
  const meal = hour >= 5 && hour < 9 ? 1 : hour >= 17 && hour < 22 ? 0.8 : hour >= 22 || hour < 5 ? 0.35 : 0.2;
  const smoke = Math.min(1, 0.15 + cold * 0.45 + meal * 0.45);
  // mist: thickest just before sunrise, burned off by mid-morning; and in fog or rain
  const dawn = hour >= 3 && hour < 10 ? Math.max(0, 1 - Math.abs(hour - 6) / 3.5) : 0;
  const wet = weather === 'fog' ? 0.9 : weather === 'rain' || weather === 'storm' ? 0.35 : 0;
  const mist = Math.min(1, Math.max(dawn * (season === 'summer' ? 0.5 : 0.85), wet));
  return { smoke, mist };
}
