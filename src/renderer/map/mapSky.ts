// Weather you can see from above (the owner's ask: something massive): fog banks that roll slowly over the land in
// fog (and thin morning mist), a sandstorm in the desert's foul weather (the screen goes ochre, sand streaks past, dust
// clouds tumble through), a blizzard when a storm comes in winter or on the tundra (the snow driven sideways, a
// whiteout), and heat haze shimmering over the desert's summer noons. The rules are pure (`skyFor`); the fog lives on
// the land (MapView's `over`, so it pans with the map), the rest over the screen. Lighter on a slow phone.

import { biomeById } from '../../shared/data/biomes';
import { Container, Graphics, Sprite } from 'pixi.js';
import { glowTexture } from '../town/layer';
import type { MapView } from './mapView';

export interface SkyState {
  weather: string;
  season: string;
  biome: string;
  hour: number;
  daylight: number;
  /** Which six-hour spell of weather it is (a third of the winter's snow spells blow up into blizzards). */
  spell?: number;
}
export interface SkyMix {
  /** 0 to 1 each. */
  fog: number;
  sand: number;
  blizzard: number;
  haze: number;
}

/** What the sky is doing now, from the weather, season, land and hour. */
export function skyFor(a: SkyState): SkyMix {
  const def = biomeById(a.biome);
  const desert = !!def.dry; // (dust over any dry land: the desert's sand, the steppe's dust, the ashlands' ash)
  const hot = !!def.hot;
  const cold = a.season === 'winter' || a.biome === 'tundra';
  const foul = a.weather === 'storm' || a.weather === 'rain';
  // (mornings mist over in spring and autumn, and on a wet land in every season but winter)
  const misty = (a.season === 'autumn' || a.season === 'spring' || (def.wet && a.season !== 'winter')) && !desert;
  const mist = (a.hour >= 4.5 && a.hour < 8.5 && misty ? (def.wet ? 0.5 : 0.35) : 0) * (1 - Math.abs(a.hour - 6.5) / 2);
  return {
    fog: Math.max(a.weather === 'fog' ? 1 : 0, Math.max(0, mist)),
    sand: desert && (foul || a.weather === 'cloudy') ? (a.weather === 'storm' ? 1 : a.weather === 'rain' ? 0.75 : 0.45) : 0,
    blizzard: cold && a.weather === 'storm' ? 1 : cold && a.weather === 'snow' ? ((a.spell ?? 1) % 3 === 0 ? 1 : 0.25) : 0,
    haze: hot && a.season === 'summer' && a.weather === 'clear' ? Math.max(0, 1 - Math.abs(a.hour - 13.5) / 3.5) : 0,
  };
}

interface Bank {
  s: Sprite;
  x: number;
  y: number;
  vx: number;
  w: number;
  h: number;
  phase: number;
}
interface Streak {
  x: number;
  y: number;
  len: number;
  speed: number;
}

export class MapSky {
  /** Over the screen (added to the stage after the map). */
  readonly root = new Container();
  mix: SkyMix = { fog: 0, sand: 0, blizzard: 0, haze: 0 };
  night = false;
  /** For previews: hold the sky at this. */
  force: SkyMix | null = null;
  private shown: SkyMix = { fog: 0, sand: 0, blizzard: 0, haze: 0 };
  private readonly banks: Bank[] = [];
  private readonly fogLayer = new Container();
  private readonly tint = new Graphics();
  private readonly lines = new Graphics();
  private readonly dust: Bank[] = [];
  private readonly dustLayer = new Container();
  private readonly streaks: Streak[] = [];
  private t = 0;

  constructor(private readonly map: MapView) {
    map.over.addChild(this.fogLayer);
    this.root.addChild(this.tint, this.dustLayer, this.lines);
  }

  render(dt: number, w: number, h: number): void {
    this.t += dt;
    const calm = this.map.calm;
    // (each eases in and out over some seconds, so weather comes on and lifts)
    for (const k of ['fog', 'sand', 'blizzard', 'haze'] as const) this.shown[k] = this.force ? this.force[k] : this.shown[k] + (this.mix[k] - this.shown[k]) * Math.min(1, dt * 0.25);
    this.fog(dt, calm);
    const v = this.shown;
    // the screen's cast: ochre in a sandstorm, white in a blizzard, a bright wash in the haze
    const tg = this.tint.clear();
    if (v.fog > 0.02) tg.rect(0, 0, w, h).fill({ color: this.night ? 0x60687a : 0xdfe4ea, alpha: 0.2 * v.fog });
    if (v.sand > 0.02) tg.rect(0, 0, w, h).fill({ color: 0xc8904a, alpha: 0.32 * v.sand });
    if (v.blizzard > 0.02) tg.rect(0, 0, w, h).fill({ color: this.night ? 0x8090a8 : 0xeef4fa, alpha: 0.28 * v.blizzard });
    if (v.haze > 0.02 && !calm)
      for (let i = 0; i < 6; i++) {
        const y = ((i / 6) * h + this.t * 6) % h;
        tg.rect(0, y, w, 10 + 6 * Math.sin(this.t * 2 + i)).fill({ color: 0xfff4d8, alpha: 0.05 * v.haze * (0.6 + 0.4 * Math.sin(this.t * 3.1 + i * 1.7)) });
      }
    // streaks driven across: sand low and quick, snow everywhere and slanting
    const lg = this.lines.clear();
    const want = calm ? 0 : Math.round(140 * v.sand + 180 * v.blizzard);
    while (this.streaks.length < want) this.streaks.push({ x: Math.random() * w, y: Math.random() * h, len: 6 + Math.random() * 22, speed: 500 + Math.random() * 500 });
    this.streaks.length = Math.min(this.streaks.length, want);
    const snowy = v.blizzard >= v.sand;
    const colour = snowy ? 0xffffff : 0xe8c48a;
    for (const s of this.streaks) {
      s.x += s.speed * dt;
      s.y += s.speed * dt * (snowy ? 0.32 : 0.06);
      if (s.x > w + 30 || s.y > h + 10) {
        s.x = -30 - Math.random() * 60;
        s.y = Math.random() * h;
      }
      lg.moveTo(s.x, s.y).lineTo(s.x - s.len, s.y - s.len * (snowy ? 0.32 : 0.06));
    }
    if (this.streaks.length) lg.stroke({ color: colour, width: 1.6, alpha: snowy ? 0.6 : 0.75 });
    // dust clouds tumbling through a sandstorm
    const dustWant = calm ? 0 : Math.round(7 * v.sand);
    while (this.dust.length < dustWant) {
      const s = this.dustLayer.addChild(new Sprite(glowTexture()));
      s.anchor.set(0.5);
      s.tint = 0xb98a50;
      const bw = 220 + Math.random() * 260;
      this.dust.push({ s, x: -bw - Math.random() * w, y: Math.random() * h, vx: 160 + Math.random() * 140, w: bw, h: bw * 0.55, phase: Math.random() * 6 });
    }
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i];
      d.x += d.vx * dt;
      if (d.x > w + d.w) {
        if (this.dust.length > dustWant) {
          d.s.destroy();
          this.dust.splice(i, 1);
          continue;
        }
        d.x = -d.w;
        d.y = Math.random() * h;
      }
      d.s.position.set(d.x, d.y + Math.sin(this.t + d.phase) * 20);
      d.s.width = d.w;
      d.s.height = d.h;
      d.s.alpha = 0.5 * v.sand;
    }
  }

  /** Fog banks on the land, drifting slowly with the breeze. */
  private fog(dt: number, calm: boolean): void {
    const f = this.shown.fog;
    const view = this.map.view;
    const want = f > 0.03 ? (calm ? 6 : 16) : 0;
    while (this.banks.length < want) {
      const s = this.fogLayer.addChild(new Sprite(glowTexture()));
      s.anchor.set(0.5);
      const bw = 260 + Math.random() * 380;
      this.banks.push({ s, x: view.x + Math.random() * view.w, y: view.y + Math.random() * view.h, vx: 6 + Math.random() * 10, w: bw, h: bw * (0.35 + Math.random() * 0.2), phase: Math.random() * 6 });
    }
    for (let i = this.banks.length - 1; i >= 0; i--) {
      const b = this.banks[i];
      if (this.banks.length > want && b.s.alpha < 0.02) {
        b.s.destroy();
        this.banks.splice(i, 1);
        continue;
      }
      b.x += b.vx * dt;
      // (a bank drifted off the view comes round again on the other side)
      if (b.x - b.w / 2 > view.x + view.w + 80) b.x = view.x - b.w / 2 - 40;
      if (b.x + b.w / 2 < view.x - 400) b.x = view.x + Math.random() * view.w;
      if (b.y < view.y - 200 || b.y > view.y + view.h + 200) b.y = view.y + Math.random() * view.h;
      b.s.position.set(b.x, b.y + Math.sin(this.t * 0.2 + b.phase) * 12);
      b.s.width = b.w * (1 + 0.08 * Math.sin(this.t * 0.15 + b.phase));
      b.s.height = b.h;
      b.s.tint = this.night ? 0x7880a0 : 0xe6eaf0;
      b.s.alpha = 0.8 * f * (0.7 + 0.3 * Math.sin(this.t * 0.3 + b.phase));
    }
  }
}
