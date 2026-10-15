// Eyes in the dark, and wisps over the graves (the owner's ask). At night pairs of glowing eyes watch from the forest's
// edge and the fog's edge in view, blinking now and then, more in winter and on blighted land, and gone the moment
// anyone comes near (map/airRules.ts `eyesWanted`, `forestEdge`, `eyeColour`, `blinking`); a pair stays a while and
// fades, and another opens somewhere else. Over a graveyard after dark a few wisps drift and bob, more in a town of the
// dead (`wispsWanted`): the 5000 Pixel Effects pack's moon orb (its forest orb on blighted land), with a soft glow. The
// eyes are two specks of light, as eyes in the dark are; all of it goes in the map's lights layer, so it shows only
// after dusk. None on a slow phone.

import { Container, Sprite, Texture } from 'pixi.js';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import type { Building } from '../../shared/sim/state';
import { footprint } from '../../shared/sim/buildings';
import { CELL, type LandMap } from '../../shared/sim/land';
import { pixelFxFrame, pixelFxFrames } from '../art/effects';
import { glowTexture } from '../town/layer';
import { blinking, eyeColour, EYES_SHY, eyesWanted, forestEdge, wispsWanted, type Sky } from './airRules';
import { visibility } from './groundArt';

interface Eyes {
  root: Container;
  x: number;
  y: number;
  age: number;
  life: number;
  phase: number;
  /** Fading out (someone came near, or its time is up). */
  going: boolean;
}
interface Wisp {
  orb: Sprite;
  glow: Sprite;
  home: { x: number; y: number; w: number; h: number };
  t: number;
  phase: number;
}

export class MapEyes {
  private readonly layer = new Container();
  private readonly eyes: Eyes[] = [];
  private readonly wisps: Wisp[] = [];
  private nextTry = 0;
  private t = 0;
  land: LandMap | null = null;
  sky: Sky = { season: 'summer', weather: 'clear', daylight: 1, hour: 12 };
  blighted = false;
  /** A town of the dead (the liches, the Blood Court): more wisps. */
  undead = false;
  /** Everyone about (world px): eyes close and are gone when someone comes near. */
  folk: { x: number; y: number }[] = [];
  private graves: { x: number; y: number; w: number; h: number }[] = [];

  constructor(lights: Container) {
    lights.addChild(this.layer);
  }

  /** Each snapshot: the graveyards standing. */
  syncGraves(buildings: readonly Building[]): void {
    this.graves = buildings
      .filter((b) => b.status === 'done' && b.def === 'graveyard' && BUILDING_BY_ID[b.def])
      .map((b) => {
        const f = footprint(b);
        return { x: f.x * CELL, y: f.y * CELL, w: f.w * CELL, h: f.h * CELL };
      });
  }

  render(dt: number, view: { x: number; y: number; w: number; h: number }, calm: boolean): void {
    this.t += dt;
    const sky = this.sky;
    const want = calm || !this.land ? 0 : eyesWanted(sky, this.blighted);
    this.layer.visible = !calm;
    // new eyes open where the wood meets the open ground, or at the fog's edge, somewhere in view and away from people
    this.nextTry -= dt;
    if (this.eyes.filter((e) => !e.going).length < want && this.nextTry <= 0 && this.land) {
      this.nextTry = 0.7 + Math.random() * 1.6;
      const land = this.land;
      for (let tries = 0; tries < 24; tries++) {
        const x = view.x + Math.random() * view.w;
        const y = view.y + Math.random() * view.h;
        const cx = Math.floor(x / CELL);
        const cy = Math.floor(y / CELL);
        if (cx < 0 || cy < 0 || cx >= land.w || cy >= land.h) continue;
        const fog = visibility(land, cx, cy) === 1;
        if (!fog && !forestEdge(land, cx, cy)) continue;
        if (this.folk.some((p) => Math.hypot(p.x - x, p.y - y) < EYES_SHY * 1.4)) continue;
        if (this.eyes.some((e) => Math.hypot(e.x - x, e.y - y) < 60)) continue;
        this.eyes.push(this.openEyes(x, y, Math.floor(Math.random() * 1000)));
        break;
      }
    }
    for (let i = this.eyes.length - 1; i >= 0; i--) {
      const e = this.eyes[i];
      e.age += dt;
      if (!e.going && (e.age > e.life || !want || this.folk.some((p) => Math.hypot(p.x - e.x, p.y - e.y) < EYES_SHY))) e.going = true;
      const fadeIn = Math.min(1, e.age / 0.8);
      e.root.alpha = e.going ? e.root.alpha - dt * 3 : fadeIn;
      if (e.going && e.root.alpha <= 0) {
        e.root.destroy({ children: true });
        this.eyes.splice(i, 1);
        continue;
      }
      // (a blink: the pair shut a moment; and they glance about now and then)
      e.root.scale.y = blinking(this.t, e.phase) ? 0.15 : 1;
      e.root.position.set(Math.round(e.x + Math.round(Math.sin(this.t * 0.4 + e.phase) * 1.2)), Math.round(e.y));
    }
    this.renderWisps(dt, view, sky, calm);
  }

  private openEyes(x: number, y: number, key: number): Eyes {
    const root = this.layer.addChild(new Container());
    const colour = eyeColour(this.blighted, key);
    const apart = 6 + (key % 3) * 1.5;
    for (const side of [-1, 1]) {
      const g = root.addChild(new Sprite(glowTexture()));
      g.anchor.set(0.5);
      g.tint = colour;
      g.width = g.height = 18;
      g.alpha = 0.6;
      g.position.set((side * apart) / 2, 0);
      const pupil = root.addChild(new Sprite(Texture.WHITE));
      pupil.anchor.set(0.5);
      pupil.tint = colour;
      pupil.width = 3;
      pupil.height = 2.4;
      pupil.position.set((side * apart) / 2, 0);
    }
    root.alpha = 0;
    return { root, x, y, age: 0, life: 7 + Math.random() * 9, phase: Math.random() * 5, going: false };
  }

  private renderWisps(dt: number, view: { x: number; y: number; w: number; h: number }, sky: Sky, calm: boolean): void {
    const n = calm ? 0 : wispsWanted(sky.daylight, this.graves.length, this.undead);
    while (this.wisps.length > n) {
      const w = this.wisps.pop()!;
      w.orb.destroy();
      w.glow.destroy();
    }
    while (this.wisps.length < n) {
      const home = this.graves[this.wisps.length % this.graves.length];
      const glow = this.layer.addChild(new Sprite(glowTexture()));
      glow.anchor.set(0.5);
      glow.tint = this.blighted ? 0x7cff9a : 0x9ad8ff;
      const orb = this.layer.addChild(new Sprite());
      orb.anchor.set(0.5);
      this.wisps.push({ orb, glow, home, t: Math.random() * 20, phase: Math.random() * 6.28 });
    }
    const strip = this.blighted ? 'forest-orb' : 'moon-orb';
    const frames = pixelFxFrames(strip);
    for (const w of this.wisps) {
      w.t += dt;
      // (a slow loop over the graves, bobbing, now and then darting a little)
      const x = w.home.x + w.home.w * (0.5 + 0.42 * Math.sin(w.t * 0.23 + w.phase) + 0.08 * Math.sin(w.t * 1.7 + w.phase));
      const y = w.home.y + w.home.h * (0.5 + 0.35 * Math.cos(w.t * 0.31 + w.phase * 1.3)) - 10 - 4 * Math.sin(w.t * 2.1 + w.phase);
      const seen = x > view.x - 40 && x < view.x + view.w + 40 && y > view.y - 40 && y < view.y + view.h + 40;
      const pulse = 0.7 + 0.3 * Math.sin(w.t * 3 + w.phase);
      w.glow.visible = seen;
      w.glow.position.set(Math.round(x), Math.round(y));
      w.glow.width = w.glow.height = 46 * pulse;
      w.glow.alpha = 0.55 * pulse;
      const tex = frames ? pixelFxFrame(strip, Math.floor((w.t * 8) % frames)) : null;
      w.orb.visible = seen && !!tex;
      if (tex) w.orb.texture = tex;
      w.orb.position.set(Math.round(x), Math.round(y));
      w.orb.scale.set(0.75);
      w.orb.alpha = 0.85 * pulse;
    }
  }
}
