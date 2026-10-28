// The player's building wishes: a building pinned in the Building book is built next as soon as the town can (the
// planner's planPins in planner.ts finds it a spot and gathers its makings); when it stands, or can't be had, the
// Journal says so and the pin goes.

import { BUILDING_BY_ID, type BuildingDef } from '../data/buildings';
import { isSeat } from '../data/seats';
import { isRingPiece } from './ringWall';
import { isUnlocked, unlockInfo } from './buildings';
import { notify, type GameState, type Pin } from './state';
import { TICKS_PER_HOUR } from './time';

/** At most this many orders waiting or under way at once (the owner's ask: a good number lined up; it was 5). The same
 *  building may be ordered more than once (three houses). */
export const PINS_MOST = 20;
/** An order not started in this long is given up. Waiting its turn in the queue (every building slot busy) doesn't
 *  count: only time stuck on something else (no room, nothing to build it with). */
export const PIN_WAIT_HOURS = 72;
/** What an order waiting its turn says (every building slot busy). */
export const SLOT_WAIT = 'waiting for a free building slot';

/** Why a building can't be pinned at all (null: it can). */
export function pinRefusal(s: GameState, def: BuildingDef | undefined): string | null {
  if (!def) return 'Unknown building';
  if (def.never || isSeat(def.id)) return 'The town raises that itself';
  if (isRingPiece(def.id) || (def.hp && def.width === 1 && !def.defense)) return 'Walls and gates are built as the ring wall';
  if (!isUnlocked(unlockInfo(s), def)) return 'Not learned yet';
  if ((s.pins ?? []).length >= PINS_MOST) return `At most ${PINS_MOST} orders at once`;
  return null;
}

/** Pin (on) or unpin a building: put at the end of the queue. Unpinned, one order (`id`; without it, every order of
 *  that building, as older callers did) is taken out; a blueprint already laid for it stays, as the town's own. */
export function setPin(s: GameState, defId: string, on: boolean, id?: number): string | null {
  if (!on) {
    s.pins = (s.pins ?? []).filter((p) => p.def !== defId || (id !== undefined && p.id !== id));
    return null;
  }
  const def = BUILDING_BY_ID[defId];
  const no = pinRefusal(s, def);
  if (no) return no;
  (s.pins ??= []).push({ def: defId, at: s.tick, id: s.nextId++ });
  return null;
}

/** The wishes' news: finished, lost or given up. Hourly-ish, from the planner. */
export function tendPins(s: GameState): void {
  if (!s.pins?.length) return;
  const keep: Pin[] = [];
  for (const p of s.pins) {
    const def = BUILDING_BY_ID[p.def];
    const b = p.building !== undefined ? s.buildings.find((q) => q.id === p.building) : undefined;
    if (p.building !== undefined) {
      if (b && b.status === 'done') {
        notify(s, `Your wish is built: the ${def.name} stands.`, true);
        continue;
      }
      if (!b || b.def !== p.def) {
        notify(s, `The ${def.name} you wished for couldn't be finished: its site was given up.`, true);
        continue;
      }
    } else if (p.why !== SLOT_WAIT && s.tick - p.at > PIN_WAIT_HOURS * TICKS_PER_HOUR) {
      notify(s, `The ${def.name} you wished for can't be built for now${p.why ? ` (${p.why})` : ''}. The wish is set aside.`, true);
      continue;
    }
    keep.push(p);
  }
  s.pins = keep;
}

/** Whether a blueprint is one the player wished for (the planner never sets it aside). */
export const pinned = (s: GameState, id: number) => (s.pins ?? []).some((p) => p.building === id);
