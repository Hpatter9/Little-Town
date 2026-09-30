// The way out of the Stone Age runs through the Bear Cave: the Elder Lodge needs its totem. A party can fetch it
// (the player sends it, from the Expedition Board), but a town left to itself never goes. So once the town has
// learned the Elder's Council and still has no totem a day and a half later, with no party on its way to the cave,
// the Cave Bear comes down to the town itself. Beat it, and the totem it guards is the town's; lose, and it comes
// again another day and a half on.

import { RAID_KIND_BY_ID } from '../data/raids';
import type { Rng } from '../rng';
import { depositNear, totalStock } from './buildings';
import { startRaid } from './raids';
import { campX, notify, type GameState, type Raid } from './state';
import { TICKS_PER_HOUR } from './time';

/** Game hours from learning the Elder's Council (or from the last time it came) to the Cave Bear coming down. */
export const BEAR_WAIT_HOURS = 36;

/** Whether the town still wants the totem, and nobody's gone for it. */
function wantsTotem(s: GameState): boolean {
  if (s.era !== 'neolithic' || !s.research.done.includes('elders_council')) return false;
  if ((totalStock(s).totem ?? 0) > 0) return false;
  if (s.buildings.some((b) => b.def === 'elder_lodge' && (b.status === 'done' || (b.delivered.totem ?? 0) > 0))) return false;
  return !s.expeditions.some((e) => e.dest === 'bear_cave');
}

/** Once an hour: the Cave Bear's clock, and when it runs out, the bear (never during another raid). */
export function caveBear(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.gameOver) return;
  if (!wantsTotem(s)) {
    s.caveBearTick = undefined;
    return;
  }
  if (s.caveBearTick === undefined) {
    s.caveBearTick = s.tick + BEAR_WAIT_HOURS * TICKS_PER_HOUR;
    return;
  }
  if (s.tick < s.caveBearTick || s.raid) return;
  s.caveBearTick = s.tick + BEAR_WAIT_HOURS * TICKS_PER_HOUR;
  startRaid(s, RAID_KIND_BY_ID.cave_bear, 1, rng);
  notify(s, 'Nobody went to the Bear Cave, so the Cave Bear is coming to the town, the totem still hanging from its neck!', true);
}

/** The Cave Bear's raid is over: if it was killed, the town has the totem. */
export function caveBearBeaten(s: GameState, r: Raid): void {
  if (r.kind !== 'cave_bear') return;
  const bear = r.raiders.find((q) => q.kind === 'cave_bear' && !q.ally);
  if (!bear?.down) {
    notify(s, 'The Cave Bear lumbers back to its cave, the totem with it. It will be back.', true);
    return;
  }
  depositNear(s, campX(s), { totem: 1 });
  notify(s, 'The Cave Bear is dead, and the totem is the town\'s: the elders can raise their lodge.', true);
}
