// What the watched delve shows in each room (see fight/fightView.ts), from Craftpix's free 2D Top-Down Pixel Dungeon
// pack (a door and a chest opening, wall torches and braziers, all seen side-on) and its Pixel Dungeon Props pack (a
// skull altar for the shrines, a swinging guillotine for the traps).

import { Rectangle, Texture } from 'pixi.js';
import { loadImage } from './loadImage';
import doorsUrl from './delve/doors.png';
import firesUrl from './delve/fires.png';
import skullUrl from './delve/skull.png';
import guillotineUrl from './delve/guillotine.png';

export type DelveProp = 'door' | 'chest' | 'gate' | 'torch' | 'brazier' | 'skull' | 'blade';
/** Each prop's frames: the sheet, frame size, and where each frame is (column, row). */
const DEFS: Record<DelveProp, { url: string; w: number; h: number; at: [number, number][] }> = {
  door: { url: doorsUrl, w: 32, h: 32, at: [0, 1, 2, 3, 4].map((c) => [c, 1]) },
  gate: { url: doorsUrl, w: 32, h: 32, at: [0, 1, 2, 3, 4].map((c) => [c, 2]) },
  chest: { url: doorsUrl, w: 32, h: 32, at: [0, 1, 2, 3, 4].map((c) => [c, 4]) },
  torch: { url: firesUrl, w: 44, h: 48, at: [0, 1, 2, 3, 4, 5].map((r) => [1, r]) },
  brazier: { url: firesUrl, w: 44, h: 48, at: [0, 1, 2, 3, 4, 5].map((r) => [2, r]) },
  skull: { url: skullUrl, w: 48, h: 48, at: [0, 1, 2].flatMap((r) => [[0, r], [1, r]] as [number, number][]) },
  blade: { url: guillotineUrl, w: 48, h: 48, at: Array.from({ length: 12 }, (_, c) => [c, 0] as [number, number]) },
};
const frames: Partial<Record<DelveProp, Texture[]>> = {};
let asked = false;

/** Load the props (once; frames are null until they're in). */
export function loadDelveProps(): void {
  if (asked) return;
  asked = true;
  const byUrl = new Map<string, Promise<HTMLImageElement>>();
  for (const [id, d] of Object.entries(DEFS) as [DelveProp, (typeof DEFS)[DelveProp]][]) {
    let p = byUrl.get(d.url);
    if (!p) byUrl.set(d.url, (p = loadImage(d.url)));
    p.then((im) => {
      const source = Texture.from(im).source;
      frames[id] = d.at.map(([c, r]) => new Texture({ source, frame: new Rectangle(c * d.w, r * d.h, d.w, d.h) }));
    }, () => undefined);
  }
}

/** Frame `i` of a prop (clamped to its last frame), or null before loading. */
export function propFrame(id: DelveProp, i: number): Texture | null {
  const list = frames[id];
  return list?.length ? list[Math.max(0, Math.min(list.length - 1, Math.floor(i)))] : null;
}
/** Frame `i` of a prop that loops. */
export function propLoop(id: DelveProp, i: number): Texture | null {
  const list = frames[id];
  return list?.length ? list[((Math.floor(i) % list.length) + list.length) % list.length] : null;
}
