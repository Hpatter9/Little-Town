// What the small scenes about town have round them (sim/idleScenes.ts; the people's own poses are map/sceneMoments.ts
// through mapPeople): the Village pack's log for the elder feeding the pigeons and the couple sat by the water to sit
// on, the crumbs the elder throws, the splash a child's jump makes in a puddle (rings and drops), and the busker's
// notes drifting up. Renderer only; none of the moving bits on a slow phone (`calm`).

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { PersonView } from '../../shared/sim/snapshot';
import { loadImage } from '../art/loadImage';
import logUrl from '../art/village/log3.png';
import { splashJump, SPLASH_AIR, SPLASH_EVERY, throwing } from './sceneMoments';

let logTex: Texture | null = null;
loadImage(logUrl)
  .then((im) => {
    logTex = Texture.from(im);
    logTex.source.scaleMode = 'nearest';
  })
  .catch(() => undefined);

/** The log's size under a sitter, and its place below their feet (px). */
const LOG_SCALE = 0.9;
const LOG_DOWN = 4;
/** The notes over a busker: how many at once, how long each takes to drift up (ms), how high (px). */
const NOTES = 3;
const NOTE_RISE = 2200;
const NOTE_HIGH = 34;

interface Shown {
  log?: Sprite;
  fx: Graphics;
}

export class MapScenes {
  /** A slow phone: only the logs. */
  calm = false;
  private readonly shown = new Map<number, Shown>();
  private people: PersonView[] = [];

  constructor(
    private readonly layer: Container,
    /** Where someone stands as drawn now (MapPeople.posOf), or null when they're not on the map. */
    private readonly posOf: (id: number) => { x: number; y: number } | null,
  ) {}

  /** The townsfolk of the last snapshot. */
  sync(people: PersonView[]): void {
    this.people = people;
  }

  /** Those feeding the pigeons now, sat (MapBirds brings the birds down round them). */
  feeders(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (const v of this.people) {
      if (v.pastime?.kind !== 'pigeons' || v.activity !== 'sit' || v.indoors) continue;
      const p = this.posOf(v.id);
      if (p) out.push(p);
    }
    return out;
  }

  /** The busker playing now, if any (for the tune: main.ts). */
  busker(): { x: number; y: number } | null {
    for (const v of this.people) if (v.pastime?.kind === 'busk' && v.activity === 'idle' && !v.indoors) return this.posOf(v.id);
    return null;
  }

  render(now: number): void {
    const seen = new Set<number>();
    for (const v of this.people) {
      const kind = v.pastime?.kind;
      if (!kind || v.indoors || v.away !== null) continue;
      const sitting = (kind === 'pigeons' || kind === 'riverside') && v.activity === 'sit';
      const splashing = kind === 'splash' && v.activity === 'play';
      const busking = kind === 'busk' && v.activity === 'idle';
      if (!sitting && !splashing && !busking) continue;
      const p = this.posOf(v.id);
      if (!p) continue;
      seen.add(v.id);
      let sh = this.shown.get(v.id);
      if (!sh) {
        sh = { fx: this.layer.addChild(new Graphics()) };
        this.shown.set(v.id, sh);
      }
      // the log sat on, under the sitter
      if (sitting && logTex) {
        if (!sh.log) {
          sh.log = this.layer.addChild(new Sprite(logTex));
          sh.log.anchor.set(0.5, 1);
          sh.log.scale.set(LOG_SCALE);
        }
        sh.log.visible = true;
        sh.log.position.set(Math.round(p.x), Math.round(p.y - LOG_DOWN));
        sh.log.zIndex = p.y - 1;
      } else if (sh.log) sh.log.visible = false;
      const g = sh.fx.clear();
      g.position.set(Math.round(p.x), Math.round(p.y));
      g.zIndex = p.y + 0.4;
      if (this.calm) continue;
      if (sitting && kind === 'pigeons') {
        // (a handful of crumbs arcing out before them and scattering)
        const th = throwing(v.id, now);
        if (th !== null)
          for (let i = 0; i < 5; i++) {
            const a = th * (0.6 + i * 0.12);
            g.circle(6 + a * (10 + i * 4), -14 + a * 18 - Math.sin(a * Math.PI) * 10 + i, 0.9).fill({ color: 0xe8d8a0, alpha: 1 - th * 0.5 });
          }
      } else if (splashing) {
        // (rings spreading where they land, and drops thrown up)
        const t = (now + v.id * 377) % SPLASH_EVERY;
        const j = splashJump(v.id, now);
        if (t >= SPLASH_AIR) {
          const k = (t - SPLASH_AIR) / (SPLASH_EVERY - SPLASH_AIR);
          g.ellipse(0, 0, 5 + k * 12, 2 + k * 4).stroke({ color: 0xc8e0f0, width: 1, alpha: 0.75 * (1 - k) });
          if (k < 0.35)
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2 + v.id;
              g.circle(Math.cos(a) * (4 + k * 16), -Math.sin(k * Math.PI * 2.6) * 6 - 1 + Math.sin(a) * 2, 1).fill({ color: 0xe0f0ff, alpha: 0.9 - k * 2 });
            }
        } else g.ellipse(0, 0, 6, 2).fill({ color: 0x6a8aa0, alpha: 0.25 + j.lift * 0.02 });
      } else if (busking) {
        // (notes drifting up and off to one side, fading)
        for (let i = 0; i < NOTES; i++) {
          const k = ((now + v.id * 500 + (i * NOTE_RISE) / NOTES) % NOTE_RISE) / NOTE_RISE;
          const x = 8 + Math.sin(k * 5 + i) * 5 + k * 6;
          const y = -44 - k * NOTE_HIGH;
          const c = [0xfff0a0, 0xffd0f0, 0xc0f0ff][i % 3];
          g.circle(x, y, 1.6).fill({ color: c, alpha: 1 - k });
          g.moveTo(x + 1.4, y).lineTo(x + 1.4, y - 5).stroke({ color: c, width: 1, alpha: 1 - k });
        }
      }
    }
    for (const [id, sh] of this.shown) {
      if (seen.has(id)) continue;
      sh.log?.destroy();
      sh.fx.destroy();
      this.shown.delete(id);
    }
  }
}
