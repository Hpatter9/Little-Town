// The sky behind the town: the sun climbing and sinking in an arc across the day, the moon doing the same
// through the night (in its phase: new to full and back over the werewolves' cycle), and stars twinkling in
// the dark, with now and then a shooting star. Drawn in screen space behind the hills, so the sun and moon rise
// and set behind the land.
//
// On the phone (`full`) the strip isn't see-through to a desktop, so the whole sky is drawn too: its colour
// through the day (blue by day, warm at dawn and dusk, deep blue at night, greyer under cloud), clouds drifting on
// the wind, birds crossing by day and bats at dusk, and a rainbow when the rain clears.

import { loadScenery, sceneryArts } from '../art/scenery';
import { noTone } from '../art/pixelArt';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { BACK_GROUND_Y, STRIP_HEIGHT } from '../../shared/constants';
import { FULL_MOON_DAYS } from '../../shared/data/monsters';
import type { Calendar } from '../../shared/sim/time';
import type { WeatherNow } from '../../shared/sim/weather';
import { mix, skyColors, weatherCover } from './skyColors';

/** The sun is up from SUN[0] to SUN[1] (it rises and sets behind the hills); the moon from MOON[0] to MOON[1]. */
const SUN = [5, 21] as const;
const MOON = [19, 31] as const; // (7am the next morning)
/** Where the arcs begin and peak (strip y): the horizon behind the back hills, and near the top of the sky. */
const HORIZON = BACK_GROUND_Y + 4;
const ZENITH = 22;
/** On the phone the clock bar runs across the top of the strip, so the arcs peak lower. */
const ZENITH_FULL = 48;
const SCALE = 2; // chunky pixels, like the rest of the art
const STARS = 130;
const CLOUDS = 14;

interface Star {
  x: number;
  y: number;
  size: number;
  color: number;
  base: number;
  speed: number;
  phase: number;
}

interface Cloud {
  sprite: Sprite;
  /** Position along a loop wider than the screen, so clouds drift off one side and back on the other. */
  x: number;
  speed: number;
  alpha: number;
}

interface Flyer {
  x: number;
  y: number;
  dx: number;
  phase: number;
  bob: number;
}

export class SkyView {
  readonly root = new Container();
  private readonly back = new Graphics();
  private readonly stars = new Graphics();
  private readonly glow = new Graphics();
  private readonly rainbow = new Graphics();
  private readonly clouds = new Container();
  private readonly flyers = new Graphics();
  private readonly sun = new Sprite(sunTexture());
  private readonly moon = new Sprite();
  private readonly moons: Texture[] = [];
  private starList: Star[] = [];
  private cloudList: Cloud[] = [];
  private flock: { birds: Flyer[]; bats: boolean } | null = null;
  private nextFlock = 0;
  private shooting: { x: number; y: number; dx: number; dy: number; born: number } | null = null;
  private nextShooting = 0;
  private hours = 12;
  private daylight = 1;
  private phase = FULL_MOON_DAYS - 1;
  private weather: WeatherNow = { kind: 'clear', through: 1, before: 'clear' };
  private backKey = '';
  private lastNow = 0;

  constructor(private readonly full = false) {
    for (let i = 0; i < FULL_MOON_DAYS; i++) this.moons.push(moonTexture(i));
    for (const s of [this.sun, this.moon]) {
      s.anchor.set(0.5);
      s.scale.set(SCALE);
    }
    this.root.addChild(this.back, this.stars, this.glow, this.rainbow, this.moon, this.sun, this.clouds, this.flyers);
    this.back.visible = this.rainbow.visible = this.clouds.visible = this.flyers.visible = full;
    for (let i = 0; i < STARS; i++) {
      const bright = Math.random() < 0.18;
      this.starList.push({
        x: Math.random(),
        y: 4 + Math.random() * (HORIZON - 30),
        size: bright ? 2 : 1,
        color: [0xffffff, 0xfff4d8, 0xd8e8ff, 0xffe0c0][Math.floor(Math.random() * 4)],
        base: bright ? 1 : 0.6 + Math.random() * 0.4,
        speed: 0.6 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
      });
    }
    if (full) {
      const shapes = [0, 1, 2, 3].map(cloudTexture);
      for (let i = 0; i < CLOUDS; i++) {
        const sprite = new Sprite(shapes[i % shapes.length]);
        sprite.anchor.set(0.5);
        sprite.scale.set(SCALE);
        sprite.y = 18 + ((i * 37) % 70);
        this.clouds.addChild(sprite);
        this.cloudList.push({ sprite, x: Math.random(), speed: 0.004 + Math.random() * 0.006, alpha: 0 });
      }
      // (the packs' clouds take over once loaded: art/scenery.ts; white, so the time of day still tints them)
      void loadScenery().then(() => {
        const arts = sceneryArts('cloud', noTone, 'sky');
        if (arts.length)
          for (const [i, c] of this.cloudList.entries()) {
            c.sprite.texture = arts[(i * 3) % arts.length].texture;
            c.sprite.scale.set(SCALE / 2); // (about the size of the painted ones)
          }
      });
    }
  }

  /** From each snapshot: the time of day, tonight's moon and the weather. */
  update(c: Calendar, moonPhase: number, weather: WeatherNow): void {
    this.hours = c.hour + c.minute / 60;
    this.daylight = c.daylight;
    this.weather = weather;
    if (moonPhase !== this.phase || !this.moon.texture || this.moon.texture === Texture.EMPTY) {
      this.phase = moonPhase;
      this.moon.texture = this.moons[moonPhase] ?? this.moons[0];
    }
  }


  /** Each frame: `width` is the town's share of the screen. (The root sits in the town's, at the strip's top.) */
  render(now: number, width: number): void {
    const dt = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 0;
    this.lastNow = now;
    const h = this.hours;
    const cover = this.full ? weatherCover(this.weather) : 0;
    const g = this.glow.clear();

    if (this.full) this.drawBack(width, cover);

    // the sun: warm and low at dawn and dusk, pale gold at noon (dimmed behind cloud)
    const sunU = (h - SUN[0]) / (SUN[1] - SUN[0]);
    this.sun.visible = sunU > 0 && sunU < 1;
    if (this.sun.visible) {
      const { x, y } = arc(sunU, width, this.full);
      this.sun.position.set(x, y);
      const low = 1 - Math.sin(Math.PI * sunU); // 0 at noon, 1 at the horizon
      this.sun.tint = mix(0xfff6d8, 0xff9a4a, low ** 1.5);
      this.sun.alpha = 1 - cover * 0.75;
      g.circle(x, y, 20 + low * 8).fill({ color: this.sun.tint, alpha: (0.12 + low * 0.08) * (1 - cover) });
      g.circle(x, y, 30 + low * 14).fill({ color: this.sun.tint, alpha: 0.06 * (1 - cover) });
    }

    // the moon: from dusk to dawn, in tonight's phase
    const mh = h < 12 ? h + 24 : h;
    const moonU = (mh - MOON[0]) / (MOON[1] - MOON[0]);
    this.moon.visible = moonU > 0 && moonU < 1;
    if (this.moon.visible) {
      const { x, y } = arc(moonU, width, this.full);
      this.moon.position.set(x, y);
      // fainter by day (it lingers into the morning and comes up before dark)
      this.moon.alpha = (0.35 + 0.65 * (1 - this.daylight)) * (1 - cover * 0.7);
      const lit = litShare(this.phase);
      if (lit > 0.05) g.circle(x, y, 18).fill({ color: 0xcfdcff, alpha: 0.1 * lit * (1 - this.daylight) * (1 - cover) });
    }

    // the stars: out as the light goes, each twinkling at its own pace (hidden behind cloud)
    const dark = Math.max(0, 1 - this.daylight * 1.6) * (1 - cover);
    const st = this.stars.clear();
    this.stars.visible = dark > 0;
    if (dark > 0) {
      const t = now / 1000;
      for (const s of this.starList) {
        const twinkle = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        const a = dark * s.base * twinkle;
        if (a < 0.04) continue;
        const x = Math.round(s.x * width);
        st.rect(x, Math.round(s.y), s.size, s.size).fill({ color: s.color, alpha: a });
        // the brightest glint in a little cross now and then
        if (s.size > 1 && twinkle > 0.9) st.rect(x - 1, Math.round(s.y) + 0.5, 4, 1).rect(x + 0.5, Math.round(s.y) - 1, 1, 4).fill({ color: s.color, alpha: a * 0.5 });
      }
      this.shootingStar(st, now, width, dark);
    }

    if (!this.full) return;
    this.drawRainbow(width);
    this.drawClouds(dt, width, cover);
    this.drawFlyers(now, dt, width);
  }

  /** The sky's colour, in bands from the top down to behind the hills (redrawn only when it changes). */
  private drawBack(width: number, cover: number): void {
    const { top, horizon } = skyColors(this.hours, this.daylight, cover);
    const key = `${top}|${horizon}|${width}`;
    if (key === this.backKey) return;
    this.backKey = key;
    const g = this.back.clear();
    const BANDS = 24;
    const bandH = STRIP_HEIGHT / BANDS;
    for (let i = 0; i < BANDS; i++) g.rect(0, Math.floor(i * bandH), width, Math.ceil(bandH) + 1).fill({ color: mix(top, horizon, (i / (BANDS - 1)) ** 1.3) });
  }

  /** Now and then at night a shooting star streaks down across the sky. */
  private shootingStar(g: Graphics, now: number, width: number, dark: number): void {
    if (!this.shooting && now > this.nextShooting) {
      if (this.nextShooting) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.shooting = { x: Math.random() * width, y: 8 + Math.random() * 40, dx: dir * (220 + Math.random() * 120), dy: 60 + Math.random() * 40, born: now };
      }
      this.nextShooting = now + 15_000 + Math.random() * 30_000;
    }
    const s = this.shooting;
    if (!s) return;
    const age = (now - s.born) / 1000;
    if (age > 0.7) {
      this.shooting = null;
      return;
    }
    const x = s.x + s.dx * age;
    const y = s.y + s.dy * age;
    const fade = dark * (1 - age / 0.7);
    for (let i = 0; i < 8; i++) g.rect(Math.round(x - s.dx * 0.012 * i), Math.round(y - s.dy * 0.012 * i), 1, 1).fill({ color: 0xffffff, alpha: fade * (1 - i / 8) });
  }

  /** A rainbow in the hours after the rain clears (by day). */
  private drawRainbow(width: number): void {
    const w = this.weather;
    const after = (w.before === 'rain' || w.before === 'storm') && (w.kind === 'clear' || w.kind === 'cloudy');
    const strength = after && this.daylight > 0.6 ? Math.sin(Math.PI * Math.min(1, w.through / 0.45)) * (w.through < 0.45 ? 1 : 0) : 0;
    const g = this.rainbow.clear();
    if (strength <= 0.01) return;
    const cx = width * 0.62;
    const cy = HORIZON + 10;
    const colors = [0xe0403a, 0xf08a30, 0xf0d040, 0x60c050, 0x4080e0, 0x7050c0];
    colors.forEach((c, i) => g.arc(cx, cy, 150 - i * 4, Math.PI, 0).stroke({ width: 4, color: c, alpha: 0.28 * strength }));
  }

  /** Clouds drift on the wind; more of them, and greyer, the worse the weather. */
  private drawClouds(dt: number, width: number, cover: number): void {
    const loop = width + 200;
    const wind = this.weather.kind === 'storm' ? 3 : this.weather.kind === 'rain' ? 1.8 : 1;
    const shown = Math.round(2 + cover * (CLOUDS - 2));
    const tint = cloudTint(this.hours, this.daylight, cover);
    this.cloudList.forEach((c, i) => {
      const want = i < shown ? 0.55 + cover * 0.4 : 0;
      c.alpha += (want - c.alpha) * Math.min(1, dt * 0.8); // (fade in and out as the weather turns)
      c.x = (c.x + c.speed * wind * dt) % 1;
      c.sprite.x = Math.round(c.x * loop - 100);
      c.sprite.alpha = c.alpha;
      c.sprite.tint = tint;
      c.sprite.visible = c.alpha > 0.02 && c.sprite.x > -80 && c.sprite.x < width + 80;
    });
  }

  /** Birds cross the sky by day in fair weather; at dusk, bats. */
  private drawFlyers(now: number, dt: number, width: number): void {
    const fair = this.weather.kind === 'clear' || this.weather.kind === 'cloudy';
    const dusk = this.daylight > 0.05 && this.daylight < 0.55;
    const day = this.daylight >= 0.55;
    if (!this.flock && now > this.nextFlock) {
      if (this.nextFlock && fair && (day || dusk)) {
        const bats = dusk;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const n = bats ? 2 + Math.floor(Math.random() * 4) : 3 + Math.floor(Math.random() * 5);
        const y0 = 24 + Math.random() * 60;
        const x0 = dir > 0 ? -20 : width + 20;
        const speed = (bats ? 40 : 30 + Math.random() * 15) * dir;
        this.flock = {
          bats,
          birds: Array.from({ length: n }, (_, i) => ({
            // a loose V for birds; bats flit about anywhere
            x: x0 - dir * (bats ? Math.random() * 40 : Math.ceil(i / 2) * 9),
            y: y0 + (bats ? (Math.random() - 0.5) * 24 : (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 5),
            dx: speed * (0.9 + Math.random() * 0.2),
            phase: Math.random() * 6,
            bob: Math.random() * 6,
          })),
        };
      }
      this.nextFlock = now + 10_000 + Math.random() * 20_000;
    }
    const g = this.flyers.clear();
    const f = this.flock;
    if (!f) return;
    const t = now / 1000;
    const color = f.bats ? 0x1a1420 : mix(0x2a2a34, 0x14141c, 1 - this.daylight);
    let onScreen = false;
    for (const b of f.birds) {
      b.x += b.dx * dt;
      const x = Math.round(b.x);
      const y = Math.round(b.y + Math.sin(t * (f.bats ? 7 : 1.5) + b.bob) * (f.bats ? 4 : 1.5));
      if (x > -30 && x < width + 30) onScreen = true;
      const up = Math.sin(t * (f.bats ? 22 : 9) + b.phase) > 0;
      // a little "v" (wings up) or a flat "^" (wings down)
      if (up) g.rect(x - 3, y - 2, 1, 1).rect(x - 2, y - 1, 1, 1).rect(x - 1, y, 2, 1).rect(x + 1, y - 1, 1, 1).rect(x + 2, y - 2, 1, 1);
      else g.rect(x - 3, y, 1, 1).rect(x - 2, y - 1, 1, 1).rect(x - 1, y - 1, 2, 1).rect(x + 1, y - 1, 1, 1).rect(x + 2, y, 1, 1);
    }
    g.fill({ color });
    if (!onScreen && f.birds.every((b) => (b.dx > 0 ? b.x > width : b.x < 0))) this.flock = null;
  }
}

/** Clouds lit by the time of day: white by day, rosy at dawn and dusk, dark at night, greyer in bad weather. */
function cloudTint(hours: number, daylight: number, cover: number): number {
  const twilight = daylight > 0 && daylight < 1 ? 1 - Math.abs(daylight * 2 - 1) : 0;
  let c = mix(0x323848, 0xffffff, daylight);
  c = mix(c, hours < 12 ? 0xffc8a8 : 0xf0a090, twilight * 0.7);
  return mix(c, mix(0x2a2c34, 0x9098a4, daylight), Math.max(0, cover - 0.4) * 1.4);
}

/** A pixel cloud: a few overlapping puffs, lit on top and shaded underneath. */
function cloudTexture(shape: number): Texture {
  const W = 48;
  const H = 20;
  const puffs: [number, number, number][][] = [
    [[14, 12, 7], [24, 9, 9], [34, 12, 7], [20, 14, 6], [30, 14, 6]],
    [[10, 13, 6], [19, 10, 7], [28, 9, 8], [37, 13, 6]],
    [[16, 12, 8], [28, 11, 9], [22, 14, 7]],
    [[8, 14, 5], [16, 12, 6], [25, 10, 7], [33, 12, 6], [40, 14, 5]],
  ];
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inside = puffs[shape].some(([px, py, r]) => Math.hypot(x - px, (y - py) * 1.25) <= r);
      if (!inside || y > 17) continue;
      const shade = y > 13 ? '#c8ccd6' : y > 10 ? '#e8eaf0' : '#ffffff';
      g.fillStyle = shade;
      g.fillRect(x, y, 1, 1);
    }
  }
  return Texture.from(c);
}

/** A point along the arc: u 0..1 from the left edge (rising) over the top to the right edge (setting). */
function arc(u: number, width: number, full: boolean): { x: number; y: number } {
  const margin = 24;
  const top = full ? ZENITH_FULL : ZENITH;
  return { x: Math.round(margin + u * (width - 2 * margin)), y: Math.round(HORIZON - (HORIZON - top) * Math.sin(Math.PI * u)) };
}

/** How the phase index maps round the cycle: 0 = new, 0.5 = full (the full moon is the last day). */
function cycle(phase: number): number {
  return (((phase - (FULL_MOON_DAYS - 1) + FULL_MOON_DAYS / 2) % FULL_MOON_DAYS) + FULL_MOON_DAYS) % FULL_MOON_DAYS / FULL_MOON_DAYS;
}

/** Share of the face that's lit, 0..1. */
function litShare(phase: number): number {
  return (1 - Math.cos(cycle(phase) * Math.PI * 2)) / 2;
}

/* ------------------------------------------------------------ pixel art */

function canvas(size: number, draw: (put: (x: number, y: number, rgba: string) => void) => void): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw((x, y, rgba) => {
    g.fillStyle = rgba;
    g.fillRect(x, y, 1, 1);
  });
  return Texture.from(c);
}

/** A 15px sun (tinted by the time of day, so drawn in near-white): a round face with a brighter core and rays. */
function sunTexture(): Texture {
  const N = 21;
  const c = (N - 1) / 2;
  return canvas(N, (put) => {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const d = Math.hypot(x - c, y - c);
        if (d <= 5.6) put(x, y, d < 3 ? '#ffffff' : d < 4.6 ? '#fffaf0' : '#f4e8c8');
      }
    }
    // eight short rays
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      for (const r of i % 2 ? [7.5, 8.5] : [7.2, 8.2, 9.2]) put(Math.round(c + Math.cos(a) * r), Math.round(c + Math.sin(a) * r), '#f8ecd0');
    }
  });
}

/** A 13px moon in one phase: the lit part pale with a few craters, the dark part only just visible. */
function moonTexture(phase: number): Texture {
  const N = 13;
  const R = 6;
  const c = (N - 1) / 2;
  const u = cycle(phase); // 0 new .. 0.5 full .. 1 new
  const theta = u * Math.PI * 2;
  const craters = [
    [-2, -2, 1.3],
    [2, 1, 1],
    [-1, 3, 0.9],
    [3, -3, 0.7],
  ];
  return canvas(N, (put) => {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const nx = (x - c) / R;
        const ny = (y - c) / R;
        if (nx * nx + ny * ny > 1.02) continue;
        const w = Math.sqrt(Math.max(0, 1 - ny * ny));
        // waxing: lit from the right, the shadow's edge an ellipse sweeping across; waning: the mirror image
        const lit = u <= 0.5 ? nx > w * Math.cos(theta) : -nx > w * Math.cos(Math.PI * 2 - theta);
        if (!lit) {
          put(x, y, 'rgba(120,130,160,0.22)');
          continue;
        }
        const crater = craters.some(([cx, cy, r]) => Math.hypot(x - c - cx, y - c - cy) <= r);
        const rim = nx * nx + ny * ny > 0.75;
        put(x, y, crater ? '#c8ccd8' : rim ? '#dfe4ee' : '#f2f4f8');
      }
    }
  });
}
