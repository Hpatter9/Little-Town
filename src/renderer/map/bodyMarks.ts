// What shows of someone's harm in the town (the owner's ask, after the injury system): a patch over a lost eye, a
// peg, hook, wooden or jointed limb or a bionic one where a part was lost and made good, a crutch for a leg gone and
// not replaced, and a bandage over a bad wound; and a limp in the walk when their legs are hurt. Drawn over the side-on
// LPC sprite in art pixels about the feet (the frame's FEET_Y and CENTRE_X), facing right (the caller mirrors it).

import type { Graphics } from 'pixi.js';
import type { BodyMark } from '../../shared/sim/snapshot';

const WOOD = 0x8a5a2e;
const WOOD_DARK = 0x5a3a1c;
const METAL = 0xa8b0b8;
const METAL_DARK = 0x6a727a;
const BIONIC = 0x5ad8f0;
const CLOTH = 0xf0ece0;
const CLOTH_SHADE = 0xc8c0b0;

/** Where the parts sit on the side-on frame (px from the feet, facing right). */
const AT = {
  eye: { x: 3, y: -36 },
  head: { x: -6, y: -42 },
  hand: { x: 4, y: -19 },
  shoulder: { x: 1, y: -31 },
  knee: { x: 0, y: -10 },
  torso: { x: -4, y: -27 },
};

/** A key for what's drawn (redraw only when it changes). */
export const marksKey = (marks: readonly BodyMark[], dir: number, crutch: number) => marks.map((m) => m.part + m.look).join(',') + (dir < 0 ? 'l' : 'r') + crutch;

/** Draw the marks into `g` (cleared first), in its own coordinates about the feet; `crutch` sways the crutch (0..1). */
export function drawMarks(g: Graphics, marks: readonly BodyMark[], crutch = 0): void {
  g.clear();
  for (const m of marks) {
    const part = m.part;
    if (m.look === 'bandage') {
      if (part === 'head' || part === 'eye_l' || part === 'eye_r') g.rect(AT.head.x, AT.head.y, 11, 2).fill(CLOTH).rect(AT.head.x, AT.head.y + 1, 11, 1).fill(CLOTH_SHADE);
      else if (part === 'torso') g.rect(AT.torso.x, AT.torso.y, 9, 2).fill(CLOTH).rect(AT.torso.x, AT.torso.y + 3, 9, 1).fill(CLOTH_SHADE);
      else if (part.startsWith('arm') || part.startsWith('hand')) g.rect(AT.hand.x - 1, AT.hand.y - 4, 3, 3).fill(CLOTH).rect(AT.hand.x - 1, AT.hand.y - 2, 3, 1).fill(CLOTH_SHADE);
      else g.rect(AT.knee.x - 2, AT.knee.y - 2, 5, 3).fill(CLOTH).rect(AT.knee.x - 2, AT.knee.y, 5, 1).fill(CLOTH_SHADE);
      continue;
    }
    if (part === 'eye_l' || part === 'eye_r') {
      // (only the near eye shows side-on; a patch's strap goes round the head either way)
      if (m.look === 'patch') g.moveTo(AT.head.x, AT.eye.y - 3).lineTo(AT.eye.x + 1, AT.eye.y).stroke({ width: 1, color: 0x1a1410 }).rect(AT.eye.x - 1, AT.eye.y - 1, 3, 3).fill(0x1a1410);
      else if (m.look === 'bionic') g.rect(AT.eye.x, AT.eye.y, 2, 1).fill(BIONIC);
      continue;
    }
    if (part === 'leg_l' || part === 'leg_r') {
      if (m.look === 'gone') {
        // a crutch under the arm, swinging with the step
        const foot = 7 + Math.round(crutch * 3);
        g.moveTo(AT.shoulder.x + 4, AT.shoulder.y + 6).lineTo(foot, 0).stroke({ width: 2, color: WOOD }).rect(AT.shoulder.x + 2, AT.shoulder.y + 5, 5, 2).fill(WOOD_DARK);
      } else if (m.look === 'peg') g.rect(AT.knee.x - 1, AT.knee.y, 3, 10).fill(WOOD).rect(AT.knee.x - 1, AT.knee.y, 1, 10).fill(WOOD_DARK).rect(AT.knee.x - 2, -1, 4, 1).fill(WOOD_DARK);
      else if (m.look === 'metal') g.rect(AT.knee.x - 1, AT.knee.y - 2, 3, 12).fill(METAL).rect(AT.knee.x - 1, AT.knee.y + 2, 3, 1).fill(METAL_DARK);
      else if (m.look === 'bionic') g.rect(AT.knee.x - 1, AT.knee.y - 2, 3, 12).fill(METAL_DARK).rect(AT.knee.x, AT.knee.y - 1, 1, 10).fill(BIONIC);
      continue;
    }
    if (part === 'hand_l' || part === 'hand_r') {
      if (m.look === 'hook') g.moveTo(AT.hand.x, AT.hand.y - 2).lineTo(AT.hand.x + 1, AT.hand.y + 2).lineTo(AT.hand.x + 3, AT.hand.y + 2).lineTo(AT.hand.x + 3, AT.hand.y).stroke({ width: 1, color: METAL });
      else if (m.look === 'metal') g.rect(AT.hand.x - 1, AT.hand.y - 1, 3, 3).fill(METAL);
      else if (m.look === 'bionic') g.rect(AT.hand.x - 1, AT.hand.y - 1, 3, 3).fill(METAL_DARK).rect(AT.hand.x, AT.hand.y, 1, 1).fill(BIONIC);
      continue;
    }
    if (part === 'arm_l' || part === 'arm_r') {
      const colour = m.look === 'wood' ? WOOD : m.look === 'metal' ? METAL : m.look === 'bionic' ? METAL_DARK : null;
      if (colour === null) continue;
      g.moveTo(AT.shoulder.x, AT.shoulder.y).lineTo(AT.hand.x, AT.hand.y).stroke({ width: 2, color: colour });
      if (m.look === 'bionic') g.moveTo(AT.shoulder.x, AT.shoulder.y + 1).lineTo(AT.hand.x, AT.hand.y).stroke({ width: 1, color: BIONIC });
    }
  }
}

/** The hitch in a limping walk (px down, on alternate steps), by how well their legs work (1 sound). */
export function limpDip(moving: number, walked: number): number {
  if (moving >= 0.9) return 0;
  const step = Math.floor(walked / 8) % 2;
  return step ? Math.min(3, Math.round((1 - moving) * 4)) : 0;
}
