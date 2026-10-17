// Stragglers (the owner's report: a shinobi and a rat still in town after several raids). Foes are owned by something:
// a raid (`s.raid.raiders`), a roaming band (`s.roamers`) or the fight it is in (`s.skirmishes`). Once an hour, in a
// town running itself, whatever has outlived its owner is sent away with a line in the journal, so a foe stuck in an
// old save (or by a case nobody has met yet) heals itself on load: a raid whose raiders are still about long after
// the clock (and the board's own stall rule) should have driven them off, a band shown as fighting a skirmish that is
// gone, and a band left long past its time. Nothing here draws from the town's stream.

import { notify, type GameState } from './state';
import { TICKS_PER_HOUR } from './time';

/** A raid's live raiders slip away this long after the clock ran out (the board's own stall rule comes at 2 hours). */
export const STRAY_RAID_HOURS = 4;
/** A band still on the land this long after its time is up goes. */
export const STRAY_BAND_HOURS = 6;

export const STRAY_LINE = 'A straggler slipped away in the night.';

/** Every hour with the autopilot on: send away whatever has outlived its owner. Returns how many. */
export function strays(s: GameState): number {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false) return 0;
  let n = 0;
  const r = s.raid;
  if (r && r.phase === 'active' && s.tick >= r.leavesTick + STRAY_RAID_HOURS * TICKS_PER_HOUR && !r.waiting && !r.parley && r.mercyAsk === undefined) {
    for (const rd of r.raiders)
      if (!rd.ally && !rd.down && !rd.gone) {
        rd.gone = true;
        n++;
      }
  }
  if (s.roamers?.length) {
    const live = new Set((s.skirmishes ?? []).filter((k) => k.ended === undefined).map((k) => k.id));
    const before = s.roamers.length;
    s.roamers = s.roamers.filter((b) => !(b.fighting !== undefined && !live.has(b.fighting)) && s.tick < b.until + STRAY_BAND_HOURS * TICKS_PER_HOUR);
    n += before - s.roamers.length;
  }
  if (n) notify(s, STRAY_LINE);
  return n;
}
