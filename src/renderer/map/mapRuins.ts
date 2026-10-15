// Ruins lying where buildings fell (sim/ruins.ts), drawn on the map from the packs until they're cleared. A burnt
// building is a blackened shell: the lower half of its own picture, the top broken off along a jagged line and charred
// (the soot darkest at the top), its charred beams (the Fields pack's logs, darkened) leaning and lying about it, on a
// scorched patch. One brought down by a disaster is the lower third of it, dusty and grey, with its beams and a heap of
// the Fields pack's stones; one pulled down is its foundation: a course of the stones round its footprint on bared
// earth. They fade out in their last hours. Pieces by the ruin's id, so a ruin is drawn the same every time.

import { Container, CanvasSource, Sprite, Texture } from 'pixi.js';
import { CELL } from '../../shared/sim/land';
import { RUIN_HOURS } from '../../shared/data/memorials';
import type { RuinView } from '../../shared/sim/ruins';
import type { PixelArt } from '../art/pixelArt';
import { choresTex, type ChoresArt } from '../art/choresArt';
import { glowTexture } from '../town/layer';

/** How much of the building's height still stands, by how it fell. */
const KEEP = { burnt: 0.5, felled: 0.3, pulled: 0.16 } as const;
/** The ground under each (a tint on the soft patch, and how dark). */
const PATCH = { burnt: [0x16120e, 0.75], felled: [0x5a4a38, 0.5], pulled: [0x6a5640, 0.5] } as const;
/** Beams about it (charred or weathered), and their tint. */
const BEAMS = { burnt: [3, 0x3a2c24], felled: [2, 0xa89880], pulled: [0, 0] } as const;
/** The last hours, over which a ruin fades away. */
const FADE_HOURS = 6;

interface Drawn {
  key: string;
  patch: Sprite;
  pieces: Sprite[];
  ruin: RuinView;
}

const h01 = (id: number, salt: number) => {
  let h = (id * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

export class MapRuins {
  private readonly drawn = new Map<number, Drawn>();
  private ready = false;

  /** `art`: a building's picture as the map draws it (MapView.artFor), for the shell. */
  constructor(
    private readonly under: Container,
    private readonly things: Container,
    private readonly art: (def: string, id: number) => PixelArt | null,
  ) {
    choresTex(() => {
      this.ready = true;
      for (const d of this.drawn.values()) d.key = ''; // (drawn again with the stones)
    });
  }

  /** The ruins now (per snapshot): drawn, faded, cleared. */
  sync(ruins: readonly RuinView[]): void {
    const seen = new Set<number>();
    for (const r of ruins) {
      seen.add(r.id);
      const key = `${r.tick}|${r.kind}|${this.ready ? 1 : 0}`;
      let d = this.drawn.get(r.id);
      if (d && d.key !== key) {
        this.destroy(d);
        d = undefined;
      }
      if (!d) {
        d = this.draw(r, key);
        this.drawn.set(r.id, d);
      }
      d.ruin = r;
      const left = RUIN_HOURS[r.kind] - r.hours;
      const a = Math.max(0, Math.min(1, left / FADE_HOURS));
      if (Math.abs(d.patch.alpha / (PATCH[r.kind][1] as number) - a) > 0.02) {
        d.patch.alpha = (PATCH[r.kind][1] as number) * a;
        for (const p of d.pieces) p.alpha = a;
      }
    }
    for (const [id, d] of this.drawn)
      if (!seen.has(id)) {
        this.destroy(d);
        this.drawn.delete(id);
      }
  }

  /** The ruin under a world point, if any. */
  ruinAt(wx: number, wy: number): RuinView | null {
    for (const d of this.drawn.values()) {
      const r = d.ruin;
      if (wx >= r.x * CELL - 4 && wx < (r.x + r.w) * CELL + 4 && wy >= r.y * CELL - 8 && wy < (r.y + r.h) * CELL + 4) return r;
    }
    return null;
  }

  private destroy(d: Drawn): void {
    d.patch.destroy();
    for (const p of d.pieces) p.destroy();
  }

  private draw(r: RuinView, key: string): Drawn {
    const cx = (r.x + r.w / 2) * CELL;
    const bottom = (r.y + r.h) * CELL - 2;
    const [tint] = PATCH[r.kind];
    const patch = this.under.addChild(new Sprite(glowTexture()));
    patch.anchor.set(0.5);
    patch.tint = tint;
    patch.width = r.w * CELL * 1.3;
    patch.height = r.h * CELL * 1.15;
    patch.position.set(Math.round(cx), Math.round((r.y + r.h / 2) * CELL));
    const pieces: Sprite[] = [];
    const put = (t: Texture, x: number, y: number, ax = 0.5, ay = 0.85) => {
      const s = this.things.addChild(new Sprite(t));
      s.anchor.set(ax, ay);
      s.position.set(Math.round(x), Math.round(y));
      s.zIndex = y;
      pieces.push(s);
      return s;
    };
    // the shell of what stood (none for a foundation)
    const art = r.kind === 'pulled' ? null : this.art(r.def, r.id);
    const shell = art ? shellOf(art, r.kind, r.id) : null;
    if (shell) put(shell, cx, bottom, 0.5, 1);
    const tex = choresTex();
    if (this.ready) {
      // the stones: round the footprint's edge for a foundation, heaped about for the rest
      const n = Math.round(r.w * r.h * (r.kind === 'pulled' ? 2.2 : r.kind === 'felled' ? 2.6 : 1.2)) + 2;
      for (let i = 0; i < n; i++) {
        const t = tex[`rubble${1 + Math.floor(h01(r.id, i * 3) * 4)}` as ChoresArt];
        if (!t) continue;
        let x: number, y: number;
        if (r.kind === 'pulled') {
          // (along the edge, walked round the footprint)
          const per = 2 * (r.w + r.h);
          const at = ((i + h01(r.id, i * 3 + 1) * 0.6) / n) * per;
          const e = at < r.w ? [at, 0] : at < r.w + r.h ? [r.w, at - r.w] : at < 2 * r.w + r.h ? [2 * r.w + r.h - at, r.h] : [0, per - at];
          x = (r.x + e[0]) * CELL + (h01(r.id, i * 3 + 2) - 0.5) * 6;
          y = (r.y + e[1]) * CELL + 4 + (h01(r.id, i * 3 + 2) - 0.5) * 6;
        } else {
          x = (r.x + 0.15 + h01(r.id, i * 3 + 1) * (r.w - 0.3)) * CELL;
          y = (r.y + r.h * 0.45 + h01(r.id, i * 3 + 2) * r.h * 0.6) * CELL;
        }
        const s = put(t, x, y);
        if (r.kind === 'burnt') s.tint = 0x6a6058;
      }
      // the beams: leaning against the shell and lying across the ground
      const [beams, beamTint] = BEAMS[r.kind];
      for (let i = 0; i < beams; i++) {
        const t = tex[(['log1', 'log3', 'log4'] as ChoresArt[])[Math.floor(h01(r.id, 90 + i) * 3)]];
        if (!t) continue;
        const x = (r.x + 0.2 + h01(r.id, 100 + i) * (r.w - 0.4)) * CELL;
        const y = bottom - 2 + h01(r.id, 110 + i) * 6;
        const s = put(t, x, y, 0.5, 0.9);
        s.tint = beamTint;
        s.rotation = (h01(r.id, 120 + i) - 0.5) * 1.6;
      }
    }
    return { key, patch, pieces, ruin: r };
  }
}

/** What's left standing of a building's picture: its lower part, broken off along a jagged top, charred (burnt) or
 *  greyed with dust (brought down). */
const shells = new Map<string, Texture>();
function shellOf(art: PixelArt, kind: keyof typeof KEEP, id: number): Texture | null {
  const key = `${art.texture.uid}|${kind}|${id % 7}`;
  const had = shells.get(key);
  if (had) return had;
  const res = art.texture.source.resource as (HTMLCanvasElement | HTMLImageElement) & { width: number; height: number };
  if (!res || !res.width) return null;
  const k = res.width / art.width;
  const keepH = Math.max(4, Math.round(art.height * KEEP[kind]));
  const c = document.createElement('canvas');
  c.width = res.width;
  c.height = Math.round(keepH * k);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(res, 0, res.height - c.height, res.width, c.height, 0, 0, c.width, c.height);
  const im = g.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  // (the top broken off: each art column cut down a step or more, the line wandering)
  const cut: number[] = [];
  let depth = 0;
  for (let x = 0; x < art.width; x++) {
    if (x % 3 === 0) depth = Math.floor(h01(id, 200 + x) * keepH * 0.45);
    cut.push(depth);
  }
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (!d[i + 3]) continue;
      const ax = Math.floor(x / k);
      const ay = y / k;
      if (ay < cut[ax]) {
        d[i + 3] = 0;
        continue;
      }
      const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      if (kind === 'burnt') {
        // (charred: near black, the soot thickest at the broken top, a little of the stone's grey showing low down)
        const up = 1 - Math.min(1, (ay - cut[ax]) / (keepH * 0.7));
        const v = lum * (0.32 - up * 0.18);
        d[i] = v + 10;
        d[i + 1] = v + 6;
        d[i + 2] = v + 4;
      } else {
        const v = lum * 0.7 + 40;
        d[i] = v * 1.02;
        d[i + 1] = v * 0.97;
        d[i + 2] = v * 0.9;
      }
    }
  g.putImageData(im, 0, 0);
  const tex = new Texture({ source: new CanvasSource({ resource: c, resolution: k }) });
  shells.set(key, tex);
  return tex;
}
