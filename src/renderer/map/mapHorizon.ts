// The other settlements past the fog, and a host on its way (the owner's ask: the wider world felt from home). Each
// power of the realm lies some way off on the world map, and from the town you see which way: at night its campfires
// flicker at the edge of the fog in that direction (more and brighter the bigger its town: map/horizonRules.ts
// `campfiresOf`), by day thin columns of smoke rise there on the horizon, taller as it grows (`smokesOf`); a razed one
// shows nothing. A war host marching on the town is a line of torches at the fog's edge on its side, starting far out
// and drawing in as it comes (`hostTorches`). The flames are the 5000 Pixel Effects pack's (its fire flame strip), the
// smoke its white smoke, greyed; their glows go in the map's lights layer, which shows only after dusk. None on a slow
// phone but the glows.

import { Container, Sprite } from 'pixi.js';
import { CELL, type LandMap } from '../../shared/sim/land';
import { pixelFxFrame, pixelFxFrames } from '../art/effects';
import { glowTexture } from '../town/layer';
import { flicker } from './flicker';
import { campfiresOf, hostTorches, settlementsSeen, smokesOf, type SettlementIn } from './horizonRules';

/** The most smoke puffs on the horizon at once, how fast they climb (px a second), and their greys. */
const PUFFS_MOST = 140;
const CLIMB = 16;
const GREYS = [0xd0ccc4, 0xbcb8b0, 0xdcd8d0];
/** How big a far fire's flame is drawn (the 32px strip shrunk), and a torch's. */
const FIRE_K = 0.45;
const TORCH_K = 0.42;

interface Hearth {
  key: string;
  x: number;
  y: number;
  strength: number;
  phase: number;
  glow: Sprite;
  flame: Sprite;
}
interface Column {
  key: string;
  x: number;
  y: number;
  height: number;
  due: number;
}
interface Puff {
  s: Sprite;
  x: number;
  y: number;
  top: number;
  age: number;
  life: number;
  frame: number;
}

export class MapHorizon {
  private readonly smokeLayer = new Container();
  private readonly flameLayer = new Container();
  private readonly glowLayer = new Container();
  private hearths = new Map<string, Hearth>();
  private columns: Column[] = [];
  private readonly puffs: Puff[] = [];
  private readonly spare: Sprite[] = [];
  private t = 0;
  /** For previews (`window.__horizon`): a host forced on a bearing, and its hours away. */
  force: { bearing: number; hours: number; size: number } | null = null;

  constructor(over: Container, lights: Container) {
    over.addChild(this.smokeLayer, this.flameLayer);
    lights.addChild(this.glowLayer);
  }

  /** Each snapshot: the powers (their towns and their hosts) and the land, whose fog's edge they show at. */
  sync(land: LandMap, factions: readonly (SettlementIn & { host: { hours: number; size: number } | null })[]): void {
    const want = new Map<string, { x: number; y: number; strength: number; phase: number; torch: boolean }>();
    const columns: Column[] = [];
    for (const f of settlementsSeen(factions)) {
      campfiresOf(f.id, f.tier, f.bearing, land).forEach((p, i) => want.set(`f:${f.id}:${i}`, { x: p.x * CELL, y: p.y * CELL, strength: p.strength, phase: p.phase, torch: false }));
      smokesOf(f.id, f.tier, f.folk, f.bearing, land).forEach((p, i) => columns.push({ key: `s:${f.id}:${i}`, x: p.x * CELL, y: p.y * CELL, height: p.height, due: 0 }));
      if (f.host)
        hostTorches(f.id, f.bearing, f.host.hours, f.host.size, land).forEach((p, i) => want.set(`t:${f.id}:${i}`, { x: p.x * CELL, y: p.y * CELL, strength: 0.8, phase: i * 1.7, torch: true }));
    }
    if (this.force)
      hostTorches('preview', this.force.bearing, this.force.hours, this.force.size, land).forEach((p, i) => want.set(`t:preview:${i}`, { x: p.x * CELL, y: p.y * CELL, strength: 0.8, phase: i * 1.7, torch: true }));
    for (const [k, h] of this.hearths)
      if (!want.has(k)) {
        h.glow.destroy();
        h.flame.destroy();
        this.hearths.delete(k);
      }
    for (const [k, w] of want) {
      let h = this.hearths.get(k);
      if (!h) {
        const glow = this.glowLayer.addChild(new Sprite(glowTexture()));
        glow.anchor.set(0.5);
        glow.tint = w.torch ? 0xffa040 : 0xff9a3a;
        const flame = this.flameLayer.addChild(new Sprite());
        flame.anchor.set(0.5, 0.85);
        flame.scale.set(w.torch ? TORCH_K : FIRE_K);
        h = { key: k, x: w.x, y: w.y, strength: w.strength, phase: w.phase, glow, flame };
        this.hearths.set(k, h);
      }
      // (a host's torches march in: eased toward where the line is now)
      h.x = h.x + (w.x - h.x) * (k.startsWith('t:') ? 0.2 : 1);
      h.y = h.y + (w.y - h.y) * (k.startsWith('t:') ? 0.2 : 1);
      h.strength = w.strength;
    }
    // (keep each column's timing where it still stands)
    this.columns = columns.map((c) => ({ ...c, due: this.columns.find((o) => o.key === c.key)?.due ?? Math.random() }));
  }

  /** A frame: the fires and torches flicker, the smoke climbs; only what's in view is drawn. `night` is the lights'
   *  fade (0 by day, 1 after dusk), `day` the daylight. */
  render(dt: number, view: { x: number; y: number; w: number; h: number }, night: number, day: number, wind: number, calm: boolean): void {
    this.t += dt;
    const near = (x: number, y: number, pad: number) => x > view.x - pad && x < view.x + view.w + pad && y > view.y - pad && y < view.y + view.h + pad;
    const flames = pixelFxFrames('fire-flame');
    for (const h of this.hearths.values()) {
      const seen = near(h.x, h.y, 80);
      const torch = h.key.startsWith('t:');
      const k = flicker(torch ? 'torch' : 'campfire', this.t, h.phase);
      h.glow.visible = seen;
      if (seen) {
        h.glow.position.set(Math.round(h.x), Math.round(h.y - 4));
        h.glow.width = h.glow.height = (torch ? 44 : 44 + 52 * h.strength) * (0.9 + 0.1 * k);
        h.glow.alpha = (torch ? 0.85 : 0.5 + 0.5 * h.strength) * k;
      }
      // (the flames themselves: a far camp's only after dark, a host's torches always: they march by day too)
      const tex = flames && !calm ? pixelFxFrame('fire-flame', Math.floor((this.t * 10 + h.phase * 3) % flames)) : null;
      h.flame.visible = seen && !!tex && (torch || night > 0.2);
      if (h.flame.visible) {
        h.flame.texture = tex!;
        // (a host's torches bob as they march)
        const bob = torch ? Math.round(Math.abs(Math.sin(this.t * 4 + h.phase)) * 2) : 0;
        h.flame.position.set(Math.round(h.x), Math.round(h.y - bob));
        h.flame.alpha = torch ? 1 : Math.min(1, night * 1.4) * (0.6 + 0.4 * h.strength);
      }
    }
    // the far towns' smoke by day: puffs climbing their columns, leaning with the wind, thinning at the top
    const daySmoke = calm ? 0 : Math.max(0, Math.min(1, (day - 0.3) / 0.3));
    const every = 0.4;
    for (const c of this.columns) {
      c.due -= dt;
      if (c.due > 0) continue;
      c.due += every * (0.7 + Math.random() * 0.6);
      if (!daySmoke || this.puffs.length >= PUFFS_MOST || !near(c.x, c.y - c.height / 2, c.height)) continue;
      const s = this.spare.pop() ?? this.smokeLayer.addChild(new Sprite(glowTexture()));
      s.anchor.set(0.5);
      s.visible = true;
      s.tint = GREYS[Math.floor(Math.random() * GREYS.length)];
      s.texture = pixelFxFrame('white-smoke', 0) ?? glowTexture();
      this.puffs.push({ s, x: c.x + (Math.random() - 0.5) * 6, y: c.y, top: c.y - c.height, age: 0, life: c.height / CLIMB, frame: Math.floor(Math.random() * 2) });
    }
    const frames = pixelFxFrames('white-smoke');
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
      p.x += wind * 8 * k * dt;
      p.y -= CLIMB * dt;
      const tex = frames ? pixelFxFrame('white-smoke', Math.min(frames - 1, p.frame + Math.floor(k * 3))) : null;
      if (tex && p.s.texture !== tex) p.s.texture = tex;
      p.s.width = p.s.height = 14 + 34 * k;
      p.s.position.set(Math.round(p.x), Math.round(p.y));
      p.s.alpha = 0.75 * daySmoke * Math.min(1, k * 5) * (1 - k * k);
    }
  }
}
