// Sun shafts and the dawn haze (the owner's ask): in the golden hours (about 6 to 8 and 17 to 19) in fair weather, soft
// slanted beams of light fall through the woods in view, leaning the way the low sun throws them (map/airRules.ts
// `shaftsStrength`, `shaftSlant`), each fading up and away again in its own time; and at dawn a low haze lies over the
// land, thickest about six and burning off by half past eight (`dawnHaze`). Both are light, so they are drawn here as
// soft gradients (no pack has a sunbeam): the beams added over the land in the map's `over`, the haze laid over it. None
// on a slow phone.

import { Container, Sprite, Texture } from 'pixi.js';
import { CELL, groundAt, type LandMap } from '../../shared/sim/land';
import { glowTexture } from '../town/layer';
import { dawnHaze, shaftSlant, SHAFTS_MOST, shaftsStrength, type Sky } from './airRules';

/** A beam's colour, its size (px) and how bright at its best; the haze's colour, its bands and how thick at its best. */
const BEAM = 0xffdc96;
const BEAM_W = 28;
const BEAM_H = 150;
const BEAM_ALPHA = 0.4;
const HAZE = 0xf2e6d2;
const HAZE_BANDS = 6;
const HAZE_ALPHA = 0.26;

/** A soft beam: bright down its middle, fading at both sides and toward its ends. */
let beamTex: Texture | null = null;
function beamTexture(): Texture {
  if (beamTex) return beamTex;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const g = c.getContext('2d')!;
  const across = g.createLinearGradient(0, 0, 32, 0);
  across.addColorStop(0, 'rgba(255,255,255,0)');
  across.addColorStop(0.5, 'rgba(255,255,255,1)');
  across.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = across;
  g.fillRect(0, 0, 32, 128);
  // (fade the ends: keep only what the down-gradient lets through)
  g.globalCompositeOperation = 'destination-in';
  const down = g.createLinearGradient(0, 0, 0, 128);
  down.addColorStop(0, 'rgba(0,0,0,0)');
  down.addColorStop(0.25, 'rgba(0,0,0,0.9)');
  down.addColorStop(0.7, 'rgba(0,0,0,0.6)');
  down.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = down;
  g.fillRect(0, 0, 32, 128);
  return (beamTex = Texture.from(c));
}

interface Beam {
  s: Sprite;
  x: number;
  y: number;
  age: number;
  life: number;
  w: number;
}
interface Band {
  s: Sprite;
  x: number;
  y: number;
  vx: number;
}

export class MapSunShafts {
  private readonly beamLayer = new Container();
  private readonly hazeLayer = new Container();
  private readonly beams: Beam[] = [];
  private readonly bands: Band[] = [];
  private nextBeam = 0;
  land: LandMap | null = null;
  sky: Sky = { season: 'summer', weather: 'clear', daylight: 1, hour: 12 };
  /** A wet land (the fens, the coast...): a thicker haze. */
  wet = false;
  /** For previews (`window.__shafts`): the golden hour and the dawn haze shown whatever the hour. */
  force = false;

  constructor(over: Container) {
    this.beamLayer.blendMode = 'add';
    over.addChild(this.hazeLayer, this.beamLayer);
  }

  render(dt: number, view: { x: number; y: number; w: number; h: number }, calm: boolean): void {
    const sky = this.force ? { ...this.sky, weather: 'clear', hour: 6.6, daylight: 0.8 } : this.sky;
    const strength = calm || !this.land ? 0 : shaftsStrength(sky);
    const slant = shaftSlant(sky.hour);
    // new beams over the woods in view, till there are enough for the hour
    this.nextBeam -= dt;
    if (strength > 0 && this.beams.length < Math.round(SHAFTS_MOST * strength) && this.nextBeam <= 0 && this.land) {
      this.nextBeam = 0.6 + Math.random() * 1.2;
      for (let tries = 0; tries < 20; tries++) {
        const x = view.x + Math.random() * view.w;
        const y = view.y + Math.random() * view.h;
        const cx = Math.floor(x / CELL);
        const cy = Math.floor(y / CELL);
        if (groundAt(this.land, cx, cy) !== 'forest') continue;
        if (this.beams.some((b) => Math.hypot(b.x - x, b.y - y) < 50)) continue;
        const s = this.beamLayer.addChild(new Sprite(beamTexture()));
        s.anchor.set(0.5, 0);
        s.tint = BEAM;
        s.alpha = 0;
        this.beams.push({ s, x, y: y - BEAM_H * 0.55, age: 0, life: 7 + Math.random() * 7, w: BEAM_W * (0.6 + Math.random() * 0.8) });
        break;
      }
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.age += dt;
      const k = Math.min(1, b.age / 2, (b.life - b.age) / 2.5);
      if (k <= 0 || (!strength && b.age > 0.5 && b.s.alpha <= 0.01)) {
        b.s.destroy();
        this.beams.splice(i, 1);
        continue;
      }
      b.s.alpha = strength ? BEAM_ALPHA * strength * k * (0.85 + 0.15 * Math.sin(b.age * 0.9)) : Math.max(0, b.s.alpha - dt * 0.2);
      b.s.rotation = slant;
      b.s.width = b.w;
      b.s.height = BEAM_H;
      b.s.position.set(Math.round(b.x), Math.round(b.y));
    }
    // the dawn haze: soft long bands lying over the land in view, drifting with the morning air
    const haze = calm ? 0 : dawnHaze(sky, this.wet);
    if (haze > 0 && !this.bands.length)
      for (let i = 0; i < HAZE_BANDS; i++) {
        const s = this.hazeLayer.addChild(new Sprite(glowTexture()));
        s.anchor.set(0.5);
        s.tint = HAZE;
        this.bands.push({ s, x: view.x + Math.random() * view.w, y: view.y + ((i + 0.5) / HAZE_BANDS) * view.h, vx: 4 + Math.random() * 6 });
      }
    for (const band of this.bands) {
      band.x += band.vx * dt;
      // (one drifted off the view comes back in at the other side; the view moved, they follow it)
      if (band.x - view.w * 0.4 > view.x + view.w) band.x = view.x - view.w * 0.3;
      if (band.x + view.w * 0.4 < view.x) band.x = view.x + view.w + view.w * 0.3;
      if (band.y < view.y - view.h * 0.2 || band.y > view.y + view.h * 1.2) band.y = view.y + Math.random() * view.h;
      band.s.position.set(Math.round(band.x), Math.round(band.y));
      band.s.width = view.w * 0.9;
      band.s.height = view.h * 0.32;
      band.s.alpha = Math.max(0, Math.min(HAZE_ALPHA * haze, band.s.alpha + dt * 0.1 * (haze > 0 ? 1 : -2)));
    }
    if (!haze && this.bands.every((b) => b.s.alpha <= 0)) while (this.bands.length) this.bands.pop()!.s.destroy();
  }
}
