// The legends of towns gone by (sim/legacy.ts), kept on the device across towns: written by the phone page when a town
// is set aside for a new one, read by the New Town screen (a descendant may found the next) and the Chronicle's Hall of
// Legends. Browser storage can be missing; then there are none.

import type { Legend } from '../shared/sim/legacy';

export const LEGENDS_KEY = 'littletown.legends';
const MOST = 40;

export function readLegends(): Legend[] {
  try {
    const v = JSON.parse(localStorage.getItem(LEGENDS_KEY) ?? '[]');
    return Array.isArray(v) ? (v as Legend[]).filter((l) => l && typeof l.id === 'string' && typeof l.founder === 'string') : [];
  } catch {
    return [];
  }
}

export function keepLegend(l: Legend): void {
  const all = readLegends().filter((x) => x.id !== l.id);
  all.push(l);
  try {
    localStorage.setItem(LEGENDS_KEY, JSON.stringify(all.slice(-MOST)));
  } catch {
    /* (no room: the legend is lost) */
  }
}
