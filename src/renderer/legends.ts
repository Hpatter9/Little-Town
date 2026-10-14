// The legends of towns gone by (sim/legacy.ts), kept across towns: written when a town is set aside for a new one,
// read by the New Town screen (a descendant may found the next) and the Chronicle's Hall of Legends. The phone keeps
// them in the browser's storage; the desktop app keeps them in a file of its own (main/legends.ts) and hands them over
// the bridge (`primeLegends`). Browser storage can be missing; then there are none.

import type { Legend } from '../shared/sim/legacy';
import type { Bridge } from '../shared/ipc';

export const LEGENDS_KEY = 'littletown.legends';
/** How many towns are remembered (the oldest forgotten first; a line keeps its founders' names all the same). */
export const LEGENDS_MOST = 120;

/** The desktop app's legends, once the bridge has handed them over (null: read the browser's storage). */
let fromHost: Legend[] | null = null;
/** Bumped whenever the legends change, for the menus' redraw keys. */
let version = 0;
export const legendsVersion = () => version;

export const validLegends = (v: unknown): Legend[] =>
  Array.isArray(v) ? (v as Legend[]).filter((l) => l && typeof l.id === 'string' && typeof l.founder === 'string') : [];

export function readLegends(): Legend[] {
  if (fromHost) return fromHost.slice();
  try {
    return validLegends(JSON.parse(localStorage.getItem(LEGENDS_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

export function keepLegend(l: Legend): void {
  const all = readLegends().filter((x) => x.id !== l.id);
  all.push(l);
  version++;
  try {
    localStorage.setItem(LEGENDS_KEY, JSON.stringify(all.slice(-LEGENDS_MOST)));
  } catch {
    /* (no room: the legend is lost) */
  }
}

/** Where the bridge keeps the legends itself (the desktop app), ask for them; `then` runs once they're in. */
export function primeLegends(bridge: Pick<Bridge, 'getLegends'>, then?: () => void): void {
  if (!bridge.getLegends) return;
  void bridge
    .getLegends()
    .then((v) => {
      fromHost = validLegends(v);
      version++;
      then?.();
    })
    .catch(() => {});
}
