// The animals in the pens (sim/livestock.ts), drawn in code: two walking frames and a grazing frame each, facing
// right (left is a mirrored sprite). A few coats per kind, so a herd isn't all alike.

import type { HerdDef } from '../../shared/data/livestock';
import { paint, type Painter, type PixelArt, type Tone } from './pixelArt';

export type AnimalFrames = { walk: [PixelArt, PixelArt]; graze: PixelArt };

type Look = HerdDef['look'];
type Coat = { body: string; shade: string; light: string; head: string; legs: string; spot?: string };

const COATS: Record<Look, Coat[]> = {
  hen: [
    { body: '#f4f0e4', shade: '#cfc8b8', light: '#ffffff', head: '#d83a2a', legs: '#e0a030' },
    { body: '#a8683a', shade: '#7a4a28', light: '#c8884a', head: '#d83a2a', legs: '#e0a030' },
    { body: '#3a3430', shade: '#221e1c', light: '#5a524a', head: '#d83a2a', legs: '#c89030' },
  ],
  goat: [
    { body: '#f0ece4', shade: '#c8c0b4', light: '#ffffff', head: '#e8e0d4', legs: '#b0a898' },
    { body: '#8a5a38', shade: '#5e3c24', light: '#a8744a', head: '#6a4428', legs: '#4a3020' },
    { body: '#3a3230', shade: '#221c1a', light: '#54483f', head: '#2a2422', legs: '#1a1614', spot: '#e8e0d4' },
  ],
  sheep: [
    { body: '#ece6d8', shade: '#c8bea8', light: '#fbf8f0', head: '#2a2420', legs: '#2a2420' },
    { body: '#d8ccb4', shade: '#b0a488', light: '#ece2cc', head: '#f0e8dc', legs: '#6a5a48' },
    { body: '#4a403a', shade: '#322a26', light: '#625650', head: '#2a2420', legs: '#2a2420' },
  ],
  pig: [
    { body: '#e8a8a0', shade: '#c88078', light: '#f8c8c0', head: '#e8a8a0', legs: '#c88078' },
    { body: '#e8a8a0', shade: '#c88078', light: '#f8c8c0', head: '#e8a8a0', legs: '#c88078', spot: '#3a3030' },
    { body: '#6a4a3a', shade: '#4a3228', light: '#8a6450', head: '#6a4a3a', legs: '#3a2820' },
  ],
  cow: [
    { body: '#f4f0e8', shade: '#cfc8bc', light: '#ffffff', head: '#f4f0e8', legs: '#cfc8bc', spot: '#2a2424' },
    { body: '#8a4a2a', shade: '#5e321c', light: '#a86038', head: '#8a4a2a', legs: '#5e321c', spot: '#f0e8dc' },
    { body: '#a86a3a', shade: '#7a4a28', light: '#c8884a', head: '#a86a3a', legs: '#6a4028' },
  ],
};

/** Size of each kind's frame (width, height). */
const SIZE: Record<Look, [number, number]> = { hen: [9, 9], goat: [16, 14], sheep: [16, 13], pig: [16, 11], cow: [22, 17] };

/** Draw one animal: `step` moves the legs (0 or 1), `graze` puts the head down. */
function drawAnimal(p: Painter, look: Look, c: Coat, step: 0 | 1, graze: boolean): void {
  const h = SIZE[look][1];
  const leg = (x: number, forward: boolean, len: number) => p.rect(x + (step === 1 ? (forward ? 1 : -1) : 0), h - len, 1, len, c.legs);
  switch (look) {
    case 'hen': {
      leg(3, true, 2);
      leg(5, false, 2);
      p.ellipse(4, h - 5, 3.5, 2.5, c.shade);
      p.ellipse(4, h - 6, 3, 2, c.body);
      p.rect(1, h - 7, 2, 1, c.light); // tail
      p.rect(0, h - 8, 2, 1, c.body);
      const hy = graze ? h - 4 : h - 8;
      p.rect(6, hy, 2, 2, c.body); // head
      p.px(7, hy - 1, c.head); // comb
      p.px(8, hy + 1, '#e0a030'); // beak
      p.px(7, hy, '#1a1a1a');
      break;
    }
    case 'goat':
    case 'sheep': {
      const sheep = look === 'sheep';
      for (const [x, fwd] of [[3, true], [5, false], [10, true], [12, false]] as [number, boolean][]) leg(x, fwd, 4);
      p.ellipse(7.5, h - 7, 6.5, sheep ? 4 : 3.2, c.shade);
      p.ellipse(7, h - 8, 6, sheep ? 3.6 : 2.8, c.body);
      if (sheep) for (const [x, y] of [[3, h - 10], [6, h - 11], [9, h - 10], [11, h - 9], [5, h - 8], [8, h - 8]]) p.rect(x, y, 2, 1, c.light);
      else {
        p.rect(3, h - 10, 7, 1, c.light);
        if (c.spot) p.rect(5, h - 8, 3, 2, c.spot);
        p.rect(1, h - 10, 1, 2, c.body); // a flicked tail
      }
      const hx = 12;
      const hy = graze ? h - 5 : h - 12;
      p.rect(hx, hy, 3, 4, c.head);
      p.rect(hx + 3, hy + 1, 1, 2, c.head);
      p.px(hx + 2, hy + 1, '#1a1a1a');
      if (!sheep) {
        p.rect(hx, hy - 2, 1, 2, '#8a8070'); // horns
        p.px(hx + 1, hy + 4, c.shade); // beard
      } else p.px(hx - 1, hy, c.body);
      break;
    }
    case 'pig': {
      for (const [x, fwd] of [[4, true], [6, false], [10, true], [12, false]] as [number, boolean][]) leg(x, fwd, 3);
      p.ellipse(8, h - 6, 7, 3.6, c.shade);
      p.ellipse(7.5, h - 7, 6.5, 3.2, c.body);
      p.rect(3, h - 9, 8, 1, c.light);
      if (c.spot) p.ellipse(6, h - 6, 2, 1.5, c.spot);
      p.px(1, h - 8, c.shade); // curly tail
      p.px(0, h - 9, c.shade);
      const hy = graze ? h - 5 : h - 8;
      p.rect(12, hy - 1, 3, 4, c.head);
      p.rect(15, hy + 1, 1, 2, c.shade); // snout
      p.px(13, hy - 2, c.shade); // ear
      p.px(14, hy, '#1a1a1a');
      break;
    }
    case 'cow': {
      for (const [x, fwd] of [[4, true], [6, false], [14, true], [16, false]] as [number, boolean][]) leg(x, fwd, 5);
      p.rect(3, h - 13, 15, 8, c.shade);
      p.rect(3, h - 13, 14, 7, c.body);
      p.rect(3, h - 13, 14, 1, c.light);
      if (c.spot) {
        p.rect(5, h - 12, 4, 3, c.spot);
        p.rect(11, h - 10, 3, 3, c.spot);
      }
      p.rect(2, h - 12, 1, 5, c.body); // tail
      p.px(2, h - 7, c.shade);
      p.rect(9, h - 6, 3, 1, '#e8a8a0'); // udder
      const hy = graze ? h - 7 : h - 15;
      p.rect(17, hy, 4, 5, c.head);
      p.rect(20, hy + 2, 2, 3, '#e8b8a8'); // muzzle
      p.px(18, hy - 1, '#e8e0cc'); // horns
      p.px(20, hy - 1, '#e8e0cc');
      p.px(19, hy + 1, '#1a1a1a');
      break;
    }
  }
}

const cache = new Map<string, AnimalFrames>();

/** The frames for one animal (a coat picked by `n`). */
export function animalFrames(look: Look, n: number, tone: Tone, toneKey: string): AnimalFrames {
  const coats = COATS[look];
  const coat = coats[Math.abs(n) % coats.length];
  const key = `${look}|${Math.abs(n) % coats.length}|${toneKey}`;
  let f = cache.get(key);
  if (!f) {
    const [w, h] = SIZE[look];
    const frame = (step: 0 | 1, graze: boolean) => paint(w, h, tone, (p) => drawAnimal(p, look, coat, step, graze));
    f = { walk: [frame(0, false), frame(1, false)], graze: frame(0, true) };
    cache.set(key, f);
  }
  return f;
}
