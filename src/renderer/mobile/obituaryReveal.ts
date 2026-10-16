// Obituaries on the phone (sim/obituary.ts): a favourite's death opens their card by itself, once (`watchFavourites`,
// the ids seen kept in `littletown.favouritesMourned`); anyone else's opens from the news (`showObituary`). The card
// has their face (drawn in the strip, `__picture({ fallen })`), their last lines, and one button, "Watch", that takes
// the camera to their funeral, or their grave (`__showOnMap({ funeral })`). Read-only: nothing here changes the town.

import { obituaryLines } from '../../shared/sim/obituary';
import type { Snapshot } from '../../shared/sim/snapshot';
import { showReveal } from './revealStub';

type StripWindow = Window & {
  __picture?: (p: { fallen?: number }) => HTMLCanvasElement | null;
  __showOnMap?: (a: { funeral?: number }) => boolean;
};

/** Open someone's obituary card (false: nobody by that id among the fallen). */
export function showObituary(snap: Snapshot, id: number, strip: HTMLIFrameElement, favourite = false): boolean {
  const f = snap.annals.fallen.find((q) => q.id === id);
  if (!f) return false;
  const w = strip.contentWindow as StripWindow | null;
  const art = w?.__picture?.({ fallen: id }) ?? null;
  const lines = obituaryLines(f);
  showReveal({
    key: `obit:${id}`,
    kicker: favourite ? '♥ In memory' : 'In memory',
    title: f.name,
    lines: favourite ? [...lines, 'Your place among the followed is free.'] : lines,
    art,
    tone: 'red',
    actions: [{ label: 'Watch', run: () => void w?.__showOnMap?.({ funeral: id }) }],
  });
  return true;
}

const MOURNED = 'littletown.favouritesMourned';

/** On each snapshot: a favourite who has died since is shown their card, once. */
export function watchFavourites(strip: HTMLIFrameElement): (snap: Snapshot) => void {
  let seen: number[] = [];
  try {
    seen = JSON.parse(localStorage.getItem(MOURNED) ?? '[]') as number[];
  } catch {
    /* (no storage) */
  }
  return (snap) => {
    // (once the strip can draw their face)
    if (!(strip.contentWindow as StripWindow | null)?.__picture) return;
    for (const id of snap.favouritesGone ?? []) {
      if (seen.includes(id) || snap.catchingUp != null) continue;
      if (!showObituary(snap, id, strip, true)) continue;
      seen = [...seen, id].slice(-20);
      try {
        localStorage.setItem(MOURNED, JSON.stringify(seen));
      } catch {
        /* (no storage) */
      }
    }
  };
}
