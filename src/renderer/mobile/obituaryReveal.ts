// Obituaries on the phone (sim/obituary.ts): a favourite's death opens their card by itself, once (`watchFavourites`,
// the ids seen kept in `littletown.favouritesMourned`); anyone else's opens from the news (`showObituary`). The card
// (mobile/revealCard.ts) has their face (drawn in the strip, `__picture({ fallen })`) and their last lines; the news
// line of their funeral has "Watch" (`__showOnMap({ funeral })`). Read-only: nothing here changes the town.

import { obituaryLines } from '../../shared/sim/obituary';
import type { Snapshot } from '../../shared/sim/snapshot';
import { showReveal } from './revealCard';

type StripWindow = Window & {
  __picture?: (p: { fallen?: number }) => HTMLCanvasElement | null;
};

/** Open someone's obituary card (false: nobody by that id among the fallen). */
export function showObituary(snap: Snapshot, id: number, strip: HTMLIFrameElement, favourite = false): boolean {
  const f = snap.annals.fallen.find((q) => q.id === id);
  if (!f) return false;
  const w = strip.contentWindow as StripWindow | null;
  const face = w?.__picture?.({ fallen: id }) ?? null;
  const lines = obituaryLines(f);
  showReveal({
    kind: favourite ? '♥ In memory' : 'In memory',
    title: f.name,
    lore: (favourite ? [...lines, 'Your place among the followed is free. Watch their funeral from the news.'] : lines).join(' '),
    art: face, // (their portrait canvas, painted as its layers load)
    tone: 'dark',
    ...(favourite ? { key: `obit:${id}` } : {}), // (a tap in the news may open it again; the favourite's own card shows once)
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
      if (seen.includes(id)) continue;
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
