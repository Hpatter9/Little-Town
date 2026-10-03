// Things that come alive inside the town, with no warning from the lookout: a chest a traveller left at the shop that
// turns out to be a Mimic (it comes out at night), and a library's tomes, possessed, flying at whoever is studying
// them. Each is a raid that starts in the middle of town. Beaten, they pay: the mimic's hoard of coins, and the
// tomes' secrets (every topic being studied jumps halfway to done).

import { BUILDING_BY_ID } from '../data/buildings';
import { RAID_KIND_BY_ID } from '../data/raids';
import { RESEARCH_STATIONS } from '../data/research';
import type { Rng } from '../rng';
import { buildingDoor } from './buildings';
import { startRaid } from './raids';
import { shopOf } from './shop';
import { notify, type GameState, type Raid } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

/** Chance each night hour, with a shop, that a chest left there is a mimic (about one a fortnight). */
export const MIMIC_PER_NIGHT_HOUR = 1 / 90;
/** Chance each hour, with someone studying at a library or better, that its tomes wake (about one a week or two). */
export const TOMES_PER_HOUR = 1 / 250;
/** What a mimic's belly holds, in coins; how much of what's left of each topic being studied the tomes give. */
export const MIMIC_HOARD = 45;
export const TOME_SECRETS = 0.5;

/** Once an hour: something may wake inside the town (never during a raid). */
export function lurkers(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.raid || s.gameOver || s.tick < 2 * 24 * TICKS_PER_HOUR) return;
  const hour = calendar(s.tick).hour;
  const shop = shopOf(s);
  if (shop && (hour >= 22 || hour < 4) && rng.chance(MIMIC_PER_NIGHT_HOUR)) {
    startRaid(s, RAID_KIND_BY_ID.mimic, 30, rng, buildingDoor(shop));
    notify(s, `A chest a traveller left at the ${BUILDING_BY_ID[shop.def].name} has teeth! A Mimic!`, true);
    return;
  }
  const study = s.buildings.find(
    (b) => b.status === 'done' && (RESEARCH_STATIONS[b.def]?.mult ?? 0) >= 2 && s.people.some((p) => p.away === null && p.task?.type === 'research' && p.task.station === b.id),
  );
  if (study && rng.chance(TOMES_PER_HOUR)) {
    startRaid(s, RAID_KIND_BY_ID.tomes, 24, rng, buildingDoor(study));
    notify(s, `The books of the ${BUILDING_BY_ID[study.def].name} tear themselves off the shelves and fly at the scholars!`, true);
  }
}

/** A lurker raid is over: if they were all killed, the town has what they held. */
export function lurkersBeaten(s: GameState, r: Raid): void {
  const foes = r.raiders.filter((q) => !q.ally);
  if (!foes.length || !foes.every((q) => q.down)) return;
  if (r.kind === 'mimic') {
    s.coins = (s.coins ?? 0) + MIMIC_HOARD;
    notify(s, `The Mimic is dead. In its belly: ${MIMIC_HOARD} coins, and the bones of whoever opened it last.`, true);
  } else if (r.kind === 'tomes') {
    const topics = Object.keys(s.research.progress);
    for (const t of topics) s.research.progress[t] += (1 - s.research.progress[t]) * TOME_SECRETS;
    notify(s, topics.length ? 'The tomes lie still, and give up their secrets: the scholars are halfway closer to everything they study.' : 'The tomes lie still.', true);
  }
}
