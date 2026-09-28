// The War Machine boss, drawn in code (no sprite in the packs fits a tank): a 72x72 frame facing right with its
// treads on the bottom row; flip to face left. (The other machines use tiny-rpg-town sprites: see stills.ts.)

import type { Texture } from 'pixi.js';
import type { MachineSprite } from '../../shared/data/enemies';
import { noTone, paint, type Painter } from './pixelArt';

export const MACHINE_FRAME = 32;
/** The giant bosses are drawn on a bigger frame. */
export const BOSS_FRAME = 72;
const BIG: ReadonlySet<string> = new Set(['tank']);
/** Frame size (square) for a machine kind. */
export const machineSize = (kind: MachineSprite['machine']) => (BIG.has(kind) ? BOSS_FRAME : MACHINE_FRAME);
const FRAMES = 4;

const DRAW: Record<MachineSprite['machine'], (p: Painter, f: number) => void> = {
  // ---- giant bosses (72x72, facing right, feet on the bottom row; frame 3 is the attack) ----
  tank: (p, f) => {
    const OLIVE = '#4f5d43';
    const OLIVE_DARK = '#353f2c';
    p.ellipse(36, 70, 30, 2, 'rgba(0,0,0,0.35)');
    // treads
    p.rect(4, 56, 60, 12, '#2a2a2a');
    for (let x = 6 + (f % 2) * 3; x < 62; x += 6) p.rect(x, 58, 3, 8, '#4a4a4a');
    for (const x of [10, 22, 34, 46, 58]) p.ellipse(x, 62, 4, 4, '#1c1c1c');
    // hull and turret
    p.rect(8, 42, 56, 14, OLIVE);
    p.rect(8, 42, 56, 2, '#66784f');
    p.rect(22, 30, 26, 12, OLIVE_DARK);
    p.rect(22, 30, 26, 2, OLIVE);
    p.rect(48, 33, 22, 4, '#2a2a30'); // the barrel
    p.rect(30, 26, 8, 4, OLIVE_DARK); // hatch
    for (let x = 12; x < 60; x += 10) p.px(x, 48, '#8a9a70');
    if (f === 3) {
      p.ellipse(71, 35, 4, 5, '#ffd96e'); // muzzle flash
      p.ellipse(71, 35, 2, 3, '#ffffff');
    }
  },
};

const cache = new Map<string, Texture>();

/** A frame of a machine's idle/move loop (0..3). */
export function machineFrame(kind: MachineSprite['machine'], frame: number): Texture {
  const f = ((frame % FRAMES) + FRAMES) % FRAMES;
  const key = `${kind}:${f}`;
  let t = cache.get(key);
  if (!t) {
    const size = machineSize(kind);
    t = paint(size, size, noTone, (p) => DRAW[kind](p, f)).texture;
    cache.set(key, t);
  }
  return t;
}
