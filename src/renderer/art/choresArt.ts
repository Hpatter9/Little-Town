// The pack sprites behind the work you can see (map/mapFelling.ts, mapStockpile.ts, mapGains.ts, mapChores.ts): the
// Fields tileset's stump, logs, crates, stones and flag, the Village tileset's barrel, crate, log bundle, stump with its
// axe and bucket, the Glassblower's Workshop's sacks, and two haystacks from the Medieval Field Work set
// shrunk to the map's pixel (see CREDITS.md). Loaded once; `choresTex` is empty until they come.

import { Rectangle, Texture } from 'pixi.js';
import { loadImage } from './loadImage';
import stump from './packs/f_stump.png';
import log1 from './packs/f_log1.png';
import log3 from './packs/f_log3.png';
import box1 from './packs/f_box1.png';
import logpile from './packs/v_logpile.png';
import bucket from './packs/v_bucket.png';
import sacks from './shops/gb_sacks.png';
import rubble1 from './chores/rubble1.png';
import rubble2 from './chores/rubble2.png';
import rubble3 from './chores/rubble3.png';
import rubble4 from './chores/rubble4.png';
import flag from './chores/flag.png';
import box3 from './chores/box3.png';
import log4 from './chores/log4.png';
import barrel from './chores/barrel.png';
import crate from './chores/crate.png';
import logs from './chores/logs.png';
import stumpAxe from './chores/stump_axe.png';
import hayHeap from './chores/hay_heap.png';
import hayBale from './chores/hay_bale.png';

const URLS = { stump, log1, log3, box1, logpile, bucket, sacks, rubble1, rubble2, rubble3, rubble4, flag, box3, log4, barrel, crate, logs, stumpAxe, hayHeap, hayBale };
export type ChoresArt = keyof typeof URLS;

const tex: Partial<Record<ChoresArt, Texture>> = {};
const waiting: (() => void)[] = [];
let asked = false;

/** The sprites by name (an empty record until they've loaded); `then` is told once when they have. */
export function choresTex(then?: () => void): Partial<Record<ChoresArt, Texture>> {
  if (then && !Object.keys(tex).length) waiting.push(then);
  if (!asked) {
    asked = true;
    Promise.all(
      (Object.entries(URLS) as [ChoresArt, string][]).map(([k, u]) =>
        loadImage(u).then((im) => {
          const t = Texture.from(im);
          t.source.scaleMode = 'nearest';
          return [k, t] as const;
        }),
      ),
    ).then(
      (all) => {
        for (const [k, t] of all) tex[k] = t;
        for (const f of waiting.splice(0)) f();
      },
      () => undefined,
    );
  }
  return tex;
}

/** One frame of the Fields pack's waving banner (six frames of 32x64 in one strip). */
const flagFrames: Texture[] = [];
export function flagFrame(n: number): Texture | null {
  const t = tex.flag;
  if (!t) return null;
  if (!flagFrames.length) for (let i = 0; i < 6; i++) flagFrames.push(new Texture({ source: t.source, frame: new Rectangle(i * 32, 0, 32, 64) }));
  return flagFrames[((n % 6) + 6) % 6];
}
