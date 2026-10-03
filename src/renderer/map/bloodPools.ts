// Blood left on the ground where someone fell (the Super Pixel Effects Gigapack's splatter, its last frame as a
// stain): the sim marks it (state.ts `markBlood`, snapshot `blood`); drawn under everything standing, fading as the
// mark ages. Only flesh bleeds (data/enemies.ts `natureOf`: people and beasts; the undead and machines don't).

import { Container, Sprite } from 'pixi.js';
import { natureOf } from '../../shared/data/enemies';
import { bloodPoolTexture, SPLAT_SIZE } from '../art/effects';
import { BLOOD_LASTS } from '../../shared/sim/state';
import type { Snapshot } from '../../shared/sim/snapshot';

interface Pool {
  sprite: Sprite;
}

/** How long a mark lasts, in sim ticks (state.ts BLOOD_LASTS), for the fade. */
const LASTS_TICKS = BLOOD_LASTS;

export class BloodPools {
  private readonly pools = new Map<string, Pool>();

  constructor(private readonly layer: Container) {}

  /** Match the stains to the sim's marks (snapshot.blood): one sprite each, fading as they age. */
  sync(marks: Snapshot['blood']): void {
    const tex = bloodPoolTexture();
    if (!tex) return;
    const seen = new Set<string>();
    for (const m of marks) {
      seen.add(m.key);
      let p = this.pools.get(m.key);
      if (!p) {
        const s = this.layer.addChild(new Sprite(tex));
        s.anchor.set(0.5, 0.5);
        s.position.set(Math.round(m.x + m.from * 3), Math.round(m.y - 2));
        // (flattened on the ground, flung the way the blow went)
        s.scale.set(-m.from * 1.3, 0.7);
        s.tint = 0xc02424; // (darkening as it dries)
        p = { sprite: s };
        this.pools.set(m.key, p);
      }
      p.sprite.alpha = 0.85 * Math.min(1, (LASTS_TICKS - m.age) / (LASTS_TICKS * 0.4));
    }
    for (const [k, p] of this.pools)
      if (!seen.has(k)) {
        p.sprite.destroy();
        this.pools.delete(k);
      }
  }
}

/** Whether a kind of creature bleeds (people and beasts do; the undead and machines don't). */
export function bleeds(kind: string): boolean {
  const n = natureOf(kind);
  return n === 'person' || n === 'beast';
}

export { SPLAT_SIZE };
