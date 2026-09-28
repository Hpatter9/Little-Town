// Weather in front of the town, on the phone (where the strip has a sky of its own): rain slanting down, storms
// with lightning, drifting fog, autumn leaves on the wind, and fireflies on summer nights. (Snow is SnowView's.)
// It's only for looks; the sim's weather is in shared/sim/weather.ts.

import { Container, Graphics } from 'pixi.js';
import { STRIP_HEIGHT } from '../../shared/constants';
import type { Calendar, Season } from '../../shared/sim/time';
import type { WeatherNow } from '../../shared/sim/weather';

const DROPS = 420;
const LEAVES = 18;
const FLIES = 22;
const GROUND = STRIP_HEIGHT - 6;

interface Mote {
  x: number;
  y: number;
  speed: number;
  phase: number;
  color: number;
}

export class WeatherView {
  readonly root = new Container();
  private readonly rain = new Graphics();
  private readonly fog = new Graphics();
  private readonly bits = new Graphics();
  private readonly flash = new Graphics();
  private drops: Mote[] = [];
  private leaves: Mote[] = [];
  private flies: Mote[] = [];
  private weather: WeatherNow = { kind: 'clear', through: 1, before: 'clear' };
  private season: Season = 'spring';
  private daylight = 1;
  private lastNow = 0;
  private nextBolt = 0;
  private bolt: { at: number; path: [number, number][] } | null = null;
  /** How hard it's raining now, eased toward the weather's (0..1). */
  private wet = 0;
  private foggy = 0;

  constructor() {
    this.root.addChild(this.fog, this.rain, this.bits, this.flash);
    const leafColors = [0xd0602a, 0xe0a030, 0xb8401e, 0xc88a2a, 0x9a5a24];
    for (let i = 0; i < DROPS; i++) this.drops.push({ x: Math.random(), y: Math.random() * GROUND, speed: 260 + Math.random() * 120, phase: 0, color: 0 });
    for (let i = 0; i < LEAVES; i++) this.leaves.push({ x: Math.random(), y: Math.random() * GROUND, speed: 14 + Math.random() * 14, phase: Math.random() * 6.3, color: leafColors[i % leafColors.length] });
    for (let i = 0; i < FLIES; i++) this.flies.push({ x: Math.random(), y: GROUND - 10 - Math.random() * 50, speed: 0.4 + Math.random() * 0.8, phase: Math.random() * 6.3, color: 0 });
  }

  update(c: Calendar, weather: WeatherNow): void {
    this.weather = weather;
    this.season = c.season;
    this.daylight = c.daylight;
  }

  render(now: number, width: number): void {
    const dt = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 0;
    this.lastNow = now;
    const w = this.weather.kind;
    const wantWet = w === 'storm' ? 1 : w === 'rain' ? 0.55 : 0;
    this.wet += (wantWet - this.wet) * Math.min(1, dt * 0.5);
    this.foggy += ((w === 'fog' ? 1 : 0) - this.foggy) * Math.min(1, dt * 0.3);
    const t = now / 1000;
    const wind = w === 'storm' ? 70 : 25;

    // rain: streaks slanting with the wind
    const r = this.rain.clear();
    const n = Math.round(DROPS * this.wet);
    for (let i = 0; i < n; i++) {
      const d = this.drops[i];
      d.y += d.speed * (0.8 + this.wet * 0.5) * dt;
      d.x += (wind * dt) / Math.max(1, width);
      if (d.y > GROUND) {
        d.y = -6;
        d.x = Math.random();
      }
      const x = Math.round((((d.x % 1) + 1) % 1) * width);
      r.moveTo(x, d.y).lineTo(x - wind * 0.05, d.y - 6);
    }
    if (n) r.stroke({ width: 1, color: this.daylight > 0.3 ? 0xc8d8f0 : 0x7890b8, alpha: 0.65 });

    // fog: soft pale bands drifting slowly across the land
    const f = this.fog.clear();
    if (this.foggy > 0.02) {
      for (let i = 0; i < 5; i++) {
        const y = 100 + i * 18 + Math.sin(t * 0.2 + i) * 4;
        const x = ((t * (6 + i * 2) + i * 173) % (width + 400)) - 200;
        f.roundRect(x - 200, y, width * 0.7, 22, 11).fill({ color: this.daylight > 0.3 ? 0xdde2e8 : 0x6a7080, alpha: 0.13 * this.foggy });
        f.roundRect(x + width * 0.4, y + 6, width * 0.6, 18, 9).fill({ color: this.daylight > 0.3 ? 0xdde2e8 : 0x6a7080, alpha: 0.1 * this.foggy });
      }
      f.rect(0, 60, width, GROUND - 60).fill({ color: this.daylight > 0.3 ? 0xd0d6de : 0x505868, alpha: 0.12 * this.foggy });
    }

    const b = this.bits.clear();
    // autumn: leaves tumbling down on the breeze (by day, not in the rain)
    if (this.season === 'autumn' && this.wet < 0.3 && this.daylight > 0.2) {
      for (const l of this.leaves) {
        l.y += l.speed * dt;
        l.x += ((wind * 0.6 + Math.sin(t * 1.3 + l.phase) * 20) * dt) / Math.max(1, width);
        if (l.y > GROUND) {
          l.y = -4;
          l.x = Math.random();
        }
        const x = Math.round((((l.x % 1) + 1) % 1) * width);
        const flip = Math.sin(t * 4 + l.phase) > 0;
        b.rect(x, Math.round(l.y), flip ? 2 : 1, flip ? 1 : 2).fill({ color: l.color });
      }
    }
    // summer nights: fireflies blinking low over the ground
    if (this.season === 'summer' && this.daylight < 0.3 && this.wet < 0.2) {
      for (const fl of this.flies) {
        const x = Math.round(fl.x * width + Math.sin(t * fl.speed + fl.phase) * 14);
        const y = Math.round(fl.y + Math.sin(t * fl.speed * 1.7 + fl.phase) * 6);
        const glow = Math.max(0, Math.sin(t * 1.6 + fl.phase * 3));
        if (glow < 0.2) continue;
        b.rect(x - 1, y - 1, 3, 3).fill({ color: 0xd8ff70, alpha: 0.18 * glow * (1 - this.daylight * 3) });
        b.rect(x, y, 1, 1).fill({ color: 0xf0ffa0, alpha: glow * (1 - this.daylight * 3) });
      }
    }

    // storms: lightning, a jagged bolt and the whole sky lit for a moment
    const fl = this.flash.clear();
    if (w === 'storm') {
      if (now > this.nextBolt) {
        if (this.nextBolt) this.bolt = { at: now, path: boltPath(Math.random() * width) };
        this.nextBolt = now + 5_000 + Math.random() * 12_000;
      }
      if (this.bolt) {
        const age = (now - this.bolt.at) / 1000;
        if (age > 0.45) this.bolt = null;
        else {
          const on = age < 0.08 || (age > 0.16 && age < 0.22); // a double flicker
          fl.rect(0, 0, width, STRIP_HEIGHT).fill({ color: 0xeef2ff, alpha: on ? 0.35 : 0.08 * (1 - age / 0.45) });
          if (on) {
            const [first, ...rest] = this.bolt.path;
            fl.moveTo(first[0], first[1]);
            for (const [x, y] of rest) fl.lineTo(x, y);
            fl.stroke({ width: 2, color: 0xffffff, alpha: 0.95 });
          }
        }
      }
    } else this.bolt = null;
  }
}

/** A jagged bolt from the top of the sky down to the hills. */
function boltPath(x0: number): [number, number][] {
  const out: [number, number][] = [[x0, 0]];
  let x = x0;
  for (let y = 12; y < 130; y += 10 + Math.random() * 10) {
    x += (Math.random() - 0.5) * 22;
    out.push([Math.round(x), Math.round(y)]);
  }
  return out;
}
